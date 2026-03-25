---
title: Platform Porting Guide
createTime: 2026/03/23 00:00:00
permalink: /kb/embedded/edk2/platform-porting/
---

# EDK2 Platform Porting Guide

## Overview

Platform porting means creating a new EDK2 platform package for a hardware target — SoC + board combination. This involves writing the minimum code that makes generic EDK2 firmware aware of your specific memory map, interrupt topology, clock configuration, and peripheral addresses.

The canonical pattern for AARCH64 platform porting is based on `ArmPlatformPkg`. This guide walks through every layer.

---

## Directory Structure for a Custom Platform Package

```
MySoCPkg/
├── MySoCPkg.dec                    ← Package declaration (GUIDs, PCDs, headers)
├── MySoCPkg.dsc                    ← Platform build description
├── MySoCPkg.fdf                    ← Flash layout
├── Include/
│   └── MySoC.h                     ← SoC-specific macros (MMIO base addresses)
├── Library/
│   ├── MySoCPlatformLib/           ← ArmPlatformLib implementation
│   │   ├── MySoCPlatformLib.inf
│   │   ├── MySoCPlatformLib.c      ← ArmPlatformIsPrimaryCore, GetVirtualMemoryMap
│   │   └── MySoCPlatformMem.c      ← Memory map definition
│   ├── MySoCMemoryInitLib/         ← DRAM init called at PEI/PrePi
│   │   ├── MySoCMemoryInitLib.inf
│   │   └── MySoCMemoryInit.c
│   └── MySoCBoardLib/              ← GPIO, button, LED for board-specific BDS
│       ├── MySoCBoardLib.inf
│       └── MySoCBoardLib.c
├── Drivers/
│   ├── MySoCUartDxe/               ← Custom UART DXE driver (if not PL011)
│   ├── MySoCGpioDxe/               ← GPIO protocol driver
│   └── MySoCClkDxe/                ← Clock management DXE driver
└── Applications/
    └── MySoCBoardConfig/           ← Optional UEFI app for board-specific setup
```

---

## Step-by-Step Platform Porting

### Step 1: Define the Memory Map in MySoC.h

Every physical address constant used across drivers and library code lives here:

```c
// MySoCPkg/Include/MySoC.h
#ifndef MYSOC_H_
#define MYSOC_H_

// DRAM
#define MYSOC_DRAM_BASE         0x40000000ULL
#define MYSOC_DRAM_SIZE         0x80000000ULL   // 2 GiB

// Secure SRAM (pre-DRAM execution)
#define MYSOC_SEC_SRAM_BASE     0x00000000ULL
#define MYSOC_SEC_SRAM_SIZE     0x00040000ULL   // 256 KiB

// UART
#define MYSOC_UART0_BASE        0x09000000ULL
#define MYSOC_UART0_IRQ         33              // GIC SPI #1 (base 32 + 1)

// GIC
#define MYSOC_GIC_DIST_BASE     0x08000000ULL
#define MYSOC_GICC_BASE         0x08010000ULL   // GICv2 CPU interface
#define MYSOC_GICR_BASE         0x080C0000ULL   // GICv3 redistributors

// Watchdog
#define MYSOC_WATCHDOG_BASE     0x08080000ULL
#define MYSOC_WATCHDOG_IRQ      48

// Timer
#define MYSOC_TIMER_FREQ_HZ     25000000        // 25 MHz

// Flash
#define MYSOC_FLASH_BASE        0x08000000ULL
#define MYSOC_FLASH_SIZE        0x04000000ULL   // 64 MiB NOR

#endif // MYSOC_H_
```

### Step 2: Implement ArmPlatformLib

`ArmPlatformLib` is the abstraction layer between generic `ArmPlatformPkg` startup code and your SoC specifics.

```c
// MySoCPlatformLib.c
#include <Library/ArmPlatformLib.h>
#include <Library/DebugLib.h>
#include <Library/IoLib.h>
#include <MySoC.h>

// Called from ResetVector to know if this is the boot CPU
// MpId is the raw MPIDR register value from the CPU
UINTN ArmPlatformIsPrimaryCore (IN UINTN MpId) {
  // Primary CPU is Aff0=0, Aff1=0, Aff2=0
  return (MpId & (ARM_CORE_AFF0 | ARM_CORE_AFF1)) == 0;
}

// Called from PrePi/PEI to initialize DRAM controller
RETURN_STATUS ArmPlatformInitializeSystemMemory (VOID) {
  // Real code would configure the DRAM controller PHY here
  // For bring-up: verify DRAM is accessible at MYSOC_DRAM_BASE
  UINT64 testAddr = MYSOC_DRAM_BASE + 0x1000;
  MmioWrite64 (testAddr, 0xDEADBEEFCAFEBABEULL);
  if (MmioRead64 (testAddr) != 0xDEADBEEFCAFEBABEULL) {
    return RETURN_DEVICE_ERROR;
  }
  return RETURN_SUCCESS;
}

// Called from PrePi to build the initial virtual memory map
// This map is loaded into the MMU (MAIR + TTBR registers) to enable caches
VOID ArmPlatformGetVirtualMemoryMap (OUT ARM_MEMORY_REGION_DESCRIPTOR **VirtualMemoryMap) {
  static ARM_MEMORY_REGION_DESCRIPTOR mVirtualMemoryTable[] = {
    // Secure SRAM: Device non-cacheable (CPU might be executing here)
    {
      MYSOC_SEC_SRAM_BASE, MYSOC_SEC_SRAM_BASE, MYSOC_SEC_SRAM_SIZE,
      ARM_MEMORY_REGION_ATTRIBUTE_UNCACHED_UNBUFFERED
    },
    // DRAM: Normal writeback cacheable
    {
      MYSOC_DRAM_BASE, MYSOC_DRAM_BASE, MYSOC_DRAM_SIZE,
      ARM_MEMORY_REGION_ATTRIBUTE_WRITE_BACK
    },
    // UART registers: Device-nGnRnE (strongly ordered)
    {
      MYSOC_UART0_BASE, MYSOC_UART0_BASE, SIZE_4KB,
      ARM_MEMORY_REGION_ATTRIBUTE_DEVICE
    },
    // GIC: Device
    {
      MYSOC_GIC_DIST_BASE, MYSOC_GIC_DIST_BASE, SIZE_64KB,
      ARM_MEMORY_REGION_ATTRIBUTE_DEVICE
    },
    // Flash (XIP region): Normal non-cacheable
    {
      MYSOC_FLASH_BASE, MYSOC_FLASH_BASE, MYSOC_FLASH_SIZE,
      ARM_MEMORY_REGION_ATTRIBUTE_UNCACHED_UNBUFFERED
    },
    // Terminator
    { 0, 0, 0, ARM_MEMORY_REGION_ATTRIBUTE_UNCACHED_UNBUFFERED }
  };

  *VirtualMemoryMap = mVirtualMemoryTable;
}
```

### Step 3: DRAM Initialization Library

```c
// MySoCMemoryInit.c
#include <Library/DebugLib.h>
#include <MySoC.h>

// Called by PEI/PrePi MemoryInitPeiLib to detect and report memory to HOBs
VOID MySoCMemoryInit (VOID) {
  // In a real SoC: configure DDR PHY, ZQ calibration, training sequence
  // Here we verify JEDEC registers and report memory size via SPD/fuses
  
  UINT32 DdrConfig = MmioRead32 (MYSOC_DDR_CTL_BASE + DDR_CONFIG_REG);
  UINT64 DetectedSize = ((DdrConfig >> 4) & 0xF) * SIZE_256MB;
  
  DEBUG ((DEBUG_INFO, "MySoC DDR: detected %lu MB at base 0x%lx\n",
          DetectedSize / SIZE_1MB, MYSOC_DRAM_BASE));
}
```

### Step 4: Platform DSC Configuration

```ini
## MySoCPkg/MySoCPlatform.dsc

[Defines]
  PLATFORM_NAME                = MySoCPlatform
  PLATFORM_GUID                = A1B2C3D4-E5F6-7890-ABCD-EF1234567890
  PLATFORM_VERSION             = 0.1
  DSC_SPECIFICATION            = 0x0001001c
  OUTPUT_DIRECTORY             = Build/MySoCPlatform
  SUPPORTED_ARCHITECTURES      = AARCH64
  BUILD_TARGETS                = DEBUG|RELEASE
  SKUID_IDENTIFIER             = DEFAULT
  FLASH_DEFINITION             = MySoCPkg/MySoCPlatform.fdf

[PcdsFixedAtBuild]
  gArmTokenSpaceGuid.PcdVFPEnabled|1
  gArmTokenSpaceGuid.PcdArmLinuxFdtMaxOffset|0x10000000
  gArmTokenSpaceGuid.PcdSystemMemoryBase|0x40000000
  gArmTokenSpaceGuid.PcdSystemMemorySize|0x80000000
  gArmPlatformTokenSpaceGuid.PcdCoreCount|4
  gArmTokenSpaceGuid.PcdGicDistributorBase|0x08000000
  gArmTokenSpaceGuid.PcdGicInterruptInterfaceBase|0x08010000
  gArmTokenSpaceGuid.PcdArmArchTimerFreqInHz|25000000
  gEfiMdePkgTokenSpaceGuid.PcdUartDefaultBaudRate|115200
  gArmPlatformTokenSpaceGuid.PcdSerialDbgRegisterBase|0x09000000

[LibraryClasses]
  # Common (all module types)
  BaseLib|MdePkg/Library/BaseLib/BaseLib.inf
  BaseMemoryLib|MdePkg/Library/BaseMemoryLib/BaseMemoryLibOptDxe.inf
  PrintLib|MdePkg/Library/BasePrintLib/BasePrintLib.inf
  DebugLib|MdePkg/Library/BaseDebugLibSerialPort/BaseDebugLibSerialPort.inf
  SerialPortLib|ArmPlatformPkg/Library/PL011SerialPortLib/PL011SerialPortLib.inf

[LibraryClasses.AARCH64.PEIM]
  ArmPlatformLib|MySoCPkg/Library/MySoCPlatformLib/MySoCPlatformLib.inf
  MemoryInitPeiLib|ArmPlatformPkg/MemoryInitPei/MemoryInitPeiLib.inf

[LibraryClasses.AARCH64.DXE_DRIVER]
  ArmGicLib|ArmPkg/Drivers/ArmGic/ArmGicLib.inf

[Components.AARCH64]
  # PrePi (combined SEC+PEI)
  ArmPlatformPkg/PrePi/PeiUniCore.inf {
    <LibraryClasses>
      ArmPlatformLib|MySoCPkg/Library/MySoCPlatformLib/MySoCPlatformLib.inf
      MemoryInitPeiLib|MySoCPkg/Library/MySoCMemoryInitLib/MySoCMemoryInitLib.inf
      HobLib|EmbeddedPkg/Library/PrePiHobLib/PrePiHobLib.inf
      PrePiHobListPointerLib|ArmPlatformPkg/Library/PrePiHobListPointerLib/PrePiHobListPointerLib.inf
  }
  # DXE Core
  MdeModulePkg/Core/Dxe/DxeMain.inf
  # ARM GIC interrupt driver
  ArmPkg/Drivers/ArmGic/ArmGicDxe.inf
  # ARM generic timer
  ArmPkg/Drivers/TimerDxe/TimerDxe.inf
  # PL011 UART serial I/O
  ArmPlatformPkg/Drivers/PL011Uart/PL011UartDxe.inf
  # Platform-specific GPIO
  MySoCPkg/Drivers/MySoCGpioDxe/MySoCGpioDxe.inf
```

### Step 5: Flash Layout (FDF)

```ini
## MySoCPkg/MySoCPlatform.fdf

[FD.MYSOC_EFI]
  BaseAddress   = 0x08000000    # Flash mapped at this address
  Size          = 0x00800000    # 8 MiB total
  ErasePolarity = 1
  BlockSize     = 0x00010000    # 64 KiB erase blocks
  NumBlocks     = 0x80

  # Region 0: EFI variable store (256 KiB)
  0x000000|0x040000
  gEfiMdeModulePkgTokenSpaceGuid.PcdFlashNvStorageVariableBase64|gEfiMdeModulePkgTokenSpaceGuid.PcdFlashNvStorageVariableSize
  DATA = {
    # Empty authenticated variable store header (produced by efi-updatevar or VariableStoreTool)
  }

  # Region 1: FTW working space (64 KiB)
  0x040000|0x010000
  gEfiMdeModulePkgTokenSpaceGuid.PcdFlashNvStorageFtwWorkingBase64|gEfiMdeModulePkgTokenSpaceGuid.PcdFlashNvStorageFtwWorkingSize

  # Region 2: FTW spare (64 KiB)
  0x050000|0x010000
  gEfiMdeModulePkgTokenSpaceGuid.PcdFlashNvStorageFtwSpareBase64|gEfiMdeModulePkgTokenSpaceGuid.PcdFlashNvStorageFtwSpareSize

  # Region 3: DXE Firmware Volume (6 MiB)
  0x060000|0x600000
  FV = FVMAIN_COMPACT

  # Region 4: SEC Firmware Volume (512 KiB)
  0x660000|0x080000
  FV = FVMAIN_SEC

[FV.FVMAIN_SEC]
  FvNameGuid         = A982A78D-4568-4834-8B89-30CD0ADB5C00
  BlockSize          = 0x10000
  FvAlignment        = 8
  ERASE_POLARITY     = 1
  MEMORY_MAPPED      = TRUE
  STICKY_WRITE       = TRUE
  LOCK_CAP           = TRUE
  LOCK_STATUS        = TRUE

  INF RESET_VECTOR_ADDRESS=0x08060000 ArmPlatformPkg/PrePi/PeiUniCore.inf

[FV.FVMAIN_COMPACT]
  FvNameGuid         = B90AE05C-F3CC-4D49-9FEB-65CBB2CE62CD
  BlockSize          = 0x10000
  FvAlignment        = 16
  ERASE_POLARITY     = 1
  MEMORY_MAPPED      = TRUE

  APRIORI DXE {
    INF MdeModulePkg/Universal/PCD/Dxe/PcdDxe.inf
    INF MdeModulePkg/Universal/ReportStatusCodeRouter/RuntimeDxe/ReportStatusCodeRouterRuntimeDxe.inf
  }

  INF MdeModulePkg/Core/Dxe/DxeMain.inf
  INF MdeModulePkg/Universal/PCD/Dxe/PcdDxe.inf
  INF ArmPkg/Drivers/ArmGic/ArmGicDxe.inf
  INF ArmPkg/Drivers/TimerDxe/TimerDxe.inf
  INF ArmPlatformPkg/Drivers/PL011Uart/PL011UartDxe.inf
  INF MdeModulePkg/Universal/Console/TerminalDxe/TerminalDxe.inf
  INF MdeModulePkg/Universal/Disk/DiskIoDxe/DiskIoDxe.inf
  INF MdeModulePkg/Universal/Disk/PartitionDxe/PartitionDxe.inf
  INF FatPkg/EnhancedFatDxe/Fat.inf
  INF MdeModulePkg/Universal/BdsDxe/BdsDxe.inf
  INF ShellPkg/Application/Shell/Shell.inf
```

---

## EFI Variable Store on Flash

The UEFI variable store requires a specific flash region format. The NV variable driver (`MdeModulePkg/Universal/Variable/RuntimeDxe/`) manages this region using a FTW (Fault Tolerant Write) mechanism to prevent corruption on power loss.

Three regions are required:
1. **Variable Store** — main variable storage (authenticated variable header + variable list)
2. **FTW Working** — scratch space for in-progress writes
3. **FTW Spare** — backup of the variable store block being updated

PCDs controlling the layout:

```ini
[PcdsFixedAtBuild]
  gEfiMdeModulePkgTokenSpaceGuid.PcdFlashNvStorageVariableBase64|0x08000000
  gEfiMdeModulePkgTokenSpaceGuid.PcdFlashNvStorageVariableSize|0x00040000
  gEfiMdeModulePkgTokenSpaceGuid.PcdFlashNvStorageFtwWorkingBase64|0x08040000
  gEfiMdeModulePkgTokenSpaceGuid.PcdFlashNvStorageFtwWorkingSize|0x00010000
  gEfiMdeModulePkgTokenSpaceGuid.PcdFlashNvStorageFtwSpareBase64|0x08050000
  gEfiMdeModulePkgTokenSpaceGuid.PcdFlashNvStorageFtwSpareSize|0x00040000
```

---

## ACPI Table Generation

For SBSA/SBBR-compliant ARM platforms, ACPI tables (FADT, MADT, GTDT, SPCR, DSDT, SSDT) are generated by DXE drivers or built as binary blobs.

```c
// Example: Installing MADT (Multiple APIC Description Table) for ARM GICv3

#include <IndustryStandard/Acpi.h>
#include <Protocol/AcpiTable.h>

// In a DXE driver:
EFI_ACPI_TABLE_PROTOCOL  *AcpiTable;

gBS->LocateProtocol (&gEfiAcpiTableProtocolGuid, NULL, (VOID **) &AcpiTable);

// Build MADT in memory
EFI_ACPI_6_3_MULTIPLE_APIC_DESCRIPTION_TABLE Madt = {
  .Header = {
    .Signature = EFI_ACPI_6_3_MULTIPLE_APIC_DESCRIPTION_TABLE_SIGNATURE,
    .Length    = sizeof (Madt),
    .Revision  = EFI_ACPI_6_3_MULTIPLE_APIC_DESCRIPTION_TABLE_REVISION,
    // ...
  }
};

UINTN TableKey;
AcpiTable->InstallAcpiTable (AcpiTable, &Madt, sizeof (Madt), &TableKey);
```

The `DynamicTablesPkg` (in `edk2-platforms`) provides a higher-level framework for generating ACPI tables from configuration data, avoiding hand-coded table assembly.
