---
title: QEMU Custom Device Models
createTime: 2026/03/14 14:21:19
permalink: /kb/embedded/qemu/qemu-custom-device-models/
---

# QEMU Custom Device Models

This page builds a complete, compilable QEMU device model from scratch using the QEMU Object Model (QOM). It covers the full QOM lifecycle, MemoryRegion registration, interrupt delivery, chardev integration, VMState save/restore, and device properties.

---

## QOM (QEMU Object Model) Foundations

QOM is QEMU's C-based object system, providing single inheritance, interfaces, and typed properties without requiring C++. Every device, bus, machine, and CPU in QEMU is a QOM object.

### Core Types

```
Object                  ← base of all objects
└── DeviceState         ← all hardware devices
    └── SysBusDevice    ← devices on the system bus (MMIO + IRQs)
        └── PL011State  ← example: the PL011 UART
```

### TypeInfo Registration

Every QOM type is registered with a `TypeInfo` struct:

```c
static const TypeInfo my_uart_info = {
    .name          = TYPE_MY_UART,           /* "my-uart" */
    .parent        = TYPE_SYS_BUS_DEVICE,
    .instance_size = sizeof(MyUARTState),    /* allocate this much */
    .instance_init = my_uart_instance_init,  /* constructor */
    .class_init    = my_uart_class_init,     /* class vtable setup */
};

static void my_uart_register_types(void)
{
    type_register_static(&my_uart_info);
}

type_init(my_uart_register_types);          /* runs at QEMU startup */
```

`type_init` registers a constructor via a GCC `__attribute__((constructor))` section, so it runs before `main()`.

### Object Lifecycle

| Phase | Function | Description |
|-------|----------|-------------|
| Type registration | `class_init` | Sets up the class vtable once per type |
| Memory allocation | (qom internal) | `g_malloc0(instance_size)` |
| Instance init | `instance_init` | Initialize per-instance fields; no hardware yet |
| Realization | `realize` / `DeviceClass.realize` | Connect to buses, map MMIO, connect IRQs |
| Unrealization | `unrealize` | Unplug hot-removable devices |
| Finalization | `instance_finalize` | Free resources |

The key distinction: `instance_init` sets up data structures (it may not access other devices); `realize` performs board-level wiring and is called after all devices exist.

---

## Complete Device Example: `my-uart`

A minimal but fully functional UART-like device that:
- Has a 32-byte TX FIFO
- Exposes MMIO registers (DATA, STATUS, CONTROL)
- Fires an IRQ when TX data is written
- Connects to a host chardev for I/O

### Header-Style Declarations

Using the `OBJECT_DECLARE_SIMPLE_TYPE` macro (QEMU >= 6.0):

```c
/* my_uart.h */
#ifndef MY_UART_H
#define MY_UART_H

#include "hw/sysbus.h"
#include "chardev/char-fe.h"

#define TYPE_MY_UART "my-uart"
OBJECT_DECLARE_SIMPLE_TYPE(MyUARTState, MY_UART)

/* Register offsets */
#define MY_UART_REG_DATA    0x00  /* W: transmit byte; R: receive byte */
#define MY_UART_REG_STATUS  0x04  /* R: status flags                   */
#define MY_UART_REG_CTRL    0x08  /* R/W: control register             */
#define MY_UART_REG_SIZE    0x10  /* total MMIO size                   */

#define MY_UART_STATUS_TXRDY  (1u << 0)  /* TX ready (FIFO not full) */
#define MY_UART_STATUS_RXRDY  (1u << 1)  /* RX byte available        */
#define MY_UART_CTRL_TXIRQEN  (1u << 0)  /* enable TX interrupt      */
#define MY_UART_CTRL_RXIRQEN  (1u << 1)  /* enable RX interrupt      */

struct MyUARTState {
    SysBusDevice parent_obj;    /* QOM parent — must be first */

    MemoryRegion mmio;          /* MMIO region, 0x10 bytes        */
    CharBackend  chr;           /* host chardev backend           */
    qemu_irq     irq;           /* single interrupt output line   */

    uint32_t ctrl;              /* CTRL register state            */
    uint8_t  rxbuf;             /* one-byte RX buffer             */
    bool     rx_pending;        /* byte available in rxbuf        */
};

#endif /* MY_UART_H */
```

`OBJECT_DECLARE_SIMPLE_TYPE(MyUARTState, MY_UART)` expands to:
```c
typedef struct MyUARTState MyUARTState;
DECLARE_INSTANCE_CHECKER(MyUARTState, MY_UART, TYPE_MY_UART)
```

which defines `MY_UART(obj)` as a type-checked cast macro.

### Implementation

```c
/* my_uart.c */
#include "qemu/osdep.h"
#include "hw/qdev-properties-system.h"
#include "hw/registerfields.h"
#include "my_uart.h"
#include "qapi/error.h"

/* ─── MemoryRegionOps ─────────────────────────────────────── */

static uint64_t my_uart_read(void *opaque, hwaddr offset, unsigned size)
{
    MyUARTState *s = MY_UART(opaque);

    switch (offset) {
    case MY_UART_REG_DATA:
        if (s->rx_pending) {
            uint8_t val = s->rxbuf;
            s->rx_pending = false;
            /* Notify chardev: we can accept another byte */
            qemu_chr_fe_accept_input(&s->chr);
            return val;
        }
        return 0xFF;   /* no data: return 0xFF (undefined per spec) */

    case MY_UART_REG_STATUS: {
        uint32_t status = MY_UART_STATUS_TXRDY;  /* TX always ready */
        if (s->rx_pending)
            status |= MY_UART_STATUS_RXRDY;
        return status;
    }

    case MY_UART_REG_CTRL:
        return s->ctrl;

    default:
        qemu_log_mask(LOG_UNIMP,
                      "my-uart: unimplemented read at offset 0x%" HWADDR_PRIx "\n",
                      offset);
        return 0;
    }
}

static void my_uart_write(void *opaque, hwaddr offset,
                          uint64_t value, unsigned size)
{
    MyUARTState *s = MY_UART(opaque);

    switch (offset) {
    case MY_UART_REG_DATA: {
        /* Transmit one byte via chardev */
        uint8_t ch = (uint8_t)(value & 0xFF);
        qemu_chr_fe_write_all(&s->chr, &ch, 1);
        /* If TX interrupts are enabled, assert IRQ then deassert */
        if (s->ctrl & MY_UART_CTRL_TXIRQEN) {
            qemu_set_irq(s->irq, 1);
            qemu_set_irq(s->irq, 0);
        }
        break;
    }
    case MY_UART_REG_CTRL:
        s->ctrl = (uint32_t)value;
        break;
    default:
        qemu_log_mask(LOG_UNIMP,
                      "my-uart: unimplemented write at offset 0x%" HWADDR_PRIx "\n",
                      offset);
        break;
    }
}

static const MemoryRegionOps my_uart_ops = {
    .read  = my_uart_read,
    .write = my_uart_write,
    .endianness = DEVICE_LITTLE_ENDIAN,
    .valid = {
        .min_access_size = 4,
        .max_access_size = 4,
    },
};

/* ─── CharDev receive callback ───────────────────────────── */

static int my_uart_chr_can_receive(void *opaque)
{
    MyUARTState *s = MY_UART(opaque);
    return s->rx_pending ? 0 : 1;   /* accept one byte at a time */
}

static void my_uart_chr_receive(void *opaque, const uint8_t *buf, int size)
{
    MyUARTState *s = MY_UART(opaque);
    s->rxbuf = buf[0];
    s->rx_pending = true;
    if (s->ctrl & MY_UART_CTRL_RXIRQEN) {
        qemu_set_irq(s->irq, 1);
    }
}

/* ─── VMState (save/restore) ─────────────────────────────── */

static const VMStateDescription my_uart_vmstate = {
    .name = "my-uart",
    .version_id = 1,
    .minimum_version_id = 1,
    .fields = (VMStateField[]) {
        VMSTATE_UINT32(ctrl,       MyUARTState),
        VMSTATE_UINT8(rxbuf,       MyUARTState),
        VMSTATE_BOOL(rx_pending,   MyUARTState),
        VMSTATE_END_OF_LIST()
    }
};

/* ─── Device lifecycle ───────────────────────────────────── */

static void my_uart_realize(DeviceState *dev, Error **errp)
{
    MyUARTState *s = MY_UART(dev);
    SysBusDevice *sbd = SYS_BUS_DEVICE(dev);

    /* Initialize MMIO region */
    memory_region_init_io(&s->mmio, OBJECT(s), &my_uart_ops, s,
                          TYPE_MY_UART, MY_UART_REG_SIZE);
    sysbus_init_mmio(sbd, &s->mmio);

    /* Initialize one IRQ output line */
    sysbus_init_irq(sbd, &s->irq);

    /* Register chardev callbacks */
    qemu_chr_fe_set_handlers(&s->chr,
                             my_uart_chr_can_receive,
                             my_uart_chr_receive,
                             NULL,   /* event callback */
                             NULL,   /* backend changed */
                             s, NULL, true);
}

static void my_uart_instance_init(Object *obj)
{
    MyUARTState *s = MY_UART(obj);
    s->ctrl = 0;
    s->rx_pending = false;
}

/* ─── Device properties ──────────────────────────────────── */

static Property my_uart_properties[] = {
    DEFINE_PROP_CHR("chardev", MyUARTState, chr),
    DEFINE_PROP_END_OF_LIST(),
};

/* ─── Class init (vtable setup) ──────────────────────────── */

static void my_uart_class_init(ObjectClass *oc, void *data)
{
    DeviceClass *dc = DEVICE_CLASS(oc);
    dc->realize = my_uart_realize;
    dc->vmsd    = &my_uart_vmstate;
    device_class_set_props(dc, my_uart_properties);
    set_bit(DEVICE_CATEGORY_MISC, dc->categories);
}

/* ─── Type registration ──────────────────────────────────── */

static const TypeInfo my_uart_info = {
    .name          = TYPE_MY_UART,
    .parent        = TYPE_SYS_BUS_DEVICE,
    .instance_size = sizeof(MyUARTState),
    .instance_init = my_uart_instance_init,
    .class_init    = my_uart_class_init,
};

static void my_uart_register_types(void)
{
    type_register_static(&my_uart_info);
}

type_init(my_uart_register_types)
```

---

## Integrating the Device into a Machine

In a machine's init function, instantiate and wire up the device:

```c
static void my_board_init(MachineState *machine)
{
    /* ... create CPU, RAM, etc. ... */

    /* Create and realize the UART */
    DeviceState *uart = qdev_new(TYPE_MY_UART);

    /* Set the chardev property to the first -serial chardev */
    qdev_prop_set_chr(uart, "chardev", serial_hd(0));

    sysbus_realize_and_unref(SYS_BUS_DEVICE(uart), &error_fatal);

    /* Map MMIO at board-specific address */
    sysbus_mmio_map(SYS_BUS_DEVICE(uart), 0, 0x40001000);

    /* Connect IRQ to NVIC input 3 */
    sysbus_connect_irq(SYS_BUS_DEVICE(uart), 0,
                       qdev_get_gpio_in(nvic, 3));
}
```

---

## VMState: Save and Restore

`VMStateDescription` describes how to serialize device state for live snapshots and migration. `VMSTATE_*` macros handle common types:

| Macro | Type |
|-------|------|
| `VMSTATE_UINT8(field, state)` | `uint8_t` |
| `VMSTATE_UINT32(field, state)` | `uint32_t` |
| `VMSTATE_UINT32_ARRAY(field, state, n)` | `uint32_t[n]` |
| `VMSTATE_BOOL(field, state)` | `bool` |
| `VMSTATE_STRUCT(field, state, ver, vmsd, type)` | nested struct |
| `VMSTATE_FIFO8(field, state)` | `Fifo8` |
| `VMSTATE_END_OF_LIST()` | terminator |

QEMU automatically serializes these fields on `savevm` and restores them on `loadvm`. The `version_id` and `minimum_version_id` handle forward/backward compatibility.

---

## Device Properties

Properties allow machine code or command-line options to configure device parameters:

```c
static Property my_uart_properties[] = {
    DEFINE_PROP_CHR("chardev",  MyUARTState, chr),
    DEFINE_PROP_UINT32("baud",  MyUARTState, baud_rate, 115200),
    DEFINE_PROP_BOOL("fifo",    MyUARTState, fifo_enabled, true),
    DEFINE_PROP_END_OF_LIST(),
};
```

Set from machine code:
```c
qdev_prop_set_uint32(uart, "baud", 9600);
```

Set from command line (`-global` option):
```bash
-global my-uart.baud=9600
```

---

## Building the Device into QEMU

Add the device to the QEMU meson build:

In `hw/char/meson.build`:
```python
system_ss.add(when: 'CONFIG_MY_UART', if_true: files('my_uart.c'))
```

In `hw/char/Kconfig`:
```
config MY_UART
    bool
    select SERIAL
```

In the machine's `Kconfig`:
```
select MY_UART
```

The device is then compiled into `qemu-system-arm` (or whichever target selects it) and available as `TYPE_MY_UART`.

---

## Inspecting Devices at Runtime

```bash
# List all realized devices (QOM tree)
(qemu) info qtree

# Show memory region tree
(qemu) info mtree

# Show device by type
(qemu) qom-list /machine/peripheral/my-uart[0]

# Read a property via QMP
{"execute": "qom-get",
 "arguments": {"path": "/machine/peripheral/my-uart[0]",
               "property": "baud"}}
```
