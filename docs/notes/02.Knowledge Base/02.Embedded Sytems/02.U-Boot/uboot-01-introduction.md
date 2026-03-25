---
title: Introduction
createTime: 2026/03/23 00:00:00
permalink: /kb/embedded/uboot/introduction/
---

# U-Boot: Introduction and Overview

## What is U-Boot?

Das U-Boot (Universal Bootloader) is the most widely deployed open-source bootloader for embedded systems. Originally developed by Wolfgang Denk at DENX Software Engineering, it was initially called PPCBoot (for PowerPC targets), then MBXBoot, and eventually renamed U-Boot as it expanded support to dozens of architectures. The project is hosted at https://source.denx.de/u-boot/u-boot and mirrored on GitHub at https://github.com/u-boot/u-boot.

U-Boot sits between the hardware initialization firmware (ROM code, TF-A, etc.) and the operating system kernel. Its primary job is to:

1. Initialize hardware (DDR, clocks, PLLs, storage interfaces, etc.)
2. Locate a kernel image (from flash, eMMC, SD card, network, USB, etc.)
3. Set up the boot environment (device tree, kernel command line, etc.)
4. Transfer control to the kernel

The 2026.01 release (tag `v2026.01`) is the January 2026 quarterly stable release and includes improvements in RISC-V support, EFI capsule updates, driver model maturity, and enhanced security features including verified boot improvements.

---

## Historical Timeline

| Year | Milestone |
|------|-----------|
| 1999 | PPCBoot 0.0.1 released by Wolfgang Denk for PowerPC |
| 2000 | MBXBoot created for i.MX |
| 2002 | Project renamed to U-Boot (Universal Bootloader) |
| 2008 | Kconfig-like configuration introduced |
| 2014 | Driver Model (DM) introduced |
| 2015 | Verified Boot / FIT image signing |
| 2016 | UEFI support introduced |
| 2018 | ARM64 support matured |
| 2020 | RISC-V full support |
| 2022 | VPL (Verifying Program Loader) introduced |
| 2024 | EFI Capsule Update, DM full migration |
| 2026 | v2026.01 — latest stable release |

---

## Where U-Boot Fits: The Boot Chain

A typical ARM64 SoC boot chain looks like:

```
+---------------------------+
|    ROM Boot Code (BL1)    |  ← On-chip ROM, hardwired
+---------------------------+
           |
           v
+---------------------------+
|  TF-A BL2 / SPL (BL2)   |  ← Loaded from storage by ROM
+---------------------------+
           |
           v
+---------------------------+
|   TF-A BL31 (EL3 runtime)|  ← Secure monitor
+---------------------------+
           |
           v
+---------------------------+
|   U-Boot (BL33 / BL2)    |  ← Non-secure world bootloader
+---------------------------+
           |
           v
+---------------------------+
|     Linux Kernel          |
+---------------------------+
           |
           v
+---------------------------+
|     Root Filesystem       |
+---------------------------+
```

On simpler MCU-class systems (like Cortex-M or RISC-V without TF-A):

```
ROM → SPL → U-Boot → Application/RTOS/Linux
```

---

## U-Boot vs Other Bootloaders

| Bootloader | Target | License | Notes |
|------------|--------|---------|-------|
| U-Boot | Everything (MCU to server) | GPL-2.0+ | Most feature-rich, huge hardware support |
| GRUB2 | x86/ARM PC | GPL-3.0 | Desktop/server focus |
| coreboot | x86 | GPL-2.0 | Open BIOS replacement |
| Barebox | Embedded Linux | GPL-2.0 | U-Boot alternative, cleaner codebase |
| LILO | x86 only | BSD | Legacy, deprecated |
| EDK2 (UEFI) | x86/ARM | BSD-2 | UEFI reference impl |
| Zephyr Bootloader | MCU | Apache-2.0 | RTOS ecosystem |

U-Boot is the dominant choice in:
- Automotive (AUTOSAR, ADAS platforms)
- Industrial IoT
- Networking equipment
- Consumer electronics (TV SoCs, set-top boxes)
- Single-board computers (Raspberry Pi, BeagleBone, etc.)
- Yocto/OpenEmbedded-built systems

---

## Key Features of U-Boot 2026.01

### Core Features
- **Multi-architecture support**: ARM, ARM64 (AArch64), x86, x86_64, RISC-V (32/64), MIPS, PowerPC, m68k, sh, nios2, xtensa, arc, microblaze, openrisc
- **Multi-storage support**: NOR flash, NAND flash, eMMC, SD/MMC, USB Mass Storage, SATA, NVMe, SPI-NOR, SPI-NAND
- **Network boot**: TFTP, NFS, BOOTP, DHCP, PXE, HTTP
- **Filesystems**: FAT (12/16/32/exFAT), ext2/3/4, SquashFS, EROFS, BTRFS, JFFS2, UBIFS, EFI system partition
- **Script engine**: Hush shell, if/for/while, env variables
- **Device Tree**: Full FDT runtime manipulation
- **Display**: Framebuffer support, HDMI, MIPI DSI, logo splash screen
- **USB**: Host (EHCI/XHCI/OHCI), Gadget (DFU, fastboot, mass storage)
- **DFU (Device Firmware Update)**: USB DFU 1.1 compliant
- **Fastboot**: Android fastboot protocol support

### Security Features (2026.01)
- **Verified Boot**: FIT image signature verification using RSA/ECDSA
- **UEFI Secure Boot**: Microsoft-compatible UEFI secure boot
- **UEFI Capsule Update**: Signed firmware updates via UEFI capsule mechanism
- **Measured Boot**: TPM 1.2/2.0 measured boot with PCR extension
- **OP-TEE integration**: Secure enclave communication
- **ARM TrustZone**: Runtime separation of secure/non-secure world
- **i.MX HAB/AHAB**: NXP High Assurance Boot support
- **Rockchip AVB**: Android Verified Boot support

### New in 2026.01
- Improved EFI capsule update with rollback protection
- Enhanced RISC-V SBI multi-hart support
- DM (Driver Model) migration fully complete — legacy board APIs removed
- New `bootflow` command with improved boot ordering
- Improved Sandbox testing coverage
- Better ACPI table generation for ARM64
- Rust bindings experimental preview
- SCMI (System Control and Management Interface) driver improvements

---

## Licensing

U-Boot is licensed under the **GNU General Public License v2.0 or later (GPL-2.0+)**.

Important licensing nuances:
- Files in `include/linux/` are dual-licensed (GPL-2.0 + Linux exceptions)
- Some drivers may have additional BSD/MIT licensed components
- The GPL requires redistribution of source when modifying and distributing binaries
- The "system library exception" does NOT apply — linking your code with U-Boot statically makes it GPL
- Standalone programs (booted by U-Boot, not linked with it) are not subject to GPL viral effect

---

## Release Cycle

U-Boot follows a **quarterly release cycle**:
- Releases in January, April, July, October
- Tags follow `vYYYY.MM` format (e.g., `v2026.01`, `v2025.10`)
- Long-Term Support (LTS) releases are maintained for ~2 years
- Release candidates: `v2026.01-rc1`, `v2026.01-rc2`, etc.
- Patches are submitted to the mailing list: u-boot@lists.denx.de

---

## Community and Resources

- **Mailing list**: u-boot@lists.denx.de
- **Git repository**: https://source.denx.de/u-boot/u-boot
- **Patchwork**: https://patchwork.ozlabs.org/project/uboot/
- **Documentation**: https://docs.u-boot.org
- **IRC**: #u-boot on Libera.Chat
- **CI**: https://source.denx.de/u-boot/u-boot/-/pipelines (GitLab CI)
- **Custodians**: Each architecture/subsystem has a designated custodian responsible for reviewing patches
