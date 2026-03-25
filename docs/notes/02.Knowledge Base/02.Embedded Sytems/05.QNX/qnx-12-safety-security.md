---
title: QNX Safety & Security
createTime: 2026/03/25 00:00:00
permalink: /kb/embedded/qnx/safety-security/
---

# QNX Safety & Security

## QNX OS for Safety

**QNX OS for Safety** is a separately certified variant of QNX Neutrino designed for safety-critical systems. It provides pre-certified software components and a Safety Manual.

### Certifications

| Standard | Level | Domain |
|----------|-------|--------|
| **ISO 26262** | ASIL D | Automotive (highest risk class) |
| **IEC 61508** | SIL 3 | Functional safety (industrial, general) |
| **IEC 62304** | Class C | Medical device software |
| **EN 50128** | SIL 4 | Railway / signaling |
| **DO-178C** | DAL A | Avionics (in progress / via partners) |

### Key Properties

- **Deterministic behavior**: Worst-case execution times are bounded
- **Freedom From Interference (FFI)**: Spatial isolation (separate virtual address spaces) + temporal isolation (APS scheduling) prevent faults from propagating between safety partitions
- **Minimal trusted computing base**: Only the microkernel runs in privileged mode (~100K lines of code vs Linux >20M lines)
- **Fault containment**: A crash in a driver or application does not affect the kernel or other processes

---

## Freedom From Interference (FFI)

FFI is the property that a fault in one software component cannot compromise the correct operation of another independent component.

### Spatial Isolation

Each process has its own virtual address space. The MMU enforces boundaries.

```
Process A (ASIL D)         Process B (QM)
┌──────────────────┐       ┌──────────────────┐
│ Code  (RX)       │       │ Code  (RX)       │
│ Data  (RW)       │       │ Data  (RW)       │
│ Stack (RW)       │       │ Stack (RW)       │
└──────────────────┘       └──────────────────┘
         │                          │
         └──────────┬───────────────┘
                    │  MMU enforces
                    ▼  address space isolation
           ┌─────────────────┐
           │   QNX Kernel    │  (runs in supervisor mode)
           └─────────────────┘
```

Any illegal memory access by Process B causes a segfault — Process A is unaffected.

### Temporal Isolation with APS

Without temporal isolation, a runaway process could consume 100% CPU:

```bash
# Create APS partitions for a mixed-criticality system
aps create -n Safety -b 40            # Safety: 40% CPU minimum
aps create -n HMI    -b 30            # HMI: 30% CPU minimum
aps create -n App    -b 20            # App: 20% CPU minimum
aps create -n Idle   -b 5             # Idle
aps create -n System -b 5             # System (procnto, drivers)

# Even if App partition goes to 100% CPU usage,
# Safety partition is guaranteed its 40% budget
```

---

## Mixed-Criticality System Design

QNX enables hosting multiple ASIL levels on one SoC:

```
┌────────────────────────────────────────────────────────┐
│                    QNX Neutrino Kernel                  │  ASIL D
├──────────────┬─────────────────┬────────────────────────┤
│ Safety ASIL D│   ASIL C        │    QM                  │
│ (APS: 40%)   │   (APS: 30%)    │    (APS: 30%)          │
│              │                 │                        │
│ safety_ecu   │ hmi_app         │ infotainment           │
│ sensor_mgr   │ cluster_ui      │ nav_app                │
│ brake_ctrl   │ warning_mgr     │ music_player           │
└──────────────┴─────────────────┴────────────────────────┘
```

### ASIL Decomposition

ISO 26262 allows decomposing an ASIL D requirement into two independent ASIL B+B channels. QNX supports this via:
1. **APS partitions**: temporal independence
2. **Separate virtual address spaces**: spatial independence
3. **Separate IFS images**: code independence (each ASIL partition can have its own binary)
4. **Memory partitioning**: physical memory pools assigned per safety domain

---

## Memory Partitioning

Memory partitioning guarantees that a safety-critical process has dedicated physical memory:

```bash
# Create a memory partition
mpartition -c -S 64m safety_mem
mpartition -c -S 128m hmi_mem

# Start a process in a memory partition
on -X safety_mem safety_ecu &

# Verify partition assignments
mpartition -i

# In the IFS build script:
# Assign typed memory regions to partitions
```

```c
/* C API: join a memory partition */
#include <sys/mman.h>
#include <sys/partition.h>

int main(void) {
    /* Attach to the safety memory partition */
    part_id_t part = part_lookup("safety_mem");
    if (part_attach(part, 0) != EOK) {
        /* handle error */
        return EXIT_FAILURE;
    }

    /* All subsequent malloc/mmap comes from the safety_mem partition */
    void *buf = malloc(1024 * 1024);  /* allocates from safety_mem */
    return 0;
}
```

---

## Process Capabilities and Privileges

QNX uses a capability-based security model. Processes request specific abilities from the process manager:

```c
#include <sys/procmgr.h>

int main(void) {
    /*
     * Request IO privilege (for MMIO access)
     */
    if (ThreadCtl(_NTO_TCTL_IO_PRIV, 0) == -1) {
        perror("ThreadCtl IO_PRIV");
        return EXIT_FAILURE;
    }

    /*
     * Request ability to set real-time scheduling on other processes
     */
    if (procmgr_ability(0,
        PROCMGR_ADO_ALLOW | PROCMGR_AID_SCHEDULE,    /* allow scheduling */
        PROCMGR_ADO_ALLOW | PROCMGR_AID_PRIO,        /* allow priority changes */
        PROCMGR_AID_EOL) != EOK) {
        perror("procmgr_ability");
        return EXIT_FAILURE;
    }

    return 0;
}
```

### Common Abilities

| Ability | Description |
|---------|-------------|
| `PROCMGR_AID_RAWIO` | Direct hardware I/O port access |
| `PROCMGR_AID_INTERRUPT` | Attach hardware interrupt handlers |
| `PROCMGR_AID_PRIO` | Change scheduling priority of other processes |
| `PROCMGR_AID_SCHEDULE` | Change scheduling policy of other processes |
| `PROCMGR_AID_MEM_SPECIAL` | Map special memory types |
| `PROCMGR_AID_PATHSPACE` | Create entries in the pathname space |
| `PROCMGR_AID_FORK` | Fork processes |
| `PROCMGR_AID_CHILD_NEWAPP` | Set exec privileges |

---

## secpol: Security Policy Enforcement

`secpol` (Security Policy) provides mandatory access control (MAC) for QNX processes. It is modeled after SELinux namespaces.

### Enabling secpol

Add to the IFS script:

```bash
# Start security policy daemon before other processes
secpol -p /etc/secpol/policy.bin &
waitfor /dev/secpol 5
```

### Writing a secpol Policy

```
# /etc/secpol/policy.conf

# Define types
type safety_domain;
type hmi_domain;
type untrusted_domain;

# Assign processes to types
proc /proc/boot/safety_ecu  safety_domain;
proc /proc/boot/hmi_app     hmi_domain;
proc /proc/boot/webserver   untrusted_domain;

# Allow safety_domain to use these resources
allow safety_domain safety_domain : process { fork exec };
allow safety_domain safety_device : fd { read write };

# Deny untrusted from accessing safety resources
deny untrusted_domain safety_device : fd { read write };

# Allow IPC between safety and HMI (one-way)
allow safety_domain hmi_domain : ipc { send };
deny  hmi_domain safety_domain : ipc { send };
```

### Compiling the Policy

```bash
# Compile policy source to binary
selink -compile policy.conf policy.bin

# Verify policy
selink -verify policy.bin
```

---

## Address Space Layout Randomization (ASLR)

ASLR randomizes the virtual addresses of code, stack, and heap, making exploitation harder:

```bash
# Check if ASLR is enabled (it is by default in QNX SDP 8.0)
pidin info | grep ASLR

# Disable ASLR for a specific process (debugging only)
on -A 0 myapp

# Disable ASLR globally at runtime (not recommended for production)
procmgr sysctl kern.aslr=0
```

---

## Stack Protection

QNX supports compiler-level and OS-level stack protection:

```bash
# Compile with stack canaries
qcc -Vgcc_ntoaarch64le -fstack-protector-strong -o myapp myapp.c

# Stack smashing protection is enabled by default in SDP 8.0
# Detected at runtime via __stack_chk_fail() -> SIGABRT + slog2 message
```

---

## Secure Boot Integration

QNX can integrate with hardware secure boot chains (e.g., ARM TrustZone, i.MX HAB):

```
ROM Boot Code (immutable)
    ↓ verifies signature
U-Boot / IPL (signed)
    ↓ verifies signature
startup-myboard (signed)
    ↓ verifies hash
procnto (integrity checked by startup)
    ↓
IFS image integrity verified
    ↓
Applications start (with secpol enforcing policies)
```

### Signing the IFS Image

```bash
# Generate key pair (one-time, keep private key secure)
openssl genrsa -out signing_key.pem 4096
openssl rsa -in signing_key.pem -pubout -out signing_key_pub.pem

# Sign the IFS image
openssl dgst -sha256 -sign signing_key.pem -out system.ifs.sig system.ifs

# Verify signature (on host, before flashing)
openssl dgst -sha256 -verify signing_key_pub.pem \
    -signature system.ifs.sig system.ifs
```

---

## Watchdog and Health Monitoring

### Hardware Watchdog

```c
#include <hw/watchdog.h>

int main(void) {
    /* Open the watchdog device */
    int wdfd = open("/dev/watchdog0", O_RDWR);
    if (wdfd == -1) {
        return EXIT_FAILURE;
    }

    /* Set 5-second timeout */
    watchdog_cmd_t cmd = {0};
    cmd.cmd = WATCHDOG_CMD_TIMEOUT;
    cmd.timeout_ms = 5000;
    devctl(wdfd, DCMD_WATCHDOG_SET_TIMEOUT, &cmd, sizeof(cmd), NULL);

    /* Start the watchdog */
    devctl(wdfd, DCMD_WATCHDOG_START, NULL, 0, NULL);

    /* In the main loop, keep stroking */
    while (1) {
        /* ... do work ... */
        devctl(wdfd, DCMD_WATCHDOG_KEEP_ALIVE, NULL, 0, NULL);
        sleep(1);
    }
}
```

### Death Notification (Software Watchdog)

Processes can monitor each other using channel pulses:

```c
#include <sys/siginfo.h>
#include <process.h>

/* Monitor child process and respawn on crash */
void monitor_child(int chid, pid_t child_pid) {
    int coid = ConnectAttach(0, child_pid, chid, _NTO_SIDE_CHANNEL, 0);
    if (coid == -1) {
        return;
    }

    /* Register for death notification */
    struct sigevent event;
    SIGEV_PULSE_INIT(&event, coid, SIGEV_PULSE_PRIO_INHERIT, PULSE_CODE_DEATH, 0);
    ConnectNotify(coid, &event, _NOTIFY_COND_EXITED);

    /* Wait for death pulse */
    struct _pulse pulse;
    MsgReceive(chid, &pulse, sizeof(pulse), NULL);
    if (pulse.code == PULSE_CODE_DEATH) {
        /* Child died — restart it */
        respawn_child();
    }
}
```

---

## Privilege Separation Pattern

Design safety-critical applications with least-privilege:

```
┌──────────────────────────────────────────────────────────┐
│                    myapp_gateway (root owned IFS binary) │
│  • Parses IFS config, opens privileged FDs               │
│  • Calls procmgr_ability() for needed capabilities       │
│  • forks + execs worker processes, passing FDs           │
│  • Drops root: setuid(worker_uid), setgid(worker_gid)   │
└──────────────────────────────────────────────────────────┘
          ↓ fork+exec (passes pre-opened FDs)
┌───────────────────────────────┐
│  myapp_worker (non-root)      │
│  • Receives FDs via inheritance│
│  • No extra capabilities      │
│  • No raw I/O, no interrupt   │
└───────────────────────────────┘
```

```c
/* myapp_gateway.c — privilege separation example */
int main(void) {
    /* Open hardware device while still privileged */
    int hw_fd = open("/dev/mydevice", O_RDWR);

    /* Drop to non-root user */
    setuid(1000);
    setgid(1000);

    /* Launch untrusted worker, inheriting the fd */
    char fd_str[16];
    snprintf(fd_str, sizeof(fd_str), "%d", hw_fd);
    char *argv[] = { "/opt/myapp/worker", fd_str, NULL };
    posix_spawn(NULL, argv[0], NULL, NULL, argv, environ);

    /* Close our copy of the fd */
    close(hw_fd);

    /* Wait for worker */
    wait(NULL);
    return 0;
}
```

---

## Safety Checklist

| Item | Description |
|------|-------------|
| APS partitions | Defined and critical budgets set for all ASIL processes |
| Memory partitions | ASIL D processes have dedicated physical memory |
| No dynamic allocation in ASIL D | All memory pre-allocated at startup |
| `mlockall(MCL_CURRENT \| MCL_FUTURE)` | Memory locked, no page faults in RT paths |
| Stack pre-faulted | Call a function that touches the maximum stack depth at startup |
| Watchdog | Both hardware and software watchdogs active |
| secpol policy | All domains defined, deny-by-default for cross-domain access |
| ASLR enabled | Default in SDP 8.0, do not disable in production |
| `-fstack-protector-strong` | Enabled in all compilation units |
| Signed IFS image | Verified by secure boot chain |
| Death notifications | All critical processes monitored and restarted |
| No `system()` / `popen()` | Avoid shell injection risks |
| No unbounded `sprintf` | Use `snprintf` with explicit length limits |
| Capabilities minimized | Each process requests only the abilities it needs |
