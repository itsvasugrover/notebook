---
title: MISRA C++ Tooling & Compliance
createTime: 2026/03/25 00:00:00
permalink: /kb/embedded/misra-cpp/tooling-compliance/
---

# MISRA C++ Tooling & Compliance

## Overview

MISRA C++ compliance is not achieved by reading the guidelines alone — it requires static analysis tooling integrated into the development workflow. This chapter covers the major static analysis tools, how to configure them, how to manage deviations in code, and how to integrate compliance checking into CI/CD pipelines.

---

## Static Analysis Tools

### 1. LDRA Testbed & TBvision

**Commercial** | ISO 26262-qualified tool

- Full MISRA C++:2008 rule set
- Generates compliance reports for certification authorities
- Integrates with Eclipse, VS Code, command line
- Tool qualification documentation (TQR) available for ISO 26262 Part 8

---

### 2. PRQA QA·C++ (now Perforce Helix QAC++)

**Commercial** | Widely used in automotive

- Complete MISRA C++:2008 and MISRA C++:2023 support
- Rule suppression via `// PRQA S <rule-id>` inline comments
- Integration with Jira, Jenkins, Azure DevOps
- Generates MISRA-category compliance PDFs

```cpp
// QA·C++ suppression format:
uint32_t val = static_cast<uint32_t>(raw);   // PRQA S 5-0-3 ++
// ^ Suppresses Rule 5-0-3 for this line with justification required separately
```

---

### 3. PC-lint Plus (Gimpel Software)

**Commercial** | Long-established C/C++ linter

- MISRA C++:2008 rule sets via `-MISRA(2008)` activation
- Inline suppression via `//lint` directives:

```cpp
// PC-lint Plus suppression:
int32_t x = (int32_t)raw_val;   //lint !e9027 MISRA C++ 5-2-4 deviation: legacy API
```

- Command-line and IDE integration
- Requires per-rule suppression justification workflow

---

### 4. Parasoft C++test

**Commercial** | Automotive, medical, aerospace certified

- MISRA C++:2008 and MISRA C:2012 rule sets
- Static analysis + unit test generation
- Suppression via annotations:

```cpp
// Parasoft suppression:
// parasoft-suppress MISRA2008-5_2_4 "Legacy C API requires C-style cast"
uint32_t val = (uint32_t)get_raw();
```

- Reports exportable for DO-178C and ISO 26262

---

### 5. Axivion Bauhaus Suite

**Commercial** | Heavy architecture and metrics focus

- MISRA C++:2008 + call-graph analysis + clone detection
- Deviation management with approval workflow
- CI integration via REST API

---

### 6. Polyspace Bug Finder / Code Prover (MathWorks)

**Commercial** | Formal verification + MISRA

- Polyspace **Code Prover**: exhaustive formal proof of no runtime errors
- Polyspace **Bug Finder**: fast MISRA C++ rule checking
- Integration with MATLAB/Simulink workflows (Model-Based Development)
- Suppression via `polyspace-begin` / `polyspace-end` pragmas:

```cpp
/* polyspace-begin MISRA-CPP:5-2-4 [Approved] "Hardware register access requires reinterpret_cast" */
volatile uint32_t* reg = reinterpret_cast<volatile uint32_t*>(0x40021000U);
/* polyspace-end MISRA-CPP:5-2-4 */
```

---

### 7. SonarQube + SonarSource C++ Plugin

**Commercial/Community** | CI-friendly

- MISRA C++:2008 rules (subset, not complete)
- Web dashboard, trend analysis, PR blocking
- Less common for DO-178C/ISO 26262 certification evidence

---

### 8. clang-tidy (Open Source)

**Free** | Not certification-qualified

- MISRA-related checks: `cert-*`, `bugprone-*`, `cppcoreguidelines-*`
- Does not implement full MISRA C++ rule set
- Useful for catching some MISRA categories in open-source projects:

```yaml
# .clang-tidy configuration
Checks: >-
  cert-*,
  bugprone-*,
  cppcoreguidelines-*,
  performance-*,
  readability-*,
  -cppcoreguidelines-pro-type-reinterpret-cast
```

```bash
clang-tidy --config-file=.clang-tidy src/sensor.cpp -- -std=c++17
```

> **Note**: `clang-tidy` is NOT a replacement for MISRA-qualified tools in certified projects.

---

### 9. cppcheck (Open Source)

**Free** | Supplementary checking

```bash
cppcheck --enable=all --std=c++14 --force src/
```

- Limited MISRA C++ coverage
- Good for catching common bugs and UB not covered by MISRA tools
- Not certification-qualified

---

## Tool Comparison Summary

| Tool | MISRA C++:2008 | MISRA C++:2023 | ISO 26262 Qualified | CI/CD |
|------|---------------|----------------|---------------------|-------|
| LDRA Testbed | Full | Yes | Yes | Yes |
| PRQA QA·C++ | Full | Yes | Yes | Yes |
| PC-lint Plus | Full | Partial | Partial | Yes |
| Parasoft C++test | Full | Yes | Yes | Yes |
| Axivion | Full | Yes | Yes | Yes |
| Polyspace | Full | Yes | Yes | Yes |
| SonarQube | Subset | Subset | No | Yes |
| clang-tidy | Subset | No | No | Yes |
| cppcheck | Subset | No | No | Yes |

---

## Deviation Management

### What Is a Deviation?

A **deviation** is a documented, approved exception to a MISRA rule. Deviations are not violations — they are explicitly authorised departures from the guideline.

### Types of Deviations

| Type | Description |
|------|-------------|
| **Permitted deviation** | The rule violation is acceptable for a specific, justified reason |
| **Advisory deviation** | An advisory rule is not followed; lower risk |
| **False positive** | The tool incorrectly reports a compliant construct as a violation |

---

### Deviation Record Format

Every deviation must be documented. A typical record contains:

```
Deviation ID:      DEV-2024-001
MISRA Rule:        MISRA C++:2008 Rule 5-2-7 (dynamic_cast)
Location:          src/comm/protocol_handler.cpp:145
Severity:          Required
Justification:     The communication protocol handler requires run-time type
                   identification of message types. The class hierarchy is
                   stable and well-tested. Static analysis confirms no path
                   where dynamic_cast returns nullptr without prior guard check.
Risk:              Low — all dynamic_cast results are checked immediately.
Mitigation:        Unit tests cover all downcast scenarios. Code review mandatory.
Approver:          J. Smith (Safety Engineer)
Date:              2024-03-15
Review Date:       2025-03-15
```

---

### Inline Deviation Comments

Each suppression in the source must reference the deviation record:

```cpp
// [DEV-2024-001] MISRA C++:2008 Rule 5-2-7 — dynamic_cast permitted
// Justification: Protocol message type dispatch — see deviation record DEV-2024-001
auto* msg = dynamic_cast<DataMessage*>(base_msg);    // SAFE: checked immediately
if (msg == nullptr) {
    return Status::InvalidMessage;
}
```

**COMPLIANCE RULE**: Suppressions without a deviation record in the project's deviation register are **non-compliant** — this is a process violation, not just a code violation.

---

## CI/CD Integration

### Jenkins Pipeline Example (PRQA QA·C++)

```groovy
pipeline {
    agent { label 'linux-build' }
    stages {
        stage('Static Analysis') {
            steps {
                sh '''
                    qacpp \
                        --project misra_project.pprj \
                        --config MISRA_CPP_2008.cfg \
                        --analysis-path src/ \
                        --report misra_report.pdf \
                        --exit-on-violation
                '''
            }
            post {
                always {
                    archiveArtifacts artifacts: 'misra_report.pdf'
                    publishHTML([
                        reportFiles: 'misra_report.html',
                        reportName: 'MISRA Compliance Report'
                    ])
                }
            }
        }
    }
}
```

---

### CMake Integration with clang-tidy

```cmake
# CMakeLists.txt
find_program(CLANG_TIDY clang-tidy)
if(CLANG_TIDY)
    set(CMAKE_CXX_CLANG_TIDY
        ${CLANG_TIDY};
        --config-file=${CMAKE_SOURCE_DIR}/.clang-tidy;
        --extra-arg=-std=c++17
    )
endif()
```

---

### GitHub Actions with cppcheck

```yaml
# .github/workflows/static-analysis.yml
name: Static Analysis
on: [push, pull_request]

jobs:
  cppcheck:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Install cppcheck
        run: sudo apt-get install -y cppcheck
      - name: Run cppcheck
        run: |
          cppcheck \
            --enable=warning,style,performance,portability \
            --std=c++14 \
            --error-exitcode=1 \
            --xml \
            --xml-version=2 \
            src/ 2> cppcheck-report.xml
      - name: Publish report
        uses: mikeal/publish-to-github-action@master
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}
```

---

## Tool Qualification (ISO 26262 Part 8)

When using static analysis tools in safety-critical development, the tools themselves may need to be **qualified** under ISO 26262 Part 8 (supporting processes — software tools).

### Tool Confidence Level (TCL)

| TCL | Risk | Qualification Required |
|-----|------|----------------------|
| TCL 1 | Low | None — no impact on safety |
| TCL 2 | Medium | Basic validation |
| TCL 3 | High | Full tool qualification |

**Determining TCL**:
- **TD1** (Tool Error Detection): Can a tool error be detected downstream?
- **TD2** (Impact on Safety): If the tool fails, could a safety failure result?
- **TCL = TD1 + TD2 combination**

### Qualified Tool Packages

| Tool | Qualification | Standard |
|------|--------------|---------|
| LDRA Testbed | TQR available | ISO 26262, DO-178C |
| Polyspace | Tool Qualification Kit (TQK) | ISO 26262 Part 8 |
| Parasoft | Tool Qualification Kit | ISO 26262, IEC 62304 |
| PRQA QA·C++ | MISRA Compliance Report + TQR | ISO 26262 |

---

## Compliance Report Generation

A MISRA Compliance Report (per the MISRA Compliance document) must contain:

1. **Software component identification** (name, version, hash)
2. **MISRA standard claimed** (MISRA C++:2008 or 2023)
3. **Deviation list** — all approved deviations
4. **Tool used** — name, version, configuration
5. **Rule enforcement summary** — each rule: enforced / not enforced / deviated
6. **Reviewer signature and date**

### Compliance Claim Categories

| Category | Meaning |
|----------|---------|
| **Fully compliant** | All rules enforced, no deviations |
| **Compliant with deviations** | Some rules deviated — all documented |
| **Not applicable** | Rule does not apply to this component |
| **Not checked** | Rule not enforced by current tooling |

---

## False Positive Management

Static analysis tools report false positives — violations that are actually compliant code. Managing them correctly:

```cpp
// Workflow for a suspected false positive:

// 1. Verify manually: is the code actually compliant?
// 2. If compliant: create a False Positive deviation record
// 3. Suppress in code with FP deviation reference:

// [FP-2024-003] MISRA C++:2008 Rule 5-0-3 — false positive
// Tool incorrectly identifies static_cast<uint16_t> as implicit conversion
// See false positive record FP-2024-003 for tool vendor bug report reference
uint16_t val = static_cast<uint16_t>(sensor_raw);   // PRQA S 0303
```

> **Never suppress a real violation as a "false positive"** — this is a process integrity failure and invalidates any compliance claim.

---

## Summary: Tooling Recommendations

| Scenario | Recommended Tool |
|----------|-----------------|
| ISO 26262 ASIL-D automotive | Polyspace + PRQA QA·C++ |
| Aerospace DO-178C Level A | LDRA Testbed or Parasoft |
| IEC 62304 Class C medical | Parasoft or PRQA QA·C++ |
| IEC 61508 SIL 3/4 | LDRA or Polyspace |
| Open source / pre-qualification | clang-tidy + cppcheck |
| CI/CD gate for large team | SonarQube + commercial tool (dual) |
