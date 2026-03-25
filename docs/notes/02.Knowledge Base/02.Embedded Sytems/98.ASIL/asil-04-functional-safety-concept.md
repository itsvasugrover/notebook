---
title: Functional Safety Concept (FSC)
createTime: 2026/03/25 00:00:00
permalink: /kb/embedded/asil/functional-safety-concept/
---

# Functional Safety Concept (FSC)

## Purpose and Position in the V-Model

The Functional Safety Concept (FSC) is the work product of ISO 26262 Part 4 (Product Development at the System Level). It is the first technically-detailed safety document produced after the Hazard Analysis and Risk Assessment (HARA).

```
ISO 26262 V-Model — Left-hand (Development) Side

  Part 3: Concept Phase
    └── HARA ──────────────────── produces Safety Goals (with ASIL)
                                          │
  Part 4: System-Level Development        │
    └── Functional Safety Concept ◄───────┘
          │  (FSC) — this document
          │  Produces: Functional Safety Requirements (FSRs)
          ▼
    └── Technical Safety Concept
          │  (TSC)
          │  Produces: Technical Safety Requirements (TSRs) for HW and SW
          ▼
  Part 5: HW Development         Part 6: SW Development
    └── HW Design                  └── SW Architecture
    └── HW FMEDA                   └── SW Detailed Design
    └── HW PMHF verification       └── SW Unit Testing
```

### What the FSC Must Achieve

| Objective | Normative Reference |
|-----------|---------------------|
| Allocate each safety goal to one or more functional safety requirements | ISO 26262-4:2018 §7.4 |
| Define safe states for each safety goal | ISO 26262-4:2018 §7.4.4 |
| Define the Fault Tolerant Time Interval (FTTI) | ISO 26262-4:2018 §7.4.5 |
| Define emergency operation time intervals | ISO 26262-4:2018 §7.4.6 |
| Specify warning and degradation strategies | ISO 26262-4:2018 §7.4.7 |
| Provide the basis for system architecture development | ISO 26262-4:2018 §7.5 |

---

## Terminology

### Safety Goal (SG)
The top-level safety requirement derived from the HARA. Safety goals are expressed as technical objectives without implementation details.

Example: `SG-01: The EPS system shall not apply unintended torque to the steering column while the vehicle is in motion. [ASIL D]`

### Functional Safety Requirement (FSR)
A requirement allocated from a safety goal to a system element. FSRs represent the first decomposition of safety goals into functional behaviors. They are still implementation-neutral.

Example: `FSR-01-A: The EPS ECU shall detect when the applied torque exceeds the commanded torque by more than ΔT_max within the FTTI. [ASIL C(D)]`

### Safe State
The system condition to be reached when a fault is detected. A safe state is defined such that the associated residual risk is acceptable (tolerable risk level).

```
Safe state types:
  1. De-energized: Power removed from actuator (e.g., hydraulic pressure released)
  2. Hold-last-value: Output frozen at last valid value for a bounded time
  3. Neutral: Output set to zero/center/neutral position
  4. Degraded mode: Reduced capability but safe (e.g., speed-limited operation)
  5. Driver notification only: Alert issued, driver takes over (for ASIL A/B contexts)
```

### Fault Tolerant Time Interval (FTTI)
The maximum time interval from the occurrence of a fault to the resulting violation of a safety goal. The FTTI constrains how quickly fault detection and reaction must occur.

```
FTTI derivation:
  FTTI = FDTI + FRTI

  Where:
    FDTI = Fault Detection Time Interval (max time to detect the fault)
    FRTI = Fault Reaction Time Interval (max time to reach safe state after detection)

  The FTTI is assigned to a safety goal and drives all timing requirements
  in the TSC and HSI.
```

### Emergency Operation Time Interval (EOTI)
The time period after a fault during which the system can continue to operate in a degraded but safe mode before shutting down or reaching the safe state. For example, a vehicle may continue driving at reduced speed for 10 seconds to allow the driver to react.

---

## Deriving Functional Safety Requirements from Safety Goals

The derivation process follows these steps:

1. **Identify the fault model**: What failure mode of which element could violate the safety goal?
2. **Define the detection strategy**: How will the system detect the failure mode?
3. **Define the reaction strategy**: What will the system do when the fault is detected?
4. **Allocate to a functional entity**: Assign each FSR to a function (e.g., torque monitoring function, ECU power management function).
5. **Assign attributes**: ASIL (possibly post-decomposition), FTTI, safe state reference.

### Worked Example: EPS Item (from asil-02-hara.md)

**Safety Goal SGsource**:
```
SG-01: The EPS system shall not apply unintended steering torque 
       while the vehicle speed exceeds 5 km/h. [ASIL D]
Safe state: Power assistance set to zero; mechanical steering retained.
```

**Functional Safety Requirements derived from SG-01**:

```
FSR-01-A (ASIL C(D)):
  The EPS ECU shall monitor the commanded torque versus the measured 
  motor torque. If the difference exceeds ΔT_MAX for more than FDTI_01 
  milliseconds, the ECU shall transition to the safe state defined for SG-01.
  
  Rationale: Detects a stuck-open power stage or FW fault causing 
             runaway motor output.
  
  Allocated to: Torque Monitoring Function (system level)
  FTTI: 50 ms (from SG-01 HARA record)
  Safe state: Type 3 — Neutral (motor assistance = 0)

FSR-01-B (ASIL A(D)):
  The EPS ECU shall monitor the torque sensor signal validity. 
  If the torque sensor signal is outside the valid range or the 
  sensor diagnostic flag is active, the ECU shall issue a driver warning 
  and transition to reduced-assistance mode within FDTI_01 ms.
  
  Rationale: Provides an independent path to detect sensor-side faults
             contributing to SG-01 violation.
  
  Allocated to: Sensor Plausibility Function (system level)
  FTTI: 50 ms
  Safe state: Type 4 — Degraded mode (minimal fixed assistance)

FSR-01-C (ASIL B(D)):
  The EPS ECU shall implement a power stage current limiter in hardware
  that de-energizes the motor driver if the phase current exceeds 
  I_LIMIT_HW amperes for more than T_LIMIT milliseconds, 
  independent of software control.
  
  Rationale: Hardware-level backstop that operates even when ECU 
             software has failed in an undetected manner.
  
  Allocated to: HW Overcurrent Protection Circuit
  FTTI: 5 ms (hardware react time, subset of overall FTTI)
  Safe state: Type 1 — De-energized (gate drivers disabled by HW latch)
```

Traceability: SG-01 → FSR-01-A + FSR-01-B + FSR-01-C (ASIL decomposition: C(D) + A(D) + B(D))

---

## FSC Structure and Document Contents

### Required Sections (ISO 26262-4:2018 §7.4)

| Section | Content |
|---------|---------|
| Scope and item description | Which item the FSC covers; references to item definition |
| Safety goal table | All safety goals with ASIL and safe state references |
| Functional safety requirements | All FSRs with derivation rationale, ASIL, and traceability |
| Safe state definitions | State description, entry conditions, monitoring in safe state |
| FTTI table | FTTI per safety goal and per FSR with derivation |
| EOTI definitions | Emergency operation intervals and limits per SG |
| Warning and degradation strategy | How warning types are prioritized and displayed |
| Functional architecture overview | Block diagram showing functional elements and their FSR allocation |
| Decomposition records | All ASIL decomposition claims with independence justification |
| Traceability matrix | FSR → SG, FSR → Item element |

### Safety Goal Table Example

| ID | Safety Goal | ASIL | Safe State | FTTI |
|----|------------|------|-----------|------|
| SG-01 | No unintended torque while vehicle in motion | ASIL D | Neutral (motor off) | 50 ms |
| SG-02 | No uncommanded brake release above 20 km/h | ASIL D | Hold last brake pressure | 30 ms |
| SG-03 | No false transmission downshift during highway driving | ASIL C | Current gear hold | 200 ms |
| SG-04 | Inadvertent door unlock above 60 km/h | ASIL B | Locked state maintained | 500 ms |

---

## FTTI Derivation in Detail

The FTTI is one of the most technically debated items in the FSC. It determines the entire reaction-time budget for the embedded system.

### FTTI Derivation Method

```
Step 1: Physics-based analysis
  Determine the maximum time a fault can persist before a physical hazard
  occurs at the human level.
  
  Example for EPS SG-01:
  - Fault: ECU applies maximum left-torque on steering
  - Vehicle speed: 50 km/h
  - Maximum steering torque: 8 Nm
  - Time for vehicle to depart lane: estimate from vehicle dynamics ~2 seconds
  - Add: driver workload, perception–reaction time (1.0–1.5 s from HARA)
  - Net time before hazardous event: ~0.5 s
  - Margin for FTTI: 50 ms (very conservative from 500 ms available)

Step 2: Controllability-based sanity check
  The FTTI must allow for:
    - t_FDTI: time for the ECU to detect the fault
    - t_FRTI: time for the ECU to actuate the safe state (motor de-energize)
    - t_margin: margin for latency, jitter, worst-case scheduling delay

  t_FTTI = t_FDTI + t_FRTI
  50 ms = 20 ms detection window + 30 ms motor current decay

Step 3: Controllability verification
  Verify that within the FTTI, the hazardous event probability including
  driver corrective action keeps the residual risk ≤ tolerable risk.
```

### FTTI Budget Allocation Down to SW Tasks

```
System FTTI: 50 ms (from SG-01)
  │
  ├── HW overcurrent latch (FSR-01-C): 5 ms (hardware path, fastest)
  │
  └── SW monitoring path (FSR-01-A + FSR-01-B):
        ├── Worst-case OS scheduling latency: 2 ms
        ├── Torque sensor ADC sampling period: 1 ms
        ├── SW task period (TorqueMonitor): 5 ms (must be ≤ FDTI)
        ├── SW decision function time: < 0.1 ms
        └── CAN message to power stage: 2 ms
        Total FDTI allocation: 10 ms
        
        FRTI: 40 ms remaining for motor current decay and safe-state stabilization
```

---

## Warning and Degradation Strategy

The FSC must specify how driver warnings integrate with safe state transitions:

```
Warning Priority Levels (example taxonomy):

Level 4 (CRITICAL, Red):
  - Immediate safe state transition occurring
  - Instrument cluster: Red warning light + text
  - Audible: Continuous chime
  - Example: SG-01 fault detected, motor disabled

Level 3 (URGENT, Amber latching):
  - Degraded mode entered, driver must stop when safe
  - Instrument cluster: Amber warning light + text
  - Audible: Triple chime
  - Example: Torque sensor fault, reduced-assistance mode

Level 2 (ADVISORY, Amber momentary):
  - Non-critical sub-system degraded, continues to function
  - Instrument cluster: Amber indicator
  - Example: Communication timeout with BMS, manual mode used

Level 1 (INFO, Yellow):
  - Maintenance required, no immediate action
  - Example: Accumulated steering cycles approaching service limit
```

### Degradation Modes per Safety Goal

| Safety Goal | Normal State | Degradation Trigger | Degraded State | Further Degradation | Safe State |
|------------|-------------|--------------------|--------------|--------------------|-----------|
| SG-01 | Full electric assist | Torque sensor range fault | Fixed low-gain assist | Additional fault | Motor off |
| SG-02 | Full ABS+ESC | ESC sensor fault | ABS only | ABS sensor fault | Manual braking |
| SG-03 | Full auto-shift | TCU comm fault | Hold current gear | Second comm fault | N gear request |

---

## FSC Review and Approval

### Review Checklist (ISO 26262-4 Confirmation Measures)

- [ ] Every safety goal has at least one FSR derived from it (completeness)
- [ ] Every FSR is traceable to exactly one safety goal (traceability)
- [ ] Every FSR has an explicit ASIL assignment (correctness)
- [ ] Every ASIL decomposition is justified with independence argument (validity)
- [ ] Every safe state is reachable from each failure mode (feasibility)
- [ ] FTTI is derivable from physics of the hazardous event (defensibility)
- [ ] All FSRs are verifiable (testability — no "shall be safe" without metric)
- [ ] No FSR conflicts with another FSR at system level (consistency)

### Roles in FSC Review

| Role | Responsibility |
|------|---------------|
| Safety Manager | Approves FSC as a safety plan work product |
| CSE (Chief Safety Engineer) | Technical lead; makes ASIL decomposition decisions |
| System Architect | Reviews FSR-to-element allocation for architectural feasibility |
| HW Lead | Reviews FSRs allocated to HW for HW realizability |
| SW Lead | Reviews FSRs allocated to SW for SW realizability and FTTI feasibility |
| Functional Safety Assessor | Independence review of high-ASIL FSRs and decomposition claims |

### Development Interface Agreement (DIA)

When an item is developed by multiple organizations (e.g., OEM and Tier-1 supplier), the FSC is the technical input to the **Development Interface Agreement (DIA)**:

```
DIA structure:
  ├── Responsibilities matrix:
  │     OEM responsibility: Item definition, HARA, FSC, acceptance criteria
  │     Supplier responsibility: TSC, HW design, SW design, safety validation
  │
  ├── Exchange of work products:
  │     OEM provides to supplier: FSC, FTTI, safe state definitions, test environment
  │     Supplier provides to OEM: TSC, FMEDA, SW architecture, test reports
  │
  └── Assumptions of use (for SEooC suppliers):
        Supplier assumes specific item context and documents these assumptions.
        OEM verifies assumptions at integration.
```
