---
title: "TTS Troubleshooting"
createTime: 2026/03/21 14:07:00
permalink: /kb/ai/tts/troubleshooting/
---

# TTS Troubleshooting

Common problems with neural TTS systems and their solutions.

---

## Robotic or Flat-Sounding Voice

**Symptom**: Speech is intelligible but monotone, with unnatural rhythm.

**Causes & Fixes**:

```python
# 1. Try a different voice — some voices are naturally more expressive
from kokoro import KPipeline
pipeline = KPipeline(lang_code="a")

# More expressive voices
for voice in ["af_heart", "af_bella", "bf_emma"]:
    for _, _, audio in pipeline("Hello! How are you today?", voice=voice):
        save_audio(audio, f"{voice}.wav")

# 2. Adjust speed — slightly slower often sounds more natural
for _, _, audio in pipeline(text, voice="af_heart", speed=0.9):
    ...

# 3. Add punctuation to guide prosody
text_flat = "Tell me about AI"
text_better = "Tell me about AI!"   # exclamation adds expressiveness
text_best  = "Tell me about A.I."   # disambiguates acronym pronunciation

# 4. For Bark — use emphasis tokens
bark_text = "This is [laughs] REALLY interesting!"
```

---

## Mispronounced Words

**Symptom**: Abbreviations, technical terms, proper nouns, or numbers spoken incorrectly.

**Common patterns and fixes**:

| Problem | Input | Fix |
|---------|-------|-----|
| Acronym read as word | "API" → "appy" | "A.P.I." or "A P I" |
| Number read wrong | "2026" → "two thousand twenty-six" | "twenty twenty-six" |
| URL spoken weirdly | "github.com" → garbled | "github dot com" |
| Abbreviation wrong | "Dr." → "drive" | "Doctor" |
| Symbol ignored | "C++" → "C" | "C plus plus" |
| Technical term | "CUDA" → "COOD-ah" | "CUDA" (try spelling: "C.U.D.A.") |

```python
import re

def normalize_text_for_tts(text: str) -> str:
    """Pre-process text to improve TTS pronunciation."""
    # Expand common abbreviations
    text = re.sub(r"\bDr\.\s", "Doctor ", text)
    text = re.sub(r"\bMr\.\s", "Mister ", text)
    text = re.sub(r"\bMs\.\s", "Miss ", text)
    text = re.sub(r"\bAPI\b", "A.P.I.", text)
    text = re.sub(r"\bGPU\b", "G.P.U.", text)
    text = re.sub(r"\bCPU\b", "C.P.U.", text)
    text = re.sub(r"\bRAG\b", "R.A.G.", text)
    text = re.sub(r"\bLLM\b", "L.L.M.", text)
    
    # Convert URLs
    text = re.sub(r"https?://", "", text)
    text = text.replace(".com", " dot com")
    text = text.replace(".org", " dot org")
    
    # Symbols
    text = text.replace("C++", "C plus plus")
    text = text.replace("C#", "C sharp")
    text = text.replace("&", "and")
    text = text.replace("%", "percent")
    text = text.replace("@", "at")
    
    return text
```

For Kokoro, you can also use phoneme overrides in the text if `misaki` G2P is installed:

```python
# Kokoro phoneme injection (language-dependent)
text = "The word /ˈlɛd/ (lead) is spelled differently from /liːd/ (lead)."
```

---

## Audio Clicks and Pops

**Symptom**: Short click or pop artifact at the beginning or end of synthesized audio, or between sentences.

**Causes & Fixes**:

```python
import numpy as np
import soundfile as sf

def fade_audio(audio: np.ndarray, fade_ms: float = 10.0, sr: int = 24000) -> np.ndarray:
    """Apply linear fade-in and fade-out to remove clicks."""
    fade_samples = int(fade_ms * sr / 1000)
    fade_samples = min(fade_samples, len(audio) // 4)
    
    fade_in = np.linspace(0, 1, fade_samples)
    fade_out = np.linspace(1, 0, fade_samples)
    
    audio = audio.copy()
    audio[:fade_samples] *= fade_in
    audio[-fade_samples:] *= fade_out
    return audio

def crossfade_concat(chunks: list[np.ndarray],
                      crossfade_ms: float = 20.0,
                      sr: int = 24000) -> np.ndarray:
    """Join audio chunks with crossfade to avoid boundary clicks."""
    if not chunks:
        return np.array([])
    if len(chunks) == 1:
        return chunks[0]
    
    cf = int(crossfade_ms * sr / 1000)
    result = chunks[0]
    
    for chunk in chunks[1:]:
        chunk = fade_audio(chunk, crossfade_ms, sr)
        # Overlap and add
        overlap_len = min(cf, len(result), len(chunk))
        fade_out = np.linspace(1, 0, overlap_len)
        fade_in  = np.linspace(0, 1, overlap_len)
        
        result[-overlap_len:] = result[-overlap_len:] * fade_out + chunk[:overlap_len] * fade_in
        result = np.concatenate([result, chunk[overlap_len:]])
    
    return result
```

---

## Voice Clone Quality Poor (XTTS-v2 / F5-TTS)

**Symptoms**: Cloned voice sounds like a different person, wrong accent, distorted.

**Reference audio requirements**:

| Requirement | Value | Why |
|-------------|-------|-----|
| Duration | 3–15 seconds | Too short = insufficient info; too long = slow encoding |
| Noise | Very low | Background music/noise bleeds into the clone |
| Content | Natural speech | Avoid laughing, singing, whispering |
| Format | WAV, 16kHz+ mono | MP3 compression artifacts hurt cloning |
| Language | Match output | Cloning across languages rarely works well |

```python
# Pre-process reference audio for better cloning
import numpy as np
import soundfile as sf
import subprocess
import os
import tempfile

def prepare_reference_audio(input_path: str, output_path: str,
                              target_sr: int = 24000,
                              max_duration_s: float = 15.0):
    """
    Clean reference audio for voice cloning:
    - Convert to mono WAV at target sample rate
    - Trim to max_duration_s
    - Normalize volume
    """
    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
        tmp_path = tmp.name
    
    # ffmpeg: convert to mono, resample, trim
    subprocess.run([
        "ffmpeg", "-y",
        "-i", input_path,
        "-ac", "1",
        "-ar", str(target_sr),
        "-t", str(max_duration_s),
        tmp_path,
    ], check=True, capture_output=True)
    
    # Normalize
    audio, sr = sf.read(tmp_path, dtype="float32")
    peak = np.abs(audio).max()
    if peak > 0:
        audio = audio / peak * 0.95
    
    sf.write(output_path, audio, sr)
    os.unlink(tmp_path)
    print(f"Reference prepared: {output_path} ({len(audio)/sr:.2f}s @ {sr}Hz)")
```

---

## CUDA Out of Memory

**Symptom**: `torch.cuda.OutOfMemoryError` when using XTTS-v2 or F5-TTS on GPU.

```python
# 1. Force CPU (slower but no VRAM requirement)
from TTS.api import TTS
tts = TTS("tts_models/multilingual/multi-dataset/xtts_v2", gpu=False)

# 2. Reduce batch — XTTS-v2 GPU with shorter text uses less VRAM
# Split text into shorter chunks (<100 chars each) before synthesizing

# 3. Release GPU memory between calls
import torch
import gc

def synthesize_and_free(tts_model, text, ref_wav, lang):
    result = tts_model.tts(text=text, speaker_wav=ref_wav, language=lang)
    torch.cuda.empty_cache()
    gc.collect()
    return result

# 4. Use Kokoro instead — 82M params, trivial VRAM usage
```

---

## Bark Is Too Slow

**Symptom**: Bark takes 10–30 seconds to synthesize a few words.

**Options**:

```python
# 1. Use small models (quality drops, 3–5× faster)
import os
os.environ["SUNO_USE_SMALL_MODELS"] = "True"
from bark import preload_models
preload_models()

# 2. Use GPU — Bark is ~10× faster on GPU vs CPU
# Ensure CUDA is available and torch uses it

# 3. Switch to a faster library for non-expressive content
# Bark's unique strength is laughter/music/non-verbal sounds
# For regular speech → Kokoro or XTTS-v2

# 4. Pre-generate and cache common phrases
CACHE = {}

def bark_cached(text: str, preset: str = "v2/en_speaker_6") -> np.ndarray:
    key = (text, preset)
    if key not in CACHE:
        CACHE[key] = generate_audio(text, history_prompt=preset)
    return CACHE[key]
```

---

## Text with Numbers & Special Characters

**Symptom**: Numbers, dates, math expressions, or symbols cause wrong or broken speech.

```python
from num2words import num2words  # pip install num2words
import re

def preprocess_for_tts(text: str, lang: str = "en") -> str:
    # Convert integers
    text = re.sub(
        r"\b(\d+)\b",
        lambda m: num2words(int(m.group()), lang=lang),
        text,
    )
    # Convert floats
    text = re.sub(
        r"\b(\d+\.\d+)\b",
        lambda m: num2words(float(m.group()), lang=lang),
        text,
    )
    # Handle currency
    text = re.sub(
        r"\$(\d+\.\d{2})",
        lambda m: f"{num2words(float(m.group(1)), to='currency', lang=lang)} dollars",
        text,
    )
    # Remove markdown and code formatting
    text = re.sub(r"`[^`]+`", "", text)        # inline code
    text = re.sub(r"\*\*([^*]+)\*\*", r"\1", text)  # bold
    text = re.sub(r"\*([^*]+)\*", r"\1", text)        # italic
    text = re.sub(r"#{1,6}\s", "", text)             # headings
    text = re.sub(r"\[[^\]]+\]\([^)]+\)", "", text)  # links
    
    return text.strip()
```

---

## edge-tts Rate Limiting / Network Errors

**Symptom**: `aiohttp.ClientError` or silent failures from edge-tts.

```python
import asyncio
import edge_tts

async def synthesize_with_retry(text: str, voice: str, max_retries: int = 3) -> bytes:
    for attempt in range(max_retries):
        try:
            communicate = edge_tts.Communicate(text, voice)
            audio_data = b""
            async for chunk in communicate.stream():
                if chunk["type"] == "audio":
                    audio_data += chunk["data"]
            return audio_data
        except Exception as e:
            if attempt < max_retries - 1:
                await asyncio.sleep(1.0 * (attempt + 1))
            else:
                raise
```

For sustained offline use, switch to Kokoro — it has no network dependency.

---

## Audio Format / Sample Rate Mismatch

**Symptom**: Playback sounds sped-up, slowed-down, or distorted.

```python
import soundfile as sf
import numpy as np

def check_audio(path: str):
    audio, sr = sf.read(path, always_2d=False)
    print(f"Sample rate: {sr} Hz")
    print(f"Duration:    {len(audio)/sr:.2f}s")
    print(f"Channels:    {1 if audio.ndim == 1 else audio.shape[1]}")
    print(f"Peak:        {np.abs(audio).max():.4f}")

# TTS output sample rates
# Kokoro:  24000 Hz
# XTTS-v2: 24000 Hz
# Bark:    24000 Hz (SAMPLE_RATE constant)
# edge-tts: 24000 Hz (MP3 decoded)

# sounddevice playback MUST match the sample rate
import sounddevice as sd
sd.play(audio, samplerate=24000)  # MUST specify correct SR
sd.wait()
```

---

## Quick Diagnostic Checklist

```python
def diagnose_tts():
    """Run all TTS dependency checks."""
    print("=== TTS Diagnostics ===")
    
    # Kokoro
    try:
        from kokoro import KPipeline
        p = KPipeline(lang_code="a")
        import numpy as np
        chunks = list(p("test", voice="af_heart"))
        print(f"[OK] Kokoro — {len(chunks)} chunks from test synthesis")
    except Exception as e:
        print(f"[FAIL] Kokoro: {e}")
    
    # sounddevice
    try:
        import sounddevice as sd
        devices = sd.query_devices()
        out = [d for d in devices if d["max_output_channels"] > 0]
        print(f"[OK] sounddevice — {len(out)} output devices found")
    except Exception as e:
        print(f"[FAIL] sounddevice: {e}")
    
    # ffmpeg
    import subprocess
    r = subprocess.run(["ffmpeg", "-version"], capture_output=True)
    if r.returncode == 0:
        print("[OK] ffmpeg installed")
    else:
        print("[FAIL] ffmpeg not found — run: sudo apt install ffmpeg")
    
    # espeak-ng
    r = subprocess.run(["espeak-ng", "--version"], capture_output=True)
    if r.returncode == 0:
        print("[OK] espeak-ng installed")
    else:
        print("[WARN] espeak-ng not found — phonemization may be limited")

diagnose_tts()
```

---

## See Also

- [TTS Installation](/kb/ai/tts/installation/)
- [TTS Implementation](/kb/ai/tts/implementation/)
- [TTS Cheatsheet](/kb/ai/tts/cheatsheet/)
- [ASR Troubleshooting](/kb/ai/asr/troubleshooting/) — Use ASR as a round-trip intelligibility test: synthesize text → transcribe → compare WER
- [VAD Troubleshooting](/kb/ai/vad/troubleshooting/) — If TTS output feeds back into the microphone (no headphones), VAD will detect it as speech and loop
