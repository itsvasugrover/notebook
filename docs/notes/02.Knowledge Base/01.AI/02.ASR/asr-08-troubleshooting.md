---
title: "ASR Troubleshooting"
createTime: 2026/03/21 13:07:00
permalink: /kb/ai/asr/troubleshooting/
---

# ASR Troubleshooting

Common problems and their solutions when working with ASR libraries, particularly faster-whisper and openai-whisper.

---

## Hallucinations on Silence

**Symptom**: Whisper outputs random text, music notation, or "[MUSIC]" when the audio contains silence or low-level noise.

**Root cause**: Whisper was trained on 30-second clips and fills empty audio with plausible outputs. It does not inherently know "there is nothing to transcribe here."

**Fixes**:

```python
from faster_whisper import WhisperModel

model = WhisperModel("base.en", device="cpu", compute_type="int8")

# 1. Enable built-in VAD filter
segments, info = model.transcribe(
    "audio.wav",
    vad_filter=True,
    vad_parameters={
        "threshold": 0.5,              # speech prob threshold (0–1)
        "min_speech_duration_ms": 250, # ignore very short bursts
        "min_silence_duration_ms": 600,
        "speech_pad_ms": 200,
    },
)

# 2. Filter by no_speech_prob after the fact
for seg in segments:
    if seg.no_speech_prob > 0.6:
        continue  # skip silent/noise segments
    print(seg.text)

# 3. Filter by log-probability (very low = hallucination)
for seg in segments:
    if seg.avg_logprob < -1.0:
        continue
    print(seg.text)
```

Run VAD before ASR (strongest fix):
```python
# Use silero-vad to extract only speech windows first,
# then feed only those chunks to Whisper.
# See /kb/ai/vad/real-time-streaming/ for implementation.
```

---

## Wrong Language Detected

**Symptom**: Whisper transcribes in the wrong language, or transliterates instead of transcribing.

**Root cause**: Auto-detection uses the first 30 seconds. If that segment is noisy or contains music, the prediction can be wrong.

**Fixes**:

```python
# Force the language explicitly
segments, info = model.transcribe(
    "audio.wav",
    language="en",   # ISO 639-1 code: "fr", "de", "es", "ja", ...
)

# Check what was detected before forcing
_, info = model.transcribe("audio.wav", beam_size=1)
print(f"Detected: {info.language} ({info.language_probability:.1%})")

# If probability is low (< 0.7), force your expected language
if info.language_probability < 0.7:
    _, _ = model.transcribe("audio.wav", language="en")
```

```python
# openai-whisper: detect language from first 30s only
import whisper
model = whisper.load_model("base")
audio = whisper.load_audio("audio.wav")
audio_clip = whisper.pad_or_trim(audio)
mel = whisper.log_mel_spectrogram(audio_clip).to(model.device)
_, probs = model.detect_language(mel)
print(max(probs, key=probs.get))
```

---

## CUDA Out of Memory

**Symptom**: `torch.cuda.OutOfMemoryError` or `CUDA error: out of memory`.

**Fixes**:

```python
# 1. Use a smaller model
model = WhisperModel("small.en", device="cuda", compute_type="float16")
# instead of: WhisperModel("large-v3", ...)

# 2. Use int8 quantization (halves VRAM usage)
model = WhisperModel("base.en", device="cuda", compute_type="int8_float16")
# int8 weights, float16 activations — best balance

# 3. Reduce batch size (openai-whisper)
result = model.transcribe(audio, fp16=True, verbose=False)

# 4. Force CPU fallback if GPU OOM
try:
    model = WhisperModel("base.en", device="cuda", compute_type="float16")
except Exception:
    print("GPU failed, falling back to CPU")
    model = WhisperModel("base.en", device="cpu", compute_type="int8")
```

VRAM requirements reference:

| Model | float16 | int8_float16 | int8 (CPU) |
|-------|---------|--------------|------------|
| tiny  | 1 GB    | 0.5 GB       | — |
| base  | 1 GB    | 0.5 GB       | — |
| small | 2 GB    | 1 GB         | — |
| medium| 5 GB    | 2.5 GB       | — |
| large-v3 | 10 GB | 5 GB       | — |

---

## Slow CPU Inference

**Symptom**: Transcription takes far too long — e.g., 2 minutes to transcribe 30 seconds of audio.

**Fixes**:

```python
# 1. Use int8 compute type (most impactful)
model = WhisperModel("base.en", device="cpu", compute_type="int8")
# vs default float32 which is 2–4× slower

# 2. Use the smallest model that meets your accuracy needs
# "tiny.en" is ~32× faster than "large-v3"

# 3. Reduce beam size (biggest speed lever, small accuracy trade-off)
segments, _ = model.transcribe("audio.wav", beam_size=1)  # greedy
# default beam_size=5 does 5× more work

# 4. Disable word timestamps if not needed
segments, _ = model.transcribe("audio.wav", word_timestamps=False)

# 5. Set num_workers for CTranslate2
model = WhisperModel(
    "base.en",
    device="cpu",
    compute_type="int8",
    cpu_threads=8,       # use all physical cores
    num_workers=2,       # parallel decode workers
)
```

> **Rule of thumb**: `tiny.en` + `int8` + `beam_size=1` → ~10–15× real-time on a 4-core laptop.

---

## Words Cut Off at Segment Boundaries

**Symptom**: The last word of one segment is repeated at the start of the next, or words are swallowed at boundaries.

**Root cause**: Whisper processes 30-second windows. Without context, it does not know what was said in the previous window.

**Fix**:

```python
segments, _ = model.transcribe(
    "audio.wav",
    condition_on_previous_text=True,   # feed prev segment text as prompt
    # Default is True; if you're seeing repetition, try False:
    # condition_on_previous_text=False,
    initial_prompt="This is a technical discussion about software engineering.",
    # ^ Providing context improves first-segment accuracy
)
```

For streaming, always add padding before and after the speech window:

```python
# Add 200ms of audio before speech start (pre-roll)
PREROLL = int(0.2 * sample_rate)
speech_audio = full_audio[max(0, start_idx - PREROLL) : end_idx + PREROLL]
```

---

## Word Timestamps Misaligned

**Symptom**: Word-level timestamps are off by 200–500ms or more.

**Root cause**: DTW alignment uses cross-attention weights which can be imprecise near segment boundaries.

**Fixes**:

```python
# faster-whisper exposes alignment heads — try larger models for better alignment
model = WhisperModel("small.en", ...)  # better timestamps than tiny

segments, _ = model.transcribe(
    "audio.wav",
    word_timestamps=True,
    # Do not mix with vad_filter if you need precise timestamps
    # vad_filter shifts the timeline
    vad_filter=False,
)

# Post-process: clamp to segment boundaries
for seg in segments:
    for w in (seg.words or []):
        w_start = max(w.start, seg.start)
        w_end = min(w.end, seg.end)
```

---

## ffmpeg Not Found

**Symptom**: `FileNotFoundError: [Errno 2] No such file or directory: 'ffmpeg'` or `AudioStream error`.

**Fix**:

```bash
# Ubuntu / Debian
sudo apt install ffmpeg

# macOS
brew install ffmpeg

# Windows (Chocolatey)
choco install ffmpeg

# Verify
ffmpeg -version
```

If ffmpeg is installed but not on PATH in a virtual environment:

```python
import os
os.environ["PATH"] += os.pathsep + "/usr/bin"  # adjust path as needed
```

---

## faster-whisper Model Format Errors

**Symptom**: `ctranslate2.converters.OptimizerError` or `ValueError: Unsupported model type`.

**Cause**: Using an OpenAI `.pt` checkpoint directly instead of a CTranslate2-converted model.

**Fix**:

```bash
# Convert openai-whisper checkpoint to CTranslate2 format
pip install ctranslate2

ct2-opus-mt-converter ... # not for Whisper
# Use the faster-whisper auto-conversion instead:
python3 -c "
from faster_whisper import WhisperModel
# This auto-downloads the correct CTranslate2 model format:
model = WhisperModel('base.en')
print('Model loaded OK')
"
```

Or convert manually:

```bash
ct2-whisper-converter --model openai/whisper-base.en --output_dir whisper-base-ct2 --quantization int8
```

---

## PortAudio / sounddevice Errors

**Symptom**: `OSError: [Errno -9996] Invalid input device` or `ALSA lib pcm.c:8526`.

**Fixes**:

```bash
# List available input devices
python3 -c "import sounddevice as sd; print(sd.query_devices())"

# Set device explicitly by index
import sounddevice as sd
sd.default.device = (1, None)  # (input_device_id, output_device_id)

# Linux: suppress ALSA spam
# Add to ~/.asoundrc:
# pcm.!default { type hw card 0 }
# ctl.!default { type hw card 0 }
```

```bash
# Install portaudio headers if build fails
sudo apt install portaudio19-dev
pip install sounddevice
```

---

## Audio Quality Issues

| Issue | Cause | Fix |
|-------|-------|-----|
| High WER on clean speech | Sample rate mismatch | Ensure 16kHz mono input |
| Constant "uh", "um" in output | Filler word not suppressed | Post-process with regex |
| Foreign words transliterated | Wrong language set | Force `language=` param |
| Numbers said as words | No custom vocabulary | Use initial_prompt with domain words |
| Acronyms wrong | BPE tokenizer splits them | Add to initial_prompt |

---

## Quick Diagnostic Checklist

```python
# diagnostics.py
import soundfile as sf
import numpy as np

def diagnose_audio(path: str):
    audio, sr = sf.read(path, always_2d=False)
    duration = len(audio) / sr
    rms = np.sqrt(np.mean(audio**2))
    
    print(f"File:      {path}")
    print(f"Sample rate: {sr} Hz  (need 16000)")
    print(f"Channels:  {audio.ndim}  (need 1 mono)")
    print(f"Duration:  {duration:.2f}s")
    print(f"RMS level: {rms:.4f}  (0.01–0.3 OK, <0.005 = silent)")
    print(f"Dtype:     {audio.dtype}")
    
    if sr != 16000:
        print("WARNING: Resample to 16kHz before ASR")
    if audio.ndim > 1:
        print("WARNING: Convert to mono (average channels)")
    if rms < 0.005:
        print("WARNING: Audio may be too quiet — check gain")


if __name__ == "__main__":
    import sys
    diagnose_audio(sys.argv[1])
```

---

## See Also

- [ASR Installation](/kb/ai/asr/installation/)
- [ASR Implementation](/kb/ai/asr/implementation/)
- [ASR Cheatsheet](/kb/ai/asr/cheatsheet/)
- [VAD Troubleshooting](/kb/ai/vad/troubleshooting/) — Many ASR problems (hallucinations, empty results) originate in the VAD stage
- [TTS Troubleshooting](/kb/ai/tts/troubleshooting/) — Use ASR as a round-trip intelligibility test for TTS output
