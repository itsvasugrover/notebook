---
title: "Real-Time Streaming TTS"
createTime: 2026/03/21 14:05:00
permalink: /kb/ai/tts/real-time-streaming/
---

# Real-Time Streaming TTS

Streaming TTS generates and plays audio as sentences are produced, eliminating the wait for a full response to be synthesized. This is what makes a voice assistant feel responsive.

---

## Why Streaming Matters

Without streaming:
```
LLM finishes full response (2–5s)
  → TTS synthesizes full audio (1–3s)
  → Playback starts
Total perceived latency: 3–8s
```

With streaming:
```
LLM produces sentence 1 (0.3s)
  → TTS starts sentence 1 (0.1s)
  → Sentence 1 starts playing
  → LLM produces sentence 2 while sentence 1 plays
Total perceived latency: 0.4s to first audio
```

The key insight: **split on sentence boundaries**, generate each sentence independently, and play while the next is generating.

---

## Sentence Segmentation

The text stream from the LLM arrives token by token. We buffer tokens and flush when we detect a complete sentence.

```python
# sentence_splitter.py
import re
from typing import Iterator

SENTENCE_END = re.compile(r"(?<=[.!?])\s+|(?<=[.!?])$")
MIN_CHARS = 20  # avoid synthesizing very short fragments

def sentence_stream(token_iter: Iterator[str]) -> Iterator[str]:
    """
    Buffer tokens from an LLM stream and yield complete sentences.
    
    token_iter: iterator of string tokens (e.g. from LLM streaming)
    yields: complete sentences suitable for TTS input
    """
    buffer = ""
    
    for token in token_iter:
        buffer += token
        
        # Check for sentence boundary
        parts = SENTENCE_END.split(buffer, maxsplit=1)
        
        if len(parts) > 1:
            sentence = parts[0].strip()
            remainder = parts[1] if len(parts) > 1 else ""
            
            if len(sentence) >= MIN_CHARS:
                yield sentence
                buffer = remainder
            # else keep buffering — too short
    
    # Flush remaining text
    if buffer.strip() and len(buffer.strip()) >= 5:
        yield buffer.strip()


# Test
def fake_llm_stream():
    tokens = "Hello! This is a test of streaming TTS. It works by splitting sentences. Each sentence is synthesized independently.".split()
    for t in tokens:
        yield t + " "

for sentence in sentence_stream(fake_llm_stream()):
    print(repr(sentence))
```

---

## Kokoro Streaming with Real-Time Playback

```python
# kokoro_streaming.py
import threading
import queue
import numpy as np
import sounddevice as sd
from kokoro import KPipeline
from typing import Iterator

SAMPLE_RATE = 24000
VOICE = "af_heart"

class StreamingTTS:
    def __init__(self, voice: str = VOICE, lang_code: str = "a"):
        self.pipeline = KPipeline(lang_code=lang_code)
        self.voice = voice
        self._audio_q: queue.Queue[np.ndarray | None] = queue.Queue()
        self._playing = False
    
    def _play_worker(self):
        """Worker thread: dequeues and plays audio chunks."""
        with sd.OutputStream(samplerate=SAMPLE_RATE, channels=1, dtype="float32") as stream:
            while True:
                chunk = self._audio_q.get()
                if chunk is None:
                    break
                stream.write(chunk.reshape(-1, 1))
    
    def speak(self, text: str, block: bool = True):
        """Synthesize and play text. Streams sentence by sentence."""
        # Start playback thread
        player = threading.Thread(target=self._play_worker, daemon=True)
        player.start()
        
        # Generate audio chunks and enqueue
        for _, _, audio in self.pipeline(text, voice=self.voice):
            self._audio_q.put(audio)
        
        # Signal end
        self._audio_q.put(None)
        
        if block:
            player.join()
    
    def speak_sentences(self, sentence_iter: Iterator[str]):
        """
        Accept a stream of sentences (e.g. from LLM output).
        Synthesizes each sentence and plays immediately.
        """
        player = threading.Thread(target=self._play_worker, daemon=True)
        player.start()
        
        for sentence in sentence_iter:
            if not sentence.strip():
                continue
            for _, _, audio in self.pipeline(sentence, voice=self.voice):
                self._audio_q.put(audio)
        
        self._audio_q.put(None)
        player.join()


if __name__ == "__main__":
    tts = StreamingTTS(voice="af_bell")
    tts.speak("Hello! This sentence streams to your speakers as it is generated. Very cool!")
```

---

## Async Producer-Consumer Pipeline

For integration with async LLM streaming (OpenAI API / llama-swap):

```python
# async_tts_stream.py
import asyncio
import numpy as np
import sounddevice as sd
from kokoro import KPipeline

SAMPLE_RATE = 24000

async def llm_sentence_stream(prompt: str,
                               llm_url: str = "http://localhost:8080"\):
    """
    Stream text from an OpenAI-compatible LLM and yield complete sentences.
    """
    import httpx
    import json
    import re
    
    buffer = ""
    SENTENCE_END = re.compile(r"(?<=[.!?])\s+")
    
    async with httpx.AsyncClient(timeout=60) as client:
        async with client.stream(
            "POST",
            f"{llm_url}/v1/chat/completions",
            json={
                "model": "mistral",
                "messages": [{"role": "user", "content": prompt}],
                "stream": True,
                "max_tokens": 512,
            },
        ) as resp:
            async for line in resp.aiter_lines():
                if not line.startswith("data: "):
                    continue
                data = line[6:]
                if data == "[DONE]":
                    break
                try:
                    chunk = json.loads(data)
                    delta = chunk["choices"][0]["delta"].get("content", "")
                    buffer += delta
                    
                    parts = SENTENCE_END.split(buffer, maxsplit=1)
                    if len(parts) > 1 and len(parts[0]) >= 20:
                        yield parts[0].strip()
                        buffer = parts[1]
                except (json.JSONDecodeError, KeyError):
                    pass
    
    if buffer.strip():
        yield buffer.strip()


async def tts_producer(sentence_queue: asyncio.Queue,
                       audio_queue: asyncio.Queue,
                       pipeline: KPipeline,
                       voice: str = "af_heart"):
    """Generate audio for each sentence."""
    while True:
        sentence = await sentence_queue.get()
        if sentence is None:
            await audio_queue.put(None)
            return
        
        chunks = []
        for _, _, audio in pipeline(sentence, voice=voice):
            chunks.append(audio)
        
        if chunks:
            await audio_queue.put(np.concatenate(chunks))
        sentence_queue.task_done()


async def audio_player(audio_queue: asyncio.Queue):
    """Play audio chunks as they arrive."""
    loop = asyncio.get_event_loop()
    
    with sd.OutputStream(samplerate=SAMPLE_RATE, channels=1, dtype="float32") as stream:
        while True:
            audio = await audio_queue.get()
            if audio is None:
                break
            await loop.run_in_executor(None, stream.write, audio.reshape(-1, 1))


async def voice_response(prompt: str, llm_url: str = "http://localhost:8080"):
    """Full pipeline: LLM stream → sentence split → TTS → playback."""
    pipeline = KPipeline(lang_code="a")
    
    sentence_q: asyncio.Queue = asyncio.Queue(maxsize=3)
    audio_q: asyncio.Queue = asyncio.Queue(maxsize=3)
    
    # Start TTS worker and player concurrently
    producer = asyncio.create_task(tts_producer(sentence_q, audio_q, pipeline))
    player = asyncio.create_task(audio_player(audio_q))
    
    # Feed sentences from LLM stream
    async for sentence in llm_sentence_stream(prompt, llm_url):
        print(f"[TTS] {sentence}")
        await sentence_q.put(sentence)
    
    await sentence_q.put(None)  # signal end
    await asyncio.gather(producer, player)


if __name__ == "__main__":
    asyncio.run(voice_response("Tell me three interesting facts about the Moon."))
```

---

## edge-tts Async Streaming

```python
# edge_streaming.py
import asyncio
import edge_tts
import sounddevice as sd
import tempfile
import os
import soundfile as sf
import numpy as np
import re

SAMPLE_RATE = 24000  # edge-tts output rate varies; we resample

async def stream_edge_tts(text: str, voice: str = "en-US-AriaNeural"):
    """Stream edge-tts audio chunks directly to speakers."""
    communicate = edge_tts.Communicate(text, voice)
    
    audio_data = b""
    async for chunk in communicate.stream():
        if chunk["type"] == "audio":
            audio_data += chunk["data"]
    
    # Decode and play MP3 data
    with tempfile.NamedTemporaryFile(suffix=".mp3", delete=False) as tmp:
        tmp.write(audio_data)
        tmp_path = tmp.name
    
    try:
        audio, sr = sf.read(tmp_path, dtype="float32")
        if audio.ndim > 1:
            audio = audio.mean(axis=1)
        
        import librosa
        if sr != SAMPLE_RATE:
            audio = librosa.resample(audio, orig_sr=sr, target_sr=SAMPLE_RATE)
        
        sd.play(audio, SAMPLE_RATE)
        sd.wait()
    finally:
        os.unlink(tmp_path)


async def stream_sentences_edge(sentences: list[str], voice: str = "en-US-AriaNeural"):
    """Stream multiple sentences with minimal latency between each."""
    for sentence in sentences:
        await stream_edge_tts(sentence, voice)


if __name__ == "__main__":
    asyncio.run(stream_edge_tts("Hello! This is edge-tts streaming to your speakers.", "en-US-AriaNeural"))
```

---

## Interruptible Speech

Stop synthesis mid-playback when the user starts speaking (detected by VAD):

```python
# interruptible_tts.py
import threading
import queue
import numpy as np
import sounddevice as sd
import torch

class InterruptibleTTS:
    """
    TTS that can be interrupted mid-sentence by a VAD signal.
    """
    def __init__(self, pipeline, voice: str = "af_heart", sr: int = 24000):
        self.pipeline = pipeline
        self.voice = voice
        self.sr = sr
        self._audio_q: queue.Queue = queue.Queue()
        self._stop_event = threading.Event()
    
    def interrupt(self):
        """Call this when VAD detects the user started speaking."""
        self._stop_event.set()
        # Drain the queue
        while not self._audio_q.empty():
            try:
                self._audio_q.get_nowait()
            except queue.Empty:
                break
    
    def _play_worker(self):
        with sd.OutputStream(samplerate=self.sr, channels=1, dtype="float32") as stream:
            while not self._stop_event.is_set():
                try:
                    chunk = self._audio_q.get(timeout=0.1)
                    if chunk is None:
                        break
                    stream.write(chunk.reshape(-1, 1))
                except queue.Empty:
                    continue
    
    def speak(self, text: str):
        self._stop_event.clear()
        
        player = threading.Thread(target=self._play_worker, daemon=True)
        player.start()
        
        for _, _, audio in self.pipeline(text, voice=self.voice):
            if self._stop_event.is_set():
                break
            self._audio_q.put(audio)
        
        self._audio_q.put(None)
        player.join()
        
        return not self._stop_event.is_set()  # True if completed, False if interrupted
```

---

## Latency Budget

| Component | Typical Duration | Optimization |
|-----------|-----------------|-------------|
| LLM first token | 200–500ms | Use smaller/quantized model |
| Sentence boundary detection | ~50ms | Keep buffer small (20 chars min) |
| Kokoro synthesis (1 sentence) | 30–100ms | Already optimal on CPU |
| Audio queue enqueue | ~1ms | — |
| First audio playback starts | **300–700ms total** | Good target |
| edge-tts network round trip | +100–300ms | Add to above |
| XTTS-v2 synthesis (1 sentence) | 300–800ms | Use GPU or smaller model |
| Bark synthesis (1 sentence) | 3–10s | Avoid for real-time |

**Key rule**: The first sentence must start playing before the LLM finishes the second sentence. With Kokoro on CPU, this is easily achievable. With XTTS-v2 on CPU, it is marginal — GPU recommended.

---

## See Also

- [TTS Implementation](/kb/ai/tts/implementation/)
- [TTS Integration Guide](/kb/ai/tts/integration/)
- [ASR Real-Time Streaming](/kb/ai/asr/real-time-streaming/)
- [VAD Real-Time Streaming](/kb/ai/vad/real-time-streaming/)
