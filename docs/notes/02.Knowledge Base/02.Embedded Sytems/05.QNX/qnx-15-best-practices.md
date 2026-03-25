---
title: QNX Best Practices
createTime: 2026/03/25 00:00:00
permalink: /kb/embedded/qnx/best-practices/
---

# QNX Best Practices

## Real-Time Design Principles

### 1. Establish a Priority Schema Early

Define and document your priority allocation before writing a single line of code:

```
Priority  Range   Usage
──────────────────────────────────────────────────────
254        1      Emergency safety shutdown (e-stop)
200–253    N      Hard real-time safety (brake, steer)
100–199    N      Hard real-time control loops
 50–99     N      Soft real-time: I/O, sensor fusion
 30–49     N      Device drivers (NIC, serial, CAN)
 20–29     N      Application logic (state machines)
 10–19     N      Background processing
  2–9      N      Logging, statistics, monitoring
  1        1      Idle thread (procnto)
```

**Golden rule**: A high-priority thread must never block waiting for a low-priority thread's data without priority inheritance (use QNX mutexes, which inherit automatically).

### 2. Lock Memory at Startup

Every real-time process must lock all its memory immediately on startup to prevent page faults during execution:

```c
#include <sys/mman.h>

int main(void) {
    /* Lock all current and future pages */
    if (mlockall(MCL_CURRENT | MCL_FUTURE) == -1) {
        slog2f(g_buf, 0, SLOG2_ERROR, "mlockall: %s", strerror(errno));
        return EXIT_FAILURE;
    }

    /* Pre-fault the maximum stack depth */
    volatile char stack_probe[65536];
    memset((void *)stack_probe, 0, sizeof(stack_probe));

    /* Pre-allocate all buffers now (before RT work begins) */
    void *rt_buf = malloc(RT_BUFFER_SIZE);
    memset(rt_buf, 0, RT_BUFFER_SIZE);  /* ensure pages are faulted in */

    return realtime_main();
}
```

### 3. No Dynamic Allocation in the RT Path

```c
/* BAD: malloc in a real-time loop */
void rt_loop(void) {
    while (1) {
        char *buf = malloc(1024);   /* latency spike! */
        process(buf);
        free(buf);
    }
}

/* GOOD: pre-allocated pool */
#define POOL_SIZE 32
static msg_t msg_pool[POOL_SIZE];
static int   pool_head = 0;

static msg_t *pool_alloc(void) {
    int idx = pool_head++ % POOL_SIZE;  /* simple ring, no malloc */
    return &msg_pool[idx];
}

void rt_loop(void) {
    while (1) {
        msg_t *msg = pool_alloc();  /* O(1), no heap */
        process(msg);
    }
}
```

### 4. Avoid Priority Inversion

QNX mutexes use **priority inheritance** by default. Still, avoid patterns that cause inversion:

```c
/* BAD: spinlock busy-wait at lower priority */
while (atomic_flag_test_and_set(&lock)) { /* burns CPU */ }

/* GOOD: QNX mutex (inherits priority automatically) */
pthread_mutex_lock(&mutex);    /* blocks cleanly, donates priority */
/* ... critical section ... */
pthread_mutex_unlock(&mutex);
```

**Ceiling protocol** for known priority ceilings:

```c
pthread_mutexattr_t attr;
pthread_mutexattr_init(&attr);
pthread_mutexattr_setprotocol(&attr, PTHREAD_PRIO_PROTECT);
pthread_mutexattr_setprioceiling(&attr, 200);  /* known maximum user priority */
pthread_mutex_init(&g_mutex, &attr);
```

---

## IPC Design Patterns

### 5. Use Pulses for Asynchronous Notification

Do not use `MsgSend` when you only need to notify (no reply needed):

```c
/* BAD: sender blocks until receiver processes message */
MsgSend(coid, &event, sizeof(event), NULL, 0);

/* GOOD: fire-and-forget pulse (sender never blocks) */
MsgSendPulse(coid, SIGEV_PULSE_PRIO_INHERIT, PULSE_CODE_EVENT, 0);
```

### 6. Bounded Message Sizes

Keep messages small (under one page, ideally under a cache line):

```c
/* BAD: huge message causes kernel to copy large buffer */
char big_buf[1024 * 1024];
MsgSend(coid, big_buf, sizeof(big_buf), NULL, 0);

/* GOOD: send small header with pointer to shared memory */
typedef struct {
    uint32_t        type;
    uint32_t        length;
    shm_offset_t    data_offset;  /* offset into shared mem */
} msg_header_t;

MsgSend(coid, &header, sizeof(header), &reply, sizeof(reply));
/* receiver reads actual data from shared memory directly */
```

### 7. Disconnect Handling

Always handle the disconnect pulse (`_PULSE_CODE_DISCONNECT`) when using `name_attach`:

```c
for (;;) {
    struct _pulse pulse;
    int rcvid = MsgReceive(chid, &pulse, sizeof(pulse), NULL);

    if (rcvid == 0) {
        /* It's a pulse */
        if (pulse.code == _PULSE_CODE_DISCONNECT) {
            ConnectDetach(pulse.scoid);  /* clean up connection */
            continue;
        }
        handle_pulse(&pulse);
        continue;
    }
    if (rcvid == -1) {
        if (errno == EINTR) continue;
        break;
    }
    handle_message(rcvid);
}
```

---

## Error Handling

### 8. Always Check errno

```c
int fd = open("/dev/mydevice", O_RDWR);
if (fd == -1) {
    slog2f(g_buf, 0, SLOG2_ERROR,
           "open /dev/mydevice failed: %s (errno=%d)",
           strerror(errno), errno);
    return EXIT_FAILURE;
}
```

### 9. Use slogger2, Not printf

`printf` requires a connected console and adds latency. `slogger2` is asynchronous and persists:

```c
/* Register once at startup */
slog2_register(&config, buffers, 0);

/* Use everywhere instead of printf */
slog2f(buffers[LOG_GENERAL], 0, SLOG2_INFO, "Initialized: version=%s", VERSION);
slog2f(buffers[LOG_ERRORS],  0, SLOG2_ERROR, "Sensor %d timeout: %s",
       sensor_id, strerror(errno));
```

### 10. Structured Error Codes

Define application-specific error codes and map them to log messages:

```c
typedef enum {
    ERR_NONE          = 0,
    ERR_SENSOR_TIMEOUT = 1,
    ERR_CAN_BUSOFF    = 2,
    ERR_IPC_LOST      = 3,
    ERR_MEM_ALLOC     = 4,
} app_error_t;

static const char *error_strings[] = {
    "none", "sensor timeout", "CAN bus-off",
    "IPC connection lost", "memory allocation failed"
};

void report_error(app_error_t err) {
    slog2f(g_buf, 0, SLOG2_ERROR, "Error: %s (code=%d)",
           error_strings[err], err);
}
```

---

## Watchdog and Fault Recovery

### 11. Hardware Watchdog Must Always Run

Never skip the watchdog in production. Structure the main loop to guarantee strobing:

```c
/* Watchdog strobe pattern with deadline monitoring */
#define WATCHDOG_PERIOD_MS  1000
#define LOOP_DEADLINE_MS     500    /* must finish in 500ms */

int main(void) {
    int wdfd = open_watchdog(WATCHDOG_PERIOD_MS * 2);  /* 2x safety margin */

    struct timespec deadline;
    clock_gettime(CLOCK_MONOTONIC, &deadline);

    while (1) {
        /* Advance deadline */
        deadline.tv_nsec += WATCHDOG_PERIOD_MS * 1000000;
        if (deadline.tv_nsec >= 1000000000) {
            deadline.tv_sec++;
            deadline.tv_nsec -= 1000000000;
        }

        do_work();

        /* Check if we met the deadline */
        struct timespec now;
        clock_gettime(CLOCK_MONOTONIC, &now);
        if (now.tv_sec > deadline.tv_sec ||
            (now.tv_sec == deadline.tv_sec &&
             now.tv_nsec > deadline.tv_nsec)) {
            slog2f(g_buf, 0, SLOG2_WARNING, "Deadline missed!");
        }

        /* Strobe watchdog only if work completed */
        strobe_watchdog(wdfd);

        /* Sleep until next period */
        clock_nanosleep(CLOCK_MONOTONIC, TIMER_ABSTIME, &deadline, NULL);
    }
}
```

### 12. Respawn on Crash

Use death notifications to monitor critical processes and respawn them:

```c
static void monitor_and_respawn(const char *path, char *const argv[]) {
    while (1) {  /* respawn loop */
        pid_t child = spawn(path, 0, NULL, NULL, argv, environ);
        if (child == -1) {
            slog2f(g_buf, 0, SLOG2_ERROR, "spawn %s: %s", path, strerror(errno));
            sleep(1);
            continue;
        }

        int status;
        waitpid(child, &status, 0);   /* wait for child death */

        slog2f(g_buf, 0, SLOG2_WARNING,
               "%s exited (status=%d), respawning in 100ms", path, status);

        /* Brief delay before respawning */
        struct timespec ts = { 0, 100 * 1000 * 1000 };
        nanosleep(&ts, NULL);
    }
}
```

---

## Production Hardening

### 13. Minimal IFS Images

Include only what is needed:

```bash
# BAD: include an entire toolchain in the IFS
[perms=0755] /proc/boot/gcc  = /path/to/gcc
[perms=0755] /proc/boot/as   = /path/to/as
[perms=0755] /proc/boot/bash = /path/to/bash

# GOOD (production): no shell, no compiler, only runtime essentials
# - procnto-smp-instr (or procnto-smp for production, no tracing overhead)
# - libc.so, libm.so
# - Required drivers
# - Application binary
# - No shell (sh, bash), no strace, no gdb, no dev tools
```

### 14. Run Without a Shell in Production

```bash
# Production IFS script: no [+session] sh
[+script] .script = {
    slogger2 &
    pipe &
    devc-ser8250 -e -b115200 0x3F8,4 &
    waitfor /dev/ser1 4
    reopen /dev/ser1
    devb-sdmmc blk automount=sd0 sdio &
    waitfor /dev/sd0 5
    mount -t qnx6 /dev/sd0t12 /
    io-pkt-v6-hc &
    myapp &
    # No shell — if myapp exits, system sits idle or restarts
}
```

### 15. Strip Binaries for Production

```bash
# Strip debug symbols before flashing (reduces IFS size and prevents reverse engineering)
ntoaarch64-strip myapp
ntoaarch64-strip --strip-debug myapp  # keep symbol table but remove debug info
```

---

## Testing Strategies

### 16. Unit Test on the Host (x86_64 QNX)

Build and run unit tests on a QNX VM or as native x86_64 QNX binaries:

```bash
# Build test binary for x86_64
qcc -Vgcc_ntox86_64 -o test_suite test_suite.c mymodule.c

# Run on QNX VM (QEMU or VMware)
scp test_suite root@qnx-vm:/tmp/
ssh root@qnx-vm /tmp/test_suite
```

### 17. Integration Test with QEMU

```bash
# Run QNX IFS in QEMU for CI
qemu-system-aarch64 \
    -machine virt \
    -cpu cortex-a57 \
    -m 512M \
    -nographic \
    -kernel system.ifs \
    -serial mon:stdio \
    -net user,hostfwd=tcp::2222-:22 \
    -net nic
```

### 18. Timing Tests

```c
/* Measure worst-case execution time */
#include <sys/neutrino.h>
#include <inttypes.h>

static uint64_t measure_wcet(void (*fn)(void), int iterations) {
    uint64_t max_cycles = 0;
    uint64_t freq = SYSPAGE_ENTRY(qtime)->cycles_per_sec;

    for (int i = 0; i < iterations; i++) {
        uint64_t start = ClockCycles();
        fn();
        uint64_t end = ClockCycles();
        uint64_t cycles = end - start;
        if (cycles > max_cycles) max_cycles = cycles;
    }

    /* Convert to nanoseconds */
    uint64_t wcet_ns = (max_cycles * 1000000000ULL) / freq;
    slog2f(g_buf, 0, SLOG2_INFO,
           "WCET: %" PRIu64 " cycles / %" PRIu64 " ns",
           max_cycles, wcet_ns);
    return wcet_ns;
}
```

---

## Performance Profiling

### 19. Use tracelogger + Momentics Profiler

For thread-level timing, the kernel event trace is the gold standard:

```bash
# Record trace while under load
tracelogger -n 100000 -f /tmp/profile.kev &
./loadgen &
sleep 10
tracelogger -X

# Copy to host and open in Momentics System Profiler
scp root@192.168.1.100:/tmp/profile.kev .
# Momentics: File → Import → QNX System Profiler → profile.kev
# Shows: timeline, CPU %, message latency histogram, interrupt latency
```

### 20. IPC Benchmarking

```c
/* Measure round-trip IPC latency */
void benchmark_ipc(int coid) {
    const int SAMPLES = 10000;
    uint64_t min_ns = UINT64_MAX, max_ns = 0, total_ns = 0;
    uint64_t freq = SYSPAGE_ENTRY(qtime)->cycles_per_sec;
    uint32_t msg = 0, reply = 0;

    for (int i = 0; i < SAMPLES; i++) {
        uint64_t t0 = ClockCycles();
        MsgSend(coid, &msg, sizeof(msg), &reply, sizeof(reply));
        uint64_t t1 = ClockCycles();

        uint64_t ns = (t1 - t0) * 1000000000ULL / freq;
        if (ns < min_ns) min_ns = ns;
        if (ns > max_ns) max_ns = ns;
        total_ns += ns;
    }

    slog2f(g_buf, 0, SLOG2_INFO,
           "IPC round-trip (n=%d): min=%"PRIu64"ns avg=%"PRIu64"ns max=%"PRIu64"ns",
           SAMPLES, min_ns, total_ns / SAMPLES, max_ns);
}
```

---

## Automotive Deployment Checklist

| # | Item | Notes |
|---|------|-------|
| 1 | APS partitions defined | All ASIL processes have dedicated CPU budget |
| 2 | Memory partitions defined | ASIL D processes have dedicated RAM |
| 3 | `mlockall(MCL_CURRENT\|MCL_FUTURE)` | All RT processes |
| 4 | No `malloc` in RT paths | Pre-allocated pools only |
| 5 | Priority schema documented | Reviewed by architect |
| 6 | Mutexes use `PTHREAD_PRIO_INHERIT` | Default in QNX, verify no overrides |
| 7 | Hardware watchdog active | With 2× safety margin on strobe period |
| 8 | Software death notifications | Critical processes monitored + respawn |
| 9 | secpol policy applied | Deny-by-default, minimum cross-domain access |
| 10 | ASLR enabled | Not disabled in production |
| 11 | `-fstack-protector-strong` | All compilation units |
| 12 | Signed IFS image | Verified by secure boot chain |
| 13 | Shell removed from IFS | No `sh`, `bash`, in production image |
| 14 | Binaries stripped | Debug symbols not in production image |
| 15 | slogger2 integrated | No `printf` in production code |
| 16 | Timing measurements done | WCET verified for all RT tasks |
| 17 | ISO 26262 FMEA complete | Failure modes documented and mitigated |
| 18 | Regression test suite | Runs on every commit in CI/CD |
| 19 | QEMU-based integration tests | Full IFS boots and tests run via SSH |
| 20 | Final code review | No dynamic allocation, no unbounded loops in RT paths |
