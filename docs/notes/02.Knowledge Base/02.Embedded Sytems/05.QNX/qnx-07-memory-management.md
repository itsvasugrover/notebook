---
title: QNX Memory Management
createTime: 2026/03/25 00:00:00
permalink: /kb/embedded/qnx/memory-management/
---

# QNX Memory Management

## Memory Architecture Overview

QNX Neutrino uses a **paged virtual memory system** backed by the CPU's MMU. Each process has an independent virtual address space. The process manager (`procnto`) and the microkernel cooperate to manage:

- **Virtual address spaces** (per-process page tables)
- **Physical memory pools** (system RAM allocation)
- **Typed memory** (device memory, DMA-safe memory, physically contiguous memory)
- **Shared memory** (POSIX shared memory objects)
- **Stack management** (per-thread stack with guard pages)

---

## Virtual Memory Layout (AArch64, SDP 8.0)

```
Virtual Address Space — 64-bit AArch64
─────────────────────────────────────────────────────────────────────────────
0x0000_0000_0000_0000   NULL (unmapped, catches null pointer dereferences)
0x0000_0000_0001_0000   Program text (.text), read-only
                        Program rodata (.rodata)
0x0000_0000_????_????   Program data (.data, .bss)
                        Thread-local storage (TLS)
                        Dynamic linker mapping (ldqnx-64.so.2)
                        Shared library mappings (libc.so.x, libm.so.x, ...)
                        Heap (anonymous mmap, grows up)
                        Thread stacks (each thread's stack, guard page)
                        POSIX shared memory (shm_open mappings)
                        Typed memory objects (device MMIO ranges)
0xFFFF_FFFF_FFFF_FFFF   (user/kernel split configured by kernel)
─────────────────────────────────────────────────────────────────────────────
Kernel virtual space     (not accessible by user processes)
─────────────────────────────────────────────────────────────────────────────
```

The kernel/user split is configured at boot time (`procnto` startup option `-s`).

---

## Physical Memory Objects

QNX tracks **physical memory** as typed memory objects. All physical memory is registered in the **syspage** at boot time by the startup code.

### Typed Memory Classes

| Class | Description |
|-------|-------------|
| `POSIX_TYPED_MEM_ALLOCATE` | Any available physical memory |
| `POSIX_TYPED_MEM_ALLOCATE_CONTIG` | Physically contiguous block (DMA buffers) |
| `POSIX_TYPED_MEM_MAP_ALLOCATABLE` | Allocate from a named memory region |

```c
#include <sys/mman.h>

/* Allocate 1 MB of physically contiguous memory for DMA */
int fd = posix_typed_mem_open("/memory/system",
                              O_RDWR,
                              POSIX_TYPED_MEM_ALLOCATE_CONTIG);
if (fd == -1) { perror("posix_typed_mem_open"); exit(1); }

void *vaddr = mmap(NULL, 1024 * 1024,
                   PROT_READ | PROT_WRITE | PROT_NOCACHE,
                   MAP_SHARED, fd, 0);
if (vaddr == MAP_FAILED) { perror("mmap"); exit(1); }

/* Get the physical address for DMA programming */
off64_t phys;
mem_offset64(vaddr, NOFD, 1, &phys, NULL);
printf("Virtual: %p, Physical: 0x%llx\n", vaddr, (unsigned long long)phys);

/* DMA transfer setup */
program_dma_controller(phys, 1024 * 1024);

munmap(vaddr, 1024 * 1024);
close(fd);
```

---

## mmap: Mapping Memory

### Anonymous Memory (Heap Alternative)

```c
/* Allocate 64 KB with specific alignment */
void *buf = mmap(NULL, 64 * 1024,
                 PROT_READ | PROT_WRITE,
                 MAP_PRIVATE | MAP_ANON,
                 NOFD, 0);
if (buf == MAP_FAILED) { perror("mmap"); exit(1); }

/* Release */
munmap(buf, 64 * 1024);
```

### Device Memory (MMIO)

To access memory-mapped hardware registers, a resource manager must:
1. Call `ThreadCtl(_NTO_TCTL_IO, 0)` to enable device I/O access
2. Call `mmap_device_memory()` or `mmap_device_io()` with the physical address

```c
#include <sys/mman.h>
#include <hw/inout.h>

/* Grant I/O privilege */
ThreadCtl(_NTO_TCTL_IO, 0);

/* Map 4 KB of device registers at physical 0xFE200000 (e.g., GPIO base) */
volatile uint32_t *gpio = mmap_device_memory(
    NULL, 4096,
    PROT_READ | PROT_WRITE | PROT_NOCACHE,
    0,
    0xFE200000ULL);

if (gpio == MAP_FAILED) { perror("mmap_device_memory"); exit(1); }

/* Access registers */
gpio[0x1C / 4] = 0x00000001;  // Set GPIO 0 high

munmap_device_memory((void *)gpio, 4096);
```

### POSIX Shared Memory

```c
/* Create a named shared memory region */
int fd = shm_open("/radar_data", O_RDWR | O_CREAT, 0660);
ftruncate(fd, sizeof(RadarFrame));

RadarFrame *frame = mmap(NULL, sizeof(RadarFrame),
                         PROT_READ | PROT_WRITE,
                         MAP_SHARED, fd, 0);
close(fd);  // fd can be closed after mmap; mapping persists

/* Fill data */
frame->timestamp = clock_now();
memcpy(frame->objects, detected, n * sizeof(Object));

/* Other process attaches to the same name */
int fd2 = shm_open("/radar_data", O_RDONLY, 0);
RadarFrame *frame2 = mmap(NULL, sizeof(RadarFrame),
                          PROT_READ, MAP_SHARED, fd2, 0);
/* read frame2 */
munmap(frame2, sizeof(RadarFrame));
shm_unlink("/radar_data");  /* clean up */
```

---

## Physical Address Resolution

```c
#include <sys/mman.h>

/* Get the physical address corresponding to a virtual address */
off64_t paddr;
size_t  contig;

/* mem_offset64: query PA of virtual address */
mem_offset64(vaddr, NOFD, bytes, &paddr, &contig);
/* paddr = physical base address
   contig = number of physically contiguous bytes from paddr */

printf("Virtual %p → Physical 0x%llx (%zu contiguous bytes)\n",
       vaddr, (unsigned long long)paddr, contig);
```

---

## Memory Locking (mlockall)

For hard real-time applications, memory must be **locked** to prevent page faults during time-critical sections:

```c
#include <sys/mman.h>

/* Lock all current and future pages of this process */
if (mlockall(MCL_CURRENT | MCL_FUTURE) == -1) {
    perror("mlockall");
    exit(1);
}

/* Optionally pre-fault the stack to avoid stack-grow faults */
char stack_probe[64 * 1024];
memset(stack_probe, 0, sizeof(stack_probe));  // force page allocation
```

`MCL_CURRENT` — locks all currently mapped pages
`MCL_FUTURE` — locks all future `mmap` calls immediately on allocation

---

## Memory Introspection

### procnto Memory Map

```bash
# Show virtual memory map of a process
cat /proc/12345/maps

# Example output:
# 00010000-00020000 r-xp 00000000 00:00 0  [text]
# 00030000-00031000 rw-p 00000000 00:00 0  [data]
# ...

# Physical memory layout
cat /proc/dumper/regions

# Show memory usage (RSS, virtual size) per process
pidin mem

# Detailed slab/pool allocator stats
showmem
```

### showmem

```bash
$ showmem
System RAM: 2048 MB
  Used:  320 MB (kernel + processes + disk cache)
  Free:  1728 MB

Process   PID     VSZ     RSS
procnto     1    4.1M    3.8M
slogger2  4097    2.1M    1.4M
io-pkt    4098   12.3M    8.9M
devb-sata 4099    6.2M    4.1M
myapp    65537   32.1M   18.4M
```

---

## Typed Memory Regions

QNX allows naming specific physical memory regions:

```
# In the build script (IFS), or startup configuration:
# Define a named typed memory region for DMA-safe memory
[+keep] [virtual=0x80000000,phys=0x40000000,size=0x01000000] = "dma_pool"
```

```c
/* User application opens named region */
int fd = posix_typed_mem_open("/memory/dma_pool", O_RDWR, 
                               POSIX_TYPED_MEM_ALLOCATE_CONTIG);
struct posix_typed_mem_info info;
posix_typed_mem_get_info(fd, &info);
printf("DMA pool: %zu bytes available\n", info.posix_tmi_length);

void *dma_buf = mmap(NULL, 4096 * 16,
                     PROT_READ | PROT_WRITE | PROT_NOCACHE,
                     MAP_SHARED, fd, 0);
```

---

## Memory Protection and Guard Pages

QNX uses the MMU to enforce memory protection. Each thread stack has a **guard page** (unmapped page below the stack) to detect stack overflow:

```c
pthread_attr_t attr;
pthread_attr_init(&attr);

/* Set specific stack size */
pthread_attr_setstacksize(&attr, 128 * 1024);  /* 128 KB */

/* Set guard page size (default is one page = 4 KB) */
pthread_attr_setguardsize(&attr, 4096);

pthread_create(&tid, &attr, thread_func, NULL);
pthread_attr_destroy(&attr);
```

If a stack overflow occurs, the guard page causes a SIGSEGV in the offending thread (not the whole system).

---

## malloc and the C Heap

QNX's `malloc()` family uses an internal arena allocator built on top of `mmap()`:

```c
/* Standard malloc/free — thread-safe */
void *p = malloc(1024);
void *p2 = calloc(64, sizeof(uint32_t));
void *p3 = realloc(p, 2048);
free(p3);
free(p2);

/* Aligned allocation */
void *aligned;
posix_memalign(&aligned, 4096, 64 * 1024);  /* 4 KB aligned, 64 KB size */
free(aligned);
```

**Performance tuning**:
```bash
# Set malloc options via environment variable
export MALLOC_OPTIONS=V          # verbose (print allocation errors)
export MALLOC_OPTIONS=X          # terminate on error (good for debugging)
export MALLOC_OPTIONS=G 16        # threshold for mmap-backed allocations
```

---

## Cache Control

For DMA and device programming, cache coherency must be managed:

```c
#include <sys/cache.h>

/* Flush (write back + invalidate) dcache for a buffer before DMA write */
msync(buf, len, MS_SYNC | MS_INVALIDATE);

/* Or use the cache control API */
cache_flush(buf, len);      /* flush to memory (before device read) */
cache_inval(buf, len);      /* invalidate (before CPU read after DMA) */

/* For uncacheable memory, use PROT_NOCACHE in mmap */
void *mmio = mmap(NULL, size,
                  PROT_READ | PROT_WRITE | PROT_NOCACHE,
                  MAP_SHARED | MAP_PHYS, fd, phys_addr);
```

---

## Memory Partitioning (Kernel-Level)

QNX SDP 7.1+ supports **memory partitioning** at the kernel level, complementing APS CPU partitioning:

```bash
# Create a memory partition with reserved RAM
mpartition -c -S 64m safety_mem

# Bind a process to a memory partition
mpartition -a -n safety_mem $(pidof myapp)

# Processes in the partition draw from its reserved pool
# If the pool is exhausted, allocation fails rather than starving other partitions
```

This ensures a runaway process in one partition cannot exhaust RAM needed by a safety-critical partition.
