---
title: Process Reference Model (PRM)
createTime: 2026/03/25 00:00:00
permalink: /kb/embedded/aspice/process-reference-model/
---

# Automotive SPICE Process Reference Model (PRM)

## Structure of the PRM

The Process Reference Model defines *what* processes exist, their **purpose** (why the process is performed), and their **outcomes** (observable results of effective process performance). The PRM is architecture-neutral — it describes the goal of each process without prescribing how to achieve it. That prescriptive detail belongs in the Process Assessment Model (PAM).

The PRM in Automotive SPICE v4.0 organizes processes into a three-level hierarchy:

```
Process Category
   └── Process Group
          └── Process (identified by ID, e.g., SWE.1)
                ├── Purpose
                ├── Outcomes (1..n)
                └── [in PAM] Base Practices → Work Products
```

---

## Engineering Processes

### Software Engineering (SWE) Process Group

The SWE processes form a V-model structure. Left branches represent specification/design going down; right branches represent verification/testing going up. Each left-side process has a corresponding right-side testing/verification process.

```
                 SWE.1                    SWE.6
             SW Requirements           SW Qualification
                 Analysis                   Test
                    │                       ▲
                    ▼                       │
                 SWE.2                    SWE.5
             SW Architectural          SW Integration
                  Design               Test / Verification
                    │                       ▲
                    ▼                       │
                 SWE.3                    SWE.4
             SW Detailed Design        SW Unit Construction
             & Unit Construction       & Unit Verification
```

#### SWE.1 — Software Requirements Analysis

**Purpose**: To establish the requirements for the software and ensure traceability to the system requirements.

**Outcomes**:
1. Software requirements are defined and documented
2. Software requirements are prioritized
3. Impact of software requirements on the operating environment is identified
4. Consistency and traceability between software requirements and system requirements (or customer requirements) is established
5. Software requirements are agreed with the relevant parties
6. Software requirements are updated as needed

**Key activities**:
- Elaborate on system-level requirements allocated to software
- Define functional, non-functional (timing, memory, interface), and constraint requirements
- Identify requirements related to regulatory compliance, safety, and security
- Use IDs for every requirement (traceability key)

---

#### SWE.2 — Software Architectural Design

**Purpose**: To establish an architectural design for the software and identify which software requirements are to be allocated to which elements of the software.

**Outcomes**:
1. A software architectural design is developed that identifies software components
2. The software requirements are allocated to software components
3. Interfaces between software components and the environment are defined
4. Dynamic behavior (concurrency, synchronization, scheduling) is defined
5. Consistency and traceability between the software architectural design and software requirements is established

**Key activities**:
- Decompose software into components (modules, tasks, layers)
- Define static structure (component diagram) and dynamic structure (sequence diagram, state machine)
- Define inter-component interfaces (API signatures, data flows, event triggers)
- Allocate requirements to components (bidirectional traceability matrix)
- Select design patterns for concurrency (e.g., event-driven, cyclic scheduling with AUTOSAR OS)

---

#### SWE.3 — Software Detailed Design and Unit Construction

**Purpose**: To provide an evaluated detailed design for software components and to produce and test software units.

**Outcomes**:
1. A detailed design for each software component is developed
2. The detailed design is evaluated for consistency and feasibility
3. Software units are produced in accordance with the detailed design
4. Software unit verification confirms software units meet the detailed design

**Key activities**:
- Specify each software unit's interface (function signatures, parameter types, return types)
- Write pseudo-code or formal specification for all units
- Code software units according to the detailed design and coding guidelines
- Perform unit testing (functional, boundary, structural coverage)

---

#### SWE.4 — Software Unit Verification

**Purpose**: To verify software units to provide evidence for compliance of the software units with the software detailed design and requirements.

**Outcomes**:
1. A software unit verification strategy is developed including regression strategy
2. Software units are verified using the defined strategy
3. Results of the unit verification are recorded
4. Consistency and bidirectional traceability between software unit verification and the software detailed design are established

**Key activities**:
- Define unit test cases from the detailed design
- Achieve structural coverage targets (statement, branch, MC/DC for ASIL C/D)
- Use static analysis tools and code analysis (MISRA C compliance)
- Review unit code and unit test results
- Maintain traceability: unit test case → detailed design → SW requirement

---

#### SWE.5 — Software Integration and Integration Test

**Purpose**: To integrate the software units into larger software items, and to ensure the integrated software items meet the software architectural design.

**Outcomes**:
1. An integration strategy exists consistent with the architectural design
2. Software units are integrated according to the strategy
3. Integration test cases are defined, including traceability to the architectural design
4. Integration tests are executed
5. Results of the integration tests are recorded
6. Consistency and bidirectional traceability between integration tests and the software architectural design are established

**Key activities**:
- Define integration order (bottom-up, top-down, or incremental by feature)
- Test component interfaces: does Component A invoke Component B with expected parameters?
- Verify inter-component concurrency, timing behavior, and resource sharing
- Test error propagation between components

---

#### SWE.6 — Software Qualification Test

**Purpose**: To ensure the integrated software meets the defined software requirements.

**Outcomes**:
1. A software qualification test strategy is developed including regression test strategy
2. Qualification test cases are defined from software requirements
3. Test cases include functional tests and non-functional tests (timing, memory use, stack usage)
4. Qualification tests are executed
5. Results are recorded
6. Consistency and bidirectional traceability between qualification test and software requirements are established

**Key activities**:
- Execute full SW feature tests in the target environment (SIL/HIL or target hardware)
- Verify all software requirements are covered by at least one test case
- Capture coverage metrics (requirements coverage ≥ 100%)
- Perform regression testing on each code change

---

### System Engineering (SYS) Process Group

System processes address the full system — hardware + software + network — of an ECU or vehicle function.

#### SYS.1 — Requirements Elicitation

**Purpose**: To gather, process, and track evolving customer needs and requirements throughout the project.

**Outcomes**:
1. Continuing communication with the customer is established
2. Agreed customer requirements are defined
3. A mechanism for customer requirements changes is established
4. Customer requirements are documented

---

#### SYS.2 — System Requirements Analysis

**Purpose**: To transform stakeholder requirements into a set of technical system requirements.

**Outcomes**:
1. System requirements are defined and documented
2. System requirements are categorized (functional, performance, interface, constraint)
3. Impact on the operational environment is identified
4. Consistency and traceability between system requirements and customer requirements is established
5. System requirements are agreed

---

#### SYS.3 — System Architectural Design

**Purpose**: To establish a system architectural design and identify hardware and software elements of the system architecture.

**Outcomes**:
1. System architectural design identifies hardware, software, and manual operations
2. System requirements are allocated to hardware and software elements
3. Interfaces between system elements and with external systems are defined
4. Dynamic behavior of the system is described
5. Consistency and traceability between the system architecture and system requirements is established

---

#### SYS.4 — System Integration and Integration Test

**Purpose**: To integrate the system elements and to verify that they meet the system architectural design.

**Outcomes**:
1. Integration strategy consistent with the system architecture is developed
2. System elements are integrated according to the strategy
3. System integration test cases are developed from the architectural design
4. System integration tests are executed
5. Results are recorded
6. Bidirectional traceability is established

---

#### SYS.5 — System Qualification Test

**Purpose**: To confirm that the system meets the defined system requirements.

**Outcomes**:
1. A system qualification test strategy is developed
2. Qualification test cases defined from system requirements
3. Tests are executed including testing of interfaces with external systems
4. Results are recorded
5. Bidirectional traceability is established

---

### Hardware Engineering (HWE) Process Group (ASPICE v4.0)

HWE processes were formally added in v4.0, mirroring the SWE V-model for hardware development.

| Process | Purpose |
|---------|---------|
| **HWE.1** Hardware Requirements Analysis | Elaborate system requirements allocated to hardware |
| **HWE.2** Hardware Architectural Design | Define hardware architecture: components, interfaces, signal flows |
| **HWE.3** Hardware Detailed Design | Schematic, layout, simulation models |
| **HWE.4** Hardware Unit Verification | Component test, inspection, simulation verification |
| **HWE.5** Hardware Integration and Integration Test | PCB assembly verification, prototype test |
| **HWE.6** Hardware Qualification Test | Verify HW meets HW requirements (EMC, thermal, mechanical) |

---

### Machine Learning Engineering (MLE) — ASPICE v4.0

MLE processes address the specific challenges of developing AI/ML models for automotive use:

| Process | Purpose |
|---------|---------|
| **MLE.1** ML Engineering Requirements Analysis | Define data requirements, model performance requirements |
| **MLE.2** ML Model Development | Data collection/preparation, model training, hyperparameter tuning |
| **MLE.3** ML Model Verification | Test model correctness, robustness, fairness |
| **MLE.4** ML Integration and Test | Integrate model into SW/HW; test in operational context |

---

## Support Processes (SUP)

Support processes provide services to the engineering processes.

| Process | Purpose |
|---------|---------|
| **SUP.1** Quality Assurance | Confirm that work products and processes comply with defined standards and plans; identify non-conformances |
| **SUP.2** Verification | Confirm work products meet specified requirements through systematic examination |
| **SUP.4** Joint Review | Evaluate status of a project and products of an activity with stakeholders |
| **SUP.7** Documentation | Develop and maintain documented information |
| **SUP.8** Configuration Management | Establish and maintain integrity of all identified work products; control versioning and changes |
| **SUP.9** Problem Resolution Management | Identify, analyze, manage, and track problems to resolution |
| **SUP.10** Change Request Management | Manage change requests to work products throughout the life cycle |

---

## Management Processes (MAN)

| Process | Purpose |
|---------|---------|
| **MAN.3** Project Management | Establish and carry out project plans; monitor project activities against plans |
| **MAN.5** Risk Management | Identify and treat project risks continuously |
| **MAN.6** Measurement | Collect, analyze, and apply measurements to support management |

---

## Process Improvement Processes (PIM)

| Process | Purpose |
|---------|---------|
| **PIM.3** Process Improvement | Continuously improve processes using measurement and assessment results |

---

## Acquisition and Supply Processes (ACQ/SPL)

| Process | Purpose |
|---------|---------|
| **ACQ.3** Contract Agreement | Establish supplier contracts with required development process requirements |
| **ACQ.4** Supplier Monitoring | Monitor supplier project execution against agreements |
| **ACQ.11** Technical Requirements | Specify technical and quality requirements for supplier deliveries |
| **ACQ.12** Legal and Administrative Requirements | Address legal requirements in supplier relationships |
| **ACQ.13** Project Requirements | Define project management requirements for suppliers |
| **ACQ.14** Supplier Qualification | Evaluate and qualify potential suppliers |
| **ACQ.15** Supplier Agreement | Establish supplier agreements |
| **SPL.1** Supplier Tendering | Respond to customer/acquirer requests |
| **SPL.2** Product Release | Release products to the customer/acquirer |

---

## Process Interdependencies

The ASPICE V-model creates bidirectional traceability requirements:

```
Customer Requirements
       │  traceability
       ▼
SYS.2: System Requirements ──────────────────► SYS.5: Sys Qual Test
       │  allocation traceability                        ▲
       ▼                                                 │ test cases trace to
SYS.3: System Architecture ──────────────────► SYS.4: Sys Integration Test
       │  allocation of SW requirements                  ▲
       ▼                                                 │
SWE.1: SW Requirements ──────────────────────► SWE.6: SW Qual Test
       │  design traceability                            ▲
       ▼                                                 │
SWE.2: SW Architecture ──────────────────────► SWE.5: SW Integration Test
       │  unit design traceability                       ▲
       ▼                                                 │
SWE.3: SW Detailed Design ───────────────────► SWE.4: Unit Verification
       │
       ▼
SWE.3: Code (Software Units)
```

This bidirectional traceability is the single most important structural property of ASPICE. Every requirement at every level must trace:
- **Down** (coverage): to a lower-level specification or code unit
- **Up** (justification): from test results back to the requirement they verify

A requirement without a test is unverifiable. A test without a requirement has unknown purpose.
