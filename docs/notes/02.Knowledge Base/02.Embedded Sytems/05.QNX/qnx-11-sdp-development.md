---
title: QNX SDP Development Environment
createTime: 2026/03/25 00:00:00
permalink: /kb/embedded/qnx/sdp-development/
---

# QNX SDP Development Environment

## QNX Software Development Platform (SDP) Overview

The **QNX SDP** (Software Development Platform) is the complete toolkit for building QNX applications and BSPs:

| Component | Description |
|-----------|-------------|
| **Host tools** | `qcc`, `ntoaarch64-clang`, `make`, `mkifs`, `dumpifs`, `ntox86_64-gdb` |
| **Target headers** | `/target/qnx/usr/include/` — POSIX + QNX-specific APIs |
| **Target libs** | `/target/qnx/usr/lib/`, `/target/qnx/lib/` |
| **Prebuilt utilities** | `/target/qnx/aarch64le/sbin/`, `/target/qnx/x86_64/usr/bin/` |
| **BSPs** | Board Support Packages (separate download from myqnx.com) |
| **IDE** | Momentics IDE (Eclipse-based) |
| **qconn** | On-target agent enabling remote debugging and file transfer |

### SDP Directory Layout

```
/opt/qnx800/    (or C:\QNX800 on Windows)
├── host/
│   └── linux/
│       └── x86_64/
│           ├── bin/          ← host tools: qcc, ntoaarch64-clang, mkifs
│           ├── usr/
│           │   └── bin/      ← utilities: dumpifs, qconn, ksh
│           └── etc/
│               └── qconfig   ← SDK config
├── target/
│   └── qnx/
│       ├── usr/
│       │   ├── include/      ← all QNX/POSIX headers
│       │   └── lib/          ← import libraries (for linking)
│       ├── aarch64le/
│       │   ├── lib/          ← dynamic libs for AArch64 LE
│       │   ├── usr/
│       │   │   ├── bin/      ← target binaries (qconn, slogger2, etc.)
│       │   │   └── lib/
│       │   └── sbin/
│       └── x86_64/
│           ├── lib/
│           └── usr/
│               ├── bin/
│               └── sbin/
└── qde/                      ← Momentics IDE installation
```

---

## Setting Up the Host Environment

```bash
# Source the QNX environment script to set PATH, QNX_TARGET, QNX_HOST
source /opt/qnx800/qnxsdp-env.sh

# Key environment variables set:
echo $QNX_TARGET    # /opt/qnx800/target/qnx
echo $QNX_HOST      # /opt/qnx800/host/linux/x86_64
echo $PATH          # includes $QNX_HOST/bin, $QNX_HOST/usr/bin

# Verify tools are available
which qcc              # /opt/qnx800/host/linux/x86_64/usr/bin/qcc
which ntoaarch64-clang # /opt/qnx800/host/linux/x86_64/usr/bin/ntoaarch64-clang
which mkifs            # /opt/qnx800/host/linux/x86_64/usr/bin/mkifs
```

---

## Cross-Compilation Toolchain

### qcc — The QNX Compiler Wrapper

`qcc` is a wrapper around `clang`/`gcc` that sets up QNX-specific include paths, library paths, and default flags automatically:

```bash
# Compile for AArch64 LE (most common embedded target)
qcc -Vgcc_ntoaarch64le -o myapp myapp.c

# Compile for x86_64 (testing on a QNX VM)
qcc -Vgcc_ntox86_64 -o myapp myapp.c

# Compile C++ for AArch64
qcc -Vgcc_ntoaarch64le -lang-c++ -o myapp myapp.cpp

# Shared library
qcc -Vgcc_ntoaarch64le -shared -fPIC -o libfoo.so.1 foo.c

# Link with extra libraries
qcc -Vgcc_ntoaarch64le -o myapp myapp.c -lsocket -lm

# Full flags for production
qcc -Vgcc_ntoaarch64le \
    -Wall -Wextra \
    -O2 \
    -g \
    -fstack-protector-strong \
    -D_QNX_SOURCE \
    -o myapp main.c ipc.c
```

### Direct clang Usage

```bash
# Use ntoaarch64-clang directly (more control)
ntoaarch64-clang \
    --sysroot=$QNX_TARGET/aarch64le \
    -target aarch64-unknown-nto-qnx8.0.0 \
    -I$QNX_TARGET/usr/include \
    -L$QNX_TARGET/aarch64le/usr/lib \
    -Wall -O2 -g \
    -o myapp myapp.c

# For x86_64
ntox86_64-clang \
    --sysroot=$QNX_TARGET/x86_64 \
    -target x86_64-pc-nto-qnx8.0.0 \
    -o myapp myapp.c
```

### Checking Dependencies

```bash
# List shared library dependencies (cross-tool)
ntox86_64-objdump -p myapp | grep NEEDED
ntoaarch64le-objdump -p myapp | grep NEEDED

# On the target: list dependencies
ldd myapp

# Get symbol table
ntoaarch64le-nm myapp | grep -v " U "
ntoaarch64le-objdump -d myapp | head -50
```

---

## Makefile Patterns

### Standard QNX Recursive Makefile Structure

```
project/
├── Makefile          ← top-level
├── common.mk         ← shared variables
├── src/
│   ├── Makefile
│   ├── myapp/
│   │   └── Makefile
│   └── mylib/
│       └── Makefile
└── images/
    ├── Makefile
    └── system.build
```

### Top-Level Makefile

```makefile
# Makefile

include qconfig.mk

SUBDIRS = src images

all clean install: recurse

# Recurse into each subdirectory
recurse:
	@for d in $(SUBDIRS); do \
	    $(MAKE) -C $$d $@; \
	done

.PHONY: all clean install recurse
```

### Application Makefile

```makefile
# src/myapp/Makefile

# Processor: aarch64le, x86_64
PROCESSOR ?= aarch64le

CC = qcc -V gcc_nto$(PROCESSOR)
CXX = qcc -V gcc_nto$(PROCESSOR) -lang-c++

CFLAGS = -Wall -Wextra -O2 -g -fstack-protector-strong -D_QNX_SOURCE
LIBS   = -lsocket -lm

TARGET = myapp
SRCS   = main.c ipc.c watchdog.c
OBJS   = $(SRCS:.c=.o)

all: $(TARGET)

$(TARGET): $(OBJS)
	$(CC) $(CFLAGS) -o $@ $(OBJS) $(LIBS)

%.o: %.c
	$(CC) $(CFLAGS) -c $< -o $@

clean:
	rm -rf *.o $(TARGET)

install: $(TARGET)
	cp $(TARGET) $(INSTALL_ROOT)/aarch64le/usr/bin/

.PHONY: all clean install
```

---

## qconfig.mk

The QNX build system uses `qconfig.mk` to locate the SDP:

```makefile
# qconfig.mk (checked into your project)
ifndef QCONFIG
  QCONFIG = qconfig.mk
endif
include $(QCONFIG)

# Set default processor if not specified
PROCESSOR ?= aarch64le

# Host tool paths
CC = qcc -V gcc_nto$(PROCESSOR)
CXX = qcc -V gcc_nto$(PROCESSOR) -lang-c++
AS = nto$(PROCESSOR)-as
AR = nto$(PROCESSOR)-ar
STRIP = nto$(PROCESSOR)-strip

# Install root
INSTALL_ROOT = $(QNX_TARGET)
```

---

## qconn: Target Agent

`qconn` is a daemon running on the QNX target that allows:
- Remote debugging via GDB9+ protocol
- Remote file access (upload/download)
- Process listing and management from Momentics IDE

```bash
# On the target: start qconn (usually in the IFS script)
qconn &

# Or with port specification
qconn 8000 &

# qconn listens on TCP port 8000 (default)
# The host connects to this port for all remote operations
```

---

## Remote Debugging with GDB

### Terminal-Based GDB Debugging

```bash
# === On the target ===
# Start the application, stopped at entry point
pidin                     # find process PID if already running

# === On the host ===
# Connect using the QNX cross-debugger
ntoaarch64-gdb ./myapp

# Inside GDB:
(gdb) target qnx 192.168.1.100:8000      # connect to qconn
(gdb) upload                              # transfer binary to target
(gdb) set args -v --config /etc/myapp.cfg # set command line args
(gdb) run                                 # start execution
(gdb) break main                          # set breakpoint
(gdb) continue
(gdb) print my_variable                  # inspect variable
(gdb) backtrace                          # show call stack
(gdb) info threads                       # list all threads
(gdb) thread 3                           # switch to thread 3
(gdb) info registers                     # dump CPU registers
(gdb) x/20x 0x40000000                  # examine memory
(gdb) set scheduler-locking on          # freeze other threads
```

### Attaching to a Running Process

```bash
# On the host:
ntoaarch64-gdb

(gdb) target qnx 192.168.1.100:8000
(gdb) attach 12345              # attach to PID 12345
(gdb) backtrace
(gdb) detach
```

### Debugging with Core Dumps

```bash
# On the target: configure dumper
COREDUMP=1 COREDUMP_PATH=/var/coredumps ./myapp

# Or enable globally in .script:
dumper -d /var/coredumps &

# On the host: analyze the core dump
ntoaarch64-gdb ./myapp core.12345
(gdb) backtrace
(gdb) info locals
```

---

## Momentics IDE

Momentics is the Eclipse-based QNX IDE providing:
- C/C++ project wizard (QNX C/C++ Project type)
- Cross-compilation with managed build
- Remote target connection via qconn
- Visual debugger with thread + memory views
- System Profiler for kernel event tracing
- Application Profiler (gprof/sampling)
- Memory Analysis (heap profiler)

### Creating a New QNX Project in Momentics

1. **File → New → QNX C++ Project**
2. Set **Project Type**: Application / Shared Library / Static Library
3. Set **Active Configuration**: `Debug` (includes `-g`) or `Release` (includes `-O2`)
4. Set **CPU**: `aarch64le`, `x86_64`, etc.
5. Add source files, configure includes and libraries
6. **Build** (Ctrl+B) → calls `make` with QNX toolchain

### Connecting to a Target

1. **Window → Show View → QNX Targets**
2. Click **Add Target**, enter IP address and port (8000)
3. Right-click target → **Connect**
4. **Run → Debug Configurations → QNX C/C++ QConn**
5. Select binary, set remote path, click **Debug**

---

## Deployment and File Transfer

```bash
# Copy files to target using scp (if SSH is running)
scp myapp root@192.168.1.100:/tmp/
scp myapp.conf root@192.168.1.100:/etc/

# Copy using qcp (QNX-specific, uses qconn protocol)
qcp myapp root@192.168.1.100:8000:/tmp/myapp

# Recursive directory copy
scp -r ./release/ root@192.168.1.100:/opt/myapp/

# Remote execution
ssh root@192.168.1.100 "/opt/myapp/myapp -d"

# Transfer using the send_files utility (from BSP tools)
send_files -h 192.168.1.100 -p 8000 myapp /tmp/myapp
```

---

## Testing on x86_64 QNX VM

For faster development iteration, test on a QNX VM (VMware/VirtualBox) before deploying to embedded target:

```bash
# Build for x86_64
make PROCESSOR=x86_64

# Transfer to VM
scp myapp root@192.168.1.200:/tmp/

# Or run a QNX VM with QEMU
qemu-system-x86_64 \
    -m 512M \
    -nographic \
    -kernel system-x86_64.ifs \
    -net user,hostfwd=tcp::2222-:22,hostfwd=tcp::8000-:8000 \
    -net nic

# Connect to QEMU VM
ssh -p 2222 root@localhost

# Debug against QEMU
ntoaarch64-gdb ./myapp
(gdb) target qnx localhost:8000
```

---

## Building for Multiple Targets

```makefile
# Build for all supported targets
TARGETS = aarch64le x86_64

all:
	@for target in $(TARGETS); do \
	    $(MAKE) PROCESSOR=$$target myapp; \
	    mkdir -p dist/$$target; \
	    mv myapp dist/$$target/; \
	done

# Or use QNX CPULIST mechanism
# In qmake-based builds:
# CPULIST = aarch64le x86_64
```

---

## Useful Development Utilities

| Tool | Description |
|------|-------------|
| `use myapp` | Show command-line usage (reads QNX `use` block from binary) |
| `pidin` | Process/thread/resource viewer |
| `slog2info` | Read system log (slogger2 output) |
| `tracelogger` | Capture kernel event trace |
| `showmem` | Display memory usage |
| `fdinfo` | List open file descriptors |
| `hogs` | Show CPU hogs |
| `top` | Real-time process monitor |
| `ldd` | List shared library dependencies |
| `objdump` | Disassemble and inspect binaries |
| `nm` | List symbols |
| `strings` | Extract printable strings from binary |
| `ntoaarch64-strip` | Strip debug info for release |
| `qcc -v` | Verbose compilation (shows exact clang invocation) |
