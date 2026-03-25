---
title: MISRA C++ Best Practices & Adoption Guide
createTime: 2026/03/25 00:00:00
permalink: /kb/embedded/misra-cpp/best-practices/
---

# MISRA C++ Best Practices & Adoption Guide

## Overview

This chapter consolidates practical guidance for adopting MISRA C++ in a real project — whether starting fresh, retrofitting an existing codebase, or maintaining compliance across a team over time.

---

## Adoption Strategy

### Greenfield Projects (Starting from Zero)

The best time to adopt MISRA C++ is at project start. The additional cost is minimal — writing compliant code from the start is far cheaper than retrofitting later.

**Day-1 checklist**:

```
[ ] Select MISRA C++ version (2008 for pre-C++11, 2023 for C++17 target)
[ ] Configure compiler with strict warning flags
[ ] Integrate static analysis tool into build system
[ ] Write a deviation management procedure
[ ] Establish code review checklist with MISRA categories
[ ] Enforce clang-tidy (supplementary) in CI/CD gates
[ ] Document which rules are mandated vs advisory for your project
```

---

### Brownfield Projects (Retrofitting Existing Code)

For an existing codebase, a big-bang "fix everything" approach is impractical. Use a phased approach:

**Phase 1 — Assess (Week 1–2)**:

```bash
# Run MISRA tool on full codebase, generate a baseline report
qacpp --full-analysis src/ > baseline_violations.txt
grep -c "Rule" baseline_violations.txt
# Example output: 14,271 violations in 120 files
```

**Phase 2 — Categorise**:

| Category | Action |
|----------|--------|
| Required rule violations | Must fix — prioritise by severity |
| Advisory violations | Fix where practical; document others |
| Tool false positives | Document as FP deviations |
| Third-party code | Blanket deviation for external libraries |

**Phase 3 — Fix Incrementally**:

- Set a **violation count target** per sprint (e.g., reduce by 200/sprint)
- Never allow the count to grow — CI gate blocks PRs that add new violations
- Fix files in order of criticality: safety-critical modules first

---

## Compiler Configuration for MISRA

### GCC / Clang Recommended Flags

```cmake
target_compile_options(my_target PRIVATE
    # Standard strictness
    -std=c++14
    -Wall
    -Wextra
    -Wpedantic
    -Wconversion          # Flag implicit type conversions (MISRA Ch 5)
    -Wsign-conversion     # Flag signed/unsigned conversions (Rule 5-0-4)
    -Wshadow              # Flag identifier hiding (Rule 2-10-2)
    -Wcast-qual           # Flag removal of const/volatile qualifiers (Rule 5-2-5)
    -Wold-style-cast      # Flag C-style casts (Rule 5-2-4)
    -Wundef               # Flag undefined macros in #if (Chapter 16)
    -Wunused              # Flag unused variables/functions (Rule 0-1-3)
    -Wunreachable-code    # Flag unreachable code (Rule 0-1-1) — limited
    -Wnull-dereference    # Flag potential null dereferences
    -Wdouble-promotion    # Flag float->double implicit promotion
    -fno-exceptions       # Disable exceptions (safety-critical)
    -fno-rtti             # Disable RTTI (no typeid, dynamic_cast)
    -Werror               # Treat all warnings as errors in CI
)
```

---

### MISRA-Specific Compiler Macros

Document compiler-specific and implementation-defined behaviour as required by Rule 0-3-1:

```cpp
// implementation_assumptions.h
// Documents verified implementation-defined behaviour for this platform
// Required by MISRA C++ Rule 0-3-1

// Verified: GCC ARM 12.x on Cortex-M4
// int is 32-bit signed two's complement
static_assert(sizeof(int) == 4U, "int must be 32-bit");
static_assert(sizeof(long) == 4U, "long must be 32-bit on ARM32");

// Verified: char is unsigned on this target
static_assert(static_cast<int8_t>(static_cast<char>(0xFF)) == -1,
    "char must be signed on this target");

// Verified: right-shift of signed integers is arithmetic (sign-extending)
// GCC guarantees this for ARM: https://gcc.gnu.org/onlinedocs/gcc/...
```

---

## Coding Patterns

### Safe Integer Arithmetic

Prevent overflow without using exceptions:

```cpp
// Safe unsigned addition with saturation
uint32_t safe_add_u32(uint32_t a, uint32_t b) noexcept {
    if (b > (UINT32_MAX - a)) {
        return UINT32_MAX;    // Saturate on overflow
    }
    return a + b;
}

// Safe signed multiplication — check bounds explicitly
bool safe_mul_i32(int32_t a, int32_t b, int32_t& result) noexcept {
    if (a > 0 && b > 0 && a > (INT32_MAX / b)) { return false; }
    if (a < 0 && b < 0 && a < (INT32_MIN / b)) { return false; }
    if (a > 0 && b < 0 && b < (INT32_MIN / a)) { return false; }
    if (a < 0 && b > 0 && a < (INT32_MIN / b)) { return false; }
    result = a * b;
    return true;
}
```

---

### Type-Safe State Machine

Use `enum class` for states — prevents arithmetic and implicit conversion:

```cpp
// MISRA-compliant state machine
enum class MotorState : uint8_t {
    Idle     = 0U,
    Starting = 1U,
    Running  = 2U,
    Stopping = 3U,
    Fault    = 4U
};

class Motor {
public:
    bool request_start() noexcept {
        if (m_state != MotorState::Idle) { return false; }
        m_state = MotorState::Starting;
        return true;
    }

    MotorState get_state() const noexcept { return m_state; }

private:
    MotorState m_state{MotorState::Idle};
};
```

---

### Hardware Register Access Pattern

The most common MISRA deviation site in embedded code — accessing memory-mapped I/O:

```cpp
// hardware_registers.h
// All reinterpret_cast to hardware registers collected here.
// Each use is covered by deviation record HW-DEV-xxx.

// [HW-DEV-001] Rule 5-2-7 (reinterpret_cast)
// Justification: MMIO register access required for GPIO peripheral at 0x40020000
// Risk: None — address is page-aligned, volatile prevents optimisation
// Platform: STM32H7, verified in reference manual RM0433 Table 2

namespace stm32h7 {
namespace gpio {

constexpr uint32_t GPIOA_BASE = 0x40020000U;

struct GpioRegs {
    volatile uint32_t MODER;
    volatile uint32_t OTYPER;
    volatile uint32_t OSPEEDR;
    volatile uint32_t PUPDR;
    volatile uint32_t IDR;
    volatile uint32_t ODR;
    volatile uint32_t BSRR;
    volatile uint32_t LCKR;
    volatile uint32_t AFRL;
    volatile uint32_t AFRH;
};

// All reinterpret_casts are in this one file and covered by HW-DEV-001
inline GpioRegs& get_gpioa() noexcept {
    return *reinterpret_cast<GpioRegs*>(GPIOA_BASE);   // PRQA S 0306 HW-DEV-001
}

}  // namespace gpio
}  // namespace stm32h7
```

---

### Avoiding String Literals as Error Messages

In MISRA-compliant code, avoid using `const char*` literals scattered throughout — they bloat ROM. Instead:

```cpp
// MISRA-compliant: error codes instead of string messages
enum class ErrorCode : uint32_t {
    None          = 0x00U,
    InvalidParam  = 0x01U,
    Timeout       = 0x02U,
    HardwareFault = 0x03U,
    BufferFull    = 0x04U,
    NotInitialised= 0x05U
};

// Map to strings only in debug/logging module — never in safety-critical path
#if defined(ENABLE_DEBUG_LOGGING)
const char* error_to_string(ErrorCode code) noexcept {
    switch (code) {
        case ErrorCode::None:           return "None";
        case ErrorCode::InvalidParam:   return "InvalidParam";
        case ErrorCode::Timeout:        return "Timeout";
        case ErrorCode::HardwareFault:  return "HardwareFault";
        case ErrorCode::BufferFull:     return "BufferFull";
        case ErrorCode::NotInitialised: return "NotInitialised";
        default:                        return "Unknown";
    }
}
#endif
```

---

### Null Safety Pattern

MISRA bans `nullptr` comparisons being skipped. Enforce them:

```cpp
// Wrapper that documents and enforces not-null invariant
template<typename T>
class NotNull {
public:
    explicit NotNull(T* ptr) noexcept : m_ptr{ptr} {
        // In debug: assert. In release: undefined behaviour avoided by caller.
        static_assert(ptr != nullptr, "NotNull requires non-null pointer");
    }

    T* get() const noexcept { return m_ptr; }
    T& operator*() const noexcept { return *m_ptr; }
    T* operator->() const noexcept { return m_ptr; }

private:
    T* m_ptr;
};

// Usage: caller guarantees non-null at construction
NotNull<Sensor> s_ptr{&global_sensor};
s_ptr->read_value();
```

---

## Code Review Checklist for MISRA C++

Use this checklist during PR reviews in MISRA C++ projects:

### Declarations & Types
- [ ] All integer types use `<cstdint>` fixed-width types (`uint32_t`, not `int`)
- [ ] One declaration per line (Rule 8-0-1)
- [ ] Variables declared in narrowest possible scope (Rule 3-4-1)
- [ ] No `union` without deviation (Rule 9-5-1)
- [ ] `const` applied wherever value is not modified

### Expressions & Operators
- [ ] No C-style casts — only `static_cast`, `const_cast`, `reinterpret_cast` (Rule 5-2-4)
- [ ] No `reinterpret_cast` without deviation record (Rule 5-2-7)
- [ ] No implicit type conversions between signed/unsigned or float/int
- [ ] Boolean expressions used with `bool` operators only
- [ ] No floating-point equality comparisons (Rule 6-2-2)

### Control Flow
- [ ] Every `switch` has a `default` clause (verify separately)
- [ ] No `goto` (Chapter 6 rules)
- [ ] `++`/`--` as standalone statements only (Rule 6-2-3, advisory)
- [ ] `for` and `while` loops have bounded iteration (Rule 6-5-x)

### Functions & Classes
- [ ] Functions have a single exit point (Rule 8-4-x — advisory)
- [ ] Virtual override functions use `override` keyword (Rule 10-3-2)
- [ ] No virtual functions in constructors/destructors (Rule 12-1-1)
- [ ] Member data in non-POD classes is `private` (Rule 11-0-1)
- [ ] Destructors are `noexcept` (Rule 15-5-1)

### Memory & Resources
- [ ] No `new` / `delete` / `malloc` / `free` (Rule 18-4-1)
- [ ] No `std::vector`, `std::string`, `std::map` (dynamic allocation)
- [ ] Resource lifetimes are statically deterministic

### Preprocessor
- [ ] No macros for constants or functions — use `constexpr` / `inline` (Rule 16-2-2)
- [ ] Header guards present (Rule 16-2-1)
- [ ] No `#undef` (Rule 16-0-6)

### Deviations
- [ ] Every suppression references a deviation record ID
- [ ] No "FP" suppression without confirmed false positive analysis

---

## Managing MISRA in a Growing Team

### Project-Level Rule Customisation

Not all MISRA rules apply equally to every project. Document your project's rule policy:

```
MISRA C++ Rule Selection — Project: FW-PLATFORM

Mandatory (all Required rules enforced):
  - Chapter 0: All (0-1-1, 0-1-3, 0-1-7, 0-3-1, 0-3-2)
  - Chapter 5: All (expressions and operators)
  - Chapter 15: All except 15-0-2 (exceptions disabled by -fno-exceptions)

Advisory rules enforced as Required:
  - 6-2-3 (++/-- standalone)
  - 10-1-1 (no virtual base classes)
  - 12-1-2 (member initialiser lists)

Advisory rules as Advisory (non-blocking in CI):
  - 14-7-1 (explicit instantiation)

Rules not applicable:
  - 15-x-x: All exception rules (exceptions disabled with -fno-exceptions)
  - 27-0-1: No I/O (already implied by no <cstdio>)

Tool: PRQA QA·C++ 4.2.0
Rule config file: misra_cpp_2008_custom.cfg
Deviation register: docs/deviations/register.xlsx
```

---

### Onboarding New Team Members

```
MISRA C++ Onboarding Checklist — New Engineer

Week 1:
[ ] Read MISRA C++:2008 document (mandatory)
[ ] Read project Rule Selection document
[ ] Complete MISRA C++ training module (if available)
[ ] Set up local static analysis tool
[ ] Run analysis on one module; review output with senior engineer

Week 2:
[ ] Fix 10 real violations in non-critical code (supervised)
[ ] Write first deviation record under supervision
[ ] Understand false positive process
[ ] Review CI/CD pipeline: where does MISRA gate sit?
```

---

## Common Pitfalls & How to Avoid Them

| Pitfall | Rule(s) | Prevention |
|---------|---------|------------|
| `int` instead of `int32_t` | Rule 3-9-2 | `typedef int int32_t` via `<cstdint>` — always use `<cstdint>` |
| Mixing signed/unsigned arithmetic | Rule 5-0-4 | Enable `-Wsign-conversion`; use `static_cast` explicitly |
| `(type)` C-style cast | Rule 5-2-4 | Enable `-Wold-style-cast` in compiler |
| Inequality of floats | Rule 6-2-2 | Use epsilon comparison helper |
| `++i` in larger expression | Rule 6-2-3 | Code style guide: `++`/`--` always on own line |
| `union` for type punning | Rule 9-5-1 | Replace with `std::memcpy` pattern |
| Macro for constant | Rule 16-2-2 | `constexpr` everywhere — ban `#define VALUE 42` |
| No `override` keyword | Rule 10-3-2 | Compiler: `-Wsuggest-override` |
| Multiple declarations per line | Rule 8-0-1 | Formatter rule: one declarator per declaration |
| Throwing from destructor | Rule 15-5-1 | Always declare `~Foo() noexcept` |

---

## Summary: Adoption Roadmap

| Stage | Actions | Timeframe |
|-------|---------|-----------|
| 1. Baseline | Run static analysis, count violations, classify | 1 week |
| 2. Block new violations | CI gate: no new violations on PR merge | Day 1 |
| 3. Compiler hardening | Add `-Wconversion`, `-Wsign-conversion`, `-Wold-style-cast` | 1 week |
| 4. Fix critical modules | Safety-critical code paths first | 2–4 sprints |
| 5. Fix remaining Required | All Required rule violations resolved | 4–8 sprints |
| 6. Handle deviations | All remaining violations are documented deviations | 1 sprint |
| 7. Claim compliance | Formal MISRA compliance report generated and signed | 1 week |
| 8. Maintain | CI gate permanently active; deviation review in each sprint | Ongoing |
