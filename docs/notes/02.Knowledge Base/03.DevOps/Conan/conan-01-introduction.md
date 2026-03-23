---
title: Introduction to Conan 2.X
createTime: 2025/12/22 22:21:19
permalink: /kb/devops/conan/introduction/
---

# Introduction to Conan 2.X

Conan is a **package manager** for C++ developers. Think of it as the "npm for Node.js" or the "pip for Python". Its main job is to handle all the complexity of building, distributing, and managing dependencies for C++ projects. I have covered all the topics while using conan 2.21.0 version. Please make sure to check the official documentation for any updates and changes in the newer or older versions.

## What is a Package Manager?

A package manager is a tool that helps you:

- **Download** pre-built libraries (packages) from the internet
- **Manage versions** of those libraries (so your project works consistently)
- **Handle dependencies** (if Library A needs Library B, it automatically gets B)
- **Build from source** when needed (with the right compiler settings)
- **Distribute** your own libraries to other developers

## Why Do C++ Developers Need Conan?

Before Conan, C++ developers had to deal with these headaches:

### Manual Dependency Management

- Download `.zip` or `.tar.gz` files from websites
- Extract them manually
- Figure out how to compile them with the right flags
- Deal with missing dependencies
- Hope that the library works with your compiler and operating system

### Version Chaos

- "Does this version of Boost work with that version of OpenSSL?"
- "Which compiler was this library built with?"
- "Will it work on Windows or just Linux?"

### Build Configuration Nightmares

- Writing complex CMake files to find libraries
- Setting up include paths and library paths manually
- Different build systems (Make, CMake, Visual Studio) all need different configuration

## How Conan Solves These Problems

Conan acts as a **middleman** between you and the library ecosystem:

### 1. Centralized Package Registry

```bash
# Instead of downloading manually:
# wget https://github.com/boostorg/boost/archive/boost-1.81.0.tar.gz
# tar -xzf boost-1.81.0.tar.gz
# cd boost-boost-1.81.0
# ./bootstrap.sh --with-libraries=all
# ./b2 install

# You just do:
conan download boost/1.81.0 -r conancenter
```

### 2. Binary Compatibility

Conan stores **pre-built binaries** for different platforms:

- Windows (MSVC, MinGW)
- Linux (GCC, Clang)
- macOS (AppleClang)
- Different architectures (x86, x86_64, ARM)

### 3. Automatic Dependency Resolution

```python
# In your conanfile.py, you just declare what you need:
class MyProject(ConanFile):
    requires = (
        "boost/1.81.0",
        "openssl/3.0.8",
        "fmt/10.0.0",
    )
```

Conan automatically figures out that Boost might need other libraries and downloads everything in the right order.

## Key Concepts in Conan

### Package

A **package** is a complete, ready-to-use library that includes:

- Header files (for compilation)
- Pre-built libraries (`.lib`, `.a`, `.so`, `.dylib`)
- Package metadata (version, dependencies, build information)

### Recipe

A **recipe** (`.py` file) is the "instruction manual" for building a package. It tells Conan:

- Where to download the source code
- How to build it
- What dependencies it needs
- How to package the final result

### Profile

A **profile** is a collection of settings that define:

- Which compiler to use (GCC 11, MSVC 2022, etc.)
- What compiler flags to use
- What C++ standard to use
- Target operating system and architecture

### Remote

A **remote** is a server that stores packages. Think of it like an app store:

- **ConanCenter** - The main public repository (like Apple's App Store)
- **Artifactory** - Private company repositories (like internal app stores)
- **Custom remotes** - Your own package repositories

## The Conan Workflow

### For Library Consumers (Most Common)

```bash
# 1. Create or edit your project configuration
# 2. Tell Conan what dependencies you need
conan install .

# 3. Conan downloads and builds everything needed
# 4. Generate build files for your IDE
cmake --preset conan-release
cmake --build --preset conan-release
```

### For Library Publishers

```bash
# 1. Create a recipe (conanfile.py)
# 2. Build and test the package
conan create . mylib/1.0.0@user/channel

# 3. Upload to a remote
conan upload mylib/1.0.0@user/channel --remote=my-company-remote
```

## Why Conan 2.X?

Conan 2.X is the modern version with:

- **Better performance** - Faster builds and package resolution
- **Improved API** - Cleaner, more Pythonic interface
- **Enhanced features** - Better dependency management and build integration
- **Future-proof** - Active development and modern C++ support

## Key Points: Conan Introduction

- **Conan is a package manager** - Like npm for Node.js or pip for Python
- **Solves C++ dependency hell** - No more manual library management
- **Handles binary compatibility** - Works across different platforms and compilers
- **Two main workflows** - Consuming libraries (most common) vs. publishing them
- **Conan 2.X is the modern version** - Better performance and features than 1.X
