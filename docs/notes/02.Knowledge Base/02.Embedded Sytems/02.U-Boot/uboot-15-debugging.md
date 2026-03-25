---
title: Debugging
createTime: 2026/03/23 00:00:00
permalink: /kb/embedded/uboot/debugging/
---

# U-Boot Debugging

## Overview

U-Boot offers multiple complementary debugging paths depending on the stage at which the problem occurs:

| Problem Stage | Debugging Approach |
|--------------|-------------------|
| Very early (before serial works) | `CONFIG_DEBUG_UART`, GPIO toggling, LEDs |
| SPL phase | Early UART, JTAG + GDB |
| U-Boot proper (interactive) | Serial console, `log`, `dm tree`, `md` |
| Boot failures (hang before kernel) | `bootstage`, serial trace |
| Undefined behaviour / memory bugs | Sandbox on host, KASAN-style DEBUG |
| Driver issues | `DM` debug commands, `CONFIG_LOG_DEFAULT_LEVEL` |

---

## Part 1: CONFIG_DEBUG_UART — Very Early UART

The standard Driver Model UART is not available until DM is initialized. For failures that happen before that point, U-Boot provides `DEBUG_UART` — a hard-coded, register-based UART that works from the first C instruction.

### Kconfig

```kconfig
CONFIG_DEBUG_UART=y

# Select hardware:
CONFIG_DEBUG_UART_NS16550=y        # Generic NS16550 (most common)
# CONFIG_DEBUG_UART_PL011=y        # ARM PL011 (Cortex-A development boards)
# CONFIG_DEBUG_UART_MXC=y          # NXP i.MX UART
# CONFIG_DEBUG_UART_OMAP=y         # TI OMAP UART

# Configure the UART registers (board-specific — check datasheet):
CONFIG_DEBUG_UART_BASE=0x30860000  # UART base address
CONFIG_DEBUG_UART_CLOCK=25000000   # Input clock in Hz
CONFIG_DEBUG_UART_SHIFT=2          # Register shift for 32-bit spacing
CONFIG_BAUDRATE=115200             # Baud rate
```

### Using DEBUG_UART in Code

```c
// Include the early debug UART header:
#include <debug_uart.h>

// Initialize the debug UART (do this once, very early):
debug_uart_init();

// Print a character:
printch('H');
printch('i');

// Print a string (no printf overhead):
printascii("Hello from early boot!\n");

// Print a hex value:
printhex8(0xDEADBEEF);    // 8 hex digits
printhex4(0x1234);         // 4 hex digits
printhex2(0xFF);           // 2 hex digits
```

### Enabling DEBUG_UART in board init

In `board/mycompany/myboard/myboard.c`:
```c
void board_debug_uart_init(void)
{
    /* Configure pinmux for UART before anything else */
    /* Example: write to pinmux register directly */
    writel(0x0, IOMUXC_SW_MUX_CTL_PAD_UART1_RXD);
    writel(0x0, IOMUXC_SW_MUX_CTL_PAD_UART1_TXD);
}
```

---

## Part 2: Logging Framework

U-Boot 2026.01 has a structured log framework based on categories and log levels.

### Kconfig

```kconfig
CONFIG_LOG=y
CONFIG_LOG_MAX_LEVEL=7             # 0=EMERG ... 7=DEBUG
CONFIG_LOG_DEFAULT_LEVEL=6         # Default: INFO (6)
CONFIG_LOG_CONSOLE=y               # Print to serial console
CONFIG_SYS_CONSOLE_INFO_QUIET=n    # Show board/memory info on boot

# Optional: measure CPU usage of logging
# CONFIG_LOG_TEST is not set       # Log self-test

# Log levels:
# 0 = LOGL_EMERG     — system is unusable
# 1 = LOGL_ALERT     — action must be taken immediately
# 2 = LOGL_CRIT      — critical conditions
# 3 = LOGL_ERR       — error conditions
# 4 = LOGL_WARNING   — warning conditions
# 5 = LOGL_NOTICE    — normal but significant
# 6 = LOGL_INFO      — informational
# 7 = LOGL_DEBUG     — debug-level messages
# 8 = LOGL_DEBUG_IO  — device I/O debug
# 9 = LOGL_DEBUG_CONTENT — content debug
# 10= LOGL_DEBUG_EXTRA   — extra debug
```

### Logging in Driver Code

```c
#include <log.h>

// Category log macros (preferred in 2026.01):
log_debug("DMA transfer at %p, size=%zu\n", addr, len);   // level 7
log_info("Initialized %s controller\n", priv->name);       // level 6
log_warning("Retrying transaction (attempt %d)\n", n);     // level 4
log_err("DMA timeout, status=0x%x\n", status);            // level 3

// Conditional debug:
debug("Value = %d\n", val);          // Only compiled in if DEBUG defined

// pr_* macros (Linux-style, available in 2026.01):
pr_debug("...\n");
pr_info("...\n");
pr_warn("...\n");
pr_err("...\n");

// Log + return error in one line:
return log_msg_ret("DMA init", -ETIMEDOUT);
```

### Runtime Log Level Control

```bash
# Change log level at U-Boot prompt:
=> log level 7       # Set to DEBUG
=> log level 6       # Back to INFO

# Show available log categories:
=> log categories

# Filter to specific category:
=> log filter-add -l debug -c spl

# Remove filters:
=> log filter-remove 0
```

---

## Part 3: Sandbox — Host-Based Testing

The **sandbox** target compiles U-Boot as a Linux process on your development machine. It's the fastest way to debug U-Boot logic without a real board.

### Building Sandbox

```bash
# Build sandbox (runs on your host x86/ARM Linux)
make sandbox_defconfig
make -j$(nproc)

# Run it:
./u-boot

# With extra options:
./u-boot -d arch/sandbox/dts/sandbox.dtb    # Use explicit DTB
./u-boot -T                                  # Run tests
./u-boot -l                                  # List tests
```

### Sandbox Features

```bash
# In sandbox shell:
=> help            # All commands work
=> dm tree         # Show device tree
=> sf probe        # Simulated SPI flash
=> mmc dev 0       # Simulated MMC
=> load host 0 ${loadaddr} Image     # Load from host filesystem

# Run unit tests:
=> ut all          # Run all unit tests
=> ut dm           # Driver model tests
=> ut env          # Environment tests
=> ut fit          # FIT image tests
```

### pytest / Python Test Framework

```bash
# Install pytest and dependencies:
pip3 install pytest pexpect

# Run all U-Boot tests against sandbox:
cd /path/to/u-boot
pytest test/py/ --bd sandbox --build

# Run a specific test:
pytest test/py/tests/test_fit.py --bd sandbox

# Run tests with verbose output:
pytest test/py/ --bd sandbox -v -s

# Test FIT verified boot:
pytest test/py/tests/test_fit.py::test_fit_signed --bd sandbox
```

---

## Part 4: GDB + JTAG Debugging

For debugging actual hardware or the sandbox on host with full source-level debug.

### JTAG Hardware Setup

Common JTAG probes:
- **OpenOCD** supports most ARM chips
- **J-Link (Segger)** — professional probe, works with GDB
- **CMSIS-DAP** / **DAPLink** — open standard

### GDB with OpenOCD

```bash
# Start OpenOCD (board config file required per board):
openocd -f interface/jlink.cfg -f target/imx8mm.cfg

# In another terminal, connect GDB:
aarch64-none-linux-gnu-gdb u-boot   # ELF with symbols

# GDB commands:
(gdb) target remote localhost:3333    # Connect to OpenOCD
(gdb) monitor reset halt              # Reset and halt CPU
(gdb) load                            # Flash U-Boot binary
(gdb) monitor reset init              # Run init scripts
(gdb) break board_init_r              # Breakpoint on function
(gdb) break board.c:42               # Breakpoint on line
(gdb) continue                        # Run to breakpoint
(gdb) step                            # Step into function
(gdb) next                            # Step over function
(gdb) print gd->ram_size             # Inspect global_data
(gdb) info registers                  # CPU registers
(gdb) x/16xw 0x4000000              # Examine memory
(gdb) bt                              # Backtrace
```

### GDB with Sandbox (No Hardware Required)

```bash
# Build sandbox with debug info:
make sandbox_defconfig
scripts/config --set-val DEBUG 1
make -j$(nproc)

# Debug with GDB:
gdb --args ./u-boot -d arch/sandbox/dts/sandbox.dtb

(gdb) break board_init_r
(gdb) run
(gdb) print *gd
(gdb) watch gd->ram_size
```

### U-Boot Compiled-in GDB Stub (No JTAG Needed)

```kconfig
# Use software GDB stub over serial:
# CONFIG_GDBSTUB is not set   # Available on some architectures
```

---

## Part 5: Memory Debugging

### Examining Memory

```bash
# Memory display (md):
=> md.b ${loadaddr} 64          # Dump 64 bytes in byte format
=> md.w ${loadaddr} 32          # Dump 32 16-bit words
=> md.l 0x80000000 16           # Dump 16 32-bit words
=> md.q 0x80000000 8            # Dump 8 64-bit words (ARM64)

# Memory write:
=> mw.l 0x80000000 0xDEADBEEF 4  # Write pattern

# Memory compare:
=> cmp.l addr1 addr2 count

# Memory check (pattern test):
=> mtest 0x40000000 0x50000000  # Test RAM range

# Dump struct global_data contents:
=> bdinfo             # Board info (from bd struct in gd)

# Show memory regions:
=> mem info
```

### Diagnosing Stack Overflow

```kconfig
CONFIG_SPL_STACK_R=y
CONFIG_SPL_STACK_R_ADDR=0x82000000   # Put SPL stack in DDR after reloc
CONFIG_STACK_SIZE=0x200000           # 2MB stack for U-Boot proper
CONFIG_SPL_STACK_SIZE=0x10000        # 64KB stack for SPL

# Canary / overflow detection:
CONFIG_DEBUG_STACKSIZE=y             # Check stack size isn't exceeded
```

---

## Part 6: bootstage — Boot Timing

`bootstage` records precise timestamps for each boot stage, helping identify bottlenecks.

```kconfig
CONFIG_BOOTSTAGE=y
CONFIG_BOOTSTAGE_REPORT=y          # Print report at end of boot
CONFIG_BOOTSTAGE_STASH=y           # Stash data for kernel to read
CONFIG_BOOTSTAGE_STASH_ADDR=0x0    # Address (0 = auto)
CONFIG_BOOTSTAGE_STASH_SIZE=0x1000 # 4KB stash
CONFIG_BOOTSTAGE_MAX_SIZE=0x1000
```

```bash
# In U-Boot shell:
=> bootstage report
Timer summary in microseconds (30 records):
       Start  Elapsed   Stage
           0        0   reset
       1,024    1,024   board_init_f start
      52,380   51,356   DRAM init
     103,421   51,041   board_init_r start  
     156,232   52,811   main_loop
     ...
```

---

## Part 7: Crash and Panic Debugging

### Handling a Crash

When U-Boot crashes, it prints a register dump. Here's how to decode it:

```
"Synchronous Abort" handler, esr 0x96000007
ELR:     40082f50              ← Program counter at crash
ESR:     0000000096000007      ← Exception Syndrome Register
FAR:     0000000000000010      ← Fault Address Register
x0 : 00000000deadbeef         ← Register dump
...
Code: d2808000 f9400000 d65f03c0 (b9400001)

Resetting CPU ...
```

```bash
# Decode crash address to source line:
aarch64-none-linux-gnu-addr2line -e u-boot 0x40082f50
# Output: board/myboard/myboard.c:142

# Disassemble around crash:
aarch64-none-linux-gnu-objdump -d u-boot | grep -A 20 "40082f50"

# Decode ESR value:
# ESR = 0x96000007
# [31:26] = 0x25 = Data Abort from current EL
# [24]    = 0x1  = ISV valid
# [5:0]   = 0x07 = Translation fault, level 3
```

### panic() and BUG()

```c
// In code, you can use:
panic("Memory init failed: %s\n", reason);   // Prints + halts
BUG();                                        // Assert fatal bug
BUG_ON(condition);                            // Conditional BUG
WARN_ON(condition);                           // Print warning but continue
assert(condition);                            // Only active if DEBUG defined
```

---

## Part 8: Driver Model Debug Commands

```bash
# Show full DM device tree:
=> dm tree
 Class       Seq  Probed  Driver                    Name
 -----------------------------------------------------------
 root          0  [   ]   root_driver               root_driver
 simple_bus    0  [   ]   generic_simple_bus         {soc}
 clk           0  [   ]   fixed_clock               osc_24m
 serial        0  [   ]   serial_mxc                serial@30860000
 ...

# Probe all devices (trigger full DM init):
=> dm probe

# Show uclass instances:
=> dm uclass
uclass 0: root
uclass 5: clk  [1 device(s)]
uclass 8: mmc  [2 device(s)]

# Show a specific device's info:
=> dm info /soc/serial@30860000

# Show driver binding:
=> dm drivers

# Show udevice details including private data:
=> dm devres

# List addresses of all dm devices:
=> dm addr
```

---

## Part 9: Environment and Script Debugging

```bash
# Print all environment:
=> printenv

# Check if variable is set:
=> if test -n "${myvar}"; then echo "set"; else echo "unset"; fi

# Debug bootcmd step by step:
=> setenv bootdelay -1    # Disable autoboot
=> echo ${bootcmd}        # See the boot command
=> run bootcmd            # Run it manually

# Trace Hush script execution:
=> setenv debug_bootcmd 1
# (not a built-in; add custom tracing in board code)

# Check environment storage:
=> env info
Environment size: 1432/131068 bytes
```

---

## Part 10: Network Debugging

```bash
# Test network connectivity:
=> setenv ipaddr 192.168.1.100
=> setenv serverip 192.168.1.1
=> ping ${serverip}
host 192.168.1.1 is alive

# Check ethernet device:
=> mii info          # Display MII/PHY info
=> mii read 1 0      # Read PHY register
=> net list          # List network devices

# TFTP debug:
=> setenv netretry 5
=> tftp ${loadaddr} Image

# Enable verbose net debug (recompile needed):
# CONFIG_NET_DEBUG=y
```

---

## Quick Debug Reference Card

```bash
# ── Early boot issues ──────────────────────────────────────────────
CONFIG_DEBUG_UART=y + debug_uart_init() + printascii("alive\n")

# ── Driver issues ──────────────────────────────────────────────────
=> log level 7        # Maximum verbosity
=> dm tree            # Device tree
=> dm uclass          # Uclass list

# ── Memory issues ──────────────────────────────────────────────────
=> md.l 0x40000000 64     # Dump memory
=> mtest 0x40000000 0x41000000  # Test memory

# ── Boot timing ────────────────────────────────────────────────────
=> bootstage report   # Print timing

# ── Crash decode ───────────────────────────────────────────────────
aarch64-none-linux-gnu-addr2line -e u-boot <ELR-address>

# ── FIT verification ───────────────────────────────────────────────
=> iminfo ${loadaddr}     # Verify FIT image

# ── Environment ────────────────────────────────────────────────────
=> printenv               # All variables
=> env info               # Storage statistics
```
