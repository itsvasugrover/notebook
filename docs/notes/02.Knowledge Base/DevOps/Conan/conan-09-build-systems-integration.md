---
title: Build Systems Integration
createTime: 2025/12/22 22:21:19
permalink: /kb/devops/conan/build-systems-integration/
---

# Build Systems Integration

Conan 2.X seamlessly integrates with popular C++ build systems, acting as a **bridge** between your dependencies and your chosen build tool. Think of Conan as the "universal adapter" that makes any build system understand your dependency libraries.

## CMake Integration (Most Popular)

### Basic CMake Integration

**conanfile.py**

```python
from conan import ConanFile
from conan.tools.cmake import CMake, CMakeToolchain, CMakeDeps, cmake_layout

class MyProjectConan(ConanFile):
    name = "myproject"
    version = "1.0.0"

    # Dependencies
    requires = (
        "fmt/10.0.0",
        "spdlog/1.11.0",
    )

    # Define project layout
    def layout(self):
        cmake_layout(self)

    # Generate CMake configuration files
    def generate(self):
        # Generate CMake toolchain (compiler, flags, etc.)
        tc = CMakeToolchain(self)
        tc.variables["MYPROJECT_VERSION"] = self.version
        tc.variables["CMAKE_CXX_STANDARD"] = "17"
        tc.generate()

        # Generate dependency information (find_package files)
        deps = CMakeDeps(self)
        deps.generate()

    # Build the project
    def build(self):
        cmake = CMake(self)
        cmake.configure()
        cmake.build()
```

**CMakeLists.txt**

```cmake
cmake_minimum_required(VERSION 3.15)
project(MyProject)

# Conan generates these files automatically:
# - conan_toolchain.cmake (compiler, flags, etc.)
# - fmt-config.cmake (fmt dependency info)
# - spdlog-config.cmake (spdlog dependency info)

# Load Conan-generated files
include(${CMAKE_BINARY_DIR}/conan/conan_toolchain.cmake)

# Use find_package for Conan dependencies
find_package(fmt REQUIRED)
find_package(spdlog REQUIRED)

# Your project files
add_executable(myapp main.cpp)
target_link_libraries(myapp PRIVATE fmt::fmt spdlog::spdlog)

# Conan automatically handles:
# - Include directories
# - Link libraries
# - Compiler definitions
```

### Advanced CMake Integration

**Custom CMake Variables**

```python
def generate(self):
    tc = CMakeToolchain(self)

    # Set custom CMake variables
    tc.variables["MYPROJECT_ENABLE_LOGGING"] = True
    tc.variables["MYPROJECT_USE_CUSTOM_ALLOCATOR"] = False
    tc.variables["MYPROJECT_BUILD_TESTS"] = self.options.enable_tests

    # Set compile definitions
    tc.preprocessor_definitions["MYPROJECT_VERSION"] = f'"{self.version}"'
    tc.preprocessor_definitions["MYPROJECT_DEBUG"] = "1" if self.settings.build_type == "Debug" else "0"

    tc.generate()
```

**CMake Presets Integration**

```python
def generate(self):
    tc = CMakeToolchain(self)

    # Generate CMakePresets.json (CMake 3.19+)
    tc.cache_variables["CMAKE_CONFIGURATION_TYPES"] = "Debug;Release"
    tc.cache_variables["CMAKE_CXX_STANDARD"] = "17"
    tc.cache_variables["CMAKE_CXX_STANDARD_REQUIRED"] = "ON"

    tc.generate()
```

### CMake Best Practices with Conan

**Directory Structure**

```
myproject/
├── conanfile.py           # Conan configuration
├── CMakeLists.txt         # Main CMake file
├── src/                   # Source files
│   ├── main.cpp
│   └── CMakeLists.txt
├── include/               # Header files
│   └── myproject/
│       └── header.h
├── tests/                 # Test files
│   ├── test_main.cpp
│   └── CMakeLists.txt
└── cmake/                 # Custom CMake modules
    └── FindMyLib.cmake
```

**CMakeLists.txt Best Practices**

```cmake
# CMakeLists.txt
cmake_minimum_required(VERSION 3.15)
project(MyProject VERSION 1.0.0 LANGUAGES CXX)

# Conan automatically sets C++ standard
# set(CMAKE_CXX_STANDARD 17)  # Don't set this manually with Conan

# Conan-generated toolchain
if(EXISTS ${CMAKE_BINARY_DIR}/conan/conan_toolchain.cmake)
    include(${CMAKE_BINARY_DIR}/conan/conan_toolchain.cmake)
endif()

# Project configuration
add_executable(myapp src/main.cpp)

# Conan dependencies
find_package(fmt REQUIRED)
find_package(spdlog REQUIRED)

target_link_libraries(myapp PRIVATE fmt::fmt spdlog::spdlog)

# Conan automatically provides:
# - target_include_directories(myapp PRIVATE ${fmt_INCLUDE_DIRS})
# - target_link_libraries(myapp PRIVATE ${fmt_LIBRARIES})
```

## Meson Build Integration

### Basic Meson Integration

**conanfile.py**

```python
from conan import ConanFile
from conan.tools.meson import MesonToolchain, Meson
from conan.tools.files import copy

class MyProjectConan(ConanFile):
    name = "myproject"
    version = "1.0.0"

    requires = "fmt/10.0.0"

    def generate(self):
        # Generate Meson cross-compilation file
        tc = MesonToolchain(self)
        tc.generate()

    def build(self):
        meson = Meson(self)
        meson.configure()
        meson.build()

    def package(self):
        # Copy built files
        copy(self, "myproject", self.build_folder,
             self.package_folder, keep_path=False)
```

**meson.build**

```meson
project('myproject', 'cpp',
  version : '1.0.0',
  default_options : ['cpp_std=gnu++17'])

# Conan generates conan_meson_native.ini and conan_meson_cross.ini
# These files are automatically used by Meson

# Find Conan dependencies
fmt_dep = dependency('fmt')

# Build executable
myproject_exe = executable('myproject', 'main.cpp',
  dependencies : [fmt_dep])
```

## Autotools (Make) Integration

### Basic Autotools Integration

**conanfile.py**

```python
from conan import ConanFile
from conan.tools.gnu import AutotoolsToolchain, Autotools
from conan.tools.files import copy

class MyProjectConan(ConanFile):
    name = "myproject"
    version = "1.0.0"

    requires = "fmt/10.0.0"

    def generate(self):
        # Generate Autotools configuration
        tc = AutotoolsToolchain(self)
        tc.generate()

    def build(self):
        autotools = Autotools(self)
        autotools.autoreconf()  # Run autoreconf if needed
        autotools.configure()
        autotools.make()

    def package(self):
        copy(self, "myproject", self.build_folder,
             self.package_folder, keep_path=False)
```

**configure.ac**

```autoconf
AC_INIT([myproject], [1.0.0])
AC_PROG_CXX
AX_CXX_COMPILE_STDCXX_17([noext], [mandatory])
PKG_CHECK_MODULES([FMT], [fmt])

AC_CONFIG_FILES([Makefile])
AC_OUTPUT
```

**Makefile.am**

```makefile
bin_PROGRAMS = myproject
myproject_SOURCES = main.cpp
myproject_CPPFLAGS = $(FMT_CFLAGS)
myproject_LDADD = $(FMT_LIBS)
```

### Windows Visual Studio Integration

**conanfile.py**

```python
from conan import ConanFile
from conan.tools.microsoft import MSBuild, MSBuildToolchain
from conan.tools.cmake import CMake, CMakeToolchain, CMakeDeps

class MyProjectConan(ConanFile):
    name = "myproject"
    version = "1.0.0"

    requires = "fmt/10.0.0"

    def generate(self):
        # Generate CMake configuration
        tc = CMakeToolchain(self)
        tc.generate()

        deps = CMakeDeps(self)
        deps.generate()

    def build(self):
        cmake = CMake(self)
        cmake.configure()
        cmake.build()
```

**CMakeLists.txt**

```cmake
cmake_minimum_required(VERSION 3.15)
project(MyProject)

# Conan automatically generates configuration files
if(EXISTS ${CMAKE_BINARY_DIR}/conan/conan_toolchain.cmake)
    include(${CMAKE_BINARY_DIR}/conan/conan_toolchain.cmake)
endif()

# Find Conan dependencies
find_package(fmt REQUIRED)

# Build executable
add_executable(myapp main.cpp)
target_link_libraries(myapp PRIVATE fmt::fmt)

# Conan automatically handles include paths and library linking
```

## Visual Studio Integration

### MSBuild Integration

**conanfile.py**

```python
from conan import ConanFile
from conan.tools.microsoft import MSBuild, MSBuildToolchain, vs_ide_version

class MyProjectConan(ConanFile):
    name = "myproject"
    version = "1.0.0"

    requires = "fmt/10.0.0"

    def generate(self):
        # Generate MSBuild configuration
        tc = MSBuildToolchain(self)
        tc.generate()

    def build(self):
        msbuild = MSBuild(self)
        msbuild.build("myproject.sln")
```

### Visual Studio Solutions

**conanfile.py**

```python
def build(self):
    if self.settings.os == "Windows":
        msbuild = MSBuild(self)
        # Build specific configuration
        msbuild.build("MyProject.sln", build_type="Release")
    else:
        autotools = Autotools(self)
        autotools.make()
```

## Ninja Build Integration

### Ninja with Conan

**conanfile.py**

```python
from conan import ConanFile
from conan.tools.cmake import CMake, CMakeToolchain

class MyProjectConan(ConanFile):
    name = "myproject"
    version = "1.0.0"

    requires = "fmt/10.0.0"
    tool_requires = "ninja/1.11.1"

    def generate(self):
        tc = CMakeToolchain(self)
        tc.generate()

    def build(self):
        cmake = CMake(self)
        cmake.configure()
        cmake.build()
```

**Usage**

```bash
# Conan automatically uses Ninja when available
conan install . --build=missing
conan build .  # Uses Ninja automatically
```

## Bazel Integration

### Basic Bazel Integration

**conanfile.py**

```python
from conan import ConanFile
from conan.tools.files import copy

class MyProjectConan(ConanFile):
    name = "myproject"
    version = "1.0.0"

    requires = "fmt/10.0.0"

    def package_info(self):
        self.cpp_info.libs = ["myproject"]

    def package(self):
        # Copy source files for Bazel
        copy(self, "src/*", self.source_folder,
             self.package_folder, keep_path=True)
```

**WORKSPACE**

```python
# WORKSPACE
load("@bazel_tools//tools/build_defs/repo:http.bzl", "http_archive")

# Conan dependencies
new_local_repository(
    name = "fmt",
    path = "/path/to/conan/prefix",
    build_file = "@//:fmt.BUILD",
)

new_local_repository(
    name = "myproject",
    path = "/path/to/conan/prefix",
    build_file = "@//:myproject.BUILD",
)
```

**BUILD.bazel**

```python
# BUILD.bazel
cc_library(
    name = "myproject",
    srcs = ["src/myproject.cpp"],
    hdrs = ["include/myproject.h"],
    deps = ["@fmt//:fmt"],
    visibility = ["//visibility:public"],
)
```

## Generic Build System Integration

### Manual Build Commands

**conanfile.py**

```python
from conan import ConanFile
from conan.tools.files import copy

class MyProjectConan(ConanFile):
    name = "myproject"
    version = "1.0.0"

    requires = "fmt/10.0.0"

    def build(self):
        # Custom build commands
        self.run("g++ -std=c++17 -I{} main.cpp -o myapp".format(
            " ".join(self.dependencies["fmt"].cpp_info.includedirs)
        ))

        # Or use a custom build script
        # self.run("./build_script.sh")

    def package(self):
        copy(self, "myapp", self.build_folder,
             self.package_folder, keep_path=False)
```

### Build Script Integration

**build.sh**

```bash
#!/bin/bash
# build.sh

# Get Conan information
FMT_INCLUDE=$(conan config get pkg(fmt).include_dirs)
FMT_LIB=$(conan config get pkg(fmt).lib_dirs)
FMT_LIBS=$(conan config get pkg(fmt).libs)

# Build command
g++ -std=c++17 \
    -I${FMT_INCLUDE} \
    -L${FMT_LIB} \
    main.cpp -o myapp \
    -lfmt

echo "Build completed successfully!"
```

**conanfile.py**

```python
def build(self):
    # Use custom build script
    self.run("chmod +x build.sh && ./build.sh")
```

## Multi-Build System Support

### Conditional Build System Selection

**conanfile.py**

```python
from conan import ConanFile

class MultiBuildConan(ConanFile):
    name = "myproject"
    version = "1.0.0"

    requires = "fmt/10.0.0"

    def layout(self):
        if self.settings.os == "Windows":
            # Windows: MSBuild/Visual Studio
            pass
        elif self.settings.os == "Macos":
            # macOS: Xcode
            pass
        else:
            # Linux: Make/Cmake
            from conan.tools.cmake import cmake_layout
            cmake_layout(self)

    def generate(self):
        if self.settings.os == "Windows":
            from conan.tools.microsoft import MSBuildToolchain
            tc = MSBuildToolchain(self)
            tc.generate()
        elif self.settings.os == "Macos":
            from conan.tools.apple import XcodeToolchain
            tc = XcodeToolchain(self)
            tc.generate()
        else:
            from conan.tools.cmake import CMakeToolchain
            tc = CMakeToolchain(self)
            tc.generate()

    def build(self):
        if self.settings.os == "Windows":
            from conan.tools.microsoft import MSBuild
            msbuild = MSBuild(self)
            msbuild.build("MyProject.sln")
        elif self.settings.os == "Macos":
            self.run("xcodebuild -project MyProject.xcodeproj")
        else:
            from conan.tools.cmake import CMake
            cmake = CMake(self)
            cmake.configure()
            cmake.build()
```

## Cross-Compilation Support

### Cross-Compilation with Conan

**conanfile.py**

```python
from conan import ConanFile
from conan.tools.cmake import CMake, CMakeToolchain, cmake_layout

class CrossCompileConan(ConanFile):
    name = "myproject"
    version = "1.0.0"

    requires = "fmt/10.0.0"

    # Cross-compilation settings
    settings = "os", "compiler", "build_type", "arch"

    def layout(self):
        cmake_layout(self, src_folder="src")

    def generate(self):
        tc = CMakeToolchain(self)

        # Cross-compilation flags
        tc.cache_variables["CMAKE_SYSTEM_NAME"] = "Linux"
        tc.cache_variables["CMAKE_SYSTEM_PROCESSOR"] = "arm"

        # Toolchain file for cross-compilation
        tc.cache_variables["CMAKE_C_COMPILER"] = "arm-linux-gnueabihf-gcc"
        tc.cache_variables["CMAKE_CXX_COMPILER"] = "arm-linux-gnueabihf-g++"
        tc.cache_variables["CMAKE_FIND_ROOT_PATH_MODE_PROGRAM"] = "NEVER"
        tc.cache_variables["CMAKE_FIND_ROOT_PATH_MODE_LIBRARY"] = "ONLY"
        tc.cache_variables["CMAKE_FIND_ROOT_PATH_MODE_INCLUDE"] = "ONLY"

        tc.generate()

    def build(self):
        cmake = CMake(self)
        cmake.configure()
        cmake.build()
```

**cross-toolchain.cmake**

```cmake
# cross-toolchain.cmake
set(CMAKE_SYSTEM_NAME Linux)
set(CMAKE_SYSTEM_PROCESSOR arm)

set(CMAKE_C_COMPILER arm-linux-gnueabihf-gcc)
set(CMAKE_CXX_COMPILER arm-linux-gnueabihf-g++)

set(CMAKE_FIND_ROOT_PATH_MODE_PROGRAM NEVER)
set(CMAKE_FIND_ROOT_PATH_MODE_LIBRARY ONLY)
set(CMAKE_FIND_ROOT_PATH_MODE_INCLUDE ONLY)
```

## Key Points: Build Systems Integration

- **CMake is the primary choice** - Best integration and most commonly used
- **Multiple build systems supported** - Meson, Autotools, MSBuild, Ninja, Bazel
- **Automatic toolchain generation** - Conan generates appropriate configuration files
- **Cross-compilation support** - Easy cross-compilation setup
- **Multi-platform workflows** - Same conanfile.py works across platforms
- **Custom build scripts** - Integration with any custom build system
- **Build system abstraction** - Conan hides platform-specific complexity
