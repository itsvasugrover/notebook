---
title: Debugging EDK2
createTime: 2026/03/23 00:00:00
permalink: /kb/embedded/edk2/debugging/
---

# Debugging EDK2

## Debug Infrastructure Overview

EDK2 provides a layered debug infrastructure:

1. **DEBUG() macro** — compile-time conditional logging via serial/console
2. **ASSERT()** macro — assertion failures with file/line reporting
3. **Source-level debugging** — GDB or WinDbg via debug agent protocol
4. **OVMF + QEMU** — full firmware debug in an emulated environment
5. **UEFI Shell** — runtime inspection commands (`dmpstore`, `memmap`, `bcfg`)
6. **EDK2 crash handlers** — exception dumpers with register context

---

## DEBUG() and ASSERT() Macros

### Debug Print Levels

```c
DEBUG ((DebugLevel, FormatString, ...));
ASSERT (BooleanExpression);
ASSERT_EFI_ERROR (Status);
```

`DebugLevel` is a bitmask. Each message is only printed if `(DebugLevel & PcdDebugPrintErrorLevel) != 0`.

| Level | Hex | Meaning |
|-------|-----|---------|
| `DEBUG_INIT` | 0x00000001 | Driver initialization messages |
| `DEBUG_WARN` | 0x00000002 | Warnings |
| `DEBUG_LOAD` | 0x00000004 | Image load/unload |
| `DEBUG_FS` | 0x00000008 | File system operations |
| `DEBUG_POOL` | 0x00000010 | Pool allocations |
| `DEBUG_PAGE` | 0x00000020 | Page allocations |
| `DEBUG_INFO` | 0x00000040 | General informational |
| `DEBUG_DISPATCH` | 0x00000080 | DXE/PEI dispatch |
| `DEBUG_VARIABLE` | 0x00000100 | Variable services |
| `DEBUG_BM` | 0x00000400 | Boot Manager |
| `DEBUG_BLKIO` | 0x00001000 | Block I/O |
| `DEBUG_NET` | 0x00004000 | Network |
| `DEBUG_UNDI` | 0x00010000 | UNDI (NIC driver) |
| `DEBUG_LOADFILE` | 0x00020000 | LoadFile() |
| `DEBUG_EVENT` | 0x00080000 | Events/Timers |
| `DEBUG_GCD` | 0x00100000 | Global Coherency Domain |
| `DEBUG_CACHE` | 0x00200000 | CPU cache |
| `DEBUG_VERBOSE` | 0x00400000 | Extra verbose |
| `DEBUG_ERROR` | 0x80000000 | Errors (always logged if serial is available) |

### Controlling Debug Level

```ini
## In DSC [PcdsFixedAtBuild]:

# DEBUG build: log everything except verbose
gEfiMdePkgTokenSpaceGuid.PcdDebugPrintErrorLevel|0x8000004F

# RELEASE build: only log errors
gEfiMdePkgTokenSpaceGuid.PcdDebugPrintErrorLevel|0x80000000

# Log level per-module override (inside [Components] module block):
MdeModulePkg/Core/Dxe/DxeMain.inf {
  <PcdsFixedAtBuild>
    gEfiMdePkgTokenSpaceGuid.PcdDebugPrintErrorLevel|0x800000CF
}
```

### DebugLib Implementations

The choice of `DebugLib` instance determines where output goes:

```ini
[LibraryClasses]
  # Send DEBUG() output to serial port
  DebugLib|MdePkg/Library/BaseDebugLibSerialPort/BaseDebugLibSerialPort.inf

  # Send to null (discard all debug output; for release builds)
  DebugLib|MdePkg/Library/BaseDebugLibNull/BaseDebugLibNull.inf

  # Send to UEFI ConOut (screen)
  DebugLib|MdeModulePkg/Library/UefiDebugLibConOut/UefiDebugLibConOut.inf

  # Send to UEFI debugport (used by source-level debugger)
  DebugLib|MdePkg/Library/UefiDebugLibDebugPortProtocol/UefiDebugLibDebugPortProtocol.inf

  # Send to QEMU debug console (fw_cfg + io port 0x402)
  DebugLib|OvmfPkg/Library/PlatformDebugLibIoPort/PlatformDebugLibIoPort.inf
```

---

## Serial Debug Output

The `SerialPortLib` abstraction routes serial output. For PL011 UART on ARM platforms:

```ini
[LibraryClasses]
  SerialPortLib|ArmPlatformPkg/Library/PL011SerialPortLib/PL011SerialPortLib.inf

[PcdsFixedAtBuild]
  gArmPlatformTokenSpaceGuid.PcdSerialRegisterBase|0x09000000
  gEfiMdePkgTokenSpaceGuid.PcdUartDefaultBaudRate|115200
  gEfiMdePkgTokenSpaceGuid.PcdUartDefaultDataBits|8
  gEfiMdePkgTokenSpaceGuid.PcdUartDefaultParity|1    # No parity
  gEfiMdePkgTokenSpaceGuid.PcdUartDefaultStopBits|1
```

For x86 OVMF with QEMU:

```ini
[LibraryClasses]
  SerialPortLib|PcAtChipsetPkg/Library/SerialIoLib/SerialIoLib.inf

[PcdsFixedAtBuild]
  gEfiMdeModulePkgTokenSpaceGuid.PcdSerialUseMmio|FALSE
  gEfiMdeModulePkgTokenSpaceGuid.PcdSerialRegisterBase|0x3F8  # COM1 IO port
  gEfiMdeModulePkgTokenSpaceGuid.PcdSerialBaudRate|115200
```

### QEMU Launch with Serial to Terminal

```bash
# Launch OVMF in QEMU with serial output to terminal
qemu-system-x86_64 \
  -machine q35,smm=on \
  -m 256M \
  -drive if=pflash,format=raw,file=OVMF_CODE.fd,readonly=on \
  -drive if=pflash,format=raw,file=OVMF_VARS.fd \
  -serial stdio \
  -display none

# For AARCH64
qemu-system-aarch64 \
  -machine virt \
  -cpu cortex-a57 \
  -m 1G \
  -bios Build/ArmVirtQemu/DEBUG_GCC5/FV/QEMU_EFI.fd \
  -serial stdio \
  -display none
```

---

## Source-Level Debugging with GDB + QEMU

EDK2 supports GDB source-level debugging through two approaches:

### Approach 1: QEMU GDB Stub (Easiest)

QEMU has a built-in GDB stub. Combined with EDK2's `.debug` symbol files, you can set breakpoints in UEFI drivers.

**Step 1: Build with debug symbols**

```bash
build -p OvmfPkg/OvmfPkgX64.dsc -a X64 -t GCC5 -b DEBUG
# GCC5 DEBUG build produces .debug files at:
# Build/OvmfX64/DEBUG_GCC5/X64/<Module>/DEBUG/<ModuleName>.debug
```

**Step 2: Launch QEMU with GDB stub**

```bash
qemu-system-x86_64 \
  -machine q35 -m 256M \
  -drive if=pflash,format=raw,file=OVMF_CODE.fd,readonly=on \
  -drive if=pflash,format=raw,file=OVMF_VARS.fd \
  -serial stdio \
  -S \        # Freeze CPU at start; wait for GDB
  -gdb tcp::1234
```

**Step 3: Connect GDB**

```bash
gdb

# In GDB:
(gdb) target remote :1234
(gdb) break DxeMain          # Break at DXE Core entry point
(gdb) continue

# GDB will hit the breakpoint at DxeMain but no symbols yet
# Load symbols from the .debug file once you know where DxeMain is loaded:
(gdb) add-symbol-file Build/OvmfX64/DEBUG_GCC5/X64/MdeModulePkg/Core/Dxe/DxeMain/DEBUG/DxeMain.debug 0x<ImageBase>
```

The challenge is knowing the image base. Use the EDK2 debug script:

**Step 4: Use the EDK2 GDB helper script**

```bash
# OvmfPkg provides a helper:
cd Build/OvmfX64/DEBUG_GCC5/
python /path/to/edk2/BaseTools/Scripts/GdbSyms.py

# Or use the efi.py plugin that parses memory for loaded images:
# (requires target to have reached DXE phase)
(gdb) source /path/to/edk2/BaseTools/Scripts/efi.py
(gdb) efi images    # List all loaded images with base addresses
(gdb) efi load Build/OvmfX64/DEBUG_GCC5/X64/  # Load all symbols
```

### Approach 2: EDK2 Software Debug Agent Protocol

EDK2 has a `SourceLevelDebugPkg` that implements the Intel Source Level Debugger protocol. It allows IDA Pro or the Intel System Studio debugger to connect. This is more common in industry settings.

---

## UEFI Shell Debug Commands

Once the system boots to the UEFI Shell, several commands provide runtime introspection:

```bash
# Memory map — shows physical memory layout and type
Shell> memmap

# UEFI variables — dump all or specific variable
Shell> dmpstore -all
Shell> dmpstore BootOrder -guid 8be4df61-93ca-11d2-aa0d-00e098032b8c

# Boot option list
Shell> bcfg boot dump

# Protocol handles — list all handles and their protocols
Shell> dh -b         # -b = pause at each screen

# Protocol detail for a specific handle
Shell> dh -d <handle_number>

# Show loaded images
Shell> load -nc ?    # lists loadable images

# Device paths — show paths for all handles
Shell> devtree

# PCI bus scan
Shell> pci

# Run UEFI diagnostic in Shell
Shell> FS0:\Diagnostics\MyDiag.efi

# Exit Shell with error code inspection
Shell> echo %lasterror%
```

---

## ASSERT() and Fault Handling

When an `ASSERT ()` fires:

1. `DebugAssert()` is called with `__FILE__`, `__LINE__`, `Description`
2. In DEBUG builds: prints to serial and halts (`CpuDeadLoop()`)
3. In RELEASE builds: with `PcdDebugPropertyMask` bit 0 clear, ASSERT is a no-op

```c
// PcdDebugPropertyMask bits:
// Bit 0: DEBUG_PROPERTY_ASSERT_BREAKPOINT_ENABLED  – spin on failure
// Bit 1: DEBUG_PROPERTY_ASSERT_DEADLOOP_ENABLED    – CPU dead loop
// Bit 2: DEBUG_PROPERTY_DEBUG_CODE_ENABLED         – DEBUG_CODE() blocks execute
// Bit 3: DEBUG_PROPERTY_CLEAR_MEMORY_ENABLED       – clear freed pool/pages
// Bit 4: DEBUG_PROPERTY_ASSERT_CLEAR_MEMORY        – clear before deadloop
```

```ini
# Enable all debugging in DEBUG builds
[PcdsFixedAtBuild]
  gEfiMdePkgTokenSpaceGuid.PcdDebugPropertyMask|0x2F  # bits 0+1+2+3+5
```

### CPU Exception Handler

`CpuExceptionHandlerLib` installs exception vectors. When a fault (page fault, undefined instruction, etc.) occurs in DXE/PEI context, EDK2 prints a full exception context dump:

```
!!! Page Fault Exception (0x0e)  CPU index=00
ExceptionData = 0000000000000002  (I/D=D, Write, not-present)
RIP  - 000000007F3D128A, CS  - 0038, RFLAGS - 0000000000010202
RAX  - 0000000000000000, RCX - 000000007F4F2580, RDX - 0000000000000000
...
FS   - 0000, GS  - 0000, SS  - 0030, DS  - 0030, ES  - 0030
CR0  - 0000000080010033, CR2 - 000000000000000C
```

The `CR2` register contains the faulting virtual address. Cross-reference the `RIP` (fault location) against the loaded image map from `dh` Shell command.

---

## EDK2 Debug with QEMU + GDB: Full Workflow Example

```bash
# Terminal 1: Build and launch
build -p OvmfPkg/OvmfPkgX64.dsc -a X64 -t GCC5 -b NOOPT  # NOOPT = no optimization
cp Build/OvmfX64/NOOPT_GCC5/FV/OVMF_CODE.fd /tmp/
cp Build/OvmfX64/NOOPT_GCC5/FV/OVMF_VARS.fd /tmp/

qemu-system-x86_64 -machine q35,smm=on -m 256M \
  -drive if=pflash,format=raw,file=/tmp/OVMF_CODE.fd,readonly=on \
  -drive if=pflash,format=raw,file=/tmp/OVMF_VARS.fd \
  -serial stdio -display none -S -gdb tcp::1234 &

# Terminal 2: GDB session
gdb -ex "target remote :1234"

# Wait for DXE phase:
(gdb) continue  # Release CPU; let firmware run
# Ctrl-C to interrupt after boot

# Load all .debug symbols using base addresses from debug output
# (look for "Loading driver at 0x..." or "PROGRESS CODE: V03040002I")
(gdb) add-symbol-file Build/OvmfX64/NOOPT_GCC5/X64/MdeModulePkg/Core/Dxe/DxeMain/DEBUG/DxeMain.debug 0x7ECD9000

# Now set breakpoints by function name
(gdb) break CoreLoadImageCommon
(gdb) continue
```

---

## Checking for Memory Corruption

Enable the EDK2 heap checker:

```ini
[Components]
  MdeModulePkg/Universal/MemoryTest/GenericMemoryTestDxe/GenericMemoryTestDxe.inf

[PcdsFixedAtBuild]
  # Enable pool guard: protect freed pool memory against use-after-free
  gEfiMdeModulePkgTokenSpaceGuid.PcdHeapGuardPropertyMask|0xFF

  # Guard pages: catch buffer overflows by placing guard pages around allocations
  gEfiMdeModulePkgTokenSpaceGuid.PcdHeapGuardPageType|0x3C4
  gEfiMdeModulePkgTokenSpaceGuid.PcdHeapGuardPoolType|0x3C4

  # NULL pointer detection: map the first page as non-executable/non-readable
  gEfiMdeModulePkgTokenSpaceGuid.PcdNullPointerDetectionPropertyMask|0xFF
```

With `PcdNullPointerDetectionPropertyMask` enabled, any NULL dereference causes a page fault exception with a clear crash dump, making the fault location immediately identifiable.
