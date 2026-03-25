---
title: Support (SUP) and Management (MAN) Processes
createTime: 2026/03/25 00:00:00
permalink: /kb/embedded/aspice/sup-man-processes/
---

# Automotive SPICE — Support (SUP) and Management (MAN) Processes

## Overview

Support and Management processes are not optional additions — they are the mechanisms by which capability above Level 1 is demonstrated. Without SUP.8 (Configuration Management), for example, it is impossible to baseline work products, which blocks PA 2.2. Without MAN.3 (Project Management), it is impossible to demonstrate PA 2.1 (Performance Management). These processes are therefore directly linked to the capability level a project can achieve.

```
Engineering Processes (SWE, SYS, HWE)
         │ produce work products
         ▼
SUP.8 Configuration Management ─── ensures WPs are versioned, controlled, baselined
SUP.9 Problem Resolution ─────────── tracks defects to closure
SUP.10 Change Request Management ── manages changes to baselined WPs
SUP.1 Quality Assurance ──────────── verifies adherence to process and product standards
SUP.2 Verification ───────────────── confirms WPs meet requirements (review)
SUP.7 Documentation ─────────────── ensures WPs are properly documented
         │
MAN.3 Project Management ─────────── plans and monitors all the above
MAN.5 Risk Management ────────────── identifies, analyzes, and treats risks
MAN.6 Measurement ────────────────── collects and uses metrics
```

---

## SUP.1 — Quality Assurance

### Purpose

To provide independent assurance that work products and processes comply with defined plans and standards, and to identify non-conformances.

### Process Outcomes

1. A quality assurance strategy is developed that addresses the planned quality activities.
2. Evidence is gathered that work products and processes comply with applicable standards and plans.
3. Non-conformances are identified and tracked to resolution.
4. Quality assurance results are communicated to relevant parties.

### Base Practices

**SUP.1.BP1: Develop a quality assurance strategy**
The QA plan defines: scope of QA activities, which processes and work products will be reviewed, frequency and sampling approach, responsibilities, and escalation path for unresolved non-conformances.

**SUP.1.BP2: Confirm that plans comply with applicable requirements**
QA verifies that project plans (MAN.3) reference the correct standards, contain required artifacts, and define adequate verification activities. Compliance is confirmed before project execution starts.

**SUP.1.BP3: Assure quality of work products**
Audit/review selected work products against their content requirements (from the PAM WP characteristics). Examples: verify SRS has unique IDs, test specs have pass/fail criteria, code review records are complete.

**SUP.1.BP4: Assure quality of processes**
Verify that engineers actually follow the defined process steps. This includes process audits: does the review process match the defined review procedure? Are review checklists used? Are review results documented?

**SUP.1.BP5: Identify non-conformances and communicate to relevant parties**
Log each non-conformance with: finding ID, affected process/WP, description, assigned owner, deadline, and status. Non-conformances are not optional findings — they must be formally tracked.

**SUP.1.BP6: Track non-conformances to closure**
Follow up until each non-conformance is resolved, waived (with documented justification), or escalated. Unresolved non-conformances at project milestones are escalation items.

**SUP.1.BP7: Provide QA results to relevant parties**
QA findings are communicated to the project manager, process owner, and (for safety-relevant findings) the safety manager. QA reports are an input to management reviews.

### QA Plan Structure

A QA plan typically contains:

```
1. Purpose and Scope
2. QA Objectives and Risk-based Sampling Strategy
3. QA Activities per Project Phase (requirements → design → code → test → release)
4. Work Products Subject to QA Review
   - SRS: check for IDs, traceability, acceptance criteria
   - SW Architectural Design: check allocation matrix completeness
   - Code: check MISRA compliance run, review record completeness
   - Test Specification: check test case traceability to requirements
   - Test Report: check coverage closure, defect status
5. Process Audits Scheduled
6. Non-Conformance Reporting Procedure
7. Roles and Responsibilities
8. QA Metrics (audit coverage %, open NC count, NC closure rate)
```

### Common Weaknesses Found in Assessments

- QA performed only at end of project (gate review) — not during development phases
- Non-conformances identified verbally in meetings but not documented
- QA reports distributed but no evidence of action taken on findings
- QA scope confined to documentation; no process audits conducted
- Single engineer performing QA and engineering — independence not demonstrated

---

## SUP.2 — Verification

### Purpose

To confirm, through systematic examination and provision of objective evidence, that work products meet their specified requirements.

### Process Outcomes

1. A verification strategy is developed, including selection of verification methods (review, test, analysis, simulation).
2. Criteria for verification are identified for each work product.
3. Verification is performed according to the strategy.
4. Defects identified during verification are recorded and tracked.
5. Verification results are communicated to relevant parties.

### Base Practices

**SUP.2.BP1: Develop verification strategy**
The verification strategy defines: what will be verified (scope), how (methods: peer review, inspection, walkthrough, analysis, test), who (independent reviewer vs. author), when (per development phase), and what the exit criteria are.

**SUP.2.BP2: Verify selected work products**
Execute verification activities according to the plan. This includes: peer code reviews, architecture reviews, requirements reviews, test specification reviews, and design reviews. Each review must have defined entry criteria (artifact ready, checklist available) and exit criteria (no critical findings open).

**SUP.2.BP3: Record and track verification results**
Verification results (review records, inspection reports) are work products themselves (WP 13-04). They must be stored in the CM system, versioned, and associated with the reviewed artifact.

**SUP.2.BP4: Analyze and communicate verification results**
Summarize findings by severity: critical (blocks release), major (must fix), minor (should fix), observation. Communicate to author and project manager. Major/critical findings must be resolved before the reviewed artifact is baselined.

### Review Types Used in Practice

| Review Type | Formality | When Used |
|------------|-----------|-----------|
| Informal walkthrough | Low | Early draft review; quick sanity check |
| Peer review | Medium | Code review, test spec review |
| Technical review | High | SRS review, architecture review |
| Inspection (Fagan) | Very high | Safety-critical requirements or code; defect data collected for metrics |

### Code Review Checklist (subset)

```
□ Code matches the detailed design (no undocumented deviations)
□ All public functions have a header comment (purpose, params, return)
□ No function longer than 60 lines (or justified exception documented)
□ No magic numbers (use named constants)
□ All switch statements have a default case
□ All if/else chains handle all known values
□ Error return values checked (no ignored return codes)
□ MISRA C violations flagged and deviation recorded
□ No dynamic memory allocation (malloc/free)
□ Interrupt service routines are minimal (set flag only, process in task)
□ Shared variables protected by critical section / mutex
```

---

## SUP.4 — Joint Review

### Purpose

To maintain a common understanding with the customer of progress against the project objectives and what should be done to achieve those objectives.

### Process Outcomes

1. Joint reviews are conducted at key milestones or on request.
2. Actions required are agreed upon.
3. Relevant parties are kept informed of joint review results.

**Typical joint review agenda items:**
- Requirements status (open CRs, agreed changes)
- Milestone completion evidence (completed work products)
- Risk and issue review
- Problem resolution status
- Planned next steps

---

## SUP.7 — Documentation

### Purpose

To develop and maintain documented information required by the project.

### Process Outcomes

1. A documentation plan identifying the required documents is developed.
2. The standards to be applied to each document are identified.
3. Documents are produced and maintained according to applicable standards.
4. Documents are made available to authorized parties.

### Key Documentation Requirements for ASPICE Projects

| Document Class | Examples | ASPICE Requirement |
|----------------|---------|-------------------|
| Plans | QA Plan, Test Plan, Configuration Management Plan, Project Plan | Produced, controlled, reviewed |
| Technical Specifications | SRS, Architecture, Detailed Design, Interface Specs | Versioned, baselined, traceable |
| Test Documents | Test Specification, Test Cases, Test Results, Test Report | All linked; results reproducible |
| Records | Review Records, Change Records, Problem Records | Audit trail maintained |
| Release Documents | Release Notes, Software Bill of Materials | Traceable to baselined software |

---

## SUP.8 — Configuration Management

### Purpose

To establish and maintain the integrity of all identified work products of a project throughout the life cycle, and to make identified work products available to concerned parties.

### Process Outcomes

1. A configuration management (CM) strategy is developed.
2. Work products are identified and placed under configuration control.
3. Changes to work products are managed and controlled.
4. Baselines of identified work products are established.
5. The storage, handling, and delivery of work products is managed.
6. The status of the work products is communicated to relevant parties.

### Base Practices

**SUP.8.BP1: Develop a configuration management strategy**
The CM Plan defines: which work products are under CM, the CM tool(s), identifier/naming conventions, versioning scheme, branching/baselining rules, access controls, audit procedure.

**SUP.8.BP2: Identify configuration items**
Every work product placed under CM must have a unique identifier (CM item ID), version number, status (draft, reviewed, approved, obsolete), and owner.

**SUP.8.BP3: Establish branch and label strategy**
Define when branches are created (feature branches, release branches, hotfix branches). Define when baselines/tags are created (at each milestone, before every release candidate, at each approved version). Baselines are immutable.

**SUP.8.BP4: Control changes to configuration items**
No change to a baselined work product without a corresponding Change Request (SUP.10). The CR documents: what is changed, why, impact analysis on other items, approval authority.

**SUP.8.BP5: Store and archive work products**
All released work products must be stored in a way that guarantees retrieval for the product lifetime. Automotive ECU data must typically be retained for 15+ years (warranty, regulatory, re-programing requirements).

**SUP.8.BP6: Report configuration status**
Status accounting: regular reports of which WPs are at which version and in which state. This is often automated in modern tools (Jira, Polarion, DOORS).

**SUP.8.BP7: Verify the integrity of configuration items**
Periodic CM audits: verify that what is in the repository matches what is identified in the CM plan. Verify no untracked files exist in the build path.

### CM Naming Convention Examples

```
Documents:
  <project>-<type>-<seq>-<rev>.docx
  Example: PRJX-SRS-001-v3.2.docx

Source code branches:
  main                  ← integration branch
  release/1.4.x         ← release branch (no new features)
  feature/SWR-089-brake-override-fix   ← feature branch (linked to requirement)
  hotfix/CR-0042        ← hotfix branch

Baselines/Tags in Git:
  v1.0.0-RC1    ← Release candidate 1
  v1.0.0        ← Approved release
  MILESTONE-SWE6-COMPLETE ← Post-qualification test baseline
```

### Common Weaknesses Found in Assessments

- Source code in CM tool but documents stored on network share with no versioning
- Multiple versions of SRS in email attachments with same filename
- No CM plan — CM is practiced informally
- Baselines created but never audited against bills of materials
- SCM tool used only for code — test results, review records stored outside CM
- Build reproducibility: no mechanism to reproduce a specific released binary from source

---

## SUP.9 — Problem Resolution Management

### Purpose

To identify, analyze, manage, and track problems to resolution throughout the project.

### Process Outcomes

1. A problem resolution management strategy is developed.
2. Problems are recorded.
3. Problems are prioritized, classified, analyzed, and their root cause identified.
4. Solutions are developed and confirmed as resolving the problem.
5. Problems are tracked to closure.
6. Relevant parties are kept informed of problem status.

### Base Practices

**SUP.9.BP1: Develop problem resolution strategy**
Define: who can raise problems, what constitutes a problem (test failure, process non-conformance, technical anomaly), the tracking tool, status lifecycle (New → Open → In Analysis → Fix Ready → Verified → Closed), escalation criteria.

**SUP.9.BP2: Record problems**
Every problem is logged with: unique ID, date, severity (Critical/Major/Minor/Observation), description, reproducibility, environment/version, assignee.

**SUP.9.BP3: Classify and prioritize problems**
Classify by: origin (requirements, design, code, test), type (logic error, interface error, compiler/tool issue, requirement ambiguity), and impact on affected functions.

**SUP.9.BP4: Analyze problems for root cause**
For significant problems (all Safety/Critical severity), perform root cause analysis. Methods include: 5-Why, Ishikawa diagram, fault tree. Root cause determines whether a local fix or process improvement is needed.

**SUP.9.BP5: Develop resolution for problems**
Identify and implement the fix. Link the fix (code change, document update) to the problem record. For safety-relevant defects, assess the impact on the safety concept.

**SUP.9.BP6: Track problems to closure**
Track each problem until the fix is verified and the problem is formally closed. Re-test after fix. Verify no regression introduced.

**SUP.9.BP7: Communicate problem status**
Regular (weekly/sprint) problem resolution status reports: total open, by severity, by assignee, trend charts (new vs closed), aging (how long has each stayed open).

### Problem Record Minimum Content

```
PR-0042
Title: Brake pedal override does not activate at cold start (-40°C)
Date: 2025-11-14
Reporter: M. Fischer (SWE.6 test engineer)
Severity: Critical (safety-related SWR-089)
Status: In Analysis
Build: SW_v1.3.2
Environment: HIL bench, -40°C chamber
Reproducible: Yes (100%)
Description:
  During SYS.5 cold start test at -40°C, brake override function
  fails to set torque_setpoint = 0 when brake_pedal > 500 kPa.
  Expected: torque override activates within 20 ms after brake input.
  Actual: override never activates; CAN trace shows torque demand = 287 Nm.
Root Cause: ADC conversion factor not compensated for temp-dependent VREF drift.
Fix: Add VREF temperature compensation per hardware engineer note HWN-0093.
Fix verified: 2025-11-21 by retest. Result: PASS.
Closed: 2025-11-21
```

---

## SUP.10 — Change Request Management

### Purpose

To manage all change requests affecting baselined work products throughout the software life cycle.

### Process Outcomes

1. A change request management strategy is developed.
2. Change requests are recorded.
3. Change requests are evaluated for technical impact, resources, and schedule.
4. Changes are implemented, communicated, and tracked to closure.
5. Relevant parties are kept informed.

### Base Practices

**SUP.10.BP1: Develop change request management strategy**
Define: what constitutes a change request (modification to any baselined WP), tracking tool, CR lifecycle (New → Impact Assessment → Approved/Rejected → In Implementation → Implemented → Verified → Closed), approval authority levels.

**SUP.10.BP2: Record change requests**
Each CR includes: unique ID, requester, date, affected work products, description of change, reason for change, priority, and requestor approval.

**SUP.10.BP3: Evaluate change requests**
Impact assessment covers: which WPs are affected? What re-verification is required? What is the estimated effort? Does the change affect safety attributes or ASIL level? Is customer agreement needed?

**SUP.10.BP4: Approve/reject change requests**
Approval authority must be defined by the impact level. Minor typing corrections: peer approval. Requirement change: project manager + customer. Safety attribute change: safety manager + customer.

**SUP.10.BP5: Implement, verify, and close change requests**
Implement the change, link to affected work products, re-verify per the impact assessment, close the CR.

### Change Request Lifecycle in Practice

```
Customer sends a new functional requirement via email
  │
  ▼
CR logged in Jira: CR-0082 "Add Hill Hold Assist Control" ── Status: New
  │
  ▼
Impact Assessment:
  Affected WPs: CRS, SRS, SysArch, SWE.1 SRS, SWE.2 ArchDesign, SWE.3 DetailedDesign
  Effort: 3 sprint weeks
  Safety impact: New ASIL B function — add to safety concept? YES
  Customer approval needed: YES
  ── Status: Impact Assessed
  │
  ▼
Customer approves CR-0082 (meeting date 2025-12-03)
  ── Status: Approved
  │
  ▼
Engineering implements changes — all affected WPs updated, re-reviewed, re-tested
  ── Status: In Implementation
  │
  ▼
QA verifies that all affected WPs were updated and re-baselined
  ── Status: Verified
  │
  ▼
CR closed, all WP version references updated
  ── Status: Closed
```

---

## MAN.3 — Project Management

### Purpose

To identify, establish, and carry out project activities so that the project meets its objectives within defined resource constraints.

### Process Outcomes

1. The scope of work is defined.
2. Feasibility of achieving objectives is evaluated.
3. Project activities and estimates are developed.
4. Resources, infrastructure, and environment are allocated.
5. Responsibility and authority are defined.
6. Risks are identified.
7. Interfaces between involved parties are managed.
8. Project plans are monitored and adjusted.
9. Progress of the project is communicated.

### Base Practices

**MAN.3.BP1: Define the scope of work**
Document project objectives, deliverables, included scope, and explicitly excluded scope. In automotive projects, scope includes: functionality, interfaces (CAN DBs, software components), platforms, target markets, applicable standards (ASPICE cap level, ASIL level).

**MAN.3.BP2: Define project life cycle**
Choose a development process model (waterfall with gates, iterative V-model, agile sprints). Define phases (concept, development, integration, qualification, release), milestones, and entry/exit criteria per milestone.

**MAN.3.BP3: Evaluate feasibility of achieving project objectives**
Before committing to a plan, verify technical feasibility: can the requirements be met in the allocated schedule, with the available team, on the target hardware? Include build time, test environment availability, and supplier dependency lead times.

**MAN.3.BP4: Define, monitor, and adjust project activities and estimates**
Work Breakdown Structure (WBS) decomposes project work to task level. Each task has: owner, estimate (effort + duration), dependencies, and status. Tracked in weekly updates. When actuals deviate >15% from plan, replanning triggered.

**MAN.3.BP5: Ensure required skills, knowledge, and experience**
Competency matrix: list required skills (AUTOSAR, CAN, Python/CAPL for testing, specific tools) and assess team members against each. Gaps trigger training plans.

**MAN.3.BP6: Define communication mechanisms**
Establish: regular status meeting cadence, status report distribution list, escalation path (dev lead → project manager → program manager → customer), stakeholder communication plan.

**MAN.3.BP7: Involve relevant parties**
Identify all stakeholders (development, QA, safety manager, customer, sub-suppliers, tool vendors). Record contact, responsibility, and required involvement at each project phase.

**MAN.3.BP8: Monitor the project against the plan**
Track actual vs. planned: effort, schedule, defect trends, test completion, requirements coverage. Earned Value Management (EVM) or similar methods used for objective progress measurement.

**MAN.3.BP9: Take action to correct deviations**
When monitoring detects deviations, escalate, re-plan, or request customer change. Do not silently absorb deviations without formal replanning.

### Project Plan Minimum Content (ASPICE CL 2 per PA 2.1)

```
1. Project Scope and Objectives
2. Work Breakdown Structure (WBS)
3. Resource Plan (named roles, assigned tasks)
4. Schedule (Gantt chart or milestone table with dates)
5. Dependencies and Critical Path
6. Communication Plan
7. Milestone and Exit Criteria
8. Risk Register (see MAN.5)
9. Estimation Basis and Assumptions
```

### Common Weaknesses Found in Assessments

- Project plan exists but is only a Gantt chart — no effort estimates, no resource assignments
- Plan not updated when schedule slips ("the real schedule is in the PM's head")
- No monitoring records: no evidence of weekly comparison of actual vs. planned
- Corrective actions not recorded or tracked ("we discussed it in the meeting")
- Sub-supplier management absent: supplier's ASPICE compliance and deliverables not tracked

---

## MAN.5 — Risk Management

### Purpose

To identify and treat project risks throughout the project, so that their negative impact on project objectives is minimized.

### Process Outcomes

1. A risk management strategy is developed.
2. Risks threatening the project are identified.
3. Risks are analyzed and prioritized.
4. Risk treatment options are defined, selected, and implemented.
5. Risks are monitored and communicated throughout the project.

### Base Practices

**MAN.5.BP1: Develop a risk management strategy**
The risk management plan defines: risk identification methods (brainstorming, checklist, expert judgment), risk taxonomy (technical, schedule, resource, external), probability and impact scales, risk threshold/trigger criteria, and review cadence.

**MAN.5.BP2: Identify risks**
Risk identification sessions at project kickoff, at each phase start, and whenever major changes occur. Use structured checklists covering typical automotive SW project risks.

**MAN.5.BP3: Analyze risks**
Assess each risk for:
- **Probability**: Likelihood of occurrence (Low/Medium/High or 1–5 scale)
- **Impact**: Consequence on quality, schedule, or cost (Low/Medium/High)
- **Risk Exposure**: Probability × Impact

**MAN.5.BP4: Define and implement risk treatment**
For each risk above threshold, define treatment: Avoid (remove the risk condition), Mitigate (reduce probability or impact), Transfer (contractual, insurance), Accept (monitor only). Assign treatment owner and completion date.

**MAN.5.BP5: Monitor and report risks**
Review risk register at every status update. Update probability, impact, and treatment status. Newly identified risks added. Retired risks documented. Escalate risks threatening project milestones to management.

### Risk Register Example

```
ID     | Risk                          | P | I | Score | Treatment           | Owner    | Status
RK-001 | AUTOSAR supplier delivery 3w  | H | H | 9     | Early kickoff -2w   | PM       | OPEN
       | late — blocks integration     |   |   |       | meeting scheduled   |
RK-002 | MISRA compliance backlog >200 | M | M | 4     | Add static analysis | SW Lead  | MITIGATED
       | violations found at code rev  |   |   |       | to every commit CI  |
RK-003 | Test bench availability       | L | H | 3     | Reserve bench slots | Test Mgr | OPEN
       | shared with 3 other projects  |   |   |       | in facility booking |
RK-004 | Key engineer on medical leave | M | H | 6     | Knowledge transfer  | PM       | IN PROG
       | for 4 weeks mid-project       |   |   |       | to backup engineer  |
```

---

## MAN.6 — Measurement

### Purpose

To collect, analyze, and use measurement data to support effective management of processes and to provide objective insights about project performance.

### Process Outcomes

1. A measurement strategy is developed.
2. Measurement data is collected.
3. Measurement data is analyzed.
4. Measurement results are used to support decision-making.

### Base Practices

**MAN.6.BP1: Develop a measurement strategy**
Apply the Goal-Question-Metric (GQM) method:
1. **Goal**: What decision do we want to support?
2. **Question**: What questions must we answer to inform that decision?
3. **Metric**: What quantitative measure answers the question?

**MAN.6.BP2: Identify and collect measurements**
Define each metric: name, formula, data source, collection method, frequency, owner, and reporting format. Collect data consistently.

**MAN.6.BP3: Analyze measurement data**
Trend charts, control charts, histograms. Compare against targets. Identify outliers. Use data to validate estimates and forecasts.

**MAN.6.BP4: Use measurement data**
Feed measurement results into planning reviews, risk reviews, and process improvement decisions. Measurement data that is never acted upon is waste.

### GQM Example for SWE.6

```
GOAL: Ensure SW qualification test is complete before release
  QUESTION 1: Are all requirements covered by test cases?
    METRIC 1: Requirements coverage = (requirements with ≥1 test case / total requirements) × 100%
    TARGET: 100% before release
    SOURCE: Test management tool (e.g., Jira Zephyr, DOORS-RM link)

  QUESTION 2: Are all test cases passing?
    METRIC 2: Test pass rate = (passed test cases / total executed) × 100%
    TARGET: 100% (no outstanding Critical/Major failures)
    SOURCE: Test execution records

  QUESTION 3: Is regression execution current?
    METRIC 3: Regression recency = days since last full regression run
    TARGET: ≤ 5 business days
    SOURCE: CI/CD test pipeline (Jenkins build timestamp)
```

### Typical ASPICE Project Metrics

| Category | Metric | Target | Tool |
|----------|--------|--------|------|
| Requirements | Requirements coverage (SWE.6) | 100% | DOORS, Polarion |
| Requirements | Approved CRs vs pending CRs | <5 pending | Jira |
| Defects | Open defects by severity | 0 Critical open at release | Jira |
| Defects | Defect closure rate (weekly) | Upward trend | Jira dashboard |
| Test | Unit test pass rate | 100% last 5 builds | Jenkins + CppUTest |
| Test | Code coverage (SWE.4) | Branch ≥ defined target | Gcov/Bullseye |
| Process | QA findings closure rate | >80% closed within 2 weeks | SharePoint/Jira |
| Code | MISRA C compliance violations | 0 unapproved deviations | PC-lint/Polyspace |

### Common Weaknesses Found in Assessments

- Metrics collected but never reviewed in management meetings — data exists but is not acted upon
- Coverage metric calculated incorrectly (e.g., test files ratio vs. requirement coverage)
- Measurement plan written at project start but never updated when project scope changes
- Metrics reported at green/amber/red without underlying data backing the assessment
