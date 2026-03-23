---
title: "ASR Cheatsheet"
createTime: 2026/03/21 13:08:00
permalink: /kb/ai/asr/cheatsheet/
---

# ASR Cheatsheet

Quick-reference for install commands, model selection, code snippets, and common fixes.

---

## Install Commands

```bash
# Core (recommended stack)
pip install faster-whisper soundfile numpy

# Real-time microphone
pip install sounddevice

# Silero VAD (for silence detection)
pip install torch torchaudio
# torch.hub.load("snakers4/silero-vad", "silero_vad")

# RealtimeSTT (batteries-included real-time)
pip install RealtimeSTT

# openai-whisper (reference impl)
pip install openai-whisper

# HuggingFace Whisper / Wav2Vec2
pip install transformers accelerate

# Vosk (offline, small models)
pip install vosk

# Accuracy evaluation
pip install jiwer

# FastAPI ASR endpoint
pip install fastapi uvicorn python-multipart httpx

# System dependencies (Ubuntu)
sudo apt update && sudo apt install -y ffmpeg libsndfile1 portaudio19-dev
```

---

## Model Selection Guide

| Model | Size | Speed vs large-v3 | WER (LibriSpeech) | Best for |
|-------|------|-------------------|-------------------|----------|
| `tiny.en` | 39 MB | ~32× | ~5.7% | Live demo, embedded |
| `base.en` | 74 MB | ~16× | ~4.2% | **General offline use** |
| `small.en` | 244 MB | ~6× | ~3.0% | Good accuracy + speed |
| `medium.en` | 769 MB | ~2× | ~2.4% | High accuracy, server |
| `large-v2` | 1.5 GB | 1× | ~2.0% | Best accuracy (stable) |
| `large-v3` | 1.5 GB | 1× | ~1.8% | **Best accuracy (current)** |
| `turbo` | 809 MB | ~8× | ~2.1% | **Best accuracy/speed ratio** |

> Remove `.en` suffix for multilingual models (e.g. `"base"` instead of `"base.en"`).

---

## Compute Type Guide (faster-whisper)

| compute_type | Device | Memory | Speed | Use when |
|---|---|---|---|---|
| `float32` | CPU | High | Slow | Debugging only |
| `int8` | CPU | Low | **Fast** | CPU production |
| `float16` | GPU | Medium | Fast | GPU with 2+ GB VRAM |
| `int8_float16` | GPU | Low | **Fastest** | GPU with limited VRAM |
| `bfloat16` | GPU | Medium | Fast | A100 / H100 GPUs |

---

## faster-whisper One-Liners

```python
from faster_whisper import WhisperModel
model = WhisperModel("base.en", device="cpu", compute_type="int8")

# --- Transcribe a file ---
segs, info = model.transcribe("audio.wav", beam_size=5)
text = " ".join(s.text.strip() for s in segs)

# --- With word timestamps ---
segs, _ = model.transcribe("audio.wav", word_timestamps=True)
for seg in segs:
    for w in seg.words:
        print(f"{w.start:.2f}-{w.end:.2f}: {w.word}")

# --- Skip silence with built-in VAD ---
segs, _ = model.transcribe("audio.wav", vad_filter=True)

# --- Force language ---
segs, _ = model.transcribe("audio.wav", language="en")

# --- Translate to English ---
segs, _ = model.transcribe("audio.wav", task="translate")

# --- Fast (greedy, no beam search) ---
segs, _ = model.transcribe("audio.wav", beam_size=1, best_of=1)

# --- From numpy float32 array ---
import numpy as np
audio = np.zeros(16000 * 3, dtype=np.float32)  # 3s silence
segs, _ = model.transcribe(audio, beam_size=5)

# --- Detect language ---
_, info = model.transcribe("audio.wav", beam_size=1)
print(info.language, info.language_probability)
```

---

## VAD + ASR Pipeline

```python
import torch
import numpy as np
from faster_whisper import WhisperModel

# Load models once
vad_model, utils = torch.hub.load("snakers4/silero-vad", "silero_vad")
get_speech_ts = utils[0]
asr_model = WhisperModel("base.en", device="cpu", compute_type="int8")

def transcribe_with_vad(audio: np.ndarray, sr: int = 16000) -> str:
    tensor = torch.tensor(audio)
    speech_timestamps = get_speech_ts(tensor, vad_model, sampling_rate=sr)
    
    if not speech_timestamps:
        return ""
    
    parts = []
    for ts in speech_timestamps:
        chunk = audio[ts["start"]:ts["end"]]
        segs, _ = asr_model.transcribe(chunk, beam_size=5)
        parts.append(" ".join(s.text.strip() for s in segs))
    
    return " ".join(parts)
```

---

## RealtimeSTT Quick Start

```python
from RealtimeSTT import AudioToTextRecorder

def on_text(text):
    print(f">> {text}")

recorder = AudioToTextRecorder(
    model="base.en",
    language="en",
    silero_sensitivity=0.4,
    on_realtime_transcription_stabilized=on_text,
)

print("Speak... (Ctrl+C to quit)")
try:
    while True:
        recorder.text(on_text)
except KeyboardInterrupt:
    recorder.stop()
```

---

## WER Evaluation

```python
from jiwer import wer, cer

reference = "the quick brown fox jumps over the lazy dog"
hypothesis = "the quick brown fox jumped over the lazy dog"

print(f"WER: {wer(reference, hypothesis):.1%}")
print(f"CER: {cer(reference, hypothesis):.1%}")
```

---

## SRT Generation One-Liner

```python
from faster_whisper import WhisperModel

def to_srt_time(t):
    h,m,s,ms = int(t//3600),int(t%3600//60),int(t%60),int(t%1*1000)
    return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"

model = WhisperModel("small", device="cpu", compute_type="int8")
segs, _ = model.transcribe("video.mp4", beam_size=5)

with open("subtitles.srt", "w") as f:
    for i, seg in enumerate(segs, 1):
        f.write(f"{i}\n{to_srt_time(seg.start)} --> {to_srt_time(seg.end)}\n{seg.text.strip()}\n\n")
```

---

## Common Error Fixes

| Error | Cause | Fix |
|-------|-------|-----|
| `FileNotFoundError: ffmpeg` | ffmpeg not installed | `sudo apt install ffmpeg` |
| `CUDA error: out of memory` | Model too large for VRAM | Use smaller model or `int8_float16` |
| Hallucinations on silence | No VAD | Add `vad_filter=True` or pre-filter with silero |
| Wrong language | Auto-detect failed | Set `language="en"` explicitly |
| Words cut off | No context between windows | Set `condition_on_previous_text=True` |
| Very slow on CPU | Default float32 | Use `compute_type="int8"` |
| `InvalidInputDevice` | Wrong audio device | Run `python -c "import sounddevice as sd; print(sd.query_devices())"` |
| Duplicate words | High temperature | Set `temperature=0` in transcribe |
| `No module named 'torch'` | Missing dep for VAD | `pip install torch torchaudio` |

---

## Key Parameters Reference

```python
model.transcribe(
    audio,                          # path str or float32 numpy array
    language=None,                  # None=auto, "en", "fr", "de", ...
    task="transcribe",              # "transcribe" or "translate"
    beam_size=5,                    # 1=greedy (fast), 5=default, 10=slower
    best_of=5,                      # number of candidates with temperature>0
    patience=1.0,                   # beam search patience factor
    temperature=0,                  # 0=deterministic, 0.2-1.0=sampling
    compression_ratio_threshold=2.4,# filter repeated outputs
    log_prob_threshold=-1.0,        # filter low-confidence segments
    no_speech_threshold=0.6,        # filter silent/noise segments
    condition_on_previous_text=True,# use prev text as context
    initial_prompt=None,            # seed Whisper with domain vocabulary
    word_timestamps=False,          # enable per-word timestamps
    vad_filter=False,               # built-in silero VAD
    vad_parameters=None,            # dict with VAD settings
)
```

---

## All ASR Files

| # | Topic | Link |
|---|-------|------|
| 01 | Introduction & Overview | [→](/kb/ai/asr/introduction/) |
| 02 | Algorithms & Theory | [→](/kb/ai/asr/algorithms-theory/) |
| 03 | Libraries Comparison | [→](/kb/ai/asr/libraries-comparison/) |
| 04 | Installation | [→](/kb/ai/asr/installation/) |
| 05 | Implementation | [→](/kb/ai/asr/implementation/) |
| 06 | Real-Time Streaming | [→](/kb/ai/asr/real-time-streaming/) |
| 07 | Integration Guide | [→](/kb/ai/asr/integration/) |
| 08 | Troubleshooting | [→](/kb/ai/asr/troubleshooting/) |
| 09 | Cheatsheet | ← you are here |

## Related Topics

- [VAD Cheatsheet](/kb/ai/vad/cheatsheet/)
- [TTS Cheatsheet](/kb/ai/tts/cheatsheet/)
- [llama-swap Cheatsheet](/kb/ai/llama-swap/cheatsheet/)
- [llama.cpp Cheatsheet](/kb/ai/llama-cpp/cheatsheet/)
