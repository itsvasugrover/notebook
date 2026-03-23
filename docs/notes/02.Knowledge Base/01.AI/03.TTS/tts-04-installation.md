---
title: "TTS Installation"
createTime: 2026/03/21 14:03:00
permalink: /kb/ai/tts/installation/
---

# TTS Installation

System dependencies, library installs, model downloads, and platform-specific notes for every major TTS library.

---

## System Dependencies

### Ubuntu / Debian
```bash
sudo apt update && sudo apt install -y \
    ffmpeg \
    libsndfile1 \
    portaudio19-dev \
    espeak-ng \
    libespeak-ng-dev \
    python3-dev \
    build-essential
```

### Fedora / RHEL
```bash
sudo dnf install -y ffmpeg libsndfile portaudio-devel espeak-ng espeak-ng-devel gcc
```

### macOS
```bash
brew install ffmpeg libsndfile portaudio espeak-ng
```

### Windows
- Install [ffmpeg](https://ffmpeg.org/download.html) and add to PATH
- Install [eSpeak-NG](https://github.com/espeak-ng/espeak-ng/releases) and add to PATH
- PortAudio: included in the `sounddevice` wheel — no manual install needed

---

## Kokoro

Fastest CPU TTS. Recommended for production.

```bash
# PyTorch backend
pip install kokoro soundfile numpy

# ONNX backend (even faster CPU, no PyTorch)
pip install kokoro[onnx] soundfile numpy

# eSpeak-NG for phonemization (misaki backend, optional but recommended)
pip install misaki[en]      # English
pip install misaki[ja]      # Japanese
pip install misaki[zh]      # Chinese
pip install misaki[ko]      # Korean
pip install misaki[fr]      # French
```

Models are **downloaded automatically** on first use to `~/.cache/huggingface/hub/`.

Manual pre-download:
```python
from huggingface_hub import snapshot_download
snapshot_download("hexgrad/Kokoro-82M", local_dir="./models/kokoro")
```

---

## Coqui XTTS-v2

```bash
# Basic install
pip install TTS

# Specific XTTS-v2 with GPU
pip install TTS torch torchaudio --index-url https://download.pytorch.org/whl/cu121
```

Pre-download model (~2.8GB):
```python
from TTS.api import TTS
tts = TTS("tts_models/multilingual/multi-dataset/xtts_v2")
# Downloads to ~/.local/share/tts/tts_models--multilingual--multi-dataset--xtts_v2/
```

Manual download (for offline/Docker):
```bash
# Using huggingface-cli
pip install huggingface_hub
huggingface-cli download coqui/XTTS-v2 --local-dir ./models/xtts_v2
```

---

## F5-TTS

```bash
pip install f5-tts

# With GPU support
pip install f5-tts torch torchaudio --index-url https://download.pytorch.org/whl/cu121
```

Pre-download model:
```bash
huggingface-cli download SWivid/F5-TTS --local-dir ./models/f5-tts
```

Or via Python:
```python
from f5_tts.api import F5TTS
tts = F5TTS()  # downloads ~1.2GB on first run
```

---

## Bark

```bash
pip install bark

# suno-bark fork (more maintained)
pip install git+https://github.com/suno-ai/bark.git

# Dependencies
pip install transformers accelerate torch torchaudio soundfile
```

Pre-download all models (~5GB total):
```python
from bark import preload_models
preload_models()
# Downloads to ~/.cache/suno/bark_v0/
```

Models are stored separately:
```
~/.cache/suno/bark_v0/
├── text_2.pt          # semantic model (~1.2GB)
├── coarse_2.pt        # coarse acoustic (~1.2GB)
├── fine_2.pt          # fine acoustic (~1.2GB)
└── hubert_base_ls960.pt  # semantic encoder
```

Small models (lower quality, much faster):
```python
import os
os.environ["SUNO_USE_SMALL_MODELS"] = "True"
from bark import preload_models
preload_models()
```

---

## edge-tts

```bash
pip install edge-tts
# No model download — uses Microsoft cloud
```

---

## OpenVoice V2

```bash
git clone https://github.com/myshell-ai/OpenVoice
cd OpenVoice
pip install -e .
pip install melo-tts

# Download checkpoints (~500MB)
python -c "
from huggingface_hub import snapshot_download
snapshot_download('myshell-ai/OpenVoiceV2', local_dir='./checkpoints_v2')
"
```

---

## StyleTTS2

```bash
pip install git+https://github.com/yl4579/StyleTTS2.git
pip install torch torchaudio phonemizer einops transformers

# Download model
huggingface-cli download yl4579/StyleTTS2-LibriTTS --local-dir ./models/styletts2
```

---

## pyttsx3

```bash
pip install pyttsx3

# Linux: requires espeak or espeak-ng
sudo apt install espeak-ng

# macOS: uses built-in NSSpeechSynthesizer (no extra deps)
# Windows: uses SAPI5 (no extra deps)
```

---

## sounddevice (for real-time audio output)

```bash
pip install sounddevice
# Requires portaudio (installed above)
```

---

## Minimal requirements.txt

```text
# Core TTS stack
kokoro>=0.9.0
soundfile>=0.12.1
numpy>=1.24.0
sounddevice>=0.4.6

# For voice cloning (pick one)
# f5-tts>=0.3.0
# TTS>=0.22.0          # Coqui XTTS-v2

# For cloud TTS (no offline needed)
# edge-tts>=6.1.9

# For Bark
# bark>=1.0.0
# transformers>=4.35.0
# accelerate>=0.24.0
```

---

## Docker (CPU)

```dockerfile
FROM python:3.11-slim

RUN apt-get update && apt-get install -y \
    ffmpeg libsndfile1 espeak-ng portaudio19-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
RUN pip install --no-cache-dir kokoro soundfile numpy sounddevice

# Pre-download models at build time
RUN python -c "from kokoro import KPipeline; KPipeline(lang_code='a')"

COPY . .
CMD ["python", "tts_service.py"]
```

## Docker (GPU — XTTS-v2 / F5-TTS)

```dockerfile
FROM nvidia/cuda:12.1.1-cudnn8-runtime-ubuntu22.04

RUN apt-get update && apt-get install -y python3 python3-pip ffmpeg libsndfile1 espeak-ng \
    && rm -rf /var/lib/apt/lists/*

RUN pip3 install --no-cache-dir \
    torch torchaudio --index-url https://download.pytorch.org/whl/cu121 \
    TTS soundfile numpy

WORKDIR /app
COPY . .
CMD ["python3", "tts_api.py"]
```

---

## Platform Notes

| Platform | Notes |
|----------|-------|
| **Raspberry Pi 4** | Kokoro ONNX only — too slow otherwise. Use `int8` ONNX. Consider `tiny` voices. |
| **Apple Silicon (M1/M2/M3)** | Use `device="mps"` for PyTorch acceleration. Kokoro ONNX also works well. |
| **Windows** | pyttsx3 and edge-tts work natively. Kokoro requires WSL or proper Python env. |
| **WSL2** | PortAudio may not access mic/speakers — route audio via PulseAudio or use file output only. |
| **Headless server** | Use file output only — no sounddevice streaming. Serve audio via API. |

---

## Verify Installation

```python
# Quick sanity check
from kokoro import KPipeline
import numpy as np
import soundfile as sf

pipe = KPipeline(lang_code="a")
chunks = [audio for _, _, audio in pipe("Installation successful.", voice="af_heart")]
sf.write("/tmp/test_tts.wav", np.concatenate(chunks), 24000)
print("TTS OK — check /tmp/test_tts.wav")
```

---

## See Also

- [TTS Libraries Comparison](/kb/ai/tts/libraries-comparison/)
- [TTS Implementation](/kb/ai/tts/implementation/)
- [ASR Installation](/kb/ai/asr/installation/) — Install ASR alongside TTS for a complete voice pipeline
- [VAD Installation](/kb/ai/vad/installation/) — Install VAD to capture the speech that drives the pipeline
