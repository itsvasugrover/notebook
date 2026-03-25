---
title: Supported Architectures and Custom Architecture Configuration
createTime: 2026/03/23 00:00:00
permalink: /kb/embedded/edk2/architectures-custom-config/
---

# Supported Architectures and Custom Architecture Configuration

## EDK2 Supported Architectures

EDK2 supports six CPU architectures. Each has dedicated packages, CPU driver libraries, and toolchain support in `tools_def.txt`.

### Architecture Overview Table

| Arch Tag | ISA | Key Package | Typical Platform |
|----------|-----|-------------|-----------------|
| `X64` | x86-64 (AMD64) | `UefiCpuPkg`, `MdeModulePkg` | OVMF, PC servers, Intel NUC |
| `IA32` | x86 32-bit | `UefiCpuPkg` | Legacy 32-bit x86 targets |
| `AARCH64` | ARM 64-bit (ARMv8-A) | `ArmPkg`, `ArmPlatformPkg` | RPi4, Ampere Altra, Snapdragon |
| `ARM` | ARM 32-bit (ARMv7-A/R) | `ArmPkg`, `ArmPlatformPkg` | Legacy ARM SoCs |
| `RISCV64` | RISC-V 64-bit (RV64GC) | `RiscVPkg` | SiFive Unmatched, QEMU virt |
| `LOONGARCH64` | LoongArch 64-bit | `LoongArchPkg` | Loongson 3A6000 |

### Architecture-Specific Boot Mechanism

#### x86 / X64

- CPU starts in 16-bit real mode at reset vector `0xFFFF_FFF0`
- SEC module (`ResetVector/`) runs in real mode, transitions to 32-bit protected mode, then 64-bit long mode
- Cache-As-RAM (CAR) via MTRRs for temporary PEI stack before DRAM init
- SMM (System Management Mode) handled by `UefiCpuPkg/PiSmmCpuDxeSmm`
- ACPI as mandatory hardware description

#### AARCH64

- CPU starts at reset in EL3 (highest exception level) or EL2
- TF-A typically runs at EL3 (BL1–BL31), hands off to EDK2 at EL2 (BL33)
- EDK2 SEC/PEI implemented in `ArmPlatformPkg/PrePi/` (PEI-less) or via full PEI
- ARM GICv2/GICv3 interrupt controller driver in `ArmPkg/Drivers/ArmGic/`
- ACPI + DTB both valid; SBSA/SBBR compliance defines mandatory interfaces
- AArch64 exception vectors: `ArmPkg/Library/ArmExceptionLib/`

#### RISC-V 64

- CPU starts at Machine mode (M-mode), highest privilege
- OpenSBI runs at M-mode as the Supervisor Execution Environment (SEE)
- EDK2 runs at S-mode, using OpenSBI via SBI calls
- RISC-V UEFI spec requires Flattened Device Tree (FDT) and ACPI mandated for servers
- `RiscVPkg/` contains RISC-V CPU dxe driver, timer, and reset

---

## CPU Architecture Support in Code

### Architecture-Specific Libraries

Each architecture provides implementations of abstract library classes:

```
ArmPkg/Library/
├── ArmLib/ArmBaseLib.inf                  ← BaseLib extensions for ARM
├── ArmMmuLib/ArmMmuBaseLib.inf            ← MMU/page table manipulation
├── CpuLib/ArmCpuLib.inf                   ← CpuLib for ARM (cache flush, WFI)
├── ArmGicLib/ArmGicNonSecLib.inf          ← GIC Non-secure interrupt lib
├── ArmSmcLib/ArmSmcLib.inf                ← SMC calling convention (TF-A)
├── ArmHvcLib/ArmHvcLib.inf                ← HVC calling convention
└── SynchronizationLib/ArmSynchronizationLib.inf ← atomic operations

UefiCpuPkg/Library/
├── BaseUefiCpuLib/BaseUefiCpuLib.inf      ← x86 microarchitecture utilities
├── CpuPageTableLib/CpuPageTableLib.inf    ← x86 paging
└── MpInitLib/MpInitLib.inf                ← Multi-processor init
```

In a DSC, architecture-specific library bindings use section qualifiers:

```ini
[LibraryClasses.AARCH64]
  ArmLib|ArmPkg/Library/ArmLib/ArmBaseLib.inf
  ArmMmuLib|ArmPkg/Library/ArmMmuLib/ArmMmuBaseLib.inf
  CpuLib|ArmPkg/Library/CpuLib/ArmCpuLib.inf
  CpuExceptionHandlerLib|ArmPkg/Library/ArmExceptionLib/ArmExceptionLib.inf
  DefaultExceptionHandlerLib|ArmPkg/Library/DefaultExceptionHandlerLib/DefaultExceptionHandlerLib.inf

[LibraryClasses.X64]
  CpuLib|UefiCpuPkg/Library/BaseCpuLib/BaseCpuLib.inf
  CpuExceptionHandlerLib|UefiCpuPkg/Library/CpuExceptionHandlerLib/DxeCpuExceptionHandlerLib.inf
  MtrrLib|UefiCpuPkg/Library/MtrrLib/MtrrLib.inf
```

---

## Creating a Custom Architecture Configuration

"Custom architecture configuration" in EDK2 means defining how your specific hardware platform (SoC + board) is represented in the build system, including PCDs, library bindings, FDF regions, and architecture-specific flags. This is **platform porting**, but the architecture-config aspect focuses on the DSC mechanics.

### Step 1: Define the Platform Scope in DSC `[Defines]`

```ini
[Defines]
  PLATFORM_NAME                  = MySoCPlatform
  PLATFORM_GUID                  = A1B2C3D4-E5F6-7890-ABCD-EF1234567890
  PLATFORM_VERSION               = 0.1
  DSC_SPECIFICATION              = 0x0001001c
  OUTPUT_DIRECTORY               = Build/MySoCPlatform
  SUPPORTED_ARCHITECTURES        = AARCH64  # Only architectures this platform builds for
  BUILD_TARGETS                  = DEBUG|RELEASE|NOOPT
  SKUID_IDENTIFIER               = DEFAULT|BOARD_REV_A|BOARD_REV_B
  FLASH_DEFINITION               = MySoCPkg/MySoCPlatform.fdf
```

`SUPPORTED_ARCHITECTURES` restricts which `-a` arguments are valid for this DSC. Attempting to build `X64` for an ARM-only platform will produce an error.

### Step 2: Architecture-Specific PCD Overrides

PCDs that depend on the target architecture — base addresses, stack sizes, memory map constants — are overridden per-arch:

```ini
[PcdsFixedAtBuild.AARCH64]
  # GIC base addresses for this SoC
  gArmTokenSpaceGuid.PcdGicDistributorBase|0x08000000
  gArmTokenSpaceGuid.PcdGicInterruptInterfaceBase|0x08010000
  gArmTokenSpaceGuid.PcdGicRedistributorsBase|0x080A0000  # GICv3

  # Timer frequency
  gArmTokenSpaceGuid.PcdArmArchTimerFreqInHz|24000000

  # UART base for PL011
  gArmPlatformTokenSpaceGuid.PcdSerialDbgRegisterBase|0x09000000
  gEfiMdePkgTokenSpaceGuid.PcdUartDefaultBaudRate|115200

  # DDR layout
  gArmTokenSpaceGuid.PcdSystemMemoryBase|0x40000000
  gArmTokenSpaceGuid.PcdSystemMemorySize|0x40000000   # 1 GiB

[PcdsFixedAtBuild.X64]
  gEfiMdeModulePkgTokenSpaceGuid.PcdUse1GPageTable|TRUE
  gUefiCpuPkgTokenSpaceGuid.PcdCpuNumberOfReservedVariableMtrrs|2
```

### Step 3: Architecture-Specific Components

Include platform modules only for the relevant architecture:

```ini
[Components.AARCH64]
  ArmPkg/Drivers/ArmGic/ArmGicDxe.inf
  ArmPkg/Drivers/TimerDxe/TimerDxe.inf
  ArmPkg/Drivers/GenericWatchdogDxe/GenericWatchdogDxe.inf
  MySoCPkg/Drivers/MySoCUartDxe/MySoCUartDxe.inf
  MySoCPkg/Drivers/MySoCGpioDxe/MySoCGpioDxe.inf

[Components.X64]
  UefiCpuPkg/CpuDxe/CpuDxe.inf
  PcAtChipsetPkg/8254TimerDxe/8254Timer.inf
  MySoCPkg/Drivers/MySoCPcieDxe/MySoCPcieDxe.inf
```

### Step 4: Architecture-Specific Build Options

Control compiler flags per architecture and module type:

```ini
[BuildOptions.AARCH64]
  GCC:*_*_AARCH64_CC_FLAGS = -DMYPLATFORM_AARCH64 -DGIC_VERSION=3
  GCC:*_*_AARCH64_DLINK_FLAGS = -z max-page-size=0x1000

[BuildOptions.AARCH64.DXE_RUNTIME_DRIVER]
  GCC:*_*_AARCH64_CC_FLAGS = -DRUNTIME_DRIVER

[BuildOptions.common.PEIM]
  GCC:*_*_*_CC_FLAGS = -DPEI_PHASE_BUILD

# Release-specific flags
[BuildOptions]
  RELEASE_GCC:*_*_*_CC_FLAGS = -DNDEBUG -Os
  DEBUG_GCC:*_*_*_CC_FLAGS   = -DDEBUG_BUILD -g
```

### Step 5: SKU-Based Multi-Board Configuration

SKUs allow one DSC to produce different configurations for different board variants without separate DSC files.

```ini
[SkuIds]
  0|DEFAULT               # Always required
  1|BOARD_REV_A|DEFAULT   # Board Rev A inherits DEFAULT
  2|BOARD_REV_B|DEFAULT   # Board Rev B inherits DEFAULT

[PcdsFixedAtBuild.AARCH64]
  # Default: use GICv2
  gArmTokenSpaceGuid.PcdGicDistributorBase|0x08000000|UINT64|DEFAULT

  # Board Rev B has GIC at different address
  gArmTokenSpaceGuid.PcdGicDistributorBase|0x09000000|UINT64|BOARD_REV_B
```

Build with a specific SKU:

```bash
build -p MySoCPkg/MySoCPlatform.dsc -a AARCH64 -t GCC5 -D SKUID=BOARD_REV_B
```

Or set in `target.txt`:
```ini
SKUID_IDENTIFIER = BOARD_REV_B
```

---

## Adding AARCH64 SEC/PrePi Entry Point

The very first code that runs on an AARCH64 platform must be compiled for XIP execution. EDK2 provides two models:

### Model 1: Full PEI (SEC → PEI Core → PEIMs)

Used by platforms that need full PEI infrastructure (multiple PEIMs, HOB-based communication). The SEC module is in `ArmPlatformPkg/Sec/`.

```ini
# In DSC [Components.AARCH64]
ArmPlatformPkg/Sec/Sec.inf {
  <LibraryClasses>
    ArmPlatformLib|MySoCPkg/Library/MySoCPlatformLib/MySoCPlatformLib.inf
}
```

`ArmPlatformLib` must implement:
```c
// Called from SEC to determine if we're the primary CPU
UINTN ArmPlatformIsPrimaryCore (IN UINTN MpId);

// Called from PEI to initialize DRAM
RETURN_STATUS ArmPlatformInitializeSystemMemory (VOID);

// Return the start/size of trusted SRAM (pre-DRAM stack)
VOID ArmPlatformGetVirtualMemoryMap (OUT ARM_MEMORY_REGION_DESCRIPTOR **VirtualMemoryMap);
```

### Model 2: PrePi (PEI-less Lightweight Startup)

Used by simple platforms (ArmVirtPkg, RPi). `ArmPlatformPkg/PrePi/` is a single module that acts as both SEC and a simplified PEI Core:

```ini
# In DSC [Components.AARCH64]
ArmPlatformPkg/PrePi/PeiUniCore.inf {
  <LibraryClasses>
    ArmPlatformLib|MySoCPkg/Library/MySoCPlatformLib/MySoCPlatformLib.inf
    MemoryInitPeiLib|MySoCPkg/Library/MySoCMemoryInitLib/MySoCMemoryInitLib.inf
}
```

The PrePi model skips the PEI Core and directly transitions to DXE, producing HOBs that DXE Core consumes.

### FDF Entry for SEC

The SEC module must be at the **entry point of the SECFV** firmware volume and executed first:

```ini
## In .fdf file
[FV.SECFV]
  FvBaseAddress  = 0x00008000    # XIP address in NOR flash
  FvForceRebase  = TRUE

  INF RESET_VECTOR_ADDRESS = 0x00008000 ArmPlatformPkg/PrePi/PeiUniCore.inf
```

---

## New Architecture Definition (Hypothetical)

If EDK2 ever needed to support a new CPU architecture (like a future 128-bit ISA), the changes required illustrate the architecture boundary in the build system:

1. **Add arch tag** to `build` command parsing: `Build/buildoptions.py`
2. **tools_def.txt**: Add toolchain definitions for `NEWARCH`
3. **New package** `NewArchPkg/` with:
   - CPU exception handler
   - MMU library  
   - Timer library
   - `BaseLib` intrinsics for the new ISA
4. **Compiler intrinsics** in `MdePkg/Library/CompilerIntrinsicLib/`
5. **Linker scripts** in `BaseTools/Scripts/`
6. **Reset vector** assembly in `NewArchPkg/Sec/ResetVector/`
7. **MdePkg Include headers** for the new arch's registers/calling convention

The architecture coverage in MdePkg headers:
```
MdePkg/Include/
├── Ia32/         ← x86 32-bit processor bindings
├── X64/          ← x86-64 processor bindings
├── Arm/          ← ARM 32-bit processor bindings (deprecated)
├── AArch64/      ← ARM 64-bit processor bindings
├── RiscV64/      ← RISC-V 64-bit processor bindings
└── LoongArch64/  ← LoongArch 64-bit processor bindings
```

Each arch directory contains:
- `ProcessorBind.h` — fundamental types (`UINTN`, `INTN`, `MAX_ADDRESS`, `MAX_BIT`, alignment macros)
- `<arch>GccInline.h` or similar — inline assembly intrinsics

`ProcessorBind.h` is the critical file binding the abstract EDK2 type system to the real machine word size.
