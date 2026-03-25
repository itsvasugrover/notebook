---
title: QNX Networking (io-pkt & QNET)
createTime: 2026/03/25 00:00:00
permalink: /kb/embedded/qnx/networking/
---

# QNX Networking: io-pkt & QNET

## Networking Architecture

QNX networking is implemented entirely in user space by the **io-pkt** (I/O Packet) stack — a user-space TCP/IP implementation derived from **NetBSD**'s networking code. This gives it:
- Full BSD socket API compatibility
- User-space fault isolation (io-pkt crashes don't take down the kernel)
- Dynamically loadable protocol and driver modules
- True POSIX sockets

```
Application
  │  socket() / connect() / send() / recv()
  ▼
C Library (POSIX socket API)
  │  MsgSend → io-pkt resource manager
  ▼
io-pkt-v6-hc Process
  │  [TCP/IP stack: BSD-derived — IPv4, IPv6, TCP, UDP, SCTP, ICMP]
  │  [Protocol modules: dll/devnp-*.so]
  ▼
NIC Driver Module (devn-*.so or devnp-*.so)
  │  hardware DMA
  ▼
Network Hardware (GbE, Wi-Fi, etc.)
```

---

## Starting io-pkt

```bash
# Start the network stack (IPv4 + IPv6, high-capacity variant)
io-pkt-v6-hc &

# Start with a specific NIC driver
io-pkt-v6-hc -d /lib/dll/devnp-speedo.so &

# For embedded boards with onboard GbE (e.g., NXP i.MX8):
io-pkt-v6-hc -d fec address=0x30BE0000,irq=118 &

# Multiple NICs on one io-pkt instance
io-pkt-v6-hc \
    -d /lib/dll/devnp-speedo.so   \
    -d /lib/dll/devnp-e1000.so    &
```

### io-pkt Variants

| Binary | Description |
|--------|-------------|
| `io-pkt-v6-hc` | IPv4 + IPv6 + high capacity (default for SDP 7.x+) |
| `io-pkt-v4-hc` | IPv4 only + high capacity |
| `io-pkt-v6` | IPv4 + IPv6 (standard capacity) |

---

## Network Configuration

### Static IP Configuration

```bash
# Configure network interface en0 with static IP
ifconfig en0 192.168.1.100 netmask 255.255.255.0 up

# Add default gateway
route add default 192.168.1.1

# Add DNS (edit /etc/resolv.conf or set via DHCP)
echo "nameserver 8.8.8.8" >> /etc/resolv.conf
```

### DHCP Client

```bash
# Start DHCP client on en0
dhclient en0

# Or use the built-in QNX DHCP client
dhcpcd en0

# Auto-configure (common in BSP startup scripts)
if_up en0
dhcp_start en0
```

### Showing Interface Status

```bash
ifconfig -a        # show all interfaces
ifconfig en0       # show en0 details
netstat -rn        # routing table
netstat -an        # all sockets
netstat -s         # protocol statistics
```

Example `ifconfig en0` output:
```
en0: flags=8843<UP,BROADCAST,RUNNING,SIMPLEX,MULTICAST> mtu 1500
     address: 00:11:22:33:44:55
     media: Ethernet autoselect (1000baseT full-duplex)
     inet 192.168.1.100 netmask 0xffffff00 broadcast 192.168.1.255
     inet6 fe80::211:22ff:fe33:4455%en0 prefixlen 64 scopeid 0x1
```

---

## POSIX Socket Programming

```c
#include <sys/types.h>
#include <sys/socket.h>
#include <netinet/in.h>
#include <arpa/inet.h>
#include <unistd.h>

/* ── TCP Server ─────────────────────────────────────────────────── */

int server_fd = socket(AF_INET, SOCK_STREAM, 0);

int opt = 1;
setsockopt(server_fd, SOL_SOCKET, SO_REUSEADDR, &opt, sizeof(opt));

struct sockaddr_in addr = {
    .sin_family = AF_INET,
    .sin_addr.s_addr = INADDR_ANY,
    .sin_port = htons(8080),
};
bind(server_fd, (struct sockaddr *)&addr, sizeof(addr));
listen(server_fd, 5);

struct sockaddr_in client_addr;
socklen_t client_len = sizeof(client_addr);
int client_fd = accept(server_fd, (struct sockaddr *)&client_addr, &client_len);
char buf[1024];
recv(client_fd, buf, sizeof(buf), 0);
send(client_fd, "OK\n", 3, 0);
close(client_fd);
close(server_fd);

/* ── UDP Client ─────────────────────────────────────────────────── */

int sock = socket(AF_INET, SOCK_DGRAM, 0);
struct sockaddr_in dest = {
    .sin_family = AF_INET,
    .sin_port   = htons(9000),
};
inet_pton(AF_INET, "192.168.1.200", &dest.sin_addr);

sendto(sock, "ping", 4, 0, (struct sockaddr *)&dest, sizeof(dest));
close(sock);

/* ── IPv6 TCP Client ─────────────────────────────────────────────── */

int fd = socket(AF_INET6, SOCK_STREAM, 0);
struct sockaddr_in6 addr6 = {
    .sin6_family = AF_INET6,
    .sin6_port   = htons(443),
};
inet_pton(AF_INET6, "2001:db8::1", &addr6.sin6_addr);
connect(fd, (struct sockaddr *)&addr6, sizeof(addr6));
```

---

## Non-Blocking I/O and select()/poll()

```c
#include <sys/select.h>
#include <poll.h>
#include <fcntl.h>

/* Set socket non-blocking */
int flags = fcntl(fd, F_GETFL, 0);
fcntl(fd, F_SETFL, flags | O_NONBLOCK);

/* poll(): wait on multiple fds */
struct pollfd fds[2];
fds[0].fd     = server_fd;
fds[0].events = POLLIN;
fds[1].fd     = pipe_read_end;
fds[1].events = POLLIN;

int ret = poll(fds, 2, 5000);  /* 5 second timeout */
if (ret > 0) {
    if (fds[0].revents & POLLIN) accept_connection();
    if (fds[1].revents & POLLIN) read_pipe_data();
}

/* select() */
fd_set readfds;
FD_ZERO(&readfds);
FD_SET(server_fd, &readfds);
struct timeval tv = { .tv_sec = 1, .tv_usec = 0 };
select(server_fd + 1, &readfds, NULL, NULL, &tv);
```

---

## Unix Domain Sockets

```c
#include <sys/un.h>

/* Server */
int srv = socket(AF_UNIX, SOCK_STREAM, 0);
struct sockaddr_un su;
memset(&su, 0, sizeof(su));
su.sun_family = AF_UNIX;
strncpy(su.sun_path, "/tmp/myapp.sock", sizeof(su.sun_path) - 1);
unlink(su.sun_path);
bind(srv, (struct sockaddr *)&su, SUN_LEN(&su));
listen(srv, 5);

/* Client */
int cli = socket(AF_UNIX, SOCK_STREAM, 0);
connect(cli, (struct sockaddr *)&su, SUN_LEN(&su));
send(cli, "hello", 5, 0);
```

---

## NIC Driver Modules (devnp-*.so)

QNX uses **loadable NIC driver modules** rather than compiled-in drivers:

| Driver Module | Hardware |
|--------------|----------|
| `devnp-speedo.so` | Intel Pro/100 (Speedo) |
| `devnp-e1000.so` | Intel Pro/1000 (GbE) |
| `devnp-bcm*.so` | Broadcom GbE |
| `devnp-fec.so` | NXP FEC (Freescale Fast Ethernet) |
| `devnp-dwcgmac.so` | Synopsys DesignWare GbE |
| `devnp-mxgebc.so` | Myricom 10 GbE |
| `devnp-ath.so` | Atheros Wi-Fi |

### io-pkt Driver Options

```bash
# Load with driver-specific options
io-pkt-v6-hc -d /lib/dll/devnp-e1000.so \
    "ioaddr=0xe0000000,irq=11,speed=1000,duplex=full" &

# Specify multiple driver instances (multiple NICs)
io-pkt-v6-hc \
    -d "/lib/dll/devnp-fec.so address=0x30BE0000,irq=118,phy=0" \
    -d "/lib/dll/devnp-fec.so address=0x30BF0000,irq=119,phy=1" &

# After startup, configure each interface
ifconfig fec0 192.168.1.100/24 up
ifconfig fec1 10.0.0.1/8 up
```

---

## QNX Native Networking: QNET

**QNET** (QNX Transparent Distributed Processing) is QNX's native network protocol that makes remote processes appear local. It extends the QNX IPC model across a network:

```
Node A                              Node B
───────────                         ───────────
My program                          Remote server
   │                                     │
   │ ConnectAttach(                       │
   │   remote_nd,  ← node descriptor     │
   │   server_pid,                        │
   │   server_chid)                       │
   │                                     │
   │ MsgSend(coid, ...)  ══════════════► MsgReceive()
   ◄══════════════════════════════════   MsgReply()
```

```bash
# Load QNET support
npm-qnet &

# Show connected QNET nodes
ls /net/
# Output: node1, 192.168.1.101, myserver

# Connect to a remote node
cd /net/192.168.1.101/

# Open a remote file
cat /net/192.168.1.101/tmp/logfile.txt

# Run a program on remote node using on utility
on /net/192.168.1.101 ls -la /

# In C: get node descriptor for remote node
uint32_t nd = netmgr_remote_nd(NETMGR_ND_LOCAL_NODE, "192.168.1.101");
int coid = ConnectAttach(nd, remote_pid, remote_chid,
                         _NTO_SIDE_CHANNEL, 0);
MsgSend(coid, &msg, sizeof(msg), &reply, sizeof(reply));
```

---

## Firewall / Packet Filtering

QNX uses a BSD-derived **packet filter (pf)** or `ipf` for firewalling:

```bash
# Enable IP forwarding (for NAT/router use)
sysctl -w net.inet.ip.forwarding=1

# IPFilter rules (similar to Linux iptables)
# Edit /etc/ipf.conf
# Block all incoming except SSH:
# block in all
# pass in proto tcp from any to any port = 22 keep state

# Load rules
ipf -f /etc/ipf.conf

# NAT configuration (/etc/ipnat.conf)
# map en0 192.168.2.0/24 -> 0/32

# Apply NAT
ipnat -f /etc/ipnat.conf
```

---

## Network Namespaces (SDP 8.0)

QNX SDP 8.0 supports **separate network namespace instances** for container-like isolation:

```bash
# Create a second isolated network stack instance
io-pkt-v6-hc -p /dev/io-net2 -d devnp-e1000.so &

# Configure the second instance
nicinfo -p /dev/io-net2 en0
ifconfig -p /dev/io-net2 en0 10.1.0.1/24 up
```

---

## Network Diagnostics Tools

```bash
# Ping
ping 192.168.1.1
ping6 fe80::1%en0

# Trace route
traceroute 8.8.8.8

# DNS lookup
nslookup google.com
host google.com

# Netstat
netstat -rn           # routing table
netstat -an           # all connections + listening sockets
netstat -s            # per-protocol statistics
netstat -i            # interface statistics

# Interface statistics
nicinfo               # QNX NIC statistics tool
nicinfo en0           # specific interface

# Bandwidth test (requires netserver on target)
iperf3 -s &           # server mode
iperf3 -c 192.168.1.1 # client, TCP throughput test
iperf3 -c 192.168.1.1 -u  # UDP test

# Packet capture
tcpdump -i en0 -n port 8080
tcpdump -i en0 -w /tmp/capture.pcap

# Socket statistics
fstat                 # open files + sockets per process
```

---

## SCTP Support

QNX io-pkt supports **SCTP** (Stream Control Transmission Protocol) for multi-homed, multi-stream reliable transport:

```c
#include <sys/socket.h>
#include <netinet/sctp.h>

int fd = socket(AF_INET, SOCK_SEQPACKET, IPPROTO_SCTP);

struct sctp_initmsg init = {
    .sinit_num_ostreams   = 5,
    .sinit_max_instreams  = 5,
    .sinit_max_attempts   = 3,
};
setsockopt(fd, IPPROTO_SCTP, SCTP_INITMSG, &init, sizeof(init));

struct sockaddr_in addr = {
    .sin_family = AF_INET,
    .sin_port   = htons(9900),
    .sin_addr.s_addr = INADDR_ANY,
};
bind(fd, (struct sockaddr *)&addr, sizeof(addr));
listen(fd, 5);
```

---

## Summary: io-pkt vs QNET

| Feature | io-pkt (TCP/IP) | QNET |
|---------|----------------|------|
| Protocol | TCP/IP, UDP, IPv4/IPv6 | QNX native protocol |
| API | POSIX sockets | QNX IPC (ConnectAttach) |
| Transparency | No (need to know IP:port) | Yes (same as local IPC) |
| Transport | Ethernet, Wi-Fi, serial | Any io-pkt-enabled link |
| Firewall | pf/ipf | None (OS-level only) |
| Use case | Internet/LAN communication | QNX-to-QNX node IPC |
| Priority-aware | No | Yes (IPC priorities preserved) |
