---
title: "Real-Time Streaming VAD"
createTime: 2026/03/21 12:05:00
permalink: /kb/ai/vad/real-time-streaming/
---

# Real-Time Streaming VAD

How to implement VAD that processes a live microphone or audio stream in real time — the core of any voice assistant, push-to-talk system, or live transcription pipeline.

---

## The Real-Time VAD Challenge

Real-time VAD differs from file-based VAD in several key ways:

| | File-Based VAD | Real-Time VAD |
|--|----------------|---------------|
| Input | Complete audio file | Continuous byte stream |
| Latency | Doesn't matter | Must be <100ms |
| Model state | Stateless | Stateful (LSTM must persist) |
| Start/end detection | Easy (full context) | Must infer in real time |
| Error recovery | Restart | Must be resilient |

---

## Concepts: Chunks, Frames, Buffers

```
Microphone hardware:
  → produces raw PCM bytes continuously

Chunk (PyAudio callback):
  → typically 512–4096 samples per callback
  → ~32ms at 16kHz with chunk_size=512

VAD frame:
  → the unit the VAD model processes
  → silero: must be exactly 512 samples (16kHz) or 256 (8kHz)
  → webrtcvad: must be exactly 10/20/30ms

Ring buffer:
  → accumulates incoming chunks
  → VAD reads from ring buffer at model's required size
```

---

## Architecture: The State Machine

A real-time VAD pipeline is a state machine with padded hysteresis:

```
State: SILENT
    │
    │  N consecutive speech frames
    ▼
State: TRIGGERED (speech started)
    │   → store pre-speech buffer
    │   → start recording audio
    │
    │  M consecutive silence frames
    ▼
State: SILENCE_WAIT (potential end)
    │
    ├─ speech frame detected → back to TRIGGERED
    │
    └─ P consecutive silence frames → emit utterance
                                      → back to SILENT
```

---

## Implementation 1: Real-Time with sounddevice + silero

```python
# realtime_silero.py
import numpy as np
import sounddevice as sd
import torch
import queue
import threading
from silero_vad import load_silero_vad

SAMPLE_RATE = 16000
CHUNK_SAMPLES = 512          # 32ms — required by silero at 16kHz
SPEECH_THRESHOLD = 0.5       # probability threshold
ONSET_CHUNKS = 3             # consecutive speech chunks to trigger
OFFSET_CHUNKS = 15           # consecutive silence chunks to end (15 * 32ms = 480ms)

q = queue.Queue()

def audio_callback(indata, frames, time, status):
    """Called by sounddevice in a background thread for each audio chunk."""
    if status:
        print(f"[Audio] {status}")
    q.put(indata[:, 0].copy())  # mono


def realtime_vad():
    model = load_silero_vad()
    model.reset_states()

    speech_buffer = []     # accumulates audio when speaking
    pre_buffer = []        # ring buffer before speech (for context)
    pre_buffer_max = 10    # keep 10 chunks = 320ms pre-roll

    speech_counter = 0
    silence_counter = 0
    is_speaking = False

    print("Listening... Press Ctrl+C to stop.")

    with sd.InputStream(
        samplerate=SAMPLE_RATE,
        channels=1,
        dtype="float32",
        blocksize=CHUNK_SAMPLES,
        callback=audio_callback,
    ):
        while True:
            chunk = q.get()
            tensor = torch.from_numpy(chunk)
            
            with torch.no_grad():
                prob = model(tensor, SAMPLE_RATE).item()
            
            speech = prob > SPEECH_THRESHOLD

            if not is_speaking:
                # Keep a pre-speech buffer
                pre_buffer.append(chunk.copy())
                if len(pre_buffer) > pre_buffer_max:
                    pre_buffer.pop(0)
                
                if speech:
                    speech_counter += 1
                    if speech_counter >= ONSET_CHUNKS:
                        is_speaking = True
                        silence_counter = 0
                        # Include pre-roll context
                        speech_buffer = list(pre_buffer)
                        print(f"[VAD] Speech started (prob={prob:.2f})")
                else:
                    speech_counter = 0
            else:
                speech_buffer.append(chunk.copy())
                
                if not speech:
                    silence_counter += 1
                    if silence_counter >= OFFSET_CHUNKS:
                        # --- Utterance complete ---
                        utterance = np.concatenate(speech_buffer)
                        duration = len(utterance) / SAMPLE_RATE
                        print(f"[VAD] Utterance complete: {duration:.2f}s audio")
                        
                        # TODO: send utterance to ASR/Whisper here
                        on_utterance_complete(utterance, SAMPLE_RATE)
                        
                        speech_buffer = []
                        pre_buffer = []
                        speech_counter = 0
                        silence_counter = 0
                        is_speaking = False
                        model.reset_states()
                else:
                    silence_counter = 0


def on_utterance_complete(audio: np.ndarray, sr: int):
    """Handle completed utterance — save or send to ASR."""
    import soundfile as sf
    sf.write("utterance.wav", audio, sr)
    print(f"[App] Saved utterance ({len(audio)/sr:.2f}s)")


if __name__ == "__main__":
    try:
        realtime_vad()
    except KeyboardInterrupt:
        print("\nStopped.")
```

---

## Implementation 2: Real-Time with webrtcvad + PyAudio

```python
# realtime_webrtcvad.py
import pyaudio
import webrtcvad
import numpy as np
import collections

SAMPLE_RATE = 16000
FRAME_DURATION_MS = 30
FRAME_SAMPLES = int(SAMPLE_RATE * FRAME_DURATION_MS / 1000)  # 480 samples
FRAME_BYTES = FRAME_SAMPLES * 2   # 16-bit PCM
PADDING_DURATION_MS = 300         # ring buffer size for onset/offset
PADDING_FRAMES = int(PADDING_DURATION_MS / FRAME_DURATION_MS)  # 10 frames

def record_utterances(aggressiveness: int = 2):
    vad = webrtcvad.Vad(aggressiveness)
    pa = pyaudio.PyAudio()
    
    stream = pa.open(
        format=pyaudio.paInt16,
        channels=1,
        rate=SAMPLE_RATE,
        input=True,
        frames_per_buffer=FRAME_SAMPLES,
    )
    
    print(f"Listening (aggressiveness={aggressiveness})... Ctrl+C to stop")
    
    ring_buffer = collections.deque(maxlen=PADDING_FRAMES)
    triggered = False
    voiced_frames = []
    leftover = b""
    utterance_count = 0

    try:
        while True:
            raw = stream.read(FRAME_SAMPLES, exception_on_overflow=False)
            data = leftover + raw
            leftover = b""
            
            # Process complete frames
            while len(data) >= FRAME_BYTES:
                frame = data[:FRAME_BYTES]
                data = data[FRAME_BYTES:]
                is_speech = vad.is_speech(frame, SAMPLE_RATE)
                
                if not triggered:
                    ring_buffer.append((frame, is_speech))
                    num_voiced = sum(1 for _, s in ring_buffer if s)
                    if num_voiced > 0.8 * ring_buffer.maxlen:
                        triggered = True
                        voiced_frames = [f for f, _ in ring_buffer]
                        ring_buffer.clear()
                        print("[VAD] Speech started")
                else:
                    voiced_frames.append(frame)
                    ring_buffer.append((frame, is_speech))
                    num_unvoiced = sum(1 for _, s in ring_buffer if not s)
                    if num_unvoiced > 0.9 * ring_buffer.maxlen:
                        triggered = False
                        utterance_count += 1
                        pcm_bytes = b"".join(voiced_frames)
                        audio = np.frombuffer(pcm_bytes, dtype=np.int16).astype(np.float32) / 32768.0
                        print(f"[VAD] Utterance #{utterance_count}: {len(audio)/SAMPLE_RATE:.2f}s")
                        handle_utterance(audio, SAMPLE_RATE, utterance_count)
                        ring_buffer.clear()
                        voiced_frames = []
            
            leftover = data

    except KeyboardInterrupt:
        print("\nStopped.")
    finally:
        stream.stop_stream()
        stream.close()
        pa.terminate()


def handle_utterance(audio: np.ndarray, sr: int, idx: int):
    import soundfile as sf
    sf.write(f"utterance_{idx:04d}.wav", audio, sr)


if __name__ == "__main__":
    record_utterances(aggressiveness=2)
```

---

## Implementation 3: Async / Producer-Consumer Pattern

For integrating VAD into an async application (e.g., FastAPI):

```python
# async_vad.py
import asyncio
import numpy as np
import torch
import sounddevice as sd
from silero_vad import load_silero_vad

SAMPLE_RATE = 16000
CHUNK_SIZE = 512
THRESHOLD = 0.5


async def vad_producer(audio_queue: asyncio.Queue):
    """Reads microphone and puts chunks into the queue."""
    loop = asyncio.get_event_loop()

    def callback(indata, frames, time, status):
        loop.call_soon_threadsafe(
            audio_queue.put_nowait,
            indata[:, 0].copy()
        )

    with sd.InputStream(
        samplerate=SAMPLE_RATE,
        channels=1,
        dtype="float32",
        blocksize=CHUNK_SIZE,
        callback=callback,
    ):
        await asyncio.Event().wait()  # run forever


async def vad_consumer(audio_queue: asyncio.Queue,
                       utterance_queue: asyncio.Queue):
    """Reads chunks, runs VAD, emits complete utterances."""
    model = load_silero_vad()
    model.reset_states()
    
    is_speaking = False
    silence_count = 0
    speech_buffer = []
    SILENCE_LIMIT = 15

    while True:
        chunk = await audio_queue.get()
        tensor = torch.from_numpy(chunk)
        
        with torch.no_grad():
            prob = model(tensor, SAMPLE_RATE).item()
        
        if prob > THRESHOLD:
            silence_count = 0
            if not is_speaking:
                is_speaking = True
            speech_buffer.append(chunk)
        else:
            if is_speaking:
                speech_buffer.append(chunk)
                silence_count += 1
                if silence_count >= SILENCE_LIMIT:
                    utterance = np.concatenate(speech_buffer)
                    await utterance_queue.put(utterance)
                    speech_buffer = []
                    is_speaking = False
                    silence_count = 0
                    model.reset_states()


async def main():
    audio_q = asyncio.Queue(maxsize=100)
    utterance_q = asyncio.Queue()
    
    async def utterance_handler():
        while True:
            utterance = await utterance_q.get()
            print(f"Got utterance: {len(utterance)/SAMPLE_RATE:.2f}s")
            # → send to ASR here

    await asyncio.gather(
        vad_producer(audio_q),
        vad_consumer(audio_q, utterance_q),
        utterance_handler(),
    )


if __name__ == "__main__":
    asyncio.run(main())
```

---

## Chunk Size vs Latency

| Chunk Size (16kHz) | Duration | Latency | Notes |
|-------------------|----------|---------|-------|
| 256 samples | 16ms | Very low | silero 8kHz mode |
| 512 samples | 32ms | Low | **silero 16kHz (recommended)** |
| 1024 samples | 64ms | Medium | webrtcvad @ 30ms + buffer |
| 4096 samples | 256ms | High | Good for batch processing |

---

## Handling Resampling

If your microphone outputs a sample rate other than 16kHz:

```python
import sounddevice as sd
import numpy as np
from scipy.signal import resample_poly
import math

MIC_RATE = 44100    # most microphone default
TARGET_RATE = 16000  # silero expects 16kHz

def resample_chunk(chunk: np.ndarray) -> np.ndarray:
    gcd = math.gcd(MIC_RATE, TARGET_RATE)
    up = TARGET_RATE // gcd
    down = MIC_RATE // gcd
    return resample_poly(chunk, up, down).astype(np.float32)
```

---

## See Also

- [VAD Implementation](/kb/ai/vad/implementation/)
- [VAD Integration Guide](/kb/ai/vad/integration/)
- [VAD Algorithms & Theory](/kb/ai/vad/algorithms-theory/)
- [VAD Troubleshooting](/kb/ai/vad/troubleshooting/)
- [Real-Time Streaming ASR](/kb/ai/asr/real-time-streaming/) — The utterance audio produced by this state machine is consumed directly by real-time ASR
- [Real-Time Streaming TTS](/kb/ai/tts/real-time-streaming/) — TTS playback runs in parallel and must be interrupted when VAD detects new speech (barge-in)
