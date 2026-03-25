---
title: MISRA C++ Exception Handling
createTime: 2026/03/25 00:00:00
permalink: /kb/embedded/misra-cpp/exception-handling/
---

# MISRA C++ Exception Handling

## Overview

Chapter 15 of MISRA C++:2008 governs exceptions. In safety-critical embedded systems, exceptions introduce:

- **Non-deterministic control flow** — timing cannot be guaranteed
- **Hidden code paths** — every `throw` site and stack unwinding path must be certified
- **Code size overhead** — exception tables add ROM/RAM cost
- **RTTI dependency** — stack unwinding requires RTTI in some implementations
- **Conflict with real-time constraints** — exception handling may violate RTOS timing guarantees

Many safety-critical projects disable exceptions entirely (`-fno-exceptions` in GCC/Clang) and rely on error return codes or status enums instead.

---

## MISRA C++:2008 Exception Rules (Chapter 15)

### Rule 15-0-1 — No Exceptions Across Module or Subsystem Boundaries (Document)

Exceptions shall only be used for error handling and shall not be used as a means of normal control flow.

**Key principle:** An exception must represent an exceptional, unrecoverable condition — not expected error states.

```cpp
// NON-COMPLIANT: exception for expected condition (not truly exceptional)
uint32_t divide(uint32_t a, uint32_t b) {
    if (b == 0U) {
        throw std::range_error("division by zero");   // Non-compliant — expected case
    }
    return a / b;
}

// COMPLIANT: return an error code for expected failure cases
enum class DivResult { Ok, DivByZero };

DivResult divide(uint32_t a, uint32_t b, uint32_t& result) {
    if (b == 0U) {
        result = 0U;
        return DivResult::DivByZero;   // Compliant — explicit error code
    }
    result = a / b;
    return DivResult::Ok;
}
```

---

### Rule 15-0-2 — An Exception Object Shall Not Be an Object of a Class with Virtual Members (Advisory)

Exception objects with virtual members carry vtable pointers and interact with RTTI in complex ways during unwinding.

```cpp
// NON-COMPLIANT (advisory): exception type with virtual method
class SensorError : public std::runtime_error {
public:
    explicit SensorError(const char* msg) : std::runtime_error{msg} {}
    virtual const char* sensor_name() const { return "unknown"; }   // Virtual — non-compliant
};

// COMPLIANT: no virtual methods on exception types
struct SensorError {
    uint32_t    error_code;
    const char* message;
};

throw SensorError{0x01U, "ADC timeout"};
```

---

### Rule 15-0-3 — Handlers of a Function-try-block Implementation Not Used (Document)

A function-try-block on a constructor or destructor shall only use rethrowing.

---

### Rule 15-1-1 — The throw Expression Shall Only Throw Objects of a Type Derived from std::exception (Advisory)

```cpp
// NON-COMPLIANT (advisory): throwing a plain integer
throw 42;                 // Non-compliant — not derived from std::exception

// NON-COMPLIANT (advisory): throwing a raw string
throw "error occurred";   // Non-compliant

// COMPLIANT
throw std::runtime_error{"Sensor failure"};   // Compliant — derived from std::exception
```

---

### Rule 15-1-2 — NULL Shall Not Be Thrown (Required)

A `NULL` pointer shall not be thrown.

```cpp
// NON-COMPLIANT
throw NULL;     // Non-compliant — throws null pointer

// NON-COMPLIANT
const char* msg = nullptr;
throw msg;      // Non-compliant

// COMPLIANT
throw std::runtime_error{"Error"};
```

---

### Rule 15-1-3 — Empty Throw Shall Only Occur in a Catch Handler (Required)

A rethrow (`throw;`) expression shall only be used within a compound statement enclosed by a catch handler.

```cpp
// NON-COMPLIANT: throw; outside a catch handler
void bad_rethrow() {
    throw;    // Non-compliant — undefined behaviour outside a catch block
}

// COMPLIANT
void handle_error() {
    try {
        do_work();
    }
    catch (const std::exception& e) {
        log_error(e.what());
        throw;    // Compliant — rethrow within catch handler
    }
}
```

---

### Rule 15-3-1 — Exceptions Shall Be Caught by Reference (Required)

Exceptions shall be raised by value and caught by (const) reference.

```cpp
// NON-COMPLIANT: catch by value — copy-constructs, slices polymorphic exceptions
try {
    do_work();
}
catch (std::exception e) {       // Non-compliant — caught by value (slicing)
    log_error(e.what());
}

// NON-COMPLIANT: catch by pointer
catch (std::exception* e) {      // Non-compliant — pointer catch
    log_error(e->what());
}

// COMPLIANT: catch by const reference
try {
    do_work();
}
catch (const std::exception& e) {    // Compliant
    log_error(e.what());
}
```

---

### Rule 15-3-2 — Where Multiple Handlers Are Present, at Least One Is Catch-All (Advisory)

When multiple catch clauses are specified for a single try block, the last catch clause must be a `catch(...)`.

```cpp
// NON-COMPLIANT (advisory): no catch-all
try {
    do_work();
}
catch (const NetworkError& e) { ... }    // Misses all other exception types
catch (const SensorError& e)  { ... }   // Non-compliant — no catch(...)

// COMPLIANT
try {
    do_work();
}
catch (const NetworkError& e) { handle_network(e); }
catch (const SensorError& e)  { handle_sensor(e); }
catch (...) {
    log_fatal("Unexpected exception");
    // MUST rethrow or terminate — do not swallow unknown exceptions in safety code
    throw;
}
```

---

### Rule 15-3-3 — Handlers of a Derived Class Shall Appear Before Handlers of Base (Required)

When catching a hierarchy, place derived-class handlers before base-class handlers.

```cpp
class BaseError : public std::exception { };
class DerivedError : public BaseError { };

// NON-COMPLIANT: base before derived — DerivedError is always caught by BaseError handler
try {
    do_work();
}
catch (const BaseError& e)    { ... }   // Non-compliant — catches derived too; derived handler unreachable
catch (const DerivedError& e) { ... }   // Unreachable

// COMPLIANT: specific before general
try {
    do_work();
}
catch (const DerivedError& e) { ... }   // Compliant — more specific first
catch (const BaseError& e)    { ... }   // Catches remaining BaseError variants
catch (...) { throw; }                  // Catch-all
```

---

### Rule 15-3-4 — Each Exception Explicitly Thrown Shall Have a Handler (Required)

Each exception that may be thrown shall have a handler — either in the current function or documented as propagating to the caller.

---

### Rule 15-3-5 — A Class Type Exception Shall Always Have a Handler of a Base Class Type (Required)

If a class exception is thrown, there should be a handler for its base class too.

---

### Rule 15-3-6 — catch(...) Shall Not Be Used in Applications Where All Exceptions Are Handled at a Single Level (Required)

---

### Rule 15-3-7 — Where Multiple Handlers Are Used, Only the First Matching Handler Is Executed (Document)

This is a documentation reminder: C++ executes only the first matching catch clause. Handlers must be ordered from most to least derived.

---

### Rule 15-4-1 — Dynamic Exception Specifications Shall Not Be Used (Required)

`throw()` exception specifications (deprecated in C++11, removed in C++17) shall not be used.

```cpp
// NON-COMPLIANT: dynamic exception specification (deprecated)
void process() throw(std::runtime_error);   // Non-compliant

// NON-COMPLIANT: empty throw spec (pre-C++11 noexcept equivalent)
void process() throw();    // Non-compliant

// COMPLIANT: use noexcept (C++11+)
void process() noexcept;   // Compliant
void process();            // Compliant — no specification
```

---

### Rule 15-5-1 — A Class Destructor Shall Not Exit via an Exception (Required)

```cpp
// NON-COMPLIANT: destructor can throw
class Buffer {
public:
    ~Buffer() {
        if (m_data != nullptr) {
            flush_data();   // Non-compliant — flush_data() might throw
        }
    }
};

// COMPLIANT: destructor catches and swallows (or logs) any exception
class Buffer {
public:
    ~Buffer() noexcept {
        try {
            if (m_data != nullptr) {
                flush_data();
            }
        }
        catch (...) {
            // Log or signal error — do NOT rethrow from destructor
            signal_flush_error();
        }
    }
};
```

> **Why**: If a destructor throws during stack unwinding from another exception, `std::terminate()` is called — the program terminates in an uncontrolled manner.

---

### Rule 15-5-2 — Where a Function's Declaration Includes an Exception Specification, the Function Shall Only Be Capable of Throwing Exceptions of the Indicated Type(s) (Required)

This rule is enforced automatically by `noexcept` and checked at link time in modern C++.

---

### Rule 15-5-3 — The Terminate() Function Shall Not Be Called Implicitly (Required)

Code shall not create a situation where `std::terminate()` is called implicitly. This includes:

- Throwing from a `noexcept` function
- Throwing from a destructor during unwinding
- Not catching a thrown exception at all

```cpp
// NON-COMPLIANT: noexcept function propagates exception — calls terminate()
void critical_process() noexcept {
    do_work();    // Non-compliant — if do_work() throws, terminate() is called
}

// COMPLIANT
void critical_process() noexcept {
    try {
        do_work();
    }
    catch (...) {
        handle_error_safely();   // Compliant — no exception escapes noexcept
    }
}
```

---

## Disabling Exceptions in Safety-Critical Embedded Systems

Many safety standards (ISO 26262, IEC 61508) require deterministic, predictable execution. Exception handling is often disabled:

### GCC/Clang: `-fno-exceptions`

```bash
# In CMakeLists.txt
target_compile_options(my_firmware PRIVATE -fno-exceptions -fno-rtti)
```

### MISRA-compliant alternatives to exceptions:

```cpp
// Pattern 1: Error return codes
enum class Status { Ok, InvalidParam, HardwareFault, Timeout };

Status init_sensor(Sensor& s) {
    if (!s.is_connected()) { return Status::HardwareFault; }
    s.configure();
    return Status::Ok;
}

// Pattern 2: std::optional (C++17) for nullable return values
std::optional<uint32_t> read_adc(uint8_t channel) {
    if (channel >= ADC_MAX_CHANNELS) { return std::nullopt; }
    return adc_read_raw(channel);
}

// Pattern 3: Result type (custom)
template<typename T, typename E>
struct Result {
    bool      ok;
    T         value;
    E         error;
};

Result<uint32_t, Status> measure_temperature() {
    uint32_t raw;
    if (!adc_read(TEMP_CHANNEL, raw)) {
        return {false, 0U, Status::HardwareFault};
    }
    return {true, convert_to_celsius(raw), Status::Ok};
}
```

---

## noexcept Specification Guide

| Function Type | noexcept Specification |
|---------------|----------------------|
| Destructors | Always `noexcept` (default in C++11+) |
| Move constructors | `noexcept` where possible (enables optimisations) |
| Move assignment | `noexcept` where possible |
| `swap` | `noexcept` |
| Simple getters | `noexcept` |
| Hardware I/O that can fail | `noexcept` (with internal error handling) |
| System init functions | `noexcept` (return status code) |

---

## Summary: Exception Handling Rules

| Rule | Level | Summary |
|------|-------|---------|
| 15-0-1 | Document | Exceptions only for truly exceptional conditions |
| 15-0-2 | Advisory | Exception object shall not have virtual members |
| 15-1-1 | Advisory | Throw types derived from `std::exception` |
| 15-1-2 | Required | Do not throw `NULL` |
| 15-1-3 | Required | `throw;` only inside a catch handler |
| 15-3-1 | Required | Catch by reference, throw by value |
| 15-3-2 | Advisory | Last handler shall be `catch(...)` |
| 15-3-3 | Required | Derived-class handlers before base-class handlers |
| 15-3-4 | Required | Every thrown exception must have a handler |
| 15-4-1 | Required | No dynamic exception specifications (`throw()`) |
| 15-5-1 | Required | Destructors shall not throw |
| 15-5-3 | Required | No implicit `std::terminate()` |
| — | Best practice | Consider `-fno-exceptions` for safety-critical targets |
| — | Best practice | Use error return codes or `std::optional` instead |
