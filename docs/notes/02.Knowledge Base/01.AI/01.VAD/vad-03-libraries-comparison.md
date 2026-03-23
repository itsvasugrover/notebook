---
title: "VAD Libraries Comparison"
createTime: 2026/03/21 12:02:00
permalink: /kb/ai/vad/libraries-comparison/
---

# VAD Libraries Comparison

A detailed comparison of every major Python VAD library, with real-world use case guidance.

---

## Quick Comparison Matrix

| Library | Approach | Model Size | GPU Required | Min Python | License | HuggingFace Required |
|---------|----------|-----------|-------------|-----------|---------|---------------------|
| `webrtcvad` | GMM | <1 MB | No | 3.6 | BSD-3 | No |
| `silero-vad` | LSTM (TorchScript) | ~2 MB | No (optional) | 3.8 | MIT | No |
| `pyannote.audio` | Transformer | ~300 MB | Recommended | 3.8 | MIT* | **Yes** |
| `speechbrain` | ECAPA-TDNN | ~200 MB | Recommended | 3.8 | Apache-2.0 | No |
| `nemo` | MarbleNet | ~40 MB | Recommended | 3.8 | Apache-2.0 | No |
| `auditok` | Energy-based | 0 | No | 3.6 | MIT | No |
| `librosa` + numpy | Custom spectral | 0 | No | 3.7 | ISC | No |

*pyannote.audio requires accepting HuggingFace model terms of service.

---

## 1. webrtcvad

**GitHub:** `py-webrtcvad` — Python bindings for Google's WebRTC VAD C library

### Strengths
- Battle-tested in production (used in Google Meet, WhatsApp, Zoom)
- Extremely low latency (<1ms per frame)
- No ML framework, runs anywhere (Raspberry Pi, etc.)
- Only ~50 KB binary dependency

### Weaknesses
- Only 3 supported sample rates: 8000, 16000, 32000 Hz
- Frame duration must be exactly 10, 20, or 30ms
- Lower accuracy than ML-based approaches in noisy environments
- No probability score — only binary decision

### Sample Code

```python
import webrtcvad
import wave

vad = webrtcvad.Vad(mode=2)  # aggressiveness 0-3

with wave.open("audio.wav", "rb") as wf:
    sample_rate = wf.getframerate()   # must be 8000, 16000, or 32000
    frame_duration = 20               # ms — must be 10, 20, or 30
    frame_size = int(sample_rate * frame_duration / 1000)
    
    while True:
        raw = wf.readframes(frame_size)
        if len(raw) < frame_size * 2:
            break
        is_speech = vad.is_speech(raw, sample_rate)
        print("SPEECH" if is_speech else "silence")
```

### Best For
- Edge devices, embedded Linux, Raspberry Pi  
- Real-time telephony (8kHz)  
- When you need absolute minimum latency  
- No internet, no ML setup

---

## 2. silero-vad

**GitHub:** `snakers4/silero-vad`

The community's favourite general-purpose VAD. Small, fast, accurate.

### Strengths
- State-of-art accuracy (~97% F1) with tiny 2MB model
- Works in CPU mode (fast enough for real-time)
- Returns probability scores, not just binary
- Official PyTorch Hub loading or local file
- Utility functions for timestamps, splitting audio
- Supports 8000 and 16000 Hz

### Weaknesses
- Requires PyTorch (~200MB install)
- Chunk size must match: 256 (8kHz) or 512 (16kHz) samples
- Model load takes ~0.5s on first use

### Loading Methods

```python
# Method 1: PyTorch Hub (requires internet first time)
import torch
model, utils = torch.hub.load(
    repo_or_dir="snakers4/silero-vad",
    model="silero_vad",
    force_reload=False
)

# Method 2: pip install + local (recommended for offline)
# pip install silero-vad
from silero_vad import load_silero_vad, read_audio, get_speech_timestamps
model = load_silero_vad()
```

### Getting Timestamps

```python
from silero_vad import load_silero_vad, read_audio, get_speech_timestamps

model = load_silero_vad()
wav = read_audio("speech.wav", sampling_rate=16000)

timestamps = get_speech_timestamps(
    wav,
    model,
    sampling_rate=16000,
    threshold=0.5,          # speech probability threshold
    min_speech_duration_ms=250,
    max_speech_duration_s=float("inf"),
    min_silence_duration_ms=100,
    speech_pad_ms=30,
)
# timestamps: [{"start": 1234, "end": 5678}, ...]  (in samples)
```

### Chunk-by-Chunk Inference

```python
import torch

model = load_silero_vad()
model.reset_states()  # important: reset between audio streams

chunk = torch.zeros(512)  # 512 samples at 16kHz = 32ms
prob = model(chunk, 16000).item()
print(f"Speech probability: {prob:.3f}")
```

### Best For
- General purpose VAD in any Python application  
- When you want probability scores  
- CPU inference on servers  
- Getting precise speech timestamps from files

---

## 3. pyannote.audio

**GitHub:** `pyannote/pyannote-audio`

Enterprise-grade pipeline combining VAD + speaker diarization.

### Strengths
- Highest quality VAD + diarization in one pipeline
- Speaker-aware segmentation
- Pre-trained models on diverse datasets
- Active research project with frequent updates

### Weaknesses
- Requires GPU for real-time use
- Requires accepting HuggingFace model license agreements
- Heavy dependency tree (~1GB total with transformers)
- High latency for short utterances

### Setup (includes HuggingFace token)

```python
# 1. Accept terms at: https://hf.co/pyannote/voice-activity-detection
# 2. Get your token from https://hf.co/settings/tokens

from pyannote.audio import Pipeline

pipeline = Pipeline.from_pretrained(
    "pyannote/voice-activity-detection",
    use_auth_token="YOUR_HF_TOKEN"
)

# Run on a file
output = pipeline("audio.wav")

# Iterate over speech regions
for speech in output.get_timeline().support():
    print(f"Speech: {speech.start:.2f}s → {speech.end:.2f}s")
```

### With GPU

```python
import torch
pipeline = Pipeline.from_pretrained("pyannote/voice-activity-detection",
                                    use_auth_token="YOUR_HF_TOKEN")
pipeline.to(torch.device("cuda"))
```

### Best For
- Speaker diarization ("who spoke when")
- Meeting transcription with speaker labels
- High-quality offline processing (not real-time)

---

## 4. auditok

**GitHub:** `amsehili/auditok`

Pure Python, energy-based VAD with a convenient CLI and API.

### Strengths
- Zero ML dependencies
- Works with any audio format via ffmpeg
- Great CLI tool for splitting audio files
- Simple Python API

### Sample Code

```python
import auditok

# Split audio file into speech regions
regions = auditok.split(
    "audio.wav",
    min_dur=0.2,     # minimum speech duration (seconds)
    max_dur=10,      # maximum speech duration (seconds)
    max_silence=0.3, # max silence inside a segment (seconds)
    energy_threshold=55  # audio energy threshold (dB)
)

for i, region in enumerate(regions):
    region.save(f"speech_{i:03d}.wav")
    print(f"Segment {i}: {region.meta.start:.2f}s → {region.meta.end:.2f}s")
```

### CLI Usage

```bash
auditok -i audio.wav -e 55 -m 0.2 -s 0.3 --save-to-file speech_{N}.wav
```

### Best For
- Splitting podcast/lecture recordings into segments
- CLI batch processing
- When you cannot install PyTorch

---

## 5. SpeechBrain

Full ASR toolkit with built-in VAD.

### Sample Code

```python
from speechbrain.pretrained import VAD

vad = VAD.from_hparams(
    source="speechbrain/vad-crdnn-libriparty",
    savedir="pretrained_models/vad-crdnn"
)

# Get speech boundaries
boundaries = vad.get_speech_segments(
    "audio.wav",
    large_chunk_size=30,
    small_chunk_size=10,
    overlap_small_chunk=True,
    apply_energy_VAD=True,
    double_check=True,
)

# Save to file
vad.save_boundaries(boundaries, save_path="boundaries.csv")
```

### Best For
- End-to-end ASR pipeline with SpeechBrain
- When you're already using SpeechBrain for ASR

---

## 6. NVIDIA NeMo (MarbleNet)

```python
import nemo.collections.asr as nemo_asr

# Load MarbleNet VAD model
vad_model = nemo_asr.models.EncDecClassificationModel.from_pretrained(
    "vad_marblenet"
)

# Process a file
vad_model.setup_test_data(test_data_config={
    "sample_rate": 16000,
    "manifest_filepath": "manifest.json",
    "labels": ["background", "speech"],
    "batch_size": 1,
    "shuffle": False,
})
```

### Best For
- NVIDIA GPU servers with NeMo already set up
- Integration with NeMo's full ASR/NLP pipeline

---

## Decision Flowchart

```
Start: What are your constraints?
│
├─ No ML framework allowed / embedded device
│   └─ webrtcvad or auditok
│
├─ Need probability scores (not just binary)
│   └─ silero-vad
│
├─ Need speaker identity ("who spoke when")
│   └─ pyannote.audio
│
├─ Running in production with NVIDIA GPUs + NeMo
│   └─ NeMo MarbleNet
│
├─ Already using SpeechBrain for ASR
│   └─ SpeechBrain VAD
│
└─ General purpose, accuracy matters most
    └─ silero-vad (recommended default)
```

---

## See Also

- [Introduction to VAD](/kb/ai/vad/introduction/)
- [VAD Installation](/kb/ai/vad/installation/)
- [VAD Implementation](/kb/ai/vad/implementation/)
- [Real-Time Streaming VAD](/kb/ai/vad/real-time-streaming/)
- [ASR Libraries Comparison](/kb/ai/asr/libraries-comparison/) — faster-whisper includes a built-in silero-vad filter; library choices affect which VAD integrates best
- [TTS Libraries Comparison](/kb/ai/tts/libraries-comparison/) — understanding the full pipeline stack helps when selecting VAD
