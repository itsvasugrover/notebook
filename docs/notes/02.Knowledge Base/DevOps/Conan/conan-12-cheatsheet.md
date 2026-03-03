---
title: Conan 2.X Cheatsheet
createTime: 2025/12/22 22:21:19
permalink: /kb/devops/conan/cheatsheet/
---

# Conan 2.X Cheatsheet

A **quick reference guide** for all essential Conan commands, configuration options, and common workflows. Keep this handy for daily development tasks.

## Essential Commands

### Installation and Setup

```bash
# Install Conan 2.X
pip install conan

# Verify installation
conan --version

# Auto-detect and create profile
conan profile detect --force

# Show current profile
conan profile show default

# List all profiles
conan profile list
```

### Basic Project Workflow

```bash
# Install dependencies
conan install .

# Install with specific profile
conan install . --profile=myprofile

# Build project
conan build .

# Create package
conan create . mypackage/1.0.0@user/channel

# Upload package
conan upload mypackage/1.0.0@user/channel --remote=myremote

# Install specific package version
conan install package/1.0.0@user/channel
```

### Package Management

```bash
# Search packages
conan search fmt
conan search "boost*" --remote=conancenter

# Show package information
conan show fmt/10.0.0

# Download package
conan download fmt/10.0.0 --remote=conancenter

# List installed packages
conan list "*"

# Remove package from cache
conan cache clean "mypackage/1.0.0@user/channel"
```

## Profile Management

### Create and Modify Profiles

```bash
# Create new profile
conan profile new myprofile --detect

# Create from existing profile
conan profile new gcc11-release --profile=default

# Update profile settings
conan profile update settings.compiler.version=11 myprofile

# Update profile options
conan profile update options.shared=True myprofile

# Update environment variables
conan profile update env.CC=gcc-11 myprofile

# Remove setting
conan profile update "!settings.build_type" myprofile

# Delete profile
conan profile remove myprofile

# Show profile details
conan profile show myprofile
```

### Profile Examples

```bash
# Development profile
conan profile new dev-debug --detect
conan profile update settings.build_type=Debug dev-debug
conan profile update env.CFLAGS="-g -O0" dev-debug

# Release profile
conan profile new rel-release --detect
conan profile update settings.build_type=Release rel-release
conan profile update env.CFLAGS="-O3" rel-release

# Cross-compilation profile
conan profile new cross-arm --detect
conan profile update settings.arch=armv8 cross-arm
conan profile update env.CC=arm-linux-gnueabihf-gcc cross-arm
```

## Remote Management

### Add and Configure Remotes

```bash
# Add remote
conan remote add mycompany https://conan.mycompany.com

# Update remote URL
conan remote update mycompany https://new-url.com

# Enable/disable remote
conan remote disable conancenter
conan remote enable conancenter

# List remotes
conan remote list

# Remove remote
conan remote remove mycompany

# Set authentication
conan remote auth mycompany --username=user --password=token

# Test remote connectivity
conan ping mycompany

# Disable SSL verification (development only)
conan remote add insecure http://server.com --insecure
```

### Upload and Download

```bash
# Upload package
conan upload mypackage/1.0.0@user/channel --remote=myremote

# Upload with all binaries
conan upload mypackage/1.0.0@user/channel --remote=myremote --all

# Upload pattern
conan upload "mypackage/1.*" --remote=myremote

# Download package
conan download fmt/10.0.0 --remote=conancenter

# Download recipe only
conan download fmt/10.0.0 --remote=conancenter --recipe-only
```

## Dependency Management

### Advanced Install Options

```bash
# Build missing packages
conan install . --build=missing

# Build outdated packages
conan install . --build=outdated

# Build all packages from source
conan install . --build=*

# Install specific configuration
conan install . --profile=myprofile --build=missing

# Print dependency graph
conan install . --print=graph

# Show package information
conan info .

# Show only requires
conan info . --only=requires

# Show build requirements
conan info . --only=build_requires

# JSON output
conan install . --json=output.json
```

### Version Management

```bash
# Install with version ranges
conan install "fmt/[>=10.0.0 <11.0.0]"

# Install latest version
conan install "openssl/3.*"

# Check available versions
conan search fmt --remote=conancenter
```

## Build System Integration

### CMake Integration

```bash
# Generate CMake files
conan install . --build=missing

# CMake will automatically use:
# - conan_toolchain.cmake (compiler settings)
# - fmt-config.cmake (dependency info)

# Build with CMake
mkdir build && cd build
cmake .. -DCMAKE_BUILD_TYPE=Release
cmake --build .
```

### Build with Different Generators

```bash
# Use Ninja generator (faster builds)
conan install . --build=missing -g Ninja

# Use Unix Makefiles
conan install . --build=missing -g UnixMakefiles

# Use Visual Studio (Windows)
conan install . --build=missing -g VisualStudio
```

## Debugging and Diagnostics

### Verbose Output

```bash
# Verbose output
conan install . --verbose

# Debug output
conan install . --debug

# Trace output (maximum details)
conan install . --trace

# Save output to file
conan install . --verbose > output.log 2>&1
```

### Cache and Storage

```bash
# Show cache path
conan cache path

# List cache contents
conan list "*"

# Clean specific package
conan cache clean "mypackage/*"

# Clean entire cache
conan cache clean "*"

# Check cache size
du -sh ~/.conan2/
```

### System Information

```bash
# Show Conan configuration
conan config get

# Show Conan home directory
conan config home

# Install configuration from URL
conan config install https://github.com/user/conan-config.git

# Show environment variables
env | grep CONAN
```

## Advanced Commands

### Package Creation and Testing

```bash
# Create package from source
conan create . mylib/1.0.0@user/stable

# Create with test package
conan create . mylib/1.0.0@user/stable --test-folder=test_package

# Test existing package
conan test test_package mylib/1.0.0@user/stable

# Copy packages between remotes
conan copy mylib/1.0.0@user/testing mylib/1.0.0@user/stable --remote=dev-remote --destination=prod-remote
```

### Graph and Dependency Analysis

```bash
# Show dependency graph
conan install . --print=graph

# Generate dependency graph in DOT format
conan install . --print=graph_dot=deps.dot

# Show package dependencies
conan info mypackage/1.0.0@user/channel

# Check for conflicts
conan install . --build=missing 2>&1 | grep conflict
```

### Custom Commands

```bash
# Export recipe (create from folder)
conan export . mylib/1.0.0@user/channel

# Export package (create from built binaries)
conan export-pkg . mylib/1.0.0@user/channel --build-folder=build

# Remove packages
conan remove mypackage/1.0.0@user/channel

# Search in specific remote
conan search fmt --remote=conancenter

# List recipe revisions
conan list mylib/1.0.0@user/channel --recipe

# List package revisions
conan list mylib/1.0.0@user/channel --packages
```

## Environment Variables

### Important Conan Environment Variables

```bash
# Conan home directory
export CONAN_USER_HOME=/path/to/custom/.conan2

# Verbose output
export CONAN_VERBOSE_TRACEBACK=1

# Print run commands
export CONAN_PRINT_RUN_COMMANDS=1

# Log to file
export CONAN_LOG_RUN_TO_FILE=1

# Disable SSL verification (development only)
export CONAN_CMAKE_SKIP_RPATH=1

# Cache directory
export CONAN_CACHE_FOLDER=/path/to/cache

# User credentials
export CONAN_USERNAME=your_username
export CONAN_PASSWORD=your_token
```

## Configuration File Examples

### Basic conanfile.py

```python
from conan import ConanFile
from conan.tools.cmake import CMake, CMakeToolchain, CMakeDeps, cmake_layout

class MyProjectConan(ConanFile):
    name = "myproject"
    version = "1.0.0"
    license = "MIT"
    description = "My C++ project"
    topics = ("cpp", "library")

    settings = "os", "compiler", "build_type", "arch"
    options = {"shared": [True, False], "fPIC": [True, False]}
    default_options = {"shared": False, "fPIC": True}

    requires = ("fmt/10.0.0",)

    def configure(self):
        if self.options.shared:
            self.options.fPIC = False

    def layout(self):
        cmake_layout(self)

    def generate(self):
        tc = CMakeToolchain(self)
        tc.generate()

        deps = CMakeDeps(self)
        deps.generate()

    def build(self):
        cmake = CMake(self)
        cmake.configure()
        cmake.build()

    def package_info(self):
        self.cpp_info.libs = ["myproject"]
```

### Basic conanfile.txt

```ini
[requires]
fmt/10.0.0
spdlog/1.11.0

[generators]
CMakeDeps
CMakeToolchain

[options]
fmt:header_only=False
spdlog:header_only=False
```

### Profile Example

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
*:shared=False

[tool_requires]
cmake/3.27.0

[env]
CC=gcc-11
CXX=g++-11
CFLAGS=-O3 -DNDEBUG
CXXFLAGS=-std=c++17 -O3 -DNDEBUG

[conf]
tools.cmake.cmake_layout:build_folder_vars=['settings']
```

## Quick Workflows

### New Project Setup

```bash
# 1. Create project structure
mkdir myproject && cd myproject

# 2. Create conanfile.py (see examples above)

# 3. Install dependencies
conan install . --build=missing

# 4. Build project
conan build .

# 5. Test
./build/Release/myapp
```

### Dependency Update Workflow

```bash
# 1. Check for updates
conan install . --build=outdated

# 2. Update specific package
conan install . --build=outdated --requires=fmt/10.1.0

# 3. Test with new dependencies
conan build .

# 4. If everything works, update conanfile.py
# Update version in requires

# 5. Create new package
conan create . myproject/1.1.0@user/stable
```

### CI/CD Integration

```bash
# CI environment setup
conan profile detect --force
conan install . --profile=ci-release --build=missing
conan build .
conan create . myproject/1.0.0@user/ci
conan upload myproject/1.0.0@user/ci --remote=ci-remote
```

### Team Development

```bash
# Team member setup
git clone <repository>
cd project
conan install . --build=missing
conan build .

# Update dependencies
git pull origin main
conan install . --build=outdated
conan build .
```

## Common Error Solutions

| Error                      | Quick Fix                                                               |
| -------------------------- | ----------------------------------------------------------------------- |
| `conan: command not found` | `pip install conan`                                                     |
| `Profile not found`        | `conan profile detect --force`                                          |
| `Package not found`        | `conan search package --remote=conancenter`                             |
| `CMake not found`          | `conan install . --build=missing` (includes CMake)                      |
| `Compiler not detected`    | Install GCC/Clang/Visual Studio                                         |
| `Version conflict`         | Check dependency graph with `--print=graph`                             |
| `Authentication failed`    | Use tokens: `conan remote auth remote --username=user --password=token` |
| `SSL verification failed`  | Update CA certificates or use `--verify-ssl=false`                      |
| `No space left on device`  | `conan cache clean "*"`                                                 |
| `Include file not found`   | Use CMakeDeps generator in conanfile.py                                 |

## Performance Tips

### Speed Up Builds

```bash
# Use parallel downloads
conan config set general.parallel_download=8

# Use binary cache
export CONAN_USER_HOME=/fast/ssd/.conan2

# Avoid rebuilding
conan install . --build=missing  # Don't rebuild existing packages

# Use faster generators
conan install . -g Ninja  # Faster than Makefiles

# Optimize profile
conan profile update env.CFLAGS="-O3 -DNDEBUG" release
```

### Cache Management

```bash
# Check cache size
du -sh ~/.conan2/

# Clean old packages
conan cache clean "*"

# Move cache to faster storage
export CONAN_USER_HOME=/path/to/fast/ssd/.conan2

# Share cache between projects
export CONAN_USER_HOME=/shared/cache/.conan2
```

## Key Points: Quick Reference

- **Installation**: `pip install conan`, then `conan profile detect --force`
- **Basic workflow**: `conan install .` → `conan build .` → `conan create . package/version@user/channel`
- **Profiles**: Use profiles for different build configurations (`--profile=name`)
- **Dependencies**: Use version ranges for flexibility (`fmt/[>=10.0.0 <11.0.0]`)
- **Remotes**: Manage multiple repositories (`conan remote add/name/update/list`)
- **Debugging**: Use `--verbose`, `--debug`, `--trace` flags for detailed output
- **Cache**: Clean with `conan cache clean "*"` when stuck
- **CMake**: Conan generates all necessary CMake files automatically
- **CI/CD**: Always use specific profiles in automated environments

---

_This cheatsheet covers the most common Conan 2.X operations. For detailed explanations, refer to the specific sections in this guide._
