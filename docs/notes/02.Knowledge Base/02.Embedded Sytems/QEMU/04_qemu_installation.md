---
title: QEMU Installation
createTime: 2026/03/14 14:21:19
permalink: /kb/embedded/qemu/qemu-installation/
---

# QEMU Installation

## Build System Overview

Since QEMU 4.0, the build system uses **Meson + Ninja**, replacing the old autoconf/make system. The `./configure` script is still present but it is now a thin wrapper that generates a Meson build directory.

```
configure (wrapper)
    └──► meson setup build/  ──► Ninja  ──► binaries
```

## System Dependencies (Ubuntu 22.04 / 24.04)

```bash
# Core build tools:
sudo apt-get update
sudo apt-get install -y \
    git python3 python3-pip meson ninja-build \
    pkg-config libglib2.0-dev libpixman-1-dev \
    gcc g++ make

# For specific features:
sudo apt-get install -y \
    libslirp-dev \
    libcap-ng-dev \
    libattr1-dev \
    libfuse3-dev \
    libspice-server-dev \
    libaio-dev \
    libvirgl-dev \
    libepoxy-dev \
    libdrm-dev \
    libgbm-dev \
    libfdt-dev \
    libsdl2-dev \
    libgtk-3-dev \
    libvte-2.91-dev \
    libssl-dev \
    liblzo2-dev \
    libbzip2-dev \
    zlib1g-dev

# Python dependencies for tests and scripts:
pip3 install sphinx sphinx_rtd_theme tomli pyyaml
```

## Getting the Source

```bash
# Latest release:
git clone https://gitlab.com/qemu-project/qemu.git --branch v9.2.0 --depth 1
cd qemu

# Or latest development:
git clone https://gitlab.com/qemu-project/qemu.git
cd qemu
git submodule update --init --recursive    # dtc, berkleydb, etc.
```

## Building: Selective Target List

Building all targets takes very long. For embedded work, build only what you need:

```bash
# ARM32 + AArch64 + RISC-V only (recommended for embedded):
./configure \
    --target-list=arm-softmmu,aarch64-softmmu,riscv64-softmmu,riscv32-softmmu \
    --enable-slirp \
    --enable-plugins \
    --enable-debug-info

# With KVM support (for x86 host):
./configure \
    --target-list=aarch64-softmmu,arm-softmmu,riscv64-softmmu,x86_64-softmmu \
    --enable-kvm \
    --enable-slirp \
    --enable-plugins

# Minimal: user-mode and one system target:
./configure \
    --target-list=aarch64-softmmu,aarch64-linux-user,arm-linux-user

# Build:
make -j$(nproc)

# Install (optional):
sudo make install
```

## Key Configure Options

| Option | Effect |
|--------|--------|
| `--target-list=<list>` | Comma-separated list of targets to build |
| `--enable-kvm` | KVM hardware acceleration (Linux only) |
| `--enable-hvf` | Apple Hypervisor.framework (macOS only) |
| `--enable-plugins` | **TCG Plugin API** for custom instrumentation |
| `--enable-slirp` | User-mode networking (required for `-netdev user`) |
| `--enable-debug` | Debug build (address sanitizer, assertions) |
| `--enable-debug-info` | Include DWARF info in binaries |
| `--disable-docs` | Skip Sphinx documentation build (faster) |
| `--disable-werror` | Don't treat warnings as errors |
| `--enable-sanitizers` | ASAN + UBSAN |
| `--enable-trace-backends=<b>` | `log`, `simple`, `ust` (LTTng), `dtrace`, `nop` |
| `--prefix=<path>` | Install prefix (default `/usr/local`) |

## Package Manager Installation

For quick installation without source build:

```bash
# Ubuntu / Debian:
sudo apt-get install qemu-system-arm qemu-system-misc qemu-user-static

# Fedora / RHEL:
sudo dnf install qemu-system-arm qemu-user

# Arch Linux:
sudo pacman -S qemu-system-arm qemu-user-static

# macOS (Homebrew):
brew install qemu
```

> **Note**: Package manager versions may lag behind. For the TCG Plugin API and latest machine models, build from source.

## Enabling KVM

```bash
# Check if KVM is available:
kvm-ok
# OR:
ls /dev/kvm

# Add your user to the kvm group:
sudo usermod -a -G kvm $USER
newgrp kvm      # Activate without logout

# Load kernel module:
sudo modprobe kvm
sudo modprobe kvm_intel     # Intel host
sudo modprobe kvm_amd       # AMD host

# Make KVM module persistent:
echo 'kvm_intel' | sudo tee -a /etc/modules-load.d/kvm.conf

# Test KVM:
qemu-system-x86_64 -enable-kvm -M q35 -m 1G -nographic -kernel /boot/vmlinuz \
  -append "console=ttyS0" 2>&1 | head -20
```

## Verifying Installation

```bash
# Version:
qemu-system-aarch64 --version
# QEMU emulator version 9.2.0 (v9.2.0)

# Available machines:
qemu-system-arm -M help | head -20

# Available CPUs for a machine:
qemu-system-aarch64 -M virt -cpu help

# First boot test with virt machine:
qemu-system-aarch64 \
  -M virt -cpu cortex-a57 \
  -m 512M \
  -nographic \
  -kernel /usr/share/qemu/qemu-aarch64-firmware.bin 2>/dev/null || \
echo "QEMU is installed and functional"

# Test user-mode:
echo '#include <stdio.h>
int main(){printf("QEMU user-mode OK\\n");}' > /tmp/t.c
gcc -o /tmp/t-arm -static --target=aarch64-linux-gnu /tmp/t.c 2>/dev/null || \
aarch64-linux-gnu-gcc -static -o /tmp/t-arm /tmp/t.c && \
qemu-aarch64 /tmp/t-arm
```

## Building QEMU with TCG Plugin Support

TCG plugins (for custom instrumentation) require `--enable-plugins`:

```bash
./configure \
    --target-list=aarch64-softmmu,arm-softmmu \
    --enable-plugins \
    --enable-debug-info
make -j$(nproc)

# Build the included example plugins:
make -C contrib/plugins

# Run with a plugin:
qemu-system-aarch64 -M virt -cpu cortex-a53 -kernel Image \
  -plugin contrib/plugins/libinsn.so,arg=inline \
  -d plugin -nographic
```

## Cross-Compiling QEMU for an Embedded Host

If you need to run QEMU on an embedded Linux host (e.g., a powerful SBC):

```bash
# Cross-compile QEMU for ARM64 host:
./configure \
    --cross-prefix=aarch64-linux-gnu- \
    --target-list=arm-softmmu \
    --static \
    --disable-docs
make -j$(nproc)
```

## Prerequisites

Before installing QEMU, ensure your system meets the following requirements:
- Linux-based operating system (Ubuntu, Debian, CentOS, etc.)
- Administrative privileges (sudo access)
- Internet connection for downloading packages

## Installation Methods

### Method 1: Package Manager Installation (Recommended)

#### Ubuntu/Debian:
```bash
sudo apt update
sudo apt install qemu-system-arm qemu-system-x86 qemu-utils
```

#### CentOS/RHEL/Fedora:
```bash
sudo dnf install qemu-kvm qemu-img
# Or for older systems:
sudo yum install qemu-kvm qemu-img
```

### Method 2: Build from Source

For the latest features or custom configurations:

1. Download the source code:
```bash
wget https://download.qemu.org/qemu-7.2.0.tar.xz
tar xvJf qemu-7.2.0.tar.xz
cd qemu-7.2.0
```

2. Configure and build:
```bash
./configure --target-list=arm-softmmu,x86_64-softmmu --enable-kvm
make -j$(nproc)
sudo make install
```


