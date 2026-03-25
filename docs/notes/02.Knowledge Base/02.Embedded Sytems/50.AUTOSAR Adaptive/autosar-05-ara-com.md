---
title: ara::com — Communication API
createTime: 2026/03/25 00:00:00
permalink: /kb/embedded/autosar/ara-com/
---

# ara::com — Communication API

## Overview

`ara::com` is the AUTOSAR Adaptive communication API. It provides a **service-oriented communication** model where:
- A **Skeleton** acts as the server — it offers a service with events, methods, and fields
- A **Proxy** acts as the client — it discovers and consumes a service

The API is **generated** from a service interface definition in ARXML using AUTOSAR code generation tools, ensuring the interface contract is strictly typed and consistent between provider and consumer.

---

## Service Interface Model

A service interface in AUTOSAR Adaptive has three communication elements:

### Events
Asynchronous, unidirectional data transmission from the service provider to all subscribers.

```
Analogy: Event = ROS2 Topic = MQTT message = CAN signal (periodic)
Use case: "New camera frame available", "Object detection updated", 
          "Vehicle speed changed"
```

### Methods
Synchronous or asynchronous request-response calls from client to server.

```
Analogy: Method = RPC call = REST HTTP GET/POST
Use case: "Request emergency stop", "Get DTC list", "Compute optimal path"
```

### Fields
Named data items with get/set/notify semantics. Similar to a property with a change notification event.

```
Analogy: Field = OPC-UA Node = AUTOSAR Classic NvM parameter with callback
Use case: "Current gear position", "Headlight intensity (adjustable)", 
          "System temperature (monitored)"
```

---

## Service Interface Definition in ARXML

```arxml
<SERVICE-INTERFACE>
  <SHORT-NAME>RadarObjectService</SHORT-NAME>
  
  <!-- Events -->
  <EVENTS>
    <VARIABLE-DATA-PROTOTYPE>
      <SHORT-NAME>DetectedObjects</SHORT-NAME>
      <TYPE-TREF>/DataTypes/ObjectList</TYPE-TREF>
    </VARIABLE-DATA-PROTOTYPE>
  </EVENTS>
  
  <!-- Methods -->
  <METHODS>
    <CLIENT-SERVER-OPERATION>
      <SHORT-NAME>ResetDetectionFilter</SHORT-NAME>
      <ARGUMENTS>
        <ARGUMENT-DATA-PROTOTYPE>
          <SHORT-NAME>filter_mode</SHORT-NAME>
          <TYPE-TREF>/DataTypes/FilterMode</TYPE-TREF>
          <DIRECTION>IN</DIRECTION>
        </ARGUMENT-DATA-PROTOTYPE>
      </ARGUMENTS>
      <RETURN-VALUE>
        <TYPE-TREF>/DataTypes/ErrorCode</TYPE-TREF>
      </RETURN-VALUE>
    </CLIENT-SERVER-OPERATION>
  </METHODS>
  
  <!-- Fields -->
  <FIELDS>
    <FIELD>
      <SHORT-NAME>DetectionThreshold</SHORT-NAME>
      <TYPE-TREF>/DataTypes/Float32</TYPE-TREF>
      <HAS-GETTER>true</HAS-GETTER>
      <HAS-SETTER>true</HAS-SETTER>
      <HAS-NOTIFIER>true</HAS-NOTIFIER>
    </FIELD>
  </FIELDS>
</SERVICE-INTERFACE>
```

From this ARXML, the code generator produces:
- `radar_object_service_skeleton.h` — Server-side base class
- `radar_object_service_proxy.h` — Client-side proxy class

---

## Skeleton — Service Provider Side

```cpp
// Generated skeleton base class (do not edit — auto-generated)
// radar_object_service_skeleton.h
namespace ara::vehicle::radar {

class RadarObjectServiceSkeleton {
public:
    // Constructor: registers service with Communication Management
    explicit RadarObjectServiceSkeleton(ara::com::InstanceIdentifier instance_id);
    
    // Call to make the service discoverable by clients
    void OfferService();
    
    // Call to stop offering the service
    void StopOfferService();
    
    // Pure virtual: application implements detection logic; result triggers event
    virtual void ResetDetectionFilter(FilterMode filter_mode, 
                                       ara::com::Promise<ErrorCode>&& promise) = 0;
    
    // Event sender: application calls this to publish new data
    ara::com::SampleAllocateePtr<ObjectList> DetectedObjects.Allocate();
    ara::core::Result<void> DetectedObjects.Send(
        ara::com::SampleAllocateePtr<ObjectList>&& data);
    
    // Field accessors
    void DetectionThreshold.Update(float new_value);
    float DetectionThreshold.Get();
};

} // namespace
```

```cpp
// Application-level implementation (developer writes this)
// my_radar_skeleton.cpp
#include "radar_object_service_skeleton.h"
#include <ara/log/logging.h>

class MyRadarSkeleton : public ara::vehicle::radar::RadarObjectServiceSkeleton {
public:
    MyRadarSkeleton() 
        : RadarObjectServiceSkeleton(ara::com::InstanceIdentifier{"RadarFront_1"}) {}
    
    // Implement the method handler
    void ResetDetectionFilter(FilterMode mode, 
                               ara::com::Promise<ErrorCode>&& promise) override {
        logger_.LogInfo() << "ResetDetectionFilter called with mode: " 
                          << static_cast<int>(mode);
        
        // Reset internal state...
        detection_filter_.Reset(mode);
        
        // Resolve the promise → sends response to caller
        promise.set_value(ErrorCode::kOk);
    }
    
    // Called from main loop when new radar data arrives
    void PublishDetectedObjects(const ObjectList& objects) {
        auto sample = DetectedObjects.Allocate();
        *sample = objects;  // copy data into zero-copy buffer
        DetectedObjects.Send(std::move(sample));
    }

private:
    ara::log::Logger& logger_ = ara::log::CreateLogger("RDAR", "Radar skeleton");
    DetectionFilter detection_filter_;
};

int main() {
    ara::exec::ApplicationClient app_client;
    
    MyRadarSkeleton skeleton;
    skeleton.OfferService();  // Now discoverable
    
    app_client.ReportApplicationState(ara::exec::ApplicationState::kRunning);
    
    while (true) {
        auto frame = radar_hw_.ReadFrame();
        auto objects = ProcessFrame(frame);
        skeleton.PublishDetectedObjects(objects);
        std::this_thread::sleep_for(std::chrono::milliseconds(50)); // 20 Hz
    }
}
```

---

## Proxy — Service Consumer Side

```cpp
// Generated proxy class (auto-generated from ARXML)
// radar_object_service_proxy.h
namespace ara::vehicle::radar {

class RadarObjectServiceProxy {
public:
    // Find service instances
    static ara::com::ServiceHandleContainer<RadarObjectServiceProxy> 
        FindService(ara::com::InstanceIdentifier instance_id);
    
    static ara::com::FindServiceHandle 
        StartFindService(ara::com::FindServiceHandler<RadarObjectServiceProxy> handler,
                         ara::com::InstanceIdentifier instance_id);
    
    // Event subscription
    ara::com::SampleCache<ObjectList> DetectedObjects;
    
    // Method calls (return Future<> for async)
    ara::core::Future<ErrorCode> ResetDetectionFilter(FilterMode filter_mode);
    
    // Field operations
    ara::core::Future<float> DetectionThreshold.Get();
    ara::core::Future<void> DetectionThreshold.Set(float value);
    ara::com::SampleCache<float> DetectionThreshold.Changed;  // field change notification
};

} // namespace
```

```cpp
// Application using the proxy (developer writes this)
// path_planning.cpp
#include "radar_object_service_proxy.h"

class PathPlanningApp {
public:
    void Initialize() {
        // Option 1: Synchronous find (blocks until found or timeout)
        auto handles = RadarObjectServiceProxy::FindService(
            ara::com::InstanceIdentifier{"RadarFront_1"});
        
        if (!handles.empty()) {
            radar_proxy_ = std::make_unique<RadarObjectServiceProxy>(handles[0]);
        }
        
        // Option 2: Async find (callbacks when service appears/disappears)
        RadarObjectServiceProxy::StartFindService(
            [this](auto handles, auto find_handle) {
                if (!handles.empty()) {
                    radar_proxy_ = std::make_unique<RadarObjectServiceProxy>(handles[0]);
                    SubscribeToEvents();
                }
            },
            ara::com::InstanceIdentifier::Any  // any instance
        );
    }
    
    void SubscribeToEvents() {
        // Subscribe with max sample cache size
        radar_proxy_->DetectedObjects.Subscribe(10 /* max cache size */);
        
        // Set receive handler (called when new data arrives)
        radar_proxy_->DetectedObjects.SetReceiveHandler([this]() {
            ProcessNewObjects();
        });
    }
    
    void ProcessNewObjects() {
        // Get all new samples from the cache
        radar_proxy_->DetectedObjects.GetNewSamples([this](auto&& sample) {
            path_planner_.UpdateObjects(*sample);
        });
    }
    
    void CallMethod() {
        // Call async method — returns Future
        auto future = radar_proxy_->ResetDetectionFilter(FilterMode::kLongRange);
        
        // Get result (blocking) or use then() for async
        auto result = future.get();
        if (result != ErrorCode::kOk) {
            logger_.LogError() << "Filter reset failed";
        }
    }
    
private:
    std::unique_ptr<RadarObjectServiceProxy> radar_proxy_;
    ara::log::Logger& logger_ = ara::log::CreateLogger("PATH", "Path planning");
    PathPlanner path_planner_;
};
```

---

## Service Discovery

Service discovery in AUTOSAR Adaptive allows clients to find service providers at runtime without pre-configured IP addresses or port numbers.

### SOME/IP Service Discovery (SOME/IP-SD)

Under a SOME/IP transport binding, service discovery uses **SOME/IP-SD** (Service Discovery protocol):

```
Service Discovery Message Flow:

  Server (Skeleton)                    Client (Proxy)
  StartFindService                     FindService / StartFindService
        │                                     │
        │  Offer Service (UDP Multicast)       │
        │─────────────────────────────────────►
        │                                     │
        │  Subscribe Event Group (UDP Unicast) │
        │◄─────────────────────────────────────
        │                                     │
        │  Subscribe ACK                       │
        │─────────────────────────────────────►
        │                                     │
        │  Initial Events (UDP/TCP Unicast)    │
        │─────────────────────────────────────►
        │                                     │
  [Periodic events continue at runtime via UDP/TCP]
```

SOME/IP-SD messages carry:
- **Service ID**: 16-bit identifier for the service interface
- **Instance ID**: Distinguishes multiple instances of the same service
- **Major/Minor version**: Service interface version compatibility check
- **TTL**: Time-to-live for the offer; clients resend subscriptions if TTL expires
- **IP address + port**: Where to reach the service (unicast)

---

## Event Communication in ara::com: Detailed Flow

```
Event data flow from Skeleton to all Subscribers:

Step 1: Application allocates a sample
  auto sample = skeleton.DetectedObjects.Allocate();
  // Returns a managed pointer to a pre-allocated buffer (zero-copy)

Step 2: Application populates the sample
  sample->timestamp = CurrentTimeMs();
  sample->objects = detected_objects_vector;

Step 3: Application sends the sample
  skeleton.DetectedObjects.Send(std::move(sample));
  // ara::com takes ownership; schedules transmission via transport binding

  ─ IPC transport: writes to shared memory segment, signals a futex
  ─ SOME/IP transport: serializes to wire format, sends via UDP socket
  ─ DDS transport: publishes to DDS topic via DDS Data Writer

Step 4: Transport delivers to subscriber(s)
  ─ IPC: subscriber's receive handler woken from futex wait
  ─ SOME/IP: UDP packet received by subscriber's udp socket → CM dispatches
  ─ DDS: DDS Data Reader notifies Listener callback

Step 5: Proxy's receive handler called
  void OnObjectDetected() {
      proxy.DetectedObjects.GetNewSamples([](auto&& sample) {
          // Process sample — zero-copy access to the buffer
          ProcessObjects(*sample);
          // sample goes out of scope → buffer returned to pool
      });
  }
```

---

## Method Communication: Synchronous vs Asynchronous

### Fire-and-Forget Method
No response expected. Used for commands where success is implied.

```cpp
// Skeleton declares fire-and-forget:
// void ShutdownSensor() = 0;

// Proxy call — no return value
proxy.ShutdownSensor();  // sends and returns immediately
```

### Asynchronous Method with Future
Normal method with a return value, using `ara::core::Future`:

```cpp
// Proxy side
ara::core::Future<PathResult> future = proxy.ComputeOptimalPath(start, goal);

// Option A: Block until result (not recommended in main loop)
PathResult result = future.get();

// Option B: Callback when ready (non-blocking)
std::move(future).then([](ara::core::Future<PathResult> f) {
    auto result = f.get();
    if (result.HasValue()) {
        UsePath(result.Value());
    }
});
```

---

## Subscription Management and Sample Cache

```cpp
// Subscribe with a maximum cache of 5 samples
proxy.DetectedObjects.Subscribe(5);

// Check subscription state
auto state = proxy.DetectedObjects.GetSubscriptionState();
// kNotSubscribed, kSubscriptionPending, kSubscribed

// Unsubscribe (stop receiving events)
proxy.DetectedObjects.Unsubscribe();

// Sample cache management:
// If provider sends faster than consumer processes, oldest samples are dropped.
// MaxSampleCount configures how many unprocessed samples the proxy can hold.

// Get a specific number of new samples
size_t processed = proxy.DetectedObjects.GetNewSamples(
    [](auto&& sample) { ProcessObject(*sample); },
    5  // process at most 5 samples per call
);
```

---

## ara::com and AUTOSAR E2E Integration

For safety-relevant data transmitted via ara::com, AUTOSAR E2E protection can be applied at the transformer level:

```
ara::com + E2E Transformer chain:

  Application data (ObjectList)
          │
  ┌───────┴────────────────────────────────┐
  │  E2EXf (E2E Transformer)              │
  │  Adds: CRC-16, counter, data ID       │
  │  (Transparent to ara::com API)         │
  └───────┬────────────────────────────────┘
          │
  ┌───────┴────────────────────────────────┐
  │  SOME/IP Serializer / DDS Serializer  │
  │  Converts C++ struct to byte stream   │
  └───────┬────────────────────────────────┘
          │
        UDP/TCP Socket → Network → ECU B

On the receiver side, E2EXf checks CRC and counter.
If E2E check fails → ara::com reports E2E error status to the application.

Application checks E2E status:
  proxy.DetectedObjects.GetNewSamples([](auto&& sample, auto& info) {
      if (info.e2e_result == ara::com::e2e::ProfileCheckStatus::kOk) {
          ProcessObject(*sample);
      } else {
          logger.LogError() << "E2E check failed!";
          trigger_safe_state();
      }
  });
```
