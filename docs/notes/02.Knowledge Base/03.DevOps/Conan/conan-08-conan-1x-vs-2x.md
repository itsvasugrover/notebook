---
title: Conan 1.X vs 2.X Differences
createTime: 2025/12/22 22:21:19
permalink: /kb/devops/conan/conan-1x-vs-2x/
---

# Conan 1.X vs 2.X Differences

Understanding the key differences between Conan 1.X and 2.X is crucial for migration and new projects. While Conan 2.X maintains backward compatibility, it introduces significant improvements and modern features that make it the recommended choice for all new development.

## Major Architectural Changes

### 1. New Toolchain Architecture

**Conan 1.X - Mixed Approach**

```python
# Old approach - mixing old and new tools
from conans import ConanFile, CMake
from conans.model import Generator

class MyProjectConan(ConanFile):
    requires = "fmt/6.2.0"

    def build(self):
        cmake = CMake(self)
        cmake.configure()
        cmake.build()
```

**Conan 2.X - Modern Toolchain**

```python
# New approach - modern, modular tools
from conan import ConanFile
from conan.tools.cmake import CMake, CMakeToolchain, CMakeDeps
from conan.tools.files import copy

class MyProjectConan(ConanFile):
    requires = "fmt/10.0.0"

    def generate(self):
        tc = CMakeToolchain(self)
        tc.generate()

        deps = CMakeDeps(self)
        deps.generate()

    def build(self):
        cmake = CMake(self)
        cmake.configure()
        cmake.build()
```

### 2. Import Structure Changes

**Conan 1.X**

```python
from conans import ConanFile  # Old import
from conans.client import CMake  # Old tools
from conans.tools import get, patch  # Old file tools
```

**Conan 2.X**

```python
from conan import ConanFile  # New import
from conan.tools.cmake import CMake  # New modular tools
from conan.tools.files import get, patch  # New file tools
```

### 3. Settings and Options Evolution

**Conan 1.X - Implicit Settings**

```python
class MyProjectConan(ConanFile):
    settings = "os", "compiler", "build_type", "arch"  # Implicit

    def configure(self):
        # Check settings directly
        if self.settings.compiler.version == "15":
            # Do something
            pass
```

**Conan 2.X - Explicit Settings**

```python
class MyProjectConan(ConanFile):
    settings = "os", "compiler", "build_type", "arch"  # Still explicit
    options = {"shared": [True, False]}

    def configure(self):
        # Access via properties
        if self.settings_build:
            # Access build-time settings
            pass
        if self.settings_target:
            # Access target settings (for cross-compilation)
            pass
```

## Build System Integration Changes

### CMake Integration Evolution

**Conan 1.X - Basic CMake**

```python
# conanfile.py (Conan 1.X)
from conans import ConanFile, CMake
from conans.client.generators.cmake import CMakeMultiGenerator

class MyProjectConan(ConanFile):
    generators = "cmake", "CMakeDeps", "CMakeToolchain"  # Mixed approach

    def build(self):
        cmake = CMake(self)
        cmake.configure()
        cmake.build()
```

**Conan 2.X - Enhanced CMake**

```python
# conanfile.py (Conan 2.X)
from conan import ConanFile
from conan.tools.cmake import CMake, CMakeToolchain, CMakeDeps, cmake_layout

class MyProjectConan(ConanFile):
    requires = "fmt/10.0.0"

    def layout(self):
        cmake_layout(self)

    def generate(self):
        tc = CMakeToolchain(self)
        tc.variables["MY_PROJECT_VERSION"] = self.version
        tc.generate()

        deps = CMakeDeps(self)
        deps.generate()

    def build(self):
        cmake = CMake(self)
        cmake.configure()
        cmake.build()
```

### Layout System Introduction

**Conan 1.X - Manual Layout**

```python
class MyProjectConan(ConanFile):
    def build(self):
        # Manual path management
        cmake = CMake(self)
        cmake.configure(build_folder="build")
```

**Conan 2.X - Automatic Layout**

```python
class MyProjectConan(ConanFile):
    def layout(self):
        cmake_layout(self)  # Automatic layout management

    def build(self):
        cmake = CMake(self)
        cmake.configure()  # Uses layout-defined paths
```

## Dependency Management Improvements

### Version Specification Evolution

**Conan 1.X - Basic Versioning**

```python
class MyProjectConan(ConanFile):
    requires = (
        "fmt/6.2.0",        # Exact version
        "boost/1.71.0",     # Exact version
    )

    # Version ranges were limited
    # requires = "boost/[>1.70 && <2.0]@user/channel"
```

**Conan 2.X - Enhanced Versioning**

```python
class MyProjectConan(ConanFile):
    requires = (
        "fmt/[>=6.2.0 <7.0.0]",  # Rich version ranges
        "boost/1.*",              # Wildcard support
        "spdlog/1.11.0",          # Fallback exact version
    )

    # More flexible version expressions
    # requires = "boost/[>=1.70.0 && <2.0.0]"
```

### Dependency Information Access

**Conan 1.X - Limited Access**

```python
class MyProjectConan(ConanFile):
    def build(self):
        # Limited dependency information
        fmt_libs = self.deps_cpp_info["fmt"].libs
        fmt_includes = self.deps_cpp_info["fmt"].include_paths
```

**Conan 2.X - Rich Access**

```python
class MyProjectConan(ConanFile):
    def generate(self):
        # Rich dependency information
        fmt_dep = self.dependencies["fmt"]
        fmt_version = fmt_dep.ref.version
        fmt_settings = fmt_dep.settings
        fmt_options = fmt_dep.options
        fmt_cpp_info = fmt_dep.cpp_info

        # Access to build requirements
        if self.dependencies.build.get("cmake"):
            cmake_version = self.dependencies.build["cmake"].ref.version
```

## Profile System Enhancements

### Profile Structure Evolution

**Conan 1.X - Basic Profiles**

```ini
[settings]
os=Linux
arch=x86_64
compiler=gcc
compiler.version=9
compiler.libcxx=libstdc++11
build_type=Release

[env]
CC=gcc-9
CXX=g++-9
```

**Conan 2.X - Enhanced Profiles**

```ini
[settings]
os=Linux
arch=x86_64
compiler=gcc
compiler.version=11
compiler.libcxx=libstdc++11
compiler.cppstd=17
build_type=Release

[options]
*:shared=True
fmt:header_only=False

[tool_requires]
cmake/3.27.0
ninja/1.11.1

[env]
CC=gcc-11
CXX=g++-11
CFLAGS=-O3
CXXFLAGS=-std=c++17 -O3

[conf]
tools.cmake.cmake_layout:build_folder_vars=['settings']
tools.build:cflags=['-march=native']
```

### Profile Variables and Templates

**Conan 1.X - Static Profiles**

```ini
# Profiles were static files
[settings]
compiler.version=9
```

**Conan 2.X - Dynamic Profiles**

```ini
# Profiles with variables
[settings]
compiler.version=GCC_VERSION
build_type=BUILD_TYPE

[env]
CFLAGS=OPTIMIZATION_FLAGS

# Usage: conan install . --profile:env=GCC_VERSION=11,BUILD_TYPE=Release
```

## API and Python Changes

### Python Version Requirements

**Conan 1.X**

- Python 2.7 and Python 3.x support
- Legacy Python 2 syntax compatibility

**Conan 2.X**

- Python 3.7+ only
- Modern Python syntax and features
- Type hints support
- Better error handling

### Method Renaming and Changes

**Conan 1.X**

```python
class MyProjectConan(ConanFile):
    def config_options(self):
        """Old method name"""
        pass

    def requirements(self):
        """Old method name"""
        self.requires("fmt/6.2.0")

    def source(self):
        """Old source method"""
        self.run("git clone https://github.com/fmtlib/fmt.git")
```

**Conan 2.X**

```python
class MyProjectConan(ConanFile):
    def configure(self):
        """New method name"""
        pass

    def requirements(self):
        """Same method name, enhanced functionality"""
        self.requires("fmt/10.0.0")

    def source(self):
        """Enhanced source method"""
        # Better file handling
        pass
```

## Command Line Interface Changes

### New Commands in 2.X

**Conan 1.X Commands**

```bash
conan install .
conan create . user/channel
conan upload package/1.0.0@user/channel
conan search fmt
```

**Conan 2.X - New Commands**

```bash
conan install .
conan create . user/channel
conan upload package/1.0.0@user/channel
conan search fmt

# New commands in 2.X:
conan profile detect          # Auto-detect current system
conan profile show default    # Show profile details
conan config install          # Install configuration from URL
conan graph info              # Show dependency graph
conan cache path              # Show cache directory paths
```

### Command Behavior Changes

**Conan 1.X**

```bash
# Install with limited output
conan install .

# Basic search
conan search fmt
```

**Conan 2.X**

```bash
# Enhanced install with better progress
conan install . --verbose

# Enhanced search with filters
conan search fmt --remote=conancenter --filter=arch:x86_64
```

## Package Management Improvements

### Package ID Changes

**Conan 1.X**

```python
class MyProjectConan(ConanFile):
    def package_id(self):
        # Basic package ID logic
        self.info.header_only()  # Make package ID independent of build type
```

**Conan 2.X**

```python
class MyProjectConan(ConanFile):
    def package_id(self):
        # Enhanced package ID logic
        self.info.settings.build_type = "Any"  # Ignore build type
        self.info.options["shared"] = "Any"    # Ignore shared/static option

        # New: Component-based package ID
        for comp in self.cpp_info.components:
            self.info.components[comp].header_only()
```

### Component System

**Conan 1.X - Limited Components**

```python
class MyProjectConan(ConanFile):
    def package_info(self):
        # Basic library information
        self.cpp_info.libs = ["mylib"]
```

**Conan 2.X - Rich Components**

```python
class MyProjectConan(ConanFile):
    def package_info(self):
        # Component-based information
        self.cpp_info.components["core"].libs = ["myproject-core"]
        self.cpp_info.components["network"].libs = ["myproject-network"]
        self.cpp_info.components["network"].requires = ["core"]
        self.cpp_info.components["cli"].bindirs = ["bin"]
```

## Performance and Reliability Improvements

### Build Performance

**Conan 1.X**

- Basic caching
- Limited parallel operations
- Slower dependency resolution

**Conan 2.X**

- Enhanced caching mechanisms
- Better parallel download and build
- Faster dependency graph resolution
- Improved binary compatibility detection

### Error Handling

**Conan 1.X**

```python
class MyProjectConan(ConanFile):
    def build(self):
        try:
            self.run("make")
        except Exception as e:
            self.output.error(f"Build failed: {e}")
```

**Conan 2.X**

```python
class MyProjectConan(ConanFile):
    def build(self):
        self.run("make")  # Better error context and messages
        # Enhanced error reporting and debugging
```

## Migration Guide

### Step 1: Update Import Statements

```python
# Old (1.X)
from conans import ConanFile
from conans.tools import get

# New (2.X)
from conan import ConanFile
from conan.tools.files import get
```

### Step 2: Update Tool Usage

```python
# Old (1.X)
def build(self):
    cmake = CMake(self)
    cmake.configure()
    cmake.build()

# New (2.X)
def generate(self):
    tc = CMakeToolchain(self)
    tc.generate()

def build(self):
    cmake = CMake(self)
    cmake.configure()
    cmake.build()
```

### Step 3: Update Profile Settings

```bash
# Check current profile
conan profile detect

# Update compiler version if needed
conan profile update settings.compiler.version=11 default
```

### Step 4: Test Compatibility

```bash
# Test your existing conanfile.py with Conan 2.X
conan install . --build=missing

# Check for any deprecated features
conan install . --build=missing --build=outdated
```

## Key Differences Summary

| Aspect                | Conan 1.X                      | Conan 2.X                     |
| --------------------- | ------------------------------ | ----------------------------- |
| **Python Version**    | 2.7 and 3.x                    | 3.7+ only                     |
| **Import Structure**  | `from conans import ConanFile` | `from conan import ConanFile` |
| **Build Tools**       | Mixed old/new                  | All new modern tools          |
| **CMake Integration** | Basic                          | Enhanced with layouts         |
| **Dependency Access** | Limited                        | Rich and type-safe            |
| **Profiles**          | Static                         | Dynamic with variables        |
| **Components**        | Basic                          | Full component support        |
| **Performance**       | Good                           | Better                        |
| **Error Handling**    | Basic                          | Enhanced with context         |

## Key Points: 1.X vs 2.X

- **2.X is the future** - All new features and improvements are in 2.X
- **Migration is gradual** - Conan 1.X packages still work with 2.X
- **Modern toolchain** - 2.X uses cleaner, more modular tools
- **Better performance** - Faster builds and dependency resolution
- **Enhanced features** - Components, profiles, version ranges
- **Python 3 only** - Cleaner syntax and better type support
