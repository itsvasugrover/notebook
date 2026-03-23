---
title: "Introduction to Automatic Speech Recognition (ASR)"
createTime: 2026/03/21 13:00:00
permalink: /kb/ai/asr/introduction/
---

# Introduction to Automatic Speech Recognition (ASR)

Automatic Speech Recognition (ASR) converts spoken audio into written text. It is the engine behind voice assistants, live captions, meeting transcription, and any system that needs to understand human speech.

---

## What ASR Does

```
Audio waveform (PCM)
        │
        ▼
┌───────────────┐
│  ASR Engine   │  acoustic model + language model
└───────┬───────┘
        │
        ▼
   "Hello, how are you?"   ← text transcript
```

ASR takes raw audio (usually 16kHz mono PCM) and outputs a text string. Modern end-to-end models (like Whisper) do this in a single neural network pass, handling noise, accents, and multiple languages without separate components.

---

## Why ASR Matters

| Use Case | Without ASR | With ASR |
|----------|------------|---------|
| Voice assistant | Cannot understand speech | Converts voice → text → LLM |
| Meeting transcription | Manual notetaking | Automatic real-time transcript |
| Accessibility | Deaf users excluded | Live captions, subtitles |
| Data entry | Keyboard only | Speak to fill forms |
| Podcast search | Cannot search audio | Index spoken words |
| Command & control | Button presses required | Hands-free device control |

---

## How ASR Fits in a Voice Pipeline

```
Microphone
    │
    ▼
┌─────────┐
│   VAD   │  Detect when speech occurs
└────┬────┘
     │ speech audio
     ▼
┌─────────┐
│   ASR   │  Convert speech → text
└────┬────┘
     │ transcript
     ▼
┌─────────┐
│   NLP   │  Parse intent / entities
│  / LLM  │
└────┬────┘
     │ response
     ▼
┌─────────┐
│   TTS   │  (Optional) text → speech back
└─────────┘
```

---

## ASR Approaches

### 1. End-to-End Neural (Modern — Recommended)

A single neural network takes audio features and directly outputs text tokens.  
**Examples: Whisper, MMS, SeamlessM4T**

```
Audio → Log-Mel Spectrogram → Transformer Encoder → Transformer Decoder → Text
```

**Pros:** Best accuracy, handles noise, multi-language, no separate components  
**Cons:** Large models (39MB–2.9GB), requires some compute

### 2. CTC-based (Connectionist Temporal Classification)

A neural encoder produces per-frame character probabilities, then CTC decoding collapses repeats.  
**Examples: Wav2Vec2, HuBERT, MMS**

```
Audio → CNN Encoder → Transformer → CTC head → [h,h,_,e,l,l,_,o] → "hello"
```

**Pros:** Fast, good for fine-tuning on custom vocabulary  
**Cons:** No built-in language model, needs beam search + LM for best accuracy

### 3. Hybrid (Traditional — Legacy)

Separate acoustic model (HMM + GMM or DNN) + pronunciation dictionary + language model (n-gram).  
**Examples: Kaldi, CMU Sphinx, older DeepSpeech**

**Pros:** Well understood, works on very low-resource hardware  
**Cons:** Complex pipeline, lower accuracy, not recommended for new projects

### 4. Streaming / Chunk-based

Processes audio in real-time by chunking with overlapping windows.  
**Examples: faster-whisper (with VAD), Vosk, RealtimeSTT**

```
[chunk1][chunk2][chunk3]...
    ↓      ↓      ↓
 partial partial  final
```

---

## Library Landscape

| Library | Model | Size | Languages | Real-Time | Offline | Best For |
|---------|-------|------|-----------|-----------|---------|----------|
| `openai-whisper` | Whisper | 39MB–2.9GB | 100+ | Partial | ✅ | Accuracy, multi-lang |
| `faster-whisper` | Whisper (CTranslate2) | 39MB–2.9GB | 100+ | ✅ | ✅ | Speed + accuracy |
| `whisper.cpp` (via Python) | Whisper (GGML) | 39MB–1.5GB | 100+ | ✅ | ✅ | Edge/embedded |
| `transformers` (Wav2Vec2) | Wav2Vec2 / HuBERT | 300MB–1GB | Per-model | ✅ | ✅ | Fine-tuning on custom data |
| `vosk` | Vosk/Kaldi | 40–2000MB | 20+ | ✅ | ✅ | Lightweight streaming |
| `speechbrain` | Various | 200MB+ | Multi | ✅ | ✅ | Full toolkit |
| `nemo` | Conformer/Citrinet | 50MB–500MB | Multi | ✅ | ✅ | NVIDIA production |
| `speech_recognition` | Multiple backends | 0 (API) | Many | ❌ | ❌ | Prototyping with APIs |
| `RealtimeSTT` | faster-whisper | same | 100+ | ✅ | ✅ | Easiest real-time setup |

---

## Whisper Model Size Guide

Whisper is the de facto standard for offline ASR. Choose the right size:

| Model | Size | Parameters | VRAM | Speed (RTF) | WER (en) | Use Case |
|-------|------|-----------|------|-------------|----------|---------|
| tiny | 39 MB | 39M | ~1 GB | ×32 | ~5.7% | Edge, very fast |
| base | 74 MB | 74M | ~1 GB | ×16 | ~4.2% | Good balance |
| small | 244 MB | 244M | ~2 GB | ×6 | ~3.0% | Better accuracy |
| medium | 769 MB | 769M | ~5 GB | ×2 | ~2.2% | High accuracy |
| large-v2 | 1.5 GB | 1550M | ~10 GB | ×1 | ~1.8% | Best accuracy |
| large-v3 | 1.5 GB | 1550M | ~10 GB | ×1 | ~1.6% | Latest, best |
| turbo | 809 MB | 809M | ~6 GB | ×8 | ~1.8% | Speed/accuracy sweet spot |

RTF = Real-Time Factor (how many × faster than real-time on GPU)  
WER = Word Error Rate (lower is better)

---

## When to Use What

```
Need simplest possible setup for prototyping?
└─ speech_recognition (Google Cloud free tier)

Need fully offline, best accuracy, multi-language?
├─ GPU available → faster-whisper (large-v3-turbo)
└─ CPU only → faster-whisper (base or small, int8)

Need real-time streaming transcription?
├─ Easy setup → RealtimeSTT
└─ Custom control → silero-vad + faster-whisper

Need to fine-tune on domain-specific vocabulary?
└─ Wav2Vec2 / HuBERT via transformers

Running on Raspberry Pi / embedded?
└─ Vosk (small model) or whisper.cpp (tiny/base)

NVIDIA GPU + production NeMo stack?
└─ NeMo Conformer-CTC or Conformer-Transducer

Already in SpeechBrain pipeline?
└─ SpeechBrain ASR
```

---

## Key Metrics

| Metric | Description | Good Value |
|--------|-------------|-----------|
| **WER** (Word Error Rate) | (S + D + I) / N | <5% clean, <15% noisy |
| **RTF** (Real-Time Factor) | Process time / audio duration | <1.0 = faster than real-time |
| **Latency** | Time from speech end to transcript | <500ms for interactive |
| **CER** (Character Error Rate) | Like WER but per character | Used for CJK/non-alpha |
| **BLEU** | Translation quality (for multilingual) | Higher is better |

---

## Audio Requirements

| Property | Requirement |
|----------|------------|
| Sample rate | 16,000 Hz (whisper resamples internally) |
| Channels | Mono (1 channel) |
| Format | float32 numpy array or WAV/MP3/FLAC/OGG file |
| Duration | Any; Whisper processes in 30s windows internally |
| Language | Auto-detected or specified |

---

## See Also

- [ASR Algorithms & Theory](/kb/ai/asr/algorithms-theory/)
- [ASR Libraries Comparison](/kb/ai/asr/libraries-comparison/)
- [ASR Installation](/kb/ai/asr/installation/)
- [ASR Implementation](/kb/ai/asr/implementation/)
- [Real-Time Streaming ASR](/kb/ai/asr/real-time-streaming/)
- [ASR Integration Guide](/kb/ai/asr/integration/)
- [ASR Troubleshooting](/kb/ai/asr/troubleshooting/)
- [ASR Cheatsheet](/kb/ai/asr/cheatsheet/)
- [Introduction to VAD](/kb/ai/vad/introduction/) — VAD is the prerequisite stage that feeds speech audio to ASR
- [Introduction to TTS](/kb/ai/tts/introduction/) — TTS is the output stage after ASR in a full voice pipeline
