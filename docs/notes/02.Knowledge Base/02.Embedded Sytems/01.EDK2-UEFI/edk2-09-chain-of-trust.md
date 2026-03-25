---
title: Chain of Trust Boot
createTime: 2026/03/23 00:00:00
permalink: /kb/embedded/edk2/chain-of-trust/
---

# Chain of Trust Boot

## What Chain of Trust Means

A Chain of Trust (CoT) is a cryptographic authentication chain where every stage of the boot process verifies the next stage before executing it. No stage runs unless the previous stage has confirmed its integrity. The chain is rooted in an immutable trust anchor — typically one-time-programmable (OTP) fuses or write-protected ROM that the attacker cannot modify.

Without a Chain of Trust, an attacker who gains write access to any firmware component (NOR flash, eMMC boot partition, SD card) can permanently compromise the device without detection.

```
OTP Fuses / Boot ROM (immutable hardware root of trust)
      │  contains public key hash
      │  verifies
      ▼
BL1 / Boot ROM firmware
      │  verifies
      ▼
BL2 (TF-A Trusted Boot Firmware) — or vendor equivalent
      │  verifies
      ▼
BL31 (TF-A Runtime EL3 Monitor)  +  BL32 (Secure OS, optional)
      │  verifies
      ▼
BL33 = EDK2 / UEFI firmware (Normal World)
      │  verifies (UEFI Secure Boot)
      ▼
OS Bootloader (GRUB / systemd-boot / Windows Boot Manager)
      │  verifies
      ▼
OS Kernel + initramfs
```

---

## TF-A Chain of Trust Framework

ARM Trusted Firmware-A (TF-A) implements the Chain of Trust through its **CoT framework** in `drivers/auth/`. The framework is driven by a **CoT descriptor** defined in C — a table of authentication methods and expected outputs.

### TBBR (Trusted Board Boot Requirements)

The ARM TBBR specification defines the certificate chain format. Certificates are X.509, signed by the platform Root-of-Trust Public Key (ROTPK).

```
ROTPK Hash (stored in OTP fuses)
    │
    │ validates
    ▼
Trusted Key Certificate (self-signed by ROTPK)
    ├── Contains: Trusted World Public Key, Non-Trusted World Public Key
    │
    ├── Trusted FW Key Certificate (signed by Trusted World Key)
    │   └── Trusted Boot Firmware Content Certificate
    │       ├── BL2 hash
    │       ├── BL31 hash
    │       └── BL32 hash (SCP/OP-TEE)
    │
    └── Non-Trusted FW Key Certificate (signed by Non-Trusted World Key)
        └── Non-Trusted Boot Content Certificate
            └── BL33 (EDK2) hash
```

Each certificate is an EFI Signature List embedded in a PKCS#7 structure, chained via X.509 field `authorityKeyIdentifier`.

### TF-A CoT Descriptor (Code)

In TF-A source (`drivers/auth/tbbr/tbbr_cot_bl1.c`, `tbbr_cot_bl2.c`):

```c
// Simplified example: authenticating BL2
static const auth_img_desc_t bl2_desc = {
  .img_id = BL2_IMAGE_ID,
  .img_type = IMG_RAW,
  .parent = &trusted_boot_fw_cert,  // BL2 is authenticated by this cert
  .img_auth_methods = (const auth_method_desc_t[AUTH_METHOD_NUM]) {
    [0] = {
      .type = AUTH_METHOD_HASH,
      .param.hash = {
        .data = &raw_data,
        .hash = &tb_fw_hash,   // hash extracted from parent certificate
      },
    },
  },
};
```

The authentication dispatch:

```
BL1 loads BL2 image + Trusted Boot Firmware Cert
    │
    ├── auth_mod_verify_img(BL2_IMAGE_ID)
    │   ├── Locate parent: Trusted Boot FW Cert
    │   ├── Verify cert signature against Trusted Key (from Trusted Key Cert)
    │   ├── Extract BL2 hash from cert Subject Alt Name extension
    │   └── Compute SHA-256 of loaded BL2 binary
    │       └── Compare → PASS/FAIL
    │
PASS → execute BL2
FAIL → platform fatal error (ROTPK hash mismatch → halt, log, or recover)
```

### Building TF-A with CoT Enabled

```bash
# In TF-A build:
make PLAT=qemu \
     BL33=Build/ArmVirtQemu/RELEASE_GCC5/FV/QEMU_EFI.fd \
     TRUSTED_BOARD_BOOT=1 \
     GENERATE_COT=1 \
     ROT_KEY=keys/rotpk.pem \
     MBEDTLS_DIR=/path/to/mbedtls \
     all fip

# GENERATE_COT=1: TF-A's cert_create tool generates the certificate chain
# ROT_KEY: RSA private key for the Root-of-Trust; hash burned to OTP in production
```

The built FIP (Firmware Image Package) contains:
```
fip.bin
├── bl2.bin              (authenticated by BL1)
├── bl31.bin             (authenticated by BL2)
├── bl33.bin = EDK2      (authenticated by BL2 via Non-Trusted Content Cert)
├── trusted-key-cert     (X.509)
├── soc-fw-key-cert      (X.509)
├── tos-fw-key-cert      (X.509, if BL32 present)
├── nt-fw-key-cert       (X.509)
├── tb-fw-cert           (X.509: contains BL31 hash)
└── nt-fw-cert           (X.509: contains BL33=EDK2 hash)
```

---

## Measured Boot and TPM 2.0

Measured Boot is complementary to Verified Boot. While Verified Boot *prevents* loading untrusted firmware, Measured Boot *records* what was loaded. This enables **remote attestation** — a remote verifier can cryptographically prove that a device booted a specific, known-good software stack.

### PCR (Platform Configuration Register) Layout

TPM 2.0 PCRs are 32-byte SHA-256 registers that can only be extended (never written directly):

```
New_PCR_value = SHA-256(Old_PCR_value || Measurement)
```

| PCR Index | What Gets Measured |
|-----------|-------------------|
| 0 | Core UEFI firmware (SRTM: EFI firmware executables) |
| 1 | UEFI firmware configuration (UEFI variables, BIOS settings) |
| 2 | Option ROMs (disk controllers, NICs) |
| 3 | Option ROM configuration and data |
| 4 | IPL (MBR, UEFI applications in boot sequence) |
| 5 | IPL configuration (GPT, boot variables) |
| 6 | State transitions and wake events |
| 7 | Secure Boot state (policy, keys: db/dbx hashes) |
| 8–15 | OS-controlled (used by bootloader, kernel) |

### EDK2 TPM 2.0 Integration (SecurityPkg)

EDK2 provides the `Tcg2Dxe` driver (`SecurityPkg/Tcg/Tcg2Dxe/`) which:

1. Initializes the TPM 2.0 device at DXE startup
2. Measures the UEFI firmware to PCR[0]
3. Measures UEFI variables (Boot####, BootOrder) to PCR[1]
4. Measures all loaded UEFI drivers to PCR[2]
5. Registers as `EFI_TCG2_PROTOCOL` for use by OS and applications

```ini
# DSC: Enable TPM 2.0 Measured Boot
[Components]
  SecurityPkg/Tcg/Tcg2Dxe/Tcg2Dxe.inf {
    <LibraryClasses>
      Tpm2DeviceLib|SecurityPkg/Library/Tpm2DeviceLibDTpm/Tpm2DeviceLibDTpm.inf
      HashLib|SecurityPkg/Library/HashLibBaseCryptoRouter/HashLibBaseCryptoRouterDxe.inf
      Tpm2CommandLib|SecurityPkg/Library/Tpm2CommandLib/Tpm2CommandLib.inf
  }
  # TPM 2.0 physical device driver (for discrete TPM on SPI/I2C bus)
  SecurityPkg/Tcg/Tcg2Smm/Tcg2Smm.inf  # x86 SMM-based TPM support
  # OR for ARM:
  SecurityPkg/Tcg/Tcg2Pei/Tcg2Pei.inf  # PEI-phase TPM init
```

### TPM Measurement API Usage

```c
#include <Protocol/Tcg2Protocol.h>

EFI_TCG2_PROTOCOL *Tcg2;

gBS->LocateProtocol (&gEfiTcg2ProtocolGuid, NULL, (VOID **)&Tcg2);

// Extend a PCR with a hash event
EFI_TCG2_EVENT *TcgEvent;
UINTN EventSize = sizeof (EFI_TCG2_EVENT) + sizeof (UEFI_IMAGE_LOAD_EVENT);

// Allocate and populate TcgEvent...
TcgEvent->Header.HeaderSize    = sizeof (EFI_TCG2_EVENT_HEADER);
TcgEvent->Header.HeaderVersion = EFI_TCG2_EVENT_HEADER_VERSION;
TcgEvent->Header.PCRIndex      = 4;
TcgEvent->Header.EventType     = EV_EFI_BOOT_SERVICES_APPLICATION;

Tcg2->HashLogExtendEvent (
  Tcg2,
  0,                          // Flags
  (EFI_PHYSICAL_ADDRESS)(UINTN) ImageBase,
  ImageSize,
  TcgEvent
);
```

---

## EDK2 VerifiedBoot (Standalone from TPM)

For embedded targets without a hardware TPM, EDK2's `SecurityPkg` provides firmware-only verified boot:

### ImageVerificationLib

```ini
[Components]
  # This library hooks into EFI_SECURITY2_ARCH_PROTOCOL
  SecurityPkg/Library/DxeImageVerificationLib/DxeImageVerificationLib.inf

[LibraryClasses.common.DXE_DRIVER]
  SecurityManagementLib|MdeModulePkg/Library/DxeSecurityManagementLib/DxeSecurityManagementLib.inf
```

At image load time, `DxeImageVerificationLib.FileAuthentication()` checks:
1. Does the image have a `WIN_CERTIFICATE` (embedded PKCS#7 signature)?
2. Is the signing cert in `db` and *not* in `dbx`?
3. If no signature: is the SHA-256 hash of the image in `db`?

### Authenticated Variables Locking

A critical hardening step: after all DXE drivers are loaded, variable writes must be restricted. The `VariableLockRequestToLock()` API prevents any further updates to Secure Boot key databases after `BdsReadyToLock` event:

```c
// In a DXE driver, register for BdsReadyToLock:
EFI_EVENT ReadyToLockEvent;
gBS->CreateEventEx (
  EVT_NOTIFY_SIGNAL,
  TPL_CALLBACK,
  OnReadyToLock,
  NULL,
  &gEfiEndOfDxeEventGroupGuid,  // End of DXE event group
  &ReadyToLockEvent
);

VOID EFIAPI OnReadyToLock (IN EFI_EVENT Event, IN VOID *Context) {
  EDKII_VARIABLE_LOCK_PROTOCOL *VariableLock;
  gBS->LocateProtocol (&gEdkiiVariableLockProtocolGuid, NULL, (VOID **)&VariableLock);
  
  // Lock custom platform variables that should not be modified after boot
  VariableLock->RequestToLock (VariableLock, L"MySoCPlatformConfig", &gMySoCGuid);
}
```

---

## Intel Boot Guard

Intel Boot Guard (IBGd) is Intel's ROM-based CoT mechanism for x86. Unlike TF-A which is software-configurable, Boot Guard is blown into CPU fuses at manufacturing time.

### Boot Guard Profiles

| Profile | BG Verified | BG Measured | Effect |
|---------|-------------|-------------|--------|
| FACB (0) | No | No | Legacy; no Boot Guard |
| Measured only (3) | No | Yes | PCR[0] extended with IBBL hash |
| Verified only (5) | Yes | No | ACM verifies IBBL; halt on fail |
| Verified + Measured (7) | Yes | Yes | Full Boot Guard |

### Boot Guard and EDK2

Boot Guard authenticates the Initial Boot Block (IBB) — the first firmware block that runs from the SPI flash. This is typically the `SECFV` region containing the SEC module. The IBB hash is programmed into CPU fuses, so even if the SPI flash is reflashed with modified firmware, the modified SECFV hash will not match the fused hash and the system will halt.

EDK2 platforms targeting Intel hardware with Boot Guard:
1. Must **not** compress the SECFV (it must be directly hashable)
2. Cannot self-relocate the IBB in FDF
3. Must keep SEC module code footprint stable across firmware updates

---

## Full CoT Stack: AR Embedded Platform Example

```
OTP Fuse: SHA-256 of ROTPK_cert
    │
    │  (burned at manufacturing, eFUSE or OTP)
    ▼
Boot ROM (mask ROM, immutable)
    │  loads and verifies BL2 against fused ROTPK hash
    △  Failure → CPU halts, log to secure debug port
    ▼
TF-A BL2 (authenticated by Boot ROM)
    │  verifies BL31 hash (from Trusted Content Certificate)
    │  verifies EDK2 (BL33) hash (from Non-Trusted Content Certificate)
    △  Failure → BL2 calls plat_error_handler() → platform-defined secure shutdown
    ▼
TF-A BL31 (EL3 monitor, S-EL1/EL2 isolation)
    ▼
EDK2 UEFI (EL2, Normal World)
    │  UEFI Secure Boot: checks db/dbx for every .efi loaded
    │  Measured Boot: Tcg2Dxe extends TPM 2.0 PCRs
    │  VariableLock: ReadyToLock seals db/dbx after DXE completes
    △  Failure → EFI_SECURITY_VIOLATION → boot option skipped
    ▼
GRUB2 / shim (signed by db key)
    │  Verifies kernel image (via shim lockdown + MOK list)
    ▼
Linux kernel (signed by distribution key)
    │  Extends PCR[8] with kernel command line
    │  Extends PCR[9] with initramfs
    ▼
User space (integrity verified by IMA/dm-verity)
```

### Remote Attestation After Boot

```
Device                              Attestation Server
  │  generate_attestation_quote()         │
  │  TPM2_Quote(PCRs 0-15, nonce=N)      │
  │──────────── quote + cert ────────────▶│
  │                                       │  verify quote signature
  │                                       │  vs. known-good PCR values
  │                                       │  (reference measurement database)
  │◀──────── PASS/FAIL + session key ─────│
```

The TPM 2.0 Quote is signed by the TPM's Attestation Identity Key (AIK), whose certificate is signed by the TPM manufacturer (Infineon, NuvoTon, etc.). The attestation server verifies the AIK cert chain, then trusts the PCR values reported.
