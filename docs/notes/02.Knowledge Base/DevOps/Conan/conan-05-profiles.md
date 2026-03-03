---
title: Profiles Deep Dive
createTime: 2025/12/22 22:21:19
permalink: /kb/devops/conan/profiles/
---

# Profiles Deep Dive

A **profile** in Conan is like a "preset configuration" that defines your entire build environment. Think of it as a saved set of compiler settings, flags, and preferences that you can reuse across different projects.

## What is a Profile?

A profile tells Conan:

- **Which compiler** to use (GCC, Clang, MSVC, etc.)
- **Compiler version** (GCC 11, MSVC 2022, etc.)
- **Compiler flags** (-O3, -std=c++17, etc.)
- **Target platform** (Linux x86_64, Windows x86_64, etc.)
- **Build type** (Debug, Release, etc.)
- **Additional environment** variables and settings

## Why Use Profiles?

### Without Profiles (Manual Configuration)

```bash
# Every time you want to build for different configurations:
conan install . -s compiler=gcc -s compiler.version=11 -s compiler.libcxx=libstdc++11 -s build_type=Release
conan install . -s compiler=clang -s compiler.version=14 -s compiler.libcxx=libc++ -s build_type=Debug
conan install . -s compiler=msvc -s compiler.version=193 -s compiler.runtime=MDd -s build_type=Debug
```

### With Profiles (Clean and Reusable)

```bash
# Simple and clear:
conan install . --profile=gcc11-release
conan install . --profile=clang14-debug
conan install . --profile=msvc2022-debug
```

## Profile File Structure

A profile file is a simple text file with sections:

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
mylib:shared=True
fmt:header_only=False

[tool_requires]
cmake/3.27.0
ninja/1.11.1

[env]
CC=/usr/bin/gcc-11
CXX=/usr/bin/g++-11
CFLAGS=-DMY_CUSTOM_FLAG
CXXFLAGS=-std=c++17 -DMY_CUSTOM_FLAG

[conf]
tools.cmake.cmake_layout:build_folder_vars=['settings']
```

## Creating and Managing Profiles

### Create a Profile from Current System

```bash
# Auto-detect your current environment
conan profile new myprofile --detect

# Show the generated profile
conan profile show myprofile
```

### Create Profile from Another Profile

```bash
# Copy an existing profile and modify it
conan profile new gcc11-release --profile=default
conan profile update settings.compiler.version=11 gcc11-release
conan profile update settings.build_type=Release gcc11-release
```

### List All Profiles

```bash
# Show all available profiles
conan profile list
```

## Profile Examples for Common Scenarios

### Development Profile (Debug Builds)

```ini
[settings]
os=Linux
arch=x86_64
compiler=gcc
compiler.version=11
compiler.libcxx=libstdc++11
compiler.cppstd=17
build_type=Debug

[options]
# Enable debug symbols, disable optimizations
*:shared=False

[tool_requires]
cmake/3.27.0

[env]
# Add debug-specific environment variables
CFLAGS=-g -O0 -DDEBUG
CXXFLAGS=-g -O0 -DDEBUG -fsanitize=address

[conf]
# Keep build directories for debugging
tools.cmake.cmake_layout:build_folder_vars=['settings']
```

### Release Profile (Optimized Builds)

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
# Optimize for production
*:shared=True

[tool_requires]
cmake/3.27.0
ninja/1.11.1

[env]
# Optimization flags
CFLAGS=-O3 -DNDEBUG
CXXFLAGS=-O3 -DNDEBUG

[conf]
# Fast builds
tools.cmake.cmake_args=["-DCMAKE_BUILD_TYPE=Release", "-DCMAKE_CXX_FLAGS_RELEASE=-O3"]
```

### Cross-Compilation Profile (ARM)

```ini
[settings]
os=Linux
arch=armv8
compiler=gcc
compiler.version=11
compiler.libcxx=libstdc++11
compiler.cppstd=17
build_type=Release

[tool_requires]
cmake/3.27.0

[env]
# Cross-compilation toolchain
CC=arm-linux-gnueabihf-gcc
CXX=arm-linux-gnueabihf-g++
AR=arm-linux-gnueabihf-ar
STRIP=arm-linux-gnueabihf-strip

[conf]
# Use cross-compilation toolchain
tools.build:cflags=["-march=armv8-a"]
tools.build:cxxflags=["-march=armv8-a"]
```

### Windows MSVC Profile

```ini
[settings]
os=Windows
arch=x86_64
compiler=msvc
compiler.version=193
compiler.runtime=MD
compiler.runtime_type=Release
compiler.cppstd=17
build_type=Release

[options]
*:shared=True

[tool_requires]
cmake/3.27.0

[env]
# Windows-specific environment
PATH=[C:/Program Files (x86)/Microsoft Visual Studio/2022/Community/VC/Auxiliary/Build]
CL=-MT
```

### macOS Profile (Apple Clang)

```ini
[settings]
os=Macos
arch=x86_64
compiler=apple-clang
compiler.version=14.0
compiler.libcxx=libc++
compiler.cppstd=17
build_type=Release

[options]
*:shared=True

[tool_requires]
cmake/3.27.0

[env]
# macOS-specific settings
MACOSX_DEPLOYMENT_TARGET=11.0
```

## Advanced Profile Features

### Profile Inheritance

Create base profiles and extend them:

```ini
# base-gcc.profile
[settings]
compiler=gcc
compiler.cppstd=17

[tool_requires]
cmake/3.27.0

# gcc11-debug.profile
[settings]
compiler.version=11
build_type=Debug

[env]
CFLAGS=-g -O0
CXXFLAGS=-g -O0

# gcc11-release.profile
[settings]
compiler.version=11
build_type=Release

[env]
CFLAGS=-O3
CXXFLAGS=-O3
```

### Profile Templates with Variables

```ini
# reusable-gcc.profile (template)
[settings]
os=Linux
arch=x86_64
compiler=gcc
compiler.version=GCC_VERSION
compiler.libcxx=libstdc++11
compiler.cppstd=17
build_type=BUILD_TYPE

[env]
CFLAGS=OPTIMIZATION_FLAGS
CXXFLAGS=OPTIMIZATION_FLAGS

# Usage with variables
conan install . --profile:env=GCC_VERSION=11,BUILD_TYPE=Release,OPTIMIZATION_FLAGS="-O3 -DNDEBUG"
```

### Conditional Profile Settings

```ini
# smart-profile.profile (conditions based on settings)
[settings]
os=Linux
arch=x86_64
compiler=gcc
compiler.version=11
build_type=Release

[env]
# Only set optimization flags for release builds
CFLAGS=@build_type:Debug?-g -O0:-O3 -DNDEBUG
CXXFLAGS=@build_type:Debug?-g -O0:-O3 -DNDEBUG
```

## Profile Command Reference

### Profile Management Commands

```bash
# Create new profile
conan profile new <name> [--detect] [--force]

# Update profile settings
conan profile update <key>=<value> <profile>

# Remove profile settings
conan profile update "!key" <profile>

# Delete profile
conan profile remove <name>

# List all profiles
conan profile list

# Show profile content
conan profile show <name>

# Convert profile to dict/JSON
conan profile show <name> --json=output.json

# Update profile from file
conan profile update @profile.txt <profile>

# Update from dict
conan profile update key=value,key2=value2 <profile>
```

### Using Profiles

```bash
# Install with specific profile
conan install . --profile=<profile-name>

# Install with multiple profiles (environment profiles)
conan install . --profile:env=<profile1> --profile:build=<profile2>

# Use profile with variables
conan install . --profile=myprofile --profile:env=CC=gcc-12

# List detected profiles
conan profile detect --force

# Show current profile detection
conan profile detect --dry-run
```

## Real-World Profile Workflows

### Multi-Configuration Development

```bash
# Development workflow with different configurations
conan install . --profile=dev-debug     # For debugging
conan install . --profile=dev-release   # For testing
conan install . --profile=cross-arm     # For embedded target
```

### CI/CD Integration

```bash
# CI/CD pipeline with multiple targets
conan create . mylib/1.0.0@user/stable --profile=ci-linux-release
conan create . mylib/1.0.0@user/stable --profile=ci-windows-release
conan create . mylib/1.0.0@user/stable --profile=ci-macos-release
conan create . mylib/1.0.0@user/stable --profile=ci-arm-release
```

### Team Development

```bash
# Team setup with shared profiles
# Share profile files via git
git add ~/.conan2/profiles/
git push origin profiles

# Team members import
git pull origin profiles
conan profile list  # See shared profiles
```

## Profile Best Practices

### 1. Organization

```bash
# Use descriptive names
conan profile new gcc11-release-optimized
conan profile new clang14-debug-sanitized
conan profile new msvc2022-static-runtime

# Use prefixes for organization
conan profile new dev-gcc11-debug
conan profile new ci-gcc11-release
conan profile new embedded-arm-cross
```

### 2. Documentation

```ini
# my-team-profile.profile
# Team standard profile for GCC 11, C++17, Release builds
# Usage: conan install . --profile=my-team-profile
[settings]
# ... settings ...
```

### 3. Version Management

```bash
# Keep profiles versioned
conan profile new gcc11 --detect
conan profile new gcc12 --detect

# Update references in CI/CD
# CI/CD script: conan install . --profile=gcc$(GCC_VERSION)
```

### 4. Security

```bash
# Never commit sensitive profiles with passwords/tokens
echo "*.profile" >> .gitignore  # For profiles with secrets
```

## Key Points: Profiles Deep Dive

- **Profiles are presets** - Store and reuse build configurations
- **Multiple sections** - settings, options, tool_requires, env, conf
- **Cross-platform support** - Different profiles for different platforms
- **Version management** - Keep profiles for different compiler versions
- **Team workflows** - Share profiles across team members
- **CI/CD integration** - Use profiles for automated builds
- **Performance optimization** - Tune flags for different build types
