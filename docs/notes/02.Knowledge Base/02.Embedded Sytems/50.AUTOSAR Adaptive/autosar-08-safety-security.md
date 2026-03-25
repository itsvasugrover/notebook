---
title: Safety and Security in AUTOSAR Adaptive
createTime: 2026/03/25 00:00:00
permalink: /kb/embedded/autosar/safety-security/
---

# Safety and Security in AUTOSAR Adaptive

## Functional Safety in AUTOSAR Adaptive

### ASIL Coverage of the Adaptive Platform

AUTOSAR Adaptive Platform Release 21-11 onward targets **ASIL B** qualification for the platform itself (specific Functional Clusters). Applications running on the platform can also be developed to ASIL B up to ASIL D, with certain architectural conditions.

```
ASIL Ceiling Matrix (Adaptive Platform Components):

  Component                     Maximum ASIL    Notes
  ────────────────────────────────────────────────────────────────────────
  ARA APIs (ara::com, etc.)     ASIL B          Platform has ASIL B safety manual
  Execution Management          ASIL B          EM is safety-relevant (process control)
  Platform Health Management    ASIL B          PHM is safety-relevant (monitoring)
  Communication Management      ASIL B          ara::com with E2E → ASIL B
  State Management              ASIL B          SM controls safety-relevant states
  ara::crypto                   ASIL B          Depends on HSM ASIL level
  ara::log                      QM             Logging is not safety-relevant
  ara::per                      QM → ASIL B     Depends on storage use case
  OS (Linux PREEMPT_RT)         QM             Linux itself is not ASIL certified
  OS (QNX 7.x)                  ASIL D capable  QNX has TÜV ASIL D certificate
  
  Key insight: To develop ASIL C/D Adaptive Applications, the underlying OS
  must be ASIL certified (QNX or equivalent), or the SoC hypervisor must 
  provide freedom-from-interference guarantees.
```

### Freedom from Interference

ISO 26262 Part 6 requires that ASIL components are free from interference from lower-ASIL or QM components. In Adaptive, this requires:

```
Mixed-Criticality Architecture on a Single SoC:

  ┌──────────────────────────────────────────────────────────┐
  │                        SoC                               │
  │                                                          │
  │  ┌─────────────────────────────────────────────────────┐ │
  │  │             Hypervisor (ASIL D certified)            │ │
  │  └──────────────┬───────────────────────┬──────────────┘ │
  │                 │                       │                 │
  │  ┌──────────────┴────────┐ ┌────────────┴──────────────┐ │
  │  │  Safety Partition     │ │   QM Partition             │ │
  │  │  ASIL B/C/D           │ │   AUTOSAR Adaptive on      │ │
  │  │  AUTOSAR Classic or   │ │   Linux (ADAS, Infotainment)│ │
  │  │  QNX + safety AAs    │ │                             │ │
  │  └───────────────────────┘ └───────────────────────────┘ │
  │                                                          │
  └──────────────────────────────────────────────────────────┘

  Hypervisor provides:
  - CPU time partitioning (no runaway QM task starves ASIL task)
  - Memory isolation (QM OS cannot corrupt ASIL partition memory)
  - Peripheral access control (safety I/O only accessible to ASIL partition)
  
  Examples:
  - NVIDIA Drive Orin: Cortex-R5 safety island (ASIL D) + ARM Cortex-A (Linux, QM)
  - NXP S32G: M7 cores (ASIL D) + A53 cores (Linux)
  - Renesas R-Car V4H: CR7 lockstep (ASIL D) + CA76 (Linux + Adaptive)
```

---

## Platform Health Management (PHM) — Complete Coverage

PHM is the watchdog and health monitoring Functional Cluster of AUTOSAR Adaptive. It allows applications to register supervised entities and report their health status.

### Supervision Types

#### 1. Alive Supervision

The application must "check in" with PHM at a configured rate. If check-ins stop (process crashed, hung), PHM detects the failure:

```cpp
#include <ara/phm/supervised_entity.h>

// The ARXML configures: expected alive period = 50ms, tolerance ±10ms
ara::phm::SupervisedEntity se("/RadarApp/AliveSupervision/MainTask");

// Called in main processing loop (~20 Hz)
void MainProcessingLoop() {
    while (running) {
        DoRadarProcessing();
        
        // Report alive checkpoint
        se.ReportCheckpoint(ara::phm::CheckpointId{0});  // checkpoint ID 0 = "alive"
        
        std::this_thread::sleep_for(50ms);
    }
}
```

#### 2. Deadline Supervision

Ensures an operation completes within a minimum and maximum time window:

```cpp
// ARXML configures: min = 10ms, max = 100ms between checkpoint A and B
ara::phm::SupervisedEntity se("/RadarApp/DeadlineSupervision/FilterOp");

void RunFilterOperation() {
    se.ReportCheckpoint(ara::phm::CheckpointId{1});  // Start: checkpoint A
    
    RunExpensiveFilterAlgorithm();  // Must complete within 10–100ms
    
    se.ReportCheckpoint(ara::phm::CheckpointId{2});  // End: checkpoint B
    // PHM calculates time between checkpoint 1 and 2
    // If outside [10ms, 100ms] → supervision failure
}
```

#### 3. Logical Supervision

Verifies that software executes in the correct sequence:

```cpp
// ARXML defines valid execution graph:
// Checkpoint 1 → Checkpoint 2 → Checkpoint 3 → Checkpoint 1 (loop)
// Any other transition → logical supervision failure

void ProcessingPipeline() {
    se.ReportCheckpoint(1);  // Pre-processing
    PreProcess();
    
    se.ReportCheckpoint(2);  // Main processing
    MainProcess();
    
    se.ReportCheckpoint(3);  // Post-processing
    PostProcess();
    
    // Loop back to 1 — valid in the ARXML supervision graph
}
```

### Recovery Actions Configured in ARXML

```arxml
<PHM-SUPERVISED-ENTITY-INTERFACE>
  <SHORT-NAME>RadarMainTaskSupervision</SHORT-NAME>
  
  <!-- Supervision configuration -->
  <ALIVE-SUPERVISION>
    <EXPECTED-ALIVE-INDICATIONS>1</EXPECTED-ALIVE-INDICATIONS>
    <ALIVE-REFERENCE-CYCLE>50</ALIVE-REFERENCE-CYCLE>       <!-- 50ms -->
    <MIN-MARGIN>5</MIN-MARGIN>                              <!-- ±5ms tolerance -->
    <MAX-MARGIN>10</MAX-MARGIN>
    <SUPERVISION-STATUS-TOLERANCE-COUNT>3</SUPERVISION-STATUS-TOLERANCE-COUNT>
    <!-- 3 missed checkpoints before fault reported -->
  </ALIVE-SUPERVISION>
  
  <!-- What PHM should do on failure -->
  <RECOVERY-ACTION>
    <RECOVERY-NOTIFICATION>REPORT_TO_SM</RECOVERY-NOTIFICATION>
    <!-- SM will then: request ADAS FunctionGroup → Off state, trigger safe stop -->
  </RECOVERY-ACTION>
</PHM-SUPERVISED-ENTITY-INTERFACE>
```

---

## ara::crypto — Complete Coverage

`ara::crypto` provides cryptographic services to AUTOSAR Adaptive Applications, backed by a Hardware Security Module (HSM) when available.

### Cryptographic Services Overview

```
ara::crypto service categories:

  ┌─────────────────────────────────────────────────────┐
  │               ara::crypto                           │
  │                                                     │
  │  Symmetric Encryption     AES-128/256 CBC/GCM/ECB  │
  │  Asymmetric Encryption    RSA-2048/4096, ECC        │
  │  Digital Signatures       ECDSA, RSA-PSS, RSA-PKCS1 │
  │  Message Authentication   CMAC (AES), HMAC-SHA256   │
  │  Hashing                  SHA-256, SHA-384, SHA-512 │
  │  Key Derivation           HKDF, SP800-108           │
  │  Random Number Gen        TRNG via HSM              │
  │  Key Management           Generate, import, export  │
  │  TLS/DTLS                 TLS 1.3, DTLS 1.3         │
  └─────────────────────────────────────────────────────┘
         │
         ▼
  ┌─────────────────────────────────────────────────────┐
  │         Crypto Provider (pluggable)                 │
  │  ┌──────────────┐     ┌─────────────────────────┐  │
  │  │ HSM backend  │ OR  │ Software crypto library  │  │
  │  │ (SHE, TPM)  │     │ (OpenSSL, Mbed TLS)      │  │
  │  └──────────────┘     └─────────────────────────┘  │
  └─────────────────────────────────────────────────────┘
```

### Code Examples

#### Digital Signature Verification

```cpp
#include <ara/crypto/public/crypto_provider.h>

auto& provider = ara::crypto::GetDefaultProvider();

// Load a pre-stored public key (retrieved from key storage)
auto key_slot = provider.LoadPublicKey(key_id);

// Create a verification context
auto verify_ctx = provider.CreateMsgRecoveryPublicCtx(
    ara::crypto::AlgorithmId::kEcdsaSha256);

// Process the data to verify
verify_ctx->Update(data_buffer);

// Verify — returns ara::core::Result<bool>
auto result = verify_ctx->Verify(signature_buffer);
if (result.HasValue() && result.Value()) {
    ProcessAuthenticatedData();
} else {
    logger.LogError() << "Signature verification FAILED";
    RejectData();
}
```

#### AES-GCM Encryption / Decryption

```cpp
auto encrypt_ctx = provider.CreateSymmetricBlockCipherCtx(
    ara::crypto::AlgorithmId::kAes128Gcm);

// Load AES key from secure key storage
auto key = provider.LoadSecretKey(aes_key_slot_id);
encrypt_ctx->SetKey(*key, ara::crypto::CryptoObjectUsage::kKryptoObjectEncrypt);

// Provide IV/nonce (must be unique per encryption operation)
std::vector<uint8_t> iv(12);  // 96-bit IV for GCM
provider.GenerateRandom(iv);

encrypt_ctx->Start(iv);
encrypt_ctx->Update(plaintext);
auto ciphertext_result = encrypt_ctx->Finish();

// ciphertext_result contains: ciphertext + 16-byte GCM authentication tag
```

#### HMAC Generation

```cpp
auto mac_ctx = provider.CreateMessageAuthnCodeCtx(
    ara::crypto::AlgorithmId::kHmacSha256);

auto hmac_key = provider.LoadSecretKey(hmac_key_slot_id);
mac_ctx->SetKey(*hmac_key);
mac_ctx->Start();
mac_ctx->Update(message);
auto mac_result = mac_ctx->Finish(true /* produce MAC */);

// Verify on receiver side
auto verify_mac_ctx = provider.CreateMessageAuthnCodeCtx(
    ara::crypto::AlgorithmId::kHmacSha256);
verify_mac_ctx->SetKey(*hmac_key);
verify_mac_ctx->Start();
verify_mac_ctx->Update(message);

bool valid = verify_mac_ctx->Check(received_mac).HasValue();
```

---

## ara::iam — Identity and Access Management

`ara::iam` controls which Adaptive Applications may access which services. This prevents a compromised or buggy AA from calling services it has no legitimate reason to access.

### Access Control Model

```
Every AA has:
  - An Application Identity Certificate (X.509 certificate, signed by OEM CA)
  - A set of permissions declared in its Application Manifest
  
Every service has:
  - An access control policy: "only apps with permission X can call method Y"
  
Enforcement happens in CM:
  - When Proxy.FindService() is called, CM checks if the caller's identity
    certificate grants it the required service access permission
  - If not, FindService() returns empty (service not found — by policy)
```

### IAM ARXML Configuration

```arxml
<!-- Who is allowed to access RadarObjectService? -->
<IAM-STATEMENT>
  <REQUESTED-SERVICE-INSTANCE-REF>/Services/RadarService_Inst1</REQUESTED-SERVICE-INSTANCE-REF>
  
  <!-- Allow PathPlanningApp to subscribe to DetectedObjects event -->
  <ALLOWED-PROVIDER>
    <APPLICATION-REF>/Apps/PathPlanningApp</APPLICATION-REF>
    <SERVICE-ELEMENT>DetectedObjects</SERVICE-ELEMENT>
    <ACTION>SUBSCRIBE</ACTION>
  </ALLOWED-PROVIDER>
  
  <!-- Allow DiagnosticsApp to call ResetDetectionFilter method -->
  <ALLOWED-PROVIDER>
    <APPLICATION-REF>/Apps/DiagnosticsApp</APPLICATION-REF>
    <SERVICE-ELEMENT>ResetDetectionFilter</SERVICE-ELEMENT>
    <ACTION>CALL</ACTION>
  </ALLOWED-PROVIDER>
</IAM-STATEMENT>
```

---

## SecOC — Secure OnBoard Communication for Adaptive

SecOC provides message authentication for SOME/IP messages to detect injection, replay, and tampering attacks. In AUTOSAR Adaptive R21-11+, SecOC is integrated as a transformer in the ara::com pipeline.

### SecOC Transformer Chain

```
  Sending side:
  Application data (ObjectList)
       │
  ┌────┴──────────────────────────────────────────────────────┐
  │  SecOC Transformer                                        │
  │  1. Compute CMAC-AES128 over (data + FreshnessValue + DataID) │
  │  2. Append truncated MAC (e.g., 24 bits)                  │
  │  3. Append FreshnessValue counter                         │
  └────┬──────────────────────────────────────────────────────┘
       │
  ┌────┴──────────────────────────────────────────────────────┐
  │  SOME/IP Serializer + UDP                                 │
  └────────────────────────────────────────────────────────────┘
  
  Receiving side:
  UDP → Deserialize → SecOC Transformer:
  1. Extract FreshnessValue — check > stored value (anti-replay)
  2. Recompute CMAC with same key
  3. Compare with received MAC — if mismatch → discard + report
  4. If valid → deliver to application
```

SecOC configuration in ARXML:
```arxml
<SECURED-I-PDU-PROPERTIES>
  <MESSAGE-LINK-REF>/IPDU/DetectedObjects_IPDU</MESSAGE-LINK-REF>
  <AUTH-INFO-TX-LENGTH>3</AUTH-INFO-TX-LENGTH>  <!-- 24-bit truncated MAC -->
  <FRESHNESS-VALUE-ID>10</FRESHNESS-VALUE-ID>
  <FRESHNESS-VALUE-TX-LENGTH>4</FRESHNESS-VALUE-TX-LENGTH>  <!-- 32-bit counter -->
  <DATA-ID>0x00AB</DATA-ID>
  <MESSAGE-AUTHENTICATION-CODE>CMAC_AES128</MESSAGE-AUTHENTICATION-CODE>
</SECURED-I-PDU-PROPERTIES>
```

---

## TLS/DTLS in Adaptive Platform

For cross-ECU communication, SOME/IP can be transported over **TLS 1.3** (for TCP-based methods) or **DTLS 1.3** (for UDP-based events). This is configured in the Service Instance Manifest:

```arxml
<REQUIRED-SOMEIP-SERVICE-INSTANCE>
  <TLS-SECURITY-LEVEL>TLS</TLS-SECURITY-LEVEL>
  <TLS-CRYPTO-CIPHER-SUITE>TLS_AES_256_GCM_SHA384</TLS-CRYPTO-CIPHER-SUITE>
  <CLIENT-CERTIFICATE-REF>/Crypto/PathPlannerCert</CLIENT-CERTIFICATE-REF>
  <ROOT-CA-CERTIFICATE-REF>/Crypto/OEM_RootCA</ROOT-CA-CERTIFICATE-REF>
</REQUIRED-SOMEIP-SERVICE-INSTANCE>
```

Mutual TLS (mTLS) is recommended for all safety-relevant or security-sensitive services.

---

## ISO 26262 Work Products for an ASIL B Adaptive Application

Developing an ASIL B Adaptive Application requires these ISO 26262 Part 6 work products:

| Work Product | Content |
|-------------|---------|
| Software Safety Requirements | Derived from system-level ASIL B safety goals |
| Software Architecture Design | How the AA implements requirements, ara:: API usage, error handling |
| Software Unit Design | Detailed C++ class/function design per safety requirement |
| Software Unit Implementation | C++ source code written to MISRA C++ or AUTOSAR C++14 guidelines |
| Software Unit Verification | Unit tests with 100% MC/DC coverage for ASIL B |
| Software Integration Test | Tests of AA on target or HIL with ARA mocks |
| Dependent Failure Analysis | Analysis of common cause failures between AA and platform |
| Safety Manual Compliance | Documentation showing compliance with platform safety manual |

---

## ISO/SAE 21434 Cybersecurity in Adaptive Context

The ISO/SAE 21434 standard (Road Vehicles — Cybersecurity Engineering) applies to AUTOSAR Adaptive systems which have significant attack surface compared to Classic platforms.

### TARA (Threat Analysis and Risk Assessment) for Adaptive Services

```
For each ara::com Service:
  1. Asset identification: what sensitive data does this service expose?
     Example: Camera feed (privacy), GPS location (tracking), Steering control
     
  2. Threat scenarios:
     - Spoofing: attacker impersonates a valid service provider
       → Mitigation: mTLS + ara::iam certificate-based identity
       
     - Tampering: attacker modifies messages in transit
       → Mitigation: TLS for SOME/IP, SecOC for CAN bridging
       
     - Replay: attacker records and replays old valid messages
       → Mitigation: SecOC FreshnessValue counter
       
     - Information disclosure: unauthorized subscriber reads sensitive events
       → Mitigation: ara::iam access control on service instances
       
     - Denial of Service: flood CM with FindService requests
       → Mitigation: rate limiting in CM; process isolation (EM cgroups)
       
  3. Risk assessment: CVSS score + automotive safety impact
  4. Security goals: derived security requirements for the system
  5. Cybersecurity concepts: architecture decisions (TLS, IAM, SecOC)
```

### Secure Boot and Key Management

```
Secure Boot Chain for Adaptive Platform:

  Hardware Root of Trust (HSM/SHE)
         │ verifies signature of
         ▼
  Bootloader (Signed by OEM key)
         │ verifies signature of
         ▼
  OS kernel + initrd (Signed)
         │ verifies (dm-verity or IMA)
         ▼
  AUTOSAR Adaptive Platform services (Signed)
         │ ara::iam verifies application certificates
         ▼
  Adaptive Applications

Key storage:
  - AES keys for SecOC stored in HSM (hardware-protected)
  - TLS private keys for each AA stored in ara::crypto key slots
  - Keys provisioned at manufacturing via secure provisioning protocol
  - Key update: UCM + ara::crypto key import with OEM authorization
```
