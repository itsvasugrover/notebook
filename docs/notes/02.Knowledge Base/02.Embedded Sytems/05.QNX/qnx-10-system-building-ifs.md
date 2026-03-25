---
title: QNX System Building & IFS
createTime: 2026/03/25 00:00:00
permalink: /kb/embedded/qnx/system-building-ifs/
---

# QNX System Building & IFS

## What Is an IFS?

An **IFS** (Image File System) is a **bootable filesystem image** that contains everything needed to start a QNX Neutrino system:
- The kernel (`procnto-smp-instr`)
- Startup code (`startup-boardname`)
- Essential device drivers
- System utilities
- Initial configuration scripts
- Optionally: application binaries and data

The IFS is produced by the **`mkifs`** tool from a **build script** (`.build` file). The resulting `*.ifs` binary is written to flash, SD card boot partition, or served via TFTP.

---

## Boot Image Structure

```
QNX IFS Image
┌────────────────────────────────────────────────────┐
│  Image Header                                      │
│  (magic, size, checksum, entry point)              │
├────────────────────────────────────────────────────┤
│  Startup Section (startup-boardname)               │
│  • Hardware init: DRAM, clocks, PLLs, WDT          │
│  • Fills the syspage (hardware description)        │
│  • Jumps to procnto entry point                    │
├────────────────────────────────────────────────────┤
│  Rampatch (optional, board-specific errata fixes)  │
├────────────────────────────────────────────────────┤
│  Filesystem Section                                │
│  ├── procnto-smp-instr (kernel + process manager)  │
│  ├── slogger2          (system logger)             │
│  ├── pipe              (POSIX pipe server)         │
│  ├── devc-ser8250      (serial console driver)     │
│  ├── devb-sdmmc        (SD/eMMC driver)            │
│  ├── io-pkt-v6-hc      (TCP/IP stack)              │
│  ├── libc.so.x         (C library)                │
│  ├── libm.so.x         (math library)              │
│  ├── cmd/sh            (shell)                     │
│  ├── myapp             (application binary)        │
│  └── .script           (startup script)           │
└────────────────────────────────────────────────────┘
```

---

## Build Script Structure

The build script (conventionally named `system.build` or `*.build`) has three sections:

```
[virtual=x86_64,elf] .bootstrap = {
    startup-x86
    PATH=/proc/boot procnto-smp-instr
}

[+script] .script = {
    # Initialization commands run by procnto
    procmgr_symlink ../../proc/boot/libc.so.6 /usr/lib/ldqnx-64.so.2
    slogger2 &
    pipe &
    ...
}

# Files to include in the IFS filesystem section
[uid=0 gid=0 perms=0755] /proc/boot/myapp = myapp
[uid=0 gid=0 perms=0644] /etc/myapp.cfg = myapp.cfg
```

---

## Annotated Build Script Example

```bash
# system.build — QNX IFS build script for a custom ARM board
# Produced by: mkifs -r $QNX_TARGET system.build system.ifs

# ── Global attributes ────────────────────────────────────────────────────
[image=0x81000000]                  # Load address in RAM
[virtual=aarch64le,elf]             # Architecture
[page_size=0x1000]                  # 4 KB pages

# ── Bootstrap section: brings up the hardware ────────────────────────────
.bootstrap = {
    # 1. Board startup: clocks, DRAM init, fills syspage
    startup-myboard -D 115200,-u 1 -v

    # 2. Kernel — must be first after startup
    PATH=/proc/boot procnto-smp-instr -v
}

# ── Script section: runs after kernel starts ─────────────────────────────
[+script] .script = {
    # Set up dynamic linker symlink
    procmgr_symlink ../../proc/boot/libc.so.6 /usr/lib/ldqnx-64.so.2

    # Start system logger (receives slog2 messages)
    PATH=/proc/boot LD_LIBRARY_PATH=/proc/boot slogger2 &

    # Start pipe server (POSIX pipes)
    PATH=/proc/boot pipe &

    # Start console (UART1)
    PATH=/proc/boot devc-ser8250 -e -b115200 -c96000000 0x3F8,4 &
    waitfor /dev/ser1 4
    reopen /dev/ser1

    # Start SD/eMMC driver
    PATH=/proc/boot devb-sdmmc blk automount=sd0 sdio &
    waitfor /dev/sd0 5

    # Mount root filesystem from SD card partition 1 (QNX6)
    mount -t qnx6 /dev/sd0t12 /
    waitfor / 5

    # Start network stack
    PATH=/proc/boot io-pkt-v6-hc &
    waitfor /dev/io-net 5
    ifconfig en0 192.168.1.100 netmask 255.255.255.0 up
    route add default 192.168.1.1

    # Start SSH daemon
    /usr/sbin/sshd &

    # Application startup
    myapp &

    # Drop to shell if app fails
    [+session] sh
}

# ── Files included in /proc/boot (initial RAM filesystem) ────────────────

# Kernel and startup (auto-included from above, listed for clarity)
procnto-smp-instr

# Core runtime libraries
libc.so.6
libm.so.3
libz.so.2
libstdc++.so.6

# Drivers
devc-ser8250
devb-sdmmc
io-pkt-v6-hc

# System utilities
[type=link] /proc/boot/libc.so.6=/usr/lib/ldqnx-64.so.2
sh
ls
cat
cp
mv
rm
mkdir
mount
ifconfig
route
slogger2
slog2info
pipe
pidin

# Application with assets
[uid=0 gid=0 perms=0755] /proc/boot/myapp = ${WORKSPACE}/release/myapp
[uid=0 gid=0 perms=0644] /proc/boot/myapp.conf = ${WORKSPACE}/config/myapp.conf

# Libraries required by myapp (use ldd on host to find them)
libmylib.so.1
```

---

## mkifs: Building the Image

```bash
# Basic build
mkifs system.build system.ifs

# With verbose output
mkifs -v system.build system.ifs

# Specify target path for library lookups
mkifs -r $QNX_TARGET system.build system.ifs

# Debug: list image contents
mkifs -l system.build system.ifs

# Verify existing image contents
dumpifs system.ifs

# Extract a file from the image
dumpifs -x procnto-smp-instr system.ifs
```

---

## dumpifs: Inspecting an Image

```bash
# List all files in the image
dumpifs system.ifs

# Example output:
# Offset      Size  Attr  Name
#       0      4136  ----  .bootstrap
#    1028    438272  -r-x  procnto-smp-instr
#  440296     24576  -r-x  startup-myboard
#  464872       512  ----  .script
#  465384     16384  -r-x  devc-ser8250
#  481768    ...

# Show image header
dumpifs -i system.ifs

# Extract a specific binary
dumpifs -x myapp system.ifs

# Dump full symbol table
dumpifs -s system.ifs
```

---

## Build Script Attributes

Attributes modify files or sections of the build script:

| Attribute | Description |
|-----------|-------------|
| `uid=N` | File UID in the IFS |
| `gid=N` | File GID |
| `perms=0NNN` | File permissions |
| `+script` | This section is the init script |
| `+compress` | Compress included file (uses deflate) |
| `+raw` | Include file as raw binary (no ELF processing) |
| `+bigendian` / `+littleendian` | Byte order |
| `physical=0xADDR` | Place this file at a specific physical address |
| `virtual=0xADDR` | Virtual address for this section |
| `virtual=arch,elf` | Specify target architecture |
| `keep` | Do not compress this section |
| `type=link` | In-IFS symbolic link |
| `align=N` | Alignment requirement |

```bash
# Compressed application (reduces IFS size, decompressed on load)
[+compress perms=0755] /proc/boot/myapp = myapp

# Place at specific physical address (e.g., for DMA buffer)
[physical=0x30000000 virtual=0x30000000 +raw perms=0644]
    /proc/boot/firmware.bin = firmware.bin

# Internal symbolic link
[type=link] /proc/boot/libfoo.so.1 = libfoo.so.1.2.3
```

---

## The .script Section In Depth

The `.script` section is executed by `procnto` as a minimal shell. Available commands:

| Command | Description |
|---------|-------------|
| `display_msg` | Print a message to console |
| `waitfor` | Wait for a file/device to appear |
| `reopen` | Close stdin/stdout/stderr, reopen on specified device |
| `procmgr_symlink` | Create a symbolic link in the namespace |
| `mount` | Mount a filesystem |
| `[+session]` | Start a foreground session (shell) |
| Standard sh | `&`, `if`, `for`, `sleep`, environment variables |

```bash
[+script] .script = {
    # Print startup message
    display_msg "Starting QNX on MyBoard v2.0"

    # Wait up to 5 seconds for /dev/ser1 to appear
    waitfor /dev/ser1 5

    # Redirect console to serial port
    reopen /dev/ser1

    # Mount extra filesystems
    mount -t qnx6 /dev/sd0t79 /usr
    mount -t tmpfs tmpfs /tmp
    mount -t tmpfs tmpfs /var/run

    # Start all services
    io-pkt-v6-hc &
    waitfor /dev/io-net 3
    dhclient en0 &

    # Run init script from disk (after / is mounted)
    /etc/rc.d/rc.local &

    # Interactive shell as fallback
    [+session] sh
}
```

---

## BSP (Board Support Package) Structure

A QNX BSP provides the board-specific startup code and drivers:

```
bsp-myboard/
├── Makefile
├── prebuilt/
│   └── nto/
│       └── aarch64le/
│           └── boot/
│               └── sys/
│                   └── startup-myboard    ← prebuilt startup binary
├── src/
│   ├── hardware/
│   │   ├── startup/
│   │   │   └── boards/
│   │   │       └── myboard/
│   │   │           ├── main.c             ← startup entry point
│   │   │           ├── init_board.c       ← clocks, PLL, DDR init
│   │   │           ├── callout_*.s        ← interrupt callouts (ASM)
│   │   │           └── Makefile
│   │   └── devi/
│   │       └── myboard-gpio/             ← GPIO driver
│   └── lib/
│       └── libhw-i2c-myboard/            ← I2C HAL library
├── images/
│   └── system.build                      ← IFS build script
└── prebuilt/
    └── nto/
        └── aarch64le/
            └── lib/
                └── dll/
                    └── devnp-myboard.so  ← board-specific NIC driver
```

---

## Startup Code Internals

The `startup-boardname` binary runs before the kernel. It:

1. Initializes DDR (SDRAM controller, PHY training)
2. Configures PLLs and clocks
3. Sets up UART for early console output
4. Initializes the **syspage** — a kernel data structure describing hardware
5. Calls `cpu_startup()` → sets up MMU, exception vectors
6. Calls `main()` in `startup/boards/boardname/main.c`
7. Jumps to `procnto` entry point

```c
/* startup-myboard/main.c */
#include <startup.h>

void board_startup(void) {
    /* Initialize clocks */
    init_clocks();

    /* Initialize DRAM controller */
    init_ddr();

    /* Add UART for syspage */
    add_typed_string(_CS_MACHINE, "MyBoard v2.0");
    hwi_add_device(HWI_ITEM_BUS_UNKNOWN, HWI_ITEM_DEVCLASS_SERIAL,
                   "8250", 0);
    hwi_add_inputclk(96000000, 1);
    hwi_add_location(UART_BASE, 0x1000, hwi_find_as(UART_BASE, 1), 0);
    hwi_add_irq(UART_IRQ);

    /* Add memory regions to syspage */
    as_add(0x40000000, 0x7FFFFFFF, AS_ATTR_RAM, "ram", "memory");
}
```

---

## Deploying and Flashing the IFS

### Flashing to SPI NOR Flash

```bash
# On the host: write system.ifs to SPI flash via programmer
# On the target: write via flashctl
flashctl -p /dev/fs0 -ev            # erase
dd if=system.ifs of=/dev/fs0        # write
```

### Booting via TFTP

Configure U-Boot or QNXIPL to load the IFS via TFTP:
```
# U-Boot environment
setenv serverip 192.168.1.1
setenv ipaddr 192.168.1.100
tftp 0x81000000 system.ifs
go 0x81000000
```

### SD Card Boot

```bash
# Write IFS to first partition of SD card (raw, no filesystem)
dd if=system.ifs of=/dev/mmcblk0p1 bs=512
```

---

## Build Automation with Makefiles

```makefile
# Makefile for IFS build
QNX_TARGET ?= /path/to/qnx800/target/qnx
PROCESSOR  = aarch64le
IMAGE      = system.ifs
BUILDFILE  = system.build

$(IMAGE): $(BUILDFILE) $(DEPS)
	mkifs -r $(QNX_TARGET) -p $(PROCESSOR) $(BUILDFILE) $(IMAGE)

clean:
	rm -f $(IMAGE)

deploy: $(IMAGE)
	scp $(IMAGE) root@192.168.1.100:/tmp/
	ssh root@192.168.1.100 "dinit -x /tmp/$(IMAGE) /dev/sd0"

.PHONY: clean deploy
```
