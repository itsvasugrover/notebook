---
title: Chain of Trust
createTime: 2026/03/23 00:00:00
permalink: /kb/embedded/uboot/chain-of-trust/
---

# U-Boot Chain of Trust — Complete Implementation Guide

## What is the Chain of Trust?

The Chain of Trust (CoT) is a cryptographic trust relationship that starts at an anchor of trust (ROM code + burned keys) and extends through every boot stage to the running OS kernel and applications. Each stage verifies the next before transferring control.

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Chain of Trust                               │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  [SoC ROM + OTP fuses] ──verifies──► [TF-A BL2 / SPL]             │
│        (immutable)                            │                     │
│                                               ▼                     │
│                                    [TF-A BL31 + OP-TEE BL32]       │
│                                               │                     │
│                                               ▼                     │
│                                       [U-Boot Proper]               │
│                                               │                     │
│                                     verifies via FIT                │
│                                               ▼                     │
│                                       [Linux Kernel]                │
│                                               │                     │
│                                               ▼                     │
│                                     [initramfs / rootfs]            │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

**Key principle**: Each link in the chain is verified by the link before it. If any stage cannot be verified, boot fails (in enforced mode) or an alarm is raised (in audit mode).

---

## The Verification Actors

| Stage | Who verifies it? | How? |
|-------|-----------------|------|
| TF-A BL2 | SoC ROM | Platform HAB/SAB/OTP fuses |
| TF-A BL31 / OP-TEE | TF-A BL2 | CoT descriptor + signed FIP |
| U-Boot (BL33) | TF-A BL2 | CoT descriptor + signed FIP |
| Linux FIT image | U-Boot | FIT RSA/ECDSA signature |
| EFI binary (GRUB) | U-Boot UEFI | UEFI db/KEK/PK database |
| Kernel modules | Kernel | IMA/module signing |
| Root filesystem | Kernel | dm-verity |

---

## Part 1: ARM Trusted Firmware-A (TF-A) Chain of Trust

TF-A implements a formal CoT framework defined in `trusted-firmware-a/drivers/auth/`.

### FIP (Firmware Image Package)

All TF-A components are bundled in a FIP file. The FIP is a flat container:

```
fip.bin
├── BL2    (trusted-boot-firmware.bin)
├── BL31   (SOC AP firmware or soc-fw.bin)
├── BL32   (tos-fw.bin = OP-TEE)
├── BL33   (non-trusted-firmware.bin = U-Boot)
└── NT_FW_CONFIG (non-trusted-fw-config = U-Boot DTB)
```

### TF-A CoT Descriptor

TF-A uses a CoT descriptor file that chains certificates:

```
┌─────────────────────────────────────────────────────────────┐
│ ROTPK (Root of Trust Public Key) — in OTP fuses             │
│   │                                                         │
│   └── Signs: Trusted Key Certificate                        │
│           │                                                 │
│           ├── Trusted World Public Key (for BL31/BL32)      │
│           │       │                                         │
│           │       ├── BL31 Content Certificate              │
│           │       │       └── Signs: BL31 hash              │
│           │       │                                         │
│           │       └── BL32 Content Certificate              │
│           │               └── Signs: BL32 hash              │
│           │                                                 │
│           └── Non-Trusted World Public Key (for U-Boot)     │
│                   │                                         │
│                   └── BL33 Content Certificate              │
│                           └── Signs: BL33 (U-Boot) hash     │
└─────────────────────────────────────────────────────────────┘
```

### Building Signed TF-A FIP

```bash
# Prerequisite: Install TF-A
git clone https://git.trustedfirmware.org/TF-A/trusted-firmware-a.git
cd trusted-firmware-a

# Step 1: Generate Root of Trust key pair
openssl genrsa -out rot_key.pem 4096
openssl rsa -in rot_key.pem -pubout > rot_key_pub.pem

# Step 2: Build TF-A with signing for i.MX8M Mini (as example)
make PLAT=imx8mm \
     CROSS_COMPILE=aarch64-none-linux-gnu- \
     SPD=opteed \
     BL32=../imx-optee-os/out/arm/core/tee.bin \
     BL33=../u-boot/u-boot-nodtb.bin \
     BL33_KEY=../keys/bl33_key.pem \
     ROT_KEY=../keys/rot_key.pem \
     GENERATE_COT=1 \
     TRUSTED_BOARD_BOOT=1 \
     CREATE_KEYS=1 \
     SAVE_KEYS=1 \
     MBEDTLS_DIR=../mbedtls \
     all fip

# Output:
# build/imx8mm/release/bl2.bin
# build/imx8mm/release/fip.bin       ← Contains BL31 + OP-TEE + U-Boot, all signed

# Verify FIP structure:
tools/fiptool/fiptool info build/imx8mm/release/fip.bin
```

### ROTPK (Root of Trust Public Key) Enrollment

```bash
# Get the ROTPK hash (this goes into OTP/e-fuses):
make PLAT=imx8mm ROTPK_HASH=build/imx8mm/release/rotpk_hash.bin

# That file contains 32 bytes (SHA-256 of the public key)
# Program into OTP via U-Boot fuse command or factory tool
xxd build/imx8mm/release/rotpk_hash.bin
```

---

## Part 2: Complete U-Boot Verified Boot — FIT Chain of Trust

This is the most universal U-Boot CoT: U-Boot proper verifies the Linux image.

### Full Walkthrough (U-Boot 2026.01)

#### 2.1 Prepare the Key Directory

```bash
mkdir -p /secure/keys
chmod 700 /secure/keys
cd /secure/keys

# Generate RSA-4096 key (production)
openssl genrsa -out fit-signing.pem 4096
# Keep this safe — it's your root of signing
chmod 400 fit-signing.pem

# Extract public key (only this goes onto device)
openssl rsa -in fit-signing.pem -pubout -out fit-signing-pub.pem
```

#### 2.2 Build U-Boot and Embed the Public Key

```bash
cd /path/to/u-boot    # cloned at v2026.01

# Step A: Build without key (get the DTB first)
make myboard_defconfig
make -j$(nproc) CROSS_COMPILE=aarch64-none-linux-gnu-

# This creates: arch/arm/dts/mysoc-myboard.dtb

# Step B: Embed public key into U-Boot DTB using mkimage
#   -F     - modify in place (no output FIT created, just key injection)
#   -k     - location of key directory (PEM file name without extension = key-name-hint)
#   -K     - DTB to inject the public key into
#   -r     - mark key as "required" (unsigned images will be REJECTED)
mkimage -F \
        -k /secure/keys \
        -K arch/arm/dts/mysoc-myboard.dtb \
        -r

# The DTB now contains this node (verify with fdtdump):
# /signature {
#     key-fit-signing {
#         required = "conf";
#         algo = "sha256,rsa4096";
#         rsa,num-bits = <4096>;
#         rsa,modulus = <...large-number...>;
#         rsa,exponent = <0x00 0x01 0x00 0x01>;
#         rsa,r-squared = <...precomputed...>;
#         rsa,n0-inverse = <...precomputed...>;
#     };
# };

# Step C: Rebuild U-Boot to incorporate the DTB with the key
make -j$(nproc) CROSS_COMPILE=aarch64-none-linux-gnu-
```

#### 2.3 Flash U-Boot to Device

```bash
# U-Boot binaries (example for SD card boot):
# flash.bin or u-boot.imx → goes at offset 0x8400 on SD

dd if=flash.bin of=/dev/sdX bs=1k seek=33 conv=sync
# OR for i.MX8M:
dd if=flash.bin of=/dev/sdX bs=512 seek=66 conv=sync,notrunc
```

#### 2.4 Prepare Kernel FIT Image

```bash
# Collect components:
ls -la
# Image                  ← ARM64 kernel (from kernel build: make Image)
# mysoc-myboard.dtb      ← Board device tree
# initramfs.cpio.gz      ← Optional initramfs

# Create .its file:
cat > linux-fit.its << 'EOF'
/dts-v1/;

/ {
    description = "Linux 6.x for MyBoard (signed)";
    #address-cells = <1>;

    images {
        kernel {
            description = "Linux Kernel";
            data = /incbin/("Image");
            type = kernel;
            arch = arm64;
            os = linux;
            compression = none;
            load = <0x40400000>;
            entry = <0x40400000>;
            hash-1 { algo = sha256; };
        };

        fdt-1 {
            description = "Flattened Device Tree";
            data = /incbin/("mysoc-myboard.dtb");
            type = flat_dt;
            arch = arm64;
            compression = none;
            hash-1 { algo = sha256; };
        };

        ramdisk-1 {
            description = "ramdisk";
            data = /incbin/("initramfs.cpio.gz");
            type = ramdisk;
            arch = arm64;
            os = linux;
            compression = gzip;
            hash-1 { algo = sha256; };
        };
    };

    configurations {
        default = "conf-1";

        conf-1 {
            description = "MyBoard Linux Boot";
            kernel = "kernel";
            fdt = "fdt-1";
            ramdisk = "ramdisk-1";

            signature-1 {
                algo = "sha256,rsa4096";
                key-name-hint = "fit-signing";
                required = "conf";
                sign-images = "kernel", "fdt", "ramdisk";
            };
        };
    };
};
EOF
```

#### 2.5 Sign the FIT Image

```bash
# Create and sign the FIT image:
mkimage -f linux-fit.its \
        -k /secure/keys \
        -K /path/to/u-boot/arch/arm/dts/mysoc-myboard.dtb \
        -r \
        linux-signed.itb

# Confirm signature is embedded:
mkimage -l linux-signed.itb
# Look for: Sign algo: sha256,rsa4096:fit-signing
#           Sign value: ...
#           Timestamp: ...

# Host-side signature check:
/path/to/u-boot/tools/fit_check_sign \
    -f linux-signed.itb \
    -k /path/to/u-boot/arch/arm/dts/mysoc-myboard.dtb
# Output: Fit check sign success
```

#### 2.6 Configure Boot Command

```bash
# U-Boot environment (setenv in autoboot):
setenv bootcmd_fit 'load mmc 0:1 ${loadaddr} linux-signed.itb; bootm ${loadaddr}'
setenv bootcmd 'run bootcmd_fit'
setenv loadaddr 0x42000000
saveenv
```

#### 2.7 Runtime Verification Output

```
U-Boot 2026.01 (Jan 01 2026 - 00:00:00 +0000) for MyBoard

DRAM:  2 GiB
MMC:   FSL_SDHC: 0, FSL_SDHC: 1

Loading from MMC 0:1...
## Loading FIT Image at 42000000 ...
   FIT description: Linux 6.x for MyBoard (signed)
   Created:         Mon  1 Jan 2026 00:00:00
   Image 0 (kernel)
     Description:   Linux Kernel
     Type:          Kernel Image
     Compression:   uncompressed
     Data Start:    0x420000e8
     Data Size:     26902016 Bytes = 25.7 MiB
     Hash algo:     sha256
     Hash value:    OK
   Image 1 (fdt-1)
     Description:   Flattened Device Tree
     Type:          Flat Device Tree
     Hash algo:     sha256
     Hash value:    OK
   Image 2 (ramdisk-1)
     Description:   ramdisk
     Hash value:    OK
   Configuration 0 (conf-1)
     Description:   MyBoard Linux Boot
     Kernel:        kernel
     FDT:           fdt-1
     Ramdisk:       ramdisk-1
     Signing algo:  sha256,rsa4096:fit-signing
     Signing value: OK
## Loading kernel from FIT Image...
## Loading ramdisk from FIT Image...
## Flattening FDT...
Starting kernel ...
```

---

## Part 3: SPL → U-Boot Verified Boot

This extends the chain one stage earlier: SPL verifies U-Boot proper.

### Kconfig for SPL Verified Boot

```kconfig
CONFIG_SPL=y
CONFIG_SPL_FIT=y
CONFIG_SPL_FIT_SIGNATURE=y         # SPL checks FIT signature
CONFIG_SPL_RSA=y
CONFIG_SPL_RSA_VERIFY=y
CONFIG_SPL_SHA256=y
CONFIG_SPL_CRYPTO=y
CONFIG_SPL_CRYPTO_RSA=y
CONFIG_SPL_HASH=y
CONFIG_SPL_FIT_MAXIMUM_KERNEL_SIZE=0x800000  # 8MB max U-Boot size
```

### Building SPL FIT Image (U-Boot in FIT)

The U-Boot binary itself is wrapped in a FIT image for SPL to verify:

```bash
# u-boot.its — wrap U-Boot in a signed FIT image

cat > spl-uboot.its << 'EOF'
/dts-v1/;

/ {
    description = "U-Boot fit image for MyBoard";
    #address-cells = <1>;

    images {
        uboot {
            description = "U-Boot";
            data = /incbin/("u-boot-nodtb.bin");
            type = standalone;
            os = u-boot;
            arch = arm64;
            compression = none;
            load = <0x44000000>;
            entry = <0x44000000>;
            hash-1 { algo = sha256; };
        };

        fdt-1 {
            description = "U-Boot DTB";
            data = /incbin/("u-boot.dtb");
            type = flat_dt;
            arch = arm64;
            compression = none;
            hash-1 { algo = sha256; };
        };
        
        atf-1 {
            description = "ARM Trusted Firmware BL31";
            data = /incbin/("bl31.bin");
            type = firmware;
            arch = arm64;
            compression = none;
            load = <0x00040000>;
            entry = <0x00040000>;
            hash-1 { algo = sha256; };
        };
    };

    configurations {
        default = "conf-1";

        conf-1 {
            description = "U-Boot with TF-A";
            firmware = "atf-1";
            loadables = "uboot";
            fdt = "fdt-1";

            signature-1 {
                algo = "sha256,rsa4096";
                key-name-hint = "spl-signing-key";
                required = "conf";
                sign-images = "firmware", "loadables", "fdt";
            };
        };
    };
};
EOF

# The SPL binary also needs the public key embedded (same process):
mkimage -F \
        -k /secure/keys \
        -K spl/u-boot-spl.dtsi \
        -r

# Sign the SPL FIT container:
mkimage -f spl-uboot.its \
        -k /secure/keys \
        -K spl/u-boot-spl.dtsi \
        -r \
        u-boot-signed.itb
```

### Complete Boot Chain with SPL Verified Boot

```
ROM code (hardcoded trust anchor)
    │ verifies (HAB/OTP)
    ▼
SPL binary (contains public key for U-Boot verification)
    │ loads u-boot-signed.itb from storage
    │ verifies FIT signature (RSA-4096 + SHA-256)
    ▼
U-Boot Proper (contains public key for Linux verification)
    │ loads linux-signed.itb from storage
    │ verifies FIT signature (RSA-4096 + SHA-256)
    ▼
Linux Kernel
```

---

## Part 4: Key Management Strategy

### Production Key Hierarchy

```
Root CA (RSA-4096, offline, on HSM)
├── Platform Signing Key (PSK)
│   └── Signs: SPL, TF-A BL2
│
├── Firmware Signing Key (FSK)
│   └── Signs: U-Boot, TF-A FIP
│
└── OS Image Signing Key (OSK)
    └── Signs: Linux FIT, UEFI EFI files
```

### Key Storage Recommendations

1. **HSM (Hardware Security Module)**: Luna HSM, Thales, YubiHSM2
   - Private key never leaves HSM
   - Signing is done via PKCS#11 API

2. **Offline Signing Server**: Air-gapped machine, restricted access

3. **Key ceremony**: Multiple operators required to activate the root key

### Using PKCS#11 for Signing (YubiHSM / SoftHSM)

```bash
# Install SoftHSM2 for testing (or use real HSM in production)
sudo apt-get install softhsm2 opensc

# Initialize token
softhsm2-util --init-token --slot 0 --label "uboot-signing"

# Generate key in HSM:
pkcs11-tool --module /usr/lib/softhsm/libsofthsm2.so \
            --keypairgen \
            --mechanism RSA-PKCS-KEY-PAIR-GEN \
            --key-type RSA:4096 \
            --label "fit-signing" \
            --pin <pin>

# Sign FIT image via PKCS#11 (U-Boot mkimage supports this):
mkimage -f linux-fit.its \
        -k /dev/null \
        --pkcs11-engine /usr/lib/engines-3/pkcs11.so \
        --pkcs11-module /usr/lib/softhsm/libsofthsm2.so \
        -K u-boot-dtb.bin \
        -r \
        linux-signed.itb
```

### Key Rotation

When a signing key is compromised:

```bash
# 1. Generate new key
openssl genrsa -out fit-signing-v2.pem 4096

# 2. Embed BOTH old and new keys in U-Boot
#    (supports images signed by either key during transition)
mkimage -F -k /secure/keys -K u-boot.dtb -r -a old-key-name
mkimage -F -k /secure/keys-v2 -K u-boot.dtb -r -a new-key-name

# 3. Deploy new U-Boot with dual-key support
# 4. Re-sign all FIT images with new key
# 5. Deploy updated FIT images
# 6. Remove old key from next U-Boot release
```

---

## Part 5: Rockchip Chain of Trust

Rockchip uses a similar but platform-specific CoT mechanism.

### Rockchip Verified Boot Flow

```
Rockchip Secure Boot (OTP fuses)
    │ verifies
    ▼
idbloader.img (DDR init + Maskrom USB fallback)
    │ signed with rkboot tool
    ▼
u-boot.itb (FIP containing TF-A BL31 + U-Boot)
    │ signed with rkboot tool
    ▼
U-Boot Proper (contains FIT pubkey for Linux)
    │ verifies
    ▼
Linux FIT image
```

```bash
# Rockchip FIT image format (rkbin required):
# https://github.com/rockchip-linux/rkbin

# Build idbloader:
tools/mkimage -n rk3588 -T rksd \
    -d rkbin/bin/rk35/rk3588_ddr_lp4_2112MHz_lp5_2736MHz_v1.xx.bin:spl/u-boot-spl.bin \
    idbloader.img

# Build u-boot.itb (FIP):
./make.sh rk3588

# Flash:
dd if=idbloader.img of=/dev/sdX seek=64 bs=512
dd if=u-boot.itb of=/dev/sdX seek=16384 bs=512
```

---

## Part 6: Verifying the Complete Chain

### Host Verification Script

```bash
#!/bin/bash
# verify-chain.sh — verify entire boot chain artifacts

KEYS_DIR=/secure/keys
UBOOT_DTB=u-boot.dtb
LINUX_FIT=linux-signed.itb
UBOOT_FIT=u-boot-signed.itb

echo "=== Verifying U-Boot Signing Key in DTB ==="
fdtdump ${UBOOT_DTB} | grep -A 5 "key-fit-signing"
if [ $? -eq 0 ]; then
    echo "  ✓ Public key found in U-Boot DTB"
else
    echo "  ✗ Public key NOT found in U-Boot DTB"
    exit 1
fi

echo ""
echo "=== Verifying Linux FIT Image Signature ==="
tools/fit_check_sign -f ${LINUX_FIT} -k ${UBOOT_DTB}
if [ $? -eq 0 ]; then
    echo "  ✓ Linux FIT signature valid"
else
    echo "  ✗ Linux FIT signature INVALID"
    exit 1
fi

echo ""
echo "=== FIT Image Contents ==="
mkimage -l ${LINUX_FIT}

echo ""
echo "=== Chain of Trust Verification COMPLETE ==="
```

### On-Device Verification

```bash
# U-Boot shell command to manually verify FIT:
=> iminfo ${loadaddr}

# Dump signature info:
=> fdt addr ${loadaddr}
=> fdt list /configurations/conf-1/signature-1

# Check env to confirm key is enrolled:
=> fdt addr ${fdtcontroladdr}
=> fdt list /signature
# Should show: key-fit-signing { required = "conf"; ... }
```

---

## Part 7: Kconfig Summary for Full Chain of Trust

```kconfig
# ============================================================
# U-Boot Chain of Trust — Complete Kconfig
# ============================================================

# --- FIT verified boot (U-Boot verifies Linux) ---
CONFIG_FIT=y
CONFIG_FIT_SIGNATURE=y
CONFIG_FIT_VERBOSE=y
CONFIG_SHA256=y
CONFIG_SHA384=y
CONFIG_SHA512=y
CONFIG_RSA=y
CONFIG_RSA_VERIFY=y
CONFIG_RSA_VERIFY_WITH_PKEY=y
CONFIG_ASYMMETRIC_KEY_TYPE=y
CONFIG_ASYMMETRIC_PUBLIC_KEY_SUBTYPE=y
CONFIG_X509_CERTIFICATE_PARSER=y

# --- SPL verified boot (SPL verifies U-Boot) ---
CONFIG_SPL=y
CONFIG_SPL_FIT=y
CONFIG_SPL_FIT_SIGNATURE=y
CONFIG_SPL_RSA=y
CONFIG_SPL_SHA256=y
CONFIG_SPL_CRYPTO=y
CONFIG_SPL_HASH=y

# --- Platform security (NXP example) ---
CONFIG_IMX_HAB=y                   # NXP HAB ROM support
CONFIG_AHAB_BOOT=y                 # For i.MX8M/8MP AHAB

# --- UEFI Secure Boot (if booting EFI) ---
CONFIG_EFI_LOADER=y
CONFIG_EFI_SECURE_BOOT=y
CONFIG_EFI_VARIABLES=y
CONFIG_PKCS7_MESSAGE_PARSER=y

# --- TPM Measured Boot (attestation) ---
CONFIG_TPM=y
CONFIG_TPM_V2=y
CONFIG_MEASURED_BOOT=y
CONFIG_MEASURE_DEVICETREE=y

# --- Console lockdown for production ---
# CONFIG_CMD_EDITENV is not set
# CONFIG_CMD_SAVEENV is not set  (lock after provisioning)
CONFIG_AUTOBOOT_KEYED=y
```

---

## Part 8: Common Chain of Trust Pitfalls

| Pitfall | Symptom | Fix |
|---------|---------|-----|
| Public key not rebuilt into U-Boot after key rotation | Boot succeeds (old key works) | Always rebuild U-Boot after key changes |
| `required = "conf"` missing | Unsigned images boot with warning | Set `required = "conf"` in .its AND mark key as required with `-r` |
| Key file permissions too wide | `mkimage` warning but proceeds | `chmod 400 *.pem` |
| DTB with key and DTB in FIT differ | Verification fails | Use same DTB hash throughout build |
| Clock skew on signature timestamp | `Certificate expired` after update | Use hardware RTC or NTP before signing |
| SPL too small for SHA+RSA code | SPL overflows SRAM | Enable only SHA-256 (not 512); reduce SPL footprint |
| Production fuse burn with wrong key | Device permanently broken | Pre-verify key hash matches fuse values before burning |
| Kernel FIT missing component hash | ``Hash algo: none`` | Every component needs `hash-1 { algo = sha256; }` |
