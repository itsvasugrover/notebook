---
title: QEMU Tracing and Logging
createTime: 2026/03/14 14:21:19
permalink: /kb/embedded/qemu/qemu-tracing-logging/
---

# QEMU Tracing and Logging

QEMU has a dedicated trace framework that is separate from the `-d` debug log. The trace framework uses statically defined trace points in QEMU's source code, activated at runtime via patterns. This page covers the trace backends, trace point syntax, `simpletrace` binary format, and how to add custom trace points when developing device models.

---

## Trace Framework Architecture

```
QEMU source file (.c)
  │
  └── trace_<event_name>(args...)    ← generated call
        │
        ↓
  Trace backend (selected at build time)
  ├── simple   → binary trace file (simpletrace format)
  ├── log      → text output via qemu debug log (-d trace:*)
  ├── ust      → LTTng User Space Tracing
  ├── dtrace   → SystemTap / DTrace probes
  └── nop      → disabled (zero overhead; default for release)
```

Each trace event is declared in a `.trace-events` file in the relevant source directory. The build system generates `trace/generated-tracers.h` with `trace_<name>()` functions for each backend.

---

## Build with Trace Support

```bash
# Default build includes simple + log backends
../qemu/configure --target-list=arm-softmmu --enable-trace-backends=simple,log

# LTTng UST backend
../qemu/configure --target-list=arm-softmmu \
    --enable-trace-backends=ust \
    --extra-cflags="-I$(pkg-config --variable=includedir lttng-ust)"
```

Available backends: `simple`, `log`, `ust`, `dtrace`, `ftrace`, `nop`. Multiple backends can be compiled in simultaneously.

---

## Enabling Trace Events at Runtime

### Pattern-based activation

```bash
# Enable all PL011 trace events
qemu-system-arm -M mps2-an385 -kernel firmware.elf -nographic \
    -trace events=pl011_*

# Multiple patterns (separate -trace flags)
qemu-system-arm ... \
    -trace events=pl011_* \
    -trace events=nvic_*

# Enable all events (warning: very verbose)
qemu-system-arm ... -trace events="*"

# Write trace to file (simple backend)
qemu-system-arm ... \
    -trace events=pl011_* \
    -trace file=/tmp/trace.bin
```

Use a file of patterns with one event name or glob per line:

```bash
echo "pl011_read" > /tmp/trace-events
echo "pl011_write" >> /tmp/trace-events
qemu-system-arm ... -trace events=/tmp/trace-events
```

### Dynamic enable/disable via Monitor

```
(qemu) trace-event pl011_* on
(qemu) trace-event pl011_* off
(qemu) info trace-events           # list all events and their state
```

---

## simpletrace Binary Format

When using the `simple` backend, QEMU writes a binary trace file. The format is a sequence of records:

**File header** (first 8 bytes):
```
magic:    0x54524143 ("TRAC") as uint32_t
version:  uint32_t (current = 4)
```

**Trace record** per event hit:
```
event_id:   uint64_t (index into event table)
timestamp:  uint64_t (nanoseconds since QEMU start, from host clock)
length:     uint32_t (total byte length of this record including header)
pid:        uint32_t (host process/thread ID)
arguments:  variable, as declared in .trace-events
```

### Parsing with `simpletrace.py`

QEMU ships `scripts/simpletrace.py` to decode this binary:

```bash
# Basic decode
python3 /path/to/qemu/scripts/simpletrace.py \
    /path/to/qemu/arm-softmmu/trace-events-all \
    /tmp/trace.bin

# Output format:
# <timestamp_ns> <event_name>(<arg1>, <arg2>, ...)
# 1234567890 pl011_read(offset=0x18, val=0x20, size=4)
# 1234568000 pl011_write(offset=0x0, val=0x48, size=4)

# Filter to specific events
python3 scripts/simpletrace.py \
    arm-softmmu/trace-events-all /tmp/trace.bin \
    | grep pl011_write
```

### Custom simpletrace parser

```python
#!/usr/bin/env python3
# analyze_uart.py — summarize UART TX traffic from trace
import sys
sys.path.insert(0, '/path/to/qemu/scripts')
import simpletrace

class Analyzer(simpletrace.Analyzer):
    def pl011_write(self, offset, value, size):
        if offset == 0:   # UARTDR
            ch = value & 0xFF
            if 0x20 <= ch < 0x7F:
                print(f'TX: {chr(ch)!r}')

simpletrace.run(Analyzer())
```

```bash
python3 analyze_uart.py arm-softmmu/trace-events-all /tmp/trace.bin
```

---

## Trace Event Definition Syntax

Trace events are defined in `.trace-events` files in QEMU's source directories. Each line defines one event:

```
# hw/char/trace-events
pl011_read(uint64_t offset, uint64_t value, unsigned size) "offset 0x%"PRIx64" value 0x%"PRIx64" size %u"
pl011_write(uint64_t offset, uint64_t value, unsigned size) "offset 0x%"PRIx64" value 0x%"PRIx64" size %u"
pl011_irq_state(int level) "level %d"
```

Format: `<event_name>(<typed_params>) "<format_string>"`

**Special prefixes:**

| Prefix | Meaning |
|--------|---------|
| `disable <name>(...)` | Event exists but is disabled by default |
| `# comment` | Comment line |

The format string is used by the `log` backend (formatted to stderr) and by `simpletrace.py` for display. The binary `simple` backend records raw argument bytes without the format string.

---

## Adding a Custom Trace Point

To add trace events to your custom device model:

### 1. Create `trace-events` file

```
# hw/char/my_uart-trace-events
my_uart_read(uint64_t offset, uint64_t value) "offset=0x%"PRIx64" value=0x%"PRIx64
my_uart_write(uint64_t offset, uint64_t value) "offset=0x%"PRIx64" value=0x%"PRIx64
my_uart_rx(uint8_t ch) "char=0x%02x"
```

### 2. Register in the meson build

In `hw/char/meson.build`:
```python
system_ss.add(when: 'CONFIG_MY_UART',
              if_true: [files('my_uart.c'),
                        trace_events('my_uart-trace-events')])
```

### 3. Include and call in the device source

```c
#include "trace.h"   /* generated by the build system */

static uint64_t my_uart_read(void *opaque, hwaddr offset, unsigned size)
{
    uint64_t val = /* ... compute value ... */ 0;
    trace_my_uart_read(offset, val);    /* ← zero cost when disabled */
    return val;
}

static void my_uart_write(void *opaque, hwaddr offset,
                           uint64_t value, unsigned size)
{
    trace_my_uart_write(offset, value);
    /* ... handle write ... */
}
```

When the `nop` backend is selected, `trace_my_uart_read()` compiles to an empty inline function — zero overhead in release builds.

---

## LTTng UST Backend

The `ust` (User Space Tracing) backend emits events as LTTng trace points, which are consumable by `lttng` tooling and viewable with Trace Compass:

```bash
# Start LTTng session
lttng create qemu-session
lttng enable-event --userspace "qemu:pl011_*"
lttng start

# Run QEMU (compiled with --enable-trace-backends=ust)
qemu-system-arm -M mps2-an385 -kernel firmware.elf -nographic

# Stop and view
lttng stop
lttng view
# or
babeltrace2 ~/lttng-traces/qemu-session*/
```

LTTng provides microsecond-resolution timestamps using the perf_event clock, and its ring-buffer approach has lower overhead than the `simple` file backend for high-frequency events.

---

## SystemTap / DTrace Backend

On Linux with SystemTap, the `dtrace` backend generates `.stp` probe points:

```bash
../qemu/configure --enable-trace-backends=dtrace ...
```

QEMU generates `trace/generated-tracers.d` with DTrace probe definitions. SystemTap can intercept these probes on a running QEMU process:

```stp
#!/usr/bin/stap
probe process("qemu-system-arm").mark("pl011_write") {
    printf("UART write: offset=%d value=%d\n", $arg1, $arg2)
}
```

```bash
stap my_uart_probe.stp -c 'qemu-system-arm -M mps2-an385 -kernel fw.elf -nographic'
```

---

## Log Backend (`-d trace:*`)

The `log` backend integrates trace events with QEMU's `-d` system. No binary file is required:

```bash
qemu-system-arm -M mps2-an385 -kernel firmware.elf -nographic \
    -d trace:pl011_* -D /tmp/qemu.log
```

Output in `/tmp/qemu.log`:
```
2234567890 pl011_write offset 0x0 value 0x48 size 4
2234568010 pl011_write offset 0x0 value 0x65 size 4
2234568020 pl011_write offset 0x0 value 0x6c size 4
```

This is the simplest way to get readable trace output without binary parsing.

---

## Key Trace Event Namespaces

QEMU's trace events are organized by source directory:

| Pattern | Source | What it covers |
|---------|--------|----------------|
| `pl011_*` | `hw/char/pl011.c` | UART register reads/writes, IRQ state |
| `nvic_*` | `hw/intc/armv7m_nvic.c` | NVIC interrupt state changes |
| `arm_cpu_*` | `target/arm/cpu.c` | CPU exception entry/exit |
| `virtio_*` | `hw/virtio/` | VirtIO queue operations |
| `kvm_*` | `accel/kvm/` | KVM VM exit events |
| `qcow2_*` | `block/qcow2*.c` | qcow2 cluster allocation |
| `dma_*` | `hw/dma/` | DMA channel operations |
| `i2c_*` | `hw/i2c/` | I2C bus transfers |
| `spi_*` | `hw/ssi/` | SPI bus transfers |

List all available trace events on your build:

```bash
cat arm-softmmu/trace-events-all | grep "^[a-z]" | cut -d'(' -f1 | sort
```
- **System Understanding**: Gain insights into the interactions between software and hardware.
