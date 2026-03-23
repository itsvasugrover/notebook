---
title: "VAD Installation & Setup"
createTime: 2026/03/21 12:03:00
permalink: /kb/ai/vad/installation/
---

# VAD Installation & Setup

Complete installation instructions for every major VAD library, including dependencies, platform notes, and environment setup.

---

## Prerequisites

### System Dependencies

```bash
# Ubuntu / Debian
sudo apt update
sudo apt install -y python3-dev python3-pip ffmpeg portaudio19-dev

# Fedora / RHEL
sudo dnf install -y python3-devel ffmpeg portaudio-devel

# macOS (Homebrew)
brew install ffmpeg portaudio

# Windows (Chocolatey)
choco install ffmpeg
```

### Python Environment (Recommended)

Always use a virtual environment to avoid dependency conflicts:

```bash
# Create and activate a virtual environment
python3 -m venv vad-env
source vad-env/bin/activate   # Linux/macOS
# vad-env\Scripts\activate   # Windows

# Upgrade pip
pip install --upgrade pip
```

---

## 1. webrtcvad

```bash
pip install webrtcvad
```

### Verify Install

```python
import webrtcvad
vad = webrtcvad.Vad()
print("webrtcvad OK, version info:", webrtcvad.__version__ if hasattr(webrtcvad, '__version__') else "installed")
```

### Troubleshooting

```bash
# If build fails on Linux: missing C compiler
sudo apt install -y build-essential python3-dev

# If build fails on Windows: install Visual C++ Build Tools
# https://visualstudio.microsoft.com/visual-cpp-build-tools/

# Alternative pre-built wheel
pip install webrtcvad-wheels  # community pre-built wheels
```

---

## 2. silero-vad

### Option A: pip install (Recommended)

```bash
pip install silero-vad
```

This installs the model package directly. No internet needed at inference time.

```python
from silero_vad import load_silero_vad
model = load_silero_vad()
print("silero-vad ready")
```

### Option B: PyTorch Hub (requires PyTorch)

```bash
pip install torch torchaudio
```

```python
import torch
model, utils = torch.hub.load(
    repo_or_dir="snakers4/silero-vad",
    model="silero_vad",
    force_reload=False,
    onnx=False
)
```

### Option C: ONNX Runtime (no PyTorch)

For environments where PyTorch is too heavy:

```bash
pip install onnxruntime silero-vad
```

```python
from silero_vad import load_silero_vad
model = load_silero_vad(onnx=True)  # uses onnxruntime instead of torch
```

### Verify silero-vad

```python
from silero_vad import load_silero_vad, read_audio
import torch

model = load_silero_vad()
# Create a 1-second silent audio tensor
wav = torch.zeros(16000)
model.reset_states()
prob = model(wav[:512], 16000).item()
print(f"Speech probability on silence: {prob:.4f}")  # should be near 0
```

---

## 3. pyannote.audio

### Install

```bash
pip install pyannote.audio
```

### HuggingFace Token Setup

pyannote models require accepting user agreements:

1. Create account at [huggingface.co](https://huggingface.co)
2. Accept the license for the models you need:
   - [pyannote/segmentation-3.0](https://hf.co/pyannote/segmentation-3.0)
   - [pyannote/voice-activity-detection](https://hf.co/pyannote/voice-activity-detection)
3. Generate a token at [hf.co/settings/tokens](https://hf.co/settings/tokens)

### Using Your Token

```bash
# Option A: Environment variable (recommended)
export HUGGINGFACE_TOKEN="hf_xxxYourTokenHerexxx"

# Option B: huggingface-cli login
pip install huggingface_hub
huggingface-cli login
```

```python
import os
from pyannote.audio import Pipeline

pipeline = Pipeline.from_pretrained(
    "pyannote/voice-activity-detection",
    use_auth_token=os.environ["HUGGINGFACE_TOKEN"]
)
```

### GPU Setup (Optional but Recommended)

```bash
# Install PyTorch with CUDA support (CUDA 12.1 example)
pip install torch torchaudio --index-url https://download.pytorch.org/whl/cu121
pip install pyannote.audio
```

```python
import torch
pipeline.to(torch.device("cuda"))
```

---

## 4. auditok

```bash
pip install auditok

# For MP3/OGG support (requires ffmpeg system package):
pip install "auditok[extras]"
```

### Verify

```bash
python3 -c "import auditok; print('auditok', auditok.__version__)"
```

---

## 5. SpeechBrain

```bash
pip install speechbrain

# Download VAD model (first use only)
python3 -c "
from speechbrain.pretrained import VAD
vad = VAD.from_hparams(
    source='speechbrain/vad-crdnn-libriparty',
    savedir='pretrained_models/vad'
)
print('SpeechBrain VAD ready')
"
```

---

## 6. Audio I/O Libraries

### PyAudio (for microphone input)

```bash
# Linux
sudo apt install portaudio19-dev
pip install pyaudio

# macOS
brew install portaudio
pip install pyaudio

# Windows
pip install pyaudio  # pre-built wheels available on Windows
```

### sounddevice (alternative to PyAudio)

```bash
pip install sounddevice soundfile
```

### soundfile (for reading/writing audio files)

```bash
pip install soundfile
```

### numpy and scipy (signal processing)

```bash
pip install numpy scipy
```

---

## Complete Environment: All-in-One

For a full VAD development environment:

```bash
# Create environment
python3 -m venv vad-env
source vad-env/bin/activate

# Core audio
pip install numpy scipy soundfile sounddevice

# VAD libraries
pip install webrtcvad silero-vad auditok

# Heavy (optional — choose what you need)
pip install torch torchaudio           # required for silero-vad torch mode
pip install pyannote.audio             # requires HF token
pip install speechbrain                # full toolkit

# Utilities
pip install librosa matplotlib jupyter
```

### requirements.txt (minimal)

```text
numpy>=1.21.0
scipy>=1.7.0
soundfile>=0.10.3
sounddevice>=0.4.4
webrtcvad>=2.0.10
silero-vad>=4.0.0
```

### requirements.txt (full)

```text
numpy>=1.21.0
scipy>=1.7.0
soundfile>=0.10.3
sounddevice>=0.4.4
torch>=2.0.0
torchaudio>=2.0.0
webrtcvad>=2.0.10
silero-vad>=4.0.0
pyannote.audio>=3.1.0
speechbrain>=0.5.15
librosa>=0.10.0
auditok>=0.2.0
```

---

## Docker Setup

```dockerfile
FROM python:3.11-slim

# System deps
RUN apt-get update && apt-get install -y \
    ffmpeg \
    portaudio19-dev \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .
CMD ["python3", "main.py"]
```

---

## Platform-Specific Notes

| Platform | Notes |
|----------|-------|
| Raspberry Pi (arm64) | webrtcvad builds from source, silero-vad ONNX mode recommended |
| macOS Apple Silicon | Use `pip install torch` (MPS backend available for silero) |
| Windows | Use `webrtcvad-wheels` to avoid build issues |
| WSL2 | Microphone access requires Windows audio passthrough — use sounddevice |
| Docker (no GPU) | Use silero-vad ONNX or webrtcvad |
| Docker (NVIDIA GPU) | Use `nvidia/cuda` base image for pyannote/speechbrain |

---

## See Also

- [VAD Libraries Comparison](/kb/ai/vad/libraries-comparison/)
- [VAD Implementation](/kb/ai/vad/implementation/)
- [Real-Time Streaming VAD](/kb/ai/vad/real-time-streaming/)
- [VAD Cheatsheet](/kb/ai/vad/cheatsheet/)
- [ASR Installation](/kb/ai/asr/installation/) — Install ASR alongside VAD for a complete pipeline
- [TTS Installation](/kb/ai/tts/installation/) — Install TTS for the response side of the voice assistant
