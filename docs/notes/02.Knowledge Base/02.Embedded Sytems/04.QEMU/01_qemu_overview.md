---
title: QEMU Overview
createTime: 2026/03/14 14:21:19
permalink: /kb/embedded/qemu/qemu-overview/
---

# QEMU Overview

## What is QEMU?

QEMU (Quick Emulator) is an open-source machine emulator and virtualizer written in C, originally created by Fabrice Bellard in 2003. It serves two fundamentally different roles that are often confused:

- **Emulator**: QEMU translates every instruction of a guest architecture into equivalent operations on the host. A guest ARM binary runs on an x86 host because QEMU reads each ARM instruction and performs the equivalent computation. This is called *dynamic binary translation*.
- **Virtualizer**: When the guest and host share the same ISA (e.g., both x86), QEMU can delegate execution directly to hardware virtualization extensions (Intel VT-x, AMD-V), using the host CPU to run guest code natively. This is where KVM comes in.

## Execution Modes

### Full-System Emulation (`qemu-system-*`)

Emulates an entire machine: CPU(s), memory controller, interrupt controller, timers, and peripheral devices. The guest OS runs completely unmodified — it sees a virtual machine that looks like real hardware.

```
┌─────────────────────────────────────────────┐
│           Guest Software                    │
│   Linux kernel / RTOS / Bare-metal app      │
├─────────────────────────────────────────────┤
│           QEMU Full-System                  │
│  ┌─────────┐ ┌──────────┐ ┌─────────────┐  │
│  │ CPU emu │ │ Memory   │ │ Peripheral  │  │
│  │ (TCG or │ │ subsystem│ │ device      │  │
│  │  KVM)   │ │          │ │ models      │  │
│  └─────────┘ └──────────┘ └─────────────┘  │
├─────────────────────────────────────────────┤
│           Host OS + Hardware                │
└─────────────────────────────────────────────┘
```

Binaries: `qemu-system-arm`, `qemu-system-aarch64`, `qemu-system-riscv64`, etc.

### User-Mode Emulation (`qemu-<arch>`)

Emulates only the CPU. The guest binary's system calls are translated and forwarded to the host OS kernel. No peripheral emulation. Useful for:
- Running cross-compiled binaries on your development machine
- Testing libraries without a full OS
- Rootfs validation during Yocto/Buildroot development

```bash
# Run an ARM aarch64 binary on an x86 host:
qemu-aarch64 -L /usr/aarch64-linux-gnu ./my-arm-binary
```

Binaries: `qemu-arm`, `qemu-aarch64`, `qemu-riscv64`, etc.

## Acceleration Backends

| Backend | When Available | How it Works |
|---------|---------------|-------------|
| **TCG** | Always | Pure software dynamic binary translation |
| **KVM** | Linux host, same ISA | Hardware virtualization via `/dev/kvm` |
| **HVF** | macOS host | Apple Hypervisor.framework (ARM/x86) |
| **WHPX** | Windows host | Windows Hypervisor Platform |
| **Xen** | Xen hypervisor host | Xen paravirt interface |
| **NVMM** | NetBSD host | NetBSD Virtual Machine Monitor |

For embedded development, TCG is almost always used because:
- You're typically cross-architecture (host x86, target ARM/RISC-V)
- KVM requires the same ISA on host and guest

Select the accelerator explicitly:
```bash
qemu-system-aarch64 -accel tcg       # Software-only
qemu-system-x86_64  -accel kvm       # Hardware-assisted (Linux)
qemu-system-aarch64 -accel hvf       # Apple silicon host
```

## Relationship to Other Tools

```
  libvirt  ───────────────────────────────────┐
  (management                                 │
   daemon)    QEMU process                    │
         │    ├── TCG / KVM acceleration      │
         └──► ├── VirtIO device model         ├── VMs
              ├── SPICE/VNC display server    │
              └── QMP JSON control socket ────┘

  Buildroot/Yocto ──► rootfs.ext4 ──► QEMU disk image
  Cross-toolchain  ──► vmlinux     ──► QEMU -kernel
  GDB (remote RSP) ◄──────────────────── QEMU -s -S
```

## Release Cycle and Versioning

QEMU follows a time-based release cycle with approximately four releases per year, using `MAJOR.MINOR.PATCH` versioning (e.g., `9.2.0`). Stable branches receive backported security fixes.

```bash
# Check version:
qemu-system-arm --version
# QEMU emulator version 9.2.0

# Source repository:
git clone https://gitlab.com/qemu-project/qemu.git
```

## QEMU in the Embedded Development Workflow

```
Phase 1 — No hardware yet:
  Write code → Cross-compile → Boot in QEMU → Debug with GDB

Phase 2 — Hardware available in limited quantity:
  CI/CD pipeline runs tests in QEMU for every commit
  Hardware reserved for final integration testing

Phase 3 — Production:
  QEMU remains for regression testing, new developer onboarding,
  and reproducing field bugs deterministically
```

Key advantages over physical hardware:
- **Determinism**: `icount` mode makes execution cycle-accurate and reproducible
- **Introspection**: You can inspect any register, memory location, bus transaction at any moment
- **Fault injection**: Simulate hardware failures (memory errors, bus faults) that are impossible to trigger reliably on real hardware
- **Speed**: No flash-erase-program cycles; just restart the process
- **Snapshots**: Save the exact system state at any point and restore it instantly
- **Automation**: QEMU is a process — scriptable via QMP JSON API
