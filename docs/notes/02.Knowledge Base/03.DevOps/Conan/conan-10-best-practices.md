---
title: Best Practices and Workflows
createTime: 2025/12/22 22:21:19
permalink: /kb/devops/conan/best-practices/
---

# Best Practices and Workflows

Following industry best practices with Conan will make your C++ development more reliable, faster, and easier to maintain. Think of these as **professional habits** that separate amateur projects from enterprise-grade software.

## Project Structure Best Practices

### Recommended Directory Structure

```
my-awesome-project/
├── conanfile.py              # Main Conan configuration
├── conanfile.txt             # Alternative for simple projects
├── CMakeLists.txt            # Build system configuration
├── src/                      # Source code
│   ├── main.cpp
│   ├── lib/
│   │   ├── CMakeLists.txt
│   │   └── mylib/
│   │       ├── header.h
│   │       └── implementation.cpp
│   └── app/
│       ├── CMakeLists.txt
│       └── myapp.cpp
├── include/                  # Public headers (if library)
│   └── myproject/
│       └── public_header.h
├── tests/                    # Test files
│   ├── conanfile.py         # Test-specific dependencies
│   ├── test_main.cpp
│   └── CMakeLists.txt
├── docs/                     # Documentation
│   └── README.md
├── profiles/                 # Custom profiles (optional)
│   ├── development
│   ├── release
│   └── cross-arm
├── .github/                  # CI/CD workflows
│   └── workflows/
│       └── ci.yml
├── .gitignore
├── LICENSE
└── README.md
```

### File Naming Conventions

```python
# Good naming patterns

# conanfile.py - Main project configuration
class MyAwesomeProjectConan(ConanFile):
    name = "myawesomeproject"    # Lowercase with underscores
    version = "1.0.0"            # Semantic versioning

# NOT:
# class MyAwesomeProjectConan(ConanFile):
#     name = "MyAwesomeProject"  # Avoid spaces and capitals

# Version examples
# Good: "1.0.0", "2.1.3", "1.0.0-beta"
# Bad: "v1.0", "final", "latest"
```

## Conanfile.py Best Practices

### Keep It Simple and Maintainable

**Good: Simple and Clear**

```python
from conan import ConanFile
from conan.tools.cmake import CMake, CMakeToolchain, CMakeDeps, cmake_layout

class MyProjectConan(ConanFile):
    name = "myproject"
    version = "1.0.0"
    license = "MIT"
    author = "Your Name <your.email@company.com>"
    description = "A great C++ project"
    topics = ("cpp", "networking", "async")

    settings = "os", "compiler", "build_type", "arch"
    options = {
        "shared": [True, False],
        "fPIC": [True, False],
        "enable_logging": [True, False],
    }
    default_options = {
        "shared": False,
        "fPIC": True,
        "enable_logging": True,
    }

    requires = ("fmt/10.0.0",)

    def configure(self):
        if self.options.shared:
            self.options.fPIC = False

    def layout(self):
        cmake_layout(self)

    def generate(self):
        tc = CMakeToolchain(self)
        tc.variables["MYPROJECT_VERSION"] = self.version
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

**Bad: Over-Complex**

```python
# Too many options, complex logic
class MyProjectConan(ConanFile):
    options = {
        "shared": [True, False],
        "static": [True, False],      # Redundant with shared
        "debug": [True, False],       # Build type handles this
        "optimization_level": [0, 1, 2, 3],  # Should be in settings
        "compiler_vendor": ["gcc", "clang", "msvc"],  # Should be in settings
        "custom_flag_1": [True, False],  # Unnecessary complexity
        "custom_flag_2": [True, False],
        "custom_flag_3": [True, False],
        # ... 20 more options
    }
```

### Dependency Management Best Practices

#### Minimal Dependencies

```python
# Good: Only what you really need
class SimpleProjectConan(ConanFile):
    requires = ("fmt/10.0.0",)  # One dependency

# Bad: Too many dependencies
class ComplexProjectConan(ConanFile):
    requires = (  # Do you really need all of these?
        "boost/1.81.0",        # Heavy dependency
        "eigen/3.4.0",         # If you use only basic linear algebra
        "opencv/4.8.0",        # If you only need basic image I/O
        "qt/6.4.0",            # If you're not building a GUI
        "sqlite/3.42.0",       # If you only need simple data storage
        # ... and 20 more
    )
```

#### Version Management

```python
# Good: Reasonable version ranges
class WellVersionedConan(ConanFile):
    requires = (
        "fmt/[>=10.0.0 <11.0.0]",    # Allow bug fixes
        "openssl/3.*",                # Allow new features
        "spdlog/1.11.0",              # Specific version (OK for stability)
    )

# Bad: Too restrictive or too broad
class PoorlyVersionedConan(ConanFile):
    requires = (
        "fmt/10.0.0",         # Too restrictive - breaks on bug fixes
        "openssl/>0.0.0",     # Too broad - could break compatibility
    )
```

#### Dependency Documentation

```python
class WellDocumentedConan(ConanFile):
    """
    MyProject - A high-performance networking library

    This package provides asynchronous network communication with:
    - TCP/UDP socket support
    - SSL/TLS encryption
    - HTTP/HTTPS protocols
    - Cross-platform compatibility

    Dependencies:
    - fmt: Text formatting and logging (required)
    - openssl: SSL/TLS encryption (required)
    - spdlog: High-performance logging (optional, see enable_logging)

    Example:
        from conan import ConanFile
        class MyProjectConan(ConanFile):
            requires = ("myproject/1.0.0",)

        # Use in CMake:
        find_package(myproject REQUIRED)
        target_link_libraries(myapp PRIVATE myproject::myproject)
    """

    # ... rest of the configuration
```

## Profile Management Best Practices

### Organized Profile Naming

```bash
# Good: Descriptive and organized
conan profile new dev-gcc11-debug
conan profile new rel-gcc11-release-optimized
conan profile new rel-msvc2022-release
conan profile new cross-arm-debug
conan profile new ci-linux-gcc11-release

# Bad: Unclear names
conan profile new profile1
conan profile new debug
conan profile new linux
conan profile new new-profile
```

### Profile Documentation

```ini
# dev-gcc11-debug.profile
# Development profile for GCC 11, Debug builds
# Usage: conan install . --profile=dev-gcc11-debug
# Purpose: Local development with debug symbols and sanitizers

[settings]
os=Linux
arch=x86_64
compiler=gcc
compiler.version=11
compiler.libcxx=libstdc++11
compiler.cppstd=17
build_type=Debug

[options]
*:shared=False  # Static linking for easier debugging

[tool_requires]
cmake/3.27.0

[env]
CFLAGS=-g -O0 -fsanitize=address -fsanitize=leak
CXXFLAGS=-g -O0 -fsanitize=address -fsanitize=leak -DDEBUG

[conf]
# Keep build directories for debugging
tools.cmake.cmake_layout:build_folder_vars=['settings']
```

### Team Profile Sharing

```bash
# Store profiles in version control
mkdir profiles
cp ~/.conan2/profiles/* profiles/
git add profiles/
git commit -m "Add Conan profiles"

# Team members can import
cp profiles/* ~/.conan2/profiles/
conan profile list  # See shared profiles
```

## Build Optimization Best Practices

### Fast Builds

#### Use sstate Cache

```bash
# Configure sstate cache location
export CONAN_USER_HOME=/path/to/fast/ssd/.conan2

# In profile:
[conf]
# Share sstate cache across projects
tools.cmake.cmake_layout:build_folder_vars=['settings']
```

#### Parallel Builds

```bash
# In profile:
[env]
MAKEFLAGS=-j8
CMAKE_BUILD_PARALLEL_LEVEL=8

[conf]
# Use all CPU cores
tools.cmake.cmaketools:parallel=True
```

#### Incremental Builds

```bash
# Only rebuild what changed
conan install . --build=missing  # Don't rebuild existing packages
conan install . --build=outdated  # Rebuild outdated packages only
```

### Binary Cache Management

```bash
# Set up binary cache in fast storage
export CONAN_USER_HOME=/fast/ssd/.conan2

# Use binary cache for multiple projects
[conf]
# Cache location
tools.cmake.cmake_layout:cache_folder=/fast/ssd/conan-cache

# Build policy
tools.cmake.cmake_layout:build_folder_vars=['settings']
```

## CI/CD Integration Best Practices

### Jenkins Pipeline Example

```groovy
// Jenkinsfile
pipeline {
    agent any

    environment {
        CONAN_USER_HOME = "${WORKSPACE}/.conan2"
        PYTHONUNBUFFERED = "1"
    }

    stages {
        stage("Setup") {
            steps {
                script {
                    // Install Conan
                    sh "pip install conan"

                    // Detect/create Conan profile
                    sh "conan profile detect --force"
                }
            }
        }

        stage("Install Dependencies") {
            steps {
                script {
                    // Install dependencies for different configurations
                    def configs = [
                        [name: "Linux GCC11 Debug", profile: "linux-gcc11-debug"],
                        [name: "Linux GCC11 Release", profile: "linux-gcc11-release"],
                        [name: "Linux Clang14 Debug", profile: "linux-clang14-debug"]
                    ]

                    parallel configs.collect { config ->
                        "${config.name}": {
                            sh "conan install . --profile=${config.profile} --build=missing"
                        }
                    }
                }
            }
        }

        stage("Build") {
            steps {
                script {
                    sh "conan build ."
                }
            }
        }

        stage("Test") {
            steps {
                script {
                    sh "cd build/Release && ./myproject_tests"
                }
            }
        }

        stage("Package") {
            steps {
                script {
                    // Create and upload package
                    sh "conan create . myproject/1.0.0@user/stable"
                    sh "conan upload myproject/1.0.0@user/stable --remote=mycompany-remote --all"
                }
            }
        }
    }

    post {
        always {
            // Clean up build artifacts
            sh "rm -rf build/"
        }

        success {
            echo "Pipeline completed successfully!"
        }

        failure {
            echo "Pipeline failed. Check logs for details."
        }
    }
}
```

### Docker-Based CI

```dockerfile
# Dockerfile.ci
FROM ubuntu:22.04

# Install build tools
RUN apt-get update && apt-get install -y \
    build-essential \
    cmake \
    git \
    python3 \
    python3-pip \
    && rm -rf /var/lib/apt/lists/*

# Install Conan
RUN pip3 install conan

# Set up working directory
WORKDIR /workspace

# Default command
CMD ["bash"]
```

```yaml
# docker-compose.ci.yml
version: "3.8"
services:
  ci:
    build:
      context: .
      dockerfile: Dockerfile.ci
    volumes:
      - .:/workspace
    environment:
      - CONAN_USER_HOME=/root/.conan2
```

## Security Best Practices

### Dependency Security

#### Regular Dependency Updates

```bash
# Check for outdated dependencies
conan install . --build=outdated

# Update specific packages
conan install . --build=outdated --requires=openssl/3.0.8
```

#### Vulnerability Scanning

```python
# Check for known vulnerabilities in dependencies
class SecureProjectConan(ConanFile):
    # Only use well-maintained packages
    requires = (
        "openssl/3.0.8",         # Well-maintained, frequent security updates
        "fmt/10.0.0",            # Active development and security fixes
    )

    # Avoid packages with known vulnerabilities
    # NOT: "old-package/1.0.0"  # If it has known security issues
```

#### Supply Chain Security

```python
# Verify package sources
class SecureProjectConan(ConanFile):
    def source(self):
        # Use HTTPS URLs
        get(self, "https://github.com/fmtlib/fmt/archive/refs/tags/10.0.0.tar.gz")

        # Verify checksums if available
        # download(self, "https://example.com/file.tar.gz", sha256="expected_checksum")
```

### Authentication Best Practices

```bash
# Use tokens instead of passwords
conan remote auth mycompany --username=$CONAN_USERNAME --password=$CONAN_TOKEN

# Environment-based authentication
export CONAN_USERNAME=your_username
export CONAN_PASSWORD=your_token_here

# Don't hardcode credentials
# BAD: conan remote auth myremote --username=admin --password=secret123
```

## Testing Best Practices

### Package Testing

```python
class MyProjectConan(ConanFile):
    # Enable testing
    test_type = "explicit"

    def build_requirements(self):
        # Testing framework
        self.test_requires("gtest/1.13.0")

    def build(self):
        # Build main library
        super().build()

        # Build and run tests
        self.run("cd tests && make test")

        # Or use test_package
        cmake = CMake(self)
        cmake.configure(source_folder="test_package")
        cmake.build()
        cmake.test()  # Run ctest
```

### Continuous Testing

```bash
# Test packages before publishing
conan create . myproject/1.0.0@user/testing
conan test test_package myproject/1.0.0@user/testing

# Test with different configurations
conan create . myproject/1.0.0@user/testing --profile=dev-debug
conan create . myproject/1.0.0@user/testing --profile=rel-release
```

## Documentation Best Practices

### README Structure

````markdown
# MyProject

A high-performance C++ networking library.

## Features

- Asynchronous I/O
- SSL/TLS support
- Cross-platform compatibility
- Zero-copy operations

## Quick Start

### Using Conan

1. Add dependency to your `conanfile.py`:

```python
class YourProjectConan(ConanFile):
    requires = ("myproject/1.0.0",)
```
````

2. Use in CMake:

```cmake
find_package(myproject REQUIRED)
target_link_libraries(your_app PRIVATE myproject::myproject)
```

## Installation

### Conan (Recommended)

```bash
conan install . --build=missing
```

### Build from Source

```bash
git clone https://github.com/yourorg/myproject.git
cd myproject
conan create . myproject/1.0.0@user/stable
```

## Documentation

- API Reference
- Examples
- Contributing

## Requirements

- C++17 or later
- CMake 3.15 or later
- Conan 2.x

## License

MIT License - see LICENSE file.

````

## Version Control Best Practices

### .gitignore Configuration

```gitignore
# Conan build artifacts
build/
generated/
conanbuildinfo.cmake
conanbuildinfo.txt

# Conan cache (can be shared)
# ~/.conan2/  # Usually in .gitignore

# IDE files
.vscode/
.idea/
*.swp
*.swo
*~

# OS files
.DS_Store
Thumbs.db

# Package files
*.tar.gz
*.zip
````

### Version Management

```python
# Dynamic version from git
class MyProjectConan(ConanFile):
    version = "1.0.0"  # Or derive from git tags

    def source(self):
        # Get version from git
        self.output.info(f"Building version: {self.version}")
```

## Performance Best Practices

### Build Time Optimization

```bash
# Use pre-built binaries when possible
conan install . --build=missing  # Don't rebuild existing packages

# Parallel operations
conan install . --build=missing -j8

# Fast storage for build cache
export CONAN_USER_HOME=/fast/ssd/.conan2
```

### Memory Optimization

```bash
# Limit parallel builds
[env]
MAKEFLAGS=-j4  # Don't use all cores

[conf]
# Limit concurrent downloads
tools.cmake.cmake_layout:parallel_limit=4
```

## Key Points: Best Practices

- **Keep it simple** - Don't over-complicate your conanfile.py
- **Document everything** - Clear documentation saves time later
- **Use version ranges** - Allow flexibility while maintaining stability
- **Organize profiles** - Descriptive names and documentation
- **Security first** - Regular updates and secure authentication
- **Test thoroughly** - Test with multiple configurations and platforms
- **CI/CD integration** - Automate testing and building
- **Performance matters** - Optimize for faster builds and development
