---
title: "VAD Integration Guide"
createTime: 2026/03/21 12:06:00
permalink: /kb/ai/vad/integration/
---

# VAD Integration Guide

How to connect VAD to real-world tools: Whisper (ASR), llama.cpp / llama-swap (LLM), FastAPI, and Docker-based pipelines.

---

## Full Voice Assistant Pipeline

```
Microphone
    │
    ▼
┌─────────────┐
│ Real-Time   │  sounddevice / PyAudio
│    VAD      │  silero-vad / webrtcvad
└──────┬──────┘
       │ speech audio (numpy array)
       ▼
┌─────────────┐
│   Whisper   │  openai-whisper / faster-whisper
│    (ASR)    │  audio → text transcript
└──────┬──────┘
       │ text
       ▼
┌─────────────┐
│  llama.cpp  │  or llama-swap
│    (LLM)    │  text → response
└──────┬──────┘
       │ response text
       ▼
┌─────────────┐
│    TTS      │  pyttsx3 / Coqui TTS / llama-cpp phonemizer
│  (Optional) │  text → speech
└─────────────┘
```

---

## Integration 1: VAD + Whisper

### openai-whisper

```python
# vad_whisper_pipeline.py
import numpy as np
import soundfile as sf
import torch
import whisper
from silero_vad import load_silero_vad
import sounddevice as sd
import queue
import os

# ── Setup ─────────────────────────────────────────────
SAMPLE_RATE = 16000
CHUNK_SIZE = 512
THRESHOLD = 0.5
SILENCE_LIMIT = 20       # 20 * 32ms = 640ms of silence to end utterance

vad_model = load_silero_vad()
vad_model.reset_states()
whisper_model = whisper.load_model("base.en")  # or "small", "medium", "large"

q = queue.Queue()


def audio_cb(indata, frames, time, status):
    q.put(indata[:, 0].copy())


def transcribe_utterance(audio: np.ndarray) -> str:
    """Run Whisper on a numpy float32 array at 16kHz."""
    result = whisper_model.transcribe(
        audio,
        fp16=torch.cuda.is_available(),
        language="en",
    )
    return result["text"].strip()


def run():
    is_speaking = False
    silence_count = 0
    speech_buffer = []

    print("Listening — speak into the microphone.")
    with sd.InputStream(samplerate=SAMPLE_RATE, channels=1,
                        dtype="float32", blocksize=CHUNK_SIZE,
                        callback=audio_cb):
        while True:
            chunk = q.get()
            tensor = torch.from_numpy(chunk)
            with torch.no_grad():
                prob = vad_model(tensor, SAMPLE_RATE).item()

            if prob > THRESHOLD:
                if not is_speaking:
                    print("[VAD] Speech detected...")
                    is_speaking = True
                silence_count = 0
                speech_buffer.append(chunk)
            else:
                if is_speaking:
                    speech_buffer.append(chunk)
                    silence_count += 1
                    if silence_count >= SILENCE_LIMIT:
                        audio = np.concatenate(speech_buffer)
                        print(f"[ASR] Transcribing {len(audio)/SAMPLE_RATE:.2f}s...")
                        text = transcribe_utterance(audio)
                        print(f"[ASR] ▶ {text}")
                        # Reset
                        speech_buffer = []
                        silence_count = 0
                        is_speaking = False
                        vad_model.reset_states()


if __name__ == "__main__":
    run()
```

### faster-whisper (Recommended for Lower Latency)

```python
from faster_whisper import WhisperModel
import numpy as np

faster_model = WhisperModel(
    "base.en",
    device="cuda" if torch.cuda.is_available() else "cpu",
    compute_type="float16" if torch.cuda.is_available() else "int8",
)

def transcribe_faster(audio: np.ndarray, sr: int = 16000) -> str:
    segments, info = faster_model.transcribe(
        audio,
        language="en",
        beam_size=5,
        vad_filter=False,  # we already do our own VAD
    )
    return " ".join(seg.text for seg in segments).strip()
```

---

## Integration 2: VAD + llama.cpp

Combine VAD + Whisper + llama.cpp server for a full local voice assistant:

```python
# voice_assistant.py
import numpy as np
import torch
import requests
import json
import sounddevice as sd
import queue
from silero_vad import load_silero_vad
from faster_whisper import WhisperModel

SAMPLE_RATE = 16000
CHUNK_SIZE = 512
VAD_THRESHOLD = 0.5
SILENCE_LIMIT = 20
LLAMA_URL = "http://localhost:8080/v1/chat/completions"
LLAMA_MODEL = "llama-3.2-3b-instruct"

# Initialize models
vad = load_silero_vad()
asr = WhisperModel("base.en", device="cpu", compute_type="int8")

conversation_history = [
    {"role": "system", "content": "You are a helpful voice assistant. Keep answers short and conversational."}
]
q = queue.Queue()


def audio_cb(indata, frames, time, status):
    q.put(indata[:, 0].copy())


def transcribe(audio: np.ndarray) -> str:
    segs, _ = asr.transcribe(audio, language="en", beam_size=3)
    return " ".join(s.text for s in segs).strip()


def ask_llm(user_text: str) -> str:
    conversation_history.append({"role": "user", "content": user_text})
    
    response = requests.post(LLAMA_URL, json={
        "model": LLAMA_MODEL,
        "messages": conversation_history,
        "max_tokens": 200,
        "temperature": 0.7,
    }, timeout=30)
    
    reply = response.json()["choices"][0]["message"]["content"].strip()
    conversation_history.append({"role": "assistant", "content": reply})
    return reply


def voice_assistant():
    vad.reset_states()
    speech_buffer = []
    is_speaking = False
    silence_count = 0
    
    print("Voice assistant ready. Speak to interact.")
    with sd.InputStream(samplerate=SAMPLE_RATE, channels=1,
                        dtype="float32", blocksize=CHUNK_SIZE,
                        callback=audio_cb):
        while True:
            chunk = q.get()
            tensor = torch.from_numpy(chunk)
            with torch.no_grad():
                prob = vad(tensor, SAMPLE_RATE).item()
            
            if prob > VAD_THRESHOLD:
                is_speaking = True
                silence_count = 0
                speech_buffer.append(chunk)
            elif is_speaking:
                speech_buffer.append(chunk)
                silence_count += 1
                if silence_count >= SILENCE_LIMIT:
                    audio = np.concatenate(speech_buffer)
                    print("\n[You] ", end="", flush=True)
                    user_text = transcribe(audio)
                    print(user_text)
                    
                    if user_text:
                        print("[AI]  ", end="", flush=True)
                        reply = ask_llm(user_text)
                        print(reply)
                    
                    speech_buffer = []
                    silence_count = 0
                    is_speaking = False
                    vad.reset_states()


if __name__ == "__main__":
    voice_assistant()
```

---

## Integration 3: VAD + llama-swap

llama-swap proxies multiple models behind one endpoint. Point your assistant at it:

```python
# With llama-swap, just change the base URL and model name
LLAMA_URL = "http://localhost:8080/v1/chat/completions"
# llama-swap routes to the right model based on the "model" field

# Small model for quick responses
FAST_MODEL = "llama-3.2-1b-instruct"

# Large model for complex questions  
SMART_MODEL = "llama-3.3-70b-instruct"

def ask_llm_swap(user_text: str, model: str = FAST_MODEL) -> str:
    response = requests.post(LLAMA_URL, json={
        "model": model,
        "messages": [{"role": "user", "content": user_text}],
        "max_tokens": 150,
    })
    return response.json()["choices"][0]["message"]["content"].strip()
```

For a full llama-swap configuration, see [Introduction to llama-swap](/kb/ai/llama-swap/introduction/).

---

## Integration 4: REST API (FastAPI)

Expose a VAD endpoint for other services:

```python
# vad_api.py
from fastapi import FastAPI, UploadFile, File
from fastapi.responses import JSONResponse
import numpy as np
import soundfile as sf
import io
from silero_vad import load_silero_vad, read_audio, get_speech_timestamps

app = FastAPI(title="VAD API")
model = load_silero_vad()


@app.post("/vad")
async def detect_speech(
    file: UploadFile = File(...),
    threshold: float = 0.5,
    min_speech_ms: int = 250,
    min_silence_ms: int = 100,
):
    """
    Upload a WAV file and get speech timestamp segments back.
    
    Returns:
        {"segments": [{"start": 1.2, "end": 3.4}, ...], "total_speech_s": 5.6}
    """
    audio_bytes = await file.read()
    audio, sr = sf.read(io.BytesIO(audio_bytes), dtype="float32", always_2d=False)
    
    if audio.ndim > 1:
        audio = audio.mean(axis=1)
    
    import torch
    wav = torch.from_numpy(audio)
    
    timestamps = get_speech_timestamps(
        wav, model,
        sampling_rate=sr,
        threshold=threshold,
        min_speech_duration_ms=min_speech_ms,
        min_silence_duration_ms=min_silence_ms,
        return_seconds=True,
    )
    
    total_speech = sum(t["end"] - t["start"] for t in timestamps)
    return JSONResponse({
        "segments": timestamps,
        "total_speech_s": round(total_speech, 3),
        "num_segments": len(timestamps),
    })


# Run with: uvicorn vad_api:app --host 0.0.0.0 --port 9000
```

---

## Integration 5: Docker Compose — Full Pipeline

```yaml
# docker-compose.yml
version: "3.9"

services:
  # llama-swap (routes to llama-server)
  llama-swap:
    image: ghcr.io/mostlygeek/llama-swap:latest
    ports:
      - "8080:8080"
    volumes:
      - ./config.yaml:/app/config.yaml
      - ./models:/models
    restart: unless-stopped

  # VAD + ASR + LLM connector
  voice-assistant:
    build:
      context: ./assistant
      dockerfile: Dockerfile
    environment:
      - LLAMA_SWAP_URL=http://llama-swap:8080
      - WHISPER_MODEL=base.en
    depends_on:
      - llama-swap
    devices:
      - /dev/snd:/dev/snd  # audio device passthrough
    restart: unless-stopped

  # VAD REST API (optional)
  vad-api:
    build:
      context: ./vad-api
    ports:
      - "9000:9000"
    restart: unless-stopped
```

---

## WebSocket Streaming Integration

For browser-based voice input:

```python
# websocket_vad.py
from fastapi import WebSocket
import numpy as np
import torch
from silero_vad import load_silero_vad

vad_model = load_silero_vad()

@app.websocket("/ws/vad")
async def websocket_vad(websocket: WebSocket):
    await websocket.accept()
    vad_model.reset_states()
    
    speech_buffer = []
    silence_count = 0
    is_speaking = False
    SILENCE_LIMIT = 15
    SAMPLE_RATE = 16000
    
    try:
        while True:
            # Receive raw float32 binary data (512 samples = 32ms)
            data = await websocket.receive_bytes()
            chunk = np.frombuffer(data, dtype=np.float32)
            tensor = torch.from_numpy(chunk)
            
            with torch.no_grad():
                prob = vad_model(tensor, SAMPLE_RATE).item()
            
            await websocket.send_json({"prob": round(prob, 4), "speech": prob > 0.5})
            
            if prob > 0.5:
                is_speaking = True
                silence_count = 0
                speech_buffer.append(chunk)
            elif is_speaking:
                speech_buffer.append(chunk)
                silence_count += 1
                if silence_count >= SILENCE_LIMIT:
                    audio = np.concatenate(speech_buffer)
                    # Signal utterance complete to client
                    await websocket.send_json({
                        "event": "utterance_complete",
                        "duration_s": len(audio) / SAMPLE_RATE
                    })
                    speech_buffer = []
                    silence_count = 0
                    is_speaking = False
                    vad_model.reset_states()
    except Exception:
        pass
    finally:
        await websocket.close()
```

---

## See Also

- [Introduction to VAD](/kb/ai/vad/introduction/)
- [Real-Time Streaming VAD](/kb/ai/vad/real-time-streaming/)
- [VAD Implementation](/kb/ai/vad/implementation/)
- [Introduction to llama-swap](/kb/ai/llama-swap/introduction/)
- [llama.cpp Server](/kb/ai/llama-cpp/server/)
- [VAD Troubleshooting](/kb/ai/vad/troubleshooting/)
- [ASR Integration Guide](/kb/ai/asr/integration/) — Companion integration guide for the ASR stage
- [TTS Integration Guide](/kb/ai/tts/integration/) — Companion integration guide for the TTS output stage
