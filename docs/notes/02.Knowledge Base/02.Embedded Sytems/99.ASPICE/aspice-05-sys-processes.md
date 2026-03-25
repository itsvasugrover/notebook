---
title: System Engineering (SYS) Processes
createTime: 2026/03/25 00:00:00
permalink: /kb/embedded/aspice/sys-processes/
---

# Automotive SPICE — System Engineering (SYS) Processes

## SYS Process Group Overview

System Engineering processes define how an automotive ECU or vehicle function is specified and verified at the system level — before the software and hardware development processes (SWE, HWE) begin. The SYS process group forms its own V-model:

```
SYS.1 Requirements Elicitation ──────────────────────────────►
                                                              │
SYS.2 System Requirements Analysis ◄──────────────────────── SYS.5 System Qualification Test
                   │                                               ▲
                   ▼                                               │
SYS.3 System Architectural Design ◄────────────────────────► SYS.4 System Integration Test
```

The SYS processes sit above the SWE processes in the overall development hierarchy:

```
Customer / OEM Requirements (SYS.1)
       │
       ▼
System Requirements (SYS.2) ──────────────────────────────────► SYS.5
       │
       ▼
System Architecture: SW + HW allocation (SYS.3) ──────────────► SYS.4
       │                   │
       ▼                   ▼
SW Requirements (SWE.1)  HW Requirements (HWE.1)
```

---

## SYS.1 — Requirements Elicitation

### Purpose

To gather, process, and track evolving customer needs and requirements throughout the life of the project, so that the supplier develops a product that meets customer expectations.

### Process Outcomes

1. Continuing communication with the customer is established.
2. Agreed customer requirements (and other agreed requirements sources) are defined and updated as needed.
3. A mechanism for managing evolving customer requirements is established.
4. Customer requirements are uniquely identified and documented.

### Base Practices

**SYS.1.BP1: Obtain customer requirements and requests for change**
Establish and maintain structured communication channels with the customer (OEM, system integrator). This includes requirement workshops, change request forms, email trails with status tracking, or dedicated requirement management tool access. All customer inputs are captured and assigned an ID.

**SYS.1.BP2: Understand customer expectations**
Go beyond what customers write to understand the intent. Ambiguous, conflicting, or missing requirements must be resolved with the customer. Record clarification discussions and agreed interpretations. Use mockups, use cases, or operational scenarios to validate understanding.

**SYS.1.BP3: Agree on requirements with customers**
Obtain formal sign-off from the customer representative. A requirement that has not been agreed upon cannot be treated as a baseline. Agreements may be documented in a Technical Specification, Statement of Work, or Change Note with signatures.

**SYS.1.BP4: Establish change mechanism**
Define how the customer submits changes (change request form, ECR/PCR in PLM tool). Track change request status. Assess impact of each change on cost, schedule, safety, and design decisions before accepting it.

### Work Products Produced

| WP ID | Work Product | Key Content |
|-------|-------------|-------------|
| 08-51 | Customer Requirements Specification | All agreed customer requirements with IDs and acceptance criteria |
| 08-50 | Change Request | Individual customer change requests with impact assessment |

### Typical Customer Requirement Sources in Automotive

```
OEM-Specific Documents:
  Technical Specification (TS) / Component Requirement Specification (CRS)
  Interface Control Document (ICD) — CAN DBC, Ethernet ARXML
  Functional Safety Concept (aligned to ISO 26262 Part 3)
  Cybersecurity Goal Document (ISO/SAE 21434)
  Environmental specs: vibration profile, temperature range, EMC requirements
  AUTOSAR BSW configuration specifications

Industry Standards (referenced in OEM documents):
  LV 124 / LV 148 / LV 214 — OEM-specific component tests (BMW/VW/PSA)
  ISO 16750 — General environmental conditions
  CISPR 25 — Vehicle radio disturbance
  ISO 7637 — Electrical transients
  ISO 11898 — CAN bus standard
```

### Common Weaknesses Found in Assessments

- Customer requirements stored in email threads or meeting minutes without formal IDs
- No change mechanism — changes accepted verbally, not logged
- Requirements captured in German/English mixed documents; no translation or alignment process
- Customer clarifications not documented — leads to "we had a different understanding" disputes

---

## SYS.2 — System Requirements Analysis

### Purpose

To transform the stakeholder requirements into a set of technical system requirements that will guide the design of the system.

### Process Outcomes

1. System requirements are defined and documented.
2. System requirements are categorized (functional, performance, interface, safety, security, constraint).
3. The impact of system requirements on the operating environment (vehicle bus, power supply, other ECUs) is identified.
4. Consistency and bidirectional traceability between system requirements and customer requirements are established.
5. System requirements are agreed with relevant parties.
6. System requirements are updated as needed throughout the project.

### Base Practices

**SYS.2.BP1: Specify system requirements**
For each customer requirement (from SYS.1), derive one or more system requirements that define the technical behavior the system must exhibit. Requirements must be SMART (Specific, Measurable, Achievable, Relevant, Time-bound). Capture in the System Requirements Specification (SRS, WP 08-13).

**SYS.2.BP2: Structure system requirements**
Organize requirements by domain (functional safety, diagnostics, communication, power management, human-machine interface) and type (functional, timing, resource, interface, constraint). Clear structure enables allocation in SYS.3.

**SYS.2.BP3: Categorize system requirements with regard to security and safety-relevance**
Flag requirements contributing to ASILs (from ISO 26262 HARA) or cybersecurity threat mitigations (from ISO/SAE 21434 TARA). Safety-related requirements must carry their ASIL classification; security requirements carry their cybersecurity attribute.

**SYS.2.BP4: Analyze system requirements for correctness and feasibility**
Review for: completeness, correctness, clarity, testability, and technical feasibility. Flag requirements that reference unavailable hardware, unrealistic timing windows, or undefined external behavior. Conduct feasibility analysis using simulation or prototype when needed.

**SYS.2.BP5: Define criteria for verification of system requirements**
For each system requirement, specify how it will be verified at system level (SYS.5): test, analysis, inspection, or demonstration. Verification criteria must be quantitative where possible.

**SYS.2.BP6: Establish bidirectional traceability**
Maintain a requirements traceability matrix (RTM): SYS requirement ↔ customer requirement. Every SYS requirement must derive from one or more customer requirements. Every customer requirement must be covered by at least one SYS requirement.

**SYS.2.BP7: Ensure consistency between system requirements and customer requirements**
Conflict analysis: resolve contradictions between SYS requirements (e.g., a performance requirement impossible to meet within the power budget constraint). Change requests used to escalate unresolvable conflicts to the customer.

**SYS.2.BP8: Agree on requirements with relevant parties**
System requirements must be reviewed and agreed by: system engineer, project manager, safety manager (for safety attributes), and (where required) customer. Baseline the agreed SRS.

### Work Products Produced

| WP ID | Work Product | Key Content |
|-------|-------------|-------------|
| 08-13 | System Requirements Specification | All system requirements with IDs, attributes, traceability to customer requirements |
| 13-22 | Traceability Record | RTM: customer req ↔ system req |
| 13-04 | Review Record | SRS review findings and resolutions |

### Work Products Consumed

| WP ID | Work Product | Source |
|-------|-------------|--------|
| 08-51 | Customer Requirements Specification | SYS.1 |

### ASIL Attribution in System Requirements

When ISO 26262 is applied alongside ASPICE:

```
Safety Analysis (HARA - ISO 26262 Part 3) identifies:
  Hazardous Event: "Unintended acceleration > 100 km/h"
  ASIL: D
  Safety Goal: "Prevent unintended positive drive torque"
      │
      ▼
Functional Safety Concept (FSC) decomposes to:
  FSR-042: The EMS shall limit drive torque to 0 Nm when brake pedal pressed
  ASIL: C (after decomposition per ISO 26262 Table 5)
      │
      ▼
System Requirement (SYS-REQ-0210):
  "When brake_pedal_signal = active AND vehicle_speed > 0, 
   the torque_demand output shall be set to 0 Nm within 20 ms"
  ASIL: C (inherited from FSR-042)
      │
      ▼
SW Requirement (SWR-0089):
  "The SafetyTorqueOverride component shall set torque_setpoint = 0 
   within one 10 ms task cycle when brake_override_active = TRUE"
  ASIL: C
```

### Common Weaknesses Found in Assessments

- System requirements written as high-level feature descriptions — not implementable or testable
- Safety requirements not attributed with ASIL — safety analysis outputs not reflected in SRS
- Traceability only maintained in one direction
- SRS never formally reviewed — team relied on informal peer walks
- Version management: customer sends SRS v3.1 but project works against v2.4

---

## SYS.3 — System Architectural Design

### Purpose

To establish a system architectural design for the system that identifies the constituent hardware and software elements, their interfaces, and how the system requirements are allocated to those elements.

### Process Outcomes

1. The system architectural design identifies hardware elements, software elements, and manual operations.
2. System requirements are allocated to elements of the system architecture.
3. Interfaces between system elements and with external systems and the operating environment are defined.
4. Dynamic behavior and resource consumption are defined for the system architecture.
5. Consistency and bidirectional traceability between the system architectural design and the system requirements are established.

### Base Practices

**SYS.3.BP1: Develop system architectural design**
Create an architecture that decomposes the system into: ECU hardware platform, software components, external sensor/actuator interfaces, bus communication interfaces, and power supply topology. The system architecture document (WP 02-01) must be sufficient to guide SWE.1, HWE.1, and procurement decisions.

**SYS.3.BP2: Allocate system requirements to system elements**
Every system requirement must be allocated to exactly one element (or a defined subset with documented shared responsibility). Allocation drives the input to SWE.1 (SW requirements) and HWE.1 (HW requirements).

**SYS.3.BP3: Define hardware-software interface (HSI)**
The HSI is a critical boundary document. For each hardware signal connected to software:
- Signal name, direction (input/output)
- Voltage/current/logic levels; digital vs. analog
- Resolution and conversion factor (for ADC channels)
- Fault modes: open-circuit behavior, stuck-at values, timeout behavior
- Interrupt or polling access mode
- Safety classification (ASIL, QM)

**SYS.3.BP4: Define interfaces between system elements**
Specify all external interfaces: CAN/LIN/Ethernet/FlexRay bus messages, I2C/SPI register maps, UART protocols. Interface specification must be precise enough to independently develop or verify each connected system.

**SYS.3.BP5: Describe dynamic behavior of the system architecture**
Define: boot sequence (HW init → BSP → drivers → OS → application), shutdown sequence, power mode transitions (Normal → Sleep → Deep Sleep), diagnostic state machine, watchdog supervision structure.

**SYS.3.BP6: Evaluate alternative architectures**
Document the technical options considered and rationale for the chosen architecture. This is critical for safety analysis: the selected architecture's ASIL decomposition strategy must be justified.

**SYS.3.BP7: Establish bidirectional traceability**
Architecture allocation matrix: system requirement → system element. Every requirement allocated; every element has at least one requirement. Feed this into SWE.1 and HWE.1 through derived requirement specifications.

### Hardware-Software Interface (HSI) Example

```
Signal: BRAKE_PEDAL_SW
Direction: Input to ECU software
Source hardware: Hall-effect pressure sensor on brake circuit
ADC channel: ADC1_CH3 (MCU Pin PA3)
Resolution: 12-bit, VREF = 5.0 V, Range: 0–4095 counts
Conversion: Pedal_Pressure_kPa = (ADC_count / 4095) × 1000 kPa
Valid range: 0–1000 kPa
Fault detection:
  Open circuit: ADC_count < 10 for > 100 ms → fault code P1234
  Stuck-at-high: ADC_count > 4080 for > 100 ms → fault code P1235
ASIL: C (contributes to brake pedal detection in safety function FSR-042)
Update rate: read every 10 ms task cycle
```

### System Architecture V & V Considerations

| Architecture Decision | V&V Strategy |
|----------------------|-------------|
| ASIL decomposition: 1×ASIL C → 2×ASIL A | Both channels must fail simultaneously — independence must be verified |
| CAN bus for safety signal | CAN E2E protection (CRC + counter) per ISO 26262 Part 7 |
| Watchdog for SW supervision | Watchdog window timer tested for unexpected trigger and missed trigger |
| NVM for fault storage | Integrity check (CRC32) on every write/read tested |

### Work Products Produced

| WP ID | Work Product | Key Content |
|-------|-------------|-------------|
| 02-01 | System Architectural Design | Component diagram, allocation table, HSI, external interfaces, dynamic behavior |
| 17-08 | Interface Requirements Specification | Full HSI documentation |
| 13-22 | Traceability Record | SYS requirement → system element |
| 13-04 | Review Record | Architecture review records |

### Work Products Consumed

| WP ID | Work Product | Source |
|-------|-------------|--------|
| 08-13 | System Requirements Specification | SYS.2 |

---

## SYS.4 — System Integration and Integration Test

### Purpose

To integrate the system elements (hardware, software, and other elements) and to verify that the integrated system behaves according to the system architectural design.

### Process Outcomes

1. A system integration strategy consistent with the system architectural design is developed, including integration of HW and SW.
2. System elements are integrated according to the integration strategy.
3. Test cases for system integration testing are developed from the system architectural design.
4. System integration tests are executed.
5. Results of the system integration tests are recorded.
6. Consistency and bidirectional traceability between integration test cases, test results, and the system architectural design are established.

### Base Practices

**SYS.4.BP1: Develop system integration strategy**
Plan how the system elements will be combined: hardware first then software flashed, or simulation-based integration followed by real hardware integration. Define the integration sequence and the test environment at each step (bench, EME lab, vehicle).

**SYS.4.BP2: Develop resource requirements for the integration test environment**
Specify what equipment, tools, and configurations are needed: prototype hardware, HIL simulator, vehicle test bench, calibration tools, CAN/LIN/Ethernet analyzers, load simulation hardware.

**SYS.4.BP3: Develop test cases for integration testing**
Test cases must be derived from the system architectural design (SYS.3). They exercise:
- Hardware-software interface (HSI) signal ranges, fault detection
- Communication interface (bus message timing, content, error frames)
- Boot sequence and power mode transitions
- Component-to-component interactions

**SYS.4.BP4: Integrate hardware and software elements**
Combine the HW platform and the software image. Flash the target ECU. Verify basic operation of each interface before running test cases. Integration is incremental — test as you combine.

**SYS.4.BP5: Perform the integration test**
Execute all integration test cases. Record: test date, tester, hardware version, software version/build ID, test case ID, result, deviation/defect references.

**SYS.4.BP6: Provide evidence of integration**
Integration records must show that all planned test cases were executed or justified as not applicable. Any incomplete integration requires a documented rationale and risk acceptance.

**SYS.4.BP7: Ensure consistency and establish bidirectional traceability**
Every integration test case traces to the system architecture element it verifies. Integration test results trace to test cases. Changed architecture elements trigger re-test.

### Integration Test Coverage of SYS.3 Outputs

```
SYS.3 Element                    → SYS.4 Test Coverage
─────────────────────────────────┼────────────────────────────────
HSI: BRAKE_PEDAL_SW ADC          → Stimulate 0–1000 kPa range, inject open-circuit, stuck-at
CAN Rx: VEHICLESPEED_frame       → Test nominal reception, timeout fault, E2E failure
Power mode: Normal → Sleep       → Trigger sleep condition, measure current in sleep mode
Watchdog: 100 ms window          → Test window exceeded → reset triggered
NVM write/read integrity         → Write pattern, read back, verify CRC
SW boot sequence                 → Measure time from VBAT present to first CAN TX
```

### Work Products Produced

| WP ID | Work Product | Key Content |
|-------|-------------|-------------|
| 04-06 | System Integration Test Specification | Integration test cases per architecture element |
| 04-08 | System Integration Test Results | Execution records |
| 13-22 | Traceability Record | Integration test case → SYS.3 architecture element |

---

## SYS.5 — System Qualification Test

### Purpose

To confirm that the integrated system meets the defined system requirements and is ready for delivery.

### Process Outcomes

1. A system qualification test strategy is developed including regression test strategy.
2. Test cases for system qualification testing are developed from system requirements.
3. System qualification tests are conducted.
4. Results of the system qualification tests are recorded.
5. Consistency and bidirectional traceability between test cases, test results, and system requirements are established.

### Base Practices

**SYS.5.BP1: Develop qualification test strategy**
Define test scope, entry criteria (SW and HW versions baselined), exit criteria (all test cases executed, all critical defects resolved), pass/fail criteria, regression strategy, test environment, and tools.

**SYS.5.BP2: Develop test cases based on system requirements**
For each system requirement (from SYS.2), develop one or more qualification test cases. Test cases must be traceable to their requirement. Requirements coverage target = 100%.

**SYS.5.BP3: Develop test cases for testing external interfaces**
System-level tests that exercise the ECU's interaction with the vehicle bus, other ECUs, and external sensors. These include network management tests (NM message timing), diagnostic tests (UDS session control, DTC management), and power supply disturbance tests.

**SYS.5.BP4: Test regression**
On every software or hardware change, re-execute the regression suite. Regression ensures that fixes to one fault do not introduce new faults.

**SYS.5.BP5: Perform qualification test**
Execute all test cases against the production-representative build and hardware. Conduct in a test environment that represents the vehicle operational environment as closely as possible.

**SYS.5.BP6: Record test results**
Every test execution must be formally recorded with build ID, HW version, test date, tester, result. Automated test tools must be validated if results are used as evidence in safety assessments.

**SYS.5.BP7: Ensure consistency and establish bidirectional traceability**
RTM closure: every SYS requirement has a test case; every test case has a recorded result; failures have associated defects traceable to the requirement.

### SYS.5 Typical Test Areas

| Test Domain | Focus |
|------------|-------|
| Functional | All system requirements verified by test |
| Diagnostic (UDS) | 0x10, 0x11, 0x14, 0x19, 0x22, 0x27, 0x2E, 0x3E services per ISO 14229 |
| Network Management | AUTOSAR NM / OSEK NM message timing, bus sleep, wakeup |
| Power Management | Normal, sleep, standby, wake-by-CAN-message, wake-by-timer |
| Error handling | Invalid CAN messages, sensor out-of-range, communication timeout |
| Environmental | Temperature soak (confirm timing requirements at -40°C, +85°C) |
| Startup time | Measure time to first valid output from KL15 ON |
| Regression | Full re-execution on each release candidate |

### Traceability Chain — Full System View

```
OEM/Customer Requirement (CRS-0210: Brake torque override)
  │ (SYS.1)
  ▼
System Requirement (SYS-REQ-0210: Torque = 0 Nm within 20 ms when brake active)
  │ (SYS.2)
  ▼
System Architecture (SYS.3: SafetyModule component on MCU, BRAKE_PEDAL_SW HSI)
  │
  ├──► SW Requirement (SWE.1: SWR-089 — SW torque limit within 10 ms)
  │       └──► SW Architecture (SWE.2 → SWE.3 → SWE.4 → SWE.5 → SWE.6)
  │
  └──► HW Requirement (HWE.1: BRAKE_PEDAL_SW ADC with 12-bit resolution ≤ 5 ms read)
  │       └──► HW Design (HWE.2 → HWE.3 → HWE.4 → HWE.5 → HWE.6)
  │
  ▼
System Integration Test (SYS.4: HSI test, NM test, power mode test)
  │
  ▼
System Qualification Test (SYS.5: QT-SYS-0210 — brake override at -40°C, +85°C, full load)
```

### Work Products Produced

| WP ID | Work Product | Key Content |
|-------|-------------|-------------|
| 04-06 | System Qualification Test Specification | All test cases traced to SYS requirements |
| 04-07 | System Qualification Test Cases | Individual test case records |
| 04-08 | System Test Report | Coverage, pass/fail summary, open defects, deviations |
| 13-22 | Traceability Record | SYS requirement → test case → test result |

### Common Weaknesses Found in Assessments (SYS.4 and SYS.5)

- Test cases designed at feature level, not traced to individual SYS requirements
- Qualification test for a CAN-based ECU run on a bench without representative CAN load
- Environmental tests (temperature, EMC) executed during component qualification but not traced to SYS requirements
- Regression tests not re-run between releases — "no one touched that part of the software"
- Diagnostic test cases absent — UDS service behavior not formally specified or tested
- No documented test environment description (hardware version, test tools, simulator configuration)
