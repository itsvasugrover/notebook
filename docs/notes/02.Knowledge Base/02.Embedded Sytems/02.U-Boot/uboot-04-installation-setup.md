---
title: Installation & Setup
createTime: 2026/03/23 00:00:00
permalink: /kb/embedded/uboot/installation-setup/
---

# U-Boot Installation and Setup (v2026.01)

## Prerequisites

### Host System Dependencies

#### Ubuntu 22.04 / 24.04 / Debian 12
```bash
sudo apt-get update
sudo apt-get install -y \
    bc \
    bison \
    build-essential \
    coccinelle \
    device-tree-compiler \
    dfu-util \
    efitools \
    flex \
    gdisk \
    git \
    gpg \
    libgnutls28-dev \
    libncurses5-dev \
    libpython3-dev \
    libsdl2-dev \
    libssl-dev \
    lz4 \
    lzma \
    lzma-alone \
    make \
    openssl \
    pkg-config \
    python3 \
    python3-asteval \
    python3-cbor2 \
    python3-coverage \
    python3-filelock \
    python3-pkg-resources \
    python3-pycryptodome \
    python3-pyelftools \
    python3-pytest \
    python3-pytest-xdist \
    python3-setuptools \
    python3-sphinx \
    python3-sphinx-rtd-theme \
    python3-subunit \
    python3-tabulate \
    python3-testtools \
    swig \
    uuid-dev
```

#### Fedora / RHEL / Rocky Linux
```bash
sudo dnf install -y \
    bc bison dtc dfu-util flex gcc gcc-c++ git make \
    ncurses-devel openssl-devel swig python3-devel \
    python3-pyelftools python3-pytest python3-setuptools \
    libgnutls-devel lz4 lzma SDL2-devel
```

#### Arch Linux
```bash
sudo pacman -S base-devel bc bison dtc flex git \
    gnutls libssl ncurses openssl python python-pyelftools \
    python-pytest swig lz4 python-setuptools sdl2
```

---

## Obtaining the Source Code (v2026.01)

### Method 1: Clone and Checkout Tag (Recommended)
```bash
# Clone the official repository
git clone https://source.denx.de/u-boot/u-boot.git
cd u-boot

# Checkout the v2026.01 stable tag
git checkout v2026.01

# Verify the tag
git log --oneline -5
# Should show: "Merge tag 'v2026.01'" at top
```

### Method 2: Clone with Specific Tag
```bash
git clone --branch v2026.01 --depth 1 \
    https://source.denx.de/u-boot/u-boot.git
cd u-boot
```

### Method 3: GitHub Mirror
```bash
git clone --branch v2026.01 --depth 1 \
    https://github.com/u-boot/u-boot.git
cd u-boot
```

### Verifying the Tag Signature (Optional but Recommended)
```bash
# Import Wolfgang Denk's GPG key (U-Boot maintainer)
gpg --keyserver keyserver.ubuntu.com --recv-keys 1A28909E
gpg --keyserver keyserver.ubuntu.com --recv-keys 87F9F635

# Verify the tag
git verify-tag v2026.01
# Expected: "Good signature from ..."
```

### Creating a Working Branch
```bash
git checkout -b my-platform-bsp v2026.01
```

---

## Cross-Compilation Toolchain Setup

U-Boot requires a cross-compiler matching the target architecture. The `CROSS_COMPILE` variable is a prefix for all compiler tools.

### ARM 32-bit (Cortex-A/M)
```bash
# Download ARM GNU toolchain (GCC 13+)
# From: https://developer.arm.com/downloads/-/arm-gnu-toolchain-downloads

wget https://developer.arm.com/-/media/Files/downloads/gnu/13.3.rel1/binrel/\
arm-gnu-toolchain-13.3.rel1-x86_64-arm-none-eabi.tar.xz

tar xf arm-gnu-toolchain-13.3.rel1-x86_64-arm-none-eabi.tar.xz
export PATH=$PWD/arm-gnu-toolchain-13.3.rel1-x86_64-arm-none-eabi/bin:$PATH
export CROSS_COMPILE=arm-none-eabi-

# Verify
arm-none-eabi-gcc --version
```

### ARM 64-bit (AArch64 / Cortex-A53/A55/A72/A76)
```bash
wget https://developer.arm.com/-/media/Files/downloads/gnu/13.3.rel1/binrel/\
arm-gnu-toolchain-13.3.rel1-x86_64-aarch64-none-linux-gnu.tar.xz

tar xf arm-gnu-toolchain-13.3.rel1-x86_64-aarch64-none-linux-gnu.tar.xz
export PATH=$PWD/arm-gnu-toolchain-13.3.rel1-x86_64-aarch64-none-linux-gnu/bin:$PATH
export CROSS_COMPILE=aarch64-none-linux-gnu-
```

### RISC-V 64-bit
```bash
# Using riscv-gnu-toolchain
sudo apt-get install gcc-riscv64-linux-gnu
export CROSS_COMPILE=riscv64-linux-gnu-

# Or use the RISC-V toolchain from SiFive/riscv-collab:
# https://github.com/riscv-collab/riscv-gnu-toolchain
```

### Using Yocto/OE SDK Toolchain
If you are using a Yocto-built toolchain:
```bash
source /opt/poky/5.0/environment-setup-aarch64-poky-linux
# CROSS_COMPILE is set automatically by the SDK environment
```

### Setting CROSS_COMPILE Persistently
```bash
# Add to ~/.bashrc or use a wrapper script
export ARCH=arm64
export CROSS_COMPILE=aarch64-none-linux-gnu-

# U-Boot respects both ARCH and CROSS_COMPILE
```

---

## First Build: QEMU ARM64 (Quick Verification)

This is the easiest way to verify your build environment is correct:

```bash
cd u-boot

# Set cross-compiler
export CROSS_COMPILE=aarch64-none-linux-gnu-

# Load qemu_arm64 defconfig
make qemu_arm64_defconfig

# Build (use all CPU cores)
make -j$(nproc)

# Verify output
ls -lh u-boot.bin u-boot
```

Expected output files:
```
u-boot           - ELF file (with debug symbols)
u-boot.bin       - Raw binary
u-boot-dtb.bin   - Binary with device tree appended
u-boot.map       - Symbol map
System.map       - Simplified symbol map
```

### Testing with QEMU
```bash
sudo apt-get install qemu-system-arm

qemu-system-aarch64 \
    -machine virt \
    -cpu cortex-a57 \
    -nographic \
    -bios u-boot.bin

# Expected: U-Boot prompt "=>"
```

---

## Build System Overview

U-Boot uses a GNU Make + Kconfig build system similar to the Linux kernel.

### Build Flow
```
make <board>_defconfig     → .config
make menuconfig            → Interactive Kconfig editor
make -j$(nproc)            → Build all targets
make <specific_target>     → Build individual artifact
```

### Important Make Targets

```bash
# Configuration
make <board>_defconfig     # Load board's default config
make menuconfig            # ncurses-based configuration editor
make nconfig               # Alternative ncurses UI
make xconfig               # Qt-based GUI (requires Qt)
make gconfig               # GTK-based GUI
make oldconfig             # Update .config from older defconfig
make savedefconfig         # Save minimal defconfig from .config
make defconfig             # Use default for current ARCH

# Building
make -j$(nproc)            # Build everything
make u-boot.bin            # Build just u-boot.bin
make spl/u-boot-spl.bin    # Build just SPL
make tpl/u-boot-tpl.bin    # Build just TPL
make u-boot.itb            # Build FIT image
make flash.bin             # Platform-specific combined image

# Cleaning
make clean                 # Remove build artifacts (keep .config)
make mrproper              # Remove everything including .config
make distclean             # Like mrproper + remove backups

# Information
make CROSS_COMPILE=... V=1 # Verbose build
make boards                # List all supported boards
make help                  # Show all available targets
make env                   # Show build environment variables

# Testing
make check                 # Run unit tests (sandbox)
make tcheck                # Parallel testing
```

### Out-of-Tree Builds

You can build into a separate directory to keep the source clean:
```bash
mkdir /tmp/uboot-build
make O=/tmp/uboot-build qemu_arm64_defconfig
make O=/tmp/uboot-build -j$(nproc)

# All artifacts end up in /tmp/uboot-build/
```

### Environment Variables Reference

| Variable | Default | Description |
|----------|---------|-------------|
| `ARCH` | (from defconfig) | Target architecture: `arm`, `arm64`, `riscv`, `x86` |
| `CROSS_COMPILE` | (empty for native) | Toolchain prefix: `aarch64-none-linux-gnu-` |
| `V` | `0` | Verbose: `V=1` shows full commands |
| `O` | `.` | Output directory for out-of-tree build |
| `DTB` | (from defconfig) | Override device tree blob filename |
| `EXT_DTB` | (empty) | Path to an external pre-compiled DTB |
| `KBUILD_OUTPUT` | (same as O) | Alternative to O |
| `CONFIG_` | — | Individual Kconfig overrides (not recommended) |
| `BL31` | (empty) | Path to ARM Trusted Firmware BL31 binary |
| `TEE` | (empty) | Path to OP-TEE binary for embedding |
| `LOADADDR` | (from config) | Override load address |

---

## Python Dependencies for Tools

Several tools (patman, binman, buildman) require Python 3.8+:

```bash
# Install Python dependencies
pip3 install --user \
    asteval \
    cbor2 \
    filelock \
    pycryptodome \
    pyelftools \
    pytest \
    tabulate \
    fdt

# Or using requirements file (if present in tools/patman/)
pip3 install -r tools/patman/requirements.txt
```

---

## Using `buildman` for Multi-Board Builds

`buildman` is U-Boot's own multi-board build tool, useful for CI and testing patches across many boards:

```bash
# Build a single board
tools/buildman/buildman.py -o /tmp/build rpi_4

# Build all ARM64 boards
tools/buildman/buildman.py -o /tmp/build -a arm64

# Test a patch series for regressions
tools/buildman/buildman.py -o /tmp/build rpi_4 -P

# Show build errors only  
tools/buildman/buildman.py -o /tmp/build -a arm64 -sE

# Use custom toolchain
tools/buildman/buildman.py -o /tmp/build rpi_4 \
    --toolchain /opt/toolchains/aarch64-none-linux-gnu-
```

Configure buildman in `~/.buildman`:
```ini
[toolchain]
# Add toolchain paths
root = /opt/linaro/

[toolchain-alias]
arm = arm-linux-gnueabihf-
aarch64 = aarch64-none-linux-gnu-
riscv64 = riscv64-linux-gnu-
```
