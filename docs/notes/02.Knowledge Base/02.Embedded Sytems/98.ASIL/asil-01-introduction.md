---
title: ASIL Introduction & ISO 26262 Overview
createTime: 2026/03/25 00:00:00
permalink: /kb/embedded/asil/introduction/
---

# ASIL — Automotive Safety Integrity Level

## What Is ASIL?

**ASIL** (Automotive Safety Integrity Level) is a risk classification scheme defined by the international standard **ISO 26262** — *Road vehicles — Functional Safety*. An ASIL is assigned to each safety goal of a system or function and determines the rigor of the safety measures required to reduce the risk of that hazard to an acceptable level.

ASIL is not a property of a component in isolation — it is a property of a **safety goal** derived from a hazardous event. The ASIL tells you: *how hard does this safety-relevant behavior need to be to get right?*

There are four ASIL levels and one non-safety level:

| Level | Risk Level | Typical Application |
|-------|-----------|---------------------|
| QM (Quality Management) | No specific safety requirements beyond normal quality | Interior lighting, infotainment |
| ASIL A | Lowest safety integrity requirement | Parking assist visual indicators |
| ASIL B | Low-medium safety integrity | Power window, automatic door locks |
| ASIL C | Medium-high safety integrity | Electronic Stability Control (ESC), airbag triggering |
| ASIL D | Highest safety integrity | Brake-by-wire, steer-by-wire, autonomous emergency braking |

---

## ISO 26262 — The Standard That Defines ASIL

ISO 26262 is the adaptation of IEC 61508 (general functional safety for electrical and electronic systems) to the road vehicle domain. First published in 2011, the second edition was released in 2018 and added motorcycles, trucks, buses, and semiconductors.

### Standard Family Structure (2018 Edition)

| Part | Title | Key Content |
|------|-------|-------------|
| Part 1 | Vocabulary | Definitions of all terms used in the standard |
| Part 2 | Management of Functional Safety | Safety management, safety plan, confirmation measures |
| Part 3 | Concept Phase | Item definition, HARA, safety goals, functional safety concept |
| Part 4 | Product Development at the System Level | Technical safety concept, system design, HW-SW integration |
| Part 5 | Product Development at the Hardware Level | HW safety requirements, HW design, FMEA, FTA, PMHF |
| Part 6 | Product Development at the Software Level | SW safety requirements, SW architecture, coding, testing, coverage |
| Part 7 | Production, Operation, Service, and Decommissioning | Manufacturing controls, field monitoring |
| Part 8 | Supporting Processes | Configuration management, change management, qualification of tools, methods |
| Part 9 | ASIL-Oriented and Safety-Oriented Analyses | FMEA, FTA, FMEDA, dependent failure analysis |
| Part 10 | Guidelines on ISO 26262 | Informative guidance on applying the standard |
| Part 11 | Guidelines on Application of ISO 26262 to Semiconductors | Chip-level functional safety |
| Part 12 | Adaptation for Motorcycles | Motorcycle-specific considerations |

---

## Key Concepts and Definitions

### Item
An **item** is the system or combination of systems that realizes a function at the vehicle level. Examples: the Electronic Power Steering (EPS) item, the Electronic Brake Control (EBC) item. The item boundary defines what is in scope for the safety analysis.

### Element
A lower-level constituent of an item — a system, sub-system, software component, hardware component, or external interface.

### Hazard
A physical situation that, in combination with certain vehicle conditions, can lead to an accident. Example: "unintended positive drive torque applied to wheels" is a hazard.

### Hazardous Event
The combination of a hazard and a specific operational situation. Example: "Unintended positive drive torque while cornering at highway speed."

### Safety Goal
A high-level safety objective assigned to prevent or mitigate a hazardous event. Safety goals are expressed in terms of the system's safe behavior, not in terms of implementation. Example: "Prevent unintended positive drive torque."

Each safety goal receives an ASIL rating based on the HARA (Hazard Analysis and Risk Assessment).

### Functional Safety
The absence of unreasonable risk due to hazards caused by malfunctioning behavior of electrical/electronic systems. ISO 26262 does not eliminate risk entirely — it requires that risk be reduced to a level that is "as low as reasonably practicable" (ALARP).

### Safe State
A state in which unacceptable hazards are avoided. For a steer-by-wire system, a safe state might be: reduced vehicle speed (below a critical threshold) before steering assistance is lost.

### Fault, Error, Failure

These three terms have precise meanings in ISO 26262:

```
FAULT                    ERROR                    FAILURE
Incorrect state in      Discrepancy between       Inability of an element
hardware/SW element     a computed value and      to perform a required
that can lead to        the correct value;        function within specified
an error                manifestation of a fault  limits; effect of an error
    │                        │                         │
    └──────────────────────► ├──────────────────────► │
      (fault propagation)    (error detection)        (failure effect)
```

### Random Hardware Failure vs. Systematic Failure

| Type | Description | ISO 26262 Control Mechanism |
|------|-------------|--------------------------|
| **Random hardware failure** | Component fails unpredictably due to physical degradation (aging, cosmic rays, thermal stress) | PMHF (Probabilistic Metric for Hardware Failures), FMEDA, fault detection coverage |
| **Systematic failure** | Deterministic failure caused by a design defect — always fails under the same conditions | Process rigor (ASIL-appropriate design methods, testing, reviews, verification) |

ASIL addresses both: systematic failures through process requirements (Part 6 SW development rigor), and random hardware failures through architectural metrics (Part 5 PMHF targets).

---

## The ISO 26262 V-Model

ISO 26262 structures product development as a V-model, mirroring the ASPICE V-model but at a functional safety level:

```
                Item Definition (3.4)
                        │
                 HARA (3.5)  ────────────────────────────────────────────────►
                        │                                              Vehicle test
                 Safety Goals &                                        (ISO 26262-3.7)
                 Functional Safety Concept (3.6, 3.7)
                        │
          ┌─────────────┴──────────────┐
          │                            │
   System Design                 System Integration
   Technical Safety Concept      System Test (ISO 26262-4.7)
   (ISO 26262-4.4, 4.5)                    ▲
          │                            │
    ┌─────┴─────┐                 ┌────┴────┐
    │           │                 │         │
   HW Design  SW Design      HW Integration SW Integration
   (Part 5)   (Part 6)       (Part 5)      (Part 6)
                │                             ▲
                └─────────────────────────────┘
                    Implementation + Unit Test
```

---

## ISO 26262 vs. Related Standards

ASIL/ISO 26262 does not operate alone. In modern automotive development, it interacts with:

| Standard | Domain | Relationship to ISO 26262 |
|---------|--------|--------------------------|
| **ISO/SAE 21434** | Cybersecurity | Parallel V-model; TARA outputs can identify cybersecurity requirements that intersect safety goals |
| **ISO 21448 (SOTIF)** | Safety of the Intended Functionality | Addresses inadequate specification and sensor limitations — covers cases where the system functions correctly but is not safe |
| **Automotive SPICE (ASPICE)** | Process capability | Defines development process rigor — ASIL levels map to required ASPICE CL targets |
| **IATF 16949** | Quality management | Quality management system for automotive supply chain; overlaps with Part 2 safety management |
| **IEC 61508** | General E/E safety | Parent standard; ISO 26262 is a sector-specific adaptation |
| **ISO 25119** | Agricultural machinery | Agricultural equivalent of ISO 26262 |

### ISO 26262 and ASPICE

HARA-derived ASIL levels directly influence the expected ASPICE Capability Level of the engineering processes:

| ASIL Level | Recommended ASPICE CL for Core SWE Processes |
|-----------|----------------------------------------------|
| QM | CL 1 (process performed) is often acceptable |
| ASIL A | CL 2 recommended |
| ASIL B | CL 2 required by most OEMs |
| ASIL C | CL 2 minimum; CL 3 for critical functions |
| ASIL D | CL 3 required; some OEMs require CL 3+ for all SWE |

---

## Normative vs. Informative Requirements

ISO 26262 uses "shall" (normative obligation), "should" (strong recommendation), and "may" (permitted). The PAM tables in Parts 5 and 6 use a three-level recommendation scale:

| Notation | Meaning |
|----------|---------|
| **++** | Highly Recommended (strongly advised for the given ASIL) |
| **+** | Recommended |
| **○** | No explicit recommendation (may still be used) |

These recommendation ratings are ASIL-dependent. For example, MC/DC coverage (a.k.a. Modified Condition/Decision Coverage) is rated:
- ASIL A: ○
- ASIL B: ○
- ASIL C: +
- ASIL D: ++

---

## Scope Limitations of ISO 26262

ISO 26262:2018 explicitly states it applies to:
- Passenger cars, trucks, buses, trailers, motorcycles (Part 12)
- E/E systems that can cause hazards by their malfunction
- Production vehicles intended for series development

It does **not** cover:
- Hazards from the intended functionality when working correctly (covered by SOTIF)
- Cybersecurity threats (covered by ISO/SAE 21434)
- Unique vehicles (race cars, specialized construction vehicles)
- Mechanical failure modes (only E/E systems in scope)

---

## Evolution: ISO 26262:2011 vs. 2018

| Change | 2011 | 2018 |
|--------|------|------|
| Scope | Passenger cars only | Extended to trucks, buses, motorcycles (Part 12), semiconductor chips (Part 11) |
| SEooC concept | Not defined | **Safety Element out of Context**: develop a component without knowing the full vehicle context |
| SOTIF | Not separated | Separated into ISO 21448 |
| Cybersecurity | Not addressed | ISO/SAE 21434 coordination referenced |
| Part 11 | Not present | Added for semiconductor/chip suppliers |
| Part 12 | Not present | Added for motorcycles |

---

## The Five Phases of a Typical ISO 26262 Project

```
Phase 1: CONCEPT
  ├── Item Definition (what is the system? boundary? interfaces?)
  ├── Hazard Analysis and Risk Assessment (HARA)
  ├── Safety Goals (with ASIL ratings)
  └── Functional Safety Concept (FSC)

Phase 2: SYSTEM DEVELOPMENT
  ├── Technical Safety Concept (TSC)
  ├── System Architectural Design
  ├── System Integration and Test
  └── Safety Analysis (FMEA, FTA, DFA at system level)

Phase 3: HARDWARE DEVELOPMENT
  ├── HW Safety Requirements
  ├── HW Design (schematic, layout)
  ├── HW Safety Analysis (FMEDA, FTA, FMEA)
  └── PMHF calculation and verification

Phase 4: SOFTWARE DEVELOPMENT
  ├── SW Safety Requirements
  ├── SW Architecture (with safety mechanisms)
  ├── SW Detailed Design and implementation (MISRA C, coding guidelines)
  ├── Unit testing (coverage: statement, branch, MC/DC)
  └── Integration and qualification testing

Phase 5: INTEGRATION AND VERIFICATION
  ├── HW-SW integration
  ├── System integration and test
  ├── Functional Safety Assessment (FSA)
  └── Release for Production
```
