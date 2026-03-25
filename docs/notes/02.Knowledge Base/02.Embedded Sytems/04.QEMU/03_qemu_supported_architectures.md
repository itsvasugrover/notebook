---
title: QEMU Supported Architectures
createTime: 2026/03/14 14:21:19
permalink: /kb/embedded/qemu/qemu-supported-architectures/
---

# QEMU Supported Architectures

## Emulation Modes per Architecture

Each QEMU target comes in two flavors:

| Flavor | Binary | What it emulates |
|--------|--------|-----------------|
| **Full-system** (`softmmu`) | `qemu-system-<arch>` | Full machine: CPU + RAM + peripherals + devices |
| **User-mode** | `qemu-<arch>` | CPU only; syscalls forwarded to host kernel |

Not all architectures support both modes. Most embedded workflows use `softmmu`.

---

## Architectures Reference for Embedded Development

### ARM 32-bit (`qemu-system-arm`)

The most important target for embedded Linux and bare-metal MCU development.

**Key machines (`-M <name>`):**

| Machine | Description | Embedded Use |
|---------|-------------|--------------|
| `virt` | Generic ARM virt platform (recommended for new projects) | Cortex-A7/A15/A53 with GICv2/v3, VirtIO, PCI |
| `versatilepb` | ARM Versatile Platform Baseboard (Cortex-A8) | Legacy; good for teaching |
| `realview-pb-a8` | RealView Platform Baseboard with Cortex-A8 | ARM Linux kernel testing |
| `mps2-an385` | ARM MPS2 with Cortex-M3 | **Bare-metal Cortex-M3** |
| `mps2-an386` | ARM MPS2 with Cortex-M4 | **Bare-metal Cortex-M4** |
| `mps2-an500` | ARM MPS2 with Cortex-M7 | **Bare-metal Cortex-M7** |
| `mps2-an505` | ARM MPS2 with Cortex-M33 (TrustZone) | **Bare-metal Cortex-M33** |
| `netduino-plus-2` | Netduino+ 2 (STM32F405, Cortex-M4) | STM32-class MCU firmware |
| `stm32vldiscovery` | STM32VL Discovery (STM32F100, Cortex-M3) | STM32 bare-metal |
| `lm3s6965evb` | LM3S6965 Eval Board (Cortex-M3) | FreeRTOS demo target |
| `connex` | Sharp LH7A400 (ARM922T) | Legacy |

```bash
# List all available ARM machines:
qemu-system-arm -M help

# List CPUs for a machine:
qemu-system-arm -M virt -cpu help
```

### AArch64 (`qemu-system-aarch64`)

The primary target for modern 64-bit embedded Linux (Cortex-A55, A72, A78 class SoCs).

| Machine | Description |
|---------|-------------|
| `virt` | **Most useful**: generic SBSA-compatible machine, GICv3, PCIe, VirtIO |
| `cortex-a57-a53` | Big.LITTLE topology |
| `raspi3ap` | Raspberry Pi 3 Model A+ (BCM2837, 4x Cortex-A53) |
| `raspi4b` | Raspberry Pi 4B (BCM2711, 4x Cortex-A72) |
| `sbsa-ref` | SBSA Reference platform (server-class standardized) |
| `xlnx-versal-virt` | Xilinx Versal (Cortex-A72+R5+AI Engine) |
| `xlnx-zcu102` | Xilinx ZCU102 (Zynq UltraScale+) |
| `fsl-imx8mp-evk` | NXP i.MX8M Plus EVK |

```bash
# The virt machine with explicit CPU:
qemu-system-aarch64 -M virt -cpu cortex-a72 \
  -m 1G -nographic \
  -kernel Image -append "console=ttyAMA0" -initrd initramfs.cpio.gz

# With device tree:
qemu-system-aarch64 -M virt -cpu cortex-a57 \
  -kernel Image -dtb virt.dtb -drive file=rootfs.ext4,format=raw,if=virtio
```

### RISC-V (`qemu-system-riscv32`, `qemu-system-riscv64`)

| Machine | Description |
|---------|-------------|
| `virt` | Generic RISC-V virt (CLINT, PLIC, VirtIO) — most useful |
| `sifive_u` | SiFive U540/U500 SoC |
| `sifive_e` | SiFive E31/E51 microcontroller (32-bit) |
| `spike` | Spike RISC-V reference ISA simulator |
| `microchip-icicle-kit` | Microchip PolarFire SoC Icicle Kit |

```bash
# Boot Linux on RISC-V 64:
qemu-system-riscv64 -M virt -cpu rv64 \
  -kernel fw_jump.elf \
  -device loader,file=Image,addr=0x80200000 \
  -append "root=/dev/vda console=ttyS0" \
  -drive file=rootfs.ext4,if=virtio,format=raw
```

### x86 / x86_64 (`qemu-system-x86_64`)

Used when the target is x86, or for UEFI/BIOS development.

| Machine | Description |
|---------|-------------|
| `pc` | Standard PC (i440FX + PIIX3, legacy) |
| `q35` | Modern PC chipset (Q35 + ICH9, PCIe) |
| `microvm` | Minimal: no PCI bus, fast boot, paravirt-only |

### PowerPC (`qemu-system-ppc`, `qemu-system-ppc64`)

| Machine | Use |
|---------|-----|
| `40p` | PowerPC Reference Platform |
| `g3beige` | Power Mac G3 |
| `ppce500` | Freescale e500 (still used in networking) |
| `bamboo` | AMCC 440EP evaluation |

### MIPS (`qemu-system-mips`, `mipsel`, `mips64`, `mips64el`)

| Machine | Use |
|---------|-----|
| `malta` | MIPS Malta reference board |
| `boston` | Baikal-T1 / MIPS I6400 |

### Xtensa (`qemu-system-xtensa`)

Used for ESP32 bare-metal testing (requires ESP-specific QEMU build, not upstream).

---

## CPU Selection

Within a machine, you can often select a specific CPU core:

```bash
# AArch64 CPU options:
qemu-system-aarch64 -M virt -cpu cortex-a72
qemu-system-aarch64 -M virt -cpu cortex-a55
qemu-system-aarch64 -M virt -cpu max        # Best emulated: all features enabled

# With feature flags:
qemu-system-aarch64 -M virt -cpu cortex-a72,+sve,sve256=on

# List all CPUs for a given machine/arch:
qemu-system-aarch64 -M virt -cpu help
```

---

## What Is NOT in Upstream QEMU

Common misconceptions — these machines exist only in unofficial forks:
- `stm32-p103` — only in [beckus/qemu_stm32](https://github.com/beckus/qemu_stm32), not upstream
- ESP32 — only in [Espressif's fork](https://github.com/espressif/qemu), not upstream
- Nordic nRF52 — not in upstream QEMU
- Raspberry Pi (full BCM2835) — `raspi2b`/`raspi3ap` exist in upstream but with incomplete peripheral support

For STM32 development with better peripheral fidelity, use Renode instead of QEMU.

---

## Machine Versioning

QEMU machines are versioned to preserve migration compatibility. When a machine type changes, the old behavior is kept under a versioned alias:

```bash
qemu-system-aarch64 -M virt          # Latest version of virt machine
qemu-system-aarch64 -M virt-8.0     # Frozen at QEMU 8.0 behavior
qemu-system-aarch64 -M virt-9.1     # Frozen at QEMU 9.1 behavior

# See all machine versions:
qemu-system-aarch64 -M help | grep virt
```

For embedded testing (non-migrated VMs), always use the unversioned name to get the latest improvements.

## Supported Architectures

### 1. **x86 and x86_64**
   - Widely used for general-purpose computing.
   - Ideal for testing and debugging software for desktop and server environments.
   - Used for UEFI firmware development.

### 2. **ARM and AArch64**
   - Commonly used in embedded systems, IoT devices, and mobile platforms.
   - Supports both 32-bit (ARM) and 64-bit (AArch64) architectures.
   - Frequently used for embedded Linux systems.

### 3. **RISC-V**
   - An open-source instruction set architecture gaining popularity in research and development.
   - Suitable for experimenting with custom hardware designs.

### 4. **PowerPC**
   - Used in legacy systems and some embedded applications.
   - Supports both 32-bit and 64-bit variants.

### 5. **MIPS**
   - Common in networking equipment and embedded systems.
   - Offers support for multiple MIPS variants.

### 6. **SPARC**
   - Historically used in high-performance computing and enterprise servers.
   - Useful for maintaining legacy systems.

### 7. **Other Architectures**
   - **SH4**: Used in some older embedded systems.
   - **MicroBlaze**: A soft processor core for FPGA-based designs.
   - **Xtensa**: Common in DSPs and microcontrollers, such as those used in ESP32.


