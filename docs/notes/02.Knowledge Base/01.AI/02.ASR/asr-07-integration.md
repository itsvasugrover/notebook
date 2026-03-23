---
title: "ASR Integration Guide"
createTime: 2026/03/21 13:06:00
permalink: /kb/ai/asr/integration/
---

# ASR Integration Guide

Patterns for integrating ASR into larger pipelines: voice assistant, FastAPI service, WebSocket streaming, Docker Compose, and subtitle generation.

---

## Full Voice Assistant (VAD + ASR + LLM)

Connect the microphone → VAD → Whisper → llama.cpp/llama-swap chain to build a local, offline voice assistant.

```python
# voice_assistant.py
"""
Full voice assistant pipeline:
  Mic → SileroVAD → faster-whisper → llama.cpp (via subprocess) → TTS
"""
import threading
import queue
import subprocess
import numpy as np
import sounddevice as sd
import torch
from faster_whisper import WhisperModel

# ── VAD ───────────────────────────────────────────────────────────────────────

class SileroVAD:
    def __init__(self, sr=16000, threshold=0.5):
        self.sr = sr
        self.threshold = threshold
        model, utils = torch.hub.load(
            "snakers4/silero-vad", "silero_vad", force_reload=False
        )
        self.model = model
        self.model.eval()

    def is_speech(self, pcm: np.ndarray) -> bool:
        with torch.no_grad():
            return self.model(torch.tensor(pcm), self.sr).item() > self.threshold


# ── LLM via llama.cpp CLI ─────────────────────────────────────────────────────

def ask_llm(prompt: str, model_path: str) -> str:
    """Call llama-cli (llama.cpp) with a prompt and return the response."""
    result = subprocess.run(
        [
            "llama-cli",
            "-m", model_path,
            "-n", "256",
            "--no-display-prompt",
            "-p", prompt,
        ],
        capture_output=True, text=True, timeout=60,
    )
    return result.stdout.strip()


# ── Voice Assistant ───────────────────────────────────────────────────────────

class VoiceAssistant:
    def __init__(self,
                 whisper_model: str = "base.en",
                 llm_model_path: str = "models/mistral-7b-q4.gguf"):
        self.sr = 16000
        self.chunk_ms = 30
        self.chunk_size = int(self.sr * self.chunk_ms / 1000)
        self.vad = SileroVAD(sr=self.sr)
        
        print("Loading Whisper...")
        self.asr = WhisperModel(whisper_model, device="cpu", compute_type="int8")
        self.llm_path = llm_model_path
        
        self._q: queue.Queue = queue.Queue()
        self._running = False
        self._speech_buf = []
        self._silence_count = 0
        self._speaking = False
        self.SILENCE_CHUNKS = 20  # 600ms silence to trigger

    def _transcribe(self, audio: np.ndarray) -> str:
        segs, _ = self.asr.transcribe(audio, beam_size=5, language="en")
        return " ".join(s.text.strip() for s in segs).strip()

    def _handle_utterance(self, audio: np.ndarray):
        print("\n[ASR] transcribing...")
        text = self._transcribe(audio)
        if not text:
            return
        print(f"[USER] {text}")
        
        prompt = (
            "You are a helpful voice assistant. Reply concisely in 1-2 sentences.\n"
            f"User: {text}\nAssistant:"
        )
        print("[LLM] thinking...")
        response = ask_llm(prompt, self.llm_path)
        print(f"[ASSISTANT] {response}")

    def _process(self):
        while self._running:
            try:
                chunk = self._q.get(timeout=0.1)
            except queue.Empty:
                continue
            
            if self.vad.is_speech(chunk):
                self._silence_count = 0
                self._speaking = True
                self._speech_buf.append(chunk)
            elif self._speaking:
                self._speech_buf.append(chunk)
                self._silence_count += 1
                if self._silence_count >= self.SILENCE_CHUNKS:
                    audio = np.concatenate(self._speech_buf)
                    threading.Thread(
                        target=self._handle_utterance, args=(audio,), daemon=True
                    ).start()
                    self._speech_buf.clear()
                    self._speaking = False
                    self._silence_count = 0

    def _mic_cb(self, indata, frames, t, status):
        self._q.put(indata[:, 0].copy())

    def run(self):
        self._running = True
        threading.Thread(target=self._process, daemon=True).start()
        with sd.InputStream(
            samplerate=self.sr, channels=1, dtype="float32",
            blocksize=self.chunk_size, callback=self._mic_cb,
        ):
            print("Voice assistant ready. Speak now (Ctrl+C to quit).")
            try:
                import time
                while True:
                    time.sleep(0.1)
            except KeyboardInterrupt:
                self._running = False


if __name__ == "__main__":
    assistant = VoiceAssistant(
        whisper_model="base.en",
        llm_model_path="models/mistral-7b-instruct-q4_K_M.gguf",
    )
    assistant.run()
```

---

## llama-swap Integration (Multi-Model Routing)

Use llama-swap's OpenAI-compatible `/v1/chat/completions` endpoint alongside ASR:

```python
# asr_llamaswap.py
import httpx
import asyncio

LLAMA_SWAP_URL = "http://localhost:8080"

async def ask_llamaswap(text: str, model: str = "mistral") -> str:
    """Send transcribed text to llama-swap and get a response."""
    async with httpx.AsyncClient(timeout=60) as client:
        resp = await client.post(
            f"{LLAMA_SWAP_URL}/v1/chat/completions",
            json={
                "model": model,
                "messages": [
                    {"role": "system", "content": "Reply concisely in 1-2 sentences."},
                    {"role": "user", "content": text},
                ],
                "max_tokens": 256,
                "stream": False,
            },
        )
        resp.raise_for_status()
        return resp.json()["choices"][0]["message"]["content"]


async def voice_to_llm(audio_file: str, llm_model: str = "mistral"):
    from faster_whisper import WhisperModel
    
    asr_model = WhisperModel("base.en", device="cpu", compute_type="int8")
    segs, _ = asr_model.transcribe(audio_file, beam_size=5)
    transcript = " ".join(s.text.strip() for s in segs)
    print(f"Transcribed: {transcript}")
    
    response = await ask_llamaswap(transcript, model=llm_model)
    print(f"LLM reply: {response}")
    return response


if __name__ == "__main__":
    asyncio.run(voice_to_llm("question.wav", llm_model="mistral"))
```

---

## FastAPI ASR Endpoint

```python
# api.py
from fastapi import FastAPI, UploadFile, File, HTTPException, Form
from fastapi.responses import JSONResponse
from faster_whisper import WhisperModel
import tempfile
import os
import shutil

app = FastAPI(title="ASR API")

_model: WhisperModel | None = None

def get_model() -> WhisperModel:
    global _model
    if _model is None:
        _model = WhisperModel("base.en", device="cpu", compute_type="int8")
    return _model


@app.post("/transcribe")
async def transcribe_audio(
    file: UploadFile = File(...),
    language: str | None = Form(default=None),
    word_timestamps: bool = Form(default=False),
):
    """
    Upload an audio file (WAV, MP3, FLAC, OGG, M4A) and receive a transcript.
    """
    allowed_types = {
        "audio/wav", "audio/mpeg", "audio/flac",
        "audio/ogg", "audio/x-m4a", "audio/mp4",
    }
    if file.content_type and file.content_type not in allowed_types:
        raise HTTPException(
            status_code=415,
            detail=f"Unsupported media type: {file.content_type}",
        )
    
    # Save to a temp file (faster-whisper needs a path)
    suffix = os.path.splitext(file.filename or "audio.wav")[1] or ".wav"
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        shutil.copyfileobj(file.file, tmp)
        tmp_path = tmp.name
    
    try:
        model = get_model()
        segments, info = model.transcribe(
            tmp_path,
            language=language,
            beam_size=5,
            word_timestamps=word_timestamps,
            vad_filter=True,
        )
        
        seg_list = []
        for seg in segments:
            s = {
                "start": round(seg.start, 3),
                "end": round(seg.end, 3),
                "text": seg.text.strip(),
            }
            if word_timestamps and seg.words:
                s["words"] = [
                    {"word": w.word, "start": round(w.start, 3), "end": round(w.end, 3), "prob": round(w.probability, 3)}
                    for w in seg.words
                ]
            seg_list.append(s)
        
        full_text = " ".join(s["text"] for s in seg_list)
        
        return JSONResponse({
            "text": full_text,
            "language": info.language,
            "language_probability": round(info.language_probability, 3),
            "duration": round(info.duration, 3),
            "segments": seg_list,
        })
    finally:
        os.unlink(tmp_path)
```

Run with:
```bash
uvicorn api:app --host 0.0.0.0 --port 8001 --reload
```

Test:
```bash
curl -X POST http://localhost:8001/transcribe \
  -F "file=@speech.wav" \
  -F "word_timestamps=true"
```

---

## WebSocket Streaming Transcription

```python
# ws_server.py
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
import numpy as np
import json
from faster_whisper import WhisperModel

app = FastAPI()
asr_model = WhisperModel("base.en", device="cpu", compute_type="int8")

@app.websocket("/ws/transcribe")
async def ws_transcribe(ws: WebSocket):
    """
    Accept float32 PCM chunks over WebSocket.
    Send back partial and final transcripts as JSON.
    
    Client sends: binary frames of float32 audio at 16kHz
    Server sends: {"type": "partial"|"final", "text": "..."}
    """
    await ws.accept()
    import asyncio
    
    buffer = []
    silence_frames = 0
    MAX_SILENCE = 20  # 20 × 30ms = 600ms
    SR = 16000
    CHUNK_SAMPLES = int(SR * 0.03)  # 30ms
    
    try:
        while True:
            data = await ws.receive_bytes()
            chunk = np.frombuffer(data, dtype=np.float32)
            energy = float(np.sqrt(np.mean(chunk ** 2)))
            
            is_speech = energy > 0.005
            
            if is_speech:
                silence_frames = 0
                buffer.append(chunk)
            elif buffer:
                silence_frames += 1
                buffer.append(chunk)
                
                if silence_frames >= MAX_SILENCE:
                    audio = np.concatenate(buffer)
                    segs, _ = asr_model.transcribe(audio, beam_size=5)
                    text = " ".join(s.text.strip() for s in segs)
                    if text.strip():
                        await ws.send_text(json.dumps({
                            "type": "final",
                            "text": text,
                        }))
                    buffer.clear()
                    silence_frames = 0
                elif len(buffer) % 10 == 0:
                    # Partial update every 300ms
                    partial_audio = np.concatenate(buffer)
                    segs, _ = asr_model.transcribe(partial_audio, beam_size=1)
                    text = " ".join(s.text.strip() for s in segs)
                    if text.strip():
                        await ws.send_text(json.dumps({
                            "type": "partial",
                            "text": text,
                        }))
    except WebSocketDisconnect:
        pass
```

---

## SRT Subtitle Generation

```python
# generate_subtitles.py
from faster_whisper import WhisperModel
import sys


def seconds_to_srt_time(t: float) -> str:
    h = int(t // 3600)
    m = int((t % 3600) // 60)
    s = int(t % 60)
    ms = int((t % 1) * 1000)
    return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"


def generate_srt(video_path: str, output_srt: str,
                 model_size: str = "small",
                 language: str = None):
    model = WhisperModel(model_size, device="cpu", compute_type="int8")
    segments, info = model.transcribe(
        video_path,
        language=language,
        beam_size=5,
        word_timestamps=False,
    )
    
    print(f"Detected language: {info.language} ({info.language_probability:.1%})")
    
    with open(output_srt, "w", encoding="utf-8") as f:
        for i, seg in enumerate(segments, 1):
            f.write(f"{i}\n")
            f.write(f"{seconds_to_srt_time(seg.start)} --> {seconds_to_srt_time(seg.end)}\n")
            f.write(f"{seg.text.strip()}\n\n")
    
    print(f"Saved: {output_srt}")


def generate_vtt(video_path: str, output_vtt: str,
                 model_size: str = "small"):
    model = WhisperModel(model_size, device="cpu", compute_type="int8")
    segments, _ = model.transcribe(video_path, beam_size=5)
    
    def vtt_time(t: float) -> str:
        h = int(t // 3600)
        m = int((t % 3600) // 60)
        s = t % 60
        return f"{h:02d}:{m:02d}:{s:06.3f}"
    
    with open(output_vtt, "w", encoding="utf-8") as f:
        f.write("WEBVTT\n\n")
        for seg in segments:
            f.write(f"{vtt_time(seg.start)} --> {vtt_time(seg.end)}\n")
            f.write(f"{seg.text.strip()}\n\n")
    
    print(f"Saved: {output_vtt}")


if __name__ == "__main__":
    video = sys.argv[1] if len(sys.argv) > 1 else "video.mp4"
    generate_srt(video, video.rsplit(".", 1)[0] + ".srt")
    generate_vtt(video, video.rsplit(".", 1)[0] + ".vtt")
```

---

## Docker Compose Pipeline

Runs llama-swap + ASR API as a pair of services:

```yaml
# docker-compose.yml
version: "3.9"

services:
  llama-swap:
    image: ghcr.io/mostlygeek/llama-swap:latest
    volumes:
      - ./models:/models
      - ./llama-swap-config.yaml:/config.yaml:ro
    ports:
      - "8080:8080"
    environment:
      - CONFIG_FILE=/config.yaml
    restart: unless-stopped

  asr-api:
    build:
      context: .
      dockerfile: Dockerfile.asr
    ports:
      - "8001:8001"
    volumes:
      - ./models:/models   # shared model storage
    environment:
      - WHISPER_MODEL=base.en
      - DEVICE=cpu
      - COMPUTE_TYPE=int8
    depends_on:
      - llama-swap
    restart: unless-stopped
```

```dockerfile
# Dockerfile.asr
FROM python:3.11-slim

RUN apt-get update && apt-get install -y ffmpeg libsndfile1 && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY api.py .
CMD ["uvicorn", "api:app", "--host", "0.0.0.0", "--port", "8001"]
```

---

## See Also

- [ASR Real-Time Streaming](/kb/ai/asr/real-time-streaming/)
- [ASR Implementation](/kb/ai/asr/implementation/)
- [VAD Integration Guide](/kb/ai/vad/integration/)
- [llama-swap Documentation](/kb/ai/llama-swap/getting-started/)
- [llama.cpp Server Guide](/kb/ai/llama-cpp/server/)
- [TTS Integration Guide](/kb/ai/tts/integration/) — Companion integration guide for synthesizing the LLM response back to speech
