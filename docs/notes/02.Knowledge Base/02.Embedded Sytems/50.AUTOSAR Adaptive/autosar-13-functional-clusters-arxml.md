---
title: ARA Functional Clusters — API & ARXML Deep Dive
createTime: 2026/03/25 00:00:00
permalink: /kb/embedded/autosar/functional-clusters-arxml/
---

# ARA Functional Clusters — API & ARXML Deep Dive

This file provides a complete reference for the seven most commonly used ARA Functional Clusters in production AUTOSAR Adaptive systems: **COM**, **EXM**, **LOG**, **PHM**, **STM**, **DIAG**, and **PER**. For each cluster:

- Full C++ API with annotated code examples
- ARXML configuration showing exactly how the AUTOSAR metamodel defines the service
- Relationship between ARXML elements and generated/runtime behaviour

---

## How ARXML Defines ARA Services — Conceptual Overview

The AUTOSAR metamodel is the common language between tools, platform implementations, and application code. Every functional cluster is configured through a chain of ARXML elements:

```
                     ARXML Metamodel Chain

  ┌─────────────────────────────────────────────────────────────────┐
  │  Software Design Tools (SystemDesk, AUTOSAR Builder)            │
  │  Developer declares: interface, ports, deployment parameters    │
  └────────────────────┬────────────────────────────────────────────┘
                       │  writes
                       ▼
  ┌─────────────────────────────────────────────────────────────────┐
  │  ARXML Files  (XML, AUTOSAR schema-validated)                   │
  │  ├── Application Manifest  (design-time topology)               │
  │  ├── Execution Manifest    (runtime process parameters)         │
  │  └── Service Instance Manifest  (transport binding)             │
  └────────────────────┬────────────────────────────────────────────┘
                       │  read by
              ┌────────┴──────────────────────────┐
              │                                   │
              ▼                                   ▼
  ┌───────────────────────┐           ┌───────────────────────────┐
  │  Code Generator        │           │  Platform Runtime (EM, CM, │
  │  Produces:             │           │  PHM, SM, UCM…)            │
  │  - Skeleton/Proxy .h   │           │  Reads manifests at boot   │
  │  - Type headers        │           │  to configure itself       │
  │  - Serialization code  │           │                            │
  └───────────────────────┘           └───────────────────────────┘
              │
              ▼
  Application developer writes C++ that includes generated headers
  and calls ara:: API.
```

The key principle: **ARXML is not just documentation — it is executable configuration**. Changing an ARXML parameter (e.g., a SOME/IP port number, a log level, a supervision timeout) changes how the entire system behaves without touching application source code.

---

## 1. ara::com — Communication (COM)

### Role

`ara::com` is the primary inter-application communication API. It abstracts the underlying transport (SOME/IP, DDS, IPC) and exposes a unified C++ interface based on **Services** containing **Events**, **Methods**, and **Fields**.

### ARXML: ServiceInterface Definition

The `ServiceInterface` in ARXML is the contract between provider and consumer. Everything in the C++ generated API (Skeleton base class, Proxy class, all data types) is derived from this single ARXML element.

```arxml
<!-- /Interfaces/RadarObjectService — the canonical service model -->
<SERVICE-INTERFACE>
  <SHORT-NAME>RadarObjectService</SHORT-NAME>
  <CATEGORY>SERVICE</CATEGORY>
  <MAJOR-VERSION>1</MAJOR-VERSION>
  <MINOR-VERSION>3</MINOR-VERSION>

  <!-- ── Data Types ───────────────────────────────────────────── -->
  <!-- (defined separately; referenced here) -->
  <!-- /DataTypes/RadarObject, /DataTypes/ObjectList, etc.        -->

  <!-- ── Events ───────────────────────────────────────────────── -->
  <!-- Fire-and-forget publish; Skeleton.Send() → all subscribers -->
  <EVENTS>
    <VARIABLE-DATA-PROTOTYPE>
      <SHORT-NAME>DetectedObjects</SHORT-NAME>
      <TYPE-TREF DEST="IMPLEMENTATION-DATA-TYPE">
        /DataTypes/ObjectList
      </TYPE-TREF>
      <!-- Serialization transformer chain (optional E2E protection) -->
      <TRANSFORMER-CHAIN-REF DEST="DATA-TRANSFORMATION-SET">
        /Transformers/E2E_P04_ObjectList
      </TRANSFORMER-CHAIN-REF>
    </VARIABLE-DATA-PROTOTYPE>
  </EVENTS>

  <!-- ── Methods ──────────────────────────────────────────────── -->
  <!-- Request-response; Proxy returns ara::core::Future<T> -->
  <METHODS>
    <CLIENT-SERVER-OPERATION>
      <SHORT-NAME>ResetDetectionFilter</SHORT-NAME>
      <ARGUMENTS>
        <ARGUMENT-DATA-PROTOTYPE>
          <SHORT-NAME>filter_mode</SHORT-NAME>
          <TYPE-TREF DEST="IMPLEMENTATION-DATA-TYPE">
            /DataTypes/FilterMode
          </TYPE-TREF>
          <DIRECTION>IN</DIRECTION>
        </ARGUMENT-DATA-PROTOTYPE>
      </ARGUMENTS>
      <!-- Return type; wrapped in Future<> by generated code -->
      <RETURN-VALUE>
        <TYPE-TREF DEST="IMPLEMENTATION-DATA-TYPE">
          /DataTypes/ErrorCode
        </TYPE-TREF>
      </RETURN-VALUE>
      <!-- Fire-and-forget if set: no return value, no response -->
      <FIRE-AND-FORGET>false</FIRE-AND-FORGET>
    </CLIENT-SERVER-OPERATION>
  </METHODS>

  <!-- ── Fields ───────────────────────────────────────────────── -->
  <!-- Combination: getter method + setter method + notifier event -->
  <FIELDS>
    <FIELD>
      <SHORT-NAME>DetectionThreshold</SHORT-NAME>
      <TYPE-TREF DEST="IMPLEMENTATION-DATA-TYPE">
        /DataTypes/Float32
      </TYPE-TREF>
      <HAS-GETTER>true</HAS-GETTER>
      <HAS-SETTER>true</HAS-SETTER>
      <HAS-NOTIFIER>true</HAS-NOTIFIER>   <!-- change notification event -->
    </FIELD>
  </FIELDS>
</SERVICE-INTERFACE>
```

### ARXML: SOME/IP Transport Binding — Provided Instance

The `ProvidedSomeipServiceInstance` element wires the abstract `ServiceInterface` to actual network parameters used by Communication Management on the server ECU:

```arxml
<PROVIDED-SOMEIP-SERVICE-INSTANCE>
  <SHORT-NAME>RadarService_Inst1_Provided</SHORT-NAME>

  <!-- Which abstract interface this configures -->
  <SERVICE-INTERFACE-REF DEST="SERVICE-INTERFACE">
    /Interfaces/RadarObjectService
  </SERVICE-INTERFACE-REF>

  <!-- SOME/IP identifiers assigned by the system architect -->
  <SERVICE-ID>0x0101</SERVICE-ID>
  <INSTANCE-ID>0x0001</INSTANCE-ID>
  <MAJOR-VERSION>1</MAJOR-VERSION>
  <MINOR-VERSION>3</MINOR-VERSION>

  <!-- Service Discovery timing -->
  <SD-SERVER-CONFIG>
    <INITIAL-OFFER-BEHAVIOR>
      <OFFER-INITIAL-DELAY-MIN>100</OFFER-INITIAL-DELAY-MIN>  <!-- ms -->
      <OFFER-INITIAL-DELAY-MAX>200</OFFER-INITIAL-DELAY-MAX>
      <OFFER-REPETITION-BASE-DELAY>200</OFFER-REPETITION-BASE-DELAY>
      <OFFER-REPETITIONS-MAX>3</OFFER-REPETITIONS-MAX>
    </INITIAL-OFFER-BEHAVIOR>
    <OFFER-CYCLIC-DELAY>1000</OFFER-CYCLIC-DELAY>  <!-- ms, main phase -->
    <REQUEST-RESPONSE-DELAY>
      <MIN-VALUE>10</MIN-VALUE>
      <MAX-VALUE>100</MAX-VALUE>
    </REQUEST-RESPONSE-DELAY>
  </SD-SERVER-CONFIG>

  <!-- Event group binding (maps to SOME/IP event group for Subscribe) -->
  <EVENT-GROUP>
    <SHORT-NAME>ObjectEventGroup</SHORT-NAME>
    <EVENT-GROUP-ID>0x0001</EVENT-GROUP-ID>
    <!-- Which events belong to this event group -->
    <EVENT-REF DEST="VARIABLE-DATA-PROTOTYPE">
      /Interfaces/RadarObjectService/DetectedObjects
    </EVENT-REF>
    <!-- UDP multicast used for event delivery -->
    <MULTICAST-UDP-ADDRESS>239.0.0.1</MULTICAST-UDP-ADDRESS>
    <MULTICAST-UDP-PORT>30501</MULTICAST-UDP-PORT>
    <!-- Initial event sent on subscription (unicast) -->
    <MULTICAST-THRESHOLD>0</MULTICAST-THRESHOLD>
  </EVENT-GROUP>

  <!-- Method binding -->
  <METHOD-MAPPING>
    <SHORT-NAME>ResetFilter_Mapping</SHORT-NAME>
    <METHOD-REF DEST="CLIENT-SERVER-OPERATION">
      /Interfaces/RadarObjectService/ResetDetectionFilter
    </METHOD-REF>
    <METHOD-ID>0x0001</METHOD-ID>
    <TRANSPORT-PROTOCOL>TCP</TRANSPORT-PROTOCOL>
    <SOMEIP-HEADER-DATA>
      <SERVER-SERVICE-MINOR-VERSION>3</SERVER-SERVICE-MINOR-VERSION>
    </SOMEIP-HEADER-DATA>
  </METHOD-MAPPING>
</PROVIDED-SOMEIP-SERVICE-INSTANCE>

<!-- Required Instance (CLIENT ECU side) -->
<REQUIRED-SOMEIP-SERVICE-INSTANCE>
  <SHORT-NAME>RadarService_Inst1_Required</SHORT-NAME>
  <SERVICE-INTERFACE-REF DEST="SERVICE-INTERFACE">
    /Interfaces/RadarObjectService
  </SERVICE-INTERFACE-REF>
  <SERVICE-ID>0x0101</SERVICE-ID>
  <INSTANCE-ID>0x0001</INSTANCE-ID>
  <!-- SD client configuration -->
  <SD-CLIENT-CONFIG>
    <INITIAL-FIND-BEHAVIOR>
      <FIND-INITIAL-DELAY-MIN>10</FIND-INITIAL-DELAY-MIN>
      <FIND-INITIAL-DELAY-MAX>100</FIND-INITIAL-DELAY-MAX>
      <FIND-REPETITIONS-MAX>3</FIND-REPETITIONS-MAX>
      <FIND-REPETITION-BASE-DELAY>200</FIND-REPETITION-BASE-DELAY>
    </INITIAL-FIND-BEHAVIOR>
    <TTL>3000</TTL>  <!-- ms — subscription TTL before auto-renewal -->
  </SD-CLIENT-CONFIG>
  <!-- Which event groups to subscribe to -->
  <CONSUMED-EVENT-GROUP>
    <SHORT-NAME>ObjectEventGroup_Consumed</SHORT-NAME>
    <EVENT-GROUP-ID>0x0001</EVENT-GROUP-ID>
  </CONSUMED-EVENT-GROUP>
</REQUIRED-SOMEIP-SERVICE-INSTANCE>
```

### SOME/IP Transport Layer Breakdown (UDP vs TCP)

```
ara::com transport selection per element type:

  Element         Default Transport   When to use TCP instead
  ────────────────────────────────────────────────────────────────────
  Events          UDP (unicast/mcast) TCP only if reliability required
                                      and you can afford TCP overhead
  Methods         TCP                 Use UDP if response fits one MTU
                                      (rare — default is TCP)
  Fields          Same as events      Notifier: UDP; Get/Set: TCP
  SD (discovery)  UDP broadcast/mcast Always UDP; broadcast for initial
                                      offer; unicast for targeted SD

SOME/IP over UDP constraints:
  - Max payload: 1472 bytes (Ethernet MTU 1500 - 20 IP - 8 UDP - SOME/IP header)
  - Larger payloads: use SOME/IP TP (Transport Protocol — segmentation)
    → SOME/IP TP adds 4-byte offset header; CM reassembles on receiver side

SOME/IP TP ARXML config:
  <SOMEIP-TP-CONFIG>
    <TP-SUPPORTED>true</TP-SUPPORTED>
    <SEGMENT-LEN>1392</SEGMENT-LEN>  <!-- max bytes per UDP segment -->
  </SOMEIP-TP-CONFIG>
```

### C++ API: Full Event/Method/Field Usage

```cpp
// ── Skeleton (Server) ─────────────────────────────────────────────────
class MyRadarSkeleton : public RadarObjectServiceSkeleton {
public:
    MyRadarSkeleton()
        : RadarObjectServiceSkeleton(ara::com::InstanceIdentifier("RADAR_01")) {}

    // Method handler — pure virtual; must implement
    ara::core::Future<ErrorCode> ResetDetectionFilter(
        const FilterMode& filter_mode) override
    {
        ara::core::Promise<ErrorCode> promise;
        filter_.Reset(filter_mode);
        promise.set_value(ErrorCode::kOk);
        return promise.get_future();
    }

    // Publish event from application loop
    void PublishObjects(const ObjectList& objects) {
        // Allocate zero-copy sample from the COM pool
        auto sample = DetectedObjects.Allocate();
        *sample = objects;
        // Send to all subscribers; CM handles transport
        auto result = DetectedObjects.Send(std::move(sample));
        if (!result.HasValue()) {
            logger_.LogError() << "Send failed: " << result.Error().Message();
        }
    }

    // Update field value (notifier event fires automatically to subscribers)
    void UpdateThreshold(float t) { DetectionThreshold.Update(t); }

private:
    ara::log::Logger& logger_ =
        ara::log::CreateLogger("RDAR", "Radar skeleton");
    DetectionFilter filter_;
};

// ── Proxy (Client) ────────────────────────────────────────────────────
class ObjectConsumer {
public:
    void Start() {
        // Async find — callback fires when service appears/disappears
        find_handle_ = RadarObjectServiceProxy::StartFindService(
            [this](auto container, auto) {
                if (!container.empty()) {
                    proxy_ = std::make_unique<RadarObjectServiceProxy>(
                        container.front());
                    SetupSubscriptions();
                }
            },
            ara::com::InstanceIdentifier::Any);
    }

    void SetupSubscriptions() {
        // Subscribe to DetectedObjects event; cache up to 10 samples
        proxy_->DetectedObjects.Subscribe(10);
        proxy_->DetectedObjects.SetReceiveHandler(
            [this]() { OnNewObjects(); });

        // Subscribe to field change notification
        proxy_->DetectionThreshold.Changed.Subscribe(1);
        proxy_->DetectionThreshold.Changed.SetReceiveHandler(
            [this]() { OnThresholdChanged(); });
    }

    void OnNewObjects() {
        // Drain the event cache; lambda called once per sample
        proxy_->DetectedObjects.GetNewSamples(
            [](ara::com::SamplePtr<ObjectList> sample) {
                ProcessObjects(*sample);
            });
    }

    void OnThresholdChanged() {
        proxy_->DetectionThreshold.Changed.GetNewSamples(
            [](auto sample) {
                logger_.LogInfo() << "New threshold: " << *sample;
            });
    }

    void CallMethod() {
        auto future = proxy_->ResetDetectionFilter(FilterMode::kShortRange);
        // Non-blocking callback when result arrives
        std::move(future).then([](ara::core::Future<ErrorCode> f) {
            auto result = f.get();
            if (result.HasValue() && result.Value() == ErrorCode::kOk)
                logger_.LogInfo() << "Filter reset ok";
        });
    }

    // Field getter (async)
    void ReadField() {
        auto future = proxy_->DetectionThreshold.Get();
        float t = future.get().Value();  // blocking for brevity
        logger_.LogInfo() << "Current threshold: " << t;
    }

    // Field setter
    void WriteField(float t) {
        auto future = proxy_->DetectionThreshold.Set(t);
        future.get();  // wait for ack
    }

private:
    ara::com::FindServiceHandle find_handle_;
    std::unique_ptr<RadarObjectServiceProxy> proxy_;
};
```

---

## 2. ara::exec — Execution Management (EXM)

### Role

`ara::exec` (referred to as EXM) is the interface between an Adaptive Application and the Execution Management platform service. It has two responsibilities:

1. **Application lifecycle reporting**: The application tells EM which state it has reached (`kRunning`, `kTerminating`)
2. **Execution client**: Used by tools or orchestrators to query the state of other applications

### ARXML: Execution Manifest Process Configuration

```arxml
<EXECUTION-MANIFEST>
  <SHORT-NAME>RadarApp_ExecManifest</SHORT-NAME>

  <!-- ── Process definition ─────────────────────────────────── -->
  <PROCESS>
    <SHORT-NAME>RadarProc</SHORT-NAME>

    <!-- Path to the ELF binary on target filesystem -->
    <EXECUTABLE-REF DEST="EXECUTABLE">
      /Executables/radar_proc
    </EXECUTABLE-REF>

    <!-- CLI arguments  -->
    <START-UP-OPTION>
      <SHORT-NAME>Opt_Config</SHORT-NAME>
      <OPTION-VALUE>--config=/etc/radar/cfg.json</OPTION-VALUE>
    </START-UP-OPTION>

    <!-- POSIX scheduling (mapped to sched_setscheduler by EM) -->
    <SCHEDULING-POLICY>SCHED-FIFO</SCHEDULING-POLICY>
    <SCHEDULING-PRIORITY>60</SCHEDULING-PRIORITY>

    <!-- CPU core pinning (mapped to sched_setaffinity by EM) -->
    <CORE-AFFINITY>
      <ASSIGNED-PROCESSOR-ID>2</ASSIGNED-PROCESSOR-ID>
      <ASSIGNED-PROCESSOR-ID>3</ASSIGNED-PROCESSOR-ID>
    </CORE-AFFINITY>

    <!-- Resource limits (mapped to cgroup v2 by EM on Linux) -->
    <PROCESS-RESOURCE-MANAGEMENT>
      <CPU-BUDGET>
        <BUDGET>300000</BUDGET>      <!-- µs per period -->
        <PERIOD>1000000</PERIOD>     <!-- µs = 30% CPU -->
      </CPU-BUDGET>
      <MEMORY-HARD-LIMIT>536870912</MEMORY-HARD-LIMIT>   <!-- 512 MB -->
      <MAX-FILE-DESCRIPTORS>512</MAX-FILE-DESCRIPTORS>
    </PROCESS-RESOURCE-MANAGEMENT>

    <!-- Linux capability whitelist (least privilege) -->
    <REQUIRED-ENTER-EXIT-PERMISSION>
      <PERMISSION>CAP-SYS-NICE</PERMISSION>
    </REQUIRED-ENTER-EXIT-PERMISSION>

    <!-- FunctionGroup membership: this process runs when ADASfg = Active -->
    <FUNCTION-GROUP-STATE-IN-PROCESS-IREF>
      <FUNCTION-GROUP-REF DEST="FUNCTION-GROUP">
        /MachineDesign/FunctionGroups/ADASfg
      </FUNCTION-GROUP-REF>
      <FUNCTION-GROUP-STATE-REF DEST="FUNCTION-GROUP-STATE">
        /MachineDesign/FunctionGroups/ADASfg/Active
      </FUNCTION-GROUP-STATE-REF>
    </FUNCTION-GROUP-STATE-IN-PROCESS-IREF>

    <!-- Timeouts -->
    <STARTUP-TIMEOUT>5000</STARTUP-TIMEOUT>    <!-- ms: max time to reach kRunning -->
    <SHUTDOWN-TIMEOUT>3000</SHUTDOWN-TIMEOUT>  <!-- ms: max time after SIGTERM -->

    <!-- Recovery policy on unexpected exit -->
    <PROCESS-RECOVERY>
      <RECOVERY-ACTION>RESTART</RECOVERY-ACTION>
      <MAX-NUM-RESTART-ATTEMPTS>3</MAX-NUM-RESTART-ATTEMPTS>
      <RESTART-STRATEGY>EXPONENTIAL</RESTART-STRATEGY>
      <RESTART-INTERVAL>500</RESTART-INTERVAL>  <!-- ms base delay -->
    </PROCESS-RECOVERY>
  </PROCESS>
</EXECUTION-MANIFEST>
```

### C++ API

```cpp
#include <ara/exec/application_client.h>
#include <ara/exec/execution_client.h>

// ── ApplicationClient — used by the application itself ───────────────
int main() {
    ara::exec::ApplicationClient app_client;

    // ── Initializing phase ────────────────────────────────────────────
    // App is alive but not yet ready to serve. EM waits up to
    // STARTUP-TIMEOUT ms for kRunning. Don't call OfferService yet.
    InitHardware();
    ConnectToServices();
    LoadCalibration();

    // Signal running — EM records this and stops the startup timer
    app_client.ReportApplicationState(ara::exec::ApplicationState::kRunning);

    // ── Running phase ─────────────────────────────────────────────────
    skeleton_.OfferService();

    while (!stop_token.stop_requested()) {
        DoMainWork();
    }

    // ── Terminating phase ─────────────────────────────────────────────
    skeleton_.StopOfferService();
    app_client.ReportApplicationState(ara::exec::ApplicationState::kTerminating);
    FlushLogs();
    return 0;
    // Process exit → EM observes waitpid() return → marks Terminated
}

// ── ExecutionClient — used to query state of other processes ─────────
// (used by State Management or diagnostic tools)
ara::exec::ExecutionClient exec_client;

// Query all function groups and their current states
auto fg_states = exec_client.GetFunctionGroupStates().Value();
for (const auto& [fg, state] : fg_states) {
    logger.LogInfo() << "FunctionGroup: " << fg << " State: " << state;
}

// ── FunctionGroup state from EM perspective ───────────────────────────
// Applications can also receive state change notifications:
ara::exec::FunctionGroupStateClient fg_client(
    "/MachineDesign/FunctionGroups/ADASfg");

fg_client.SetStateChangeHandler([](const std::string& new_state) {
    if (new_state == "Active") {
        StartADASProcessing();
    } else if (new_state == "Passive") {
        SuspendActuation();
    }
});
```

---

## 3. ara::log — Diagnostic Log and Trace (DLT)

### Role

`ara::log` is the logging framework for AUTOSAR Adaptive. Under the hood it uses **DLT (Diagnostic Log and Trace)** — the AUTOSAR standard for structured log message routing in vehicles. Log messages are forwarded by the DLT daemon to:

- A host-side **DLT Viewer** tool (via USB or Ethernet)
- A persistent file (for post-mortem analysis)
- A remote diagnostic tester (via DoIP/UDS)

### ARXML: Logging Configuration

Logging is configured in the Application Manifest:

```arxml
<LOG-AND-TRACE>
  <SHORT-NAME>RadarApp_LogConfig</SHORT-NAME>

  <!-- Application-level defaults -->
  <LOG-MODE>kRemote</LOG-MODE>         <!-- kRemote | kFile | kConsole | combination -->
  <LOG-LEVEL>kInfo</LOG-LEVEL>         <!-- default level; filters lower-severity msgs -->
  <LOG-FILE-PATH>/var/log/ara/radar.dlt</LOG-FILE-PATH>

  <!-- DLT Application ID (4-char ASCII, visible in DLT Viewer) -->
  <APPLICATION-ID>RDAR</APPLICATION-ID>
  <APPLICATION-DESCRIPTION>Radar Processing Application</APPLICATION-DESCRIPTION>

  <!-- Named log contexts (one per component / thread) -->
  <LOG-CONTEXT>
    <SHORT-NAME>MainCtx</SHORT-NAME>
    <CONTEXT-ID>MAIN</CONTEXT-ID>          <!-- 4-char, shown in DLT Viewer -->
    <CONTEXT-DESCRIPTION>Main loop</CONTEXT-DESCRIPTION>
    <DEFAULT-LOG-LEVEL>kVerbose</DEFAULT-LOG-LEVEL>
  </LOG-CONTEXT>

  <LOG-CONTEXT>
    <SHORT-NAME>FilterCtx</SHORT-NAME>
    <CONTEXT-ID>FILT</CONTEXT-ID>
    <CONTEXT-DESCRIPTION>Object filter pipeline</CONTEXT-DESCRIPTION>
    <DEFAULT-LOG-LEVEL>kWarn</DEFAULT-LOG-LEVEL>  <!-- filter noisy in production -->
  </LOG-CONTEXT>
</LOG-AND-TRACE>
```

### C++ API

```cpp
#include <ara/log/logging.h>

// ── Initialisation (called once in main()) ────────────────────────────
// Parameters must match the ARXML LOG-AND-TRACE configuration
ara::log::InitLogging(
    "RDAR",                              // Application ID (matches ARXML)
    "Radar Processing Application",      // Description (matches ARXML)
    ara::log::LogLevel::kInfo,           // Default level
    ara::log::LogMode::kRemote           // kRemote | kFile | kConsole
                         | ara::log::LogMode::kFile,
    "/var/log/ara/radar.dlt"             // File path (if kFile mode)
);

// ── Create logger for a context (matches ARXML LOG-CONTEXT) ──────────
static auto& main_logger =
    ara::log::CreateLogger("MAIN",     // Context ID (4-char)
                           "Main loop",
                           ara::log::LogLevel::kVerbose);

static auto& filter_logger =
    ara::log::CreateLogger("FILT", "Object filter pipeline",
                           ara::log::LogLevel::kWarn);

// ── Log level severity (descending) ──────────────────────────────────
// kFatal   — unrecoverable error; application will terminate
// kError   — recoverable error; operation failed
// kWarn    — unexpected condition; may affect correctness
// kInfo    — normal operational events (service start/stop, etc.)
// kDebug   — internal state useful during development
// kVerbose — fine-grained trace (disabled in production builds)

void ProcessFrame(const RadarFrame& frame) {
    main_logger.LogDebug() << "ProcessFrame: " << frame.id;

    auto result = filter_.Apply(frame);
    if (!result.HasValue()) {
        filter_logger.LogError()
            << "Filter failed: " << result.Error().Message()
            << " frame_id=" << frame.id;
        return;
    }

    main_logger.LogInfo() << "Objects detected: " << result.Value().size();
}

// ── Structured argument types (shown with units in DLT Viewer) ────────
main_logger.LogInfo()
    << ara::log::Arg("distance_m", 42.7f)
    << ara::log::Arg("velocity_ms", -3.2f);

// ── Fatal log (flushes immediately, before crash handler) ─────────────
void OnHardwareFault(uint32_t fault_code) {
    main_logger.LogFatal()
        << "Hardware fault code=0x" << ara::log::HexFormat(fault_code)
        << " — entering safe state";
    ara::exec::ApplicationClient{}.ReportApplicationState(
        ara::exec::ApplicationState::kTerminating);
    std::abort();
}

// ── Runtime log level change (can be pushed via DLT Viewer) ──────────
// DLT Viewer sends a "Set Log Level" message over DLT protocol.
// ara::log runtime processes it automatically — no code needed.
// ARXML controls the initial level; runtime changes are volatile.
```

### DLT Message Structure (Internal)

```
DLT message on wire (TCP/UDP to host DLT Viewer):

  Byte  Field
  ────  ─────────────────────────────────────────────────────
    0   Header type bitmask (extended header, verbose mode…)
    1   Message counter (per application)
   2–3  Message length
   4–7  ECU ID ("RDAR" or "ECU1" — configured in dlt.conf)
   8–11 Session ID (process PID)
  12–15 Timestamp (100µs resolution, from monotonic clock)
  16–19 Message ID (if non-verbose) / Argument count (verbose)
  20+   Application ID (4 ASCII bytes)
  24+   Context ID (4 ASCII bytes)
  28+   Message type (DLT_TYPE_LOG, control, etc.)
  32+   Log level (FATAL/ERROR/WARN/INFO/DEBUG/VERBOSE)
  36+   Payload: serialized argument values (type+length+data)

DLT Viewer decodes each argument's type (bool, uint32, float32, string…)
and displays with proper formatting.
```

---

## 4. ara::phm — Platform Health Management (PHM)

### Role

`ara::phm` monitors the runtime health of Adaptive Applications. If an application stops checking in, exceeds a timing deadline, or executes in the wrong sequence, PHM triggers a configured recovery action (restart, safe state, reboot).

### ARXML: PHM Supervision Configuration

```arxml
<!-- ── Supervised Entity declaration in Application Manifest ────── -->
<PHM-SUPERVISED-ENTITY-INTERFACE>
  <SHORT-NAME>RadarMain_SE</SHORT-NAME>
  <CATEGORY>ALIVE-SUPERVISION</CATEGORY>
</PHM-SUPERVISED-ENTITY-INTERFACE>

<!-- ── Supervision configuration in Execution Manifest ─────────── -->
<HEALTH-CHANNEL-INTERFACE>
  <SHORT-NAME>RadarHealth</SHORT-NAME>

  <!-- ── Alive Supervision ─────────────────────────────────────── -->
  <ALIVE-SUPERVISION>
    <SHORT-NAME>RadarAlive</SHORT-NAME>
    <SUPERVISED-ENTITY-ID>RadarMain_SE</SUPERVISED-ENTITY-ID>

    <!-- Checkpoint ID that counts as the "alive" signal -->
    <EXPECTED-ALIVE-INDICATION-CHECKPOINT>0</EXPECTED-ALIVE-INDICATION-CHECKPOINT>

    <!-- Expected number of checkpoints per reference cycle -->
    <EXPECTED-ALIVE-INDICATIONS>1</EXPECTED-ALIVE-INDICATIONS>

    <!-- Reference cycle (ms) -->
    <ALIVE-REFERENCE-CYCLE>50</ALIVE-REFERENCE-CYCLE>

    <!-- Allowed miss count before failure declared -->
    <SUPERVISION-INTERVAL-TOLERANCE>2</SUPERVISION-INTERVAL-TOLERANCE>

    <!-- How many consecutive failures before recovery action triggered -->
    <FAILED-SUPERVISION-CYCLES-TOLERANCE>3</FAILED-SUPERVISION-CYCLES-TOLERANCE>
  </ALIVE-SUPERVISION>

  <!-- ── Deadline Supervision ──────────────────────────────────── -->
  <DEADLINE-SUPERVISION>
    <SHORT-NAME>FilterDeadline</SHORT-NAME>
    <SUPERVISED-ENTITY-ID>RadarMain_SE</SUPERVISED-ENTITY-ID>

    <!-- Checkpoint A (start) → Checkpoint B (end) must happen within window -->
    <SUPERVISION-CHECKPOINT-FROM>1</SUPERVISION-CHECKPOINT-FROM>
    <SUPERVISION-CHECKPOINT-TO>2</SUPERVISION-CHECKPOINT-TO>
    <MIN-DEADLINE>10</MIN-DEADLINE>   <!-- ms — too fast = error too -->
    <MAX-DEADLINE>100</MAX-DEADLINE>  <!-- ms — must finish before this -->
  </DEADLINE-SUPERVISION>

  <!-- ── Logical Supervision ───────────────────────────────────── -->
  <LOGICAL-SUPERVISION>
    <SHORT-NAME>PipelineSequence</SHORT-NAME>
    <SUPERVISED-ENTITY-ID>RadarMain_SE</SUPERVISED-ENTITY-ID>

    <!-- Valid checkpoint graph: 10→11→12→10 (circular) or 10→13 (abort) -->
    <SUPERVISION-CHECKPOINT>
      <CHECKPOINT-ID>10</CHECKPOINT-ID>
      <VALID-NEXT-CHECKPOINT>11</VALID-NEXT-CHECKPOINT>
      <VALID-NEXT-CHECKPOINT>13</VALID-NEXT-CHECKPOINT>  <!-- error path -->
    </SUPERVISION-CHECKPOINT>
    <SUPERVISION-CHECKPOINT>
      <CHECKPOINT-ID>11</CHECKPOINT-ID>
      <VALID-NEXT-CHECKPOINT>12</VALID-NEXT-CHECKPOINT>
    </SUPERVISION-CHECKPOINT>
    <SUPERVISION-CHECKPOINT>
      <CHECKPOINT-ID>12</CHECKPOINT-ID>
      <VALID-NEXT-CHECKPOINT>10</VALID-NEXT-CHECKPOINT>  <!-- loop back -->
    </SUPERVISION-CHECKPOINT>
  </LOGICAL-SUPERVISION>

  <!-- ── Recovery Action (what PHM does on supervision failure) ── -->
  <HEALTH-CHANNEL-ACTION-ITEM>
    <SHORT-NAME>HealthRecover</SHORT-NAME>
    <STATUS-INDICATOR>SUPERVISION-FAILURE</STATUS-INDICATOR>
    <!-- Notify SM to request state change → triggers process restart -->
    <RECOVERY-NOTIFICATION-TO-SM>
      <FUNCTION-GROUP-REF>/FGS/ADASfg</FUNCTION-GROUP-REF>
      <FUNCTION-GROUP-STATE-REF>/FGS/ADASfg/Off</FUNCTION-GROUP-STATE-REF>
    </RECOVERY-NOTIFICATION-TO-SM>
  </HEALTH-CHANNEL-ACTION-ITEM>
</HEALTH-CHANNEL-INTERFACE>
```

### C++ API

```cpp
#include <ara/phm/supervised_entity.h>
#include <ara/phm/health_channel.h>

// ── Supervised Entity: alive supervision ─────────────────────────────
// Instance identifier matches SUPERVISED-ENTITY-ID in ARXML
ara::phm::SupervisedEntity se_alive(
    ara::phm::SupervisedEntityId{"RadarMain_SE"});

void MainProcessingLoop() {
    while (!stop) {
        ProcessRadarData();    // < 50ms

        // Alive checkpoint — must be called once per reference cycle (50ms)
        // Checkpoint 0 = the alive signal configured in ARXML
        se_alive.ReportCheckpoint(ara::phm::CheckpointId{0});

        std::this_thread::sleep_for(std::chrono::milliseconds(50));
    }
}

// ── Deadline supervision ─────────────────────────────────────────────
void RunFilterPipeline() {
    // Checkpoint 1 = start of monitored operation
    se_alive.ReportCheckpoint(ara::phm::CheckpointId{1});

    RunComplexFilter();  // PHM measures: must be 10ms ≤ duration ≤ 100ms

    // Checkpoint 2 = end; PHM calculates elapsed time
    se_alive.ReportCheckpoint(ara::phm::CheckpointId{2});
}

// ── Logical supervision ───────────────────────────────────────────────
void Pipeline() {
    se_alive.ReportCheckpoint(ara::phm::CheckpointId{10});  // Step A
    StageA();
    se_alive.ReportCheckpoint(ara::phm::CheckpointId{11});  // Step B
    StageB();
    se_alive.ReportCheckpoint(ara::phm::CheckpointId{12});  // End: back to 10
    // Any other sequence (e.g., 10 → 12 skipping 11) → logical failure
}

// ── HealthChannel: report non-supervision health events ──────────────
// (e.g., hardware faults that don't directly map to a supervision)
ara::phm::HealthChannel health_channel(
    ara::phm::HealthChannelId{"RadarHealth"});

void OnHardwareSensorFault() {
    // Inform PHM/SM of a health event; SM can react with state transition
    health_channel.ReportHealthStatus(
        ara::phm::HealthStatus{"SENSOR_FAULT"});
}
```

---

## 5. ara::sm / ara::stm — State Management (STM)

### Role

`ara::sm` (State Management, also referred to as STM) is the API through which applications interact with the **State Management** Functional Cluster. It allows applications to:

- **Request** a Function Group or Machine State transition
- **Receive notifications** when state changes occur
- **Trigger** emergency transitions (e.g., safe state request)

### ARXML: Machine Design and Function Groups

All states and their associated processes are defined in the Machine Design ARXML:

```arxml
<MACHINE-DESIGN>
  <SHORT-NAME>VehicleComputePlatform</SHORT-NAME>

  <!-- ── Machine State (top-level system mode) ──────────────── -->
  <MACHINE-STATE-MACHINE>
    <SHORT-NAME>MachineFSM</SHORT-NAME>

    <MACHINE-STATE>
      <SHORT-NAME>Startup</SHORT-NAME>
      <!-- No user processes in Startup — platform services only -->
    </MACHINE-STATE>

    <MACHINE-STATE>
      <SHORT-NAME>Driving</SHORT-NAME>
    </MACHINE-STATE>

    <MACHINE-STATE>
      <SHORT-NAME>Parking</SHORT-NAME>
    </MACHINE-STATE>

    <MACHINE-STATE>
      <SHORT-NAME>OTA-Update</SHORT-NAME>
    </MACHINE-STATE>

    <MACHINE-STATE>
      <SHORT-NAME>Shutdown</SHORT-NAME>
    </MACHINE-STATE>

    <!-- Valid transitions (SM enforces; invalid requests are rejected) -->
    <MACHINE-STATE-TRANSITION>
      <FROM-STATE-REF>/Machine/States/Startup</FROM-STATE-REF>
      <TO-STATE-REF>/Machine/States/Driving</TO-STATE-REF>
    </MACHINE-STATE-TRANSITION>
    <MACHINE-STATE-TRANSITION>
      <FROM-STATE-REF>/Machine/States/Driving</FROM-STATE-REF>
      <TO-STATE-REF>/Machine/States/Parking</TO-STATE-REF>
    </MACHINE-STATE-TRANSITION>
    <MACHINE-STATE-TRANSITION>
      <FROM-STATE-REF>/Machine/States/Driving</FROM-STATE-REF>
      <TO-STATE-REF>/Machine/States/OTA-Update</TO-STATE-REF>
    </MACHINE-STATE-TRANSITION>
  </MACHINE-STATE-MACHINE>

  <!-- ── Function Groups ──────────────────────────────────────── -->
  <FUNCTION-GROUP>
    <SHORT-NAME>ADASfg</SHORT-NAME>
    <CATEGORY>FUNCTION-GROUP</CATEGORY>

    <FUNCTION-GROUP-STATE>
      <SHORT-NAME>Off</SHORT-NAME>
      <!-- No processes assigned to Off state -->
    </FUNCTION-GROUP-STATE>

    <FUNCTION-GROUP-STATE>
      <SHORT-NAME>Passive</SHORT-NAME>
      <!-- Sensor fusion only; no actuation -->
    </FUNCTION-GROUP-STATE>

    <FUNCTION-GROUP-STATE>
      <SHORT-NAME>Active</SHORT-NAME>
      <!-- All ADAS processes running -->
    </FUNCTION-GROUP-STATE>

    <!-- Valid state transitions within this FunctionGroup -->
    <FUNCTION-GROUP-STATE-TRANSITION>
      <FROM-REF>/FGS/ADASfg/Off</FROM-REF>
      <TO-REF>/FGS/ADASfg/Passive</TO-REF>
    </FUNCTION-GROUP-STATE-TRANSITION>
    <FUNCTION-GROUP-STATE-TRANSITION>
      <FROM-REF>/FGS/ADASfg/Passive</FROM-REF>
      <TO-REF>/FGS/ADASfg/Active</TO-REF>
    </FUNCTION-GROUP-STATE-TRANSITION>
    <FUNCTION-GROUP-STATE-TRANSITION>
      <FROM-REF>/FGS/ADASfg/Active</FROM-REF>
      <TO-REF>/FGS/ADASfg/Passive</TO-REF>
    </FUNCTION-GROUP-STATE-TRANSITION>
  </FUNCTION-GROUP>

  <!-- ── Trigger Mappings: Machine State → FunctionGroup State ── -->
  <!-- When Machine enters "Driving", ADASfg → Active -->
  <MACHINE-STATE-TO-FG-STATE-MAPPING>
    <SHORT-NAME>DrivingToADASActive</SHORT-NAME>
    <MACHINE-STATE-REF>/Machine/States/Driving</MACHINE-STATE-REF>
    <FG-STATE-MAPPING>
      <FUNCTION-GROUP-REF>/FGS/ADASfg</FUNCTION-GROUP-REF>
      <FUNCTION-GROUP-STATE-REF>/FGS/ADASfg/Active</FUNCTION-GROUP-STATE-REF>
    </FG-STATE-MAPPING>
  </MACHINE-STATE-TO-FG-STATE-MAPPING>
</MACHINE-DESIGN>
```

### C++ API

```cpp
#include <ara/sm/state_client.h>
#include <ara/sm/trigger_client.h>

// ── StateClient — request and observe state changes ───────────────────
ara::sm::StateClient sm_client;

// Request FunctionGroup transition (non-blocking; response via Future)
auto future = sm_client.RequestStateTransition(
    "/MachineDesign/FunctionGroups/ADASfg",   // FunctionGroup path
    "Active"                                   // target state
);
auto result = future.get();
if (result.HasValue()) {
    logger.LogInfo() << "ADASfg: Active";
} else {
    // SM rejected the request: invalid transition, prerequisite not met, etc.
    logger.LogError() << "State transition rejected: "
                      << result.Error().Message();
}

// Subscribe to state change notifications (non-blocking)
sm_client.SetStateChangeHandler(
    "/MachineDesign/FunctionGroups/ADASfg",
    [](const std::string& new_state) {
        logger.LogInfo() << "ADASfg state changed -> " << new_state;
        if (new_state == "Active") {
            skeleton_.OfferService();
        } else {
            skeleton_.StopOfferService();
        }
    });

// Query current state
auto state = sm_client.GetCurrentState(
    "/MachineDesign/FunctionGroups/ADASfg").Value();
logger.LogInfo() << "ADASfg is: " << state;

// ── TriggerClient — request Machine State transitions ─────────────────
// (typically called by orchestration or diagnostic application)
ara::sm::TriggerClient trigger_client;

// Request machine-level shutdown
trigger_client.RequestMachineStateTransition("Shutdown");

// Request OTA update mode (stops all non-UCM applications)
trigger_client.RequestMachineStateTransition("OTA-Update");
```

---

## 6. ara::diag — Diagnostics (DIAG)

### Role

`ara::diag` is the AUTOSAR Adaptive API for implementing diagnostic services. It allows an Adaptive Application to:

- Register as a **UDS diagnostic server** (handles services like 0x22 ReadDataByIdentifier, 0x14 ClearDTC, 0x31 RoutineControl)
- Be reachable by **DoIP** (Diagnostics over IP) from an external diagnostic tester
- Provide **DID** (Data Identifier) handlers, **DTC** monitors, and **Routine Control** handlers

### ARXML: Diagnostic Configuration

```arxml
<!-- ── Diagnostic Contribution (what this AA contributes to the server) -->
<DIAGNOSTIC-CONTRIBUTION-SET>
  <SHORT-NAME>RadarDiag_Contributions</SHORT-NAME>

  <!-- ── DID (ReadDataByIdentifier — UDS 0x22) ────────────────── -->
  <DIAGNOSTIC-DATA-IDENTIFIER>
    <SHORT-NAME>RadarStatus_DID</SHORT-NAME>
    <ID>0xF190</ID>   <!-- e.g., 0xF190 = AsciiVin; custom DIDs: 0x0100–0xEFFF -->

    <!-- Read access: 0x22 will call the registered getter -->
    <READ-CLASS-REF DEST="DIAGNOSTIC-READ-DATA-BY-IDENTIFIER">
      /Diag/ReadDataByIdentifier
    </READ-CLASS-REF>

    <!-- Data definition -->
    <DATA-ELEMENT>
      <SHORT-NAME>StatusByte</SHORT-NAME>
      <TYPE-TREF>/DataTypes/uint8</TYPE-TREF>
    </DATA-ELEMENT>
    <DATA-ELEMENT>
      <SHORT-NAME>ObjectCount</SHORT-NAME>
      <TYPE-TREF>/DataTypes/uint16</TYPE-TREF>
    </DATA-ELEMENT>
  </DIAGNOSTIC-DATA-IDENTIFIER>

  <!-- ── DTC (Fault memory) ────────────────────────────────────── -->
  <DIAGNOSTIC-TROUBLE-CODE-OBD>
    <SHORT-NAME>RadarHW_Fault</SHORT-NAME>
    <DTC-VALUE>0xC0100F</DTC-VALUE>   <!-- P-code or OBD format -->
    <FUNCTIONAL-UNIT>0x01</FUNCTIONAL-UNIT>
    <SEVERITY>WWH-OBD-DTC-SEVERITY-REPORT-CONDITIONALLY</SEVERITY>
  </DIAGNOSTIC-TROUBLE-CODE-OBD>

  <!-- ── Routine Control (UDS 0x31) ───────────────────────────── -->
  <DIAGNOSTIC-ROUTINE>
    <SHORT-NAME>CalibrateSensor_Routine</SHORT-NAME>
    <ROUTINE-IDENTIFIER>0x0201</ROUTINE-IDENTIFIER>  <!-- custom ID -->

    <!-- Start/Stop/RequestResult sub-functions -->
    <SUBFUNCTION>
      <SUB-FUNCTION>START</SUB-FUNCTION>
      <PARAMETERS>
        <PARAMETER>
          <SHORT-NAME>CalibMode</SHORT-NAME>
          <TYPE-TREF>/DataTypes/uint8</TYPE-TREF>
          <DIRECTION>IN</DIRECTION>
        </PARAMETER>
      </PARAMETERS>
    </SUBFUNCTION>
    <SUBFUNCTION>
      <SUB-FUNCTION>REQUEST-RESULT</SUB-FUNCTION>
      <RESULT-PARAMETERS>
        <PARAMETER>
          <SHORT-NAME>CalibResult</SHORT-NAME>
          <TYPE-TREF>/DataTypes/uint8</TYPE-TREF>
        </PARAMETER>
      </RESULT-PARAMETERS>
    </SUBFUNCTION>
  </DIAGNOSTIC-ROUTINE>
</DIAGNOSTIC-CONTRIBUTION-SET>

<!-- ── DoIP configuration (how external tester reaches this ECU) ─── -->
<DIAGNOSTIC-ADDRESS>
  <SHORT-NAME>RadarECU_DoIPAddress</SHORT-NAME>
  <LOGICAL-ADDRESS>0x0101</LOGICAL-ADDRESS>   <!-- tester uses this address -->
  <DOIP-CONNECTION>
    <PROTOCOL-VERSION>2</PROTOCOL-VERSION>
    <ANNOUNCE-INTERVAL>1000</ANNOUNCE-INTERVAL>  <!-- ms, vehicle announcement -->
    <VEHICLE-IP-ADDRESS>192.168.1.101</VEHICLE-IP-ADDRESS>
    <ACTIVATION-LINE-DEP>true</ACTIVATION-LINE-DEP>  <!-- needs ignition active -->
  </DOIP-CONNECTION>
</DIAGNOSTIC-ADDRESS>
```

### C++ API

```cpp
#include <ara/diag/uds_transport_protocol_handler.h>
#include <ara/diag/generic_uds_service.h>
#include <ara/diag/dtc_information.h>
#include <ara/diag/routine_control.h>

// ── DID Handler: UDS 0x22 ReadDataByIdentifier ───────────────────────
class RadarDiagHandler {
public:
    void RegisterDIDs() {
        // Register DID 0xF190 read handler
        did_manager_.Register(
            0xF190,
            ara::diag::AccessPermission::kReadOnly,
            [this](ara::diag::MetaInfo meta) -> ara::diag::OperationOutput {
                // Return current radar status
                ara::diag::OperationOutput out;
                out.responseData = {
                    static_cast<uint8_t>(radar_status_),              // StatusByte
                    static_cast<uint8_t>(object_count_ >> 8),         // ObjectCount H
                    static_cast<uint8_t>(object_count_ & 0xFF)        // ObjectCount L
                };
                return out;
            });
    }

    // ── DTC Reporting: UDS 0x19 ReadDTCInformation ──────────────────
    void ReportFault(bool fault_active) {
        ara::diag::DtcInformation dtc_info(0xC0100F);  // matches ARXML DTC value

        if (fault_active) {
            // Set DTC confirmed, test failed bits
            dtc_info.SetTestFailed(ara::diag::TestResult::kTestFailed);
            dtc_info.SetConfirmedDtc(true);
        } else {
            dtc_info.SetTestFailed(ara::diag::TestResult::kTestPassed);
        }
    }

    // ── Routine Control: UDS 0x31 ────────────────────────────────────
    void RegisterRoutine() {
        routine_manager_.Register(
            0x0201,  // routine ID matches ARXML
            // Start handler
            [this](const std::vector<uint8_t>& params,
                   ara::diag::MetaInfo meta) -> ara::diag::OperationOutput {
                uint8_t calib_mode = params.empty() ? 0 : params[0];
                StartCalibration(calib_mode);
                return {0x01};  // routine started response byte
            },
            // Stop handler
            [this](auto, auto) -> ara::diag::OperationOutput {
                StopCalibration();
                return {0x02};
            },
            // RequestResult handler
            [this](auto, auto) -> ara::diag::OperationOutput {
                return {static_cast<uint8_t>(calibration_result_)};
            });
    }

    // ── Security Access: UDS 0x27 ────────────────────────────────────
    // Sensitive DIDs and routines can require security level unlock.
    // ara::diag::SecurityAccess handles seed/key exchange.
    // Configured in ARXML via DIAGNOSTIC-ACCESS-PERMISSION elements.

private:
    ara::diag::DIDManager did_manager_;
    ara::diag::RoutineManager routine_manager_;
    RadarStatus radar_status_ = RadarStatus::kOk;
    uint16_t object_count_ = 0;
    uint8_t calibration_result_ = 0;
};
```

---

## 7. ara::per — Persistency (PER)

### Role

`ara::per` provides persistent storage for Adaptive Applications — data that survives process restarts and machine reboots. Two storage backends are offered:

| Storage Type | Use Case | Analogy |
|---|---|---|
| `KeyValueStorage` | Small configuration values, calibration, counters | AUTOSAR NvM (Classic) |
| `FileStorage` | Larger binary blobs, HD maps, certificate stores | Filesystem with versioning |

### ARXML: Persistency Deployment

```arxml
<!-- ── PersistencyKeyValueStorageInterface (design-time) ──────── -->
<!-- Defined in the Application Component's Port Interface -->
<PERSISTENCY-KEY-VALUE-STORAGE-INTERFACE>
  <SHORT-NAME>RadarConfig_KVSI</SHORT-NAME>

  <!-- Named data elements stored in this KV storage -->
  <KEY-VALUE-PAIR-PROTOTYPE>
    <SHORT-NAME>DetectionThreshold</SHORT-NAME>
    <TYPE-TREF>/DataTypes/Float32</TYPE-TREF>
    <!-- Default value used on first access if key not yet stored -->
    <INIT-VALUE>
      <NUMERICAL-VALUE>0.75</NUMERICAL-VALUE>
    </INIT-VALUE>
  </KEY-VALUE-PAIR-PROTOTYPE>

  <KEY-VALUE-PAIR-PROTOTYPE>
    <SHORT-NAME>CalibrationVersion</SHORT-NAME>
    <TYPE-TREF>/DataTypes/uint32</TYPE-TREF>
    <INIT-VALUE><NUMERICAL-VALUE>0</NUMERICAL-VALUE></INIT-VALUE>
  </KEY-VALUE-PAIR-PROTOTYPE>

  <KEY-VALUE-PAIR-PROTOTYPE>
    <SHORT-NAME>FilterMode</SHORT-NAME>
    <TYPE-TREF>/DataTypes/uint8</TYPE-TREF>
    <INIT-VALUE><NUMERICAL-VALUE>1</NUMERICAL-VALUE></INIT-VALUE>
  </KEY-VALUE-PAIR-PROTOTYPE>
</PERSISTENCY-KEY-VALUE-STORAGE-INTERFACE>

<!-- ── PersistencyDeployment (system integration — maps to filesystem) -->
<PERSISTENCY-KEY-VALUE-STORAGE-DEPLOYMENT>
  <SHORT-NAME>RadarConfig_Deploy</SHORT-NAME>

  <!-- Which KV interface this deploys -->
  <PERSISTENCY-KEY-VALUE-STORAGE-INTERFACE-REF DEST="PERSISTENCY-KEY-VALUE-STORAGE-INTERFACE">
    /Interfaces/RadarConfig_KVSI
  </PERSISTENCY-KEY-VALUE-STORAGE-INTERFACE-REF>

  <!-- Filesystem path where the storage database is created -->
  <URI>/opt/radar/per/radar_config</URI>

  <!-- Redundancy: how many copies are maintained for data integrity -->
  <MAXIMUM-ALLOWED-SIZE-OF-REDUNDANT-AREA>65536</MAXIMUM-ALLOWED-SIZE-OF-REDUNDANT-AREA>
  <REDUNDANCY-HANDLING-CAPABILITIES>
    <REDUNDANCY-ENUM>TRIPLE</REDUNDANCY-ENUM>   <!-- 3× copy voting -->
  </REDUNDANCY-HANDLING-CAPABILITIES>

  <!-- CRC protection per key-value block -->
  <KEY-VALUE-STORAGE-INTEGRITY>
    <INTEGRITY-CONDITION>CRC32</INTEGRITY-CONDITION>
  </KEY-VALUE-STORAGE-INTEGRITY>
</PERSISTENCY-KEY-VALUE-STORAGE-DEPLOYMENT>

<!-- ── File Storage deployment ──────────────────────────────────── -->
<PERSISTENCY-FILE-STORAGE-DEPLOYMENT>
  <SHORT-NAME>RadarMap_Deploy</SHORT-NAME>

  <URI>/opt/radar/per/maps</URI>

  <!-- Maximum total size of all files in this storage -->
  <MAXIMUM-ALLOWED-SIZE>1073741824</MAXIMUM-ALLOWED-SIZE>  <!-- 1 GB -->

  <!-- File elements listed (optional; for validated access) -->
  <FILE-ELEMENT>
    <SHORT-NAME>SensorCalibBlob</SHORT-NAME>
    <CATEGORY>BINARY</CATEGORY>
    <MAX-SIZE>65536</MAX-SIZE>
  </FILE-ELEMENT>
</PERSISTENCY-FILE-STORAGE-DEPLOYMENT>
```

### C++ API

```cpp
#include <ara/per/key_value_storage.h>
#include <ara/per/file_storage.h>

// ── KeyValueStorage ───────────────────────────────────────────────────

// Open returns a Result; always check for error
// Short-name matches PERSISTENCY-KEY-VALUE-STORAGE-INTERFACE SHORT-NAME
auto kvs_result = ara::per::OpenKeyValueStorage("RadarConfig_KVSI");
if (!kvs_result.HasValue()) {
    logger.LogError() << "Cannot open KVS: " << kvs_result.Error().Message();
    std::abort();
}
auto& kvs = kvs_result.Value();

// ── Read a value ──────────────────────────────────────────────────────
// GetValue<T> returns ara::core::Result<T>
auto threshold_result = kvs.GetValue<float>("DetectionThreshold");
if (threshold_result.HasValue()) {
    float threshold = threshold_result.Value();  // 0.75 on first run (init value)
    ApplyThreshold(threshold);
} else {
    // Key not found — use the ARXML init value (platform handles fallback)
    logger.LogWarn() << "DetectionThreshold not set; using default";
}

// ── Write a value ─────────────────────────────────────────────────────
// SetValue does NOT persist immediately — data goes to write-back cache
auto set_result = kvs.SetValue("DetectionThreshold", 0.85f);
if (!set_result.HasValue()) {
    logger.LogError() << "SetValue failed: " << set_result.Error().Message();
}

// Persist the cache to storage (calls msync() / fsync() internally)
// Must be called; not calling it means data may be lost on power-off
auto sync_result = kvs.SyncToStorage();
if (!sync_result.HasValue()) {
    logger.LogError() << "Sync failed: " << sync_result.Error().Message();
}

// ── Remove a key ─────────────────────────────────────────────────────
kvs.RemoveKey("OldCalibrationData");

// ── Iterate all keys ─────────────────────────────────────────────────
auto keys = kvs.GetAllKeys().Value();
for (const auto& key : keys) {
    logger.LogDebug() << "KVS key: " << key;
}

// ── Recover from corruption ───────────────────────────────────────────
// If CRC check fails on a block, ara::per returns an error.
// Application can request recovery (restores from redundant copy)
// or reset to defaults.
if (kvs.RecoverKey("FilterMode") == ara::per::RecoverResult::kRecovered) {
    logger.LogWarn() << "FilterMode recovered from redundant copy";
}

// ── FileStorage ───────────────────────────────────────────────────────
auto fs_result = ara::per::OpenFileStorage("RadarMap_Deploy");
auto& fs = fs_result.Value();

// Write binary blob (sensor calibration)
auto write_result = fs.WriteFile(
    "SensorCalibBlob",
    reinterpret_cast<const uint8_t*>(calib_data.data()),
    calib_data.size());

// Read binary blob
auto read_result = fs.ReadFile("SensorCalibBlob");
if (read_result.HasValue()) {
    auto& blob = read_result.Value();
    LoadCalibration(blob.data(), blob.size());
}

// Delete a file from storage
fs.DeleteFile("OldCalibBlob");

// List files in storage
auto files = fs.GetAllFileNames().Value();
```

### ara::per Redundancy and Integrity

The ARXML `REDUNDANCY-ENUM` setting controls how `ara::per` protects data against storage corruption:

```
NONE      No redundancy. Single copy. Fastest; no protection.
DUAL      Two copies stored. On mismatch → error reported to application.
TRIPLE    Three copies stored. On mismatch → majority vote wins; error to app
          if no majority. Slowest; highest reliability.

CRC32     Each block has a CRC32 appended. Detects single-bit corruption.
CRC64     Stronger CRC — used for safety-relevant stored data.

On corruption detected:
  ara::per::GetValue<T>() returns ara::core::Result with error code
  kRecoveryFailed or kCorrupted.
  Application may call RecoverKey() to restore from redundant copy
  or ResetToDefault() to reload ARXML init value.
```

---

## ARXML → Runtime: Flow Summary for All Seven Clusters

```
  ARXML Element                    Functional Cluster  What it configures at runtime
  ───────────────────────────────────────────────────────────────────────────────────
  SERVICE-INTERFACE                COM / ara::com       Generated Skeleton/Proxy class;
    └─ EVENTS, METHODS, FIELDS                          event, method, field IDs

  PROVIDED-SOMEIP-SERVICE-INSTANCE COM / ara::com       SOME/IP Service ID, Instance ID,
    └─ EVENT-GROUP                                      Event Group ID, multicast addr,
    └─ METHOD-MAPPING                                   Method ID, TCP/UDP port

  EXECUTION-MANIFEST               EXM / ara::exec      process binary path, scheduling
    └─ PROCESS                                          priority, CPU affinity, cgroup
    └─ FUNCTION-GROUP-STATE-IREF                        limits, startup/shutdown timeouts

  LOG-AND-TRACE                    LOG / ara::log       Application ID, Context IDs,
    └─ LOG-CONTEXT                                      default log levels per context,
                                                        log output mode (DLT/file/console)

  HEALTH-CHANNEL-INTERFACE         PHM / ara::phm       Supervision type (alive/deadline/
    └─ ALIVE-SUPERVISION                                logical), timing thresholds,
    └─ DEADLINE-SUPERVISION                             recovery action on failure
    └─ LOGICAL-SUPERVISION

  MACHINE-DESIGN                   STM / ara::sm        Valid Machine States, valid
    └─ MACHINE-STATE-MACHINE                            FunctionGroups, valid state
    └─ FUNCTION-GROUP                                   transitions, Machine State →
    └─ MACHINE-STATE-TO-FG-MAPPING                     FunctionGroup mapping

  DIAGNOSTIC-CONTRIBUTION-SET      DIAG / ara::diag     DIDs (0x22/0x2E), DTCs (0x19),
    └─ DIAGNOSTIC-DATA-IDENTIFIER                       Routines (0x31), security access
    └─ DIAGNOSTIC-TROUBLE-CODE                          levels, DoIP address/port
    └─ DIAGNOSTIC-ROUTINE

  PERSISTENCY-KEY-VALUE-STORAGE    PER / ara::per       Filesystem path, init values,
    └─ KEY-VALUE-PAIR-PROTOTYPE                         CRC mode, redundancy level,
  PERSISTENCY-FILE-STORAGE                              max size, file elements list
```
