---
title: QNX Resource Managers
createTime: 2026/03/25 00:00:00
permalink: /kb/embedded/qnx/resource-managers/
---

# QNX Resource Managers

## What Is a Resource Manager?

A **resource manager** (resmgr) is a user-space server that implements a POSIX file-like interface by registering a **pathname prefix** in the QNX filesystem namespace. Client applications use the standard POSIX calls (`open()`, `read()`, `write()`, `ioctl()`, `close()`, etc.) and the calls are transparently routed via IPC to the resource manager process.

```
Application                    Resource Manager (user-space process)
   open("/dev/mydevice")
        │
        ▼
   [C library resolves path]
        │
        ▼
   [IPC → MsgSend to resmgr]
                               MsgReceive() → io_open()
                               → MsgReply(fd)
        ◄──────────────────────
   fd = 3  (success)

   write(fd, buf, len)
        │
        ▼
   [IPC → MsgSend to resmgr]
                               MsgReceive() → io_write()
                               → MsgReply(len)
        ◄──────────────────────
```

Every device in `/dev/` — serial ports, network interfaces, frame buffers, custom hardware — is a resource manager.

---

## Resource Manager Framework Components

QNX provides a high-level framework (`<sys/iofunc.h>`, `<sys/dispatch.h>`) that handles most of the IPC plumbing:

| Component | Header | Description |
|-----------|--------|-------------|
| `dispatch_t` | `<sys/dispatch.h>` | Dispatch context; manages channel and message routing |
| `resmgr_attr_t` | `<sys/resmgr.h>` | Resource manager attributes |
| `iofunc_attr_t` | `<sys/iofunc.h>` | Device attributes (stat info, permissions, size) |
| `iofunc_ocb_t` | `<sys/iofunc.h>` | Open Control Block — per-open-file instance state |
| `resmgr_connect_funcs_t` | `<sys/resmgr.h>` | Callbacks for connect-phase messages (open, stat, chmod) |
| `resmgr_io_funcs_t` | `<sys/resmgr.h>` | Callbacks for I/O messages (read, write, ioctl, close) |

---

## Minimal Resource Manager Example

```c
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <errno.h>
#include <sys/iofunc.h>
#include <sys/dispatch.h>

/* Per-device state */
static iofunc_attr_t device_attr;

/* ── Custom I/O handlers ──────────────────────────────────────────────── */

static int io_read(resmgr_context_t *ctp, io_read_t *msg,
                   iofunc_ocb_t *ocb) {
    const char *data = "Hello from resmgr!\n";
    int data_len = strlen(data) + 1;

    /* Check if the offset is past end of data */
    if (ocb->offset >= data_len)
        return _RESMGR_NPARTS(0);  /* EOF */

    int n = data_len - ocb->offset;
    if (n > msg->i.nbytes)
        n = msg->i.nbytes;

    /* Reply with the data */
    SETIOV(ctp->iov, data + ocb->offset, n);
    ocb->offset += n;

    return _RESMGR_NPARTS(1);  /* 1 iov part */
}

static int io_write(resmgr_context_t *ctp, io_write_t *msg,
                    iofunc_ocb_t *ocb) {
    /* Read the data the client sent */
    int nbytes = msg->i.nbytes;
    char *buf = malloc(nbytes + 1);
    MsgRead(ctp->rcvid, buf, nbytes, sizeof(io_write_t));
    buf[nbytes] = '\0';
    printf("Received write: %s\n", buf);
    free(buf);

    _IO_SET_WRITE_NBYTES(ctp, nbytes);  /* report bytes written */
    return _RESMGR_NPARTS(0);
}

/* ── Main ─────────────────────────────────────────────────────────────── */

int main(void) {
    dispatch_t             *dpp;
    resmgr_attr_t           rattr;
    resmgr_connect_funcs_t  cfuncs;
    resmgr_io_funcs_t       iofuncs;

    /* 1. Create a dispatch context (channel + message buffer) */
    dpp = dispatch_create();
    if (dpp == NULL) { perror("dispatch_create"); exit(1); }

    /* 2. Set up default handlers */
    iofunc_func_init(_RESMGR_CONNECT_NFUNCS, &cfuncs,
                     _RESMGR_IO_NFUNCS,      &iofuncs);

    /* 3. Override only the handlers we implement */
    iofuncs.read  = io_read;
    iofuncs.write = io_write;

    /* 4. Initialize device attributes (/dev/mydev, mode 0666, char device) */
    iofunc_attr_init(&device_attr, S_IFCHR | 0666, NULL, NULL);
    device_attr.nbytes = 0;  /* no seek */

    /* 5. Register the pathname /dev/mydev */
    memset(&rattr, 0, sizeof(rattr));
    rattr.nparts_max = 3;
    int id = resmgr_attach(dpp, &rattr, "/dev/mydev", _FTYPE_ANY, 0,
                           &cfuncs, &iofuncs, &device_attr);
    if (id == -1) { perror("resmgr_attach"); exit(1); }

    /* 6. Allocate a context buffer */
    dispatch_context_t *ctp_ctx = dispatch_context_alloc(dpp);

    printf("Resource manager ready at /dev/mydev\n");

    /* 7. Event loop */
    for (;;) {
        ctp_ctx = dispatch_block(ctp_ctx);    /* blocks on MsgReceive */
        dispatch_handler(ctp_ctx);            /* dispatches to callbacks */
    }

    return 0;
}
```

Test it:
```bash
cat /dev/mydev             # triggers io_read
echo "hello" > /dev/mydev  # triggers io_write
```

---

## Connect vs I/O Messages

QNX resource manager callbacks are split into two phases:

### Connect Messages (connection setup)

Called when a path is being resolved (before a file descriptor is fully open):

| Callback | Called For |
|----------|-----------|
| `io_open` | `open()` call |
| `io_unlink` | `unlink()` / `remove()` |
| `io_rename` | `rename()` |
| `io_mknod` | `mknod()` |
| `io_readlink` | `readlink()` |
| `io_link` | `link()` (hard link) |
| `io_stat` | `stat()`, `lstat()` |

### I/O Messages (per-fd operations)

Called on an open file descriptor:

| Callback | Called For |
|----------|-----------|
| `io_read` | `read()`, `readv()` |
| `io_write` | `write()`, `writev()` |
| `io_ioctl` | `ioctl()` |
| `io_devctl` | `devctl()` (QNX-specific extended ioctl) |
| `io_close_ocb` | Last `close()` of a fd |
| `io_stat` | `fstat()` |
| `io_lseek` | `lseek()` |
| `io_chmod` | `fchmod()` |
| `io_chown` | `fchown()` |
| `io_sync` | `fsync()`, `fdatasync()` |
| `io_mmap` | `mmap()` on fd |
| `io_msg` | custom `_IO_MSG` messages |
| `io_select` | `select()`, `poll()` |

---

## Custom ioctl / devctl

For device-specific commands, use `devctl()` (preferred over `ioctl()` in QNX):

```c
/* Define in shared header between driver and clients */
#include <devctl.h>

#define MY_DEVCTL_SET_RATE  __DIOT ('M', 1, struct my_rate_s)
#define MY_DEVCTL_GET_STATUS __DIOF('M', 2, struct my_status_s)

struct my_rate_s   { uint32_t rate_hz; };
struct my_status_s { uint32_t errors; uint32_t packets; };

/* ── Resource manager side ── */
static int io_devctl(resmgr_context_t *ctp, io_devctl_t *msg,
                     iofunc_ocb_t *ocb) {
    void *data = _DEVCTL_DATA(msg->i);

    switch (msg->i.dcmd) {
    case MY_DEVCTL_SET_RATE: {
        struct my_rate_s *req = data;
        set_hw_rate(req->rate_hz);
        return _RESMGR_NPARTS(0);
    }
    case MY_DEVCTL_GET_STATUS: {
        struct my_status_s *resp = data;
        resp->errors  = hw_error_count;
        resp->packets = hw_packet_count;
        msg->o.ret_val = EOK;
        SETIOV(ctp->iov, resp, sizeof(*resp));
        return _RESMGR_NPARTS(1);
    }
    default:
        return iofunc_devctl_default(ctp, msg, ocb);
    }
}

/* ── Client side ── */
int fd = open("/dev/mydev", O_RDWR);

struct my_rate_s rate = { .rate_hz = 115200 };
devctl(fd, MY_DEVCTL_SET_RATE, &rate, sizeof(rate), NULL);

struct my_status_s status;
devctl(fd, MY_DEVCTL_GET_STATUS, &status, sizeof(status), NULL);
printf("Errors: %u, Packets: %u\n", status.errors, status.packets);
```

---

## Open Control Block (OCB)

The OCB represents **one open file descriptor** and stores per-open state. The default OCB is `iofunc_ocb_t`. You extend it for device-specific per-fd state:

```c
/* Extended OCB for a device with per-fd counter */
typedef struct {
    iofunc_ocb_t  hdr;         /* MUST be first — cast-compatible */
    uint32_t      read_count;  /* per-fd read counter */
    void         *priv_buf;    /* per-fd private buffer */
} my_ocb_t;

/* Custom allocator and deallocator */
static IOFUNC_OCB_T *ocb_calloc(resmgr_context_t *ctp, IOFUNC_ATTR_T *attr) {
    my_ocb_t *ocb = calloc(1, sizeof(*ocb));
    if (!ocb) return NULL;
    ocb->priv_buf = malloc(512);
    return (IOFUNC_OCB_T *)ocb;
}
static void ocb_free(IOFUNC_OCB_T *ocb) {
    my_ocb_t *my = (my_ocb_t *)ocb;
    free(my->priv_buf);
    free(my);
}

/* Register allocators in main() */
iofunc_funcs_t ocb_funcs = {
    _IOFUNC_NFUNCS,
    .nfuncs   = _IOFUNC_NFUNCS,
    .ocb_calloc = ocb_calloc,
    .ocb_free   = ocb_free,
};
iofunc_mount_t mount = { .funcs = &ocb_funcs };

/* Pass &mount as the 5th argument to iofunc_attr_init */
iofunc_attr_init(&device_attr, S_IFCHR | 0666, &mount, NULL);
```

---

## Multi-Part Replies

QNX resmgr uses scatter-gather IOVs for zero-copy replies:

```c
static int io_read(resmgr_context_t *ctp, io_read_t *msg,
                   iofunc_ocb_t *ocb) {
    /* Reply with two separate memory regions without copying */
    static const char header[] = "HDR:";
    static const char payload[] = "data payload here\n";

    iov_t parts[2];
    SETIOV(&parts[0], header,  sizeof(header)  - 1);
    SETIOV(&parts[1], payload, sizeof(payload) - 1);

    /* Set total nbytes for the system call return value */
    int total = sizeof(header) - 1 + sizeof(payload) - 1;
    _IO_SET_READ_NBYTES(ctp, total);

    return _RESMGR_NPARTS(2);  /* 2 scatter-gather parts */
}
```

---

## Interrupt Handling Inside a Resource Manager

Device drivers implemented as resource managers typically handle hardware interrupts:

```c
static struct sigevent intr_event;
static int intr_id;

/* ISR: runs in kernel context — minimal work */
static const struct sigevent *uart_isr(void *arg, int id) {
    volatile UART_Regs *uart = (volatile UART_Regs *)arg;
    /* Read status, clear interrupt, return sigevent to wake thread */
    intr_status = uart->status;
    uart->isr_clear = 1;
    return &intr_event;  /* delivers pulse to waiting thread */
}

/* In driver initialization */
void init_driver(void) {
    /* Allow this thread hardware I/O access */
    ThreadCtl(_NTO_TCTL_IO, 0);

    /* Map device registers */
    volatile UART_Regs *regs = mmap_device_memory(NULL, sizeof(UART_Regs),
        PROT_READ|PROT_WRITE|PROT_NOCACHE, 0, UART_BASE_ADDR);

    /* Create channel for interrupt pulse */
    int chid = ChannelCreate(0);
    int coid = ConnectAttach(0, getpid(), chid, _NTO_SIDE_CHANNEL, 0);

    /* Pulse code for our interrupt */
    SIGEV_PULSE_INIT(&intr_event, coid, 21 /*priority*/,
                     UART_INTR_PULSE, 0);

    /* Attach ISR */
    intr_id = InterruptAttach(UART_IRQ, uart_isr, regs,
                              sizeof(*regs), _NTO_INTR_FLAGS_TRK_MSK);
}
```

---

## Pathname Prefixes and the /dev Namespace

Resource managers register in the `/dev/` hierarchy (or any path):

```
/dev/
├── ser1               ← devc-ser8250 (UART resource manager)
├── ser2
├── null               ← devc-null
├── zero               ← devc-null (read returns zeros)
├── random             ← devc-random
├── shmem/             ← POSIX shared memory namespace
├── ptmx               ← pty master
├── pts/1, pts/2, ...  ← pty slave
├── io-net/            ← network device namespace
│   ├── en0            ← Ethernet NIC
│   └── lo0            ← Loopback
├── sd0                ← devb-sdmmc (SD card block device)
├── sd0t12             ← partition 12 of sd0
├── mydevice           ← custom resource manager (our example)
└── ...
```

```bash
# List all resource managers and their paths
ls -la /dev/

# Check which process owns a particular /dev/ entry
fuser /dev/ser1

# Show all registered resmgr paths
resmgr -l
```

---

## POSIX Layer on Top of Resmgr

Because resource managers implement the POSIX message protocol, all standard POSIX file I/O works:

```c
/* Standard POSIX — works perfectly with resource managers */
int fd = open("/dev/mydev", O_RDWR);
struct pollfd pfd = { .fd = fd, .events = POLLIN };

/* poll()/select() calls io_select handler */
poll(&pfd, 1, 5000);  /* 5 second timeout */

if (pfd.revents & POLLIN) {
    char buf[128];
    int n = read(fd, buf, sizeof(buf));
}

/* Even stdio works */
FILE *f = fopen("/dev/mydev", "r");
char line[128];
fgets(line, sizeof(line), f);
fclose(f);
```

---

## Comparison: Resource Manager vs name_attach

| Feature | Resource Manager (`resmgr_attach`) | Name Service (`name_attach`) |
|---------|-----------------------------------|------------------------------|
| POSIX interface | Yes (`open`/`read`/`write`/`ioctl`) | No (custom message structs) |
| Accessible from shell | Yes (`cat /dev/foo`) | No |
| Namespace | `/dev/*` or any path | Global name table |
| Overhead | Slightly higher (message format) | Minimal |
| Best for | Device drivers, file-like services | Fast service-to-service IPC |
| select()/poll() | Yes (via `io_select` callback) | No |
