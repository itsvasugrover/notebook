---
title: Manifests, Tooling & Update Management
createTime: 2026/03/25 00:00:00
permalink: /kb/embedded/autosar/manifests-tooling/
---

# Manifests, Tooling & Update Management

## The Three AUTOSAR Adaptive Manifests

Every deployed Adaptive Application is described by three ARXML manifest files. Each manifest is authored at a different stage by different roles and serves a distinct purpose:

```
Manifest             Authored by            Purpose
─────────────────────────────────────────────────────────────────────────────
Application Manifest  Software Architect     What the AA is: name, version,
                                             ASIL, service dependencies declared
                                             at design time

Execution Manifest    System Integrator      How the AA runs: which process, 
                                             priority, CPU affinity, memory limit,
                                             environment, FunctionGroup binding

Service Instance      System Integrator      Where to find/offer services:
Manifest                                     transport binding, SOME/IP IDs,
                                             DDS topic mappings, endpoint addresses
```

---

## Application Manifest — Full Reference

The Application Manifest is the design-time description of the Adaptive Application. It captures the software component topology and declares all service interface dependencies.

```arxml
<ADAPTIVE-APPLICATION>
  <SHORT-NAME>RadarProcessingApp</SHORT-NAME>
  <CATEGORY>ADAPTIVE-APPLICATION</CATEGORY>
  
  <!-- Version of this application software -->
  <ADMIN-DATA>
    <DOC-REVISIONS>
      <DOC-REVISION>
        <ISSUE-DATE>2024-01-15</ISSUE-DATE>
        <REVISION-LABEL>2.3.1</REVISION-LABEL>
      </DOC-REVISION>
    </DOC-REVISIONS>
  </ADMIN-DATA>
  
  <!-- Safety classification -->
  <FUNCTIONAL-SAFETY-ELEMENT-IREF>
    <BASE-REF>/SafetyGoals/SG_RadarAvailability</BASE-REF>
    <ASIL-LEVEL>ASIL_B</ASIL-LEVEL>
  </FUNCTIONAL-SAFETY-ELEMENT-IREF>
  
  <!-- Required service interfaces (what this app consumes) -->
  <REQUIRED-SERVICE-INSTANCE-TO-PORT-PROTOTYPE-IREF>
    <SERVICE-INTERFACE-REF>/Interfaces/CameraImageService</SERVICE-INTERFACE-REF>
    <PORT-PROTOTYPE-REF>/RadarProcessingApp/Ports/CameraIn</PORT-PROTOTYPE-REF>
  </REQUIRED-SERVICE-INSTANCE-TO-PORT-PROTOTYPE-IREF>
  
  <!-- Provided service interfaces (what this app offers) -->
  <PROVIDED-SERVICE-INSTANCE-TO-PORT-PROTOTYPE-IREF>
    <SERVICE-INTERFACE-REF>/Interfaces/RadarObjectService</SERVICE-INTERFACE-REF>
    <PORT-PROTOTYPE-REF>/RadarProcessingApp/Ports/ObjectOut</PORT-PROTOTYPE-REF>
  </PROVIDED-SERVICE-INSTANCE-TO-PORT-PROTOTYPE-IREF>
  
  <!-- Declared state interaction -->
  <ACCEPTED-STATE-MANAGEMENT-TRANSITION>
    <FUNCTION-GROUP-REF>/FunctionGroups/ADASFunctionGroup</FUNCTION-GROUP-REF>
  </ACCEPTED-STATE-MANAGEMENT-TRANSITION>
</ADAPTIVE-APPLICATION>
```

---

## Execution Manifest — Full Reference

The Execution Manifest binds the Application Manifest description to a concrete POSIX process configuration. It is written during system integration.

```arxml
<EXECUTION-MANIFEST>
  <SHORT-NAME>RadarProcessingApp_ExecManifest</SHORT-NAME>
  
  <!-- Reference back to Application Manifest -->
  <ADAPTIVE-APPLICATION-REF>/Apps/RadarProcessingApp</ADAPTIVE-APPLICATION-REF>
  
  <PROCESS>
    <SHORT-NAME>RadarProcessingMain</SHORT-NAME>
    
    <!-- Executable path (absolute on deployed filesystem) -->
    <EXECUTABLE>
      <SHORT-NAME>radar_proc_exe</SHORT-NAME>
      <CODE-DESCRIPTOR>/opt/radar/bin/radar_proc</CODE-DESCRIPTOR>
    </EXECUTABLE>
    
    <!-- Arguments passed to main() -->
    <START-UP-OPTION>--config=/etc/radar/default.json</START-UP-OPTION>
    <START-UP-OPTION>--log-level=INFO</START-UP-OPTION>
    
    <!-- Environment variables -->
    <ENVIRONMENT-VARIABLE>
      <SHORT-NAME>RADAR_HW_INTERFACE</SHORT-NAME>
      <VALUE>/dev/spi1</VALUE>
    </ENVIRONMENT-VARIABLE>
    
    <!-- Linux scheduling: SCHED_FIFO priority 60 on CPU cores 2,3 -->
    <SCHEDULING-POLICY>SCHED_FIFO</SCHEDULING-POLICY>
    <SCHEDULING-PRIORITY>60</SCHEDULING-PRIORITY>
    <CPU-AFFINITY>
      <ASSIGNED-PROCESSOR-ID>2</ASSIGNED-PROCESSOR-ID>
      <ASSIGNED-PROCESSOR-ID>3</ASSIGNED-PROCESSOR-ID>
    </CPU-AFFINITY>
    
    <!-- Resource limits (enforced by EM via cgroups) -->
    <RESOURCE-GROUP>
      <CPU-BUDGET-PERCENT>30</CPU-BUDGET-PERCENT>
      <MEMORY-LIMIT-BYTES>536870912</MEMORY-LIMIT-BYTES>  <!-- 512 MB -->
      <MAX-OPEN-FILE-DESCRIPTORS>512</MAX-OPEN-FILE-DESCRIPTORS>
    </RESOURCE-GROUP>
    
    <!-- Linux capabilities required (principle of least privilege) -->
    <LINUX-CAPABILITY>CAP_SYS_NICE</LINUX-CAPABILITY>
    <LINUX-CAPABILITY>CAP_NET_RAW</LINUX-CAPABILITY>
    
    <!-- Timeouts -->
    <STARTUP-TIMEOUT-MS>5000</STARTUP-TIMEOUT-MS>
    <SHUTDOWN-TIMEOUT-MS>3000</SHUTDOWN-TIMEOUT-MS>
    
    <!-- FunctionGroup state this process belongs to -->
    <FUNCTION-GROUP-STATE-IN-PROCESS-IREF>
      <FUNCTION-GROUP-REF>/FGS/ADASFunctionGroup</FUNCTION-GROUP-REF>
      <FUNCTION-GROUP-STATE-REF>/FGS/ADASFunctionGroup/Active</FUNCTION-GROUP-STATE-REF>
    </FUNCTION-GROUP-STATE-IN-PROCESS-IREF>
    
    <!-- Recovery policy if process crashes -->
    <PROCESS-RECOVERY>
      <RECOVERY-ACTION>RESTART</RECOVERY-ACTION>
      <MAX-NUM-RETRY>3</MAX-NUM-RETRY>
      <RESTART-TIME-OFFSET-MS>500</RESTART-TIME-OFFSET-MS>
    </PROCESS-RECOVERY>
  </PROCESS>
</EXECUTION-MANIFEST>
```

---

## Service Instance Manifest — Full Reference

The Service Instance Manifest configures the transport binding for every service instance. Communication Management reads this at startup to know which protocol, IDs, and network endpoints to use.

```arxml
<SERVICE-INSTANCE-MANIFEST>
  <SHORT-NAME>RadarObjectService_SIM</SHORT-NAME>
  
  <!-- ─────────────────────────────────────────────────── -->
  <!-- Provided Instance (SERVER side)                    -->
  <!-- ─────────────────────────────────────────────────── -->
  <PROVIDED-SOMEIP-SERVICE-INSTANCE>
    <SHORT-NAME>RadarService_Provided</SHORT-NAME>
    <SERVICE-INTERFACE-REF>/Interfaces/RadarObjectService</SERVICE-INTERFACE-REF>
    <INSTANCE-ID>1</INSTANCE-ID>
    <SERVICE-ID>0x0101</SERVICE-ID>
    <MAJOR-VERSION>1</MAJOR-VERSION>
    <MINOR-VERSION>3</MINOR-VERSION>
    
    <!-- Service Discovery timing -->
    <OFFER-CYCLIC-DELAY-MS>1000</OFFER-CYCLIC-DELAY-MS>
    <INITIAL-DELAY-MIN-MS>100</INITIAL-DELAY-MIN-MS>
    <INITIAL-DELAY-MAX-MS>200</INITIAL-DELAY-MAX-MS>
    
    <!-- Event deployment -->
    <EVENT-DEPLOYMENT>
      <SHORT-NAME>DetectedObjects_Depl</SHORT-NAME>
      <EVENT-REF>/Interfaces/RadarObjectService/DetectedObjects</EVENT-REF>
      <EVENT-ID>0x8001</EVENT-ID>
      <EVENT-GROUP-ID>1</EVENT-GROUP-ID>
      <TRANSPORT>UDP</TRANSPORT>
      <MULTICAST-GROUP-ADDRESS>239.0.0.1</MULTICAST-GROUP-ADDRESS>
      <MULTICAST-PORT>30101</MULTICAST-PORT>
      <THRESHOLD-SIZE>0</THRESHOLD-SIZE>   <!-- No coalescing; send immediately -->
    </EVENT-DEPLOYMENT>
    
    <!-- Method deployment -->
    <METHOD-DEPLOYMENT>
      <SHORT-NAME>ResetFilter_Depl</SHORT-NAME>
      <METHOD-REF>/Interfaces/RadarObjectService/ResetDetectionFilter</METHOD-REF>
      <METHOD-ID>0x0001</METHOD-ID>
      <TRANSPORT>TCP</TRANSPORT>
      <PORT>30100</PORT>
      <RESPONSE-TIMEOUT-MS>500</RESPONSE-TIMEOUT-MS>
    </METHOD-DEPLOYMENT>
  </PROVIDED-SOMEIP-SERVICE-INSTANCE>
  
  <!-- ─────────────────────────────────────────────────── -->
  <!-- Required Instance (CLIENT side on PathPlanning ECU) -->
  <!-- ─────────────────────────────────────────────────── -->
  <REQUIRED-SOMEIP-SERVICE-INSTANCE>
    <SHORT-NAME>RadarService_Required</SHORT-NAME>
    <SERVICE-INTERFACE-REF>/Interfaces/RadarObjectService</SERVICE-INTERFACE-REF>
    <INSTANCE-ID>1</INSTANCE-ID>
    <SERVICE-ID>0x0101</SERVICE-ID>
    
    <!-- Events to subscribe to -->
    <CONSUMED-EVENT-GROUP>
      <EVENT-GROUP-ID>1</EVENT-GROUP-ID>
    </CONSUMED-EVENT-GROUP>
  </REQUIRED-SOMEIP-SERVICE-INSTANCE>
</SERVICE-INSTANCE-MANIFEST>
```

---

## ARXML ServiceInterface Data Type Definition

```arxml
<!-- Reusable data types referenced by the ServiceInterface -->
<IMPLEMENTATION-DATA-TYPE>
  <SHORT-NAME>RadarObject</SHORT-NAME>
  <CATEGORY>STRUCTURE</CATEGORY>
  <SUB-ELEMENTS>
    <IMPLEMENTATION-DATA-TYPE-ELEMENT>
      <SHORT-NAME>object_id</SHORT-NAME>
      <TYPE-TREF>/DataTypes/uint16</TYPE-TREF>
    </IMPLEMENTATION-DATA-TYPE-ELEMENT>
    <IMPLEMENTATION-DATA-TYPE-ELEMENT>
      <SHORT-NAME>distance_m</SHORT-NAME>
      <TYPE-TREF>/DataTypes/float32</TYPE-TREF>
    </IMPLEMENTATION-DATA-TYPE-ELEMENT>
    <IMPLEMENTATION-DATA-TYPE-ELEMENT>
      <SHORT-NAME>velocity_ms</SHORT-NAME>
      <TYPE-TREF>/DataTypes/float32</TYPE-TREF>
    </IMPLEMENTATION-DATA-TYPE-ELEMENT>
    <IMPLEMENTATION-DATA-TYPE-ELEMENT>
      <SHORT-NAME>azimuth_rad</SHORT-NAME>
      <TYPE-TREF>/DataTypes/float32</TYPE-TREF>
    </IMPLEMENTATION-DATA-TYPE-ELEMENT>
  </SUB-ELEMENTS>
</IMPLEMENTATION-DATA-TYPE>

<IMPLEMENTATION-DATA-TYPE>
  <SHORT-NAME>ObjectList</SHORT-NAME>
  <CATEGORY>ARRAY</CATEGORY>
  <ARRAY-SIZE>64</ARRAY-SIZE>
  <ELEMENT-TYPE-TREF>/DataTypes/RadarObject</ELEMENT-TYPE-TREF>
</IMPLEMENTATION-DATA-TYPE>
```

---

## UCM (Update and Configuration Management) — Complete Coverage

UCM is the OTA update Functional Cluster of AUTOSAR Adaptive. It manages the complete lifecycle of software packages on the vehicle.

### UCM Architecture

```
OEM Backend                      Vehicle
─────────────────                ──────────────────────────────────────────
                                 ┌────────────────────────────────────────┐
Campaign Manager                 │  UCM Master (orchestrates vehicle      │
   │                             │  updates across multiple ECUs)         │
   │  Vehicle Software Package   │       │                                │
   │──────────────────────────►  │       │  UCM Worker per domain ECU     │
   │  (via HTTPS/MQTT/OTA proto) │       ├─► UCM Worker (ADAS ECU)        │
                                 │       ├─► UCM Worker (Body ECU)        │
                                 │       └─► UCM Worker (Powertrain ECU)  │
                                 └────────────────────────────────────────┘
```

### UCM Software Package Format

```
AUTOSAR UCM SoftwarePackage:

  update_package.UCMPackage
  ├── manifest.arxml          ← Package manifest (ARXML)
  │   ├── Package name and version
  │   ├── Target ECU / platform
  │   ├── Activation prerequisites
  │   ├── Rollback policy
  │   └── Dependency declarations
  ├── software/
  │   ├── radar_proc          ← New binary
  │   ├── libara_extension.so ← New shared library
  │   └── config/
  │       └── radar.json      ← Updated configuration
  └── verification/
      ├── signature.p7s       ← PKCS#7 signature (OEM private key)
      └── hash_manifest.json  ← SHA-256 of every file
```

Package manifest ARXML:
```arxml
<ADAPTIVE-SOFTWARE-CLUSTER-TO-DEPLOYMENT>
  <SHORT-NAME>RadarApp_v2_3_1_Package</SHORT-NAME>
  
  <VERSION>
    <MAJOR>2</MAJOR>
    <MINOR>3</MINOR>
    <PATCH>1</PATCH>
  </VERSION>
  
  <!-- Which software cluster this updates -->
  <SOFTWARE-CLUSTER-REF>/Clusters/RadarProcessingCluster</SOFTWARE-CLUSTER-REF>
  
  <!-- Minimum existing version required before this can be applied -->
  <MINIMUM-SUPPORTED-UCM-VERSION>
    <MAJOR>1</MAJOR><MINOR>0</MINOR>
  </MINIMUM-SUPPORTED-UCM-VERSION>
  
  <!-- Can we roll back to this version if activation fails? -->
  <ROLLBACK-SUPPORTED>true</ROLLBACK-SUPPORTED>
  
  <!-- What to do on activation: restart just the app, or reboot machine? -->
  <ACTIVATION-ACTION>RESTART_APPLICATION</ACTIVATION-ACTION>
</ADAPTIVE-SOFTWARE-CLUSTER-TO-DEPLOYMENT>
```

### OTA Update Flow — End-to-End

```
Step  Actor              Action
────────────────────────────────────────────────────────────────────────────
 1   OEM Backend         Builds and signs UpdatePackage; uploads to CDN
 
 2   Telematics Client   On vehicle: downloads package (HTTPS TLS 1.3)
                         Stores in /tmp/update/ (pre-reserved partition)
 
 3   UCM Master          Receives package transfer notification from
                         Telematics Client via ara::com method call
 
 4   UCM Worker (ADAS)   ara::ucm::PackageManager.TransferStart(package_size)
                         Returns: transfer ID
 
 5   Telematics          Splits package into chunks; calls
                         ara::ucm::PackageManager.TransferData(chunk)
                         for each chunk
 
 6   UCM Worker          Assembles package, verifies:
                         - SHA-256 hash of each file
                         - PKCS#7 signature against OEM Root CA
                         → If verification fails: reject, report error
 
 7   UCM Worker          TransferExit() — package is valid and staged
 
 8   SM                  UCM Master triggers SM: request OTAFunctionGroup→Updating
                         (stops ADAS applications, keeps UCM + safety shell)
 
 9   UCM Worker          ProcessSwPackage() — installs binaries:
                         - Writes new binary to inactive partition
                         - Updates symlinks
                         - Updates package metadata database
 
10   UCM Worker          Reports kInstalled state
 
11   SM                  Triggers machine restart OR restarts specific processes
 
12   EM / System         New version boots; runs startup tests
 
13   UCM Master          Verifies new version running correctly (health check)
                         If OK: Activate() — marks new version as permanent
                         If fail: Rollback() — reverts to previous version
                         
14   UCM Worker          Rollback: restores previous binary from backup partition
                         Restarts process; reports kRolledBack
```

### UCM C++ API

```cpp
#include <ara/ucm/package_manager.h>

// Initialize UCM client
ara::ucm::PackageManager pkg_mgr;

// Query installed packages
auto packages = pkg_mgr.GetSwPackages();
for (const auto& pkg : packages) {
    logger.LogInfo() << "Package: " << pkg.Name() 
                     << " Version: " << pkg.Version().Major() 
                     << "." << pkg.Version().Minor();
}

// Install a new package (called by update orchestrator)
auto transfer_id = pkg_mgr.TransferStart(package_size_bytes);

for (const auto& chunk : chunked_data) {
    pkg_mgr.TransferData(transfer_id, chunk);
}

pkg_mgr.TransferExit(transfer_id);

// Process (install to inactive partition)
auto process_result = pkg_mgr.ProcessSwPackage(transfer_id);
if (process_result == ara::ucm::PackageManagementStatus::kInstalled) {
    // Request SM to restart
    sm_client.RequestStateTransition("MachineFG", "Restart");
}

// After restart — confirm activation or rollback
if (post_boot_health_check_ok) {
    pkg_mgr.Activate(transfer_id);
} else {
    pkg_mgr.Rollback(transfer_id);
}
```

---

## Tool Landscape for AUTOSAR Adaptive

| Tool | Vendor | Purpose |
|------|--------|---------|
| MICROSAR.AP | Vector Informatik | Complete AUTOSAR Adaptive platform implementation; code generation from ARXML; SOME/IP stack; UCM |
| EB corbos AdaptiveCore | Elektrobit (EB) | Full Adaptive Platform; supports Linux and QNX |
| ETAS RTA-A | ETAS (Bosch Group) | Adaptive Platform runtime; strong in powertrain and safety domains |
| SystemDesk | Vector Informatik | ARXML system modeling tool; creates Application/Execution/Service Instance Manifests |
| PREEvision | Vector Informatik | Network and ECU architecture design; generates ARXML for deployment |
| AUTOSAR Builder | AUTOSAR / Eclipse | Open-source ARXML editor; metamodel validation |
| DaVinci Configurator | Vector | Configuration tool for Classic; being extended to Adaptive |
| CANalyzer / CANoe | Vector | Protocol analysis; SOME/IP monitoring and simulation; supports Adaptive testing |
| SIL Kit | Vector | Software-in-the-loop simulation bus for Adaptive applications |
| Trace32 | Lauterbach | JTAG debugger supporting Adaptive; debug C++ with full OS-awareness |
| DLT Viewer | Open Source | Diagnostic Log and Trace viewer for ara::log output |
| CMake + Conan | Open Source | Build system and package manager for Adaptive C++ components |
