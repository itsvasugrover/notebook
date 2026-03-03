---
title: Dependency Management
createTime: 2025/12/22 22:21:19
permalink: /kb/devops/conan/dependency-management/
---

# Dependency Management

Conan's dependency management system is like a smart **dependency detective** - it automatically figures out what libraries your project needs, downloads them with all their dependencies, and ensures everything works together perfectly.

## Understanding Dependencies

### What is a Dependency?

A **dependency** is a library or package that your project needs to compile and run. Think of it like ingredients in a recipe:

```python
# Your project (the main dish)
class MyProjectConan(ConanFile):
    # Dependencies (ingredients)
    requires = (
        "fmt/10.0.0",        # For beautiful text formatting
        "openssl/3.0.8",     # For security/encryption
        "spdlog/1.11.0",     # For logging
    )
```

### Types of Dependencies

#### 1. Build Dependencies (`requires`)

```python
class MyProjectConan(ConanFile):
    # Libraries needed to USE your package (runtime dependencies)
    requires = (
        "fmt/10.0.0",        # Formatting library
        "openssl/3.0.8",     # Encryption library
    )
```

#### 2. Tool Dependencies (`tool_requires`)

```python
class MyProjectConan(ConanFile):
    # Tools needed to BUILD your package (compile-time dependencies)
    tool_requires = (
        "cmake/3.27.0",      # Build system generator
        "ninja/1.11.1",      # Fast build tool
        "doxygen/1.9.6",     # Documentation generator
    )
```

#### 3. Test Dependencies (`test_requires`)

```python
class MyProjectConan(ConanFile):
    # Tools needed only for testing (not in final package)
    test_requires = (
        "gtest/1.13.0",      # Testing framework
        "benchmark/1.8.0",   # Performance testing
    )
```

## How Conan Resolves Dependencies

### The Dependency Resolution Process

1. **Parse Requirements** - Read your `conanfile.py` to see what you need
2. **Search Remotes** - Look for packages in configured remotes
3. **Resolve Dependencies** - Find all transitive dependencies
4. **Check Compatibility** - Ensure all packages work together
5. **Download/Build** - Get or build the packages
6. **Generate Build Files** - Create CMake/other build system files

### Example Dependency Tree

```
MyApp (your project)
├── fmt/10.0.0
│   └── (no dependencies)
├── openssl/3.0.8
│   ├── zlib/1.2.13
│   └── (some platform-specific dependencies)
└── spdlog/1.11.0
    └── fmt/10.0.0  (already included!)
```

Conan is smart enough to:

- **Share dependencies** - Only download `fmt` once, even if multiple packages need it
- **Resolve conflicts** - If different packages need different versions, Conan helps resolve it
- **Optimize builds** - Build only what's needed

## Version Specification

### Exact Versions

```python
class MyProjectConan(ConanFile):
    # Use specific version (most common)
    requires = (
        "fmt/10.0.0",        # Exactly version 10.0.0
        "openssl/3.0.8",     # Exactly version 3.0.8
    )
```

### Version Ranges

```python
class MyProjectConan(ConanFile):
    # Flexible versioning
    requires = (
        "fmt/[>=10.0.0 <11.0.0]",    # Any 10.x version
        "openssl/3.*",                # Any 3.x version
        "spdlog/1.11.0",              # Exact version (fallback)
    )
```

### Version Range Operators

| Operator | Meaning               | Example                         |
| -------- | --------------------- | ------------------------------- |
| `>`      | Greater than          | `openssl/>3.0.0`                |
| `<`      | Less than             | `fmt/<11.0.0`                   |
| `>=`     | Greater than or equal | `boost/>=1.70.0`                |
| `<=`     | Less than or equal    | `zlib/<=1.3.0`                  |
| `==`     | Equal to              | `cmake/==3.27.0`                |
| `*`      | Wildcard              | `boost/1.8*` (1.80, 1.81, etc.) |
| `&&`     | AND condition         | `boost/[>=1.70.0 && <2.0.0]`    |

## Advanced Dependency Features

### Conditional Dependencies

```python
class MyProjectConan(ConanFile):
    options = {
        "use_openssl": [True, False],
        "enable_logging": [True, False],
    }

    default_options = {
        "use_openssl": True,
        "enable_logging": True,
    }

    def configure(self):
        """Configure dependencies based on options"""

        requires = ["fmt/10.0.0"]

        if self.options.use_openssl:
            requires.append("openssl/3.0.8")

        if self.options.enable_logging:
            requires.append("spdlog/1.11.0")

        self.requires = tuple(requires)
```

### Optional Dependencies

```python
class MyProjectConan(ConanFile):
    # Required dependencies
    requires = ("fmt/10.0.0",)

    # Optional dependencies
    def requirements(self):
        if self.options.enable_benchmarking:
            self.requires("benchmark/1.8.0")

        if self.options.enable_profiling:
            self.requires("google-perftools/2.10.0")
```

### Development Dependencies

```python
class MyProjectConan(ConanFile):
    # Regular dependencies
    requires = ("fmt/10.0.0", "openssl/3.0.8")

    # Build-time dependencies
    build_requires = (
        "cmake/3.27.0",
        "doxygen/1.9.6",
    )

    # Test dependencies (for package testing)
    test_build_requires = (
        "gtest/1.13.0",
    )
```

## Dependency Conflict Resolution

### When Dependencies Clash

Sometimes different packages need different versions of the same library:

```python
# Package A needs OpenSSL 1.1
# Package B needs OpenSSL 3.0
# Your project needs both A and B

class MyProjectConan(ConanFile):
    requires = (
        "package-a/1.0.0",  # Depends on openssl/1.1.1
        "package-b/2.0.0",  # Depends on openssl/3.0.8
    )
```

### Resolution Strategies

#### 1. Version Override (Force a Version)

```python
class MyProjectConan(ConanFile):
    requires = (
        "package-a/1.0.0",
        "package-b/2.0.0",
        ("openssl/3.0.8", "override"),  # Force OpenSSL 3.0
    )

    def configure(self):
        # Both packages will use OpenSSL 3.0
        # This works if both packages are compatible with OpenSSL 3.0
```

#### 2. Conflict Detection and Warnings

```bash
# Conan will warn about conflicts
# Example output:
# Warning: Package 'package-a/1.0.0' requires 'openssl/1.1.1' but your project
# is trying to use 'openssl/3.0.8'. This might cause ABI incompatibilities.
```

#### 3. Multiple Version Handling

```python
class MyProjectConan(ConanFile):
    # Allow multiple versions (advanced)
    def configure(self):
        # This requires careful handling in your code
        pass
```

## Dependency Graph Analysis

### Visualizing Dependencies

```bash
# Show dependency tree
conan install . --print=graph

# Save dependency graph to file
conan install . --print=graph=graph.txt

# Generate dependency graph in DOT format
conan install . --print=graph_dot=deps.dot
```

### Analyzing Dependencies

```bash
# Show package information
conan info .

# Show only direct dependencies
conan info . --only=requires

# Show build-time dependencies
conan info . --only=build_requires

# Show detailed dependency information
conan info . --json=info.json
```

## Transitive Dependencies

### Understanding Transitive Dependencies

Dependencies often depend on other dependencies:

```
MyApp
├── fmt/10.0.0
│   └── (no dependencies)
├── openssl/3.0.8
│   └── zlib/1.2.13        # Transitive dependency
└── boost/1.81.0
    ├── zlib/1.2.13        # Same transitive dependency (shared!)
    ├── bzip2/1.0.8        # Another transitive dependency
    └── (many more...)
```

### Managing Transitive Dependencies

#### Option 1: Default (Automatic)

Conan automatically handles transitive dependencies:

```python
class MyProjectConan(ConanFile):
    requires = ("boost/1.81.0",)
    # Conan automatically includes zlib, bzip2, etc.
```

#### Option 2: Explicit Transitive Dependencies

```python
class MyProjectConan(ConanFile):
    requires = (
        "boost/1.81.0",
        "zlib/1.2.13",  # Explicitly include
    )
    # This is useful when you need to control versions
```

#### Option 3: Disable Transitive Dependencies

```python
class MyProjectConan(ConanFile):
    def configure(self):
        # Remove transitive dependencies
        if self.dependencies.get("boost"):
            self.dependencies["boost"].requires.clear()
```

## Package Information Access

### Accessing Dependency Information

```python
class MyProjectConan(ConanFile):
    requires = ("fmt/10.0.0", "openssl/3.0.8")

    def generate(self):
        # Access dependency information
        fmt_dep = self.dependencies["fmt"]
        openssl_dep = self.dependencies["openssl"]

        # Get version
        fmt_version = fmt_dep.ref.version
        openssl_version = openssl_dep.ref.version

        # Get settings
        fmt_build_type = fmt_dep.settings.get_safe("build_type")
        openssl_os = openssl_dep.settings.get_safe("os")

        # Get package paths
        fmt_include = fmt_dep.cpp_info.includedirs
        openssl_libs = openssl_dep.cpp_info.libs

        print(f"Using fmt {fmt_version} with build_type={fmt_build_type}")
        print(f"Using openssl {openssl_version} on {openssl_os}")
```

### Conditional Logic Based on Dependencies

```python
class MyProjectConan(ConanFile):
    requires = ("fmt/10.0.0",)

    def generate(self):
        # Check if specific dependency exists
        if self.dependencies.get("fmt"):
            fmt = self.dependencies["fmt"]

            # Check dependency version
            if fmt.ref >= "10.1.0":
                # Use new feature
                pass

            # Check dependency options
            if fmt.options.get_safe("header_only"):
                # Handle header-only library
                pass
```

## Best Practices for Dependency Management

### 1. Minimize Dependencies

```python
# Good: Minimal dependencies
class GoodProjectConan(ConanFile):
    requires = ("fmt/10.0.0",)  # Only what you really need

# Bad: Too many dependencies
class BadProjectConan(ConanFile):
    requires = (  # You probably don't need all of these
        "boost/1.81.0",  # Heavy dependency
        "eigen/3.4.0",   # Math library
        "opencv/4.8.0",  # Computer vision
        "qt/6.4.0",      # GUI framework
        # ... 50 more dependencies
    )
```

### 2. Use Version Ranges Carefully

```python
# Good: Reasonably flexible ranges
requires = (
    "fmt/[>=10.0.0 <11.0.0]",  # Allow patch updates
    "openssl/3.*",              # Allow minor updates
)

# Bad: Too restrictive or too broad
requires = (
    "fmt/10.0.0",        # Too restrictive
    "openssl/>0.0.0",    # Too broad - could break
)
```

### 3. Document Dependencies

```python
class DocumentedProjectConan(ConanFile):
    """
    MyProject - A C++ networking library

    Dependencies:
    - fmt: Text formatting (required)
    - openssl: TLS/SSL support (required)
    - spdlog: Logging (optional, see enable_logging option)
    """

    requires = ("fmt/10.0.0", "openssl/3.0.8")
```

### 4. Test Dependency Compatibility

```python
class TestedProjectConan(ConanFile):
    def build(self):
        # Test that all dependencies work together
        # Build a small test program that uses all dependencies
        test_code = """
        #include <fmt/core.h>
        #include <openssl/ssl.h>
        #include <spdlog/spdlog.h>

        int main() {
            fmt::print("All dependencies work!\\n");
            return 0;
        }
        """
        # Compile and run test...
```

## Key Points: Dependency Management

- **Three types of dependencies** - `requires`, `tool_requires`, `test_requires`
- **Version specification** - Exact versions, ranges, wildcards
- **Automatic resolution** - Conan handles transitive dependencies
- **Conflict resolution** - Version overrides and warnings
- **Conditional dependencies** - Based on options and settings
- **Graph analysis** - Visualize and understand dependency relationships
- **Best practices** - Minimize dependencies, use reasonable version ranges
