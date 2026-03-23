---
title: Installation and Setup
createTime: 2025/12/22 22:21:19
permalink: /kb/devops/conan/installation-setup/
---

# Installation and Setup

Let's get Conan 2.X installed and configured on your system. Conan works on Windows, macOS, and Linux.

## Installation Methods

### Method 1: pip (Recommended for Most Users)

If you have Python 3 and pip installed:

```bash
# Install the latest Conan 2.X
pip install conan

# Verify installation
conan --version
```

### Method 2: Package Managers

#### Windows (Using Chocolatey)

```powershell
choco install conan
```

#### macOS (Using Homebrew)

```bash
brew install conan
```

#### Ubuntu/Debian

```bash
# Add Conan repository
sudo add-apt-repository conan/stable
sudo apt update
sudo apt install conan
```

### Method 3: Standalone Installer (Linux/macOS)

```bash
# Download and install the latest version
curl -L https://github.com/conan-io/conan/releases/latest/download/conan-linux-x86_64.tar.gz | tar xz
sudo mv conan*/bin/* /usr/local/bin/
sudo mv conan*/config/* ~/.conan/
```

### Method 4: From Source

For developers who want the latest features:

```bash
git clone https://github.com/conan-io/conan.git
cd conan
pip install -e .
```

## Initial Setup

### 1. Configure Your Profile

Conan needs to know about your development environment:

```bash
# Create a default profile based on your current system
conan profile detect

# This creates a profile with your current compiler and settings
```

### 2. Check Your Profile

```bash
# View your default profile
conan profile show -pr default

# This shows something like:
# Host profile:
# [settings]
# arch=x86_64
# build_type=Release
# compiler=gcc
# compiler.cppstd=gnu17
# compiler.libcxx=libstdc++11
# compiler.version=15
# os=Linux

# Build profile:
# [settings]
# arch=x86_64
# build_type=Release
# compiler=gcc
# compiler.cppstd=gnu17
# compiler.libcxx=libstdc++11
# compiler.version=15
# os=Linux
```

### 3. Test with a Simple Package

Let's verify everything works:

```bash
# Create a temporary directory
mkdir conan-test && cd conan-test

# Create a simple conanfile.txt
cat > conanfile.txt << EOF
[requires]
fmt/10.0.0

[generators]
CMakeDeps
CMakeToolchain
EOF

# Install the package
conan install .

# This should download and configure fmt library, if any
# issues occur please refer to the troubleshooting section.
# Run with --build=missing to build from source if binaries are not found.
```

### 4. Create a Test Project

```bash
# Create a simple C++ file
cat > main.cpp << EOF
#include <fmt/core.h>
#include <iostream>

int main() {
    fmt::print("Hello from Conan!\n");
    return 0;
}
EOF

# Create a CMakeLists.txt
cat > CMakeLists.txt << EOF
cmake_minimum_required(VERSION 3.15)
project(HelloConan)

find_package(fmt REQUIRED)

add_executable(hello main.cpp)
target_link_libraries(hello PRIVATE fmt::fmt)
EOF

# Build the project
mkdir build && cd build
cmake .. -DCMAKE_BUILD_TYPE=Release
cmake --build .
./hello
```

You should see "Hello from Conan!" - success!

## Configuration Files

Conan uses several configuration files:

### Global Configuration (~/.conan2/settings.yml)

Controls default settings for all projects:

```yaml
# ~/.conan2/settings.yml (auto-generated, don't edit manually)
# Defines available compilers, architectures, etc.
```

### Profile Files (~/.conan2/profiles/)

Your profiles are stored here:

```bash
# List all profiles
conan profile list

# Show profile details
conan profile show -pr default

# Create a custom profile
conan profile detect --name=myprofile # Based on current system

# Show custom profile
conan profile show -pr myprofile
```

### Project Configuration

Each project can have its own configuration:

```bash
# conan config install .   # Install configuration from URL/archive
# conan config home       # Show Conan home directory
```

## Environment Setup

### Set Up Your Development Environment

#### Windows

```powershell
# Add to your PATH if not done automatically
$env:PATH += ";C:\Users\$env:USERNAME\.local\bin"
```

#### macOS/Linux

```bash
# Add to ~/.bashrc or ~/.zshrc
export PATH="$HOME/.local/bin:$PATH"
```

### Compiler Setup

#### GCC on Linux

```bash
# Install GCC if needed
sudo apt update
sudo apt install build-essential

# Check version
gcc --version  # Should be 7+ for Conan 2.X
```

#### Clang on macOS

```bash
# Usually pre-installed with Xcode
clang++ --version
```

#### MSVC on Windows

```powershell
# Install Visual Studio 2022 with C++ Desktop Development
# Conan will auto-detect MSVC version
cl.exe  # Check if available
```

## Troubleshooting Common Issues

### Issue 1: "conan: command not found"

**Solution:** Add Conan to your PATH

```bash
# Find where Conan was installed
which conan  # Usually ~/.local/bin/conan
echo $PATH   # Make sure ~/.local/bin is in PATH
```

### Issue 2: "Compiler not found"

**Solution:** Install a C++ compiler

```bash
# Ubuntu/Debian
sudo apt install build-essential

# macOS
xcode-select --install

# Windows
# Install Visual Studio with C++ support
```

### Issue 3: "Permission denied"

**Solution:** Fix permissions

```bash
# Linux/macOS
chmod +x ~/.local/bin/conan

# Or run with sudo (not recommended)
sudo conan --version
```

### Issue 4: Python version issues

**Solution:** Use Python 3

```bash
# Make sure you're using Python 3
python3 --version  # Should be 3.7+
pip3 install conan
```

## Advanced Setup

### Multiple Compiler Versions

If you have multiple compilers installed:

```bash
# Create profiles for different compilers
conan profile detect --name=gcc11
conan profile show -pr gcc11 -s:h compiler.version=11

conan profile detect --name=clang14
conan profile show -pr clang14 -s:h compiler.version=14

# Use specific profile
conan install . -pr gcc11
```

### Custom Remotes

```bash
# Add a private remote
conan remote add mycompany https://artifactory.mycompany.com

# List all remotes
conan remote list

# Disable default remote for testing
conan remote disable conancenter
```

## Verification Checklist

- [ ] `conan --version` works
- [ ] `conan profile detect` completed successfully
- [ ] `conan profile show -pr default` shows your compiler
- [ ] Test project with `fmt` library compiled successfully
- [ ] You can build and run the hello world example

## Key Points: Installation and Setup

- **Multiple installation methods** - pip is recommended for most users
- **Profile detection** - Conan auto-detects your compiler and settings
- **Test with a simple package** - Always verify installation works
- **PATH configuration** - Make sure Conan is in your system PATH
- **Compiler requirements** - Conan 2.X needs modern compilers (GCC 7+, MSVC 2019+, Clang 10+)
