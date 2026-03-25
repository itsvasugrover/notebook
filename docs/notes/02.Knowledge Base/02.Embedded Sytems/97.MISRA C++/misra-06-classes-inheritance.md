---
title: MISRA C++ Classes, Inheritance & OOP Rules
createTime: 2026/03/25 00:00:00
permalink: /kb/embedded/misra-cpp/classes-inheritance/
---

# MISRA C++ Classes, Inheritance & OOP Rules

## Overview

Chapters 9–12 of MISRA C++:2008 cover classes, derived classes, member access control, and special member functions. C++'s object-oriented features introduce hazards — slicing, the fragile base class problem, hidden virtual dispatch costs, and RTTI overhead — that are unacceptable in safety-critical embedded software.

---

## Chapter 9 — Classes

### Rule 9-3-1 — No const or Volatile Members Returned by Reference (Required)

Member functions shall not return non-const handles to class-data.

```cpp
class Sensor {
public:
    // NON-COMPLIANT: returning non-const ref exposes internal state
    uint32_t& get_value() { return m_value; }

    // COMPLIANT: return by value or const ref
    uint32_t get_value() const { return m_value; }
    const uint32_t& get_ref() const { return m_value; }   // Compliant (const ref)

private:
    uint32_t m_value{0U};
};
```

---

### Rule 9-3-3 — Member Function const-Correctness (Required)

If a member function can be made `const`, it shall be `const`.

```cpp
class Config {
public:
    // NON-COMPLIANT: does not modify state but not marked const
    uint32_t read_timeout() { return m_timeout; }

    // COMPLIANT
    uint32_t read_timeout() const { return m_timeout; }

private:
    uint32_t m_timeout{100U};
};
```

---

### Rule 9-5-1 — No Unions (Required)

Unions shall not be used.

```cpp
// NON-COMPLIANT: union — member access is type-punning, undefined behaviour
union DataWord {
    uint32_t as_uint;
    float    as_float;
    uint8_t  bytes[4];
};

DataWord dw;
dw.as_uint = 0x3F800000U;
float f = dw.as_float;     // Non-compliant — reads inactive union member

// COMPLIANT: use memcpy for type-punning (well-defined)
uint32_t raw = 0x3F800000U;
float f;
static_assert(sizeof(raw) == sizeof(f), "Size mismatch");
std::memcpy(&f, &raw, sizeof(f));    // Compliant — defined type conversion
```

> **Embedded note:** `union` is widely used for register overlays. MISRA requires a deviation with documented justification and mitigation for each use.

---

### Rule 9-6-1 — Bit Field Member Types (Required)

Bit-fields shall only be declared with a type of `unsigned int` or `signed int` — or an explicitly-sized typedef (the standard explicitly permits implementation-defined behaviour for `int`).

```cpp
// NON-COMPLIANT: unspecified-width plain int
struct Flags {
    unsigned int active  : 1;   // Compliant — unsigned int
    int          error   : 1;   // Non-compliant — plain int bit-field (signedness impl-defined)
    bool         enabled : 1;   // Non-compliant — bool bit-field is implementation-defined
};

// COMPLIANT
struct Flags {
    unsigned int active  : 1;
    signed int   error   : 1;
};
```

---

### Rule 9-6-2 — No Plain int Bit Fields (Required)

Bit-fields shall not have type `int`. (The signedness of `int` bit-fields is implementation-defined.)

```cpp
// NON-COMPLIANT
struct Control {
    int mode : 3;        // Non-compliant — plain int

    // COMPLIANT
    signed int   mode2 : 3;    // Compliant — explicitly signed
    unsigned int flags : 5;    // Compliant — explicitly unsigned
};
```

---

## Chapter 10 — Derived Classes

### Rule 10-1-1 — No Multiple Base Classes with Same Name (Advisory)

Classes should not be derived from virtual bases.

```cpp
// NON-COMPLIANT (advisory): diamond inheritance via virtual
struct Base {
    virtual void do_work() = 0;
    uint32_t m_data{0U};
};
struct Left  : virtual Base { };
struct Right : virtual Base { };
struct Diamond : Left, Right { };    // Non-compliant (advisory) — virtual base class

// COMPLIANT: favour composition over deep inheritance
class Worker {
public:
    virtual void do_work() = 0;
    virtual ~Worker() = default;
};

class ConcreteWorker : public Worker {
public:
    void do_work() override { ... }
};
```

---

### Rule 10-1-2 — Base Class Shall Not Be Both Virtual and Non-Virtual (Required)

A base class shall not be both virtual and non-virtual in the same hierarchy.

---

### Rule 10-1-3 — An Accessible Base Class Shall Not Also Be Indirect Base Class (Advisory)

---

### Rule 10-2-1 — All Accessible Entity Names in Hierarchy Shall Be Distinct (Advisory)

If a name is declared in a base class, the same name shall not be declared in a derived class.

```cpp
// NON-COMPLIANT (advisory): name hiding
class Base {
public:
    void configure(uint32_t x) { ... }
};

class Derived : public Base {
public:
    void configure() { ... }     // Non-compliant — hides Base::configure(uint32_t)
};

// COMPLIANT: use override keyword and distinct names or using-declarations
class Derived : public Base {
public:
    using Base::configure;       // Brings Base version into scope
    void configure(uint32_t x, uint32_t y) { ... }  // Compliant — different signature
};
```

---

### Rule 10-3-1 — Virtual Functions Shall Be Declared virtual Only Once (Required)

Each overridden virtual function shall be declared with the `virtual` keyword in the base class definition only. Use `override` in derived classes.

```cpp
// NON-COMPLIANT: virtual repeated in derived class
class Base {
public:
    virtual void process() = 0;
    virtual ~Base() = default;
};

class Derived : public Base {
public:
    virtual void process() override { ... }   // Non-compliant — 'virtual' repeated
};

// COMPLIANT: use 'override' without repeating 'virtual'
class Derived : public Base {
public:
    void process() override { ... }    // Compliant — 'override' is sufficient
};
```

---

### Rule 10-3-2 — Each Overriding Virtual Function Shall Use override (Required)

```cpp
// NON-COMPLIANT: override keyword missing — silent hiding if signature drifts
class Sensor : public Base {
public:
    void process() { ... }     // Non-compliant — no 'override'
};

// COMPLIANT
class Sensor : public Base {
public:
    void process() override { ... }    // Compliant — compiler checks the override
};
```

---

### Rule 10-3-3 — Virtual Function Shall Not Have Default Parameters (Required)

A virtual function shall not have a default parameter expression that is different in the base class and a derived class.

```cpp
// NON-COMPLIANT: default parameter in virtual function
class Base {
public:
    virtual void report(uint32_t code = 0U) { ... }
};
class Derived : public Base {
public:
    void report(uint32_t code = 42U) override { ... }  // Non-compliant — different default
};

// When called via base pointer, Base's default is used (code=0) but Derived's impl runs
// This is a well-known C++ pitfall

// COMPLIANT: no default parameters in virtual functions
class Base {
public:
    virtual void report(uint32_t code) { ... }
    void report() { report(0U); }   // Non-virtual wrapper provides default
};
```

---

### Rule 10-3-1 — No Calls to Virtual Functions in Constructors/Destructors (Related — also 12-1-1)

```cpp
// NON-COMPLIANT: virtual function called in constructor
class Device {
public:
    Device() {
        initialise();    // Non-compliant — virtual dispatch does NOT work here
    }
    virtual void initialise() { ... }
};

class SpecialDevice : public Device {
public:
    void initialise() override { ... }   // This override is NOT called during Device()
};

// COMPLIANT: use two-phase initialisation
class Device {
public:
    Device() = default;
    virtual void initialise() { ... }
    virtual ~Device() = default;
};

// Caller:
SpecialDevice dev;
dev.initialise();    // Compliant — virtual dispatch works correctly after construction
```

---

## Chapter 11 — Member Access Control

### Rule 11-0-1 — Member Data in Non-POD Class Shall Be Private (Required)

```cpp
// NON-COMPLIANT: public member data in a class (non-POD)
class Actuator {
public:
    uint32_t position;       // Non-compliant — public member data
    uint32_t velocity;       // Non-compliant

    void update() { ... }
};

// COMPLIANT: member data private, accessed via methods
class Actuator {
public:
    uint32_t get_position() const { return m_position; }
    void     set_position(uint32_t pos) { m_position = pos; }
    void     update() { ... }

private:
    uint32_t m_position{0U};
    uint32_t m_velocity{0U};
};

// Exception: POD structs with only data (plain C-compatible struct) may use public data
struct Point {
    int32_t x;
    int32_t y;
};   // Compliant for POD struct
```

---

### Rule 11-0-1 & Friend Declarations

`friend` declarations undermine encapsulation. They are tightly restricted:

```cpp
// NON-COMPLIANT: friend class grants wide access
class Config {
    friend class TestHarness;    // Non-compliant — exposes all private members to TestHarness
    uint32_t m_secret{0U};
};

// Prefer redesigning interfaces so friends are not needed.
```

---

## Chapter 12 — Special Member Functions

### Rule 12-1-1 — Object's Dynamic Type Not Used in Constructor or Destructor (Required)

Do not call virtual functions or use `typeid` on the object under construction.

```cpp
// NON-COMPLIANT: typeid in constructor
#include <typeinfo>
class Base {
public:
    Base() {
        const char* name = typeid(*this).name();   // Non-compliant — typeid during construction
    }
    virtual ~Base() = default;
};
```

---

### Rule 12-1-2 — All Constructors of a Class Shall Use Member Initializers (Advisory)

```cpp
// NON-COMPLIANT (advisory): assignment in constructor body
class Motor {
public:
    Motor(uint32_t speed) {
        m_speed = speed;       // Non-compliant (advisory) — assignment, not initialisation
        m_state = 0U;
    }
private:
    uint32_t m_speed;
    uint32_t m_state;
};

// COMPLIANT: member initialiser list
class Motor {
public:
    Motor(uint32_t speed)
        : m_speed{speed}
        , m_state{0U}
    {}
private:
    uint32_t m_speed;
    uint32_t m_state;
};
```

---

### Rule 12-8-2 — Copy Constructor and Copy Assignment Shall Be Defined Together (Required)

If a copy constructor is explicitly defined, a copy assignment shall also be defined, and vice versa.

```cpp
// NON-COMPLIANT: copy constructor without copy assignment
class Buffer {
public:
    Buffer(const Buffer& other);         // Non-compliant — copy assign missing
    // Missing: Buffer& operator=(const Buffer& other);
};

// COMPLIANT: Rule of Three (copy ctor, copy assign, destructor)
class Buffer {
public:
    Buffer(const Buffer& other);
    Buffer& operator=(const Buffer& other);
    ~Buffer();

private:
    uint8_t* m_data{nullptr};
    uint32_t m_size{0U};
};
```

---

### Rule of Five in MISRA Context

MISRA C++:2008 predates C++11 move semantics, but MISRA C++:2023 addresses them. Best practice for embedded:

```cpp
// Prefer: define clearly or delete what you don't want
class Resource {
public:
    explicit Resource(uint32_t size);
    ~Resource();

    // Explicitly deleted — no copying for a resource owner
    Resource(const Resource&) = delete;
    Resource& operator=(const Resource&) = delete;

    // If move is needed — explicitly define it
    Resource(Resource&&) noexcept;
    Resource& operator=(Resource&&) noexcept;
};
```

---

## RTTI — Runtime Type Information

MISRA strongly discourages RTTI (`typeid`, `dynamic_cast`) because:
- It has runtime overhead (code size + time)
- It requires exception support
- It indicates a design flaw (hierarchy not clean)

### Rule — Avoid dynamic_cast (Rule 5-2-7) / No RTTI

```cpp
// NON-COMPLIANT: dynamic_cast (RTTI required, can return nullptr at runtime)
Base* base_ptr = get_device();
Derived* d = dynamic_cast<Derived*>(base_ptr);    // Non-compliant
if (d != nullptr) {
    d->specific_action();
}

// COMPLIANT: redesign with virtual interface
class Device {
public:
    virtual void action() = 0;
    virtual ~Device() = default;
};

class SpecialDevice : public Device {
public:
    void action() override { specific_action(); }
private:
    void specific_action() { ... }
};

// Caller uses polymorphism without casting:
Device* dev = get_device();
dev->action();    // Compliant — no RTTI needed
```

---

## Object Slicing

### Preventing Slicing (Related to Rule 10-x)

```cpp
// NON-COMPLIANT: object slicing — derived part is lost
class Shape {
public:
    virtual double area() const { return 0.0; }
    uint32_t m_color{0U};
};
class Circle : public Shape {
public:
    double area() const override { return 3.14159 * m_radius * m_radius; }
    double m_radius{1.0};
};

void display(Shape s) { ... }    // Takes by value — SLICES Circle

Circle c;
c.m_radius = 5.0;
display(c);    // Non-compliant — Circle sliced to Shape; m_radius lost

// COMPLIANT: pass by pointer or reference
void display(const Shape& s) { ... }
display(c);    // Compliant — no slicing, virtual dispatch works
```

---

## Summary: Class & Inheritance Rules

| Rule | Level | Summary |
|------|-------|---------|
| 9-3-1 | Required | No non-const handles to member data |
| 9-3-3 | Required | `const` member functions for non-mutating members |
| 9-5-1 | Required | No `union` |
| 9-6-1 | Required | Bit-fields only `unsigned int` or `signed int` |
| 9-6-2 | Required | No plain `int` bit-fields |
| 10-1-1 | Advisory | No virtual base classes |
| 10-2-1 | Advisory | No name hiding across hierarchy |
| 10-3-1 | Required | `virtual` keyword only in base class definition |
| 10-3-2 | Required | `override` required on all overriding functions |
| 10-3-3 | Required | No different default parameters in virtual overrides |
| 11-0-1 | Required | Member data in non-POD class shall be `private` |
| 12-1-1 | Required | No virtual calls or `typeid` in constructors/destructors |
| 12-1-2 | Advisory | Use member initialiser lists |
| 12-8-2 | Required | Define copy ctor and copy assign together |
| 5-2-7  | Required | No `dynamic_cast` (RTTI) |
