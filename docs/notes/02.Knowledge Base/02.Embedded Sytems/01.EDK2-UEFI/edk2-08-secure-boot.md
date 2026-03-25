---
title: UEFI Secure Boot
createTime: 2026/03/23 00:00:00
permalink: /kb/embedded/edk2/secure-boot/
---

# UEFI Secure Boot

## What Secure Boot Enforces

UEFI Secure Boot is an integrity verification mechanism defined in the UEFI specification (§32). Before UEFI loads any executable — a bootloader, OS loader, UEFI driver, or option ROM — it verifies the binary's cryptographic signature against an authorized key database. If verification fails, the executable is refused.

Secure Boot does **not** prevent booting a different OS. It prevents loading unsigned or improperly signed code. A user can enroll their own keys (in UEFI Setup mode) to authorize any code they trust.

---

## Key Hierarchy

Secure Boot uses a four-tier key hierarchy. Each tier authorizes the one below it.

```
Platform Key (PK)
    │  owns + authorizes
    ▼
Key Exchange Key (KEK)
    │  authorizes updates to
    ▼
Signature Database (db)    Forbidden Signature Database (dbx)
    │                               │
    │ authorizes loading            │ blocks loading (blacklist)
    ▼                               ▼
UEFI executables (PE/COFF .efi binaries)
```

### Platform Key (PK)

- Exactly **one** PK is enrolled at any time
- Issued and held by the platform owner (OEM, enterprise IT, or user for custom builds)
- Changing the PK requires physical presence (user must press a button in UEFI setup — called "Setup Mode")
- Implemented as a `PK` UEFI authenticated variable
- Key type: X.509 certificate (typically RSA-2048 or RSA-4096)

### Key Exchange Key (KEK)

- One or more KEKs; each is an X.509 cert or a raw SHA-256 hash
- KEK holders can update `db` and `dbx` without re-enrolling PK
- Microsoft's KEK (`77fa9abd-0359-4d32-bd60-28f4e78f784b`) is pre-enrolled on most commercial hardware, allowing Microsoft to push `db`/`dbx` updates via Windows Update

### Signature Database (db)

- Contains the public keys and/or SHA-256 hashes of **allowed** executables
- An executable is trusted if: its signing certificate chains to an entry in `db`, OR its SHA-256 image hash is directly in `db`
- Key types allowed: X.509 cert, SHA-1/SHA-256 hash, RSA-2048 hash

### Forbidden Signature Database (dbx)

- Contains revoked certificates and image hashes
- Checked **before** `db` — if a match is found in `dbx`, the executable is blocked even if it would pass `db`
- Critical security mechanism: when a bootloader vulnerability is discovered (e.g., BootHole/GRUB 2020), the affected binary hash or signing cert is added to `dbx` and pushed to all systems via Windows Update

### Additional Databases

| Variable | Purpose |
|----------|---------|
| `dbr` (dbt) | Boot recovery database; used when booting recovery paths |
| `dbt` (MOK) | Third-party database for MOK (Machine Owner Key) shim mechanism |
| `MokList` | Machine Owner Key list maintained by Linux shim, not UEFI firmware |

---

## UEFI Variable Security Model

Secure Boot keys are stored in authenticated UEFI non-volatile variables. Each is a `EFI_SIGNATURE_LIST` structure:

```c
// UEFI Spec: Authentication 2 Descriptor
typedef struct {
  EFI_GUID          SignatureType;    // cert type or hash type GUID
  UINT32            SignatureListSize;
  UINT32            SignatureHeaderSize;
  UINT32            SignatureSize;
  // EFI_SIGNATURE_DATA[] follows:
  //   EFI_GUID  SignatureOwner;  (identifies who enrolled this entry)
  //   UINT8     SignatureData[]; (DER-encoded X.509 cert or hash bytes)
} EFI_SIGNATURE_LIST;
```

These variables have the `EFI_VARIABLE_TIME_BASED_AUTHENTICATED_WRITE_ACCESS` attribute. Any attempt to update them must include a valid `EFI_VARIABLE_AUTHENTICATION_2` header — a PKCS#7 signature using the corresponding authorization key (PK for KEK updates, KEK for db/dbx updates).

---

## Generating Secure Boot Keys

All keys are X.509 certificates backed by RSA private keys. Use OpenSSL:

```bash
# Step 1: Generate Platform Key (PK)
openssl req -newkey rsa:4096 -nodes -keyout PK.key -new -x509 -sha256 \
    -days 3650 \
    -subj "/CN=MySoC Platform Key/" \
    -out PK.crt

# Step 2: Generate Key Exchange Key (KEK)
openssl req -newkey rsa:4096 -nodes -keyout KEK.key -new -x509 -sha256 \
    -days 3650 \
    -subj "/CN=MySoC Key Exchange Key/" \
    -out KEK.crt

# Step 3: Generate Image Signing Key (db key)
openssl req -newkey rsa:4096 -nodes -keyout db.key -new -x509 -sha256 \
    -days 3650 \
    -subj "/CN=MySoC Signing Key/" \
    -out db.crt

# Convert to DER format (EDK2 tools expect DER)
openssl x509 -in PK.crt  -outform DER -out PK.der
openssl x509 -in KEK.crt -outform DER -out KEK.der
openssl x509 -in db.crt  -outform DER -out db.der

# Convert to PKCS#12 for some tooling
openssl pkcs12 -export -out db.pfx -inkey db.key -in db.crt -passout pass:
```

---

## Signing UEFI Executables

UEFI binaries are PE/COFF format. Signing embeds a PKCS#7 signature in the PE `WIN_CERTIFICATE` security directory entry.

### Using sbsign (Linux)

```bash
# Install
sudo apt-get install sbsigntool

# Sign a UEFI binary
sbsign --key db.key --cert db.crt --output grubx64.efi.signed grubx64.efi

# Verify
sbverify --cert db.crt grubx64.efi.signed

# Check signature details
pesign -c db.crt -i grubx64.efi --show-signature
```

### Using osslsigncode (cross-platform)

```bash
# Install
sudo apt-get install osslsigncode

# Sign
osslsigncode sign \
    -certs db.crt \
    -key db.key \
    -h sha256 \
    -in grubx64.efi \
    -out grubx64.efi.signed

# Verify
osslsigncode verify -certs db.crt grubx64.efi.signed
```

### Signing the EDK2-Built Firmware Itself

When building OVMF or a platform firmware with Secure Boot support, the firmware binary can also be signed for platform-level integrity:

```bash
# Produce a signed FDF output by adding a security section to the FV
# In the .fdf file:
[FV.FVMAIN_COMPACT]
  # Wrap DXE FV in a PKCS#7-signed encapsulation section
  # This is the "authenticated firmware volume" concept
  # Handled by Conf/tools_def.txt PKCS7SIGN tool
```

For most embedded use cases, the firmware itself is authenticated by TF-A or BootROM (see Chain of Trust), and Secure Boot handles executables loaded **by** UEFI.

---

## Enrolling Keys in EDK2 (OVMF / Development)

### Method 1: UEFI Shell (Interactive)

```bash
# From UEFI Shell, mount the ESP containing your EFI sig list files
FS0:
cd SecureBoot

# Use the built-in KeyTool.efi (from efitools package) or EnrollDefaultKeys.efi
# (from OvmfPkg) to enroll keys
KeyTool.efi
```

### Method 2: efitools (Linux userspace, for OVMF/QEMU)

```bash
sudo apt-get install efitools

# Create EFI Signature List for PK
cert-to-efi-sig-list -g "$(uuidgen)" PK.crt PK.esl

# Self-sign the EFI Signature List update (PK signs itself during initial enrollment)
sign-efi-sig-list -k PK.key -c PK.crt PK PK.esl PK.auth

# Create signed update for KEK (signed by PK)
cert-to-efi-sig-list -g "$(uuidgen)" KEK.crt KEK.esl
sign-efi-sig-list -k PK.key -c PK.crt KEK KEK.esl KEK.auth

# Create signed update for db (signed by KEK)
cert-to-efi-sig-list -g "$(uuidgen)" db.crt db.esl
sign-efi-sig-list -k KEK.key -c KEK.crt db db.esl db.auth
```

### Method 3: EDK2 EnrollDefaultKeys.efi

`OvmfPkg/EnrollDefaultKeys/EnrollDefaultKeys.efi` is an UEFI application that reads keys from the QEMU firmware configuration interface and enrolls them automatically. Used in OVMF test builds.

### Method 4: Programmatic Enrollment via SetVariable

In a platform-specific PEI module or early DXE driver (before `ReadyToLock`), you can pre-provision the Secure Boot variables:

```c
// In a DXE driver that runs before ReadyToLock
#include <Guid/AuthenticatedVariableFormat.h>
#include <Library/AuthVariableLib.h>

// Note: writing PK/KEK/db as "Authenticated Variables" requires:
//   1. System is in "Setup Mode" (PK variable is empty)
//   2. For PK: the auth descriptor is signed by the new PK itself (self-signed)
//   3. For KEK/db/dbx: auth descriptor signed by PK (for KEK) or KEK (for db/dbx)

Status = gRT->SetVariable (
  EFI_PLATFORM_KEY_NAME,      // L"PK"
  &gEfiGlobalVariableGuid,
  EFI_VARIABLE_NON_VOLATILE |
  EFI_VARIABLE_BOOTSERVICE_ACCESS |
  EFI_VARIABLE_RUNTIME_ACCESS |
  EFI_VARIABLE_TIME_BASED_AUTHENTICATED_WRITE_ACCESS,
  sizeof(AuthDescriptor) + sizeof(EslData),
  AuthDescriptor            // contains the PKCS#7 signature + EFI_SIGNATURE_LIST
);
```

---

## EDK2 Secure Boot Build Configuration

### DSC Configuration

```ini
[Defines]
  # Enable Secure Boot support in the build
  SECURE_BOOT_ENABLE = TRUE

[PcdsFixedAtBuild]
  # Default state: Secure Boot is ENABLED on first boot
  gEfiMdeModulePkgTokenSpaceGuid.PcdSecureBootEnable|TRUE

[PcdsDynamicDefault]
  # Secure Boot can be toggled at runtime (controlled by PK enrollment state)
  gEfiMdeModulePkgTokenSpaceGuid.PcdSecureBootEnable|1

[Components]
  # Core variable driver with authenticated variable support
  MdeModulePkg/Universal/Variable/RuntimeDxe/VariableRuntimeDxe.inf {
    <LibraryClasses>
      AuthVariableLib|SecurityPkg/Library/AuthVariableLib/AuthVariableLib.inf
      VarCheckLib|MdeModulePkg/Library/VarCheckLib/VarCheckLib.inf
      BaseCryptLib|CryptoPkg/Library/BaseCryptLib/BaseCryptLib.inf
      OpensslLib|CryptoPkg/Library/OpensslLib/OpensslLib.inf
      IntrinsicLib|CryptoPkg/Library/IntrinsicLib/IntrinsicLib.inf
  }

  # Secure Boot configuration DXE driver
  SecurityPkg/VariableAuthenticated/SecureBootConfigDxe/SecureBootConfigDxe.inf

  # Image verification (checks PE/COFF signatures against db/dbx)
  SecurityPkg/Library/DxeImageVerificationLib/DxeImageVerificationLib.inf
```

### The Image Verification Flow

When `EFI_SECURITY2_ARCH_PROTOCOL.FileAuthentication()` is called for every image load:

```
LoadImage() called
        │
        ▼
Security2Arch.FileAuthentication()
        │
        ├── Extract WIN_CERTIFICATE from PE header
        │
        ├── Check dbx: is this binary's hash or signing cert revoked?
        │   └── if YES → EFI_SECURITY_VIOLATION → load rejected
        │
        ├── Check db: does binary's signing cert chain to a trusted entry?
        │   └── if YES → load allowed
        │
        ├── Check db: is a direct SHA-256 hash of the binary in db?
        │   └── if YES → load allowed
        │
        └── None matched → EFI_SECURITY_VIOLATION → load rejected (Secure Boot on)
                                                    OR load allowed (Secure Boot off)
```

---

## Linux Shim and MOK

On systems with Microsoft's KEK enrolled, Linux distributions cannot self-sign their bootloaders with a key Microsoft doesn't know about. The solution is `shim`:

```
UEFI db contains: Microsoft UEFI CA cert
        │
        │ verifies
        ▼
shim.efi (signed by Microsoft with UEFI CA key)
        │
        │ verifies using its own embedded cert + MokList variable
        ▼
grubx64.efi (signed by distribution's signing key)
        │
        │ verifies (via grub UEFI Secure Boot extension)
        ▼
vmlinuz (signed by distribution's signing key)
```

**MOK (Machine Owner Key)** allows end users to enroll their own signing keys into the `MokList` variable without needing Microsoft's KEK. This is managed by `mokutil`:

```bash
# Add a custom key to MokList
sudo mokutil --import my-custom-key.der
# System reboots into MOKManager (a UEFI application by shim)
# User confirms enrollment

# List enrolled MOK keys
mokutil --list-enrolled

# Delete a key from MokList
sudo mokutil --delete enrolled-key.der
```

---

## Secure Boot State Machine

```
Setup Mode (PK not enrolled)
    │  
    │  Enroll PK (self-signed auth variable)
    ▼
User Mode (PK enrolled, Secure Boot active)
    │
    │  Options:
    │  1. Delete PK → back to Setup Mode
    │  2. Audit Mode (log violations, don't block) → for testing
    │  3. Deployed Mode (cannot re-enter Setup Mode without physical presence)
    ▼
Deployed Mode (highest security; PK cannot be deleted without physical presence reset)
```

EDK2 variables tracking Secure Boot state:
- `SecureBoot` (UINT8, read-only) — `1` when Secure Boot is active
- `SetupMode` (UINT8) — `1` when in Setup Mode (PK empty)
- `AuditMode` (UINT8) — `1` when in Audit Mode
- `DeployedMode` (UINT8) — `1` when in Deployed Mode
