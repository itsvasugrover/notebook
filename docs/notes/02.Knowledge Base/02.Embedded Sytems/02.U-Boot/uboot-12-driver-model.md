---
title: Driver Model (DM)
createTime: 2026/03/23 00:00:00
permalink: /kb/embedded/uboot/driver-model/
---

# U-Boot Driver Model (DM)

## Overview

The Driver Model (DM) is U-Boot's unified framework for managing hardware devices and drivers. Introduced in 2014 and fully mandatory as of U-Boot 2023+, DM provides:

- Structured separation between device and driver
- Automatic device tree probing
- Parent/child device relationships  
- Uclass (device class) abstraction
- Power management hooks (probe/remove)
- Resource management (devres)

As of **2026.01**, ALL core drivers use DM. Legacy non-DM drivers have been removed.

---

## Core Concepts

### Three Main Objects

```
struct udevice     → A specific hardware instance (e.g., UART0)
struct uclass      → A class of devices (e.g., all UARTs = UCLASS_SERIAL)
struct driver      → The software driver code (e.g., ns16550_serial_driver)
```

### Relationships

```
UCLASS_SERIAL (uclass)
    ├── serial0 (udevice) ← ns16550_serial_driver (driver)
    ├── serial1 (udevice) ← pl011_serial_driver (driver)
    └── serial2 (udevice) ← dwc3_gadget_dev (USB gadget serial)

UCLASS_MMC (uclass)
    ├── mmc@30B40000 (udevice) ← sdhci_driver (driver)
    └── mmc@30B50000 (udevice) ← sdhci_driver (driver)

UCLASS_ETH (uclass)
    └── ethernet@30BE0000 (udevice) ← dwc_eth_qos_driver (driver)
```

---

## `struct udevice` — Device Instance

```c
// include/dm/device.h
struct udevice {
    const struct driver     *driver;     // Driver bound to this device
    const char              *name;       // Device name (from DTS)
    void                    *plat_;      // Platform data (driver-specific)
    void                    *parent_plat_; // Parent's platform data for child
    void                    *uclass_plat_; // Uclass-specific data for device
    ulong                   driver_data; // Driver match data (from of_match)
    struct udevice          *parent;     // Parent udevice (bus or root)
    void                    *priv_;      // Private data (driver allocates)
    struct uclass           *uclass;     // Uclass this device belongs to
    void                    *uclass_priv_; // Uclass private data
    void                    *parent_priv_; // Parent driver data for child
    struct list_head        uclass_node; // List in uclass->dev_head
    struct list_head        child_head;  // List of child devices
    struct list_head        sibling_node;// List in parent->child_head
    u32                     flags;       // DM_FLAG_* flags
    int                     req_seq;     // Requested sequence number (from DTS)
    int                     seq_;        // Assigned sequence number
    ofnode                  node;        // DT node (if from DT)
    struct list_head        devres_head; // devres (managed resources) list
    struct udevice          *dma_iommu; // IOMMU device for DMA
};
```

### Accessing Device Data Safely

```c
// Accessor macros — ALWAYS use these, never access _ fields directly
dev_get_priv(dev)           → driver private data (void*)
dev_get_plat(dev)           → platform data
dev_get_parent_priv(dev)    → parent's private data for this child
dev_get_uclass_priv(dev)    → uclass private data for this device
dev_get_parent_plat(dev)    → parent's platform data for child
dev_ofnode(dev)             → device's DT ofnode

// Cast to typed pointer:
struct my_priv *priv = dev_get_priv(dev);
struct my_plat *plat = dev_get_plat(dev);
```

---

## `struct driver` — Driver Definition

```c
// include/dm/device.h
struct driver {
    char                    *name;       // Driver name
    enum uclass_id          id;          // Which uclass this belongs to
    const struct udevice_id *of_match;   // DT compatible strings
    int (*bind)(struct udevice *dev);    // Called at bind time
    int (*probe)(struct udevice *dev);   // Called to activate device
    int (*remove)(struct udevice *dev);  // Called to deactivate device
    int (*unbind)(struct udevice *dev);  // Called to unbind
    int (*of_to_plat)(struct udevice *dev); // Parse DT → platform data
    int (*child_post_bind)(struct udevice *dev); // After child bind
    int (*child_pre_probe)(struct udevice *dev); // Before child probe
    int (*child_post_remove)(struct udevice *dev); // After child remove
    int priv_auto;       // Size of driver private data (auto-allocated)
    int plat_auto;       // Size of platform data (auto-allocated)
    int per_child_auto;  // Size of parent data per child
    int per_child_plat_auto; // Size of parent plat per child
    const void *ops;     // Operations struct pointer (uclass-specific)
    u32 flags;           // DM_FLAG_* flags
    /* ... */
};
```

### Registering a Driver

```c
// At the bottom of your driver file:
U_BOOT_DRIVER(my_uart_driver) = {
    .name           = "my_uart",
    .id             = UCLASS_SERIAL,
    .of_match       = my_uart_ids,       // matches compatible strings
    .of_to_plat     = my_uart_of_to_plat,
    .probe          = my_uart_probe,
    .remove         = my_uart_remove,
    .ops            = &my_uart_ops,
    .priv_auto      = sizeof(struct my_uart_priv),
    .plat_auto      = sizeof(struct my_uart_plat),
    .flags          = DM_FLAG_PRE_RELOC,  // needed if used in early boot
};
```

---

## Writing a Complete Driver: NS16550 UART Example

```c
// drivers/serial/ns16550.c (simplified and annotated)
// SPDX-License-Identifier: GPL-2.0+

#include <dm.h>
#include <errno.h>
#include <fdtdec.h>
#include <ns16550.h>
#include <serial.h>
#include <clk.h>
#include <asm/io.h>
#include <linux/compiler.h>

/* Platform data structure — populated from DT in of_to_plat() */
struct ns16550_plat {
    unsigned long   base;         // MMIO base address
    int             reg_width;    // Register width (1, 2, or 4 bytes)
    int             reg_shift;    // Register stride shift (e.g., 2 = 4-byte stride)
    int             reg_offset;   // Byte offset to first register
    unsigned long   clock;        // Input clock frequency in Hz
    unsigned int    fcr;          // FIFO Control Register value
    bool            skip_init;    // Skip full init (use ROM settings)
};

/* Driver private data — allocated automatically (priv_auto bytes) */
struct ns16550_priv {
    struct ns16550_plat plat;  // copy used at runtime
    int                 port;  // Port number
};

/* Compatible strings matched against DT "compatible" property */
static const struct udevice_id ns16550_ids[] = {
    { .compatible = "ns16550a",           .data = PORT_NS16550A },
    { .compatible = "ns16550",            .data = PORT_NS16550 },
    { .compatible = "snps,dw-apb-uart",   .data = PORT_NS16550A },
    { .compatible = "ti,omap2-uart",      .data = PORT_NS16550A },
    { .compatible = "nxp,lpuart",         .data = PORT_NS16550A },
    { }  // Terminator
};

/* Parse device tree into plat structure */
static int ns16550_of_to_plat(struct udevice *dev)
{
    struct ns16550_plat *plat = dev_get_plat(dev);
    struct clk clk;
    int err;

    /* Read MMIO base address from DT "reg" property */
    plat->base = dev_read_addr(dev);
    if (plat->base == FDT_ADDR_T_NONE)
        return -EINVAL;

    /* Read optional register config */
    plat->reg_width = dev_read_u32_default(dev, "reg-io-width", 1);
    plat->reg_shift = dev_read_u32_default(dev, "reg-shift", 0);
    plat->reg_offset = dev_read_u32_default(dev, "reg-offset", 0);
    plat->skip_init = dev_read_bool(dev, "skip-init");

    /* Get clock frequency */
    err = clk_get_by_index(dev, 0, &clk);
    if (!err) {
        plat->clock = clk_get_rate(&clk);
        clk_free(&clk);
    } else {
        plat->clock = dev_read_u32_default(dev, "clock-frequency",
                                            CONFIG_SYS_NS16550_CLK);
    }

    return 0;
}

/* Probe: called to activate the device (set up hardware) */
static int ns16550_probe(struct udevice *dev)
{
    struct ns16550_plat *plat = dev_get_plat(dev);

    if (plat->skip_init)
        return 0;

    NS16550_init((NS16550_t)plat->base, plat->clock / 16 / CONFIG_BAUDRATE);
    return 0;
}

/* Serial ops: getc/putc/pending/setbrg */
static int ns16550_serial_getc(struct udevice *dev)
{
    struct ns16550_plat *plat = dev_get_plat(dev);
    NS16550_t com_port = (NS16550_t)plat->base;

    if (!(serial_in(&com_port->lsr) & UART_LSR_DR))
        return -EAGAIN;
    return serial_in(&com_port->rbr);
}

static int ns16550_serial_putc(struct udevice *dev, const char ch)
{
    struct ns16550_plat *plat = dev_get_plat(dev);
    NS16550_t com_port = (NS16550_t)plat->base;

    if (!(serial_in(&com_port->lsr) & UART_LSR_THRE))
        return -EAGAIN;
    serial_out(ch, &com_port->thr);
    return 0;
}

static int ns16550_serial_pending(struct udevice *dev, bool input)
{
    struct ns16550_plat *plat = dev_get_plat(dev);
    NS16550_t com_port = (NS16550_t)plat->base;

    if (input)
        return (serial_in(&com_port->lsr) & UART_LSR_DR) ? 1 : 0;
    else
        return (serial_in(&com_port->lsr) & UART_LSR_THRE) ? 0 : 1;
}

static int ns16550_serial_setbrg(struct udevice *dev, int baudrate)
{
    struct ns16550_plat *plat = dev_get_plat(dev);
    NS16550_setbrg((NS16550_t)plat->base, plat->clock, baudrate);
    return 0;
}

/* Ops structure: implements the uclass interface */
static const struct dm_serial_ops ns16550_serial_ops = {
    .putc   = ns16550_serial_putc,
    .pending = ns16550_serial_pending,
    .getc   = ns16550_serial_getc,
    .setbrg = ns16550_serial_setbrg,
};

/* Register the driver */
U_BOOT_DRIVER(ns16550_serial) = {
    .name           = "ns16550_serial",
    .id             = UCLASS_SERIAL,
    .of_match       = ns16550_ids,
    .of_to_plat     = ns16550_of_to_plat,
    .probe          = ns16550_probe,
    .ops            = &ns16550_serial_ops,
    .flags          = DM_FLAG_PRE_RELOC,
    .plat_auto      = sizeof(struct ns16550_plat),
};
```

---

## Uclass

Each category of devices is managed by a uclass. Uclasses define the **interface** (ops struct) that all drivers in that class must implement.

### Key Uclasses

| `uclass_id` | Header | Purpose |
|------------|--------|---------|
| `UCLASS_SERIAL` | `include/serial.h` | UART/serial ports |
| `UCLASS_MMC` | `include/mmc.h` | MMC/SD/eMMC |
| `UCLASS_ETH` | `include/net.h` | Ethernet |
| `UCLASS_CLK` | `include/clk.h` | Clock drivers |
| `UCLASS_GPIO` | `include/asm/gpio.h` | GPIO banks |
| `UCLASS_I2C` | `include/i2c.h` | I2C bus |
| `UCLASS_I2C_GENERIC` | `include/i2c.h` | I2C device |
| `UCLASS_SPI` | `include/spi.h` | SPI bus master |
| `UCLASS_SPI_FLASH` | `include/spi_flash.h` | SPI-NOR flash |
| `UCLASS_MTD` | `include/mtd.h` | MTD flash |
| `UCLASS_USB` | `include/usb.h` | USB host |
| `UCLASS_USB_GADGET_GENERIC` | | USB gadget |
| `UCLASS_PINCTRL` | `include/pinctrl.h` | Pin multiplexer |
| `UCLASS_REGULATOR` | `include/power/regulator.h` | Voltage regulator |
| `UCLASS_PMIC` | `include/power/pmic.h` | PMIC |
| `UCLASS_PHY` | `include/phy-uclass.h` | generic PHY |
| `UCLASS_RESET` | `include/reset.h` | Reset controller |
| `UCLASS_TIMER` | `include/timer.h` | Hardware timers |
| `UCLASS_WATCHDOG` | `include/watchdog.h` | Watchdog timer |
| `UCLASS_TPM` | `include/tpm-v1.h` | TPM 1.2/2.0 |
| `UCLASS_VIDEO` | `include/video.h` | Display/video |
| `UCLASS_PANEL` | `include/panel.h` | Panel (LCD/HDMI) |
| `UCLASS_FIRMWARE` | `include/firmware.h` | Firmware helpers |
| `UCLASS_SCMI_AGENT` | | SCMI protocol agent |

### Defining a New Uclass

```c
// include/dm/uclass-id.h — add your UCLASS_MY_TYPE
// lib/dm/uclass-id.c — add entry

// drivers/mysubsys/my-uclass.c

UCLASS_DRIVER(my_type) = {
    .id         = UCLASS_MY_TYPE,
    .name       = "my_type",
    .post_bind  = dm_scan_fdt_dev,
    .priv_auto  = sizeof(struct my_uclass_priv),
    .per_device_auto = sizeof(struct my_device_priv),
};
```

---

## DM Init Sequence

```c
// Normal flow (U-Boot proper):
dm_init()          → Creates root device, uclass tree
dm_scan_platdata() → Bind devices from board platdata (non-DT, legacy)
dm_scan_fdt()      → Scan DT, bind matching devices
dm_scan_other()    → Other device sources (e.g., virtual devices)

// For SPL (limited):
spl_early_init()   → subset DM init
dm_init_and_scan(true)  // true = pre-reloc phase
```

---

## devres — Managed Resources

Similar to Linux's devres, U-Boot supports automatic resource deallocation when a device is removed:

```c
// drivers/serial/my_driver.c
static int my_driver_probe(struct udevice *dev)
{
    struct my_priv *priv;
    int *ptr;
    
    // Memory freed automatically when device is removed
    ptr = devm_kmalloc(dev, 64, GFP_KERNEL);
    if (!ptr)
        return -ENOMEM;
    
    // GPIO claimed, released on remove
    int ret = devm_gpio_request(dev, gpio, "my-gpio");
    if (ret)
        return ret;
    
    // Clock obtained, released on remove
    struct clk *clk = devm_clk_get(dev, "mclk");
    if (IS_ERR(clk))
        return PTR_ERR(clk);
    
    return 0;
}
```

---

## Useful DM Debug Commands

```bash
# At U-Boot prompt:
dm tree           # Full tree of all bound devices with probe state
dm drivers        # List all registered drivers
dm uclass         # Show uclasses and their devices
dm devres         # Show managed resources per device
dm status         # Show DM statistics
```

Sample `dm tree` output:
```
 Class    Index  Probed  Driver                Name
-----------------------------------------------------------
 root         0  yes     root_driver           root_driver
 serial       0  yes     ns16550_serial        |-- serial@30860000
 clk          0  yes     clk_imx8mm            |-- clock-controller@30380000
 pinctrl      0  yes     pinctrl_imx           |-- pinctrl@30330000
 mmc          0  yes     sdhci-esdhc-imx       |-- mmc@30B40000
 mmc          1  yes     sdhci-esdhc-imx       |-- mmc@30B50000
 eth          0  yes     dwc_eth_qos           |-- ethernet@30BE0000
 i2c          0  yes     i2c_imx               |-- i2c@30A20000
```
