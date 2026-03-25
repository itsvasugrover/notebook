---
title: Work Products Catalog
createTime: 2026/03/25 00:00:00
permalink: /kb/embedded/aspice/work-products/
---

# Automotive SPICE — Work Products Catalog

## What Are Work Products?

In Automotive SPICE, a Work Product (WP) is any artifact produced, consumed, or maintained during process execution that constitutes **objective evidence** of process performance. An assessor cannot grant credit for a Base Practice without seeing corresponding work products.

Work products serve three roles:
1. **Evidence**: Proof that base practices were performed
2. **Communication**: Artifacts passed between processes and teams
3. **Configuration items**: Artifacts placed under CM control (SUP.8)

---

## WP Identification System

ASPICE uses a two-segment numeric scheme: `<category>-<seq>`.

| Category Range | Domain |
|----------------|--------|
| 01–09 | Project management and planning documents |
| 02 | Design artifacts |
| 04 | Test artifacts |
| 08 | Specification documents |
| 13 | Records |
| 14 | Standards, guidelines, procedures |
| 15–19 | Interface and technical reference documents |

---

## Complete Work Products Catalog by ID

### Plans and Project Documents

---

#### WP 01-13 — Project Plan

**Produced by**: MAN.3  
**Consumed by**: All processes (for monitoring)

**Content Characteristics**:
- Project scope and objectives
- Work breakdown structure (WBS)
- Activity schedule with milestones and dependencies
- Resource plan: named roles, assigned activities
- Effort and cost estimates with basis of estimation
- Project life cycle definition (phases, milestones, gate criteria)
- Communication plan
- References to sub-plans (QA plan, test plan, CM plan, risk log)
- Configuration baseline references

**Common Deficiencies in Assessment**:
- Plan is a Gantt chart only, without WBS, effort estimates, or resource names
- Plan is not version-controlled — assessors cannot tell what was planned vs. changed
- Plan is created at project start and never updated ("living document" that is actually frozen)

---

#### WP 01-50 — Quality Assurance Plan

**Produced by**: SUP.1  
**Consumed by**: All processes (as governance reference)

**Content Characteristics**:
- Scope of QA activities (which processes, which work products)
- QA schedule and audit calendar
- Sampling criteria and sampling strategy (risk-based)
- Non-conformance reporting procedure
- Escalation path
- QA metrics (audit coverage %, NC closure rate)
- QA roles and responsibilities
- Reference to applicable standards and guidelines

---

#### WP 01-51 — Configuration Management Plan

**Produced by**: SUP.8  
**Consumed by**: All processes (for CM compliance)

**Content Characteristics**:
- Scope: which work products are configuration items
- CM tool and tool configuration
- Identifier and naming conventions
- Versioning scheme (semantic, date-based, etc.)
- Branching and labeling strategy
- Baselining rules and schedule
- Access control: who can read/write/approve
- Backup and archiving procedures
- CM audit procedure

---

#### WP 01-52 — Test Plan

**Produced by**: SWE.4, SWE.5, SWE.6, SYS.4, SYS.5  
**Consumed by**: QA, Project Management

**Content Characteristics**:
- Test strategy (approach, levels, tools)
- Scope: what is tested, what is explicitly excluded
- Test entry criteria (prerequisites before testing starts)
- Test exit criteria (criteria for test completion)
- Test environment description (hardware version, SW baseline, tools, HIL config)
- Coverage targets and rationale
- Regression strategy
- Defect management reference (link to SUP.9)
- Roles and responsibilities

---

### Design Artifacts

---

#### WP 02-01 — Architectural Design

(This WP ID covers both system and software architectural design)

**Produced by**: SYS.3 (System Architecture), SWE.2 (SW Architecture)  
**Consumed by**: SWE.3, HWE (for system architecture); SWE.3, SWE.5 (for SW architecture)

**Content Characteristics (System Architecture)**:
- System boundary and context diagram
- System elements: hardware, software, and external interfaces
- Hardware-software interface (HSI) description
- System component interaction diagram
- Allocation of system requirements to system elements (allocation matrix)
- Dynamic behavior: boot sequence, power mode state machine, communications topology
- Rationale for architecture decisions

**Content Characteristics (SW Architecture)**:
- SW component decomposition diagram
- Component responsibility description
- Inter-component interface definitions (API signatures, data types, protocols)
- External interface definitions (HW abstraction, OS API, bus protocol stack)
- Concurrency and scheduling model (task list, priorities, periods)
- Software requirement allocation to components (allocation matrix)
- Design patterns and rationale

**Common Deficiencies**:
- Architecture diagram exists in Visio/draw.io but no formal specification of interfaces
- Allocation matrix absent — architecture diagram with no traceability to requirements
- Dynamic behavior absent — no scheduling model, no boot sequence
- System architecture created at start of project but never updated as design evolves

---

#### WP 02-11 — Software Detailed Design

**Produced by**: SWE.3  
**Consumed by**: SWE.3 (implementation), SWE.4 (unit test derivation)

**Content Characteristics**:
- For each software unit: unique identifier, purpose/responsibility statement
- Unit interface specification: function signatures, parameters, return types, preconditions, postconditions
- Algorithm description: pseudo-code, flowcharts, formal notation (UML state machine, MSC)
- Data structure definitions: structs, enums, buffers, shared global variables
- Error handling: what happens at each error condition
- Resource consumption estimates: stack depth, RAM allocation, CPU cycles (WCET estimate)
- Traceability to SW components in SWE.2 architecture
- Design constraints: applicable coding standards, tool limitations

**Common Deficiencies**:
- Detailed design created by reverse-engineering the code at audit time
- Algorithm descriptions too vague to serve as specification for an independent implementer
- Interface specifications missing for internal (private) functions
- No error handling described — only happy path covered
- Resource consumption absent — no stack analysis

---

### Specification Documents

---

#### WP 08-13 — System Requirements Specification

**Produced by**: SYS.2  
**Consumed by**: SYS.3, SYS.5 (test derivation), SWE.1 (allocate to SW)

**Content Characteristics**:
- Unique requirement identifiers (IDs stable over project life)
- Requirement type attribute (functional, performance, interface, safety, security, constraint)
- Requirement text: precise, measurable, unambiguous
- Acceptance criteria for each requirement (how will it be verified?)
- ASIL attribution for safety requirements
- Cybersecurity attribute for security requirements
- Traceability to customer requirements (RTM)
- Priority and status attributes
- Rationale or notes where intent is non-obvious
- Version and approval status

---

#### WP 08-52 — Software Requirements Specification (SRS)

**Produced by**: SWE.1  
**Consumed by**: SWE.2 (architecture), SWE.6 (test derivation), SUP.1 (QA audit)

**Content Characteristics**:
- Unique requirement identifiers (e.g., SWR-001)
- Functional requirements: what the software must do
- Non-functional requirements: timing (deadlines, periods, WCET), memory (heap, stack, ROM), CPU load budget
- Interface requirements: HW interfaces, OS interfaces, inter-component interfaces, communication protocol parameters
- Safety requirements: ASIL-attributed requirements derived from FSC (ISO 26262)
- Security requirements: cybersecurity controls (ISO/SAE 21434)
- Constraint requirements: coding standard compliance, AUTOSAR version, supported toolchain
- Traceability: each SWR traces to ≥ 1 system requirement
- Status: draft, reviewed, approved, obsolete

**Example Requirement in SRS**:
```
ID: SWR-089
Type: Functional / Safety
ASIL: C
Title: Brake Override Torque Limit
Text: When the brake_override_active signal is TRUE, the SafetyTorqueOverride 
      component shall set torque_setpoint = 0 Nm within one 10 ms task cycle 
      (≤ 10 ms from signal assertion to output update).
Acceptance Criteria: Verified by test case QT-089; timer measured with HIL oscilloscope
Traceability: SYS-REQ-0210
Status: Approved v2.0
```

**Common Deficiencies**:
- Requirements stated as design choices rather than needed behavior
- Non-functional requirements absent (common finding: "no timing requirements defined")
- ASIL not attributed — safety analysis outputs not reflected
- Acceptance criteria missing — requirements cannot be tested
- SRS not reviewed before SWE.2 starts

---

#### WP 08-51 — Customer Requirements Specification (CRS)

**Produced by**: SYS.1  
**Consumed by**: SYS.2

**Content Characteristics**:
- All agreed customer requirements
- Requirement IDs (or customer IDs if provided)
- Source document references (customer TS versions, change notes)
- Agreement date and signatory
- Change request cross-references

---

### Test Artifacts

---

#### WP 04-06 — Test Specification

**Produced by**: SWE.4, SWE.5, SWE.6, SYS.4, SYS.5  
**Consumed by**: Test execution activities; SUP.1

**Content Characteristics**:
- Document scope and applicable test level (unit / integration / qualification)
- Test approach and tools
- Test environment description (HW version, SW build, HIL config, test bench layout)
- Coverage targets with rationale
- Test case listing with:
  - Unique test case ID
  - Purpose / objective
  - Traceability: which requirement/design element is being verified
  - Preconditions (system state before test)
  - Stimulus / input actions
  - Expected results (quantitative where applicable)
  - Pass/fail criteria
  - Test data references
- Regression scope definition

**Common Deficiencies**:
- Test cases described at feature level ("test brake override") without design-level precision
- Traceability from test case to requirement absent
- Expected results qualitative ("brake override works") rather than quantitative ("torque = 0 ± 5 Nm")
- Test environment not specified — results cannot be reproduced

---

#### WP 04-07 — Test Cases

(Sometimes recorded as part of 04-06 or as separate records in a test management tool)

**Content Characteristics**:
- Test case ID
- Test case title
- Requirement traceability link
- Preconditions
- Test steps (numbered, unambiguous)
- Expected results per step
- Pass/fail verdict
- Execution date and tester
- Associated defect records (if failed)
- SW version / HW version tested against

---

#### WP 04-08 — Test Results (Test Execution Records)

**Produced by**: All test-executing processes  
**Consumed by**: Project management review, release decision

**Content Characteristics**:
- Summary: total test cases, passed, failed, not executed
- Software version / build ID tested
- Hardware version / test environment configuration
- Test execution date(s) and team
- Per-test-case result records
- Defect references for failures
- Coverage achieved (requirements, structural)
- Regression execution status
- Deviations from test specification with justification
- Sign-off / approval section

---

### Records

---

#### WP 13-04 — Review Record

**Produced by**: SUP.2, SWE.1–SWE.6, SYS.2–SYS.5  
**Consumed by**: SUP.1 (QA audit), Project Management

**Content Characteristics**:
- Review ID
- Date of review
- Reviewed artifact (ID, version, title)
- Review type (walkthrough, peer review, inspection)
- Reviewers (names and roles)
- Review checklist reference
- Findings per item:
  - Finding ID
  - Type (defect, question, suggestion)
  - Severity (Critical, Major, Minor, Observation)
  - Description
  - Disposition (accepted, rejected)
  - Action item: assigned to, due date, status
- Review verdict (pass, conditional pass, fail — re-review required)
- Sign-off by review moderator

**Common Deficiencies**:
- Review record is meeting minutes ("we discussed chapter 3") without finding tracking
- Findings not classified by severity
- Actions not linked to findings — cannot verify closure
- Review conducted after the artifact was already baselined and in use

---

#### WP 13-22 — Traceability Record

**Produced by**: SWE processes, SYS processes  
**Consumed by**: SWE.4–SWE.6, SYS.4–SYS.5, SUP.1, Release

**Content Characteristics**:
- Matrix or link structure covering the full traceability chain
- At minimum: customer requirement ↔ system requirement ↔ SW requirement ↔ test case ↔ test result
- Coverage metrics derivable from the matrix

**Tool-based traceability examples**:
```
DOORS/Polarion: Native requirement link types (implements, verifies, traces)
Jira: Issue links (e.g., "relates to" from test case to requirement story)
Excel/CSV: RTM columns:
  | SWR-ID | SWR-Title | Parent SYS-REQ | SWE.2-Component | TC-ID | TC-Status |
  | SWR-089 | Brake Override | SYS-REQ-0210 | SafetyTorqueOverride | QT-089 | PASS |
```

**Coverage Derivation**:
```
Requirements Coverage = 
  (count of SWRs with at least 1 linked test case marked PASS) / (total SWRs) × 100%

Verification Coverage (bidirectional) =
  Forward: every SWR has a test case (no untested requirements)
  Backward: every test case links to a SWR (no orphan tests)
  Both directions must be 100% at release.
```

---

#### WP 13-50 — Change Request Record

**Produced by**: SUP.10  
**Consumed by**: Project Management, affected process owners

**Content Characteristics**:
- CR ID (unique, stable)
- Requester and date
- Affected work products and version
- Description of change and reason
- Impact assessment: effort, schedule, affected WPs, safety impact
- Approval/rejection decision with authority and date
- Implementation reference (commit ID, document revision)
- Verification record (how was the change verified)
- Closure date

---

#### WP 13-04 — Problem Record

**Produced by**: SUP.9  
**Consumed by**: Engineering (for fixing), QA, Project Management

**Content Characteristics**:
- PR ID (unique)
- Date raised
- Environment (SW version, HW version, test bench)
- Severity (Critical, Major, Minor, Observation)
- Description: precise, reproducible statement of the problem
- Reproduction steps / stimulus
- Actual behavior vs. expected behavior
- Root cause analysis (for safety-relevant and major problems)
- Fix description and reference (commit, document change)
- Verification status (re-tested: pass/fail)
- Closure date and closer

---

### Guidelines and Standards

---

#### WP 14-01 — Coding Guidelines

**Produced by**: SWE.3 process setup  
**Consumed by**: SWE.3 (implementation), SWE.4 (static analysis)

**Content Characteristics**:
- Applicable standard (MISRA C:2012, AUTOSAR C++ Coding Guidelines, CERT C)
- Project-specific additions/restrictions
- Deviation procedure: how to formally document an approved deviation from a rule
- Approved deviation list
- Static analysis tool configuration
- Review checklist reference

---

#### WP 14-06 — Software Development Standards

**Content Characteristics**:
- Folder/file naming conventions
- Header file guard conventions
- Function naming conventions
- Maximum function complexity limits (cyclomatic complexity ceiling)
- Prohibited language constructs
- Approved design patterns
- Version requirements for compilers, linkers, assemblers

---

## WP Mapping to Processes

The following table maps the most frequently needed work products to the processes that produce and consume them:

| WP ID | WP Name | Produced By | Consumed By |
|-------|---------|-------------|-------------|
| 01-13 | Project Plan | MAN.3 | All processes |
| 01-50 | QA Plan | SUP.1 | All processes |
| 01-51 | CM Plan | SUP.8 | All processes |
| 01-52 | Test Plan | SWE.4,5,6 SYS.4,5 | QA, PM |
| 02-01 | Architectural Design | SYS.3, SWE.2 | SWE.3, HWE, SWE.5, SYS.4 |
| 02-11 | SW Detailed Design | SWE.3 | SWE.3 (code), SWE.4 |
| 04-06 | Test Specification | SWE.4,5,6, SYS.4,5 | Test execution, QA |
| 04-07 | Test Cases | SWE.4,5,6, SYS.4,5 | Test execution |
| 04-08 | Test Results | SWE.4,5,6, SYS.4,5 | PM, QA, release |
| 08-13 | System Requirements Specification | SYS.2 | SYS.3, SYS.5, SWE.1 |
| 08-51 | Customer Requirements Specification | SYS.1 | SYS.2 |
| 08-52 | Software Requirements Specification | SWE.1 | SWE.2, SWE.6 |
| 13-04 | Review Record | SUP.2 reviewing any WP | SUP.1, PM |
| 13-22 | Traceability Record | SWE/SYS processes | SWE.4–6, SYS.4–5, Release |
| 13-50 | Change Request | SUP.10 | All affected processes |
| 13-04 | Problem Record | SUP.9 | Engineering, QA |
| 14-01 | Coding Guidelines | Process setup | SWE.3, SWE.4 |
| 17-08 | Interface Requirements Spec | SYS.3 | SWE.1, HWE.1, SYS.4 |

---

## Minimum WP Evidence Set for CL 2 Assessment

For a project to achieve CL 2 on the SWE processes, assessors typically look for the following minimum WP set to demonstrate PA 1.1 (all BPs performed) and PA 2.2 (WPs controlled and reviewed):

```
Process         WP Required for PA 1.1         WP Required for PA 2.2
────────────────────────────────────────────────────────────────────────
SWE.1           08-52 (SRS with IDs,            Review record for SRS
                traceability to SYS-REQ,         Version history in CM
                acceptance criteria)

SWE.2           02-01 (SW architecture:          Architecture review record
                components, interfaces,           Versioned in CM
                allocation matrix)

SWE.3           02-11 (Detailed design           Design review record
                per unit: algorithm,             Versioned in CM
                interface spec)
                17-02 (Source code)              Code review record
                                                 Source code in SCM

SWE.4           04-06 (Unit test spec:           Test spec review record
                cases with traceability)         In CM
                04-08 (Unit test results:        Results in CM (not just
                pass/fail, coverage)             in tester's PC)

SWE.5           04-06 (Integration test spec)   Review + CM
                04-08 (Integration test results) CM

SWE.6           04-06 (Qual test spec)           Review + CM
                04-07 (Test cases traced to SRS) CM
                04-08 (Qual test report)         Approved, in CM
                13-22 (Requirements RTM          Maintained in CM
                showing 100% coverage)
```
