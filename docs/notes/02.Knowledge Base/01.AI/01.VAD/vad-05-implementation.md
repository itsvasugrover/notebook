---
title: "VAD Implementation"
createTime: 2026/03/21 12:04:00
permalink: /kb/ai/vad/implementation/
---

# VAD Implementation

Complete, production-ready Python implementations using every major VAD library. Each section is self-contained and runnable.

---

## Common Utilities

These helpers are used across all examples below:

```python
# vad_utils.py
import wave
import numpy as np
import soundfile as sf

def read_wav_mono_16k(filepath: str) -> tuple[np.ndarray, int]:
    """Read a WAV file, convert to mono float32 at original sample rate."""
    audio, sr = sf.read(filepath, dtype="float32", always_2d=False)
    if audio.ndim > 1:
        audio = audio.mean(axis=1)  # stereo → mono
    return audio, sr

def audio_to_16bit_pcm(audio: np.ndarray) -> bytes:
    """Convert float32 numpy array to 16-bit PCM bytes."""
    pcm = (audio * 32767).astype(np.int16)
    return pcm.tobytes()

def frames_from_bytes(pcm_bytes: bytes, frame_size_bytes: int):
    """Yield fixed-size byte frames from a PCM byte string."""
    for i in range(0, len(pcm_bytes) - frame_size_bytes + 1, frame_size_bytes):
        yield pcm_bytes[i:i + frame_size_bytes]

def segments_to_audio(audio: np.ndarray, segments: list[dict], sr: int) -> list[np.ndarray]:
    """Extract audio clips from timestamps (in seconds)."""
    clips = []
    for seg in segments:
        start = int(seg["start"] * sr)
        end = int(seg["end"] * sr)
        clips.append(audio[start:end])
    return clips
```

---

## Implementation 1: webrtcvad

### Basic Per-Frame VAD

```python
# webrtcvad_basic.py
import webrtcvad
import soundfile as sf
import numpy as np

def vad_webrtc(filepath: str, aggressiveness: int = 2,
               frame_duration_ms: int = 20) -> list[dict]:
    """
    Run WebRTC VAD on a WAV file.
    Returns list of speech segment timestamps (seconds).
    
    Args:
        filepath: Path to .wav file (8, 16, or 32 kHz, mono)
        aggressiveness: 0 (least) to 3 (most aggressive)
        frame_duration_ms: 10, 20, or 30ms
    """
    audio, sr = sf.read(filepath, dtype="int16", always_2d=False)
    assert sr in (8000, 16000, 32000), f"Unsupported sample rate: {sr}"
    assert frame_duration_ms in (10, 20, 30), "Frame must be 10, 20, or 30ms"

    vad = webrtcvad.Vad(aggressiveness)
    frame_size = int(sr * frame_duration_ms / 1000)        # samples per frame
    frame_bytes = frame_size * 2                           # 16-bit = 2 bytes/sample

    if audio.ndim > 1:
        audio = audio[:, 0]  # take first channel

    pcm = audio.tobytes()
    
    segments = []
    in_speech = False
    speech_start = 0.0
    
    for i, offset in enumerate(range(0, len(pcm) - frame_bytes + 1, frame_bytes)):
        frame = pcm[offset:offset + frame_bytes]
        if len(frame) < frame_bytes:
            break
        is_speech = vad.is_speech(frame, sr)
        timestamp = i * frame_duration_ms / 1000.0
        
        if is_speech and not in_speech:
            speech_start = timestamp
            in_speech = True
        elif not is_speech and in_speech:
            segments.append({"start": speech_start, "end": timestamp})
            in_speech = False
    
    if in_speech:
        segments.append({"start": speech_start, "end": len(pcm) / (sr * 2)})
    
    return segments


if __name__ == "__main__":
    segments = vad_webrtc("speech.wav", aggressiveness=2)
    for seg in segments:
        print(f"Speech: {seg['start']:.2f}s → {seg['end']:.2f}s "
              f"(duration: {seg['end']-seg['start']:.2f}s)")
```

### webrtcvad with Smoothing

```python
import collections
import webrtcvad
import soundfile as sf
import numpy as np

def vad_webrtc_smoothed(filepath: str, aggressiveness: int = 2,
                        frame_ms: int = 30, padding_ms: int = 300) -> list[dict]:
    """
    WebRTC VAD with a ring buffer for smoothing.
    Uses a sliding window of frames to decide speech vs silence.
    padding_ms: how much silence to include before/after speech.
    """
    audio, sr = sf.read(filepath, dtype="int16", always_2d=False)
    if audio.ndim > 1:
        audio = audio[:, 0]

    vad = webrtcvad.Vad(aggressiveness)
    frame_size = int(sr * frame_ms / 1000)
    frame_bytes = frame_size * 2
    padding_frames = int(padding_ms / frame_ms)
    pcm = audio.tobytes()

    ring_buffer = collections.deque(maxlen=padding_frames)
    triggered = False
    segments = []
    voiced_frames = []
    t = 0.0

    for offset in range(0, len(pcm) - frame_bytes + 1, frame_bytes):
        frame = pcm[offset:offset + frame_bytes]
        is_speech = vad.is_speech(frame, sr)
        
        if not triggered:
            ring_buffer.append((t, is_speech))
            num_voiced = sum(1 for _, s in ring_buffer if s)
            if num_voiced > 0.9 * ring_buffer.maxlen:
                triggered = True
                start_time = ring_buffer[0][0]
                voiced_frames = list(ring_buffer)
                ring_buffer.clear()
        else:
            voiced_frames.append((t, is_speech))
            ring_buffer.append((t, is_speech))
            num_unvoiced = sum(1 for _, s in ring_buffer if not s)
            if num_unvoiced > 0.9 * ring_buffer.maxlen:
                end_time = t
                segments.append({"start": start_time, "end": end_time})
                ring_buffer.clear()
                voiced_frames = []
                triggered = False
        
        t += frame_ms / 1000.0

    if triggered and voiced_frames:
        segments.append({"start": voiced_frames[0][0], "end": t})

    return segments
```

---

## Implementation 2: silero-vad

### File-Based Timestamp Extraction

```python
# silero_timestamps.py
from silero_vad import load_silero_vad, read_audio, get_speech_timestamps,                        save_audio, collect_chunks
import torch

def silero_get_segments(filepath: str,
                        threshold: float = 0.5,
                        min_speech_ms: int = 250,
                        min_silence_ms: int = 100,
                        speech_pad_ms: int = 30,
                        sampling_rate: int = 16000) -> list[dict]:
    """
    Extract speech timestamps from an audio file using Silero VAD.
    Returns list of {"start": seconds, "end": seconds} dicts.
    """
    model = load_silero_vad()
    wav = read_audio(filepath, sampling_rate=sampling_rate)
    
    timestamps = get_speech_timestamps(
        wav,
        model,
        threshold=threshold,
        sampling_rate=sampling_rate,
        min_speech_duration_ms=min_speech_ms,
        max_speech_duration_s=float("inf"),
        min_silence_duration_ms=min_silence_ms,
        speech_pad_ms=speech_pad_ms,
        return_seconds=True,  # return in seconds instead of samples
    )
    return timestamps


def silero_extract_speech(filepath: str, output_path: str,
                           sampling_rate: int = 16000):
    """
    Strip silence — save only speech audio to a new file.
    """
    model = load_silero_vad()
    wav = read_audio(filepath, sampling_rate=sampling_rate)
    timestamps = get_speech_timestamps(wav, model, sampling_rate=sampling_rate)
    
    # Concatenate all speech chunks
    speech_only = collect_chunks(timestamps, wav)
    save_audio(output_path, speech_only, sampling_rate=sampling_rate)
    print(f"Saved speech-only audio to {output_path}")


if __name__ == "__main__":
    segments = silero_get_segments("recording.wav")
    total_speech = sum(s["end"] - s["start"] for s in segments)
    print(f"Found {len(segments)} speech segments, {total_speech:.2f}s total")
    for seg in segments:
        print(f"  {seg['start']:.2f}s → {seg['end']:.2f}s")
```

### Chunk-by-Chunk (Streaming) Inference

```python
# silero_streaming.py
import torch
import numpy as np
from silero_vad import load_silero_vad

SAMPLE_RATE = 16000
CHUNK_SIZE = 512  # 32ms at 16kHz

model = load_silero_vad()
model.reset_states()  # Reset LSTM state for new stream

def process_chunk(chunk: np.ndarray) -> float:
    """
    Process a single audio chunk (must be CHUNK_SIZE samples).
    Returns speech probability [0.0, 1.0].
    """
    tensor = torch.from_numpy(chunk.astype(np.float32))
    if len(tensor) < CHUNK_SIZE:
        tensor = torch.nn.functional.pad(tensor, (0, CHUNK_SIZE - len(tensor)))
    with torch.no_grad():
        prob = model(tensor, SAMPLE_RATE).item()
    return prob


# Example: process a WAV file chunk by chunk
import soundfile as sf

def stream_file(filepath: str, threshold: float = 0.5):
    audio, sr = sf.read(filepath, dtype="float32", always_2d=False)
    assert sr == SAMPLE_RATE, f"Expected 16kHz, got {sr}Hz"
    
    model.reset_states()
    for i in range(0, len(audio), CHUNK_SIZE):
        chunk = audio[i:i + CHUNK_SIZE]
        prob = process_chunk(chunk)
        label = "SPEECH" if prob > threshold else "silence"
        t = i / sr
        print(f"t={t:.3f}s  prob={prob:.3f}  [{label}]")
```

---

## Implementation 3: Custom Energy VAD

For prototyping or when you cannot install any external library:

```python
# energy_vad.py
import numpy as np
import soundfile as sf
from scipy.signal import butter, sosfilt

def butter_highpass(cutoff: float, fs: float, order: int = 5):
    """High-pass filter to remove low-frequency hum."""
    nyq = 0.5 * fs
    normal_cutoff = cutoff / nyq
    sos = butter(order, normal_cutoff, btype="high", analog=False, output="sos")
    return sos

def energy_vad_file(filepath: str,
                    frame_ms: int = 20,
                    threshold_db: float = -40.0,
                    min_speech_s: float = 0.2,
                    min_silence_s: float = 0.3,
                    hp_cutoff: float = 80.0) -> list[dict]:
    """
    Energy-based VAD with optional high-pass filtering and hysteresis.
    
    Args:
        threshold_db: dBFS threshold for speech. -40 is a good starting point.
        min_speech_s: Minimum speech segment duration (merge short segments)
        min_silence_s: Minimum silence gap (merge close segments)
        hp_cutoff: High-pass filter cutoff in Hz (removes HVAC/fan noise)
    """
    audio, sr = sf.read(filepath, dtype="float32", always_2d=False)
    if audio.ndim > 1:
        audio = audio.mean(axis=1)
    
    # High-pass filter to improve accuracy in noisy environments
    sos = butter_highpass(hp_cutoff, sr)
    audio = sosfilt(sos, audio)
    
    frame_size = int(sr * frame_ms / 1000)
    threshold_linear = 10 ** (threshold_db / 20.0)  # dBFS → linear
    
    # Compute per-frame energy
    energies = []
    for i in range(0, len(audio) - frame_size + 1, frame_size):
        frame = audio[i:i + frame_size]
        rms = np.sqrt(np.mean(frame ** 2))
        energies.append(rms)
    
    # Threshold detection
    is_speech = np.array(energies) > threshold_linear
    
    # Convert frames to segments
    raw_segments = []
    in_speech = False
    start_frame = 0
    for i, speech in enumerate(is_speech):
        if speech and not in_speech:
            start_frame = i
            in_speech = True
        elif not speech and in_speech:
            raw_segments.append({
                "start": start_frame * frame_ms / 1000.0,
                "end": i * frame_ms / 1000.0
            })
            in_speech = False
    if in_speech:
        raw_segments.append({
            "start": start_frame * frame_ms / 1000.0,
            "end": len(energies) * frame_ms / 1000.0
        })
    
    # Merge segments that are too close (< min_silence_s apart)
    merged = []
    for seg in raw_segments:
        if merged and seg["start"] - merged[-1]["end"] < min_silence_s:
            merged[-1]["end"] = seg["end"]
        else:
            merged.append(dict(seg))
    
    # Remove very short segments
    filtered = [s for s in merged if s["end"] - s["start"] >= min_speech_s]
    return filtered


if __name__ == "__main__":
    segments = energy_vad_file("speech.wav", threshold_db=-35.0)
    for seg in segments:
        print(f"Speech: {seg['start']:.2f}s → {seg['end']:.2f}s")
```

---

## Implementation 4: pyannote.audio

```python
# pyannote_vad.py
import os
from pyannote.audio import Pipeline

def pyannote_vad(filepath: str, hf_token: str = None) -> list[dict]:
    """
    Run pyannote.audio VAD on an audio file.
    Returns list of {"start": seconds, "end": seconds}.
    
    Requires HuggingFace token with accepted model license.
    """
    token = hf_token or os.environ.get("HUGGINGFACE_TOKEN")
    assert token, "Set HUGGINGFACE_TOKEN env var or pass hf_token parameter"
    
    pipeline = Pipeline.from_pretrained(
        "pyannote/voice-activity-detection",
        use_auth_token=token
    )
    
    # Optional: move to GPU
    # import torch
    # pipeline.to(torch.device("cuda"))
    
    vad_result = pipeline(filepath)
    
    segments = []
    for speech_turn in vad_result.get_timeline().support():
        segments.append({
            "start": round(speech_turn.start, 3),
            "end": round(speech_turn.end, 3),
        })
    return segments


if __name__ == "__main__":
    segs = pyannote_vad("interview.wav")
    print(f"Detected {len(segs)} speech segments")
    for s in segs:
        dur = s["end"] - s["start"]
        print(f"  {s['start']:.3f}s → {s['end']:.3f}s  ({dur:.3f}s)")
```

---

## Saving Speech Segments

Once you have timestamps, extract and save them:

```python
# save_segments.py
import soundfile as sf
import numpy as np
import os

def save_speech_segments(source_filepath: str,
                          segments: list[dict],
                          output_dir: str = "segments",
                          pre_pad: float = 0.1,
                          post_pad: float = 0.3):
    """
    Save each detected speech segment as a separate WAV file.
    """
    audio, sr = sf.read(source_filepath, dtype="float32", always_2d=False)
    os.makedirs(output_dir, exist_ok=True)
    
    saved_files = []
    for i, seg in enumerate(segments):
        start = max(0, int((seg["start"] - pre_pad) * sr))
        end = min(len(audio), int((seg["end"] + post_pad) * sr))
        clip = audio[start:end]
        
        out_path = os.path.join(output_dir, f"segment_{i:04d}.wav")
        sf.write(out_path, clip, sr)
        saved_files.append(out_path)
        print(f"Saved: {out_path} ({len(clip)/sr:.2f}s)")
    
    return saved_files
```

---

## Comparing Libraries Side-by-Side

```python
# compare_vad.py — run all VAD methods on the same file
import time
import soundfile as sf

filepath = "test_speech.wav"
audio, sr = sf.read(filepath, dtype="float32")
duration = len(audio) / sr

print(f"File: {filepath}, Duration: {duration:.2f}s\n")

# --- webrtcvad ---
t0 = time.monotonic()
from webrtcvad_basic import vad_webrtc
segs_webrtc = vad_webrtc(filepath, aggressiveness=2)
t_webrtc = time.monotonic() - t0

# --- silero ---
t0 = time.monotonic()
from silero_timestamps import silero_get_segments
segs_silero = silero_get_segments(filepath)
t_silero = time.monotonic() - t0

# --- energy ---
t0 = time.monotonic()
from energy_vad import energy_vad_file
segs_energy = energy_vad_file(filepath)
t_energy = time.monotonic() - t0

print(f"{'Method':<15} {'Segments':>8} {'Speech %':>10} {'Time (ms)':>10}")
print("-" * 50)
for name, segs, t in [
    ("webrtcvad", segs_webrtc, t_webrtc),
    ("silero-vad", segs_silero, t_silero),
    ("energy-vad", segs_energy, t_energy),
]:
    total_speech = sum(s["end"] - s["start"] for s in segs)
    pct = 100 * total_speech / duration
    print(f"{name:<15} {len(segs):>8} {pct:>9.1f}% {t*1000:>9.1f}ms")
```

---

## See Also

- [VAD Algorithms & Theory](/kb/ai/vad/algorithms-theory/)
- [Real-Time Streaming VAD](/kb/ai/vad/real-time-streaming/)
- [VAD Integration Guide](/kb/ai/vad/integration/)
- [VAD Troubleshooting](/kb/ai/vad/troubleshooting/)
- [VAD Cheatsheet](/kb/ai/vad/cheatsheet/)
- [ASR Implementation](/kb/ai/asr/implementation/) — Pass the audio segments produced here to ASR for transcription
