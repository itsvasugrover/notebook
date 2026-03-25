---
title: Assessment Execution
createTime: 2026/03/25 00:00:00
permalink: /kb/embedded/aspice/assessment-execution/
---

# Automotive SPICE — Assessment Execution

## Assessment Types

ASPICE distinguishes several types of assessments with different scope, rigor, and output:

| Assessment Type | Description | Who Leads | Output |
|----------------|-------------|-----------|--------|
| **Full Conformant Assessment** | Rigorous, covers all scoped processes, uses complete PAM, produces official ratings | Certified intacs assessor | Assessment Output Document (AOD), Assessment Report |
| **Self-Assessment** | Organization assesses itself against PAM | Internal ASPICE-trained engineers | Internal capability profile |
| **Gap Analysis** | Identifies gaps against a target profile, not official ratings | Process improvement consultant or internal QA | Gap report with improvement actions |
| **Informal Assessment / Health Check** | Structured interviews and WP review to identify risk areas | Coach or internal QA | Findings list |
| **Audit / Compliance Check** | Verify that a supplier meets a contractually demanded CL profile | OEM supplier quality team or external assessor | Accept/Reject supplier decision |

---

## Roles in an ASPICE Assessment

### Assessment Sponsor

The person/organization who commissions and funds the assessment. In a supplier-development context, this is typically:
- The OEM's Supplier Quality Manager (for a supplier assessment)
- The Tier-1's internal process improvement owner (for a self-assessment)

Responsibilities:
- Defines assessment scope (processes, projects, target CL profile)
- Approves release of assessment results
- Ensures access to evidence and personnel

### Assessment Team

| Role | Responsibility |
|------|---------------|
| Lead Assessor | Accountable for assessment quality and conformance to the PAM; makes final rating decisions; compiles the AOD |
| Assessor | Collects evidence, performs interviews, rates individual processes |
| Assessor Trainee | Observes and may collect evidence under supervision; does not independently rate |
| Assessment Team Support | Logistics, scheduling, tool access, note-taking |

### Assessed Organization Representatives

| Role | Responsibility |
|------|---------------|
| Organizational Champion | Single point of contact for the assessed org; coordinates access |
| Process Owner/Engineer | Subject-matter expert for each assessed process; present during interviews |
| Project Manager | Provides project context, plans, monitoring records |
| Tool/CM Administrator | Demonstrates CM tool, provides access to repositories |

---

## intacs Assessor Competency Levels

The international automotive task force (intacs) certification scheme defines three assessor levels:

| Level | Name | Requirements |
|-------|------|-------------|
| Provisional Assessor (PA) | Entry level | ASPICE Foundation course, 1 full assessment as observer, knowledge exam |
| Competent Assessor (CA) | Active lead | ≥3 full assessments including ≥1 as co-lead, CA exam |
| Principal Assessor (PRA) | Highest level | ≥10 full assessments, leadership of ≥5, intacs PRA exam and endorsement |

Assessors must maintain certification through continuing professional development (CPD) and recent assessment activity. intacs maintains a public register of certified assessors.

---

## Assessment Phases

A full ASPICE assessment follows five phases:

```
Phase 1: ASSESSMENT INITIATION
  └── Define scope, boundaries, constraints
  └── Assemble assessment team
  └── Agree schedule and logistics
  └── Prepare assessment plan

Phase 2: ASSESSMENT INSTRUMENT PREPARATION
  └── Prepare process-specific question sets
  └── Prepare WP review checklists per process
  └── Customize evidence collection guides

Phase 3: DATA COLLECTION
  └── Document review sessions
  └── Interviews with process owners and engineers
  └── Tool demonstrations
  └── Evidence tagging and labeling

Phase 4: DATA VALIDATION AND RATING
  └── Team consolidation session
  └── PA-by-PA rating per process
  └── Calibration across assessors
  └── Resolve disagreements via Lead Assessor decision

Phase 5: REPORTING
  └── Draft Assessment Output Document (AOD)
  └── Review with assessed organization (factual accuracy check)
  └── Finalize and deliver AOD + Assessment Report
```

---

## Phase 1: Assessment Initiation

### Scope Definition

The assessment scope is agreed between the assessor and sponsor before the assessment begins:

```
Scope Definition includes:
  ├── Assessed organizational unit (which team, which site, which project)
  ├── Assessed processes (e.g., SWE.1–SWE.6, SUP.8, SUP.9, MAN.3)
  ├── Target capability level profile (e.g., all processes at CL 2)
  ├── Life cycle phase of the project (concept / development / integration)
  ├── Assessment purpose (improvement / supplier audit / internal gate)
  └── Constraints (duration, confidentiality, rating ownership)
```

### Assessment Plan Content

```
1. Assessment purpose and context
2. Assessed processes and CL targets
3. Assessment team composition with competency
4. Assessment schedule (days, sessions per process)
5. Evidence collection approach
6. Confidentiality and data handling
7. Output document format and distribution
```

---

## Phase 2: Instrument Preparation

Assessors prepare process-specific question sets aligned to the PAM. These are not rigidly scripted — they are guides to ensure all BPs, GPs, and WP characteristics are covered.

### Sample Interview Questions — SWE.1

```
BP1 — Specify software requirements:
  "Walk me through how you capture a software requirement when it comes from the system team."
  "Show me an example requirement in your SRS. How is it identified? What attributes does it have?"

BP6 — Bidirectional traceability:
  "How do you maintain traceability between software requirements and system requirements?"
  "If I pick a random system requirement, can you show me the corresponding SW requirements?
   And if I pick a random SW requirement, can you show me its origin in the SRS?"

PA 2.2 — Work product management:
  "Where is the SRS stored? What version are we looking at today?"
  "How is a new version of the SRS created and approved?"
  "Show me the review record for this version of the SRS."
```

### WP Checklist — SRS (WP 08-52) Spot Check

```
□ Unique IDs present for all requirements
□ Functional requirements clearly documented
□ Non-functional requirements present (timing, memory, WCET)
□ Interface requirements present (HW interfaces, comms protocol params)
□ Traceability column/link to SYS requirements populated
□ ASIL attributes present for safety requirements
□ Acceptance criteria or test method defined per requirement
□ Version/date and approval status visible
□ Review record exists and links to this version
```

---

## Phase 3: Data Collection

### Evidence Collection Guidelines

Evidence is tagged against specific Process Attribute Sub-practices (BPs or GPs). Every rating must be traceable to evidence.

| Evidence Type | Examples | Notes |
|--------------|---------|-------|
| Physical work products | SRS, architecture document, test report, review record | Most reliable; check version/date stamp |
| Tool records | Git commit history, Jira issue list, DOORS traceability view, CI build results | Export or screenshot with timestamp |
| Runtime demonstrations | Show CM tool branching, run test in CI pipeline | Harder to falsify; confirms tool is actually in use |
| Interviews | Engineer explains their daily process, explains a real example | Corroborate with WPs; do not accept interview alone for F rating |

### Interview Techniques

**Evidence-oriented questions**: Start with the work product, then probe depth.
```
"Can you show me the test specification for SWE.4?"
  → If it exists: drill into its contents
  → If it doesn't exist: that is a finding
```

**Scenario-based questions**: Test the process, not the knowledge.
```
"Suppose I find a bug that was missed in unit testing and only appears in SWE.6. 
 Walk me through exactly what happens from when the test fails to when the SRS is potentially updated."
```

**Reverse-trace questions**: Expose traceability gaps.
```
"Take test case QT-089. Which software requirement is it verifying? 
 Which system requirement does that trace to? 
 Can you show me the traceability record?"
```

**Common interview patterns that indicate problems**:
- "We did that but didn't document it" → BP may not be credited
- "It's all in the engineer's head" → PA 2.2 gap; knowledge not transferred to WP
- "We use [Tool X] for that" → Ask for a demonstration — tool use ≠ process execution
- "Our process is agile, so we don't do that" → Agile is not an ASPICE exemption; outcomes still required

### Evidence Tagging Example

During data collection, assessors tag evidence:

```
Evidence Tag #007
Process: SWE.1
PA / BP: PA 1.1 / BP6 (Bidirectional traceability)
Evidence type: Work product
Description: Traceability matrix (RTM) between SRS v3.1 and System Requirements Spec v2.4
Location: DOORS project PROJ-X / module "SW-SYS Traceability" exported 2025-11-14
Indicator: Forward: 183/185 SWRs linked to SYS-REQ (98%). Backward: 47/47 SYS-REQs linked.
           2 SWRs (SWR-178, SWR-179) not linked — observed as gap.
Contribution: Partial — main traceability structure present; 2 gaps to be noted.
```

---

## Phase 4: Data Validation and Rating

### Consolidation Session

After evidence collection, the assessment team meets to:
1. Share all evidence collected per process
2. Discuss gaps and ambiguities
3. Rate each Process Attribute per process using the 4-point scale (N/P/L/F)
4. Aggregate PA ratings to CL determination
5. Calibrate: ensure rating consistency across assessors

### Rating Rules

**PA 1.1 Rating Derivation**:
- How many BPs have objective evidence of performance?
- Do the WPs have the required content characteristics?
- Rating is aggregated judgment: not a simple count, but a qualitative assessment of what fraction of the PA is demonstrated

**CL Derivation from PA Ratings**:
```
PA 1.1 rated separately for each process.

CL 1: PA 1.1 ≥ L (>50%)

CL 2: PA 1.1 = F AND PA 2.1 ≥ L AND PA 2.2 ≥ L
  (If PA 1.1 = L, CL stops at 1 regardless of PA 2.x ratings)

CL 3: All CL 2 PAs = F AND PA 3.1 ≥ L AND PA 3.2 ≥ L
  (All lower level PAs must be F to advance)

CL 4: All CL 3 PAs = F AND PA 4.1 ≥ L AND PA 4.2 ≥ L

CL 5: All CL 4 PAs = F AND PA 5.1 ≥ L AND PA 5.2 ≥ L
```

### Judgment Protocol

When two assessors disagree on a rating:
1. Each presents their evidence rationale
2. Discuss gaps in evidence collection
3. If still unresolved: Lead Assessor makes the final decision and documents the rationale
4. A minority view can be recorded in the AOD

---

## Phase 5: Assessment Reporting

### Assessment Output Document (AOD)

The AOD is the formal output of a conformant ASPICE assessment. Its structure is defined by intacs:

```
Assessment Output Document
  1. Assessment purpose, scope, and context
  2. Assessment sponsor and team
  3. Assessed organizational unit
  4. Assessment input: processes assessed, CL profile targeted
  5. Assessment results:
     ├── Capability Level Profile (table: process vs. achieved CL)
     ├── Process Attribute ratings per process (PA 1.1 through PA 5.2)
     └── Summary of strengths and weaknesses per process
  6. Assessment constraints and limitations
  7. Assessment date and assessor credentials
  8. Assessor signatures
```

### Capability Level Profile Table (Example)

```
Process     │ PA 1.1 │ PA 2.1 │ PA 2.2 │ PA 3.1 │ PA 3.2 │  CL
────────────┼────────┼────────┼────────┼────────┼────────┼──────
SWE.1       │   L    │   P    │   L    │        │        │   1
SWE.2       │   F    │   L    │   F    │        │        │   2
SWE.3       │   F    │   F    │   L    │        │        │   2
SWE.4       │   F    │   F    │   F    │   L    │   L    │   3
SWE.5       │   F    │   L    │   F    │        │        │   2
SWE.6       │   F    │   F    │   F    │        │        │   2
SYS.2       │   F    │   L    │   F    │        │        │   2
SUP.8       │   F    │   F    │   F    │        │        │   2
SUP.9       │   L    │   P    │   P    │        │        │   1
MAN.3       │   F    │   F    │   F    │        │        │   2
```

Blank cells = not assessed at that level (prerequisite PA not achieved).

### Strengths and Weaknesses Per Process

The AOD includes a narrative section for each process:

```
SWE.1 — Software Requirements Analysis
  CL Achieved: 1

  Strengths:
    + SRS exists and covers all major functional requirements
    + Requirements have rationale comments
    + Engineering team demonstrates good understanding of customer intent

  Weaknesses (justifying PA 1.1 = L):
    - Non-functional requirements (timing, memory, stack) not documented
    - Requirement IDs not stable — requirements renumbered at each SRS revision (traceability broken)
    - Acceptance criteria absent for 40% of requirements

  Weaknesses (justifying PA 2.1 = P):
    - No project plan entry for SWE.1 — requirements development not planned
    - Responsibility for SRS not formally assigned

  Note: CL 2 cannot be claimed because PA 1.1 = L (must be F for CL 2 progression)
```

---

## Preparing for an ASPICE Assessment — Practical Checklist

### 4 Weeks Before Assessment

```
□ Confirm scope and process list with lead assessor
□ Identify one engineer per process who knows the work best
□ Verify all key work products are present, versioned, and accessible
□ Check that review records exist for every baselined WP
□ Confirm traceability matrices are populated and bidirectional
□ Run internal self-assessment against PAM checklist and close gaps
□ Ensure CM system is accessible and organized (no orphan files)
□ Prepare brief project overview presentation (2–3 slides max)
```

### 1 Week Before Assessment

```
□ Provide assessment team with: project plan, process list, tool access credentials
□ Book rooms with display/projection for document review sessions
□ List CM locations for all WPs (so review sessions don't lose time searching)
□ Prepare demo scenarios for CM tools, test management tools, CI pipeline
□ Assign a dedicated contact per process for scheduling interviews
```

### During the Assessment

```
□ Answer questions specifically and concisely — do not pre-empt
□ Show evidence rather than claim ("let me show you" > "yes, we do that")
□ If something doesn't exist, say so — assessors respect honesty
□ Keep notes on assessor questions to identify gap patterns
□ Raise objections during the assessment if you disagree with a finding — 
  not after the AOD is finalized
□ Do NOT retroactively create documents during the assessment week
```

### Common Mistakes That Hurt Assessment Outcomes

| Mistake | Consequence |
|---------|------------|
| Creating documents during the assessment | Assessors will time-stamp check — retrospective artifacts are not evidence |
| Telling assessors about the process without showing work products | Interview without WP = at best PA claim, not F rating |
| Having one "ASPICE expert" speak for all processes | Assessors notice when engineers can't describe their own process |
| Claiming a tool used for CM that the team can't demonstrate | Tool license ≠ tool use |
| Showing test results but no traceability to requirements | PA 1.1 gap regardless of test quality |

---

## Assessment Output Use

### Improvement Planning

After the AOD is received, the organization should:

1. Prioritize findings by: gap to target CL + effort to fix + project schedule
2. Create an improvement plan: for each finding, one or more improvement actions with owner and date
3. Track improvement actions to completion
4. Conduct a follow-up assessment or gap review after 6–12 months

### Supplier Rating and Contract Implications

OEMs use assessment results as:

| OEM Use | Implication for Supplier |
|---------|--------------------------|
| New business decision gate | CL profile must meet minimum before contract award |
| PPAP/SOP gate | Must achieve CL profile before start of production release |
| Ongoing monitoring | Annual re-assessment or continuous process KPI reporting |
| Contractual penalty clause | Failure to maintain agreed CL can trigger financial penalties or disqualification |

### Self-Assessment vs. Customer Assessment

A self-assessment should produce the same ratings as an external assessment — but must be conducted by trained ASPICE assessors, not by the engineers who performed the work.

```
Objectivity Requirements for Self-Assessment:
  ✓ Assessors must be trained in PAM interpretation
  ✓ Assessors must not assess processes they personally executed
  ✓ The assessment output must be reviewed by an independent party
  
  Common failure mode: "We assessed ourselves at CL 2 on all processes"
    but OEM external assessment rates most processes at CL 1
    because self-assessors were too lenient with PA 1.1 ratings
```
