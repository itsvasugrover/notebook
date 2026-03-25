---
title: Execution Management & State Management
createTime: 2026/03/25 00:00:00
permalink: /kb/embedded/autosar/execution-management/
---

# Execution Management & State Management

## Overview

Two Functional Clusters jointly govern the lifecycle of all software on an AUTOSAR Adaptive machine:

| Cluster | Short Name | Responsibility |
|---------|------------|----------------|
| Execution Management | EM | Start, monitor, and terminate individual Adaptive Applications (POSIX processes) |
| State Management | SM | Orchestrate system-level state transitions that determine which applications are running |

They work in a hierarchical relationship: **SM decides what should run → EM makes it happen**.

---

## Execution Management (EM) in Depth

### Core Responsibility

EM is the first AUTOSAR Adaptive service to start after the OS boots. It reads the **Execution Manifest** of every deployed Adaptive Application and:

1. Determines which processes to launch during startup
2. Forks and executes each process (`fork()` + `exec()`)
3. Monitors process health
4. Applies recovery actions on process failure
5. Terminates processes gracefully during shutdown

### Process Model

Each Adaptive Application (AA) runs as a **separate POSIX process**. This is a fundamental architectural principle:

```
Machine
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Execution Management Process (PID 2, elevated privilege)
    │
    ├── AA: RadarProcessing   (PID 101, /opt/radar/bin/radar_proc)
    ├── AA: PathPlanning      (PID 102, /opt/path/bin/path_plan)
    ├── AA: DiagnosticsApp    (PID 103, /opt/diag/bin/diag_app)
    └── AA: OTAManager        (PID 104, /opt/ota/bin/ota_mgr)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  AUTOSAR Adaptive Platform (Middleware)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  POSIX OS (Linux / QNX)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

Process isolation means:
- Memory faults in one AA cannot corrupt another AA's memory
- EM can kill and restart a misbehaving AA without affecting the platform
- Each AA runs with minimum required OS permissions (least privilege principle)

### Application Process Lifecycle State Machine

```
               ┌─────────────┐
    Start()    │             │
  ─────────────►  Initializing│
               │             │
               └──────┬──────┘
                      │ ReportApplicationState(kRunning)
                      ▼
               ┌─────────────┐
               │             │
               │   Running   │◄─────────────────────────┐
               │             │                           │
               └──────┬──────┘                   Restart (if recovery
                      │                                policy = restart)
          SIGTERM      │  ReportApplicationState(kTerminating)
          received     │  or EM requests shutdown
                      ▼
               ┌─────────────┐
               │             │
               │ Terminating │
               │             │
               └──────┬──────┘
                      │ process exits (exit(0))
                      ▼
               ┌─────────────┐
               │  Terminated │  EM records exit, decides next action
               └─────────────┘
```

**Application Responsibility**: Applications must call `ara::exec::ApplicationClient::ReportApplicationState()` to inform EM of their state transitions. EM waits for each state report within a configured timeout.

```cpp
#include <ara/exec/application_client.h>

int main() {
    ara::exec::ApplicationClient app_client;
    
    // --- Initialization Phase ---
    // Set up threads, connect to services, load config
    InitializeHardware();
    LoadCalibrationData();
    ConnectToServices();
    
    // Signal to EM that we're ready
    app_client.ReportApplicationState(ara::exec::ApplicationState::kRunning);
    
    // --- Running Phase ---
    while (!shutdown_requested) {
        DoWork();
        
        // Check for shutdown signal
        if (ShouldShutdown()) {
            break;
        }
    }
    
    // --- Termination Phase ---
    app_client.ReportApplicationState(ara::exec::ApplicationState::kTerminating);
    
    // Clean up resources — must complete before OS terminates the process
    CleanupHardware();
    FlushLogs();
    
    return 0;  // EM observes clean exit
}
```

### EM Timeout Handling

EM enforces timeouts on each state transition:

```
  EM action                    What happens on timeout
  ─────────────────────────────────────────────────────────────────────
  Wait for kRunning report     EM marks AA as failed; applies recovery
  Wait for kTerminating report After SIGTERM + timeout → sends SIGKILL
  Wait for process exit        After SIGKILL + timeout → marks as failed
```

Timeouts are configured in the Execution Manifest:
```arxml
<PROCESS>
  <SHORT-NAME>RadarProcessingMain</SHORT-NAME>
  <STARTUP-PROCESS-TIMEOUT>5000</STARTUP-PROCESS-TIMEOUT>  <!-- ms -->
  <SHUTDOWN-PROCESS-TIMEOUT>3000</SHUTDOWN-PROCESS-TIMEOUT>
</PROCESS>
```

### Execution Manifest — Full Structure

The Execution Manifest is an ARXML file that EM reads to configure each process:

```arxml
<ADAPTIVE-APPLICATION>
  <SHORT-NAME>RadarProcessingApp</SHORT-NAME>
  <CATEGORY>APPLICATION</CATEGORY>
  
  <PROCESS>
    <SHORT-NAME>RadarProcessingMain</SHORT-NAME>
    
    <!-- Binary to execute -->
    <EXECUTABLE>
      <SHORT-NAME>radar_proc</SHORT-NAME>
      <CODE-DESCRIPTOR>/opt/radar/bin/radar_proc</CODE-DESCRIPTOR>
    </EXECUTABLE>
    
    <!-- Command-line arguments -->
    <START-UP-OPTION>
      <SHORT-NAME>ConfigFile</SHORT-NAME>
      <OPTION-VALUE>--config=/etc/radar/radar.json</OPTION-VALUE>
    </START-UP-OPTION>
    
    <!-- Environment variables -->
    <ENV-VAR>
      <SHORT-NAME>LOG_LEVEL</SHORT-NAME>
      <VALUE>DEBUG</VALUE>
    </ENV-VAR>
    
    <!-- Scheduling configuration -->
    <SCHEDULING-POLICY>SCHED_FIFO</SCHEDULING-POLICY>
    <SCHEDULING-PRIORITY>60</SCHEDULING-PRIORITY>  <!-- 0=lowest, 99=highest for FIFO -->
    <CPU-AFFINITY>
      <CPU-CORE-ID>2</CPU-CORE-ID>
      <CPU-CORE-ID>3</CPU-CORE-ID>
    </CPU-AFFINITY>
    
    <!-- Resource limits -->
    <RESOURCE-GROUP>
      <SHORT-NAME>RadarResourceGroup</SHORT-NAME>
      <CPU-BUDGET>30</CPU-BUDGET>          <!-- 30% CPU budget -->
      <MEMORY-LIMIT>512000000</MEMORY-LIMIT>  <!-- 512 MB -->
      <MAX-FD-LIMIT>256</MAX-FD-LIMIT>
    </RESOURCE-GROUP>
    
    <!-- Startup timeout -->
    <STARTUP-PROCESS-TIMEOUT>5000</STARTUP-PROCESS-TIMEOUT>
    <SHUTDOWN-PROCESS-TIMEOUT>3000</SHUTDOWN-PROCESS-TIMEOUT>
    
    <!-- Function Group association -->
    <FUNCTION-GROUP-REF>/FunctionGroups/MachineFG</FUNCTION-GROUP-REF>
    <FUNCTION-GROUP-STATE-REF>/FunctionGroups/MachineFG/Running</FUNCTION-GROUP-STATE-REF>
  </PROCESS>
</ADAPTIVE-APPLICATION>
```

### Recovery Actions

When a process fails (unexpected termination, crash, or timeout), EM applies a configured recovery action:

```
Recovery Policy         Behavior
──────────────────────────────────────────────────────────────────────────
NO_RESTART              Process is not restarted; EM notifies PHM and SM
RESTART_PROCESS         EM immediately restarts the process; limited retries
RESTART_WITH_BACKOFF    Restart with increasing delay (1s, 2s, 4s, 8s...)
ESCALATE_TO_SM          EM notifies SM, which may trigger a state change
              
Configured in Execution Manifest:
<RECOVERY-ACTION>
  <RECOVERY-POLICY>RESTART_WITH_BACKOFF</RECOVERY-POLICY>
  <MAX-RESTART-ATTEMPTS>3</MAX-RESTART-ATTEMPTS>
  <RESTART-BACKOFF-MS>1000</RESTART-BACKOFF-MS>
</RECOVERY-ACTION>
```

After exceeding max restart attempts, EM escalates to SM or enters a machine-level error state.

---

## State Management (SM) in Depth

### Role of SM

SM is the **system-level orchestrator**. It manages the high-level operational state of the entire Adaptive machine. SM:

1. Defines the **Machine State** (the overarching system mode)
2. Manages **Function Groups** (logical groups of related applications)
3. Requests EM to start/stop specific process groups based on state transitions
4. Handles recovery escalation from EM/PHM

### Machine State

The Machine State represents the top-level operating mode of the vehicle ECU:

```
                          ┌─────────────┐
                          │   Startup   │  Entered immediately at OS boot
                          └──────┬──────┘
                                 │ (platform services initialized)
                                 ▼
                 ┌───────────────────────────────┐
                 │          Driving Mode         │  Normal vehicle operation
                 │  (Function Groups: All apps)  │
                 └─────────────┬─────────────────┘
              ┌────────────────┤
              │ OTA trigger    │ remote diagnostics trigger
              ▼                ▼
    ┌──────────────┐   ┌──────────────────────────────┐
    │ Update Mode  │   │    Diagnostic Mode           │
    │ (Only UCM,   │   │  (Full stack + Diag server)  │
    │  OTA apps)   │   │                              │
    └──────┬───────┘   └──────────────────────────────┘
           │ (update complete)
           ▼
    ┌──────────────┐
    │  Restart     │   Reboots the machine; returns to Startup on next boot
    └──────────────┘

    ┌──────────────┐
    │  Shutdown    │   Graceful system shutdown; EM terminates all processes
    └──────────────┘
```

SM standard states (from AUTOSAR specification):

| State | Description |
|-------|-------------|
| `Startup` | Initial state; platform services start; no user-facing functionality |
| `Driving` | Full vehicle operation; all AAs active |
| `Parking` | Reduced set of AAs; lower power; park assist features active |
| `OTA_Update` | Only UCM and Update-related AAs active |
| `Vehicle_Service` | Workshop diagnostic mode |
| `Shutdown` | Graceful stop of all processes → machine powers down |
| `Restart` | Graceful stop → reboot |
| `Error` | Unrecoverable error; limited function safe state |

### Function Groups and Function Group States

A **Function Group** is a logical grouping of related Adaptive Applications that are controlled as a unit. Every Adaptive Application belongs to at least one Function Group.

```
Machine
├── Function Group: MachineFG           (mandatory — represents the machine itself)
│   ├── State: Off          → No processes running
│   ├── State: Startup      → Platform services only
│   └── State: Running      → All normal-mode processes
│
├── Function Group: ADASFunctionGroup
│   ├── State: Off          → No ADAS processes
│   ├── State: Passive      → Monitoring only, no actuation
│   └── State: Active       → Full ADAS pipeline running
│
├── Function Group: OTAFunctionGroup
│   ├── State: Off          → UCM idle
│   └── State: Updating     → UCM + download agent active
│
└── Function Group: DiagFunctionGroup
    ├── State: Off          → Diag server stopped
    └── State: Active       → UDS Diagnostic server active
```

State transitions are expressed in ARXML:

```arxml
<FUNCTION-GROUP>
  <SHORT-NAME>ADASFunctionGroup</SHORT-NAME>
  
  <FUNCTION-GROUP-STATE>
    <SHORT-NAME>Off</SHORT-NAME>
    <!-- No processes in Off state -->
  </FUNCTION-GROUP-STATE>
  
  <FUNCTION-GROUP-STATE>
    <SHORT-NAME>Passive</SHORT-NAME>
    <PROCESS-IN-MACHINE-STATE-IREF>
      <BASE-REF>/Apps/SensorFusion</BASE-REF>
    </PROCESS-IN-MACHINE-STATE-IREF>
  </FUNCTION-GROUP-STATE>
  
  <FUNCTION-GROUP-STATE>
    <SHORT-NAME>Active</SHORT-NAME>
    <PROCESS-IN-MACHINE-STATE-IREF>
      <BASE-REF>/Apps/SensorFusion</BASE-REF>
    </PROCESS-IN-MACHINE-STATE-IREF>
    <PROCESS-IN-MACHINE-STATE-IREF>
      <BASE-REF>/Apps/PathPlanning</BASE-REF>
    </PROCESS-IN-MACHINE-STATE-IREF>
    <PROCESS-IN-MACHINE-STATE-IREF>
      <BASE-REF>/Apps/ActuatorControl</BASE-REF>
    </PROCESS-IN-MACHINE-STATE-IREF>
  </FUNCTION-GROUP-STATE>
</FUNCTION-GROUP>
```

### ara::sm Client API

Applications interact with SM via `ara::sm`:

```cpp
#include <ara/sm/state_client.h>

// Request a state change (application can request SM to change state)
ara::sm::StateClient state_client;

// Request that ADASFunctionGroup transitions to Active
auto future = state_client.RequestStateTransition(
    "ADASFunctionGroup",
    "Active"
);

auto result = future.get();
if (result.HasValue()) {
    logger.LogInfo() << "ADAS state transition accepted";
} else {
    logger.LogError() << "State transition rejected: " << result.Error().Message();
}

// Subscribe to state change notifications
state_client.SubscribeToStateChange(
    "ADASFunctionGroup",
    [](const std::string& fg_name, const std::string& new_state) {
        logger.LogInfo() << fg_name << " is now in state: " << new_state;
    }
);
```

### SM ↔ EM ↔ PHM Interaction

```
  Application crash
       │
       ▼
  EM detects process died unexpectedly
       │
       ├───► Attempt restart (if restart policy configured)
       │         │
       │         └─► Max retries exceeded → Escalate to SM
       │
       └───► Notify PHM of supervised entity failure
                   │
                   ▼
             PHM evaluates recovery action:
             ─ RecoveryToDefaultState → SM transitions FunctionGroup to Off → SM transitions to Error machine state
             ─ ResetMachine → SM triggers Restart
             ─ NotifyApplication → SM notifies a designated watchdog AA
```

---

## EM Privilege Model

EM runs with elevated privileges to:
- Set SCHED_FIFO priorities (requires `CAP_SYS_NICE`)
- Set CPU affinity (`CAP_SYS_NICE`)
- Create cgroups for resource isolation (`cgroup` filesystem access)
- Start processes with specific UIDs/GIDs from the Execution Manifest

All AAs run with reduced privileges (non-root, applied capabilities only). This is enforced via:
- Linux capabilities (fine-grained privilege control)
- User/group namespaces
- cgroup v2 for CPU and memory budget enforcement
- seccomp filters (optional, restrict available syscalls per process)

---

## Execution Manifest vs Application Manifest vs Service Instance Manifest

| Manifest | Owner | Contains |
|----------|-------|----------|
| Application Manifest | AA developer | Software component topology, version, categories |
| Execution Manifest | System integrator | Process→FunctionGroup binding, scheduling, resources |
| Service Instance Manifest | System integrator | Transport binding config (SOME/IP service IDs, DDS topic mapping) |
