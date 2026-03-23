---
title: Conanfile.py Basics
createTime: 2025/12/22 22:21:19
permalink: /kb/devops/conan/conanfile-py-basics/
---

# Conanfile.py Basics

A `conanfile.py` is like a **recipe card** for building your C++ project or library. Think of it as the "instruction manual" that tells Conan exactly what to do - where to get the source code, how to build it, what dependencies it needs, and how to package the final result.

## What is a Conanfile?

Two main types of configuration files:

### 1. conanfile.txt (Simple Configuration)

A **declaration file** - you tell Conan what you need, and it handles everything.

```ini
[requires]
fmt/10.0.0
openssl/3.0.8

[generators]
CMakeDeps
CMakeToolchain
```

### 2. conanfile.py (Advanced Configuration)

A **full programming recipe** - you have complete control over the build process.

```python
from conan import ConanFile
from conan.tools.cmake import CMakeToolchain, CMakeDeps, CMake
from conan.tools.files import copy

class MyProjectConan(ConanFile):
    name = "myproject"
    version = "1.0.0"

    settings = "os", "arch", "compiler", "build_type"

    # What this package depends on
    requires = (
        "fmt/10.0.0",
        "openssl/3.0.8",
    )

    # What tools are needed to build this package
    tool_requires = (
        "cmake/3.27.0",
    )

    # Default options for this package
    default_options = {
        "fmt:header_only": False,
        "openssl:shared": False,
    }

    def generate(self):
        # Generate CMake configuration files
        cmake = CMakeToolchain(self)
        cmake.generate()

        deps = CMakeDeps(self)
        deps.generate()

    def build(self):
        # Build the project using CMake
        cmake = CMake(self)
        cmake.configure()
        cmake.build()
```

## Basic Conanfile.py Structure

### The Class Declaration

```python
from conan import ConanFile

class MyProjectConan(ConanFile):
    # Your recipe goes here
    pass
```

Every `conanfile.py` needs to define a class that inherits from `ConanFile`.

### Essential Attributes

#### 1. Package Identity

```python
class MyLibraryConan(ConanFile):
    name = "mylibrary"           # Package name (required)
    version = "1.0.0"            # Version (required)
    # user = "mycompany"         # Optional user namespace
    # channel = "stable"         # Optional channel
```

#### 2. Dependencies (`requires`)

```python
class MyProjectConan(ConanFile):
    # Single dependency
    requires = "fmt/10.0.0"

    # Multiple dependencies (tuple)
    requires = (
        "fmt/10.0.0",
        "openssl/3.0.8",
        "boost/1.81.0",
    )

    # Version ranges (advanced)
    requires = (
        "fmt/[>=10.0.0 <11.0.0]",
        "openssl/3.*",
    )
```

#### 3. Build Tools (`tool_requires`)

```python
class MyProjectConan(ConanFile):
    # Tools needed to build this package
    tool_requires = (
        "cmake/3.27.0",
        "ninja/1.11.1",
    )
```

#### 4. Package Options

```python
class MyProjectConan(ConanFile):
    # Package-specific options
    options = {
        "shared": [True, False],        # Build as shared library
        "fPIC": [True, False],          # Position independent code
        "header_only": [True, False],   # Header-only library
    }

    default_options = {
        "shared": False,
        "fPIC": True,
        "header_only": False,
    }
```

## Common Methods

### generate() - Prepare Build Files

```python
def generate(self):
    """Generate build system files (CMake, Make, etc.)"""

    # Generate CMake configuration
    cmake = CMakeToolchain(self)
    cmake.variables["MY_VAR"] = True
    cmake.generate()

    # Generate pkg-config files
    deps = CMakeDeps(self)
    deps.generate()

    # Generate environment variables
    env = Environment()
    env.define("MY_ENV_VAR", "value")
    env.vars(self).save_script("myenv")
```

### configure() - Set Options Based on Settings

```python
def configure(self):
    """Configure options based on settings"""

    # If building shared library, disable fPIC
    if self.options.shared:
        self.options.fPIC = False
```

### layout() - Define Source and Build Layout

```python
def layout(self):
    """Define source and build directory structure"""

    # For CMake projects
    self.folders.source = "."
    self.folders.build = "build"
    self.folders.generators = "build"

    # Define output folders
    self.cpp.source.includedirs = ["include"]
    self.cpp.build.libdirs = ["build/lib"]
    self.cpp.build.bindirs = ["build/bin"]
```

### build() - Build the Project

```python
def build(self):
    """Build the project"""

    # For CMake
    cmake = CMake(self)
    cmake.configure()
    cmake.build()

    # For other build systems
    # self.run("make -j4")
    # self.run("cmake --build .")
```

### package() - Package the Built Files

```python
def package(self):
    """Copy built files to package directory"""

    # Copy header files
    copy(self, "*.h", self.source_folder,
         self.package_folder, keep_path=True)

    # Copy library files
    copy(self, "*.so", self.build_folder,
         self.package_folder, keep_path=False)
    copy(self, "*.lib", self.build_folder,
         self.package_folder, keep_path=False)

    # Copy license files
    copy(self, "LICENSE*", self.source_folder,
         self.package_folder, keep_path=False)
```

## Simple Examples

### Example 1: Header-Only Library

```python
from conan import ConanFile
from conan.tools.files import copy

class HeaderOnlyLibConan(ConanFile):
    name = "myheaderlib"
    version = "1.0.0"
    description = "A simple header-only library"
    license = "MIT"

    def package(self):
        """Copy header files to package"""
        copy(self, "*.h", self.source_folder,
             self.package_folder, keep_path=True)

    def package_info(self):
        """Tell consumers how to use this library"""
        self.cpp_info.libs = ["myheaderlib"]
```

### Example 2: Simple CMake Project

```python
from conan import ConanFile
from conan.tools.cmake import CMake, CMakeToolchain, CMakeDeps
from conan.tools.files import copy

class MyAppConan(ConanFile):
    name = "myapp"
    version = "1.0.0"

    requires = "fmt/10.0.0"

    def generate(self):
        cmake = CMakeToolchain(self)
        cmake.generate()

        deps = CMakeDeps(self)
        deps.generate()

    def build(self):
        cmake = CMake(self)
        cmake.configure()
        cmake.build()

    def package(self):
        # Copy executable
        copy(self, "myapp", self.build_folder,
             self.package_folder, keep_path=False)
```

## Working with Dependencies

### Accessing Dependency Information

```python
class MyProjectConan(ConanFile):
    requires = "fmt/10.0.0"

    def generate(self):
        # Get information about fmt dependency
        fmt = self.dependencies["fmt"]

        # Access its settings
        fmt_version = fmt.ref.version
        fmt_build_type = fmt.settings.get_safe("build_type")

        # Access its package information
        fmt_include = fmt.cpp_info.includedirs
        fmt_libs = fmt.cpp_info.libs

        print(f"Using fmt version: {fmt_version}")
```

### Transitive Dependencies

```python
class MyProjectConan(ConanFile):
    requires = "openssl/3.0.8"

    def package_info(self):
        # This package depends on openssl, so we can
        # expose openssl's libraries to consumers
        self.cpp_info.requires = ["openssl::openssl"]
```

## Key Points: Conanfile.py Basics

- **conanfile.py is a recipe** - Complete instructions for building your project
- **Inherits from ConanFile** - Every recipe class must inherit from `ConanFile`
- **Essential attributes** - `name`, `version`, `requires`, `options`
- **Key methods** - `generate()`, `configure()`, `build()`, `package()`
- **Two main uses** - Consuming dependencies vs. creating packages for others
- **Simple to complex** - Start with `conanfile.txt`, move to `conanfile.py` as needed
