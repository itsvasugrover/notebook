---
title: "Real-Time Streaming ASR"
createTime: 2026/03/21 13:05:00
permalink: /kb/ai/asr/real-time-streaming/
---

# Real-Time Streaming ASR

Real-time transcription requires a different architecture than file-based transcription. Instead of feeding a complete recording, audio arrives as a continuous stream of chunks that must be transcribed with minimal latency.

---

## Architecture Overview

```
Microphone → [Ring Buffer] → VAD State Machine → [Speech Buffer]
                                                        ↓
                                              faster-whisper (segment)
                                                        ↓
                                               Transcript Callback
```

The VAD state machine is the key component: it decides when to flush the speech buffer to Whisper and keeps silence from wasting inference cycles.

---

## VAD + faster-whisper Pipeline

```python
# realtime_asr.py
import threading
import queue
import numpy as np
import sounddevice as sd
from faster_whisper import WhisperModel

# ---------- VAD (minimal silero wrapper) ----------
import torch

class SileroVAD:
    def __init__(self, sr: int = 16000, threshold: float = 0.5):
        self.sr = sr
        self.threshold = threshold
        model, utils = torch.hub.load(
            repo_or_dir="snakers4/silero-vad",
            model="silero_vad",
            force_reload=False,
        )
        self.model = model
        self._get_speech_ts = utils[0]
        self.model.eval()
    
    def is_speech(self, chunk: np.ndarray) -> bool:
        """chunk: float32 numpy array at self.sr Hz"""
        tensor = torch.tensor(chunk, dtype=torch.float32)
        with torch.no_grad():
            prob = self.model(tensor, self.sr).item()
        return prob > self.threshold


# ---------- Streamer ----------

class RealtimeASR:
    def __init__(self,
                 model_size: str = "base.en",
                 device: str = "cpu",
                 compute_type: str = "int8",
                 sample_rate: int = 16000,
                 chunk_ms: int = 30,
                 silence_ms: int = 600,
                 speech_pad_ms: int = 200,
                 on_transcript=None):
        """
        Args:
            model_size:    faster-whisper model size
            chunk_ms:      mic chunk size in ms (30ms recommended for VAD)
            silence_ms:    ms of silence to trigger transcription
            speech_pad_ms: ms of audio to prepend/append to each segment
            on_transcript: callback(text: str, is_final: bool)
        """
        self.sr = sample_rate
        self.chunk_size = int(sample_rate * chunk_ms / 1000)
        self.silence_chunks = int(silence_ms / chunk_ms)
        self.pad_chunks = int(speech_pad_ms / chunk_ms)
        self.on_transcript = on_transcript or (lambda text, final: print(f"[{'FINAL' if final else 'partial'}] {text}"))
        
        print(f"Loading Whisper {model_size}...")
        self.asr = WhisperModel(model_size, device=device, compute_type=compute_type)
        self.vad = SileroVAD(sr=sample_rate)
        
        self._audio_q: queue.Queue[np.ndarray] = queue.Queue()
        self._running = False
        self._speech_buffer: list[np.ndarray] = []
        self._silence_count = 0
        self._is_speaking = False
    
    # ---------- Transcription ----------
    
    def _transcribe_buffer(self, is_final: bool = True):
        if not self._speech_buffer:
            return
        audio = np.concatenate(self._speech_buffer)
        if len(audio) < self.sr * 0.3:  # skip < 300ms
            return
        
        segments, _ = self.asr.transcribe(
            audio,
            beam_size=3 if is_final else 1,
            language="en",
            condition_on_previous_text=False,
            vad_filter=False,  # we already did VAD
        )
        text = " ".join(s.text.strip() for s in segments).strip()
        if text:
            self.on_transcript(text, is_final)
    
    # ---------- Processing loop ----------
    
    def _process_loop(self):
        while self._running:
            try:
                chunk = self._audio_q.get(timeout=0.1)
            except queue.Empty:
                continue
            
            speech = self.vad.is_speech(chunk)
            
            if speech:
                self._silence_count = 0
                if not self._is_speaking:
                    self._is_speaking = True
                    # Add padding from before speech started
                self._speech_buffer.append(chunk)
            else:
                if self._is_speaking:
                    self._speech_buffer.append(chunk)  # trailing pad
                    self._silence_count += 1
                    
                    if self._silence_count >= self.silence_chunks:
                        # End of utterance → transcribe
                        self._transcribe_buffer(is_final=True)
                        self._speech_buffer.clear()
                        self._is_speaking = False
                        self._silence_count = 0
    
    # ---------- Microphone callback ----------
    
    def _mic_callback(self, indata, frames, time_info, status):
        chunk = indata[:, 0].copy()
        self._audio_q.put(chunk)
    
    # ---------- Public API ----------
    
    def start(self):
        self._running = True
        self._worker = threading.Thread(target=self._process_loop, daemon=True)
        self._worker.start()
        
        self._stream = sd.InputStream(
            samplerate=self.sr,
            channels=1,
            dtype="float32",
            blocksize=self.chunk_size,
            callback=self._mic_callback,
        )
        self._stream.start()
        print("Listening... (Ctrl+C to stop)")
    
    def stop(self):
        self._running = False
        self._stream.stop()
        self._stream.close()
        self._worker.join(timeout=3)
        # Flush any remaining audio
        self._transcribe_buffer(is_final=True)


if __name__ == "__main__":
    import time
    
    transcripts = []
    
    def on_result(text, is_final):
        if is_final:
            transcripts.append(text)
            print(f">> {text}")
    
    asr = RealtimeASR(
        model_size="base.en",
        on_transcript=on_result,
    )
    
    try:
        asr.start()
        while True:
            time.sleep(0.1)
    except KeyboardInterrupt:
        asr.stop()
        print("\nFull transcript:")
        print(" ".join(transcripts))
```

---

## RealtimeSTT (Higher-Level API)

```python
# realtimestt_example.py
from RealtimeSTT import AudioToTextRecorder

def on_realtime(text: str):
    print(f"\r{text}  ", end="", flush=True)

def on_final(text: str):
    print(f"\n>> {text}")

recorder = AudioToTextRecorder(
    model="base.en",
    language="en",
    spinner=False,
    silero_sensitivity=0.4,        # VAD sensitivity (0–1)
    webrtc_sensitivity=2,           # WebRTC VAD aggressiveness (0–3)
    min_length_of_recording=0.5,    # seconds
    min_gap_between_recordings=0.3, # seconds
    on_realtime_transcription_update=on_realtime,
    on_realtime_transcription_stabilized=on_final,
)

print("Speak now (Ctrl+C to stop)...")
try:
    while True:
        recorder.text(on_final)   # blocks until speech detected
except KeyboardInterrupt:
    recorder.stop()
```

---

## Vosk Partial Results (Word-Level Live Output)

```python
# vosk_streaming.py
import sounddevice as sd
import queue
import json
from vosk import Model, KaldiRecognizer

MODEL_PATH = "vosk-model-small-en-us-0.15"
SAMPLE_RATE = 16000

model = Model(MODEL_PATH)
rec = KaldiRecognizer(model, SAMPLE_RATE)
rec.SetWords(True)

audio_queue: queue.Queue[bytes] = queue.Queue()

def mic_callback(indata, frames, time_info, status):
    audio_queue.put(bytes(indata))

last_partial = ""

with sd.RawInputStream(
    samplerate=SAMPLE_RATE,
    blocksize=8000,
    dtype="int16",
    channels=1,
    callback=mic_callback,
):
    print("Listening with Vosk... (Ctrl+C to stop)")
    try:
        while True:
            data = audio_queue.get()
            if rec.AcceptWaveform(data):
                result = json.loads(rec.Result())
                if result.get("text"):
                    print(f"\n>> {result['text']}")
                    last_partial = ""
            else:
                partial = json.loads(rec.PartialResult()).get("partial", "")
                if partial != last_partial:
                    print(f"\r... {partial}  ", end="", flush=True)
                    last_partial = partial
    except KeyboardInterrupt:
        pass
```

---

## Async Producer-Consumer Pattern

For integration with async frameworks (FastAPI, asyncio):

```python
# async_asr.py
import asyncio
import numpy as np
from faster_whisper import WhisperModel
import sounddevice as sd


class AsyncRealtimeASR:
    def __init__(self, model_size: str = "base.en"):
        self.model = WhisperModel(model_size, device="cpu", compute_type="int8")
        self._queue: asyncio.Queue = None
        self.sample_rate = 16000
        self.chunk_ms = 30
    
    async def transcribe_stream(self, audio_gen):
        """
        Async generator: yields (text, is_final) tuples.
        
        audio_gen: async iterator yielding float32 numpy chunks
        """
        buffer = []
        silence_count = 0
        MAX_SILENCE = 20  # 20 × 30ms = 600ms
        
        async for chunk in audio_gen:
            energy = np.sqrt(np.mean(chunk ** 2))
            is_speech = energy > 0.01
            
            if is_speech:
                silence_count = 0
                buffer.append(chunk)
            elif buffer:
                silence_count += 1
                buffer.append(chunk)
                
                if silence_count >= MAX_SILENCE:
                    audio = np.concatenate(buffer)
                    segments, _ = await asyncio.to_thread(
                        lambda a: self.model.transcribe(a, beam_size=3),
                        audio,
                    )
                    text = " ".join(s.text.strip() for s in segments)
                    if text.strip():
                        yield text, True
                    buffer.clear()
                    silence_count = 0
                else:
                    # Emit interim partial
                    if len(buffer) % 10 == 0:
                        partial_audio = np.concatenate(buffer)
                        segs, _ = await asyncio.to_thread(
                            lambda a: self.model.transcribe(a, beam_size=1),
                            partial_audio,
                        )
                        text = " ".join(s.text.strip() for s in segs)
                        if text.strip():
                            yield text, False


async def mic_source(sr: int = 16000, chunk_ms: int = 30):
    """Async generator that yields mic chunks."""
    q: asyncio.Queue = asyncio.Queue()
    chunk_size = int(sr * chunk_ms / 1000)
    
    def callback(indata, frames, t, status):
        q.put_nowait(indata[:, 0].copy())
    
    import sounddevice as sd
    with sd.InputStream(samplerate=sr, channels=1, dtype="float32",
                         blocksize=chunk_size, callback=callback):
        try:
            while True:
                chunk = await q.get()
                yield chunk
        except asyncio.CancelledError:
            pass


async def main():
    asr = AsyncRealtimeASR("base.en")
    async for text, is_final in asr.transcribe_stream(mic_source()):
        prefix = "FINAL" if is_final else "partial"
        print(f"[{prefix}] {text}")


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        pass
```

---

## Latency Optimization Tips

| Technique | Latency Reduction | Trade-off |
|-----------|------------------|-----------|
| `beam_size=1` (greedy) | ~50% faster | Slightly lower WER |
| `compute_type="int8"` | 2× faster on CPU | Negligible accuracy loss |
| `tiny.en` model | 10× faster than `large-v3` | Lower accuracy |
| Reduce chunk size (30ms→20ms) | More responsive VAD | More tiny fragments |
| `condition_on_previous_text=False` | Avoids hallucination loops | Less context continuity |
| Stop at 30s max buffer | Prevents runaway latency | May cut long utterances |
| `vad_filter=False` (manual VAD done) | Skip redundant VAD pass | Must do your own VAD |

---

## Chunk Size Guidelines

```
chunk_ms  |  Latency  |  VAD Accuracy  |  CPU Usage
----------+-----------+----------------+-----------
  10ms    |  Lowest   |  Poor          |  High
  30ms    |  Low      |  Good          |  Medium     ← recommended
  50ms    |  Medium   |  Better        |  Lower
 100ms    |  High     |  Best          |  Very low
```

For Silero VAD: **30ms is the minimum supported chunk size at 16kHz** (480 samples).

---

## See Also

- [ASR Implementation (File-Based)](/kb/ai/asr/implementation/)
- [ASR Integration Guide](/kb/ai/asr/integration/)
- [Real-Time Streaming VAD](/kb/ai/vad/real-time-streaming/) — The VAD state machine described there feeds utterance audio directly into the ASR pipeline here
- [Real-Time Streaming TTS](/kb/ai/tts/real-time-streaming/) — TTS playback runs concurrently; VAD barge-in detection must interrupt ongoing TTS
- [VAD Real-Time Streaming](/kb/ai/vad/real-time-streaming/)
- [ASR Cheatsheet](/kb/ai/asr/cheatsheet/)
