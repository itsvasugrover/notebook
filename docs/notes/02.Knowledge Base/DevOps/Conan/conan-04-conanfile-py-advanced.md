---
title: Conanfile.py Advanced Features
createTime: 2025/12/22 22:21:19
permalink: /kb/devops/conan/conanfile-py-advanced/
---

# Conanfile.py Advanced Features

Now that you know the basics, let's explore the powerful advanced features that make Conan 2.X incredibly flexible for complex C++ projects.

## Advanced Configuration

### Environment Variables

```python
from conan import ConanFile
from conan.tools.env import Environment

class AdvancedProjectConan(ConanFile):
    name = "advancedproject"
    version = "1.0.0"

    def generate(self):
        """Set up environment variables for build"""

        env = Environment()

        # Define environment variables
        env.define("MY_LIB_PATH", "/custom/lib/path")
        env.define("EXTRA_CXXFLAGS", "-DMY_FEATURE_ENABLED")
        env.prepend("PATH", "/custom/bin")
        env.prepend("LD_LIBRARY_PATH", "/custom/lib")

        # Save environment to a script file
        env.vars(self).save_script("myproject_env")
```

### Custom Options with Validation

```python
class AdvancedProjectConan(ConanFile):
    name = "advancedproject"
    version = "1.0.0"

    options = {
        "shared": [True, False],
        "fPIC": [True, False],
        "std": ["c++11", "c++14", "c++17", "c++20"],
        "optimization": ["none", "speed", "size", "debug"],
        "crypto_backend": ["openssl", "mbedtls", "custom"],
    }

    default_options = {
        "shared": False,
        "fPIC": True,
        "std": "c++17",
        "optimization": "speed",
        "crypto_backend": "openssl",
    }

    def configure(self):
        """Validate and configure options"""

        # Ensure compatible options
        if self.options.shared:
            self.options.fPIC = False

        # Validate crypto backend
        if self.options.crypto_backend == "custom":
            # Custom backend needs additional configuration
            if not hasattr(self, "custom_crypto_path"):
                raise ConanException("custom_crypto_path must be specified for custom backend")
```

### Advanced Source Handling

```python
from conan.tools.files import download, unzip, replace_in_file, get
from conan.tools.scm import Version

class AdvancedProjectConan(ConanFile):
    name = "advancedproject"
    version = "1.0.0"

    def source(self):
        """Advanced source code handling"""

        # Download from URL
        download(self,
                "https://example.com/source.tar.gz",
                "source.tar.gz")

        # Download specific version from Git
        get(self,
            "https://github.com/user/repo/archive/refs/tags/v1.0.0.tar.gz",
            destination=".")

        # Download with authentication (advanced)
        # download(self,
        #         "https://private.repo.com/source.zip",
        #         "source.zip",
        #         auth=(username, password))

        # Handle patches
        # patch_file = os.path.join(self.recipe_folder, "patches", "fix_compilation.patch")
        # replace_in_file(self, os.path.join(self.source_folder, "CMakeLists.txt"),
        #                "add_library(mylib", "add_library(mylib SHARED")

    def export_sources(self):
        """Export sources for consumers"""

        # Copy source files to package for consumers
        copy(self, "*.h", self.source_folder,
             self.export_sources_folder, keep_path=True)
        copy(self, "*.cpp", self.source_folder,
             self.export_sources_folder, keep_path=True)
        copy(self, "CMakeLists.txt", self.source_folder,
             self.export_sources_folder, keep_path=False)
```

## Build System Integration

### Advanced CMake Integration

```python
from conan.tools.cmake import CMake, CMakeToolchain, CMakeDeps
from conan.tools.cmake import cmake_layout

class AdvancedCMakeConan(ConanFile):
    name = "advancedcmake"
    version = "1.0.0"

    # Define source and build layout
    settings = "os", "compiler", "build_type", "arch"
    options = {"shared": [True, False], "fPIC": [True, False]}
    default_options = {"shared": False, "fPIC": True}

    requires = (
        "fmt/10.0.0",
        "spdlog/1.11.0",
    )

    def layout(self):
        """Define project layout"""
        cmake_layout(self)

    def generate(self):
        """Generate CMake configuration"""

        # Get CMakeToolchain and customize it
        tc = CMakeToolchain(self)

        # Set custom CMake variables
        tc.variables["MYPROJECT_VERSION"] = self.version
        tc.variables["BUILD_SHARED_LIBS"] = self.options.shared
        tc.variables["MYPROJECT_ENABLE_LOGGING"] = True
        tc.variables["CMAKE_CXX_STANDARD"] = "17"
        tc.variables["CMAKE_CXX_STANDARD_REQUIRED"] = "ON"

        # Set custom compile definitions
        tc.preprocessor_definitions["MYPROJECT_VERSION"] = f'"{self.version}"'
        tc.preprocessor_definitions["MYPROJECT_DEBUG"] = "1" if self.settings.build_type == "Debug" else "0"

        # Generate the toolchain
        tc.generate()

        # Generate dependency information
        deps = CMakeDeps(self)
        deps.generate()

    def build(self):
        """Build the project"""

        cmake = CMake(self)
        cmake.configure()
        cmake.build()

        # Or run custom build commands
        # self.run("make -j4")
        # self.run("cmake --build . --config Release")

    def package(self):
        """Package the built artifacts"""

        # Copy headers
        copy(self, "include/**/*.h",
             self.source_folder,
             self.package_folder, keep_path=True)

        # Copy libraries
        if self.options.shared:
            copy(self, "*.so", self.build_folder,
                 self.package_folder, keep_path=False)
            copy(self, "*.dll", self.build_folder,
                 self.package_folder, keep_path=False)
        else:
            copy(self, "*.a", self.build_folder,
                 self.package_folder, keep_path=False)
            copy(self, "*.lib", self.build_folder,
                 self.package_folder, keep_path=False)

        # Copy license
        copy(self, "LICENSE*",
             self.source_folder,
             self.package_folder, keep_path=False)
```

### Multiple Build Systems Support

```python
from conan.tools.gnu import AutotoolsToolchain, AutotoolsDeps, Autotools
from conan.tools.microsoft import MSBuild, MSBuildToolchain
from conan.tools.build import cmd_args_to_string

class MultiBuildConan(ConanFile):
    name = "multibuild"
    version = "1.0.0"

    def generate(self):
        """Generate build system files based on settings"""

        if self.settings.os == "Windows":
            # Generate MSBuild files
            tc = MSBuildToolchain(self)
            tc.generate()
        else:
            # Generate Autotools files
            tc = AutotoolsToolchain(self)
            tc.generate()

    def build(self):
        """Build using appropriate build system"""

        if self.settings.os == "Windows":
            # Build with MSBuild
            msbuild = MSBuild(self)
            msbuild.build("project.sln")
        else:
            # Build with Autotools/Make
            autotools = Autotools(self)
            autotools.make()
```

## Advanced Package Information

### Custom Package Information

```python
class AdvancedPackageConan(ConanFile):
    name = "advancedpackage"
    version = "1.0.0"

    def package_info(self):
        """Configure package information for consumers"""

        # Basic library information
        self.cpp_info.libs = ["myproject"]

        # Include directories
        self.cpp_info.includedirs = ["include"]

        # Library directories
        self.cpp_info.libdirs = ["lib"]

        # Binary directories (executables)
        self.cpp_info.bindirs = ["bin"]

        # System libraries needed
        self.cpp_info.system_libs = ["pthread", "dl"]

        # Framework dependencies (macOS)
        self.cpp_info.frameworks = ["CoreFoundation", "Security"]

        # Compiler definitions
        self.cpp_info.defines = ["MYPROJECT_EXPORTS"]

        # Additional requirements
        self.cpp_info.requires = ["fmt::fmt", "openssl::openssl"]

    def package_id(self):
        """Customize how the package ID is computed"""

        # Make package ID independent of build type
        self.info.settings.build_type = "Any"

        # Or make it depend on specific options only
        if self.options.shared:
            self.info.options["shared"] = "Any"
```

### Component-Based Packages

```python
class MultiComponentConan(ConanFile):
    name = "multicomponent"
    version = "1.0.0"

    def package_info(self):
        """Define multiple components within the package"""

        # Core library
        self.cpp_info.components["core"].libs = ["myproject-core"]
        self.cpp_info.components["core"].requires = ["fmt::fmt"]

        # Network module
        self.cpp_info.components["network"].libs = ["myproject-network"]
        self.cpp_info.components["network"].requires = ["openssl::openssl", "core"]

        # Database module
        self.cpp_info.components["database"].libs = ["myproject-database"]
        self.cpp_info.components["database"].requires = ["sqlite3::sqlite3", "core"]

        # CLI tool
        self.cpp_info.components["cli"].bindirs = ["bin"]
        self.cpp_info.components["cli"].requires = ["core", "network", "database"]
```

## Advanced Testing

### Package Testing

```python
class AdvancedProjectConan(ConanFile):
    name = "advancedproject"
    version = "1.0.0"

    # Enable testing
    test_type = "explicit"

    def build_requirements(self):
        """Build requirements for testing"""
        self.test_requires("gtest/1.13.0")
        self.tool_requires("cmake/3.27.0")

    def build(self):
        """Build and run tests"""

        # Build the library
        super().build()

        # Create and build test project
        test_src = os.path.join(self.source_folder, "tests")
        test_build = os.path.join(self.build_folder, "tests_build")

        os.makedirs(test_build, exist_ok=True)

        # Configure tests
        self.run(f"cmake -S {test_src} -B {test_build}")

        # Build tests
        self.run(f"cmake --build {test_build}")

        # Run tests
        self.run(f"{test_build}/myproject_tests")
```

## Advanced Dependency Management

### Version Range Management

```python
class AdvancedDepConan(ConanFile):
    name = "advanceddep"
    version = "1.0.0"

    # Use version ranges for flexibility
    requires = (
        "fmt/[>=10.0.0 <11.0.0]",      # Any 10.x version
        "openssl/3.*",                  # Any 3.x version
        "spdlog/1.11.0",                # Exact version
        "boost/[>=1.70.0 && <2.0.0]",   # Complex range
    )

    def configure(self):
        """Configure dependencies based on requirements"""

        # Get references to dependencies
        fmt_ref = self.dependencies["fmt"].ref
        openssl_ref = self.dependencies["openssl"].ref

        print(f"Using fmt: {fmt_ref}")
        print(f"Using openssl: {openssl_ref}")

        # Set options based on dependency versions
        if fmt_ref >= "10.1.0":
            self.options["fmt"].header_only = True
```

### Custom Dependency Injection

```python
class CustomDepConan(ConanFile):
    name = "customdep"
    version = "1.0.0"

    def configure(self):
        """Inject custom dependencies"""

        # Create a custom dependency
        if not self.dependencies.get("mycustomlib"):
            # This would require implementing a custom dependency provider
            pass

    def package_id(self):
        """Modify package ID based on dependencies"""

        # Remove dependency versions from package ID for ABI compatibility
        for req in self.requires.values():
            req.package_id_mode = "minor_mode"  # or "major_mode", "patch_mode"
```

## Key Points: Advanced Features

- **Environment management** - Full control over build and runtime environments
- **Multiple build systems** - CMake, Autotools, MSBuild support
- **Component packages** - Split packages into logical components
- **Version ranges** - Flexible dependency versioning
- **Advanced testing** - Built-in testing with test packages
- **Custom package info** - Fine-grained control over how consumers use your package
