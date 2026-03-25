---
title: MISRA C++ Language-Independent & Preprocessing Rules
createTime: 2026/03/25 00:00:00
permalink: /kb/embedded/misra-cpp/language-independent/
---

# MISRA C++ Language-Independent & Preprocessing Rules

## Language-Independent Issues (Chapter 0)

These rules address code quality concerns that are not tied to any specific C++ construct — dead code, unreachable paths, unused variables, undocumented assumptions.

---

### Rule 0-1-1 — No Unreachable Code (Required)

A project shall not contain unreachable code.

**Rationale**: Unreachable code is a strong indicator of a logic error. It may represent dead code paths left over from maintenance, or incorrectly implemented control flow.

```cpp
// NON-COMPLIANT: code after return is unreachable
int32_t compute(int32_t x) {
    return x * 2;
    x++;           // Non-compliant — unreachable
}

// NON-COMPLIANT: condition is always false
int32_t y = 5;
if (y > 10) {
    do_thing();    // Non-compliant — unreachable given constant y
}

// COMPLIANT: all paths reachable
int32_t compute(int32_t x) {
    if (x > 0) {
        return x * 2;
    }
    return 0;      // Compliant — reachable
}
```

---

### Rule 0-1-3 — No Unused Variables (Required)

A project shall not contain unused variables.

```cpp
// NON-COMPLIANT
void process(uint32_t len) {
    uint32_t unused_count = 0U;   // Non-compliant — never used
    for (uint32_t i = 0U; i < len; ++i) {
        do_work();
    }
}

// COMPLIANT
void process(uint32_t len) {
    for (uint32_t i = 0U; i < len; ++i) {
        do_work();
    }
}
```

---

### Rule 0-1-7 — Return Value Must Be Used (Required)

The value returned by a function with a non-void return type (that is not an overloaded operator) shall always be used.

```cpp
// NON-COMPLIANT: return value discarded
uint8_t read_register(uint32_t addr);

void configure(void) {
    read_register(0x1000U);    // Non-compliant — return value discarded
}

// COMPLIANT
void configure(void) {
    uint8_t val = read_register(0x1000U);   // return value used
    (void)val;  // explicit cast to void acceptable when intentionally ignored
}
```

---

### Rule 0-3-1 — Document Implementation-Defined Behaviour (Advisory)

All usage of implementation-defined behaviour shall be documented.

Common implementation-defined behaviours in C++:
- `sizeof(int)`, `sizeof(long)`, `sizeof(pointer)`
- Bit order of bit fields
- Signedness of `char`
- Results of right-shifting signed negative values
- `reinterpret_cast` aliasing

```cpp
// ADVISORY: document implementation-defined behaviour
// Implementation-defined: sizeof(int) == 4 on this platform (x86_64, AArch64)
// Documented in: platform_assumptions.h
static_assert(sizeof(int32_t) == 4U, "Platform requires 32-bit int");
```

---

## Identifier Rules (Chapter 2, Sections 10, 13)

### Rule 2-10-1 — Typographic Unambiguity (Required)

Different identifiers shall be typographically unambiguous throughout the project.

Typographically similar characters to avoid mixing:
- `l` (lowercase L) and `1` (one) and `I` (uppercase i)
- `O` (uppercase o) and `0` (zero)
- `S` and `5`
- `Z` and `2`

```cpp
// NON-COMPLIANT: typographically similar names
void init_l1bus(void);   // 'l' and '1' ambiguous
void init_1lbus(void);

// COMPLIANT: unambiguous names
void init_can_bus(void);
void init_lin_bus(void);
```

---

### Rule 2-10-2 — No Identifier Hiding (Required)

Identifiers declared in an inner scope shall not hide an identifier declared in an outer scope.

```cpp
// NON-COMPLIANT: inner 'value' hides outer 'value'
uint32_t value = 100U;

void process(void) {
    uint32_t value = 0U;    // Non-compliant — hides outer value
    use(value);
}

// COMPLIANT: use distinct names
uint32_t g_value = 100U;

void process(void) {
    uint32_t local_value = 0U;   // Compliant — no hiding
    use(local_value);
}
```

---

### Rule 2-13-2 — No Octal Constants (Required)

Octal constants (integer literals beginning with `0`) shall not be used.

```cpp
// NON-COMPLIANT: leading zero makes this octal 075 = decimal 61, not 75!
uint8_t mode = 075;      // Non-compliant — octal literal

// COMPLIANT alternatives
uint8_t mode_dec = 61U;           // decimal
uint8_t mode_hex = 0x3DU;         // hexadecimal
uint8_t mode_oct_WRONG = 075;     // Non-compliant

// Exception: sole zero literal is not octal (it has no other meaning)
uint8_t zero = 0;   // Compliant — this is the integer 0
```

---

### Rule 2-13-4 — Upper Case Literal Suffixes (Required)

Literal suffixes shall be upper case.

```cpp
// NON-COMPLIANT: lowercase suffixes
uint32_t a = 100u;      // Non-compliant 'u'
float b = 1.0f;         // Non-compliant 'f'  (MISRA 2008)
int64_t c = 100l;       // Non-compliant 'l' — ambiguous with '1'

// COMPLIANT: uppercase suffixes
uint32_t a = 100U;      // Compliant
float b = 1.0F;         // Compliant
int64_t c = 100L;       // Compliant
```

---

## Preprocessing Rules (Chapter 16)

Preprocessing is one of the most heavily regulated areas in MISRA C++ because macros are a common source of subtle bugs that are hard to detect with static analysis.

---

### Rule 16-0-1 — #include Only at Top Level (Required)

`#include` directives shall only be preceded by other preprocessor directives or comments.

```cpp
// NON-COMPLIANT: #include after code
namespace foo {
    #include "foo.h"    // Non-compliant
}

// NON-COMPLIANT: conditional #include
void func(void) {
    #include "values.h"   // Non-compliant
}

// COMPLIANT
#include "foo.h"   // At top of file, before any code
#include <cstdint>
```

---

### Rule 16-0-2 — Macros Only in Source Files or Global Headers (Required)

Macros shall only be defined or undefined in the following places:
- In C++ source files (`.cpp`, `.cxx`)
- In included headers that are not included indirectly

This prevents macro collisions across translation units.

---

### Rule 16-0-5 — Arguments to #ifdef and #ifndef (Required)

Arguments to `#if` and `#elif` shall be expressions of essential Boolean type.

---

### Rule 16-0-6 — `#undef` Only in System Headers (Required)

In the majority of cases, `#undef` shall not be used.  
Macros should not need to be undefined — if they do, consider replacing them with `inline` functions or `constexpr` values.

```cpp
// NON-COMPLIANT (typical pattern to avoid)
#define BUFFER_SIZE 256
// ... code using BUFFER_SIZE ...
#undef BUFFER_SIZE      // Non-compliant — should not be needed

// COMPLIANT alternative
constexpr uint32_t BUFFER_SIZE = 256U;  // Not a macro — no undef needed
```

---

### Rule 16-1-1 — Defined Operator Only in Preprocessor Expressions (Required)

The `defined` preprocessor operator shall only be used in one of the two standard forms:
- `defined(identifier)` 
- `defined identifier`

```cpp
// NON-COMPLIANT
#if defined (FOO) && defined BAR   // spacing inconsistency not required but be explicit
// Use consistent form:
#if defined(FOO) && defined(BAR)   // Compliant
```

---

### Rule 16-2-1 — Guard Headers from Multiple Inclusions (Required)

The preprocessor shall only be used for unconditional and conditional file inclusion and include guards, and using the following directives: `#ifndef`, `#define`, `#endif` for include guards.

```cpp
// COMPLIANT include guard pattern
#ifndef MY_HEADER_H
#define MY_HEADER_H

// content

#endif  /* MY_HEADER_H */

// ALSO COMPLIANT: pragma once (widely supported, often preferred)
#pragma once
```

---

### Rule 16-2-2 — Macros Shall Not Be Used for Constants or Function-Like Behaviour (Required)

The C preprocessor shall only be used for inclusion of header files and include guards.

Specifically, **do not use macros for**:
- Constants (`#define PI 3.14159`) — use `constexpr`
- Function-like macros — use `inline` functions or templates
- Type aliases — use `typedef` or `using`

```cpp
// NON-COMPLIANT: macro for constant
#define MAX_SENSORS 32

// NON-COMPLIANT: function-like macro
#define MAX(a, b) ((a) > (b) ? (a) : (b))

// NON-COMPLIANT: macro for type alias
#define BYTE uint8_t


// COMPLIANT: constexpr constant
constexpr uint32_t MAX_SENSORS = 32U;

// COMPLIANT: inline template function
template<typename T>
inline T max_val(T a, T b) noexcept {
    return (a > b) ? a : b;
}

// COMPLIANT: type alias
using Byte = uint8_t;
```

---

### Rule 16-3-1 — # and ## Operators (Advisory)

There shall be at most one occurrence of the `#` or `##` operators in a single macro definition.

```cpp
// NON-COMPLIANT: multiple ## operators in one macro
#define PASTE3(a, b, c) a ## b ## c   // Non-compliant

// COMPLIANT: one ## operator
#define PASTE2(a, b) a ## b           // Compliant
```

---

### Rule 16-3-2 — # Operator (Advisory)

The `#` operator should not be used.

```cpp
// NON-COMPLIANT (advisory): stringizing operator
#define STRINGIFY(x) #x
const char* name = STRINGIFY(my_var);  // Non-compliant (advisory)

// RATIONALE: better to use string literals directly
const char* name = "my_var";
```

---

### Rule 16-6-1 — #pragma Only If Required (Document)

All uses of the `#pragma` directive shall be documented, as they are compiler-specific and non-portable.

```cpp
// DOCUMENT this usage:
// Pragma: suppress MISRA 5-0-3 for this file due to hardware register packing
// Justification: hardware register layout requires exact bit positions
// Deviation record: DEV-2024-042
#pragma pack(push, 1)
struct HardwareRegister {
    uint8_t  ctrl;
    uint16_t data;
    uint8_t  status;
};
#pragma pack(pop)
```

---

## Comment Rules

### Rule 2-7-1 — No `/*` Inside C-Style Comments (Advisory)

```cpp
// NON-COMPLIANT: nested /* inside a C comment
/*
 * This function /* does something */ important
 */

// COMPLIANT: use C++ comments for commenting out code
// This function does something important
```

### Rule 2-7-2 — Do Not Comment Out Code with C-Style Comments (Advisory)

```cpp
// NON-COMPLIANT:
/*
int32_t old_implementation(void) {
    return x * 2;
}
*/

// COMPLIANT: remove dead code, or use version control to preserve old code
```

### Rule 2-7-3 — Do Not Comment Out Code with C++ Comments (Advisory)

```cpp
// NON-COMPLIANT:
// int32_t old_code = compute();
// process(old_code);

// RATIONALE: commented-out code is often stale, misleading, and pollutes the codebase.
// Use source control (git) to preserve old versions.
```

---

## Summary of Key Language-Independent and Preprocessing Rules

| Rule | Level | Core Message |
|------|-------|-------------|
| 0-1-1 | Required | No unreachable code |
| 0-1-3 | Required | No unused variables |
| 0-1-7 | Required | Always use function return values |
| 0-3-1 | Advisory | Document impl-defined behaviour |
| 2-10-1 | Required | No typographically ambiguous identifiers |
| 2-10-2 | Required | No identifier hiding |
| 2-13-2 | Required | No octal literals |
| 2-13-4 | Required | Uppercase literal suffixes |
| 16-0-1 | Required | `#include` only at top of file |
| 16-2-2 | Required | No macros for constants or functions |
| 16-3-1 | Advisory | Max one `#` / `##` per macro |
| 2-7-2 | Advisory | Don't comment out code |
