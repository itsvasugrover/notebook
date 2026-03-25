---
title: ASIL Decomposition
createTime: 2026/03/25 00:00:00
permalink: /kb/embedded/asil/decomposition/
---

# ASIL Decomposition

## What Is ASIL Decomposition?

ASIL decomposition is the technique of splitting a safety requirement with a given ASIL into two (or more) redundant requirements with lower, combined ASILs — provided that the implementations of those requirements are **sufficiently independent**.

The rationale is that two independent mechanisms with lower individual integrity can together provide the same risk reduction as one highly integrated mechanism. ISO 26262 Part 9 (clause 5.4) defines the normative rules for ASIL decomposition.

**Core principle**: If two elements are independent, a common-cause failure must be excluded. The probability that both fail simultaneously is the product of their individual failure probabilities → the combined mechanism achieves the same ASIL as the original single-element requirement.

---

## Decomposition Notation

ISO 26262 uses the following notation:

```
ASIL D ──────── decomposes to ──────► ASIL B(D) + ASIL B(D)
                                       └─────┘   └─────┘
                                       Part A     Part B
                                       (residual B) (redundant B)

The notation "ASIL B(D)" means:
  - The element carries ASIL B process requirements
  - The original requirement was ASIL D before decomposition
  - Both parts together must satisfy the ASIL D safety goal
```

The parenthetical `(D)` is critical: it records the original ASIL and prevents "ASIL washing" — improperly downgrading requirements.

---

## Valid Decomposition Combinations

ISO 26262 Part 9, Table 4 defines the permitted combinations:

| Original ASIL | Part A | Part B |
|--------------|--------|--------|
| ASIL D | ASIL D | QM — **only if full independence guaranteed** |
| ASIL D | ASIL C | ASIL A |
| ASIL D | ASIL B | ASIL B |
| ASIL C | ASIL C | QM |
| ASIL C | ASIL B | ASIL A |
| ASIL C | ASIL A | ASIL B |
| ASIL B | ASIL B | QM |
| ASIL B | ASIL A | ASIL A |
| ASIL A | ASIL A | QM |

The most commonly applied decompositions in practice:
- **ASIL D → ASIL B(D) + ASIL B(D)**: Two independent ASIL B channels
- **ASIL C → ASIL B(C) + ASIL A(C)**: Common for sensor/actuator monitoring structures
- **ASIL D → ASIL C(D) + ASIL A(D)**: Asymmetric decomposition

---

## Independence Requirements

Decomposition is only valid if the two implementing elements satisfy the **independence criterion** specified in ISO 26262 Part 9 clause 5.4.5.

### Freedom from Interference (FFI)

The two elements must not be able to corrupt each other. Without FFI, a single fault in element A could cause element B to also fail — eliminating the redundancy entirely.

**Software freedom from interference**:
```
Sources of SW interference that must be excluded:
  ├── Shared memory: Element A overwrites Element B's data
  ├── Shared stack: Stack overflow in A corrupts B's stack frame
  ├── Shared execution time: A starves B in the scheduler
  ├── Shared I/O: A's writes to a hardware register corrupt B's peripheral state
  └── Shared OS resources: A's deadlock blocks B's mutex

Mechanisms to achieve FFI in SW:
  ├── Memory Protection Unit (MPU): hardware enforcement of memory region access
  ├── AUTOSAR OS: separate OS applications with MPU-backed partition isolation
  ├── AUTOSAR MultiCore: separate cores running separate partitions
  ├── Hypervisor: Type-1 hypervisor with hardware-backed isolation
  └── Separate ECUs: strongest independence — no shared silicon
```

**Hardware freedom from interference**:
```
Sources of HW interference that must be excluded:
  ├── Shared power supply: single voltage fault kills both channels
  ├── Shared ground: ground bounce causes both channels to malfunction
  ├── Shared clock: crystal fails → both channels stop
  ├── Shared bus: CAN/SPI/I2C fault readable by both channels
  └── Thermal coupling: both components on same PCB area fail together

Mechanisms for HW FFI:
  ├── Separate power supply rails with independent regulators
  ├── Separate PCB layout areas for channel A and channel B
  ├── Separate clock sources
  └── Separate ECU hardware (strongest independence)
```

### Independence vs. Diversity

Independence means freedom from common-cause failure. Diversity means implementing the same function in two different ways to reduce systematic common-cause failures (design defects shared by identical implementations):

| Technique | Type | Addresses |
|-----------|------|-----------|
| Memory partitioning (MPU) | Independence mechanism | Random HW failure interference |
| Separate MCU die | Independence mechanism | Random HW failure coupling |
| Different algorithms for same function | Diversity | Systematic design faults |
| Different compilers | Diversity | Compiler bug as systematic fault |
| Different programming language (C vs. Ada) | Diversity | Language-specific systematic faults |
| Different software supplier for channel B | Diversity + Independence | Systematic faults in SW development process |

---

## Dependent Failure Analysis (DFA)

ISO 26262 Part 9 clause 7 requires a **Dependent Failure Analysis (DFA)** to confirm that independence claims between decomposed elements are valid.

A DFA identifies:
1. **Initiators**: potential sources of dependent failures (shared resources, coupling elements)
2. **Propagation paths**: how the initiator affects both elements
3. **Countermeasures**: existing or planned mechanisms that prevent propagation

### DFA Worksheet Example (Partial)

```
Item: EPS ECU with ASIL D → ASIL B + ASIL B decomposition
      (Main CPU: function channel; Safety Monitor MCU: monitoring channel)

Initiator ID: DFA-03
Initiator:    12V supply rail feeds both Main CPU and Safety MCU
Coupling:     Both processors share VSYS_12V → VCORE_1.25V from same LDO
Propagation:  LDO failure → both processors lose power simultaneously
Effect:       Both channels fail → no monitoring → safety goal SG-01 violated
Countermeasure: Separate LDO per channel; 
                Independent TVS protection per power rail;
                Power-on-reset detection per channel independent
Residual risk: LDO failure in one channel → safe state → no simultaneous failure
DFA verdict:  Independence MAINTAINED with countermeasure implemented
Reference:    Schematic Rev B, Power Section, nodes VCC_MCU1 and VCC_MCU2
```

---

## ASIL Decomposition in Practice

### Common Architectural Patterns

#### 1. Dual-Channel Architecture (Most Common for ASIL D)

```
Input ──────┬──────── Channel A: Main Execution (ASIL B(D))
            │         SW: Control algorithm, setpoint calculation
            │         HW: Main MCU, RAM, Flash
            │                    │
            │                    ▼
            │         Voter / Comparison logic
            │                    ▲
            │                    │
            └──────── Channel B: Safety Monitor (ASIL B(D))
                      SW: Independent plausibility check, range check
                      HW: Safety MCU (e.g., Aurix TC3xx LS "lock-step" core)
                                        ↑
                                Uses different code path, same requirement
```

#### 2. Lock-Step Core (ASIL D without explicit full decomposition)

Modern MCUs like the Infineon Aurix TC3xx and NXP S32K families implement lock-step cores:

```
MCU with Lock-Step Architecture:
  ┌──────────────────────────────────────────────────┐
  │  Core 0 (Master)      Core 0 LS (Comparator)     │
  │  ┌──────────┐         ┌──────────┐               │
  │  │  Execute │◄───────►│  Execute │               │
  │  │  same    │         │  same    │               │
  │  │  code    │         │  code    │               │
  │  └────┬─────┘         └────┬─────┘               │
  │       │                    │                     │
  │       └──────► Compare ◄───┘                     │
  │               (every cycle)                      │
  │               If mismatch → NMI → safe state     │
  └──────────────────────────────────────────────────┘

Lock-step achieves ASIL D single-point-fault detection because:
  - The Hamming Distance between the two instruction streams is maintained
  - Permanent faults (stuck-at, bridging faults) are detected within one clock cycle
  - Transient faults (soft errors from cosmic rays) detected before state is committed
```

Lock-step does NOT decompose the ASIL — it achieves ASIL D on a single core by adding the lock-step comparator, which provides sufficient single-point fault detection coverage for ASIL D PMHF targets.

#### 3. Diverse Redundancy (Highest Independence, ASIL D)

```
System A                        System B
──────────                      ──────────
MCU: Renesas RH850              MCU: Infineon TC3xx
SW: C, developed by Team A      SW: Ada, developed by Team B
Algorithm: PID with LQR         Algorithm: Fuzzy logic with table lookup
Tool: Green Hills MULTI         Tool: TASKING Compiler
        │                               │
        └──────────── Arbiter ──────────┘
                    (vote / crosscheck)
                          │
                          ▼
                    Actuator Output
```

Diverse redundancy maximizes protection against systematic faults (developer-introduced bugs that would appear in both channels if they used the same code).

---

## Co-Existence of Different ASILs on the Same Platform

When ASIL D and QM software run on the same MCU, **freedom from interference** must be proved. This is the co-existence problem:

```
Problem:
  ASIL D safety function in task T_SAFETY
  QM infotainment mirror feature in task T_QM
  Both running on same OS
  
  If T_QM has a buffer overflow:
    → Corrupts T_SAFETY's memory
    → T_SAFETY produces incorrect output
    → ASIL D violation — QM code caused ASIL D failure
```

### Solutions for ASIL / QM Co-Existence

| Solution | Mechanism | ASIL Achieved |
|----------|-----------|---------------|
| Memory Protection Unit (MPU) | Hardware enforces read/write access per task | ASIL B sufficient with MPU |
| AUTOSAR OS with OS applications | Partitioned OS applications with MPU hooks | ASIL D possible |
| Hypervisor | Full VM separation: ASIL VM + QM VM | ASIL D |
| Separate cores (MultiCore MCU) | Different cores → no shared execution | ASIL D |
| Separate physical ECUs | No shared silicon | ASIL D, strongest independence |

### AUTOSAR OS Application Partitioning

```
OS Application "Safety_Partition"       OS Application "QM_Partition"
  ASIL D                                   QM
  ┌─────────────────────────────┐         ┌─────────────────────────────┐
  │ Runnable: TorqueSafetyCheck │         │ Runnable: BluetoothStack    │
  │ Runnable: VehicleSpeedCheck │         │ Runnable: UsbFileSystem     │
  │ TRUSTED (kernel mode)       │         │ NON-TRUSTED (user mode)     │
  └─────────────────────────────┘         └─────────────────────────────┘
          │                                         │
          │ MPU enforces region separation          │
          └────────────────────┬────────────────────┘
                               │
                     OS Kernel (ASIL D)
                     (context switch saves MPU config)
```

If the QM partition violates its memory region, the MPU generates a MemoryFault exception → OS reports to the safety monitor → system enters safe state. The ASIL D partition was never corrupted.

---

## ASIL Decomposition and ASPICE Process Requirements

When ASIL decomposition is applied, both resulting elements carry their individual ASIL process requirements:

```
Original Requirement: SG-01 ASIL D
  ↓ decompose
Element A: FSR-01a ASIL C(D) → SW development must satisfy ASIL C process requirements
Element B: FSR-01b ASIL A(D) → SW development must satisfy ASIL A process requirements

ASIL C process requirements include:
  ├── SW coding guidelines (MISRA C compliant, ASIL C table)
  ├── SW unit testing: branch coverage + MC/DC (ASIL C: recommended/highly recommended)
  ├── SW architectural design: modular, no dynamic memory, no recursion
  └── Review methods: formal technical review for SRS, architecture, detailed design

ASIL A process requirements include (subset of ASIL C):
  ├── SW coding guidelines (MISRA C, ASIL A table)
  ├── SW unit testing: statement coverage
  └── Review: peer review sufficient
```

---

## Common Mistakes in ASIL Decomposition

### Mistake 1: ASIL Washing

ASIL washing occurs when decomposition is applied without genuine independence, resulting in requirements with a lower ASIL label that are in fact not independent.

```
Example of ASIL washing:
  Safety goal SG-01: ASIL D
  Decomposed to:
    Element A: ASIL B(D) — Main function in software module A
    Element B: ASIL B(D) — "Monitoring" in software module B (in the same task, 
                           sharing the same stack, compiled with the same tool, 
                           on the same memory region)
  
  Problem: Module A and Module B share all resources. A fault in A affects B.
  This is NOT a valid decomposition — independence is not achieved.
  Correct label: SG-01 cannot be decomposed this way → must remain ASIL D
```

### Mistake 2: Not Recording the Original ASIL

Writing "SWR-089: ASIL B" when the derivation was from a decomposed "ASIL D" safety goal means the full context is lost. Assessors, safety managers, and auditors cannot verify the decomposition chain without the `(D)` notation.

### Mistake 3: Decomposing Without DFA

Decomposition without DFA means independence is claimed but not verified. The DFA is normatively required by ISO 26262 Part 9. Finding DFA absent is a Major non-conformance in a functional safety audit.

### Mistake 4: Assuming Architectural Diversity Is Sufficient for Random HW Failures

Using two different algorithms in software (diversity) addresses systematic faults. It does **not** address random hardware failures caused by silicon defects. PMHF targets still require quantitative hardware fault metrics (PMHF calculation, FMEDA) regardless of software diversity.
