---
title: AUTOSAR Adaptive Platform — Introduction & Motivation
createTime: 2026/03/25 00:00:00
permalink: /kb/embedded/autosar/adaptive-introduction/
---

# AUTOSAR Adaptive Platform — Introduction & Motivation

## Why a New Platform Was Needed

AUTOSAR Classic was designed in the early 2000s for resource-constrained microcontrollers performing deterministic control functions. By the mid-2010s, the automotive industry began deploying a new class of ECU — high-performance compute platforms running ADAS, autonomous driving, vehicle connectivity, and over-the-air update systems — for which Classic was architecturally unsuited.

### The Classic Platform Limitations

```
Classic Platform constraint: Everything is static and known at build time.

  Limitation 1: Static task configuration
  All tasks, their periods, priorities, and CPU assignments are fixed in ARXML.
  Cannot add a new algorithm at runtime without a complete rebuild + reflash.
  
  Problem: A Level 3 ADAS ECU must dynamically activate/deactivate perception
  algorithms based on operational design domain (ODD — highway vs. parking)
  and available sensor firmware versions.

  Limitation 2: Signal-oriented communication model
  Classic COM module exchanges named signals with compile-time-known producer/consumer.
  Adding a new consumer ECU requires updating the ARXML of all ECUs involved.
  
  Problem: A zonal connectivity gateway must route data to new apps added via OTA.
  The "new app" was not known at build time of the gateway ECU.

  Limitation 3: C language, static memory, no OS abstraction
  Classic SW is tightly coupled to OSEK OS, static memory, and generated RTE.
  Modern algorithms (deep neural networks for perception, path planning) are
  written in C++ with STL, use heap-allocated data structures, and are developed
  in Linux-based environments.
  
  Problem: Porting a DNN inference framework to Classic would require rewriting 
  in C with static memory, losing modern SW engineering tools (sanitizers, 
  valgrind, gTest, Python integration).

  Limitation 4: No service discovery
  Classic communication assumes all ECUs and their signal sets are known at
  integration time. There is no concept of "find who offers this service at runtime."
  
  Problem: A plug-in sensor module (e.g., optional trailer detection sensor) must
  be discoverable at runtime by the central gateway, not pre-wired in ARXML.
```

### The New Compute Platform Requirements

```
High-Performance Automotive SoC (e.g., NVIDIA Orin, Qualcomm SA8295, NXP S32G):
  ├── CPU: 8–12 ARM Cortex-A cores at 2+ GHz (application procesors)
  ├── GPU/NPU: 100+ TOPS AI inference compute
  ├── RAM: 4–32 GB LPDDR5
  ├── OS: Linux or QNX (POSIX-compliant)
  ├── Networking: Multi-Gbit Ethernet, PCIe, USB
  └── Use cases: Camera fusion, LiDAR processing, path planning, OTA management

  AUTOSAR Classic cannot run on this hardware — OSEK OS assumes kilobytes of RAM,
  not gigabytes; single-threaded or small-core scheduling, not 12-core SMP Linux.
```

---

## What AUTOSAR Adaptive Platform Is

AUTOSAR Adaptive Platform (AP) is a software platform for **high-performance, service-oriented, dynamically updatable automotive applications** running on POSIX-based operating systems.

```
Key characteristics:

  1. C++14/17 as the primary language
     Modern C++: classes, templates, RAII, smart pointers, std::thread
     Supports: DNN frameworks, Eigen, OpenCV integration patterns
     
  2. POSIX OS (Linux, QNX, PikeOS)  
     Applications run as POSIX processes with virtual memory
     OS provides: file system, network sockets, shared memory, semaphores
     
  3. Service-Oriented Architecture (SOA)
     Communication via services: publish/subscribe and method call
     Services are discovered at runtime (not pre-wired in ARXML)
     
  4. Dynamic: run new applications without full reflash
     UCM (Update and Configuration Management) can install new Adaptive Applications
     while the vehicle is parked (controlled update process)
     
  5. ara:: namespace — the unified C++ API
     All Adaptive Platform services accessed via ara:: APIs:
     ara::com, ara::exec, ara::diag, ara::log, ara::crypto, ara::nm, ara::phm
```

---

## AUTOSAR Adaptive Scope and Target Use Cases

| Use Case | Adaptive Platform Role |
|----------|----------------------|
| ADAS / AD perception | ARA platform runs camera/LiDAR fusion algorithms as Adaptive Applications |
| Path planning | Dynamic algorithm selection based on ODD; can be updated over the air |
| V2X Communication | ETSI ITS-G5 / C-V2X stack runs as Adaptive service |
| Infotainment / HMI | High-level UI framework and media stack as Adaptive Applications |
| OTA / UCM | Update and Configuration Manager orchestrates firmware updates across vehicle |
| Connectivity gateway | Central gateway with runtime-discovered device endpoints |
| Vehicle API / digital cockpit | RESTful or SOME/IP service interface to in-car functions |
| High-Performance Data Recording | Camera/sensor data recorded via Adaptive service |

---

## Adaptive Platform vs. Classic Platform: The Fundamental Difference

```
Classic Platform mental model:
  "A closed box. Everything inside is known at compile time. 
   The network, the tasks, the signals, the calibrations — all frozen in ARXML."

  Build once → flash once → run forever (until next full software release)

Adaptive Platform mental model:
  "A service marketplace. Applications are processes. 
   Services are discovered and connected at runtime.
   New applications can be installed while others run."

  Build application → package as ucm container → install via OTA → 
  Execution Management starts the process → process offers services via ara::com
```

---

## AUTOSAR Adaptive Architecture Summary

```
AUTOSAR Adaptive Platform Stack:

  ┌──────────────────────────────────────────────────────────────┐
  │              Adaptive Applications (AA)                      │
  │  MyADASApp  PerceptionService  PathPlanningService           │
  │  (C++17 processes, use ara:: APIs)                           │
  └─────────────────────────┬────────────────────────────────────┘
                            │
  ┌─────────────────────────┴────────────────────────────────────┐
  │         ARA — AUTOSAR Runtime for Adaptive Applications      │
  │                                                              │
  │  ara::com    ara::exec   ara::diag   ara::log   ara::phm     │
  │  ara::crypto ara::nm     ara::ucm    ara::rest  ara::iam     │
  └─────────────────────────┬────────────────────────────────────┘
                            │
  ┌─────────────────────────┴────────────────────────────────────┐
  │            Adaptive Platform Foundation                      │
  │  Execution Manager │ Service Registry │ Communication Mgmt   │
  │  Identity and Access Mgmt │ Crypto Service │ Log and Trace   │
  └─────────────────────────┬────────────────────────────────────┘
                            │
  ┌─────────────────────────┴────────────────────────────────────┐
  │              POSIX Operating System                          │
  │  Linux (Yocto/GENIVI) │ QNX │ PikeOS │ INTEGRITY            │
  │  Process management │ Scheduling │ Virtual memory           │
  │  Network stack │ File system │ IPC (POSIX IPC)              │
  └─────────────────────────┬────────────────────────────────────┘
                            │
  ┌─────────────────────────┴────────────────────────────────────┐
  │              High-Performance Automotive SoC                 │
  │  ARM Cortex-A cores │ NPU/GPU │ Ethernet MAC │ PCIe          │
  └──────────────────────────────────────────────────────────────┘
```

---

## Adaptive Application (AA)

An Adaptive Application is the unit of independently deployable software in the Adaptive Platform. Each AA:

- Built as a **POSIX executable**
- Described by three **manifest files** (Application Manifest, Execution Manifest, Service Instance Manifest)
- Communicates exclusively through `ara::com` (no direct IPC, no global shared memory across AA boundaries)
- Managed by **Execution Management (EM)** — EM starts, stops, and monitors AAs
- Has an **identity** validated by **Identity and Access Management (IAM)**

```
Adaptive Application structure:

my_adas_app/
├── src/
│   ├── main.cpp          ← ara::exec::ApplicationClient initialization
│   ├── perception.cpp    ← Core perception algorithm (ASIL-annotated if safety-relevant)
│   ├── service_proxy.cpp ← ara::com proxy for consuming sensor services
│   └── service_skeleton.cpp ← ara::com skeleton for providing output service
├── manifest/
│   ├── application_manifest.arxml ← AA metadata: name, version, ASIL
│   ├── execution_manifest.arxml   ← Process startup: args, environment, scheduling
│   └── service_instance_manifest.arxml ← Which services to offer/require; transport binding
├── CMakeLists.txt         ← Build system
└── Dockerfile             ← Container for development environment
```

---

## AUTOSAR Adaptive Standards Releases (Key Milestones)

| Release | Date | Key Additions |
|---------|------|--------------|
| R17-03 | March 2017 | First public release: ara::com, ara::exec, ara::diag, ara::log |
| R17-10 | October 2017 | Platform Health Management (PHM), Network Management (NM) |
| R18-03 | March 2018 | Update and Config Management (UCM), improved Security |
| R18-10 | October 2018 | Crypto service, REST API (experimental) |
| R19-03 | March 2019 | DDS transport binding for ara::com; IAM refinement |
| R19-11 | November 2019 | ara::com SOME/IP improvements; PHM refinement |
| R20-11 | November 2020 | Zonal network architecture support; time synchronization |
| R21-11 | November 2021 | Full PHM maturity; ara::iam stable; ara::rest stable |
| R22-11 | November 2022 | ara::crypto enhancements; ara::nm v2 |
| R23-11 | November 2023 | DDS profiling; vehicle API patterns; AP+CP integration |
| R25-03 | March 2025 | Current: Enhanced safety for AP; AUTOSAR Adaptive/Classic gateway patterns |

---

## Relationship to AUTOSAR Classic in a Modern Vehicle

Modern vehicles deploy both platforms simultaneously. The typical architecture:

```
Vehicle Software Architecture (2025 premium vehicle):

  ┌─────────────────────────────────────────────────────────────────┐
  │         Central High-Performance Computer (HPC)                 │
  │         NVIDIA Orin / Qualcomm SA8295                           │
  │         OS: Hypervisor (KVM or XEN)                             │
  │                                                                 │
  │  ┌─────────────────┐   ┌─────────────────────────────────────┐ │
  │  │  VM1: Safety    │   │  VM2: ADAS/AD Apps                  │ │
  │  │  (QNX/PikeOS)   │   │  (Ubuntu 22.04 LTS + GENIVI)        │ │
  │  │  AUTOSAR Adaptive│   │  AUTOSAR Adaptive                   │ │
  │  │  ASIL B target  │   │  Perception, Path Planning          │ │
  │  └─────────────────┘   └─────────────────────────────────────┘ │
  └─────────────────────────────┬───────────────────────────────────┘
                                │ Ethernet backbone (1/10 Gbit)
                ┌───────────────┴───────────────────┐
                │         Domain Gateway ECU         │
                │         NXP S32G / Renesas R-Car   │
                └──────┬────────────────────┬────────┘
                       │ CAN/LIN/FlexRay     │ Ethernet
            ┌──────────┴──────┐   ┌──────────┴──────────┐
            │  Body Control   │   │  ADAS Sensor Fusion  │
            │  Module (BCM)   │   │  (radar, camera)     │
            │  AUTOSAR Classic│   │  AUTOSAR Classic     │
            │  ASIL A/B       │   │  ASIL B/C            │
            └─────────────────┘   └─────────────────────┘
```

The Classic ECUs handle real-time safety-critical actuation (braking, steering, engine); the Adaptive Platform handles intelligence, connectivity, and user experience.
