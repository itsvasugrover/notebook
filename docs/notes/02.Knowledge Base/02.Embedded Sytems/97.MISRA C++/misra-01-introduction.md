---
title: MISRA C++ Introduction
createTime: 2026/03/25 00:00:00
permalink: /kb/embedded/misra-cpp/introduction/
---

# MISRA C++ Introduction

## What Is MISRA C++?

**MISRA C++** (Motor Industry Software Reliability Association C++) is a set of software development guidelines for the C++ programming language developed by the MISRA consortium. Its goal is to facilitate code safety, security, portability, and reliability in the context of embedded systems — particularly those used in safety-critical applications such as automotive, aerospace, industrial, and medical devices.

MISRA C++ restricts the use of language features that are:
- **Undefined behaviour** — the C++ standard places no requirement on what the compiler must do
- **Unspecified behaviour** — the standard allows multiple outcomes and does not specify which
- **Implementation-defined behaviour** — each compiler/platform may behave differently
- **Potentially harmful** — features that are easy to misuse and often misused

---

## History and Versions

### MISRA C++:2008

The first edition, published in 2008 by the MISRA consortium, targeting **C++03**.

| Property | Detail |
|----------|--------|
| Language standard | C++03 |
| Total rules | 228 rules across 20 chapters |
| Obligation levels | Required / Advisory / Document |
| Chapters | 0, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 27 |
| Published | 2008 |
| Still active? | Yes — widely used in DO-178C, ISO 26262 projects |

### MISRA C++:2023

The second edition, published in 2023, targeting **C++17**.

| Property | Detail |
|----------|--------|
| Language standard | C++17 |
| Total rules | ~250 rules |
| Obligation levels | Mandatory / Required / Advisory |
| Decidability | Decidable / Undecidable classification added |
| Published | 2023 |
| Key changes | Covers C++11/14/17 features: `auto`, lambdas, `constexpr`, `noexcept`, range-for, `nullptr`, scoped enums, move semantics |

---

## Why Unrestricted C++ Is Dangerous in Safety-Critical Systems

### Undefined Behaviour Examples

```cpp
// Signed integer overflow — undefined behaviour (compiler may assume it never happens)
int32_t x = INT32_MAX;
int32_t y = x + 1;        // UB: the compiler may optimise assuming this never occurs

// Accessing out-of-bounds memory — undefined behaviour
int32_t arr[4] = {1, 2, 3, 4};
int32_t val = arr[4];     // UB: one past the end

// Null pointer dereference — undefined behaviour
int32_t* p = nullptr;
*p = 5;                   // UB: undefined, likely hardware fault
```

### Implementation-Defined Behaviour Examples

```cpp
// Size of int is implementation-defined
sizeof(int);     // Could be 2, 4, or 8 depending on platform

// Right-shift of signed integer is implementation-defined
int32_t x = -8;
int32_t y = x >> 1;   // May be -4 (arithmetic) or 2147483644 (logical) — impl-defined

// char signedness is implementation-defined
char c = 0xFF;
if (c == -1) { ... }   // May be true or false depending on compiler flags
```

### Consequences in Safety-Critical Embedded Systems

| Risk | Impact |
|------|--------|
| Undetected integer overflow | Wrong actuator position, sensor reading, timing value |
| Implicit type conversion | Data silently truncated or sign-changed |
| Pointer arithmetic errors | Memory corruption in adjacent buffers |
| Undefined behaviour optimised away | Safety checks removed by compiler |
| Non-deterministic execution | Violates real-time constraints |

---

## Safety Standards That Reference MISRA C++

| Standard | Domain | MISRA C++ Relevance |
|----------|--------|---------------------|
| **ISO 26262** | Automotive functional safety (road vehicles) | Referenced for ASIL A–D software |
| **IEC 61508** | Industrial functional safety (general machinery) | Referenced for SIL 1–4 software |
| **DO-178C** | Aerospace software (airborne systems) | MISRA C++ used as coding standard evidence |
| **IEC 62304** | Medical device software | Referenced for Class B/C software safety |
| **EN 50128** | Railway control and protection systems | Referenced for SIL 1–4 software |
| **AUTOSAR C++14** | Automotive software architecture | Subsumes MISRA C++:2008; adds new rules |

---

## MISRA C++:2008 Rule Structure

Each rule is referenced as **Rule `<chapter>-<section>-<number>`**.

```
Rule 5-0-3
     │ │ └── Rule number within section
     │ └──── Section within chapter (ISO C++ standard section)
     └────── Chapter (based on ISO C++ chapter numbering)
```

### Chapter Overview (MISRA C++:2008)

| Chapter | Topic |
|---------|-------|
| 0 | Language-independent issues (unreachable code, unused variables) |
| 2 | Lexical conventions (identifiers, literals, comments) |
| 3 | Basic concepts (declarations, scope, linkage, ODR) |
| 4 | Standard conversions |
| 5 | Expressions |
| 6 | Statements |
| 7 | Declarations |
| 8 | Declarators |
| 9 | Classes |
| 10 | Derived classes |
| 11 | Member access control |
| 12 | Special member functions |
| 13 | Overloading |
| 14 | Templates |
| 15 | Exception handling |
| 16 | Preprocessing directives |
| 17 | Library introduction |
| 18 | Language support library |
| 19 | Diagnostics library |
| 27 | Input/output library |

---

## MISRA C++:2008 Obligation Levels

| Level | Description | Deviation Allowed? |
|-------|-------------|-------------------|
| **Required** | The rule shall be followed in all circumstances | Yes — with documented justification |
| **Advisory** | Should generally be followed; may be deviated with justification | Yes |
| **Document** | Implementation-defined behaviours that must be documented | N/A |

---

## MISRA C++:2023 Obligation Levels

MISRA C++:2023 introduces a refined three-tier system:

| Level | Description |
|-------|-------------|
| **Mandatory** | Shall always be followed — no deviation permitted |
| **Required** | Shall be followed unless a formal deviation is documented |
| **Advisory** | Should be followed; lower risk if deviated |

### Decidability Classification (MISRA C++:2023)

| Class | Meaning |
|-------|---------|
| **Decidable** | A tool can always determine compliance or non-compliance algorithmically |
| **Undecidable** | Compliance depends on program semantics that cannot always be computed statically |

---

## Deviation Process

A **deviation** is a documented, approved exception to a MISRA rule. Violations that are not deviations are non-compliant.

### Required Documentation for Each Deviation

```
Deviation ID:      DEV-PROJ-001
MISRA Rule:        MISRA C++:2008 Rule 5-2-7
Rule Category:     Required
Location:          src/hal/uart_driver.cpp:Line 88
Justification:     reinterpret_cast is required to access memory-mapped UART
                   register at address 0x40011000. No alternative exists for
                   hardware register access on STM32H743.
Risk Assessment:   Low — pointer is guaranteed aligned by hardware spec.
Mitigation:        Address verified against RM0433 Rev 7 Table 8. Unit tested.
Approver:          J. Smith (Safety Lead)
Date:              2026-01-15
Review Date:       2027-01-15
```

### Types of Deviations

| Type | Description |
|------|-------------|
| **Permitted deviation** | Rule violation is acceptable for a specific, justified reason |
| **Advisory deviation** | An advisory rule is not followed; risk is lower |
| **False positive** | The tool incorrectly reports a compliant construct as a violation |

---

## Compliance Claims

A formal **MISRA compliance claim** must state:

1. Which MISRA standard is claimed (e.g., MISRA C++:2008)
2. Which rules were enforced
3. Which rules were subject to deviations (all documented)
4. Which tool was used for static analysis
5. The version of the tool and its configuration

### Example Compliance Statement

```
Software Module: FCU_Core v2.4.1
MISRA Standard:  MISRA C++:2008
Compliance:      Compliant with deviations
Rules Enforced:  All 228 rules
Deviations:      14 approved deviations (see deviation register DEV-FCU-v2.4.1)
Tool:            PRQA QA·C++ 4.2 — configuration: MISRA_CPP_2008_Required_All.cfg
Checked by:      Static Analysis Engineer — J. Smith
Date:            2026-03-15
```

---

## MISRA C++:2008 vs AUTOSAR C++14

| Property | MISRA C++:2008 | AUTOSAR C++14 |
|----------|---------------|---------------|
| Base standard | C++03 | C++14 |
| Rule count | 228 | ~300 |
| Relationship | Foundation | Superset — includes all MISRA C++:2008 rules |
| Focus | General safety | Automotive software architecture + safety |
| Modern C++? | No (C++03 only) | Yes (C++11/14 features included) |
| Adopted by | Any safety-critical domain | Automotive AUTOSAR projects |

---

## MISRA C++ vs CERT C++

| Property | MISRA C++ | CERT C++ |
|----------|-----------|---------|
| Focus | Safety, determinism | Security, undefined behaviour |
| Binding level | Legally in safety standards | Best practice / voluntary |
| Rule count | 228 / ~250 | ~100 rules + recommendations |
| Primary audience | Embedded / safety engineers | Security engineers |
| Deviation process? | Yes — formal | No formal process |
| Tooling | Dedicated commercial tools | clang-tidy, compiler warnings |

---

## Tooling Support

| Tool | Vendor | MISRA C++:2008 | MISRA C++:2023 | ISO 26262 Qualified |
|------|--------|---------------|----------------|---------------------|
| **PRQA QA·C++** (Helix QAC++) | Perforce | Full | Yes | Yes |
| **Polyspace Bug Finder** | MathWorks | Full | Yes | Yes |
| **PC-lint Plus** | Gimpel | Full | Partial | Partial |
| **Parasoft C++test** | Parasoft | Full | Yes | Yes |
| **Axivion Bauhaus** | Axivion | Full | Yes | Yes |
| **LDRA Testbed** | LDRA | Full | Yes | Yes |
| **SonarQube** | Sonar | Subset | Subset | No |
| **Coverity** | Synopsys | Subset | No | No |
| **clang-tidy** | LLVM (open source) | Subset (via CERT/CG checks) | No | No |
| **cppcheck** | Open source | Subset | No | No |

---

## Quick Reference: MISRA C++ Rule Numbering

```
MISRA C++:2008  → Rule 5-0-3     (Chapter 5, Section 0, Rule 3)
MISRA C++:2023  → Rule 6.7.1     (Section 6.7, Rule 1)
```

Rules with chapter `0` (e.g., Rule 0-1-1) are MISRA-specific — they do not correspond to a C++ standard chapter but cover language-independent issues like dead code and unused variables.
