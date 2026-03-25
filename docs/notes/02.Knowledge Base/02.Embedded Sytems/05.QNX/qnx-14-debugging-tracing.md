---
title: QNX Debugging & Tracing
createTime: 2026/03/25 00:00:00
permalink: /kb/embedded/qnx/debugging-tracing/
---

# QNX Debugging & Tracing

## Debugging Tools Overview

| Tool | Purpose |
|------|---------|
| `ntoaarch64-gdb` | Cross-debugger (GDB) via qconn |
| `qconn` | On-target debug/file-transfer agent |
| `dumper` | Generates core dumps on process crash |
| `slogger2` / `slog2info` | System logger and log viewer |
| `pidin` | Process and thread introspection |
| `tracelogger` | Kernel event trace recorder |
| `traceevent` | Post-process kernel trace files |
| `hogs` | Show CPU usage by thread |
| `showmem` | Physical and virtual memory usage |
| `fdinfo` | Open file descriptors per process |
| `System Profiler` | Momentics IDE visual trace viewer |

---

## GDB Remote Debugging

### Basic Workflow

```bash
# === On the QNX target ===
# qconn must be running (usually started in the IFS script)
qconn 8000 &

# Optional: run the app so GDB can attach later
./myapp &

# === On the host (Linux) ===
source /opt/qnx800/qnxsdp-env.sh
ntoaarch64-gdb ./myapp        # load binary with debug symbols
```

```gdb
# Inside GDB:

# Connect to target
(gdb) target qnx 192.168.1.100:8000

# Upload the binary to the target
(gdb) upload

# Set breakpoints before running
(gdb) break main
(gdb) break my_module.c:142
(gdb) break MyClass::someMethod

# Start execution
(gdb) run

# Execution control
(gdb) continue          # continue to next breakpoint
(gdb) next              # step over
(gdb) step              # step into
(gdb) finish            # run until function returns
(gdb) until 200         # run until line 200

# Inspect state
(gdb) backtrace         # call stack
(gdb) backtrace full    # call stack with local variables
(gdb) info locals       # local variables in current frame
(gdb) info args         # function arguments
(gdb) print my_var      # print variable value
(gdb) print *ptr        # dereference pointer
(gdb) print arr[0]@10   # print array slice (10 elements)
(gdb) display counter   # auto-display on each stop

# Memory inspection
(gdb) x/20xw 0x80000000        # hex words
(gdb) x/10i $pc                # disassemble around PC
(gdb) x/s 0x80001000           # as C string

# Registers
(gdb) info registers           # all registers
(gdb) print $x0                # AArch64 register x0
(gdb) print $pc                # program counter

# Threads
(gdb) info threads             # list threads
(gdb) thread 3                 # switch to thread 3
(gdb) thread apply all bt      # backtrace all threads
(gdb) set scheduler-locking on # freeze other threads during step

# Watchpoints
(gdb) watch my_variable        # break on write
(gdb) rwatch my_variable       # break on read
(gdb) awatch my_variable       # break on read or write
```

### Attaching to a Running Process

```gdb
(gdb) target qnx 192.168.1.100:8000
(gdb) info os processes        # list target processes
(gdb) attach 12345             # attach to PID 12345
(gdb) backtrace                # where is it now?
(gdb) continue
(gdb) detach                   # detach without killing
```

### Conditional Breakpoints

```gdb
(gdb) break process.c:85 if error_count > 5
(gdb) break handle_msg if msg.type == 0x42
(gdb) condition 2 x > 100     # add condition to existing breakpoint 2
(gdb) ignore 3 10              # skip breakpoint 3 the next 10 times
```

---

## Core Dump Analysis

### Configuring the Dumper

```bash
# Start dumper daemon (in the IFS .script section)
dumper -d /var/coredumps &

# Configure dump filename format
dumper -f core.%P.%N &    # %P = PID, %N = process name

# Set a size limit (in bytes)
dumper -s 100000000 &     # 100 MB max

# Enable for a specific process only
COREDUMP=1 ./myapp
```

### Analyzing a Core Dump

```bash
# On the host: copy the core dump
scp root@192.168.1.100:/var/coredumps/core.12345 .

# Load into GDB with the matching binary (must have -g symbols)
ntoaarch64-gdb ./myapp core.12345

(gdb) backtrace            # where it crashed
(gdb) info threads         # all threads at time of crash
(gdb) thread apply all bt  # backtrace every thread
(gdb) frame 2              # switch to frame 2
(gdb) info locals          # local variables at that frame
(gdb) list                 # source around crash location
```

---

## slogger2 System Logger

`slogger2` is QNX Neutrino's structured system logger. Applications write to it via `slog2_register()` and `slog2f()`. It persists across crashes (unlike `printf`—which requires a console).

### Writing to slogger2

```c
#include <sys/slog2.h>

static slog2_buffer_set_config_t config;
static slog2_buffer_t            buffers[2];

int init_logging(void) {
    config.buffer_set_name = "myapp";
    config.num_buffers = 2;

    /* Fast buffer: 8KB, logs DEBUG/INFO */
    config.buffer_config[0].buffer_name = "general";
    config.buffer_config[0].num_pages = 2;        /* 2 * 4KB */

    /* Slow buffer: 16KB, logs WARN/ERROR */
    config.buffer_config[1].buffer_name = "errors";
    config.buffer_config[1].num_pages = 4;

    if (slog2_register(&config, buffers, 0) == -1) {
        return -1;
    }

    return 0;
}

void do_work(void) {
    slog2f(buffers[0], 0, SLOG2_DEBUG1, "Processing request #%d", req_id);
    slog2f(buffers[0], 0, SLOG2_INFO,   "Sensor value: %.3f", value);
    slog2f(buffers[1], 0, SLOG2_WARNING,"Retry count: %d", retries);
    slog2f(buffers[1], 0, SLOG2_ERROR,  "Failed to open %s: %s",
           path, strerror(errno));
    slog2f(buffers[1], 0, SLOG2_CRITICAL,"Memory allocation failed!");
}
```

### slog2 Severity Levels

| Level | Value | Description |
|-------|-------|-------------|
| `SLOG2_SHUTDOWN` | 0 | System shutdown |
| `SLOG2_CRITICAL` | 1 | Unrecoverable error |
| `SLOG2_ERROR` | 2 | Recoverable error |
| `SLOG2_WARNING` | 3 | Potential problem |
| `SLOG2_NOTICE` | 4 | Normal but significant |
| `SLOG2_INFO` | 5 | Informational |
| `SLOG2_DEBUG1` | 6 | Debug level 1 |
| `SLOG2_DEBUG2` | 7 | Verbose debug |

### Reading Logs with slog2info

```bash
# Show all log messages (current buffer contents)
slog2info

# Continuous tail mode (like tail -f)
slog2info -w

# Filter by process name
slog2info -n myapp

# Filter by severity (show WARNING and above)
slog2info -l 3

# Show specific buffer set
slog2info -b myapp:general

# Show with timestamps
slog2info -t

# Show raw binary data
slog2info -r

# Show log from a saved file
slog2info -f /var/log/slog2.bin

# Save current logs to file
slog2info > /tmp/system.log
```

---

## Kernel Event Tracing

The QNX **Instrumented Kernel** (`procnto-smp-instr`) generates trace events for every significant kernel operation: system calls, interrupts, context switches, IPC, etc.

### Setting Up Kernel Tracing

```bash
# IFS must use the instrumented kernel:
# In system.build, replace:
#    PATH=/proc/boot procnto-smp
# with:
#    PATH=/proc/boot procnto-smp-instr

# On the target: start recording a trace
tracelogger -n 10000 -f /tmp/trace.kev &

# Let the system run, then stop:
tracelogger -X              # signal to stop

# Or record for a fixed number of events
tracelogger -n 50000 /tmp/trace.kev

# Set trace filter (only record specific events)
tracelogger -f /tmp/trace.kev \
    -e _NTO_TRACE_EMIT_COMM  \   # IPC events
    -e _NTO_TRACE_EMIT_THREAD \  # thread state changes
    -e _NTO_TRACE_EMIT_INT       # interrupt events
```

### Analyzing Trace Files

```bash
# Dump trace events as text
traceevent /tmp/trace.kev

# Verbose trace with timestamps and PIDs
traceevent -v /tmp/trace.kev

# Filter by event type
traceevent /tmp/trace.kev | grep -i "context switch"
traceevent /tmp/trace.kev | grep "MsgSend"

# Count event types
traceevent /tmp/trace.kev | awk '{print $3}' | sort | uniq -c | sort -rn

# Copy to host for analysis in Momentics IDE
scp root@192.168.1.100:/tmp/trace.kev .
# Then: Momentics → Window → Open Perspective → System Profiler
#       File → Import → QNX System Profiler: trace.kev
```

### Trace Events Available

| Category | Events |
|----------|--------|
| **Thread** | `THREAD_CREATE`, `THREAD_DESTROY`, `THREAD_READY`, `THREAD_RUNNING`, `THREAD_BLOCKED`, `THREAD_NANOSLEEP` |
| **IPC** | `MSG_SEND_ENTRY/EXIT`, `MSG_RECEIVE_ENTRY/EXIT`, `MSG_REPLY_ENTRY/EXIT` |
| **Interrupt** | `INT_HANDLER_ENTRY/EXIT`, `INTR_ATTACH/DETACH` |
| **Timer** | `TIMER_CREATE`, `TIMER_DELETE`, `TIMER_ARMED` |
| **Process** | `PROCESS_CREATE`, `PROCESS_DESTROY`, `PROCESS_PROCCREATE` |
| **User** | `USER_TRACE` — application-defined trace points |

### Inserting User Trace Points

```c
#include <sys/trace.h>

void my_function(void) {
    /* Insert a user trace event with optional data */
    trace_logbc(0, 0, "entering my_function");

    /* With structured data */
    trace_logf(0, 0, "value=%d status=%s", value, status);
}
```

---

## pidin: Process and System Inspector

`pidin` is the primary QNX process inspection tool:

```bash
# Full process listing
pidin

# Thread-level listing (shows all threads, priorities, states)
pidin threads

# Memory usage per process
pidin mem

# File descriptor usage
pidin fd

# Scheduling info
pidin sched

# Message passing statistics
pidin msg

# Show arguments and environment
pidin arg

# Filter by process name
pidin | grep myapp

# Show timer information
pidin timers

# Show channels and connections
pidin channels
pidin connections

# Show specific PID
pidin -p 12345

# Continuous refresh (like top)
pidin -n 5 threads    # refresh every 5 seconds
```

### pidin Output Fields

```
     pid   tid name                prio  STATE          Blocked
   49230     1 proc/boot/myapp      10r  SEND           12->...
   49230     2 proc/boot/myapp      20r  REPLY          waiting on ch 5
   49230     3 proc/boot/myapp      10f  MUTEX          mutex 0x4001d230
```

| Field | Description |
|-------|-------------|
| `pid` | Process ID |
| `tid` | Thread ID |
| `prio` | Priority + policy (`r`=RR, `f`=FIFO, `o`=OTHER, `s`=SPORADIC) |
| `STATE` | Thread state (READY, RUNNING, SEND, RECEIVE, REPLY, MUTEX, etc.) |
| `Blocked` | Resource the thread is waiting for |

---

## hogs: CPU Usage Monitor

```bash
# Show top CPU-consuming threads, refresh every 2 seconds
hogs -i 2

# Example output:
#
# Total CPU:  100.00%
# System:       2.34%
# User:        97.66%
#
# %CPU  PID  TID  NAME
# 45.2  1234   2  myapp
# 22.1  5678   1  io-pkt-v6-hc
#  8.3    12   1  procnto-smp-instr
```

---

## showmem: Memory Inspector

```bash
# Show physical memory usage
showmem

# Show per-process virtual memory
showmem -S

# Example output:
# Total physical: 512 MB
# Available:      234 MB
# Kernel:          24 MB
# Drivers:         68 MB
# Processes:      186 MB
```

---

## fdinfo: File Descriptor Inspector

```bash
# Show all open fds across all processes
fdinfo

# Show fds for a specific process
fdinfo -p 12345

# Show fds referencing a specific path
fdinfo /dev/ser1
```

---

## Debugging IPC Issues

```bash
# Show channels (servers waiting for messages)
pidin channels

# Show connections (clients connected to channels)
pidin connections

# Show blocked threads and what they're waiting on
pidin threads | grep -E "SEND|RECEIVE|REPLY"

# Trace IPC with kernel trace
tracelogger -n 10000 -f /tmp/ipc_trace.kev &
# ... reproduce the issue ...
tracelogger -X
traceevent /tmp/ipc_trace.kev | grep -E "MsgSend|MsgReceive|MsgReply"
```

---

## Debugging Memory Issues

```bash
# Find memory leaks with MuLink (malloc debug library)
LD_PRELOAD=libmudflap.so LD_MUDFLAPWARN_LEVEL=3 ./myapp

# Or set MALLOC_OPTIONS for heap trace
MALLOC_OPTIONS=T ./myapp 2>&1 | grep "HEAP"

# Heap analysis tool (Momentics): run with:
HOOKED_INTO=1 qcc -Vgcc_ntoaarch64le -lmalloc_g -o myapp_dbg myapp.c

# Check for guard-page violations
# Guard pages cause SIGSEGV on overflow — visible in GDB backtrace
```

---

## Useful Debugging Tips

### Enable Verbose slog2 Output in Code

```c
/* Log the function, file, and line automatically */
#define LOG_DEBUG(fmt, ...) \
    slog2f(g_log_buf, 0, SLOG2_DEBUG1, \
           "[%s:%d] " fmt, __func__, __LINE__, ##__VA_ARGS__)

#define LOG_ERROR(fmt, ...) \
    slog2f(g_log_buf, 0, SLOG2_ERROR, \
           "[%s:%d] " fmt, __func__, __LINE__, ##__VA_ARGS__)
```

### Print Thread ID in Logs

```c
#include <sys/neutrino.h>
slog2f(buf, 0, SLOG2_DEBUG1,
       "[tid=%d] Processing request", gettid());
```

### Find a Deadlock

```bash
# List all threads in MUTEX, SEND, REPLY state
pidin threads | awk '$5 ~ /MUTEX|SEND|REPLY/'

# Attach GDB and inspect waiting chains
ntoaarch64-gdb
(gdb) target qnx 192.168.1.100:8000
(gdb) attach 12345
(gdb) thread apply all bt
```

### Signal Handling for Debug Dumps

```c
#include <signal.h>
#include <sys/slog2.h>

static void dump_state(int sig) {
    slog2f(g_buf, 0, SLOG2_WARNING, "SIGUSR1 received: state=%d items=%d",
           g_state, g_item_count);
    /* Print queue contents, etc. */
}

int main(void) {
    signal(SIGUSR1, dump_state);
    /* ... */
}

/* Trigger from shell (on target): */
/* kill -USR1 <pid> */
```
