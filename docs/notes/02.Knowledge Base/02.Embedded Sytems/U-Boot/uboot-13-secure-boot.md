---
title: Secure Boot
createTime: 2026/03/23 00:00:00
permalink: /kb/embedded/uboot/secure-boot/
---

# U-Boot Secure Boot

## Overview: What is Secure Boot?

Secure Boot is the process of cryptographically verifying each stage of the boot chain before executing it. The goal is **integrity and authenticity**: only known-good, unmodified firmware/software signed by a trusted party is allowed to run.

A properly implemented secure boot chain means:
- An attacker who modifies U-Boot binary on eMMC cannot execute arbitrary code on boot
- Only images signed with your private key are launched
- The chain cannot be broken silently — failures halt the system (if enforced)

There are multiple independent secure boot mechanisms in U-Boot, each targeting different threat models and hardware:

| Mechanism | Hardware | Who Verifies What |
|-----------|----------|-------------------|
| **U-Boot Verified Boot (FIT)** | Any | U-Boot verifies Linux kernel/initrd FIT image |
| **NXP HAB/AHAB** | i.MX SoCs | ROM code verifies SPL; SPL verifies U-Boot |
| **Rockchip SecureBoot** | RK3588/RK356x | ROM verifies SPL+U-Boot via OTP keys |
| **TI TIFS + X509** | AM62x, AM64x | TIFS ROM verifies all stages |
| **ARM TrustZone / TF-A** | ARM Cortex-A | TF-A BL2 verifies BL31/BL33 (U-Boot) |
| **UEFI Secure Boot** | x86, ARM64 EFI | U-Boot verifies EFI executables via db/KEK/PK |
| **TPM Measured Boot** | Any with TPM | Records boot measurements; doesn't enforce by itself |

This document covers the **U-Boot Verified Boot (FIT)** mechanism in depth, plus UEFI Secure Boot and TPM Measured Boot. Platform-specific HAB/AHAB is in the Chain of Trust document.

---

## Part 1: U-Boot Verified Boot (FIT Image Signatures)

### Concept

U-Boot verifies a **FIT (Flattened Image Tree)** image before booting it. The FIT image contains:
- Kernel image
- Device tree(s)
- Initramfs (optional)
- Signature nodes covering selected components

The **public key** is embedded in U-Boot's own device tree (compiled in). The **private key** is only on your signing workstation. If the signature doesn't verify, U-Boot refuses to boot.

### Trust Model

```
Signing workstation (secure)             Embedded device (field)
├── Private key (NEVER leaves here)      ├── U-Boot binary (contains pubkey)
│                                        │   └── Can verify FIT images
└── FIT image signer                     └── FIT image (on storage)
        │                                        │
        └── Signs FIT image ──────────────────── Verified by U-Boot
```

### Kconfig for Verified Boot

```kconfig
# Minimum required options
CONFIG_FIT=y                       # FIT image format support
CONFIG_FIT_SIGNATURE=y             # Enable signature checking in FIT
CONFIG_FIT_VERBOSE=y               # Print verification progress
CONFIG_RSA=y                       # RSA algorithm support
CONFIG_RSA_VERIFY=y                # RSA signature verification
CONFIG_RSA_VERIFY_WITH_PKEY=y      # Use embedded pubkey in DTB
CONFIG_SHA256=y                    # SHA-256 hashing
CONFIG_SHA512=y                    # SHA-512 (for RSA-4096 with SHA-512)

# For ECC/ECDSA (alternative to RSA, since U-Boot ~2021)
CONFIG_ECDSA=y
CONFIG_ECDSA_VERIFY=y

# For PKCS#7 / X.509 certificate chains
CONFIG_ASYMMETRIC_KEY_TYPE=y
CONFIG_ASYMMETRIC_PUBLIC_KEY_SUBTYPE=y
CONFIG_X509_CERTIFICATE_PARSER=y
CONFIG_PKCS7_MESSAGE_PARSER=y

# SPL FIT signature verification (optional but recommended)
CONFIG_SPL_FIT_SIGNATURE=y
CONFIG_SPL_RSA=y
CONFIG_SPL_SHA256=y
CONFIG_SPL_CRYPTO=y
CONFIG_SPL_HASH=y

# Enforce trust: refuse to boot unsigned images
# (when this is NOT set, unsigned images are accepted with a warning)
# Set in production; don't set in development until keys are enrolled
# CONFIG_FIT_SIGNATURE_STRICT     # NOT a separate config — controlled by FIT node "required"
```

### Step-by-Step: Setting Up Verified Boot

#### Step 1: Generate Signing Keys

```bash
mkdir -p keys
cd keys

# Option A: RSA-4096 (most widely supported)
openssl genrsa -out my-signing-key.pem 4096

# Extract the public key
openssl rsa -in my-signing-key.pem -pubout -out my-signing-key-pub.pem

# Verify key pair
openssl rsa -in my-signing-key.pem -check

# Option B: ECDSA P-384 (smaller, faster, modern)
openssl ecparam -name secp384r1 -genkey -noout -out my-ec-key.pem
openssl ec -in my-ec-key.pem -pubout -out my-ec-key-pub.pem

# Option C: RSA-2048 (faster verification, less secure)
openssl genrsa -out my-signing-key.pem 2048
```

> **CRITICAL**: The private key (`.pem`) must NEVER be on the target device. Keep it on a secure signing server or HSM. Only the public key goes into U-Boot.

#### Step 2: Create the FIT Image Source (`.its`) File

```dts
// my-image.its — FIT Image Tree Source

/dts-v1/;

/ {
    description = "Linux kernel + FDT for MyBoard";
    #address-cells = <1>;

    images {
        kernel-1 {
            description = "Linux kernel";
            data = /incbin/("Image");         // ARM64 uncompressed kernel
            type = kernel;
            arch = arm64;
            os = linux;
            compression = none;
            load = <0x40400000>;
            entry = <0x40400000>;

            hash-1 {
                algo = sha256;
            };
        };

        fdt-myboard {
            description = "Device tree for MyBoard";
            data = /incbin/("mysoc-myboard.dtb");
            type = flat_dt;
            arch = arm64;
            compression = none;

            hash-1 {
                algo = sha256;
            };
        };

        ramdisk-1 {
            description = "initramfs";
            data = /incbin/("initramfs.cpio.gz");
            type = ramdisk;
            arch = arm64;
            os = linux;
            compression = gzip;
            load = <0x43800000>;
            entry = <0x43800000>;

            hash-1 {
                algo = sha256;
            };
        };
    };

    configurations {
        // "default" tells U-Boot which config to use if none specified
        default = "conf-myboard";

        conf-myboard {
            description = "Boot Linux on MyBoard";
            kernel = "kernel-1";
            fdt = "fdt-myboard";
            ramdisk = "ramdisk-1";

            // SIGNATURE NODE: This is what mkimage fills during signing
            signature-1 {
                algo = "sha256,rsa4096";    // Hash + signature algorithm
                key-name-hint = "my-signing-key";  // Key name to use
                // "required=conf" means: this configuration MUST be
                // signed and verified before booting
                required = "conf";
                // Sign over: kernel + FDT + ramdisk
                sign-images = "kernel", "fdt", "ramdisk";
            };
        };
    };
};
```

**`required` values:**
- `"image"` — Each individual image must be signed
- `"conf"` — The configuration as a whole must be signed (stronger: prevents swapping components)
- Not present — Signature is optional (checked if present, but unsigned is also accepted)

#### Step 3: Embed Public Key into U-Boot's Device Tree

This is the key step: U-Boot needs to contain the public key to verify against.

```bash
# Build U-Boot WITHOUT keys first (to get the DTB)
make myboard_defconfig
make -j$(nproc)

# Extract U-Boot's DTB
# It is either:
# - arch/arm/dts/mysoc-myboard.dtb (built separately)
# - Or part of u-boot-dtb.bin (strip the binary to get DTB)
cp arch/arm/dts/mysoc-myboard.dtb u-boot-dtb-unsigned.dtb

# Use mkimage to write the PUBLIC KEY into the U-Boot DTB:
# -K = key directory containing PEM files
# -k = key name (filename without .pem)
# -r = mark key as "required" (needed for enforced verification)
# -F = write key to existing FIT/DTB
mkimage -F -k ./keys -K u-boot-dtb-unsigned.dtb -r u-boot-dtb.bin

# This writes something like this into the DTB:
# /signature/key-my-signing-key {
#     required = "conf";
#     algo = "sha256,rsa4096";
#     rsa,num-bits = <4096>;
#     rsa,modulus = <...>;
#     rsa,exponent = <65537>;
#     rsa,r-squared = <...>;   // Montgomery pre-computation
#     rsa,n0-inverse = <...>;  // Montgomery constant
# };
```

#### Step 4: Rebuild U-Boot with the Key-Embedded DTB

```bash
# The key is now in the DTB. Rebuild U-Boot so the DTB is picked up:
make -j$(nproc) EXT_DTB=u-boot-dtb.bin

# OR: Copy the key-embedded DTB to the arch dir and rebuild:
cp u-boot-dtb.bin arch/arm/dts/mysoc-myboard.dtb
make -j$(nproc)

# Verify the key is in the output DTB:
fdtdump u-boot-dtb.bin | grep -A 20 "signature"
```

#### Step 5: Create and Sign the FIT Image

```bash
# Assemble and SIGN the FIT image in one step:
mkimage -f my-image.its \
        -k ./keys \
        -K u-boot-dtb.bin \
        -r \
        my-image-signed.itb

# -f my-image.its    → Input .its source file
# -k ./keys          → Directory containing private key PEM files
# -K u-boot-dtb.bin  → DTB file to write public key into (updated in-place)
# -r                 → Mark keys as required (enforced verification)
# my-image-signed.itb → Output signed FIT binary

# Verify the signature was embedded:
mkimage -l my-image-signed.itb
# Should show: "Sign algo: sha256,rsa4096:my-signing-key"
# Signature and hash nodes in the output
```

#### Step 6: Verify the Signature (Host-Side)

```bash
# Tool: fit_check_sign (in U-Boot tools/)
tools/fit_check_sign -f my-image-signed.itb -k u-boot-dtb.bin

# Expected output:
# Fit check sign success
```

#### Step 7: Boot with Verification

```bash
# Load signed FIT image and boot:
tftp ${loadaddr} my-image-signed.itb
bootm ${loadaddr}

# U-Boot output during verified boot:
## Loading kernel from FIT Image at 40400000 ...
##   Verifying Hash Integrity ... sha256+ OK
##   Trying 'conf-myboard' configuration...
### Verifying signature for configuration: sha256,rsa4096
    FIT image key required
    Verifying signature for 'kernel' ... sha256,rsa4096:my-signing-key: OK
    Verifying signature for 'fdt' ... sha256,rsa4096:my-signing-key: OK
    Verifying signature for 'ramdisk' ... sha256,rsa4096:my-signing-key: OK
## Loading kernel from FIT Image ...
```

If verification **fails**:
```
Signature check Failed
ERROR: can't get kernel image!
```
Boot is aborted.

---

## Part 2: Key Rollback and Version Management

### The Problem with Signature Rollback

Even with verified boot, an attacker could replay an older, signed-but-vulnerable firmware version. Monotonic counters prevent this.

### Anti-Rollback with Monotonic Counters

U-Boot 2026.01 supports rollback protection via:

#### A: FIT Image Version + OTP Counters (Hardware-Dependent)

```dts
// In the FIT .its file, add version to configuration:
configurations {
    conf-myboard {
        // ...
        signature-1 {
            algo = "sha256,rsa4096";
            key-name-hint = "my-signing-key";
            required = "conf";
            sign-images = "kernel", "fdt";
            // Anti-rollback: minimum firmware version
            // U-Boot will reject images with version < OTP counter
            rollback-index = <3>;      // FIT image version number
        };
    };
};
```

#### B: UEFI Capsule Anti-Rollback (see UEFI Secure Boot section)

---

## Part 3: UEFI Secure Boot

UEFI Secure Boot in U-Boot is compatible with the UEFI specification and Microsoft's requirements. U-Boot acts as the UEFI firmware and enforces that only EFI executables signed by keys in the Signature Database (`db`) are loaded.

### UEFI Secure Boot Database Variables

| Variable | Content | Meaning |
|----------|---------|---------|
| `PK` (Platform Key) | One X.509 certificate | Platform owner's key; controls who can update KEK |
| `KEK` (Key Exchange Key) | One or more X.509 certs | Keys that can update db/dbx |
| `db` (Authorized Signatures) | X.509 certs, SHA-256 hashes | Allowed signing keys/image hashes |
| `dbx` (Forbidden Signatures) | X.509 certs, SHA-256 hashes | Revoked keys/images |
| `dbr` | SHA-256 hashes | Recovery-mode signatures |
| `MokList` | Machine Owner Key list | Used by shim/MOK manager |

These are stored as UEFI authenticated variables in non-volatile storage.

### Kconfig for UEFI Secure Boot

```kconfig
CONFIG_EFI_LOADER=y                    # UEFI support in U-Boot
CONFIG_EFI_SECURE_BOOT=y              # Enable UEFI Secure Boot enforcement
CONFIG_EFI_VARIABLES=y                 # UEFI variable storage
CONFIG_EFI_MM_COMM_TEE=y              # Variables in OP-TEE secure storage
CONFIG_EFI_CAPSULE_ON_DISK=y          # Capsule update from disk
CONFIG_EFI_CAPSULE_AUTHENTICATE=y     # Authenticate capsule updates
CONFIG_EFI_RUNTIME_UPDATE_CAPSULE=y   # Accept capsule at runtime
CONFIG_SHA256=y
CONFIG_SHA384=y
CONFIG_SHA512=y
CONFIG_RSA=y
CONFIG_RSA_VERIFY=y
CONFIG_X509_CERTIFICATE_PARSER=y
CONFIG_PKCS7_MESSAGE_PARSER=y
```

### Enrolling UEFI Secure Boot Keys

#### Method 1: Using `efitools` on Host, Uploading via U-Boot

```bash
# Install efitools
sudo apt-get install efitools uuid-runtime

# 1. Generate Platform Key (PK)
openssl req -newkey rsa:2048 -nodes -keyout PK.key \
    -new -x509 -sha256 -days 3650 \
    -subj "/CN=My Platform Key/" \
    -out PK.crt

# 2. Generate Key Exchange Key (KEK)
openssl req -newkey rsa:2048 -nodes -keyout KEK.key \
    -new -x509 -sha256 -days 3650 \
    -subj "/CN=My KEK/" \
    -out KEK.crt

# 3. Generate Signing Key for db (image signing)
openssl req -newkey rsa:2048 -nodes -keyout db.key \
    -new -x509 -sha256 -days 3650 \
    -subj "/CN=My DB Signing Key/" \
    -out db.crt

# 4. Convert to DER format
openssl x509 -in PK.crt -out PK.der -outform DER
openssl x509 -in KEK.crt -out KEK.der -outform DER
openssl x509 -in db.crt -out db.der -outform DER

# 5. Create EFI Signature Lists
GUID=$(uuidgen)
cert-to-efi-sig-list -g ${GUID} PK.crt PK.esl
cert-to-efi-sig-list -g ${GUID} KEK.crt KEK.esl
cert-to-efi-sig-list -g ${GUID} db.crt db.esl

# 6. Sign the signature lists
# PK is self-signed:
sign-efi-sig-list -k PK.key -c PK.crt PK PK.esl PK.auth
# KEK is signed by PK:
sign-efi-sig-list -k PK.key -c PK.crt KEK KEK.esl KEK.auth
# db is signed by KEK:
sign-efi-sig-list -k KEK.key -c KEK.crt db db.esl db.auth
```

#### Enrolling via U-Boot UEFI Shell

```bash
# Boot to U-Boot UEFI shell
=> bootefi hello     # or load and boot a UEFI shell

# Inside UEFI shell:
FS0:\> EnrollDefaultKeys.efi    # If using efitools EnrollDefaultKeys
# OR:
FS0:\> SetupMode.efi PK.auth KEK.auth db.auth
```

#### Enrolling via U-Boot `efidebug` Command

```bash
# Copy .auth files to FAT partition
# In U-Boot:
=> efidebug auth

# Interactive prompts to enroll PK, KEK, db
```

### Signing an EFI Boot Image

```bash
# Sign a GRUB EFI binary or kernel.efi with your db key
sbsign --key db.key --cert db.crt \
       --output grubaa64-signed.efi grubaa64.efi

# Verify the signature
sbverify --cert db.crt grubaa64-signed.efi

# Sign a Linux kernel EFI stub (CONFIG_EFI_STUB must be on in kernel)
sbsign --key db.key --cert db.crt \
       --output linux.efi linux-unsigned.efi
```

### UEFI Capsule Updates

Capsule updates allow firmware to be updated via UEFI while maintaining Secure Boot:

```bash
# Create a capsule wrapping a new U-Boot FIT image:
tools/mkeficapsule \
    --monotonic-count 1 \
    --private-key db.key \
    --certificate db.crt \
    --guid <board-specific-guid> \
    -b u-boot.itb \
    u-boot-capsule.bin

# Place capsule on EFI System Partition:
# /EFI/UpdateCapsule/u-boot-capsule.bin

# On next boot, U-Boot processes the capsule and updates itself
```

---

## Part 4: TPM Measured Boot

Measured Boot records cryptographic hashes of each boot stage into TPM PCRs (Platform Configuration Registers). It does NOT enforce — it provides **attestation**: you can verify after the fact whether the boot was compromised.

### Kconfig for Measured Boot

```kconfig
CONFIG_TPM=y
CONFIG_TPM_V2=y                    # For TPM 2.0 (most modern systems)
CONFIG_TPM2_TIS_SPI=y              # TPM connected via SPI
CONFIG_TPM2_TIS_I2C=y              # TPM connected via I2C
CONFIG_CMD_TPM=y
CONFIG_CMD_TPM2=y
CONFIG_MEASURED_BOOT=y             # Enable PCR extension
CONFIG_MEASURE_DEVICETREE=y        # Measure the DTB
```

### How PCR Extension Works

PCRs start at 0x00...00. Each `extend` operation: `PCR_new = SHA256(PCR_old || new_value)`.

Standard PCR usage (TCG PC Client spec, used by U-Boot):

| PCR | Content |
|-----|---------|
| PCR[0] | CRTM / Firmware code |
| PCR[4] | Boot manager, bootloader code |
| PCR[7] | Secure Boot policy |
| PCR[8] | GRUB config / command line |
| PCR[9] | All files loaded by bootloader |

### Using TPM Commands

```bash
# Initialize TPM (must be done after power-on)
=> tpm2 startup TPM2_SU_CLEAR

# Read PCR values
=> tpm2 pcr_read 0x0076   # Read PCR0-6 (bitmask)

# Extend a PCR with a measurement:
=> tpm2 pcr_extend 4 ${sha256_of_kernel}

# Read TPM properties
=> tpm2 get_capability 0x6 0x106 4   # Get manufacturer info

# Seal/unseal a secret to PCRs (anti-rollback secret)
=> tpm2 nv_define 0x1500016 0x6 0x40
=> tpm2 nv_write 0x1500016 ${key_addr} 32
=> tpm2 nv_read 0x1500016 ${dest_addr} 32
```

### Measured Boot in C Code

```c
// common/tpm-common.c — U-Boot extends PCR during boot
int tpm_measure_data(struct udevice *dev, uint32_t pcr_index,
                     const void *data, size_t length)
{
    u8 digest[TPM2_SHA256_DIGEST_SIZE];
    
    /* Hash the data */
    sha256_csum_wd(data, length, digest, CHUNKSZ_SHA256);
    
    /* Extend the PCR */
    return tpm2_pcr_extend(dev, pcr_index, TPM2_ALG_SHA256,
                           digest, TPM2_SHA256_DIGEST_SIZE);
}

// Called from boot:
// PCR4: Extend with kernel image hash
tpm_measure_data(dev, 4, kernel_data, kernel_size);
// PCR9: Extend with DTB hash
tpm_measure_data(dev, 9, fdt_blob, fdt_size);
```

## Part 5: Platform-Specific Secure Boot — NXP i.MX HAB

### HAB Architecture (i.MX6, i.MX7, i.MX8M Mini/Nano/Plus)

HAB (High Assurance Boot) is NXP's ROM-level secure boot mechanism. The SoC ROM code verifies the bootloader (SPL or full U-Boot) before jumping to it.

```
Power On Reset
     │
     ▼
  SoC ROM
     │
     ├── Read HAB status from e-fuses
     │
     ├── [if HAB enabled] Verify IVT + CSF headers in bootloader
     │       • Check RSA signature against SRK table in fuses
     │       • Check hash of bootloader image
     │
     ├── [if verification passes] Jump to SPL/U-Boot
     │
     └── [if verification fails OR HAB open] Warn and jump anyway
              (HAB OPEN = development mode, HAB CLOSED = production)
```

#### HAB Data Structures

1. **IVT (Image Vector Table)**: Points to the image entry point, DCD, CSF
2. **DCD (Device Configuration Data)**: Optional register writes before DDR init
3. **CSF (Command Sequence File)**: Contains the signature + certificates
4. **SRK (Super Root Key)**: The root certificate hash burned into e-fuses

#### HAB Workflow

```bash
# Step 1: Install NXP Code Signing Tool (CST)
# Download from NXP website (requires account):
# https://www.nxp.com/webapp/sps/download/license.jsp?colCode=IMX_CST_TOOL_NEW
tar -xf cst-3.x.x.tar.gz
cd cst-3.x.x
make -C code/cst

# Step 2: Generate PKI tree (one-time setup)
./code/cst/keys/hab4_pki_tree.sh
# Follow prompts:
# - Use existing SRK keys? N
# - How many Super Root Keys (2 or 4)? 4
# - Key length: 4096
# - Certificate duration (years): 10

# This generates:
# SRK1_sha256_4096_65537_v3_ca_crt.pem (x4)
# CSF1_1_sha256_4096_65537_v3_usr_crt.pem
# IMG1_1_sha256_4096_65537_v3_usr_crt.pem
# (+ private keys in crts/ directory)

# Step 3: Create SRK table and SRK hash
./code/cst/bin/srktool \
    --hab_ver 4 \
    --certs crts/SRK1_sha256_4096_65537_v3_ca_crt.pem,\
            crts/SRK2_sha256_4096_65537_v3_ca_crt.pem,\
            crts/SRK3_sha256_4096_65537_v3_ca_crt.pem,\
            crts/SRK4_sha256_4096_65537_v3_ca_crt.pem \
    --table SRK_table.bin \
    --efuses SRK_efuses.bin \
    --digest sha256

# SRK_efuses.bin = 32 bytes = SHA-256 of SRK table
# These 32 bytes go into e-fuses!

# Step 4: Build U-Boot
# For i.MX8M: includes ATF (TF-A) + OP-TEE + SPL + U-Boot-proper
MKIMAGE_PATH=../imx-atf/build/imx8mm/release
BL31=${MKIMAGE_PATH}/bl31.bin
TEE=../imx-optee-os/out/arm/core/tee.bin

make imx8mm_evk_defconfig
make -j$(nproc) \
    CROSS_COMPILE=aarch64-none-linux-gnu- \
    BL31=${BL31} \
    TEE=${TEE}

# This produces: flash.bin (contains SPL + TF-A + OP-TEE + U-Boot)

# Step 5: Create CSF for SPL/U-Boot signing
# Create csf_spl.txt:
cat > csf_spl.txt << 'EOF'
[Header]
  Version = 4.3
  Hash Algorithm = sha256
  Engine = CAAM
  Engine Configuration = 0
  Certificate Format = X509
  Signature Format = CMS
  
[Install SRK]
  File = "SRK_table.bin"
  Source index = 0

[Install CSFK]
  File = "crts/CSF1_1_sha256_4096_65537_v3_usr_crt.pem"

[Authenticate CSF]

[Install Key]
  Verification index = 0
  Target index = 2
  File = "crts/IMG1_1_sha256_4096_65537_v3_usr_crt.pem"

[Authenticate Data]
  Verification index = 2
  Blocks = 0x7e1000 0x000 0x42000 "flash.bin"
  # Address     Offset  Length  File

[Unlock]
  Engine = CAAM
  Features = MID
EOF

# Sign with CST:
./code/cst/bin/cst --i csf_spl.txt --o csf_spl.bin

# Step 6: Pad SPL and append CSF marker
# (NXP imx-mkimage does this automatically)
# See: imx-mkimage project for complete flow

# Step 7: Program e-fuses (IRREVERSIBLE IN HAB CLOSED MODE)
# Using U-Boot fuse commands (development/testing):
=> fuse prog -y 6 0 <word0>   # SRK hash word 0
=> fuse prog -y 6 1 <word1>   # SRK hash word 1
=> fuse prog -y 6 2 <word2>
=> fuse prog -y 6 3 <word3>
=> fuse prog -y 6 4 <word4>
=> fuse prog -y 6 5 <word5>
=> fuse prog -y 6 6 <word6>
=> fuse prog -y 6 7 <word7>

# CLOSE the part (PERMANENT - do this last, in production only!)
=> fuse prog -y 1 3 0x02000000    # Set SEC_CONFIG[1:0] = 0b11

# Step 8: Verify HAB status in U-Boot
=> hab_status
HAB Configuration: 0xf0 expected: 0xf0 (Closed)
HAB State:         0x66 expected: 0x66 (Trusted)
No HAB Events Found!
```

---

## Part 6: Locking Down U-Boot for Production

### Disable Autoboot Interrupt

```kconfig
# Prevent pressing a key to stop autoboot
CONFIG_AUTOBOOT_KEYED=y            # Enable keyed autoboot
CONFIG_AUTOBOOT_ENCRYPTION=y       # Require password hash (SHA-256)
# Or:
CONFIG_ZERO_BOOTDELAY_CHECK=n      # Don't check key on delay=0
```

Environment:
```bash
# In production environment:
setenv bootdelay 0                 # No delay
setenv silent 1                    # Suppress all serial output
saveenv
```

### Disable U-Boot Commands in Production

```kconfig
# Remove dangerous/unnecessary commands from production build:
# CONFIG_CMD_SETENV is not set
# CONFIG_CMD_EDITENV is not set
# CONFIG_CMD_SAVEENV is not set
CONFIG_CMD_MEMORY=n                # md, mw, cp — useful for debug only
CONFIG_CMD_LOADS=n
CONFIG_CMD_LOADB=n
CONFIG_CMD_IMPORTENV=n
# CONFIG_CMD_CONSOLE is not set
```

```c
// Alternative: Command access control via board-specific hook
// board/mycompany/myboard/myboard.c

int board_run_command(const char *cmdline)
{
    /* In locked-down mode, reject all interactive commands */
    if (gd->flags & GD_FLG_SECURE_MODE) {
        printf("Error: console locked\n");
        return 1;
    }
    return 0;
}
```

### Environment Write Protection

```kconfig
# Lock environment AFTER first successful boot (or at factory):
CONFIG_ENV_WRITEABLE_LIST=y
# CONFIG_ENV_IS_READONLY is not set  # Set for fully read-only
```

```c
// Lock environment programmatically:
env_set("env_written", "1");
// Use custom logic to mark env as locked
```

### Restrict `bootm` to Only Verified Images

```kconfig
# Require signature for ALL FIT images, no fallback to unsigned
CONFIG_FIT_SIGNATURE=y
# In the FIT image: required = "conf";  — key is marked required
# If the key is marked required in DTB, unsigned images are rejected
```

---

## Part 7: Debugging Secure Boot Issues

### HAB Debug

```bash
# Check HAB events (failures logged here)
=> hab_status

# Bypass HAB events (testing only — only on open parts):
# setenv secureboot_disable 1

# HAB Error codes:
# 0x33 = FAILURE
# 0x69 = SUCCESS
# 0x66 = TRUSTED
# 0xf0 = OPEN (no enforcement)
# 0xcc = CLOSED (enforcement active)
```

### FIT Signature Debug

```bash
# Verbose fit image info:
=> iminfo ${loadaddr}
## Checking Image at 42000000 ...
   FIT image found
   FIT description: Linux kernel + FDT for MyBoard
    Image 0 (kernel-1)
     Description:  Linux kernel
     Type:         Kernel Image
     Compression:  uncompressed
     Hash algo:    sha256
     Hash value:   OK
    Configuration 0 (conf-myboard)
     Description:  Boot Linux on MyBoard
     Kernel:       kernel-1
     FDT:          fdt-myboard
     Signature algo: sha256,rsa4096
     Signature:    OK

# Environment variable to increase FIT verbosity:
=> setenv fit_verbose 1
=> bootm ${loadaddr}
```

### Common Errors

| Error | Cause | Fix |
|-------|-------|-----|
| `FIT: Bad signature` | Wrong key or corrupted image | Re-sign with correct key |
| `FIT: key not in DTB` | Public key not embedded | Rebuild U-Boot with `mkimage -K` |
| `FIT: required key not present` | Key marked required but absent | Embed key with `-r` flag |
| `HAB: No Entry Point found` | IVT header missing/corrupt | Check imx-mkimage output |
| `HAB Events Found` | Signature verification failed | Verify CSF and SRK fuses |
| `UEFI: image authentication failed` | db doesn't contain signing cert | Enroll correct db key |
