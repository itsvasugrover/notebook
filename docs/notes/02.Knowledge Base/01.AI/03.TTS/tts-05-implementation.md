---
title: "TTS Implementation"
createTime: 2026/03/21 14:04:00
permalink: /kb/ai/tts/implementation/
---

# TTS Implementation

Complete, production-ready Python implementations for each major TTS library. Each section is self-contained and directly runnable.

---

## Kokoro (Recommended — Fastest Offline)

### Basic Synthesis

```python
# kokoro_basic.py
from kokoro import KPipeline
import numpy as np
import soundfile as sf

def synthesize(text: str,
               voice: str = "af_heart",
               speed: float = 1.0,
               lang_code: str = "a",
               output_path: str = "output.wav") -> np.ndarray:
    """
    Synthesize text to a WAV file using Kokoro.
    lang_code: "a"=American EN, "b"=British EN, "j"=Japanese,
               "z"=Chinese, "k"=Korean, "f"=French, "p"=Portuguese
    """
    pipeline = KPipeline(lang_code=lang_code)
    
    audio_chunks = []
    for graphemes, phonemes, audio in pipeline(text, voice=voice, speed=speed):
        audio_chunks.append(audio)
    
    full_audio = np.concatenate(audio_chunks)
    sf.write(output_path, full_audio, 24000)
    return full_audio


if __name__ == "__main__":
    audio = synthesize(
        "The quick brown fox jumps over the lazy dog.",
        voice="af_heart",
        output_path="kokoro_test.wav",
    )
    print(f"Generated {len(audio)/24000:.2f}s of audio")
```

### Reusing the Pipeline (Model Stays Loaded)

```python
# kokoro_reuse.py
from kokoro import KPipeline
import numpy as np
import soundfile as sf
from typing import Iterator

class KokoroTTS:
    """Keeps Kokoro loaded in memory for repeated synthesis calls."""
    
    def __init__(self, lang_code: str = "a", voice: str = "af_heart"):
        self.pipeline = KPipeline(lang_code=lang_code)
        self.default_voice = voice
        self.sample_rate = 24000
    
    def synthesize(self, text: str, voice: str = None, speed: float = 1.0) -> np.ndarray:
        voice = voice or self.default_voice
        chunks = [audio for _, _, audio in self.pipeline(text, voice=voice, speed=speed)]
        return np.concatenate(chunks)
    
    def synthesize_to_file(self, text: str, path: str,
                            voice: str = None, speed: float = 1.0):
        audio = self.synthesize(text, voice, speed)
        sf.write(path, audio, self.sample_rate)
    
    def stream(self, text: str, voice: str = None, speed: float = 1.0) -> Iterator[np.ndarray]:
        """Yield audio chunks sentence by sentence."""
        voice = voice or self.default_voice
        for _, _, audio in self.pipeline(text, voice=voice, speed=speed):
            yield audio


if __name__ == "__main__":
    tts = KokoroTTS(voice="am_michael")
    tts.synthesize_to_file("Hello from Kokoro!", "hello.wav")
    tts.synthesize_to_file("British accent test.", "british.wav", voice="bm_george")
```

### Multi-Voice Batch

```python
# kokoro_batch.py
import csv
from pathlib import Path
from kokoro import KPipeline
import numpy as np
import soundfile as sf

def batch_synthesize(manifest_csv: str, output_dir: str,
                     voice: str = "af_heart", lang: str = "a"):
    """
    CSV format: text,filename
    Synthesizes all rows and saves to output_dir/filename.wav
    """
    pipeline = KPipeline(lang_code=lang)
    Path(output_dir).mkdir(parents=True, exist_ok=True)
    
    with open(manifest_csv) as f:
        reader = csv.DictReader(f)
        for i, row in enumerate(reader):
            chunks = [a for _, _, a in pipeline(row["text"], voice=voice)]
            audio = np.concatenate(chunks)
            out_path = str(Path(output_dir) / row["filename"])
            sf.write(out_path, audio, 24000)
            print(f"[{i+1}] {row['filename']} ({len(audio)/24000:.2f}s)")
```

---

## Coqui XTTS-v2 (Voice Cloning)

```python
# xtts_impl.py
from TTS.api import TTS
import soundfile as sf
import numpy as np

class XTTSV2:
    def __init__(self, gpu: bool = False):
        self.tts = TTS(
            "tts_models/multilingual/multi-dataset/xtts_v2",
            gpu=gpu,
        )
    
    def clone_voice(self, text: str, reference_wav: str,
                    language: str = "en", output_path: str = "cloned.wav"):
        """Synthesize text in the voice of reference_wav speaker."""
        self.tts.tts_to_file(
            text=text,
            speaker_wav=reference_wav,
            language=language,
            file_path=output_path,
        )
    
    def clone_voice_numpy(self, text: str, reference_wav: str,
                          language: str = "en") -> tuple[np.ndarray, int]:
        """Return (audio_array, sample_rate) without writing to file."""
        wav = self.tts.tts(
            text=text,
            speaker_wav=reference_wav,
            language=language,
        )
        return np.array(wav, dtype=np.float32), 24000


if __name__ == "__main__":
    xtts = XTTSV2(gpu=False)
    xtts.clone_voice(
        text="This voice was cloned from just a few seconds of reference audio.",
        reference_wav="my_voice_sample.wav",
        language="en",
        output_path="my_cloned_voice.wav",
    )
    print("Done! Check my_cloned_voice.wav")
```

---

## F5-TTS (Best Open-Source Cloning Quality)

```python
# f5tts_impl.py
from f5_tts.api import F5TTS
import soundfile as sf
import numpy as np
import os

class F5TTSEngine:
    def __init__(self):
        self.model = F5TTS()
    
    def synthesize(self,
                   gen_text: str,
                   ref_audio: str,
                   ref_text: str,
                   output_path: str = "f5_output.wav",
                   nfe_step: int = 32,
                   speed: float = 1.0) -> np.ndarray:
        """
        Args:
            gen_text:   Text to generate
            ref_audio:  Path to reference WAV (target voice, 3–15s)
            ref_text:   Transcript of what is spoken in ref_audio
            nfe_step:   Flow matching ODE steps (16=fast, 32=balanced, 64=best)
            speed:      Speech rate multiplier
        """
        wav, sr, _ = self.model.infer(
            ref_file=ref_audio,
            ref_text=ref_text,
            gen_text=gen_text,
            nfe_step=nfe_step,
            cfg_strength=2.0,
            speed=speed,
            cross_fade_duration=0.15,
        )
        sf.write(output_path, wav, sr)
        return wav
    
    def synthesize_long(self, text: str, ref_audio: str, ref_text: str,
                         output_path: str = "f5_long.wav",
                         max_chars: int = 200) -> np.ndarray:
        """Split long text into chunks and concatenate."""
        import re
        sentences = re.split(r"(?<=[.!?])\s+", text)
        
        chunks = []
        current = ""
        for s in sentences:
            if len(current) + len(s) > max_chars:
                if current:
                    w, sr, _ = self.model.infer(
                        ref_file=ref_audio, ref_text=ref_text,
                        gen_text=current.strip(), nfe_step=32,
                    )
                    chunks.append(w)
                current = s
            else:
                current += " " + s
        
        if current.strip():
            w, sr, _ = self.model.infer(
                ref_file=ref_audio, ref_text=ref_text,
                gen_text=current.strip(), nfe_step=32,
            )
            chunks.append(w)
        
        full_audio = np.concatenate(chunks)
        sf.write(output_path, full_audio, sr)
        return full_audio


if __name__ == "__main__":
    engine = F5TTSEngine()
    engine.synthesize(
        gen_text="Hello! This is a demonstration of F5-TTS voice cloning.",
        ref_audio="reference.wav",
        ref_text="This is the text spoken in the reference audio file.",
        output_path="f5_demo.wav",
    )
```

---

## Bark (Expressive / Creative)

```python
# bark_impl.py
from bark import SAMPLE_RATE, generate_audio, preload_models
import soundfile as sf
import numpy as np
import os

# Use small models for faster inference (lower quality)
# os.environ["SUNO_USE_SMALL_MODELS"] = "True"

preload_models()

VOICE_PRESETS = {
    "male_1": "v2/en_speaker_6",
    "male_2": "v2/en_speaker_0",
    "female_1": "v2/en_speaker_9",
    "female_2": "v2/en_speaker_3",
    "british": "v2/en_speaker_5",
}

def bark_synthesize(text: str,
                    preset: str = "female_1",
                    output_path: str = "bark_out.wav") -> np.ndarray:
    """
    Special tokens supported in text:
      [laughter]  [laughs]  [sighs]  [music]  [gasps]  [clears throat]
      ♪ song lyrics ♪      ---  (dramatic pause)
      CAPS = emphasis
    """
    history_prompt = VOICE_PRESETS.get(preset, preset)
    audio = generate_audio(text, history_prompt=history_prompt)
    sf.write(output_path, audio, SAMPLE_RATE)
    return audio


if __name__ == "__main__":
    bark_synthesize(
        "[clears throat] Hello! [laughs] I am Bark — an expressive TTS model. ♪ la la la ♪",
        preset="female_1",
        output_path="bark_demo.wav",
    )
```

---

## edge-tts

```python
# edge_tts_impl.py
import asyncio
import edge_tts
import soundfile as sf
import io
import numpy as np
import tempfile
import os

VOICES = {
    "aria":  "en-US-AriaNeural",
    "guy":   "en-US-GuyNeural",
    "jenny": "en-US-JennyNeural",
    "sonia": "en-GB-SoniaNeural",
    "ryan":  "en-GB-RyanNeural",
}

async def synthesize_async(text: str,
                            voice: str = "aria",
                            output_path: str = "edge_out.mp3",
                            rate: str = "+0%",
                            pitch: str = "+0Hz") -> str:
    """
    rate: "+10%" = 10% faster, "-20%" = 20% slower
    pitch: "+5Hz" = higher, "-10Hz" = lower
    """
    voice_id = VOICES.get(voice, voice)
    communicate = edge_tts.Communicate(text, voice_id, rate=rate, pitch=pitch)
    await communicate.save(output_path)
    return output_path

async def synthesize_to_numpy(text: str, voice: str = "aria") -> tuple[np.ndarray, int]:
    """Returns (float32 array, sample_rate) — decodes MP3 in memory."""
    with tempfile.NamedTemporaryFile(suffix=".mp3", delete=False) as f:
        tmp = f.name
    try:
        await synthesize_async(text, voice, tmp)
        audio, sr = sf.read(tmp, dtype="float32")
        if audio.ndim > 1:
            audio = audio.mean(axis=1)
        return audio, sr
    finally:
        os.unlink(tmp)


def synthesize(text: str, voice: str = "aria", output_path: str = "edge_out.mp3"):
    """Sync wrapper."""
    asyncio.run(synthesize_async(text, voice, output_path))


if __name__ == "__main__":
    synthesize("Hello! This is edge-tts running with no model download.", voice="aria")
    print("Saved edge_out.mp3")
```

---

## Saving Audio in Multiple Formats

```python
# audio_formats.py
import numpy as np
import soundfile as sf
import subprocess
import tempfile
import os

def save_audio(audio: np.ndarray, sample_rate: int,
               output_path: str, normalize: bool = True):
    """
    Save audio as WAV, MP3, or OGG based on file extension.
    audio: float32 numpy array, values in [-1, 1]
    """
    if normalize and audio.max() > 0:
        audio = audio / np.abs(audio).max() * 0.95
    
    ext = os.path.splitext(output_path)[1].lower()
    
    if ext == ".wav":
        sf.write(output_path, audio, sample_rate, subtype="PCM_16")
    
    elif ext in (".mp3", ".ogg", ".flac"):
        # Write WAV first, then convert with ffmpeg
        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
            tmp_wav = tmp.name
        sf.write(tmp_wav, audio, sample_rate, subtype="PCM_16")
        
        ffmpeg_cmd = ["ffmpeg", "-y", "-i", tmp_wav]
        if ext == ".mp3":
            ffmpeg_cmd += ["-codec:a", "libmp3lame", "-qscale:a", "2"]
        elif ext == ".ogg":
            ffmpeg_cmd += ["-codec:a", "libvorbis", "-qscale:a", "5"]
        elif ext == ".flac":
            ffmpeg_cmd += ["-codec:a", "flac"]
        ffmpeg_cmd.append(output_path)
        
        subprocess.run(ffmpeg_cmd, check=True, capture_output=True)
        os.unlink(tmp_wav)
    else:
        raise ValueError(f"Unsupported format: {ext}")
```

---

## Resample for ASR Round-Trip

If you need to feed TTS output back into ASR (16kHz):

```python
import numpy as np
import soundfile as sf
import librosa  # pip install librosa

def resample_for_asr(audio: np.ndarray, src_sr: int, target_sr: int = 16000) -> np.ndarray:
    if src_sr == target_sr:
        return audio
    return librosa.resample(audio, orig_sr=src_sr, target_sr=target_sr)

# Example: Kokoro outputs 24kHz, ASR needs 16kHz
tts_audio_24k = np.zeros(24000)  # placeholder
asr_audio_16k = resample_for_asr(tts_audio_24k, 24000, 16000)
```

---

## See Also

- [TTS Real-Time Streaming](/kb/ai/tts/real-time-streaming/)
- [TTS Integration Guide](/kb/ai/tts/integration/)
- [TTS Troubleshooting](/kb/ai/tts/troubleshooting/)
- [ASR Implementation](/kb/ai/asr/implementation/) — The transcript produced by ASR is the text input to TTS synthesis
- [VAD Real-Time Streaming](/kb/ai/vad/real-time-streaming/) — TTS playback must be interruptible when VAD detects new user speech (barge-in)
