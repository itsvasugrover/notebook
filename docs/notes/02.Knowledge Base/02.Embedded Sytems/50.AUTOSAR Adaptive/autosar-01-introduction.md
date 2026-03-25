---
title: AUTOSAR Introduction & History
createTime: 2026/03/25 00:00:00
permalink: /kb/embedded/autosar/introduction/
---

# AUTOSAR Introduction & History

## What Is AUTOSAR?

**AUTOSAR** (AUTomotive Open System ARchitecture) is a worldwide development partnership of automotive manufacturers, suppliers, and technology companies. Founded in 2003, AUTOSAR defines a standardized software architecture for automotive ECUs (Electronic Control Units), with the goal of enabling:

- **Interoperability**: Software components from different suppliers can be integrated into the same vehicle ECU
- **Scalability**: Same software components reused across vehicle variants and platforms
- **Functional safety**: Standardized BSW building blocks with known safety properties
- **Maintainability**: Clear separation between software and hardware enables independent updates

AUTOSAR does NOT produce software — it publishes specifications. The actual software (BSW stacks, tools, OS kernels) is implemented by commercial vendors and open-source projects following the specification.

---

## AUTOSAR Timeline and Versions

```
2002: Initial discussions between BMW, Bosch, Continental, DaimlerChrysler,
      Siemens VDO, Volkswagen
2003: AUTOSAR consortium officially founded (5 core, 5 premium members)
2004: First specification draft (Release 1.0 — internal only)
2006: AUTOSAR Release 2.1 — first publicly available specification
2007: Release 3.0 — major refinement; OSEK compatibility maintained
2008: Release 3.1 — COM stack, ECU configuration
2010: Release 4.0 — AUTOSAR Classic fully mature; Ethernet support begins
2011: Release 4.1 — SOME/IP, large data transfer
2014: Release 4.2 — Ethernet, diagnostic improvements, Adaptive concept initiates
2017: AUTOSAR Adaptive Platform Release 17-03 (first official Adaptive spec)
2018: AUTOSAR Adaptive 18-03 and 18-10 — Execution Management, UCM
2019: Adaptive 19-03 — Cryptocurrency, PHM stabilization
2020: Adaptive 20-11 — SOME/IP, DDS transport binding, ara::log refinements
2021: Adaptive 21-11 — Platform Health Management finalization
2022: Adaptive 22-11 — ara::crypto improvements, IAM
2023: Adaptive 23-11 — Adaptive Platform maturation; REST API support
2025: Adaptive 25-03 — Current; DDS profiling, zonal architecture integration
```

### AUTOSAR Partnership Structure

| Tier | Role | Example Members |
|------|------|----------------|
| Core Partner | Define specifications; steering committee | BMW, Bosch, Continental, Denso, Ford, GM, Stellantis, Toyota, VW, ZF |
| Premium Partner | Contribute to specification; implement tools/BSW | dSPACE, ETAS, MathWorks, Vector, Wind River |
| Associate Partner | Access specifications; provide feedback | Various Tier-2 suppliers, tool vendors |
| Development Partner | Contribute to specific development areas | Academic and research organizations |

---

## Two AUTOSAR Platforms

AUTOSAR defines two distinct software platforms, each addressing a different class of ECU:

```
                    AUTOSAR Ecosystem
                           │
           ┌───────────────┴───────────────┐
           │                               │
   AUTOSAR Classic                AUTOSAR Adaptive
   Platform (CP)                  Platform (AP)
   ────────────────                ─────────────────
   Released: 2006                  Released: 2017
   Target: Traditional MCUs        Target: High-performance SoCs
   OS: AUTOSAR OS (OSEK-based)     OS: POSIX (QNX, Linux, PikeOS)
   SW paradigm: Signal-based       SW paradigm: Service-oriented
   Language: C (primary)           Language: C++14/17
   Memory: Static allocation       Memory: Dynamic (controlled)
   Networking: CAN, LIN, FlexRay   Networking: Ethernet (SOME/IP, DDS)
   Use cases: Powertrain, Body,    Use cases: ADAS, AD, Infotainment,
             Chassis control                  Connectivity, OTA
   Safety: ASIL A–D (well-proven)  Safety: ASIL B (evolving)
```

---

## The Automotive Software Challenge: Why AUTOSAR Exists

Before AUTOSAR, automotive software was:

```
Pre-AUTOSAR typical ECU software structure:

  ┌──────────────────────────────────────────────────────┐
  │                  Application Code                    │
  │        (directly accesses hardware registers)         │
  │                                                      │
  │  #define ADC_RESULT_REG  *(volatile uint16_t*)0xFC000│
  │  float torque = ADC_RESULT_REG * 0.004883f;          │
  │                                                      │
  │  /* CAN send directly via Bosch CC770 descriptor */  │
  │  CAN_MSGOBJ[5].DATA[0] = (uint8_t)torque;            │
  │  CAN_MSGOBJ[5].DATA[1] = (uint8_t)(torque >> 8);     │
  │  CAN_MSGOBJ[5].CTRL.all = 0x0A55;  /* transmit */    │
  └──────────────────────────────────────────────────────┘
  Hardware: MC68376 (Motorola)

  Problems:
  1. Changing from MC68376 to C167 requires rewriting ALL application code
  2. Supplier A's torque code + Supplier B's ABS code = integration nightmare
  3. Testing the application is impossible without physical hardware
  4. Safety analysis requires understanding of hardware-level code
```

AUTOSAR solved this by introducing strict layering, standardized interfaces, and generated configuration code between hardware and application software.

---

## AUTOSAR Core Philosophy: Separation of Concerns

The foundational AUTOSAR principle is **"Collaborate on standards, compete on implementations."**

```
AUTOSAR separates:
  ├── WHAT the software does (application logic — supplier differentiator)
  ├── HOW it communicates (standardized communication APIs — AUTOSAR defines)
  ├── WHAT hardware it runs on (abstracted by MCAL — hardware-specific, 
  │                             but with standardized interface upward)
  └── HOW it is configured (ARXML tool-based configuration — AUTOSAR defines format)
```

This separation enables:
- An OEM to switch from Supplier A's braking SWC to Supplier B's braking SWC without changing the BSW
- A BSW vendor to support 10 different MCUs with the same MCAL interface above
- A tool vendor to generate integration code from an ARXML model without knowing the application logic

---

## Key AUTOSAR Concepts (Common to Both Platforms)

### Software Component (SWC)
A unit of application software with defined ports (connectors) and interfaces. SWCs are the reusable building blocks of AUTOSAR application software.

### Port and Interface
A port is a communication endpoint on an SWC. Ports connect SWCs to each other or to BSW services. The interface defines the data types exchanged via the port.

### ARXML (AUTOSAR XML)
The meta-model serialization format. All AUTOSAR configuration, component descriptions, interface definitions, and deployment information are stored in ARXML files. Tools read/write ARXML to configure the system.

### Runtime Environment (RTE / ara::com)
- **Classic**: The RTE (Runtime Environment) is generated code that marshals data between SWCs and BSW via standardized APIs
- **Adaptive**: `ara::com` is the C++ communication middleware API

### ECU Configuration
The process of mapping abstract software components to concrete ECU hardware, configuring BSW parameters, and generating the integration glue code. Done using AUTOSAR configuration tools (Vector DaVinci Developer, EB tresos, ETAS Isolar).

---

## AUTOSAR and ISO 26262 Relationship

AUTOSAR is both a beneficiary and an enabler of ISO 26262 functional safety:

| Aspect | AUTOSAR Contribution |
|--------|---------------------|
| Pre-qualified BSW | BSW modules (OS, WdgM, E2E, FiM) pre-qualified at ASIL D by vendors — reduces tool and component qualification effort |
| Standardized safety mechanisms | E2E Library (ISO 26262 communication protection) built into the standard |
| WdgM | Watchdog Manager with alive/deadline/logical supervision |
| FiM | Function Inhibition Manager — inhibit functions when their enabling conditions are not safe |
| AUTOSAR OS | Safety-qualified RTOS with OS application partitioning and MPU support |
| DEM / FDC | Diagnostic Event Manager — systematic fault storage and DTC management |
| Memory partitioning | OS Application concept with MPU enforcement standardized across MCUs |

Safety-qualified AUTOSAR BSW from vendors like EB (Elektrobit), Vector, ETAS, and KPIT provides ASIL D pre-qualified components, reducing the project-specific qualification burden significantly.

---

## AUTOSAR Members and Tools Ecosystem

### BSW Stack Providers (Classic)
| Vendor | Product | Notes |
|--------|---------|-------|
| Vector | MICROSAR | Most widely deployed globally |
| EB (Elektrobit) | EB tresos | Major presence in Tier-1 suppliers |
| ETAS | RTA-BSW | Bosch subsidiary; strong in powertrain |
| KPIT | KPIT AUTOSAR | Strong in Asia Pacific |
| Mentor (Siemens) | Nucleus AUTOSAR | Part of Siemens EDA portfolio |

### Adaptive Platform Providers
| Vendor | Product | Notes |
|--------|---------|-------|
| ETAS | AUTOSAR Adaptive (RTA-A) | Bosch subsidiary |
| Vector | MICROSAR.AP | Commercial grade |
| EB (Elektrobit) | EB corbos Adaptive AUTOSAR | Linux-based; strong OEM deployments |
| APEX.AI | Apex.OS | ROS 2 based, AUTOSAR Adaptive compatible |
| OpenAA (open source) | ara-api | Reference open-source implementation |

### Configuration Tools
| Tool | Vendor | Used For |
|------|--------|---------|
| DaVinci Developer | Vector | SWC design, RTE generation, BSW config |
| DaVinci Configurator | Vector | BSW module configuration |
| EB tresos Studio | EB | BSW configuration |
| SystemDesk | dSPACE | System architecture, SWC modeling |
| AUTOSAR Builder | Mentor | ARXML-based design |
