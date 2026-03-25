---
title: QNX Process & Thread Model
createTime: 2026/03/25 00:00:00
permalink: /kb/embedded/qnx/process-thread-model/
---

# QNX Process & Thread Model

## Processes in QNX Neutrino

A QNX process is a **protected execution environment** consisting of:
- A unique **PID** (process ID)
- A **virtual address space** (managed by the MMU)
- One or more **threads**
- A set of **file descriptors**, **channel IDs**, and **connection IDs**
- **Signal dispositions**
- **Resource limits** (via `setrlimit()`)
- A **credential set**: UID, GID, supplementary groups, capabilities

Processes are isolated from each other — a write by one process to an invalid address causes a **SIGSEGV** only in that process; other processes and the kernel continue unaffected.

---

## Creating Processes

QNX supports three mechanisms for creating child processes:

### fork()

```c
pid_t pid = fork();
if (pid == 0) {
    // Child: exact copy of parent's address space (copy-on-write)
    execl("/bin/myapp", "myapp", NULL);
    _exit(1);  // exec failed
} else if (pid > 0) {
    // Parent: pid is child's PID
    int status;
    waitpid(pid, &status, 0);
} else {
    perror("fork");
}
```

- Complete copy of the parent's address space (copy-on-write pages)
- Child inherits parent's file descriptors, channels, connections
- QNX `fork()` has one important restriction: only the calling thread is copied; other parent threads are not duplicated in the child

### spawn() — QNX-Preferred

`spawn()` and `spawnl()` are the preferred QNX mechanism because they atomically:
1. Create a new process
2. Set up the environment (file descriptor inheritance, working directory, etc.)
3. Execute a new program

No intermediate forked state exists:

```c
#include <process.h>

// spawnl: simple form
pid_t child = spawnl(P_NOWAIT, "/usr/bin/myapp", "myapp", "arg1", NULL);

// spawn with full control via struct inheritance_s
struct inheritance inherit;
memset(&inherit, 0, sizeof(inherit));
inherit.flags = SPAWN_SETGROUP;
inherit.pgroup = SPAWN_NEWPGROUP;

int fd_map[] = { STDIN_FILENO, STDOUT_FILENO, STDERR_FILENO };
pid_t child2 = spawn("/usr/bin/myapp",
                     3, fd_map,
                     &inherit,
                     (char *const[]){"myapp", "arg1", NULL},
                     environ);
```

### posix_spawn()

Standard POSIX.1-2008 function, implemented efficiently in QNX:

```c
#include <spawn.h>

posix_spawnattr_t attr;
posix_spawn_file_actions_t file_actions;

posix_spawnattr_init(&attr);
posix_spawn_file_actions_init(&file_actions);
posix_spawn_file_actions_addclose(&file_actions, 3);  // close fd 3 in child

pid_t pid;
char *const argv[] = { "myapp", "arg1", NULL };
posix_spawn(&pid, "/usr/bin/myapp", &file_actions, &attr, argv, environ);

posix_spawnattr_destroy(&attr);
posix_spawn_file_actions_destroy(&file_actions);
```

---

## Process Lifecycle

```
                  fork()/spawn()
                        │
                        ▼
                  ┌──────────┐
                  │  ALIVE   │◄──── Threads executing
                  └────┬─────┘
                       │ All threads exit, or any thread calls exit()
                       ▼
                  ┌──────────┐
                  │  ZOMBIE  │     process entry remains; exit status stored
                  └────┬─────┘
                       │ Parent calls waitpid() / wait()
                       ▼
                   Reaped (PID released)
```

If the parent exits without reaping, QNX's process manager re-parents zombies to **PID 1** (the `tinit` or `sinit` init process), which automatically reaps them.

---

## Threads in QNX

Threads are the **schedulable unit**. Every thread has:
- A **Thread ID (TID)** — unique within the process
- A **stack** (default 256 KB, configurable)
- A **priority** (1–255, where 255 is highest)
- A **scheduling policy** (FIFO, Round Robin, Sporadic)
- A **CPU affinity mask** (which CPUs it may run on)
- Signal mask, floating-point state, `errno`

### Creating Threads

QNX uses standard POSIX threads (pthreads):

```c
#include <pthread.h>

void *worker_thread(void *arg) {
    int thread_num = *(int *)arg;
    printf("Thread %d running on CPU %d\n",
           thread_num, SCHED_GETCPU());
    return NULL;
}

int main(void) {
    pthread_t tid;
    pthread_attr_t attr;

    pthread_attr_init(&attr);
    // Set stack size
    pthread_attr_setstacksize(&attr, 64 * 1024);  // 64 KB stack
    // Set scheduling policy and priority
    struct sched_param sp = { .sched_priority = 20 };
    pthread_attr_setschedpolicy(&attr, SCHED_FIFO);
    pthread_attr_setschedparam(&attr, &sp);
    pthread_attr_setinheritsched(&attr, PTHREAD_EXPLICIT_SCHED);

    int num = 1;
    pthread_create(&tid, &attr, worker_thread, &num);
    pthread_attr_destroy(&attr);

    pthread_join(tid, NULL);
    return 0;
}
```

### Thread Priorities

QNX uses **256 priority levels** (0–255):

| Priority Range | Usage |
|---------------|-------|
| 0 | Idle thread (runs when no other thread is ready) |
| 1–10 | Low priority background tasks |
| 11–50 | Normal application threads |
| 51–100 | Device drivers (typical) |
| 101–200 | Time-critical application threads |
| 201–254 | High-priority drivers, interrupt handlers second-level |
| 255 | Reserved (kernel internal) |

Priority 1 is the minimum for user threads. The idle thread runs at priority 0 and is not schedulable by users.

### Thread Control: ThreadCtl()

`ThreadCtl()` is QNX's extension to POSIX for thread-level kernel controls:

```c
#include <sys/neutrino.h>

// Allow this thread to access hardware I/O ports (x86) and mmap device memory
ThreadCtl(_NTO_TCTL_IO, 0);

// Allow this thread to raise its own priority (requires root or CAP_SYS_NICE)
ThreadCtl(_NTO_TCTL_RUNMASK, (void *)(uintptr_t)cpu_mask);

// Set CPU affinity: run only on CPU 0 and CPU 1
uint32_t runmask = 0x3;  // bit 0 = CPU0, bit 1 = CPU1
ThreadCtl(_NTO_TCTL_RUNMASK, (void *)(uintptr_t)runmask);

// Get thread name (QNX extension)
ThreadCtl(_NTO_TCTL_NAME, "MyWorkerThread");
```

---

## Thread Naming

Thread names are highly recommended — they appear in `pidin`, `slog2info`, and Momentics IDE thread views:

```c
#include <sys/neutrino.h>

// Set name of the CURRENT thread
pthread_setname_np(pthread_self(), "SensorReader");

// QNX-specific: set any thread's name
char name[_NTO_THREAD_NAME_MAX + 1];
snprintf(name, sizeof(name), "Worker-%d", thread_id);
ThreadCtl(_NTO_TCTL_NAME, name);
```

---

## CPU Affinity

On SMP systems, threads can be pinned to specific CPUs to improve cache locality or implement CPU partitioning:

```c
// Using POSIX CPU sets
#include <sched.h>

cpu_set_t set;
CPU_ZERO(&set);
CPU_SET(0, &set);  // Allow only CPU 0
CPU_SET(2, &set);  // And CPU 2

pthread_t tid = pthread_self();
pthread_setaffinity_np(tid, sizeof(set), &set);

// QNX-native: using runmask bitmask
uint32_t runmask = (1 << 0) | (1 << 2);  // CPU 0 and CPU 2
ThreadCtl(_NTO_TCTL_RUNMASK, (void *)(uintptr_t)runmask);

// SMP-INHERIT variant: recursively set all threads in process
uint32_t inherit_mask = 0x3;  // CPU 0,1 only
ThreadCtl(_NTO_TCTL_RUNMASK_GET_AND_SET_INHERIT,
          (void *)(uintptr_t)inherit_mask);
```

---

## Synchronization Primitives

### Mutexes

QNX mutexes support **priority inheritance** automatically:

```c
pthread_mutex_t lock;
pthread_mutexattr_t attr;

pthread_mutexattr_init(&attr);
pthread_mutexattr_settype(&attr, PTHREAD_MUTEX_RECURSIVE);  // Recursive
// Priority inheritance is the default in QNX; explicitly set:
pthread_mutexattr_setprotocol(&attr, PTHREAD_PRIO_INHERIT);

pthread_mutex_init(&lock, &attr);
pthread_mutexattr_destroy(&attr);

// Usage
pthread_mutex_lock(&lock);
// critical section
pthread_mutex_unlock(&lock);

pthread_mutex_destroy(&lock);
```

### Condition Variables

```c
pthread_cond_t cond = PTHREAD_COND_INITIALIZER;
pthread_mutex_t mu   = PTHREAD_MUTEX_INITIALIZER;
int data_ready = 0;

// Consumer thread
pthread_mutex_lock(&mu);
while (!data_ready)
    pthread_cond_wait(&cond, &mu);
// process data
pthread_mutex_unlock(&mu);

// Producer thread
pthread_mutex_lock(&mu);
data_ready = 1;
pthread_cond_signal(&cond);
pthread_mutex_unlock(&mu);
```

### Semaphores

```c
#include <semaphore.h>

sem_t sem;
sem_init(&sem, 0, 0);        // Initial count = 0, process-private

// Post (increment) from ISR/pulse handler or other thread
sem_post(&sem);

// Wait (decrement) — blocks if count == 0
sem_wait(&sem);

// Timed wait
struct timespec ts;
clock_gettime(CLOCK_MONOTONIC, &ts);
ts.tv_sec += 1;  // 1 second timeout
sem_timedwait(&sem, &ts);

sem_destroy(&sem);
```

### Barriers

```c
pthread_barrier_t barrier;
pthread_barrier_init(&barrier, NULL, 4);  // 4 threads must reach barrier

// Each thread:
pthread_barrier_wait(&barrier);  // blocks until all 4 threads arrive
```

### Readers-Writer Locks

```c
pthread_rwlock_t rwlock = PTHREAD_RWLOCK_INITIALIZER;

// Multiple readers concurrently:
pthread_rwlock_rdlock(&rwlock);
// read shared data
pthread_rwlock_unlock(&rwlock);

// Single writer exclusion:
pthread_rwlock_wrlock(&rwlock);
// modify shared data
pthread_rwlock_unlock(&rwlock);
```

---

## Pulse-Based Event Notification

Pulses allow a thread to wait for events without spinning:

```c
#include <sys/neutrino.h>

#define MY_PULSE_CODE _PULSE_CODE_MINAVAIL

int chid = ChannelCreate(0);
int coid = ConnectAttach(0, getpid(), chid, _NTO_SIDE_CHANNEL, 0);

// Set up timer to send pulse every 10 ms
struct sigevent event;
SIGEV_PULSE_INIT(&event, coid, SIGEV_PULSE_PRIO_INHERIT,
                 MY_PULSE_CODE, 0);

struct itimerspec timer_spec = {
    .it_interval = { .tv_sec = 0, .tv_nsec = 10000000 },  // 10 ms
    .it_value    = { .tv_sec = 0, .tv_nsec = 10000000 },
};
timer_t timer;
timer_create(CLOCK_MONOTONIC, &event, &timer);
timer_settime(timer, 0, &timer_spec, NULL);

// Event loop
for (;;) {
    struct _pulse pulse;
    int rcvid = MsgReceive(chid, &pulse, sizeof(pulse), NULL);
    if (rcvid == 0) {
        // Pulse received
        switch (pulse.code) {
        case MY_PULSE_CODE:
            do_periodic_work();
            break;
        default:
            break;
        }
    }
}
```

---

## Signals

QNX supports full POSIX signals plus some QNX-specific extensions:

```c
#include <signal.h>
#include <sys/neutrino.h>

// POSIX signal handler
struct sigaction sa;
sa.sa_handler = my_handler;
sigemptyset(&sa.sa_mask);
sa.sa_flags = SA_RESTART;
sigaction(SIGTERM, &sa, NULL);

// Real-time signal (queued, carries value)
union sigval sv;
sv.sival_int = 42;
sigqueue(target_pid, SIGRTMIN, sv);

// Block signals in a thread (mask SIGINT, SIGTERM)
sigset_t mask;
sigemptyset(&mask);
sigaddset(&mask, SIGINT);
sigaddset(&mask, SIGTERM);
pthread_sigmask(SIG_BLOCK, &mask, NULL);

// sigwaitinfo: block and atomically receive signal
struct siginfo info;
int sig = sigwaitinfo(&mask, &info);
printf("Got signal %d, value %d\n", sig, info.si_value.sival_int);
```

**Important QNX signal behavior**: Signals delivered to a process are directed to a **specific thread** based on which thread has the signal unmasked. If all threads mask a signal, it is queued until unmasked.

---

## /proc Filesystem

QNX exposes process and thread information via `/proc`:

```bash
# List all processes
ls /proc/

# Get info about process PID 12345
cat /proc/12345/as       # address space map
cat /proc/12345/maps     # POSIX-style memory maps

# pidin: the QNX process information utility
pidin                    # list all processes and threads
pidin -p 12345           # threads in process 12345
pidin -F"%a %b %N"       # custom format: pid, tid, thread name
pidin mem                # memory usage per process
pidin sched              # scheduling info for all threads
pidin fd                 # open file descriptors
pidin arg                # command-line arguments
```

Example `pidin` output:
```
     pid tid name               prio cpu state        Blocked
       1   1 procnto-smp-instr     0   f NANOSLEEP
    4097   1 slogger2             10   0 RECEIVE      1(slogger2)
    4098   1 pipe                 10   1 RECEIVE      1(pipe)
    4099   1 devc-pty           125   0 RECEIVE      1(devc-pty)
   65537   1 io-pkt-v6-hc        21   1 RECEIVE      1(io-pkt)
   65538   1 devb-sdmmc          20   0 RECEIVE      1(devb-sdmmc)
  131073   1 myapp                10   0 REPLY        65538(devb-sdmmc)
```

---

## Process Resource Limits

```c
#include <sys/resource.h>

// Get/set maximum open file descriptors
struct rlimit rl;
getrlimit(RLIMIT_NOFILE, &rl);
rl.rlim_cur = 1024;
setrlimit(RLIMIT_NOFILE, &rl);

// Other useful limits:
// RLIMIT_STACK  - maximum thread stack size
// RLIMIT_AS     - maximum virtual address space
// RLIMIT_CORE   - maximum core dump size
// RLIMIT_CPU    - maximum CPU time in seconds
```

---

## Environment Variables

QNX inherits standard POSIX environment variable handling:

```bash
# Key QNX environment variables
PATH=/proc/boot:/bin:/usr/bin:/usr/sbin
LD_LIBRARY_PATH=/lib:/usr/lib:/lib/dll
TMPDIR=/tmp
SYSNAME=nto               # QNX operating system name
PROCESSOR=x86_64          # or aarch64
HOSTNAME=qnx-target

# QNX-specific
TMPDIR=/dev/shmem         # Often RAM-backed
```
