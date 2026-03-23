---
title: Hello World QEMU
createTime: 2026/03/14 14:21:19
permalink: /kb/embedded/qemu/hello-world-qemu/
---

# Hello World on QEMU (Bare-Metal)

A proper embedded hello world does not use `printf` inside Linux — it writes directly to a UART peripheral register from bare-metal firmware with no OS, no C library, and no semihosting. This page builds that firmware from scratch, runs it under QEMU, and shows how to debug it live with GDB.

---

## Target Machine: `lm3s6965evb`

The `lm3s6965evb` (Stellaris LM3S6965) is a Cortex-M3 machine included in upstream QEMU. It has a UART0 at base address `0x4000C000` (compatible with the PL011 UART model). It is the machine used by the FreeRTOS QEMU demo and is therefore well-tested.

```bash
qemu-system-arm -M lm3s6965evb -cpu cortex-m3 -kernel firmware.elf -nographic
```

Alternative: `mps2-an385` (Cortex-M3, UART0 at `0x40004000`, also PL011-compatible):

```bash
qemu-system-arm -M mps2-an385 -kernel firmware.elf -nographic
```

---

## The Cortex-M Vector Table

Every Cortex-M firmware begins with a vector table at address `0x00000000`. The first word is the initial stack pointer; the second is the reset handler address. At reset, the CPU loads `SP` from offset 0 and `PC` from offset 4, then begins executing:

```
+----------+
| 0x00000000 | Initial Stack Pointer (top of SRAM)
| 0x00000004 | Reset_Handler address
| 0x00000008 | NMI_Handler
| 0x0000000C | HardFault_Handler
|    ...     | (15 system exceptions, then IRQ0..N)
+----------+
```

---

## Project Layout

```
baremetal-hello/
├── Makefile
├── link.ld          ← linker script
├── startup.S        ← reset handler, vector table
└── main.c           ← UART write + infinite loop
```

---

## Linker Script (`link.ld`)

The linker script defines memory regions and section placement. For `lm3s6965evb`: flash starts at `0x00000000` (256 KB), SRAM at `0x20000000` (64 KB).

```ld
MEMORY
{
    FLASH (rx)  : ORIGIN = 0x00000000, LENGTH = 256K
    SRAM  (rwx) : ORIGIN = 0x20000000, LENGTH = 64K
}

SECTIONS
{
    /* Vector table and code in flash */
    .text :
    {
        KEEP(*(.vectors))   /* vector table must be first */
        *(.text*)
        *(.rodata*)
    } > FLASH

    /* Copy-initialized data: lives in flash, runs from SRAM */
    .data :
    {
        _sdata = .;
        *(.data*)
        _edata = .;
    } > SRAM AT > FLASH

    /* Load address of .data in flash */
    _sidata = LOADADDR(.data);

    /* Zero-initialized data */
    .bss :
    {
        _sbss = .;
        *(.bss*)
        *(COMMON)
        _ebss = .;
    } > SRAM

    /* Stack grows down from top of SRAM */
    _estack = ORIGIN(SRAM) + LENGTH(SRAM);
}
```

Key points:
- `KEEP(*(.vectors))` prevents the linker from discarding the vector table if nothing references it
- `.data AT > FLASH` means the section lives (VMA) in SRAM but is stored (LMA) in flash; startup code copies it
- `_sidata`, `_sdata`, `_edata`, `_sbss`, `_ebss` are symbols the startup code uses to perform the copy and zero-fill

---

## Reset Handler (`startup.S`)

```asm
    .syntax unified
    .cpu cortex-m3
    .thumb

/* ─── Vector table ─────────────────────────────────── */
    .section .vectors, "a", %progbits
    .global _vectors
_vectors:
    .word   _estack          /* 0x00: Initial SP            */
    .word   Reset_Handler    /* 0x04: Reset                 */
    .word   Default_Handler  /* 0x08: NMI                   */
    .word   Default_Handler  /* 0x0C: HardFault             */
    /* Fill remaining 12 system + up to 240 IRQ slots */
    .rept   244
    .word   Default_Handler
    .endr

/* ─── Reset handler ────────────────────────────────── */
    .section .text
    .global Reset_Handler
    .type   Reset_Handler, %function
Reset_Handler:
    /* Copy .data from flash (LMA) to SRAM (VMA) */
    ldr     r0, =_sidata    /* source: flash load address of .data */
    ldr     r1, =_sdata     /* destination start */
    ldr     r2, =_edata     /* destination end   */
.copy_loop:
    cmp     r1, r2
    bge     .bss_zero
    ldr     r3, [r0], #4
    str     r3, [r1], #4
    b       .copy_loop

    /* Zero-fill .bss */
.bss_zero:
    ldr     r1, =_sbss
    ldr     r2, =_ebss
    mov     r3, #0
.bss_loop:
    cmp     r1, r2
    bge     .call_main
    str     r3, [r1], #4
    b       .bss_loop

.call_main:
    bl      main
    /* main should never return; spin if it does */
.halt:
    b       .halt

/* ─── Default exception handler (spin) ────────────── */
    .global Default_Handler
    .type   Default_Handler, %function
Default_Handler:
    b       .

    .size Reset_Handler, . - Reset_Handler
```

---

## UART Driver (`main.c`)

The PL011 UART register map (base `0x4000C000` on `lm3s6965evb`):

| Offset | Register | Description |
|--------|----------|-------------|
| `0x000` | UARTDR | Data Register (read = RX, write = TX) |
| `0x018` | UARTFR | Flag Register (bit 5 = TXFF — TX FIFO full) |
| `0x024` | UARTIBRD | Integer Baud Rate Divisor |
| `0x028` | UARTFBRD | Fractional Baud Rate Divisor |
| `0x02C` | UARTLCR_H | Line Control (word length, FIFO enable) |
| `0x030` | UARTCR | Control Register (enable UART, TX, RX) |

```c
#include <stdint.h>

#define UART0_BASE  0x4000C000UL

#define UART_DR     (*(volatile uint32_t *)(UART0_BASE + 0x000))
#define UART_FR     (*(volatile uint32_t *)(UART0_BASE + 0x018))
#define UART_IBRD   (*(volatile uint32_t *)(UART0_BASE + 0x024))
#define UART_FBRD   (*(volatile uint32_t *)(UART0_BASE + 0x028))
#define UART_LCRH   (*(volatile uint32_t *)(UART0_BASE + 0x02C))
#define UART_CR     (*(volatile uint32_t *)(UART0_BASE + 0x030))

#define FR_TXFF     (1u << 5)   /* TX FIFO full */
#define LCRH_WLEN8  (3u << 5)   /* 8-bit word length */
#define LCRH_FEN    (1u << 4)   /* FIFO enable */
#define CR_UARTEN   (1u << 0)   /* UART enable */
#define CR_TXE      (1u << 8)   /* TX enable */
#define CR_RXE      (1u << 9)   /* RX enable */

static void uart_init(void)
{
    /* Disable UART during configuration */
    UART_CR = 0;

    /* 115200 baud with 16 MHz PCLK: IBRD=8, FBRD=44 */
    UART_IBRD = 8;
    UART_FBRD = 44;

    /* 8-bit, no parity, 1 stop bit, FIFOs enabled */
    UART_LCRH = LCRH_WLEN8 | LCRH_FEN;

    /* Enable UART, TX, and RX */
    UART_CR = CR_UARTEN | CR_TXE | CR_RXE;
}

static void uart_putc(char c)
{
    /* Wait while TX FIFO is full */
    while (UART_FR & FR_TXFF)
        ;
    UART_DR = (uint32_t)c;
}

static void uart_puts(const char *s)
{
    while (*s)
        uart_putc(*s++);
}

int main(void)
{
    uart_init();
    uart_puts("Hello, QEMU!\r\n");

    /* Spin forever */
    for (;;)
        ;

    return 0;
}
```

---

## Makefile

```makefile
CROSS   := arm-none-eabi-
CC      := $(CROSS)gcc
AS      := $(CROSS)as
LD      := $(CROSS)ld
OBJCOPY := $(CROSS)objcopy
OBJDUMP := $(CROSS)objdump

CFLAGS  := -mcpu=cortex-m3 -mthumb -mfloat-abi=soft \
           -Os -ffreestanding -nostdlib -Wall -g
LDFLAGS := -T link.ld --gc-sections -Map=firmware.map

OBJS    := startup.o main.o

all: firmware.elf firmware.bin

firmware.elf: $(OBJS)
	$(LD) $(LDFLAGS) -o $@ $^

firmware.bin: firmware.elf
	$(OBJCOPY) -O binary $< $@

startup.o: startup.S
	$(CC) $(CFLAGS) -c -o $@ $<

main.o: main.c
	$(CC) $(CFLAGS) -c -o $@ $<

disasm: firmware.elf
	$(OBJDUMP) -d $<

clean:
	rm -f *.o *.elf *.bin *.map
```

Toolchain required: `arm-none-eabi-gcc` (from the `gcc-arm-none-eabi` package on Ubuntu, or the Arm Developer toolchain).

---

## Build and Run

```bash
# Install toolchain
sudo apt install gcc-arm-none-eabi binutils-arm-none-eabi

# Build
make

# Verify the vector table is first
arm-none-eabi-objdump -h firmware.elf | grep -E "vectors|text"

# Run
qemu-system-arm -M lm3s6965evb -kernel firmware.elf -nographic
# Expected output:
# Hello, QEMU!
# (then QEMU hangs in the spin loop — press Ctrl-A X to quit)
```

---

## Debugging with GDB

Launch QEMU in a frozen state, waiting for GDB:

```bash
qemu-system-arm -M lm3s6965evb -kernel firmware.elf -nographic \
    -s -S
# -s  = -gdb tcp::1234
# -S  = freeze CPU at reset
```

In a second terminal:

```bash
arm-none-eabi-gdb firmware.elf

(gdb) target remote :1234
(gdb) monitor info registers       # QEMU monitor inside GDB
(gdb) info registers               # GDB register dump
(gdb) b main
(gdb) c                            # continue until main
(gdb) n                            # step over
(gdb) x/4xw 0x4000C000            # inspect UART DR/FR registers
(gdb) disassemble                  # disassemble current function
```

You can set breakpoints on the reset handler to verify the .data copy and .bss zero steps:

```bash
(gdb) b Reset_Handler
(gdb) c
(gdb) si                           # step one instruction at a time
```

---

## Alternative: Linux Userspace with `qemu-user`

For code that targets Linux (not bare-metal), `qemu-user` is faster to set up — it emulates only the CPU instruction set, passing system calls directly to the host kernel:

```bash
# Install user-mode QEMU
sudo apt install qemu-user qemu-user-static

# Cross-compile a hello world
arm-linux-gnueabihf-gcc -static -o hello hello.c

# Run it
qemu-arm-static ./hello
# Hello, World!
```

`qemu-user` does not emulate memory-mapped peripherals. Use it for algorithm testing, ABI validation, and porting software. For real firmware testing, use `qemu-system-arm` as shown above.

---

## What This Proves

Running bare-metal firmware on QEMU demonstrates:

1. The vector table mechanism works — QEMU loads SP from address 0, jumps to Reset_Handler
2. The startup code correctly copies `.data` from LMA to VMA and zeroes `.bss`
3. Direct MMIO register writes reach the emulated PL011 UART and produce visible output
4. All of this is validated before any physical hardware is available
