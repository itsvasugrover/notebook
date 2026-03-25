---
title: Hardware Development per ISO 26262 Part 5
createTime: 2026/03/25 00:00:00
permalink: /kb/embedded/asil/hw-development/
---

# Hardware Development per ISO 26262 Part 5

## Overview of Part 5

ISO 26262 Part 5 covers the product development of hardware elements within a safety-related item. Its primary purpose is to demonstrate that the hardware can achieve the required ASIL level by:

1. Designing hardware that satisfies the Technical Safety Requirements (TSRs)
2. Identifying hardware failure modes and their safety effects (FMEDA)
3. Computing probabilistic metrics (PMHF, SPFM, LFM) to verify quantitative targets
4. Demonstrating that safety mechanisms achieve sufficient diagnostic coverage

```
Part 5 Structure:
  §5.4   Initiation of hardware development
  §5.5   Specification of hardware safety requirements
  §5.6   Hardware design
  §5.7   Hardware design verification
  §5.8   Evaluation of the hardware architectural metrics
  §5.9   Evaluation of safety goal violations due to random hardware failures
  §5.10  Hardware integration and testing
  §5.11  (Informative annexes: hardware design guidance)
```

---

## Hardware Safety Requirements (Part 5 §5.5)

Hardware safety requirements are derived from the Technical Safety Requirements (TSRs) and HSI specification. They define what hardware elements must achieve.

### HW Safety Requirement Attributes

| Attribute | Description |
|-----------|-------------|
| ID | e.g., HWR-EPS-009 |
| Title | Short description |
| Derived from | TSR ID |
| ASIL | Inherited ASIL (post-decomposition) |
| Element | Specific HW component or sub-system |
| Verification method | Lab test, schematic inspection, simulation, FMEA |

### Categories of HW Safety Requirements

```
1. Functional HW requirements
   Example: "The gate driver IC shall drive all MOSFET gates low within 5 µs 
             of the nFAULT signal being asserted."
   
2. Hardware safety mechanism requirements
   Example: "The system power supply shall include independent undervoltage 
             detection that resets the safety MCU if VCC drops below 4.5V."
   
3. Hardware diagnostic requirements
   Example: "The ADC shall expose a self-test register that returns a known 
             value when the test mode is activated; SW shall test this at startup."
   
4. Hardware failure mode avoidance
   Example: "All safety-critical signals on the PCB shall have ground guard 
             traces minimum 0.5 mm wide on each side to reduce coupling."
   
5. Quantitative requirements
   Example: "The combined hardware architecture shall achieve PMHF ≤ 10 FIT 
             for the safety goal SG-01."
```

---

## Hardware Failure Mode and Effects Analysis (FMEDA)

The **Failure Mode Effects and Diagnostic Analysis (FMEDA)** is the primary hardware quantitative safety analysis tool in ISO 26262. It extends the classical FMEA with diagnostic coverage estimates and failure rate data from component reliability databases.

### FMEDA vs. FMEA

| FMEA | FMEDA |
|------|-------|
| Qualitative | Quantitative — uses actual failure rates (FIT values) |
| Lists failure modes and effects | Adds: failure rate, diagnostic coverage per safety mechanism |
| Does not compute numerical risk | Computes SPFM, LFM, PMHF per architectural element |

### FMEDA Terminology

**FIT (Failures In Time)**: The number of failures per 10⁹ operating hours.  
A component with a failure rate of 100 FIT is expected to fail once in 10⁷ hours = ~1141 years.

**Failure Mode**: The specific way a component can fail. Examples: short circuit, open circuit, stuck-high, stuck-low, stuck-at-mid-supply, parameter drift.

**Safety Effect**: Effect of the failure mode on the safety goal. Classified as:
- **SPF (Single-Point Fault)**: The failure mode alone violates a safety goal (no safety mechanism detects it)
- **Residual Fault**: A fault whose safety mechanism has insufficient coverage to fully detect it
- **Latent Fault**: A failure that remains undetected without safety effect on its own, but could combine with another fault to violate a safety goal
- **Dual-Point Fault**: Requires a combination of two independent failures to violate a safety goal
- No effect: Failure does not affect any safety goal

**Diagnostic Coverage (DC)**: Fraction of a failure mode's failure rate caught by a safety mechanism.

```
DC = λ_detected / λ_total

Where:
  λ_detected = failure rate covered by safety mechanism
  λ_total    = total failure rate for that failure mode

Classification:
  DC ≥ 99%    → High diagnostic coverage
  90% ≤ DC < 99% → Medium diagnostic coverage
  60% ≤ DC < 90% → Low diagnostic coverage
  DC < 60%    → No or negligible coverage
```

### FMEDA Worksheet Example (Partial — Torque Sensor)

| Component | Failure Mode | Failure Rate (FIT) | Effect on SG | Fault Class | Safety Mechanism | DC (%) | λ_SPF | λ_residual | λ_latent |
|-----------|-------------|---------------------|-------------|------------|-----------------|--------|-------|-----------|---------|
| Torque sensor IC | Output stuck high | 8 | SG-01 direct violation | SPF | Diagnostic: SW range check | 97% | 0.24 | 7.76 | 0 |
| Torque sensor IC | Output stuck low | 8 | SG-01 direct violation | SPF | Diagnostic: SW range check | 97% | 0.24 | 7.76 | 0 |
| Torque sensor wiring | Open circuit | 5 | SG-01 — loss of control | SPF | Voltage rail monitor detects open | 90% | 0.50 | 4.50 | 0 |
| ADC input resistor | Short to GND | 2 | Measures zero torque | Latent | SW sensor diagnostic (startup) | 95% | 0 | 0 | 0.10 |
| 5V supply rail | Undervoltage | 3 | Sensor output undefined | SPF | SBC watchdog monitors VCC5 | 99% | 0.03 | 2.97 | 0 |
| Gate driver IC | Phase short to +VDC | 12 | Uncontrolled motor current | SPF | HW overcurrent latch (DRV8301) | 99% | 0.12 | 11.88 | 0 |

---

## Hardware Architectural Metrics

ISO 26262 Part 5 Table 1 and Table 4 define normative targets for three metrics that characterize the hardware architecture's ability to handle failures.

### 1. Single-Point Fault Metric (SPFM)

The SPFM measures how well the hardware architecture avoids single-point faults — failures that directly violate a safety goal without another fault.

$$\text{SPFM} = 1 - \frac{\lambda_{SPF} + \lambda_{residual}}{\lambda_{total\_relevant}}$$

Where:
- $\lambda_{SPF}$: failure rate of undetected single-point faults (no coverage)
- $\lambda_{residual}$: failure rate of partially detected faults (residual after coverage)
- $\lambda_{total\_relevant}$: total failure rate of all hardware elements relevant to the safety goal

**SPFM Targets per ASIL (ISO 26262 Part 5 Table 4)**:

| ASIL | SPFM Target |
|------|-------------|
| ASIL A | ≥ 90% |
| ASIL B | ≥ 97% |
| ASIL C | ≥ 97% |
| ASIL D | ≥ 99% |

### 2. Latent Fault Metric (LFM)

The LFM measures coverage of latent faults — failures that remain undetected over time and that could become the second fault in a dual-point failure combination.

$$\text{LFM} = 1 - \frac{\lambda_{latent\_undetected}}{\lambda_{total\_latent}}$$

A latent fault is acceptable only if it is revealed before another fault can combine with it. The **Multiple Point Fault Detection Interval (MPFDI)** — how long a latent fault can persist before being detected — is defined in the TSC/HSI.

**LFM Targets per ASIL (ISO 26262 Part 5 Table 4)**:

| ASIL | LFM Target |
|------|------------|
| ASIL A | No requirement |
| ASIL B | ≥ 60% |
| ASIL C | ≥ 80% |
| ASIL D | ≥ 90% |

### 3. Probabilistic Metric for Hardware Failures (PMHF)

The PMHF is the probability per hour that hardware failures cause a violation of the safety goal. It is the sum of:

$$\text{PMHF} = \lambda_{SPF} + \lambda_{residual} + \lambda_{latent_{DPF}}$$

Where:
- $\lambda_{SPF}$: residual single-point fault contribution
- $\lambda_{residual}$: residual fraction not caught by DC
- $\lambda_{latent_{DPF}}$: dual-point fault contribution (two latent faults combining)

**PMHF Targets (ISO 26262 Part 5 Table 5)**:

| ASIL | PMHF Target |
|------|-------------|
| ASIL A | < 10⁻⁶ per hour (1000 FIT) |
| ASIL B | < 10⁻⁷ per hour (100 FIT) |
| ASIL C | < 10⁻⁷ per hour (100 FIT) |
| ASIL D | < 10⁻⁸ per hour (10 FIT) |

### PMHF Calculation Example

```
Safety Goal SG-01 ASIL D — Target PMHF ≤ 10 FIT

Hardware Elements in Causal Chain:
  Torque Sensor subsystem:     SPF contribution = 0.24 + 0.24 = 0.48 FIT
  Wiring open circuit:         SPF contribution = 0.50 FIT
  5V supply undervoltage:      SPF contribution = 0.03 FIT
  Gate driver phase short:     SPF contribution = 0.12 FIT
  ADC resistor DPF latent:     DPF contribution = calculate separately
  MCU internal stuck:          SPF contribution = (from MCU datasheet FMEDA) ~1.5 FIT

Total λ_SPF ≈ 2.87 FIT

Latent fault dual-point contribution (simplified):
  λ_latent = 0.10 FIT (ADC resistor)
  MPFDI = 1000 hours (periodic driving mission profile)
  λ_DPF = λ_latent × λ_second_fault × MPFDI ≈ 0.10 × 3 × 10⁻⁶ × 1000 ≈ 3 × 10⁻⁴ FIT (negligible)

Total PMHF ≈ 2.87 + ~0 = 2.87 FIT
Result: 2.87 FIT << 10 FIT target ✓ — ASIL D satisfied
```

---

## HW Fault Tree Analysis (FTA)

FTA is a **top-down** deductive analysis that starts from the safety goal violation and identifies all combinations of hardware failures that could cause it. It complements the bottom-up FMEDA.

```
Fault Tree Example (Partial — SG-01 EPS):

                       SG-01 VIOLATED
                       (Unintended Torque)
                              │
                     ┌────────┴────────┐
                     OR (either path)
                     │                │
            SW Path Failed     HW Backstop Failed
            (Main MCU no      (Gate Driver OC latch
             reaction)          didn't activate)
                │                      │
         ┌──────┴──────┐        ┌──────┴──────┐
         OR (either)   OR       Latch defect  IC power fault
         │             │        (stuck open)  (no VCC5)
  MCU SW stuck   HW OC latch   [FMEDA ref]   [FMEDA ref]
  in fault state  not reached
  [FMEDA ref]    [FMEDA ref]
```

FTA probability:
- Assign failure probability values per leaf node from FMEDA
- Propagate up the tree through AND/OR gates
- Top-level probability must be ≤ PMHF target / FTTI contribution fraction

---

## Dependent Failure Analysis for HW (DFA)

The DFA for hardware (ISO 26262 Part 5 and Part 9) identifies common cause failures (CCF) — hardware failures that invalidate an ASIL decomposition by causing both redundant channels to fail simultaneously.

### Common Cause Failure Initiators for HW

| CCF Initiator | Example | Countermeasures |
|--------------|---------|----------------|
| Shared power supply | Single LDO powers both MCU cores | Separate LDO per channel |
| Thermal stress | Both components in a hot spot on PCB | Thermal spread design; independent thermal sensors |
| Vibration | Board resonance causes both solder joints to crack | Resonance test; conformal coating |
| Cosmic ray (neutron) Single Event Upset | Bit flip in both MCU register files simultaneously | ECC; physically separated dies |
| PCB contamination / corrosion | PCB chemical residue bridges both signal traces | Conformal coat; IPC cleaning standard |
| Manufacturing defect (same die revision) | Same silicon errata affects both channels | Diversity: use different revision or vendor |
| Design error (shared schematic section) | Same design bug in both power supply decoupling networks | Independent design review per channel; diversity |

### Beta Factor Method for CCF Quantification

ISO 26262 uses the **beta factor method** (from IEC 61508) for CCF quantification when required:

```
CCF contribution to PMHF:
  λ_CCF = β × λ_channel

Where:
  β = fraction of channel failure rate attributed to common cause
  β typical values: 0.005–0.20 depending on independence measures
  
  High independence (separate PCB, separate supply, diversity): β ≈ 0.01
  Moderate independence (same PCB, separate supply): β ≈ 0.05–0.10
  Low independence (shared PCB, shared supply): β ≈ 0.10–0.20
```

---

## Hardware Design Guidelines for Safety

### PCB Design Considerations

```
Power supply design for safety:
  1. Separate voltage regulators for safety-critical and non-critical supplies
  2. Independent under/over-voltage monitors per supply rail
  3. Capacitor sizing: bypass caps to prevent transient-induced brownouts
  4. No shared output capacitor between safety-critical and infotainment sections

Signal integrity for safety-critical signals:
  1. Guard traces around high-impedance safety sensor inputs
  2. Differential pairs for long traces (EMC robustness)
  3. Test points on all safety-critical nodes (for production test)
  4. ESD protection on external connector pins (IEC 61000-4 compliance)

Thermal design:
  1. Component placement: safety MCU not co-located with high-power drivers
  2. Thermal simulation at worst-case ambient + self-heating
  3. Temperature monitoring: NTC thermistor on PCB near safety MCU
```

### Component Selection for Safety

```
MCU Selection criteria for ASIL D:
  ├── Lock-step core (dual-core comparator) for ASIL D fault detection
  ├── Internal ECC on Flash and RAM
  ├── Hardware MPU (Cortex-R or Aurix TC3xx TriCore)
  ├── Hardware security module (HSM) — optional but increasingly required
  ├── Functional safety datasheet (FSD) providing FMEDA data
  └── Safety manual from silicon vendor with startup test requirements

Gate Driver Selection criteria for ASIL D:
  ├── Hardware overcurrent protection (nFAULT signal)
  ├── Undervoltage lockout (UVLO) on VCC
  ├── Active Miller clamping (prevents false turn-on of lower MOSFET)
  └── Shoot-through protection (dead-time insertion)
```

---

## Hardware Development Verification

### Hardware Verification Plan

For ASIL C/D, the hardware verification plan must be a documented work product (ISO 26262 Part 5 §5.7). It defines:

| Aspect | Requirement |
|--------|------------|
| Traceability | Each HWR → one or more test cases |
| Coverage | All HWRs must have at least one verification method |
| Methods | Combination of inspection, analysis, simulation, hardware test |
| Pass criteria | Explicit numerical limits for each measure |
| Failure handling | Non-conformance process for test failures |

### Typical HW Verification Test Categories

| Category | Method | Covers |
|----------|--------|--------|
| Functional verification | Bench test with oscilloscope, DMM | TSRs met under nominal conditions |
| Fault injection | Inject fault conditions (short circuit, open circuit, OOV) | Safety mechanism reaction verified |
| FTTI measurement | Inject fault at input; measure time to safe state at output | FTTI ≤ allocated budget |
| ESD / EMC test | Per ISO 11452 / CISPR 25 / ISO 7637 | Emissions and immunity |
| Operating temperature | Thermal chamber test: -40°C to +125°C | Performance within spec over temperature |
| Vibration / shock | Per ISO 16750 | Mechanical robustness of solder joints, connectors |
| HALT/HASS | Accelerated Life Testing | Robustness margin verification |
| Production test | ICT (In-Circuit Test) + functional test | Quality gate for manufacturing |
