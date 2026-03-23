---
title: "VAD Troubleshooting"
createTime: 2026/03/21 12:07:00
permalink: /kb/ai/vad/troubleshooting/
---

# VAD Troubleshooting

Diagnosing and fixing common VAD issues: false positives, missed speech, choppy output, integration bugs, and performance problems.

---

## Quick Diagnostic First Steps

Before deep-diving, run these checks:

```python
# 1. Check your audio properties
import soundfile as sf
audio, sr = sf.read("problem.wav", dtype="float32")
print(f"Sample rate: {sr} Hz")
print(f"Channels: {audio.ndim}")
print(f"Duration: {len(audio)/sr:.2f}s")
print(f"Min/Max amplitude: {audio.min():.4f} / {audio.max():.4f}")
print(f"RMS level: {(audio**2).mean()**0.5:.4f}")
```

```python
# 2. Visualize VAD output vs audio
import matplotlib.pyplot as plt
import numpy as np
from silero_vad import load_silero_vad, read_audio, get_speech_timestamps
import torch

model = load_silero_vad()
wav = read_audio("problem.wav", sampling_rate=16000)

# Get frame-by-frame probabilities
CHUNK = 512
probs = []
model.reset_states()
for i in range(0, len(wav) - CHUNK + 1, CHUNK):
    with torch.no_grad():
        p = model(wav[i:i+CHUNK], 16000).item()
    probs.append(p)

t = [i * CHUNK / 16000 for i in range(len(probs))]
plt.figure(figsize=(14, 4))
plt.plot(np.linspace(0, len(wav)/16000, len(wav)), wav.numpy(), alpha=0.4, label="Audio")
plt.plot(t, probs, color="red", linewidth=2, label="VAD prob")
plt.axhline(0.5, color="orange", linestyle="--", label="Threshold")
plt.legend()
plt.xlabel("Time (s)")
plt.title("VAD Probability vs Audio Waveform")
plt.tight_layout()
plt.savefig("vad_debug.png", dpi=100)
print("Saved vad_debug.png")
```

---

## Problem 1: Too Many False Positives (Background Noise Detected as Speech)

**Symptoms:** VAD constantly triggers when nobody is speaking. Fan noise, HVAC, music, or keyboard clicks get flagged.

### Diagnosis

```python
# Check the noise floor
import numpy as np, soundfile as sf
audio, sr = sf.read("silent_room.wav", dtype="float32")
rms = np.sqrt(np.mean(audio ** 2))
print(f"Noise floor RMS: {rms:.5f}")
print(f"Noise floor dBFS: {20*np.log10(rms+1e-9):.1f} dB")
# If > -40 dBFS, your environment is noisy
```

### Fixes

**Fix A: Raise the VAD threshold (silero)**
```python
# Default is 0.5. In noisy environments, try 0.6–0.8
timestamps = get_speech_timestamps(wav, model, threshold=0.7, ...)
```

**Fix B: Increase webrtcvad aggressiveness**
```python
vad = webrtcvad.Vad(mode=3)  # 0→1→2→3 = increasing aggression
```

**Fix C: Apply a high-pass filter before VAD**
```python
from scipy.signal import butter, sosfilt

def highpass(audio, sr, cutoff=100):
    sos = butter(5, cutoff / (sr/2), btype="high", output="sos")
    return sosfilt(sos, audio)

audio_filtered = highpass(audio, sr, cutoff=80)
```

**Fix D: Increase minimum speech duration**
```python
# Ignore detections shorter than 300ms (fan noise is usually brief)
get_speech_timestamps(wav, model,
    min_speech_duration_ms=300,  # was 250
    ...)
```

**Fix E: Environment-specific microphone gain**
```bash
# Linux: reduce microphone gain with alsamixer or PulseAudio
amixer set Capture 70%
```

---

## Problem 2: Missed Speech (Speech Not Detected)

**Symptoms:** Quiet speech, distant microphone, or soft-spoken users not triggering VAD.

### Diagnosis

```python
# Check amplitude — speech below -50 dBFS may be missed
import soundfile as sf, numpy as np
audio, sr = sf.read("quiet_speech.wav", dtype="float32")
rms = np.sqrt(np.mean(audio ** 2))
print(f"Audio RMS: {20*np.log10(rms+1e-9):.1f} dBFS")
# Should be > -40 dBFS for reliable detection
```

### Fixes

**Fix A: Lower threshold (silero)**
```python
get_speech_timestamps(wav, model, threshold=0.3, ...)  # default 0.5
```

**Fix B: Lower aggressiveness (webrtcvad)**
```python
vad = webrtcvad.Vad(mode=0)  # least aggressive
```

**Fix C: Normalize audio amplitude before VAD**
```python
def normalize(audio: np.ndarray, target_rms: float = 0.05) -> np.ndarray:
    rms = np.sqrt(np.mean(audio ** 2))
    if rms < 1e-9:
        return audio
    return audio * (target_rms / rms)

audio_norm = normalize(audio)
```

**Fix D: Increase microphone gain**
```bash
amixer set Capture 95%
# Or in Python with sounddevice
sd.default.device = "default"
# Use a USB mic closer to speaker
```

---

## Problem 3: Choppy / Split Utterances

**Symptoms:** One sentence gets split into 3–4 short segments because brief pauses trigger silence detection.

### Fixes

**Fix A: Increase silence padding (silero)**
```python
get_speech_timestamps(wav, model,
    min_silence_duration_ms=500,  # was 100ms — allow 500ms pauses
    speech_pad_ms=100,            # add 100ms padding around each segment
    ...)
```

**Fix B: Merge close segments in post-processing**
```python
def merge_segments(segments: list[dict], gap_s: float = 0.6) -> list[dict]:
    """Merge segments that are within gap_s seconds of each other."""
    if not segments:
        return segments
    merged = [dict(segments[0])]
    for seg in segments[1:]:
        if seg["start"] - merged[-1]["end"] <= gap_s:
            merged[-1]["end"] = seg["end"]
        else:
            merged.append(dict(seg))
    return merged

merged = merge_segments(raw_segments, gap_s=0.5)
```

**Fix C: Increase silence counter in real-time VAD**
```python
SILENCE_LIMIT = 30  # was 15 — wait 30 * 32ms = 960ms before ending
```

---

## Problem 4: webrtcvad Assertion / ValueError

**Symptoms:** `Error: 10` or `ValueError: Error code: 10` from webrtcvad

```
Error: 10 from _webrtcvad.vad(...)
```

### Cause and Fix

webrtcvad requires exact constraints:

```python
# Check your input parameters:
assert sr in (8000, 16000, 32000), f"Bad sample rate: {sr}"
assert frame_ms in (10, 20, 30), f"Bad frame duration: {frame_ms}ms"

expected_bytes = int(sr * frame_ms / 1000) * 2  # 16-bit = 2 bytes/sample
assert len(frame_bytes) == expected_bytes, (
    f"Frame size mismatch: got {len(frame_bytes)}, expected {expected_bytes}"
)
```

---

## Problem 5: silero Model Producing 0.0 for All Frames

**Symptoms:** Every chunk returns `0.0` probability even for clear speech.

### Cause: Forgot to reset states

```python
# silero LSTM state persists between calls.
# Always reset before a new audio stream:
model.reset_states()
```

### Cause: Wrong chunk size

```python
# silero at 16kHz requires EXACTLY 512 samples per chunk
# at 8kHz requires EXACTLY 256 samples
chunk = audio[i:i + 512]
if len(chunk) != 512:
    chunk = np.pad(chunk, (0, 512 - len(chunk)))  # zero-pad last chunk
```

### Cause: Wrong data type

```python
# Input must be float32 in range [-1.0, 1.0]
audio = audio.astype(np.float32)
if audio.max() > 1.0:          # int16 input
    audio = audio / 32768.0
tensor = torch.from_numpy(audio)
```

---

## Problem 6: pyannote.audio Token Error

```
requests.exceptions.HTTPError: 401 Client Error: Unauthorized
```

### Fix

```python
# 1. Verify your token is set
import os
token = os.environ.get("HUGGINGFACE_TOKEN")
print("Token set:", bool(token))

# 2. Test the token
from huggingface_hub import HfApi
api = HfApi()
user = api.whoami(token=token)
print("Logged in as:", user["name"])

# 3. Check you accepted the model agreement at:
# https://hf.co/pyannote/voice-activity-detection
```

---

## Problem 7: Real-Time VAD Latency Too High

**Symptoms:** Noticeable delay between speech start/end and system response.

### Diagnosis

```python
import time
import torch
from silero_vad import load_silero_vad
import numpy as np

model = load_silero_vad()
model.reset_states()
chunk = torch.zeros(512)

# Benchmark
times = []
for _ in range(1000):
    t0 = time.perf_counter()
    with torch.no_grad():
        model(chunk, 16000)
    times.append(time.perf_counter() - t0)

print(f"Avg inference: {np.mean(times)*1000:.3f}ms")
print(f"P99 inference: {np.percentile(times, 99)*1000:.3f}ms")
# Should be < 2ms on modern CPU
```

### Fixes

| Cause | Fix |
|-------|-----|
| Audio queue filling up | Increase callback thread priority |
| PyTorch JIT not compiled | Use `silero_vad` pip package (pre-compiled) |
| ONNX mode not loaded | `load_silero_vad(onnx=True)` for lighter runtime |
| Chunk too large | Use 512 samples (not 1024+) |
| Using GPU (cold) | Prefer CPU for <1ms VAD; GPU adds warmup overhead |

---

## Problem 8: PyAudio `OSError: [Errno -9996] Invalid input device`

```python
import pyaudio
p = pyaudio.PyAudio()

# List available input devices
for i in range(p.get_device_count()):
    info = p.get_device_info_by_index(i)
    if info["maxInputChannels"] > 0:
        print(f"Device {i}: {info['name']}")

# Set the correct device index
stream = p.open(
    format=pyaudio.paInt16,
    channels=1,
    rate=16000,
    input=True,
    input_device_index=1,  # ← use the index from above
    frames_per_buffer=480,
)
```

---

## Tuning Parameters Reference

| Library | Parameter | Default | Effect |
|---------|-----------|---------|--------|
| silero | `threshold` | 0.5 | Higher = fewer false positives; lower = fewer misses |
| silero | `min_speech_duration_ms` | 250 | Skip segments shorter than this |
| silero | `min_silence_duration_ms` | 100 | Silence gap required to split segments |
| silero | `speech_pad_ms` | 30 | Padding added before/after each segment |
| webrtcvad | `aggressiveness` | 2 | 0–3; higher = more filtering |
| webrtcvad | `frame_duration_ms` | 30 | 10/20/30; shorter = lower latency |
| energy | `threshold_db` | -40 | Lower = more sensitive |
| Real-time | `SILENCE_LIMIT` | 15–20 | Frames of silence before ending utterance |
| Real-time | `ONSET_CHUNKS` | 3 | Frames of speech before triggering |

---

## See Also

- [VAD Algorithms & Theory](/kb/ai/vad/algorithms-theory/)
- [VAD Implementation](/kb/ai/vad/implementation/)
- [Real-Time Streaming VAD](/kb/ai/vad/real-time-streaming/)
- [VAD Libraries Comparison](/kb/ai/vad/libraries-comparison/)
- [VAD Cheatsheet](/kb/ai/vad/cheatsheet/)
- [ASR Troubleshooting](/kb/ai/asr/troubleshooting/) — VAD false positives cause ASR hallucinations; VAD misses cause ASR to receive silence
- [TTS Troubleshooting](/kb/ai/tts/troubleshooting/) — Use ASR round-trip (VAD→ASR) to measure TTS intelligibility
