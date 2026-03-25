---
title: MISRA C++ Standard Library Usage
createTime: 2026/03/25 00:00:00
permalink: /kb/embedded/misra-cpp/standard-library/
---

# MISRA C++ Standard Library Usage

## Overview

Chapters 17–27 of MISRA C++:2008 cover the C++ Standard Library. Much of the standard library is banned or heavily restricted for safety-critical use because it relies on dynamic memory, exceptions, locale, I/O, and other features incompatible with deterministic real-time embedded systems.

---

## General Principle

> *"The C Standard Library and several C++ Standard Library features have been restricted or banned as they are not intended for use in safety-critical embedded systems."*

Every standard library header must be evaluated for:
1. Does it use dynamic memory internally?
2. Does it throw exceptions?
3. Is its timing deterministic?
4. Is it defined in terms of undefined/implementation-defined behaviour?

---

## Dynamic Memory — Banned Features

### Rule 18-4-1 — No Dynamic Heap Memory Allocation (Required)

Dynamic memory allocation (`new`, `delete`, `malloc`, `free`, `calloc`, `realloc`) shall not be used.

```cpp
// NON-COMPLIANT: dynamic allocation
uint8_t* buf = new uint8_t[1024];       // Non-compliant
uint8_t* buf2 = (uint8_t*)malloc(128);  // Non-compliant
delete[] buf;                            // Non-compliant
free(buf2);                              // Non-compliant

// NON-COMPLIANT: std::vector (uses heap internally)
std::vector<uint32_t> samples;
samples.push_back(42U);    // Non-compliant — heap allocation

// COMPLIANT: stack allocation
uint8_t buf[1024];         // Compliant — static/stack allocation

// COMPLIANT: fixed-size container
std::array<uint32_t, 64U> samples;   // Compliant — fixed-size, stack-allocated

// COMPLIANT: static allocation pool (if heap is needed)
static uint8_t pool[4096U];
static uint32_t pool_offset{0U};

uint8_t* alloc_from_pool(uint32_t size) {
    if (pool_offset + size > sizeof(pool)) { return nullptr; }
    uint8_t* ptr = &pool[pool_offset];
    pool_offset += size;
    return ptr;
}
```

> **Why**: Heap fragmentation is non-deterministic. In long-running embedded systems, heap allocation can fail at unpredictable times. Safety standards require proof of memory usage bounds.

---

### Rule 18-4-1 — Placement new Is Allowed with Restrictions

```cpp
// COMPLIANT: placement new into a pre-allocated buffer (no heap)
alignas(Sensor) uint8_t sensor_storage[sizeof(Sensor)];
Sensor* s = new (sensor_storage) Sensor{42U};    // Compliant — no dynamic allocation
s->~Sensor();    // Must explicitly call destructor
```

---

## C-Library Compatibility Headers — Banned Features

### Rule 27-0-1 — No C Standard Library I/O (Required)

The stream input/output library `<cstdio>` (and its C version `<stdio.h>`) shall not be used.

```cpp
// NON-COMPLIANT: printf, scanf, fopen, etc.
#include <cstdio>
printf("Sensor value: %u\n", sensor_val);    // Non-compliant

// COMPLIANT: use platform-specific UART/debug output
uart_write("Sensor value: ");
uart_write_uint32(sensor_val);
uart_write("\n");
```

> **Why**: `printf` and its family use dynamic memory internally (format string processing, output buffering), are not real-time safe, and have undefined behaviour for format/argument mismatches.

---

### Rule — No `<csetjmp>` (Required)

The `<csetjmp>` C-compatibility header shall not be used. `setjmp`/`longjmp` bypass destructors and are not compatible with C++ stack unwinding.

```cpp
// NON-COMPLIANT
#include <csetjmp>
jmp_buf env;
if (setjmp(env) == 0) {
    risky_function();
} else {
    // Jumped back here — destructors NOT called
}
```

---

### Rule — No `<csignal>` (Required)

The `<csignal>` header shall not be used. Signal handlers in C++ have severe restrictions on what is safe to call — nearly all standard library functions are unsafe within a signal handler.

```cpp
// NON-COMPLIANT
#include <csignal>
signal(SIGFPE, my_handler);   // Non-compliant
```

---

### Rule 17-0-1 — No Overriding of Reserved Names (Required)

Reserved identifiers, reserved macros, and reserved names shall not be declared by the user.

```cpp
// NON-COMPLIANT: redefining a C++ standard macro/name
#define assert(x) (void)(x)      // Non-compliant — overrides standard assert
#define EOF 0                    // Non-compliant — redefines standard macro

// NON-COMPLIANT: redefining standard function
int32_t memcpy(void* d, const void* s, size_t n) { ... }  // Non-compliant

// COMPLIANT: use distinct names
void safe_memcpy(void* dst, const void* src, uint32_t size) { ... }
```

---

### Rule 17-0-2 — No Use of Standard Identifiers as Own Identifiers (Required)

The identifiers of C++ standard library functions shall not be used for any purpose other than their standard library purpose.

---

### Rule 17-0-5 — The setlocale Function Shall Not Be Used (Required)

```cpp
// NON-COMPLIANT
#include <clocale>
setlocale(LC_ALL, "en_US.UTF-8");   // Non-compliant — locale state affects numeric formatting globally
```

---

## Allowed Standard Library Headers

### Chapter 18 — Language Support

| Header | Status | Notes |
|--------|--------|-------|
| `<cassert>` | Restricted | `assert()` is acceptable in non-release builds only |
| `<climits>` | Allowed | `INT_MAX`, `UINT8_MAX` etc. permitted |
| `<cstddef>` | Allowed | `size_t`, `ptrdiff_t`, `offsetof`, `nullptr_t` |
| `<cstdint>` | Allowed | `uint32_t`, `int8_t` etc. — **Preferred** for MISRA |
| `<limits>` | Allowed | `std::numeric_limits<T>` |
| `<new>` | Restricted | Only for placement new — no `::operator new` |
| `<typeinfo>` | Banned | RTTI — `typeid`, `type_info` |
| `<type_traits>` | Restricted | Compile-time traits OK, `std::enable_if` with caution |

---

### Chapter 19 — Diagnostics

| Header | Status | Notes |
|--------|--------|-------|
| `<stdexcept>` | Restricted | Only if exceptions enabled; avoid in safety-critical |
| `<cerrno>` | Banned | Global mutable state (`errno`) — non-deterministic |

---

### Chapter 20 — Utilities

| Header | Status | Notes |
|--------|--------|-------|
| `<utility>` | Allowed | `std::move`, `std::forward`, `std::pair` |
| `<functional>` | Restricted | `std::function` uses heap — banned; function pointers OK |
| `<memory>` | Restricted | Smart pointers (`unique_ptr` without custom deleter) — consult project policy |
| `<tuple>` | Restricted | Use with caution; no implicit construction from unrelated types |
| `<optional>` | Allowed | C++17 — preferred over raw pointer + bool pair |
| `<variant>` | Restricted | Type-safe union; visit patterns can be complex |

---

### Chapter 21 — Strings

| Header | Status | Notes |
|--------|--------|-------|
| `<string>` | Banned | `std::string` uses dynamic memory |
| `<string_view>` | Allowed (C++17) | `std::string_view` — no allocation, read-only views |
| `<cstring>` | Restricted | `memcpy`, `memset` allowed; `strcpy`/`strcat` banned |
| `<cwchar>` | Banned | Wide char — unnecessary in embedded |

```cpp
// NON-COMPLIANT: std::string (heap)
std::string name = "sensor_1";   // Non-compliant

// COMPLIANT: string_view (no allocation)
std::string_view name{"sensor_1"};   // Compliant — C++17

// COMPLIANT: fixed char buffer
char name[16] = "sensor_1";         // Compliant — static allocation
```

---

### Chapter 23 — Containers

| Header | Status | Notes |
|--------|--------|-------|
| `<array>` | Allowed | `std::array<T, N>` — fixed-size, no heap |
| `<vector>` | Banned | Dynamic allocation |
| `<list>` | Banned | Dynamic allocation + pointer chasing |
| `<map>` | Banned | Dynamic allocation + balancing overhead |
| `<unordered_map>` | Banned | Dynamic allocation + hashing overhead |
| `<set>` | Banned | Dynamic allocation |
| `<deque>` | Banned | Dynamic allocation |
| `<stack>` | Restricted | Only over `std::array`-based adapter |
| `<queue>` | Restricted | Only over `std::array`-based adapter |
| `<span>` | Allowed (C++20) | Non-owning view over contiguous data |

```cpp
// COMPLIANT: std::array for fixed-size buffers
std::array<uint16_t, 128U> adc_samples{};
adc_samples.fill(0U);

// COMPLIANT: std::array with standard algorithms
uint16_t max_sample = *std::max_element(adc_samples.begin(), adc_samples.end());
```

---

### Chapter 26 — Numerics

| Header | Status | Notes |
|--------|--------|-------|
| `<cmath>` | Restricted | Allowed but check: may throw on domain error; errno-based error reporting |
| `<numeric>` | Allowed | `std::accumulate`, `std::iota` are safe |
| `<complex>` | Restricted | Safe if exceptions disabled; overhead on some architectures |
| `<random>` | Restricted | Seed and algorithm must be deterministic; `mt19937` is large |
| `<ratio>` | Allowed | Compile-time rational arithmetic |
| `<chrono>` | Restricted | Compile-time constants OK; runtime clock queries may have platform issues |

```cpp
// COMPLIANT: std::accumulate on fixed array
std::array<uint32_t, 8U> readings{10U, 20U, 15U, 12U, 18U, 11U, 14U, 16U};
uint32_t sum = std::accumulate(readings.begin(), readings.end(), 0U);
```

---

### Chapter 24 — Algorithms

`<algorithm>` is largely safe as long as:
1. The underlying containers are MISRA-compliant (no heap)
2. Iterators are bounds-checked (or use `.at()` where needed)
3. No side effects in predicates violating rule 5-14-1 equivalent

```cpp
// COMPLIANT: algorithms on std::array
std::array<uint32_t, 16U> buffer{};

std::fill(buffer.begin(), buffer.end(), 0U);      // Compliant

std::sort(buffer.begin(), buffer.end());           // Compliant

auto it = std::find(buffer.begin(), buffer.end(), 42U);
if (it != buffer.end()) {
    // Found
}
```

---

### Chapter 25 — Iterators

Iterators on fixed containers are safe. Raw pointer arithmetic is restricted by Chapter 5 rules (Rules 5-0-15 to 5-0-18).

---

## Memory Safety Patterns

### Static Memory Pool

```cpp
// MISRA-compliant static memory pool — no heap
template<typename T, uint32_t N>
class StaticPool {
public:
    T* allocate() noexcept {
        if (m_count >= N) { return nullptr; }
        return &m_storage[m_count++];
    }

    void reset() noexcept { m_count = 0U; }

    uint32_t available() const noexcept { return N - m_count; }

private:
    T        m_storage[N]{};
    uint32_t m_count{0U};
};

// Usage
StaticPool<Sensor, 8U> sensor_pool;
Sensor* s = sensor_pool.allocate();
if (s != nullptr) {
    new (s) Sensor{42U};   // Placement new — no heap
}
```

---

## Summary: Standard Library Usage

| Feature | Status | Reason |
|---------|--------|--------|
| `new` / `delete` | Banned | Non-deterministic heap |
| `malloc` / `free` | Banned | C heap, fragmentation |
| `std::vector` | Banned | Dynamic allocation |
| `std::string` | Banned | Dynamic allocation |
| `std::function` | Banned | Heap allocation |
| `std::map/set` | Banned | Dynamic allocation |
| `printf` / `scanf` | Banned | Dynamic buffers, UB on format mismatch |
| `setjmp` / `longjmp` | Banned | Bypasses destructors |
| `signal` / `raise` | Banned | Async-signal-unsafe |
| `std::array` | Allowed | Fixed-size, stack-allocated |
| `std::string_view` | Allowed | No allocation |
| `std::optional` | Allowed | No allocation |
| `std::span` | Allowed | No allocation |
| `<cstdint>` | Allowed | Required for fixed-width types |
| `<algorithm>` | Allowed | On MISRA-compliant containers |
| `<numeric>` | Allowed | Compile-time and runtime numerics |
| `<type_traits>` | Restricted | Compile-time only use |
| `<memory>` | Restricted | `unique_ptr` with care |
| `<chrono>` | Restricted | Compile-time constants OK |
