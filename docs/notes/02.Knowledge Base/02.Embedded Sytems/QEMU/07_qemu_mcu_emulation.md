---
title: QEMU MCU Emulation
createTime: 2026/03/14 14:21:19
permalink: /kb/embedded/qemu/qemu-mcu-emulation/
---

# QEMU MCU Emulation

This page covers the internal architecture of ARM Cortex-M MCUs as QEMU models them, which upstream machines are actually implemented, what QEMU gets right and wrong, and how to run RTOS firmware.

---

## ARM Cortex-M Architecture as QEMU Sees It

Cortex-M cores (M0, M0+, M3, M4, M23, M33, M55) implement the ARMv6-M, ARMv7-M, and ARMv8-M Baseline/Mainline ISAs. QEMU's `arm-softmmu` target implements these through the `cortex-m*` CPU family.

### Processor Core Features Emulated

| Feature | M0/M0+ | M3 | M4 | M33 |
|---------|--------|----|----|-----|
| ISA | ARMv6-M | ARMv7-M | ARMv7-M | ARMv8-M Mainline |
| FPU | No | No | Single (SP) | Optional SP/DP |
| DSP extensions | No | No | Yes | Yes |
| TrustZone | No | No | No | Yes |
| MPU | No (M0+: optional) | 8 regions | 8 regions | 16 regions |
| Thumb-2 | Subset | Full | Full | Full |

QEMU emulates these at instruction-decode level. The `cortex-m4` CPU model includes the DSP instructions and the single-precision FPU (VFPv4-SP). The `cortex-m33` model includes TrustZone state management.

### Memory Map (Fixed by ARM Specification)

```
0x00000000 - 0x1FFFFFFF  Code (512 MB)      Flash/ROM
0x20000000 - 0x3FFFFFFF  SRAM (512 MB)      On-chip SRAM
0x40000000 - 0x5FFFFFFF  Peripheral (512 MB) MMIO peripherals
0x60000000 - 0x9FFFFFFF  External RAM
0xA0000000 - 0xDFFFFFFF  External Device
0xE0000000 - 0xE00FFFFF  Private Peripheral Bus (PPB)
    0xE000E000 - 0xE000EFFF  System Control Space (SCS)
        0xE000E008  ACTLR  - Auxiliary Control
        0xE000E010  SysTick base (STK_CTRL, STK_LOAD, STK_VAL)
        0xE000E100  NVIC base (ISER, ICER, ISPR, ICPR, IPR)
        0xE000ED00  SCB base (CPUID, ICSR, VTOR, AIRCR, SCR, CCR, ...)
```

This layout is architecturally fixed. Flash at `0x00000000` and SRAM at `0x20000000` are constants. The PPB at `0xE0000000` is always present and not configurable.

### NVIC (Nested Vectored Interrupt Controller)

The NVIC is the most important peripheral for embedded firmware. QEMU's `armv7m_nvic` device implements it. Key concepts:

**Exception numbers** below 16 are system exceptions (Reset=1, NMI=2, HardFault=3, MemManage=4, BusFault=5, UsageFault=6, SVCall=11, PendSV=14, SysTick=15). IRQs start at exception number 16 (IRQ0 = exception 16).

**Priority** is 8-bit (bits 7:0), but only the top N bits are implemented (N = priority bits, typically 3–8). Lower numeric value = higher priority. Negative priorities are reserved for system exceptions.

**Tail-chaining**: when an interrupt returns and another is pending at the same or higher priority, the NVIC skips the full exception entry/exit sequence (saves ~6 cycles on hardware; QEMU models this behaviorally but not cycle-accurately).

**Vector table**: located at `VTOR` (Vector Table Offset Register, SCB at `0xE000ED08`). Default = `0x00000000`. Relocatable to SRAM.

QEMU hardwires the number of IRQ lines in the machine definition. `mps2-an385` exposes 32 external IRQs.

### SysTick

A 24-bit down-counter driven by the processor clock or an external reference. QEMU models SysTick with the host's real-time clock scaled to the configured CPU frequency. For time-sensitive RTOS tests, use `-icount` for deterministic counting (see below).

---

## Upstream QEMU Cortex-M Machines

**These machines are in QEMU upstream** (as of QEMU 8.x):

| Machine name | Core | Flash | RAM | Key peripherals |
|-------------|------|-------|-----|-----------------|
| `lm3s6965evb` | Cortex-M3 | 256 KB | 64 KB | UART0–2 (PL011), SSI, I2C, GPIO, ADC |
| `lm3s811evb` | Cortex-M3 | 64 KB | 8 KB | UART0 (PL011), SSI, I2C, GPIO |
| `mps2-an385` | Cortex-M3 | 4 MB | 4 MB | UART0–4 (PL011), SPI, I2C, GPIO, ETH |
| `mps2-an386` | Cortex-M4 | 4 MB | 4 MB | Same as an385 + FPU |
| `mps2-an500` | Cortex-M7 | 4 MB | 4 MB | Same as an385 + FPU |
| `mps2-an505` | Cortex-M33 | 4 MB | 4 MB | TrustZone, UART0–5, SPI, I2C |
| `mps2-an511` | Cortex-M3 | 4 MB | 4 MB | eMBED-M configuration |
| `mps3-an524` | Cortex-M33 | 4 MB | 4 MB | TrustZone, Ethernet |
| `microbit` | Cortex-M0 | 256 KB | 16 KB | UART, GPIO (partial) |
| `netduino-plus-2` | Cortex-M4 | 1 MB | 192 KB | STM32F4 peripherals |
| `stm32vldiscovery` | Cortex-M3 | 128 KB | 8 KB | STM32F1 peripherals |

### Machines NOT in Upstream QEMU

The following are frequently mentioned online but are **not part of the official QEMU tree**:

| Name | Source | Note |
|------|--------|------|
| `stm32-p103` | `beckus/qemu_stm32` fork | Abandoned, QEMU 0.x era |
| `esp32` | `Espressif/qemu` fork | Xtensa LX7, maintained by Espressif |
| `nrf52840` | Various unofficial forks | No upstream patch series |

Using these requires building a custom QEMU fork, which carries its own maintenance burden and may diverge significantly from upstream behavior.

### Verify Available Machines

```bash
qemu-system-arm -M help | grep -i "cortex\|mps\|lm3s\|stm32\|micro"
```

---

## Running Firmware on `mps2-an385`

```bash
qemu-system-arm \
    -M mps2-an385 \
    -cpu cortex-m3 \
    -kernel firmware.elf \
    -nographic \
    -serial stdio
```

QEMU loads the ELF directly, setting PC and SP from the vector table at address 0. UART0 on `mps2-an385` is at `0x40004000`.

### UART0 Register Map (PL011 on mps2-an385)

```c
#define UART0_BASE   0x40004000UL
#define UART_DR      (*(volatile uint32_t *)(UART0_BASE + 0x000))
#define UART_FR      (*(volatile uint32_t *)(UART0_BASE + 0x018))
#define UART_CR      (*(volatile uint32_t *)(UART0_BASE + 0x030))
```

---

## Running FreeRTOS on QEMU

FreeRTOS ships a QEMU demo for `mps2-an385`. The demo exercises task scheduling, queues, timers, and semaphores.

```bash
# Clone FreeRTOS
git clone --recurse-submodules https://github.com/FreeRTOS/FreeRTOS.git

cd FreeRTOS/FreeRTOS/Demo/CORTEX_M3_MPS2_QEMU_GCC

# Build (requires arm-none-eabi-gcc)
make

# Run
qemu-system-arm -M mps2-an385 -m 16M \
    -nographic -serial stdio \
    -kernel gcc/RTOSDemo.axf
```

Expected output:

```
Starting FreeRTOS on MPS2 AN385 under QEMU...
Task1: count = 0
Task1: count = 1
...
```

---

## Running Zephyr on QEMU

Zephyr has first-class QEMU targets. The `qemu_cortex_m3` board maps to `lm3s6965evb`:

```bash
# West workspace with Zephyr
west init ~/zephyrproject
cd ~/zephyrproject
west update
west zephyr-export

# Build hello world for QEMU Cortex-M3
cd ~/zephyrproject/zephyr
west build -b qemu_cortex_m3 samples/hello_world

# Run under QEMU directly via west
west build -t run
# or manually:
qemu-system-arm \
    -M lm3s6965evb \
    -cpu cortex-m3 \
    -nographic \
    -kernel build/zephyr/zephyr.elf \
    -serial mon:stdio
```

Zephyr configures SysTick for its tick timer. By default the QEMU machine runs at a simulated 12 MHz. Set CPU frequency in Zephyr's board config if timing matters.

---

## Deterministic Execution with `-icount`

In standard mode, QEMU advances simulated time based on host real time, leading to non-deterministic behavior for tests relying on exact cycle counts or timer intervals. Use `-icount` to tie simulated time to instruction count:

```bash
qemu-system-arm -M mps2-an385 -kernel firmware.elf \
    -nographic -serial stdio \
    -icount shift=0,align=off,sleep=on
```

| Sub-option | Description |
|-----------|-------------|
| `shift=N` | 1 ns = 2^N instructions (shift=0: 1 ns/insn, shift=6: 64 ns/insn) |
| `align=on` | Align execution to clock boundaries (increases reproducibility) |
| `sleep=on` | Allow virtual clock to advance during MMIO wait loops |

`-icount` is essential for HIL tests where you need the same timer interrupt to fire after exactly the same number of instructions every run.

---

## Peripheral Fidelity Limitations

QEMU provides behavioral emulation, not cycle-accurate RTL simulation. Known gaps:

| Feature | QEMU behavior |
|---------|---------------|
| Peripheral clock gating | Not emulated; peripherals always accessible |
| DMA | Partially emulated in some machines |
| ADC | Usually not emulated or returns fixed zero |
| Low-power modes (SLEEP/STOP/STANDBY) | CPU stops but wake-up trigger accuracy is limited |
| GPIO electrical state | Not emulated; only register state is |
| Flash write timing | Instant; no write-delay, no wear model |
| Watchdog timer | Available but reset behavior may differ |

If your firmware depends on exact peripheral timing or uses peripherals not modeled by QEMU, use hardware or a higher-fidelity simulator (Renode, SimAVR) for those cases.
