---
title: "TTS Libraries Comparison"
createTime: 2026/03/21 14:02:00
permalink: /kb/ai/tts/libraries-comparison/
---

# TTS Libraries Comparison

A deep-dive comparison of the major TTS libraries, covering APIs, voice quality, hardware requirements, and practical usage patterns.

---

## Quick Comparison Matrix

| Library | Model type | MOS | CPU RTF | GPU RTF | Cloning | langs | License |
|---------|-----------|-----|---------|---------|---------|-------|---------|
| **Kokoro** | Flow+HiFiGAN | 4.1 | ~0.05 | ~0.005 | ✗ | EN,JA,ZH,FR,KO,PT | Apache 2.0 |
| **Coqui XTTS-v2** | Codec LM | 4.3 | ~0.4 | ~0.05 | ✓ (3s) | 17 | CPML* |
| **F5-TTS** | Flow matching | 4.4 | ~0.2 | ~0.02 | ✓ (ref) | EN,ZH | MIT |
| **StyleTTS2** | Diffusion+style | 4.4 | ~0.3 | ~0.03 | ✓ | EN | MIT |
| **Bark** | Codec LM (GPT) | 4.0 | ~15 | ~1.5 | ✗ | 10+ | MIT |
| **edge-tts** | Cloud (Azure) | 4.2 | ~0.01** | — | ✗ | 400+ voices | MIT (client) |
| **OpenVoice V2** | VITS+converter | 4.1 | ~0.15 | ~0.02 | ✓ | EN,ZH,FR,ES,JP,KO | MIT |
| **MeloTTS** | VITS variant | 4.0 | ~0.1 | ~0.01 | ✗ | EN,ZH,FR,ES,JP,KO | MIT |
| **pyttsx3** | OS engine | 2.8 | ~0.001 | — | ✗ | OS-dependent | MIT |

\* CPML = Coqui Public Model License (non-commercial restriction on the model weights)  
\*\* Network latency not counted

---

## Kokoro

**Best for**: Production offline streaming, embedded edge devices, low-latency voice pipelines.

Kokoro uses a lightweight flow-based acoustic model with a HiFi-GAN vocoder. Available as ONNX (CPU-optimized) or PyTorch. 82M parameters total.

### Voices
```python
# Available voice IDs (English)
voices_en = [
    "af_heart",     # African American female, warm
    "af_bella",     # Female, expressive
    "af_sarah",     # Female, professional
    "am_adam",      # Male, neutral
    "am_michael",   # Male, deep
    "bf_emma",      # British female
    "bm_george",    # British male
]
# Japanese: jf_alpha, jm_kumo, etc.
# French: ff_siwis
# Korean: kf_*, km_*
```

### Basic Usage
```python
from kokoro import KPipeline
import soundfile as sf

pipeline = KPipeline(lang_code="a")  # "a"=American English, "j"=Japanese, etc.
generator = pipeline("Hello, world! This is Kokoro TTS.", voice="af_heart", speed=1.0)

audio_chunks = []
for gs, ps, audio in generator:
    audio_chunks.append(audio)

import numpy as np
full_audio = np.concatenate(audio_chunks)
sf.write("output.wav", full_audio, 24000)
```

### Streaming (generator-based)
```python
# Each iteration yields one sentence segment
for graphemes, phonemes, audio_chunk in pipeline(text, voice="af_heart"):
    play_audio(audio_chunk)  # play while generating next
```

---

## Coqui XTTS-v2

**Best for**: High-quality multilingual voice cloning where license permits.

XTTS-v2 is a codec LM: it encodes text and a speaker embedding (from a 3-second reference) as conditioning tokens, then generates EnCodec tokens autoregressively, which are decoded to audio.

### 17 Supported Languages
English, Spanish, French, German, Italian, Portuguese, Polish, Turkish, Russian, Dutch, Czech, Arabic, Chinese, Japanese, Hungarian, Korean, Hindi.

### Voice Cloning
```python
from TTS.api import TTS

tts = TTS("tts_models/multilingual/multi-dataset/xtts_v2", gpu=False)

tts.tts_to_file(
    text="Hello, I am cloning your voice.",
    speaker_wav="reference_voice.wav",   # 3-24s clean reference audio
    language="en",
    file_path="cloned.wav",
)
```

### Low-Level API (more control)
```python
from TTS.tts.configs.xtts_config import XttsConfig
from TTS.tts.models.xtts import Xtts
import torch

config = XttsConfig()
config.load_json("path/to/xtts_v2/config.json")
model = Xtts.init_from_config(config)
model.load_checkpoint(config, checkpoint_dir="path/to/xtts_v2/")
model.eval()

# Get speaker conditioning latents from reference
gpt_cond_latent, speaker_embedding = model.get_conditioning_latents(
    audio_path=["reference_voice.wav"]
)

# Synthesize (streaming)
chunks = model.inference_stream(
    "Text to synthesize.",
    "en",
    gpt_cond_latent,
    speaker_embedding,
    stream_chunk_size=20,
    temperature=0.7,
    length_penalty=1.0,
    repetition_penalty=10.0,
    top_k=50,
    top_p=0.85,
)
for chunk in chunks:
    audio_np = chunk.cpu().numpy()
    play_audio(audio_np)
```

---

## F5-TTS

**Best for**: Best open-source voice cloning quality, MIT license, good speed.

F5-TTS uses flow matching — it learns a velocity field that transports noise to mel-spectrograms, conditioned on text and a reference audio clip. No separate speaker encoder needed.

### Installation
```bash
pip install f5-tts
```

### Inference
```python
from f5_tts.api import F5TTS

tts = F5TTS()

wav, sr, _ = tts.infer(
    ref_file="reference_voice.wav",
    ref_text="The reference text spoken in the reference audio.",
    gen_text="Text I want to generate in that voice.",
    target_rms=0.1,
    cross_fade_duration=0.15,
    nfe_step=32,          # flow matching ODE steps (16-32 for quality)
    cfg_strength=2.0,     # classifier-free guidance
    speed=1.0,
)

import soundfile as sf
sf.write("f5_output.wav", wav, sr)
```

### CLI
```bash
f5-tts_infer-cli \
  --model F5TTS_v1_Base \
  --ref_audio reference.wav \
  --ref_text "What is spoken in reference.wav" \
  --gen_text "Hello, this is my cloned voice speaking." \
  --output_dir ./output
```

---

## Bark

**Best for**: Expressive, creative synthesis — laughter, music, non-verbal sounds, multiple speakers. Not for production latency-sensitive use.

Bark is a hierarchical codec LM with three stages: semantic tokens (from text), coarse acoustic tokens (1st RVQ layer), fine acoustic tokens (remaining RVQ layers).

```python
from bark import SAMPLE_RATE, generate_audio, preload_models
from bark.generation import SUPPORTED_LANGS
import soundfile as sf
import numpy as np

preload_models()

# Special tokens
# [laughter] [laughs] [sighs] [music] [gasps] [clears throat]
# ♪ music ♪   --- (pause)   CAPITALIZATION for emphasis

audio = generate_audio(
    "Hello! [laughs] This is Bark. ♪ la la la ♪",
    history_prompt="v2/en_speaker_6",   # voice preset
)
sf.write("bark_out.wav", audio, SAMPLE_RATE)

# Available voice presets
presets_en = [f"v2/en_speaker_{i}" for i in range(10)]
```

**GPU strongly recommended**: CPU inference is ~15× real-time (15s to generate 1s of audio).

---

## edge-tts

**Best for**: Simple, zero-setup, cloud-quality TTS with the widest voice selection. Requires internet.

Uses Microsoft Azure's neural TTS via an undocumented edge browser API. Free, no API key needed.

```python
import asyncio
import edge_tts
import soundfile as sf
import io

async def synthesize(text: str, voice: str = "en-US-AriaNeural") -> bytes:
    communicate = edge_tts.Communicate(text, voice)
    audio_data = b""
    async for chunk in communicate.stream():
        if chunk["type"] == "audio":
            audio_data += chunk["data"]
    return audio_data  # MP3 bytes

# List all voices
async def list_voices():
    voices = await edge_tts.list_voices()
    for v in voices:
        print(v["ShortName"], v["Locale"], v["Gender"])

# Synthesis with SSML for prosody control
async def synthesize_ssml():
    communicate = edge_tts.Communicate(
        "<speak><prosody rate='-10%' pitch='+5Hz'>Slow and high pitched.</prosody></speak>",
        "en-US-AriaNeural",
    )
    await communicate.save("output.mp3")

asyncio.run(synthesize("Hello, this is edge-tts!"))
```

Popular voices:
- `en-US-AriaNeural` — female, expressive
- `en-US-GuyNeural` — male, natural
- `en-GB-SoniaNeural` — British female
- `en-US-JennyNeural` — female, assistive

---

## OpenVoice V2

**Best for**: Voice style transfer — take any base TTS voice and apply a target speaker's timbre to it.

```python
from openvoice import se_extractor
from openvoice.api import ToneColorConverter
from melo.api import TTS
import torch

# Load tone color converter
ckpt_converter = "checkpoints_v2/converter"
device = "cpu"
tone_color_converter = ToneColorConverter(f"{ckpt_converter}/config.json", device=device)
tone_color_converter.load_ckpt(f"{ckpt_converter}/checkpoint.pth")

# Extract target speaker embedding from reference audio
target_se, _ = se_extractor.get_se("reference_voice.wav", tone_color_converter, vad=False)

# Generate base speech with MeloTTS
tts_model = TTS(language="EN", device=device)
speaker_ids = tts_model.hps.data.spk2id
source_se = torch.load(f"checkpoints_v2/base_speakers/ses/en-us.pth", map_location=device)

tts_model.tts_to_file(
    "Hello, this voice will be converted!",
    speaker_ids["EN-US"],
    "/tmp/base_output.wav",
    speed=1.0,
)

# Apply tone color conversion
tone_color_converter.convert(
    audio_src_path="/tmp/base_output.wav",
    src_se=source_se,
    tgt_se=target_se,
    output_path="final_output.wav",
    message="@OpenVoice",
)
```

---

## pyttsx3

**Best for**: Zero-latency, zero-internet, zero-ML, simple notification/alert TTS.

```python
import pyttsx3

engine = pyttsx3.init()
engine.setProperty("rate", 150)    # words per minute (default ~200)
engine.setProperty("volume", 0.9)  # 0.0 – 1.0

# List available voices
for voice in engine.getProperty("voices"):
    print(voice.id, voice.name, voice.languages)

engine.setProperty("voice", "english")  # or use voice.id

# Say and wait
engine.say("Hello, world!")
engine.runAndWait()

# Save to file
engine.save_to_file("Hello from pyttsx3", "output.wav")
engine.runAndWait()
```

---

## Decision Flowchart

```
Needs internet? No required?
  ├─ Yes, fine → edge-tts (fastest, highest voice variety)
  └─ No (offline required)
        │
        ├─ Need voice cloning?
        │     ├─ Best quality → F5-TTS (MIT)
        │     ├─ Multilingual → XTTS-v2 (CPML)
        │     └─ Style transfer → OpenVoice V2
        │
        ├─ Speed critical (edge/embedded)?
        │     └─ Kokoro ONNX
        │
        ├─ Expressive/creative (laughter, music)?
        │     └─ Bark
        │
        └─ Zero deps, simple alerts?
              └─ pyttsx3
```

---

## See Also

- [TTS Installation](/kb/ai/tts/installation/)
- [TTS Implementation](/kb/ai/tts/implementation/)
- [TTS Real-Time Streaming](/kb/ai/tts/real-time-streaming/)
- [ASR Libraries Comparison](/kb/ai/asr/libraries-comparison/) — The ASR WER round-trip test (synthesize → transcribe → compare) is a standard TTS intelligibility benchmark
- [VAD Libraries Comparison](/kb/ai/vad/libraries-comparison/) — TTS output sample rate (22050/24000 Hz) must be resampled to 16000 Hz before VAD or ASR processing
