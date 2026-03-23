---
title: "Introduction to Voice Activity Detection (VAD)"
createTime: 2026/03/21 12:00:00
permalink: /kb/ai/vad/introduction/
---

# Introduction to Voice Activity Detection (VAD)

Voice Activity Detection (VAD) is the foundational technology that determines **when a human is speaking** in an audio stream. Every modern voice pipeline — from smart speakers to speech-to-text APIs — depends on VAD to work reliably and efficiently.

---

## What is VAD?

VAD is an algorithm or model that classifies each frame of audio as either **speech** or **non-speech (silence/noise)**. The output is typically a binary signal or probability score over time.

```
Audio stream:
[noise][noise][SPEECH SPEECH SPEECH][noise][SPEECH][noise][noise]
                ↑                  ↑       ↑      ↑
             start               end    start    end
```

Without VAD, downstream systems must process all audio — including silence — which wastes compute, increases latency, and reduces accuracy.

---

## Why VAD Matters

| Problem Without VAD | How VAD Solves It |
|---------------------|-------------------|
| ASR processes silence → hallucinations | Only speech frames are sent to ASR |
| Continuous microphone → high CPU/GPU | Activate processing only during speech |
| Privacy: always-on recording | Discard silence frames, never store them |
| Bandwidth: sending all audio | Transmit only detected speech segments |
| Battery drain on mobile/edge devices | Sleep CPU between utterances |

---

## The VAD Pipeline Position

VAD is always placed **before** any downstream task:

```
Microphone/Audio file
        │
        ▼
  ┌───────────┐
  │    VAD    │  ← Are these frames speech?
  └─────┬─────┘
        │ speech only
        ▼
  ┌────────────────┐
  │ ASR / Whisper  │  ← Transcription
  └────────────────┘
        │
        ▼
  ┌────────────────┐
  │  LLM / NLP    │  ← Understanding / Generation
  └────────────────┘
```

---

## Types of VAD

### 1. Energy-Based (Traditional)

Compares the RMS energy of a frame against a threshold. Fast, zero dependencies, but fragile in noisy environments.

```
speech if RMS(frame) > threshold
```

**Pros:** microsecond latency, no model, no GPU  
**Cons:** breaks in noise, music, fan sounds

### 2. Zero Crossing Rate (ZCR)

Counts how often the signal crosses zero. Speech has lower ZCR than white noise but higher than silence.

**Pros:** simple, fast  
**Cons:** unreliable alone, usually combined with energy

### 3. Statistical / GMM-Based

Models speech and non-speech as Gaussian Mixture Models. **WebRTC VAD** uses this approach. Very fast and runs on CPUs with no ML framework.

**Pros:** proven in production (used in billions of devices), low latency, no GPU  
**Cons:** limited accuracy in challenging noise

### 4. DNN / ML-Based

Modern approaches use neural networks (LSTM, CNN, Transformer) trained on large corpora.  
**Silero VAD** (LSTM), **pyannote.audio** (Transformer), **SpeechBrain VAD** fall here.

**Pros:** state-of-art accuracy, works in real noise  
**Cons:** model load time, GPU helpful (not required for Silero)

---

## VAD Library Overview

| Library | Approach | Size | GPU Needed | Best For |
|---------|----------|------|-----------|----------|
| `webrtcvad` | GMM (WebRTC) | <1 MB | No | Low-latency edge/embedded |
| `silero-vad` | LSTM (PyTorch) | ~2 MB | Optional | General purpose, high accuracy |
| `pyannote.audio` | Transformer | ~300 MB | Recommended | Diarization + VAD |
| `speechbrain` | ECAPA-TDNN | ~200 MB | Recommended | Full ASR toolkit |
| `nemo` | MarbleNet | ~40 MB | Recommended | Production ASR pipelines |
| Energy + scipy | Custom math | 0 | No | Quick prototyping |

---

## When to Use What

```
Need very low latency (<20ms)?
├─ Yes → webrtcvad
└─ No → need high accuracy?
         ├─ Yes → silero-vad (best general choice)
         │        or pyannote (if you also need diarization)
         └─ No → energy-based (prototyping only)

Running on edge/embedded (no internet, no GPU)?
└─ webrtcvad or silero-vad (CPU mode)

Want speaker diarization alongside VAD?
└─ pyannote.audio

Full speech pipeline (ASR + VAD + NLP)?
└─ SpeechBrain or NeMo
```

---

## Key Concepts and Terminology

| Term | Definition |
|------|-----------|
| **Frame** | Short chunk of audio (typically 10–30ms) |
| **Chunk size** | Number of samples per frame (e.g. 512 at 16kHz = 32ms) |
| **Aggressiveness** | How aggressively to filter non-speech (0–3 in WebRTC) |
| **Threshold** | Probability above which a frame is considered speech |
| **Onset** | The moment speech begins |
| **Offset** | The moment speech ends |
| **Padding** | Extra silence added before/after detected speech segment |
| **Hysteresis** | Delay before switching from speech→silence to avoid choppy cuts |
| **False Positive** | Non-speech classified as speech (noise mistaken for voice) |
| **False Negative** | Speech classified as non-speech (voice missed) |

---

## VAD Output Formats

### Binary per frame
```python
[0, 0, 0, 1, 1, 1, 1, 1, 0, 0, 1, 1, 0, 0]
#  silence       SPEECH        SPEECH
```

### Probability score per frame
```python
[0.02, 0.05, 0.91, 0.98, 0.87, 0.03, 0.01]
```

### Timestamp segments
```python
[
    {"start": 1.2, "end": 3.8},
    {"start": 5.1, "end": 7.4},
]
```

---

## Sample Audio Requirements

Most VAD libraries have strict audio requirements:

| Property | Typical Requirement |
|----------|-------------------|
| Sample rate | 8000, 16000, or 32000 Hz |
| Channels | Mono (1 channel) |
| Bit depth | 16-bit PCM |
| Frame size | 10, 20, or 30ms |

---

## See Also

- [VAD Algorithms & Theory](/kb/ai/vad/algorithms-theory/)
- [VAD Libraries Comparison](/kb/ai/vad/libraries-comparison/)
- [VAD Installation](/kb/ai/vad/installation/)
- [VAD Implementation](/kb/ai/vad/implementation/)
- [Real-Time Streaming VAD](/kb/ai/vad/real-time-streaming/)
- [VAD Integration Guide](/kb/ai/vad/integration/)
- [VAD Troubleshooting](/kb/ai/vad/troubleshooting/)
- [VAD Cheatsheet](/kb/ai/vad/cheatsheet/)
- [Introduction to ASR](/kb/ai/asr/introduction/) — VAD feeds its output directly into ASR
- [Introduction to TTS](/kb/ai/tts/introduction/) — TTS is the final stage after ASR in a voice pipeline
