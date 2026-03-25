---
title: EDK2 Architecture
createTime: 2026/03/23 00:00:00
permalink: /kb/embedded/edk2/architecture/
---

# EDK2 Architecture

## The Module System

The fundamental build unit in EDK2 is the **module**. Every library, driver, application, and core component is a module. A module is defined by an INF (module Information) file and contains:

- C/assembly source files
- A declaration of its module type (one of the PI/UEFI module types)
- Its library class dependencies
- Protocols it produces or consumes
- GUIDs it uses
- PCDs it accesses

### Module Types

Module type determines the execution context, calling conventions, available services, and linking rules. The build system refuses to link a module against libraries incompatible with its type.

| Module Type | Execution Context | Entry Point | Notes |
|-------------|------------------|-------------|-------|
| `BASE` | None — pure library | N/A | No UEFI/PI assumptions; portable C |
| `SEC` | SEC phase, no services | `_ModuleEntryPoint` | Runs before PEI Core; typically XIP |
| `PEI_CORE` | PEI Core itself | `PeiCore()` | One per firmware volume |
| `PEIM` | PEI phase | `PeimEntry()` | Access only to PPI services |
| `DXE_CORE` | DXE Core itself | `DxeMain()` | One per firmware image |
| `DXE_DRIVER` | DXE phase, boot-time | `UefiMain()` | Full Boot Services access |
| `DXE_RUNTIME_DRIVER` | DXE + Runtime | `UefiMain()` | Remains active after ExitBootServices |
| `DXE_SAL_DRIVER` | Itanium SAL (legacy) | — | Itanium only; deprecated |
| `DXE_SMM_DRIVER` | SMM (x86 only) | `SmmEntry()` | Runs in System Management Mode |
| `SMM_CORE` | SMM Core itself | — | Manages SMM drivers |
| `UEFI_DRIVER` | DXE, UEFI-model | `UefiDriverEntryPoint` | Implements Driver Binding Protocol |
| `UEFI_APPLICATION` | BDS phase, interactive | `ShellAppMain()` | UEFI Shell apps, OS bootloaders |
| `MM_STANDALONE` | Standalone MM | — | Non-SMM secure execution (ARM StandaloneMM) |
| `MM_CORE_STANDALONE` | Standalone MM Core | — | ARM TrustZone Secure Enclave core |

---

## Metadata Files

EDK2 uses four types of metadata files that together describe a complete firmware image. Understanding all four is essential before modifying any platform or adding custom code.

### INF — Module Information File

Every module has exactly one `.inf` file at its root. It is an INI-style text file.

```ini
## MdeModulePkg/Universal/HiiDatabaseDxe/HiiDatabase.inf

[Defines]
  INF_VERSION                    = 0x00010005
  BASE_NAME                      = HiiDatabase           # Output binary name
  FILE_GUID                      = 348C4D62-BFBD-4882-9ECE-C80BB1C4783B
  MODULE_TYPE                    = DXE_DRIVER
  VERSION_STRING                 = 1.0
  ENTRY_POINT                    = InitializeHiiDatabase  # C function name

[Sources]
  HiiDatabase.c
  HiiDatabase.h
  HiiDatabaseEntry.c
  Image.c
  Font.c
  ConfigRouting.c
  ConfigKeywordHandler.c

[Packages]
  MdePkg/MdePkg.dec
  MdeModulePkg/MdeModulePkg.dec

[LibraryClasses]
  UefiDriverEntryPoint
  BaseLib
  BaseMemoryLib
  MemoryAllocationLib
  UefiBootServicesTableLib
  UefiRuntimeServicesTableLib
  DebugLib
  PrintLib

[Protocols]
  gEfiHiiDatabaseProtocolGuid              ## PRODUCES
  gEfiHiiStringProtocolGuid               ## PRODUCES
  gEfiHiiConfigRoutingProtocolGuid        ## PRODUCES
  gEfiHiiFontProtocolGuid                 ## PRODUCES
  gEfiHiiImageProtocolGuid                ## SOMETIMES_PRODUCES

[Pcd]
  gEfiMdeModulePkgTokenSpaceGuid.PcdHiiOsRuntimeSupport  ## CONSUMES

[Depex]
  TRUE
```

**Key INF sections:**

- `[Defines]` — identity, type, entry point
- `[Sources]` — all `.c`, `.h`, `.asm`, `.S` (and `.uni` for HII strings)
- `[Packages]` — which `.dec` files declare the GUIDs/PCDs/LibClasses this module uses
- `[LibraryClasses]` — abstract library names resolved by the DSC at build time
- `[Protocols]` / `[Ppis]` / `[Guids]` — declaration of GUIDs with access type tags
- `[FixedPcd]`, `[Pcd]`, `[PcdEx]` — PCD access type (see PCD section)
- `[Depex]` — dependency expression; the dispatcher only loads this module when the listed protocols/PPIs are available

---

### DEC — Package Declaration File

A `.dec` file is the package's public API declaration. It declares the GUIDs, library classes, PCDs, and include paths that other packages may use.

```ini
## MdePkg/MdePkg.dec

[Defines]
  DEC_SPECIFICATION              = 0x00010005
  PACKAGE_NAME                   = MdePkg
  PACKAGE_UNI_FILE               = MdePkg.uni
  PACKAGE_GUID                   = 1E73767F-8F52-4603-AEB4-F29B510B6766
  PACKAGE_VERSION                = 1.08

[Includes]
  Include                          # adds MdePkg/Include/ to the compiler's -I list

[Includes.IA32]
  Include/Ia32                    # architecture-specific headers

[LibraryClasses]
  ## Base library with string/memory functions
  BaseLib|Include/Library/BaseLib.h
  
  ## Provides compiler-independent integer intrinsics
  BaseIntrinsicLib|Include/Library/BaseIntrinsicLib.h

[Guids]
  ## EFI System Table GUID
  gEfiGlobalVariableGuid    = { 0x8BE4DF61, 0x93CA, 0x11D2, \
    { 0xAA, 0x0D, 0x00, 0xE0, 0x98, 0x03, 0x2B, 0x8C } }

[Protocols]
  gEfiBlockIoProtocolGuid   = { 0x964E5B21, 0x6459, 0x11D2, \
    { 0x8E, 0x39, 0x00, 0xA0, 0xC9, 0x69, 0x72, 0x3B } }

[Ppis]
  gEfiPeiMemoryDiscoveredPpiGuid = { 0xF894643D, 0xC449, 0x42D1, \
    { 0x8E, 0xA8, 0x85, 0xBD, 0xD8, 0xC6, 0x5B, 0xDE } }

[PcdsFeatureFlag]
  gEfiMdePkgTokenSpaceGuid.PcdComponentNameDisable|FALSE|BOOLEAN|0x0000000d

[PcdsFixedAtBuild, PcdsPatchableInModule]
  gEfiMdePkgTokenSpaceGuid.PcdMaximumUnicodeStringLength|1000000|UINT32|0x00000001

[PcdsDynamic, PcdsDynamicEx]
  gEfiMdePkgTokenSpaceGuid.PcdPlatformBootTimeOut|0xffff|UINT16|0x00000004
```

---

### DSC — Platform Description File

The `.dsc` file is the **master build control file** for a platform. It does not describe a single module — it describes an entire firmware image. The DSC tells the build system:

1. Which modules to build
2. Which concrete library instances resolve each abstract library class
3. PCD value overrides for this platform
4. Build options (compiler flags)

```ini
## OvmfPkg/OvmfPkgX64.dsc (simplified excerpt)

[Defines]
  PLATFORM_NAME                  = Ovmf
  PLATFORM_GUID                  = 5a9e7754-d81b-49ea-85ad-69eaa7b1539b
  PLATFORM_VERSION               = 0.1
  DSC_SPECIFICATION              = 0x00010005
  OUTPUT_DIRECTORY               = Build/OvmfX64
  SUPPORTED_ARCHITECTURES        = X64
  BUILD_TARGETS                  = DEBUG|RELEASE|NOOPT
  SKUID_IDENTIFIER               = DEFAULT
  FLASH_DEFINITION               = OvmfPkg/OvmfPkgX64.fdf

[BuildOptions]
  # Append to GCC compilation flags for all modules
  GCC:*_*_*_CC_FLAGS             = -fno-builtin-memset
  # Override flags for DXE_RUNTIME_DRIVER modules only
  GCC:*_*_*_DLINK_FLAGS          = -z common-page-size=0x1000

[SkuIds]
  0|DEFAULT

[PcdsFixedAtBuild]
  # Override the upstream default value for this platform
  gEfiMdeModulePkgTokenSpaceGuid.PcdMaxVariableSize|0x2000
  gEfiMdeModulePkgTokenSpaceGuid.PcdMaxHardwareErrorVariableSize|0x8000
  gUefiOvmfPkgTokenSpaceGuid.PcdOvmfMemFvBase|0x800000
  gUefiOvmfPkgTokenSpaceGuid.PcdOvmfMemFvSize|0x600000

[PcdsDynamicDefault]
  gEfiMdeModulePkgTokenSpaceGuid.PcdBootDiscoveryPolicy|0

# Library class → concrete module resolution
[LibraryClasses]
  RegisterFilterLib|MdePkg/Library/RegisterFilterLibNull/RegisterFilterLibNull.inf
  BaseLib|MdePkg/Library/BaseLib/BaseLib.inf
  BaseMemoryLib|MdePkg/Library/BaseMemoryLib/BaseMemoryLib.inf
  PrintLib|MdePkg/Library/BasePrintLib/BasePrintLib.inf
  DebugLib|OvmfPkg/Library/PlatformDebugLibIoPort/PlatformDebugLibIoPort.inf
  SerialPortLib|PcAtChipsetPkg/Library/SerialIoLib/SerialIoLib.inf

# Architecture-specific library overrides
[LibraryClasses.X64]
  CpuLib|UefiCpuPkg/Library/BaseCpuLib/BaseCpuLib.inf

# Library class overrides for a specific module type
[LibraryClasses.common.PEIM]
  HobLib|MdePkg/Library/PeiHobLib/PeiHobLib.inf
  PeiServicesLib|MdePkg/Library/PeiServicesLib/PeiServicesLib.inf

[Components]
  # Modules included in this platform build (order matters for depex)
  MdeModulePkg/Core/Dxe/DxeMain.inf
  MdeModulePkg/Universal/MemoryTest/NullMemoryTestDxe/NullMemoryTestDxe.inf
  MdeModulePkg/Universal/DevicePathDxe/DevicePathDxe.inf
  OvmfPkg/VirtioNetDxe/VirtioNet.inf {
    # Module-specific PCD or library overrides (inside braces)
    <PcdsFixedAtBuild>
      gEfiMdePkgTokenSpaceGuid.PcdDebugPrintErrorLevel|0x80000000
  }
```

**DSC section qualification syntax:**

```
[Section.arch.module_type]
```

Examples:
- `[LibraryClasses.AARCH64]` — only for AARCH64 builds
- `[LibraryClasses.common.PEIM]` — for all architectures, PEIM module type only
- `[BuildOptions.X64.DXE_DRIVER]` — for X64 DXE drivers only
- `[Components.IA32]` — modules built only for IA32

---

### FDF — Flash Description File

The `.fdf` file describes the final **binary layout** of the firmware image. It maps modules into Firmware Volumes (FVs), FVs into regions, and regions into a flash device.

```ini
## OvmfPkg/OvmfPkgX64.fdf (simplified)

[FD.OVMF]                          # Firmware Device descriptor
  BaseAddress   = 0x00000000       # Where OVMF is mapped in the address space
  Size          = 0x00200000       # 2 MiB total firmware image
  ErasePolarity = 1
  BlockSize     = 0x1000           # 4 KiB erase blocks
  NumBlocks     = 0x200            # 512 blocks = 2 MiB

  # Region map: offset | size | region_name
  0x000000|0x001C0000            # VARS region: EFI variables
  DATA = {                       # Pre-populated variable store header
    0xAA, 0x55, ...
  }
  0x001C0000|0x000E0000          # DXE firmware volume (FVMAIN)

[FV.FVMAIN_COMPACT]               # Firmware Volume container
  FvNameGuid         = 7CB8BDC9-F8EB-4F34-AAEA-3EE4AF6516A1
  BlockSize          = 0x10000
  FvAlignment        = 16
  ERASE_POLARITY     = 1
  MEMORY_MAPPED      = TRUE
  STICKY_WRITE       = TRUE
  LOCK_CAP           = TRUE
  LOCK_STATUS        = TRUE
  WRITE_DISABLED_CAP = TRUE
  WRITE_STATUS       = FALSE
  ReadDisabledCap    = FALSE
  ReadEnabledCap     = TRUE
  ReadStatusCap      = TRUE
  ReadLockCap        = FALSE
  FvExtHeaderFile    = $(OUTPUT_DIRECTORY)/FvNameStrings.bin

  # Apriori file: loaded before dependency resolution
  APRIORI DXE {
    INF  MdeModulePkg/Universal/PCD/Dxe/PcdDxe.inf
    INF  MdeModulePkg/Universal/ReportStatusCodeRouter/RuntimeDxe/ReportStatusCodeRouterRuntimeDxe.inf
  }

  # Modules included in this FV
  INF  MdeModulePkg/Core/Dxe/DxeMain.inf
  INF  MdeModulePkg/Universal/MemoryTest/NullMemoryTestDxe/NullMemoryTestDxe.inf
  INF  OvmfPkg/VirtioBlkDxe/VirtioBlk.inf
  INF  FatPkg/EnhancedFatDxe/Fat.inf
  INF  MdeModulePkg/Universal/Disk/UnicodeCollation/EnglishDxe/EnglishDxe.inf
```

**Flash layout for a typical ARM SoC:**

```
Flash Device (e.g., 64 MB NOR)
┌─────────────────────────────────────┐ 0x0000_0000
│  FIP (Firmware Image Package)       │  ← TF-A BL2 + BL31 + BL33(EDK2)
│  [optional; packed by TF-A fiptool] │
├─────────────────────────────────────┤ 0x0100_0000
│  UEFI Variable Store (NV_VARS)      │  ← authenticated variables, Boot####
├─────────────────────────────────────┤ 0x0140_0000
│  DXE Firmware Volume (FVMAIN)       │  ← DXE Core + all DXE drivers
├─────────────────────────────────────┤ 0x0600_0000
│  PEI Firmware Volume (SECFV)        │  ← SEC + PEI Core + PEIMs
└─────────────────────────────────────┘ 0x04000_0000
```

---

## PCD — Platform Configuration Database

PCDs (Platform Configuration Data) are typed, named configuration values. They replace the old approach of `#define`-based configuration and allow values to be overridden at the platform DSC level without modifying source files.

### PCD Access Types

| Type | Set At | Linkage | Use Case |
|------|--------|---------|----------|
| `FixedAtBuild` | Compile time | Compiled as `const` | Cache-line aligned buffers, feature flags |
| `PatchableInModule` | Binary patch time | Stored in `.data` section | Post-build patching without recompile |
| `FeatureFlag` | Compile time | `BOOLEAN` only | `#ifdef`-style conditional compilation |
| `Dynamic` | Runtime (single SKU) | PCD database | Boot timeout, boot order policies |
| `DynamicEx` | Runtime (multi-SKU) | PCD database | Token accessible by GUID+token number |

### PCD Declaration in DEC

```ini
[PcdsFixedAtBuild]
  ## Base address of the firmware variable store
  # @Prompt UEFI Variable Store Base
  gUefiOvmfPkgTokenSpaceGuid.PcdOvmfFlashNvStorageVariableBase|0x00000000|UINT32|0x11

[PcdsFeatureFlag]
  ## Enable TPM2 support
  gUefiOvmfPkgTokenSpaceGuid.PcdQemuBootOrderPciTranslation|TRUE|BOOLEAN|0x1c

[PcdsDynamic, PcdsDynamicEx]
  ## Timeout in seconds before auto-boot
  gEfiMdeModulePkgTokenSpaceGuid.PcdPlatformBootTimeOut|0xffff|UINT16|0x0004
```

### PCD Usage in C Code

```c
#include <Library/PcdLib.h>

// FixedAtBuild or FeatureFlag
UINT32 base = FixedPcdGet32 (PcdOvmfFlashNvStorageVariableBase);
BOOLEAN tpmEnabled = FeaturePcdGet (PcdQemuBootOrderPciTranslation);

// Dynamic PCD read/write
UINT16 timeout = PcdGet16 (PcdPlatformBootTimeOut);
PcdSet16S (PcdPlatformBootTimeOut, 5);  // Returns EFI_STATUS
```

---

## HOBs, PPIs, and Protocols

These three inter-module communication mechanisms correspond to the three firmware phases.

### HOBs (Hand-Off Blocks) — PEI → DXE data passing

HOBs form a singly-linked list in memory created by PEI and consumed by DXE. After DXE Core starts, HOBs are read-only.

```c
// PEI: Creating a HOB to report memory range
#include <Library/HobLib.h>

BuildResourceDescriptorHob (
  EFI_RESOURCE_SYSTEM_MEMORY,
  EFI_RESOURCE_ATTRIBUTE_PRESENT |
  EFI_RESOURCE_ATTRIBUTE_INITIALIZED |
  EFI_RESOURCE_ATTRIBUTE_UNCACHEABLE |
  EFI_RESOURCE_ATTRIBUTE_WRITE_COMBINEABLE |
  EFI_RESOURCE_ATTRIBUTE_WRITE_THROUGH_CACHEABLE |
  EFI_RESOURCE_ATTRIBUTE_WRITE_BACK_CACHEABLE |
  EFI_RESOURCE_ATTRIBUTE_TESTED,
  (EFI_PHYSICAL_ADDRESS)(UINTN) MemBase,
  (UINT64) MemSize
);
```

Common HOB types:
- `EFI_HOB_MEMORY_ALLOCATION` — physical memory reservation
- `EFI_HOB_RESOURCE_DESCRIPTOR` — describes a memory range and its attributes
- `EFI_HOB_FIRMWARE_VOLUME` — locates a firmware volume
- `EFI_HOB_GUID_TYPE` — custom HOB identified by GUID (platform-specific data)

### PPIs (PEIM-to-PEIM Interfaces) — PEI inter-module communication

PPIs are the PEI equivalent of DXE protocols. A PEIM installs a PPI, and another PEIM locates it.

```c
// Installing a PPI (in a PEIM entry point)
STATIC EFI_PEI_READ_ONLY_VARIABLE2_PPI mVariablePpi = {
  PeiGetVariable,
  PeiNextVariableName
};

STATIC EFI_PEI_PPI_DESCRIPTOR mPpiList = {
  EFI_PEI_PPI_DESCRIPTOR_PPI | EFI_PEI_PPI_DESCRIPTOR_TERMINATE_LIST,
  &gEfiPeiReadOnlyVariable2PpiGuid,
  &mVariablePpi
};

EFI_STATUS EFIAPI PeimEntry (
  IN EFI_PEI_FILE_HANDLE    FileHandle,
  IN CONST EFI_PEI_SERVICES **PeiServices
) {
  return (*PeiServices)->InstallPpi (PeiServices, &mPpiList);
}
```

```c
// Locating a PPI (in another PEIM)
EFI_PEI_READ_ONLY_VARIABLE2_PPI *VarPpi;

Status = PeiServicesLocatePpi (
  &gEfiPeiReadOnlyVariable2PpiGuid,
  0, NULL,
  (VOID **) &VarPpi
);
```

PPI notification: a PEIM can register a callback triggered when a specific PPI is installed by any other PEIM. This enables asynchronous startup ordering.

### Protocols — DXE/BDS inter-driver communication

The DXE protocol database is the core runtime service registry. Protocols are installed on **handles** — opaque void pointers used as device identity anchors.

```c
// DXE Driver: installing a protocol
EFI_HANDLE  mHandle = NULL;

STATIC MY_CUSTOM_PROTOCOL mCustomProtocol = {
  MyFunction1,
  MyFunction2,
};

// In driver entry point:
Status = gBS->InstallMultipleProtocolInterfaces (
  &mHandle,
  &gMyCustomProtocolGuid, &mCustomProtocol,
  NULL
);
```

```c
// DXE Driver: locating a protocol
MY_CUSTOM_PROTOCOL *Custom;

Status = gBS->LocateProtocol (
  &gMyCustomProtocolGuid,
  NULL,
  (VOID **) &Custom
);
if (!EFI_ERROR (Status)) {
  Custom->MyFunction1 (...);
}
```

**Notification for late-arriving protocols:**

```c
EFI_EVENT  mEvent;
VOID       *mRegistration;

VOID EFIAPI OnProtocolInstalled (
  IN EFI_EVENT  Event,
  IN VOID       *Context
) {
  MY_CUSTOM_PROTOCOL *Custom;
  gBS->LocateProtocol (&gMyCustomProtocolGuid, NULL, (VOID **) &Custom);
  // now safe to use
}

// Register notification
gBS->CreateEvent (EVT_NOTIFY_SIGNAL, TPL_CALLBACK, OnProtocolInstalled,
                  NULL, &mEvent);
gBS->RegisterProtocolNotify (&gMyCustomProtocolGuid, mEvent, &mRegistration);
```

---

## DEPEX — Dependency Expressions

The DXE and PEI dispatchers evaluate DEPEX expressions to determine module load order. A module is not dispatched until all its DEPEX conditions are met.

```ini
# INF [Depex] section for a DXE driver
[Depex]
  gEfiPciRootBridgeIoProtocolGuid AND
  gEfiMetronomeArchProtocolGuid

# For a PEIM
[Depex]
  gEfiPeiMemoryDiscoveredPpiGuid AND
  gEfiPeiBootInRecoveryModePpiGuid
```

DXE DEPEX operators: `AND`, `OR`, `NOT`, `TRUE`, `FALSE`, `BEFORE <GUID>`, `AFTER <GUID>`

The `BEFORE`/`AFTER` operators schedule relative to another module by GUID (found in its `[Defines] FILE_GUID`), regardless of protocol availability.

---

## Firmware Volume Internals

A Firmware Volume (FV) is a structured binary container defined by the PI spec. Internally it looks like:

```
FV Header (76 bytes)
├── Signature: "_FVH"
├── Attributes: MEMORY_MAPPED, STICKY_WRITE, etc.
├── HeaderLength, FvLength, Revision
└── BlockMap: (BlockSize, NumBlocks) pairs

FFS Files (Firmware File System 2)
├── FFS File Header (24 bytes per file)
│   ├── GUID (file identity)
│   ├── Type: EFI_FV_FILETYPE_DXE_CORE / PEIM / APPLICATION / etc.
│   └── Attributes, Size, State
│
└── Sections (within each FFS file)
    ├── Leaf sections: PE32, TE, RAW, UI (name string), VERSION
    └── Encapsulation sections: COMPRESSION, GUID_DEFINED (used for signing)
```

The `GenFv` tool in BaseTools builds FV images. The `GenFfs` tool produces FFS files from compiled PE32 binaries. The `LzmaCompress` / `EfiLzma` tools compress sections before packing into FVs to reduce firmware image size.
