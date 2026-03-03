---
title: Troubleshooting Guide
createTime: 2025/12/22 22:21:19
permalink: /kb/devops/conan/troubleshooting/
---

# Troubleshooting Guide

Even experienced developers encounter issues with Conan. This guide helps you **quickly identify and fix** the most common problems, from dependency conflicts to build failures.

## Quick Diagnosis

### Start Here - Basic Diagnostics

```bash
# 1. Check Conan version and configuration
conan --version
conan profile detect --force

# 2. Check system information
conan profile show

# 3. Clear cache and start fresh (nuclear option)
conan cache clean "*"

# 4. Verbose output for debugging
conan install . --verbose --build=missing
```

### Debug Output Levels

```bash
# Basic output
conan install .

# Verbose output (more details)
conan install . --verbose

# Debug output (all details)
conan install . --debug

# Trace output (maximum details)
conan install . --trace
```

## Installation and Setup Issues

### Problem: "conan: command not found"

**Symptoms:**

```bash
bash: conan: command not found
```

**Solutions:**

```bash
# Check if Conan is installed
which conan

# If not found, reinstall
pip install conan

# Or check Python path
python3 -c "import conan; print(conan.__file__)"

# Add to PATH (Linux/macOS)
echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.bashrc
source ~/.bashrc

# Windows PowerShell
$env:PATH += ";$env:USERPROFILE\.local\bin"
```

### Problem: "Python version not supported"

**Symptoms:**

```bash
ERROR: Conan 2.X requires Python 3.7 or higher. Current version: 2.7.x
```

**Solutions:**

```bash
# Check Python version
python3 --version

# Install Python 3.7+ (Ubuntu/Debian)
sudo apt update
sudo apt install python3 python3-pip

# Install Python 3.7+ (macOS)
brew install python3

# Install Python 3.7+ (Windows)
# Download from python.org or use winget
winget install Python.Python.3.11

# Use specific Python version
python3 -m pip install conan
```

### Problem: "Compiler not detected"

**Symptoms:**

```bash
ERROR: Unable to detect compiler
```

**Solutions:**

```bash
# Install C++ compiler (Ubuntu/Debian)
sudo apt update
sudo apt install build-essential

# Install C++ compiler (macOS)
xcode-select --install

# Install C++ compiler (Windows)
# Install Visual Studio with "Desktop development with C++"

# Verify compiler installation
gcc --version          # Linux/macOS
cl.exe                 # Windows (in Developer Command Prompt)

# Force profile detection
conan profile detect --force
```

## Dependency and Package Issues

### Problem: "Package not found"

**Symptoms:**

```bash
ERROR: Package 'mypackage/1.0.0@user/channel' not found
```

**Solutions:**

```bash
# 1. Check if package exists
conan search mypackage --remote=conancenter

# 2. Check package name and version
conan search "mypackage*" --remote=conancenter

# 3. Check if remote is accessible
conan ping conancenter

# 4. Check if remote is enabled
conan remote list

# 5. Enable disabled remotes
conan remote enable conancenter

# 6. Check package reference format
# Correct: mypackage/1.0.0@user/channel
# Wrong: mypackage@1.0.0@user/channel
```

### Problem: "Version conflict in dependencies"

**Symptoms:**

```bash
ERROR: Version conflict detected:
  - myapp/1.0.0 requires 'openssl/3.0.8'
  - myapp/1.0.0 requires 'openssl/1.1.1'
```

**Solutions:**

```python
# Solution 1: Force a specific version
class MyAppConan(ConanFile):
    requires = (
        "package-a/1.0.0",
        "package-b/2.0.0",
        ("openssl/3.0.8", "override"),  # Force OpenSSL 3.0
    )

# Solution 2: Use compatible version ranges
class MyAppConan(ConanFile):
    requires = (
        "openssl/[>=3.0.0 <4.0.0]",  # Allow any 3.x version
    )

# Solution 3: Remove conflicting dependencies
class MyAppConan(ConanFile):
    def configure(self):
        # Remove transitive dependency
        if self.dependencies.get("openssl"):
            self.dependencies["openssl"].requires.clear()
```

### Problem: "Dependency resolution failed"

**Symptoms:**

```bash
ERROR: Unable to resolve dependencies for myapp/1.0.0
```

**Solutions:**

```bash
# 1. Check dependency graph
conan install . --print=graph

# 2. Build missing dependencies
conan install . --build=missing

# 3. Build all dependencies from source
conan install . --build=outdated

# 4. Check for unavailable packages
conan install . --build=missing --build=outdated --verbose

# 5. Clear cache and retry
conan cache clean "*"
conan install . --build=missing
```

## Build and Compilation Issues

### Problem: "CMake not found"

**Symptoms:**

```bash
ERROR: CMake was not found in PATH
```

**Solutions:**

```bash
# Install CMake (Ubuntu/Debian)
sudo apt update
sudo apt install cmake

# Install CMake (macOS)
brew install cmake

# Install CMake (Windows)
# Download from cmake.org or use winget
winget install Kitware.CMake

# Or install via Conan
conan install . --build=missing
# Conan will download and use cmake if specified in tool_requires

# Verify installation
cmake --version
```

### Problem: "Compiler version mismatch"

**Symptoms:**

```bash
ERROR: Package was built with different compiler version
```

**Solutions:**

```bash
# 1. Check current compiler
gcc --version
clang++ --version
cl.exe

# 2. Update profile to match compiler
conan profile detect --force

# 3. Check profile settings
conan profile show default

# 4. Update compiler version in profile
conan profile update settings.compiler.version=11 default

# 5. Rebuild package with correct compiler
conan install . --build=missing --profile=default
```

### Problem: "Linker errors"

**Symptoms:**

```bash
undefined reference to `fmt::print'
/usr/bin/ld: cannot find -lfmt
```

**Solutions:**

```python
# Solution 1: Fix CMakeLists.txt
# CMakeLists.txt
cmake_minimum_required(VERSION 3.15)
project(MyApp)

# Let Conan handle everything
find_package(fmt REQUIRED)
target_link_libraries(myapp PRIVATE fmt::fmt)

# Solution 2: Check package information
conan show fmt/10.0.0

# Solution 3: Verify include paths
conan install . --build=missing
cat build/Conan_toolchain.cmake | grep FMT
```

### Problem: "Include file not found"

**Symptoms:**

```bash
fatal error: fmt/core.h: No such file or directory
```

**Solutions:**

```python
# Solution 1: Verify package provides headers
# conanfile.py
class MyProjectConan(ConanFile):
    requires = "fmt/10.0.0"

    def package_info(self):
        # Check that headers are available
        fmt_libs = self.deps_cpp_info["fmt"].libs
        fmt_includes = self.deps_cpp_info["fmt"].include_paths
        print(f"fmt include paths: {fmt_includes}")

# Solution 2: Check CMake configuration
# CMakeLists.txt
find_package(fmt REQUIRED)
# This should set:
# - FMT_INCLUDE_DIRS
# - FMT_LIBRARIES

# Solution 3: Force rebuild
conan install . --build=fmt
```

## Profile and Configuration Issues

### Problem: "Profile not found"

**Symptoms:**

```bash
ERROR: Profile 'myprofile' not found
```

**Solutions:**

```bash
# 1. List available profiles
conan profile list

# 2. Create missing profile
conan profile new myprofile --detect

# 3. Use default profile instead
conan install . --profile=default

# 4. Create profile from file
conan profile new myprofile --file=myprofile.txt

# 5. Check profile file location
ls ~/.conan2/profiles/
```

### Problem: "Invalid profile settings"

**Symptoms:**

```bash
ERROR: Invalid profile setting: compiler.version=invalid
```

**Solutions:**

```bash
# 1. Check valid settings values
conan profile show default

# 2. Update with valid values
conan profile update settings.compiler.version=11 default

# 3. Reset profile
conan profile detect --force

# 4. Validate profile
conan profile show myprofile
```

### Problem: "Cross-compilation not working"

**Symptoms:**

```bash
ERROR: Build host configuration different from target
```

**Solutions:**

```python
# Solution 1: Use proper cross-compilation profile
# cross-arm.profile
[settings]
os=Linux
arch=armv8
compiler=gcc
compiler.version=11
compiler.libcxx=libstdc++11
compiler.cppstd=17
build_type=Release

[env]
CC=arm-linux-gnueabihf-gcc
CXX=arm-linux-gnueabihf-g++

[conf]
tools.build:cflags=["-march=armv8-a"]
tools.build:cxxflags=["-march=armv8-a"]

# Solution 2: Use Conan cross-compilation features
# conanfile.py
class CrossCompileConan(ConanFile):
    settings = "os", "compiler", "build_type", "arch"

    def generate(self):
        tc = CMakeToolchain(self)
        tc.cache_variables["CMAKE_SYSTEM_NAME"] = "Linux"
        tc.cache_variables["CMAKE_SYSTEM_PROCESSOR"] = "arm"
        tc.cache_variables["CMAKE_C_COMPILER"] = "arm-linux-gnueabihf-gcc"
        tc.cache_variables["CMAKE_CXX_COMPILER"] = "arm-linux-gnueabihf-g++"
        tc.generate()
```

## Remote and Authentication Issues

### Problem: "Remote not accessible"

**Symptoms:**

```bash
ERROR: Unable to connect to remote 'myremote'
```

**Solutions:**

```bash
# 1. Check remote connectivity
conan ping myremote

# 2. Test with basic connection
curl -I https://myremote.com/conan/v1/

# 3. Check remote configuration
conan remote list

# 4. Re-add remote
conan remote remove myremote
conan remote add myremote https://myremote.com/conan/v1/

# 5. Disable SSL verification (development only)
conan remote add myremote http://insecure-server.com --insecure
```

### Problem: "Authentication failed"

**Symptoms:**

```bash
ERROR: Unauthorized: Wrong username or password
```

**Solutions:**

```bash
# 1. Check authentication
conan remote auth myremote

# 2. Use environment variables
export CONAN_USERNAME=your_username
export CONAN_PASSWORD=your_password
conan install . --remote=myremote

# 3. Use API tokens instead of passwords
conan remote auth myremote --username=your_username --password=your_api_token

# 4. Clear authentication cache
conan user --clean

# 5. Re-authenticate
conan remote auth myremote --username=your_username
```

### Problem: "SSL certificate verification failed"

**Symptoms:**

```bash
ERROR: SSL: CERTIFICATE_VERIFY_FAILED
```

**Solutions:**

```bash
# Solution 1: Update CA certificates
# Ubuntu/Debian
sudo apt update && sudo apt install ca-certificates

# macOS
/Applications/Python\ 3.x/Install\ Certificates.command

# Solution 2: Use correct CA bundle
export REQUESTS_CA_BUNDLE=/path/to/ca-bundle.crt
export SSL_CERT_FILE=/path/to/ca-bundle.crt

# Solution 3: Disable verification (development only)
conan remote add myremote https://server.com --verify-ssl=false

# Solution 4: Add custom CA certificate
export REQUESTS_CA_BUNDLE=/path/to/custom-ca.pem
```

## Cache and Storage Issues

### Problem: "Disk space full"

**Symptoms:**

```bash
ERROR: No space left on device
```

**Solutions:**

```bash
# 1. Check cache size
du -sh ~/.conan2/

# 2. Clean cache
conan cache clean "*"

# 3. Remove specific packages
conan cache clean "mypackage/*"

# 4. Move cache to different location
export CONAN_USER_HOME=/path/to/larger/disk/.conan2

# 5. Configure cache limits
[conf]
# Limit cache size (if supported)
tools.cmake.cmake_layout:max_cache_size=10GB
```

### Problem: "Cache corruption"

**Symptoms:**

```bash
ERROR: Package integrity check failed
```

**Solutions:**

```bash
# 1. Clear specific package
conan cache clean "mypackage/1.0.0@user/channel"

# 2. Clear entire cache
conan cache clean "*"

# 3. Remove cache directory
rm -rf ~/.conan2/

# 4. Reinstall Conan
pip install --upgrade conan

# 5. Re-detect profile
conan profile detect --force
```

### Problem: "Slow downloads"

**Symptoms:**

```bash
Package downloads are very slow
```

**Solutions:**

```bash
# 1. Check network connectivity
ping center.conan.io

# 2. Use different remote
conan remote disable conancenter
conan remote add conancenter-mirror https://conan.bintray.com

# 3. Configure concurrent downloads
conan config set general.parallel_download=8

# 4. Use binary cache
export CONAN_USER_HOME=/fast/ssd/.conan2

# 5. Download packages manually
conan download fmt/10.0.0 --remote=conancenter
```

## CMake Integration Issues

### Problem: "CMake can't find dependencies"

**Symptoms:**

```bash
CMake Error: Could not find fmt
```

**Solutions:**

```python
# Solution 1: Use Conan-generated CMake files
# conanfile.py
def generate(self):
    tc = CMakeToolchain(self)
    tc.generate()

    deps = CMakeDeps(self)
    deps.generate()

# CMakeLists.txt
# Load Conan-generated files
if(EXISTS ${CMAKE_BINARY_DIR}/conan/conan_toolchain.cmake)
    include(${CMAKE_BINARY_DIR}/conan/conan_toolchain.cmake)
endif()

# Use Conan dependencies
find_package(fmt REQUIRED)
target_link_libraries(myapp PRIVATE fmt::fmt)

# Solution 2: Check generated files
ls build/conan/
# Should contain: conan_toolchain.cmake, fmt-config.cmake, etc.

# Solution 3: Force regeneration
rm -rf build/
conan install . --build=missing
```

### Problem: "Multiple CMake configurations"

**Symptoms:**

```bash
CMake Error: Found package 'fmt' but it was not a config package
```

**Solutions:**

```python
# Solution 1: Use CMakeDeps generator
# conanfile.py
def generate(self):
    deps = CMakeDeps(self)
    deps.generate()

# NOT generators = ["cmake"]  # Old approach
# Use generators = ["CMakeDeps", "CMakeToolchain"]

# Solution 2: Check generated config files
find build/conan/ -name "*-config.cmake"
# Should find: fmt-config.cmake, spdlog-config.cmake, etc.

# Solution 3: Update to modern CMake
cmake_minimum_required(VERSION 3.15)
project(MyApp)

# Use modern CMake approach
find_package(fmt REQUIRED)
```

## Debugging Advanced Issues

### Enable Maximum Debug Output

```bash
# Enable all debugging features
export CONAN_VERBOSE_TRACEBACK=1
export CONAN_PYLINTRC=
export CONAN_PRINT_RUN_COMMANDS=1
export CONAN_LOG_RUN_TO_FILE=1

# Run with maximum verbosity
conan install . --verbose --debug --trace > debug.log 2>&1
```

### Log Analysis

```bash
# Check Conan logs
ls ~/.conan2/logs/

# Analyze trace output
grep ERROR debug.log
grep "ERROR:" debug.log

# Check specific operations
grep "conan install" debug.log
```

### Environment Investigation

```bash
# Check environment variables
env | grep CONAN

# Check paths
echo $PATH
echo $HOME

# Check Conan configuration
conan config get

# Check cache location
conan cache path
```

## Common Error Messages and Solutions

| Error Message             | Likely Cause                               | Quick Fix                                   |
| ------------------------- | ------------------------------------------ | ------------------------------------------- |
| `command not found`       | Conan not installed                        | `pip install conan`                         |
| `Package not found`       | Wrong package name or remote               | `conan search package --remote=conancenter` |
| `Version conflict`        | Different packages need different versions | Use version overrides                       |
| `CMake not found`         | CMake not installed                        | Install CMake or add to tool_requires       |
| `Compiler not detected`   | No C++ compiler installed                  | Install GCC/Clang/Visual Studio             |
| `SSL verification failed` | Certificate issues                         | Update CA certificates                      |
| `Authentication failed`   | Wrong credentials                          | Use tokens, not passwords                   |
| `No space left on device` | Disk full                                  | Clean cache or move to larger disk          |
| `Profile not found`       | Missing profile                            | Create profile or use default               |
| `Include file not found`  | Header paths incorrect                     | Use Conan-generated CMake files             |

## Key Points: Troubleshooting

- **Start with basics** - Version, profile, and connectivity checks
- **Use verbose output** - `--verbose`, `--debug`, `--trace` flags
- **Clear cache when stuck** - `conan cache clean "*"`
- **Check dependencies first** - Many issues are dependency conflicts
- **Verify build tools** - CMake, compilers must be installed
- **Profile management** - Most configuration issues are profile-related
- **Remote authentication** - Use tokens, check connectivity
- **Clean slate approach** - When stuck, clear everything and start fresh
