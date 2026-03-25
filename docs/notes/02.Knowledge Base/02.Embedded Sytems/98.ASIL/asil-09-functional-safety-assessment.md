---
title: Functional Safety Assessment and Safety Management
createTime: 2026/03/25 00:00:00
permalink: /kb/embedded/asil/functional-safety-assessment/
---

# Functional Safety Assessment and Safety Management

## ISO 26262 Part 2: Functional Safety Management

ISO 26262 Part 2 defines the management processes and organizational requirements that must be in place across all phases of the safety lifecycle. It is independent of the technical content of Parts 3–7 — Part 2 establishes WHO is responsible, HOW decisions are made and reviewed, and WHAT evidence must be collected.

### Part 2 Scope

```
Part 2 covers:
  ├── Overall safety management (§5): Safety plan, safety case, competence
  ├── Safety lifecycle initiation (§6): DIA, SEooC assumptions
  ├── Overall operation (§7): Operational safety activities
  ├── Overall maintenance (§8): Post-release safety considerations
  ├── Decommissioning (§9): End-of-life safety
  └── Confirmation measures (§6.4.8, §6.4.9):
        - Design Review
        - Verification
        - Functional Safety Assessment
        - Safety Audit
```

---

## Key Roles in ISO 26262 Safety Management

### Safety Manager

The Safety Manager is responsible for planning and coordinating all safety lifecycle activities. This is a formal role assigned to a named individual.

```
Safety Manager responsibilities:
  ├── Develop and maintain the Safety Plan
  ├── Ensure all work products are produced and reviewed
  ├── Track deviations, non-conformances, and their resolution
  ├── Approve work products at phase gates
  ├── Coordinate between OEM safety team and supplier
  └── Report safety status to project management and customer
```

### Chief Safety Engineer (CSE)

The CSE is the senior technical safety expert for the item. They own all technical safety decisions.

```
CSE responsibilities:
  ├── Lead HARA and sign off on ASIL assignments
  ├── Author or approve the Functional Safety Concept
  ├── Review and approve the Technical Safety Concept
  ├── Resolve disagreements on ASIL decomposition claims
  ├── Review confirmation measures outputs (audits, assessments)
  └── Provide technical input to the Safety Case
```

### Functional Safety Assessor (FSA)

The FSA performs an independent review of the safety case and confirms that ISO 26262 requirements are met. The FSA must have independence from the development team.

```
FSA independence levels per ASIL (Part 2 Table 1):

ASIL A: Independence Level I1 — another person in same project
        (NOT same developer, but can be same team)

ASIL B: Independence Level I2 — independent person, same department
        (different project or function in same company)

ASIL C: Independence Level I3 — independent person, different department
        (different organizational unit in same company)

ASIL D: Independence Level I3 or I4 — strongly independent
        I3: structural independence in same company (preferred minimum)
        I4: fully independent organization (different company preferred)
```

### Competence Requirements

ISO 26262 Part 2 §5.4 requires that persons performing safety activities have demonstrated competence. Evidence of competence includes:

| Evidence Type | Description |
|--------------|-------------|
| Formal training | ISO 26262 training course + certificate |
| Education | Relevant engineering degree |
| Work experience | Years of functional safety project experience |
| Project history | Named participation in previous ISO 26262 projects |
| Tool qualification experience | Qualification of safety tools |

---

## Safety Plan

The Safety Plan is the primary management work product under Part 2. It is created at project initiation and updated throughout the safety lifecycle.

### Safety Plan Contents

```
Safety Plan sections:
  1. Item description and scope
     - What is the item? What is out of scope?
     
  2. ASIL determination reference
     - Reference to HARA; summary of maximum ASIL per safety goal
     
  3. Safety lifecycle activities plan
     - For each ISO 26262 activity: who does it, when, what deliverable
     
  4. Work product list
     - Complete list with ID, title, responsible role, review requirement, status
     
  5. Confirmation measures schedule
     - Which phases get Design Review, Verification, FSA, Safety Audit
     - Who will perform each confirmation measure
     
  6. DIA (Development Interface Agreement) reference
     - If applicable: OEM/supplier boundary and responsibility allocation
     
  7. Tool usage plan
     - All tools used in safety activities, their TCL classification,
       qualification plan for TCL-2 and TCL-3 tools
     
  8. Sub-project and SEooC handling
     - Any reused components, assumed ASIL for SEooC
     
  9. Tailoring activities
     - If any ISO 26262 requirements are claimed not applicable: justification
```

---

## Confirmation Measures

ISO 26262 defines four types of confirmation measures (Part 2 §6.4.8). They are normatively required at specific phases and for specific ASIL levels.

### 1. Design Review

An inspection of a work product by qualified reviewers different from the authors, checking for technical correctness, compliance with requirements, and adherence to process.

```
Design Review triggers in ISO 26262:
  - HARA: review before finalizing ASIL assignments
  - FSC: review by system architect, HW lead, SW lead, FSA
  - TSC: technical review before starting HW/SW development
  - SW Architecture: review per Part 6 §6.6
  - HW Design: schematic review per Part 5 §5.6
  - Test Plans: review before executing tests
  
Reviewers must be:
  - Different from the author(s) of the work product
  - Qualified and competent in the subject area
  - For ASIL C/D: formal review with issue tracking (not informal inspection)
```

### 2. Verification

Verification confirms that a work product satisfies the requirements placed upon it — typically through testing, analysis, inspection, or simulation.

```
Types of verification in the V-model:
  - Requirements verification: SWR is traceable to TSR, FSR, SG
  - Architectural verification: Architecture satisfies FFI, modularity, ASIL requirements
  - Unit test: SW unit satisfies SWR (coverage criterion met)
  - Integration test: System satisfies TSR + FSR at integration level
  - SW qualification test: ECU-level SW verification against SWR
  - HW verification: HWR verified by bench test or analysis

Verification is documented in:
  - Verification plan (what to verify, by whom, method, criterion)
  - Test cases and procedures
  - Test reports with pass/fail results
  - Non-conformance reports for failures
```

### 3. Functional Safety Assessment (FSA)

The FSA is the most visible confirmation measure. It is an independent evaluation of whether the safety activities and work products implement ISO 26262 requirements correctly.

#### FSA Phases

```
Phase 1: Planning
  ├── Safety Manager and FSA assessor agree on:
  │     - Scope of the assessment
  │     - Work products to be assessed
  │     - Assessment schedule
  │     - Independence verification (who is the assessor, what is their independence level)
  └── Assessment Plan is created and approved

Phase 2: Execution
  The assessor reviews work products and conduct interviews:
  
  Activity 1: Work product completeness check
    → Is the Safety Plan complete and up to date?
    → Are all required work products produced?
    → Is traceability maintained throughout (SG → FSR → TSR → SWR/HWR → Test)?
  
  Activity 2: Content review
    → Is the HARA methodology correct? Are S/E/C ratings justified?
    → Are ASIL assignments defensible?
    → Are decomposition claims valid (independence demonstrated)?
    → Are safety mechanisms adequate for the ASIL?
    → Are PMHF/SPFM/LFM metrics met?
    → Are verification results complete and passed?
  
  Activity 3: Process audit (mini safety audit)
    → Are the development processes followed? (ASPICE process compliance)
    → Is configuration management in place?
    → Are non-conformances tracked and resolved?

Phase 3: Reporting
  ├── Minor finding: Clarification needed; can be resolved without re-work
  ├── Major finding: Non-conformance with ISO 26262; re-work required before RfP
  └── Critical finding: Fundamental safety flaw; may require design change
```

#### FSA Work Product Review Checklist (High Level)

| Work Product | Key FSA Questions |
|-------------|------------------|
| HARA | Are S/E/C ratings consistent? Are safety goals complete? |
| FSC | Does FSC cover all safety goals? Is ASIL decomposition justified? Are FTTI values derivable? |
| TSC | Are all FSRs allocated to TSRs? Is HSI complete? Are safety mechanisms specified concretely? |
| SW Architecture | FFI demonstrated? ASIL partition isolation verified? No dynamic memory in ASIL SW? |
| SW Code | MISRA violations? Coding guidelines followed? Coverage requirements met? |
| SW Unit Tests | Coverage criterion met per ASIL? Test cases traceable to SWRs? |
| HW Design | FMEDA complete? PMHF targets met? DFA adequate? |
| System Tests | All TSRs verified? FTTI tests passed? Fault injection tests passed? |
| DTC (Diagnostic Codes) | All safety faults assigned DTCs? DTC read/clear documented? |

### 4. Safety Audit

The Safety Audit evaluates whether processes, procedures, and organizational practices conform to ISO 26262 requirements (process compliance, not technical content review).

```
Safety Audit scope:
  - Configuration management system: all safety work products version-controlled?
  - Change management: changes to safety work products processed correctly?
  - Problem reporting: non-conformances and defects tracked and resolved?
  - Competence: are assigned personnel actually qualified?
  - Tool qualification: TCL-2/3 tools qualified before use?
  - Review records: design reviews documented with issue lists?
  - Independence: reviewers are different from authors?

Safety Audit is typically performed:
  - Once per major project phase gate (concept, design, verification, release)
  - Triggered findings → corrective action plan required
```

---

## Safety Case

The Safety Case is the structured argument that the item achieves functional safety sufficient for its intended use. It is the final synthesis of all evidence produced during the safety lifecycle.

### Safety Case Structure

```
Safety Case Argumentation Pattern (Goal Structuring Notation - GSN):

CLAIM (Goal):
  G1: "EPS Item achieves functional safety for all safety goals"
  
STRATEGY:
  S1: "Demonstrated by evidence from all ISO 26262 lifecycle phases"
  
SUBGOALS:
  G2: "All hazardous events have been identified and classified" (HARA evidence)
  G3: "All safety goals have been addressed by FSRs" (FSC evidence)
  G4: "FSRs have been implemented correctly" (TSC + HW/SW design evidence)
  G5: "Implementation is correct and verified" (Verification evidence)
  G6: "Hardware random failure targets are met" (PMHF evidence)
  G7: "Systematic failures are adequately controlled" (Process compliance evidence)
  
EVIDENCE:
  E1: HARA document Rev 3.1, approved
  E2: FSC document Rev 2.0, approved
  E3: TSC document Rev 1.5, approved
  E4: SW Architecture document Rev 4.0
  E5: Unit Test Reports - all tests passed, MC/DC 100%
  E6: System Verification Test Report Rev 1.0 - all TSRs verified
  E7: FMEDA report Rev 2.1 - PMHF = 2.87 FIT (target 10 FIT) ✓
  E8: Functional Safety Assessment Report Rev 1.0 - no Major findings
```

---

## Release for Production (RfP)

RfP is the formal decision milestone at which the item is declared safe and approved for production release. ISO 26262 does not define a single "RfP" work product but the concept is widely used.

### RfP Prerequisites

| Required Evidence | Status |
|------------------|--------|
| Safety Plan closed out | All activities completed |
| All HARA open points resolved | No open severity-3 issues |
| FSC approved | No Major open FSA findings |
| TSC approved | No Major open FSA findings |
| All SWRs verified (test report) | 100% coverage, all passed |
| All HWRs verified (test report) | All bench tests passed |
| PMHF meeting targets | Confirmed by FMEDA |
| Safety Audit passed | No open major correctives |
| FSA final report "positive" | No Outstanding Major/Critical findings |
| DIA signed by all parties | OEM and supplier agree on interfaces |
| Change management closed | No open safety-relevant change requests |
| Safety Case reviewed and approved | CSE, Safety Manager, FSA sign-off |

---

## Development Interface Agreement (DIA)

The DIA is a normative work product (ISO 26262 Part 2 §5.4.7) required when safety responsibilities are split between organizations (OEM ↔ Tier-1 ↔ Tier-2).

### DIA Contents

```
DIA sections:
  1. Parties and scope definition
     - Organization A (e.g., OEM): responsible for X, Y, Z activities
     - Organization B (e.g., Tier-1): responsible for A, B, C activities
     
  2. Safety goals allocated to each party
     - OEM confirms which safety goals are relevant to the Tier-1 item
     
  3. Work products to be exchanged
     - OEM delivers: HARA, FSC, item definition, test environment spec
     - Tier-1 delivers: TSC, FMEDA, SW Architecture, test reports, Safety Case module
     
  4. FSC-to-TSC interface
     - Agreed FSRs shared with Tier-1 as the entry requirement for their TSC
     
  5. Assumptions of use (for SEooC)
     - If Tier-1 develops a Safety Element out of Context (SEooC),
       the assumed ASIL and operational context must be documented here
       
  6. Confirmation measures responsibilities
     - Who performs FSA: OEM FSA team assesses Tier-1 item, or
                         Tier-1 provides independent assessor approved by OEM
     - Who performs Safety Audit: agreed party structure
     
  7. Change management procedure
     - How changes to the interface (FSC changes affecting Tier-1) are managed
     - Change notification timeline and impact assessment responsibility
```

---

## Safety Element out of Context (SEooC)

An SEooC is a safety-related element developed independently of a specific item context (e.g., a generic ABS MCU, motor driver IC, or OS platform developed by a Tier-2 for use in multiple OEM projects).

### SEooC Development Approach

```
Normal item development:
  HARA (specific vehicle context) → Safety Goals → FSC → TSC → HW/SW

SEooC development (no specific vehicle context):
  Assumed Operating Context → Assumed Safety Requirements (ASR)
                ▲                              │
                │                              ▼
  OEM/Tier-1 verifies context    SEooC developer designs to ASRs
  matches their application
  
  → If context matches: safety arguments are reusable
  → If context differs: integration documentation must resolve gaps
```

### SEooC Examples

| Component | Typical ASIL | SEooC Safety Assumptions |
|-----------|-------------|--------------------------|
| Aurix TC3xx MCU | ASIL D (silicon) | Assumes certain startup tests are performed by application SW |
| Vector CANoe | TCL-2 tool | Assumes use for system testing only, not direct production code |
| AUTOSAR OS (e.g., RTA-OS) | ASIL D qualified | Assumes correct BSW configuration per safety manual |
| TJA1145 CAN SBC | ASIL D | Assumes watchdog is serviced by application per protocol |
| CRC library (e.g., Autosar library) | ASIL D | Assumes input data length and alignment constraints per safety manual |
