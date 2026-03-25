---
title: Process Assessment Model (PAM)
createTime: 2026/03/25 00:00:00
permalink: /kb/embedded/aspice/process-assessment-model/
---

# Automotive SPICE Process Assessment Model (PAM)

## Role of the PAM

The Process Reference Model (PRM) defines *what* outcomes a process must produce. The Process Assessment Model (PAM) defines *how to measure* whether those outcomes are achieved. The PAM is the instrument assessors use to collect evidence, rate processes, and determine capability levels.

The PAM adds three constructs on top of the PRM:

| PRM Layer | PAM Addition | Description |
|-----------|--------------|-------------|
| Purpose | — | Inherited unchanged from PRM |
| Outcomes | — | Inherited unchanged from PRM |
| (not in PRM) | **Base Practices (BPs)** | Specific activities that, if performed, lead to the process outcomes |
| (not in PRM) | **Work Products (WPs)** | Artifacts produced or used that provide objective evidence |
| (not in PRM) | **Generic Practices (GPs)** | Activities that demonstrate capability beyond Level 1 |
| (not in PRM) | **Generic Resources (GRs)** | Resources needed to support generic practices |

---

## Two-Dimensional Assessment Model

ASPICE assessment operates in two independent dimensions:

```
┌────────────────────────────────────────────────────────────────┐
│                    PROCESS DIMENSION                           │
│   What the process does (Purpose, Outcomes, BPs, WPs)         │
│   ─────────────────────────────────────────────────────────   │
│   Measured by: PA 1.1 — Process Performance                   │
└────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────┐
│                   CAPABILITY DIMENSION                         │
│   How well the process is managed, defined, and optimized      │
│   ─────────────────────────────────────────────────────────   │
│   Measured by: PA 2.1, 2.2, 3.1, 3.2, 4.1, 4.2, 5.1, 5.2    │
└────────────────────────────────────────────────────────────────┘
```

A process can only achieve a particular Capability Level if it satisfies **all** Process Attributes at that level (and all levels below).

---

## Process Attributes (PAs)

ASPICE defines nine Process Attributes distributed across Capability Levels 1–5:

| CL | PA ID | PA Name | What It Measures |
|----|-------|---------|-----------------|
| 1 | PA 1.1 | Process Performance | Are the process outcomes being achieved? Are the base practices being performed? |
| 2 | PA 2.1 | Performance Management | Is process performance planned and monitored? Are responsibilities assigned? Are resources available? |
| 2 | PA 2.2 | Work Product Management | Are work products identified, controlled, and reviewed? Is status tracked? |
| 3 | PA 3.1 | Process Definition | Is there an organizational standard process definition? Is the project process derived from the standard? |
| 3 | PA 3.2 | Process Deployment | Is the standard process deployed in the project? Is process improvement communicated? |
| 4 | PA 4.1 | Process Measurement | Are process measures defined and collected? Are measures used to manage the process? |
| 4 | PA 4.2 | Process Control | Are statistical techniques used? Is process variation understood and controlled? |
| 5 | PA 5.1 | Process Innovation | Are improvement goals and targets defined? Are innovations identified and evaluated? |
| 5 | PA 5.2 | Process Optimization | Are changes implemented and monitored for effectiveness? |

---

## Rating Scale

Each Process Attribute is rated on the ISO/IEC 33020 four-level ordinal scale:

| Rating | Symbol | Achievement Range | Description |
|--------|--------|-------------------|-------------|
| Not achieved | N | 0%–15% | Little or no evidence that the attribute is achieved |
| Partially achieved | P | >15%–50% | Some evidence of achievement; some aspects may be unpredictable |
| Largely achieved | L | >50%–85% | Significant evidence; some weaknesses may still be present |
| Fully achieved | F | >85%–100% | Comprehensive evidence; no significant weaknesses |

### How PA Ratings Determine Capability Level

For a process to achieve a given CL, the PA ratings must satisfy:

| Capability Level | Required PA Ratings |
|-----------------|---------------------|
| CL 0 (Incomplete) | PA 1.1 = N |
| CL 1 (Performed) | PA 1.1 = F or L |
| CL 2 (Managed) | PA 1.1 = F AND PA 2.1 = F or L AND PA 2.2 = F or L |
| CL 3 (Established) | CL 2 satisfied AND PA 3.1 = F or L AND PA 3.2 = F or L |
| CL 4 (Predictable) | CL 3 satisfied AND PA 4.1 = F or L AND PA 4.2 = F or L |
| CL 5 (Optimizing) | CL 4 satisfied AND PA 5.1 = F or L AND PA 5.2 = F or L |

> **Important nuance from PAM v4.0**: To claim CL N, all PAs from PA 1.1 through the highest PA at CL N must be rated **F** — **except** the PAs at CL N itself, which must be rated **F or L**. All PAs at CL N-1 and below must have been rated **F** (not merely L) to cross the level boundary.

---

## Base Practices (BPs)

Base Practices are the primary instrument for determining PA 1.1 ratings. A BP describes a specific activity that contributes to achieving one or more of the process outcomes.

### BP Notation and Format

Each BP is identified with an ID, title, outcome mapping, and (in PAM v4.0) explicit isoRef:

```
SWE.1.BP1: Specify software requirements
   For each system requirement or function allocated to software, specify the 
   corresponding software requirement. The software requirements shall include 
   functional and non-functional requirements ...
   [Outcome: 1, 2]
   [WP Output: 08-52 Software Requirements Specification]
   [WP Input: 08-13 System Requirements Specification]
```

| Field | Description |
|-------|-------------|
| ID | `<process>.<BP n>` — e.g., SWE.1.BP1 |
| Title | Short imperative phrase |
| Description | Normative text defining what must be done |
| Outcomes | Numeric references to PRM outcomes this BP contributes to |
| WP Output | Work products this BP helps produce |
| WP Input | Work products this BP needs as input |

---

## Work Products (WPs)

Work Products provide the **objective evidence** for Base Practice performance. An assessor cannot give credit for a BP without seeing a corresponding work product (or equivalent evidence).

### WP ID System

ASPICE uses a two-segment numeric ID: `<category>-<seq>`.

| Category Range | Type |
|----------------|------|
| 01–09 | Project documents (plans, reports) |
| 10–19 | Requirements and design artifacts |
| 20–29 | Test artifacts |

Examples:
```
01-13  Project Plan
08-13  System Requirements Specification
08-52  Software Requirements Specification
02-01  SW Architectural Design
02-11  SW Detailed Design
04-06  Test Specification
04-07  Test Cases
13-50  Review Record
13-04  Problem Record
08-50  Change Request
```

### WP Characteristics

Each WP has defined **content characteristics** — the minimum content the artifact must contain for the assessor to consider it adequate evidence:

```
WP 08-52 Software Requirements Specification
Characteristics:
• Identification of requirements (unique IDs)
• Functional requirements
• Non-functional requirements (performance, timing, capacity, safety, security)
• Interface requirements
• Requirement rationale (where applicable)
• Traceability to system requirements / customer requirements
• Consistency markers (cross-references, definitions)
• Status information (approved, baselined version)
```

### WP States, Configuration, and Versions

Work products must be managed under configuration control. The PAM explicitly requires for PA 2.2:

1. **Identification**: Each WP has a unique ID, title, version, and status
2. **Controlled**: Changes go through a defined process (e.g., change request for baselined documents)
3. **Reviewed**: WPs are reviewed and approved before baseline
4. **Accessible**: WPs are retrievable by all authorized parties

---

## Generic Practices (GPs)

Generic Practices are the instrument for measuring CL 2–5 Process Attributes. Unlike BPs (which are process-specific), GPs apply uniformly across all processes. They describe *how well* the process is being managed, defined, and controlled.

### PA 2.1 — Performance Management Generic Practices

| GP ID | Title | Description |
|-------|-------|-------------|
| GP 2.1.1 | Identify the objectives for the performance of the process | Objectives should be defined in terms of quality, time, cost, or similar |
| GP 2.1.2 | Plan the performance of the process to fulfill the objectives | A plan exists (schedule, resources, milestones) |
| GP 2.1.3 | Monitor the performance of the process against the plan | Actual vs planned progress is tracked |
| GP 2.1.4 | Adjust the performance of the process | When deviations occur, corrective actions are taken |
| GP 2.1.5 | Define responsibilities and authorities for performing the process | Named roles with clear accountabilities |
| GP 2.1.6 | Identify and make available resources to perform the process | People, tools, environments, and budget allocated |
| GP 2.1.7 | Manage the interfaces between involved parties | Communication and collaboration mechanisms between roles defined |

### PA 2.2 — Work Product Management Generic Practices

| GP ID | Title | Description |
|-------|-------|-------------|
| GP 2.2.1 | Define the requirements for the work products | Content and quality criteria for each WP |
| GP 2.2.2 | Define requirements for documentation and control of work products | Templates, naming conventions, storage location |
| GP 2.2.3 | Identify, document, and control the work products | Versioning and unique identification |
| GP 2.2.4 | Review and adjust work products to meet defined requirements | Review records exist; corrections are tracked |

### PA 3.1 — Process Definition Generic Practices

| GP ID | Title | Description |
|-------|-------|-------------|
| GP 3.1.1 | Define the standard process that supports the deployment of the defined process | Org-level process definition document exists |
| GP 3.1.2 | Determine the sequence and interaction of the standard process with other processes | Process flow maps show inputs, outputs, and interfaces |
| GP 3.1.3 | Identify the roles and competencies for performing the standard process | Role profiles/competency matrices exist |
| GP 3.1.4 | Identify the infrastructure and work environment for performing the standard process | Toolchain, lab environments listed |
| GP 3.1.5 | Determine suitable methods for monitoring the effectiveness of the standard process | KPIs, review checklists, metrics plans |

### PA 3.2 — Process Deployment Generic Practices

| GP ID | Title | Description |
|-------|-------|-------------|
| GP 3.2.1 | Deploy a defined process that satisfies the context-specific requirements for the standard process | Project process tailored from the standard process |
| GP 3.2.2 | Assign and communicate roles, responsibilities, and authorities for performing the defined process | Project-level RACI exists |
| GP 3.2.3 | Ensure necessary competencies for performing the defined process are available | Training records, qualification evidence |
| GP 3.2.4 | Provide resources and information to support the performance of the defined process | Resource allocation confirmed |
| GP 3.2.5 | Collect and analyze data about the performance of the process | Process performance data collected and reviewed |
| GP 3.2.6 | Manage the interfaces between involved parties | Meeting minutes, communication logs show coordination |

### PA 4.1 — Process Measurement Generic Practices

| GP ID | Title | Description |
|-------|-------|-------------|
| GP 4.1.1 | Identify the process measurement information needs | What questions should measurement answer? |
| GP 4.1.2 | Define process measures that address the measurement information needs | Operational metric definitions |
| GP 4.1.3 | Collect process measurements | Actual data collected per the plan |
| GP 4.1.4 | Analyze process measurements | Trends, control charts, statistical summaries |
| GP 4.1.5 | Use the results of analysis to monitor and validate performance | Out-of-control conditions detected and acted upon |

### PA 4.2 — Process Control Generic Practices

| GP ID | Title | Description |
|-------|-------|-------------|
| GP 4.2.1 | Identify techniques for statistical control of the process | SPC methods documented |
| GP 4.2.2 | Establish suitable measures and frequency of measurement | Control limits and sampling strategy |
| GP 4.2.3 | Implement statistical control for the process | SPC charts, control action rules in place |
| GP 4.2.4 | Analyze special cause variation | Root cause analysis for out-of-control signals |
| GP 4.2.5 | Adjust the performance of the process | Process adjustments to respond to special causes |

### PA 5.1 — Process Innovation Generic Practices

| GP ID | Title | Description |
|-------|-------|-------------|
| GP 5.1.1 | Define process improvement objectives | Quantified improvement goals for the process |
| GP 5.1.2 | Analyze measurement data to identify areas of innovation | Mining process data for improvement opportunities |
| GP 5.1.3 | Identify innovations to implement improvements | New techniques, tools, or approaches evaluated |
| GP 5.1.4 | Assess the potential impact of each proposed innovation | Business case, benefit/risk analysis |
| GP 5.1.5 | Implement innovations to achieve improvement objectives | Change controlled innovation deployment |

### PA 5.2 — Process Optimization Generic Practices

| GP ID | Title | Description |
|-------|-------|-------------|
| GP 5.2.1 | Assess the impact of each implemented innovation against defined improvement objectives | Post-implementation review |
| GP 5.2.2 | Optimize the standard process using the results | Standard process updated to reflect improvements |

---

## Assessment Indicators

Assessors use two types of indicators to collect evidence:

### Process Performance Indicators (PPIs) — PA 1.1

PPIs are specific to each process. They include:
- **Base Practice Characterizations**: Does the assessor see evidence of each BP being performed?
- **Work Product Characterizations**: Does the WP contain the required characteristics?

### Capability Indicators (CIs) — PA 2.1 through PA 5.2

CIs are generic across processes:
- **Generic Practice Characterizations**: Evidence of each GP being performed in the context of this process
- **Generic Resource Characterizations**: Evidence that the resources supporting the GPs are available and used

---

## PAM Conformance Requirements

The ASPICE PAM must conform to ISO/IEC 33004 (Requirements for process reference, process assessment, and maturity models). Key conformance requirements:

1. The PAM must be derived from an ISO/IEC 33004-conformant PRM
2. Each process in the PAM must cover all capabilities from CL 0 to CL 5
3. The measurement framework must be based on the ISO/IEC 33020 rating scale
4. Assessors must use the PAM as defined; deviation must be documented and justified

---

## Evidence Hierarchy

In ASPICE assessments, evidence is weighted roughly as follows (most to least reliable):

```
Physical Work Products (documents, code, test reports with version/date stamps)
        │
        ▼ (higher confidence)

Runtime Demonstrations (tool demos, test execution, CI pipeline output)
        │
        ▼

Interviews with performed-task owners (engineers, QA leads)
        │
        ▼ (lower confidence)

Management/process owner interviews about intentions and plans
```

Assessors may **not** over-rely on interview testimony alone for rating. Objective evidence in work products is mandatory for F and L ratings on PA 1.1.
