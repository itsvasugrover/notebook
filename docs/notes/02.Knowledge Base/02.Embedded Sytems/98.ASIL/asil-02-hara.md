---
title: Hazard Analysis and Risk Assessment (HARA)
createTime: 2026/03/25 00:00:00
permalink: /kb/embedded/asil/hara/
---

# Hazard Analysis and Risk Assessment (HARA)

## Purpose of HARA

The Hazard Analysis and Risk Assessment (HARA) is the foundational safety analysis of ISO 26262 Phase 1. Its purpose is to:

1. **Identify hazards** caused by malfunctions of the item
2. **Define hazardous events** by combining hazards with operational situations
3. **Evaluate risk** of each hazardous event using three parameters: Severity, Exposure, Controllability
4. **Assign ASIL** (or QM) to each hazardous event
5. **Derive safety goals** — high-level safety objectives to prevent or mitigate each hazardous event

The HARA is the single most important input document in a functional safety project. Every safety requirement downstream — from the Functional Safety Concept all the way to software unit tests — ultimately traces its ASIL attribute back to a HARA-derived safety goal.

---

## HARA Terminology

### Hazard
A **hazard** is a potential source of harm caused by a malfunction of the item. Hazards are expressed in technology-neutral, effect-oriented language:
- "Unintended acceleration of the vehicle"
- "Unintended deceleration of the vehicle"
- "Loss of steering assistance"
- "Unintended airbag deployment"

Hazards are identified per malfunctioning behavior of the item. For an Electronic Power Steering (EPS) system, the hazard list might include:
```
H1: Unintended application of steering torque (positive or negative)
H2: Absence of steering torque assistance when demanded
H3: Erroneous steering torque direction
H4: Stiffness in the steering mechanism (mechanical failure — outside E/E scope)
```

### Operational Situation
An **operational situation** is a scenario in which vehicle, driver, traffic, road, and environmental conditions interact with the item. Typical operational situations:
```
OS1: Highway driving at > 100 km/h
OS2: City driving at 30–50 km/h
OS3: Parking maneuver (< 10 km/h)
OS4: Emergency braking
OS5: Cornering at the limit of friction (oversteer/understeer threshold)
OS6: Lane change at highway speed
OS7: Vehicle at rest
```

### Hazardous Event
A **hazardous event** combines a hazard with a specific operational situation:
```
HE-01: Unintended positive steering torque (H1) WHILE cornering at highway speed (OS1+OS5)
HE-02: Loss of steering assistance (H2) WHILE parking (OS3)
HE-03: Erroneous steering direction (H3) WHILE emergency lane change (OS6)
```

---

## ASIL Rating Parameters

Each hazardous event is evaluated against three independent parameters. The combination determines the ASIL:

### 1. Severity (S)

Severity describes the worst-case harm to people (not property damage) if the hazardous event leads to an accident:

| Class | Description | Example |
|-------|-------------|---------|
| **S0** | No injuries | Property damage only |
| **S1** | Light-to-moderate injuries | Reversible injuries; no life-threatening condition |
| **S2** | Severe injuries (possibly life-threatening) | Survivable severe multiple injuries |
| **S3** | Fatal injuries (life-threatening, likely fatal) | Fatalities likely; multiple persons at risk |

**Determining Severity**:
- Use crash data, field accident statistics, biomechanical injury models (HIC, chest deflection)
- Consider the reasonable worst-case accident scenario resulting from the hazardous event — not the absolute worst case
- Document rationale with references to standards (e.g., Euro NCAP, FMVSS)

### 2. Exposure (E)

Exposure describes the probability or frequency that the operational situation in the hazardous event occurs during typical vehicle operation:

| Class | Description | Frequency |
|-------|-------------|-----------|
| **E0** | Incredibly unlikely | Not a realistic scenario |
| **E1** | Very low probability | < once per vehicle lifecycle (rare special maneuver) |
| **E2** | Low probability | A few times per year (e.g., icy road driving) |
| **E3** | Medium probability | Once per month, or a few hours per year |
| **E4** | High probability | Occurs almost every drive cycle; normal operating condition |

**Determining Exposure**:
- Use field data (naturalistic driving studies), OEM trip data, NHTSA/GIDAS crash databases
- For time-based exposure (probability per hour of operation): E4 > 10%, E3 1%–10%, E2 0.1%–1%, E1 < 0.1%
- Document the operational situation definition explicitly — "highway driving" needs a precise duration definition

### 3. Controllability (C)

Controllability describes the probability that a typical driver (or other road user) can avoid the accident given the malfunction:

| Class | Description |
|-------|-------------|
| **C0** | Controllable in general (almost everyone can avoid accident) |
| **C1** | Simply controllable (most drivers can avoid; > 99%) |
| **C2** | Normally controllable (majority of drivers can avoid; > 90%) |
| **C3** | Difficult to control or uncontrollable (> 10% of drivers cannot avoid accident) |

**Determining Controllability**:
- Based on human factors research, driver studies, real-world accident data
- Consider: warning time, severity of the malfunction onset (sudden vs. gradual), required driver action complexity, driver reaction time
- Be conservative: if in doubt between C2 and C3, use C3

---

## ASIL Determination Table

The ASIL is determined from the combination of S, E, and C using ISO 26262 Table 4 (Part 3, clause 6.4.6):

```
                C1              C2              C3
         ┌──────────────┬───────────────┬───────────────┐
    E1   │     QM       │      QM       │      QM       │
         ├──────────────┼───────────────┼───────────────┤
S1  E2   │     QM       │      QM       │      QM       │
         ├──────────────┼───────────────┼───────────────┤
    E3   │     QM       │      QM       │     ASIL A    │
         ├──────────────┼───────────────┼───────────────┤
    E4   │     QM       │     ASIL A    │     ASIL B    │
         └──────────────┴───────────────┴───────────────┘

                C1              C2              C3
         ┌──────────────┬───────────────┬───────────────┐
    E1   │     QM       │      QM       │      QM       │
         ├──────────────┼───────────────┼───────────────┤
S2  E2   │     QM       │      QM       │     ASIL A    │
         ├──────────────┼───────────────┼───────────────┤
    E3   │     QM       │     ASIL A    │     ASIL B    │
         ├──────────────┼───────────────┼───────────────┤
    E4   │    ASIL A    │     ASIL B    │     ASIL C    │
         └──────────────┴───────────────┴───────────────┘

                C1              C2              C3
         ┌──────────────┬───────────────┬───────────────┐
    E1   │     QM       │      QM       │     ASIL A    │
         ├──────────────┼───────────────┼───────────────┤
S3  E2   │     QM       │     ASIL A    │     ASIL B    │
         ├──────────────┼───────────────┼───────────────┤
    E3   │    ASIL A    │     ASIL B    │     ASIL C    │
         ├──────────────┼───────────────┼───────────────┤
    E4   │    ASIL B    │     ASIL C    │     ASIL D    │
         └──────────────┴───────────────┴───────────────┘
```

**S0 always yields QM** — no physical injury possible means no safety integrity requirement.
**E0 always yields QM** — vanishingly rare events do not drive safety requirements.

---

## HARA Worked Example — Electronic Power Steering (EPS)

### Item Definition

```
Item: Electronic Power Steering (EPS) System
Boundary: EPS ECU, torque sensor, motor, mechanical rack, CAN interface to VCU
Interfaces: CAN bus (vehicle speed, gear position), 12V power supply
Intended function: Provide adjustable steering assistance based on vehicle speed and 
                   driver torque input to reduce driver effort while maintaining feel
Operating modes: Active (VBAT ON, vehicle moving), Standby, Fail-silent, Limp-home
```

### Hazard Identification

```
H1: Unintended application of assist torque in one direction
H2: Unintended absence of steering assistance (zero assist)
H3: Oscillating steering assistance (torque hunting)
H4: Assist torque greater than driver can overcome
H5: Delayed response to driver torque input
```

### Hazardous Events + ASIL Ratings

| HE ID | Hazard | Situation | S | E | C | ASIL |
|-------|--------|-----------|---|---|---|------|
| HE-01 | Unintended right steering torque > 5 Nm | Highway driving, straight | S3 | E4 | C3 | D |
| HE-02 | Unintended right steering torque > 5 Nm | Parking (< 5 km/h) | S1 | E3 | C1 | QM |
| HE-03 | Loss of steering assistance | Highway driving | S2 | E4 | C2 | C |
| HE-04 | Loss of steering assistance | Parking | S0 | E3 | C1 | QM |
| HE-05 | Oscillating steering torque | Cornering at handling limit | S3 | E3 | C3 | C |
| HE-06 | Torque exceeding driver capability | Emergency lane change | S3 | E2 | C3 | B |

**Rationale for HE-01 = ASIL D**:
- S3: An unexpected right-steering torque at highway speed can cause the vehicle to depart the lane. At motorway speeds (130 km/h) with multiple lanes of traffic, fatal multi-vehicle collisions are likely.
- E4: Highway driving occurs multiple times per week for typical drivers — this is a normal operating condition.
- C3: The suddenness of the lateral deviation and the driver's expectation that the steering is neutral leaves little time for corrective action. Studies show > 10% of drivers cannot recover.

### Safety Goals Derived from HARA

Each hazardous event rated ASIL A or higher produces a safety goal:

```
SG-01 (ASIL D): Prevent unintended steering torque exceeding 3 Nm in any direction 
                during vehicle operation above 20 km/h.
SG-02 (ASIL C): Minimize the effect of absent steering assistance during vehicle 
                operation above 60 km/h to within a driver-recoverable range.
SG-03 (ASIL C): Prevent oscillating steering torque with frequency > 2 Hz and 
                amplitude > 5 Nm during cornering.
SG-04 (ASIL B): Prevent application of steering torque exceeding driver capability 
                during lane change at > 80 km/h.
```

---

## HARA Documentation Structure

An HARA report typically contains the following sections:

```
1. Introduction and Scope
   - Item description and boundary
   - Interfaces (reference to Item Definition document)

2. Operational Situations
   - List of all operational situations with descriptions
   - Exposure class justification per situation

3. Hazard Identification
   - Method used (FMEA-style, HAZOP, brain storming)
   - List of all hazards with IDs

4. Hazardous Event Analysis
   - Table: HE-ID, Hazard, Operational Situation, S, E, C, ASIL
   - Rationale for each S/E/C classification
   - References to supporting data (accident databases, OEM field data)

5. Safety Goals
   - Table: SG-ID, Safety Goal text, ASIL, Source HE-ID

6. Review and Approval
   - Stakeholders: safety engineer, system engineer, project manager, customer
   - Review record reference

Appendices
   - Exposure justification data
   - Accident statistics references
   - HAZOP worksheets
```

---

## Classification Arguments and Common Disputes

### Severity Classification Debates

**Common dispute**: "Why S3 and not S2 for loss of braking?"
- S classification requires a *worst-case credible scenario* analysis, not average case
- Loss of braking at 120 km/h on a congested motorway is S3 — the worst case is a rear-end collision into stopped traffic
- Rule: when in doubt, take the higher severity class; justify downgrading thoroughly

### Exposure Classification Debates

**Common dispute**: "Our ADAS feature only activates on motorways — E3 not E4"
- Exposure must reflect likelihood of the operational situation occurring during the vehicle lifetime
- If the car is equipped with the feature for all drives and the feature activates automatically, E4 applies
- Feature activation ≠ exposure to the scenario — the vehicle can be in a situation regardless of feature activation status

### Controllability Classification Debates

**Common dispute**: "Drivers can react within 1 second — C2, not C3"
- Controllability is about the *population* of drivers, not the average
- Consider: elderly drivers, distracted drivers, drivers in unfamiliar vehicles
- A 1-second reaction time for a sudden wheel jerk at 120 km/h is C3 in almost all crash reconstruction analyses — the vehicle deviates before the driver can react

---

## Relationship Between HARA Output and Downstream Development

```
HARA Output
  ├── Safety Goal SG-01 (ASIL D)
  │       │
  │       ▼
  │   Functional Safety Concept (ISO 26262 Part 3.7)
  │       │  decomposes SG-01 into FSRs
  │       ▼
  │   FSR-01: EPS ECU shall detect unintended torque > 2 Nm and enter safe state
  │            within 50 ms  [ASIL D after decomposition: ASIL C + ASIL C]
  │       │
  │       ▼
  │   Technical Safety Concept (ISO 26262 Part 4)
  │       │  allocates FSR-01 to HW and SW
  │       ▼
  │   SW Safety Requirement  ─────────────────────► SW unit test (MC/DC coverage)
  │   HW Safety Requirement  ─────────────────────► FMEDA, PMHF calculation
  │
  └── Safety Goal SG-02 (ASIL C)
          │
          ▼ (same chain, lower rigor)
```

This downstream traceability is mandatory under ISO 26262 — every SW requirement that carries an ASIL attribute must trace back through this chain to a HARA-derived safety goal.
