---
title: Software Development per ISO 26262 Part 6
createTime: 2026/03/25 00:00:00
permalink: /kb/embedded/asil/sw-development/
---

# Software Development per ISO 26262 Part 6

## Overview of Part 6

ISO 26262 Part 6 covers the complete software product development lifecycle for safety-related automotive software. It defines requirements from software safety requirements down to unit testing, and specifies method selection tables that prescribe which techniques are mandatory or recommended based on the ASIL of the software element.

```
Part 6 Structure:
  §6.5  Software safety requirements
  §6.6  Software safety: architectural design
           (includes specification of SW architectural design)
  §6.7  Software unit design (detailed design)
  §6.8  Software unit implementation (coding)
  §6.9  Software unit testing (unit test)
  §6.10 Software integration and testing (integration test)
  §6.11 Verification of the embedded software
  §6.12 (Informative: application to software components)
```

---

## Software Safety Requirements (Part 6 §6.5)

SW safety requirements are derived from the Technical Safety Requirements (TSRs) and the Hardware-Software Interface (HSI) specification. They are the entry requirement for all subsequent SW development activities.

### SW Safety Requirement Attributes

| Attribute | Description |
|-----------|-------------|
| ID | Unique identifier (e.g., SWR-042) |
| Title | Short description |
| Derived from | TSR ID (full traceability chain: SG → FSR → TSR → SWR) |
| ASIL | Assigned ASIL (possibly post-decomposition) |
| Rationale | Why this requirement is needed for safety |
| Verification | Method and metric (branch coverage, MC/DC, review) |

### SWR Example

```
SWR-042
Title: Torque Deviation Detection — Threshold Check
Derived from: TSR-EPS-017 (FSR-01-A, SG-01 ASIL D → ASIL C(D))
ASIL: ASIL C(D)

Requirement:
  The function TorqMon_CheckDeviation() shall return 
  TORQMON_FAULT_DETECTED when |setpoint_Nm - measured_Nm| > 
  PARAM_TRQ_DELTA_MAX for N_CONSEC_FAULT_MAX consecutive calls.
  
  In all other conditions it shall return TORQMON_OK.
  
  There shall be no path through TorqMon_CheckDeviation() that 
  modifies any variable outside its explicitly defined output 
  (no side effects).
  
Verification: MCoverage (MC/DC) unit test; IDs: UT-TM-001 through UT-TM-023
```

---

## Software Architecture Design (Part 6 §6.6)

The SW architecture defines the decomposition of the software into modules, the interfaces between them, and the runtime configuration (tasks, priorities, memory regions).

### Mandatory Properties of ASIL SW Architecture

| Property | Description | Normative ASIL |
|----------|-------------|----------------|
| Modularity | Well-defined interfaces; minimal coupling between modules | All ASIL |
| Encapsulation | Internal state hidden; only public APIs access module data | All ASIL |
| No dynamic memory in runtime (heap) | `malloc()`/`free()` in safety SW is forbidden in runtime paths | ASIL B+ |
| No dynamic object creation | No late binding, no plugin loading at runtime | ASIL C/D |
| Limited use of recursion | Recursion makes stack depth analysis intractable | ASIL B+ |
| Defined data flow | Data flow through explicit interfaces, not global shared variables | ASIL A+ |
| Control flow analysis possible | No `goto`, limited function pointers in safety SW | ASIL B+ |
| Worst-case stack sizeable | Call depth is bounded; stack is statically allocated | ASIL A+ |

### Architecture Notations and Views

Architectural design must cover:

1. **Module decomposition**: component diagram showing modules and interfaces
2. **Call graph**: which module calls which, identifying recursive paths
3. **Data flow**: which modules read/write which global data
4. **Task assignment**: which modules execute in which OS tasks
5. **Memory region assignment**: which AUTOSAR OS Application or MPU region each module belongs to

```
Example Module Architecture (EPS SW, simplified):

┌──────────────────────────────────────────────────┐
│  OS Application "Safety_Partition" (ASIL C/D)    │
│  ┌───────────────┐  ┌──────────────────────────┐ │
│  │TorqMon.c      │  │SafetyManager.c           │ │
│  │ ASIL C(D)     │  │ ASIL D                   │ │
│  │               │  │                          │ │
│  │ Inputs:       │  │ Inputs:                  │ │
│  │  setpoint_Nm  │  │  fault requests from all │ │
│  │  measured_Nm  │  │  modules                 │ │
│  │               │  │                          │ │
│  │ Output:       │  │ Output:                  │ │
│  │  fault_flag   │──│  safe_state_request      │ │
│  └───────────────┘  └─────────────┬────────────┘ │
└───────────────────────────────────┼──────────────┘
                                    │
           OS Application Boundary  │  (MPU enforced)
                                    │
┌───────────────────────────────────┼──────────────┐
│  OS Application "Control_Partition" (ASIL A/B)   │
│  ┌───────────────┐                │              │
│  │TorqCtrl.c     │                │              │
│  │ ASIL A        │                │              │
│  │ setpoint gen  │                │              │
│  └───────────────┘                │              │
└───────────────────────────────────┼──────────────┘
                                    ▼
                           AUTOSAR OS Kernel (ASIL D)
                                    │
                                    ▼
                           Hardware Abstraction (BSW)
```

### Spatial Separation (Freedom from Interference)

ISO 26262 Part 6 §6.6 normatively requires that **spatial freedom from interference** be demonstrated when software elements of different ASIL (or QM) coexist on the same processor:

```
Mechanisms satisfying spatial FFI:

1. Memory Protection Unit (MPU):
   Configures read/write execute permissions per address range 
   for each task/OS application.
   MPU supported MCUs: Cortex-M4/M7/M33, ARM Cortex-R, Aurix TC3xx
   
2. AUTOSAR OS Trusted/Non-Trusted:
   Trusted (kernel mode): can access any memory
   Non-Trusted (user mode): constrained to MPU-assigned region
   Non-Trusted violation → OS Application error hook → SafetyManager

3. Hypervisor:
   Full VM-level isolation; MMU configured by hypervisor
   Guest VM cannot access another VM's physical memory
```

### Temporal Separation

Temporal FFI ensures that a runaway task in the QM/lower ASIL partition cannot starve the ASIL D safety task:

```
Mechanisms:
  1. Time-partitioned OS scheduling (AUTOSAR OS Category 2 ISR)
  2. Execution time monitoring: each task has a Worst-Case Execution Time (WCET) budget;
     overrun triggers OS protection hook
  3. Rate monotonic scheduling with WCRT analysis: verify that safety task 
     always meets its deadline even under full CPU load from QM tasks
  4. Interrupt priority: safety ISRs assigned higher priority than QM tasks
```

---

## Software Unit Design (Detailed Design, Part 6 §6.7)

Detailed design specifies the behavior of each software unit (typically a function or group of tightly coupled functions) to the level of pseudocode or design notation sufficient for unambiguous coding.

### Required Properties of Detailed Design

| Property | Recommended for ASIL | Reason |
|----------|---------------------|--------|
| No multiple function exit points | ASIL B, C, D | Simplifies branch coverage analysis |
| One return per function | ASIL C, D | Avoids unintended early returns masking faults |
| No dead code | All ASIL | Dead code cannot be tested → uncertainty |
| Initialized variables at declaration | All ASIL | Prevents undefined behavior from uninitialized reads |
| No implicit type conversion | ASIL B+ | MISRA enforcement prevents signed/unsigned bugs |
| Bounded loops (no `while(true)` without exit condition) | ASIL A+ | Enables worst-case execution time analysis |

### Defensive Programming Patterns (ASIL B+)

```c
/* GOOD: Defensive range check before use */
static SensorStatus_t ReadTorqueSensor(float *out_torque_Nm)
{
    float raw = ADC_Read(ADC_CHANNEL_TORQUE);
    
    if ((raw < TORQUE_SENSOR_MIN_V) || (raw > TORQUE_SENSOR_MAX_V)) {
        DiagMgr_SetFault(FAULT_TORQUE_SENSOR_RANGE);
        return SENSOR_FAULT;
    }
    
    *out_torque_Nm = (raw - TORQUE_SENSOR_OFFSET) * TORQUE_SENSOR_GAIN;
    return SENSOR_OK;
}

/* BAD: Implicit trust of sensor value */
static float ReadTorqueSensor_Bad(void)
{
    return (ADC_Read(ADC_CHANNEL_TORQUE) - 1.65f) * 4.0f;
    /* No range check; no fault reporting; caller blindly trusts value */
}
```

---

## Software Unit Implementation — Coding Guidelines (Part 6 §6.8)

### MISRA C:2012 and ISO 26262

ISO 26262 Part 6 Table 6 lists coding guidelines as methods. MISRA C:2012 is the most widely adopted guideline for automotive embedded C software.

MISRA C:2012 has three rule categories:
- **Mandatory**: Violation is non-conformance; no deviation allowed
- **Required**: Violation requires a documented deviation with justification
- **Advisory**: Follow unless there is a strong justified reason to deviate

#### ASIL Recommendation Level for Coding Guidelines

| Method | QM | ASIL A | ASIL B | ASIL C | ASIL D |
|--------|----|----|----|----|-----|
| Use of language subsets (MISRA C) | ○ | + | + | ++ | ++ |
| Enforcement of coding guidelines by static analysis tool | ○ | ○ | + | ++ | ++ |
| No uninitialized variables | ○ | + | + | ++ | ++ |
| No dynamic memory allocation in runtime | ○ | ○ | + | ++ | ++ |
| No recursion | ○ | ○ | + | ++ | ++ |
| Use of strongly typed interfaces | ○ | + | + | ++ | ++ |

*(++ = highly recommended, + = recommended, ○ = no recommendation)*

### MISRA C:2012 Rules Most Critical for Safety

| Rule | Category | Description |
|------|----------|-------------|
| Rule 1.3 | Mandatory | There shall be no occurrence of undefined or critical unspecified behaviour |
| Rule 10.1–10.8 | Required | Essential type model: operands and conversions |
| Rule 11.8 | Required | A cast shall not remove any const or volatile qualification |
| Rule 13.2 | Required | The value of an expression and its persistent side effects shall be the same under all permitted evaluation orders |
| Rule 14.3 | Required | Controlling expressions shall not be invariant |
| Rule 15.1 | Advisory | The goto statement should not be used |
| Rule 15.2 | Required | The goto statement shall jump to a label declared later in the same function |
| Rule 17.1 | Mandatory | Functions with variable number of arguments (`...`) shall not be used |
| Rule 17.4 | Mandatory | All exit paths from a function with non-void return type shall have an explicit return statement |
| Rule 18.3 | Mandatory | Relational operators shall not be applied to objects of pointer type |
| Rule 21.3 | Required | Dynamic memory `malloc`/`calloc`/`realloc`/`free` shall not be used |
| Rule 22.1 | Required | All resources that are dynamically acquired shall be explicitly released |

### Stack Analysis

For ASIL C and D, the maximum stack usage of every task must be formally analyzed:

```
Stack Analysis Methods:
  1. Static call tree analysis: 
     Tool traverses the call graph, sums stack frames per function, reports worst-case depth
     Tools: Polyspace Code Prover, LDRA, IAR C-SPY linker analysis
  
  2. Run-time measurement with paint/canary:
     Pre-fill stack with pattern (0xDEAD_BEEF per word)
     Run worst-case scenarios
     Check how many words were overwritten
     
  3. Stack Guard with MPU:
     Place a no-access MPU region at the bottom of each task stack
     If stack overflow occurs → MemFault → safety reaction
     
  Stack Size Requirement:
     Configured stack = max measured / analyzed stack depth + margin
     Typical margin: 20% above worst-case depth
     Total must fit in static RAM allocation defined in linker script
```

---

## Software Unit Testing (Part 6 §6.9)

Unit testing in ISO 26262 has normative coverage criteria that depend on the ASIL of the unit under test.

### Coverage Criteria per ASIL

| Coverage Criterion | QM | ASIL A | ASIL B | ASIL C | ASIL D |
|--------------------|----|--------|--------|--------|--------|
| Statement Coverage (SC) | ○ | + | ++ | ++ | ++ |
| Branch Coverage (BC) | ○ | ○ | + | ++ | ++ |
| MC/DC Coverage | ○ | ○ | ○ | + | ++ |

*(++ = highly recommended, + = recommended, ○ = no recommendation)*

### Coverage Criterion Definitions

```
Statement Coverage (SC):
  Every executable statement executed at least once.
  SC = (Executed statements / Total statements) × 100%
  Target: 100% for ASIL A/B/C/D

Branch Coverage (BC):  
  Every branch (if-true, if-false, switch-case, loop entered, loop skipped)
  executed at least once in the test suite.
  BC = (Executed branches / Total branches) × 100%
  100% BC implies 100% SC, but not vice versa.

MC/DC (Modified Condition/Decision Coverage):
  For each Boolean expression (Decision):
    1. Each condition within the decision must independently affect the outcome.
    2. Each condition must be exercised as TRUE and FALSE.
    3. Each possible outcome of the decision must occur at least once.
  
  MC/DC is required for ASIL D (++ = highly recommended) meaning that
  for ASIL D software, every Boolean condition is independently tested.

Example of MC/DC test for:
  if ((A && B) || C)

  Test case | A | B | C | Result | Purpose
  ----------|---|---|---|--------|--------------------
  TC1       | T | T | F | T      | A+B together make TRUE, C off
  TC2       | F | T | F | F      | A independently changes result T→F
  TC3       | T | F | F | F      | B independently changes result T→F
  TC4       | T | T | T | T      | C TRUE forces TRUE (verify C irrelevant when A+B true changes: need C alone)
  TC5       | F | F | T | T      | C independently changes result F→T

  Minimum MC/DC set for this expression: {TC1, TC2, TC3, TC5} (4 test cases)
```

### Unit Test Framework Considerations

```
For ASIL C/D SW unit testing:

Requirements for test environment:
  1. Test tool qualification: The unit test tool (e.g., GoogleTest, LDRA TBrun, 
     Cantata++) must be qualified at TCL-2 or TCL-3 (see asil-10-tools).
  
  2. Test case to SWR traceability: Each test case must reference the SWR it verifies.
  
  3. Test case independence: Test cases must not share state 
     (each test sets up and tears down its own context).
  
  4. Coverage measurement: Coverage tool must be qualified (TCL-2/3) 
     and its instrumentation must not alter the behavior under test.
  
  5. Negative testing: Test cases must include boundary value analysis (BVA), 
     equivalence partitioning, and robustness tests (out-of-range inputs).
```

---

## Software Integration and Testing (Part 6 §6.10)

Integration testing verifies that software modules work correctly together. It occurs after unit testing and before SW qualification/acceptance testing.

### Integration Levels

```
Level 1: Module integration
  - Integrate 2–5 related modules
  - Verify inter-module interfaces and data exchange
  - Test pass criteria: output values correct per interface contract

Level 2: SW stack integration (AUTOSAR example)
  - Integrate all BSW layers with RTE and application SW
  - Verify AUTOSAR port connections
  - Verify global calibration parameter initialization
  
Level 3: SW + HW integration (SIL → HIL)
  - Flash SW onto target ECU
  - Connect ECU to Hardware-in-the-Loop (HiL) rig
  - Inject system-level stimuli
  - Verify safety reactions match TSR specifications
```

### Integration Test Coverage for Safety Requirements

For safety-related integration, the following must be tested:

| Test Category | What to Test |
|--------------|-------------|
| Normal operation | Safety monitors inactive during nominal signal range |
| Single fault injection | One fault type at a time; verify detection and safe state entry |
| Recovery from safe state | After fault removal, verify system returns to operation correctly |
| FTTI compliance test | Inject fault, measure time from fault to safe state entry vs. FTTI |
| Out-of-range injection | Each safety-relevant sensor → inject out-of-range; verify DTC set + reaction |
| Communication fault | Inject CAN timeout, bit error; verify E2E fault detection |
| Timing fault | Slow down message period; verify E2E counter fault detected |

---

## Software Qualification Testing (Verification of Embedded SW)

Part 6 §6.11 (Verification) requires that all SW safety requirements are verified by test at the ECU level:

```
ECU-level SW verification test plan requirements:
  1. Derive test cases from each SWR (one-to-one mapping required for ASIL C/D)
  2. Test environment: 
       ├── HIL (Hardware-in-the-Loop) preferred for embedded SW on target
       ├── SIL (Software-in-the-Loop) valid for algorithm-level verification
       └── Simulation model must be validated against physical measurements
  3. Test execution and logging: 
       ├── Automated test tools (CAPL scripts on CANoe, Python + PCAN)
       └── Test results recorded in test management tool (Doors, Jira)
  4. Regression baseline: After any SW change, full regression must re-execute ASIL tests
  5. Non-conformance handling: Failed tests → Problem Report → Root Cause Analysis → 
     SW change → Re-test (same or more extensive)
```

---

## Freedom from Interference (FFI) in SW — Complete Treatment

ISO 26262 Part 6 §6.6 and Part 9 §6 together require that freedom from interference be demonstrated for all ASIL decomposition pairs and for ASIL/QM co-existence.

### FFI Evidence Package (for ASIL D project)

```
Required evidence for spatial + temporal FFI:

1. MPU configuration document
   - Lists each MPU region, address range, access permissions
   - Version-controlled; matches as-built firmware configuration
   
2. MPU test evidence
   - Test injects memory access violation (write to protected region)
   - Test verifies MemFault exception is raised and logged
   - Test verifies protected region is not corrupted
   
3. OS task timing analysis
   - WCET measured or verified for each ASIL task
   - WCRT analysis: response time analysis for all tasks
   - Result: no safety task misses its deadline under any scenario
   
4. Stack overflow test
   - Stack canary integrity verified at end of each test run
   - No stack corruption detected in ASIL task stacks
   
5. Fault injection of QM faults into ASIL partition
   - Inject buffer overflow in QM module
   - Verify ASIL module output is unchanged
   - Verify MPU fault is reported to safety monitor
   - Verify system enters safe state (if configured)
```

---

## Summary: SW Development Method Table (ISO 26262 Part 6 Table 1–8, Condensed)

| SW Activity | Key Method | ASIL A | ASIL B | ASIL C | ASIL D |
|-------------|-----------|--------|--------|--------|--------|
| SW Architecture | Module decomposition | + | ++ | ++ | ++ |
| SW Architecture | No dynamic memory | ○ | + | ++ | ++ |
| SW Architecture | Formal description | ○ | ○ | + | ++ |
| Detailed Design | Pseudocode / design description | + | + | ++ | ++ |
| Coding | MISRA C enforcement | + | + | ++ | ++ |
| Coding | No recursion | ○ | + | ++ | ++ |
| Coding | Static analysis (MISRA checker, Polyspace) | ○ | + | ++ | ++ |
| Unit Test | Statement Coverage 100% | + | ++ | ++ | ++ |
| Unit Test | Branch Coverage 100% | ○ | + | ++ | ++ |
| Unit Test | MC/DC Coverage | ○ | ○ | + | ++ |
| Integration Test | Interface test | + | + | ++ | ++ |
| Verification | FTTI compliance test | + | + | ++ | ++ |
| FFI | MPU spatial separation | ○ | + | ++ | ++ |
| FFI | Timing analysis (WCRT) | ○ | + | ++ | ++ |

*(++ = highly recommended, + = recommended, ○ = no recommendation per ISO 26262)*
