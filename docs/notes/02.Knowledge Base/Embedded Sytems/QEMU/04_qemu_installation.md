---
title: QEMU Installation
createTime: 2026/03/14 14:21:19
permalink: /kb/embedded/qemu/qemu-installation/
---

# QEMU Installation

Installing QEMU is the first step to leveraging its powerful emulation and virtualization capabilities. This guide will walk you through the process of installing QEMU on a Linux system, ensuring you have the necessary tools to begin your embedded systems development journey.

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

## Post-Installation Setup

### Enable KVM (Optional but Recommended)
To improve performance with hardware virtualization:

```bash
# Add your user to the kvm group
sudo usermod -a -G kvm $USER

# Load the kernel modules
sudo modprobe kvm
sudo modprobe kvm-intel  # or kvm-amd for AMD processors

# To make modules load automatically:
echo 'kvm' | sudo tee -a /etc/modules
echo 'kvm-intel' | sudo tee -a /etc/modules  # or kvm-amd for AMD
```

## Verification

Verify the installation by checking the QEMU version:

```bash
qemu-system-arm --version
qemu-system-x86_64 --version
```

## Next Steps

After installing QEMU, you can:
- Learn about [QEMU Architecture](/kb/embedded/qemu/qemu-architecture/) to understand how it works
- Explore [QEMU Basic Usage](/kb/embedded/qemu/qemu-basic-usage/) to start running your first emulations
- Configure QEMU for specific use cases like running bootloaders or firmware
- Use QEMU with custom built images

## Troubleshooting

If you encounter issues after installation:

1. **Permission denied errors**: Ensure your user is in the kvm group and reload your session
2. **Missing target architectures**: Install additional qemu-system-* packages for specific architectures
3. **Performance issues**: Check if KVM is properly enabled and accessible

## Conclusion

With QEMU installed, you're now ready to begin exploring embedded systems development. The installation provides the foundation for testing, debugging, and validating your embedded systems before deploying to physical hardware. Proceed to [QEMU Basic Usage](/kb/embedded/qemu/qemu-basic-usage/) to start your first emulation session.
`
