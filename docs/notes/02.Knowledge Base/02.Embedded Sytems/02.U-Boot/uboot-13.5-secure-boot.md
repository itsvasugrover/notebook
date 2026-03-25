---
title: Secure Boot II
createTime: 2026/03/23 12:36:07
permalink: /kb/embedded/uboot/secure-boot-ii/
---

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
