---
title: QEMU Architecture
createTime: 2026/03/14 14:21:19
permalink: /kb/embedded/qemu/qemu-architecture/
---

# QEMU Architecture

Understanding QEMU's internals is essential for getting the most out of it — for performance tuning, writing device models, and debugging emulation fidelity issues.

## The Tiny Code Generator (TCG)

TCG is QEMU's software dynamic binary translator. It converts guest machine code into host machine code at runtime, block by block.

### Translation Blocks (TBs)

QEMU does not translate instructions one at a time. It translates a **Translation Block (TB)**: a linear sequence of guest instructions ending at a branch, exception vector entry, or after a configurable maximum size.

```
Guest ARM64 code                   Host x86_64 code
──────────────────                 ─────────────────────────────
ldr  x0, [x1, #8]    ──────────►  mov  rax, [rbp + offsetof(env, x1)]
add  x0, x0, #1       TCG IR      add  rax, 8
str  x0, [x2]         translation mov  rdx, [rax]
                                  add  rdx, 1
                                  mov  rax, [rbp + offsetof(env, x2)]
                                  mov  [rax], rdx
```

### TCG Pipeline

```
Guest instructions
       │
       ▼ target/arm/translate.c (arch-specific frontend)
TCG Intermediate Representation (IR)
       │  e.g., tcg_gen_ld_i64(), tcg_gen_add_i64(), tcg_gen_st_i64()
       ▼ tcg/optimize.c
Optimized TCG IR (dead code elim, constant folding, copy propagation)
       ▼ tcg/<host_arch>/tcg-target.c.inc (arch-specific backend)
Host machine code in Code Cache
```

### Code Cache and TB Chaining

Generated host code lives in a fixed-size **code cache** (default 32 MiB, configurable with `TB_JIT_CACHE_SIZE`). When a TB completes and the next TB is already translated, TCG **chains** them with a direct jump, avoiding the overhead of re-entering the dispatch loop.

TB invalidation happens when:
- Guest code is written (SMC — self-modifying code)
- The TLB entry for the TB's address is invalidated
- The code cache is full (LRU eviction)

### TCG CPU State

The guest CPU state is maintained in `CPUArchState` (e.g., `ARMCPU` for ARM). A pointer to this struct is passed in a dedicated host register (`rbp` on x86_64) so that register accesses from TCG IR translate to a single memory load/store relative to that base.

```c
// In target/arm/cpu.h (simplified):
typedef struct CPUARMState {
    uint64_t xregs[32];    // AArch64 general-purpose registers
    uint64_t pc;           // Program counter
    uint32_t pstate;       // Processor state
    // ... hundreds more fields
} CPUARMState;
```

### TCG Multi-Threading (since QEMU 4.0)

By default, TCG is single-threaded: one TCG thread handles all vCPUs. Since QEMU 4.0, multi-threaded TCG is available:

```bash
-accel tcg,thread=multi   # Each vCPU gets its own TCG thread (SMP)
-accel tcg,thread=single  # Default: one thread for all vCPUs
```

## Memory Subsystem

QEMU's memory model is one of its most complex subsystems. It maps both RAM and MMIO devices into a unified address space using a hierarchy of `MemoryRegion` objects.

### MemoryRegion

`MemoryRegion` is the fundamental unit. It can represent:
- **RAM**: A region backed by host memory
- **I/O (MMIO)**: A region with read/write callbacks
- **ROM**: Read-only memory
- **Alias**: A window that remaps part of another MemoryRegion
- **Container**: A region that contains sub-regions (no backing storage itself)

```c
// Three types of MemoryRegion initialization:

// 1. RAM-backed:
memory_region_init_ram(&mr, owner, "my-ram", size, &error_fatal);

// 2. MMIO with callbacks:
memory_region_init_io(&mr, owner, &my_ops, opaque, "my-device", size);

// 3. Alias (remap another region):
memory_region_init_alias(&mr, owner, "alias", &target_mr, offset, size);
```

### MemoryRegionOps

For I/O regions, the `MemoryRegionOps` struct defines the behavior:

```c
static const MemoryRegionOps my_device_ops = {
    .read  = my_device_read,   // Called on guest read from this region
    .write = my_device_write,  // Called on guest write to this region
    .endianness = DEVICE_LITTLE_ENDIAN,
    .valid = {
        .min_access_size = 4,  // Only 32-bit accesses allowed
        .max_access_size = 4,
    },
    .impl = {
        .min_access_size = 4,
        .max_access_size = 4,
    },
};
```

### AddressSpace and FlatView

- **`AddressSpace`**: A root view of memory as seen by a particular agent (CPU, DMA controller). Multiple address spaces can exist.
- **`FlatView`**: The compiled, non-overlapping, physical layout of all `MemoryRegion`s. Recomputed whenever the region tree changes.
- **`MemoryRegionSection`**: A slice of a `FlatView` used by the TCG TLB.

```
CPU address space (AddressSpace)
  └── system bus container (MemoryRegion, container)
        ├── RAM [0x40000000 - 0x4FFFFFFF] (RAM-backed)
        ├── ROM [0x00000000 - 0x0007FFFF] (ROM)
        ├── UART [0x09000000 - 0x09000FFF] (I/O)
        └── GIC  [0x08000000 - 0x0801FFFF] (I/O)
```

### TLB (Software TLB)

TCG maintains a software TLB per vCPU to cache virtual→physical translations. On a TLB miss, QEMU calls the arch-specific page walker. Each TLB entry encodes the host address (for RAM) or the MemoryRegion callback pointer (for MMIO).

## QEMU Object Model (QOM)

QOM is QEMU's C-based object-oriented framework, providing inheritance, properties, and interfaces without C++.

### Core Types

```c
// Every QOM type is described by TypeInfo:
static const TypeInfo my_device_info = {
    .name          = "my-device",
    .parent        = TYPE_SYS_BUS_DEVICE,
    .instance_size = sizeof(MyDeviceState),
    .instance_init = my_device_instance_init,  // constructor (alloc)
    .class_init    = my_device_class_init,      // class setup (once)
};

// Register at module load time:
static void my_device_register(void)
{
    type_register_static(&my_device_info);
}
type_init(my_device_register);
```

### Lifecycle: instance_init vs realize

```
type_new()          → instance_init()   // Allocate and zero struct, init MemoryRegions
qdev_realize()     → realize()         // Connect to buses, map memory, request IRQs
                                        // (hardware is now "live")
object_unref()     → instance_finalize() // Cleanup
```

This two-phase model allows devices to be created and configured before being "plugged in" to the machine.

### Properties

Devices expose configurable properties:

```c
DEFINE_PROP_UINT32("clock-frequency", MyDeviceState, freq, 24000000);
DEFINE_PROP_CHR("chardev", MyDeviceState,  chr);
DEFINE_PROP_BOOL("fifo-enabled", MyDeviceState, fifo_en, true);

// Set from command line:
// -device my-device,clock-frequency=48000000
```

## I/O and Event Loop

QEMU's main thread runs a **GLib event loop** (`GMainLoop`) that multiplexes:
- File descriptor events (sockets, serial ports, QMP)
- Timers (`QEMUTimer`) — used for peripheral timers, watchdogs
- Bottom Halves (BH) — deferred callbacks scheduled from IRQ context
- Coroutines — cooperative multi-tasking for block I/O

```
Main thread:
  glib event loop
  ├── fd events  (network, console, QMP socket)
  ├── timers     (UART baud rate, DMA timeouts)
  ├── BHs        (deferred IRQ delivery after lock drop)
  └── AioContext (block layer async I/O completions)

vCPU thread(s):
  TCG translation + execution loop
  ↕ (mutex + memory barriers)
Main thread:
  Device model callbacks (MMIO reads/writes happen in vCPU thread)
```

## Bus Hierarchy

Devices connect to buses. Buses define the protocol and addressing scheme:

| Bus Type | Header | Usage |
|----------|--------|-------|
| `SysBus` | `hw/sysbus.h` | Memory-mapped devices (most embedded peripherals) |
| `PCI` | `hw/pci/pci.h` | PCI/PCIe devices |
| `USB` | `hw/usb/` | USB devices |
| `I2CBus` | `hw/i2c/i2c.h` | I2C devices |
| `SSIBus` | `hw/ssi/ssi.h` | SPI devices |
| `SCLBus` | `hw/scsi/` | SCSI |

For embedded work, most devices are `SysBusDevice`: they have one or more MMIO regions and IRQ lines, mapped directly onto the CPU address space.

## Machine Init Flow

When you run `qemu-system-arm -M virt`, QEMU executes:

```
1. module_init()           — register all TypeInfos (devices, CPUs, machines)
2. machine->init()         — e.g., virt_init() in hw/arm/virt.c
   ├── Create CPU object(s)
   ├── Create RAM MemoryRegion, wire to address space
   ├── Create and realize peripheral devices
   │     ├── UART → map to 0x09000000, wire IRQ to GIC
   │     ├── GIC  → map to 0x08000000
   │     ├── Timer → map to 0x09010000, wire IRQ
   │     └── ...
   ├── Load kernel/DTB/initrd into guest RAM
   └── Set CPU initial PC to entry point
3. Main loop: vCPU thread starts, event loop starts
```

## QEMU Source Tree Layout (Key Directories)

| Directory | Contents |
|-----------|----------|
| `target/<arch>/` | Guest CPU frontend: instruction decode → TCG IR |
| `tcg/<host_arch>/` | Host backend: TCG IR → host machine code |
| `hw/<bus>/` | Device models (uart, timer, intc, dma, ...) |
| `hw/arm/`, `hw/riscv/` | Machine definitions |
| `include/hw/` | Device model headers |
| `include/exec/` | Memory API headers |
| `accel/tcg/` | TCG core: TB management, translation loop |
| `accel/kvm/` | KVM accelerator integration |
| `qom/` | QOM core (type system, object, properties) |
| `chardev/` | Character backends (serial, PTY, socket) |
| `block/` | Block layer (qcow2, raw, nbd, ...) |
| `net/` | Network backends (user, tap, socket, ...) |
| `monitor/` | QEMU Monitor and QMP |
| `scripts/` | Python utilities: simpletrace, qemu.py QMP library |

## Key Components of QEMU Architecture

### 1. **CPU Emulation**
QEMU uses dynamic binary translation to emulate CPUs. It translates guest instructions into host instructions at runtime, enabling the execution of software built for one architecture on a completely different architecture.

- **TCG (Tiny Code Generator)**: The core component responsible for translating guest instructions to host instructions. For more on performance considerations, see [QEMU Performance Optimization](/kb/embedded/qemu/qemu-performance-optimization/).
- **Supported Architectures**: ARM, x86, RISC-V, PowerPC, SPARC, and more. See [QEMU Supported Architectures](/kb/embedded/qemu/qemu-supported-architectures/) for a complete list.

### 2. **Device Emulation**
QEMU provides emulation for a wide range of hardware devices, including:
- Network interfaces
- Storage controllers
- USB devices
- Graphics adapters
- Serial and parallel ports


