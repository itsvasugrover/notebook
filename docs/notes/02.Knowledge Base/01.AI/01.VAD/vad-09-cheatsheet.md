---
title: "VAD Cheatsheet"
createTime: 2026/03/21 12:08:00
permalink: /kb/ai/vad/cheatsheet/
---

# VAD Cheatsheet

Quick reference for everything VAD — install commands, config, code snippets, and decision tables.

---

## Install Commands

```bash
# Minimal (no ML framework)
pip install webrtcvad soundfile numpy scipy

# Recommended general purpose
pip install silero-vad torch torchaudio soundfile sounddevice numpy

# Full (all libraries)
pip install silero-vad webrtcvad pyannote.audio speechbrain \
            torch torchaudio soundfile sounddevice numpy scipy librosa

# Audio I/O
pip install pyaudio       # microphone input (PyAudio)
pip install sounddevice   # microphone input (sounddevice — easier)
pip install soundfile     # WAV read/write

# System dependencies (Ubuntu/Debian)
sudo apt install -y ffmpeg portaudio19-dev build-essential python3-dev
```

---

## Library Selection

```
Need <1ms latency, no ML, embedded?      → webrtcvad (mode 2)
Need best accuracy, general purpose?     → silero-vad (threshold 0.5)
Need speaker diarization + VAD?          → pyannote.audio
No PyTorch allowed, simple splitting?    → auditok
Full SpeechBrain ASR pipeline?           → speechbrain VAD
NVIDIA GPU + NeMo?                       → MarbleNet
```

---

## Audio Requirements

| Property | webrtcvad | silero-vad | pyannote |
|----------|-----------|-----------|---------|
| Sample rate | 8000 / 16000 / 32000 Hz | 8000 / 16000 Hz | any (resamples) |
| Channels | mono | mono | mono |
| Format | 16-bit PCM bytes | float32 torch tensor | file path or waveform |
| Frame size | exactly 10/20/30ms | 512 (16kHz) or 256 (8kHz) | N/A |

---

## silero-vad — File-Based

```python
from silero_vad import load_silero_vad, read_audio, get_speech_timestamps

model = load_silero_vad()
wav = read_audio("audio.wav", sampling_rate=16000)

segments = get_speech_timestamps(
    wav, model,
    sampling_rate=16000,
    threshold=0.5,                    # 0.3 (sensitive) ↔ 0.8 (strict)
    min_speech_duration_ms=250,       # ignore < 250ms
    min_silence_duration_ms=100,      # gap to split segments
    speech_pad_ms=30,                 # padding before/after
    return_seconds=True,
)
# → [{"start": 1.23, "end": 4.56}, ...]
```

---

## silero-vad — Chunk Streaming

```python
import torch
import numpy as np
from silero_vad import load_silero_vad

model = load_silero_vad()
model.reset_states()          # IMPORTANT: reset before each new stream

chunk = torch.zeros(512)      # 512 samples at 16kHz = 32ms
prob = model(chunk, 16000).item()   # → float [0.0, 1.0]
is_speech = prob > 0.5
```

---

## webrtcvad — File-Based

```python
import webrtcvad, soundfile as sf

vad = webrtcvad.Vad(mode=2)        # aggressiveness 0–3
audio, sr = sf.read("audio.wav", dtype="int16", always_2d=False)
frame_ms = 20
frame_size = int(sr * frame_ms / 1000)   # samples
pcm = audio.tobytes()

for i in range(0, len(pcm) - frame_size*2 + 1, frame_size*2):
    frame = pcm[i:i + frame_size*2]
    speech = vad.is_speech(frame, sr)
```

---

## Energy VAD (zero dependencies)

```python
import numpy as np, soundfile as sf

def energy_vad(filepath, threshold_db=-40.0, frame_ms=20):
    audio, sr = sf.read(filepath, dtype="float32", always_2d=False)
    if audio.ndim > 1: audio = audio.mean(axis=1)
    threshold = 10 ** (threshold_db / 20.0)
    frame_size = int(sr * frame_ms / 1000)
    results = []
    for i in range(0, len(audio) - frame_size + 1, frame_size):
        rms = np.sqrt(np.mean(audio[i:i+frame_size] ** 2))
        results.append(rms > threshold)
    return results   # [True/False per frame]
```

---

## Real-Time VAD (sounddevice + silero)

```python
import sounddevice as sd, torch, queue, numpy as np
from silero_vad import load_silero_vad

SR = 16000; CHUNK = 512; THRESH = 0.5; SILENCE_LIMIT = 20
model = load_silero_vad(); model.reset_states()
q = queue.Queue()

def cb(indata, frames, time, status):
    q.put(indata[:, 0].copy())

speech_buf = []; silence_cnt = 0; speaking = False

with sd.InputStream(samplerate=SR, channels=1, dtype="float32",
                    blocksize=CHUNK, callback=cb):
    while True:
        chunk = q.get()
        prob = model(torch.from_numpy(chunk), SR).item()
        if prob > THRESH:
            speaking = True; silence_cnt = 0; speech_buf.append(chunk)
        elif speaking:
            speech_buf.append(chunk); silence_cnt += 1
            if silence_cnt >= SILENCE_LIMIT:
                utterance = np.concatenate(speech_buf)
                # → send utterance to Whisper / ASR
                speech_buf = []; silence_cnt = 0; speaking = False
                model.reset_states()
```

---

## VAD + Whisper

```python
import whisper, numpy as np

wmodel = whisper.load_model("base.en")   # "tiny", "small", "medium", "large"

def transcribe(audio: np.ndarray, sr: int = 16000) -> str:
    return wmodel.transcribe(audio, fp16=False)["text"].strip()

# faster-whisper (recommended)
from faster_whisper import WhisperModel
fmodel = WhisperModel("base.en", device="cpu", compute_type="int8")

def transcribe_fast(audio: np.ndarray) -> str:
    segs, _ = fmodel.transcribe(audio, language="en", beam_size=3)
    return " ".join(s.text for s in segs).strip()
```

---

## VAD API Call (llama.cpp / llama-swap)

```python
import requests

def ask_llm(text: str, base_url="http://localhost:8080") -> str:
    r = requests.post(f"{base_url}/v1/chat/completions", json={
        "model": "llama-3.2-3b-instruct",
        "messages": [{"role": "user", "content": text}],
        "max_tokens": 200,
    })
    return r.json()["choices"][0]["message"]["content"].strip()
```

---

## Merge Speech Segments

```python
def merge_segments(segments, gap_s=0.5):
    if not segments: return []
    merged = [dict(segments[0])]
    for s in segments[1:]:
        if s["start"] - merged[-1]["end"] <= gap_s:
            merged[-1]["end"] = s["end"]
        else:
            merged.append(dict(s))
    return merged
```

---

## Save Speech Segments

```python
import soundfile as sf, os, numpy as np

def save_segments(filepath, segments, out_dir="segments", pad=0.3):
    audio, sr = sf.read(filepath, dtype="float32", always_2d=False)
    os.makedirs(out_dir, exist_ok=True)
    for i, s in enumerate(segments):
        start = max(0, int((s["start"] - pad) * sr))
        end = min(len(audio), int((s["end"] + pad) * sr))
        sf.write(f"{out_dir}/seg_{i:04d}.wav", audio[start:end], sr)
```

---

## Tuning Reference

| Symptom | Parameter | Change |
|---------|-----------|--------|
| Too many false positives (noise) | `threshold` | Raise (0.5 → 0.7) |
| Missing quiet speech | `threshold` | Lower (0.5 → 0.3) |
| Choppy utterances (split at pauses) | `min_silence_duration_ms` | Raise (100 → 400) |
| Short noise bursts flagged | `min_speech_duration_ms` | Raise (250 → 500) |
| Late reaction to speech start | `ONSET_CHUNKS` | Lower (3 → 1) |
| Cuts speech too early | `SILENCE_LIMIT` | Raise (15 → 25) |
| Background noise | HP filter cutoff | 80–150 Hz |

---

## Common Errors

| Error | Cause | Fix |
|-------|-------|-----|
| `Error: 10` (webrtcvad) | Wrong sample rate or frame size | Use 8000/16000/32000 Hz, 10/20/30ms frames |
| silero all-zero probs | LSTM state not reset | Call `model.reset_states()` |
| silero wrong shape | Chunk size ≠ 512 (16kHz) | Pad to exactly 512 samples |
| float out of range | Audio is int16, not float32 | Divide by 32768.0 |
| `OSError: -9996` (PyAudio) | Wrong device index | List devices and use correct index |
| `401 Unauthorized` (pyannote) | Invalid/missing HF token | Set `HUGGINGFACE_TOKEN` env var |

---

## See Also

- [Introduction to VAD](/kb/ai/vad/introduction/)
- [VAD Algorithms & Theory](/kb/ai/vad/algorithms-theory/)
- [VAD Libraries Comparison](/kb/ai/vad/libraries-comparison/)
- [VAD Installation](/kb/ai/vad/installation/)
- [VAD Implementation](/kb/ai/vad/implementation/)
- [Real-Time Streaming VAD](/kb/ai/vad/real-time-streaming/)
- [VAD Integration Guide](/kb/ai/vad/integration/)
- [VAD Troubleshooting](/kb/ai/vad/troubleshooting/)
- [Introduction to llama-swap](/kb/ai/llama-swap/introduction/)
- [llama.cpp Server](/kb/ai/llama-cpp/server/)
- [ASR Cheatsheet](/kb/ai/asr/cheatsheet/) — Quick reference for the transcription stage that consumes VAD output
- [TTS Cheatsheet](/kb/ai/tts/cheatsheet/) — Quick reference for the speech synthesis stage
