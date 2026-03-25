---
title: MISRA C++ Declarations & Definitions
createTime: 2026/03/25 00:00:00
permalink: /kb/embedded/misra-cpp/declarations-definitions/
---

# MISRA C++ Declarations & Definitions

## Overview

Chapters 3, 7, and 8 of MISRA C++:2008 govern how identifiers, types, objects, and pointers are declared and defined. Correct declarations are foundational to safe, portable C++ — many vulnerabilities and undefined behaviours originate from incorrect or ambiguous declarations.

---

## The One Definition Rule (ODR)

### Rule 3-1-1 — Headers Usable in Multiple TUs (Required)

It shall be possible to include any header file in multiple translation units without violating the One Definition Rule.

This means headers must:
- Use include guards or `#pragma once`
- Not contain definitions of non-inline, non-template functions
- Not contain definitions of non-const, non-constexpr objects with external linkage

```cpp
// header.h — NON-COMPLIANT: function definition without inline
// If included in two .cpp files, the linker sees two definitions of foo()
int32_t foo(void) {        // Non-compliant — ODR violation
    return 42;
}

// header.h — COMPLIANT
inline int32_t foo(void) {  // Compliant — inline allows multiple definitions
    return 42;
}
```

---

### Rule 3-2-2 — One Definition Rule Shall Not Be Violated (Required)

Every entity (class, function, variable with external linkage) shall have exactly one definition across the entire program.

```cpp
// file_a.cpp
int32_t g_counter = 0;      // Definition — OK in one TU

// file_b.cpp
int32_t g_counter = 0;      // Non-compliant — second definition, ODR violation

// CORRECT: declare in header, define in exactly one .cpp
// header.h:
extern int32_t g_counter;   // Declaration only

// file_a.cpp:
int32_t g_counter = 0;      // One definition — Compliant
```

---

### Rule 3-3-1 — External Linkage Declarations in Headers (Required)

Objects or functions with external linkage shall be declared in a header file.

```cpp
// NON-COMPLIANT: extern declaration buried in a .cpp file
// file_b.cpp:
extern int32_t g_value;   // Non-compliant — should be in a header

// COMPLIANT:
// shared.h:
extern int32_t g_value;   // Compliant — reachable from all TUs

// shared.cpp:
int32_t g_value = 0;      // Definition
```

---

## Const-Correctness

### Rule 7-1-1 — Non-Modified Objects Shall Be const (Required)

A variable which is not modified shall be `const`-qualified.

```cpp
// NON-COMPLIANT
void display(uint32_t len, int32_t* data) {  // data never modified inside
    for (uint32_t i = 0U; i < len; ++i) {
        print(data[i]);                      // only reads data
    }
}

// COMPLIANT
void display(uint32_t len, const int32_t* data) {  // const correct
    for (uint32_t i = 0U; i < len; ++i) {
        print(data[i]);
    }
}
```

---

### Rule 7-1-2 — Pointer/Reference Parameters as const (Required)

A pointer or reference parameter in a function shall be declared as pointer to `const` or reference to `const` if the corresponding object is not modified.

```cpp
// NON-COMPLIANT: buffer is read-only but not declared const
bool validate_frame(uint8_t* buffer, uint32_t length) {
    for (uint32_t i = 0U; i < length; ++i) {
        if (buffer[i] == 0U) { return false; }
    }
    return true;
}

// COMPLIANT
bool validate_frame(const uint8_t* buffer, uint32_t length) {
    for (uint32_t i = 0U; i < length; ++i) {
        if (buffer[i] == 0U) { return false; }
    }
    return true;
}
```

---

## Type Definitions and Aliases

### Rule 3-9-2 — Use Sized Integer Types (Advisory)

`typedef` names that indicate size and signedness should be used in place of the basic numerical types.

```cpp
// NON-COMPLIANT (advisory): basic types whose size is platform-dependent
int   counter;     // int size varies: 16-bit, 32-bit, 64-bit
long  value;       // long size varies: 32-bit on MSVC, 64-bit on Linux 64-bit

// COMPLIANT: fixed-size integer types from <cstdint>
int32_t  counter;
int64_t  value;
uint8_t  byte_data;
uint16_t word_data;
uint32_t dword_data;
```

---

### Rule 2-10-3 — Unique typedef Names (Required)

A `typedef` name shall be a unique identifier (not used for any other purpose in the program).

```cpp
// NON-COMPLIANT: typedef name reused as variable name
typedef uint32_t MyType;
void func(void) {
    uint8_t MyType = 5U;    // Non-compliant — reuses typedef name
}

// COMPLIANT
typedef uint32_t MyType;
void func(void) {
    uint8_t my_var = 5U;    // Compliant — distinct name
}
```

---

## Object Declarations

### Rule 8-0-1 — One Object Per Declaration (Required)

Multiple declarators shall not be used in the same declaration.

```cpp
// NON-COMPLIANT: multiple declarators
int32_t a, b, c;           // Non-compliant
int32_t *p1, p2;           // Non-compliant and dangerous: p2 is int32_t, not int32_t*

// COMPLIANT: one object per declaration
int32_t a;
int32_t b;
int32_t c;
int32_t* p1;
int32_t* p2;
```

---

### Rule 3-4-1 — Minimise Scope of Variables (Required)

An identifier declared to be an object or type shall be defined in a block that minimises its visibility.

```cpp
// NON-COMPLIANT: variable declared at wider scope than needed
int32_t result;              // declared here but only used inside the loop
for (uint32_t i = 0U; i < 10U; ++i) {
    result = compute(i);     // Non-compliant — result should be inside loop
    store(result);
}

// COMPLIANT: narrowest possible scope
for (uint32_t i = 0U; i < 10U; ++i) {
    int32_t result = compute(i);   // Compliant — declared where first used
    store(result);
}
```

---

## Pointer Declarations

### Rule 8-3-1 — & and * Bind to Type (Required)

Parameters in a function declaration that are arrays shall be declared as pointers.

### Rule 8-5-2 — Braces Required for Multi-Dimensional Arrays (Required)

Braces shall be used to indicate and match the structure in non-zero initialisation of arrays and structures.

```cpp
// NON-COMPLIANT: no braces for inner arrays
int32_t arr[2][3] = { 0, 1, 2, 3, 4, 5 };        // Non-compliant

// COMPLIANT: nested braces match structure
int32_t arr[2][3] = { { 0, 1, 2 }, { 3, 4, 5 } }; // Compliant
```

---

## Pointer Arithmetic and Pointer Safety

### Rule 5-0-15 — Array Types in Subscript Expressions (Required)

Array indexing shall be the only form of pointer arithmetic.

```cpp
// NON-COMPLIANT: raw pointer arithmetic
uint8_t buffer[64];
uint8_t* p = buffer;
uint8_t val = *(p + 5);     // Non-compliant — pointer arithmetic

// COMPLIANT: array subscript
uint8_t val = buffer[5];    // Compliant
```

---

### Rule 5-0-16 — No Pointer Subtraction on Different Arrays (Required)

Pointer arithmetic shall only be applied to pointers that address elements of the same array.

```cpp
// NON-COMPLIANT: subtracting pointers into different arrays
uint8_t arr1[10];
uint8_t arr2[10];
ptrdiff_t diff = &arr2[0] - &arr1[0];   // Non-compliant — undefined behaviour

// COMPLIANT: only within the same array
ptrdiff_t diff = &arr1[5] - &arr1[0];   // Compliant — same array
```

---

### Rule 5-0-17 — No Pointer Comparison Across Arrays (Required)

The relationship operators (`<`, `<=`, `>`, `>=`) shall not be applied to pointer types except where they point into the same array.

---

### Rule 8-4-1 — Function Parameter Types Shall Be Declared (Required)

Functions shall not be declared using the ellipsis notation (variadic `...`).

```cpp
// NON-COMPLIANT: variadic function
void log_message(const char* fmt, ...);    // Non-compliant

// COMPLIANT: explicitly typed parameters
void log_message(uint8_t level, const char* message, uint32_t code);

// Or use variadic templates (MISRA C++:2023 allows with restrictions)
template<typename... Args>
void log_safe(Args&&... args);
```

---

## Function Declarations

### Rule 8-4-2 — Identifiers Used in Declarations Shall Be Identical (Required)

The identifiers used in the declaration and definition of a function shall be identical.

```cpp
// NON-COMPLIANT: parameter names differ between declaration and definition
// header.h:
void configure_device(uint32_t speed, uint8_t mode);

// source.cpp:
void configure_device(uint32_t s, uint8_t m) {   // Non-compliant — different names
    ...
}

// COMPLIANT:
void configure_device(uint32_t speed, uint8_t mode) {   // Names match
    ...
}
```

---

### Rule 8-4-4 — Function Identifiers in Expressions (Required)

A function identifier shall either be used to call the function or it shall be preceded by `&`.

```cpp
// NON-COMPLIANT: function name used without call or address-of
typedef void (*FuncPtr)(void);
FuncPtr p = some_function;    // Non-compliant — should use &some_function

// COMPLIANT
FuncPtr p = &some_function;   // Compliant — explicit &
```

---

## Static Storage Duration

### Rule 3-3-2 — Static Re-Declarations (Required)

If a function has internal linkage, all re-declarations shall include the `static` storage class specifier.

```cpp
// NON-COMPLIANT: first declaration has static, re-declaration does not
static void helper(void);   // First declaration — internal linkage

void helper(void) {         // Non-compliant — missing static
    ...
}

// COMPLIANT
static void helper(void);

static void helper(void) {  // Compliant — both have static
    ...
}
```

---

## Bit Fields

### Rule 9-6-1 — Bit Fields Shall Be Declared as Integral Types (Required)

Bit fields shall be of integral type, and shall be either `unsigned int` or `signed int` (or a `typedef` of those).

```cpp
// NON-COMPLIANT
struct Flags {
    bool     active : 1;    // Non-compliant — bool bit field
    float    value  : 4;    // Non-compliant — float bit field (impossible practically)
    uint8_t  code   : 3;    // Non-compliant — uint8_t not guaranteed for bit fields
};

// COMPLIANT
struct Flags {
    uint32_t active : 1;    // Compliant — unsigned int
    uint32_t code   : 3;    // Compliant — unsigned int
    uint32_t mode   : 4;    // Compliant — unsigned int
};
```

---

### Rule 9-6-2 — Named Bit Fields Shall Be Either Signed or Unsigned Int (Required)

Named bit fields of type `int` shall be prohibited because signedness of plain `int` is implementation-defined.

```cpp
// NON-COMPLIANT
struct Control {
    int flag : 1;     // Non-compliant — signedness of int:1 is impl-defined
};

// COMPLIANT
struct Control {
    uint32_t flag : 1;    // Compliant — explicitly unsigned
    int32_t  sign : 4;    // Compliant — explicitly signed
};
```

---

## Summary: Key Declaration & Definition Rules

| Rule | Level | Rule Summary |
|------|-------|-------------|
| 3-1-1 | Required | Headers usable in multiple TUs without ODR violation |
| 3-2-2 | Required | Don't violate ODR |
| 3-3-1 | Required | External linkage declarations in header files |
| 3-4-1 | Required | Declare variables in the narrowest possible scope |
| 3-9-2 | Advisory | Use sized integer typedefs |
| 7-1-1 | Required | Unmodified objects shall be const |
| 7-1-2 | Required | Unmodified pointer/reference params shall be const |
| 8-0-1 | Required | One declarator per declaration |
| 8-4-1 | Required | No variadic functions (`...`) |
| 8-4-2 | Required | Declaration and definition identifiers must match |
| 8-4-4 | Required | Function identifiers: call or use `&` |
| 9-6-1 | Required | Bit fields must be integral (unsigned/signed int) |
| 9-6-2 | Required | No plain `int` bit fields — specify signedness |
