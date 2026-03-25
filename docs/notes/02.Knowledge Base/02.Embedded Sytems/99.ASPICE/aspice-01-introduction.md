---
title: Automotive SPICE Introduction
createTime: 2026/03/25 00:00:00
permalink: /kb/embedded/aspice/introduction/
---

# Automotive SPICE: Introduction and Overview

## What is Automotive SPICE?

Automotive SPICE (Software Process Improvement and Capability dEtermination) is a framework for assessing and improving the processes used to develop software-intensive automotive systems. It is specifically tailored to the automotive industry's demand for safety-critical, real-time embedded software — ECUs controlling engine management, braking, steering, and increasingly, ADAS and autonomous driving functions.

The framework derives from:
- **ISO/IEC 33000** series (the international standard for process assessment, successor to ISO/IEC 15504 / SPICE)
- **ISO/IEC 12207** (software life cycle processes)
- **ISO/IEC 15288** (system life cycle processes)
- Automotive-industry adaptations maintained by the **HIS Consortium** (Hersteller Initiative Software — a group of OEMs including Audi, BMW, Daimler, Porsche, Volkswagen) and now under the **Automotive Special Interest Group (Automotive SIG)** within **intacs** (international assessor certification scheme)

The current release is **Automotive SPICE® Process Assessment / Reference Model (PAM) version 4.0** (2023), aligned with ISO/IEC 33002 conformance requirements. Version 3.1 (2017) remains widely referenced in supplier contracts and existing assessments.

### Why the Automotive Industry Needs ASPICE

Modern vehicles contain 100+ ECUs running over 100 million lines of code. The failure modes of this software — brake-by-wire, electric power steering, airbag deployment — are safety-critical. Automotive OEMs cannot inspect every line of supplier code, so they assess the **process capability** of their software suppliers: a capable, repeatable process produces software that is consistently correct.

ASPICE is used contractually:
- OEMs mandate target capability levels in supplier development contracts
- Tier-1 suppliers propagate ASPICE requirements to Tier-2/Tier-3 suppliers
- ASPICE assessments are a gate criterion for sourcing decisions
- ISO 26262 (functional safety) and ASPICE are complementary — ISO 26262 defines *what* must be achieved (safety requirements, ASIL levels); ASPICE defines *how well* the development process achieves it

---

## Relationship to Other Standards

```
ISO/IEC 33000 series
(Process Assessment meta-standard)
         │
         │ framework basis
         ▼
Automotive SPICE PAM 4.0
(Process Assessment / Reference Model)
         │
         │ complements
         ├────────────────────────────────────┐
         ▼                                    ▼
ISO 26262:2018                          IATF 16949:2016
(Road vehicles — Functional Safety)     (Quality Mgt for Automotive)
         │                                    │
         │                                    ▼
         │                               IATF 16949 + VDA 6.3
         │                               (Process Audit)
         ▼
SOTIF (ISO 21448)
(Safety of the Intended Functionality)
         │
         ▼
ISO/SAE 21434:2021
(Road Vehicles — Cybersecurity Engineering)
```

ASPICE does not replace ISO 26262 or IATF 16949. They operate at different levels:
- ASPICE: *Is the development process capable?*
- ISO 26262: *Are the safety requirements for ASIL-rated functions satisfied?*
- IATF 16949: *Does the manufacturing quality system meet automotive requirements?*

In practice, all three are applied simultaneously to a product. An ASPICE Level 2 (managed process) is a prerequisite for many safety-critical functions; ISO 26262 ASIL C/D work typically demands ASPICE Level 3 (established process) process deployment.

---

## The Automotive SPICE Document Family

| Document | Purpose |
|----------|---------|
| **PAM (Process Assessment Model)** | The normative assessment instrument: defines process purposes, outcomes, base practices, work products, and generic practices per capability level |
| **Process Reference Model (PRM)** | Defines the processes themselves (purpose, outcomes) independently of assessment; embedded within the PAM |
| **Assessor Competency Model** | Defines minimum competency requirements for Automotive SPICE assessors |
| **Assessment Methodology** | Normative guidance on conducting assessments in conformance with ISO/IEC 33002 |
| **Automotive SPICE in Practice (intacs)** | Informative guide to PAM interpretation; published by intacs |

The PAM contains both the PRM and the assessment instruments. The PRM is a subset. This is why practitioners commonly refer to "Automotive SPICE PAM v4.0" as the single authoritative document.

---

## Key Concepts

### Process

A process is a set of interrelated activities performed to transform inputs into outputs. In ASPICE, processes are grouped by **process category** and identified by a two-letter prefix plus number:

| Prefix | Category | Scope |
|--------|----------|-------|
| `SWE` | Software Engineering | Software requirements, design, construction, integration, testing |
| `SYS` | System Engineering | System requirements, architecture, integration, testing |
| `ACQ` | Acquisition | Supplier selection, monitoring, contracts |
| `SPL` | Supply | Supplier response to customer requirements |
| `MAN` | Management | Project management, risk, measurement |
| `PIM` | Process Improvement | Process establishment, assessment, improvement |
| `REU` | Reuse | Reuse program management |
| `SUP` | Support | Quality assurance, configuration management, problem resolution, change management |

### Process Outcome

An observable result of a process. Each process has between 3 and 7 outcomes. Every outcome must be achieved at Capability Level 1 for the process to be rated at Level 1.

### Base Practice (BP)

A process activity that, when performed, contributes to achieving one or more process outcomes. BPs are normative at Capability Level 1.

### Work Product (WP)

A document, artifact, or record produced or consumed by a base practice. Work products are the *evidence* that base practices were performed. Assessors look for work products to rate process performance.

### Generic Practice (GP) / Generic Resource (GR)

At Capability Levels 2–5, process performance is governed by **Generic Practices** that apply to *all* processes. At Level 2, the process must be planned, monitored, and controlled. At Level 3, it must be defined as part of a standard organizational process.

### Capability Level (CL)

A 6-level scale (0–5) measuring how well a process achieves its purpose:

| Level | Name | Description |
|-------|------|-------------|
| 0 | Incomplete | Process not performed or fails to achieve outcomes |
| 1 | Performed | Process achieves its purpose (outputs produced) |
| 2 | Managed | Process planned, monitored, controlled; work products managed |
| 3 | Established | Performed using a defined process from organizational standard |
| 4 | Predictable | Process operated within defined limits; quantitatively managed |
| 5 | Optimizing | Continuously improved; innovation applied |

### Process Attribute (PA)

Each capability level above 0 is defined by one or two Process Attributes that describe *how well* the process is performed:

| Level | Process Attributes |
|-------|-------------------|
| 1 | PA 1.1 Process Performance |
| 2 | PA 2.1 Performance Management, PA 2.2 Work Product Management |
| 3 | PA 3.1 Process Definition, PA 3.2 Process Deployment |
| 4 | PA 4.1 Process Measurement, PA 4.2 Process Control |
| 5 | PA 5.1 Process Innovation, PA 5.2 Process Optimization |

---

## Automotive SPICE in the Supply Chain

```
OEM (e.g., BMW, VW, Toyota)
  │
  │  ASPICE requirements in supplier development agreement:
  │  "Assessed and rated capability ≥ Level 2 for SWE.1–SWE.6, SYS.2–SYS.5,
  │   SUP.1, SUP.8, SUP.9, SUP.10, MAN.3"
  │
  ├── Tier-1 Supplier (e.g., Bosch, Continental, ZF)
  │     │  develops complete ECU (hardware + software)
  │     │  conducts internal ASPICE assessments
  │     │  may undergo OEM-witnessed assessment
  │     │
  │     └── Tier-2 Supplier (e.g., embedded OS vendor, communication stack)
  │           │  OEM propagates ASPICE requirements through Tier-1
  │           │  Tier-2 assessed for relevant processes only
  │           │  (e.g., software development processes if SW-only deliverable)
  │
  └── ASPICE Assessor / Assessment Team
        │  may be OEM internal assessors
        │  or external certified assessors (intacs Provisional/Competent/Principal)
        │  follows Assessment Methodology document
```

### Common OEM Demands per Safety Level

| ASIL / Criticality | Typical Demanded Capability Level |
|--------------------|------------------------------------|
| QM (non-safety) | CL 1 (evidence of performance) |
| ASIL A–B | CL 2 for SWE/SYS/SUP/MAN processes |
| ASIL C | CL 2 for most; CL 3 for critical processes |
| ASIL D | CL 3 for SWE and SYS processes |

---

## Version History

| Version | Year | Key Changes |
|---------|------|-------------|
| 2.0 | 2005 | First HIS-maintained release |
| 2.4 | 2008 | Widely used; many projects still reference this for legacy contracts |
| 2.5 | 2010 | Updated BPs, first systematic WP alignment |
| 3.0 | 2015 | Major restructure: system processes added (SYS.x), HW processes (HWE.x draft) |
| 3.1 | 2017 | Stable release; most current OEM contracts reference this |
| 4.0 | 2023 | Aligned with ISO/IEC 33000 terminology, added HWE processes (HWE.1–HWE.6), Machine Learning processes (MLE), cybersecurity processes |

Version 4.0 introduces **HWE (Hardware Engineering)** processes formally, **MLE (Machine Learning Engineering)** processes for AI-based automotive systems, and alignment with **ISO/SAE 21434** for cybersecurity.
