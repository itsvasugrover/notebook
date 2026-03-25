---
title: Implementation Guide
createTime: 2026/03/25 00:00:00
permalink: /kb/embedded/aspice/implementation-guide/
---

# Automotive SPICE — Implementation Guide

## Overview

This guide describes how to practically implement ASPICE in an automotive software development project. It covers the road to CL 2 and CL 3, artifact templates, toolchain setup, traceability matrix structures, ISO 26262 integration, and common OEM finding patterns with remediation strategies.

---

## Starting Point: Assess Before You Plan

Before investing in process improvement, understand your current state. A gap analysis against the minimum CL 2 requirements (PA 1.1 = F, PA 2.1 ≥ L, PA 2.2 ≥ L) for each scoped process will identify the highest-value improvements.

```
Gap Analysis Priority Matrix:

High Value (implement first):
  ■ Requirement IDs — enables all traceability
  ■ Review records — blocks PA 2.2 across every process
  ■ CM tooling for documents — blocks PA 2.2 for all non-code WPs
  ■ Project plan with monitoring records — blocks PA 2.1

Medium Value:
  ■ Non-functional requirements in SRS — fixes PA 1.1 SWE.1 L → F
  ■ Traceability matrix — needed for SWE.4–SWE.6 BPs
  ■ Test result records — needed for PA 1.1 SWE.4, SWE.6

Lower Value (after CL 2 is stable):
  ■ Standard process definition (needed for CL 3, not CL 2)
  ■ Process metrics and GQM (needed for CL 3 PA 3.2 and CL 4)
```

---

## Road to CL 2 — Step by Step

### Step 1: Establish Configuration Management (SUP.8)

CM is the foundation. Without it, no WP can be "controlled" as required by PA 2.2.

**Minimum CM setup**:

```
Documents (use SharePoint/Confluence with versioning enabled):
  /project/
    /requirements/
      SRS_v1.0.docx  (never overwrite — always create new version file)
      SRS_v2.0.docx
      SRS_CURRENT → symbolic link or Confluence "current version"
    /design/
      SW_Architecture_v1.2.docx
    /test/
      Test_Specification_SWE6_v2.0.docx
      Test_Results_SWE6_RC1.xlsx
    /reviews/
      ReviewRecord_SRS_v2.0_2025-11-14.docx

Source code (Git):
  main branch → integration
  feature/* → feature development
  release/1.x → release branches
  tags: v1.0.0-RC1, v1.0.0 (milestone tags at every baseline)
```

**CM Plan minimum content**:
```
1. Scope: all WPs listed in WP 08-52, 02-01, 02-11, 04-06, 04-07, 04-08, 13-04, 13-22
2. Tool: Git for source code; Confluence for documents (versions ON, approval workflow ON)
3. Naming convention: <project>-<type>-<seq>-v<major>.<minor>.<docx|xlsx|pdf>
4. Branching: feature → main → release; tags at milestones
5. Baseline schedule: at each project milestone (SRS baseline, Architecture baseline, etc.)
6. Access control: read = all team; write = author; approve = reviewer + PM
```

---

### Step 2: Add Unique IDs to All Requirements

This is the single highest-leverage change for traceability. Without requirement IDs, no bidirectional traceability is possible, which blocks BP6 of SWE.1 and all traceability requirements in SWE.6.

**ID scheme design**:
```
Customer Requirements:   CRS-XXXX  (CRS-0001, CRS-0002, ...)
System Requirements:     SYS-XXXX  (SYS-0001, SYS-0002, ...)
Software Requirements:   SWR-XXXX  (SWR-0001, SWR-0002, ...)
HW Requirements:         HWR-XXXX
System Test Cases:       STC-XXXX
SW Unit Test Cases:      UTC-XXXX
SW Integration Tests:    SIT-XXXX
SW Qualification Tests:  SQT-XXXX

Rule: IDs are never reused. When a requirement is deleted, its ID is retired
      and its slot left blank with comment "RETIRED: reason+date".
      This prevents ID reuse and ambiguity in old traceability tables.
```

**Tooling options**:
| Tool | Cost | Traceability Support | Notes |
|------|------|---------------------|-------|
| IBM DOORS Next | High | Built-in link types | Industry standard; Polarion alternative |
| Polarion ALM | High | Built-in | Used at BMW/VW/Bosch |
| Jira + Zephyr | Medium | Issue links | Common with DevOps teams |
| Codebeamer | Medium | Good | Increasingly common |
| Excel/CSV | Free | Manual | Workable for small projects (<200 reqs) |
| ReqView | Low | Good | Lightweight DOORS alternative |

---

### Step 3: Create Review Records for All Baselined Work Products

Every WP must have an associated review record (WP 13-04). This is non-negotiable for PA 2.2.

**Minimum review record content** (template):

```markdown
# Review Record

| Field | Value |
|-------|-------|
| Review ID | RR-2025-047 |
| Date | 2025-11-14 |
| Reviewed Document | SRS v2.0 — Software Requirements Specification |
| Review Type | Peer Review |
| Reviewers | M. Fischer (SW Lead), A. Köhler (QA) |
| Review Format | Document review + walkthrough meeting |
| Checklist Used | SRS_Review_Checklist_v1.1 |

## Findings

| ID | Type | Severity | Location | Description | Disposition | Owner | Due | Status |
|----|------|----------|----------|-------------|-------------|-------|-----|--------|
| F001 | Defect | Major | SWR-089 | Timing requirement missing: no deadline specified | Accept | Fischer | 2025-11-18 | CLOSED |
| F002 | Question | Minor | SWR-013 | "shall be reliable" — not testable. Clarify? | Accept → Rephrase | Fischer | 2025-11-18 | CLOSED |
| F003 | Observation | Obs | SWR-044 | Redundant with SWR-022 — consider merge | Accept | Fischer | 2025-11-22 | CLOSED |

## Review Conclusion
All Major/Critical findings resolved. Document approved for baselining as SRS v2.0.

Signatures: M. Fischer (reviewer)  A. Köhler (reviewer)  Date: 2025-11-14
```

**Rule**: A WP may not be baselined until its review record shows no open Major or Critical findings.

---

### Step 4: Build the Project Plan for PA 2.1

The project plan must demonstrate performance management for each assessed process. It must contain:

```
Project Plan essentials for PA 2.1:

1. Work Breakdown Structure — per process:
   SWE.1 SW Requirements Analysis
     Task 1.1: Draft SRS v1.0 ......... Owner: Fischer ..... Start: W01 .... End: W04
     Task 1.2: Internal review ......... Owner: Köhler ...... Duration: 1w .. Dep: 1.1
     Task 1.3: Customer review ......... Owner: PM .......... Duration: 2w .. Dep: 1.2
     Task 1.4: Update SRS v2.0 ......... Owner: Fischer ..... Duration: 1w .. Dep: 1.3
     Task 1.5: Baseline SRS v2.0 ....... Owner: Fischer ..... Duration: 1d .. Dep: 1.4
   
   SWE.2 SW Architectural Design
     ...

2. Monitoring records: weekly status meeting minutes showing:
   - Planned vs actual task completion
   - Actions taken for deviations (date, person, action)
   - Resource allocation status
```

---

### Step 5: Build the Traceability Matrix

A traceability matrix (RTM) is the evidence for BP6 across all process pairs:

**Excel RTM structure**:
```
Column A: CRS-ID      (Customer Requirement)
Column B: CRS-Title
Column C: SYS-ID      (System Requirement)
Column D: SYS-Title
Column E: SWR-ID      (Software Requirement)
Column F: SWR-Title
Column G: Component   (SWE.2 allocation)
Column H: TC-ID       (Test Case)
Column I: TC-Title
Column J: Test-Result (PASS/FAIL/NOT RUN)
Column K: Notes
```

**Coverage formula** (for spreadsheet):
```
Requirements Coverage =
  COUNTIF(Column J, "PASS") / COUNTA(Column E) × 100%

Forward coverage check:
  Are there SWRs with no TC-ID?
  = COUNTBLANK(Column H) [must be 0 at release]

Backward coverage check:
  Are there TCs with no SWR-ID?
  = Check Column H has no entries not present in Column E
```

---

## Road to CL 3 — Organizational Standard Process

At CL 3, the process must be defined at **organizational** level, not just project level.

### Standard Process Definition Structure

The organizational process asset library (OPAL) contains:

```
OPAL/
  01_organization_process_overview.md     ← Process architecture, governance structure
  SWE/
    SWE.1_requirements_management_v2.0.docx
    SWE.1_srs_template_v3.0.docx
    SWE.1_review_checklist_v1.2.xlsx
    SWE.2_architecture_template_v1.1.docx
    SWE.2_review_checklist_v1.0.xlsx
    ...
  SUP/
    SUP.8_cm_procedure_v1.3.docx
    SUP.9_problem_resolution_v2.0.docx
    ...
  MAN/
    MAN.3_project_plan_template_v2.0.docx
    MAN.5_risk_register_template_v1.5.xlsx
  competency/
    role_profiles/
      sw_requirements_engineer_profile.docx
      test_engineer_profile.docx
    training_catalog.xlsx
  lessons_learned/
    2024_project_A_lessons.docx
    2023_project_B_lessons.docx
```

### Project Tailoring

For CL 3, every project must document how it tailored the standard process:

```markdown
# Project Tailoring Record — [Project Name]
Date: 2025-10-01
Reference Standard Process Version: SWE.1_requirements_management_v2.0.docx

| Aspect | Standard | Tailoring Applied | Justification |
|--------|----------|-------------------|---------------|
| SRS template | Template v3.0 | Added Appendix C (timing budget table) | Project has <1ms timing constraints not in standard template |
| Review checklist | v1.2 | Used as-is | No tailoring needed |
| Tool | DOORS Next | Jira + custom RTM spreadsheet | DOORS license budget not approved; PM agreed deviation |
| Review frequency | Before each baseline | Baseline review only (no interim) | Small team; continuous review not feasible |
```

Tailoring trade-off: the project can tailor the process, but must document WHY and demonstrate the tailoring doesn't compromise the process outcomes.

---

## Toolchain Recommendations

### Requirements Management

```
Recommended: Polarion ALM or IBM DOORS Next
  ✓ Native traceability links
  ✓ Baseline management (snapshots)
  ✓ Version history per requirement
  ✓ Review / approval workflow
  Caution: High cost, steep learning curve

Budget alternative: Jira + Xray/Zephyr
  ✓ Widespread adoption
  ✓ Test traceability to stories/requirements
  ✗ Requirement attribute management less mature
  Requires: manual RTM supplement for formal traceability evidence

Minimal: ReqView or Excel
  Suitable for projects with <300 requirements
  Must ensure versioning: SharePoint with file history or Git-tracked CSV
```

### Source Code Management

```
Git (mandatory):
  Host options: GitLab (self-hosted), GitHub Enterprise, Bitbucket Server, Azure DevOps
  
  Branch protection rules (enforce for ASPICE CL 2 evidence):
    main: require pull request + 1 reviewer approval + CI pass
    release/*: require 2 reviews + CI pass + manual QA gate
    
  Commit convention (links commits to CRs and requirements):
    Format: [SWR-089] Fix brake override timing in cold start
            [CR-0042] Update torque calculation per customer feedback
    
  Tag convention:
    v{major}.{minor}.{patch}-RC{n}  → Release candidate tags
    v{major}.{minor}.{patch}        → Release tags
    MILESTONE-{name}                → Process milestone tags
```

### Defect and Change Management

```
Jira Projects:
  Project: SW-DEFECTS (Problem Records per SUP.9)
    Issue type: Bug
    Fields: Severity, Affected Version, Root Cause, Resolution, Verification Status
    Workflow: New → In Analysis → Fix Ready → Verified → Closed
  
  Project: SW-CHANGES (Change Requests per SUP.10)
    Issue type: Change Request
    Fields: Affected WPs, Impact Assessment, Approval Status, Implementation Ref
    Workflow: New → Impact Assessment → Approved/Rejected → In Implementation → Verified → Closed
```

### Test Management

```
Zephyr Scale (Jira plugin) or Xray:
  ✓ Test cases linked to Jira requirements
  ✓ Test execution records versioned per build
  ✓ Coverage reports (requirements coverage)
  ✓ Traceability: requirement → test case → execution record

Excel fallback:
  Use for projects with <100 test cases
  Store in version-controlled location (Git or SharePoint with history)
  Include: test case ID, requirement link, preconditions, steps, expected result, pass/fail, date, build
```

### CI/CD for ASPICE Evidence

A well-configured CI pipeline automates evidence generation:

```yaml
# Example Jenkins/GitLab CI stage definitions aligned to ASPICE evidence needs

stages:
  - build
  - static_analysis
  - unit_test
  - coverage_check
  - integration_test
  - report

static_analysis:
  script:
    - polyspace-bug-finder --sources src/ --report reports/misra_report.pdf
  artifacts:
    paths: [reports/misra_report.pdf]          # WP 14-01 compliance evidence

unit_test:
  script:
    - cmake --build . --target unit_tests
    - ./unit_tests --gtest_output=xml:reports/unit_test_results.xml
  artifacts:
    paths: [reports/unit_test_results.xml]     # WP 04-08 evidence

coverage_check:
  script:
    - gcovr -r . --xml reports/coverage.xml
    - python check_coverage.py --min-branch 85 reports/coverage.xml
  artifacts:
    paths: [reports/coverage.xml]              # SWE.4 BP5 evidence
    
  # fail build if coverage below target → enforces PA 1.1 BP5
```

---

## ASPICE Integration with ISO 26262

ASPICE processes and ISO 26262 clauses are complementary — they share many work products and activities.

### Mapping ASPICE Processes to ISO 26262 Clauses

| ASPICE Process | ISO 26262 Clause (Part 6 SW) | Shared Work Products |
|---------------|------------------------------|---------------------|
| SWE.1 | 6.7 SW Requirements Spec | SRS (both reference it) |
| SWE.2 | 6.8 SW Architectural Design | SW architecture, HSI |
| SWE.3 | 6.9 SW Detailed Design; 6.10 SW Unit Implementation | Detailed design, source code |
| SWE.4 | 6.11 SW Unit Testing | Unit test spec, results, coverage report |
| SWE.5 | 6.12 SW Integration and Integration Test | Integration test spec + results |
| SWE.6 | 6.13 SW Testing | Qualification test spec + results |
| SYS.2 | 4 System Design (Part 4) | System Requirements Specification |
| SYS.3 | 4 System Architecture | System Architecture, HSI |
| SUP.1 | 5 Safety Management (Part 2) | QA plan, audit records |
| MAN.3 | 5 Project Management (Part 2) | Safety Plan, Project Plan |

### Practical Integration Rules

1. **One artifact, two purposes**: The SRS serves both ASPICE (WP 08-52) and ISO 26262 (6.7 SW Requirements Specification). It must satisfy both standards' content requirements in a single document.

2. **Safety attributes in requirements**: Every safety-relevant software requirement in the SRS must carry its ASIL. ASPICE auditors and ISO 26262 auditors both look for this.

3. **ASIL decomposition traceability**: If a system-level ASIL is decomposed across hardware and software (per ISO 26262 Part 4 Table 5), the traceability from the system safety requirement to the derived SW and HW safety requirements must be maintained. This is a SYS.2–SYS.3–SWE.1 traceability item.

4. **Review independence for ASIL D**: ISO 26262 ASIL D requires independent review. ASPICE SUP.2 requires verification. For ASIL D work products, these must both be addressed in the same review activity.

5. **Confirmation measures**: ISO 26262 Part 2 clause 5 defines safety activities including confirmation reviews and functional safety audits. These produce review records (WP 13-04 in ASPICE terms) and audit reports that satisfy both standards.

---

## Common OEM Finding Categories and Remediation

### Finding Category 1: Missing Non-Functional Requirements

**Finding (typical wording)**:
"SWE.1.BP1 — Partially: Software requirements do not include timing requirements. No deadline, execution time, or task period requirements specified in the SRS. SWE.1 PA 1.1 cannot achieve F due to incomplete process outcome 1."

**Remediation**:
1. Open Change Request for SRS update
2. Add section to SRS template: "Timing Constraints" and "Resource Constraints" tables
3. For each SW component: specify cyclic period (if applicable), response deadline, WCET budget, memory budget
4. Review with hardware team: validate that timing requirements are achievable on target MCU

---

### Finding Category 2: No Review Records

**Finding**:
"SUP.2 / PA 2.2 — Not Achieved: No evidence of review records for the SW Architectural Design (WP 02-01, v1.3). GP 2.2.4 requires evidence of review and adjustment of work products."

**Remediation**:
1. Create review record template (see Step 3 above)
2. Schedule retrospective review of architecture if it is still in draft; else note: "architecture review not performed for v1.3 — gap identified; review conducted for v1.4 (going forward)"
3. Document the review procedure in the QA plan (SUP.1)
4. Going forward: add "review record created" to every WP's definition of done

---

### Finding Category 3: Traceability Gaps

**Finding**:
"SWE.6.BP7 — Partially: Bidirectional traceability between qualification test cases and software requirements is not established. 23 of 185 software requirements (12%) have no linked test case."

**Remediation**:
1. Conduct requirements review to classify the 23 unlinked requirements:
   - Are they testable requirements with missing test cases? → Write test cases (SUP.10 CR for test spec update)
   - Are they non-testable requirements (constraints, standards compliance)? → Define alternative verification method (analysis, inspection) and document
2. Update RTM for all 23 requirements
3. Add automated coverage check to CI pipeline: fail build if RTM coverage < 100%

---

### Finding Category 4: Project Plan Not Maintained

**Finding**:
"MAN.3 PA 2.1 — Partially: GP 2.1.3 requires evidence of monitoring performance against the plan. Project plan was created at project kickoff but has not been updated since week 4. No deviation records or corrective action records exist."

**Remediation**:
1. Update project plan to reflect current state (retroactively is still better than not at all)
2. Establish weekly status meeting with minutes template including:
   - Tasks completed since last meeting
   - Tasks planned vs tasks actually done (with deviation explanation)
   - Actions and corrective measures with owners and dates
3. Store meeting minutes in CM system with date stamps
4. Going forward: plan update is a standing agenda item at every weekly status meeting

---

### Finding Category 5: Informal CM

**Finding**:
"SUP.8 PA 1.1 — Partially: Source code is version-controlled in Git. However, work product documentation (SRS, architecture, test plans, review records) is stored in an unversioned Teams folder. Multiple versions of the SRS exist in team members' email (attached). No CM Plan document found. BP1 not demonstrated for document artifacts."

**Remediation**:
1. Migrate all document WPs to version-controlled location (Confluence, SharePoint with versioning ON, or Git)
2. Create CM Plan (1–3 pages: scope, tool, naming, branching, baselining, access control)
3. Define "single source of truth" for each WP class: no parallel copies in email/Teams
4. Conduct CM audit after migration: verify all WPs at expected version, no orphan files

---

## Project Startup Checklist (ASPICE-aligned)

Use this at the start of every project to ensure CL 2 infrastructure is in place before first deliverables are produced:

```
□ CM system configured: document versioning on, SCM branch strategy defined
□ CM Plan created and baselined (even if 2 pages)
□ Project Plan created with WBS, resource assignments, and milestone schedule
□ QA Plan created and baselined
□ Requirements management tool set up: project/folder structure, ID scheme, traceability links
□ SRS template distributed to requirements engineers
□ Architecture design template available
□ Review record template available
□ Test plan template available
□ Problem tracking system created (Jira project or equivalent)
□ Change request workflow configured
□ Risk register initialized in project plan
□ Traceability matrix structure created (even if empty — ready for population)
□ Roles and responsibilities defined and communicated
□ Team trained on process: review checklist, CM procedure, defect reporting
□ Entry criteria for first milestone meeting defined
```

---

## Summary: The Minimum Viable ASPICE CL 2 Implementation

Distilled to the absolute minimum required to achieve CL 2 on all SWE/SYS/SUP/MAN processes:

| What | Why | Where |
|------|-----|-------|
| Unique requirement IDs in SRS | Traceability (all SWE BPs) | Requirements tool or Excel |
| Version-controlled documents | PA 2.2 GP 2.2.3 | SharePoint or Confluence |
| Review records for all baselined WPs | PA 2.2 GP 2.2.4 | Review records in CM |
| Project plan with WBS + resource names | PA 2.1 GP 2.1.2 + 2.1.5 | Project plan document in CM |
| Weekly status notes with actual vs planned | PA 2.1 GP 2.1.3 | Meeting minutes in CM |
| CM Plan (even 2 pages) | SUP.8 BP1 | In CM |
| Traceability matrix (bidirectional) | SWE.1 BP6, SWE.6 BP7 | Linked in requirements tool |
| Test results with build ID and timestamps | SWE.4/SWE.6 PA 1.1 | Test management tool or CM |
| Problem records with severity and closure | SUP.9 PA 1.1 | Jira or equivalent |
| Non-functional requirements in SRS | SWE.1 PA 1.1 | SRS document |
