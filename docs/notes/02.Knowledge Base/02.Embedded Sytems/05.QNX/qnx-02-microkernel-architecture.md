---
title: QNX Microkernel Architecture
createTime: 2026/03/25 00:00:00
permalink: /kb/embedded/qnx/microkernel-architecture/
---

# QNX Neutrino Microkernel Architecture

## Microkernel Philosophy

The QNX Neutrino RTOS is built on a **pure microkernel** — the smallest possible kernel that provides the core abstractions required to build an operating system, leaving everything else as user-space servers.

### What Runs In Kernel Space?
Only the Neutrino microkernel binary (`procnto-smp-instr`) runs in kernel mode. It provides:

1. **Thread scheduling** — all scheduling decisions including priority, preemption, and time-slicing
2. **Synchronous IPC** — `MsgSend`, `MsgReceive`, `MsgReply` primitives
3. **Interrupt management** — `InterruptAttach`, interrupt dispatch, interrupt latency guarantees
4. **Timer management** — high-resolution timers via hardware timer abstraction
5. **Virtual memory management** — page table management, address space creation/destruction

**Nothing else** — no drivers, no filesystems, no network stack, no device I/O — runs in kernel mode.

### What Runs In User Space?
Every other OS service runs as a separate **privileged user-space process**:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        User Space (Ring 3 on x86)                           │
│                                                                             │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌────────────────────┐   │
│  │  devb-*    │  │  io-pkt    │  │  fs/qnx6   │  │  Your Application  │   │
│  │ (disk drv) │  │ (network)  │  │ (filesystem│  │  (any process)     │   │
│  └─────┬──────┘  └─────┬──────┘  └─────┬──────┘  └────────┬───────────┘   │
│        │               │               │                   │               │
│  ┌─────▼───────────────▼───────────────▼───────────────────▼───────┐       │
│  │                    IPC (MsgSend / MsgReceive)                    │       │
│  └─────────────────────────────┬───────────────────────────────────┘       │
└────────────────────────────────│────────────────────────────────────────────┘
                                 │
                        ─────────▼──────────
                        │   Neutrino        │
                        │   microkernel     │  Kernel Space (Ring 0)
                        │   (procnto)       │
                        ─────────────────────
                                 │
                        ─────────▼──────────
                        │    Hardware       │
                        │  (CPU, MMU, IRQ)  │
                        ─────────────────────
```

---

## Kernel Object Types

The Neutrino kernel manages a fixed set of primitive objects. All OS constructs are built from these.

### Threads and Processes
- **Thread**: The fundamental unit of execution. Each thread has a stack, register set, priority, and scheduling state.
- **Process**: A container of one or more threads sharing an address space. Also called a "team" internally. Every process has at least one thread (the main thread).
- A process has zero OS overhead on its own — threads within it are what get scheduled.

### Channels and Connections
The IPC backbone of QNX:

| Object | Description |
|--------|-------------|
| **Channel** | A receive endpoint. A server creates a channel and blocks on it. `ChannelCreate()` |
| **Connection** | A client-side handle attached to a channel. `ConnectAttach()` |
| **coid** (connection ID) | File descriptor-like integer returned by `ConnectAttach()` |
| **chid** (channel ID) | Integer returned by `ChannelCreate()` |

```
Server Process                     Client Process
┌──────────────────────┐           ┌──────────────────┐
│ chid = ChannelCreate()│           │ coid = ConnectAttach(│
│                      │◄──────────│     server_pid,  │
│ MsgReceive(chid,...) │           │     chid)        │
│   (blocks until msg) │           │                  │
│                      │           │ MsgSend(coid,    │
│   process request    │           │   snd_buf,       │
│                      │           │   rcv_buf)       │
│ MsgReply(rcvid, ...)  │──────────►│   (blocks until) │
└──────────────────────┘           │   MsgReply)      │
                                   └──────────────────┘
```

### Pulses
- A pulse is a **small, non-blocking** message (5 bytes: 1-byte code + 4-byte value).
- Used for signals, timer expiry notifications, interrupt completion.
- Sent with `MsgSendPulse()` — never blocks the sender.
- A server receives them via `MsgReceive()` just like regular messages, distinguished by `rcvid == 0`.

### Interrupts
- Hardware interrupts are serviced at kernel level (interrupt vector table → kernel dispatcher).
- A user-space driver claims an interrupt with `InterruptAttach()` or `InterruptAttachEvent()`.
- When the interrupt fires, the kernel calls the driver's **interrupt service routine (ISR)** in kernel context (fast, minimal work), then optionally sends a **pulse** to wake the driver's thread.

```c
// Interrupt-driven driver pattern
static const struct sigevent *isr_handler(void *area, int id) {
    // Minimal ISR: read status register, clear interrupt, return pulse
    volatile HW_Regs *hw = (volatile HW_Regs *)area;
    hw->status_clear = 1;
    return &uart_event;  // pulse delivered to thread
}

// In driver init:
InterruptAttach(UART_IRQ, isr_handler, hw_regs, sizeof(*hw_regs),
                _NTO_INTR_FLAGS_TRK_MSK);
```

---

## Memory Model

### Virtual Address Space Layout

Each QNX process has its own **64-bit virtual address space** (on AArch64 or x86_64):

```
Virtual Address Space (64-bit AArch64)
0x0000_0000_0000_0000  ┌──────────────────────┐
                       │   NULL guard (unmapped)│
0x0000_0000_0001_0000  ├──────────────────────┤
                       │   Program text (.text)│
                       │   Program data (.data)│
                       │   Program BSS (.bss)  │
                       ├──────────────────────┤
                       │   Dynamic libraries   │
                       │   (mapped by ldqnx)   │
                       ├──────────────────────┤
                       │   Thread stacks       │
                       │   (each thread stack) │
                       ├──────────────────────┤
                       │   Anonymous mmap      │
                       │   (malloc heap)       │
                       ├──────────────────────┤
                       │   Named shared memory │
                       │   (POSIX shm_open)    │
                       ├──────────────────────┤
                       │   Typed memory objects│
                       │   (device MMIO ranges)│
0xFFFF_FFFF_FFFF_FFFF  └──────────────────────┘
```

### Process Manager (procnto) Role
The kernel binary `procnto-smp-instr` serves **dual roles**:

1. **Microkernel**: In-kernel primitives (IPC, scheduling, MMU, interrupts)
2. **Process Manager**: A user-space server co-located in the same binary that handles:
   - `fork()`, `exec()`, `spawn()`, `exit()`
   - `/proc` filesystem
   - Memory object management
   - Privilege management

---

## Kernel Internals: Blocking States

Every thread in QNX has one of these states (visible in `pidin` output):

| State | Description |
|-------|-------------|
| `READY` | Eligible to run; on the run queue |
| `RUNNING` | Currently executing on a CPU |
| `SEND` | Blocked in `MsgSend()` — waiting for server to receive |
| `REPLY` | Blocked in `MsgSend()` — server received, waiting for `MsgReply()` |
| `RECEIVE` | Blocked in `MsgReceive()` — waiting for a client message |
| `WAITTHREAD` | Waiting for a thread join (`pthread_join()`) |
| `WAITPAGE` | Waiting for a page fault to be resolved |
| `SIGSUSPEND` | Waiting in `sigsuspend()` |
| `SIGWAITINFO` | Waiting in `sigwaitinfo()` |
| `NANOSLEEP` | Sleeping via `nanosleep()` |
| `MUTEX` | Blocked on a mutex lock |
| `CONDVAR` | Blocked on a condition variable |
| `JOIN` | Waiting for thread join |
| `INTR` | Waiting for an interrupt |
| `SEM` | Blocked waiting on a semaphore |
| `STACK` | Thread is creating its stack |
| `DEAD` | Thread has exited; not yet reaped |

The kernel transitions threads among these states atomically. **A thread in `SEND` or `REPLY` state yields its priority to the server** — this is the **priority inheritance** mechanism used for bounded priority inversion.

---

## System Calls: The Kernel Interface

QNX applications make system calls via a **kernel call table** (essentially a software interrupt or `SVC` on ARM, `syscall` on x86). The complete kernel call API is in `<sys/neutrino.h>`.

### Core System Calls

```c
// IPC
int         MsgSend(int coid, const void *smsg, int sbytes,
                    void *rmsg, int rbytes);
int         MsgReceive(int chid, void *msg, int bytes,
                       struct _msg_info *info);
int         MsgReply(int rcvid, int status, const void *smsg, int sbytes);
int         MsgSendPulse(int coid, int priority, int code, int value);
int         MsgDeliverEvent(int rcvid, const struct sigevent *event);

// Channel / Connection
int         ChannelCreate(unsigned flags);
int         ChannelDestroy(int chid);
int         ConnectAttach(uint32_t nd, pid_t pid, int chid,
                          unsigned index, int flags);
int         ConnectDetach(int coid);

// Scheduling
int         SchedSet(int id, int *policy, struct sched_param *param);
int         SchedGet(int id, int *policy, struct sched_param *param);
uint64_t    ClockCycles(void);   // read hardware cycle counter

// Threads
int         ThreadCreate(pid_t pid, void *(*func)(void*), void *arg,
                         const struct _thread_attr *attr);
int         ThreadDestroy(int tid, int priority, void *status);

// Interrupts
int         InterruptAttach(int intr, const struct sigevent *event,
                            const void *area, int size, unsigned flags);
int         InterruptDetach(int id);
int         InterruptWait(int flags, const uint64_t *timeout);

// Timers
int         TimerCreate(clockid_t id, const struct sigevent *notify);
int         TimerSettime(timer_t id, int flags,
                         const struct itimerspec *value,
                         struct itimerspec *ovalue);
```

---

## Message Passing: The Universal Abstraction

In QNX, **everything is message passing**. File I/O, device I/O, inter-process communication — all are implemented as synchronous `MsgSend()/MsgReceive()/MsgReply()` calls.

When a process opens `/dev/ser1` (a UART), the C library:
1. `ConnectAttach()` to the serial driver process
2. Every `write()` → `MsgSend()` to the driver
3. The driver processes the message and `MsgReply()`s with the result
4. `read()` returns to the application

This means the OS API is **completely transparent** — the same POSIX API works whether the server is local, on a remote node (QNET), or behind a hardware abstraction layer.

---

## Kernel Variants

QNX ships multiple kernel binaries optimized for different use cases:

| Binary | Description |
|--------|-------------|
| `procnto-smp` | Production kernel for SMP systems (no instrumentation) |
| `procnto-smp-instr` | Instrumented kernel — enables System Profiler and kernel event tracing |
| `procnto` | Uniprocessor kernel (legacy; SDP 8.0 focuses on SMP) |
| `procnto-smp-v7` | ARMv7 32-bit kernel |
| `procnto64-smp` | AArch64 64-bit kernel (primary for SDP 8.0) |

In production, `procnto-smp` is used. During development, `procnto-smp-instr` is preferred for tracing.

---

## Boot Sequence at the Kernel Level

```
Power-On Reset
      │
      ▼
IPL / ROM bootstrap
      │ (loads IFS image from flash/eMMC into RAM)
      ▼
startup-*                 ← Board-specific C startup code (sets up DRAM, clocks)
      │ (sets up syspage, initializes MMU, jumps to kernel)
      ▼
procnto-smp-instr         ← Kernel starts; initializes scheduler, IPC subsystem
      │ (creates initial thread — the "idle" thread)
      │ (starts process manager thread)
      ▼
/proc/boot/* processes     ← Scripts in IFS buildfile run:
      │                       procnto starts each initial process
      ▼
/proc/boot/slogger2        ← System logger
/proc/boot/pipe            ← POSIX pipe server
/proc/boot/devc-*          ← Serial/console driver
/proc/boot/devb-*          ← Block device driver (eMMC, SPI flash, etc.)
/proc/boot/io-pkt-v6-hc    ← Network stack
/proc/boot/mountqnx6r.so   ← QNX6 filesystem
      │
      ▼
/etc/rc.d/* or tinit        ← System init scripts
      │
      ▼
Application processes       ← Your software
```

---

## Comparing Kernel Size

The Neutrino kernel is extremely compact:

| Metric | Value |
|--------|-------|
| Kernel binary size (`procnto-smp`) | ~300–500 KB |
| Kernel RAM footprint (minimal system) | ~2–4 MB total (kernel + essential servers) |
| Minimum IFS image (console + shell) | ~1.5 MB |
| Interrupt latency (ARM Cortex-A53, 1 GHz) | ~2–5 µs (worst case with instrumentation) |
| Context switch time | ~1–3 µs |
| Number of kernel objects (threads, etc.) | Limited only by available RAM |

---

## Key Architectural Advantages

1. **Fault containment**: A driver crash kills only that driver process; the kernel, other drivers, and applications continue running. The dead driver can be restarted by a watchdog (using `SIGCHLD` and `respawn` in the build script).

2. **Hot-patching / live update**: A new version of a server can be started while the old one is still running; connections are migrated. This enables firmware updates without downtime.

3. **Hardware access control**: Only processes that have been granted access via `ThreadCtl(_NTO_TCTL_IO,0)` can perform I/O port operations or `mmap_device_memory()`. This prevents rogue applications from accessing hardware directly.

4. **Adaptive partitioning**: The `APS` (Adaptive Partitioning Scheduler) can guarantee minimum CPU budgets to partitions even under overload — critical for mixed-criticality systems.

5. **Transparent networking**: QNET (the QNX network filesystem protocol) makes remote process connections look identical to local ones — `ConnectAttach(remote_nd, pid, chid...)` works transparently.
