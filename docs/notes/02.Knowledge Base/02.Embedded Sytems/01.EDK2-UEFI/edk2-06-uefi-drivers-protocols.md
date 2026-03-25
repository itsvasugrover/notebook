---
title: UEFI Drivers and Protocols
createTime: 2026/03/23 00:00:00
permalink: /kb/embedded/edk2/uefi-drivers-protocols/
---

# UEFI Drivers and Protocols

## UEFI Boot Services

The UEFI Boot Services Table (`EFI_BOOT_SERVICES`) is the core API available from DXE startup until `ExitBootServices()`. It is accessed through the global `gBS` pointer (injected by `UefiBootServicesTableLib`).

### Memory Services

```c
// Allocate pages (4 KiB aligned, type tracked in memory map)
EFI_PHYSICAL_ADDRESS Addr = 0;  // 0 means "any"
Status = gBS->AllocatePages (
  AllocateAnyPages,                // or AllocateMaxAddress, AllocateAddress
  EfiBootServicesData,             // memory type
  EFI_SIZE_TO_PAGES (BufferSize),  // number of 4 KiB pages
  &Addr
);

// Convert to pointer
VOID *Buffer = (VOID *)(UINTN)Addr;

// Free pages
gBS->FreePages (Addr, EFI_SIZE_TO_PAGES (BufferSize));

// Pool allocations (heap; tracked by type)
VOID *Mem;
gBS->AllocatePool (EfiBootServicesData, 256, &Mem);
gBS->FreePool (Mem);

// Get full system memory map (required before ExitBootServices)
UINTN MapSize = 0, MapKey, DescSize;
UINT32 DescVersion;
Status = gBS->GetMemoryMap (&MapSize, NULL, &MapKey, &DescSize, &DescVersion);
// MapSize is now the required buffer size; allocate and call again
```

**Memory Types and Their Lifecycle:**

| Type | Preserved After ExitBS? | Use Case |
|------|------------------------|----------|
| `EfiBootServicesCode` | No — OS reclaims | Loaded UEFI applications, DXE drivers |
| `EfiBootServicesData` | No — OS reclaims | Boot-time heap allocations |
| `EfiRuntimeServicesCode` | Yes — mapped in OS | Runtime drivers (e.g., variable storage) |
| `EfiRuntimeServicesData` | Yes — mapped in OS | Runtime driver data structures |
| `EfiConventionalMemory` | Yes — OS uses freely | Available physical RAM |
| `EfiACPIReclaimMemory` | Yes until ACPI enabled | ACPI tables |
| `EfiACPIMemoryNVS` | Yes — never reclaimed | ACPI NVS firmware data |
| `EfiPersistentMemory` | Yes — non-volatile | NVDIMM |
| `EfiReservedMemoryType` | Yes — never used by OS | DMA buffers, firmware reserved |

### Event and Timer Services

```c
// Create an event (callback when signaled)
EFI_EVENT Event;
gBS->CreateEvent (
  EVT_NOTIFY_SIGNAL,              // event type
  TPL_CALLBACK,                   // task priority level
  MyCallback,                     // VOID EFIAPI (*callback)(EFI_EVENT, VOID*)
  (VOID *)Context,                // context passed to callback
  &Event
);

// Signal the event manually
gBS->SignalEvent (Event);

// Create a periodic timer event
EFI_EVENT TimerEvent;
gBS->CreateEvent (EVT_TIMER | EVT_NOTIFY_SIGNAL, TPL_CALLBACK, OnTimer, NULL, &TimerEvent);
gBS->SetTimer (TimerEvent, TimerPeriodic, 10000000); // 1 second (100ns units)

// Close event
gBS->CloseEvent (Event);
```

**Task Priority Levels (TPL):**

```
TPL_APPLICATION  (4)  ← Normal context; default for most code
TPL_CALLBACK     (8)  ← Event notification callbacks  
TPL_NOTIFY       (16) ← Used inside boot services; preempts CALLBACK
TPL_HIGH_LEVEL   (31) ← Interrupt service; extremely limited operations
```

Higher TPLs mask lower-priority events. `RaiseTPL` / `RestoreTPL` bracket critical sections.

---

## UEFI Runtime Services

Runtime Services remain active after `ExitBootServices()`. They are implemented by `DXE_RUNTIME_DRIVER` modules that are relocated into virtual addresses.

```c
// Variable access (most commonly used runtime services)

// Write a UEFI variable
Status = gRT->SetVariable (
  L"MyVariable",                  // Unicode name
  &gMyVendorGuid,                 // namespace GUID
  EFI_VARIABLE_NON_VOLATILE |
  EFI_VARIABLE_BOOTSERVICE_ACCESS |
  EFI_VARIABLE_RUNTIME_ACCESS,   // attributes
  DataSize,                       // data size in bytes
  Data                            // pointer to data
);

// Read a UEFI variable
UINTN Size = sizeof (MyData);
Status = gRT->GetVariable (L"MyVariable", &gMyVendorGuid, &Attributes, &Size, &MyData);

// Enumerate variables
UINTN NameSize = 256;
CHAR16 VarName[256] = L"";
EFI_GUID VarGuid;
while (TRUE) {
  NameSize = sizeof (VarName);
  Status = gRT->GetNextVariableName (&NameSize, VarName, &VarGuid);
  if (Status == EFI_NOT_FOUND) break;
}

// System reset
gRT->ResetSystem (EfiResetCold, EFI_SUCCESS, 0, NULL);

// Capsule update (submits firmware update capsule)
EFI_CAPSULE_HEADER *CapsuleArray[1] = { &MyCapsule };
UINT64 MaxCapsuleSize;
EFI_RESET_TYPE ResetType;
gRT->QueryCapsuleCapabilities (CapsuleArray, 1, &MaxCapsuleSize, &ResetType);
gRT->UpdateCapsule (CapsuleArray, 1, ScatterGatherList);
```

---

## UEFI Driver Model

The UEFI Driver Model is the standard way to write DXE drivers that manage hardware. It mandates a specific protocol interface — the **Driver Binding Protocol** — that the DXE Core uses to connect drivers to controllers.

### Driver Binding Protocol

```c
typedef struct {
  EFI_DRIVER_BINDING_SUPPORTED  Supported;  // Can this driver manage this controller?
  EFI_DRIVER_BINDING_START      Start;      // Attach driver to controller
  EFI_DRIVER_BINDING_STOP       Stop;       // Detach driver from controller
  UINT32                        Version;    // Higher version wins when two drivers compete
  EFI_HANDLE                    ImageHandle;
  EFI_HANDLE                    DriverBindingHandle;
} EFI_DRIVER_BINDING_PROTOCOL;
```

### Minimal UEFI Driver Example

```c
// MyUartDxe.c — Minimal UEFI Driver implementing Serial I/O Protocol

#include <Uefi.h>
#include <Library/UefiDriverEntryPoint.h>
#include <Library/UefiBootServicesTableLib.h>
#include <Library/DebugLib.h>
#include <Protocol/SerialIo.h>
#include <Protocol/DevicePath.h>
#include "MyUart.h"  // MMIO register definitions

// Forward declarations
EFI_STATUS EFIAPI MyUartSupported (IN EFI_DRIVER_BINDING_PROTOCOL *, IN EFI_HANDLE, IN EFI_DEVICE_PATH_PROTOCOL *);
EFI_STATUS EFIAPI MyUartStart    (IN EFI_DRIVER_BINDING_PROTOCOL *, IN EFI_HANDLE, IN EFI_DEVICE_PATH_PROTOCOL *);
EFI_STATUS EFIAPI MyUartStop     (IN EFI_DRIVER_BINDING_PROTOCOL *, IN EFI_HANDLE, IN UINTN, IN EFI_HANDLE *);

// Driver Binding Protocol instance
EFI_DRIVER_BINDING_PROTOCOL gMyUartDriverBinding = {
  MyUartSupported,
  MyUartStart,
  MyUartStop,
  0x10,        // version
  NULL,        // ImageHandle (filled in by EntryPoint lib)
  NULL         // DriverBindingHandle
};

// Serial I/O Protocol implementation
EFI_STATUS EFIAPI MyUartReset    (IN EFI_SERIAL_IO_PROTOCOL *This);
EFI_STATUS EFIAPI MyUartWrite    (IN EFI_SERIAL_IO_PROTOCOL *This, IN OUT UINTN *BufferSize, IN VOID *Buffer);
EFI_STATUS EFIAPI MyUartRead     (IN EFI_SERIAL_IO_PROTOCOL *This, IN OUT UINTN *BufferSize, OUT VOID *Buffer);

STATIC EFI_SERIAL_IO_PROTOCOL mSerialIo = {
  SERIAL_IO_INTERFACE_REVISION,
  MyUartReset,
  NULL,   // SetAttributes
  NULL,   // SetControl
  NULL,   // GetControl
  MyUartWrite,
  MyUartRead,
  NULL    // Mode
};

EFI_STATUS EFIAPI MyUartSupported (
  IN EFI_DRIVER_BINDING_PROTOCOL *This,
  IN EFI_HANDLE                   ControllerHandle,
  IN EFI_DEVICE_PATH_PROTOCOL    *RemainingDevicePath OPTIONAL
) {
  // Check if this handle has our vendor device path node
  EFI_STATUS Status;
  MY_UART_DEVICE_PATH *Dp;

  Status = gBS->OpenProtocol (
    ControllerHandle,
    &gMyUartDevicePathGuid,
    (VOID **) &Dp,
    This->DriverBindingHandle,
    ControllerHandle,
    EFI_OPEN_PROTOCOL_BY_DRIVER
  );
  if (EFI_ERROR (Status)) return EFI_UNSUPPORTED;

  gBS->CloseProtocol (ControllerHandle, &gMyUartDevicePathGuid,
                      This->DriverBindingHandle, ControllerHandle);
  return EFI_SUCCESS;
}

EFI_STATUS EFIAPI MyUartStart (
  IN EFI_DRIVER_BINDING_PROTOCOL *This,
  IN EFI_HANDLE                   ControllerHandle,
  IN EFI_DEVICE_PATH_PROTOCOL    *RemainingDevicePath OPTIONAL
) {
  // Initialize hardware
  MyUartHwInit (MYSOC_UART0_BASE, 115200);

  // Install Serial I/O Protocol on the controller handle
  return gBS->InstallProtocolInterface (
    &ControllerHandle,
    &gEfiSerialIoProtocolGuid,
    EFI_NATIVE_INTERFACE,
    &mSerialIo
  );
}

EFI_STATUS EFIAPI MyUartStop (
  IN EFI_DRIVER_BINDING_PROTOCOL *This,
  IN EFI_HANDLE                   ControllerHandle,
  IN UINTN                        NumberOfChildren,
  IN EFI_HANDLE                  *ChildHandleBuffer OPTIONAL
) {
  return gBS->UninstallProtocolInterface (
    ControllerHandle,
    &gEfiSerialIoProtocolGuid,
    &mSerialIo
  );
}

// Driver entry point (called by DXE Core when module loads)
EFI_STATUS EFIAPI MyUartDriverEntry (
  IN EFI_HANDLE        ImageHandle,
  IN EFI_SYSTEM_TABLE *SystemTable
) {
  return EfiLibInstallDriverBinding (ImageHandle, SystemTable,
                                    &gMyUartDriverBinding, ImageHandle);
}
```

---

## Key Protocol Families

### Storage Protocols

| Protocol | GUID | Purpose |
|----------|------|---------|
| `EFI_BLOCK_IO_PROTOCOL` | `gEfiBlockIoProtocolGuid` | Raw block read/write (disk, eMMC, NVMe) |
| `EFI_BLOCK_IO2_PROTOCOL` | — | Async block I/O |
| `EFI_DISK_IO_PROTOCOL` | `gEfiDiskIoProtocolGuid` | Byte-aligned I/O over Block IO |
| `EFI_SIMPLE_FILE_SYSTEM_PROTOCOL` | `gEfiSimpleFileSystemProtocolGuid` | FAT filesystem access |
| `EFI_NVME_PASS_THRU_PROTOCOL` | — | Direct NVMe command pass-through |
| `EFI_SD_MMC_PASS_THRU_PROTOCOL` | — | SD/eMMC pass-through |

### Network Protocols

| Protocol | Purpose |
|----------|---------|
| `EFI_SIMPLE_NETWORK_PROTOCOL` | Raw Ethernet frame send/receive |
| `EFI_MANAGED_NETWORK_PROTOCOL` | Managed network with filtering |
| `EFI_IP4_PROTOCOL` / `EFI_IP6_PROTOCOL` | IPv4/IPv6 |
| `EFI_TCP4_PROTOCOL` / `EFI_TCP6_PROTOCOL` | TCP connection |
| `EFI_UDP4_PROTOCOL` | UDP datagrams |
| `EFI_HTTP_PROTOCOL` | HTTP/HTTPS client |
| `EFI_TLS_PROTOCOL` | TLS session |

### Console Protocols

| Protocol | Purpose |
|----------|---------|
| `EFI_SIMPLE_TEXT_OUTPUT_PROTOCOL` | Character output (ConOut) |
| `EFI_SIMPLE_TEXT_INPUT_PROTOCOL` | Keyboard input (ConIn) |
| `EFI_SIMPLE_TEXT_INPUT_EX_PROTOCOL` | Extended input with key state |
| `EFI_GRAPHICS_OUTPUT_PROTOCOL` | Framebuffer access (GOP) |
| `EFI_EDID_DISCOVERED_PROTOCOL` | Monitor EDID information |
| `EFI_SERIAL_IO_PROTOCOL` | Serial port character I/O |

### Security Protocols

| Protocol | Purpose |
|----------|---------|
| `EFI_SECURITY_ARCH_PROTOCOL` | File authentication hook |
| `EFI_SECURITY2_ARCH_PROTOCOL` | Enhanced file auth (Secure Boot) |
| `EFI_TCG2_PROTOCOL` | TPM 2.0 interface |
| `EFI_RNG_PROTOCOL` | Hardware RNG |
| `EFI_PKCS7_VERIFY_PROTOCOL` | PKCS#7 signature verification |

---

## Device Path Protocol

The Device Path is a data structure that uniquely identifies a hardware resource. It is a variable-length chain of typed nodes terminated by an `END_ENTIRE_DEVICE_PATH` node.

```c
// Typical device path for FAT partition on SD card:
//   ACPI HID (SD controller) → PCI → SD Host → Logical Unit → HD Partition

// Creating a device path programmatically
#include <Library/DevicePathLib.h>

// Append a node to an existing path
EFI_DEVICE_PATH_PROTOCOL *NewPath;
NewPath = AppendDevicePathNode (ExistingPath, NewNode);

// Convert to text (for UEFI Shell display)
CHAR16 *Text = ConvertDevicePathToText (DevicePath, TRUE, TRUE);
Print (L"Device: %s\n", Text);
FreePool (Text);

// Parse a text device path
EFI_DEVICE_PATH_PROTOCOL *Dp = ConvertTextToDevicePath (L"PciRoot(0x0)/Pci(0x1,0x0)/VenHw(...)");
```

Device Path node types relevant to storage:
- `HARDWARE_DEVICE_PATH` + `HW_PCI_DP` — PCI device (bus/device/function numbers)
- `MEDIA_DEVICE_PATH` + `MEDIA_HARDDRIVE_DP` — GPT/MBR partition
- `MEDIA_DEVICE_PATH` + `MEDIA_FILEPATH_DP` — File path on a filesystem
- `MESSAGING_DEVICE_PATH` + `MSG_USB_DP` — USB device
- `MESSAGING_DEVICE_PATH` + `MSG_NVME_NAMESPACE_DP` — NVMe namespace

---

## UEFI Applications

UEFI applications are `UEFI_APPLICATION` type modules that can be loaded and executed from the BDS phase (from UEFI Shell, boot manager, or via `LoadImage`/`StartImage`).

```c
// UEFI application entry point (via ShellPkg)
#include <Library/ShellLib.h>
#include <Library/UefiApplicationEntryPoint.h>

EFI_STATUS EFIAPI UefiMain (
  IN EFI_HANDLE        ImageHandle,
  IN EFI_SYSTEM_TABLE *SystemTable
) {
  EFI_STATUS Status;
  EFI_INPUT_KEY Key;

  Print (L"MySoC UEFI Diagnostic Tool v1.0\n");

  // Read Shell arguments
  UINTN Argc;
  CHAR16 **Argv;
  Status = ShellCommandLineParseEx (NULL, NULL, NULL, TRUE, FALSE);

  // Access firmware variables
  UINT32 Attributes;
  UINT64 BoardSerial;
  UINTN Size = sizeof (BoardSerial);
  gRT->GetVariable (L"BoardSerial", &gMySoCVendorGuid, &Attributes, &Size, &BoardSerial);
  Print (L"Board Serial: 0x%016llx\n", BoardSerial);

  // Wait for keypress
  gBS->WaitForEvent (1, &gST->ConIn->WaitForKey, NULL);
  gST->ConIn->ReadKeyStroke (gST->ConIn, &Key);

  return EFI_SUCCESS;
}
```

UEFI applications differ from OS executables: they run in the firmware environment, can access all UEFI protocols, and terminate by returning to the BDS (they do **not** call `ExitBootServices()`).
