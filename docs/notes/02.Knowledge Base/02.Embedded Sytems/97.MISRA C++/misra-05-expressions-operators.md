---
title: MISRA C++ Expressions, Operators & Conversions
createTime: 2026/03/25 00:00:00
permalink: /kb/embedded/misra-cpp/expressions-operators/
---

# MISRA C++ Expressions, Operators & Conversions

## Overview

Chapter 4 (Standard Conversions) and Chapter 5 (Expressions) of MISRA C++:2008 contain the largest cluster of rules. Implicit type conversions and complex expressions are among the most common sources of subtle bugs in C++ — especially on embedded targets where integer widths vary.

---

## Essential Type Model

The **essential type** model (central to MISRA C++ and MISRA C) classifies every expression into one of these essential types:

| Essential Type | C++ Types Covered |
|----------------|-------------------|
| Boolean | `bool` |
| Character | `char`, `wchar_t` |
| Signed integer | `signed char`, `short`, `int`, `long`, `long long`, `int8_t`, `int16_t`, `int32_t`, `int64_t` |
| Unsigned integer | `unsigned char`, `unsigned short`, `unsigned int`, `unsigned long`, `uint8_t`, `uint16_t`, `uint32_t`, `uint64_t` |
| Floating-point | `float`, `double`, `long double` |
| Enum | Any `enum` or `enum class` |

The rules restrict implicit conversions **between** essential types.

---

## Implicit Conversion Rules

### Rule 5-0-3 — No Implicit Conversion to Different Underlying Type (Required)

A cvalue expression shall not be implicitly converted to a different underlying type.

```cpp
// NON-COMPLIANT: uint8_t + uint16_t — uint8_t promoted to int, then assigned to uint16_t
uint8_t  a = 5U;
uint16_t b = 10U;
uint16_t c = a + b;             // Non-compliant — a undergoes implicit int promotion

// COMPLIANT
uint16_t c = static_cast<uint16_t>(a) + b;    // Compliant — explicit cast

// NON-COMPLIANT: narrowing
uint32_t big = 1000U;
uint8_t  small = big;           // Non-compliant — potential loss of data

// COMPLIANT
uint8_t small = static_cast<uint8_t>(big);    // Compliant — explicit, documents intent
```

---

### Rule 5-0-4 — No Implicit Signed/Unsigned Conversion (Required)

An implicit integral conversion shall not change the signedness of the underlying type.

```cpp
// NON-COMPLIANT: int32_t assigned to uint32_t implicitly
int32_t  signed_val = -1;
uint32_t unsigned_val = signed_val;    // Non-compliant — sign change
// Result: unsigned_val == 0xFFFFFFFF (4294967295)

// COMPLIANT
uint32_t unsigned_val = static_cast<uint32_t>(signed_val);   // Still wrong logically but compliant

// BETTER: redesign to avoid signed/unsigned mixing
```

---

### Rule 5-0-5 — No Implicit Floating to Integer Conversion (Required)

There shall be no implicit floating-integral conversions.

```cpp
// NON-COMPLIANT
float freq = 100.5F;
int32_t period = freq;       // Non-compliant — truncates 100.5 to 100

// COMPLIANT
int32_t period = static_cast<int32_t>(freq);    // Compliant — explicit
```

---

### Rule 5-0-6 — No Implicit Conversion Decreasing Width (Required)

An implicit integral or floating-point conversion shall not reduce the size of the underlying type.

```cpp
// NON-COMPLIANT: uint32_t to uint16_t (narrowing)
uint32_t val32 = 70000U;
uint16_t val16 = val32;        // Non-compliant — truncates

// COMPLIANT
uint16_t val16 = static_cast<uint16_t>(val32);  // Explicit — documents potential truncation
```

---

### Rule 5-0-7 — No Non-Constant Expressions Composited with Chars (Required)

There shall be no explicit floating-integral conversions of a cvalue expression.

---

### Rule 4-5-1 — bool Shall Not Be Used with Non-Boolean Operators (Required)

Expressions with type `bool` shall not be used as operands to built-in operators other than:
`=`, `&&`, `||`, `!`, `==`, `!=`, unary `&`, and the conditional `?:` operator.

```cpp
// NON-COMPLIANT: using bool in arithmetic
bool flag = true;
int32_t count = flag + 1;     // Non-compliant — +1 on bool

// NON-COMPLIANT
if (flag == 1) { ... }         // Non-compliant — comparing bool to integer

// COMPLIANT
if (flag) { ... }              // Compliant
if (!flag) { ... }             // Compliant
bool result = flag && other;   // Compliant
```

---

### Rule 4-5-2 — enum Confined to Logical/Relational Operators (Required)

Expressions with type `enum` shall not be used as operands to built-in operators except `[]`, `=`, `==`, `!=`, unary `&`, `<`, `<=`, `>`, `>=`.

```cpp
// NON-COMPLIANT: arithmetic on enum
enum class State { Idle = 0, Running = 1, Error = 2 };
State s = State::Idle;
int32_t n = s + 1;            // Non-compliant — arithmetic on enum

// COMPLIANT: use underlying_type explicitly
int32_t n = static_cast<int32_t>(s) + 1;    // Compliant — explicit conversion
```

---

### Rule 4-10-1 — NULL Not Used as Integer (Required)

`NULL` shall not be used as an integer value.

```cpp
// NON-COMPLIANT
int32_t x = NULL;     // Non-compliant — NULL is an integer

// COMPLIANT
int32_t x = 0;        // Compliant — use integer literal 0
int32_t* p = nullptr; // Compliant (C++11+) — use nullptr for pointers
```

---

### Rule 4-10-2 — 0 Not Used as Null Pointer Constant (Required)

Literal zero shall not be used as the null-pointer-constant.

```cpp
// NON-COMPLIANT (MISRA 2008, pre-C++11 mindset carried forward)
int32_t* p = 0;             // Non-compliant — use nullptr

// NON-COMPLIANT
if (ptr == 0) { ... }       // Non-compliant — compare with nullptr

// COMPLIANT
int32_t* p = nullptr;       // Compliant
if (ptr == nullptr) { ... } // Compliant
```

---

## Assignment Operators

### Rule 6-2-1 — No Assignment in Sub-Expressions (Required)

Assignment operators shall not be used in sub-expressions.

```cpp
// NON-COMPLIANT: assignment inside condition
uint32_t val;
if ((val = read_sensor()) != 0U) {    // Non-compliant
    process(val);
}

// COMPLIANT
uint32_t val = read_sensor();
if (val != 0U) {
    process(val);
}

// NON-COMPLIANT: chained assignment (may be acceptable in some contexts but Rule 6-2-1 restricts)
int32_t a, b, c;
a = b = c = 0;    // Non-compliant — chained assignment is a sub-expression
```

---

### Rule 6-2-2 — Floating-Point Equality (Required)

Floating-point expressions shall not be directly or indirectly tested for equality or inequality.

```cpp
// NON-COMPLIANT: exact floating-point comparison (unreliable due to rounding)
float measured = compute_value();
if (measured == 3.14159F) { ... }          // Non-compliant
if (measured != 0.0F) { ... }              // Non-compliant

// COMPLIANT: use a tolerance comparison
float epsilon = 1.0e-5F;
if (fabsf(measured - 3.14159F) < epsilon) { ... }   // Compliant
if (fabsf(measured) > epsilon) { ... }               // Compliant
```

---

### Rule 6-2-3 — before++ / after++ (Advisory)

The `++` and `--` operators should only appear as standalone statements, not in larger expressions.

```cpp
// NON-COMPLIANT (advisory)
arr[i++] = val;              // Non-compliant (advisory)
int32_t x = ++counter + 2;  // Non-compliant (advisory)

// COMPLIANT
arr[i] = val;
i++;                         // Compliant — standalone statement

int32_t x = counter + 2;
++counter;                   // Compliant — separate statement
```

---

## Unary Operators

### Rule 5-3-1 — Each Operand of ! Shall Have Boolean Type (Required)

```cpp
// NON-COMPLIANT: ! applied to integer
uint32_t flags = get_flags();
if (!flags) { ... }           // Non-compliant — !uint32_t reduces to bool via integral comparison

// COMPLIANT
if (flags == 0U) { ... }      // Compliant — explicit comparison
```

### Rule 5-3-2 — Unary Minus Only on Signed Expressions (Required)

The unary minus operator shall not be applied to an expression whose underlying type is unsigned.

```cpp
// NON-COMPLIANT
uint32_t u = 5U;
int32_t  n = -u;    // Non-compliant — unary minus on unsigned is implementation-defined

// COMPLIANT
int32_t  n = -static_cast<int32_t>(u);   // Compliant — convert first
```

---

## Shift Operators

### Rule 5-8-1 — Shift Count Within Type Width (Required)

The right hand operand of a shift operator shall lie in the range zero to one less than the width in bits of the underlying type of the left hand operand.

```cpp
// NON-COMPLIANT: shifting by too many bits is undefined behaviour
uint8_t  byte_val = 0x01U;
uint32_t result = byte_val << 8U;    // Non-compliant — shifts past width of uint8_t

// COMPLIANT: widen before shifting
uint32_t result = static_cast<uint32_t>(byte_val) << 8U;   // Compliant
```

---

## Bitwise Operators

### Rule 5-0-21 — Bitwise Operations on Signed Types (Required)

Bitwise operations shall not be performed on signed integer types.

```cpp
// NON-COMPLIANT: bitwise AND on signed int
int32_t val = 0x12345678;
int32_t masked = val & 0xFF;    // Non-compliant — bitwise op on signed type

// COMPLIANT
uint32_t uval    = static_cast<uint32_t>(val);
uint32_t masked  = uval & 0xFFU;    // Compliant — bitwise on unsigned
```

---

## Logical Operators

### Rule 5-2-1 — Each Operand of && and || Shall Be Boolean (Required)

Each operand of the `&&` or `||` operators shall be a postfix-expression.

```cpp
// NON-COMPLIANT: non-boolean operands
uint32_t a = 5U, b = 3U;
if (a && b) { ... }              // Non-compliant — a and b are integers

// COMPLIANT: convert to boolean explicitly
if ((a != 0U) && (b != 0U)) { ... }  // Compliant
```

---

### Rule 5-14-1 — No Side Effects in Right Operand of Logical && or || (Required)

The right operand of `&&` or `||` shall not contain side effects.

```cpp
// NON-COMPLIANT: side effect in right operand — right side may not be evaluated (short-circuit)
bool result = is_valid() && (++counter > 0);   // Non-compliant — ++counter may not execute

// COMPLIANT: separate the side effect
++counter;
bool result = is_valid() && (counter > 0);     // Compliant
```

---

## Conditional Operator

### Rule 5-0-13 — Condition in Conditional Operators (Required)

The condition of a ternary `? :` shall be a Boolean expression.

```cpp
// NON-COMPLIANT: condition is integer
uint32_t len = 10U;
uint32_t result = len ? process() : 0U;         // Non-compliant

// COMPLIANT
uint32_t result = (len != 0U) ? process() : 0U; // Compliant
```

---

## sizeof Operator

### Rule 5-3-4 — sizeof Applied to Expressions Then → sizeof(Type) (Required)

The `sizeof` operator shall not be applied to an expression that contains a side effect.

```cpp
// NON-COMPLIANT: side effect inside sizeof (side effect is never executed)
sizeof(arr[i++]);    // Non-compliant — i++ inside sizeof is never evaluated

// COMPLIANT
sizeof(arr[0]);     // Compliant — no side effect
sizeof(int32_t);    // Compliant — type, not expression
```

---

## Comma Operator

### Rule 5-18-1 — No Comma Operator in Expressions (Required)

The comma operator shall not be used.

```cpp
// NON-COMPLIANT
for (int32_t i = 0, j = 10; i < j; ++i, --j) { ... }  // Non-compliant — comma in for

// Exception: commas in for-loop initialisation and increment are acceptable
// Rule 5-18-1 strictly means comma operator in expressions like: (a++, b++)
int32_t val = (do_a(), do_b());    // Non-compliant — comma operator

// COMPLIANT
do_a();
int32_t val = do_b();              // Compliant
```

---

## Cast Operators

### Rule 5-2-4 — Only C++ Style Casts (Required)

C-style casts and functional notation casts shall not be used.

```cpp
// NON-COMPLIANT: C-style cast
uint32_t u = (uint32_t)some_int;                 // Non-compliant

// NON-COMPLIANT: functional notation cast
uint32_t u = uint32_t(some_int);                 // Non-compliant

// COMPLIANT: C++ named casts
uint32_t u = static_cast<uint32_t>(some_int);    // Compliant
```

---

### Rule 5-2-5 — No Cast to Remove const or volatile (Required)

A cast shall not remove any `const` or `volatile` qualification from the type of a pointer or reference.

```cpp
// NON-COMPLIANT: const_cast to remove const
const uint8_t* const_ptr = get_data();
uint8_t* mutable_ptr = const_cast<uint8_t*>(const_ptr);   // Non-compliant
*mutable_ptr = 0;    // Writes to data that should be read-only — UB possible

// COMPLIANT: redesign to avoid needing const_cast
// If you need to modify data, it should not be const
```

---

### Rule 5-2-6 — No reinterpret_cast (Required)

A cast shall not convert a pointer to a function to any other pointer type, including a pointer to function type.

**Note**: `reinterpret_cast` is highly restricted in MISRA C++. The only accepted use is for converting between pointer types when interacting with hardware registers — and this must be deviations-documented.

```cpp
// NON-COMPLIANT: reinterpret_cast between unrelated types
uint32_t raw = reinterpret_cast<uint32_t>(ptr);   // Non-compliant

// NON-COMPLIANT: accessing hardware via reinterpret_cast without deviation
volatile uint32_t* reg = reinterpret_cast<volatile uint32_t*>(0x40021000);

// COMPLIANT (with deviation): document hardware register access
// Deviation reference: DEV-2024-007
// Justification: Required to access memory-mapped hardware register at 0x40021000
// Risk: implementation-defined alignment conversion
// Mitigation: address is always aligned to 4-byte boundary per hardware spec
volatile uint32_t* reg = reinterpret_cast<volatile uint32_t*>(0x40021000U);
```

---

## Summary: Key Expression Rules

| Rule | Level | Summary |
|------|-------|---------|
| 4-5-1 | Required | No non-boolean operators on `bool` |
| 4-5-2 | Required | No arithmetic on `enum` |
| 4-10-1 | Required | `NULL` not used as integer |
| 4-10-2 | Required | `0` not used as null pointer |
| 5-0-3 | Required | No implicit type change between essential types |
| 5-0-4 | Required | No implicit signed/unsigned conversion |
| 5-0-5 | Required | No implicit float→int conversion |
| 5-0-6 | Required | No implicit narrowing conversion |
| 5-2-4 | Required | Only C++ style casts (no C-style) |
| 5-2-5 | Required | No cast that removes `const`/`volatile` |
| 5-3-1 | Required | `!` only on boolean types |
| 5-3-2 | Required | Unary minus only on signed operands |
| 5-8-1 | Required | Shift count within bitwidth of type |
| 5-0-21 | Required | No bitwise ops on signed types |
| 5-14-1 | Required | No side effects in `&&`/`||` right operand |
| 5-18-1 | Required | No comma operator |
| 6-2-1 | Required | No assignment in sub-expressions |
| 6-2-2 | Required | No floating-point equality test |
| 6-2-3 | Advisory | `++`/`--` as standalone statements only |
