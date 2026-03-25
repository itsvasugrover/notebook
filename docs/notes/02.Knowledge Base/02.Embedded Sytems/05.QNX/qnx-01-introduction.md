---
title: QNX Introduction & History
createTime: 2026/03/25 00:00:00
permalink: /kb/embedded/qnx/introduction/
---

# QNX Introduction & History

## What Is QNX?

**QNX** (pronounced "cue-nix") is a commercial **POSIX-compliant, real-time operating system (RTOS)** built on a **microkernel architecture**. Unlike monolithic kernels (Linux, Windows) where most OS services run in kernel space, the QNX Neutrino microkernel provides only the essential primitives — threads, IPC, interrupt handling, and scheduling — while all other services (filesystems, device drivers, networking, protocol stacks) run as independent processes in user space.

This design gives QNX three defining properties:

1. **Fault isolation**: A crashed driver or file system server does not bring down the kernel or other processes; it can be restarted transparently.
2. **Deterministic real-time behavior**: The microkernel is fully preemptible and has small, bounded interrupt latency.
3. **Modular deployability**: Add or remove OS services at runtime; boot a tiny embedded image or a full development workstation from the same source base.

QNX is developed by **BlackBerry Limited** (acquired from QNX Software Systems in 2010). The commercial product line is called **QNX Software Development Platform (SDP)**; the most current release at the time of writing is **QNX SDP 8.0** (released 2023), targeting 64-bit ARM and x86_64 platforms.

---

## Historical Timeline

| Year | Milestone |
|------|-----------|
| 1980 | Gordon Bell and Dan Dodge found Quantum Software Systems in Waterloo, Ontario |
| 1982 | First version of QUNIX shipped on Intel 8088 for the IBM PC |
| 1984 | Company and OS renamed to QNX; QNX 2 ships |
| 1991 | QNX 4.x released — widely adopted in industrial automation |
| 1995 | QNX RTP (Realtime Platform) demo on a 1.44 MB floppy — full POSIX OS, networking, and GUI in 1.44 MB |
| 1998 | QNX Neutrino RTOS (QNX 6.0) — complete rewrite on fully symmetric microkernel |
| 2001 | QNX 6.1 — SMP support, Photon microGUI, full POSIX |
| 2004 | QNX RTOS 6.3 — embedded automotive use surges (infotainment, ADAS) |
| 2007 | Used in Cisco routers, medical devices, nuclear power plant control |
| 2010 | **BlackBerry (Research In Motion) acquires QNX Software Systems** for ~$200 M |
| 2011 | QNX powers BlackBerry PlayBook tablet OS (based on QNX Neutrino) |
| 2012 | QNX CAR Platform 2.0 — dedicated automotive middleware stack |
| 2014 | QNX SDP 6.6 — improved toolchain, 64-bit ARM Technology Preview |
| 2016 | QNX OS for Safety 1.0 — IEC 61508/ISO 26262 pre-certification |
| 2017 | QNX SDP 7.0 — full 64-bit ARM and x86_64 support, GCC 5.4 toolchain |
| 2020 | QNX SDP 7.1 — Adaptive AUTOSAR support, improved hypervisor integration |
| 2021 | QNX Hypervisor 2.2 — ARM TrustZone integration |
| 2022 | QNX OS for Safety 2.2.3 certified to ISO 26262 ASIL D |
| 2023 | **QNX SDP 8.0** — Clang/LLVM toolchain, C++20, Python 3 integration, ARC and RISC-V tech preview |
| 2025 | QNX SDP 8.0 updates — Enhanced security features, expanded hardware support |

---

## QNX Product Family

```
BlackBerry QNX Products
├── QNX Neutrino RTOS (SDP 8.0)            ← Core RTOS kernel + POSIX libraries
│   ├── Microkernel (procnto-smp-instr)
│   ├── C/C++ runtime (libc.so, libm.so)
│   ├── POSIX threads, signals, timers
│   └── Board Support Packages (BSPs)
│
├── QNX OS for Safety                       ← ISO 26262 ASIL D certified variant
│   ├── Safety-certified kernel
│   ├── Safety-certified C library
│   └── Pre-certified documentation artifacts
│
├── QNX Hypervisor                          ← Type-1 bare-metal hypervisor
│   ├── Adaptive AUTOSAR VM support
│   ├── Virtual machine manager
│   └── Virtio device model
│
├── QNX Platform for ADAS                  ← ADAS middleware stack
│   ├── Sensor fusion framework
│   ├── OpenCL/Vulkan compute
│   └── Camera/display pipelines
│
└── QNX CAR Platform                        ← Infotainment middleware
    ├── HMI framework
    ├── Android Auto / Apple CarPlay
    └── Media stack (audio/video)
```

---

## Where Is QNX Used?

QNX is deployed in safety-critical and high-reliability domains where a system crash is not acceptable:

### Automotive
- **Instrument clusters** (digital dashboards) — guaranteed frame rendering latency
- **ADAS / autonomous driving compute units** — sensor fusion, camera pipelines
- **Telematics Control Units (TCU)** — always-on connectivity
- **Over-the-Air update managers** — secure software management
- Major OEM adopters: BMW, Ford, GM, Hyundai, Toyota, Volkswagen Group, and hundreds more through Tier-1 suppliers (Harman, Bosch, Continental)

### Medical
- Infusion pumps, surgical robots, patient monitoring systems requiring IEC 62304 and FDA clearance

### Industrial
- Industrial control systems (ICS), PLCs, SCADA HMI terminals — IEC 61508 SIL 3 requirements

### Defense & Aerospace
- Avionics displays, mission computers — DO-178C considerations

### Networking / Telecom
- Cisco IOS historically used QNX; carrier-grade platform controllers

---

## QNX vs Linux vs Other RTOS

| Feature | QNX Neutrino | Linux (PREEMPT_RT) | FreeRTOS | VxWorks |
|---------|-------------|-------------------|----------|---------|
| Kernel type | Microkernel | Monolithic | Minimal kernel | Monolithic |
| POSIX compliance | Full POSIX.1 | Full POSIX.1 | Partial (via POSIX layer) | Full POSIX.1 |
| Fault isolation | Full (drivers in user space) | Limited (kernel modules crash kernel) | None (flat model) | Moderate (optional protection model) |
| Real-time guarantees | Hard RT (deterministic) | Soft RT (PREEMPT_RT) | Hard RT (limited services) | Hard RT |
| SMP support | Yes (procnto-smp) | Yes | No (standard) | Yes |
| Hypervisor | Type-1 (QNX Hypervisor) | KVM (Type-2) | No | Limited |
| Safety certifications | ISO 26262 ASIL D, IEC 61508 SIL 3 | None native | IEC 61508 (SafeRTOS) | DO-178C, IEC 61508 |
| Source availability | Commercial (closed source, BSP source) | Open source (GPL) | Open source (MIT) | Commercial (closed) |
| Footprint | ~300 KB kernel; scalable | ~4+ MB kernel | 6–10 KB kernel | ~500 KB+ |
| License | Commercial | GPL v2 | MIT | Commercial |

---

## QNX Neutrino Editions

### Standard SDP 8.0
Full development platform for production use. Includes:
- Neutrino RTOS kernel (`procnto-smp-instr`)
- C/C++ runtime library (Clang/LLVM based since SDP 8.0)
- POSIX threads, sockets, timers
- io-pkt networking stack
- QNX filesystem drivers
- Target agent (`qconn`) for IDE connectivity
- Full Board Support Packages (BSPs)

### QNX OS for Safety
A **certification-targeted** subset of the QNX Neutrino RTOS. Provides:
- Pre-certified kernel, C library, and select middleware
- Safety manual, FMEA, and other IEC 61508 / ISO 26262 artifacts
- Qualified to **ISO 26262 ASIL D** and **IEC 61508 SIL 3**
- Separate thread scheduler (SafeKernel) with Freedom From Interference

### QNX SDP 8.0 Key Changes (vs SDP 7.1)
- **Toolchain**: Switched from GCC to Clang/LLVM 14 as primary compiler
- **C++ standard**: C++20 support (GCC-based SDP 7.1 was C++17)
- **Python 3**: Full Python 3 runtime bundled for scripting and build tools
- **Security**: Capability-based process restrictions hardened
- **SMP scalability**: Improved scheduler performance on 8+ core platforms
- **RISC-V**: Technology preview for RISC-V 64-bit targets

---

## QNX Licensing

QNX is a **commercial product**. Licensing options:

| License Type | Description |
|-------------|-------------|
| Development License | Per-seat license for engineers; includes IDE, compiler, BSP sources |
| Runtime Royalty | Per-unit fee for production deployment with QNX runtime |
| Volume OEM | Negotiated per-project terms for high-volume automotive programs |
| Evaluation | Time-limited free evaluation via myQNX portal |

Source code for the **kernel itself** is not publicly available. However:
- BSP (Board Support Package) sources are provided to licensees
- Driver source is available under NDA for most supported hardware
- Community-sourced ports exist (e.g., QEMU BSP for development/testing)

---

## Summary

QNX Neutrino is the premier commercial RTOS for safety-critical embedded systems. Its microkernel design provides true fault isolation, hard real-time determinism, POSIX compliance, and a scalable architecture that runs identically from a single-core microcontroller derivative up to a multi-core ADAS SoC. The product is backed by BlackBerry's automotive safety certifications (ASIL D) and a decades-long track record in production vehicles, medical devices, and industrial systems.
