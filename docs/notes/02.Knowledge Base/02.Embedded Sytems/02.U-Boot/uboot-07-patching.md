---
title: Patching U-Boot
createTime: 2026/03/23 00:00:00
permalink: /kb/embedded/uboot/patching/
---

# Adding Patches to U-Boot

## Overview

Patches in U-Boot are used to:
1. Add support for a custom board/SoC not yet upstream
2. Apply bug fixes between releases
3. Backport features from newer U-Boot to a stable tag
4. Apply vendor-specific modifications (NDA code, proprietary drivers)
5. Prepare patches for upstream submission

U-Boot uses **standard Linux kernel patch workflow**: patches in unified diff format (`git format-patch`) applied via `git am` or `patch`.

---

## Patch Management Approaches

### Approach 1: Git Commits on a Branch (Recommended for BSP Development)

```
v2026.01 tag (upstream)
    |
    ├── commit: "arm: mysoc: add MySoC SoC support"
    ├── commit: "board: myvendor: add myboard support"
    ├── commit: "configs: add myboard_defconfig"
    └── commit: "arm: dts: add mysoc-myboard device tree"
```

This is the cleanest approach: your patches live as normal git commits on a feature branch.

```bash
# Start from the tag
git checkout -b feature/myboard v2026.01

# Make changes and commit them
git add arch/arm/mach-mysoc/
git commit -m "arm: mysoc: add MySoC SoC clock driver"

git add board/myvendor/myboard/
git commit -m "board: myvendor/myboard: add initial board support"
```

### Approach 2: Quilt (for patchset management)

Quilt is a classic patch management tool used when you manage patches as files. Widely used in Yocto BSP layers and OpenEmbedded.

```bash
sudo apt-get install quilt
```

### Approach 3: Yocto `.bbappend` patches

If building U-Boot via Yocto/OE, patches are placed in the recipe's `files/` directory and applied via `SRC_URI`. (Covered separately in the Yocto section.)

---

## Method 1: Git-Based Patch Workflow

### Creating Patches with `git format-patch`

`git format-patch` creates `.patch` files from commits. Each file is a complete, self-contained patch with metadata.

```bash
# Generate patch for the last commit
git format-patch -1 HEAD

# Generate patches for last 3 commits
git format-patch -3 HEAD

# Generate patches from a range
git format-patch v2026.01..HEAD

# Generate patches into a specific directory
git format-patch -o /tmp/myboard-patches v2026.01..HEAD

# Generate a numbered patch series (001-..., 002-..., etc.)
git format-patch --numbered v2026.01..HEAD -o patches/

# Add a cover letter (patch series summary email)
git format-patch --cover-letter -n v2026.01..HEAD -o patches/
# Edit patches/0000-cover-letter.patch with subject and description
```

### Patch File Format

A patch file produced by `git format-patch` looks like:

```
From a1b2c3d4e5f6... Mon Sep 17 00:00:00 2001
From: Your Name <your.email@company.com>
Date: Mon, 23 Mar 2026 10:00:00 +0000
Subject: [PATCH 1/3] board: myvendor/myboard: add initial board support

Add support for MyBoard based on MySoC Cortex-A55.

Key features:
- 1 GB LPDDR4 at 0x40000000
- eMMC HS400 on USDHC1
- Designware Ethernet
- NS16550 UART console

Signed-off-by: Your Name <your.email@company.com>
---
 board/myvendor/myboard/Kconfig    |  20 +++
 board/myvendor/myboard/Makefile   |   5 +
 board/myvendor/myboard/myboard.c  | 180 +++++++++++++++++++++++
 configs/myboard_defconfig         |  55 +++++++
 4 files changed, 260 insertions(+)
 create mode 100644 board/myvendor/myboard/Kconfig
 ...

diff --git a/board/myvendor/myboard/Kconfig b/board/myvendor/myboard/Kconfig
new file mode 100644
index 000000000000..b1c2d3e4f5a6
--- /dev/null
+++ b/board/myvendor/myboard/Kconfig
@@ -0,0 +1,20 @@
+if TARGET_MYBOARD
+
+config SYS_BOARD
+    default "myboard"
...
```

### Applying Patches with `git am`

```bash
# Apply a single patch
git am 0001-board-myvendor-myboard-add-initial-board-support.patch

# Apply all patches in a directory
git am patches/*.patch

# Apply patches with 3-way merge (helps with conflicts)
git am -3 patches/*.patch

# Apply patches while keeping message-ID for reference
git am --keep-cr patches/*.patch

# If a patch fails to apply cleanly:
git am --abort     # Abort and reset to pre-am state
git am --skip      # Skip the failing patch (dangerous! may lose changes)

# After manually resolving conflicts:
git add <conflicted-files>
git am --continue
```

### Applying Patches with the `patch` Tool

For simple patches not in git format:
```bash
# Apply from file
patch -p1 < mypatch.patch

# Test without applying (dry run)
patch -p1 --dry-run < mypatch.patch

# Reverse/undo a patch
patch -p1 -R < mypatch.patch

# Handle CRLF line endings
patch -p1 --binary < mypatch.patch
```

---

## Method 2: Quilt Patch Series Management

Quilt manages a stack of patches on top of a base source tree. Patches are stored as files in a `patches/` directory with a `series` file controlling order.

### Setting Up Quilt

```bash
# Install quilt
sudo apt-get install quilt

# Configure quilt (create ~/.quiltrc)
cat > ~/.quiltrc << 'EOF'
QUILT_DIFF_ARGS="--no-timestamps --no-index -p ab --color=auto"
QUILT_REFRESH_ARGS="--no-timestamps --no-index -p ab"
QUILT_SERIES_ARGS="--color=auto"
QUILT_PATCH_OPTS="--unified"
QUILT_DIFF_OPTS="-p"
EDITOR=vim
EOF
```

### Initial Setup on U-Boot Source

```bash
cd u-boot

# Initialize quilt on the source (non-git, or alongside git)
# quilt uses patches/ directory and patches/series file
ls patches/     # Will be created when you push first patch
cat patches/series  # Ordered list of patches to apply
```

### Creating a New Patch with Quilt

```bash
# Import quilt
export QUILT_PATCHES=patches   # Default, can omit

# Create a new empty patch
quilt new 0001-board-myvendor-myboard-initial.patch

# Add files that the patch will modify
quilt add board/myvendor/myboard/myboard.c
quilt add configs/myboard_defconfig
quilt add arch/arm/dts/mysoc-myboard.dts

# ... make your edits to those files ...
vim board/myvendor/myboard/myboard.c

# Refresh (finalize) the patch
quilt refresh

# Check the patch contents
quilt diff       # Show uncommitted changes vs top patch
quilt top        # Show currently active top patch
```

### Working with the Patch Stack

```bash
# Show all patches in series
quilt series

# Show which patches are applied
quilt applied

# Show which patches are not yet applied
quilt unapplied

# Push (apply) next patch
quilt push

# Push all patches
quilt push -a

# Pop (unapply) top patch
quilt pop

# Pop all patches
quilt pop -a

# Go to a specific patch
quilt goto 0003-drivers-net-add-myeth.patch

# Edit a patch that's already in the stack
quilt push -a                      # Apply all
quilt goto 0002-some-patch.patch   # Go to the patch
quilt add drivers/net/myeth.c      # Add new file to patch scope
# ... edit the file ...
quilt refresh                      # Update the patch file
quilt pop -a                       # Pop all
quilt push -a                      # Re-apply cleanly
```

### The `patches/series` File

```
# patches/series
0001-arm-mysoc-add-clock-driver.patch
0002-arm-mysoc-add-ddr-init.patch
0003-board-myvendor-myboard-initial-support.patch
0004-configs-add-myboard-defconfig.patch
0005-arm-dts-add-mysoc-myboard.patch
0006-drivers-net-dwmac-fix-speed-negotiation.patch -p1
```

The optional `-p1` after a patch name overrides the default strip level.

---

## Method 3: Applying Vendor / Third-Party Patches

### Typical Vendor SDK Patch Structure

Vendors (NXP, Rockchip, TI, etc.) often provide U-Boot forks or patch series:

```bash
# Example: NXP i.MX releases patches relative to U-Boot tag
# NXP release: lf-6.6.52-2.2.0 uses u-boot-lf_v2024.04

git clone https://github.com/nxp-imx/uboot-imx.git
git checkout lf_v2024.04

# Their commits are additional patches on top of v2024.04
git log v2024.04..HEAD --oneline | head -20
```

### Extracting Vendor Patches

If you want to apply vendor patches onto a different base (e.g., to maintain alignment with v2026.01):

```bash
# Generate patches from vendor commits on top of base tag
cd uboot-vendor
git format-patch v2026.01..HEAD -o /tmp/vendor-patches/

# Apply to your clean v2026.01 tree
cd u-boot
git am --reject -3 /tmp/vendor-patches/*.patch

# Review rejects manually
find . -name "*.rej" | xargs ls -la
```

### Handling Patch Conflicts

```bash
# When git am fails, view the failure
git am --show-current-patch

# Option 1: Edit the file, mark resolved, continue
vim drivers/mmc/sdhci.c     # Fix conflict manually
git add drivers/mmc/sdhci.c
git am --continue

# Option 2: Use git mergetool
git mergetool

# Option 3: Abort and redo with 3-way merge
git am --abort
git am -3 0042-drivers-mmc-sdhci-fix-timing.patch
```

---

## Using U-Boot's `patman` Tool

`patman` is U-Boot's own patch preparation and submission tool. It automates tagging, CC lists, version tracking, and formatting patches for submission.

### Setup

```bash
# Install patman dependencies
pip3 install gitpython pygit2

# Configure patman (reads from .patman in repo root or ~/.patman)
cat > .patman << 'EOF'
[settings]
smtp_server: smtp.gmail.com
smtp_port: 587
from_address: yourname@company.com

[alias]
u-boot: u-boot@lists.denx.de
tom: Tom Rini <trini@konsulko.com>
EOF

# Add maintainer database (from .mailmap / MAINTAINERS-like file)
```

### Creating a Patch Series with `patman`

```bash
# From your branch with commits
# patman reads commit messages for tags like:
# Series-to: u-boot
# Series-cc: tom
# Cover-letter: END
# ... description ...
# END

# Create series
tools/patman/patman.py send --dry-run -n 5  # Last 5 commits
tools/patman/patman.py send -n 5           # Actually send to mailing list
```

### Commit Message Format for patman

```
board: myvendor/myboard: add initial board support

Add support for MyBoard based on MySoC Cortex-A55 platform.

The board features:
- 1 GB LPDDR4 at 0x40000000
- eMMC 5.1 HS400 on USDHC1
- Designware GMAC Ethernet
- NS16550 UART

Series-to: u-boot
Series-cc: Heinrich Schuchardt <xypron.glx@gmx.de>
Reviewed-by: Tom Rini <trini@konsulko.com>
Signed-off-by: Your Name <your.email@company.com>
```

---

## Applying Patches in Yocto (for BSP integration)

When integrating U-Boot into a Yocto build via a BSP layer, patches go in the recipe's `files/` or `patches/` directory:

### Directory Structure

```
meta-myvendor/
└── recipes-bsp/
    └── u-boot/
        ├── u-boot-myvendor_2026.01.bb    (or .bbappend)
        └── files/
            ├── 0001-arm-mysoc-add-clocks.patch
            ├── 0002-board-myvendor-add-myboard.patch
            ├── 0003-configs-add-myboard-defconfig.patch
            └── myboard_defconfig
```

### `u-boot-myvendor_2026.01.bb`

```bitbake
# recipes-bsp/u-boot/u-boot-myvendor_2026.01.bb
DESCRIPTION = "U-Boot bootloader for MyVendor boards"
LICENSE = "GPL-2.0-or-later"
LIC_FILES_CHKSUM = "file://Licenses/gpl-2.0.txt;md5=b234ee4d..."

# Inherit the standard U-Boot class
inherit uboot-config

# Source: U-Boot v2026.01 + patches
SRC_URI = "git://source.denx.de/u-boot/u-boot.git;branch=master;protocol=https \
           file://0001-arm-mysoc-add-clocks.patch \
           file://0002-board-myvendor-add-myboard.patch \
           file://0003-configs-add-myboard-defconfig.patch \
           file://myboard_defconfig \
           "

SRCREV = "abcdef1234567890abcdef1234567890abcdef12"  # Commit for v2026.01
PV = "2026.01+git${SRCPV}"

S = "${WORKDIR}/git"

# defconfig to use for this machine
UBOOT_CONFIG ??= "myboard"
UBOOT_CONFIG[myboard] = "myboard_defconfig,,u-boot.itb"

# Build SPL + proper
UBOOT_MAKE_TARGET = "all"
UBOOT_BINARY = "u-boot.itb"
SPL_BINARY = "spl/u-boot-spl.bin"
```

### `.bbappend` Approach (Extending Existing Recipe)

```bitbake
# recipes-bsp/u-boot/u-boot_%.bbappend
FILESEXTRAPATHS:prepend := "${THISDIR}/files:"

SRC_URI:append:myboard = " \
    file://0001-arm-mysoc-add-clocks.patch \
    file://0002-board-myvendor-add-myboard.patch \
    file://0003-configs-add-myboard-defconfig.patch \
    "

UBOOT_MACHINE:myboard = "myboard_defconfig"
```

---

## Patch Checkpatch Validation

Before submitting patches upstream, always run `checkpatch.pl`:

```bash
# Check a single patch file
scripts/checkpatch.pl 0001-board-myvendor-myboard-initial.patch

# Check the last N commits
scripts/checkpatch.pl --git HEAD~3..HEAD

# Check a specific file for style
scripts/checkpatch.pl --no-tree -f board/myvendor/myboard/myboard.c

# Check with relaxed rules (for board-specific code)
scripts/checkpatch.pl --subjective 0001-*.patch
```

Common issues found by checkpatch:
- Missing `SPDX-License-Identifier` header
- Lines longer than 80 characters (U-Boot limit)
- Trailing whitespace
- Missing `Signed-off-by:` line
- Wrong commit message format
- Function declarations with arguments in wrong style
- Use of banned functions (`strcpy`, `sprintf` without bounds check)

---

## Maintaining a Patch Series Across U-Boot Versions

### Rebasing Patches to a New Release

```bash
# You are on: feature/myboard based on v2025.10
# You want to: rebase onto v2026.01

git fetch origin
git checkout feature/myboard

# Rebase all your commits onto the new tag
git rebase --onto v2026.01 v2025.10 feature/myboard

# Resolve any conflicts
# Run: git status → edit conflicted files → git add → git rebase --continue

# Verify build still works
make myboard_defconfig && make -j$(nproc)
```

### Using `buildman` to Test Patch Impact

```bash
# Build the board before and after the patch
tools/buildman/buildman.py -o /tmp/before myboard
git am mypatch.patch
tools/buildman/buildman.py -o /tmp/after myboard

# Compare binary sizes  
ls -la /tmp/before/myboard/u-boot.bin /tmp/after/myboard/u-boot.bin
```
