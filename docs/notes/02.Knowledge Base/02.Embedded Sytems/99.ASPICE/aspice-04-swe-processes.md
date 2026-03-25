---
title: Software Engineering (SWE) Processes
createTime: 2026/03/25 00:00:00
permalink: /kb/embedded/aspice/swe-processes/
---

# Automotive SPICE — Software Engineering (SWE) Processes

## SWE Process Group Overview

The SWE process group defines six processes arranged as a V-model. The left side of the V (SWE.1–SWE.3) covers specification and design work products flowing downward toward code. The right side (SWE.4–SWE.6) covers verification and test flowing upward, each right-side process verifying the artifact created by its mirror left-side process.

```
SWE.1 SW Requirements ◄──────────────────────► SWE.6 SW Qualification Test
       Analysis                                        (verifies SWE.1 outputs)
         │
SWE.2 SW Architectural ◄────────────────────► SWE.5 SW Integration Test
       Design                                        (verifies SWE.2 outputs)
         │
SWE.3 SW Detailed Design ◄──────────────────► SWE.4 SW Unit Verification
       & Unit Construction                           (verifies SWE.3 outputs)
```

---

## SWE.1 — Software Requirements Analysis

### Purpose

To establish the requirements for the software elements of the system and to ensure that these requirements are consistent with the system requirements.

### Process Outcomes

1. Software requirements are defined and documented.
2. Software requirements are categorized (functional, non-functional, interface, constraint).
3. The impact of the software on its operating environment (hardware, OS, external interfaces) is identified.
4. Consistency and bidirectional traceability between software requirements and system requirements (or customer requirements) are established.
5. Software requirements are agreed upon with relevant parties.
6. Software requirements are updated as the project evolves (change-controlled).

### Base Practices

**SWE.1.BP1: Specify software requirements**
For each system requirement or function allocated to software, specify a corresponding software requirement. Each requirement must be uniquely identified. Captured in the Software Requirements Specification (SRS, WP 08-52).

**SWE.1.BP2: Structure software requirements**
Organize requirements hierarchically or by feature/subsystem to support architectural design. Use requirement types: functional, performance, interface, safety, security, constraint. Structure enables requirements allocation to software components in SWE.2.

**SWE.1.BP3: Analyze software requirements for correct and feasible implementation**
Review each requirement for completeness, consistency, testability, and feasibility. Mark ambiguous, incomplete, or conflicting requirements and resolve them before design starts.

**SWE.1.BP4: Analyze the impact of software requirements on the operating environment**
Identify hardware/OS/middleware constraints the software must satisfy. Document timing constraints, memory budgets, CPU load limits, and interface protocols required by the hardware.

**SWE.1.BP5: Define criteria for software requirements verification**
For each requirement, define the acceptance criteria and the method (test, inspection, analysis, demonstration) to be used during SWE.6. This forms the basis of the test specification.

**SWE.1.BP6: Ensure consistency and establish bidirectional traceability**
Every SW requirement must trace up to a system/customer requirement and down to at least one test case in SWE.6. Gaps indicate either missing requirements or orphaned tests.

**SWE.1.BP7: Identify and communicate impacts on other processes**
Assess which SWE.1 outputs affect SYS processes, project plans, safety analysis (ISO 26262), or supplier requirements. Communicate changes to affected stakeholders.

**SWE.1.BP8: Agree on software requirements with stakeholders**
Obtain formal approval of the SRS from the customer, system engineer, project manager, and (where applicable) safety manager. Version and baseline the agreed SRS.

### Work Products Produced

| WP ID | Work Product | Key Content |
|-------|-------------|-------------|
| 08-52 | Software Requirements Specification | Functional requirements, non-functional requirements, interface requirements, unique IDs, traceability to SYS requirements |
| 13-22 | Traceability Record | Forward/backward mapping: SW req ↔ SYS req |
| 13-04 | Review Record | SRS review findings, decisions, dispositions |

### Work Products Consumed

| WP ID | Work Product | Source Process |
|-------|-------------|----------------|
| 08-13 | System Requirements Specification | SYS.2 |
| 17-08 | Interface Requirements Specification | SYS.3 |

### Common Weaknesses Found in Assessments

- Requirements stated as design decisions ("the software shall use interrupt-driven I/O") rather than capability needs
- Non-testable requirements ("the software shall be reliable")
- Requirements without unique IDs — makes traceability impossible
- SRS not baselined before SWE.2 begins
- Missing non-functional requirements (timing, memory, stack depth)
- Traceability table maintained separately from SRS and quickly goes out of date

### Checklist

```
□ Every system function has a corresponding SW requirement
□ All requirements have unique, stable IDs (e.g., SWR-001)
□ All requirements are testable (observable, measurable)
□ All requirements trace to a parent system/customer requirement
□ Interface requirements cover all external signals, messages, and protocols
□ Timing requirements specify deadlines, periods, worst-case execution
□ Acceptance criteria defined for each requirement
□ SRS reviewed and baselined (version-controlled)
□ Traceability matrix exists and is bidirectional
```

---

## SWE.2 — Software Architectural Design

### Purpose

To establish an architectural design for the software and identify which software requirements are to be allocated to which elements of the software.

### Process Outcomes

1. A software architectural design is developed that identifies software components.
2. The software requirements are allocated to software components of the architecture.
3. Interfaces between software components and with the external environment are defined.
4. The dynamic behavior of the software (scheduling, synchronization, communication) is defined.
5. Consistency and bidirectional traceability between the software architectural design and software requirements are established.

### Base Practices

**SWE.2.BP1: Develop software architectural design**
Decompose the software into components (modules, tasks, layers, partitions). Document the static structure using component diagrams, class diagrams, or architectural views. The architecture must be complete enough to build SWE.3 detailed designs from.

**SWE.2.BP2: Allocate software requirements to software components**
Create a requirements-allocation matrix: which component is responsible for implementing each requirement. Multiple components may share a requirement only when the contribution of each is specified.

**SWE.2.BP3: Define interfaces between software components**
Specify each inter-component interface: function signatures, shared data structures, message/event definitions, protocol IDs, timing contracts. Interfaces must be precise enough to permit independent development.

**SWE.2.BP4: Define interfaces between software components and the environment**
Specify all hardware interfaces (register maps, interrupt handlers, DMA buffers), OS interfaces (task APIs, semaphore usage, memory management), and communication interfaces (CAN frames, LIN frames, Ethernet PDUs).

**SWE.2.BP5: Describe dynamic behavior**
Specify execution model: cyclic scheduler (100 ms/10 ms/1 ms tasks), event-driven interrupts, state machines. Use sequence diagrams, timing diagrams, or state charts. Demonstrate that the architecture meets all timing requirements from SWE.1.

**SWE.2.BP6: Evaluate alternative architectures**
Document architecture decisions and the alternatives considered. Record rationale for selected approach (modularity, performance, safety isolation). Evaluation may be informal for small projects but must exist.

**SWE.2.BP7: Establish bidirectional traceability**
Every software requirement (from SWE.1) allocated to this architecture must trace to a specific component. Every component in the design must relate to at least one allocated requirement. Unmapped components indicate scope creep.

### Work Products Produced

| WP ID | Work Product | Key Content |
|-------|-------------|-------------|
| 02-01 | SW Architectural Design | Component diagrams, interface definitions, allocation table, dynamic behavior description |
| 13-22 | Traceability Record | SW req ↔ SW component mapping |
| 13-04 | Review Record | Architecture review findings |

### Work Products Consumed

| WP ID | Work Product | Source |
|-------|-------------|--------|
| 08-52 | Software Requirements Specification | SWE.1 |

### Design Patterns Commonly Used in Automotive SW Architectures

**AUTOSAR Classic Platform Layering**:
```
Application Layer      │ SW Components (SWC), Runnable Entities
────────────────────────┼─────────────────────
RTE (Runtime Env)       │ Port-Connector interface between SWCs and BSW
────────────────────────┼─────────────────────
Basic Software (BSW)    │ Services Layer: OS, Diagnostics, Memory, COM
                        │ ECU Abstraction Layer: drivers abstraction
                        │ Microcontroller Abstraction: MCAL drivers
────────────────────────┼─────────────────────
Microcontroller         │ Hardware
```

**Non-AUTOSAR Embedded Layering**:
```
Application / Feature Business Logic
        │
HAL — Hardware Abstraction Layer
        │
Driver Layer (peripheral drivers)
        │
Hardware (MCU peripherals)
```

### Common Weaknesses Found in Assessments

- Architecture diagram in Visio or draw.io but no formal interface specification document
- Interfaces described with prose but no type definitions or data structures
- Timing analysis absent ("we know it works" without evidence)
- Bidirectional traceability claimed but only in one direction (SWE.2 to SWE.1, not reverse)
- Architecture changed during implementation without updating the architecture document

### Checklist

```
□ Architecture documented in a controlled artifact (not just in engineers' heads)
□ All components identified with responsibility statements
□ All inter-component interfaces defined (not just listed)
□ External interfaces (HW, OS, CAN/LIN/Eth) precisely specified
□ Dynamic behavior (scheduling, synchronization) described and verified against SWE.1 timing requirements
□ Design alternatives documented with rationale
□ Allocation matrix: every SWE.1 requirement → at least one component
□ Reverse: every component → at least one requirement
□ Architecture reviewed and baselined
```

---

## SWE.3 — Software Detailed Design and Unit Construction

### Purpose

To provide an evaluated detailed design for software components and to produce and test software units.

### Process Outcomes

1. A detailed design for each software component is developed describing the algorithms, data structures, and unit interfaces.
2. The detailed design is evaluated for consistency with the architectural design and for feasibility of implementation.
3. Software units are produced in accordance with the detailed design.
4. Software unit verification confirms that units meet the detailed design requirements.

### Base Practices

**SWE.3.BP1: Develop software detailed design**
For each software component identified in SWE.2, develop a unit-level design specifying:
- Function/method signatures and preconditions/postconditions
- Algorithm descriptions (pseudo-code, flowcharts, formal notation)
- Data structures (structs, enums, buffers, queues)
- Error handling approach for each operational mode
- Resource consumption estimates (RAM, stack depth, CPU cycles)

**SWE.3.BP2: Define interfaces of software units**
Specify the public interface of each unit in precise terms. For C: function prototypes, typedefs, macro definitions, and their published in header files. For C++: class interface in .h files. Interfaces must be stable before implementation.

**SWE.3.BP3: Describe dynamic behavior of software units**
State machines, activity diagrams, or pseudo-code showing how each unit responds to its possible inputs and transitions. Must cover all normal and error paths.

**SWE.3.BP4: Evaluate the detailed design against the architectural design**
Review that the detailed design is consistent with SWE.2 component design (no introduced architectural gaps, no unauthorized new interfaces).

**SWE.3.BP5: Define unit test cases and test data**
From the detailed design, derive functional test cases (equivalence partitions, boundary values) and structural test cases (branch, decision, MC/DC coverage). Test data sets identified.

**SWE.3.BP6: Implement software units**
Write source code in accordance with the detailed design and the project coding guidelines (e.g., MISRA C, CERT C, project-specific rules). Code must be consistent with the detailed design — the design is the specification.

**SWE.3.BP7: Record unit test results**
Execute the defined unit tests. Record: test case ID, preconditions, inputs, expected outputs, actual outputs, pass/fail, coverage achieved, defects found/fixed.

### Work Products Produced

| WP ID | Work Product | Key Content |
|-------|-------------|-------------|
| 02-11 | SW Detailed Design | Per-unit: algorithms, data structures, function interfaces, state machines |
| 04-06 | Test Specification | Unit Test Specification: test cases, test data, coverage targets |
| 17-02 | Source Code | Implementation in language (C, C++, Ada, Rust) per design |
| 13-04 | Review Record | Design review and code review records |

### Work Products Consumed

| WP ID | Work Product | Source |
|-------|-------------|--------|
| 02-01 | SW Architectural Design | SWE.2 |
| 08-52 | Software Requirements Specification | SWE.1 |

### Coding Standards in Automotive SW Development

#### MISRA C:2012 Rules Applied at SWE.3

MISRA C:2012 defines 143 rules across three severity categories:

| Category | Count | Compliant Strategy |
|----------|-------|-------------------|
| Mandatory | 10 | Must comply — no deviation permitted |
| Required | 107 | Must comply or document a formal deviation |
| Advisory | 26 | Should comply; deviation is acceptable |

Critical MISRA C:2012 required rules for embedded SW:
```c
/* Rule 10.1: Operand types must be appropriate for the operator */
uint8_t x = (uint8_t)(a + b);   /* explicit cast avoids implicit conversion */

/* Rule 14.4: The controlling expression of if/while must be essentially Boolean */
if (flag == true)   /* not: if (flag) */

/* Rule 15.5: A function shall have a single point of exit */
/* Rule 17.3: A function shall not be declared implicitly */
void init_can(void);  /* forward declaration required */

/* Rule 21.3: Memory allocation/deallocation shall not be used */
/* malloc/free forbidden — use static allocation pools instead */
```

#### Stack Usage Analysis

For ASIL C/D software, stack usage must be statically analyzed:
```
Tool: StackAnalyzer (AbsInt), Polyspace, LDRA
Output: Worst-Case Stack Depth (WCSD) per task/interrupt context
Requirement: WCSD ≤ allocated stack depth × safety_margin_factor
```

### Common Weaknesses Found in Assessments

- Design document created by reverse-engineering existing code ("code first, document later")
- Unit test cases test only happy paths; error paths have low coverage
- Code review records not linked to specific functions or review findings not tracked to closure
- Detailed design not updated when code diverges (design rot)
- MISRA compliance scanner run at end of project, violations not tracked per sprint

---

## SWE.4 — Software Unit Verification

### Purpose

To verify software units to provide evidence for compliance of the software units with the software detailed design.

### Process Outcomes

1. A software unit verification strategy is developed including a regression test strategy.
2. Software units are verified using the verification strategy.
3. Results of the unit verification are recorded.
4. Consistency and bidirectional traceability between the unit verification results, unit test cases, and the software detailed design are established.

### Base Practices

**SWE.4.BP1: Develop unit verification strategy**
Define test approach: unit test framework (Google Test, CppUTest, Unity), target platform (host PC with stubs/mocks, hardware-in-the-loop), coverage tools, coverage targets, defect reporting mechanism.

**SWE.4.BP2: Develop unit test cases and test data based on detailed design**
Derive test cases from SWE.3 detailed designs. Test cases must cover:
- All equivalence classes for inputs
- Boundary values (min, max, min-1, max+1)
- Special values (null pointers, empty buffers, overflow conditions)
- All state transitions

**SWE.4.BP3: Verify software units based on the detailed design**
Execute the test cases. Record results per case. All failures are defects that must be resolved and re-tested.

**SWE.4.BP4: Verify software units based on the software requirements**
Additional functional tests ensuring the implemented unit meets the SW requirements allocated to it (from SWE.1 via SWE.2 allocation). This bridges unit test and integration test perspectives.

**SWE.4.BP5: Evaluate software unit test coverage**
Measure structural coverage achieved. Compare against coverage targets defined in the verification strategy. Justify any shortfall (dead code, infeasible paths).

**SWE.4.BP6: Ensure consistency and establish bidirectional traceability**
Each unit test case traces to a specific base attribute in the detailed design. Test results trace to test cases. Traceability enables change impact analysis.

### Coverage Targets by ASIL (ISO 26262 Table 10)

| Coverage Type | QM | ASIL A | ASIL B | ASIL C | ASIL D |
|---------------|----|----|----|----|-----|
| Statement coverage | Rec | Rec | Highly Rec | Highly Rec | Highly Rec |
| Branch coverage | — | Rec | Rec | Highly Rec | Highly Rec |
| MC/DC coverage | — | — | — | Rec | Highly Rec |

ASPICE SWE.4 does not mandate specific coverage percentages — that is defined by the project's safety strategy and ASIL. The ASPICE requirement is that coverage targets are *defined* and *evidence shows they are met or shortfalls justified*.

### Unit Test Framework Example (Unity / CppUTest)

```c
/* Unity framework — C unit test example */
#include "unity.h"
#include "can_driver.h"

void setUp(void) {
    can_driver_init();
}

void tearDown(void) {
    can_driver_deinit();
}

/* SWR-042: CAN frame with DLC > 8 shall be rejected */
void test_can_send_rejects_overlength_frame(void) {
    can_frame_t frame = {
        .id  = 0x1FF,
        .dlc = 9,     /* boundary value: DLC > 8 is invalid */
        .data = {0}
    };
    TEST_ASSERT_EQUAL(CAN_ERR_INVALID_DLC, can_send(&frame));
}

/* SWR-043: CAN frame with nominal DLC shall be transmitted */
void test_can_send_accepts_valid_frame(void) {
    can_frame_t frame = {
        .id  = 0x100,
        .dlc = 8,
        .data = {0xDE, 0xAD, 0xBE, 0xEF, 0x00, 0x00, 0x00, 0x01}
    };
    TEST_ASSERT_EQUAL(CAN_OK, can_send(&frame));
}
```

### Work Products Produced

| WP ID | Work Product | Key Content |
|-------|-------------|-------------|
| 04-07 | Test Cases | Unit test cases with inputs, expected outputs, pass/fail |
| 04-08 | Test Results | Execution records: date, tester, pass/fail, coverage metrics |
| 13-04 | Review Record | Code review records linked to units reviewed |
| 13-22 | Traceability Record | Test case → detailed design → SW requirement |

### Common Weaknesses Found in Assessments

- Coverage measured but no target defined in advance — target set "after the fact" to match actual coverage
- Test doubles (mocks/stubs) not clearly identified in test documentation
- No regression execution: unit tests not re-run after bug fixes
- Test results stored locally on engineer's machine, not in CM system
- Coverage measured only for happy-path execution flows

---

## SWE.5 — Software Integration and Integration Test

### Purpose

To integrate software units into larger software items and to verify that the integrated software items behave according to the software architectural design and software requirements.

### Process Outcomes

1. A software integration strategy consistent with the software architectural design is developed.
2. Software units are integrated according to the integration strategy.
3. Test cases for software integration testing are developed.
4. Software integration tests are executed.
5. Results of the software integration tests are recorded.
6. Consistency and bidirectional traceability between integration test cases, integration test results, and the software architectural design are established.

### Base Practices

**SWE.5.BP1: Develop software integration and verification strategy**
Define the sequence in which components will be combined (bottom-up, top-down, incremental feature-based, sandwich). Specify how inter-component interfaces will be exercised. Define the test environment (hardware, OS simulator, test harness).

**SWE.5.BP2: Develop test cases for software integration testing**
Derive test cases from the software architectural design (SWE.2). Focus on:
- Interface correctness: are parameters passed correctly between components?
- Error propagation: does a fault in Component A correctly surface in Component B?
- Resource contention: shared global data, mutexes, DMA channels
- Timing interactions: task scheduling, event sequencing

**SWE.5.BP3: Integrate software units and verify against the architectural design**
Build integrated software items incrementally. At each integration step, execute relevant test cases. Do not integrate everything at once — incremental integration enables defect isolation.

**SWE.5.BP4: Test integrated software items**
Execute all integration test cases. Verify inter-component interfaces, data flow, event dispatching, error recovery, and initialization sequences.

**SWE.5.BP5: Record software integration test results**
Document: which integration build was tested, test date, tester, test case results, defects opened, regression status.

**SWE.5.BP6: Ensure consistency and establish bidirectional traceability**
Each integration test case traces to one or more elements in the SW architectural design. Test results trace to test cases. Design changes re-trigger affected integration tests.

### Integration Strategies

| Strategy | Description | When to Use |
|----------|-------------|-------------|
| Bottom-up | Test leaf components first, integrate upward | Many independent utilities, driver layers |
| Top-down | Integrate from the top with stubs for lower layers | Architecture-first, when top-level logic is critical |
| Incremental/Feature-based | Integrate one feature at a time | Agile development, continuous integration |
| Big-bang | Integrate all at once | Small projects only; poor defect isolation |

### Test Environment Configurations

```
Native (host PC):
  ┌────────────────────────────┐
  │ Test Harness (Google Test)  │
  │  ├── Component Under Test  │
  │  ├── Stub: HW abstraction  │
  │  └── Mock: external CAN    │
  └────────────────────────────┘
  Suitable for: business logic, state machines, protocol parsers

HIL (Hardware-in-the-Loop):
  ┌───────────────────┐     ┌──────────────────────┐
  │ Target ECU        │◄───►│ HIL Simulator        │
  │  (real HW + SW)   │     │  (vehicle bus sim)   │
  └───────────────────┘     └──────────────────────┘
  Suitable for: timing-critical, interrupt-driven, all I/O paths
```

### Work Products Produced

| WP ID | Work Product | Key Content |
|-------|-------------|-------------|
| 04-06 | Integration Test Specification | Test cases per architectural interface/behavior |
| 04-08 | Integration Test Results | Execution records per test case, build ID, defects |
| 13-22 | Traceability Record | Integration test case → SW architectural design element |

### Common Weaknesses Found in Assessments

- Integration test cases re-state unit test cases (they are the same tests)
- Missing test cases for error scenarios and boundary conditions between components
- Integration test environment not described (assessors can't verify it represents the architecture)
- Test cases not traced to architectural design elements
- No regression execution after critical defect fixes

---

## SWE.6 — Software Qualification Test

### Purpose

To confirm by testing that the integrated software satisfies the defined software requirements.

### Process Outcomes

1. A software qualification test strategy is developed including a regression test strategy.
2. Test cases for the software qualification test are developed based on software requirements.
3. Qualification tests are executed.
4. Results of the software qualification tests are recorded.
5. Consistency and bidirectional traceability between software qualification test cases, test results, and software requirements are established.

### Base Practices

**SWE.6.BP1: Develop software qualification test strategy**
Define the approach for qualification testing: test scope, entry/exit criteria, test levels, coverage metrics (requirements coverage target = 100%), test environment, regression strategy, and tools.

**SWE.6.BP2: Develop test cases based on software requirements**
For each SW requirement (SWR) from SWE.1, develop one or more test cases. Test cases must be specific and unambiguous: preconditions set, stimulus provided, expected outcome measurable. Coverage: every SWR must have at least one test case.

**SWE.6.BP3: Develop test cases to cover functional and non-functional requirements**
In addition to functional tests, include test cases for:
- Timing (response time, deadline misses)
- Memory usage (heap, stack, static RAM footprint vs. budget)
- CPU load (worst-case measured on target)
- Interface protocol compliance (CAN message timing, diagnostics UDS response codes)

**SWE.6.BP4: Execute regression tests**
After any change to the software (defect fix, requirement change, code update), execute the full regression suite or a risk-based subset. Regression prevents regressions from entering the baseline.

**SWE.6.BP5: Perform software qualification testing**
Execute all qualification test cases against the release candidate build. Capture test results with: build/version ID, test date, test environment, tester name, pass/fail, and any deviations.

**SWE.6.BP6: Record test results**
All test execution records must be traceable to the tested build, the test case, and the requirement. Automated test tools should capture results with timestamps.

**SWE.6.BP7: Ensure consistency and establish bidirectional traceability**
Traceability matrix: SW requirement → test case → test result. Both directions must close: no untested required requirement, no test case without a requirement linkage.

**SWE.6.BP8: Summarize and communicate qualification test results**
Produce a Software Test Report (WP 04-08) summarizing: test scope, test completion, pass/fail summary, open defects, requirements coverage, outstanding deviations. Report reviewed by project manager and quality assurance.

### Requirements Coverage Matrix Example

```
ID      | Description                      | TC-001 | TC-002 | TC-003 | Result
SWR-001 | System shall init in < 200 ms    |   X    |        |        | PASS
SWR-002 | CAN msg received and parsed      |   X    |   X    |        | PASS
SWR-003 | CAN DLC > 8 rejected             |        |   X    |        | PASS
SWR-004 | SW shall log fault to NVM        |        |        |   X    | PASS
SWR-005 | SW shall respond to UDS 0x10     |        |   X    |   X    | FAIL→CR-0042
```

Requirements coverage = (tested requirements / total requirements) × 100%
Target: 100% before release.

### Non-Functional Test Examples

**Timing test (ASIL B ECU, SWR timing requirement)**:
```
Test Case: TC-NF-001
Requirement: SWR-089: SW shall calculate torque setpoint within 1 ms after sensor input
Precondition: 100 ms cyclic task running, sensor simulation active
Stimulus: Introduce step change in torque demand signal
Measure: Time from sensor signal change to setpoint output transition
Expected: Δt ≤ 1 ms (measured with logic analyzer or HIL time measurement)
Result: Δt = 0.82 ms → PASS
```

**Memory usage test**:
```
Test Case: TC-NF-012
Requirement: SWR-091: SW static RAM usage ≤ 8 KB
Tool: Linker map analysis + target run-time measurement
Result: .data + .bss = 6.4 KB → PASS
```

### Work Products Produced

| WP ID | Work Product | Key Content |
|-------|-------------|-------------|
| 04-06 | SW Qualification Test Specification | All qualification test cases |
| 04-07 | SW Qualification Test Cases | Individual test case records |
| 04-08 | SW Test Report | Coverage summary, pass/fail summary, open defects, deviations |
| 13-22 | Traceability Record | SW requirement → test case → test result |

### Work Products Consumed

| WP ID | Work Product | Source |
|-------|-------------|--------|
| 08-52 | Software Requirements Specification | SWE.1 |
| 04-05 | Integration Test Build | SWE.5 outputs |

### Common Weaknesses Found in Assessments

- Test cases written at system/feature level that require no detailed knowledge of SW requirements ("test the speed limiter") — cannot be traced to individual requirements
- Requirements with IDs but traceability table never created
- Tests run, but pass/fail results not formally documented (informal Excel sheets or chat logs)
- Regression test not executed before each release — reliance on "nothing changed in that area"
- Non-functional tests not performed until late in project — timing violations discovered at SOP

### SWE Process Traceability — Complete Chain

```
Customer Requirement (CR-001)
    │
    ▼
System Requirement (SYS-REQ-012)  [SYS.2]
    │ allocated to SW
    ▼
SW Requirement (SWR-089)          [SWE.1]
    │ allocated to component
    ▼
SW Component (Torque Calculator)  [SWE.2]
    │ detailed in
    ▼
SW Detailed Design (DD-TC-03)     [SWE.3]
    │ implemented as
    ▼
Source Code (torque_calc.c)       [SWE.3]
    │ verified by
    ▼
Unit Test (UT-TC-003)              [SWE.4]  ─── traces to DD-TC-03
    │ exercised at
    ▼
Integration Test (IT-045)          [SWE.5]  ─── traces to SW Architecture
    │ confirmed by
    ▼
Qualification Test (QT-089)        [SWE.6]  ─── traces to SWR-089
```

Every link in this chain must be documented and bidirectional. Breaking one link creates a conformance finding in an ASPICE assessment.
