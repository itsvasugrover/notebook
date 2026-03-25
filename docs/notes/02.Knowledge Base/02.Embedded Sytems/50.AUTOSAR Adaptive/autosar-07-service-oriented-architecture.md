---
title: Service-Oriented Architecture, SOME/IP & DDS
createTime: 2026/03/25 00:00:00
permalink: /kb/embedded/autosar/soa/
---

# Service-Oriented Architecture, SOME/IP & DDS

## Service-Oriented Architecture (SOA) in Automotive

### Core Principles

Traditional automotive ECU networks were **signal-oriented**: a temperature sensor periodically broadcasts a raw value on CAN, and any ECU that cares subscribes to that ID. This worked at 5–25 ECUs per vehicle, but scales poorly.

SOA reframes the architecture:
- Every capability is a **service** with a defined interface (contract)
- Consumers **discover** services at runtime rather than knowing endpoints at compile time
- Communication is **event-driven or on-demand** rather than periodic flooding
- Services are **versioned** and independently deployable

```
Signal-Oriented (Classic CAN)          Service-Oriented (Adaptive Ethernet)
──────────────────────────────────────────────────────────────────────────────
ECU A broadcasts 0x123 at 10ms          RadarECU offers RadarObjectService
ECU B hardcodes CAN ID 0x123            PathPlannerECU calls FindService(),
ECU C hardcodes CAN ID 0x123            subscribes to DetectedObjects event
                                        DiagnosticsECU discovers RadarService
                                        and calls ResetFilter() method
──────────────────────────────────────────────────────────────────────────────
Tight coupling, static binding          Loose coupling, dynamic binding
Broadcast (bus sharing)                 Point-to-point after discovery
No versioning                           Major/minor versioning built in
No access control                       IAM governs who can access service
```

### Benefits in AUTOSAR Adaptive Context

1. **OTA flexibility**: A new software version can change its internal service interfaces as long as it increments the major version; consumers with compatible major versions continue working
2. **Scalability**: Ethernet can carry thousands of service interactions simultaneously; no bus bandwidth ceiling like CAN (1 Mbit/s)
3. **Platform independence**: The same `ara::com` API works over SOME/IP (cross-ECU), DDS (high-throughput), or IPC (intra-machine) — transport is swapped at deployment without changing application code
4. **Discoverability**: A diagnostic tester or analytics platform can discover all available services dynamically without requiring a hardcoded list

---

## SOME/IP Protocol — Complete Reference

SOME/IP (Scalable service-Oriented MiddlewarE over IP) is AUTOSAR's primary Ethernet-based transport protocol. Standardized in AUTOSAR, it is also published by GENIVI and used industry-wide.

### SOME/IP Message Format

```
 0                   1                   2                   3
 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1
┌─────────────────────────────────────────────────────────────────┐
│                    Service ID (16 bits)                         │
│                    Method ID   (16 bits)                        │
├─────────────────────────────────────────────────────────────────┤
│                    Length (32 bits)                             │
│           (total length of message from Request ID onwards)    │
├─────────────────────────────────────────────────────────────────┤
│                    Client ID   (16 bits)                        │
│                    Session ID  (16 bits)                        │
├─────────────────────────────────────────────────────────────────┤
│ Protocol Version │ Interface Version │ Message Type │ Return Code│
│     (8 bits)     │    (8 bits)       │   (8 bits)   │  (8 bits)  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│                       Payload (variable)                        │
│                  (Serialized application data)                  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Field-by-Field Explanation

| Field | Size | Values and Meaning |
|-------|------|--------------------|
| Service ID | 16 bits | Unique ID for the service interface (e.g., 0x0101 = RadarService) |
| Method ID | 16 bits | 0x0001–0x7FFF = methods; 0x8000–0xFFFE = events (notification); 0xFFFF = SD |
| Length | 32 bits | Number of bytes from Request ID to end of payload (inclusive) |
| Client ID | 16 bits | Identifies the calling client; used to route responses back |
| Session ID | 16 bits | Incrementing counter per client; pairs responses to requests |
| Protocol Version | 8 bits | Always 0x01 in current SOME/IP |
| Interface Version | 8 bits | Major version of service interface; incompatible changes = increment |
| Message Type | 8 bits | See table below |
| Return Code | 8 bits | 0x00 = E_OK; non-zero = error (see SOME/IP error codes) |

**Message Type Values:**

| Hex | Name | Direction |
|-----|------|-----------|
| 0x00 | REQUEST | Client → Server (expects response) |
| 0x01 | REQUEST_NO_RETURN | Client → Server (fire-and-forget) |
| 0x02 | NOTIFICATION | Server → Client (event) |
| 0x80 | RESPONSE | Server → Client (method result) |
| 0x81 | ERROR | Server → Client (method error) |

### SOME/IP Serialization

SOME/IP uses **little-endian** byte ordering (configurable per type in ARXML). Serialization rules:

```
Type            Serialization
──────────────────────────────────────────────────────────────────
uint8           1 byte, unsigned
uint16          2 bytes, LE
uint32          4 bytes, LE
float32         4 bytes, IEEE 754, LE
bool            1 byte (0x00 = false, 0x01 = true)
struct          Members serialized in declaration order, no padding
string          uint32 length prefix + UTF-8 bytes + null terminator
dynamic array   uint32 length-in-bytes prefix + element data
static array    No length prefix; elements serialized sequentially
optional        Presence flag (1 byte) + data if present

Example — ObjectList:
struct Object {
    uint16  object_id;    // 0x0042 → bytes: 42 00
    float32 distance_m;   // 4.5f   → bytes: 00 00 90 40
    float32 velocity_ms;  // -12.0f → bytes: 00 00 40 C1
};

struct ObjectList {
    uint32 count;           // 2 → bytes: 02 00 00 00
    Object objects[count];  // 2 × 10 bytes
};

Full serialized payload (2 objects, 24 bytes):
02 00 00 00  42 00 00 00 90 40 00 00 40 C1  43 00 00 00 A0 40 00 00 80 41
```

---

## SOME/IP Service Discovery (SOME/IP-SD)

### SD Message Structure

SD messages are SOME/IP messages with Service ID = 0xFFFF, Method ID = 0x8100.

Each SD message contains one or more **entries** (describing services or event groups) and **options** (IP address/port details).

```
SD Message Structure:
┌──────────────────────────────────────┐
│  SOME/IP Header (Service: 0xFFFF)    │
├──────────────────────────────────────┤
│  Flags (8 bits)                      │
│  Reserved (24 bits)                  │
├──────────────────────────────────────┤
│  Entries Array Length (32 bits)      │
│  ┌─────────────────────────────────┐ │
│  │  Entry (16 bytes each)          │ │
│  │  Type | idx1 | idx2 | ...      │ │
│  │  Service ID | Instance ID       │ │
│  │  Major Ver | TTL | Minor Ver    │ │
│  └─────────────────────────────────┘ │
├──────────────────────────────────────┤
│  Options Array Length (32 bits)      │
│  ┌─────────────────────────────────┐ │
│  │  Option: Length | Type          │ │
│  │  IPv4 Endpoint: Addr | Proto    │ │
│  │             | Port              │ │
│  └─────────────────────────────────┘ │
└──────────────────────────────────────┘
```

### Discovery Entry Types

| Type Code | Name | Direction |
|-----------|------|-----------|
| 0x00 | Find Service | Client → Server (Query: "who offers this service?") |
| 0x01 | Offer Service | Server → Client (Response: "I offer it at this address") |
| 0x06 | Subscribe Eventgroup | Client → Server (Subscribe: "send me these events") |
| 0x07 | Subscribe Eventgroup ACK | Server → Client (Confirmation: "subscribed") |

### Discovery State Machine (Server Side)

```
   SD State Machine (Server, SOME/IP-SD specification):

   ┌────────────────┐
   │  Down Phase    │  Service not available; SD silent
   └───────┬────────┘
           │ OfferService() called
           ▼
   ┌────────────────┐
   │ Initial Wait   │  Waits random delay (INITIAL_DELAY_MIN to MAX)
   │    Phase       │  Avoids broadcast storms at system startup
   └───────┬────────┘
           │ delay expired
           ▼
   ┌────────────────┐     Count < REPETITIONS_MAX
   │ Repetition     │◄──────────────────────────────┐
   │    Phase       │  Sends OfferService multicast  │
   └───────┬────────┘────────────────────────────────┘
           │ REPETITIONS_MAX reached
           ▼
   ┌────────────────┐
   │  Main Phase    │  Sends periodic OfferService at REQUEST_RESPONSE_DELAY
   │                │  Responds to FindService with unicast OfferService
   └───────┬────────┘
           │ StopOfferService() called
           ▼
   ┌────────────────┐
   │  Down Phase    │  Sends StopOfferService message once; goes silent
   └────────────────┘
```

Configurable timing parameters (typical values):

| Parameter | Typical Value | Purpose |
|-----------|--------------|---------|
| INITIAL_DELAY_MIN | 100 ms | Minimum wait before first offer |
| INITIAL_DELAY_MAX | 200 ms | Maximum wait — randomized between min/max |
| REPETITION_BASE_DELAY | 200 ms | Delay doubles each repetition |
| REPETITIONS_MAX | 3 | Number of rapid offers before main phase |
| CYCLIC_OFFER_DELAY | 1000 ms | Main phase periodic offer interval |
| TTL | 3 s | Time-to-live of service offer; clients must renew subscription before TTL expires |

---

## DDS (Data Distribution Service) in Automotive

### What is DDS?

DDS is an OMG (Object Management Group) standard for data-centric publish-subscribe communication. Unlike SOME/IP (which is transport-centric), DDS is **data-centric**: endpoints don't know about each other; they only know about **topics**.

### DDS Core Concepts

```
DDS Domain
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│  Participant A (Radar ECU)          Participant B (Planner ECU) │
│  ┌───────────────────────┐         ┌───────────────────────┐   │
│  │     Data Writer       │         │     Data Reader        │   │
│  │  Topic: ObjectList    │         │  Topic: ObjectList     │   │
│  │  Type: ObjectStruct   │         │  Type: ObjectStruct    │   │
│  │  QoS: RELIABLE        │─────────► QoS: RELIABLE         │   │
│  └───────────────────────┘         └───────────────────────┘   │
│                                                                 │
│  Discovery: Automatic via Simple Discovery Protocol (SPDP/SEDP) │
│  No central broker required                                     │
└─────────────────────────────────────────────────────────────────┘
```

### DDS QoS Policies — Key Policies for Automotive

| QoS Policy | Values | Automotive Use Case |
|-----------|--------|---------------------|
| RELIABILITY | BEST_EFFORT / RELIABLE | RELIABLE for safety data, BEST_EFFORT for high-rate sensor streams |
| DURABILITY | VOLATILE / TRANSIENT_LOCAL / PERSISTENT | TRANSIENT_LOCAL: late-joining subscribers get the last N samples (useful for configuration data) |
| HISTORY | KEEP_LAST (depth N) / KEEP_ALL | KEEP_LAST 1 for latest-value semantics; KEEP_LAST 10 for burst tolerance |
| DEADLINE | duration | Alert if no sample received within deadline (e.g., 50ms for safety sensor) |
| LIFESPAN | duration | Discard old samples automatically (e.g., 200ms for radar objects) |
| LATENCY_BUDGET | duration | Hint for middleware: group samples for efficiency vs forward immediately |
| OWNERSHIP | SHARED / EXCLUSIVE | EXCLUSIVE: only one writer can be "the owner" of a topic at a time (useful for redundant sensors) |
| PARTITION | string pattern | Namespace isolation within a domain |

### DDS in ara::com

AUTOSAR defines a DDS binding for `ara::com`. Each ServiceInterface event is mapped to a DDS topic:

```
ARXML Service Interface → DDS Topic Mapping:

  ServiceInterface: RadarObjectService
  Event: DetectedObjects (type: ObjectList)
  
  → DDS Topic Name:  "ara_RadarObjectService_Instance1_DetectedObjects"
  → DDS Type:        ObjectList (IDL generated from ARXML)
  → QoS profile:     Defined in Service Instance Manifest ARXML
  
  ServiceInterface Method:
  Method: ResetDetectionFilter
  → DDS Topic (request):  "ara_RadarObjectService_Request_ResetFilter"
  → DDS Topic (reply):    "ara_RadarObjectService_Reply_ResetFilter"
  → Uses DDS Request-Reply pattern (Connext, OpenDDS, CycloneDDS)
```

### SOME/IP vs DDS for Automotive

| Dimension | SOME/IP | DDS |
|-----------|---------|-----|
| Origin | AUTOSAR / GENIVI (automotive-native) | OMG (initially defence/finance, adapted for automotive) |
| Transport | UDP (events), TCP (reliable methods) | UDP (multicast or unicast) |
| Discovery | SOME/IP-SD (broadcast/multicast phases) | SPDP/SEDP (DDS Discovery Protocol) |
| Serialization | Custom SOME/IP wire format | CDR (Common Data Representation) |
| QoS | Limited (best-effort UDP, reliable TCP) | Comprehensive (20+ QoS policies) |
| Data model | Service-centric (events are part of a service) | Data-centric (topics are standalone) |
| Latency | ~100 µs (same subnet) | ~50–200 µs depending on DDS implementation |
| Throughput | Good for automotive payloads | Excellent, designed for high-throughput streaming |
| Industry adoption | Universal in AUTOSAR Adaptive | Growing; used in ADAS, robotics (ROS2 uses DDS) |
| Best for | ECU-to-ECU service calls, V2X, OTA | High-bandwidth streams (camera, lidar, maps), complex QoS requirements |

---

## Service Registry and Communication Management Architecture

```
Communication Management (CM) Architecture on a Single Machine:

  Adaptive Applications
  ┌──────────┐   ┌─────────────┐   ┌───────────────┐
  │  Radar   │   │PathPlanning │   │  Diagnostics  │
  │  (skel)  │   │  (proxy)    │   │   (proxy)     │
  └────┬─────┘   └──────┬──────┘   └───────┬───────┘
       │  ara::com API   │                   │
  ─────┴─────────────────┴───────────────────┴───────────
                    CM (Communication Management)
  ┌─────────────────────────────────────────────────────┐
  │  Service Registry (internal to CM)                  │
  │  Maps: ServiceID + InstanceID → process endpoint    │
  │                                                     │
  │  ┌───────────────┐  ┌───────────────┐  ┌─────────┐ │
  │  │  SOME/IP-SD   │  │  DDS          │  │  IPC    │ │
  │  │  Handler      │  │  Participant  │  │  Broker │ │
  │  └───────┬───────┘  └──────┬────────┘  └────┬────┘ │
  └──────────┼─────────────────┼────────────────┼───────┘
             │                 │                │
  Ethernet   │          Ethernet / UDP     Shared Memory
  UDP/TCP    │                             / Unix Socket
  ┌──────────┴──────────────────────────────────────────┐
  │             Network / OS (POSIX)                    │
  └─────────────────────────────────────────────────────┘
  
  Remote ECU ──────────────────────────────────────────►
  (Path Planning on different ECU communicates via SOME/IP over Ethernet)
```

---

## Network Architecture in ARXML

AUTOSAR Adaptive models network topology in ARXML to allow CM to assign the correct transport binding to each service instance:

```arxml
<!-- Network topology: which ECU has which IP, which VLAN -->
<ETHERNET-CLUSTER>
  <SHORT-NAME>VehicleEthernet</SHORT-NAME>
  <COMMUNICATION-CONTROLLER>
    <SHORT-NAME>RadarECU_Eth0</SHORT-NAME>
    <ETH-IF-SPEED>1000000000</ETH-IF-SPEED>  <!-- 1 GbE -->
  </COMMUNICATION-CONTROLLER>
</ETHERNET-CLUSTER>

<!-- SOME/IP Service Instance configuration -->
<PROVIDED-SOMEIP-SERVICE-INSTANCE>
  <SHORT-NAME>RadarService_Inst1</SHORT-NAME>
  <SERVICE-INTERFACE-REF>/Interfaces/RadarObjectService</SERVICE-INTERFACE-REF>
  <INSTANCE-ID>1</INSTANCE-ID>
  <SERVICE-ID>0x0101</SERVICE-ID>
  
  <EVENT-DEPLOYMENT>
    <SHORT-NAME>DetectedObjects_Deploy</SHORT-NAME>
    <EVENT-REF>/Interfaces/RadarObjectService/DetectedObjects</EVENT-REF>
    <EVENT-MULTICAST-SUBSCRIPTION-ADDRESSES>
      <IPV4-MULTICAST-ADDRESS>239.0.0.1</IPV4-MULTICAST-ADDRESS>
      <PORT-NUMBER>30101</PORT-NUMBER>
    </EVENT-MULTICAST-SUBSCRIPTION-ADDRESSES>
    <EVENT-GROUP-ID>1</EVENT-GROUP-ID>
  </EVENT-DEPLOYMENT>
  
  <METHOD-DEPLOYMENT>
    <SHORT-NAME>ResetFilter_Deploy</SHORT-NAME>
    <METHOD-REF>/Interfaces/RadarObjectService/ResetDetectionFilter</METHOD-REF>
    <METHOD-ID>0x0001</METHOD-ID>
    <TRANSPORT-PROTOCOL>TCP</TRANSPORT-PROTOCOL>
    <PORT-NUMBER>30100</PORT-NUMBER>
  </METHOD-DEPLOYMENT>
</PROVIDED-SOMEIP-SERVICE-INSTANCE>
```
