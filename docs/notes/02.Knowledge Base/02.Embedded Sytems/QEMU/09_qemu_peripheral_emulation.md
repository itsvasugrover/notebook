---
title: QEMU Peripheral Emulation
createTime: 2026/03/14 14:21:19
permalink: /kb/embedded/qemu/qemu-peripheral-emulation/
---

# QEMU Peripheral Emulation

This page explains how QEMU's memory-mapped I/O (MMIO) subsystem works, how the `MemoryRegionOps` callbacks bridge guest MMIO accesses to emulated peripheral logic, and how peripheral I/O reaches the guest through interrupt delivery.

---

## How MMIO Works in QEMU

When a guest CPU writes to `0x40004000` (for example, UART0 on `mps2-an385`), the following chain executes:

1. **TCG translation**: The store instruction is translated into a TCG intermediate op that calls `helper_stl_mmu`.
2. **TLB lookup**: The softmmu TLB is checked for a mapping. MMIO addresses are never cached in the TLB (they are always `MMIO_NOTDIRTY`).
3. **TLB miss handling**: `tlb_fill()` is called, which walks the flattened `FlatView` of the current address space.
4. **MemoryRegion match**: The `FlatView` contains `FlatRange` entries mapping physical address ranges to `MemoryRegion` objects. QEMU finds the `MemoryRegion` whose range contains `0x40004000`.
5. **MemoryRegionOps dispatch**: QEMU calls `mr->ops->write(opaque, offset, value, size)` where `offset = 0x40004000 - mr->addr`.
6. **Peripheral logic executes**: The write callback runs inline in the TCG thread context (or the device model's context under multi-threading).

For reads, the same path applies with `mr->ops->read()`.

---

## MemoryRegion API

`MemoryRegion` is the core abstraction for all address-space mappings in QEMU. Every device, RAM block, ROM, and alias is a `MemoryRegion`.

### Types

| Init function | Type | Description |
|--------------|------|-------------|
| `memory_region_init_ram()` | RAM | Read-write, backed by `RAMBlock` |
| `memory_region_init_rom()` | ROM | Read-only alias of RAM |
| `memory_region_init_rom_device()` | ROM with writes | ROM with write callback |
| `memory_region_init_io()` | MMIO | Calls `ops->read`/`ops->write` on each access |
| `memory_region_init_alias()` | Alias | Re-map a sub-range of another region |
| `memory_region_init()` | Container | Logical container; no storage, contains children |

### `memory_region_init_io`

```c
void memory_region_init_io(MemoryRegion *mr,
                            Object       *owner,
                            const MemoryRegionOps *ops,
                            void         *opaque,
                            const char   *name,
                            uint64_t      size);
```

- `mr`: An uninitialized `MemoryRegion` (usually embedded in the device state struct)
- `owner`: The `Object *` that owns this region (used for reference counting)
- `ops`: Pointer to the read/write callback table
-    `opaque`: Passed as first argument to every callback (typically `void *` cast from the device state)
- `name`: Debug name visible in `info mtree`
- `size`: Size in bytes of the MMIO aperture

### `MemoryRegionOps` Structure

```c
struct MemoryRegionOps {
    /* Read from the hardware.
       @addr: offset within the MemoryRegion
       @size: access size in bytes (1, 2, or 4)
       Returns: value read */
    uint64_t (*read)(void *opaque, hwaddr addr, unsigned size);

    /* Write to the hardware.
       @addr: offset within the MemoryRegion
       @value: value to write
       @size: access size in bytes */
    void (*write)(void *opaque, hwaddr addr, uint64_t value, unsigned size);

    /* Optional: called when read returns; can modify returned value */
    uint64_t (*read_with_attrs)(void *opaque, hwaddr addr, unsigned size,
                                 MemTxAttrs attrs);
    MemTxResult (*write_with_attrs)(void *opaque, hwaddr addr, uint64_t value,
                                    unsigned size, MemTxAttrs attrs);

    /* Valid access widths */
    struct {
        unsigned min_access_size;
        unsigned max_access_size;
        bool unaligned;
    } valid;

    /* Preferred implementation widths (QEMU will split/merge accesses) */
    struct {
        unsigned min_access_size;
        unsigned max_access_size;
    } impl;

    enum device_endian endianness;  /* DEVICE_LITTLE_ENDIAN or _BIG_ENDIAN */
};
```

### Placement with `sysbus_mmio_map`

Every device on the system bus exposes `SysBusMmio` entries (one per MMIO region):

```c
// Inside device realize()
sysbus_init_mmio(sbd, &s->mmio);

// Machine code that instantiates the device:
sysbus_mmio_map(SYS_BUS_DEVICE(dev), 0, 0x40004000);
```

`sysbus_mmio_map` registers the `MemoryRegion` in the system address space at the given physical address.

---

## PL011 UART: A Walk-Through

The PL011 is ARM's standard UART core. It is used in `mps2-an385`, `virt`, and `versatilepb`. Its QEMU source is in `hw/char/pl011.c`. Here is how it works:

### State Struct

```c
typedef struct PL011State {
    SysBusDevice parent_obj;     /* must be first — QOM inheritance */

    MemoryRegion iomem;          /* MMIO region: 0x1000 bytes */
    uint32_t readbuff;           /* receive buffer */
    uint32_t flags;              /* UARTFR (flag register) */
    uint32_t lcr;                /* UARTLCR_H */
    uint32_t rsr;                /* UARTRSR/ECR */
    uint32_t cr;                 /* UARTCR */
    uint32_t dmacr;              /* UARTDMACR */
    uint32_t int_enabled;        /* UARTIMSC (interrupt mask) */
    uint32_t int_level;          /* pending interrupt bits */
    uint32_t read_fifo[16];      /* receive FIFO */
    uint32_t ilpr;               /* UARTILPR */
    uint32_t ibrd;               /* UARTIBRD */
    uint32_t fbrd;               /* UARTFBRD */
    uint32_t  ifl;               /* UARTIFLS */
    int read_pos, read_count, read_trigger;
    CharBackend chr;             /* host I/O backend (stdio, socket, ...) */
    qemu_irq irq[6];             /* UART interrupt lines */
    const unsigned char *id;     /* PrimeCell identification bytes */
} PL011State;
```

### Read Handler (excerpt)

```c
static uint64_t pl011_read(void *opaque, hwaddr offset, unsigned size)
{
    PL011State *s = (PL011State *)opaque;
    uint32_t c;

    switch (offset >> 2) {            /* offset >> 2 = register index */
    case 0: /* UARTDR */
        s->flags &= ~PL011_FLAG_RXFF;
        c = s->read_fifo[s->read_pos];
        if (s->read_count > 0) {
            s->read_count--;
            s->read_pos = (s->read_pos + 1) & 15;
        }
        if (s->read_count == 0)
            s->flags |= PL011_FLAG_RXFE;
        if (s->read_count == s->read_trigger - 1)
            s->int_level &= ~PL011_INT_RX;
        pl011_update(s);              /* recompute interrupt level */
        qemu_chr_fe_accept_input(&s->chr);  /* unblock host chardev */
        return c;
    case 6: /* UARTFR */
        return s->flags;
    case 12: /* UARTIBRD */
        return s->ibrd;
    /* ... */
    }
}
```

### Write Handler — TX path

```c
static void pl011_write(void *opaque, hwaddr offset,
                        uint64_t value, unsigned size)
{
    PL011State *s = (PL011State *)opaque;

    switch (offset >> 2) {
    case 0: /* UARTDR */
        /* Guest wrote a byte to transmit */
        s->int_level |= PL011_INT_TX;
        pl011_update(s);
        /* Forward byte to the host chardev backend (stdio, socket, ...) */
        {
            unsigned char ch = value & 0xFF;
            qemu_chr_fe_write_all(&s->chr, &ch, 1);
        }
        break;
    case 12: /* UARTCR */
        s->cr = value;
        pl011_loopback_mdmctrl(s);
        break;
    /* ... */
    }
}
```

Guest writes `'H'` to `UARTDR` (`0x40004000`) → QEMU calls `pl011_write(s, 0, 'H', 4)` → `qemu_chr_fe_write_all` → host writes `H` to stdio.

---

## Interrupt Delivery

Peripherals signal events to the CPU via interrupt lines (`qemu_irq`).

```c
/* irq is a qemu_irq handle; level=1 asserts, level=0 deasserts */
qemu_set_irq(irq, level);
```

`qemu_irq` is a function pointer wrapper — it calls a handler previously registered by the interrupt controller. For Cortex-M, `armv7m_nvic_set_pending()` is the handler. For ARM GIC (used in `virt`), `gic_set_irq()` is called.

The routing from device IRQ output to NVIC/GIC input is configured in the machine init function:

```c
/* mps2-an385 machine init (simplified) */
DeviceState *uart = qdev_new(TYPE_PL011);
sysbus_realize_and_unref(SYS_BUS_DEVICE(uart), &error_fatal);
sysbus_mmio_map(SYS_BUS_DEVICE(uart), 0, 0x40004000);

/* Connect UART IRQ output 0 to NVIC input 5 */
sysbus_connect_irq(SYS_BUS_DEVICE(uart), 0,
                   qdev_get_gpio_in(nvic_dev, 5));
```

When the PL011 calls `qemu_set_irq(s->irq[0], 1)`, it invokes the NVIC's GPIO-in handler, which sets bit 5 in `NVIC_ISPR0` and potentially escalates to the CPU via the `cpu_interrupt(cpu, CPU_INTERRUPT_HARD)` path.

---

## CharDev Backends

The `CharBackend` in PL011State provides host-side I/O. Configuring it:

```bash
# stdio
-serial stdio

# TCP server (connect with: telnet localhost 5555)
-serial tcp::5555,server,nowait

# PTY (creates /dev/pts/N)
-serial pty

# File
-serial file:/tmp/uart.log

# Null (discard)
-serial null
```

The modern approach uses `-chardev` to create a named backend:

```bash
-chardev socket,id=uart0,host=localhost,port=5555,server=on,wait=off \
-serial chardev:uart0
```

Inside QEMU, a `CharBackend` has a `chr_read` callback (called when the host chardev receives data, feeding it into the FIFO) and uses `qemu_chr_fe_write_all` for TX.

---

## I2C and SPI Buses

Devices on I2C or SPI buses use bus-specific APIs instead of direct MMIO mapping:

### I2C

```c
/* Create an I2C bus */
I2CBus *bus = i2c_init_bus(dev, "i2c");

/* Create a slave device and attach it */
DeviceState *sensor = i2c_slave_new("my-sensor", 0x48);
i2c_slave_set_address(I2C_SLAVE(sensor), 0x48);
i2c_bus_attach(bus, I2C_SLAVE(sensor));
```

I2C slave devices implement the `I2CSlave` interface: `event()` (START/STOP/NACK), `recv()`, `send()`.

### SPI

```c
SSIBus *spi = ssi_create_bus(dev, "spi");
DeviceState *flash = ssi_create_slave(spi, "m25p80");
```

SPI slaves implement `SSIPeripheral`: `transfer()` (full-duplex byte exchange).

---

## GPIO

```c
/* Device creates output GPIO lines */
qdev_init_gpio_out(dev, s->out_gpio, 4);   /* 4 output lines */

/* Connect output of device A to input of device B */
qdev_connect_gpio_out(dev_a, 0, qdev_get_gpio_in(dev_b, 0));

/* Assert/deassert a GPIO output line */
qemu_set_irq(s->out_gpio[0], 1);
```

GPIO is the generic mechanism for any signal between devices — interrupts, chip-selects, resets, and actual GPIO pins all use `qemu_irq` under the hood.
