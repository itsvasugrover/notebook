---
title: Technical Safety Concept (TSC)
createTime: 2026/03/25 00:00:00
permalink: /kb/embedded/asil/technical-safety-concept/
---

# Technical Safety Concept (TSC)

## Purpose and Position in the V-Model

The Technical Safety Concept (TSC) is the work product of ISO 26262 Part 4 (Product Development at the System Level), produced after the Functional Safety Concept (FSC). It translates the implementation-neutral Functional Safety Requirements (FSRs) into concrete, architecture-bound **Technical Safety Requirements (TSRs)** that are allocated to specific hardware and software elements.

```
FSC (Functional Safety Concept)
  │  Implementation-neutral: "detect torque error > ΔT within FTTI"
  │
  ▼
TSC (Technical Safety Concept)
  │  Implementation-specific: "MCU ADC on PA3 shall sample torque sensor 
  │  at 1 kHz; SW module TorqueMonitor shall compare to setpoint and 
  │  assert SafetyRequest flag if |delta| > 2 Nm for > 3 samples"
  │         │                │
  ▼         ▼                ▼
HW TSRs    SW TSRs          HSI Spec
(Part 5)   (Part 6)         (Interface between HW and SW)
```

### TSC vs. FSC

| Aspect | FSC | TSC |
|--------|-----|-----|
| Level of abstraction | Functional | Technical / architectural |
| Implementation reference | None | Specific HW/SW elements |
| Required by standard | Part 4 §7.4 | Part 4 §7.5 |
| Audience | System engineer, architect | HW and SW design engineers |
| Contains FTTI? | Yes (derived from physics) | Yes (allocated to HW/SW budget) |
| Contains safety mechanisms? | No (functional detection strategy) | Yes (concrete mechanism specified) |

---

## Technical Safety Requirements (TSRs)

A TSR is a technically-specified, verifiable requirement assigned to a specific hardware or software element.

### TSR Attributes

| Attribute | Description | Example |
|-----------|-------------|---------|
| ID | Unique identifier | TSR-EPS-042 |
| Title | Short label | Motor Phase Current Limit HW |
| Derived from | Traceability to FSR | FSR-01-C |
| ASIL | Inherited from FSR (post-decomposition) | ASIL B(D) |
| Allocated to | HW or SW element | HW: Gate Driver IC U7 |
| Requirement text | Precise, verifiable text | See below |
| Verification method | Test, analysis, inspection | HW bench test + simulation |
| Safe state reference | Which safe state is activated | SS-01: Gate driver latch active-low |

### TSR Example (HW)

```
TSR-EPS-042
╔══════════════════════════════════════════════════════════════════════╗
║ The gate driver IC (U7, DRV8301) hardware overcurrent protection     ║
║ shall assert the nFAULT signal within 5 µs when the measured peak    ║
║ motor phase current exceeds 60 A, and shall latch the gate outputs   ║
║ low (all MOSFETs off) until the fault is cleared by a reset signal   ║
║ from the MCU (nSCS pin). The fault latch shall be implemented in     ║
║ hardware and shall NOT require MCU software to maintain the safe     ║
║ state.                                                               ║
╚══════════════════════════════════════════════════════════════════════╝
ASIL: ASIL B(D)
Derived from: FSR-01-C (hardware-level backstop for SG-01)
Verified by: TSR-EPS-042-TV: Inject 65 A on phase U at DUT bench.
             Measure nFAULT assertion time. Pass criterion: ≤ 5 µs.
             Inspect schematic for hardware latch circuit (no MCU in loop).
```

### TSR Example (SW)

```
TSR-EPS-017
╔══════════════════════════════════════════════════════════════════════╗
║ The SW module TorqueMonitor (TorqMon.c) shall be scheduled by the   ║
║ AUTOSAR OS every 5 ms. It shall compare the filtered torque setpoint ║
║ (output of TorqueControl module, in Nm, Q8 fixed-point) to the ADC  ║
║ measured motor torque (TorqueSensor.c output). If the difference     ║
║ |e_torque| > TRQ_DELTA_MAX (calibratable, default 2.0 Nm) for       ║
║ 3 consecutive task cycles, the module shall call                     ║
║ SafetyManager_RequestSafeState(SS_01) and set the diagnostic flag    ║
║ DTCID_0x1234 (TorqueDeviationExceeded).                              ║
╚══════════════════════════════════════════════════════════════════════╝
ASIL: ASIL C(D)
Derived from: FSR-01-A (torque monitoring function)
Verified by: TSR-EPS-017-TV: SW unit test — inject torque error;
             verify SafetyManager call and DTC set within 15 ms.
```

---

## Hardware-Software Interface (HSI) Specification

The **Hardware-Software Interface (HSI)** is a normative work product defined in ISO 26262 Part 4 §7.5.3. It specifies the complete technical interface between hardware and software relevant to safety.

### HSI Contents

The HSI must document every HW/SW interaction that affects safety-relevant behavior:

```
HSI Document Sections:
  1. Hardware resources
     ├── Memory map: base addresses and sizes for all RAM, ROM, peripheral regions
     ├── Interrupt table: IRQ numbers, priorities, latencies
     ├── DMA channel assignments: which peripherals use DMA, memory regions
     └── Clock tree: clock domains, frequencies, gating mechanisms

  2. Peripheral and sensor interfaces
     ├── ADC: channel assignments, resolution, sampling rate, reference voltage
     ├── PWM: timer base clock, period, resolution, dead-time settings
     ├── SPI/I2C/UART: bus assignments, baud rates, timing constraints
     └── GPIO: pin assignments, drive strength, pull-up/down configuration

  3. Safety-relevant hardware behavior
     ├── Watchdog: window period, trigger mechanism, behavior on timeout
     ├── HW overcurrent latch: threshold, latching behavior, reset mechanism
     ├── Power-on reset: startup time, voltage thresholds
     ├── MPU: region definitions, access attributes (no-exec, read-only, etc.)
     └── Lock-step core: error detection mechanism, fault injection interface

  4. Startup and shutdown sequences
     ├── Power-on initialization sequence (step-by-step with timing)
     └── Safe state entry sequence (which bits to set in which registers)

  5. Assumed HW failure modes for SW
     ├── ADC stuck-high / stuck-low behavior
     ├── SPI communication error behavior (timeout, CPHA mismatch)
     └── EEPROM bit-flip behavior (ECC or parity behavior)
```

### ASIL Inheritance from HW to SW

The ASIL of an SW component is determined by the FSR it implements, not by the hardware it runs on:

```
FSR-01-A: ASIL C(D) → SW module TorqueMonitor.c must be developed to ASIL C
FSR-01-B: ASIL A(D) → SW module SensorPlausibility.c developed to ASIL A

If TorqueMonitor.c and SensorPlausibility.c co-exist on the same MCU:
  → Freedom from interference must be proven (see asil-03-asil-decomposition.md)
  → MPU must protect TorqueMonitor memory regions from SensorPlausibility access
```

---

## System Architecture Design for Safety

The TSC is inseparable from the system architecture. The architecture must:

1. Allocate each FSR to system elements (sensors, ECUs, actuators, communication buses)
2. Specify the safety mechanisms that implement detection and reaction
3. Specify the safe state entry path for each failure mode

### System Architecture Block Diagram (EPS Example)

```
                         Vehicle CAN Bus
                               │
                     ┌─────────┴──────────┐
                     │                    │
          ┌──────────┴──────┐   ┌────────┴──────────┐
          │   EPS ECU       │   │ Main Vehicle ECU  │
          │                 │   │ (speed, ignition) │
          │ ┌─────────────┐ │   └───────────────────┘
          │ │Main MCU     │ │
          │ │RH850-F1x    │ │
         ─┤─│             │ │
Torque    │ │TorqueMonitor│ │
Sensor ───┤─│SensorPlausi │ │
          │ │TorqueControl│ │
          │ └──────┬──────┘ │
          │        │        │
          │ ┌──────┴──────┐ │
          │ │Safety MCU   │ │    HW Latch
          │ │TC234        │ │  ┌──────────┐
          │ │IndepMonitor │─┼──│Gate Drv  │── Motor Phase A/B/C
          │ └─────────────┘ │  │DRV8301   │
          │                 │  └──────────┘
          └─────────────────┘
                  │
           Steering Column
              Torque Output
```

### Allocation Table: FSR → System Element

| FSR ID | FSR Name | Allocated to | Element Type | ASIL |
|--------|---------|------------|------------|------|
| FSR-01-A | Torque deviation detection | Main MCU: TorqueMonitor.c task | SW | ASIL C(D) |
| FSR-01-B | Sensor plausibility | Main MCU: SensorPlausibility.c task | SW | ASIL A(D) |
| FSR-01-C | HW overcurrent latch | Gate Driver IC (DRV8301) | HW | ASIL B(D) |
| FSR-02-A | Independent torque monitor | Safety MCU: IndependentMonitor.c | SW | ASIL B(D) |
| FSR-02-B | Motor enable supervision | Safety MCU GPIO → Gate Driver enable pin | HW/SW | ASIL B(D) |

---

## Safety Mechanisms Specified in the TSC

The TSC is the first document to specify concrete safety mechanisms. These are later detailed in hardware FMEDA (Part 5) and software architecture (Part 6).

### Typical Safety Mechanisms and Their TSR Allocation

#### 1. Watchdog Timer

```
TSR: The SW application shall trigger the window watchdog by calling 
     WDG_Trigger() at 95–105 ms intervals. If the trigger is missed or 
     occurs outside the window, the watchdog IC (SBC U4) shall assert 
     RESET to the Main MCU within 1 ms.

WHY: Detects "stuck" SW execution paths (task overrun, infinite loop)
ASIL: ASIL D watchdog mechanism (covered by watchdog IC ASIL-D certification)
```

#### 2. End-to-End (E2E) Protection

```
TSR: All safety-relevant data exchanged over CAN bus between the EPS ECU 
     and any other ECU shall be protected by an AUTOSAR E2E Profile 2 
     wrapper with: CRC (16-bit), sequence counter (4-bit), data ID.
     The receiver shall check the CRC and counter and shall set 
     E2E_STATUS = E2E_P02STATUS_ERROR if a violation is detected.

WHY: CAN bus arbitration and electromagnetic interference can corrupt
     data without bit-level detection. E2E detects multi-bit errors.
ASIL: ASIL D E2E protection (E2E Profile 2 provides diagnostic coverage 
      ≥ 99% for 2-byte CRC)
```

#### 3. Cross-Channel Torque Comparison

```
TSR: The Safety MCU (TC234) shall receive the torque setpoint from 
     the Main MCU via internal point-to-point SPI. It shall independently 
     read the torque sensor via its own SPI port (distinct from Main MCU 
     SPI bus). It shall compare |setpoint - measured| against 
     SAFE_TRQ_DELTA_HW. If the threshold is exceeded, the Safety MCU 
     shall de-assert the Motor_Enable GPIO pin within 2 ms, 
     independently of the Main MCU.

WHY: Single-chip ASIL D not achieved; redundant MCU provides independent 
     monitoring path (dual-channel ASIL B(D) + ASIL B(D) decomposition)
ASIL: Safety MCU path: ASIL B(D); combined with Main MCU path = ASIL D
```

#### 4. Memory ECC and MPU

```
TSR-MEM-01: The Main MCU shall run with ECC enabled on all safety-relevant 
             RAM regions (as defined in HSI Section 1.1). ECC single-bit 
             errors shall be logged and reported to the safety monitor.
             ECC double-bit errors shall immediately trigger a Reset.

TSR-MEM-02: The MPU shall be configured according to MPU Configuration Table 
             Rev A (Appendix B of this TSC). Memory regions used by ASIL C 
             modules shall be marked no-access for QM modules.
```

---

## ASIL Decomposition at the System Level

The TSC formalizes the ASIL decomposition decided in the FSC by allocating each decomposed branch to a specific system element:

```
SG-01: ASIL D
  └── decomposed in FSC to:
        FSR-01-A: ASIL C(D) + FSR-01-B: ASIL A(D) [software path]
        + FSR-01-C: ASIL B(D) [hardware path]
        
  TSC allocates:
        FSR-01-A → TorqueMonitor.c on Main MCU    ← develops to ASIL C
        FSR-01-B → SensorPlausib.c on Main MCU    ← develops to ASIL A
        FFI between FSR-01-A and FSR-01-B → MPU Table entry MEM-SAFETY-01
        
        FSR-01-C → DRV8301 Gate IC overcurrent    ← hardware element

  DFA for TSC decomposition:
        DFA-TSC-01: Shared power supply for Main MCU and Gate Driver
        DFA-TSC-02: CAN bus coupling between Main MCU safety flag and Gate Driver
        DFA-TSC-03: Single torque sensor (shared input for FSR-01-A and FSR-01-B)
        → Countermeasures documented and referenced in TSC Appendix DFA
```

---

## TSC Review and Approval

### Minimum Required Evidence

| Work Product | Required For | Normative Clause |
|-------------|-------------|-----------------|
| TSR table with full traceability | All TSRs → FSRs → SGs | ISO 26262-4 §7.5 |
| System architecture diagram | Visual TSR allocation overview | ISO 26262-4 §7.5.2 |
| HSI specification | All HW/SW interfaces for safety | ISO 26262-4 §7.5.3 |
| DFA update | All new decomposition claims in TSC | ISO 26262-9 §7 |
| Safety mechanism coverage justification | Each SM covers which fault mode | ISO 26262-4 §7.5.4 |
| FTTI allocation table | FDTI and FRTI budgets per element | ISO 26262-4 §7.5.5 |

### TSC Review Checklist

- [ ] All FSRs are allocated to at least one TSR (no FSR without a TSR)
- [ ] All TSRs are verifiable (measurable pass/fail criterion defined)
- [ ] FTTI budget is consistent: sum of element timing ≤ total FTTI
- [ ] HSI covers all safety-relevant HW/SW interactions
- [ ] Independence claims from FSC are carried through with DFA references
- [ ] ASIL labels on TSRs correctly reflect decomposed ASIL (parenthetical notation)
- [ ] Safety mechanisms are adequately specified (not "shall be monitored" but HOW)
- [ ] Safe state entry paths are fully traceable from fault → detection → transition → SS

---

## Relation of TSC to Part 5 (HW) and Part 6 (SW) Input

The TSC outputs become the entry requirements for hardware and software development:

```
TSC Outputs Feed:

┌─────────────────────────────────────────────────────────────────────┐
│                         TSC Work Products                           │
│  TSRs (HW) ── System Architecture ── HSI Spec ── TSRs (SW)         │
└───┬─────────────────────┬─────────────────────┬────────────────────┘
    │                     │                     │
    ▼                     ▼                     ▼
Part 5: HW Dev       Part 4 Tests          Part 6: SW Dev
────────────────     ─────────────         ──────────────
HW Safety Req        System integration    SW Safety Requirements
HW Design            test cases            (derived from TSRs + HSI)
HW FMEDA             (verify TSRs)         SW Architecture
PMHF calculation                           SW Detailed Design
                                           SW Unit + Integration Tests
```

The FTTI timing constraints in the TSC's FTTI allocation table directly constrain the SW task period (must be ≤ FDTI), the OS worst-case response time analysis (WCRT), and the worst-case execution time (WCET) analysis of safety-relevant tasks.
