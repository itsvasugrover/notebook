---
title: QNX Scheduling & Adaptive Partitioning
createTime: 2026/03/25 00:00:00
permalink: /kb/embedded/qnx/scheduling-aps/
---

# QNX Scheduling & Adaptive Partitioning

## Overview

QNX Neutrino uses a **priority-based preemptive scheduler** with 256 priority levels (0–255). The scheduler is **fully preemptible** — a higher-priority thread always preempts a lower-priority thread immediately (within interrupt latency). Multiple scheduling policies can be mixed freely between threads.

---

## Scheduling Policies

### SCHED_FIFO (First In, First Out)

- A FIFO thread runs to completion until it **voluntarily yields or blocks**
- Never preempted by threads at the same priority
- Preempted by any higher-priority ready thread
- **Best for**: Time-critical tasks that must not be interrupted at their priority level

```c
struct sched_param sp = { .sched_priority = 50 };
pthread_setschedparam(tid, SCHED_FIFO, &sp);
```

```
Priority 50 (FIFO): [Thread A ────────────────────────────────── done]
Priority 50 (FIFO):                                               [Thread B ──────]
```

### SCHED_RR (Round Robin)

- Threads at the same priority share CPU time in **time slices** (quantum)
- Default quantum: 4 × tick period (~4 ms on a 250 Hz timer, configurable)
- When a thread's quantum expires, it is moved to the back of its priority queue
- **Best for**: Multiple equal-priority threads that should share CPU fairly

```c
struct sched_param sp = { .sched_priority = 20 };
pthread_setschedparam(tid, SCHED_RR, &sp);

// Query current quantum
struct timespec ts;
sched_rr_get_interval(pid, &ts);  // fills ts with quantum duration
```

### SCHED_SPORADIC

Sporadic (also called **server scheduling** in real-time literature) provides bounded execution with replenishment. A sporadic thread has:

- **`sched_ss_low_priority`**: The background priority (runs at this when budget exhausted)
- **`sched_priority`**: The high priority (runs at this when budget available)
- **`sched_ss_init_budget`**: Initial execution budget (nanoseconds)
- **`sched_ss_repl_period`**: Replenishment period (nanoseconds) — budget refills each period
- **`sched_ss_max_repl`**: Maximum pending replenishments

```c
#include <sched.h>

struct sched_param sp;
memset(&sp, 0, sizeof(sp));
sp.sched_priority     = 40;                          // High priority when budget > 0
sp.sched_ss_low_priority = 10;                       // Low priority when budget = 0
sp.sched_ss_repl_period.tv_sec  = 0;
sp.sched_ss_repl_period.tv_nsec = 100000000;         // 100 ms period
sp.sched_ss_init_budget.tv_sec  = 0;
sp.sched_ss_init_budget.tv_nsec = 20000000;          // 20 ms budget per period
sp.sched_ss_max_repl = 4;                            // Max pending replenishements

pthread_setschedparam(tid, SCHED_SPORADIC, &sp);
```

This gives the thread **20 ms out of every 100 ms** at priority 40, with any remaining time running at priority 10. Perfect for bursty, real-time tasks that should not monopolize the CPU.

### SCHED_OTHER

- Standard POSIX "fair" scheduling policy
- In QNX Neutrino, `SCHED_OTHER` threads behave identically to `SCHED_RR` at their assigned priority
- **Best for**: Background tasks initiated without explicit real-time requirements

---

## Priority Queues and the Run Queue

The scheduler maintains a **per-CPU run queue** organized as a bitmap of occupied priorities with a linked list of threads at each priority:

```
Priority 255: [ ]
Priority 200: [ Driver ISR thread ]
Priority  50: [ Network thread ] → [ Audio thread ]
Priority  20: [ App thread A ] → [ App thread B ] → [ App thread C ]
Priority  10: [ Logger thread ]
Priority   0: [ Idle thread ]
```

At each scheduling decision the kernel:
1. Finds the highest occupied priority bit (O(1) via `fls()` on the bitmap)
2. Takes the first thread from that priority's queue
3. Puts it on the executing CPU
4. Handles round-robin quantum expiry by moving the thread to the tail of its queue

---

## Timer Resolution and Tick Rate

QNX's timer subsystem is **tick-based with sub-tick precision**:

```c
// Configure the clock resolution (minimum tick period)
// Default: 1 ms (1,000,000 ns) — can go to HW timer resolution (~100 µs)
struct _clockperiod clkper = {
    .nsec = 500000,   // 500 µs tick
    .fract = 0,
};
ClockPeriod(CLOCK_REALTIME, &clkper, NULL, 0);

// High-resolution timing uses ClockCycles() — reads hardware cycle counter
uint64_t start = ClockCycles();
// ... work ...
uint64_t elapsed_cycles = ClockCycles() - start;

// Convert to nanoseconds
struct _clockcycles info;
ClockCycles_info(&info);  // fills info.nsec_tod_adjust, etc.
uint64_t elapsed_ns = elapsed_cycles * 1000000000ULL / SYSPAGE_ENTRY(qtime)->cycles_per_sec;
```

---

## POSIX Real-Time Clocks

```c
// Available clocks
CLOCK_REALTIME     // Wall-clock time; jumps on NTP/settimeofday
CLOCK_MONOTONIC    // Monotonic; never jumps backward (preferred for timeouts)
CLOCK_PROCESS_CPUTIME_ID  // CPU time consumed by the process
CLOCK_THREAD_CPUTIME_ID   // CPU time consumed by the current thread

// Examples
struct timespec ts;
clock_gettime(CLOCK_MONOTONIC, &ts);

// Absolute sleep until a specific time
struct timespec deadline = { .tv_sec = ts.tv_sec + 1, .tv_nsec = ts.tv_nsec };
clock_nanosleep(CLOCK_MONOTONIC, TIMER_ABSTIME, &deadline, NULL);

// Relative sleep
struct timespec rel = { .tv_sec = 0, .tv_nsec = 5000000 };  // 5 ms
clock_nanosleep(CLOCK_MONOTONIC, 0, &rel, NULL);
```

---

## Adaptive Partitioning Scheduler (APS)

**APS** is QNX's mixed-criticality CPU allocation mechanism. It divides the CPU into named **partitions**, each with a **guaranteed minimum budget** expressed as a percentage of CPU time.

### Why APS?

In a standard priority-based scheduler, a runaway high-priority task can starve lower-priority work. APS prevents this by:
- Guaranteeing that each partition receives **at least its configured percentage** even when overloaded
- Allowing partitions to **borrow unused budget** from less-loaded partitions dynamically

### APS Concepts

| Concept | Description |
|---------|-------------|
| **Partition** | A named CPU budget (e.g., "Safety", "App", "HMI") |
| **Budget** | Guaranteed minimum CPU percentage (0–100) |
| **Critical budget** | Per-partition time that cannot be borrowed by others |
| **Window size** | Averaging window over which budget is enforced (default 100 ms) |
| **Borrowing** | Partitions can use idle budget from other partitions |

### Configuring APS

APS is configured either at system startup (via a `sched_aps*` API), or via the `aps` command:

```bash
# Create partitions (total should not exceed 100%)
aps create -b 40 safety    # "safety" gets 40% guaranteed
aps create -b 30 hmi       # "hmi" gets 30%
aps create -b 20 app       # "app" gets 20%
# Remaining 10% goes to the "System" partition (always exists)

# Modify budget
aps modify -b 50 safety

# Show partition info
aps show

# List threads per partition
aps show -t
```

### Joining Threads to Partitions

```c
#include <sys/sched_aps.h>

// Join the current thread (and all future children) to a partition
int partition_id = sched_aps_lookup("safety");
sched_aps_join_partition(partition_id, 0);

// Create a thread in a specific partition
pthread_attr_t attr;
pthread_attr_init(&attr);
// Set partition via APS extension
sched_aps_partition_info_t aps_info;
aps_info.id = partition_id;
pthread_attr_setaps(&attr, &aps_info);
pthread_create(&tid, &attr, thread_func, arg);
```

### APS Example: Automotive System

```
System Partitions:
┌────────────────────────────────────────────────────────────┐
│  Safety (40%)    │  HMI (30%)    │  App (20%)  │  Sys(10%) │
│  ───────────     │  ──────────   │  ─────────  │  ──────── │
│  ADAS sensor     │  Instrument   │  Navigation │  Logger   │
│  fusion          │  cluster      │  Audio      │  Network  │
│  Health monitor  │  Touch input  │  Infotainment│  init    │
└────────────────────────────────────────────────────────────┘

Under normal load:
  Safety uses 25% → remaining 15% borrowed by HMI

Under Safety overload:
  Safety gets its full 40% guaranteed (never starved)
  HMI gets its 30% guaranteed
  App is constrained to 20%

Critical budget: Safety has 10% "critical" that cannot be borrowed
  even when all others are idle. Guarantees worst-case latency.
```

---

## Real-Time Timers

### One-Shot Timer

```c
timer_t   timerid;
struct sigevent   event;
struct itimerspec spec;

// Deliver pulse when timer fires
SIGEV_PULSE_INIT(&event, coid, priority, MY_TIMER_CODE, 0);
timer_create(CLOCK_MONOTONIC, &event, &timerid);

// Fire once after 100 ms
spec.it_value.tv_sec     = 0;
spec.it_value.tv_nsec    = 100000000;
spec.it_interval.tv_sec  = 0;
spec.it_interval.tv_nsec = 0;         // it_interval=0 → one-shot
timer_settime(timerid, 0, &spec, NULL);
```

### Periodic Timer

```c
// Fire every 10 ms (periodic)
spec.it_value.tv_sec     = 0;
spec.it_value.tv_nsec    = 10000000;
spec.it_interval.tv_sec  = 0;
spec.it_interval.tv_nsec = 10000000;  // repeat interval
timer_settime(timerid, 0, &spec, NULL);
```

### Absolute Deadline Timer (TIMER_ABSTIME)

```c
struct timespec now;
clock_gettime(CLOCK_MONOTONIC, &now);

// Fire at an absolute deadline 50 ms from now
spec.it_value.tv_sec  = now.tv_sec;
spec.it_value.tv_nsec = now.tv_nsec + 50000000;
spec.it_interval.tv_sec  = 0;
spec.it_interval.tv_nsec = 0;
timer_settime(timerid, TIMER_ABSTIME, &spec, NULL);
```

---

## Priority Ceiling Protocol

For local mutex-based critical sections where priority inversion must be bounded:

```c
pthread_mutex_t mu;
pthread_mutexattr_t attr;

pthread_mutexattr_init(&attr);
pthread_mutexattr_setprotocol(&attr, PTHREAD_PRIO_PROTECT);
pthread_mutexattr_setprioceiling(&attr, 80);  // Ceiling = 80

pthread_mutex_init(&mu, &attr);
pthread_mutexattr_destroy(&attr);

// Any thread locking this mutex immediately rises to priority 80
pthread_mutex_lock(&mu);
// ... critical section runs at priority 80 ...
pthread_mutex_unlock(&mu);
// priority returns to thread's normal priority
```

---

## Scheduling Utilities

```bash
# Show scheduler info for all threads
pidin sched

# Change process priority (kill -sched or nice)
nice -n -10 /usr/bin/myapp          # nice value (-20 to 19)

# QNX slay: signal a process
slay -s SIGTERM myapp
slay -p 50 -SIGSTOP 4097            # lower priority and stop

# on: run a program with specific scheduling
on -p 40 -s fifo /usr/bin/myapp     # priority 40, FIFO policy

# schedctl: change scheduling of running process
schedctl -p 40 -f 4097              # set PID 4097 to FIFO prio 40
```

---

## Summary: Choosing a Scheduling Policy

| Scenario | Recommended Policy |
|----------|-------------------|
| Hard real-time control loop (motor control, safety monitor) | `SCHED_FIFO` high priority |
| Multiple equal-priority tasks sharing a CPU | `SCHED_RR` |
| Bursty task needing bounded CPU (sensor reader, codec) | `SCHED_SPORADIC` |
| Background/batch work | `SCHED_RR` low priority |
| Mixed-criticality system (ADAS + HMI + App) | APS partitions + `SCHED_FIFO` within Safety partition |
| Worst-case execution bounded by partition | APS + Critical budget |
