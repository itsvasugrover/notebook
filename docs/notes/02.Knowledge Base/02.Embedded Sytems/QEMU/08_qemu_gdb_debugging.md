---
title: QEMU GDB Debugging
createTime: 2026/03/14 14:21:19
permalink: /kb/embedded/qemu/qemu-gdb-debugging/
---

# QEMU GDB Debugging

QEMU exposes an implementation of the GDB Remote Serial Protocol (RSP) that allows any GDB client to connect, set breakpoints, inspect memory and registers, and single-step through guest code. This page explains the protocol mechanics, GDB connection workflow, hardware vs software breakpoints in emulation, kernel debugging, and GDB Python scripting.

---

## GDB Remote Serial Protocol (RSP)

GDB splits into a client (the `gdb` binary on the developer machine) and a stub (the remote target). Communication uses a text-based packet protocol over TCP (or serial). Packets are framed as:

```
$<data>#<checksum>
```

Where `<checksum>` is a two-hex-digit sum of all bytes in `<data>`, modulo 256. The stub replies with `+` (ACK) or `-` (NACK). Retransmission handles packet loss.

QEMU implements the RSP stub internally. When `-gdb tcp::1234` is specified, QEMU opens a TCP listen socket on port 1234 and waits for a GDB connection. Once connected, QEMU accepts RSP commands including:

| RSP Packet | GDB command | Description |
|-----------|-------------|-------------|
| `?` | initial | Query halt reason |
| `g` / `G` | `info registers` | Read/write all registers |
| `p N` / `P N=V` | `p $reg` | Read/write single register |
| `m addr,len` / `M addr,len:data` | `x`, `set mem` | Read/write memory |
| `c [addr]` | `continue` | Resume execution |
| `s [addr]` | `stepi` | Single-step one instruction |
| `Z0,addr,len` / `z0` | `break` | Insert/remove software breakpoint |
| `Z1,addr,len` / `z1` | `hbreak` | Insert/remove hardware breakpoint |
| `Z2,addr,len` / `z2` | `watch` | Insert write watchpoint |
| `Z3,addr,len` / `z3` | `rwatch` | Insert read watchpoint |
| `Z4,addr,len` / `z4` | `awatch` | Insert access watchpoint |
| `vCont;c` | continue | Extended continue |

---

## Launching QEMU with GDB Support

```bash
# -s  : shorthand for -gdb tcp::1234
# -S  : freeze CPU at startup, wait for GDB 'continue'

qemu-system-arm -M mps2-an385 -kernel firmware.elf \
    -nographic -s -S
```

With `-S`, QEMU starts but holds the CPU at the reset vector. No instructions execute until GDB sends the continue command. This is the standard embedded debug setup.

### Custom GDB port

```bash
-gdb tcp::3333          # GDB on port 3333
-gdb tcp::0             # OS-assigned port (QEMU prints the port)
-gdb unix:/tmp/gdb.sock # Unix domain socket
```

---

## Connecting GDB

```bash
# For ARM bare-metal
arm-none-eabi-gdb firmware.elf

(gdb) target remote :1234
Remote debugging using :1234
Reset_Handler () at startup.S:20
```

For ELF targets QEMU populates the stop reply packet with the PC value from the vector table reset handler. GDB maps this to a source location using DWARF debug info in the ELF.

### GDB Session for Bare-Metal Firmware

```gdb
(gdb) target remote :1234

# Inspect initial state
(gdb) info registers
(gdb) x/8xw 0x00000000          # vector table in flash

# Set breakpoints
(gdb) b main                    # symbol breakpoint
(gdb) b *0x00000200             # address breakpoint
(gdb) c                         # run until main

# Step through code
(gdb) n                         # next (step over function calls)
(gdb) s                         # step (into function calls)
(gdb) si                        # step one instruction
(gdb) ni                        # next instruction (step over)
(gdb) finish                    # run to return of current function

# Inspect memory
(gdb) x/4xw 0x40004000         # UART MMIO registers
(gdb) x/10i $pc                 # disassemble from PC
(gdb) x/s 0x20001000            # read as string

# Modify state
(gdb) set $r0 = 0xdeadbeef
(gdb) set {int}0x20000000 = 42  # write to SRAM

# Watchpoints
(gdb) watch *(int*)0x20000010   # break on write
(gdb) rwatch *(int*)0x20000010  # break on read
(gdb) awatch *(int*)0x20000010  # break on access

# Info commands
(gdb) info breakpoints
(gdb) info watchpoints
(gdb) backtrace                 # call stack
(gdb) frame 2                   # switch to frame 2
(gdb) info locals               # local variables in current frame
(gdb) info args                 # function arguments
```

---

## Hardware vs Software Breakpoints

In physical hardware, breakpoints fall into two categories:

- **Software breakpoints**: Replace the instruction at the breakpoint address with a trap instruction (`BKPT #0` on ARM Thumb). The original instruction is saved. On hit, the CPU takes a debug exception; the debugger restores the original instruction.
- **Hardware breakpoints**: Use dedicated comparator registers in the CoreSight debug subsystem. No instruction modification required. Limited in number (typically 4–8 on Cortex-M). Work on ROM/Flash where writes are not possible.

**In QEMU emulation**, both types are implemented as internal TCG state (no actual instruction patching or hardware register use). The distinction matters less than on real hardware, but QEMU correctly implements both RSP packet types (`Z0`/`Z1`) with their expected semantics:

- `Z0` (software): Can be set anywhere including ROM; QEMU tracks the address and halts when TCG executes that instruction
- `Z1` (hardware): Same internal mechanism; GDB's `hbreak` command uses this

**Watchpoints** (`Z2`, `Z3`, `Z4`) require QEMU to translate every memory access into a check against the watchpoint list. QEMU does this in softmmu, making watchpoints work correctly but with a performance cost.

The number of hardware breakpoints QEMU reports to GDB is configured by the machine type. Check with:

```bash
(qemu) info registers   # shows DCRDR and debug registers
```

---

## Debugging the Linux Kernel

For AArch64 or ARM Linux guests, the same `-s -S` approach works but requires additional steps for symbol resolution:

```bash
qemu-system-aarch64 -M virt -cpu cortex-a53 -m 512M \
    -kernel Image -initrd rootfs.cpio.gz \
    -append "console=ttyAMA0 nokaslr" \
    -nographic -s -S
```

**Note**: `nokaslr` disables kernel address space layout randomization, which is essential — without it, the kernel loads at a random offset and GDB symbol addresses are wrong.

```bash
aarch64-linux-gnu-gdb vmlinux

(gdb) target remote :1234
(gdb) c                          # let kernel boot

# After boot, press Ctrl-C to interrupt
(gdb) add-symbol-file vmlinux 0  # if symbols aren't already loaded
(gdb) b panic
(gdb) b do_sys_open
(gdb) c
```

### Kernel GDB Scripts

The Linux kernel source includes Python GDB helper scripts at `scripts/gdb/`. Load them:

```gdb
(gdb) source /path/to/linux/vmlinux-gdb.py
(gdb) lx-ps                     # list all processes
(gdb) lx-dmesg                  # print kernel ring buffer
(gdb) lx-lsmod                  # list modules
(gdb) lx-symbols                # load module symbols
(gdb) apropos lx-               # show all lx-* commands
```

---

## Python GDB Scripting

GDB embeds a Python interpreter. Use it to automate repetitive debug tasks:

```python
# print_nvic.py — load with: (gdb) source print_nvic.py

import gdb

class PrintNVIC(gdb.Command):
    """Print Cortex-M NVIC enabled interrupts."""

    def __init__(self):
        super().__init__("nvic", gdb.COMMAND_USER)

    def invoke(self, arg, from_tty):
        iser0 = gdb.parse_and_eval("*(unsigned int*)0xE000E100")
        print(f"NVIC ISER0 = {int(iser0):#010x}")
        for i in range(32):
            if int(iser0) & (1 << i):
                print(f"  IRQ{i} enabled")

PrintNVIC()
```

```gdb
(gdb) source print_nvic.py
(gdb) nvic
NVIC ISER0 = 0x00000003
  IRQ0 enabled
  IRQ1 enabled
```

### Breakpoint with Python callback

```python
class UARTBreakpoint(gdb.Breakpoint):
    def __init__(self, addr):
        super().__init__(f"*{addr:#x}", gdb.BP_WATCHPOINT,
                         gdb.WP_WRITE, True)

    def stop(self):
        val = gdb.parse_and_eval("*(unsigned int*)0x4000C000")
        char = int(val) & 0xFF
        if 0x20 <= char < 0x7F:
            print(f"[UART TX] '{chr(char)}'")
        return False  # don't actually stop

UARTBreakpoint(0x4000C000)
```

---

## GDB TUI Mode

GDB's Text User Interface shows source, assembly, and registers simultaneously:

```bash
arm-none-eabi-gdb -tui firmware.elf

# Or toggle inside GDB:
(gdb) tui enable
(gdb) layout src          # source view
(gdb) layout asm          # assembly view
(gdb) layout split        # source + asm side by side
(gdb) layout regs         # add register panel
(gdb) tui reg general     # show general-purpose registers
(gdb) tui reg float       # show float/VFP registers
```

---

## Multi-Core / SMP Debugging

For machines with multiple CPUs, QEMU exposes each vCPU as a GDB thread:

```bash
(gdb) info threads          # list all CPUs
  Id   Target Id         Frame
* 1    Thread 1 (CPU#0)   0x80001000 in kernel_start ()
  2    Thread 2 (CPU#1)   0x80001000 in kernel_start ()

(gdb) thread 2              # switch to CPU#1
(gdb) info registers        # registers of CPU#1

(gdb) set scheduler-locking on   # step only current thread
```

---

## QEMU Monitor + GDB Together

When using `-serial mon:stdio` or `-monitor stdio`, you access the QEMU monitor from the same terminal. Use `Ctrl-A C` to switch between serial console and monitor. In the monitor you can:

```
(qemu) info registers    # QEMU's own register dump (different from GDB's)
(qemu) stop              # pause execution (GDB then sees a stop)
(qemu) cont              # resume (same as GDB continue)
(qemu) x /4xw 0x40004000 # memory inspect from QEMU side
```

This dual access is useful when you need QEMU-level introspection (e.g., `info mtree` to see the memory region tree) alongside GDB source-level debugging.
