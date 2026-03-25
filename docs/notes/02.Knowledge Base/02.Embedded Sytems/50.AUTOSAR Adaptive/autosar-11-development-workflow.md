---
title: Development Workflow
createTime: 2026/03/25 00:00:00
permalink: /kb/embedded/autosar/development-workflow/
---

# Development Workflow

## Overview: From ARXML to Deployed Binary

AUTOSAR Adaptive development follows a toolchain-driven workflow where service interfaces are defined in ARXML, code is generated from these definitions, and applications are compiled, tested, packaged, and deployed via OTA.

```
                    AUTOSAR Adaptive Development Flow
─────────────────────────────────────────────────────────────────────────────

  [1] System Design
      ServiceInterface ARXML  ──────────────────────────────────────────┐
      Application Manifest                                              │
      (Vector SystemDesk / Eclipse AUTOSAR Builder)                     │
                                                                        │
  [2] Code Generation                                                   │
      ARXML → ara::com Generator → PerceptionService_skeleton.h         │
                                   PerceptionService_proxy.h            │
                                   PerceptionService_types.h            │
                                                                        │
  [3] Application Development                                           │
      Developer writes:                                                 │
      ├── radar_processing.cpp (implements Skeleton)                    │
      ├── path_planning.cpp (uses Proxy)                                │
      └── CMakeLists.txt (build configuration)                          │
                                                                        │
  [4] Build                                                             │
      CMake + cross-compiler → ARM64 ELF binary                         │
                                                                        │
  [5] Unit Test                                                         │
      GTest + ara:: mocks → test binary on x86-64 dev machine           │
                                                                        │
  [6] Integration Test                                                  │
      SIL: Vector SIL Kit / SOME/IP simulation                          │
      HIL: Deployed to target SoC with hardware peripherals             │
                                                                        │
  [7] Package                                                           │
      CMake install → binary + manifests → AUTOSAR UCM Package          │
                                                                        │
  [8] Deploy                                                            │
      UCM OTA update to vehicle ECU                                     │
─────────────────────────────────────────────────────────────────────────────
```

---

## Code Generation: ara::com Skeleton/Proxy

Code generation happens as part of the build system or as a pre-step using vendor-provided tools:

### Generator Input

The generator requires:
1. `RadarObjectService.arxml` — ServiceInterface definition with events, methods, fields, data types
2. `Service_Instance_Manifest.arxml` — Transport binding configuration

### Generator Output

```
Generated file structure:
  generated/
  ├── include/
  │   ├── radar_object_service_common.h   ← Shared types
  │   ├── radar_object_service_skeleton.h ← Server base class
  │   └── radar_object_service_proxy.h    ← Client proxy class
  └── src/
      ├── radar_object_service_skeleton.cpp
      └── radar_object_service_proxy.cpp
```

### Generated Skeleton Header (Annotated)

```cpp
// radar_object_service_skeleton.h  — DO NOT EDIT (auto-generated)
#pragma once

#include <ara/com/types.h>
#include <ara/core/future.h>
#include "radar_object_service_common.h"

namespace ara { namespace vehicle { namespace radar {

class RadarObjectServiceSkeleton {
public:
    // Constructor: binds to a specific instance identifier
    explicit RadarObjectServiceSkeleton(
        ara::com::InstanceIdentifier instance_id,
        ara::com::MethodCallProcessingMode mode = 
            ara::com::MethodCallProcessingMode::kEvent);
    
    virtual ~RadarObjectServiceSkeleton() = default;
    
    // Non-copyable; move-only
    RadarObjectServiceSkeleton(const RadarObjectServiceSkeleton&) = delete;
    RadarObjectServiceSkeleton& operator=(const RadarObjectServiceSkeleton&) = delete;
    
    // Service lifecycle
    ara::core::Result<void> OfferService();
    void StopOfferService();
    
    // ── Events ──────────────────────────────────────────
    struct DetectedObjectsEvent {
        // Allocate a sample from the zero-copy pool
        ara::com::SampleAllocateePtr<ObjectList> Allocate();
        // Send the sample to all subscribers
        ara::core::Result<void> Send(ara::com::SampleAllocateePtr<ObjectList>&& data);
        // Update rate statistics (optional)
        void SetUpdateCycleOffset(ara::core::Duration offset);
    } DetectedObjects;
    
    // ── Methods (pure virtual — developer must implement) ──
    virtual ara::core::Future<ResetFilterOutput> ResetDetectionFilter(
        const FilterMode& filter_mode) = 0;
    
    // ── Fields ───────────────────────────────────────────
    struct DetectionThresholdField {
        void Update(float value);
        float Get();
    } DetectionThreshold;
    
    // Call this in main processing loop (if kPolling mode)
    void ProcessNextMethodCall();
};

}}} // namespace
```

---

## CMake Build System for Adaptive Applications

### Directory Structure

```
my_radar_app/
├── CMakeLists.txt
├── src/
│   ├── main.cpp
│   └── radar_processor.cpp
├── include/
│   └── radar_processor.h
├── generated/            ← Output from code generator (committed to repo)
│   ├── include/
│   │   ├── radar_object_service_skeleton.h
│   │   └── radar_object_service_proxy.h
│   └── src/
│       ├── radar_object_service_skeleton.cpp
│       └── radar_object_service_proxy.cpp
├── test/
│   ├── CMakeLists.txt
│   └── radar_processor_test.cpp
└── manifest/
    ├── application_manifest.arxml
    ├── execution_manifest.arxml
    └── service_instance_manifest.arxml
```

### CMakeLists.txt (Application)

```cmake
cmake_minimum_required(VERSION 3.21)
project(RadarProcessingApp CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# ── Cross-compilation setup ──────────────────────────────────────────
# Set via: cmake -DCMAKE_TOOLCHAIN_FILE=toolchain/aarch64-linux.cmake
# Toolchain file sets: CMAKE_SYSTEM_PROCESSOR, CMAKE_C_COMPILER, etc.

# ── Find AUTOSAR Adaptive Platform libraries ─────────────────────────
find_package(ARACore REQUIRED)      # ara::core (Result, Future, etc.)
find_package(ARACom REQUIRED)       # ara::com
find_package(ARAExec REQUIRED)      # ara::exec
find_package(ARALog REQUIRED)       # ara::log
find_package(ARAPhm REQUIRED)       # ara::phm
find_package(ARAPer REQUIRED)       # ara::per

# ── Main application target ──────────────────────────────────────────
add_executable(radar_proc
    src/main.cpp
    src/radar_processor.cpp
    generated/src/radar_object_service_skeleton.cpp
    generated/src/camera_image_service_proxy.cpp
)

target_include_directories(radar_proc PRIVATE
    include/
    generated/include/
)

target_link_libraries(radar_proc PRIVATE
    ARACore::ara-core
    ARACom::ara-com
    ARAExec::ara-exec
    ARALog::ara-log
    ARAPhm::ara-phm
)

# ── Security hardening flags ─────────────────────────────────────────
target_compile_options(radar_proc PRIVATE
    -fstack-protector-strong
    -D_FORTIFY_SOURCE=2
    -Wall -Wextra -Wpedantic
    -Werror                         # Treat warnings as errors (for safety)
)

target_link_options(radar_proc PRIVATE
    -Wl,-z,relro -Wl,-z,now
    -Wl,-z,noexecstack
)

# ── Installation (creates the deploy layout) ─────────────────────────
install(TARGETS radar_proc DESTINATION /opt/radar/bin/)
install(DIRECTORY manifest/ DESTINATION /etc/autosar/manifests/radar/)

# ── Unit Tests ───────────────────────────────────────────────────────
enable_testing()
add_subdirectory(test/)
```

### Cross-Compilation Toolchain File

```cmake
# toolchain/aarch64-linux-gcc.cmake
set(CMAKE_SYSTEM_NAME Linux)
set(CMAKE_SYSTEM_PROCESSOR aarch64)

# Sysroot: path to the target system libraries (from Yocto SDK)
set(CMAKE_SYSROOT /opt/poky/4.0/sysroots/aarch64-poky-linux)

set(CMAKE_C_COMPILER   aarch64-poky-linux-gcc)
set(CMAKE_CXX_COMPILER aarch64-poky-linux-g++)
set(CMAKE_AR           aarch64-poky-linux-ar)
set(CMAKE_STRIP        aarch64-poky-linux-strip)

set(CMAKE_FIND_ROOT_PATH_MODE_PROGRAM NEVER)
set(CMAKE_FIND_ROOT_PATH_MODE_LIBRARY ONLY)
set(CMAKE_FIND_ROOT_PATH_MODE_INCLUDE ONLY)
```

---

## Unit Testing Adaptive Applications

Unit tests run on the developer's x86-64 machine (not cross-compiled). ara:: API calls are replaced with **mock objects**.

### Mocking ara::com Proxy

```cpp
// test/radar_processor_test.cpp
#include <gtest/gtest.h>
#include <gmock/gmock.h>
#include "radar_processor.h"

// Mock the generated Proxy class
class MockCameraProxy {
public:
    // Mock the event subscription
    MOCK_METHOD(void, Subscribe, (size_t max_cache), ());
    MOCK_METHOD(void, SetReceiveHandler, (std::function<void()> handler), ());
    MOCK_METHOD(size_t, GetNewSamples, 
                (std::function<void(ara::com::SamplePtr<CameraFrame>&&)> callback,
                 size_t max_count), ());
    // Mock the method call
    MOCK_METHOD(ara::core::Future<ResetFrameResult>, ResetFrame, (), ());
    
    // Event accessor for tests
    CameraImageEvent ImageFrame;
};

class RadarProcessorTest : public ::testing::Test {
protected:
    void SetUp() override {
        // Inject mock proxy into processor
        processor_ = std::make_unique<RadarProcessor>(&mock_camera_proxy_);
    }
    
    MockCameraProxy mock_camera_proxy_;
    std::unique_ptr<RadarProcessor> processor_;
};

TEST_F(RadarProcessorTest, ProcessesNewFrame_WhenImageArrives) {
    // Arrange
    auto sample = std::make_shared<CameraFrame>();
    sample->width = 1920;
    sample->height = 1080;
    
    EXPECT_CALL(mock_camera_proxy_, GetNewSamples(_, _))
        .WillOnce([&sample](auto callback, auto) {
            callback(ara::com::SamplePtr<CameraFrame>{sample});
            return 1u;
        });
    
    // Act
    processor_->OnNewCameraFrame();
    
    // Assert
    EXPECT_TRUE(processor_->LastFrameProcessed());
    EXPECT_EQ(processor_->LastFrameWidth(), 1920u);
}
```

### Mocking ara::log (To Suppress Output in Tests)

```cpp
// test/test_main.cpp
#include <gtest/gtest.h>
#include <ara/log/logging.h>

int main(int argc, char** argv) {
    // Initialize ara::log to suppress all output during tests
    ara::log::InitLogging("TEST", "Unit tests", ara::log::LogLevel::kOff,
                          ara::log::LogMode::kConsole, "");
    
    ::testing::InitGoogleTest(&argc, argv);
    return RUN_ALL_TESTS();
}
```

---

## Integration Testing

### Vector SIL Kit (Software-in-the-Loop)

SIL Kit allows running Adaptive Applications on a development machine with simulated SOME/IP communication:

```
SIL Kit Architecture:

  PC: Linux x86-64
  ┌──────────────────────────────────────────────────────────┐
  │                     SIL Kit Registry                     │
  │              (central discovery / bus hub)               │
  └─────────────┬──────────────────────────────┬─────────────┘
                │                              │
  ┌─────────────┴──────┐              ┌────────┴──────────────┐
  │ AUTOSAR Adaptive   │              │  CANoe.Ethernet        │
  │ Application under  │              │  (simulated vehicle    │
  │ test (x86-64 build)│              │   ECU / SOME/IP client)│
  └────────────────────┘              └───────────────────────┘
  
  SOME/IP packets flow through SIL Kit virtual bus.
  No network interface required.
```

### HIL with CANoe.Ethernet

For full integration with simulated hardware signals over SOME/IP:

```
HIL Bench Configuration:

  Test PC (CANoe)                   Target SoC (Eval Board)
  ─────────────────                 ─────────────────────────
  CANoe.Ethernet                    AUTOSAR Adaptive Stack
  SOME/IP test scripts              RadarProcessingApp
         │                                  │
         └──────── 1 GbE Ethernet ──────────┘
  
  Test script (CAPL):
  on envVar trigger {
      CallSOMEIP(0x0101, 0x0001, {0x01, 0x00});  // Method call
      WaitForResponse(500);
      CheckEventPayload(0x8001, expected_objects);
  }
```

---

## Debugging AUTOSAR Adaptive Applications

### DLT Viewer (Diagnostic Log and Trace)

`ara::log` is built on AUTOSAR DLT (Diagnostic Log and Trace). All log messages are sent to a DLT daemon and can be captured by a connected DLT Viewer on the host PC:

```cpp
// Application logging with ara::log
auto logger = ara::log::CreateLogger("RDAR", "Radar Application", 
                                      ara::log::LogLevel::kVerbose);

logger.LogInfo()    << "Object detected at " << distance << "m";
logger.LogWarn()    << "Object quality low: " << quality_score;
logger.LogError()   << "Hardware fault code: " << fault_code;
logger.LogFatal()   << "Unrecoverable failure — entering safe state";
logger.LogVerbose() << "Frame counter: " << frame_count;
logger.LogDebug()   << "Raw sensor value: " << raw_value;
```

DLT message routing on target:
```
Application Process → DLT Client Library → Unix socket → DLT Daemon
DLT Daemon → TCP socket → DLT Viewer on PC (USB passthrough or Ethernet)
```

### GDB Remote Debugging

```bash
# On target ECU:
gdbserver :1234 /opt/radar/bin/radar_proc --config=/etc/radar/default.json

# On development machine:
aarch64-linux-gdb /path/to/radar_proc_debug_symbols
(gdb) target remote target-ip:1234
(gdb) set sysroot /opt/poky/4.0/sysroots/aarch64-poky-linux
(gdb) set solib-search-path /opt/poky/.../lib
(gdb) break RadarProcessor::ProcessFrame
(gdb) continue
```

### Lauterbach Trace32 for Mixed-Mode Debug

Trace32 supports debugging AUTOSAR Adaptive processes (user-space C++) alongside the OS kernel and hypervisor:

```
Trace32 Capabilities:
- Symbol loading for all POSIX processes simultaneously
- OS-aware thread/task list (shows all ara::exec Application states)
- Hardware trace (ETM/PTM) for non-intrusive execution profiling
- Hypervisor-aware: can switch between VM0 (safety), VM1 (QM) contexts
- Call stack unwinding through multi-threaded C++ code
```

---

## CI/CD Pipeline for AUTOSAR Adaptive

### Pipeline Stages

```yaml
# .gitlab-ci.yml (example)

stages:
  - static-analysis
  - build
  - unit-test
  - integration-test
  - package
  - deploy-to-hil

# ── Stage 1: Static Analysis ─────────────────────────────────────────
autosar-cpp14-analysis:
  stage: static-analysis
  image: autosar-build:latest
  script:
    - cppcheck --enable=all --suppress=missingInclude src/
    - clang-tidy src/*.cpp -- -std=c++17 -I include/ -I generated/include/
    - polyspace-analyze --autosar-cpp14 src/  # Commercial AUTOSAR C++14 checker

# ── Stage 2: Build ───────────────────────────────────────────────────
cross-build-aarch64:
  stage: build
  image: yocto-sdk:4.0
  script:
    - source /opt/poky/4.0/environment-setup-aarch64-poky-linux
    - cmake -B build -DCMAKE_TOOLCHAIN_FILE=toolchain/aarch64-linux-gcc.cmake
    - cmake --build build --parallel $(nproc)
  artifacts:
    paths: [build/radar_proc]

# ── Stage 3: Unit Tests ──────────────────────────────────────────────
unit-tests-x86:
  stage: unit-test
  image: ubuntu:22.04
  script:
    - cmake -B test-build -DBUILD_TESTS=ON
    - cmake --build test-build --target radar_proc_tests
    - cd test-build && ctest --output-on-failure --parallel $(nproc)
  coverage: '/^TOTAL.*\s+(\d+%)$/'
  artifacts:
    reports:
      junit: test-build/test_results.xml
      coverage_report:
        coverage_format: cobertura
        path: test-build/coverage.xml

# ── Stage 4: SIL Integration Test ────────────────────────────────────
sil-integration:
  stage: integration-test
  script:
    - sil-kit-registry &
    - ./build/radar_proc --sil-kit &
    - python3 tests/integration/test_radar_service.py
      --sil-kit-registry localhost:8500
  artifacts:
    reports:
      junit: integration_results.xml

# ── Stage 5: Package ─────────────────────────────────────────────────
create-ucm-package:
  stage: package
  script:
    - cmake --install build --prefix staging/
    - python3 tools/create_ucm_package.py 
        --input staging/ 
        --manifest manifest/ 
        --sign-key ${OEM_SIGNING_KEY}
        --output artifacts/radar_app_v${CI_COMMIT_TAG}.ucmpkg
  artifacts:
    paths: [artifacts/]
```

---

## Software Packaging for UCM Deployment

### UCM Package Creation Script

```python
# tools/create_ucm_package.py
import hashlib, json, subprocess
from pathlib import Path

def create_package(input_dir, manifest_dir, signing_key, output_path):
    package = {
        "manifest": load_arxml(manifest_dir / "package_manifest.arxml"),
        "files": {}
    }
    
    # Hash every file
    for f in Path(input_dir).rglob("*"):
        if f.is_file():
            sha256 = hashlib.sha256(f.read_bytes()).hexdigest()
            package["files"][str(f.relative_to(input_dir))] = sha256
    
    # Create archive
    subprocess.run(["tar", "czf", "/tmp/payload.tar.gz", "-C", input_dir, "."])
    
    # Sign with OEM private key (PKCS#7)
    subprocess.run([
        "openssl", "cms", "-sign",
        "-in", "/tmp/payload.tar.gz",
        "-inkey", signing_key,
        "-signer", "certs/oem_code_signing.pem",
        "-out", "/tmp/signature.p7s",
        "-binary"
    ])
    
    # Bundle: manifest + payload + signature
    with zipfile.ZipFile(output_path, 'w') as zf:
        zf.write("/tmp/payload.tar.gz", "payload.tar.gz")
        zf.write("/tmp/signature.p7s", "signature.p7s")
        zf.writestr("package_manifest.json", json.dumps(package))
```
