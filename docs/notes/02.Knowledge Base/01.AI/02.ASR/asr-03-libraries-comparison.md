---
title: "ASR Libraries Comparison"
createTime: 2026/03/21 13:02:00
permalink: /kb/ai/asr/libraries-comparison/
---

# ASR Libraries Comparison

Detailed breakdown of every major Python ASR library — models, performance, features, and the right use case for each.

---

## Quick Comparison Matrix

| Library | Model | Size | GPU? | Offline | Streaming | Languages | License |
|---------|-------|------|------|---------|-----------|-----------|---------|
| `openai-whisper` | Whisper | 39MB–2.9GB | Optional | ✅ | ❌ (30s chunks) | 100+ | MIT |
| `faster-whisper` | Whisper (CT2) | same | Optional | ✅ | ✅ | 100+ | MIT |
| `RealtimeSTT` | faster-whisper | same | Optional | ✅ | ✅ | 100+ | MIT |
| `transformers` Wav2Vec2 | Wav2Vec2/HuBERT | 300MB–1GB | Recommended | ✅ | ✅ | Per-model | Apache-2 |
| `vosk` | Vosk/Kaldi | 40MB–2GB | No | ✅ | ✅ | 20+ | Apache-2 |
| `speechbrain` | Various | 200MB+ | Recommended | ✅ | ✅ | Multi | Apache-2 |
| `nemo` | Conformer | 50–500MB | Recommended | ✅ | ✅ | Multi | Apache-2 |
| `speech_recognition` | Cloud APIs | 0 | Cloud | ❌ | ❌ | 100+ | BSD-3 |
| `whisper.cpp` | Whisper GGML | 39MB–1.5GB | Optional | ✅ | ✅ | 100+ | MIT |

---

## 1. openai-whisper

**GitHub:** `openai/whisper`  
The original Whisper implementation in PyTorch.

### Strengths
- Reference implementation — always up to date
- Simple API
- Word-level timestamps
- Translation mode (any language → English)
- Supports 100+ languages and automatic language detection

### Weaknesses
- Slower than faster-whisper (2–4×)
- High VRAM usage at large model sizes
- Not designed for true real-time streaming

### Quick Usage

```python
import whisper

model = whisper.load_model("base")         # tiny/base/small/medium/large-v3/turbo

# Transcribe a file
result = model.transcribe("audio.wav")
print(result["text"])

# With options
result = model.transcribe(
    "audio.wav",
    language="en",          # force language (None = auto-detect)
    task="transcribe",      # "transcribe" or "translate"
    fp16=True,              # use float16 (GPU only)
    word_timestamps=True,   # enable word-level timestamps
    verbose=False,
)
```

### Best For
- Offline file transcription
- Multilingual projects
- When you want the simplest possible Whisper API

---

## 2. faster-whisper

**GitHub:** `SYSTRAN/faster-whisper`  
Whisper reimplemented using CTranslate2 — the community's top pick for production.

### Strengths
- **2–4× faster** than openai-whisper on CPU
- **Up to 4× less VRAM** on GPU
- INT8 quantization (CPU) for even lower memory
- Word-level timestamps via DTW
- Built-in VAD filter (silero-vad integration)
- Streaming support via `model.transcribe()` generator

### Weaknesses
- External dependency (CTranslate2 compiled binaries)
- Slightly different API from openai-whisper

### Models

```python
from faster_whisper import WhisperModel

# CPU (int8 quantization — recommended for CPU-only setups)
model = WhisperModel("base.en", device="cpu", compute_type="int8")

# GPU (float16 — recommended for GPU)
model = WhisperModel("large-v3", device="cuda", compute_type="float16")

# GPU (int8 — saves VRAM, slight accuracy trade-off)
model = WhisperModel("large-v3", device="cuda", compute_type="int8_float16")

# Turbo (best speed/accuracy balance)
model = WhisperModel("turbo", device="cuda", compute_type="float16")
```

### Transcription

```python
segments, info = model.transcribe(
    "audio.wav",
    language="en",               # None = auto-detect
    task="transcribe",
    beam_size=5,
    best_of=5,
    patience=1.0,
    temperature=0.0,             # 0 = deterministic
    condition_on_previous_text=True,
    vad_filter=True,             # built-in silero VAD to skip silence
    vad_parameters={
        "threshold": 0.5,
        "min_speech_duration_ms": 250,
        "min_silence_duration_ms": 2000,
    },
    word_timestamps=True,
)

# Iterate segments (generator — lazy evaluation)
for seg in segments:
    print(f"[{seg.start:.2f}s → {seg.end:.2f}s] {seg.text}")
    if seg.words:
        for w in seg.words:
            print(f"   {w.start:.2f}-{w.end:.2f}: {w.word}")
```

### Best For
- **Production transcription** — this is the recommended default
- CPU-only servers (int8 mode)
- When you need word timestamps
- Real-time streaming pipelines

---

## 3. RealtimeSTT

**GitHub:** `KoljaB/RealtimeSTT`  
A high-level library wrapping faster-whisper with a ready-to-use real-time transcription pipeline.

### Strengths
- Easiest way to get microphone → real-time text working
- Built-in VAD (silero) + audio buffering
- Callback-based API
- Handles all the threading complexity for you

### Usage

```python
from RealtimeSTT import AudioToTextRecorder

def process_text(text: str):
    print(f"Transcribed: {text}")

recorder = AudioToTextRecorder(
    model="base.en",
    language="en",
    silero_sensitivity=0.4,
    webrtc_sensitivity=2,
    on_realtime_transcription_stabilized=process_text,
)

print("Speak now...")
recorder.start()
input("Press Enter to stop...")
recorder.stop()
```

### Best For
- Rapid prototyping of voice applications
- When you don't want to manage VAD + ASR threading manually

---

## 4. transformers (Wav2Vec2 / HuBERT / MMS)

**GitHub:** `huggingface/transformers`  
HuggingFace transformers gives access to hundreds of ASR models.

### Key Models

| Model | Size | Best For |
|-------|------|----------|
| `facebook/wav2vec2-base-960h` | 360MB | English, fast |
| `facebook/wav2vec2-large-960h-lv60-self` | 1.18GB | English, best quality |
| `facebook/hubert-large-ls960-ft` | 1.25GB | English, very accurate |
| `facebook/mms-300m` | 1.7GB | 1000+ languages |
| `openai/whisper-large-v3` | 3GB | Via pipeline API |

### Usage: pipeline API (Simplest)

```python
from transformers import pipeline

asr = pipeline(
    "automatic-speech-recognition",
    model="facebook/wav2vec2-base-960h",
    device=0,    # 0 = first GPU, -1 = CPU
)

result = asr("audio.wav")
print(result["text"])

# With chunking for long audio
result = asr(
    "long_audio.wav",
    chunk_length_s=30,
    stride_length_s=5,
    return_timestamps="word",
)
```

### Usage: Manual (More Control)

```python
import torch
import soundfile as sf
from transformers import Wav2Vec2ForCTC, Wav2Vec2Processor

processor = Wav2Vec2Processor.from_pretrained("facebook/wav2vec2-base-960h")
model = Wav2Vec2ForCTC.from_pretrained("facebook/wav2vec2-base-960h")

audio, sr = sf.read("audio.wav")
inputs = processor(
    audio,
    sampling_rate=sr,
    return_tensors="pt",
    padding=True
)

with torch.no_grad():
    logits = model(**inputs).logits

predicted_ids = torch.argmax(logits, dim=-1)
transcription = processor.batch_decode(predicted_ids)
print(transcription[0])
```

### Fine-tuning on Custom Data

Wav2Vec2 is the go-to for domain adaptation (medical terms, names, jargon):

```python
from transformers import Wav2Vec2ForCTC, TrainingArguments, Trainer

model = Wav2Vec2ForCTC.from_pretrained(
    "facebook/wav2vec2-base",
    ctc_loss_reduction="mean",
    pad_token_id=processor.tokenizer.pad_token_id,
    vocab_size=len(processor.tokenizer),
)
model.freeze_feature_encoder()  # keep CNN weights frozen

# Use HuggingFace Trainer or custom training loop
```

### Best For
- Fine-tuning on custom vocabulary/domain
- 1000+ language support (MMS model)
- Research and experimentation

---

## 5. Vosk

**GitHub:** `alphacep/vosk-api`  
Offline streaming ASR based on Kaldi, designed for embedded and real-time use.

### Strengths
- Very small models (40MB English small model)
- True token-by-token streaming output
- Works on Raspberry Pi, Android, iOS
- No GPU required
- 20+ language models available

### Weaknesses
- Lower accuracy than Whisper
- English small model Word Error Rate ~8–12%
- No multilingual single model

### Usage

```python
from vosk import Model, KaldiRecognizer
import wave, json

model = Model("vosk-model-small-en-us-0.15")  # download from vosk website
wf = wave.open("audio.wav", "rb")
rec = KaldiRecognizer(model, wf.getframerate())
rec.SetWords(True)

results = []
while True:
    data = wf.readframes(4000)
    if not data:
        break
    if rec.AcceptWaveform(data):
        r = json.loads(rec.Result())
        results.append(r)
    else:
        partial = json.loads(rec.PartialResult())
        print(f"Partial: {partial.get('partial', '')}", end="\r")

final = json.loads(rec.FinalResult())
print("\nFinal:", final.get("text", ""))
```

### Best For
- Embedded / Raspberry Pi / Android / iOS
- True word-by-word streaming output
- Applications with strict memory constraints (<100MB)

---

## 6. speech_recognition (SpeechRecognition)

**GitHub:** `Uberi/SpeechRecognition`  
Python wrapper for multiple ASR backends: Google, Azure, IBM, Sphinx, Whisper.

### Backends Supported

| Backend | Offline | Cost |
|---------|---------|------|
| Google Cloud STT | No | Pay-per-use |
| Google Web Speech API | No | Free (unofficial) |
| Azure Cognitive Services | No | Pay-per-use |
| IBM Watson | No | Pay-per-use |
| CMU Sphinx | Yes | Free |
| Whisper (local) | Yes | Free |

### Usage

```python
import speech_recognition as sr

r = sr.Recognizer()

# From microphone
with sr.Microphone() as source:
    r.adjust_for_ambient_noise(source, duration=1)
    print("Speak:")
    audio = r.listen(source)

# Recognize
try:
    # Google (requires internet)
    text = r.recognize_google(audio)
    print(f"Google: {text}")

    # Whisper (offline)
    text = r.recognize_whisper(audio, model="base.en")
    print(f"Whisper: {text}")
except sr.UnknownValueError:
    print("Could not understand audio")
except sr.RequestError as e:
    print(f"Recognition failed: {e}")
```

### Best For
- Quick prototyping with cloud backends
- When you need a one-liner and accuracy doesn't matter yet
- Educational/demo projects

---

## Decision Flowchart

```
What matters most?
│
├─ Speed + accuracy (production)
│   ├─ GPU available → faster-whisper (turbo/large-v3, float16)
│   └─ CPU only → faster-whisper (base/small, int8)
│
├─ Easiest real-time setup
│   └─ RealtimeSTT
│
├─ Fine-tuning on custom vocabulary
│   └─ Wav2Vec2 via transformers
│
├─ Embedded / Raspberry Pi / offline no-GPU
│   └─ Vosk (small model)
│
├─ Cloud API (prototype, don't care about cost)
│   └─ speech_recognition (Google)
│
├─ 1000+ language support
│   └─ MMS (facebook/mms-300m via transformers)
│
└─ NVIDIA production inference stack
    └─ NeMo Conformer-CTC
```

---

## See Also

- [Introduction to ASR](/kb/ai/asr/introduction/)
- [ASR Installation](/kb/ai/asr/installation/)
- [ASR Implementation](/kb/ai/asr/implementation/)
- [Real-Time Streaming ASR](/kb/ai/asr/real-time-streaming/)
- [VAD Libraries Comparison](/kb/ai/vad/libraries-comparison/) — faster-whisper's built-in VAD uses silero; library selection affects which VAD to pair with
- [TTS Libraries Comparison](/kb/ai/tts/libraries-comparison/) — ASR WER on TTS output (round-trip test) is a standard quality metric
