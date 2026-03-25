---
title: Tools, Integration, and ISO 26262 Ecosystem
createTime: 2026/03/25 00:00:00
permalink: /kb/embedded/asil/tools-integration/
---

# Tools, Integration, and ISO 26262 Ecosystem

## Tool Qualification in ISO 26262

### Why Tools Must Be Qualified

Safety-critical software is developed and verified using tools. If a tool has a bug, it can introduce errors into the safety product without the engineer noticing — a classic example of a systematic failure. ISO 26262 Part 8 (§11) defines requirements for qualifying development tools to prevent tool errors from propagating into the safety product undetected.

```
Example of a tool error causing a safety violation:

  Scenario: Compiler optimization bug
  - Developer writes correct C code for the torque monitor
  - Compiler with optimization level O2 incorrectly reorders two instructions
  - Resulting binary does NOT implement the safety function correctly
  - SW unit tests pass (they execute the C source semantics, not the binary)
  - ECU is released with a latent ASIL D SW defect caused by the compiler

  Tool qualification addresses this by:
  1. Identifying that the compiler is safety-critical (TCL-3)
  2. Requiring validation of the compiler against the specific 
     optimization flags used
  3. Providing evidence that the compiler's output is correct for 
     the patterns used in the safety SW
```

---

## Tool Confidence Level (TCL)

TCL is a three-level classification (TCL-1, TCL-2, TCL-3) that determines how much qualification effort is needed.

### TCL Determination Method

TCL is determined from two dimensions:

**Tool Impact (TI)**: How severely could an undetected tool error affect the safety product?

```
TI1: The tool cannot introduce an error into the safety product, or 
     any error it introduces can be detected by an independent measure.
     Example: Documentation generator — output is reviewed by human

TI2: The tool could introduce an error that might NOT be detected by 
     another measure. The tool's output is trusted without full independent verification.
     Example: Compiler — output binary is not line-by-line reviewed
```

**Tool Error Detection (TD)**: How likely is it that a tool error would be detected before it affects safety?

```
TD1: High confidence that tool errors are detected.
     - Output is completely reviewed by a qualified person
     - OR an independent tool produces the same result

TD2: Medium confidence — tool error potentially detectable during 
     testing or verification activities but not guaranteed.

TD3: Low confidence — tool error could propagate without detection.
     Only detected when the system fails (too late for safety).
```

**TCL Mapping**:

| TI \ TD | TD1 | TD2 | TD3 |
|---------|-----|-----|-----|
| TI1 | TCL-1 | TCL-1 | TCL-1 |
| TI2 | TCL-1 | TCL-2 | TCL-3 |

- **TCL-1**: No qualification required (error either impossible or fully detectable)
- **TCL-2**: Validation required — show the tool works correctly for its safety use
- **TCL-3**: Qualification required — rigorous evidence of tool correctness

---

## Tool Qualification Methods

### For TCL-2 (Validation)

TCL-2 requires demonstrating that the tool produces correct output for the specific usage patterns in the project.

```
TCL-2 Qualification methods (ISO 26262 Part 8 §11.4.8):

Option A: Increased confidence from use
  - Document the tool's history of use in safety projects
  - Demonstrate no known unresolved safety-relevant bugs in the used version
  - Requires: revision-locked tool version + known bug list reviewed

Option B: Validation of the tool:
  - Derive test cases from the tool's specification
  - Execute test cases against the tool in the usage context
  - If all test cases pass: tool is validated for this usage

Option C: Development artefacts evaluation:
  - Review the tool's development documentation
  - Verify the tool itself was developed per appropriate safety process
  (This is what certified tools like GreenHills MULTI or IAR versions claim)
```

### For TCL-3 (Qualification)

TCL-3 is the highest level and typically used for compilers, static analysis tools, or test automation tools that directly affect the safety product content.

```
TCL-3 Qualification methods:

1. Use a pre-certified tool:
   Some tool vendors provide ISO 26262 Tool Qualification Kits (TQK):
   - Green Hills MULTI Compiler: ASIL D certification kit available
   - IAR Embedded Workbench: qualification report for specific versions
   - Polyspace Code Prover: qualified at TCL-3 per MathWorks qualification kit
   
2. Rigorous tool validation:
   - Specify the tool's safety functionality (what it must correctly do)
   - Derive test cases from the specification covering all safety-relevant features
   - Execute test cases on the exact tool version used in production
   - Document pass criteria and results
   - Lock the tool version (no updates without re-establishing qualification)

3. Know and avoid tool errata:
   - Obtain vendor's list of known bugs for the exact version used
   - Review all known bugs against safety-relevant usage patterns
   - For any bug that could affect safety SW: avoid that usage pattern (documented restriction)
   OR patch the tool and re-qualify
```

### Tool Qualification Plan

```
Tool Qualification Plan structure (required for TCL-2/3):

For each tool used in safety activities:
  Tool:           Green Hills MULTI Compiler v2021.1.5
  TCL:            TCL-3
  ASIL:           ASIL D
  Usage:          Compiling all ASIL D SW modules (C to ARM ELF binary)
  Critical flags: -On (optimization level 1), -gnu99, -arm64, 
                  Disabled flags: -O2 and higher (not qualified)
  Method:         Use vendor-provided ASIL D qualification kit v5.1.2
  Evidence:       Compiler test suite results (1247 test cases), all passed
  Restrictions:   No C++ exceptions; No computed goto; No VLAs
  Version lock:   Tool binary hash SHA256: 0xABCD...
  Responsible:    Tool Qualification Engineer: J. Smith
  Date:           March 2026
```

---

## Commonly Used Safety Tools and Their TCL

| Tool | Typical Use | Typical TCL | Qualification Available? |
|------|------------|------------|--------------------------|
| Green Hills MULTI | C/C++ compiler | TCL-3 | Yes (ASIL D kit) |
| IAR Embedded Workbench | C/C++ compiler | TCL-3 | Yes (ASIL D kit) |
| TASKING TriCore CC | Aurix compiler | TCL-3 | Yes |
| GCC / clang | Compiler (open source) | TCL-2/3 | No formal kit; requires custom validation |
| Polyspace Code Prover | Static analysis (formal) | TCL-3 | Yes (MathWorks kit) |
| LDRA Testbed | Coverage measurement + MISRA | TCL-2/3 | Yes |
| Cantata++ | Unit test framework + coverage | TCL-2/3 | Yes |
| GoogleTest | Unit test framework | TCL-2 | No formal kit; validation required |
| Vector CANoe | System test automation | TCL-2 | Yes (Vector qualification) |
| MATLAB Simulink | Model-based design (code gen) | TCL-3 (code gen) | Yes (Embedded Coder qualification kit) |
| dSPACE HIL simulator | HIL test environment | TCL-2 | Yes |
| JIRA + Doors | Requirements management | TCL-1/2 | Tool validation documentation required |
| Jenkins CI | Build automation | TCL-2 | Custom validation required |
| Conan + Artifactory | Artifact management | TCL-1 | No safety relevance if output is reviewed |

---

## AUTOSAR and ISO 26262

### AUTOSAR Classic Platform Safety Architecture

AUTOSAR Classic provides a standardized software architecture for ECUs. From an ISO 26262 perspective:

```
AUTOSAR Classic SW Stack:

  ┌──────────────────────────────────────────────────────────────┐
  │                 Application Layer (SWCs)                     │  ← Developed to ASIL per FSR
  │  TorqueMonitor.c  SensorPlausibility.c  TorqueControl.c      │
  └──────────────────────────┬───────────────────────────────────┘
                            RTE (Runtime Environment)              ← Configured by AUTOSAR tools
  ┌──────────────────────────┴───────────────────────────────────┐
  │                     Basic Software (BSW)                     │
  │  ┌──────────────────────────────────────────────────────┐   │
  │  │  Service Layer: OS, WdgM, DiagMgr, ComM, NvM, FIM    │   │ ← Pre-qualified BSW components
  │  ├──────────────────────────────────────────────────────┤   │
  │  │  ECU Abstraction: McuDrv, PortDrv, AdcDrv, PwmDrv    │   │
  │  ├──────────────────────────────────────────────────────┤   │
  │  │  MCAL: low-level hardware drivers                     │   │
  └──────────────────────────────────────────────────────────────┘
                            Hardware (MCU)
```

### Safety-Relevant AUTOSAR BSW Modules

| Module | Safety Relevance |
|--------|----------------|
| WdgM (Watchdog Manager) | Manages SW supervision (alive, deadline, logical) — ASIL D |
| E2E Library | E2E protection for inter-ECU communication — ASIL D |
| FiM (Function Inhibition Manager) | Inhibits functions when their safety preconditions aren't met — ASIL D |
| NvM (Non-Volatile Memory Manager) | Corrupted NvM can provide wrong calibration to safety SW — ASIL configurable |
| ComM (Communication Manager) | Bus management; loss of communication triggers safe state — ASIL configurable |
| AUTOSAR OS | Task management, MPU-backed protection hooks — ASIL D |
| SecOC (Secure Onboard Communication) | Adds CMAC-based authentication to E2E — security layer on top of safety |

### AUTOSAR MCAL Qualification for ISO 26262

For ASIL D embedded software, the AUTOSAR MCAL (Microcontroller Abstraction Layer) drivers must themselves be qualified or certified at the appropriate ASIL:

```
MCAL qualification strategy options:
  1. Use silicon vendor's pre-qualified MCAL:
     Infineon Aurix: MCAL provided by EB (Elektrobit) — ASIL D qualified
     NXP S32K: MCAL by NXP — ASIL D qualified
     Renesas RH850: MCAL by Renesas — ASIL D certified
     
  2. Qualify custom MCAL:
     Develop MCAL in-house and qualify using standard Part 6 process
     (realistic only if the MCAL is reused across many programs)
```

---

## ISO 26262 × ASPICE Integration

### Shared Work Products

ISO 26262 and ASPICE (Automotive SPICE) have significant overlap in required documentation and process activities. The key insight is that **the same work product can satisfy both standards** when its content and review process align with both.

```
Dual-purpose work product mapping:

ISO 26262 Work Product        ASPICE Process Area / Work Product
──────────────────────────    ──────────────────────────────────
Item Definition               SYS.1: System Requirements Analysis
HARA                          SYS.1 Risk analysis
Safety Plan                   MAN.3: Project Management Plan
FSC                           SYS.2: System Architecture Design (safety view)
TSC                           SYS.2: System Architecture Design (detailed)
SW Safety Requirements        SWE.1: SW Requirements Analysis
SW Architecture               SWE.2: SW Architecture Design
SW Detailed Design            SWE.3: SW Detailed Design
SW Unit Tests                 SWE.4: SW Unit Verification
SW Integration Tests          SWE.5: SW Integration Testing
System Verification           SYS.4: System Integration Testing
Configuration Management      SUP.8: Configuration Management
Problem Resolution            SUP.9: Problem Resolution Management
```

### Where They Diverge

| Aspect | ISO 26262 Focus | ASPICE Focus |
|--------|---------------|-------------|
| Primary driver | Safety of the product | Process maturity of the organization |
| Confirmation | FSA, safety audit, DFA | Assessment levels (CL0–CL5) |
| Metrics | PMHF, SPFM, LFM, DC | Process performance metrics |
| Decomposition | ASIL decomposition rules | Work product decomposition |
| Requirement | Normative (must comply) | Process improvement framework |
| Assessor | FSA (qualified safety expert) | Automotive SPICE Assessor |

### Combined Assessment Strategy

For ASIL C/D projects, combined ISO 26262 FSA + ASPICE process audit interviews are efficient when planned together. The assessor reviews:

1. **Safety case**: confirms ISO 26262 technical compliance
2. **Process evidence**: confirms ASPICE process adherence
3. **Work products**: same work products serve both purposes

---

## ISO 26262 × ISO/SAE 21434 (Cybersecurity)

ISO/SAE 21434:2021 is the automotive cybersecurity standard. It increasingly interacts with ISO 26262 because modern ECUs require both safety and security.

### Safety-Security Conflict Areas

```
Potential conflicts and resolutions:

1. Security update vs. Safety lockdown
   Conflict: Cybersecurity requires OTA (over-the-air) firmware updates;
             ISO 26262 requires that safety SW cannot be inadvertently changed.
   Resolution: OTA update process must include:
     - Cryptographic verification of firmware signature before flash
     - Safety-critical code in immutable region (separate bank); 
       OTA only updates calibration/non-safety regions
     - Update-induced restart triggers full startup self-test (WDT, ECC, Flash CRC)

2. Isolation vs. Integration
   Conflict: Security requires isolation of network interfaces to prevent attacks;
             Safety requires fast diagnostic access for fault monitoring.
   Resolution: AUTOSAR SecOC for safety-relevant CAN messages + 
               VLAN segmentation for network isolation

3. Diagnostic access vs. Security
   Conflict: ISO 26262 requires an accessible diagnostic interface (UDS/OBD-II) 
             for reading DTCs; Security requires this interface is protected.
   Resolution: UDS security access with seed-key authentication before DTC read
```

### ISO 26262 Part 8 §6 — Safety and Security Interaction

ISO 26262 Part 8 explicitly requires that the developer analyze interactions between safety and security requirements. This analysis must confirm that security mechanisms do not impair safety mechanisms and vice versa.

---

## ISO 26262 × ISO 21448 (SOTIF)

### The Three-Zone Model

ISO 21448:2022 (SOTIF — Safety of the Intended Functionality) addresses hazards caused by the **intended behavior of a system under performance limitations** — as opposed to hardware failures (ISO 26262) or cyber attacks (ISO/SAE 21434).

```
Three-zone model for ADAS/AD systems:

Zone 1: Known Safe Scenarios
  Scenarios where the system behavior is correct and safe.
  Evidence: Test campaigns at nominal conditions.

Zone 2: Known Unsafe Scenarios
  Scenarios where the system's performance limitation causes a hazardous behavior.
  Examples: LiDAR obscured by heavy rain → false-positive object detection → 
            AEB activates unnecessarily → rear-end collision risk
  
  ISO 26262 role: Does NOT cover (sensor performance limitations are SOTIF scope)
  SOTIF role: Must be identified and either mitigated or acceptance argued

Zone 3: Unknown Unsafe Scenarios
  Scenarios not yet identified during development; may emerge in the field.
  The goal of SOTIF is to reduce Zone 3 toward zero.
  Achieved through: extensive simulation, scenario testing, field data analysis.

Boundary between ISO 26262 and SOTIF:
  ISO 26262 covers: hardware failure → EPS applies unintended steering
  SOTIF covers:     correct hardware, but decision algorithm makes incorrect 
                    steering decision due to sensor perception failure in fog
```

---

## ISO 26262 × IEC 61508

ISO 26262 is derived from IEC 61508 (Functional Safety of E/E/PE Safety-related Systems). IEC 61508 is the sector-independent base standard. ISO 26262 is its automotive-specific adaptation.

| Aspect | IEC 61508 | ISO 26262 |
|--------|-----------|-----------|
| SIL levels | SIL 1–4 | ASIL A–D + QM |
| Scope | All E/E/PE safety systems | Road vehicle electrical systems |
| PMHF equivalent | PFH (Probability of Failure per Hour) | PMHF |
| HFT (Hardware Fault Tolerance) | Required for SIL 3/4 | Not directly — SPFM/LFM used instead |
| Reference architecture | Generic | Automotive-specific (V-model, AUTOSAR) |
| Assessment | IEC 61508 certification | ISO 26262 FSA |

Key difference: ISO 26262 replaces SIL with ASIL in name and notation, and refines the PMHF targets specifically for road vehicle operational lifetimes (500–3000 hours per year mission profile).

---

## Summary: ISO 26262 ASIL Section Master Index

| File | Title | Key Topics |
|------|-------|-----------|
| [asil-01](../98.ASIL/asil-01-introduction.md) | Introduction & ISO 26262 Overview | ASIL levels, ISO 26262 Parts, V-model |
| [asil-02](../98.ASIL/asil-02-hara.md) | HARA Methodology | S/E/C parameters, ASIL table, worked example |
| [asil-03](../98.ASIL/asil-03-asil-decomposition.md) | ASIL Decomposition | Valid combinations, independence, DFA, co-existence |
| [asil-04](../98.ASIL/asil-04-functional-safety-concept.md) | Functional Safety Concept | FSRs, safe states, FTTI, degradation strategy |
| [asil-05](../98.ASIL/asil-05-technical-safety-concept.md) | Technical Safety Concept | TSRs, HSI specification, allocation, ASIL inheritance |
| [asil-06](../98.ASIL/asil-06-sw-development-iso26262.md) | SW Development (Part 6) | Architecture, coding, MISRA, unit tests, coverage, FFI |
| [asil-07](../98.ASIL/asil-07-hw-development-iso26262.md) | HW Development (Part 5) | FMEDA, PMHF, SPFM, LFM, fault tree, DFA |
| [asil-08](../98.ASIL/asil-08-safety-mechanisms.md) | Safety Mechanisms | Watchdog, E2E, plausibility, ECC, MPU, lock-step |
| [asil-09](../98.ASIL/asil-09-functional-safety-assessment.md) | Functional Safety Assessment | Roles, safety plan, FSA, safety case, RfP, DIA |
| [asil-10](../98.ASIL/asil-10-tools-and-integration.md) | Tools and Integration | TCL, tool qualification, AUTOSAR, ASPICE, SOTIF, security |
