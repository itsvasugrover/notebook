---
title: Capability Levels In Depth
createTime: 2026/03/25 00:00:00
permalink: /kb/embedded/aspice/capability-levels/
---

# Automotive SPICE — Capability Levels In Depth

## Overview

Capability Levels (CLs) in ASPICE describe how well a process is being performed and managed. They are not a measure of product quality directly — they measure the *management and institutional control* of the development processes. A team can accidentally produce a good product at CL 0; the goal of capability levels is to make good outcomes *repeatable and predictable*.

ASPICE inherits its capability framework from ISO/IEC 33020, which defines six levels:

| Level | Name | Core Question |
|-------|------|--------------|
| 0 | Incomplete | Is the process even attempted? |
| 1 | Performed | Are the process outcomes achieved? |
| 2 | Managed | Is performance planned, monitored, and work products controlled? |
| 3 | Established | Is the process standardized across the organization? |
| 4 | Predictable | Is the process quantitatively managed? |
| 5 | Optimizing | Is the process continuously improved? |

---

## CL 0 — Incomplete

### Definition
The process is not implemented, or fails to achieve its purpose. Work products may not exist.

### What This Means in Practice
- No software requirements document exists
- Testing is ad-hoc and undocumented
- Engineers don't know what process they should be following

### Assessment Indicators
- PA 1.1 = N (Not achieved: 0%–15%)
- Work products absent, or their existence is incidental

### Industry Significance
CL 0 is rare in automotive projects that have passed any supplier gate. However, specific processes within a project can be at CL 0 if they were never initiated (e.g., SUP.8 Configuration Management intentionally excluded from scope).

---

## CL 1 — Performed

### Definition
The process is implemented and achieves its purpose. The defined process outcomes can be observed in work products. However, performance is not planned or monitored; it relies on individual skill.

### Process Attribute
- **PA 1.1 — Process Performance**: Measures the extent to which the process purpose is achieved through performance of the defined base practices.

### PA 1.1 Evidence
Assessors look for:
1. Base practices being performed (interview evidence + work product evidence)
2. Work products that demonstrate outcomes being produced (not just claimed)

### What CL 1 Looks Like in Practice

```
SWE.1 at CL 1:
  ✓ Software requirements document exists
  ✓ Requirements have enough detail to start design
  ✓ Requirements cover the main functions
  ✗ Requirements have no IDs (traceability impossible)
  ✗ Non-functional requirements missing or vague
  ✗ No review conducted on the SRS
  ✗ SRS version not controlled; multiple copies on file server
```

The work is done, but it's individual-dependent and fragile.

### Rating Required for CL 1
- PA 1.1 must be rated **L** (Largely: >50%–85%) or **F** (Fully: >85%–100%)
- No other PAs are required

---

## CL 2 — Managed

### Definition
The process is managed: its performance is planned, monitored, and adjusted. The work products are controlled according to defined requirements. Individual results are consistent across time and team members.

### Process Attributes
- **PA 2.1 — Performance Management**: The process is planned, monitored, responsibilities assigned, resources allocated.
- **PA 2.2 — Work Product Management**: Work products are identified, documented, version-controlled, and reviewed.

### What CL 2 Requires in Practice

#### PA 2.1 — Performance Management Indicators

| GP | Evidence Expected |
|----|------------------|
| GP 2.1.1 | Objectives for each process are defined (e.g., "SRS review complete by Sprint 3") |
| GP 2.1.2 | Plan exists: schedule with dates, tasks, milestones for this process |
| GP 2.1.3 | Monitoring records: actual vs. planned tracked regularly (meeting minutes, status reports) |
| GP 2.1.4 | Corrective actions when deviations occur (plan updates, escalations) |
| GP 2.1.5 | Roles/responsibilities defined (who writes SRS, who reviews, who approves) |
| GP 2.1.6 | Resources allocated (named engineer, tool licenses, test environment booked) |
| GP 2.1.7 | Interface management: coordination between SWE.1 author and SYS.2/SYS.3 owners |

#### PA 2.2 — Work Product Management Indicators

| GP | Evidence Expected |
|----|------------------|
| GP 2.2.1 | Content requirements for each WP defined (template or checklist) |
| GP 2.2.2 | Documentation and control requirements (where stored, naming convention, version format) |
| GP 2.2.3 | WPs under version control (Git, SharePoint with versioning, DOORS) |
| GP 2.2.4 | WPs reviewed; review records exist; review findings tracked to closure |

### What CL 2 Looks Like in Practice

```
SWE.1 at CL 2:
  ✓ SRS has template with required sections
  ✓ SRS version controlled in Confluence or DOORS
  ✓ SRS review conducted with review checklist, review record filed
  ✓ Project plan shows SRS milestone with owner and date
  ✓ Monitoring: project status meeting weekly, SRS completion tracked
  ✓ Roles defined in project plan: John = SRS author, Maria = reviewer
  ✓ Resources: DOORS license provisioned, requirements training completed
  ✗ Process not defined in an org-level standard process (that's CL 3)
```

### Rating Required for CL 2
- PA 1.1 = **F**
- PA 2.1 = **F or L**
- PA 2.2 = **F or L**

Note: PA 1.1 must be **fully** achieved — not just largely — to progress to CL 2. This is often the rejection point: projects think they are at CL 2, but PA 1.1 has gaps (missing BPs or WP characteristics) that prevent CL 2 from being awarded.

---

## CL 3 — Established

### Definition
The process is performed using a defined, tailored standard process from an organizational process asset library. Process experience and lessons learned are shared across projects.

### Process Attributes
- **PA 3.1 — Process Definition**: An organizational standard process exists; the deployed process is derived from it.
- **PA 3.2 — Process Deployment**: The standard process is deployed in the project with appropriate tailoring; competencies, resources, and data collection are in place.

### What CL 3 Requires in Practice

#### PA 3.1 — Process Definition Evidence

| GP | Evidence Expected |
|----|------------------|
| GP 3.1.1 | Organization-level process definition exists (e.g., a Process Handbook, Process Gemba board) |
| GP 3.1.2 | Process flow diagrams showing inputs, activities, outputs, and interfaces to other processes |
| GP 3.1.3 | Role descriptions and competency profiles (what skills are required to perform each role) |
| GP 3.1.4 | Infrastructure and work environment defined (which tools, which versions, which server) |
| GP 3.1.5 | Effectiveness monitoring criteria (how the organization knows the standard process is working) |

#### PA 3.2 — Process Deployment Evidence

| GP | Evidence Expected |
|----|------------------|
| GP 3.2.1 | Project-specific deployment: tailoring document showing how the standard process was adapted |
| GP 3.2.2 | Project RACI/responsibility matrix explicitly referencing the standard process roles |
| GP 3.2.3 | Competency verified: training records, certifications, mentoring logs |
| GP 3.2.4 | Resources available per the standard process infrastructure requirements |
| GP 3.2.5 | Process performance data collected per the organization's measurement framework |
| GP 3.2.6 | Interfaces managed per the standard process definition |

### Organization vs. Project Level

CL 3 introduces an important distinction that CL 1 and CL 2 do not:

```
Organization Level (Standard Process):
  Defined once, maintained by a Process Improvement group or QA team
  Example: "The Software Requirements Management process shall..."
    ├── Standard template: SRS_Template_v2.docx
    ├── Standard review checklist: SRS_Review_Checklist_v1.xlsx
    ├── Tool: IBM DOORS Next configured per OPAlib-SWE1-Config-v3
    └── Competency: SWE.1 authors must complete training course "RM-201"

Project Level (Deployed Process):
  Tailored from the standard process for project-specific context
  Example: "For Project X (microcontroller with 32KB RAM constraint), the SRS...
    ├── Uses SRS_Template_v2.docx with Appendix B added for timing requirements
    ├── Deviates from standard: adds HW timing analysis section (tailoring documented)
    └── Competency: John Smith completed RM-201 on 2025-09-15 (training record)
```

### What CL 3 Looks Like in Practice

```
SWE.1 at CL 3:
  ✓ All CL 2 evidence present
  ✓ SRS template is an organizational standard (version-controlled in OPAlib)
  ✓ Standard review checklist exists at org level
  ✓ Project deployment: tailoring decision logged ("timing section added for CAN timing req")
  ✓ Engineer training record shows "Requirements Engineering 201" completed
  ✓ Lessons learned from previous SWE.1 implementations documented in OPAlib
  ✓ Process performance data (review defect density) collected and fed back to org
  ✗ Still no statistical process control (that's CL 4)
```

### Rating Required for CL 3
- PA 1.1 = **F**
- PA 2.1 = **F**
- PA 2.2 = **F**
- PA 3.1 = **F or L**
- PA 3.2 = **F or L**

---

## CL 4 — Predictable

### Definition
The process is controlled using statistical methods. Quantitative performance limits are set; special causes of variation are identified and corrected. Process performance is predictable within established limits.

### Process Attributes
- **PA 4.1 — Process Measurement**: Quantitative process measures defined and collected.
- **PA 4.2 — Process Control**: Statistical techniques applied; special causes detected.

### What CL 4 Means

At CL 4, the team no longer just asks "did we finish?" — they ask "how did the process behave relative to historical baselines?" and "is this deviation a normal variation or a signal that something went wrong?"

Statistical Process Control (SPC) concepts:
```
Control Chart:
  Upper Control Limit (UCL) ─────────────────────────────────── 
  Average (CL)          ─  ─  ─  ─ ●  ─  ─  ─  ─  ─  ─  ─  ─  
  Lower Control Limit (LCL) ─────────────────────────────────── 
                              ▲ Special cause — investigate!

Examples of measurable processes at CL 4:
  - Code review defect density (defects/KLOC) — tracked per sprint
  - Unit test execution time (build-to-pass duration)
  - SRS review cycle time (days from draft to approved)
  - Post-release defect rate per KLOC
```

### Evidence for PA 4.1 and PA 4.2

| PA | Concrete Evidence |
|----|------------------|
| PA 4.1 | Measurement plan with GQM-derived metrics; data collection tool (Jira, DOORS, CI) |
| PA 4.1 | Historical measurement data (at least 8–12 data points to establish statistical baseline) |
| PA 4.2 | Control charts, run charts, or capability indices (Cp, Cpk) per measurable process |
| PA 4.2 | Written rule for triggering special-cause investigation |
| PA 4.2 | Records of special-cause investigations and process adjustments |

### Industry Reality
CL 4 is rare in the automotive supplier industry. Most OEM contractual requirements target CL 2 (standard for all SWE processes) or CL 3 (for safety-critical suppliers). CL 4 is found in Tier-1 suppliers with mature engineering organizations or in safety-critical chipmakers.

---

## CL 5 — Optimizing

### Definition
The process is continuously improved based on quantitative analysis of performance data and systematic innovation. Improvement goals are defined quantitatively; innovations are evaluated for business impact.

### Process Attributes
- **PA 5.1 — Process Innovation**: Improvement goals defined; innovations identified, evaluated, selected.
- **PA 5.2 — Process Optimization**: Implemented innovations assessed; process updated.

### What CL 5 Means

CL 5 requires a formal feedback loop:
```
Process performance data
       │ (PA 4.1 measurement)
       ▼
Innovation ideas generated (brainstorming, technology scanning, academic research)
       │
       ▼
Business case analysis: will this innovation improve the quantitative metric?
       │
       ▼
Pilot implementation → measurement → comparison against baseline
       │
       ▼
Standard process updated with validated improvement
       │
       ▼
All future projects deploy the improved standard process (CL 3 deployment loop)
```

### Industry Reality
CL 5 is extremely rare — limited to organizations with dedicated process engineering teams (e.g., Bosch, Continental, Denso internal process excellence programs). No OEM contract typically demands CL 5.

---

## Capability Level Profiles

An ASPICE assessment does not produce a single "the project is at CL X" rating. It produces a *capability level profile* — individual CL ratings per process:

### Typical Target Profile (OEM common contract demand)

| Process | Minimum Required CL | Rationale |
|---------|--------------------|-----------| 
| SWE.1 | 2 | Requirements must be managed |
| SWE.2 | 2 | Architecture must be version-controlled |
| SWE.3 | 2 | Detailed design managed |
| SWE.4 | 2 | Unit tests planned and monitored |
| SWE.5 | 2 | Integration test managed |
| SWE.6 | 2 | Qualification test managed |
| SYS.2 | 2 | System requirements managed |
| SYS.3 | 2 | System architecture controlled |
| SYS.4 | 2 | System integration managed |
| SYS.5 | 2 | System qualification managed |
| SUP.1 | 2 | QA planned and executed |
| SUP.8 | 2 | Configuration management required |
| SUP.9 | 2 | Defect tracking required |
| SUP.10 | 2 | Change management required |
| MAN.3 | 2 | Project management required |
| MAN.5 | 2 | Risk management required |

### Premium/ASIL D Supplier Target Profile

Some OEMs require CL 3 on the engineering core and support processes for ASIL D components:

| Process Group | CL Target |
|--------------|-----------|
| SWE.1–SWE.6 | 3 |
| SYS.2, SYS.3, SYS.4, SYS.5 | 3 |
| SUP.1, SUP.8, SUP.9, SUP.10 | 3 |
| MAN.3, MAN.5 | 3 |

---

## Common Assessment Findings Per Level

### CL 1 Typical Gaps

```
SWE.1: Requirements exist but lack unique IDs → traceability impossible
SWE.3: Code exists but no detailed design document → cannot assess design conformance
SWE.4: Tests ran, results in engineers' notebooks → no formal test records
SUP.8: Source code in Git but documents unversioned on Teams/SharePoint
```

### CL 2 Typical Gaps

```
PA 2.1: Project plan is a Gantt chart without effort estimates or resource assignments
PA 2.1: No monitoring records — status meetings happen but no minutes or action items
PA 2.1: Responsibilities listed in org chart but not assigned per task
PA 2.2: SRS reviewed informally ("we discussed it") — no written review record
PA 2.2: Review findings not tracked to closure — assessor cannot verify fixes were made
PA 2.2: WPs stored in CM tool but no baseline procedure — "latest" is undefined
PA 1.1: SRS lacks non-functional requirements (timing, memory, stack) — incomplete outcome
```

### CL 3 Typical Gaps

```
PA 3.1: Process exists at project level but no org-level standard process
PA 3.1: Organization has a "process manual" but it is 5 years old — not maintained
PA 3.1: No competency profiles — "we hire good engineers" is not an ASPICE conformance argument
PA 3.2: Project tailoring not documented — cannot tell what was tailored from what standard
PA 3.2: Process performance data not fed back to organization-level improvement
```

### CL 4 Typical Gaps

```
PA 4.1: Metrics collected but not anchored to management decisions
PA 4.1: Fewer than 8 data points — insufficient for statistical baseline
PA 4.2: No control charts — only trend charts (trend charts tell you direction, not variation)
PA 4.2: No documented response rule for out-of-control signals
```

---

## Capability Level Determination — Step by Step

Given an assessment of one process (e.g., SWE.1):

```
Step 1: Rate PA 1.1 (interviewing SWE.1 engineers + examining SRS + traceability matrix)
  Result: PA 1.1 = L (Largely achieved — some BPs have gaps)

Step 2: Can CL 1 be awarded?
  CL 1 requires PA 1.1 ≥ L → YES: SWE.1 = CL 1

Step 3: Rate PA 2.1 and PA 2.2 (examining plans, monitoring records, WP versions, reviews)
  PA 1.1 must be F for CL 2 — but PA 1.1 = L only → CL 2 CANNOT BE AWARDED
  
  Even if PA 2.1 = F and PA 2.2 = F, CL 2 requires PA 1.1 = F.
  Result: SWE.1 = CL 1 (not CL 2)
```

This is the most common surprise in ASPICE assessments: teams invest heavily in process management (plans, monitoring) but have gaps in their work products that keep PA 1.1 below F, preventing CL 2 from being awarded despite strong CL 2 evidence.

```
Profile for a process that achieves CL 2:
  PA 1.1 = F (all major BPs performed, WPs have required characteristics)
  PA 2.1 = L (plan exists, monitoring present, some GP gaps acceptable)
  PA 2.2 = F (WPs versioned, reviewed, findings closed)
  Result: CL 2
```
