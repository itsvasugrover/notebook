---
title: "ASR Installation & Setup"
createTime: 2026/03/21 13:03:00
permalink: /kb/ai/asr/installation/
---

# ASR Installation & Setup

Complete installation instructions for every major ASR library, including system dependencies, virtual environments, platform-specific notes, and Docker setups.

---

## Prerequisites

### System Dependencies

```bash
# Ubuntu / Debian
sudo apt update
sudo apt install -y python3-dev python3-pip build-essential \
    ffmpeg libsndfile1 portaudio19-dev

# Fedora / RHEL
sudo dnf install -y python3-devel ffmpeg libsndfile portaudio-devel

# macOS (Homebrew)
brew install ffmpeg libsndfile portaudio

# Windows (Chocolatey)
choco install ffmpeg
pip install pipwin
pipwin install pyaudio
```

**ffmpeg** is needed for format conversion (MP3, OGG, FLAC → WAV).  
**libsndfile** is needed by `soundfile` for reading audio.  
**portaudio** is needed by `pyaudio`/`sounddevice` for microphone input.

### Python Environment

```bash
python3 -m venv asr-env
source asr-env/bin/activate
pip install --upgrade pip
```

---

## 1. openai-whisper

```bash
pip install openai-whisper
# Requires PyTorch (will install automatically)
```

Whisper downloads models on first use to `~/.cache/whisper/`.  
Pre-download a specific model:

```python
import whisper
whisper.load_model("base.en")   # downloads if not cached
```

### Pre-download All Models You Need

```bash
python3 -c "
import whisper
for m in ['tiny.en', 'base.en', 'small.en', 'medium.en']:
    print(f'Downloading {m}...')
    whisper.load_model(m)
print('Done')
"
```

### Verify

```python
import whisper
model = whisper.load_model("tiny.en")
result = model.transcribe("test.wav")
print(result["text"])
```

---

## 2. faster-whisper (Recommended)

```bash
pip install faster-whisper
```

This installs CTranslate2 automatically. For GPU support, install PyTorch with CUDA first:

```bash
# CUDA 12.x
pip install torch torchaudio --index-url https://download.pytorch.org/whl/cu121
pip install faster-whisper
```

### Model Download Locations

faster-whisper models are downloaded from HuggingFace to `~/.cache/huggingface/hub/`:

```python
from faster_whisper import WhisperModel

# Models download automatically on first use
# Pass a HuggingFace model ID or local path
model = WhisperModel("base.en", device="cpu", compute_type="int8")
```

### Pre-convert and Cache Locally

```bash
# Convert original Whisper model to CTranslate2 format
pip install ctranslate2

ct2-opus-mt-converter --help  # not whisper-specific

# Or use faster-whisper's built-in download
python3 -c "
from faster_whisper import WhisperModel
model = WhisperModel('base.en', device='cpu', compute_type='int8')
print('Model ready at:', model.model_path)
"
```

### Verify

```python
from faster_whisper import WhisperModel
model = WhisperModel("tiny.en", device="cpu", compute_type="int8")
segments, info = model.transcribe("test.wav")
print("".join(s.text for s in segments))
```

---

## 3. RealtimeSTT

```bash
pip install RealtimeSTT
# Installs faster-whisper, sounddevice, silero-vad automatically
```

### Verify

```python
from RealtimeSTT import AudioToTextRecorder
recorder = AudioToTextRecorder(model="tiny.en")
print("RealtimeSTT ready")
recorder.stop()
```

---

## 4. transformers (Wav2Vec2 / HuBERT)

```bash
pip install transformers torch torchaudio soundfile

# For GPU
pip install torch torchaudio --index-url https://download.pytorch.org/whl/cu121
pip install transformers soundfile
```

### Download Model Weights

```python
from transformers import Wav2Vec2ForCTC, Wav2Vec2Processor

# Downloads to ~/.cache/huggingface/hub/ on first run
processor = Wav2Vec2Processor.from_pretrained("facebook/wav2vec2-base-960h")
model = Wav2Vec2ForCTC.from_pretrained("facebook/wav2vec2-base-960h")
print("Wav2Vec2 loaded")
```

### Offline Use: Save Locally

```python
# Save
model.save_pretrained("./local_wav2vec2")
processor.save_pretrained("./local_wav2vec2")

# Load offline
model = Wav2Vec2ForCTC.from_pretrained("./local_wav2vec2")
processor = Wav2Vec2Processor.from_pretrained("./local_wav2vec2")
```

---

## 5. Vosk

```bash
pip install vosk
```

### Download Language Models

Models are NOT bundled with pip — download from [alphacephei.com/vosk/models](https://alphacephei.com/vosk/models):

```bash
# Small English model (~40MB)
wget https://alphacephei.com/vosk/models/vosk-model-small-en-us-0.15.zip
unzip vosk-model-small-en-us-0.15.zip

# Large English model (~1.8GB, much better accuracy)
wget https://alphacephei.com/vosk/models/vosk-model-en-us-0.22.zip
unzip vosk-model-en-us-0.22.zip
```

Or via Python:

```python
from vosk import Model
# If model path doesn't exist, Vosk will try to download it
model = Model("vosk-model-small-en-us-0.15")
```

---

## 6. SpeechBrain

```bash
pip install speechbrain torch torchaudio
```

Models download automatically from HuggingFace on first use:

```python
from speechbrain.pretrained import EncoderDecoderASR

asr = EncoderDecoderASR.from_hparams(
    source="speechbrain/asr-crdnn-rnnlm-librispeech",
    savedir="pretrained_models/asr-crdnn"
)
text = asr.transcribe_file("test.wav")
print(text)
```

---

## 7. speech_recognition

```bash
pip install SpeechRecognition
pip install pyaudio   # for microphone

# For Whisper backend
pip install openai-whisper

# For CMU Sphinx offline backend
pip install pocketsphinx
```

---

## 8. jiwer (for WER evaluation)

```bash
pip install jiwer
```

```python
from jiwer import wer
error = wer("the cat sat on the mat", "the cat set on the mat")
print(f"WER: {error:.3f}")  # 0.167
```

---

## Full Environment Setup

### Minimal (faster-whisper only)

```bash
python3 -m venv asr-env && source asr-env/bin/activate
pip install faster-whisper soundfile sounddevice numpy
```

### Development (all libraries)

```bash
python3 -m venv asr-env && source asr-env/bin/activate
pip install faster-whisper openai-whisper RealtimeSTT \
    transformers torch torchaudio soundfile sounddevice \
    speechbrain vosk jiwer pyaudio librosa
```

### requirements.txt (production)

```text
faster-whisper>=1.0.0
soundfile>=0.12.0
sounddevice>=0.4.6
numpy>=1.24.0
torch>=2.1.0
torchaudio>=2.1.0
```

---

## Docker Setup

```dockerfile
FROM python:3.11-slim

RUN apt-get update && apt-get install -y \
    ffmpeg libsndfile1 portaudio19-dev build-essential \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install faster-whisper (CPU int8)
RUN pip install --no-cache-dir faster-whisper soundfile sounddevice numpy

# Pre-download model at build time
RUN python3 -c "from faster_whisper import WhisperModel; \
    WhisperModel('base.en', device='cpu', compute_type='int8')"

COPY . .
CMD ["python3", "main.py"]
```

### With GPU (CUDA)

```dockerfile
FROM nvidia/cuda:12.1.0-cudnn8-runtime-ubuntu22.04

RUN apt-get update && apt-get install -y python3 python3-pip ffmpeg libsndfile1
RUN pip3 install torch torchaudio --index-url https://download.pytorch.org/whl/cu121
RUN pip3 install faster-whisper soundfile numpy

# Pre-download model
RUN python3 -c "from faster_whisper import WhisperModel; \
    WhisperModel('large-v3', device='cuda', compute_type='float16')"
```

---

## Platform Notes

| Platform | Notes |
|----------|-------|
| Raspberry Pi (arm64) | Use Vosk (small model) or faster-whisper (tiny, int8) |
| macOS Apple Silicon (M1/M2/M3) | Use `device="mps"` for Metal acceleration with PyTorch |
| Windows | Pre-built CTranslate2 wheels available — `pip install faster-whisper` just works |
| WSL2 | Audio passthrough needed for mic; file-based is straightforward |
| NVIDIA GPU | Use `compute_type="float16"` for best speed/accuracy |
| CPU-only server | Use `compute_type="int8"` — 4× memory reduction, minimal accuracy loss |

### macOS MPS Acceleration

```python
import torch
from faster_whisper import WhisperModel

# MPS (Metal) — faster than CPU on Apple Silicon
# Note: faster-whisper doesn't support MPS directly; use openai-whisper for MPS
import whisper
model = whisper.load_model("base.en").to("mps")
```

---

## See Also

- [ASR Libraries Comparison](/kb/ai/asr/libraries-comparison/)
- [ASR Implementation](/kb/ai/asr/implementation/)
- [ASR Cheatsheet](/kb/ai/asr/cheatsheet/)
- [VAD Installation](/kb/ai/vad/installation/) — Install VAD alongside ASR; silero-vad is a dependency of RealtimeSTT
- [TTS Installation](/kb/ai/tts/installation/) — Complete the full pipeline by installing TTS
