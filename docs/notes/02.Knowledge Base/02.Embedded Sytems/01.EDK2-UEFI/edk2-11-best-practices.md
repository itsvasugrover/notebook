---
title: EDK2 Best Practices
createTime: 2026/03/23 00:00:00
permalink: /kb/embedded/edk2/best-practices/
---

# EDK2 Best Practices

## Repository and Submodule Management

### Pin edk2 to a Stable Commit

Never reference `edk2` by branch name in production firmware. Always pin to a specific commit SHA or a tagged stable release.

```bash
# EDK2 stable releases are tagged as: edk2-stable<YYYYMM>
# Examples: edk2-stable202402, edk2-stable202408

git -C edk2 fetch --tags
git -C edk2 checkout edk2-stable202402    # Pin to Feb 2024 stable release

# Record the pinned commit in CI
git -C edk2 rev-parse HEAD > edk2_version.txt
```

In `.gitmodules`:
```ini
[submodule "edk2"]
    path = edk2
    url = https://github.com/tianocore/edk2.git
    # Do NOT use branch = main or branch = master — always pin explicitly
```

Lock the submodule recursively including CryptoPkg's OpenSSL:

```bash
git submodule update --init --recursive edk2/
# Pins CryptoPkg/Library/OpensslLib/openssl to the commit referenced by edk2
```

### Submodule vs PACKAGES_PATH

Two valid approaches for multi-repo platform builds:

**Approach A (Submodules):**
```
my-firmware/
├── edk2/             (submodule at pinned commit)
├── edk2-platforms/   (submodule at pinned commit)
└── MySoCPkg/         (in-tree, no submodule)
```

**Approach B (PACKAGES_PATH):**
```bash
export PACKAGES_PATH=/src/edk2:/src/edk2-platforms:/src/MySoCPkg
source /src/edk2/edksetup.sh
build -p MySoCPkg/MySoCPlatform.dsc ...
```

Approach A is preferred for reproducible CI builds. Approach B is common during active development.

---

## Package and Module Organization

### Separate Platform Code from Upstream

Never modify files inside `edk2/` directly. Upstream modifications belong in a patch series or a separate package:

```
my-firmware/
├── edk2/                    ← Never modified directly
├── patches/edk2/            ← Patches applied on top of upstream
│   ├── 0001-fix.patch
│   └── apply-patches.sh
└── MyVendorPkg/             ← All vendor-specific code here
    ├── MyVendorPkg.dec
    ├── MySoCPlatform.dsc
    └── ...
```

### Library Instantiation Discipline

Every library class should have at least a **null instance** for module types that do not need the functionality. This prevents compilation failures and avoids accidental functionality leakage:

```ini
# In DSC: provide null instances for library classes not needed in PEI
[LibraryClasses.common.PEIM]
  LockBoxLib|MdeModulePkg/Library/LockBoxNullLib/LockBoxNullLib.inf
  UefiBootServicesTableLib|MdePkg/Library/UefiBootServicesTableLibNull/UefiBootServicesTableLibNull.inf
```

### Module-Specific Library Overrides

Use per-module library overrides (inside `{<...>}` in DSC `[Components]`) sparingly. If the same override appears for more than 3 modules, promote it to a `[LibraryClasses.common.<module_type>]` section:

```ini
# Bad: Repeated per-module overrides
[Components]
  DriverA.inf { <LibraryClasses> DebugLib|CustomDebugLib.inf }
  DriverB.inf { <LibraryClasses> DebugLib|CustomDebugLib.inf }
  DriverC.inf { <LibraryClasses> DebugLib|CustomDebugLib.inf }

# Good: Section-level override
[LibraryClasses.common.DXE_DRIVER]
  DebugLib|CustomDebugLib.inf
```

---

## Build Configuration Hygiene

### Separate DEBUG and RELEASE PCDs

```ini
# Use DSC build option macros to conditionally define PCDs
[PcdsFixedAtBuild]
  # Enabled in both DEBUG and RELEASE
  gEfiMdePkgTokenSpaceGuid.PcdUartDefaultBaudRate|115200

!if $(TARGET) == DEBUG
  gEfiMdePkgTokenSpaceGuid.PcdDebugPrintErrorLevel|0x8000004F
  gEfiMdePkgTokenSpaceGuid.PcdDebugPropertyMask|0x2F
  gEfiMdeModulePkgTokenSpaceGuid.PcdHeapGuardPropertyMask|0xFF
  gEfiMdeModulePkgTokenSpaceGuid.PcdNullPointerDetectionPropertyMask|0xFF
!else
  gEfiMdePkgTokenSpaceGuid.PcdDebugPrintErrorLevel|0x80000000
  gEfiMdePkgTokenSpaceGuid.PcdDebugPropertyMask|0x00
  gEfiMdeModulePkgTokenSpaceGuid.PcdHeapGuardPropertyMask|0x00
!endif
```

### Never Hardcode Addresses in Source

Always use PCDs for MMIO addresses, memory map boundaries, and hardware constants. This allows:
- Board variants with different memory maps to share the same source
- SKU-based configuration without recompilation
- Post-build patching (if `PatchableInModule` PCDs are used)

```c
// Bad: hardcoded address
#define UART_BASE  0x09000000
MmioWrite32 (UART_BASE + UART_FR_OFFSET, 0);

// Good: PCD-backed address
MmioWrite32 (
  FixedPcdGet32 (PcdSerialRegisterBase) + UART_FR_OFFSET,
  0
);
```

---

## Security Hardening in EDK2

### Lock Variables at End of DXE

Register for the `EndOfDxeEvent` and lock all variables that should not change after driver loading completes:

```c
EFI_EVENT  mEndOfDxeEvent;

VOID EFIAPI OnEndOfDxe (IN EFI_EVENT Event, IN VOID *Context) {
  EDKII_VARIABLE_LOCK_PROTOCOL *VariableLock;
  
  if (!EFI_ERROR (gBS->LocateProtocol (
        &gEdkiiVariableLockProtocolGuid, NULL, (VOID **)&VariableLock))) {
    VariableLock->RequestToLock (VariableLock, L"PlatformConfig", &gMyVendorGuid);
    VariableLock->RequestToLock (VariableLock, L"HardwareFuses",  &gMyVendorGuid);
  }
}

// Register in driver entry point:
gBS->CreateEventEx (
  EVT_NOTIFY_SIGNAL, TPL_CALLBACK, OnEndOfDxe, NULL,
  &gEfiEndOfDxeEventGroupGuid, &mEndOfDxeEvent
);
```

### Enable Stack Overflow Detection

```ini
[PcdsFixedAtBuild]
  # SMM Stack Guard: detect SMM stack overflow (x86)
  gEfiMdeModulePkgTokenSpaceGuid.PcdCpuSmmStackGuard|TRUE

  # DXE Stack protection via guard pages
  gEfiMdeModulePkgTokenSpaceGuid.PcdCpuStackGuard|TRUE
```

### Restrict SMM Communication Buffer (x86 Only)

SMM handlers must validate all data from the Normal World. Use `SmmMemLib` to verify that communication buffers are outside SMRAM:

```c
#include <Library/SmmMemLib.h>

EFI_STATUS EFIAPI MySmmHandler (
  IN EFI_HANDLE  DispatchHandle,
  IN CONST VOID *RegisterContext,
  IN OUT VOID   *CommBuffer,
  IN OUT UINTN  *CommBufferSize
) {
  // CRITICAL: Validate CommBuffer is not inside SMRAM
  if (!SmmIsBufferOutsideSmmValid (
        (UINTN)CommBuffer,
        *CommBufferSize)) {
    return EFI_ACCESS_DENIED;
  }
  
  // Only now safe to read CommBuffer
  MY_COMM_DATA *Data = (MY_COMM_DATA *)CommBuffer;
  // Validate Data->Type is within expected range before use
  if (Data->Type >= MAX_COMMAND_TYPE) {
    return EFI_INVALID_PARAMETER;
  }
  ...
}
```

### Deploy Mode for Production

Transition to `DeployedMode` after factory provisioning. This prevents the Secure Boot key hierarchy from being modified without physical access:

```c
// After factory key enrollment is complete:
UINT8 DeployedMode = 1;
gRT->SetVariable (
  L"DeployedMode",
  &gEfiGlobalVariableGuid,
  EFI_VARIABLE_NON_VOLATILE |
  EFI_VARIABLE_BOOTSERVICE_ACCESS |
  EFI_VARIABLE_RUNTIME_ACCESS,
  sizeof (DeployedMode),
  &DeployedMode
);
```

---

## CI/CD Integration

### Stuart-Based CI Pipeline

```yaml
# .github/workflows/edk2-build.yml
name: EDK2 Platform CI

on: [push, pull_request]

jobs:
  build:
    runs-on: ubuntu-22.04
    steps:
      - uses: actions/checkout@v4
        with:
          submodules: recursive

      - name: Install dependencies
        run: |
          sudo apt-get install -y gcc-aarch64-linux-gnu python3-pip nasm uuid-dev
          pip3 install edk2-pytool-extensions edk2-pytool-library

      - name: Setup environment
        run: |
          cd edk2
          make -C BaseTools/Source/C/

      - name: Stuart setup
        run: |
          source edk2/edksetup.sh
          stuart_setup -c MySoCPkg/.pytool/CISettings.py

      - name: Build DEBUG
        run: |
          source edk2/edksetup.sh
          build -p MySoCPkg/MySoCPlatform.dsc \
                -a AARCH64 -t GCC5 -b DEBUG \
                -D SECURE_BOOT_ENABLE=TRUE

      - name: Build RELEASE
        run: |
          source edk2/edksetup.sh
          build -p MySoCPkg/MySoCPlatform.dsc \
                -a AARCH64 -t GCC5 -b RELEASE \
                -D SECURE_BOOT_ENABLE=TRUE

      - name: Archive fw images
        uses: actions/upload-artifact@v4
        with:
          name: firmware-images
          path: |
            Build/MySoCPlatform/DEBUG_GCC5/FV/*.fd
            Build/MySoCPlatform/RELEASE_GCC5/FV/*.fd
```

### Patch Application in CI

```bash
#!/bin/bash
# apply-patches.sh: Apply vendor patch series onto pinned edk2

set -e

PATCH_DIR="patches/edk2"
EDK2_DIR="edk2"

echo "Applying patches to edk2 at $(git -C $EDK2_DIR rev-parse HEAD)"

for patch in "$PATCH_DIR"/*.patch; do
    echo "Applying: $(basename $patch)"
    git -C "$EDK2_DIR" am -3 < "../$patch"
done

echo "All patches applied successfully"
```

---

## Common Pitfalls

### Module Type / Library Class Mismatch

```
ERROR: Cannot use UefiBootServicesTableLib in a PEIM
```

`UefiBootServicesTableLib` accesses `gBS` which doesn't exist in PEI phase. Use `PeiServicesLib` instead and select PEI-safe library instances in `[LibraryClasses.common.PEIM]`.

### PCD Access Type Mismatch

```
# Using PcdGet16() on a FixedAtBuild PCD → compiler error
# FixedAtBuild PCDs must use FixedPcdGet*() macros
```

| PCD Type | Correct Accessor Macro |
|----------|-----------------------|
| `FixedAtBuild` | `FixedPcdGet8/16/32/64/Bool/Ptr()` |
| `PatchableInModule` | `PcdGet*()`; also allows `PcdSet*S()` |
| `FeatureFlag` | `FeaturePcdGet()` |
| `Dynamic` | `PcdGet*()` and `PcdSet*S()` |
| `DynamicEx` | `PcdGetEx*()` and `PcdSetEx*S()` |

### Missing DEPEX Causes Load Order Failure

If a DXE driver crashes because a protocol pointer is NULL, the likely cause is a missing DEPEX entry. The DXE Dispatcher loaded the driver before the dependency was installed because no DEPEX declared the dependency.

Check with:
```bash
# Dump dispatch order from serial output with DEBUG_DISPATCH enabled
grep -E "Loading driver|Installing protocol" build.log | head -50
```

### FDF Variable Store Size Must Match Flash Block Boundary

The `PcdFlashNvStorageVariableSize` must be a multiple of the flash block erase size, or the FTW driver will fail:

```ini
# Wrong: 0x3E000 is not a multiple of 0x10000 (64 KiB block)
gEfiMdeModulePkgTokenSpaceGuid.PcdFlashNvStorageVariableSize|0x3E000

# Correct: align to block boundary
gEfiMdeModulePkgTokenSpaceGuid.PcdFlashNvStorageVariableSize|0x40000  # 256 KiB
```

### AutoGen.h Not Updated After INF Change

After modifying an INF (adding/removing protocols, PCDs, or packages), the AutoGen files are stale. Force regeneration:

```bash
build cleanall
build -p MyPlatform.dsc ...
# Or: delete just the AutoGen for the affected module
rm -rf Build/MyPlatform/DEBUG_GCC5/AARCH64/MySoCPkg/Drivers/MySoCUartDxe/
build -m MySoCPkg/Drivers/MySoCUartDxe/MySoCUartDxe.inf -p MyPlatform.dsc ...
```

---

## Firmware Update Strategy

### UEFI Capsule Updates

Signed capsule updates (defined in UEFI 2.10 §23) allow secure over-the-air firmware upgrades:

```ini
[Components]
  MdeModulePkg/Universal/CapsuleRuntimeDxe/CapsuleRuntimeDxe.inf
  MdeModulePkg/Universal/FaultTolerantWriteDxe/FaultTolerantWriteDxe.inf

[PcdsFixedAtBuild]
  # Enable capsule-on-disk (write capsule to ESP before reset)
  gEfiMdeModulePkgTokenSpaceGuid.PcdCapsuleOnDiskSupport|TRUE
  # Require capsule to have a valid Firmware Management Protocol GUID
  gEfiMdeModulePkgTokenSpaceGuid.PcdCapsuleInRamSupport|TRUE
```

The capsule must be signed with a certificate enrolled in a special UEFI variable (`db` or vendor-defined). The capsule processing firmware validates the signature before writing to flash, closing the TOCTOU gap that would exist if validation happened post-write.
