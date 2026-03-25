---
title: QNX Hypervisor
createTime: 2026/03/25 00:00:00
permalink: /kb/embedded/qnx/qnx-hypervisor/
---

# QNX Hypervisor

## Overview

The **QNX Hypervisor** is a **Type-1 bare-metal hypervisor** that runs directly on hardware. It enables multiple independent guest operating systems (VMs) to share a single SoC while maintaining strict isolation between them.

Key use cases:
- **Automotive**: Run AUTOSAR Adaptive (Linux-based) alongside a QNX safety partition on the same SoC
- **Industrial**: Isolate real-time control from Linux-based SCADA
- **Medical**: Separate certified software from connectivity software
- **Defense**: Geographically separate red/black networks on one platform

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                     QNX Hypervisor (Type-1)                     │
│  Runs in EL2 (AArch64) / VMX Root (x86_64)                     │
│  Tiny footprint, deterministic scheduling                       │
├──────────────────────┬──────────────────────┬───────────────────┤
│  VM 0 (Host VM)      │  VM 1 (Guest QNX)    │  VM 2 (Guest Linux│
│  QNX Neutrino        │  QNX Neutrino / OS   │  AUTOSAR, ADAS)   │
│  ASIL D (safety)     │  for Safety          │  QM               │
│                      │                      │                   │
│  EL1/EL0             │  EL1/EL0             │  EL1/EL0          │
└──────────────────────┴──────────────────────┴───────────────────┘
         │                      │                      │
         └──────────────────────┼──────────────────────┘
                                │
         ┌──────────────────────▼──────────────────────┐
         │           Physical Hardware (AArch64)        │
         │   CPUs   DRAM   Peripherals   Interrupts     │
         └─────────────────────────────────────────────┘
```

The hypervisor itself is extremely small (runs entirely in privileged EL2 mode), and delegates workloads to the **Host VM** (always QNX Neutrino) which manages physical devices and hosts virtual device (vdev) backends.

---

## VM Types

| Type | Description |
|------|-------------|
| **Host VM** | First VM to start. Runs QNX Neutrino. Has direct access to physical hardware. Hosts vdev backends. One per system. |
| **Guest VM** | Can run QNX Neutrino, Linux, or other OSes. Sees only virtual hardware. Multiple can coexist. |

---

## ARM Virtualization Extensions

The QNX Hypervisor leverages ARM's hardware virtualization support:

| Feature | Role |
|---------|------|
| **EL2** (Exception Level 2) | Hypervisor mode — traps privileged guest operations |
| **Stage-2 MMU** | Translates Guest Physical Address (GPA) → Host Physical Address (HPA), enforcing VM memory isolation |
| **VHE** (Virtualization Host Extensions) | Allows EL2 to run OS-like code more efficiently (used by Host VM) |
| **Generic Timer** | Per-VM virtual timer, injected as virtual interrupt |
| **GICv3/GICv4** | Hardware interrupt controller with virtual interrupt injection |
| **SMMU** | I/O MMU — restricts DMA-capable devices to their assigned VM's memory |

---

## VM Configuration File

Each VM is configured with a **`.qvmconf`** file:

```json
# /etc/vms/guest-qnx.qvmconf
{
    "name": "safety-vm",
    "image": "/boot/safety-qnx.ifs",
    "cpus": 2,
    "cpulist": "2,3",
    "ram": [
        { "base": "0x80000000", "size": "256M" }
    ],
    "vdev": [
        {
            "type": "qvm-vdev-qcar-uart",
            "config": "base=0x9000000,irq=33,baud=115200"
        },
        {
            "type": "qvm-vdev-virtio-net",
            "config": "peer=vswitch0,mac=52:54:00:12:34:56"
        },
        {
            "type": "qvm-vdev-virtio-blk",
            "config": "file=/dev/sd0t79"
        }
    ]
}
```

```json
# /etc/vms/guest-linux.qvmconf
{
    "name": "linux-adas",
    "image": "/boot/linux-adas-kernel.bin",
    "dtb": "/boot/linux-adas.dtb",
    "cpus": 4,
    "cpulist": "4,5,6,7",
    "ram": [
        { "base": "0x100000000", "size": "1G" }
    ],
    "vdev": [
        {
            "type": "qvm-vdev-virtio-net",
            "config": "peer=vswitch0"
        },
        {
            "type": "qvm-vdev-virtio-blk",
            "config": "file=/dev/sd0t83"
        },
        {
            "type": "qvm-vdev-shmem",
            "config": "name=shm-safety-adas,size=4M,role=client"
        }
    ]
}
```

---

## Starting and Managing VMs

```bash
# Start the hypervisor (done via IFS script in Host VM)
# The hypervisor is started by the Host VM's startup code

# In the Host VM IFS .script section:
# Start virtual device server
qvm-vdev-server &
waitfor /dev/qvm 5

# Start guest VMs
qvm start /etc/vms/guest-qnx.qvmconf
qvm start /etc/vms/guest-linux.qvmconf

# List running VMs
qvm list

# Pause a VM
qvm pause safety-vm

# Resume a VM
qvm resume safety-vm

# Stop a VM gracefully
qvm stop safety-vm

# Force destroy a VM
qvm destroy safety-vm

# Show VM statistics
qvm stat safety-vm
```

---

## Virtual Devices (vdevs)

Virtual devices are user-space processes in the **Host VM** that emulate hardware for guest VMs. They communicate with the hypervisor via `ioctl()` on `/dev/qvm`.

### Available vdev Types

| vdev | Description |
|------|-------------|
| `qvm-vdev-ramfb` | Frame buffer (shared memory display) |
| `qvm-vdev-qcar-uart` | Virtual UART (mapped to host UART or PTY) |
| `qvm-vdev-virtio-net` | VirtIO network interface |
| `qvm-vdev-virtio-blk` | VirtIO block device |
| `qvm-vdev-virtio-console` | VirtIO console (character device) |
| `qvm-vdev-shmem` | Shared memory region between VMs |
| `qvm-vdev-gic` | ARM Generic Interrupt Controller emulation |
| `qvm-vdev-timer` | Virtual timer |
| `qvm-vdev-pl011` | ARM PL011 UART emulation |
| `qvm-vdev-ioapic` | x86 I/O APIC emulation |
| `qvm-vdev-pic` | x86 PIC emulation |
| `qvm-vdev-ps2` | PS/2 keyboard/mouse |

---

## VirtIO: The Guest-to-Host Communication Protocol

Guest VMs use **VirtIO** to communicate efficiently with the Host VM for I/O:

```
Guest VM                     Host VM (via vdev)
┌─────────────────────┐      ┌────────────────────────────┐
│  virtio-net driver  │      │  qvm-vdev-virtio-net       │
│  (in Linux/QNX)     │      │  (in Host VM user space)   │
│                     │      │                            │
│  virtqueue (TX)  ───┼──────┼──► process packet          │
│  virtqueue (RX)  ◄──┼──────┼─── inject packet + IRQ    │
└─────────────────────┘      └────────────────────────────┘
         │ shared memory (mapped into both VMs by hypervisor)
         │ virtqueue metadata in shared DMA memory
```

---

## Inter-VM Communication: Shared Memory

VMs can share memory regions for high-performance data exchange:

### Host VM Configuration

```json
{
    "vdev": [
        {
            "type": "qvm-vdev-shmem",
            "config": "name=shm-safety-hmi,size=8M,role=server,paddr=0x70000000"
        }
    ]
}
```

### Guest VM Configuration

```json
{
    "vdev": [
        {
            "type": "qvm-vdev-shmem",
            "config": "name=shm-safety-hmi,size=8M,role=client"
        }
    ]
}
```

### Accessing Shared Memory from a QNX Guest

```c
#include <sys/mman.h>
#include <fcntl.h>

/* Open the shared memory region (appears as typed memory in QNX guest) */
int fd = posix_typed_mem_open("shm-safety-hmi",
                               O_RDWR,
                               POSIX_TYPED_MEM_ALLOCATE);

void *shared = mmap(NULL, 8 * 1024 * 1024,
                    PROT_READ | PROT_WRITE,
                    MAP_SHARED, fd, 0);

/* Use a lock-free ring buffer or spinlock for synchronization */
struct shared_data *data = (struct shared_data *)shared;
```

---

## HVC: Hypervisor Call Interface

Guests can make **HVC** (Hypervisor Call) calls to request services from the hypervisor. These are similar to system calls but cross the EL1→EL2 boundary:

```c
/* QNX-specific: vdev API for making HVC calls is wrapped
 * by the qvm device driver inside the guest VM.
 * Applications do not call HVC directly.
 * The microkernel in each guest issues HVC for:
 * - Physical interrupt routing
 * - Stage-2 memory mappings
 * - VM lifecycle management
 */
```

---

## CPU Affinity and Scheduling

```json
# Assign CPUs 0-1 to Host VM (safety), CPUs 2-5 to Linux guest
{
    "host": {
        "cpulist": "0,1",
        "priority": 240
    },
    "vms": [
        {
            "name": "linux-guest",
            "cpulist": "2,3,4,5",
            "priority": 10
        }
    ]
}
```

The hypervisor scheduler ensures:
- Host VM vCPUs get pinned to their assigned physical CPUs
- Guest VM vCPUs are scheduled by the QNX hypervisor scheduler on their assigned physical CPUs
- Priority-based scheduling: higher-priority VMs preempt lower-priority VMs on shared CPUs

---

## Device Assignment (Pass-Through)

Physical devices can be assigned directly to a Guest VM, bypassing the Host VM:

```json
{
    "name": "safety-vm",
    "cpulist": "0,1",
    "ram": [ { "base": "0x80000000", "size": "256M" } ],
    "vdev": [
        {
            "type": "qvm-vdev-passthrough",
            "config": "paddr=0xFF000000,size=0x1000,irq=32"
        }
    ]
}
```

With an SMMU (ARM IOMMU), DMA from the passed-through device is restricted to the guest's physical memory range, preventing the device from accessing other VMs' memory.

---

## QNX Hypervisor with AUTOSAR Adaptive

A common automotive deployment runs AUTOSAR Adaptive Platform on Linux in a Guest VM, alongside a QNX safety partition in the Host VM:

```
┌──────────────────────────────────────────────────────────────────────┐
│                   QNX Hypervisor                                     │
├──────────────────────────────────┬───────────────────────────────────┤
│  Host VM: QNX Neutrino (ASIL D)  │  Guest VM: Linux + AUTOSAR AP    │
│                                  │                                   │
│  • Wheel speed sensor driver     │  • ARA::COM (DDS/SOME-IP)        │
│  • Brake controller (ISO 26262)  │  • Execution Management          │
│  • APS: 40% CPU                  │  • Service registry              │
│                                  │  • Navigation, ADAS apps         │
│  Shares data via shmem vdev      │  • Reads safety data via shmem   │
└──────────────────────────────────┴───────────────────────────────────┘
```

---

## Nested Virtualization

QNX Hypervisor supports nested virtualization on platforms with ARM VHE:

```
Bare metal
└── QNX Hypervisor (EL2)
    └── Host VM: QNX Neutrino
        └── Guest VM 1: Another QNX hypervisor instance (for testing)
```

This is primarily used for development and CI/CD testing of hypervisor configurations.

---

## Diagnostic and Monitoring

```bash
# List VMs and their status
qvm list

# Show VM CPU/memory statistics
qvm stat --all

# Show interrupt statistics per VM
qvm irqstat safety-vm

# Show vdev status
qvm vdevstat safety-vm

# Debug: dump VM memory (host VM only, requires privilege)
qvm memdump safety-vm 0x80000000 4096

# Trace hypervisor events
tracelogger -f /tmp/hv_trace.kev &
pidin sched
# then:
tracelogger -X
traceevent -v /tmp/hv_trace.kev | grep qvm
```
