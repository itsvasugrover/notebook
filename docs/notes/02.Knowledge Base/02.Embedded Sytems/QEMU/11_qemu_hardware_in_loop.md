---
title: QEMU Hardware in Loop
createTime: 2026/03/14 14:21:19
permalink: /kb/embedded/qemu/qemu-hardware-in-loop/
---

# QEMU Hardware-in-the-Loop (HIL)

Hardware-in-the-Loop (HIL) with QEMU means using QEMU's external control interfaces to drive and observe a simulated machine programmatically — the same way a HIL framework drives physical hardware through a test controller. The primary mechanism is **QMP (QEMU Machine Protocol)**, supplemented by the Python `qemu.machine` library from QEMU's source tree.

---

## QMP: QEMU Machine Protocol

QMP is a JSON-RPC interface exposed by QEMU over a Unix socket or TCP. It provides machine-level control: start/stop execution, inject events, query state, hot-plug devices, and inject faults — all without touching the serial console.

### Enabling QMP

```bash
qemu-system-arm -M mps2-an385 -kernel firmware.elf -nographic \
    -qmp unix:/tmp/fw-test.sock,server,nowait \
    -serial file:/tmp/uart.log
```

`server,nowait` tells QEMU to open the socket and accept a connection later without blocking startup.

### Protocol Handshake

```json
// Server greeting (QEMU sends immediately on connect)
{"QMP": {"version": {"qemu": {"major": 8, "minor": 2, "micro": 0},
                      "package": ""}, "capabilities": ["oob"]}}

// Client must negotiate first
{"execute": "qmp_capabilities"}
{"return": {}}

// Then issue commands
{"execute": "query-status"}
{"return": {"status": "running", "singlestep": false, "running": true}}
```

### Essential QMP Commands

| Command | Description |
|---------|-------------|
| `qmp_capabilities` | Required handshake |
| `query-status` | Get run state |
| `stop` | Pause VM |
| `cont` | Resume VM |
| `system_reset` | Hardware reset (CPU + devices) |
| `system_powerdown` | ACPI powerdown signal |
| `query-registers` | CPU register dump (architecture-specific) |
| `human-monitor-command` | Run a Monitor command, get text output |
| `device-list-properties` | List properties of a device type |
| `query-block` | List block devices |
| `blockdev-snapshot-sync` | Take block device snapshot |
| `inject-nmi` | Inject a non-maskable interrupt |
| `input-send-event` | Inject keyboard/mouse events |

### Manual QMP Session

```bash
# Connect with socat
socat - UNIX-CONNECT:/tmp/fw-test.sock

# Send capabilities (required first)
{"execute":"qmp_capabilities"}

# Stop and reset
{"execute":"stop"}
{"execute":"system_reset"}
{"execute":"cont"}

# Human-readable register dump via monitor
{"execute":"human-monitor-command","arguments":{"command-line":"info registers"}}
```

---

## Python `qemu.machine` Library

QEMU ships a Python library at `python/qemu/` (QEMU >= 5.1). It wraps QMP with a convenient API and handles launch, socket management, and cleanup.

### Installation

```bash
# From the QEMU source tree
cd /path/to/qemu
pip install -e python/
```

Or install build output:
```bash
pip install qemu  # PyPI package (subset of functionality)
```

### Basic Usage

```python
from qemu.machine import QEMUMachine

with QEMUMachine(binary='/usr/bin/qemu-system-arm') as vm:
    vm.set_machine('mps2-an385')
    vm.add_args('-kernel', 'firmware.elf')
    vm.add_args('-nographic')
    vm.add_args('-serial', 'file:/tmp/uart.log')
    vm.launch()

    # QMP interaction
    status = vm.qmp('query-status')
    print(status)  # {'return': {'status': 'running', ...}}

    # Stop, inspect, resume
    vm.qmp('stop')
    regs = vm.qmp('human-monitor-command',
                  **{'command-line': 'info registers'})
    print(regs['return'])
    vm.qmp('cont')

    # Context manager handles shutdown automatically
```

### Setting Properties Programmatically

```python
vm.set_qmp_monitor(enabled=True)
vm.add_args(
    '-qmp', 'unix:/tmp/test.sock,server,nowait',
    '-serial', 'tcp::5555,server,nowait',
    '-icount', 'shift=0,align=off,sleep=on',   # deterministic timing
)
```

---

## Writing Tests with `QMPTestCase`

`qemu.machine.QMPTestCase` (in the QEMU source at `python/qemu/machine/qtest.py`) is the base class used by QEMU's own test suite. It integrates with Python's `unittest` framework:

```python
import unittest
from qemu.machine import QEMUMachine

class FirmwareBootTest(unittest.TestCase):

    def setUp(self):
        self.vm = QEMUMachine('/usr/bin/qemu-system-arm')
        self.vm.set_machine('mps2-an385')
        self.vm.add_args('-kernel', 'firmware.elf',
                         '-nographic',
                         '-serial', f'file:/tmp/test-uart.log',
                         '-icount', 'shift=0,align=off,sleep=on')
        self.vm.launch()

    def tearDown(self):
        self.vm.shutdown()

    def test_boot_reached_main(self):
        """Verify firmware outputs expected boot message."""
        import time
        time.sleep(0.5)   # let deterministic-time VM run
        self.vm.qmp('stop')

        with open('/tmp/test-uart.log') as f:
            output = f.read()

        self.assertIn('Hello, QEMU!', output)

    def test_reset_restarts(self):
        """Verify firmware outputs same message after reset."""
        import time, os
        time.sleep(0.5)
        self.vm.qmp('stop')
        os.truncate('/tmp/test-uart.log', 0)
        self.vm.qmp('system_reset')
        self.vm.qmp('cont')
        time.sleep(0.5)
        self.vm.qmp('stop')

        with open('/tmp/test-uart.log') as f:
            output = f.read()

        self.assertIn('Hello, QEMU!', output)

if __name__ == '__main__':
    unittest.main()
```

Run tests:
```bash
python -m pytest test_firmware.py -v
```

---

## QTest: QEMU's Internal Testing Protocol

QEMU has a second testing interface called **QTest** (`-qtest stdio` or `-qtest unix:...`). QTest provides raw register read/write access specifically for unit testing device models:

```bash
qemu-system-arm -M mps2-an385 -nographic \
    -qtest stdio -qtest-log /dev/null
```

QTest commands (text protocol via the socket/stdio):

```
readb  <addr>            # read 1 byte at physical address
readw  <addr>            # read 2 bytes
readl  <addr>            # read 4 bytes
readq  <addr>            # read 8 bytes
writeb <addr> <val>
writel <addr> <val>
clock_step <ns>          # advance virtual time by N nanoseconds
clock_set <ns>           # set virtual time to absolute value
irq_intercept_in  <name> # intercept GPIO inputs
irq_intercept_out <name> # intercept GPIO outputs
get_irq <num>            # check GPIO state
```

This protocol is used by QEMU's `tests/qtest/` test suite. Each test directly pokes peripheral registers and observes side effects without needing any guest firmware.

---

## icount: Deterministic Execution for Testing

In QEMU's default mode, the virtual clock advances based on host real time. This means two test runs may see the same timer fire at different points if the host is loaded differently.

`-icount` ties virtual time to instruction counts, making execution **fully deterministic**:

```bash
-icount shift=0,align=off,sleep=on
```

| Option | Effect |
|--------|--------|
| `shift=N` | 1 virtual ns = 2^N TCG instructions |
| `align=off` | Don't align I/O to clock boundaries (faster) |
| `sleep=on` | Allow clock to advance during blocked I/O |

With `-icount`, the same firmware binary will always produce the same output in the same number of instructions, making test assertions on timing reliable.

---

## Fault Injection via QMP

QMP allows injecting hardware faults to test firmware resilience:

```python
# Inject an NMI
vm.qmp('inject-nmi')

# Simulate power failure by stopping mid-execution
vm.qmp('stop')
# read memory, verify partial state
vm.qmp('system_reset')

# Write directly to a peripheral register to simulate an error
vm.qmp('human-monitor-command',
       **{'command-line': 'writel 0x40004018 0x08'})  # set UART error bit
```

---

## CI/CD Integration

### GitHub Actions pattern

```yaml
name: Firmware Tests
on: [push, pull_request]

jobs:
  qemu-tests:
    runs-on: ubuntu-24.04
    steps:
      - uses: actions/checkout@v4

      - name: Install tools
        run: |
          sudo apt-get install -y qemu-system-arm gcc-arm-none-eabi \
              python3-pip
          pip install qemu

      - name: Build firmware
        run: make -C firmware

      - name: Run QEMU tests
        run: python -m pytest tests/ -v --timeout=30
```

### GitLab CI pattern

```yaml
qemu-test:
  image: ubuntu:24.04
  before_script:
    - apt-get update && apt-get install -y qemu-system-arm gcc-arm-none-eabi python3-pip
    - pip install qemu
  script:
    - make
    - python -m pytest tests/ -v
  artifacts:
    paths:
      - /tmp/test-uart.log
    when: always
```

---

## Connecting to Real Hardware via QEMU TCP Bridge

QEMU's `-serial tcp:` option allows bridging a simulated UART to a real serial port via TCP:

```bash
# On QEMU host: expose UART0 as a TCP server
qemu-system-arm -M mps2-an385 -kernel firmware.elf -nographic \
    -serial tcp::5556,server,nowait

# On another machine (or from real hardware via Ethernet): connect
socat /dev/ttyUSB0,b115200,raw TCP:qemu-host:5556
```

This setup allows real hardware (e.g., a test jig MCU) to communicate with the emulated firmware as if via a physical UART cable.

Similarly, QEMU's `-nic socket` backend can bridge virtual Ethernet between QEMU instances or to a host network tap.
