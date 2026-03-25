---
title: Configuration Files (.conf)
createTime: 2025/12/21 22:21:19
permalink: /kb/embedded/yocto/configuration-files/
---

# Configuration Files (.conf)

## Variable Assignment Operators — The Most Critical Concept

BitBake variables are not simple strings — they are computed through a series of operators applied in a defined order. Misunderstanding these is the #1 source of hard-to-diagnose build problems.

```bash
# Hard assignment — standard; ${} expanded at parse time
VAR = "${OTHER_VAR}/suffix"

# Forced-immediate — expands RHS at parse time regardless of order
VAR := "${OTHER_VAR}/suffix"

# Soft default — only if VAR is not already set
VAR ?= "default_value"

# Weakest default — only if NOTHING else has assigned VAR anywhere
VAR ??= "very_weak_default"

# Append with space (applied at parse time)
VAR += "more"

# Append without space (applied at parse time)
VAR .= "suffix"

# Deferred modifiers — applied LAST, after all = assignments
# (Order of these across files does NOT matter; they always win)
VAR:prepend = "prefix_"
VAR:append  = "_suffix"
VAR:remove  = "specific_token"
```

The `:append`/`:prepend`/`:remove` operators are stored as modifiers and applied to the final value only when the variable is actually read. This deferred model is how `.bbappend` files can safely extend `SRC_URI` without race conditions.

## OVERRIDES — Conditional Variable Selection

`OVERRIDES` is a colon-separated list of active identifiers. BitBake automatically selects the most-specific version of any variable:

```bash
# OVERRIDES is assembled from MACHINE, TARGET_OS, DISTRO, class context, etc.
OVERRIDES = "aarch64:raspberrypi4-64:poky:class-target:..."

# Machine-specific default — selected when MACHINE=raspberrypi4-64
KERNEL_IMAGETYPE                  = "zImage"        # fallback
KERNEL_IMAGETYPE:raspberrypi4-64  = "Image.gz"      # used for RPi4
KERNEL_IMAGETYPE:qemuarm64        = "Image"         # used for QEMU ARM64
```

The override syntax (`:machine-name`) replaced the old `_machine-name` underscore syntax in Yocto 3.4 (Honister). Old recipes using `SRC_URI_append` need updating to `SRC_URI:append`.

## `bitbake.conf` — The Root Configuration

Located at `meta/conf/bitbake.conf`. Sets all fundamental defaults. Key variable groups:

```bash
# Paths
TMPDIR    = "${TOPDIR}/tmp"
DL_DIR    = "${TOPDIR}/../downloads"       # Shared downloads directory
SSTATE_DIR = "${TOPDIR}/../sstate-cache"  # Shared state cache

# Cross-compilation toolchain
TARGET_ARCH   = "aarch64"
TARGET_OS     = "linux"
TARGET_PREFIX = "${TARGET_SYS}-"
CC  = "${TARGET_PREFIX}gcc ${HOST_CC_ARCH}${TOOLCHAIN_OPTIONS}"
CXX = "${TARGET_PREFIX}g++ ${HOST_CC_ARCH}${TOOLCHAIN_OPTIONS}"

# FHS-compliant directory variables
prefix      = "/usr"
exec_prefix = "${prefix}"
bindir      = "${exec_prefix}/bin"
sbindir     = "${exec_prefix}/sbin"
libdir      = "${exec_prefix}/lib"
includedir  = "${prefix}/include"
sysconfdir  = "/etc"
localstatedir = "/var"
```

Never edit `bitbake.conf`. Override its values in `local.conf` or a `distro.conf`.

## `local.conf` — Per-Build User Configuration

```bash
# ─── Required ───────────────────────────────────────────────────────────────────
MACHINE = "raspberrypi4-64"
DISTRO  = "poky"

# ─── Build Performance ───────────────────────────────────────────────────────────────
BB_NUMBER_THREADS ?= "${@oe.utils.cpu_count()}"
PARALLEL_MAKE     ?= "-j ${@oe.utils.cpu_count()}"

# ─── Shared Caches (share across projects and team members) ────────────────
SSTATE_DIR ?= "/srv/yocto/sstate-cache"
DL_DIR     ?= "/srv/yocto/downloads"
SSTATE_MIRRORS = "file://.* https://sstate.example.com/PATH"

# ─── Packages and Image ─────────────────────────────────────────────────────────
PACKAGE_CLASSES      = "package_ipk"
EXTRA_IMAGE_FEATURES += "debug-tweaks ssh-server-openssh"

# ─── Source Mirrors ───────────────────────────────────────────────────────────────
PREMIRRORS:prepend = "https://.*/.* https://mirror.example.com/sources/ \n"

# ─── Disk Space Safety Guard ────────────────────────────────────────────────────────
BB_DISKMON_DIRS = "STOPTASKS,${TMPDIR},1G,100K HALT,${SSTATE_DIR},512M,50K"

# ─── License Policy ──────────────────────────────────────────────────────────────────
# Without this, GPL-3 and commercial components fail to build
LICENSE_FLAGS_ACCEPTED = "commercial_ffmpeg"
```

## `machine.conf` — Minimal Custom Board

```bash
# conf/machine/my-imx8m-board.conf
require conf/machine/include/arm/arch-armv8a.inc

MACHINE_FEATURES = "usbhost usbgadget wifi bluetooth alsa"

# Kernel
PREFERRED_PROVIDER_virtual/kernel = "linux-fslc"
PREFERRED_VERSION_linux-fslc      = "6.6%"
KERNEL_IMAGETYPE   = "Image"
KERNEL_DEVICETREE  = "freescale/imx8mp-my-board.dtb"

# Bootloader
PREFERRED_PROVIDER_virtual/bootloader = "u-boot-fslc"
UBOOT_MACHINE     = "my_board_defconfig"
UBOOT_ENTRYPOINT  = "0x40480000"
UBOOT_LOADADDRESS = "0x40480000"

# Serial console
SERIAL_CONSOLES = "115200;ttymxc1"

# Image types
IMAGE_FSTYPES = "ext4 wic.gz"
WKS_FILE      = "my-board-sdcard.wks"
```

## Configuration File Loading Order

```
bitbake.conf           ← layer meta/conf/ — global defaults, never edit
    ↓
auto.conf              ← generated by toaster/scripts; do not edit
    ↓
local.conf             ← your per-build customisations
    ↓
machine.conf           ← included by MACHINE variable
    ↓
distro.conf            ← included by DISTRO variable
    ↓
recipe .bb files       ← per-component settings
    ↓
.bbappend files        ← layer overrides
```

Later files override earlier files for hard assignments (`=`). The `:append`/`:prepend` operators accumulate across all files regardless of order.
