---
title: "Speaker Diarization"
createTime: 2026/03/21 13:10:00
permalink: /kb/ai/asr/speaker-diarization/
---

# Speaker Diarization

Speaker diarization answers the question **"who spoke when?"** — it segments audio into contiguous speech regions and assigns each region a speaker label. Combined with ASR, this produces speaker-attributed transcripts.

---

## What Diarization Does

```
Input audio:  ┌──────────────────────────────────────────────────────┐
              │ [SPKR_A]...[SPKR_B]...[SPKR_A]...[SPKR_B]...[SPKR_A]│
              └──────────────────────────────────────────────────────┘
Output:
  SPEAKER_00  0.0s – 4.2s  "Hello, this is Alice speaking."
  SPEAKER_01  4.5s – 8.1s  "Hi Alice, I'm Bob."
  SPEAKER_00  8.3s – 12.7s "Great to meet you, Bob."
```

---

## Diarization Error Rate (DER) Formula

$$\text{DER} = \frac{t_{\text{FA}} + t_{\text{MISS}} + t_{\text{ERROR}}}{t_{\text{TOTAL}}}$$

Where:

| Symbol | Description |
|--------|-------------|
| $t_{\text{FA}}$ | Duration of speech detected in non-speech |
| $t_{\text{MISS}}$ | Duration of speech missed (false negative) |
| $t_{\text{ERROR}}$ | Duration assigned to wrong speaker |
| $t_{\text{TOTAL}}$ | Total reference speech duration |

A perfect system has DER = 0%. Real-world systems achieve 5–15% DER on telephone speech and 10–25% DER on meeting data.

---

## Architecture: pyannote.audio Pipeline

```
Audio ─► VAD ─► Segmentation ─► Embedding ─► Clustering ─► Result
              (Speaker        (ECAPA-TDNN    (agglomerative  (speaker
               boundaries)   x-vectors)     HAC)           labels)
```

### Core Components

| Stage | Model | What it does |
|-------|-------|--------------|
| VAD | SileroVAD | Remove non-speech |
| Segmentation | PyanNet (LSTM) | Find speaker change points |
| Embedding | ECAPA-TDNN | 192-dim speaker vector per segment |
| Clustering | Agglomerative HAC | Group segments by speaker identity |

---

## Installation

```bash
pip install pyannote.audio
# Requires free HuggingFace account + model access token
# Visit: https://huggingface.co/pyannote/speaker-diarization-3.1
# Click "Agree" to model terms, then create HF_TOKEN
```

---

## Basic Diarization

```python
# basic_diarization.py
import torch
from pyannote.audio import Pipeline

# Load pipeline (requires HuggingFace token)
HF_TOKEN = "hf_XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"  # your token
pipeline = Pipeline.from_pretrained(
    "pyannote/speaker-diarization-3.1",
    use_auth_token=HF_TOKEN
)

# GPU acceleration (optional but recommended)
if torch.cuda.is_available():
    pipeline.to(torch.device("cuda"))

# Run diarization
diarization = pipeline("meeting.wav")

# Print speaker segments
for turn, _, speaker in diarization.itertracks(yield_label=True):
    print(f"{speaker:12s}  {turn.start:6.1f}s – {turn.end:6.1f}s")
```

---

## Specify Number of Speakers

If you know how many speakers are present, pass it to improve accuracy:

```python
# Exact number of speakers known
diarization = pipeline("meeting.wav", num_speakers=2)

# Or provide a range
diarization = pipeline("meeting.wav", min_speakers=2, max_speakers=5)
```

---

## Diarization + Transcription (WhisperX)

[WhisperX](https://github.com/m-bain/whisperX) combines faster-whisper with pyannote diarization to produce **word-level speaker-tagged transcripts**.

### Installation

```bash
pip install whisperx  # includes faster-whisper + pyannote integration
```

### Full Pipeline

```python
# whisperx_diarization.py
import whisperx
import gc
import torch

DEVICE = "cuda" if torch.cuda.is_available() else "cpu"
COMPUTE_TYPE = "float16" if DEVICE == "cuda" else "int8"
HF_TOKEN = "hf_XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"
AUDIO_FILE = "meeting.wav"

# Step 1: Transcribe with faster-whisper
model = whisperx.load_model("base.en", DEVICE, compute_type=COMPUTE_TYPE)
audio = whisperx.load_audio(AUDIO_FILE)
result = model.transcribe(audio, batch_size=16)
print("Before alignment:", result["segments"][:2])
gc.collect()
torch.cuda.empty_cache() if DEVICE == "cuda" else None

# Step 2: Word-level alignment (required before diarization)
model_align, metadata = whisperx.load_align_model(
    language_code=result["language"], device=DEVICE
)
result = whisperx.align(
    result["segments"], model_align, metadata, audio, DEVICE,
    return_char_alignments=False
)
print("After alignment:", result["segments"][:2])
gc.collect()
torch.cuda.empty_cache() if DEVICE == "cuda" else None

# Step 3: Assign speaker labels
diarize_model = whisperx.DiarizationPipeline(use_auth_token=HF_TOKEN, device=DEVICE)
diarize_segments = diarize_model(audio, min_speakers=1, max_speakers=5)
result = whisperx.assign_word_speakers(diarize_segments, result)

# Step 4: Print speaker-attributed transcript
for segment in result["segments"]:
    speaker = segment.get("speaker", "UNKNOWN")
    text = segment["text"].strip()
    start = segment["start"]
    end = segment["end"]
    print(f"[{speaker}] ({start:.1f}s–{end:.1f}s) {text}")
```

**Example output:**
```
[SPEAKER_00] (0.0s–4.2s) Hello, this is Alice speaking.
[SPEAKER_01] (4.5s–8.1s) Hi Alice, I'm Bob.
[SPEAKER_00] (8.3s–12.7s) Great to meet you, Bob.
```

---

## Manual Diarization + ASR Pipeline (without WhisperX)

```python
# manual_diarization_asr.py
from pyannote.audio import Pipeline
from faster_whisper import WhisperModel
import soundfile as sf
import numpy as np
import torch

# Load models
HF_TOKEN = "hf_XXXXXXXX"
diarize_pipeline = Pipeline.from_pretrained(
    "pyannote/speaker-diarization-3.1", use_auth_token=HF_TOKEN
)
asr_model = WhisperModel("base.en", device="cpu", compute_type="int8")

# Load audio
audio_path = "meeting.wav"
audio_data, sample_rate = sf.read(audio_path)
assert sample_rate == 16000, "Resample to 16kHz first"

# Diarize
diarization = diarize_pipeline(audio_path)

# Transcribe each speaker segment
results = []
for turn, _, speaker in diarization.itertracks(yield_label=True):
    start_sample = int(turn.start * sample_rate)
    end_sample = int(turn.end * sample_rate)
    segment_audio = audio_data[start_sample:end_sample].astype(np.float32)

    # Skip very short segments
    if len(segment_audio) < sample_rate * 0.3:  # less than 0.3s
        continue

    segments, _ = asr_model.transcribe(segment_audio, language="en")
    transcript = " ".join(s.text for s in segments).strip()

    if transcript:
        results.append({
            "speaker": speaker,
            "start": turn.start,
            "end": turn.end,
            "text": transcript,
        })

for r in results:
    print(f"[{r['speaker']}] {r['start']:.1f}s–{r['end']:.1f}s: {r['text']}")
```

---

## Export to Common Formats

### RTTM Format (standard diarization output)

```python
# Write RTTM file for evaluation with dscore/NIST tools
with open("output.rttm", "w") as f:
    for turn, _, speaker in diarization.itertracks(yield_label=True):
        f.write(
            f"SPEAKER {audio_path} 1 {turn.start:.3f} "
            f"{turn.duration:.3f} <NA> <NA> {speaker} <NA> <NA>\n"
        )
```

### SRT Subtitle Format

```python
def to_srt_time(seconds: float) -> str:
    h = int(seconds // 3600)
    m = int((seconds % 3600) // 60)
    s = int(seconds % 60)
    ms = int((seconds % 1) * 1000)
    return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"


with open("output.srt", "w") as f:
    for i, r in enumerate(results, 1):
        f.write(f"{i}\n")
        f.write(f"{to_srt_time(r['start'])} --> {to_srt_time(r['end'])}\n")
        f.write(f"[{r['speaker']}] {r['text']}\n\n")
```

---

## Evaluate DER

```bash
pip install pyannote.metrics
```

```python
from pyannote.metrics.diarization import DiarizationErrorRate
from pyannote.core import Annotation, Segment

# Reference (ground truth)
reference = Annotation()
reference[Segment(0.0, 4.2)] = "Alice"
reference[Segment(4.5, 8.1)] = "Bob"
reference[Segment(8.3, 12.7)] = "Alice"

# Hypothesis (your system output)
hypothesis = diarization  # pyannote Annotation object

metric = DiarizationErrorRate()
der = metric(reference, hypothesis)
print(f"DER: {der * 100:.1f}%")
```

---

## Tuning the Pipeline

```python
# Lower threshold → more speaker changes detected (higher recall, higher false alarm)
# Higher threshold → fewer changes (higher precision, higher miss rate)
# pyannote 3.x allows tuning segmentation threshold
pipeline = Pipeline.from_pretrained("pyannote/speaker-diarization-3.1", use_auth_token=HF_TOKEN)
pipeline._segmentation.threshold = 0.4  # default ~0.5
```

---

## Limitations

| Limitation | Workaround |
|------------|------------|
| Overlapping speech confuses diarization | Post-process: assign overlap to nearest-embedding speaker |
| DER spikes with >8 speakers | Use `max_speakers` to constrain clustering |
| HuggingFace token required | Use offline mode after initial download |
| CPU inference is slow on long files | Use chunked processing or GPU |
| Unknown number of speakers | Use `min_speakers=1, max_speakers=10` |

---

## See Also

- [Introduction to VAD](/kb/ai/vad/introduction/) — VAD is the first stage in the diarization pipeline
- [VAD Libraries Comparison](/kb/ai/vad/libraries-comparison/) — pyannote.audio VAD vs Silero VAD
- [ASR Integration Guide](/kb/ai/asr/integration/) — Full VAD+ASR+diarization pipeline patterns
- [ASR Fine-Tuning](/kb/ai/asr/fine-tuning/) — Improve transcription quality before diarization
- [ASR Algorithms & Theory](/kb/ai/asr/algorithms-theory/) — Speaker embeddings and CTC background
