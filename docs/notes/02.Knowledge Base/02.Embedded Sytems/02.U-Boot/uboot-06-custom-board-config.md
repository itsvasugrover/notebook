---
title: Custom Board & Architecture Config
createTime: 2026/03/23 00:00:00
permalink: /kb/embedded/uboot/custom-board-config/
---

# Creating Custom Architecture Configs for U-Boot

## Overview

Adding a custom board or custom SoC architecture support to U-Boot involves several layers:

1. **Architecture layer** (`arch/`) — Only if you have a new CPU/ISA (rare)
2. **SoC layer** (`arch/<arch>/mach-<soc>/`) — SoC-specific initialization
3. **Board layer** (`board/<vendor>/<board>/`) — Board-specific peripherals
4. **Device Tree** (`arch/<arch>/dts/`) — Hardware description
5. **Kconfig/defconfig** — Build-time configuration

This guide walks through creating a complete custom board called **`myboard`** based on a hypothetical **ARM Cortex-A55 SoC** called `mysoc` (similar to what you would do for NXP i.MX8M, Rockchip RK356x, TI AM62x, etc.).

---

## Step 1: Understand the Existing SoC Support

Before creating your board, check if your SoC is already supported:

```bash
# Find existing SoC support
ls arch/arm/mach-*/

# Check configs directory for similar platforms
ls configs/ | grep -i "imx8\|rk35\|am62"

# Find existing board code as a reference
find board/ -name "*.c" | xargs grep -l "board_init" | head -5
```

For this guide, assume:
- SoC: `ARM Cortex-A55` dual-core @ 1.5 GHz
- DRAM: 1 GB LPDDR4 at 0x40000000
- eMMC: HS400, SDHCI controller
- UART: NS16550-compatible at 0x30860000
- Ethernet: Designware GMAC at 0x30BE0000
- SPL: Loaded into 256 KB SRAM at 0x00100000
- U-Boot: Relocated to top 4 MB of DRAM

---

## Step 2: Create the Board Directory

```bash
mkdir -p board/myvendor/myboard
```

### `board/myvendor/myboard/Makefile`

```makefile
# board/myvendor/myboard/Makefile

obj-y += myboard.o
obj-$(CONFIG_SPL_BUILD) += spl.o
```

### `board/myvendor/myboard/Kconfig`

```kconfig
# board/myvendor/myboard/Kconfig

if TARGET_MYBOARD

config SYS_BOARD
    default "myboard"

config SYS_VENDOR
    default "myvendor"

config SYS_SOC
    default "mysoc"

config SYS_CONFIG_NAME
    default "myboard"

endif
```

---

## Step 3: Create the Board C File

### `board/myvendor/myboard/myboard.c`

```c
// board/myvendor/myboard/myboard.c
// SPDX-License-Identifier: GPL-2.0+
/*
 * Copyright (C) 2026 My Company
 * Author: Your Name <your.email@company.com>
 *
 * Board file for MyBoard (MySoC Cortex-A55)
 */

#include <common.h>
#include <env.h>
#include <fdt_support.h>
#include <hang.h>
#include <init.h>
#include <log.h>
#include <mmc.h>
#include <net.h>
#include <phy.h>
#include <asm/arch/clock.h>
#include <asm/arch/ddrphy.h>
#include <asm/arch/gpio.h>
#include <asm/arch/sys_proto.h>
#include <asm/io.h>
#include <dm/uclass.h>
#include <linux/delay.h>

DECLARE_GLOBAL_DATA_PTR;

/*
 * board_early_init_f() - called very early, before DRAM init
 * Use: Configure mux, clocks, debug UART if needed before SPL console
 */
int board_early_init_f(void)
{
    /* Enable UART clock and configure pin mux */
    mysoc_uart_init(CONFIG_DEBUG_UART_BASE);
    
    /* Configure power domains needed for early init */
    mysoc_power_domain_up(PD_UART0);
    mysoc_power_domain_up(PD_TIMER0);
    
    return 0;
}

/*
 * board_init() - post-relocation board initialization
 * Called after U-Boot has relocated to DRAM and DM is up.
 */
int board_init(void)
{
    /* If using an NXP-style architecture, save boot mode */
    /* save_boot_params_ret: see arch/arm/cpu/armv8/start.S */

    /* Configure LED GPIOs */
    gpio_request(GPIO_LED_STATUS, "led-status");
    gpio_direction_output(GPIO_LED_STATUS, 1);

    /* Example: configure USB PHY power */
    gpio_request(GPIO_USB_PWR_EN, "usb-pwr-en");
    gpio_direction_output(GPIO_USB_PWR_EN, 1);
    udelay(10000); /* 10 ms settle time */

    return 0;
}

/*
 * dram_init() - mandatory: set gd->ram_size
 * Called during board_init_f pre-relocation.
 */
int dram_init(void)
{
    /* Use get_ram_size() to probe actual DRAM
     * or just trust hardware configuration */
    gd->ram_size = SZ_1G;  /* 1 GB */
    return 0;
}

/*
 * dram_init_banksize() - fill in bd->bi_dram[]
 */
int dram_init_banksize(void)
{
    gd->bd->bi_dram[0].start = CFG_SYS_SDRAM_BASE;  /* 0x40000000 */
    gd->bd->bi_dram[0].size  = gd->ram_size;
    return 0;
}

/*
 * board_late_init() - last chance before main_loop()
 * Use: Set env variables, detect boot device, configure bootcmd.
 */
int board_late_init(void)
{
    uint32_t boot_mode;

    /* Detect boot source */
    boot_mode = mysoc_get_boot_mode();
    switch (boot_mode) {
    case BOOT_FROM_EMMC:
        env_set("bootdev", "mmc 0");
        env_set("devnum", "0");
        env_set("devtype", "mmc");
        break;
    case BOOT_FROM_SD:
        env_set("bootdev", "mmc 1");
        env_set("devnum", "1");
        env_set("devtype", "mmc");
        break;
    case BOOT_FROM_NET:
        env_set("bootdev", "net");
        break;
    }

    /* Set board revision in env */
    char rev[8];
    snprintf(rev, sizeof(rev), "%d", mysoc_get_board_rev());
    env_set("board_rev", rev);

    /* Set MAC address from fuses if not already set */
    if (!env_get("ethaddr")) {
        u8 mac[6];
        mysoc_read_mac_from_fuse(mac);
        eth_env_set_enetaddr("ethaddr", mac);
    }

    return 0;
}

/*
 * misc_init_r() - optional: miscellaneous post-relocation init
 */
int misc_init_r(void)
{
    /* Example: initialize an external PMIC via I2C */
    return 0;
}

/*
 * ft_board_setup() - called to modify device tree before passing to kernel
 * @blob: pointer to FDT blob in DRAM (modifiable copy)
 * @bd:   board info
 */
int ft_board_setup(void *blob, struct bd_info *bd)
{
    /* Fixup memory nodes */
    fdt_fixup_memory(blob, CFG_SYS_SDRAM_BASE, gd->ram_size);

    /* Modify MAC address in Ethernet node */
    u8 mac[6];
    eth_env_get_enetaddr("ethaddr", mac);
    do_fixup_by_compat(blob, "snps,dwmac-4.10a",
                       "local-mac-address", mac, 6, 1);

    /* Example: disable a node based on hardware strap */
    if (!mysoc_has_wifi()) {
        int off = fdt_path_offset(blob, "/wifi");
        if (off > 0)
            fdt_set_node_status(blob, off, FDT_STATUS_DISABLED);
    }

    return 0;
}

/*
 * checkcpu() - optional: print CPU info
 */
int checkcpu(void)
{
    printf("SoC:   MySoC Dual Cortex-A55 @ 1.5 GHz\n");
    return 0;
}

/*
 * show_board_info() - optional: print board info
 */
int show_board_info(void)
{
    printf("Board: MyBoard v%d\n", mysoc_get_board_rev());
    return 0;
}

/*
 * print_cpuinfo() - optional: called during init_sequence_f
 */
int print_cpuinfo(void)
{
    printf("CPU:   Cortex-A55 dual-core, %d MHz\n",
           mysoc_get_cpu_freq() / 1000000);
    return 0;
}
```

---

## Step 4: Create the SPL Board File

### `board/myvendor/myboard/spl.c`

```c
// board/myvendor/myboard/spl.c
// SPDX-License-Identifier: GPL-2.0+

#include <common.h>
#include <hang.h>
#include <init.h>
#include <log.h>
#include <spl.h>
#include <asm/arch/clock.h>
#include <asm/arch/ddr.h>
#include <asm/arch/sys_proto.h>
#include <asm/io.h>

/*
 * board_early_init_f() in SPL context
 * Init only what is needed to get SPL running:
 * - watchdog (disable or feed)
 * - clocks
 * - debug UART
 */
void board_init_f(ulong dummy)
{
    int ret;

    /* Initialize global data early */
    ret = spl_early_init();
    if (ret) {
        debug("spl_early_init() failed: %d\n", ret);
        hang();
    }

    /* Must come very first: disable watchdog before it fires */
    mysoc_wdt_disable();

    /* Set up PLLs/clocks for DRAM init */
    mysoc_clock_init();
    
    /* Optional: early UART for SPL debug */
    preloader_console_init();
    
    /* DRAM initialization — must complete before board_init_r */
    ret = mysoc_ddr_init();
    if (ret) {
        puts("DDR init failed!\n");
        hang();
    }
    
    puts("DDR: ");
    print_size(gd->ram_size, "\n");
}

/*
 * spl_board_init() - board-level init called from SPL common code
 * after board_init_r() has set up DM, serial, etc.
 */
void spl_board_init(void)
{
    /* Initialize eMMC PHY before SPL tries to read from it */
    mysoc_emmc_phy_init();
}

/*
 * spl_boot_device() - tell SPL where to load next stage from
 */
u32 spl_boot_device(void)
{
    /* Read boot mode straps */
    uint32_t bmode = mysoc_get_boot_mode();

    switch (bmode) {
    case BOOT_FROM_EMMC:
        return BOOT_DEVICE_MMC1;    /* eMMC on MMC1 */
    case BOOT_FROM_SD:
        return BOOT_DEVICE_MMC2;    /* SD on MMC2 */
    case BOOT_FROM_SPI_NOR:
        return BOOT_DEVICE_SPI;
    case BOOT_FROM_UART:
        return BOOT_DEVICE_UART;
    default:
        puts("Unknown boot device, defaulting to MMC1\n");
        return BOOT_DEVICE_MMC1;
    }
}

/*
 * spl_mmc_emmc_boot_partition() - select eMMC boot partition
 */
int spl_mmc_emmc_boot_partition(struct mmc *mmc)
{
    /* Boot from eMMC boot partition 1 (index 1) */
    return 1;  /* 0 = user, 1 = boot1, 2 = boot2 */
}

/*
 * board_fit_config_name_match() - select FIT config from SPL
 * Called when loading a FIT image to match board-specific config node.
 */
int board_fit_config_name_match(const char *name)
{
    /* Accept any FIT config starting with "myboard" */
    if (!strncmp(name, "myboard", 7))
        return 0;
    return -1;
}

/*
 * spl_perform_fixups() - modify FDT passed to U-Boot Proper
 * Only called if CONFIG_SPL_OF_CONTROL=y and CONFIG_SPL_STANDALONE_LOAD_ADDR
 */
void spl_perform_fixups(struct spl_image_info *spl_image)
{
    /* Can patch FDT here if needed before U-Boot Proper gets it */
}
```

---

## Step 5: Create the SoC Architecture Layer

If your SoC does not have existing U-Boot support, you also need to add it under `arch/arm/mach-mysoc/`:

```bash
mkdir -p arch/arm/mach-mysoc
```

### `arch/arm/mach-mysoc/Makefile`
```makefile
obj-y += clock.o
obj-y += ddr.o
obj-y += sys_proto.o
obj-$(CONFIG_SPL_BUILD) += spl.o
```

### `arch/arm/mach-mysoc/Kconfig`
```kconfig
if ARCH_MYSOC

choice
    prompt "MySoC variant"
    optional

config TARGET_MYSOC_EVK
    bool "MySoC EVK Reference Board"
    select BOARD_LATE_INIT
    select SUPPORT_SPL
    imply CMD_FUSE
    help
      MySoC evaluation kit reference board.

config TARGET_MYBOARD
    bool "MyBoard custom board"
    select BOARD_LATE_INIT
    select SUPPORT_SPL
    help
      Custom board based on MySoC.

endchoice

config SYS_SOC
    default "mysoc"

source "board/myvendor/myboard/Kconfig"

endif

config ARCH_MYSOC
    bool "MySoC SoC family"
    select ARM64
    select DM
    select DM_GPIO
    select DM_I2C
    select DM_MMC
    select DM_SERIAL
    select DM_SPI
    select OF_CONTROL
    select OF_LIVE
    select PINCTRL
    select SUPPORT_SPL
    select SYS_MALLOC_F
    select SYS_MALLOC_F_LEN=0x10000
    help
      Enable support for MySoC series SoC family.
```

### `arch/arm/Kconfig` — Hook your SoC in
```kconfig
# In arch/arm/Kconfig, add:
source "arch/arm/mach-mysoc/Kconfig"
```

---

## Step 6: Create the Device Tree

### `arch/arm/dts/mysoc-myboard.dts`
```dts
// arch/arm/dts/mysoc-myboard.dts
// SPDX-License-Identifier: (GPL-2.0+ OR MIT)

/dts-v1/;

#include "mysoc.dtsi"          /* SoC-level DTS include */
#include "mysoc-mysoc-pins.dtsi" /* pin mux include */

/ {
    model = "MyVendor MyBoard";
    compatible = "myvendor,myboard", "myvendor,mysoc";

    chosen {
        stdout-path = &uart0;
        /* U-Boot specific: tell U-Boot where console is */
    };

    memory@40000000 {
        device_type = "memory";
        reg = <0x0 0x40000000 0x0 0x40000000>; /* 1 GB at 0x40000000 */
    };

    /* Board-specific fixed regulators */
    reg_3v3: regulator-3v3 {
        compatible = "regulator-fixed";
        regulator-name = "VCC_3V3";
        regulator-min-microvolt = <3300000>;
        regulator-max-microvolt = <3300000>;
        regulator-always-on;
    };

    reg_1v8: regulator-1v8 {
        compatible = "regulator-fixed";
        regulator-name = "VCC_1V8";
        regulator-min-microvolt = <1800000>;
        regulator-max-microvolt = <1800000>;
        regulator-always-on;
    };

    /* LED */
    leds {
        compatible = "gpio-leds";
        status-led {
            label = "status";
            gpios = <&gpio3 14 GPIO_ACTIVE_HIGH>;
            default-state = "on";
        };
    };
};

/* Override SoC defaults for board-specific config */
&uart0 {
    pinctrl-names = "default";
    pinctrl-0 = <&uart0_pins>;
    status = "okay";
};

&usdhc1 {
    /* eMMC on USDHC1 */
    pinctrl-names = "default", "state_100mhz", "state_200mhz";
    pinctrl-0 = <&usdhc1_pins>;
    pinctrl-1 = <&usdhc1_pins_100mhz>;
    pinctrl-2 = <&usdhc1_pins_200mhz>;
    vmmc-supply = <&reg_3v3>;
    vqmmc-supply = <&reg_1v8>;
    bus-width = <8>;
    non-removable;
    status = "okay";
};

&usdhc2 {
    /* SD card on USDHC2 */
    pinctrl-names = "default";
    pinctrl-0 = <&usdhc2_pins>;
    vmmc-supply = <&reg_3v3>;
    bus-width = <4>;
    cd-gpios = <&gpio2 12 GPIO_ACTIVE_LOW>;
    status = "okay";
};

&fec1 {
    /* Ethernet (Designware GMAC) */
    pinctrl-names = "default";
    pinctrl-0 = <&fec1_pins>;
    phy-mode = "rgmii-id";
    phy-handle = <&ethphy0>;
    status = "okay";

    mdio {
        #address-cells = <1>;
        #size-cells = <0>;

        ethphy0: ethernet-phy@1 {
            compatible = "ethernet-phy-ieee802.3-c22";
            reg = <1>;
            reset-gpios = <&gpio1 9 GPIO_ACTIVE_LOW>;
            reset-assert-us = <10000>;
            reset-deassert-us = <300000>;
        };
    };
};

&i2c1 {
    pinctrl-names = "default";
    pinctrl-0 = <&i2c1_pins>;
    clock-frequency = <400000>;
    status = "okay";

    /* PMIC example */
    pmic: pmic@4b {
        compatible = "rohm,bd71847";
        reg = <0x4b>;
        pinctrl-names = "default";
        pinctrl-0 = <&pmic_pins>;
        interrupt-parent = <&gpio1>;
        interrupts = <3 IRQ_TYPE_LEVEL_LOW>;
        rohm,reset-snvs-powered;
        // ...
    };
};
```

### `arch/arm/dts/Makefile` — Register the DTB
```makefile
# In arch/arm/dts/Makefile, add:
dtb-$(CONFIG_TARGET_MYBOARD) += mysoc-myboard.dtb
```

---

## Step 7: Create the defconfig

### `configs/myboard_defconfig`
```kconfig
# configs/myboard_defconfig
# MySoC MyBoard defconfig for U-Boot 2026.01

CONFIG_ARM=y
CONFIG_ARCH_MYSOC=y
CONFIG_TARGET_MYBOARD=y
CONFIG_ARM64=y
CONFIG_DEFAULT_DEVICE_TREE="mysoc-myboard"

# Text base: U-Boot will relocate here initially, then move to top of DRAM
CONFIG_SYS_TEXT_BASE=0x40200000

# SPL
CONFIG_SPL=y
CONFIG_SPL_TEXT_BASE=0x00100000
CONFIG_SPL_MAX_SIZE=0x40000
CONFIG_SPL_STACK=0x00140000
CONFIG_SPL_BSS_START_ADDR=0x00140000
CONFIG_SPL_BSS_MAX_SIZE=0x2000
CONFIG_SPL_DM=y
CONFIG_SPL_OF_CONTROL=y
CONFIG_SPL_SERIAL=y
CONFIG_SPL_WATCHDOG=y
CONFIG_SPL_MMC=y
CONFIG_SPL_LOAD_FIT=y
CONFIG_SPL_LOAD_FIT_ADDRESS=0x40400000

# DRAM
CONFIG_NR_DRAM_BANKS=1

# Memory
CONFIG_SYS_MALLOC_LEN=0x2000000

# Environment - stored in eMMC
CONFIG_ENV_IS_IN_MMC=y
CONFIG_ENV_SIZE=0x10000
CONFIG_ENV_OFFSET=0x400000
CONFIG_SYS_MMC_ENV_DEV=0
CONFIG_SYS_MMC_ENV_PART=1

# Boot
CONFIG_BOOTDELAY=3
CONFIG_USE_BOOTCOMMAND=y
CONFIG_BOOTCOMMAND="run distro_bootcmd"
CONFIG_DISTRO_DEFAULTS=y

# Console
CONFIG_DEBUG_UART=y
CONFIG_DEBUG_UART_NS16550=y
CONFIG_DEBUG_UART_BASE=0x30860000
CONFIG_DEBUG_UART_CLOCK=24000000
CONFIG_DEBUG_UART_SHIFT=2

# Drivers
CONFIG_DM=y
CONFIG_DM_GPIO=y
CONFIG_DM_I2C=y
CONFIG_DM_MMC=y
CONFIG_MMC_SDHCI=y
CONFIG_MMC_SDHCI_SDMA=y
CONFIG_MMC_SDHCI_ADMA=y
CONFIG_DM_PCI=y
CONFIG_DM_SERIAL=y
CONFIG_SERIAL_NS16550=y
CONFIG_DM_SPI=y
CONFIG_DM_ETH=y
CONFIG_DM_ETH_PHY=y
CONFIG_ETH_DESIGNWARE=y
CONFIG_PINCTRL=y
CONFIG_PINMUX=y
CONFIG_CLK=y
CONFIG_DM_REGULATOR=y
CONFIG_DM_REGULATOR_FIXED=y
CONFIG_DM_REGULATOR_GPIO=y

# Filesystems
CONFIG_FS_FAT=y
CONFIG_FAT_WRITE=y
CONFIG_FS_EXT4=y
CONFIG_EXT4_WRITE=y
CONFIG_CMD_FAT=y
CONFIG_CMD_EXT4=y
CONFIG_CMD_FS_GENERIC=y

# Network (for development / TFTP boot)
CONFIG_NET=y
CONFIG_CMD_NET=y
CONFIG_CMD_DHCP=y
CONFIG_CMD_PING=y
CONFIG_CMD_TFTPBOOT=y

# Verified Boot (FIT)
CONFIG_FIT=y
CONFIG_FIT_SIGNATURE=y
CONFIG_RSA=y
CONFIG_RSA_VERIFY=y
CONFIG_SHA256=y
CONFIG_SHA512=y

# USB
CONFIG_USB=y
CONFIG_DM_USB=y
CONFIG_USB_XHCI_HCD=y
CONFIG_USB_STORAGE=y
CONFIG_CMD_USB=y

# EFI
CONFIG_EFI_LOADER=y
CONFIG_EFI_SECURE_BOOT=y

# Logging / Debug (reduce for production)
CONFIG_LOG=y
CONFIG_LOGLEVEL=6
```

---

## Step 8: Register the Board in Top-Level Kconfig

### `arch/arm/Kconfig` (add to appropriate selection)
```kconfig
config TARGET_MYBOARD
    bool "MyBoard (MySoC)"
    depends on ARCH_MYSOC
    select BOARD_LATE_INIT
    select SUPPORT_SPL
    help
      Custom board based on MySoC ARM Cortex-A55 SoC.
```

---

## Step 9: Build and Verify the Custom Board

```bash
export CROSS_COMPILE=aarch64-none-linux-gnu-

# Load defconfig
make myboard_defconfig

# Optionally verify via menuconfig
make menuconfig

# Build
make -j$(nproc)

# Verify outputs
ls -lh u-boot.bin spl/u-boot-spl.bin
file u-boot
aarch64-none-linux-gnu-readelf -h u-boot | grep -E "Type|Entry"

# Verify entry point matches CONFIG_SYS_TEXT_BASE
# Entry point address: 0x40200000 for U-Boot proper
```

---

## Step 10: Flash the Images

### Flash SPL to eMMC boot partition 1
```bash
# Access eMMC on Linux host via USB OTG + ums or directly
# Enable eMMC boot partition 1 for writing:
sudo mmc bootpart enable 1 1 /dev/mmcblkX

# Write SPL to eMMC boot partition 1 (offset 0):
sudo dd if=spl/u-boot-spl.bin of=/dev/mmcblkXboot0 bs=1024 seek=0 conv=fsync

# Write U-Boot FIT image to eMMC user partition (offset 4 MB):
sudo dd if=u-boot.itb of=/dev/mmcblkX bs=1024 seek=4096 conv=fsync

# Alternatively, write to SD card for bring-up:
sudo dd if=spl/u-boot-spl.bin of=/dev/sdX bs=1024 seek=4 conv=fsync
sudo dd if=u-boot.itb of=/dev/sdX bs=1024 seek=1024 conv=fsync
```

---

## Custom Architecture: Adding a New CPU Architecture

If you need to support a completely new ISA (Instruction Set Architecture) that U-Boot does not currently support:

### Required Files

```
arch/mynewarch/
├── Kconfig             # Architecture Kconfig
├── Makefile            # Arch Makefile
├── config.mk           # Compiler flags
├── cpu/
│   ├── Makefile
│   ├── start.S         # Reset vector / entry point
│   ├── cpu.c           # CPU info, reset
│   ├── cache.c         # Cache management
│   └── interrupts.c    # Interrupt handling
├── include/
│   └── asm/
│       ├── global_data.h   # DECLARE_GLOBAL_DATA_PTR register binding
│       ├── io.h            # MMIO access (readl/writel)
│       ├── processor.h     # CPU-specific primitives
│       ├── sections.h      # Linker section definitions
│       └── u-boot-mynewarch.lds  # Linker script
└── lib/
    ├── Makefile
    ├── bootm.c         # bootm kernel handoff
    └── relocate.S      # Relocation code
```

### Linker Script Template (`arch/mynewarch/cpu/u-boot.lds`)

```ld
OUTPUT_FORMAT("elf64-mynewarch", "elf64-mynewarch", "elf64-mynewarch")
OUTPUT_ARCH(mynewarch)
ENTRY(_start)

SECTIONS
{
    . = 0x00000000;

    .text : {
        *(.__image_copy_start)
        arch/mynewarch/cpu/start.o (.text*)
        *(.text*)
    }

    . = ALIGN(8);
    .rodata : { *(.rodata*) }

    . = ALIGN(8);
    .data : { *(.data*) }

    . = ALIGN(8);
    .u_boot_list : {
        KEEP(*(SORT(.u_boot_list*)));
    }

    . = ALIGN(8);
    __image_copy_end = .;

    .bss (NOLOAD) : {
        __bss_start = .;
        *(.bss*)
        . = ALIGN(8);
        __bss_end = .;
    }
}
```

### `arch/mynewarch/include/asm/global_data.h`
```c
#ifndef __ASM_MYNEWARCH_GLOBAL_DATA_H
#define __ASM_MYNEWARCH_GLOBAL_DATA_H

/* Define which register stores the gd pointer.
 * Choose a callee-saved register per the ABI. */
#define DECLARE_GLOBAL_DATA_PTR  \
    register volatile gd_t *gd asm("a9")

#include <asm-generic/global_data.h>

#endif
```

### Top-level `arch/Kconfig` — Register the arch
```kconfig
# In arch/Kconfig:
config MYNEWARCH
    bool "MyNewArch"
    select SYS_SUPPORTS_LITTLE_ENDIAN
    select DM
    select OF_CONTROL
    help
      Support for MyNewArch instruction set architecture.
```
