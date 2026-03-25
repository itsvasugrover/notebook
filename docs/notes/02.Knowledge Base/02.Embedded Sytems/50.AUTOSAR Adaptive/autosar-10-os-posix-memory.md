---
title: OS, POSIX & Memory Management
createTime: 2026/03/25 00:00:00
permalink: /kb/embedded/autosar/os-posix/
---

# OS, POSIX & Memory Management

## POSIX OS Requirements of AUTOSAR Adaptive

### Minimum POSIX Conformance

AUTOSAR Adaptive Platform requires a POSIX.1-2017 (IEEE Std 1003.1-2017) compliant operating system. The platform uses the following POSIX subsystems:

| POSIX Subsystem | Used By | Purpose |
|-----------------|---------|---------|
| Process Control | EM | `fork()`, `exec()`, `waitpid()`, `kill()` |
| POSIX Signals | EM | `SIGTERM` (graceful shutdown), `SIGKILL` (forced kill) |
| POSIX Threads | All AAs | `pthread_create()`, mutexes, condition variables |
| POSIX Scheduling | EM | `sched_setscheduler()`, `sched_setparam()` |
| POSIX IPC | CM (IPC binding) | Shared memory (`shm_open()`), semaphores (`sem_open()`) |
| POSIX Files | ara::per | `open()`, `read()`, `write()`, `mmap()` |
| POSIX Sockets | CM (SOME/IP) | `socket()`, `bind()`, `sendto()`, `recvfrom()` |
| POSIX Timers | PHM, CM | `timer_create()`, `clock_gettime()` |
| POSIX Capabilities | EM | `cap_set_proc()` — least privilege enforcement |

---

## Linux as AUTOSAR Adaptive OS

### Yocto-Based Build

Automotive Adaptive stacks on Linux typically use a Yocto Project build, since vendors (Vector, EB) provide Yocto layers:

```
Yocto Layer Stack for AUTOSAR Adaptive:

  meta-ivi / meta-openembedded      Base embedded Linux
  meta-virtualization               Hypervisor support (Xen, KVM)
  meta-automotive                   Automotive middleware, GENIVI
  meta-autosar-adaptive-platform    AUTOSAR Adaptive runtime (vendor-specific)
  meta-my-vehicle-bsp               Board Support Package for the SoC
  meta-my-apps                      The application layer (AAs, manifests)
```

Key `local.conf` settings for AUTOSAR Adaptive:

```bash
# Real-time kernel for PREEMPT_RT patch
PREFERRED_PROVIDER_virtual/kernel = "linux-yocto-rt"
LINUX_KERNEL_TYPE = "preempt-rt"

# Systemd as init system (integrates with EM)
DISTRO_FEATURES:append = " systemd"
VIRTUAL-RUNTIME_init_manager = "systemd"

# cgroup v2 for resource isolation
KERNEL_EXTRA_FEATURES:append = " cgroups/cgroup.scc"

# Security: SELinux
DISTRO_FEATURES:append = " selinux"
```

### systemd Integration

On Linux, Execution Management uses systemd as its bootstrap mechanism. The EM process itself is a systemd service:

```ini
# /lib/systemd/system/autosar-em.service
[Unit]
Description=AUTOSAR Adaptive Execution Management
After=network.target ara-com-daemon.service

[Service]
Type=forking
ExecStart=/usr/bin/ara-em --manifest-dir=/etc/autosar/manifests/
Restart=on-failure
RestartSec=1s
CapabilityBoundingSet=CAP_SYS_NICE CAP_SYS_RESOURCE CAP_SETUID CAP_SETGID

[Install]
WantedBy=multi-user.target
```

EM then manages all Adaptive Applications directly (not via systemd) using `fork()`/`exec()`.

### cgroups v2 for Resource Isolation

EM enforces the resource limits from the Execution Manifest using Linux cgroups v2:

```bash
# EM creates a cgroup for each Adaptive Application
# (Conceptual – EM does this programmatically)

# Create cgroup for RadarProcessingApp
mkdir /sys/fs/cgroup/ara/RadarProcessingApp/

# CPU bandwidth: 30% of CPU time (300ms per 1s period)
echo "300000 1000000" > /sys/fs/cgroup/ara/RadarProcessingApp/cpu.max

# Memory limit: 512 MB
echo "536870912" > /sys/fs/cgroup/ara/RadarProcessingApp/memory.max

# Move the process into the cgroup
echo <PID> > /sys/fs/cgroup/ara/RadarProcessingApp/cgroup.procs
```

### PREEMPT_RT Kernel Patch

For deterministic response times, Linux with the PREEMPT_RT patch is required for real-time Adaptive Applications:

```
Key PREEMPT_RT changes:

  Standard Linux          PREEMPT_RT Linux
  ─────────────────────────────────────────────────────────────────────
  Spinlocks non-preemptible    Spinlocks converted to sleepable mutexes
  Interrupt handlers run in    Interrupt handlers run in kernel threads
  non-preemptible context       (can be preempted by higher-prio tasks)
  High-resolution timers       Full hrtimer subsystem, nanosecond precision
  limited accuracy             
  
  Achievable latency (ARM Cortex-A55, 400 MHz):
  Unpatched Linux:   max latency ~200µs, avg ~30µs
  PREEMPT_RT Linux:  max latency ~50µs,  avg ~10µs
  QNX microkernel:   max latency ~10µs,  avg ~2µs
```

---

## QNX as AUTOSAR Adaptive OS

### Why QNX?

QNX 7.x (BlackBerry) holds a TÜV SÜD ASIL D certificate, making it the primary choice when Adaptive Applications require ASIL C/D qualification. QNX is used in:
- Mercedes-Benz MB.OS
- General Motors UltraCruise
- BMW iDrive systems

### QNX Microkernel Architecture

```
QNX Microkernel vs Linux Monolithic:

  Linux:
  ┌────────────────────────────────────────────────────────┐
  │                    Linux Kernel                        │
  │  Scheduler│MemMgr│FS │Drivers│Network│IPC │TCP/IP Stack│
  └────────────────────────────────────────────────────────┘
  Failure in any driver = potential kernel panic

  QNX Microkernel:
  ┌─────────────────────┐
  │   QNX Microkernel   │  (tiny: scheduler + IPC + memory + POSIX signals)
  └─────────────────────┘
  User Space:
  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐
  │FileSys │ │Driver  │ │Network │ │ Driver │ │ Input  │
  │Process │ │Manager │ │Manager │ │ (USB)  │ │Manager │
  └────────┘ └────────┘ └────────┘ └────────┘ └────────┘
  Failure in any manager = that process crashes; microkernel restarts it
  No kernel panic; microkernel itself cannot crash from userspace faults
```

### QNX IPC: Message Passing via Pulses

QNX IPC is fundamentally different from Linux. It uses **synchronous message passing**:

```c
// QNX server thread (blocks waiting for messages)
int chid = ChannelCreate(0);
struct sigevent event;
int rcvid;
MyMessage_t msg;

while (1) {
    rcvid = MsgReceive(chid, &msg, sizeof(msg), NULL);
    
    // Process message
    MyReply_t reply = ProcessMessage(msg);
    
    // Send reply (unblocks the client)
    MsgReply(rcvid, 0, &reply, sizeof(reply));
}

// QNX client (synchronous call — blocks until reply)
int coid = ConnectAttach(0, server_pid, server_chid, 0, 0);
MsgSend(coid, &request, sizeof(request), &reply, sizeof(reply));
// Returns when server calls MsgReply
```

AUTOSAR Adaptive Communication Management on QNX uses QNX IPC (message passing / pulses) as the IPC transport binding instead of Linux shared memory + futex.

### QNX Determinism Advantages

| Metric | Linux PREEMPT_RT | QNX 7.x |
|--------|-----------------|---------|
| Worst-case interrupt latency | ~50 µs | ~5 µs |
| Context switch time | ~3 µs | ~1 µs |
| Scheduling jitter | ~10 µs | ~2 µs |
| ASIL certification max | ASIL B (platform) | ASIL D |
| Required for ASIL D AA | No (needs hypervisor partition) | Yes (natively) |

---

## Process Memory Model in AUTOSAR Adaptive

```
Virtual Address Space of a Single Adaptive Application Process:

  Virtual Address  │ Content                      │ Protection
  ─────────────────┼──────────────────────────────┼───────────────────
  0xFFFFFFFF...    │ Kernel space (unmapped)       │ No access from user
  ...              │                               │
  0x7FFF0000       │ Stack (grows downward)        │ RW (ASLR randomized)
                   │ Stack guard page              │ No access (SIGSEGV)
  ...              │                               │
  0x7EFE0000       │ Shared libraries (.so)        │ RX (read + execute)
                   │ (libara_com.so, libstdc++.so) │
  ...              │                               │
  0x40000000       │ Anonymous mmap()              │ RW or RX depending
                   │ (dynamic allocations)         │
  ...              │
  0x00200000       │ Application heap (brk/sbrk)   │ RW
  ...              │                               │
  0x00100000       │ Application BSS/data          │ RW
  0x00001000       │ Application text (.text)      │ RX (read + execute)
                   │ Application rodata (.rodata)  │ RO
  0x00000000       │ NULL page (guard)             │ No access (SIGSEGV)
```

Key properties:
- **ASLR** (Address Space Layout Randomization) is enabled to prevent ROP/ret2libc attacks
- **NX bit** (No-Execute) is set on stack and heap — code cannot be injected via data overflow
- **Read-only .text** — modifying code at runtime is prevented
- **Guard pages** between stack and heap regions — stack overflow causes SIGSEGV, not heap corruption

---

## Scheduling Configuration in POSIX Context

### Scheduling Policies

```
SCHED_FIFO (Real-Time):
  - Priority range: 1 (lowest) to 99 (highest)
  - Once running, task runs until it voluntarily yields, blocks, or a higher-priority
    task becomes runnable
  - No time slice — no preemption by equal-priority tasks
  - Use: Safety-critical tasks (PHM watchdog, ara::phm supervised loop)
  - Requires: CAP_SYS_NICE capability or running as root

SCHED_RR (Round-Robin Real-Time):
  - Same as SCHED_FIFO but with a time slice (configurable via /proc)
  - Equal-priority tasks take turns
  - Use: Multiple equal-priority tasks that must each make progress

SCHED_OTHER / SCHED_NORMAL:
  - CFS (Completely Fair Scheduler) — Linux's default
  - Nice values: -20 (highest priority) to +19 (lowest)
  - Time-sharing; no determinism guarantee
  - Use: Non-RT tasks (logging, diagnostics, OTA background download)

SCHED_DEADLINE:
  - EDF (Earliest Deadline First) scheduling
  - Per-task: runtime, deadline, period parameters
  - Guarantees worst-case execution time budget
  - Use: Advanced RT applications needing EDF instead of FIFO
```

Execution Manifest maps to POSIX scheduling:

```
EM reads Execution Manifest             EM calls POSIX API
────────────────────────────────────────────────────────────
SCHEDULING-POLICY = SCHED_FIFO     →   sched_setscheduler(pid, SCHED_FIFO, {60})
SCHEDULING-PRIORITY = 60
CPU-AFFINITY = {2, 3}              →   sched_setaffinity(pid, {CPU2, CPU3})
```

### Priority Inversion Protection

For shared mutexes between tasks of different priorities (e.g., SCHED_FIFO task waits for SCHED_OTHER task to release a mutex), **priority inheritance** must be used:

```cpp
// Create mutex with priority inheritance
pthread_mutexattr_t attr;
pthread_mutexattr_init(&attr);
pthread_mutexattr_setprotocol(&attr, PTHREAD_PRIO_INHERIT);

pthread_mutex_t mutex;
pthread_mutex_init(&mutex, &attr);

// Now: if high-priority task blocks on this mutex, the OS temporarily
// elevates the priority of the low-priority task holding the mutex
// to the high-priority task's level → prevents priority inversion
```

---

## Memory Allocation Patterns for Safety

Automotive safety standards frown on unbounded dynamic memory allocation at runtime because:
- Memory fragmentation can cause `malloc()` to fail unpredictably
- Memory leaks are non-deterministic
- `new` / `malloc()` involve OS-level locks that can cause priority inversion

### Patterns Used in ASIL B Adaptive Applications

#### Pattern 1: Pre-allocate all memory at initialization

```cpp
class RadarProcessor {
public:
    RadarProcessor() {
        // Allocate all working buffers at startup
        radar_frame_buffer_.reserve(kMaxFrameSize);
        object_list_.reserve(kMaxObjects);
        filter_coefficients_.resize(kFilterSize);
    }
    
    void ProcessFrame() {
        // No allocation during runtime — use pre-allocated buffers
        radar_frame_buffer_.clear();  // clear() does NOT release memory
        ReadFrameInto(radar_frame_buffer_);
        ApplyFilter(radar_frame_buffer_, filter_coefficients_, object_list_);
    }
    
private:
    static constexpr size_t kMaxFrameSize = 4096;
    static constexpr size_t kMaxObjects = 64;
    static constexpr size_t kFilterSize = 128;
    
    std::vector<uint8_t> radar_frame_buffer_;
    std::vector<RadarObject> object_list_;
    std::vector<float> filter_coefficients_;
};
```

#### Pattern 2: Memory Pool Allocator for ara::com samples

```cpp
// ara::com uses internal pool allocators for event samples.
// The pool size is statically configured in the manifest:
// <MAX-SAMPLE-COUNT>10</MAX-SAMPLE-COUNT>
// This means at most 10 ObjectList samples are alive simultaneously.

// Application should return samples promptly:
radar_proxy_.DetectedObjects.GetNewSamples([](auto&& sample) {
    ProcessObject(*sample);
    // sample destroyed here → returned to pool
    // Never store SamplePtr<> in long-lived containers!
});
```

#### Pattern 3: Static Storage Duration for Configuration

```cpp
// Use static arrays for lookup tables, calibration data, configuration
class FilterConfig {
public:
    // Loaded once from ara::per at startup; never reallocated
    static const FilterCoefficients& GetInstance() {
        static FilterCoefficients instance = LoadFromPersistentStorage();
        return instance;
    }
};
```

---

## IPC Mechanisms in Adaptive Platform

### POSIX Shared Memory (Linux IPC binding)

Communication Management's IPC transport binding uses POSIX shared memory for intra-machine zero-copy communication:

```
Process A (Radar — Skeleton)          Process B (PathPlanner — Proxy)
────────────────────────────          ───────────────────────────────
shm_open("/ara_RadarService_Evt1_shm") ── shm_open (same name → same segment)
mmap(shm_fd, PROT_READ|PROT_WRITE)       mmap(shm_fd, PROT_READ)

write ObjectList to offset 0             read ObjectList from offset 0

sem_post(event_semaphore)            ──► sem_wait(event_semaphore) [unblocks]
                                         // Zero-copy: no data copied between processes
                                         // Physical memory pages are shared by both
                                         // virtual address spaces
```

Advantages:
- No data copy → latency ~ 2–5 µs for intra-machine events
- Zero serialization overhead when using shared-memory-compatible types (POD / trivially copyable)

Shared memory layout managed by CM is opaque to the application — the application only sees the standard `ara::com` API.

### Unix Domain Sockets (Method calls, IPC)

For request-response method calls on the same machine, CM may use POSIX Unix domain sockets:

```
Method call flow:
  Proxy.ResetFilter() → 
    write() to unix socket "/var/run/ara/radar_service_inst1.sock" →
    CM reads request → dispatches to Skeleton process →
    Skeleton invokes method handler →
    Skeleton resolves Promise →
    write() reply to socket →
    CM delivers to Proxy Future →
    Future.get() returns result
```

---

## Virtual Memory and Security Considerations

### mmap() for ara::per (Persistent Storage)

`ara::per::KeyValueStorage` uses `mmap()` to map persistent storage files into process address space:

```cpp
// Under the hood, ara::per maps a file into memory:
// int fd = open("/opt/radar/etc/config.db", O_RDWR);
// void* mapped = mmap(nullptr, file_size, PROT_READ|PROT_WRITE, MAP_SHARED, fd, 0);
// Data written through mapped pointer is flushed to disk by OS (msync())

// Application sees:
auto storage = ara::per::OpenKeyValueStorage("RadarConfig").Value();
auto threshold = storage.GetValue<float>("detection_threshold").Value();
storage.SetValue("detection_threshold", new_threshold);
storage.SyncToStorage();  // calls msync() internally
```

### ASLR for Adaptive Applications

ASLR (Address Space Layout Randomization) is enabled for all AUTOSAR Adaptive processes:
- Stack base randomized by ±128 KB
- Heap base randomized
- Shared library load addresses randomized

For ASIL applications, care must be taken with position-independent executables (PIE):
```cmake
# CMakeLists.txt for an ASIL AA
set_target_properties(radar_proc PROPERTIES
    POSITION_INDEPENDENT_CODE ON   # Generates PIE (required for ASLR)
)
target_compile_options(radar_proc PRIVATE
    -fstack-protector-strong       # Stack canary protection
    -D_FORTIFY_SOURCE=2            # Buffer overflow detection in libc functions
)
target_link_options(radar_proc PRIVATE
    -Wl,-z,relro                   # Read-only after relocation
    -Wl,-z,now                     # Resolve all symbols at load time (no lazy binding)
    -Wl,-z,noexecstack             # Mark stack as non-executable
)
```
