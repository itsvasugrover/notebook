---
title: MISRA C++ Rule Categories & Classification
createTime: 2026/03/25 00:00:00
permalink: /kb/embedded/misra-cpp/rule-categories/
---

# MISRA C++ Rule Categories & Classification

## Overview

MISRA C++ organises its guidelines into a hierarchical structure. Understanding the classification system is essential for:
- Knowing which rules can be deviated and under what conditions
- Configuring static analysis tools correctly
- Writing compliant deviation records
- Making accurate compliance claims

---

## MISRA C++:2008 Classification

### Obligation Levels

| Level | Description | Deviation Allowed? |
|-------|-------------|-------------------|
| **Required** | Must always be followed unless formally deviated | Yes — with documented justification |
| **Advisory** | Best practice; recommended strongly | Yes — advisory non-compliance recorded collectively |
| **Document** | Not a code constraint; documentation/process requirement | N/A |

### Rule Numbering

Rules follow the pattern `Rule <chapter>-<section>-<number>`:

```
Rule 5-0-3
      │ │ └── Rule number within the section
      │ └──── Section number within the chapter
      └────── Chapter number (maps to language area)
```

Examples:
- `Rule 0-1-1` — Chapter 0 (language independent), Section 1, Rule 1
- `Rule 5-0-5` — Chapter 5 (expressions), Section 0, Rule 5
- `Rule 14-7-2` — Chapter 14 (templates), Section 7, Rule 2

---

## Chapter Breakdown (2008)

### Chapter 0 — Language Independent Issues

Rules that apply regardless of language version; mostly about code quality and process.

| Rule | Required/Advisory | Description |
|------|------------------|-------------|
| 0-1-1 | Required | A project shall not contain unreachable code |
| 0-1-2 | Required | A project shall not contain infeasible paths |
| 0-1-3 | Required | A project shall not contain unused variables |
| 0-1-4 | Required | A project shall not contain non-volatile POD variables with only one use |
| 0-1-5 | Advisory | A project shall not contain unused type declarations |
| 0-1-6 | Required | A project shall not contain instances of non-volatile variables being given values that are never subsequently used |
| 0-1-7 | Required | The value returned by a function having a non-void return type that is not an overloaded operator shall always be used |
| 0-1-8 | Required | All functions with void return type shall have external side-effects |
| 0-1-9 | Advisory | There shall be no dead code |
| 0-1-10 | Required | Every defined function shall be called at least once |
| 0-1-11 | Advisory | There shall be no unused parameters in functions |
| 0-1-12 | Advisory | There shall be no unused parameters in non-virtual functions |
| 0-2-1 | Required | An object shall not be assigned to an overlapping object |
| 0-3-1 | Advisory | All usage of implementation-defined behaviour shall be documented |
| 0-3-2 | Required | If a function generates error information, then that error information shall be tested |

### Chapter 2 — Unused Code

| Rule | Level | Description |
|------|-------|-------------|
| 2-7-1 | Advisory | The character sequence `/*` shall not be used within a C-style comment |
| 2-7-2 | Advisory | Sections of code shall not be "commented out" using C-style comments |
| 2-7-3 | Advisory | Sections of code shall not be "commented out" using C++ comments |
| 2-10-1 | Required | Different identifiers shall be typographically unambiguous |
| 2-10-2 | Required | Identifiers declared in an inner scope shall not hide an identifier declared in an outer scope |
| 2-10-3 | Required | A typedef name shall be a unique identifier |
| 2-10-4 | Required | A class, union or enum name shall be a unique identifier |
| 2-10-5 | Advisory | The identifier name of a non-member object or function with static storage shall not be reused |
| 2-10-6 | Required | If an identifier refers to a type, it shall not also refer to an object or a function in the same scope |
| 2-13-1 | Required | Only those escape sequences that are defined in ISO/IEC 14882:2003 shall be used |
| 2-13-2 | Required | Octal constants shall not be used |
| 2-13-3 | Required | A "U" suffix shall be applied to all octal or hexadecimal integer literals of unsigned type |
| 2-13-4 | Required | Literal suffixes shall be upper case |
| 2-13-5 | Required | Narrow and wide string literals shall not be concatenated |

### Chapter 3 — Basic Concepts

| Rule | Level | Description |
|------|-------|-------------|
| 3-1-1 | Required | It shall be possible to include any header file in multiple translation units without violating the One Definition Rule |
| 3-1-2 | Required | Functions shall not be declared at block scope |
| 3-1-3 | Required | When an array is declared, its size shall either be stated explicitly or defined implicitly by initialisation |
| 3-2-1 | Required | All declarations of an object or function shall have compatible types |
| 3-2-2 | Required | The One Definition Rule shall not be violated |
| 3-2-3 | Required | A type, object or function that is used in multiple translation units shall be declared in one and only one file |
| 3-2-4 | Required | An identifier with external linkage shall have exactly one definition |
| 3-3-1 | Required | Objects or functions with external linkage shall be declared in a header file |
| 3-3-2 | Required | If a function has internal linkage then all re-declarations shall include the static storage class specifier |
| 3-4-1 | Required | An identifier declared to be an object or type shall be defined in a block that minimises its visibility |
| 3-9-1 | Required | The types used for an object, a function return type, or a function parameter shall be token-for-token identical in all declarations and re-declarations |
| 3-9-2 | Advisory | typedefs that indicate size and signedness should be used in place of the basic numerical types |
| 3-9-3 | Required | The underlying bit representations of floating-point values shall not be used |

### Chapter 4 — Standard Conversions

| Rule | Level | Description |
|------|-------|-------------|
| 4-5-1 | Required | Expressions with type bool shall not be used as operands to built-in operators other than the assignment operator `=`, the logical operators `&&`, `||`, `!`, the equality operators `==` and `!=`, the unary `&` operator, and the conditional operator |
| 4-5-2 | Required | Expressions with type enum shall not be used as operands to built-in operators other than the subscript operator `[]`, the assignment operator `=`, the equality operators `==` and `!=`, the unary `&` operator, and the relational operators `<`, `<=`, `>`, `>=` |
| 4-5-3 | Required | Expressions with type (plain) char and wchar_t shall not be used as operands to built-in operators other than the assignment operator `=`, the equality operators `==` and `!=`, and the unary `&` operator |
| 4-10-1 | Required | NULL shall not be used as an integer value |
| 4-10-2 | Required | Literal zero (0) shall not be used as the null-pointer-constant |

---

## MISRA C++:2023 Classification

### Obligation Levels

| Level | Symbol | Description |
|-------|--------|-------------|
| **Mandatory** | M | No deviation, no exception. Absolute prohibition of the construct. |
| **Required** | R | Must comply unless a documented deviation is approved and authorised. |
| **Advisory** | A | Recommended. Non-compliance documented collectively. |

### Decidability

| Type | Meaning |
|------|---------|
| **Decidable** | A static analysis tool can determine compliance or violation for every program. The tool does not need external knowledge. |
| **Undecidable** | No algorithm can determine all violations across all programs. Requires human judgment, documentation, or process to verify. |

### Example Rule Classifications (2023)

```
Rule M6-9    [Mandatory, Decidable]
  A goto statement shall not be used.

Rule R5-4    [Required, Decidable]
  The value of an expression shall not be implicitly converted to a
  different essential type.

Rule A8-4    [Advisory, Undecidable]
  Output parameters of functions shall not use pass-by-reference.
```

---

## Rule Categories by Topic

### Expressions (Chapter 5 / 2008)

Rules governing how expressions are formed and evaluated:

```cpp
// Rule 5-0-1: The value of an expression shall be the same under
// any order of evaluation that the standard permits.
// VIOLATION: order of evaluation of function arguments is unspecified
int x = 5;
bad_func(x++, x++);     // Non-compliant

// CORRECT:
int a = x++;
int b = x++;
good_func(a, b);        // Compliant — deterministic
```

```cpp
// Rule 5-0-3: A cvalue expression shall not be implicitly converted
// to a different underlying type.
// VIOLATION:
uint8_t a = 5u;
uint16_t b = 10u;
uint16_t c = a + b;     // Non-compliant — mixed types, implicit conversion

// CORRECT:
uint16_t c = static_cast<uint16_t>(a) + b;   // Compliant
```

### Statements (Chapter 6 / 2008)

```cpp
// Rule 6-2-1: Assignment operators shall not be used in sub-expressions.
// VIOLATION:
if (x = foo()) { ... }  // Non-compliant — assignment in condition

// CORRECT:
x = foo();
if (x != 0) { ... }     // Compliant
```

```cpp
// Rule 6-4-1: An if ( condition ) construct shall be followed by
// a compound statement. The else keyword shall be followed by either
// a compound statement, or another if statement.
// VIOLATION:
if (x > 0)
    do_thing();         // Non-compliant — no braces

// CORRECT:
if (x > 0) {
    do_thing();         // Compliant
}
```

```cpp
// Rule 6-5-1: A for loop shall contain a single loop-counter which
// shall not have floating type.
// VIOLATION:
for (float f = 0.0f; f < 1.0f; f += 0.1f) { ... }  // Non-compliant

// CORRECT:
for (uint32_t i = 0U; i < 10U; ++i) { ... }  // Compliant
```

### Declarations and Types (Chapters 7–8 / 2008)

```cpp
// Rule 7-1-1: A variable which is not modified shall be const-qualified.
// VIOLATION:
void foo(int x) {           // Non-compliant if x is never modified
    display(x);
}

// CORRECT:
void foo(const int x) {     // Compliant
    display(x);
}
```

```cpp
// Rule 7-1-2: A pointer or reference parameter in a function shall be
// declared as pointer to const or reference to const if the corresponding
// object is not modified.
// VIOLATION:
void print_data(int* data, uint32_t length);  // Non-compliant if data not modified

// CORRECT:
void print_data(const int* data, uint32_t length);  // Compliant
```

---

## Commonly Violated Rules (Top-10)

| Rule | Category | Why Common |
|------|----------|------------|
| 5-0-3 | Expressions | Integer promotions are implicit in C++ |
| 5-0-5 | Expressions | `sizeof` applied to expressions instead of types |
| 5-0-7 | Expressions | Compound arithmetic on `char` |
| 6-4-1 | Statements | Missing braces on single-line `if`/`else` |
| 7-1-1 | Declarations | Forgetting `const` on unmodified locals/params |
| 8-0-1 | Declarators | Multiple declarations per statement |
| 9-6-1 | Classes | Using bit fields of non-integral type |
| 15-3-3 | Exceptions | Catching via value instead of reference |
| 16-0-1 | Preprocessing | `#include` not at top of file |
| 16-2-2 | Preprocessing | Macros used instead of `inline` or `enum class` |

---

## Classification Summary Table

| Attribute | MISRA C++:2008 | MISRA C++:2023 |
|-----------|----------------|----------------|
| Obligation levels | Required, Advisory, Document | Mandatory, Required, Advisory |
| Decidability marked | No | Yes (Decidable / Undecidable) |
| Rule count | 228 | ~250 |
| C++ version | C++03 | C++17 |
| Deviation for Mandatory | Not applicable (no "Mandatory" level) | Not permitted |
| Deviation for Required | Yes, with full documentation | Yes, with full documentation |
| Advisory recording | Collectively | Collectively |
