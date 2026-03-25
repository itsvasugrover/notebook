---
title: MISRA C++ Templates & Generic Programming
createTime: 2026/03/25 00:00:00
permalink: /kb/embedded/misra-cpp/templates-generics/
---

# MISRA C++ Templates & Generic Programming

## Overview

Chapter 14 of MISRA C++:2008 governs templates. Templates are a powerful C++ feature but they generate code instantiated at compile time — the resulting machine code must be fully analysable. MISRA restricts templates to ensure generated code remains predictable, analysable, and free of subtle ordering or specialisation hazards.

---

## Why Templates are Restricted in Safety-Critical Code

| Concern | Why It Matters |
|---------|---------------|
| Implicit instantiation | Compiler decides what code is generated — hard to review/certify |
| Partial specialisation pitfalls | Wrong specialisation silently selected |
| Dependent name resolution | Two-phase lookup rules are subtle and error-prone |
| SFINAE | Substitution failure logic is opaque and hard to verify |
| Code bloat | Every instantiation creates code — ROM budget critical in embedded |
| Undefined behaviour from templates | Template metaprogramming can produce UB silently |

---

## Template Declarations

### Rule 14-5-1 — Copy Constructors and Copy Assignment Shall Not Be Templates (Required)

A copy constructor or copy assignment shall not be a template function.

```cpp
// NON-COMPLIANT: templated copy constructor
class Config {
public:
    template<typename T>
    Config(const T& other) { ... }   // Non-compliant — template copy constructor
};

// COMPLIANT: explicit copy constructor
class Config {
public:
    Config(const Config& other) = default;    // Compliant — non-template
    Config& operator=(const Config& other) = default;
};
```

---

### Rule 14-5-2 — Member Function Template Shall Not Be Virtual (Required)

Member function templates shall not be declared `virtual`.

```cpp
// NON-COMPLIANT: virtual function template
class Processor {
public:
    template<typename T>
    virtual void process(T data) { ... }   // Non-compliant — virtual template
};

// Why it's non-compliant: The compiler cannot build a vtable for an open-ended
// set of template instantiations. Most compilers reject this outright.

// COMPLIANT: use a non-template virtual interface
class Processor {
public:
    virtual void process(uint32_t data) = 0;   // Compliant
    virtual ~Processor() = default;
};
```

---

### Rule 14-5-3 — Overloaded Function Templates Shall Not Be Overloaded with Non-Template Functions (Required)

A non-member generic function shall only be declared in a namespace that does not contain an ordinary function with the same name.

```cpp
// NON-COMPLIANT: overloaded with non-template function
void reset(uint32_t id) { ... }            // Non-template

template<typename T>
void reset(T& device) { ... }             // Non-compliant — overloads with above

// COMPLIANT: use distinct names or place in separate namespace
namespace hw_utils {
    template<typename T>
    void reset_device(T& device) { ... }   // Compliant — no ambiguity
}
void reset_channel(uint32_t id) { ... }
```

---

## Template Specialisation

### Rule 14-7-1 — Explicit Instantiation Should Be Used Instead of Implicit (Advisory)

Templates should be explicitly instantiated rather than relying on implicit instantiation.

```cpp
// Template definition in header
template<typename T>
T clamp(T value, T lo, T hi) {
    if (value < lo) return lo;
    if (value > hi) return hi;
    return value;
}

// NON-COMPLIANT (advisory): implicit instantiation scattered in multiple TUs
// (Different TUs instantiate clamp<uint32_t> independently — binary bloat)

// COMPLIANT: explicit instantiation in one .cpp file
// In clamp.cpp:
template uint32_t clamp<uint32_t>(uint32_t, uint32_t, uint32_t);
template int32_t  clamp<int32_t>(int32_t, int32_t, int32_t);

// In clamp.h: declare extern explicit instantiation to suppress implicit
extern template uint32_t clamp<uint32_t>(uint32_t, uint32_t, uint32_t);
extern template int32_t  clamp<int32_t>(int32_t, int32_t, int32_t);
```

---

### Rule 14-7-2 — Explicit Specialisation Not Narrower than Primary Template (Required)

For any given template specialisation, an explicit specialisation shall be declared in the same anonymous namespace as the primary template.

---

### Rule 14-7-3 — Full Specialisation Shall Be Declared Before First Use (Required)

All partial and explicit specialisations for a class template shall be declared before the first use of the template.

```cpp
// NON-COMPLIANT: specialisation after first use
template<typename T>
struct Encoder {
    static uint32_t encode(T value);
};

// First use — implicit instantiation picks primary template
uint32_t x = Encoder<float>::encode(1.0F);

// Late specialisation — but the compiler already chose primary template above
template<>
struct Encoder<float> {
    static uint32_t encode(float value) { ... }   // Non-compliant — too late
};

// COMPLIANT: all specialisations before any use
template<typename T>
struct Encoder {
    static uint32_t encode(T value);
};

template<>
struct Encoder<float> {
    static uint32_t encode(float value) { ... }   // Compliant — declared first
};

uint32_t x = Encoder<float>::encode(1.0F);        // Use after specialisation
```

---

## Template Parameters

### Rule 14-8-1 — Overloaded Function Calls — Explicit Template Argument (Required)

Overloaded function templates shall not be explicitly specialised. (Use full specialisation — not partial — on a class template instead.)

---

### Rule 14-8-2 — Explicit Specialisation of Function Template (Advisory)

Explicit specialisation of function templates shall be used with caution. Prefer function overloading.

```cpp
// NON-COMPLIANT (advisory): explicit specialisation of function template
template<typename T>
void log_value(T val) { ... }

template<>
void log_value<float>(float val) { ... }   // Non-compliant (advisory)

// COMPLIANT: use function overloading instead
void log_value(float val) { ... }          // Compliant — overload, not specialisation
void log_value(uint32_t val) { ... }       // Compliant — overload
```

---

## typename vs class

### Best Practice: typename for Type Parameters

MISRA and safety coding standards prefer `typename` over `class` in template parameter lists for clarity:

```cpp
// COMPLIANT: typename for type template parameters
template<typename T>
T add(T a, T b) { return a + b; }

// ACCEPTABLE: 'class' is equivalent but less clear for type parameters
template<class T>
T add(T a, T b) { return a + b; }
```

---

## Dependent Names

### Two-Phase Lookup and `typename`

Dependent names in templates must be qualified with `typename` or `template` to aid two-phase lookup:

```cpp
// NON-COMPLIANT: missing 'typename' on dependent type
template<typename Container>
void process(Container& c) {
    Container::iterator it = c.begin();   // Non-compliant — 'iterator' is a dependent name
}

// COMPLIANT: explicitly specify it's a type
template<typename Container>
void process(Container& c) {
    typename Container::iterator it = c.begin();   // Compliant
}

// COMPLIANT: use auto (C++11, accepted in MISRA C++:2023)
template<typename Container>
void process(Container& c) {
    auto it = c.begin();   // Compliant — no ambiguity
}
```

---

## static_assert in Templates

`static_assert` is the MISRA-preferred way to enforce template constraints instead of SFINAE:

```cpp
// NON-COMPLIANT (clarity concern): SFINAE to restrict types
template<typename T,
         typename = std::enable_if_t<std::is_unsigned_v<T>>>
T safe_divide(T a, T b) { ... }   // Non-compliant (advisory) — SFINAE is opaque

// COMPLIANT: static_assert with clear diagnostic
template<typename T>
T safe_divide(T a, T b) {
    static_assert(std::is_unsigned<T>::value,
        "safe_divide: T must be an unsigned type");
    if (b == T{0}) {
        return T{0};
    }
    return a / b;
}
```

> **Note on `{0}` syntax**: Using `T{0}` zero-initialises the value of type `T` — this is safer than `(T)0` (C-style cast) and preferred in MISRA-compliant code.

---

## Avoiding Template Code Bloat

In embedded systems, ROM is finite. Template instantiations multiply code size.

### Pattern: Type-Erased Base + Thin Template Wrapper

```cpp
// Non-template base with the implementation
class BaseQueue {
protected:
    void push_raw(const void* data, uint32_t size);
    bool pop_raw(void* data, uint32_t size);
    // ...
};

// Thin template wrapper — just casts, minimal code generated per type
template<typename T, uint32_t N>
class Queue : private BaseQueue {
public:
    void push(const T& item) {
        push_raw(&item, sizeof(T));
    }
    bool pop(T& item) {
        return pop_raw(&item, sizeof(T));
    }
};

// Fully explicit instantiation
extern template class Queue<uint32_t, 16U>;
extern template class Queue<uint8_t, 64U>;
```

---

## Template Metaprogramming in Safety-Critical Code

Template metaprogramming (TMP) and `constexpr` computations are highly restricted in MISRA:

- **Prefer `constexpr` functions** over TMP: more readable, same compile-time evaluation
- **Avoid recursive templates**: hard to analyse, can cause exponential compile times
- **No SFINAE chains**: use `static_assert` or `if constexpr` (C++17, MISRA C++:2023)

```cpp
// NON-COMPLIANT: TMP recursive computation
template<uint32_t N>
struct Factorial {
    static constexpr uint32_t value = N * Factorial<N - 1U>::value;
};
template<>
struct Factorial<0U> {
    static constexpr uint32_t value = 1U;
};

// COMPLIANT: constexpr function — same result, far more readable
constexpr uint32_t factorial(uint32_t n) {
    return (n == 0U) ? 1U : (n * factorial(n - 1U));
}
static_assert(factorial(5U) == 120U, "Factorial check");
```

---

## Summary: Template Rules

| Rule | Level | Summary |
|------|-------|---------|
| 14-5-1 | Required | No template copy constructor or copy assignment |
| 14-5-2 | Required | No virtual member function templates |
| 14-5-3 | Required | No overload of function template with non-template |
| 14-7-1 | Advisory | Use explicit instantiation over implicit |
| 14-7-3 | Required | Specialisations declared before first use |
| 14-8-1 | Required | No explicit specialisation of overloaded function template |
| 14-8-2 | Advisory | Prefer overloading over function template specialisation |
| — | Best practice | `static_assert` to constrain templates, not SFINAE |
| — | Best practice | `typename` in qualifying dependent type names |
| — | Best practice | `constexpr` functions over recursive TMP |
| — | Best practice | Explicit instantiation to control code size |
