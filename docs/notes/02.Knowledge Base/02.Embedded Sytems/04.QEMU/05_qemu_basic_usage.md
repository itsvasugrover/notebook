---
title: QEMU Basic Usage
createTime: 2026/03/14 14:21:19
permalink: /kb/embedded/qemu/qemu-basic-usage/
---

# QEMU Basic Usage

This page covers the complete command-line interface for `qemu-system-*`, including machine configuration, storage backends, networking modes, the QEMU Monitor, QMP, and semihosting — all topics needed for effective embedded and systems-level work.

---

## Command Structure

Every `qemu-system-<arch>` invocation follows the same pattern:

```
qemu-system-<arch> [machine options] [cpu options] [memory options] \
    [storage options] [network options] [serial/display options] \
    [kernel options] [debug options]
```

All options are parsed left to right with no mandatory ordering. Options that accept sub-parameters use a comma-separated key=value syntax:

```bash
-drive file=disk.qcow2,format=qcow2,if=virtio,cache=writeback
```

---

## Machine Selection (`-M` / `-machine`)

The `-M` flag selects a machine type. Each machine type hard-codes a specific board topology: memory map, peripherals, interrupt controller, reset vector.

```bash
qemu-system-arm -M help          # list all ARM machines
qemu-system-aarch64 -M virt      # generic AArch64 virtual platform
qemu-system-arm -M mps2-an385    # ARM MPS2 with Cortex-M3
qemu-system-riscv32 -M sifive_e  # SiFive E-series RISC-V
```

For forward compatibility, machine names are versioned. An unversioned name like `virt` is an alias for the latest. Use `virt-8.2` to pin to a specific QEMU release:

```bash
qemu-system-aarch64 -M virt-8.2,highmem=off,gic-version=3
```

Machine properties are appended as comma-separated key=value pairs after the machine name. Inspect available properties:

```bash
qemu-system-aarch64 -M virt,help
```

---

## CPU Selection (`-cpu`)

The CPU model determines instruction set extensions, feature flags, and stepping emulation:

```bash
qemu-system-arm -M virt -cpu cortex-a53       # specific model
qemu-system-aarch64 -M virt -cpu max          # all features enabled
qemu-system-x86_64 -cpu host                  # pass through host CPU flags (KVM)
qemu-system-arm -cpu cortex-m3,help           # list available features
```

The `max` pseudo-CPU enables every extension QEMU supports for that ISA. This is useful when you want maximum software compatibility but don't need cycle-accurate CPU model matching.

For embedded Cortex-M machines the CPU is usually fixed by the machine type and cannot be changed:

```bash
qemu-system-arm -M mps2-an385   # always Cortex-M3; -cpu is ignored
```

---

## Memory (`-m`)

```bash
-m 256M          # 256 megabytes
-m 1G            # 1 gigabyte
-m size=4G,slots=4,maxmem=16G   # hotplug memory
```

QEMU maps guest RAM as anonymous `mmap` regions in the QEMU host process. For performance-sensitive use, back RAM with huge pages (see [Performance Optimization](/kb/embedded/qemu/qemu-performance-optimization/)).

---

## SMP and Multicore (`-smp`)

```bash
-smp 4                                 # 4 vCPUs
-smp cpus=4,cores=2,threads=2,sockets=1   # topology
```

With KVM each vCPU is a host thread. With TCG, all vCPUs are serialized unless `-accel tcg,thread=multi` is set (which comes with memory ordering caveats).

---

## Storage

### `-drive` (legacy but universal)

```bash
-drive file=rootfs.ext4,format=raw,if=sd,id=sd0
-drive file=flash.bin,format=raw,if=pflash,readonly=on
-drive file=disk.qcow2,format=qcow2,if=virtio,cache=writeback,aio=native,cache.direct=on
```

Key sub-options:

| Option | Description |
|--------|-------------|
| `file=` | Image path or block device |
| `format=` | `raw`, `qcow2`, `vmdk`, `vhdx` |
| `if=` | Interface: `virtio`, `ide`, `sd`, `pflash`, `none` |
| `cache=` | `writeback` (default), `writethrough`, `none`, `directsync` |
| `aio=` | `threads` (default), `native`, `io_uring` |
| `readonly=on` | Read-only mount |

### qcow2 Format

qcow2 (QEMU Copy-On-Write v2) is the preferred disk image format. It supports sparse allocation, internal snapshots, compression, and encryption. Create an image:

```bash
qemu-img create -f qcow2 disk.qcow2 8G
qemu-img info disk.qcow2
```

qcow2 stores data in clusters (default 64 KB). The first cluster contains the header plus L1 table; L2 tables index actual data clusters. Reads to un-allocated regions return zeroes; writes allocate new clusters on first access.

### `-blockdev` + `-device` (modern split)

```bash
-blockdev driver=qcow2,file.driver=file,file.filename=disk.qcow2,node-name=hd0 \
-device virtio-blk-pci,drive=hd0
```

`-blockdev` creates a named storage node graph. `-device` attaches it to a guest-visible device. This separates storage topology from device model and is required for advanced I/O features.

---

## Networking

QEMU supports six networking architectures for the guest NIC backend.

### User Mode (SLIRP) — default

```bash
-netdev user,id=net0 -device virtio-net-pci,netdev=net0
# with port forwarding
-netdev user,id=net0,hostfwd=tcp::2222-:22,hostfwd=tcp::8080-:80 \
-device virtio-net-pci,netdev=net0
```

The SLiRP backend implements a minimal TCP/IP stack inside QEMU's user process. The guest gets a NAT'd 10.0.2.x subnet. No root access needed. Latency is high (~2–5 ms), throughput limited (~100–300 Mbps). Guest can initiate connections; incoming connections require explicit port forwarding. DNS resolves via `10.0.2.3`.

### TAP — kernel bridge

```bash
# Host setup (one time)
sudo ip tuntap add dev tap0 mode tap user $USER
sudo ip link set tap0 up
sudo ip link add br0 type bridge
sudo ip link set eth0 master br0
sudo ip link set tap0 master br0

# QEMU
-netdev tap,id=net0,ifname=tap0,script=no,downscript=no \
-device virtio-net-pci,netdev=net0
```

TAP creates a virtual Ethernet interface on the host that appears as a kernel network device. Packets are transferred via the `/dev/net/tun` kernel facility. The guest sees a real Ethernet segment and can obtain DHCP addresses from a real DHCP server.

### Socket — VM-to-VM

Connect two QEMU instances via a virtual cable:

```bash
# First VM (listen)
-netdev socket,id=net0,listen=:4444 -device e1000,netdev=net0

# Second VM (connect)
-netdev socket,id=net0,connect=127.0.0.1:4444 -device e1000,netdev=net0
```

### VDE (Virtual Distributed Ethernet)

Connects to a running VDE switch for complex virtual network topologies:

```bash
-netdev vde,id=net0,sock=/var/run/vde2/tap.ctl -device virtio-net-pci,netdev=net0
```

### Hubmode and None

```bash
-net nic -net hubmode    # legacy multi-VM hub
-nic none                # disable networking entirely
```

---

## Serial and Console

### `-serial`

```bash
-serial stdio                    # connect to host terminal
-serial null                     # discard output
-serial file:/tmp/serial.log     # write to file
-serial tcp::5555,server,nowait  # expose as TCP server
-serial pty                      # allocate pseudo-terminal (prints path)
-serial mon:stdio                # multiplex serial + QEMU Monitor
```

For embedded targets with no display, combine `-nographic -serial stdio` to route guest UART0 to the terminal. `Ctrl-A X` exits QEMU in this mode.

### `-chardev` + `-serial` (modern split)

```bash
-chardev socket,id=s0,host=localhost,port=9999,server=on,wait=off \
-serial chardev:s0
```

`-chardev` creates a named host I/O backend. Backends include: `stdio`, `file`, `socket`, `udp`, `pty`, `pipe`, `ringbuf`, `null`, `spicevmc`.

---

## Display

| Option | Description |
|--------|-------------|
| `-nographic` | Disable all graphical output; serial0 → stdio |
| `-display gtk` | GTK+ window (default on desktop installs) |
| `-display sdl` | SDL2 window |
| `-display vnc=:1` | VNC server on display :1 (port 5901) |
| `-display curses` | Curses text-mode display |
| `-display none` | No display, but don't route serial to stdio |
| `-vga std` | Standard VGA adapter (x86 guests) |
| `-vga virtio` | VirtIO-GPU (better performance) |

For headless CI use `-nographic` or `-display none -serial stdio`.

---

## Kernel and Firmware Loading

```bash
-kernel Image           # Linux kernel or bare-metal ELF/binary
-initrd rootfs.cpio.gz  # initial ramdisk
-append "console=ttyAMA0 root=/dev/vda rw"  # kernel cmdline
-dtb board.dtb          # device tree blob
-bios u-boot.bin        # BIOS/firmware image
-pflash flash0.bin      # parallel flash (NOR Flash)
```

For Cortex-M targets the firmware is typically loaded via `-kernel`:

```bash
qemu-system-arm -M mps2-an385 -kernel firmware.elf -nographic
```

QEMU can load ELF files directly, respecting section load addresses from program headers.

---

## QEMU Monitor

The QEMU Monitor is an interactive control interface for the running VM. Access it by:

- Pressing `Ctrl-A C` when using `-serial mon:stdio` or `-nographic`
- Using `-monitor stdio` to dedicate stdio to the monitor
- Connecting a chardev: `-monitor unix:/tmp/qemu.sock,server,nowait`

### Key Monitor Commands

```
(qemu) help                        # list all commands
(qemu) info status                 # running / paused
(qemu) info registers             # dump CPU registers
(qemu) info mem                   # guest page table walk
(qemu) info mtree                 # memory region tree
(qemu) info qtree                 # device tree (QOM)
(qemu) info network               # network interfaces
(qemu) info block                 # block devices

(qemu) stop                       # pause execution
(qemu) cont                       # resume execution
(qemu) quit                       # terminate QEMU

(qemu) x /10i $pc                 # disassemble 10 instructions at PC
(qemu) x /4xg 0x40000000         # hex dump 4 qwords at address
(qemu) xp /4xw 0x1000            # physical memory hex dump
(qemu) p $r0                      # print register value

(qemu) sendkey ctrl-alt-delete    # send key sequence to guest
(qemu) screendump screenshot.ppm  # capture display to file

(qemu) savevm snap1               # save VM snapshot
(qemu) loadvm snap1               # restore snapshot
(qemu) delvm snap1                # delete snapshot
(qemu) info snapshots             # list snapshots

(qemu) drive_add 0 file=disk2.qcow2,format=qcow2,if=none,id=hd1
(qemu) device_add virtio-blk-pci,drive=hd1    # hot-plug device
(qemu) device_del device-id                    # hot-remove device
```

---

## QMP (QEMU Machine Protocol)

QMP is a JSON-based machine-readable version of the Monitor, designed for automation and tooling (libvirt, cloud platforms, test harnesses). Connect via Unix socket:

```bash
qemu-system-aarch64 -M virt \
    -qmp unix:/tmp/qmu.sock,server,nowait \
    ...
```

Communicate with `socat` or Python:

```bash
socat - UNIX-CONNECT:/tmp/qmu.sock
```

```
# Server greeting
{"QMP": {"version": {...}, "capabilities": [...]}}

# Negotiate capabilities
{"execute": "qmp_capabilities"}

# Response
{"return": {}}

# Query status
{"execute": "query-status"}
{"return": {"status": "running", "singlestep": false, "running": true}}

# Pause VM
{"execute": "stop"}

# Resume
{"execute": "cont"}

# System reset
{"execute": "system_reset"}
```

Python usage (using the `qemu.machine` module from the QEMU source tree):

```python
from qemu.machine import QEMUMachine

with QEMUMachine('/usr/bin/qemu-system-aarch64') as vm:
    vm.set_machine('virt')
    vm.add_args('-cpu', 'cortex-a53', '-m', '256M')
    vm.add_args('-kernel', 'Image', '-nographic')
    vm.launch()
    vm.qmp('stop')
    result = vm.qmp('query-registers')
    vm.shutdown()
```

---

## Semihosting

Semihosting is a mechanism by which a target application running in an emulator can call host OS services (open file, read/write, exit) through a special trap instruction, without implementing a real OS or UART driver.

**ARM semihosting** uses `HLT #0xF000` (AArch64) or `SVC #0x123456` / `HLT #0xF000` (ARM). The calling convention places the operation number in `r0`/`x0` and a parameter block address in `r1`/`x1`.

```bash
# Enable semihosting
qemu-system-arm -M mps2-an385 -kernel app.elf \
    -semihosting-config enable=on,target=native \
    -nographic
```

| Option | Description |
|--------|-------------|
| `enable=on` | Activate semihosting trap handling |
| `target=native` | Use host libc (default) |
| `target=gdb` | Forward operations to GDB (for GDB-based hosting) |
| `chardev=id` | Route I/O to a chardev instead of stdio |
| `userspace=on` | Allow semihosting from userspace (not just privileged mode) |

Common semihosting operations (ARM `SYS_*`):

| Op | Hex | Description |
|----|-----|-------------|
| `SYS_OPEN` | 0x01 | Open file |
| `SYS_CLOSE` | 0x02 | Close file handle |
| `SYS_WRITEC` | 0x03 | Write single character |
| `SYS_WRITE0` | 0x04 | Write null-terminated string |
| `SYS_WRITE` | 0x05 | Write buffer |
| `SYS_READ` | 0x06 | Read buffer |
| `SYS_EXIT` | 0x18 | Terminate program |
| `SYS_EXIT_EXTENDED` | 0x20 | Exit with 64-bit code |

Semihosting is suitable for unit tests and early bring-up. A `printf()` call via the C library semihosting implementation (`--specs=rdimon.specs` in GCC) takes the SYS_WRITE path.

---

## Snapshot Management

QEMU supports two snapshot types: **internal** (stored inside a qcow2 image) and **external** (separate overlay files).

```bash
# Create internal snapshot while running (via Monitor)
(qemu) savevm checkpoint1

# List
(qemu) info snapshots

# Restore
(qemu) loadvm checkpoint1

# From command line, boot from saved snapshot
qemu-system-arm -M virt -drive file=disk.qcow2,format=qcow2 \
    -loadvm checkpoint1

# Manage with qemu-img
qemu-img snapshot -l disk.qcow2        # list
qemu-img snapshot -c snap2 disk.qcow2  # create
qemu-img snapshot -a snap2 disk.qcow2  # apply (revert)
qemu-img snapshot -d snap2 disk.qcow2  # delete
```

External snapshots use overlay images: the original is `base.qcow2` (read-only) and all writes go to a new `overlay.qcow2`. This is the model cloud platforms use for live migration and backup.
