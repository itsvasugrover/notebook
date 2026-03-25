---
title: Best Practices
createTime: 2026/03/23 00:00:00
permalink: /kb/embedded/uboot/best-practices/
---

# U-Boot Best Practices

## 1. Build System and Source Management

### Always Work from a Tagged Release

```bash
# Clone at a specific release tag — DO NOT use master in production:
git clone https://source.denx.de/u-boot/u-boot.git --branch v2026.01 --depth 1

# Verify the tag signature (GPG signed by maintainer):
git tag -v v2026.01

# For patch tracking: create a branch on top of the tag
git checkout -b product/myboard v2026.01
```

### Keep Board Code Outside the Tree (Downstream Repo)

Maintain your board files in a separate repository and apply them as patches or via an overlay. This simplifies rebasing to new U-Boot versions:

```
my-platform-uboot/
├── patches/           ← git format-patch output against v2026.01
│   ├── 0001-board-add-myboard.patch
│   └── 0002-driver-add-myperipheral.patch
├── configs/
│   └── myboard_defconfig   ← Overrides the in-tree defconfig
└── apply.sh               ← git am < patches/*.patch
```

### Use `savedefconfig` Before Committing

Always save a minimal defconfig to avoid committing unnecessary generated options:

```bash
make savedefconfig          # Creates defconfig (minimal form)
cp defconfig configs/myboard_defconfig
git diff configs/myboard_defconfig   # Review changes
```

### Use `buildman` for Multi-Board CI

```bash
# Test your patches across all boards (catch regressions early):
tools/buildman/buildman --branch product/myboard --boards arm

# With parallel jobs:
tools/buildman/buildman -j8 --boards imx8mm_evk,imx8mn_evk,myboard
```

---

## 2. Configuration Best Practices

### Minimize the Feature Set

Every enabled feature:
- Adds code size
- Increases attack surface
- May introduce bugs

Principle: **enable only what is required for the product to function**.

```bash
# Start with a minimal defconfig to see what is truly required:
make allnoconfig
# Then add features one by one

# Check binary size after each change:
make -j$(nproc) && size u-boot | column -t
   text    data     bss     dec     hex  filename
 742548   56320   36848  835716   cc084  u-boot
```

### Critical Kconfigs for Production

```kconfig
# ── Security ──────────────────────────────────────────────────────────────
CONFIG_FIT_SIGNATURE=y              # Verify signed FIT images
CONFIG_DISABLE_CONSOLE=y           # Disable serial after POST if needed
# CONFIG_CMD_SETENV is not set     # Prevent env modification (post-lock)
# CONFIG_CMD_IMPORTENV is not set  # Prevent env import

# ── Stability ─────────────────────────────────────────────────────────────
CONFIG_WATCHDOG=y                  # Enable hardware watchdog
CONFIG_HW_WATCHDOG=y               # Feed watchdog in main loop
CONFIG_WATCHDOG_TIMEOUT_MSECS=10000  # 10 second watchdog timeout

# ── Reliability ───────────────────────────────────────────────────────────
CONFIG_ENV_REDUNDANT=y             # Redundant environment (dual copies)
CONFIG_BOOTCOUNT_LIMIT=y           # Limit boot retries before fallback
CONFIG_BOOTCOUNT_ENV=y             # Store bootcount in environment

# ── Size Optimization ─────────────────────────────────────────────────────
# CONFIG_LZMA is not set           # Remove unused compression
CONFIG_SYS_MALLOC_LEN=0x800000    # 8MB heap (adjust to minimum needed)
CONFIG_SYS_SPL_MALLOC_F_LEN=0x8000  # 32KB SPL malloc
```

---

## 3. SPL Size Optimization

SPL runs from on-chip SRAM, which is typically 64–512 KB. Keeping SPL small is critical.

### Check SPL Size

```bash
# After build:
wc -c spl/u-boot-spl.bin
# Must be below your platform's SRAM limit (e.g., 256 KB = 262144 bytes)

# Check segment sizes:
aarch64-none-linux-gnu-size spl/u-boot-spl
   text    data     bss     dec     hex  filename
 156372    3072   29696  189140   2e2d4  spl/u-boot-spl
```

### SPL Reduction Techniques

```kconfig
# Remove unused features from SPL:
# CONFIG_SPL_NET is not set              # No network in SPL
# CONFIG_SPL_USB_HOST is not set        # No USB in SPL (unless needed)
# CONFIG_SPL_DISPLAY is not set         # No display init in SPL
# CONFIG_SPL_CRYPTO_RSA is not set      # RSA only if using verified boot in SPL
CONFIG_SPL_DRIVERS_MISC=n

# Use smaller printf implementation in SPL:
CONFIG_SPL_USE_TINY_PRINTF=y

# Reduce stack and heap:
CONFIG_SYS_SPL_MALLOC_F_LEN=0x4000    # 16KB is often enough

# Compress U-Boot proper in SPL load:
CONFIG_SPL_LZMA=y                      # SPL decompresses U-Boot from LZMA
```

---

## 4. Environment Management

### Environment Versioning

Add a version variable to detect stale environments after firmware updates:

```bash
# In default env (include/env/myboard.h or via CONFIG_EXTRA_ENV_SETTINGS):
CONFIG_EXTRA_ENV_SETTINGS \
    "env_version=3\0" \
    "bootcmd=if test ${env_version} != 3; then " \
                "run factory_default; fi; run normal_boot\0" \
    "factory_default=env default -f -a && saveenv\0" \
    "normal_boot=run distro_bootcmd\0"
```

### Protect Critical Variables

```c
// board.c: override env write for specific variables:
int env_check_writeable(const char *name)
{
    static const char * const protected[] = {
        "serial#", "ethaddr", "env_version", NULL
    };
    for (int i = 0; protected[i]; i++) {
        if (!strcmp(name, protected[i]))
            return -EPERM;  /* Read-only */
    }
    return 0;
}
```

### Use `loadaddr` Conventions

Standardize on named addresses to avoid magic numbers:

```bash
setenv loadaddr      0x42000000   # Kernel/FIT load address
setenv fdt_addr      0x43000000   # FDT load address
setenv ramdisk_addr  0x44000000   # Ramdisk load address
setenv scripaddr     0x45000000   # Boot script address
```

---

## 5. Bootflow and Boot Reliability

### Implement a Boot Watchdog / Fallback

```bash
# bootcount_limit: if booting fails N times, fallback to recovery:
CONFIG_BOOTCOUNT_LIMIT=y
CONFIG_BOOTCOUNT_ENV=y
CONFIG_BOOTLIMIT=3              # 3 failed boots triggers altbootcmd

# Set altbootcmd for recovery:
setenv altbootcmd 'run recovery_boot'
setenv recovery_boot 'setenv bootargs console=ttymxc0,115200 init=/bin/sh; \
                      load mmc 0:2 ${loadaddr} recovery.itb; bootm ${loadaddr}'
setenv bootlimit 3
saveenv
```

### Persistent Boot State Machine

```bash
# Environment-based A/B partition tracking:
setenv slot_a_valid     1
setenv slot_b_valid     1
setenv active_slot      a
setenv upgrade_available 0

# bootcmd: check upgrade flag, select slot, verify:
setenv bootcmd '
    if test ${upgrade_available} = 1; then
        if test ${bootcount} > ${bootlimit}; then
            setenv active_slot ${fallback_slot};
            setenv upgrade_available 0;
            saveenv;
        fi;
    fi;
    if test ${active_slot} = a; then
        setenv bootpart 1;
    else
        setenv bootpart 2;
    fi;
    run boot_slot'
```

### Use distro_bootcmd for Generic Boot

```kconfig
CONFIG_DISTRO_DEFAULTS=y    # Enables distro_bootcmd auto-detection
```

distro_bootcmd scans `extlinux.conf` on multiple devices. This provides automatic boot source selection without hardcoded bootcmd.

---

## 6. Device Tree Best Practices

### Keep U-Boot DTS Separate from Linux DTS (Preferred Pattern)

```
arch/arm/dts/
├── mysoc-myboard.dts          ← Linux DTS (include from upstream)
└── mysoc-myboard-u-boot.dtsi  ← U-Boot additions only
```

```dts
// mysoc-myboard-u-boot.dtsi — include ONLY from U-Boot build
// Use bootph-* properties to control DM initialization stage

&uart1 {
    bootph-pre-ram;    // Available during pre-relocation (SPL + env)
};

&mmc0 {
    bootph-all;        // Available in all phases including SPL
};
```

### Never Duplicate nodes Between Linux and U-Boot DTS

Use `#include` and only add/override what is truly needed:

```dts
// mysoc-myboard.dts (U-Boot version)
#include "mysoc-myboard.dts"         // Include Linux DTS as base
#include "mysoc-myboard-u-boot.dtsi" // Add U-Boot-specific properties
```

---

## 7. Driver Development Best Practices

### Follow the Driver Model Patterns

```c
// Always use devres for allocations:
priv = devm_kzalloc(dev, sizeof(*priv), GFP_KERNEL);

// Use DM accessor macros, not raw struct offsets:
struct my_priv *priv = dev_get_priv(dev);

// Return proper error codes:
if (!priv)
    return -ENOMEM;
if (timeout_expired)
    return -ETIMEDOUT;

// Use log_* not printf in drivers:
log_debug("register at %p\n", priv->base);
log_err("init failed: %d\n", ret);
```

### Register I/O Conventions

```c
// Use portable register accessors (not direct pointer derefs):
#include <asm/io.h>

u32 val = readl(priv->base + REG_STATUS);
writel(val | BIT(3), priv->base + REG_CTRL);

// Memory barriers where needed:
writel(val, addr);
dmb();             // Data memory barrier

// For MMIO struct-style access:
setbits_le32(priv->base + REG_CTRL, BIT(4));   // Set bit
clrbits_le32(priv->base + REG_CTRL, BIT(4));   // Clear bit
clrsetbits_le32(addr, mask, value);            // Clear+set
```

---

## 8. Security Hardening Checklist

```markdown
## U-Boot Production Security Checklist

### Keys and Signing
- [ ] RSA-4096 or ECDSA P-384 signing key generated offline
- [ ] Private key stored in HSM or fully offline system
- [ ] Public key embedded in U-Boot DTB with `required = "conf"`
- [ ] FIT images signed with `mkimage -r`
- [ ] `fit_check_sign` passes on build server

### Boot Lock-Down
- [ ] `bootdelay=0` set in production env
- [ ] `CONFIG_AUTOBOOT_KEYED=y` configured (keyed or no-interrupt)
- [ ] Unnecessary commands removed from production config
- [ ] `CONFIG_FIT_SIGNATURE=y` enabled
- [ ] Console output disabled or reduced for production

### Platform Secure Boot
- [ ] Platform HAB/AHAB/OTP fuses programmed with correct SRK hash
- [ ] Part closed (HAB_CLOSED or equivalent) only after thorough testing
- [ ] Fallback/recovery image also signed

### Chain of Trust
- [ ] SPL verified boot enabled if platform supports it
- [ ] TF-A FIP signed
- [ ] U-Boot verifies Linux FIT
- [ ] Anti-rollback (rollback-index) defined and enforced

### Environment
- [ ] Environment variables validated at boot (version check)
- [ ] Critical variables (serial#, ethaddr) write-protected
- [ ] Redundant environment enabled
- [ ] Factory recovery procedure tested

### UEFI (if applicable)
- [ ] PK, KEK, db enrolled before shipping
- [ ] All EFI binaries signed with db key
- [ ] dbx contains revoked certificate SHA-256 hashes
```

---

## 9. Version Control and CI/CD

### Commit Message Format

Follow upstream U-Boot conventions (needed if you plan to upstream later):

```
board: myboard: add support for SPI NAND storage

Add SPI NAND support to MyBoard using the existing SPI NAND framework.
The board uses a Winbond W25N01GV 1Gbit SPI NAND connected to QSPI0.

Configuration:
- Page size: 2048 bytes
- OOB size: 64 bytes
- Block size: 128 KiB
- Total: 128 MiB

Tested on MyBoard rev 1.2 with U-Boot v2026.01.

Signed-off-by: Developer Name <dev@example.com>
```

### PR/Patch Validation

```bash
# Before submitting/merging any patch:

# 1. Check coding style:
scripts/checkpatch.pl --no-tree --strict 0001-my-change.patch

# 2. Build all affected boards:
tools/buildman/buildman --boards myboard,related_board

# 3. Run sandbox tests:
pytest test/py/ --bd sandbox --build -k "not slow"

# 4. Check for bloat:
aarch64-none-linux-gnu-size u-boot > size-after.txt
git stash
aarch64-none-linux-gnu-size u-boot > size-before.txt
git stash pop
diff size-before.txt size-after.txt
```

### CI Pipeline Template (`.gitlab-ci.yml` or GitHub Actions)

```yaml
# .github/workflows/uboot.yml
name: U-Boot Build and Test

on: [push, pull_request]

jobs:
  build:
    runs-on: ubuntu-24.04
    steps:
      - uses: actions/checkout@v4
      
      - name: Install dependencies
        run: |
          sudo apt-get update
          sudo apt-get install -y gcc-aarch64-linux-gnu build-essential \
            python3 python3-pytest python3-pexpect swig libssl-dev bison flex
      
      - name: Apply patches to U-Boot
        run: |
          git clone --branch v2026.01 --depth 1 \
            https://source.denx.de/u-boot/u-boot.git
          cd u-boot
          git am ../patches/*.patch
      
      - name: Build for MyBoard
        run: |
          cd u-boot
          make myboard_defconfig
          make -j$(nproc) CROSS_COMPILE=aarch64-linux-gnu-
      
      - name: Run sandbox tests
        run: |
          cd u-boot
          make sandbox_defconfig
          make -j$(nproc)
          pytest test/py/ --bd sandbox -x -q
      
      - name: Check binary size
        run: |
          cd u-boot
          aarch64-linux-gnu-size spl/u-boot-spl | tee spl-size.txt
          SPL_TEXT=$(awk 'NR==2{print $1}' spl-size.txt)
          [ "$SPL_TEXT" -lt 262144 ] || (echo "SPL text > 256KB!" && exit 1)
```

---

## 10. Common Mistakes to Avoid

| Mistake | Consequence | Fix |
|---------|-------------|-----|
| Using `master` branch in production | Non-reproducible builds, API churn | Always tag: `--branch v2026.01` |
| Hardcoding addresses in `bootcmd` | Breaks when RAM layout changes | Use named env vars (`loadaddr`, `fdt_addr`) |
| Not saving defconfig (`savedefconfig`) | Huge `.config` diff noise in commits | Run `make savedefconfig` before commit |
| `required` key missing from FIT | Unsigned images silently accepted | Add `required = "conf"` and `-r` to `mkimage` |
| Burning fuses without verifying signature | Permanently bricked device | Pre-verify FIT signature before fuse burn |
| Committing `.config` not `defconfig` | Breaks other board builds | Never commit `.config`; always `configs/board_defconfig` |
| Ignoring watchdog in production | System hangs forever if boot fails | Enable `CONFIG_WATCHDOG=y` |
| Single environment copy | Corruption causes unbootable device | Use `CONFIG_ENV_REDUNDANT=y` |
| Not testing recovery path | Recovery path untested until disaster | Test `altbootcmd` path before shipping |
| printf() in drivers instead of log_*() | Breaks silent boot, log filtering | Always use `log_info()`, `log_err()`, etc. |
