---
title: "TTS Integration Guide"
createTime: 2026/03/21 14:06:00
permalink: /kb/ai/tts/integration/
---

# TTS Integration Guide

Connecting TTS into larger systems: the complete voice assistant pipeline, FastAPI endpoints, WebSocket streaming, and Docker Compose.

---

## Complete Voice Assistant (VAD → ASR → LLM → TTS)

```python
# voice_assistant.py
"""
Full offline voice assistant:
  Microphone → SileroVAD → faster-whisper → llama-swap → Kokoro TTS → Speaker
"""
import threading
import queue
import re
import asyncio
import numpy as np
import sounddevice as sd
import torch
import httpx
from faster_whisper import WhisperModel
from kokoro import KPipeline

# ── Config ────────────────────────────────────────────────────────────────────

SR = 16000
CHUNK_MS = 30
CHUNK_SIZE = int(SR * CHUNK_MS / 1000)
SILENCE_CHUNKS = 20       # 600ms silence → end of utterance
TTS_SR = 24000
LLAMA_SWAP_URL = "http://localhost:8080"
LLM_MODEL = "mistral"
WHISPER_MODEL = "base.en"
KOKORO_VOICE = "af_heart"

# ── VAD ───────────────────────────────────────────────────────────────────────

class SileroVAD:
    def __init__(self):
        model, _ = torch.hub.load("snakers4/silero-vad", "silero_vad", force_reload=False)
        self.model = model.eval()
    
    def is_speech(self, chunk: np.ndarray) -> bool:
        with torch.no_grad():
            return self.model(torch.tensor(chunk), SR).item() > 0.5

# ── ASR ───────────────────────────────────────────────────────────────────────

class ASR:
    def __init__(self):
        self.model = WhisperModel(WHISPER_MODEL, device="cpu", compute_type="int8")
    
    def transcribe(self, audio: np.ndarray) -> str:
        segs, _ = self.model.transcribe(audio, beam_size=5, language="en")
        return " ".join(s.text.strip() for s in segs).strip()

# ── LLM ───────────────────────────────────────────────────────────────────────

async def llm_stream(prompt: str):
    """Async generator: yields complete sentences from LLM streaming output."""
    buffer = ""
    SENTENCE_END = re.compile(r"(?<=[.!?])\s+")
    
    async with httpx.AsyncClient(timeout=60) as client:
        async with client.stream(
            "POST",
            f"{LLAMA_SWAP_URL}/v1/chat/completions",
            json={
                "model": LLM_MODEL,
                "messages": [
                    {"role": "system", "content": "You are a helpful voice assistant. Reply concisely in 1-3 sentences."},
                    {"role": "user", "content": prompt},
                ],
                "stream": True,
                "max_tokens": 256,
            },
        ) as resp:
            import json
            async for line in resp.aiter_lines():
                if not line.startswith("data: ") or line[6:] == "[DONE]":
                    continue
                try:
                    delta = json.loads(line[6:])["choices"][0]["delta"].get("content", "")
                    buffer += delta
                    parts = SENTENCE_END.split(buffer, maxsplit=1)
                    if len(parts) > 1 and len(parts[0]) >= 15:
                        yield parts[0].strip()
                        buffer = parts[1]
                except Exception:
                    pass
    
    if buffer.strip():
        yield buffer.strip()

# ── TTS ───────────────────────────────────────────────────────────────────────

class TTS:
    def __init__(self):
        self.pipeline = KPipeline(lang_code="a")
        self._q: queue.Queue = queue.Queue()
        self._stop = threading.Event()
    
    def _player(self):
        with sd.OutputStream(samplerate=TTS_SR, channels=1, dtype="float32") as stream:
            while not self._stop.is_set():
                try:
                    chunk = self._q.get(timeout=0.1)
                    if chunk is None:
                        break
                    stream.write(chunk.reshape(-1, 1))
                except queue.Empty:
                    continue
    
    def speak_sentences(self, sentence_iter):
        """Synthesize and play a stream of sentences."""
        self._stop.clear()
        player = threading.Thread(target=self._player, daemon=True)
        player.start()
        
        for sentence in sentence_iter:
            if self._stop.is_set():
                break
            for _, _, audio in self.pipeline(sentence, voice=KOKORO_VOICE):
                if self._stop.is_set():
                    break
                self._q.put(audio)
        
        self._q.put(None)
        player.join()
    
    def interrupt(self):
        self._stop.set()

# ── Voice Assistant ───────────────────────────────────────────────────────────

class VoiceAssistant:
    def __init__(self):
        print("Loading VAD...")
        self.vad = SileroVAD()
        print("Loading ASR...")
        self.asr = ASR()
        print("Loading TTS...")
        self.tts = TTS()
        
        self._audio_q: queue.Queue = queue.Queue()
        self._running = False
        self._buf = []
        self._silence = 0
        self._speaking = False
    
    def _on_utterance(self, audio: np.ndarray):
        print("\n[ASR] transcribing...")
        text = self.asr.transcribe(audio)
        if not text:
            return
        print(f"[USER] {text}")
        
        def run():
            async def _inner():
                sentences = []
                async for s in llm_stream(text):
                    sentences.append(s)
                    print(f"[LLM] {s}")
                self.tts.speak_sentences(iter(sentences))
            asyncio.run(_inner())
        
        threading.Thread(target=run, daemon=True).start()
    
    def _process(self):
        while self._running:
            try:
                chunk = self._audio_q.get(timeout=0.1)
            except queue.Empty:
                continue
            
            if self.vad.is_speech(chunk):
                self._silence = 0
                self._speaking = True
                self._buf.append(chunk)
            elif self._speaking:
                self._buf.append(chunk)
                self._silence += 1
                if self._silence >= SILENCE_CHUNKS:
                    audio = np.concatenate(self._buf)
                    threading.Thread(target=self._on_utterance, args=(audio,), daemon=True).start()
                    self._buf.clear()
                    self._speaking = False
                    self._silence = 0
    
    def _mic_cb(self, indata, frames, t, status):
        self._audio_q.put(indata[:, 0].copy())
    
    def run(self):
        import time
        self._running = True
        threading.Thread(target=self._process, daemon=True).start()
        
        with sd.InputStream(samplerate=SR, channels=1, dtype="float32",
                             blocksize=CHUNK_SIZE, callback=self._mic_cb):
            print("\nVoice assistant ready. Speak now (Ctrl+C to quit).")
            try:
                while True:
                    time.sleep(0.1)
            except KeyboardInterrupt:
                self._running = False


if __name__ == "__main__":
    VoiceAssistant().run()
```

---

## FastAPI TTS Endpoint

```python
# tts_api.py
from fastapi import FastAPI, HTTPException
from fastapi.responses import StreamingResponse, Response
from pydantic import BaseModel, Field
from kokoro import KPipeline
import numpy as np
import io
import soundfile as sf
import struct

app = FastAPI(title="TTS API")
_pipeline: KPipeline | None = None

VOICES = ["af_heart", "af_bella", "af_sarah", "am_adam", "am_michael",
          "bf_emma", "bm_george"]

def get_pipeline() -> KPipeline:
    global _pipeline
    if _pipeline is None:
        _pipeline = KPipeline(lang_code="a")
    return _pipeline


class SynthesizeRequest(BaseModel):
    text: str = Field(..., max_length=5000)
    voice: str = Field(default="af_heart")
    speed: float = Field(default=1.0, ge=0.5, le=2.0)
    format: str = Field(default="wav", pattern="^(wav|pcm)$")


@app.post("/synthesize")
async def synthesize(req: SynthesizeRequest) -> Response:
    """
    Synthesize text to audio.
    Returns WAV audio file or raw PCM (float32 LE at 24kHz).
    """
    if req.voice not in VOICES:
        raise HTTPException(status_code=400, detail=f"Unknown voice: {req.voice}. Available: {VOICES}")
    
    pipeline = get_pipeline()
    chunks = [audio for _, _, audio in pipeline(req.text, voice=req.voice, speed=req.speed)]
    
    if not chunks:
        raise HTTPException(status_code=422, detail="No audio generated")
    
    full_audio = np.concatenate(chunks)
    
    if req.format == "pcm":
        # Raw float32 LE, 24000Hz, mono
        return Response(
            content=full_audio.astype(np.float32).tobytes(),
            media_type="audio/pcm",
            headers={"X-Sample-Rate": "24000", "X-Channels": "1"},
        )
    else:
        buf = io.BytesIO()
        sf.write(buf, full_audio, 24000, format="WAV", subtype="PCM_16")
        buf.seek(0)
        return Response(content=buf.read(), media_type="audio/wav")


@app.get("/voices")
async def list_voices():
    return {"voices": VOICES}


@app.get("/health")
async def health():
    return {"status": "ok"}
```

Run:
```bash
uvicorn tts_api:app --host 0.0.0.0 --port 8002
```

Test:
```bash
curl -X POST http://localhost:8002/synthesize \
  -H "Content-Type: application/json" \
  -d '{"text": "Hello world", "voice": "af_heart"}' \
  --output hello.wav
```

---

## WebSocket Streaming TTS

Streams audio chunks over WebSocket as they are synthesized:

```python
# ws_tts.py
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from kokoro import KPipeline
import json
import numpy as np
import struct

app = FastAPI()
pipeline = KPipeline(lang_code="a")

@app.websocket("/ws/tts")
async def ws_tts(ws: WebSocket):
    """
    Client sends: JSON {"text": "...", "voice": "af_heart", "speed": 1.0}
    Server sends: binary float32 PCM chunks at 24kHz
    Server sends: text JSON {"type": "done"} when finished
    """
    await ws.accept()
    
    try:
        while True:
            msg = await ws.receive_text()
            req = json.loads(msg)
            
            text = req.get("text", "")
            voice = req.get("voice", "af_heart")
            speed = float(req.get("speed", 1.0))
            
            if not text.strip():
                continue
            
            # Stream audio chunks
            for _, _, audio in pipeline(text, voice=voice, speed=speed):
                pcm = audio.astype(np.float32).tobytes()
                await ws.send_bytes(pcm)
            
            # Signal completion
            await ws.send_text(json.dumps({"type": "done"}))
    
    except WebSocketDisconnect:
        pass
```

---

## Docker Compose — Full Voice Stack

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
    restart: unless-stopped

  asr-api:
    build:
      context: ./services/asr
      dockerfile: Dockerfile
    ports:
      - "8001:8001"
    environment:
      - WHISPER_MODEL=base.en
      - COMPUTE_TYPE=int8
    restart: unless-stopped

  tts-api:
    build:
      context: ./services/tts
      dockerfile: Dockerfile
    ports:
      - "8002:8002"
    environment:
      - KOKORO_VOICE=af_heart
      - KOKORO_LANG=a
    restart: unless-stopped

  voice-gateway:
    build:
      context: ./services/gateway
    ports:
      - "8000:8000"
    depends_on:
      - llama-swap
      - asr-api
      - tts-api
    environment:
      - ASR_URL=http://asr-api:8001
      - TTS_URL=http://tts-api:8002
      - LLM_URL=http://llama-swap:8080
    restart: unless-stopped
```

```dockerfile
# services/tts/Dockerfile
FROM python:3.11-slim
RUN apt-get update && apt-get install -y ffmpeg libsndfile1 espeak-ng && rm -rf /var/lib/apt/lists/*
WORKDIR /app
RUN pip install --no-cache-dir kokoro soundfile numpy fastapi uvicorn
# Pre-download Kokoro model
RUN python -c "from kokoro import KPipeline; KPipeline(lang_code='a')"
COPY tts_api.py .
CMD ["uvicorn", "tts_api:app", "--host", "0.0.0.0", "--port", "8002"]
```

---

## Subtitle Generation (Voice + SRT)

Generate both audio and synchronized subtitles from TTS:

```python
# tts_subtitles.py
from kokoro import KPipeline
import numpy as np
import soundfile as sf

def synthesize_with_srt(text: str,
                         output_wav: str,
                         output_srt: str,
                         voice: str = "af_heart"):
    pipeline = KPipeline(lang_code="a")
    
    all_audio = []
    srt_entries = []
    current_time = 0.0
    sample_rate = 24000
    
    for graphemes, phonemes, audio in pipeline(text, voice=voice):
        duration = len(audio) / sample_rate
        
        srt_entries.append((current_time, current_time + duration, graphemes.strip()))
        all_audio.append(audio)
        current_time += duration
    
    # Save audio
    full_audio = np.concatenate(all_audio)
    sf.write(output_wav, full_audio, sample_rate)
    
    # Save SRT
    def fmt(t: float) -> str:
        h, m, s, ms = int(t//3600), int(t%3600//60), int(t%60), int(t%1*1000)
        return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"
    
    with open(output_srt, "w", encoding="utf-8") as f:
        for i, (start, end, line) in enumerate(srt_entries, 1):
            f.write(f"{i}\n{fmt(start)} --> {fmt(end)}\n{line}\n\n")
    
    print(f"Audio: {output_wav}")
    print(f"Subtitles: {output_srt}")
    return full_audio


if __name__ == "__main__":
    synthesize_with_srt(
        "Welcome to the demo. This text will be spoken and subtitled.",
        "demo.wav", "demo.srt",
    )
```

---

## See Also

- [TTS Real-Time Streaming](/kb/ai/tts/real-time-streaming/)
- [TTS Implementation](/kb/ai/tts/implementation/)
- [ASR Integration Guide](/kb/ai/asr/integration/)
- [VAD Integration Guide](/kb/ai/vad/integration/)
- [llama-swap Documentation](/kb/ai/llama-swap/getting-started/)
