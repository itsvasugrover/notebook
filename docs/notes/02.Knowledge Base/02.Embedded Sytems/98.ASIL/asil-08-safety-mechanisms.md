---
title: Safety Mechanisms in ISO 26262
createTime: 2026/03/25 00:00:00
permalink: /kb/embedded/asil/safety-mechanisms/
---

# Safety Mechanisms in ISO 26262

## What Is a Safety Mechanism?

A **safety mechanism** is a technical implementation — in hardware, software, or a combination — that detects faults, controls failures, or prevents hazardous events. Safety mechanisms are the concrete means by which ASIL requirements are met.

```
Fault ───[Safety Mechanism]───► Detection ───► Reaction ───► Safe State
         (detect fault before                  (transition to
          safety goal is violated)              safe condition)
```

ISO 26262 assigns a **Diagnostic Coverage (DC)** value to each safety mechanism:
- DC ≥ 99%: High coverage
- 90% ≤ DC < 99%: Medium coverage
- 60% ≤ DC < 90%: Low coverage
- DC < 60%: No coverage

---

## Watchdog Timer

### Purpose
The watchdog timer detects SW execution failures: deadlocks, infinite loops, task overruns, and loss of CPU execution.

### Simple Watchdog vs. Window Watchdog

| Feature | Simple / Timeout Watchdog | Window Watchdog |
|---------|--------------------------|----------------|
| Principle | Triggers reset if NOT triggered within timeout period | Triggers reset if triggered TOO EARLY or TOO LATE |
| Fault detected | SW stall / deadlock | SW stall AND runaway (triggers too fast) |
| ASIL suitability | ASIL B— | ASIL C/D (required for ASIL D in many implementations) |
| Implementation | MCU internal WDT or external WDT IC | External WDT IC (e.g., TI TPS3431) or MCU WWDT peripheral |

```
Window Watchdog Timing Diagram:

      | Forbidden Zone | Open Window |
      |________________|_____________|__________________►  time
      0                T_open        T_timeout
    
  If SW triggers WDT before T_open     → Reset (SW executed too fast: runaway)
  If SW triggers WDT between T_open    → OK (correct execution rate)
   and T_timeout
  If SW triggers WDT after T_timeout   → Reset (SW stalled: deadlock or overrun)
```

### Complex WDT for ASIL D: Question-Answer Watchdog

A simple trigger (toggling a pin) can be faked by stuck-at-high/low faults on the GPIO output. A **question-answer watchdog** prevents this:

```
Q/A Watchdog Protocol:
  1. Watchdog IC sends a pseudo-random challenge value to MCU (via SPI)
  2. MCU computes the expected response using a known algorithm:
       response = f(challenge) = CRC8(challenge ^ SECRET_KEY)
  3. MCU writes response to watchdog IC
  4. Watchdog IC verifies the response
  5. If response is wrong or missing within T_window → Reset

  WHAT THIS DETECTS additionally:
  - SW stuck in wrong code path (wrong algorithm executed → wrong response)
  - Stuck-at fault on SPI bus (constant response value detected)
  - CPU bit-flip causing computation error
```

### Watchdog Integration Patterns in AUTOSAR

```
WdgIf / WdgM (Watchdog Interface / Manager) in AUTOSAR:
  ┌────────────────────────────────────────────────────────────┐
  │                    WdgManager (WdgM)                       │
  │  Supervision of:                                           │
  │    ├── Alive Supervision: task called within time period   │
  │    ├── Deadline Supervision: task completes within budget  │
  │    └── Logical Supervision: program flow check points      │
  │                           │                               │
  └───────────────────────────┼───────────────────────────────┘
                              │
                          WdgIf (abstraction)
                              │
                    ┌─────────┴─────────┐
              Internal WDT         External WDT IC
              (MCU peripheral)     (SBC: TLE9279, SBC FS8x)
```

---

## End-to-End (E2E) Communication Protection

### Why Communication Needs Protection

Automotive networks (CAN, Ethernet, LIN, FlexRay) are subject to:
- Electromagnetic interference → bit flips
- Bus arbitration glitches → message loss or repetition
- ECU software errors → wrong data sent on the bus
- Systematic faults in a gateway ECU → wrong routing

The **AUTOSAR E2E Library** provides a standardized mechanism to detect these faults at the receiving end.

### E2E Fault Detection Capability

| Fault Type | E2E Detection Mechanism |
|-----------|------------------------|
| Bit errors (1–n bits flipped in transit) | CRC covers full data payload |
| Wrong sender (masquerade attack or routing error) | Data ID embedded in CRC calculation |
| Out-of-order messages | Counter (sequence number monotonically incremented) |
| Repeated messages (replay) | Counter mismatch detected |
| Lost messages (dropped) | Counter skips detected |
| Delayed messages (late arrival) | Timeout monitoring in WdgM/E2E status |
| Incorrect message length | CRC calculation over fixed-length payload catches truncation |

### AUTOSAR E2E Profiles

| Profile | CRC Type | Counter Width | Data ID | Typical Use |
|---------|----------|---------------|---------|-------------|
| P01 | CRC-8 (SAE J1850) | 4-bit | 11-bit | CAN, LIN |
| P02 | CRC-8H2F | 4-bit | 15-bit | CAN, SPI |
| P04 | CRC-32P4 | 8-bit | 32-bit | Ethernet, high-integrity |
| P05 | CRC-8 | 4-bit | 8-bit | Simple CAN FD |
| P06 | CRC-16 | 4-bit | 16-bit | Medium-complexity |
| P22 | CRC-8H2F | 4-bit | 16-bit | Modern CAN FD (latest) |

### Diagnostic Coverage of E2E profiles (typical claims in FMEDA)

```
E2E Profile P02 (CRC-8H2F, 4-bit counter, 15-bit Data ID):
  Residual fault probability: < 3.9 × 10⁻³ 
  (1 in 256 corrupt messages undetected by CRC alone)
  
  With counter (sequence number):
  Combined residual: < 1/256 × probability of counter miss = very low
  
  Claimed Diagnostic Coverage in FMEDA: up to 99% for transmission errors
  (actual DC depends on fault model — see AUTOSAR E2E specification)
```

### E2E Implementation Example

```c
/* Sender side (producer ECU) */
void SendTorqueSetpoint(float torque_Nm)
{
    TorqueMsg_t msg = {0};
    msg.torque_q16 = (int16_t)(torque_Nm * 256.0f);  /* Q8.8 fixed-point */
    
    /* AUTOSAR E2E Profile 2 protection */
    E2E_P02Protect(&e2e_config_torque, &e2e_state_tx, 
                   (uint8_t *)&msg, sizeof(msg));
    
    Can_Write(CAN_CH_EPS, MSG_ID_TORQUE_SETPOINT, &msg);
}

/* Receiver side (EPS ECU) */
void ReceiveTorqueSetpoint(const uint8_t *raw_data, uint16_t len)
{
    TorqueMsg_t msg;
    E2E_P02CheckStatusType status;
    
    memcpy(&msg, raw_data, len);
    E2E_P02Check(&e2e_config_torque, &e2e_state_rx, 
                 (uint8_t *)&msg, sizeof(msg), &status);
    
    if (status == E2E_P02STATUS_OK || status == E2E_P02STATUS_SYNC) {
        torque_setpoint_Nm = (float)msg.torque_q16 / 256.0f;
    } else {
        /* E2E fault: wrong CRC, counter skip, etc. */
        DiagMgr_SetFault(FAULT_E2E_TORQUE_SETPOINT);
        SafetyManager_RequestSafeState(SS_02);
    }
}
```

---

## Plausibility Monitoring

Plausibility monitoring detects when a sensor or system output is implausible — outside physical, parametric, or cross-channel limits — even when no obvious signal fault is present.

### Types of Plausibility Monitors

#### 1. Range Check (Single Signal)

```
Range check: sensor value must be within [MIN, MAX] physical range

  if (torque_Nm < TORQUE_SENSOR_MIN || torque_Nm > TORQUE_SENSOR_MAX) {
      /* Sensor is broken (OOV: out of valid range) or shorted */
      DiagMgr_SetFault(FAULT_TORQUE_SENSOR_RANGE);
  }

Diagnostic coverage claim: ~60%  
(detects stuck-high, stuck-low, but not within-range drift)
```

#### 2. Rate-of-Change Check (First Derivative)

```
Physical systems are constrained by inertia and bandwidth.
Signal derivative exceeding physical limits indicates a sensor fault.

  dTorque_dt = (torque_now - torque_prev) / TASK_PERIOD_s;
  if (fabsf(dTorque_dt) > TORQUE_RATE_MAX_Nm_s) {
      /* Signal jump exceeds physics — likely sensor glitch or fault */
      DiagMgr_SetFault(FAULT_TORQUE_SENSOR_RATE);
  }

Diagnostic coverage contribution: ~20–30%
(combined with range check: ~80% total)
```

#### 3. Cross-Channel Comparison

```
Two independent sensors (or channels) measuring the same physical quantity.
If they disagree beyond a threshold → at least one has failed.

  error = fabsf(torque_channel_A - torque_channel_B);
  if (error > TORQUE_CROSS_CHECK_DELTA_MAX) {
      /* Disagreement — either channel A or B is faulty */
      DiagMgr_SetFault(FAULT_TORQUE_CROSS_CHECK);
      /* With 3 sensors (triplex), voter can identify and isolate faulty channel */
  }

Diagnostic coverage claim: up to 99% (cross-check with diverse sensors)
```

#### 4. Model-Based Monitoring (Physical Model)

```
An internal model of the physical system predicts the expected output 
given the commanded input. Deviation from prediction indicates a fault.

  expected_torque = vehicle_model_predict(steering_angle, vehicle_speed);
  model_error = fabsf(measured_torque - expected_torque);
  
  if (model_error > TORQUE_MODEL_TOLERANCE) {
      DiagMgr_SetFault(FAULT_TORQUE_MODEL_MISMATCH);
  }

Used for ASIL C/D as an independent plausibility channel.
```

---

## Memory Protection

### RAM ECC (Error Correcting Code)

ECC is a hardware mechanism that detects and corrects bit errors in memory caused by:
- Cosmic ray single-event upsets (SEU)
- Alpha particle emission from IC packaging
- Electromagnetic interference inducing bit flips

```
ECC for SRAM (typical Hamming / SECDED code):
  SEC-DED = Single Error Correct, Double Error Detect

  Protection mechanism:
    Write path: ECC encoder adds check bits to each data word
    Read path:  ECC decoder checks and corrects single-bit errors
                             reports but cannot correct double-bit errors

  MCU register configuration:
    ECC_CTRL_REG = ECC_ENABLE | ECC_ERROR_INJECT_DISABLE;
    
  Error reporting:
    Single-bit error → NMI or correctable interrupt → log fault, continue
    Double-bit error → Hard fault / NMI → immediate safe state

  Startup test:
    MCU startup diagonal test: inject known single-bit error,
    verify ECC corrects it. Fail to correct → SW fails startup self-test.
```

### Flash Memory CRC / Hash Verification

```
Flash CRC verification at startup:
  1. Pre-calculated CRC over all Flash code and calibration regions
     (computed and stored at end of Flash image by linker/programmer tool)
  
  2. At ECU startup, SW recalculates CRC over Flash content
  
  3. If recalculated CRC ≠ stored CRC:
     → Flash image corrupted (programming defect, cosmic ray, aging)
     → ECU reports fault, does not proceed to normal operation

  CRC algorithm: CRC-32 (IEEE 802.3) or CRC-16-CCITT
  Diagnostic coverage: high (~99.9997%) for random bit errors in Flash

Background monitoring (periodic):
  Flash CRC also recalculated in background task during runtime
  (not just at startup) to detect Flash degradation during vehicle life
```

### Memory Protection Unit (MPU) for Safety Partitioning

```
MPU Region Configuration (ARM Cortex-M/R example):

Region 0: Background region — default, no-access (trap all unassigned accesses)
Region 1: Flash code (all tasks): Execute | Read | No-Write (code is read-only)
Region 2: Safety task RAM (ASIL C/D): Read-Write for kernel mode, Read-only for QM mode
Region 3: QM task RAM: Read-Write for QM mode only
Region 4: Shared data (IPC): Read-Write for both partitions (explicitly allowed)
Region 5: Peripheral registers (safety peripherals): Privileged access only
Region 6: Peripheral registers (non-safety): Unprivileged access allowed

MPU context switch:
  AUTOSAR OS saves/restores MPU config on each task switch.
  OS protection hook called on any MPU violation:
  void Os_ProtectionHook(StatusType FatalError) {
      DiagMgr_SetFault(FAULT_MPU_VIOLATION);
      SafetyManager_RequestSafeState(SS_01);
  }
```

### Stack Guard Region

```
Stack overflow protection using MPU guard regions:

Task stack layout (growing downward in memory):
  ┌──────────────────────────────┐ ← Stack top (initial SP)
  │       Task Stack Area        │
  │  (allocated in linker script) │
  │                              │
  │  .... (stack grows downward) │
  │                              │
  ├──────────────────────────────┤ ← Stack guard region start
  │  GUARD REGION (32 bytes)     │ ← MPU region: NO-ACCESS
  ├──────────────────────────────┤ ← Stack bottom (maximum depth)
  │       Other Task Stack       │

If task overflows into guard region:
    → MemFault exception raised immediately
    → ProtectionHook called before stack corruption propagates to next task
```

---

## CPU Monitoring: Lock-Step and Control Flow Integrity

### Lock-Step Processor

Described in detail in asil-03-asil-decomposition.md. In summary:
- Two CPU cores execute the same instruction stream with 1–2 cycle offset
- A comparator checks the output of each instruction
- Any mismatch (stuck-at fault, bit flip in CPU pipeline) → NMI → safe state
- Diagnostic coverage: **>99%** for permanent faults; **>90%** for transient faults

### Control Flow Monitoring (CFM)

Control flow monitoring detects SW execution that deviates from the intended control flow — e.g., a fault that causes the program counter to jump to an invalid address.

```
Software CFM using program flow signatures (ASIL C/D):

Concept:
  1. At each checkpoint in the code, XOR the current flow signature 
     with a known constant
  2. At the end of a function, verify the running signature matches 
     the expected end value
  3. Mismatch → control flow was deviated (missed a branch, jumped to wrong code)

Example:
  void SafetyTask(void) {
      volatile uint32_t sig = 0;

      sig ^= 0xAAAAAAAA;  /* Checkpoint A */
      Check_TorqueDeviation();
      
      sig ^= 0x12345678;  /* Checkpoint B */
      Check_SensorRange();
      
      sig ^= 0xDEADBEEF;  /* Checkpoint C */
      Check_E2EStatus();

      /* Expected end signature: 0xAAAAAAAA ^ 0x12345678 ^ 0xDEADBEEF */
      if (sig != EXPECTED_SAFETY_TASK_SIG) {
          SafetyManager_RequestSafeState(SS_01);
      }
  }
```

---

## CAN / LIN Bus Error Detection

CAN frames have built-in error detection mechanisms. Understanding their DC is required for FMEDA analysis:

### CAN Built-in Error Detection

| Mechanism | Type | Coverage |
|-----------|------|---------|
| CRC field (15-bit CRC) | Detects random bit errors | Hamming Distance HD=6; undetected: < 5 × 10⁻⁵ per message |
| Bit stuffing (max 5 consecutive same bits) | Detects synchronization errors | — |
| Form check (end-of-frame check) | Detects frame structure errors | — |
| ACK check | Detects bus write fault (no receiver acknowledges) | — |
| Error-active/passive/bus-off state machine | Limits effect of faulty transmitter | — |

**CAN alone is NOT sufficient for ASIL C/D**: CAN's HD=6 CRC covers only random bit errors, not:
- Data substitution (wrong data from same ECU)
- Delayed messages
- Sequence errors
- Wrong sender (no message authentication in CAN)

This is why AUTOSAR E2E protection is required in addition to CAN's built-in error detection for safety-relevant data.

---

## Redundant Sensor Reading and Voter Logic

For ASIL D systems where sensor failure is a significant contributor to PMHF, redundant sensors with voting logic provide both increased diagnostic coverage and fault tolerance.

### Voter Architectures

```
1+1 (Dual): No voting — disagreement detected, system enters safe state
  Channel A ──┐
              Compare ──► Error detected → Safe state
  Channel B ──┘

  Advantage: Simple, low cost
  Disadvantage: Cannot identify which channel is wrong

2+1 (Triplex with voter): Voter selects 2-of-3 majority
  Channel A ──┐
  Channel B ──┼── Voter (select majority) ──► System output
  Channel C ──┘
  
  If Channel A = 5 Nm, B = 5 Nm, C = 0 Nm (C failed):
    Voter result = 5 Nm (A and B agree)
    Voter reports: C is the outlier → isolate C, continue operation
  
  Advantage: Fault tolerant — continues operation after single fault
  Used for ASIL D systems where availability is also required (e.g., braking)

2+2 (Quad): Two pairs cross-check each other
  Pair 1 (A+A'): internal compare
  Pair 2 (B+B'): internal compare
  Pair 1 vs Pair 2: cross compare
  
  Used in highest-integrity aerospace; rare in automotive
```

### ASIL D Example: Redundant Steering Angle Sensors

```
Physical configuration:
  SAS-A: Steering angle sensor, SPI channel A → Main MCU (ASIL D channel)
  SAS-B: Steering angle sensor, SPI channel B → Safety MCU (ASIL D channel)
  
  Both sensors read the same physical angle but via independent signal paths.
  
  Cross-check in Safety MCU:
    error = |SAS_A_deg - SAS_B_deg|
    if (error > STEERING_ANGLE_COMPARE_DEG) {
        DiagMgr_SetFault(FAULT_SAS_CROSS_CHECK);
        SafetyManager_RequestSafeState(SS_01);
    }
  
  FMEDA DC claim for SAS cross-check: 99%
  (Covers stuck-high, stuck-low, drift, open circuit per sensor)
```

---

## Safety Mechanism Coverage Summary

The following table summarizes typical DC claims used in automotive FMEDA:

| Safety Mechanism | Fault Mode Covered | Typical DC |
|-----------------|-------------------|----------|
| Watchdog (simple) | SW deadlock / stall | 90% |
| Window watchdog | SW deadlock + runaway | 97–99% |
| Q/A watchdog | SW deadlock + wrong execution path | >99% |
| E2E CRC (Profile P02) | Communication bit error, wrong data | 97–99% |
| E2E counter | Message loss, repetition, sequence | 95–99% |
| Signal range check | Sensor stuck-high, stuck-low | 60–80% |
| Signal rate-of-change | Sensor step fault | 20–30% |
| Cross-channel comparison | Single-channel failure (either channel) | 90–99% |
| ADC self-test | ADC internal error | 90–95% |
| RAM ECC (SECDED) | Single-bit RAM flip | 97–99% |
| Flash CRC startup test | Flash data corruption | >99% |
| MCU lock-step | Permanent CPU faults | >99% |
| MCU lock-step | Transient CPU faults | >90% |
| MPU access violation | SW memory corruption | 90–97% |
| HW overcurrent latch | Motor phase short | 97–99% |
| Stack overflow guard (MPU) | Stack overflow → memory corruption | 95% |
| CPU CFM signatures | Control flow deviation | 90–95% |
