---
title: QNX IPC & Message Passing
createTime: 2026/03/25 00:00:00
permalink: /kb/embedded/qnx/ipc-message-passing/
---

# QNX IPC & Message Passing

## IPC as the OS Backbone

In QNX Neutrino, **all inter-process communication uses the kernel's synchronous message-passing primitives**. This is not just a convenience — file I/O, device I/O, namespace resolution, and every other OS service is built on top of `MsgSend()` / `MsgReceive()` / `MsgReply()`.

This unified IPC model means:
- A filesystem call and a custom daemon call look identical to application code
- IPC can be profiled, traced, and debugged with the same tools
- The same IPC path works locally or across a network (via QNET)

---

## Core Message Passing Primitives

### MsgSend

```c
#include <sys/neutrino.h>

int MsgSend(int coid,
            const void *smsg, int sbytes,
            void *rmsg,        int rbytes);
```

- **Sends** `sbytes` bytes from `smsg` to the server attached to connection `coid`
- **Blocks** the calling thread in `SEND` state until the server calls `MsgReceive()`, then transitions to `REPLY` state
- Returns when the server calls `MsgReply()` — the return value is the `status` passed to `MsgReply()`
- The reply data is copied into `rmsg` (up to `rbytes` bytes)
- Returns -1 on error; `errno` set

### MsgReceive

```c
int MsgReceive(int chid,
               void *msg, int bytes,
               struct _msg_info *info);
```

- **Waits** for an incoming message on channel `chid`
- Blocks the calling thread in `RECEIVE` state until a client calls `MsgSend()`
- Returns `rcvid` — a unique receive ID used to `MsgReply()` later
- If a **pulse** arrives, returns `rcvid == 0` and fills the pulse fields into `msg` (cast to `struct _pulse`)
- `info` is an optional struct filled with sender's PID, TID, and message sizes

### MsgReceivePulse

```c
int MsgReceivePulse(int chid,
                    void *msg, int bytes,
                    struct _msg_info *info);
```

Identical to `MsgReceive()` but **only accepts pulses** (non-blocking style). Returns immediately if no pulse is queued.

### MsgReply

```c
int MsgReply(int rcvid, int status,
             const void *smsg, int sbytes);
```

- **Unblocks** the sender (`rcvid` identifies which sending thread to unblock)
- `status` is returned as the return value of `MsgSend()` in the client
- Optionally copies `smsg` (reply data) to the client's `rmsg` buffer
- A server must call `MsgReply()` or `MsgError()` for every `MsgSend()` it received

### MsgError

```c
int MsgError(int rcvid, int err);
```

- Variant of `MsgReply()` that returns -1 to the client and sets `errno` to `err`
- Used to signal failure without providing reply data

---

## Complete Client-Server Example

### Server

```c
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/neutrino.h>
#include <sys/iofunc.h>

#define MY_SERVER_NAME "/dev/myserver"

typedef struct {
    uint16_t type;     // Message type
    uint16_t subtype;
    char     data[256];
} MyMsg_t;

int main(void) {
    // Create a channel (receive endpoint)
    int chid = ChannelCreate(0);
    if (chid == -1) { perror("ChannelCreate"); exit(1); }

    // Advertise this server in the namespace via name_attach
    // (links the name to our channel)
    name_attach_t *attach = name_attach(NULL, "myserver", 0);
    if (!attach) { perror("name_attach"); exit(1); }

    printf("Server running, chid=%d\n", chid);

    for (;;) {
        struct _msg_info info;
        MyMsg_t msg;

        int rcvid = MsgReceive(attach->chid, &msg, sizeof(msg), &info);
        if (rcvid == -1) { perror("MsgReceive"); continue; }

        if (rcvid == 0) {
            // Pulse received (e.g., DISCONNECT pulse when client disconnects)
            if (msg.type == _PULSE_CODE_DISCONNECT) {
                ConnectDetach(msg.value.sival_int);
            }
            continue;
        }

        // Process the message
        printf("Received from PID %d: type=%d data='%s'\n",
               info.pid, msg.type, msg.data);

        // Build reply
        MyMsg_t reply;
        reply.type = 0;
        snprintf(reply.data, sizeof(reply.data), "Echo: %s", msg.data);

        MsgReply(rcvid, EOK, &reply, sizeof(reply));
    }

    name_detach(attach, 0);
    ChannelDestroy(chid);
    return 0;
}
```

### Client

```c
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/neutrino.h>

typedef struct {
    uint16_t type;
    uint16_t subtype;
    char     data[256];
} MyMsg_t;

int main(void) {
    // Look up the server by name
    int coid = name_open("myserver", 0);
    if (coid == -1) { perror("name_open"); exit(1); }

    MyMsg_t send_msg, recv_msg;
    memset(&send_msg, 0, sizeof(send_msg));
    send_msg.type = 1;
    snprintf(send_msg.data, sizeof(send_msg.data), "Hello, QNX IPC!");

    int ret = MsgSend(coid, &send_msg, sizeof(send_msg),
                      &recv_msg, sizeof(recv_msg));
    if (ret == -1) { perror("MsgSend"); exit(1); }

    printf("Reply: %s\n", recv_msg.data);

    name_close(coid);
    return 0;
}
```

---

## Channels, Connections, and the Name Service

### Channel Lifecycle

```
Server                              Client
ChannelCreate() → chid              
name_attach(NULL, "foo", 0)         name_open("foo", 0) → coid
                                         internally:
                                         ConnectAttach(nd, pid, chid, ...)
                                    MsgSend(coid, ...)
MsgReceive(chid, ...) → rcvid
...
MsgReply(rcvid, ...)            ←──── client unblocks

                                    name_close(coid)
                                         ConnectDetach(coid)
name_detach(attach, 0)
ChannelDestroy(chid)
```

### name_attach / name_open

The QNX **name service** (managed by `procnto` via `/dev/`) provides a simple registry:

```c
// Server side: register name
#include <sys/iofunc.h>
#include <sys/dispatch.h>

name_attach_t *attach = name_attach(NULL, "my_service", NAME_FLAG_ATTACH_GLOBAL);
// attach->chid is the channel ID to pass to MsgReceive

// Client side: look up by name
int coid = name_open("my_service", 0);
// coid is a connection ID to pass to MsgSend
```

The alternative is to use a **path in the filesystem namespace** (e.g., `/dev/mydevice`) via `resmgr_attach()` — this makes the service look like a file to clients using `open()`/`read()`/`write()`.

---

## Scatter-Gather IPC (IOV)

For performance, QNX supports **vectored message send/receive** using I/O vectors, avoiding large copy:

```c
#include <sys/iov.h>

// Scatter-gather send: send header + data without copying into one buffer
struct header_s {
    uint16_t type;
    uint32_t data_len;
} hdr = { .type = 1, .data_len = data_len };

iov_t sparts[2];
SETIOV(&sparts[0], &hdr, sizeof(hdr));
SETIOV(&sparts[1], data_buf, data_len);

iov_t rparts[1];
SETIOV(&rparts[0], &reply, sizeof(reply));

int ret = MsgSendv(coid, sparts, 2, rparts, 1);

// Server side: read from a specific offset in the client's message
MsgRead(rcvid, &extra_data, sizeof(extra_data), sizeof(hdr));

// Write additional data to the client's reply buffer
MsgWrite(rcvid, &chunk, sizeof(chunk), offset);
```

---

## Pulses

Pulses are **5-byte asynchronous notifications** (1 byte code + 4 byte value). They never block the sender. They are used for:
- Timer expiry notifications
- Interrupt completion signals
- Disconnect notifications
- Custom event delivery between threads/processes

### Pulse Structure

```c
struct _pulse {
    uint16_t type;    // _PULSE_TYPE (always 0)
    uint16_t subtype; // _PULSE_SUBTYPE
    int8_t   code;    // User-defined code (-128 to 127; >= _PULSE_CODE_MINAVAIL)
    uint8_t  zero[3]; // Padding
    union sigval value; // 4-byte value (sival_int or sival_ptr)
    int32_t  scoid;   // Source connection ID
};
```

### Sending Pulses

```c
// From a regular thread
MsgSendPulse(coid, priority, MY_PULSE_CODE, 0xDEAD);

// From an interrupt handler (non-blocking, ISR-safe)
struct sigevent event;
SIGEV_PULSE_INIT(&event, coid, priority, MY_PULSE_CODE, value);
// Pass event to InterruptAttach or TimerCreate

// From kernel pulse delivery (e.g., _PULSE_CODE_DISCONNECT)
// Automatically sent by kernel when a connection is detached
```

### Receiving Pulses in the Event Loop

```c
// Combined message + pulse receive loop
for (;;) {
    union {
        struct _pulse       pulse;
        MyMsg_t             msg;
    } buf;
    struct _msg_info info;

    int rcvid = MsgReceive(chid, &buf, sizeof(buf), &info);

    if (rcvid == 0) {
        // Pulse
        switch (buf.pulse.code) {
        case MY_PULSE_CODE:
            handle_pulse(buf.pulse.value.sival_int);
            break;
        case _PULSE_CODE_DISCONNECT:
            // Client disconnected
            ConnectDetach(buf.pulse.scoid);
            break;
        default:
            break;
        }
    } else {
        // Regular message
        handle_message(rcvid, &buf.msg, &info);
        MsgReply(rcvid, EOK, NULL, 0);
    }
}
```

---

## Priority Inheritance Through IPC

QNX IPC implements **automatic priority inheritance** to prevent priority inversion:

1. Client at priority 20 calls `MsgSend()` to a server running at priority 10
2. The kernel temporarily **boosts the receiving server thread to priority 20** while it processes the request
3. When `MsgReply()` is called, the server's priority returns to 10

This is transparent and requires no explicit programmer intervention. It ensures that a high-priority client is never blocked for longer than the server's actual work time — the server runs at the client's priority.

```
Time ──────────────────────────────────────────────────────────────────────►

Priority 20:  [Client: MsgSend ─────────────────────────────── unblocked]
                               ↓ kernel boosts server            ↑
Priority 10:                   [Server: MsgReceive → work → MsgReply]
```

---

## POSIX Shared Memory

For large data transfer where copying is too expensive, use **POSIX shared memory**:

```c
#include <sys/mman.h>
#include <fcntl.h>

// Producer: create and populate shared memory
int fd = shm_open("/myshared", O_RDWR | O_CREAT, 0660);
ftruncate(fd, 4096);
void *ptr = mmap(NULL, 4096, PROT_READ|PROT_WRITE, MAP_SHARED, fd, 0);
memcpy(ptr, data, data_len);
munmap(ptr, 4096);
close(fd);

// Consumer: attach to existing shared memory
int fd2 = shm_open("/myshared", O_RDONLY, 0);
void *ptr2 = mmap(NULL, 4096, PROT_READ, MAP_SHARED, fd2, 0);
memcpy(local_buf, ptr2, data_len);
munmap(ptr2, 4096);
close(fd2);
shm_unlink("/myshared");  // Remove when done
```

**Pattern**: Use message passing to **signal** when data is ready, shared memory to actually **transfer** the data. This avoids copying large payloads through the kernel.

---

## MsgSend Variants

```c
// Standard: blocks until MsgReply
int MsgSend(int coid, const void *smsg, int sbytes,
            void *rmsg, int rbytes);

// Non-blocking MsgSend (returns immediately; no reply possible)
int MsgSendnc(int coid, const void *smsg, int sbytes,
              void *rmsg, int rbytes);

// Vectorized (scatter-gather)
int MsgSendv(int coid, const iov_t *siov, int sparts,
             const iov_t *riov, int rparts);

// Vectorized non-blocking
int MsgSendvnc(int coid, const iov_t *siov, int sparts,
               const iov_t *riov, int rparts);

// With timeout (CLOCK_MONOTONIC or CLOCK_REALTIME)
// Use sigtimedwait or SIGEV_UNBLOCK pattern for timeouts on MsgSend
```

---

## QNX Name Service vs /dev Namespace

| Mechanism | API | Use Case |
|-----------|-----|----------|
| **name_attach / name_open** | `name_attach()`, `name_open()` | Simple service-to-service IPC; not POSIX-accessible |
| **/dev namespace (resmgr)** | `resmgr_attach()`, then `open()`/`read()`/`write()` | POSIX-compatible; allows shell tools, standard C stdio |
| **POSIX shared memory** | `shm_open()`, `mmap()` | Large data transfer without copying |
| **POSIX message queues** | `mq_open()`, `mq_send()`, `mq_receive()` | POSIX queued messages (uses kernel internally) |
| **Sockets (UNIX domain)** | `socket(AF_UNIX, ...)` | Stream/datagram IPC via io-pkt |
| **Pipes** | `pipe()`, `mkfifo()` | Sequential byte-stream (uses pipe server) |
| **QNET transparent IPC** | `netmgr_remote_nd()` + `ConnectAttach` | Remote node IPC (transparent over network) |

---

## POSIX Message Queues

```c
#include <mqueue.h>

// Create a queue with up to 10 messages of 256 bytes each
struct mq_attr attr = {
    .mq_maxmsg  = 10,
    .mq_msgsize = 256,
};
mqd_t mq = mq_open("/myqueue", O_RDWR | O_CREAT, 0660, &attr);

// Send
char buf[256] = "hello";
mq_send(mq, buf, strlen(buf) + 1, 0);  // priority 0

// Receive (blocks if empty)
ssize_t n = mq_receive(mq, buf, sizeof(buf), NULL);

mq_close(mq);
mq_unlink("/myqueue");
```

---

## IPC Performance

QNX IPC is extremely fast due to kernel-mediated zero-copy implementation:

| Operation | Typical Latency (ARM Cortex-A53 @ 1GHz) |
|-----------|----------------------------------------|
| MsgSend + MsgReply (null message) | ~2–4 µs round-trip |
| MsgSend + MsgReply (256 bytes) | ~4–8 µs round-trip |
| MsgSend + MsgReply (4 KB) | ~10–20 µs round-trip |
| Pulse delivery | ~1–2 µs |
| Context switch (same priority) | ~1–3 µs |

For messages larger than ~4 KB, **shared memory + pulse** becomes faster than `MsgSend()` because it avoids kernel data copying.
