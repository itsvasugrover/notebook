---
title: AUTOSAR Adaptive Architecture (ARA)
createTime: 2026/03/25 00:00:00
permalink: /kb/embedded/autosar/adaptive-architecture/
---

# AUTOSAR Adaptive Architecture (ARA)

## ARA — AUTOSAR Runtime for Adaptive Applications

**ARA** (AUTOSAR Runtime for Adaptive Applications) is the collection of C++ APIs and platform services that Adaptive Applications use to interact with the platform. ARA is to Adaptive what the RTE is to Classic — the standardized interface between the application and the platform.

ARA has two functional groups:

```
ARA Architecture:

  ┌─────────────────────────────────────────────────────────────────┐
  │                     Adaptive Application                        │
  │              #include <ara/com/com.h>                           │
  │              #include <ara/exec/application_client.h>           │
  │              #include <ara/log/logging.h>                       │
  └──────────────────────────┬──────────────────────────────────────┘
                             │
  ┌──────────────────────────┴──────────────────────────────────────┐
  │              ARA Functional Clusters                            │
  │                                                                 │
  │  Communication:                                                 │
  │    ara::com       — Service-oriented communication              │
  │    ara::nm        — Network Management                          │
  │    ara::tsync     — Time Synchronization                        │
  │                                                                 │
  │  Execution and Lifecycle:                                       │
  │    ara::exec      — Execution Management client API             │
  │    ara::sm        — State Management interface                  │
  │                                                                 │
  │  Diagnostics:                                                   │
  │    ara::diag      — Diagnostic Communication                    │
  │    ara::phm       — Platform Health Management                  │
  │                                                                 │
  │  Logging:                                                       │
  │    ara::log       — Logging and Tracing (DLT-based)             │
  │                                                                 │
  │  Storage:                                                       │
  │    ara::per       — Persistency (key-value store, file access)  │
  │                                                                 │
  │  Security:                                                      │
  │    ara::crypto    — Cryptographic operations                    │
  │    ara::iam       — Identity and Access Management              │
  │                                                                 │
  │  Updates:                                                       │
  │    ara::ucm       — Update and Configuration Management client  │
  └─────────────────────────────────────────────────────────────────┘
```

---

## Functional Clusters in Detail

### ara::com (Communication)
The core communication API. Provides publish/subscribe (events) and request/response (methods) via `Skeleton` (server side) and `Proxy` (client side) patterns.  
→ Covered in full detail in [autosar-05-ara-com.md](autosar-05-ara-com.md)

### ara::exec (Execution Management)
The interface through which an Adaptive Application reports its state to the Execution Manager.

```cpp
#include <ara/exec/application_client.h>

int main(int argc, char* argv[]) {
    // Create the ApplicationClient — must be done first in main()
    ara::exec::ApplicationClient app_client;
    
    // Signal AUTOSAR ARA that initialization is complete;
    // EM transitions app from kInitializing → kRunning
    app_client.ReportApplicationState(ara::exec::ApplicationState::kRunning);
    
    // ... main application loop ...
    
    // Signal graceful termination
    app_client.ReportApplicationState(ara::exec::ApplicationState::kTerminating);
    return 0;
}
```

### ara::diag (Diagnostic Communication)
Provides UDS-based diagnostic services from within an Adaptive Application. Equivalent to DEM/DCM in Classic.

```cpp
#include <ara/diag/uds_error_domain.h>
#include <ara/diag/monitor.h>

// Report a diagnostic fault event
ara::diag::Monitor my_monitor{"MonitorName", 
    ara::diag::DiagnosticMonitorInitialStatus::kPassedOrFailed};
my_monitor.ReportMonitorAction(ara::diag::MonitorAction::kFailed);
```

### ara::log (Logging and Tracing)
Standardized structured logging with DLT (Diagnostic Log and Trace) backend. All log entries have a: context ID, application ID, severity level, and optional payload.

```cpp
#include <ara/log/logging.h>

// Create a logger context for this component
ara::log::Logger& logger = ara::log::CreateLogger("PERC",  // context ID
                                                   "Perception module",
                                                   ara::log::LogLevel::kVerbose);

// Log a message with severity and data
logger.LogInfo() << "Perception pipeline started. FPS target: " << fps_target;
logger.LogWarn() << "Object confidence below threshold: " << confidence;
logger.LogError() << "Sensor timeout after " << timeout_ms << " ms";
```

### ara::per (Persistency)
Provides key-value storage and file access for persistent data within an application:

```cpp
#include <ara/per/key_value_storage.h>

// Open a key-value store (defined in the Application Manifest)
auto kvs = ara::per::OpenKeyValueStorage("CalibrationStore");

// Read a value
auto result = kvs->GetValue<float>("TorqueSensorOffset");
if (result.HasValue()) {
    float offset = result.Value();
}

// Write a value
kvs->SetValue<float>("TorqueSensorOffset", 0.045f);
kvs->SyncToStorage();  // flush to persistent storage
```

### ara::crypto (Cryptographic Operations)
Provides hardware-backed cryptographic operations:

```cpp
#include <ara/crypto/cryp/cryobj/crypto_context.h>

// Sign a firmware update signature with an internal private key
// (key never leaves the Hardware Security Module)
auto sig_context = crypto_provider->CreateMsgRecoveryPublicCtx(
    kEcPrimeStarAlgo);
auto result = sig_context->Verify(message_span, signature_span);
```

### ara::phm (Platform Health Management)
Applications supervise their own checkpoints and report health to PHM:

```cpp
#include <ara/phm/supervised_entity.h>

ara::phm::SupervisedEntity supervised_entity{"PerceptionApp"};

// Report alive supervision checkpoint (must be called within configured period)
supervised_entity.ReportCheckpoint(kAliveCheckpoint_ID);

// Report logical program flow checkpoint
supervised_entity.ReportCheckpoint(kLogicCheckpointA_ID);
// ... execute algorithm ...
supervised_entity.ReportCheckpoint(kLogicCheckpointB_ID);
```

### ara::ucm (Update and Configuration Management)
UCM handles OTA update orchestration. Applications request the UCM to install packages:

```cpp
#include <ara/ucm/package_manager.h>

// Check available update packages
auto packages = ucm_client.GetSwPackages();
for (auto& package : packages) {
    if (package.state == SoftwarePackageState::kTransferred) {
        // Activate the package (requires machine state transition to Update mode)
        ucm_client.ProcessSwPackage(package.id);
    }
}
```

---

## Adaptive Platform Services (Below ARA)

Below the ARA API layer, the Adaptive Platform implements the functional clusters as system-level services. These services are themselves Adaptive Applications (or privileged platform processes) that provide functionality via ara::com.

### Core Platform Services

```
Adaptive Platform Service Architecture:

  ┌─────────────────────────────────────────────────────────────────┐
  │                   Adaptive Applications                         │
  │        (User-space POSIX processes)                             │
  │   MyApp  PerceptionService  PathPlanningService                 │
  └──────────┬───────────┬───────────┬──────────────────────────────┘
             │ ara::com   │ ara::exec  │ ara::log
  ┌──────────┴───────────┴───────────┴──────────────────────────────┐
  │                  Platform Services                              │
  │                                                                 │
  │  ┌───────────────────────┐  ┌──────────────────────────────┐   │
  │  │  Execution Manager    │  │  Communication Management    │   │
  │  │  (Process lifecycle,  │  │  (Service registry, SOME/IP  │   │
  │  │   state machine,      │  │   or DDS routing, IPC)       │   │
  │  │   health reporting)   │  └──────────────────────────────┘   │
  │  └───────────────────────┘                                      │
  │  ┌───────────────────────┐  ┌──────────────────────────────┐   │
  │  │  Crypto Service       │  │  Log and Trace Service       │   │
  │  │  (HSM-backed crypto,  │  │  (DLT daemon; aggregates     │   │
  │  │   key management)     │  │   all app log streams)       │   │
  │  └───────────────────────┘  └──────────────────────────────┘   │
  │  ┌───────────────────────┐  ┌──────────────────────────────┐   │
  │  │  Platform Health Mgr  │  │  Identity and Access Mgr     │   │
  │  │  (Supervised entities,│  │  (AUTOSAR permissions model, │   │
  │  │   recovery actions)   │  │   service access control)    │   │
  │  └───────────────────────┘  └──────────────────────────────┘   │
  │  ┌───────────────────────┐  ┌──────────────────────────────┐   │
  │  │  UCM (Update Manager) │  │  State Manager               │   │
  │  │  (OTA coordination,   │  │  (System-level state machine, │  │
  │  │   package validation)  │  │   power modes, drive modes)  │   │
  │  └───────────────────────┘  └──────────────────────────────┘   │
  └─────────────────────────────────────────────────────────────────┘
             │ POSIX system calls
  ┌──────────┴──────────────────────────────────────────────────────┐
  │               POSIX Operating System                            │
  │      (Linux / QNX / PikeOS / INTEGRITY)                        │
  └─────────────────────────────────────────────────────────────────┘
```

---

## Communication Middleware Architecture

`ara::com` is a language binding (C++) on top of a middleware layer. The actual inter-process and inter-ECU communication is handled by a pluggable transport binding.

```
ara::com Architecture with Transport Bindings:

  Application uses ara::com API only (transport-independent)
  ─────────────────────────────────────────────────────────
  
  MyApp:
    proxy.CameraFeed.Subscribe(10);  // ara::com call
    auto result = proxy.GetObjectList.Call();  // ara::com call
  
  ─────────────────────────────────────────────────────────
  ara::com generates calls to the configured transport binding:
  
  Transport Binding Options:
  ┌─────────────────────────────────────────────────────────┐
  │  SOME/IP (default for Ethernet in Adaptive Platform)    │
  │  RFC: AUTOSAR SOME/IP Protocol Specification            │
  │  Use: Service-to-service communication over UDP/TCP     │
  ├─────────────────────────────────────────────────────────┤
  │  DDS (Data Distribution Service — OMG standard)         │
  │  Use: High-throughput, low-latency data streaming       │
  │       (LiDAR point clouds, camera frames)               │
  ├─────────────────────────────────────────────────────────┤
  │  IPC (Intra-machine communication)                      │
  │  Use: Communication between two AAs on the same SoC     │
  │       Often implemented via shared memory + semaphore   │
  │       or domain sockets                                 │
  ├─────────────────────────────────────────────────────────┤
  │  Custom transport (vendor-specific)                     │
  │  Some vendors implement proprietary high-speed bindings │
  └─────────────────────────────────────────────────────────┘
```

---

## Adaptive Application Lifecycle

An Adaptive Application goes through defined states managed by the Execution Manager:

```
Adaptive Application Lifecycle:

  [ECU Power On]
        │
        │  EM reads Execution Manifest → determines FunctionGroup and startup condition
        ▼
  ┌─────────────┐
  │ Initializing│  ← Application started by EM; performs initialization
  │             │    (Initialize middleware, open service connections,
  │             │     load persistent data from ara::per)
  └──────┬──────┘
         │  app_client.ReportApplicationState(kRunning)
         ▼
  ┌─────────────┐
  │   Running   │  ← Normal operation; application processes data, serves requests
  │             │    EM monitors via PHM supervised entities (alive checkpoints)
  │             │
  │             │  ← State Manager may request state change (e.g., system to Parking mode)
  │             │    SM calls Execution Management to terminate some applications
  └──────┬──────┘
         │  Termination requested by EM (SIGTERM or state change)
         │  app_client.ReportApplicationState(kTerminating)
         ▼
  ┌─────────────┐
  │ Terminating │  ← Graceful shutdown: flush buffers, un-offer services,
  │             │    commit persistent data, close connections
  └──────┬──────┘
         │  Process exits (return 0)
         ▼
  [Process terminated — EM confirms]
```

---

## Machine State vs. Function Group State

AUTOSAR Adaptive introduces a hierarchical state management concept:

### Machine State
The machine-level lifecycle state managed by Execution Management:

```
Machine State transitions:
  Startup ──► Driving ──► Parking ──► Shutdown ──► Off
     │                       │
     └──► LowPower            └──► Update (for OTA)
```

### Function Group State
A subset of applications can be grouped into a **Function Group**. The State Manager activates/deactivates Function Groups based on driving mode.

```
Function Group: "ADAS_Features"
  States:
    Off:         No ADAS processes running
    Standby:     Perception initialized but not outputting actuation
    Active:      All ADAS features running, sending control to vehicle

  State transition driven by:
    - Vehicle speed > 5 km/h → transition from Standby → Active
    - ADAS disable button pressed → transition Active → Standby
    - System fault → transition Active → Off (recovery action)
```

Applications declare in their Execution Manifest which Function Group state they should be active in:

```arxml
<EXECUTION-MANIFEST>
  <PROCESS-REF>/Processes/PerceptionProcess</PROCESS-REF>
  <FUNCTION-GROUP-REF>/FunctionGroups/ADAS_Features</FUNCTION-GROUP-REF>
  <FUNCTION-GROUP-STATE-DEPENDENT>
    <FUNCTION-GROUP-STATE>Active</FUNCTION-GROUP-STATE>
  </FUNCTION-GROUP-STATE-DEPENDENT>
</EXECUTION-MANIFEST>
```

---

## Intra-Cluster Communication (IPC on Same Machine)

When two Adaptive Applications on the same SoC communicate via ara::com with an IPC transport binding, the flow is:

```
PerceptionService (Process A)          PathPlanningService (Process B)
        │                                          │
  ara::com Skeleton                           ara::com Proxy
  → Offers "ObjectList" event               → Subscribes to "ObjectList"
        │                                          │
        │         Communication Management         │
        │                                          │
  ┌─────┴──────────────────────────────────────────┴─────┐
  │            IPC Transport Binding                     │
  │         (POSIX shared memory + eventfd)              │
  └──────────────────────────────────────────────────────┘
  
  PerceptionService writes new ObjectList → shm segment
  Signals eventfd → PathPlanningService woken up
  PathPlanningService reads ObjectList from shm via Proxy
  
  Latency: typically ~50-200 µs for large data (much lower than network)
  Bandwidth: limited by RAM bandwidth (>10 GB/s on modern SoC)
```

---

## ARA Namespace C++ API Summary

```cpp
// All ara:: includes and namespace structure

namespace ara {
  namespace com { /* Service communication: proxy, skeleton, events, methods, fields */ }
  namespace exec { /* Execution: ApplicationClient, ApplicationState */ }
  namespace diag { /* Diagnostics: Monitor, DiagnosticServiceDataIdentifier */ }
  namespace log  { /* Logging: Logger, LogLevel, CreateLogger() */ }
  namespace per  { /* Persistency: KeyValueStorage, FileStorage */ }
  namespace crypto { /* Cryptography: Provider, Key, CipherContext */ }
  namespace phm  { /* Health: SupervisedEntity, RecoveryAction */ }
  namespace nm   { /* Network Management: NetworkHandle */ }
  namespace tsync { /* Time sync: LeapJumpCallback, SynchronizedTimeBaseConsumer */ }
  namespace ucm  { /* Update: PackageManager, SwPackage */ }
  namespace iam  { /* Identity: ServicePermission, ApplicationAccessRoleSet */ }
  namespace rest { /* REST API: RequestHandlerClient, HttpMethod */ }
  namespace sm   { /* State Management: StateClient, FunctionalGroupState */ }
  namespace core { /* Core types: Result<T,E>, ErrorCode, ErrorDomain, Future<T> */ }
}
```

### `ara::core::Result` and Error Handling

AUTOSAR Adaptive replaces traditional exception-based error handling with the `Result` pattern (similar to Rust's `Result<T, E>`):

```cpp
#include <ara/core/result.h>

// Function returning Result instead of throwing exceptions
ara::core::Result<float> ReadTemperature(SensorId id) {
    if (!IsSensorAvailable(id)) {
        return ara::core::Result<float>::FromError(
            ara::core::ErrorCode{SensorErrorDomain::kNotAvailable});
    }
    return ara::core::Result<float>::FromValue(ReadADC(id) * TEMP_GAIN);
}

// Caller handles both success and error
auto temp_result = ReadTemperature(SENSOR_A);
if (temp_result.HasValue()) {
    float temp = temp_result.Value();
    logger.LogInfo() << "Temperature: " << temp;
} else {
    logger.LogError() << "Sensor read failed: " << temp_result.Error().Message();
}
```

This pattern ensures errors are explicit, forces callers to handle failure cases, and avoids exception overhead — important for deterministic performance in automotive contexts.
