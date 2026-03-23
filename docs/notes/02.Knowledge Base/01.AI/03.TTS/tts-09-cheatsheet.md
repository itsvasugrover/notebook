---
title: "TTS Cheatsheet"
createTime: 2026/03/21 14:08:00
permalink: /kb/ai/tts/cheatsheet/
---

# TTS Cheatsheet

Quick-reference for install commands, library selection, code snippets, and common fixes.

---

## Install Commands

```bash
# Kokoro (fastest offline, Apache 2.0)
pip install kokoro soundfile numpy sounddevice
pip install misaki[en]       # English G2P
sudo apt install espeak-ng   # Required for phonemization

# F5-TTS (best voice cloning, MIT)
pip install f5-tts

# Coqui XTTS-v2 (multilingual cloning, CPML)
pip install TTS

# Bark (expressive/creative, MIT — slow)
pip install bark transformers accelerate

# edge-tts (cloud Azure, zero setup, MIT client)
pip install edge-tts

# OpenVoice V2 (style transfer, MIT)
pip install openvoice melo-tts

# pyttsx3 (OS TTS, zero ML, MIT)
pip install pyttsx3

# Audio utilities
pip install sounddevice soundfile librosa num2words ffmpeg-python

# System deps (Ubuntu)
sudo apt install ffmpeg libsndfile1 portaudio19-dev espeak-ng
```

---

## Library Selection Guide

| Need | Best Choice | Why |
|------|-------------|-----|
| Fastest CPU, offline | **Kokoro** | RTF ~0.05, Apache 2.0 |
| Best voice cloning | **F5-TTS** | Flow matching, MIT |
| Multilingual cloning | **XTTS-v2** | 17 languages |
| Zero setup, cloud | **edge-tts** | 400+ voices, free |
| Expressive/emotion | **Bark** | Laughter, music tokens |
| Voice style transfer | **OpenVoice V2** | Tone color converter |
| No ML, instant | **pyttsx3** | OS engine wrapper |
| Low latency streaming | **Kokoro** | Generator-based, first chunk < 100ms |

---

## Kokoro One-Liners

```python
from kokoro import KPipeline
import numpy as np, soundfile as sf

pipe = KPipeline(lang_code="a")  # "a"=US EN, "b"=British, "j"=JA, "z"=ZH

# --- Synthesize to file ---
sf.write("out.wav", np.concatenate([a for _,_,a in pipe("Hello!", voice="af_heart")]), 24000)

# --- Stream to speakers ---
import sounddevice as sd
for _, _, audio in pipe("Hello world!", voice="af_heart"):
    sd.play(audio, 24000); sd.wait()

# --- Different voices ---
VOICES = ["af_heart", "af_bella", "af_sarah", "am_adam", "am_michael", "bf_emma", "bm_george"]

# --- Speed control ---
for _, _, audio in pipe("Speaking slowly.", voice="af_heart", speed=0.8):
    ...

# --- British English ---
pipe_gb = KPipeline(lang_code="b")
for _, _, audio in pipe_gb("Brilliant!", voice="bf_emma"):
    ...
```

---

## XTTS-v2 Voice Cloning

```python
from TTS.api import TTS

tts = TTS("tts_models/multilingual/multi-dataset/xtts_v2", gpu=False)
tts.tts_to_file(
    text="Hello in my cloned voice.",
    speaker_wav="reference.wav",   # 3-15s clean speech
    language="en",
    file_path="output.wav",
)
```

---

## F5-TTS Voice Cloning

```python
from f5_tts.api import F5TTS
import soundfile as sf

tts = F5TTS()
wav, sr, _ = tts.infer(
    ref_file="reference.wav",
    ref_text="Exact transcript of reference.wav",
    gen_text="Text to generate in that voice.",
    nfe_step=32,
)
sf.write("output.wav", wav, sr)
```

---

## edge-tts Quick Start

```python
import asyncio, edge_tts

async def speak(text, voice="en-US-AriaNeural"):
    await edge_tts.Communicate(text, voice).save("output.mp3")

asyncio.run(speak("Hello from edge-tts!"))

# List all voices
async def voices():
    return await edge_tts.list_voices()
```

---

## Streaming TTS (Sentence by Sentence)

```python
import threading, queue
import numpy as np
import sounddevice as sd
from kokoro import KPipeline

def stream_speak(text: str, voice: str = "af_heart"):
    """Generate and play sentence by sentence."""
    pipe = KPipeline(lang_code="a")
    audio_q: queue.Queue = queue.Queue()
    
    def player():
        with sd.OutputStream(samplerate=24000, channels=1, dtype="float32") as s:
            while True:
                chunk = audio_q.get()
                if chunk is None: break
                s.write(chunk.reshape(-1, 1))
    
    t = threading.Thread(target=player, daemon=True)
    t.start()
    
    for _, _, audio in pipe(text, voice=voice):
        audio_q.put(audio)
    audio_q.put(None)
    t.join()

stream_speak("First sentence plays immediately. Second sentence follows. Done!")
```

---

## Text Pre-Processing

```python
import re
from num2words import num2words  # pip install num2words

def clean_for_tts(text: str) -> str:
    text = re.sub(r"\bAPI\b", "A.P.I.", text)
    text = re.sub(r"\bLLM\b", "L.L.M.", text)
    text = re.sub(r"\bGPU\b", "G.P.U.", text)
    text = re.sub(r"\b(\d+)\b", lambda m: num2words(int(m.group())), text)
    text = text.replace("C++", "C plus plus").replace("C#", "C sharp")
    text = re.sub(r"`[^`]+`", "", text)          # strip code
    text = re.sub(r"\*+([^*]+)\*+", r"\1", text)  # strip markdown bold/italic
    text = re.sub(r"#{1,6}\s", "", text)          # strip headings
    return text.strip()
```

---

## Audio Utilities

```python
import numpy as np
import soundfile as sf

# Fade in/out (prevents clicks)
def fade(audio, ms=10, sr=24000):
    n = min(int(ms*sr/1000), len(audio)//4)
    audio[:n]  *= np.linspace(0, 1, n)
    audio[-n:] *= np.linspace(1, 0, n)
    return audio

# Normalize
def normalize(audio, peak=0.95):
    m = np.abs(audio).max()
    return audio / m * peak if m > 0 else audio

# Resample (e.g. 24kHz → 16kHz for ASR)
import librosa
def resample(audio, src_sr, dst_sr):
    return librosa.resample(audio, orig_sr=src_sr, target_sr=dst_sr)

# Save as MP3
import subprocess, tempfile, os
def save_mp3(audio, sr, path):
    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as t:
        sf.write(t.name, audio, sr, subtype="PCM_16")
        tmp = t.name
    subprocess.run(["ffmpeg", "-y", "-i", tmp, "-codec:a", "libmp3lame", "-qscale:a", "2", path], check=True, capture_output=True)
    os.unlink(tmp)
```

---

## Common Error Fixes

| Error | Cause | Fix |
|-------|-------|-----|
| `ModuleNotFoundError: kokoro` | Not installed | `pip install kokoro` |
| `espeak-ng: command not found` | Missing system dep | `sudo apt install espeak-ng` |
| Robotic voice | Cheap voice / no punctuation | Try `af_heart`, add punctuation |
| Mispronounced acronym | G2P reads as word | Add periods: `A.P.I.` |
| Audio click at sentence end | No fade | Apply `fade()` to each chunk |
| XTTS-v2 VRAM error | Too large for GPU | `gpu=False` → use CPU |
| Bark too slow | CPU inference | Use small models or GPU |
| edge-tts network error | No internet / rate limit | Retry with backoff, or use Kokoro |
| `sounddevice` no output | Wrong device | `sd.query_devices()` → set `sd.default.device` |
| Cloned voice sounds wrong | Bad reference audio | Clean to mono 24kHz, 3–15s |
| Numbers spoken wrong | Not pre-processed | Use `num2words` |

---

## Voice Pipeline Latency Summary

```
Component           | Typical Latency | Notes
--------------------+-----------------+---------------------------
VAD utterance end   | 600ms           | Configurable silence window
ASR (Whisper base)  | 100–300ms       | faster-whisper int8 CPU
LLM first token     | 200–500ms       | Depends on model/hardware
Sentence split      | ~10ms           | After ~20 chars buffered
Kokoro synthesis    | 30–80ms/sentence| CPU, first chunk only
Playback start      | ~5ms            | sounddevice buffer
--------------------+-----------------+---------------------------
Total first audio   | 1.0 – 1.5s      | End-to-end, CPU only
```

---

## All TTS Files

| # | Topic | Link |
|---|-------|------|
| 01 | Introduction & Overview | [→](/kb/ai/tts/introduction/) |
| 02 | Algorithms & Theory | [→](/kb/ai/tts/algorithms-theory/) |
| 03 | Libraries Comparison | [→](/kb/ai/tts/libraries-comparison/) |
| 04 | Installation | [→](/kb/ai/tts/installation/) |
| 05 | Implementation | [→](/kb/ai/tts/implementation/) |
| 06 | Real-Time Streaming | [→](/kb/ai/tts/real-time-streaming/) |
| 07 | Integration Guide | [→](/kb/ai/tts/integration/) |
| 08 | Troubleshooting | [→](/kb/ai/tts/troubleshooting/) |
| 09 | Cheatsheet | ← you are here |

## Voice Pipeline

- [VAD Cheatsheet](/kb/ai/vad/cheatsheet/)
- [ASR Cheatsheet](/kb/ai/asr/cheatsheet/)
- [llama-swap Cheatsheet](/kb/ai/llama-swap/cheatsheet/)
- [llama.cpp Cheatsheet](/kb/ai/llama-cpp/cheatsheet/)
