---
title: UEFI and EDK2 Introduction
createTime: 2026/03/23 00:00:00
permalink: /kb/embedded/edk2/introduction/
---

# UEFI and EDK2: Introduction

## What is UEFI?

UEFI (Unified Extensible Firmware Interface) is a specification that defines the software interface between a platform's firmware and the operating system. It is the direct successor to the legacy BIOS (Basic Input/Output System) that governed x86 PC boot firmware from the 1970s onward, and it now governs firmware on ARM, RISC-V, MIPS, LoongArch, and other architectures.

The UEFI Specification is maintained by the **UEFI Forum**, an industry consortium whose members include AMD, ARM, HPE, IBM, Intel, Lenovo, Microsoft, and Qualcomm. The current specification is UEFI 2.10 (published August 2022) and is available at the UEFI Forum website. A companion document, the **Platform Initialization (PI) Specification**, governs the firmware boot phases from power-on through OS handoff.

### UEFI vs Legacy BIOS

| Aspect | Legacy BIOS | UEFI |
|--------|------------|------|
| Architecture | 16-bit real mode | 32-bit or 64-bit protected mode |
| MBR/Partition | MBR (512 bytes, max 4 primary) | GPT (supports 128+ partitions, up to 9.4 ZB disks) |
| Boot services | INT 13h disk, INT 10h video | Protocol-based, extensible |
| Secure Boot | None | Key-enrollment, PE/COFF signature verification |
| Networking | PXE only (BIOS extension) | First-class HTTP/HTTPS/PXE/iSCSI boot |
| Application model | TSR, expansion ROMs | UEFI applications, Shell, drivers loaded from ESP |
| Variables | CMOS (very limited) | Non-volatile EFI variables (up to hardware flash limit) |
| Device Tree | None | ACPI (x86) or ACPI+DTB (ARM/RISC-V) |

---

## UEFI Boot Phases (PI Specification)

The PI Specification divides firmware execution into six sequential phases. Each phase has a specific scope, memory model, and set of permitted operations.

```
Power On Reset
      │
      ▼
┌─────────────┐
│   SEC Phase │  Security (SEC)
│             │  • CPU in reset state; CAR (Cache-As-RAM) if no DRAM yet
│             │  • Validates PEI firmware volume integrity
│             │  • Establishes minimal stack in CAR/internal SRAM
│             │  • Passes hand-off state to PEI Core
└──────┬──────┘
       │
       ▼
┌─────────────┐
│   PEI Phase │  Pre-EFI Initialization (PEI)
│             │  • PEI Core dispatches PEIMs (PEI Modules)
│             │  • DRAM initialization (the most critical PEIM)
│             │  • PCH/SoC early initialization
│             │  • Communicates via PPIs (PEIM-to-PEIM Interfaces)
│             │  • Produces HOBs (Hand-Off Blocks) for DXE
│             │  • Finds and launches DXE Core
└──────┬──────┘
       │
       ▼
┌─────────────┐
│   DXE Phase │  Driver Execution Environment (DXE)
│             │  • DXE Core initializes UEFI Boot Services & Runtime Services
│             │  • DXE Dispatcher loads drivers from firmware volumes
│             │  • Full memory map available; GCD and memory type tracking
│             │  • Protocol database: drivers publish/consume protocols
│             │  • ACPI tables, SMBIOS tables produced here
│             │  • DXE ends when BDS signals ReadyToLock
└──────┬──────┘
       │
       ▼
┌─────────────┐
│   BDS Phase │  Boot Device Selection (BDS)
│             │  • Reads BootOrder and Boot#### NV variables
│             │  • Connects devices needed to reach boot options
│             │  • Presents OS Boot Manager or UEFI Shell
│             │  • ExitBootServices() call transitions to OS control
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  TSL Phase  │  Transient System Load (OS loader running)
│             │  • OS bootloader executing with UEFI Boot Services still live
│             │  • OS discovers hardware via UEFI protocols and ACPI
│             │  • OS calls ExitBootServices() → firmware reclaims nothing
└──────┬──────┘
       │
       ▼
┌─────────────┐
│   RT Phase  │  Runtime (OS running)
│             │  • Only UEFI Runtime Services remain active:
│             │    GetVariable(), SetVariable(), GetTime(), ResetSystem()
│             │    UpdateCapsule(), QueryVariableInfo()
│             │  • Runtime drivers mapped into OS address space
└──────┬──────┘
       │
       ▼
┌─────────────┐
│   AL Phase  │  After Life (optional)
│             │  • Entered on OS crash (S4/S5 path)
│             │  • Capsule-on-disk updates, crash dump saving
└─────────────┘
```

### PEI Memory Model Detail

PEI runs before DRAM is initialized. The CPU executes from internal SRAM, NOR flash (XIP — eXecute In Place), or Cache-As-RAM (CAR). CAR exploits the CPU L1/L2 cache initialization order: before DRAM is available, Intel CPUs can configure the cache in "no fill" + "write-back" mode to act as fast SRAM. ARM SoCs typically have on-chip SRAM instead.

The PEI Core itself is an XIP module. PEIMs that require stack allocation use temporary memory ranges reported by the Platform Memory Detection PEIM via `PeiInstallPpi(&gEfiTemporaryRamSupportPpiGuid)`.

---

## What is EDK2?

EDK2 (EFI Development Kit 2) is the reference open-source implementation of the UEFI and PI specifications. It is maintained by the **TianoCore** community under the BSD-2-Clause Plus Patent License. The canonical repository is at `https://github.com/tianocore/edk2`.

EDK2 is simultaneously:
- A **framework**: the build system, module infrastructure, library abstraction layers
- A **reference implementation**: complete UEFI-compliant firmware for virtual and real platforms
- A **platform SDK**: reusable modules that vendor firmware teams build upon

### EDK2 Project Ecosystem

```
TianoCore (community governance)
├── edk2                    ← core framework + reference platforms (OVMF, ArmVirtPkg)
├── edk2-platforms          ← vendor/community board support (RaspberryPi, SolidRun, etc.)
├── edk2-non-osi            ← non-open-source blobs integrated into open platforms
├── edk2-libc               ← ANSI C library for UEFI applications
├── edk2-redfish-client     ← Redfish BMC integration
└── mu_basecore             ← Project Mu (Microsoft fork with stricter security defaults)
```

### EDK2 vs Other UEFI Implementations

| Implementation | Maintainer | Target | Open Source |
|---------------|-----------|--------|-------------|
| EDK2/TianoCore | Linux Foundation / Community | All platforms | Yes (BSD-2) |
| Project Mu | Microsoft | Surface, Azure Sphere, Windows | Yes (BSD-2) |
| AMI Aptio V | AMI | Server/Desktop OEM | No |
| PhoenixBIOS/SecureCore | Phoenix | OEM laptops | No |
| InsydeH2O | Insyde Software | Mobile/embedded OEM | No |
| coreboot + edk2 payload | coreboot.org | Open hardware | Yes |

---

## Key Specifications Cross-Reference

Understanding EDK2 requires tracking multiple overlapping specifications:

| Specification | Controlled By | EDK2 Package | Focus |
|--------------|--------------|--------------|-------|
| UEFI 2.10 | UEFI Forum | `MdePkg` | Boot/Runtime Services, Protocols |
| PI 1.8 | UEFI Forum | `MdePkg`, `MdeModulePkg` | SEC/PEI/DXE/SMM phase model |
| ACPI 6.5 | UEFI Forum | `MdeModulePkg/AcpiTableDxe` | Hardware description tables |
| SMBIOS 3.6 | DMTF | `MdeModulePkg/SmbiosDxe` | Machine identity tables |
| TCG EFI Protocol 1.22 | TCG | `SecurityPkg` | TPM 1.2 interface |
| TCG PC Client Firmware Profile | TCG | `SecurityPkg` | TPM 2.0, Measured Boot |
| TCG2 Protocol | TCG | `SecurityPkg` | TPM 2.0 UEFI integration |
| PKCS#7/X.509 | IETF | `CryptoPkg` | Secure Boot signature format |

---

## EDK2 Package Map

The `edk2` repository is organized into packages — each package is a logical grouping of related modules.

```
edk2/
├── MdePkg/              ← Minimal Development Environment: UEFI/PI spec headers & lib stubs
├── MdeModulePkg/        ← Core UEFI modules: DXE Core, PEI Core, variable driver, etc.
├── NetworkPkg/          ← TCP/IP stack, HTTP, TLS, DNS, iPXE driver
├── CryptoPkg/           ← OpenSSL wrapper, RSA/AES/SHA/X.509/PKCS7 libs
├── SecurityPkg/         ← Secure Boot, Measured Boot, TPM2, VerifiedBoot
├── FatPkg/              ← FAT12/16/32 filesystem driver (loads from ESP)
├── UefiCpuPkg/          ← CPU-specific code: MTRR, microcode update, SMM
├── ArmPkg/              ← ARM/AARCH64 CPU drivers, GIC, MMU
├── ArmPlatformPkg/      ← ARM platform primitives: PrePi (PEI-less startup)
├── RiscVPkg/            ← RISC-V CPU drivers
├── OvmfPkg/             ← OVMF: QEMU/KVM virtual machine firmware
├── ArmVirtPkg/          ← ARM UEFI for QEMU aarch64, cloud ARM VMs
├── EmulatorPkg/         ← EDK2 Self-Hosted UEFI emulator (Unix/Windows)
├── ShellPkg/            ← UEFI Shell application + built-in commands
├── BaseTools/           ← Build system: Python build scripts, C utilities
└── Conf/                ← Build configuration templates (target.txt, tools_def.txt)
```

---

## Relationship to Other Boot Technologies

```
                 ┌─────────────────────────────────────────┐
                 │          Board / SoC Mask ROM            │
                 │    (vendor boot ROM, immutable)          │
                 └────────────────┬────────────────────────┘
                                  │ loads
              ┌───────────────────▼───────────────────────┐
              │           Trusted Firmware-A (TF-A)        │ ← ARM only
              │   BL1 (ROM) → BL2 → BL31 (EL3 monitor)    │
              │   + optional BL32 (OP-TEE / Secure OS)     │
              └───────────────────┬───────────────────────┘
                                  │ loads as BL33
              ┌───────────────────▼───────────────────────┐
              │                EDK2 / UEFI                  │
              │   SEC → PEI → DXE → BDS                    │
              └───────────────────┬───────────────────────┘
                                  │ ExitBootServices()
              ┌───────────────────▼───────────────────────┐
              │            OS Bootloader                   │
              │   GRUB2 / systemd-boot / Windows BOOT MGR  │
              └───────────────────┬───────────────────────┘
                                  │
              ┌───────────────────▼───────────────────────┐
              │              Linux / Windows / RTOS        │
              └────────────────────────────────────────────┘
```

On ARM platforms EDK2 runs as BL33 — the normal world firmware loaded by BL2. On x86, EDK2 (as OVMF or vendor firmware) loads directly after CPU power-on reset.

U-Boot can serve as an alternative to both TF-A's BL2 and UEFI in lighter embedded designs, but for UEFI-class devices (servers, SBSA-compliant ARM boards, RISC-V systems), EDK2 is the standard implementation.
