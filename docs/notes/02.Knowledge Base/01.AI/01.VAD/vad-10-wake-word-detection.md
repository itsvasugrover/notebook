---
title: "Wake Word Detection"
createTime: 2026/03/21 13:15:00
permalink: /kb/ai/vad/wake-word-detection/
---

# Wake Word Detection

Wake word detection (also called **keyword spotting** or **hotword detection**) is an always-on, ultra-low-latency model that listens continuously for a specific trigger phrase and fires only when it is heard — without activating the full ASR pipeline.

---

## Where It Sits in the Pipeline

```
Microphone
    │
    ▼
┌───────────────────────────────────────────┐
│  Wake Word Detector  (always-on, ~5% CPU) │── no match ──► (idle)
└───────────────────────────────────────────┘
    │ match detected
    ▼
┌───────────────────────────────────────────┐
│  VAD  (Silero / WebRTC)                   │── collect speech
└───────────────────────────────────────────┘
    │ speech segment ready
    ▼
┌───────────────────────────────────────────┐
│  ASR  (Whisper / Wav2Vec2)                │── transcribe
└───────────────────────────────────────────┘
    │ text
    ▼
┌───────────────────────────────────────────┐
│  LLM / Intent Handler                     │
└───────────────────────────────────────────┘
    │ response text
    ▼
┌───────────────────────────────────────────┐
│  TTS  (Kokoro / XTTS-v2)                  │
└───────────────────────────────────────────┘
```

**Wake word detection replaces the press-to-talk UX.**

---

## Key Constraints

| Constraint | Target | Why |
|-----------|--------|-----|
| CPU usage | < 5% of one core | Runs 24/7 in background |
| RAM | < 20 MB | Embedded / mobile target |
| Latency | < 100 ms to fire | Feels instant to user |
| False Accept Rate (FAR) | < 1 / hour | Avoids spurious activations |
| False Reject Rate (FRR) | < 5% | User not frustrated |

---

## Algorithms & Theory

### Sliding-Window Classification

The detector runs on a **sliding window** of ~1–2 seconds of audio split into overlapping 30 ms frames:

```
Audio stream:
  |----30ms----|----30ms----|----30ms----|
     frame₀       frame₁       frame₂   ...

Sliding window (1.5 s → ~50 frames):
  [frame₀ … frame₄₉]  →  model  →  P(wake_word)
       shift 10 ms
  [frame₁ … frame₅₀]  →  model  →  P(wake_word)
```

Each frame produces a **13–40 dimensional MFCC** or mel filterbank vector.

### MFCC Feature Extraction (per frame)

$$X_\text{MFCC}[n,k] = \sum_{m=0}^{M-1} \log\!\left(\sum_{j} H_m[j]\,|X[n,j]|^2\right) \cos\!\left(\frac{\pi k}{M}\left(m + \frac{1}{2}\right)\right)$$

where $H_m$ is the $m$-th mel filterbank filter. See [ASR Algorithms & Theory](/kb/ai/asr/algorithms-theory/) for the full Mel scale and STFT derivations.

### Decision Threshold

The model outputs $P(\text{wake}) \in [0, 1]$. A threshold $\tau$ gates the trigger:

$$\text{trigger} = \begin{cases} \text{yes} & P(\text{wake}) \geq \tau \\ \text{no} & \text{otherwise} \end{cases}$$

- **Higher $\tau$** → fewer false accepts, more false rejects (user-frustrating)
- **Lower $\tau$** → more false accepts (spurious activations), fewer rejects
- **Typical $\tau$ = 0.5–0.8** depending on noise environment

### Error Rate Formulas

$$\text{FAR} = \frac{\text{false positive activations per hour}}{\text{hours of non-wake audio}}$$

$$\text{FRR} = \frac{\text{missed wake words}}{\text{total wake word utterances}}$$

The **Equal Error Rate (EER)** is the point where FAR = FRR. Production targets: FAR < 1/h and FRR < 5%.

### Model Architectures

| Architecture | Params | Latency | Target |
|-------------|--------|---------|--------|
| DS-CNN (Depthwise Separable CNN) | ~100 K | 1–3 ms | Embedded MCU |
| CRNN (CNN + GRU) | ~200 K | 2–4 ms | Raspberry Pi |
| MobileNetV2 | ~500 K | 3–5 ms | Mobile |
| Attention RNN | ~400 K | 5 ms | Desktop |
| TC-ResNet (Transformer) | ~300 K | 4 ms | Desktop / cloud |

---

## Libraries Comparison

| Library | License | Built-in Models | CPU | Custom KW | Platform |
|---------|---------|----------------|-----|-----------|----------|
| **openWakeWord** | Apache 2.0 | 10+ | ~2–4% | Yes (fine-tune) | Linux / macOS / Windows |
| **Porcupine** (Picovoice) | Commercial (free tier) | 100+ | ~1% | Yes (paid) | All + MCU |
| **Precise-lite** (Mycroft) | Apache 2.0 | Community | ~3% | Yes (train) | Linux / RPi |
| **SpeechBrain KWS** | Apache 2.0 | None | ~5% | Yes (full train) | Linux / macOS |
| **Snowboy** (Kitt.ai) | Deprecated 2020 | Various | ~1% | Yes | Linux |

**Recommendation:** Use **openWakeWord** for open-source projects. Use **Porcupine** for production embedded devices.

---

## openWakeWord

### Install

```bash
pip install openwakeword sounddevice numpy
```

### Available Models

```python
import openwakeword
openwakeword.utils.download_models()   # ~50 MB, one-time download
# Built-in: hey_jarvis, alexa, hey_mycroft, hey_rhasspy, ok_nabu ...
```

### Detection Loop

```python
# wake_word_detect.py
from openwakeword.model import Model
import sounddevice as sd
import numpy as np
import queue

oww = Model(wakeword_models=["hey_jarvis"], inference_framework="onnx")
audio_q: queue.Queue = queue.Queue()

def audio_callback(indata, frames, time_info, status):
    audio_q.put(indata.copy())

print("Listening for 'hey jarvis'...")
with sd.InputStream(samplerate=16_000, channels=1, dtype="float32",
                    blocksize=1280, callback=audio_callback):
    while True:
        chunk = audio_q.get()
        audio = (chunk[:, 0] * 32_767).astype(np.int16)
        oww.predict(audio)

        for name, scores in oww.prediction_buffer.items():
            if scores[-1] > 0.5:
                print(f"[WAKE]  {name}  score={scores[-1]:.3f}")
                # trigger VAD + ASR pipeline here
```

---

## Porcupine (Picovoice)

Porcupine's free tier covers personal and open-source projects. Runs on Raspberry Pi, Android, iOS, and MCUs.

### Install

```bash
pip install pvporcupine pvrecorder
```

### Detection Loop

```python
# porcupine_detect.py
import pvporcupine
from pvrecorder import PvRecorder

# Free API key from console.picovoice.ai
ACCESS_KEY = "YOUR_ACCESS_KEY"

porcupine = pvporcupine.create(
    access_key=ACCESS_KEY,
    keywords=["jarvis"],
    sensitivities=[0.7],     # 0.0 = strict, 1.0 = sensitive
)

recorder = PvRecorder(device_index=-1, frame_length=porcupine.frame_length)
recorder.start()

try:
    while True:
        pcm = recorder.read()
        if porcupine.process(pcm) >= 0:
            print("Wake word detected — triggering VAD + ASR")
finally:
    recorder.stop()
    recorder.delete()
    porcupine.delete()
```

---

## Training a Custom Wake Word

### Option 1 — openWakeWord Fine-Tuning (Easiest)

Uses frozen Google speech embeddings + a small trainable head. Needs only 5–20 positive recordings; negatives are auto-generated.

```bash
# Record yourself saying "hey nova" ~20 times
# Save as: positive_clips/hey_nova_001.wav ... hey_nova_020.wav

python -m openwakeword.train \
  --positive_clips positive_clips/ \
  --model_name hey_nova \
  --output_dir models/
```

### Option 2 — Train from Scratch (SpeechBrain)

```bash
pip install speechbrain
python train_kwspotter.py hparams/kwspotter.yaml \
  --data_folder /path/to/speech_commands/
```

### Recording Guidelines

```
- Record in the deployment environment (same mic, same background noise)
- Vary speed, volume, and intonation naturally
- Minimum 50 positive samples; 200+ for production quality
- Format: 16 kHz, mono, 16-bit PCM WAV
- Include both close-mic (30 cm) and far-field (2 m) recordings
```

---

## Full Pipeline: Wake Word → VAD → ASR

```python
# full_voice_pipeline.py
from openwakeword.model import Model as WakeWordModel
from silero_vad import load_silero_vad, VADIterator
from faster_whisper import WhisperModel
import sounddevice as sd
import numpy as np
import queue
import time

# ── Load models ──────────────────────────────────────────────────────────
wake_model = WakeWordModel(wakeword_models=["hey_jarvis"], inference_framework="onnx")
vad_model  = load_silero_vad()
vad_iter   = VADIterator(vad_model, sampling_rate=16_000, threshold=0.5)
asr_model  = WhisperModel("base.en", device="cpu", compute_type="int8")

CHUNK           = 1280   # 80 ms at 16 kHz
SR              = 16_000
SILENCE_TIMEOUT = 1.5    # seconds of silence before sending to ASR

STATE_IDLE      = "idle"
STATE_LISTENING = "listening"

state          = STATE_IDLE
speech_buffer: list[np.ndarray] = []
audio_q: queue.Queue = queue.Queue()

def audio_callback(indata, frames, time_info, status):
    audio_q.put(indata.copy())

def process_loop():
    global state, speech_buffer
    last_speech_time = 0.0

    while True:
        chunk = audio_q.get()
        audio = (chunk[:, 0] * 32_767).astype(np.int16)

        if state == STATE_IDLE:
            wake_model.predict(audio)
            for name, scores in wake_model.prediction_buffer.items():
                if scores[-1] > 0.5:
                    print(f"\n[WAKE]  {name}  score={scores[-1]:.3f}")
                    state = STATE_LISTENING
                    speech_buffer.clear()
                    last_speech_time = time.time()

        elif state == STATE_LISTENING:
            audio_f32 = audio.astype(np.float32) / 32_767.0
            vad_out   = vad_iter(audio_f32, return_seconds=True)
            speech_buffer.append(audio_f32)

            if vad_out and "end" in vad_out:
                last_speech_time = time.time()

            if time.time() - last_speech_time > SILENCE_TIMEOUT and speech_buffer:
                full_audio = np.concatenate(speech_buffer)
                speech_buffer.clear()
                vad_iter.reset_states()

                segments   = asr_model.transcribe(full_audio, language="en")[0]
                transcript = " ".join(s.text for s in segments).strip()
                if transcript:
                    print(f"[ASR]   {transcript}")
                    # send to LLM / intent handler

                state = STATE_IDLE

print("Voice assistant ready — say 'hey jarvis'...")
with sd.InputStream(samplerate=SR, channels=1, dtype="float32",
                    blocksize=CHUNK, callback=audio_callback):
    process_loop()
```

---

## See Also

- [VAD Introduction](/kb/ai/vad/introduction/) — VAD is the next stage after wake word fires
- [VAD Algorithms & Theory](/kb/ai/vad/algorithms-theory/) — MFCC and energy features shared with keyword spotting
- [VAD Real-Time Streaming](/kb/ai/vad/real-time-streaming/) — Ring buffer patterns used in wake word detection
- [ASR Real-Time Streaming](/kb/ai/asr/real-time-streaming/) — Chunking audio buffers for STT after detection
- [ASR Integration Guide](/kb/ai/asr/integration/) — Full wake word → VAD → ASR → TTS pipeline
