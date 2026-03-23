---
title: "Training TTS from Scratch"
createTime: 2026/03/21 14:09:00
permalink: /kb/ai/tts/training-from-scratch/
---

# Training TTS from Scratch

Training a neural TTS system from the ground up — covering dataset preparation, acoustic model training (FastSpeech 2), vocoder training (HiFi-GAN), evaluation metrics, and multi-speaker extensions.

---

## When to Train from Scratch

| Scenario | Recommendation |
|----------|----------------|
| Existing voice cloning quality is insufficient | Fine-tune XTTS-v2 or F5-TTS instead |
| New language with no pretrained model | Train from scratch — requires 20–50h of speech data |
| Proprietary voice (brand character, IVR system) | Train from scratch for full IP ownership |
| Research: new architecture or vocoder | Train from scratch to control every component |
| Custom prosody/emotion style | Fine-tune StyleTTS2 or VITS with your data |

---

## Data Requirements

| Quality Level | Hours Required | Notes |
|--------------|---------------|-------|
| Minimum viable | 5–10h | Intelligible but robotic prosody |
| Good quality | 20–30h | Natural-sounding with clean data |
| Production quality | 50–100h | Broadcast quality, expressive |
| Multi-speaker model | 5–20h per speaker × N speakers | Same recording quality per speaker |

### Recording Requirements

- **Sample rate**: 22050 Hz or 24000 Hz, mono, 16-bit or 32-bit float WAV
- **Environment**: studio-quality booth or treated room (RT60 < 200ms)
- **Noise floor**: SNR > 40 dB (measure with RMS of silence vs. speech)
- **Microphone**: condenser mic with flat frequency response
- **Content**: phonetically balanced sentences — use the CMU Arctic script, LJSpeech prompts, or a custom script covering all phoneme contexts
- **Consistency**: same mic, same room, same speaker, no audible room changes
- Do **not** mix clean and reverberant recordings in the same dataset

---

## Dataset Preparation Pipeline

### Step 1: Audio Pre-processing

```python
# preprocess_audio.py
import subprocess
import os
from pathlib import Path
import soundfile as sf
import numpy as np

TARGET_SR = 22050  # standard for FastSpeech 2 / HiFi-GAN training

def preprocess_file(src: str, dst: str, sr: int = TARGET_SR):
    """Normalize, resample, trim silence, save WAV."""
    # Resample + convert to mono using ffmpeg
    subprocess.run([
        "ffmpeg", "-y",
        "-i", src,
        "-ac", "1",         # mono
        "-ar", str(sr),     # resample
        "-sample_fmt", "s16",
        dst,
    ], check=True, capture_output=True)

    audio, _ = sf.read(dst, dtype="float32")

    # Peak normalize to -3 dBFS
    peak = np.abs(audio).max()
    if peak > 0:
        audio = audio / peak * 0.7079  # 10^(-3/20)

    # Trim leading/trailing silence (threshold = -40 dBFS)
    threshold = 10 ** (-40 / 20)
    nonsilent = np.where(np.abs(audio) > threshold)[0]
    if len(nonsilent) > 0:
        audio = audio[nonsilent[0]:nonsilent[-1] + 1]

    sf.write(dst, audio, sr, subtype="PCM_16")
    return len(audio) / sr


def process_directory(src_dir: str, dst_dir: str):
    Path(dst_dir).mkdir(parents=True, exist_ok=True)
    for fn in sorted(Path(src_dir).glob("*.wav")):
        out = os.path.join(dst_dir, fn.name)
        dur = preprocess_file(str(fn), out)
        print(f"{fn.name}: {dur:.2f}s")
```

### Step 2: Transcript Alignment Check

Before training, validate that each audio file matches its transcript:

```python
# check_alignment.py
from faster_whisper import WhisperModel
from jiwer import wer
import soundfile as sf
import csv

model = WhisperModel("base.en", device="cpu", compute_type="int8")

def check_transcript(audio_path: str, expected_text: str) -> float:
    """Run ASR on audio, compare to expected transcript. Returns WER."""
    audio, sr = sf.read(audio_path, dtype="float32")
    segments, _ = model.transcribe(audio, language="en", beam_size=5)
    asr_text = " ".join(s.text for s in segments).strip().lower()
    ref = expected_text.lower()
    error = wer(ref, asr_text)
    return error, asr_text


# Filter out files with WER > 10%
bad_files = []
with open("metadata.csv") as f:
    reader = csv.reader(f, delimiter="|")
    for row in reader:
        filename, text = row[0], row[1]
        err, pred = check_transcript(f"wavs/{filename}.wav", text)
        if err > 0.10:
            bad_files.append((filename, err, text, pred))

print(f"Bad files: {len(bad_files)}")
for fn, e, ref, hyp in bad_files[:10]:
    print(f"  {fn}: WER={e:.2f}\n    REF: {ref}\n    HYP: {hyp}")
```

### Step 3: Metadata Format (LJSpeech Style)

```
# metadata.csv — pipe-separated
LJ001-0001|Printing, in the only sense with which we are at present concerned
LJ001-0002|differs from most if not from all the arts and crafts represented in the Exhibition
LJ001-0003|in being comparatively modern.
```

---

## FastSpeech 2 Training (Coqui TTS / ESPnet)

### Using Coqui TTS Trainer

```bash
# Install
pip install TTS

# Create recipe directory
mkdir -p recipes/my_tts
cd recipes/my_tts
```

```python
# train_fastspeech2.py
from TTS.tts.configs.fastspeech2_config import Fastspeech2Config
from TTS.tts.models.forward_tts import ForwardTTS
from TTS.utils.audio import AudioProcessor
from TTS.trainer import Trainer, TrainerArgs
from dataclasses import dataclass, field

config = Fastspeech2Config(
    run_name="my_tts_fastspeech2",
    batch_size=32,
    eval_batch_size=16,
    num_loader_workers=4,
    num_eval_loader_workers=4,
    run_eval=True,
    test_delay_epochs=-1,
    epochs=1000,
    text_cleaner="phoneme_cleaners",
    use_phonemes=True,
    phoneme_language="en-us",
    phoneme_cache_path="phoneme_cache",
    precompute_num_workers=4,
    print_step=50,
    print_eval=True,
    mixed_precision=True,
    output_path="output/my_tts/",
    datasets=[
        {
            "formatter": "ljspeech",
            "meta_file_train": "metadata.csv",
            "path": "./",
            "ignored_speakers": None,
            "language": "en",
        }
    ],
    # Vocoder: use a pre-trained HiFi-GAN
    use_speaker_embedding=False,
    # Training schedule
    lr_scheduler="NoamLR",
    lr_scheduler_params={"warmup_steps": 4000},
    lr=0.001,
)

ap = AudioProcessor.init_from_config(config)
model = ForwardTTS.init_from_config(config)

trainer = Trainer(
    TrainerArgs(),
    config,
    output_path=config.output_path,
    model=model,
    train_samples=model.get_data_samples(config, ap=ap, is_eval=False),
    eval_samples=model.get_data_samples(config, ap=ap, is_eval=True),
)
trainer.fit()
```

---

## HiFi-GAN Vocoder Training

The vocoder converts mel-spectrograms from the acoustic model to waveforms. Train on mel-spectrogram / raw audio pairs extracted from your own dataset for best voice match.

### Architecture Summary

```
Generator:
  Input:  mel-spectrogram (80 × T)
  ↓  Conv(7,1) [upsample stem]
  ↓  [TransposedConv → MRF] × 4   (upsample factors: 8,8,2,2 → total 256×)
  ↓  Conv(7,1) → Tanh
  Output: waveform samples

Multi-Period Discriminator (MPD):
  5 sub-discriminators on reshaped audio at periods {2, 3, 5, 7, 11}
  Each: Conv2d layers on (T/p, p) shaped input → real/fake score

Multi-Scale Discriminator (MSD):
  3 sub-discriminators at average-pooled scales {1×, 2×, 4×}
  Each: Strided Conv1d layers → real/fake score
```

### Training Losses in Detail

**Generator total loss:**

$$\mathcal{L}_G = \mathcal{L}_{\text{adv}}(G) + \lambda_{\text{fm}} \mathcal{L}_{\text{fm}}(G) + \lambda_{\text{mel}} \mathcal{L}_{\text{mel}}(G)$$

**Adversarial (LS-GAN):**

$$\mathcal{L}_{\text{adv}}(G) = \mathbb{E}_z\left[(D(G(z)) - 1)^2\right]$$

**Feature matching** (stabilizes training, acts as perceptual loss):

$$\mathcal{L}_{\text{fm}}(G) = \mathbb{E}_{(x,z)}\left[\sum_{i=1}^{T}\frac{1}{N_i}\|D^i(x) - D^i(G(z))\|_1\right]$$

**Mel-spectrogram reconstruction** (frequency-domain L1):

$$\mathcal{L}_{\text{mel}}(G) = \mathbb{E}_{(x,z)}\left[\|\phi(x) - \phi(G(z))\|_1\right]$$

where $\phi(\cdot)$ computes the 80-bin log-mel spectrogram.

### Training Script (Minimal HiFi-GAN)

```python
# train_hifigan.py
# Based on https://github.com/jik876/hifi-gan
# Install: pip install torch torchaudio librosa soundfile

import torch
import torch.nn.functional as F
from torch.utils.data import DataLoader
from torch.optim import AdamW
from torch.optim.lr_scheduler import ExponentialLR

# Assumes: generator, mpd, msd, train_dataset defined
# (see official repo for full model definitions)

optim_g = AdamW(generator.parameters(), lr=2e-4, betas=(0.8, 0.99))
optim_d = AdamW(list(mpd.parameters()) + list(msd.parameters()),
                lr=2e-4, betas=(0.8, 0.99))
sched_g = ExponentialLR(optim_g, gamma=0.999)
sched_d = ExponentialLR(optim_d, gamma=0.999)

for epoch in range(num_epochs):
    for batch in dataloader:
        mel, audio = batch["mel"].cuda(), batch["audio"].cuda()
        audio = audio.unsqueeze(1)

        # ── Train Discriminators ──────────────────────────────────────
        audio_gen = generator(mel)
        optim_d.zero_grad()

        # MPD loss
        real_mpd, fake_mpd, _, _ = mpd(audio, audio_gen.detach())
        loss_d_mpd = sum(
            F.mse_loss(r, torch.ones_like(r)) + F.mse_loss(f, torch.zeros_like(f))
            for r, f in zip(real_mpd, fake_mpd)
        )
        # MSD loss
        real_msd, fake_msd, _, _ = msd(audio, audio_gen.detach())
        loss_d_msd = sum(
            F.mse_loss(r, torch.ones_like(r)) + F.mse_loss(f, torch.zeros_like(f))
            for r, f in zip(real_msd, fake_msd)
        )
        loss_d = loss_d_mpd + loss_d_msd
        loss_d.backward()
        optim_d.step()

        # ── Train Generator ───────────────────────────────────────────
        optim_g.zero_grad()
        audio_gen = generator(mel)

        # Mel reconstruction loss
        mel_gen = mel_transform(audio_gen.squeeze(1))
        loss_mel = F.l1_loss(mel, mel_gen) * 45.0

        # Adversarial + feature matching
        _, fake_mpd, fmap_r_mpd, fmap_g_mpd = mpd(audio, audio_gen)
        _, fake_msd, fmap_r_msd, fmap_g_msd = msd(audio, audio_gen)

        loss_adv = sum(F.mse_loss(f, torch.ones_like(f))
                       for f in fake_mpd + fake_msd)
        loss_fm = sum(
            F.l1_loss(r, g)
            for pairs in [zip(fmap_r_mpd, fmap_g_mpd), zip(fmap_r_msd, fmap_g_msd)]
            for r, g in pairs
        ) * 2.0

        loss_g = loss_adv + loss_fm + loss_mel
        loss_g.backward()
        optim_g.step()

    sched_g.step()
    sched_d.step()
    print(f"Epoch {epoch}: G={loss_g.item():.4f} D={loss_d.item():.4f}")
```

---

## Multi-Speaker Training

### Architecture Options

| Approach | Description | Best For |
|----------|-------------|----------|
| **Speaker ID embedding table** | Fixed $N$-speaker lookup table $E \in \mathbb{R}^{N \times d}$ | Closed-set known speakers |
| **Speaker encoder (d-vector / x-vector)** | Extracts embedding from reference audio at inference | Zero-shot unseen speakers |
| **VITS with flow conditioning** | Speaker embedding injected into normalizing flow | End-to-end multi-speaker |
| **Adapter layers** | Lightweight per-speaker adapters on frozen backbone | Low-data fine-tuning per speaker |

### Speaker Embedding Injection

In FastSpeech 2 or VITS, the speaker embedding $\mathbf{e}_s \in \mathbb{R}^{256}$ is added to the encoder output before the decoder:

$$\hat{h}_i = h_i + W_s \mathbf{e}_s$$

where $h_i$ are phoneme hidden states and $W_s$ is a learned linear projection. This conditions every decoder step on the speaker identity without changing the text encoder.

```python
# Multi-speaker dataset — metadata format
# LJ001-0001|speaker_0|Printing in the only sense
# LJ001-0002|speaker_1|differs from most of the arts

# Speaker embedding table (inside model)
import torch.nn as nn
speaker_embedding = nn.Embedding(num_speakers, speaker_emb_dim)

def forward(self, phoneme_ids, speaker_ids):
    h = self.encoder(phoneme_ids)
    spk_emb = self.speaker_embedding(speaker_ids)  # (B, emb_dim)
    h = h + self.speaker_proj(spk_emb).unsqueeze(1)  # broadcast over time
    mel = self.decoder(h)
    return mel
```

---

## Evaluation Metrics

### Mean Opinion Score (MOS)

MOS is the gold standard for TTS quality. Human listeners rate speech on a 1–5 scale:

| Score | Description |
|-------|-------------|
| 5 | Excellent — indistinguishable from human |
| 4 | Good — natural, minor imperfections |
| 3 | Fair — noticeable artifacts but acceptable |
| 2 | Poor — often difficult to understand |
| 1 | Bad — completely unnatural |

MOS is expensive (requires human listeners). Automated MOS prediction: **UTMOS**, **MOSNet**, **DNSMOS**.

### Automatic MOS Prediction (UTMOS)

```bash
pip install utmos
```

```python
from utmos import UTMOSScore
import soundfile as sf
import numpy as np

scorer = UTMOSScore(device="cpu")

def predict_mos(wav_path: str) -> float:
    audio, sr = sf.read(wav_path, dtype="float32")
    if sr != 16000:
        import librosa
        audio = librosa.resample(audio, orig_sr=sr, target_sr=16000)
    score = scorer.score(audio)
    return float(score)

scores = [predict_mos(f"samples/sample_{i}.wav") for i in range(10)]
print(f"Mean predicted MOS: {np.mean(scores):.3f} ± {np.std(scores):.3f}")
```

### MUSHRA (MUltiple Stimuli with Hidden Reference and Anchor)

MUSHRA is an ITU-R BS.1534 standard for subjective audio evaluation. Unlike MOS (single stimulus), MUSHRA presents several systems simultaneously and asks listeners to rate each relative to a hidden reference:

```
Reference (hidden) : ████████████████████  100
System A           : █████████████████     85
System B           : ████████████          62
Anchor (degraded)  : ████                  23
```

MUSHRA is better than MOS for comparing multiple TTS systems because it controls for listener bias through the shared reference.

### Objective Metrics

| Metric | Formula | What it measures |
|--------|---------|-----------------|
| **MCD** (Mel Cepstral Distortion) | $\frac{10\sqrt{2}}{\ln 10}\sum_k (c_k - \hat{c}_k)^2$ | Spectral distance from reference |
| **F0 RMSE** | $\sqrt{\frac{1}{T}\sum (f_t - \hat{f}_t)^2}$ | Pitch accuracy |
| **RTF** (Real-Time Factor) | synthesis time / audio duration | Speed |
| **WER (round-trip)** | ASR WER on TTS output vs. original text | Intelligibility proxy |

```python
import numpy as np
import librosa


def mel_cepstral_distortion(ref_audio: np.ndarray,
                              gen_audio: np.ndarray,
                              sr: int = 22050) -> float:
    """Compute MCD between reference and generated audio."""
    mfcc_ref = librosa.feature.mfcc(y=ref_audio, sr=sr, n_mfcc=13)[1:]  # skip C0
    mfcc_gen = librosa.feature.mfcc(y=gen_audio, sr=sr, n_mfcc=13)[1:]

    # Align lengths
    min_len = min(mfcc_ref.shape[1], mfcc_gen.shape[1])
    diff = mfcc_ref[:, :min_len] - mfcc_gen[:, :min_len]

    mcd = (10 * np.sqrt(2) / np.log(10)) * np.mean(np.sqrt(np.sum(diff ** 2, axis=0)))
    return mcd


def round_trip_wer(text: str, audio: np.ndarray, asr_model) -> float:
    """Synthesize text, transcribe output, compute WER."""
    from jiwer import wer
    segments, _ = asr_model.transcribe(audio, language="en")
    hyp = " ".join(s.text for s in segments).strip().lower()
    return wer(text.lower(), hyp)
```

---

## Training Checklist

```
Data preparation:
  ☐ Audio resampled to 22050/24000 Hz, mono
  ☐ Silence trimmed, volume normalized to -3 dBFS
  ☐ Transcripts verified with ASR (< 10% WER threshold)
  ☐ metadata.csv formatted (pipe-separated: filename|text)
  ☐ Phoneme cache pre-computed

Acoustic model:
  ☐ Duration extraction done (MFA alignment or learned)
  ☐ Pitch (F0) extracted per utterance
  ☐ Energy extracted per utterance
  ☐ Batch size fits in GPU memory
  ☐ Learning rate warm-up configured
  ☐ Checkpoint saving every 1000 steps

Vocoder:
  ☐ Mel-spectrogram parameters match acoustic model
  ☐ HiFi-GAN fine-tuned on YOUR data (not just LJSpeech)
  ☐ Discriminators loaded with matching architecture

Evaluation:
  ☐ RTF < 0.1 on target hardware
  ☐ Round-trip WER < 5%
  ☐ MCD < 8 dB vs. ground truth
  ☐ Human listening test (informal MOS) conducted
```

---

## Common Failures and Fixes

| Problem | Likely Cause | Fix |
|---------|-------------|-----|
| Robotic, monotone output | Insufficient data or poor prosody labels | Increase data; use speaker with expressive range |
| Skipped/repeated words | Attention failure (Tacotron 2) | Switch to FastSpeech 2 (duration-based) |
| Buzzy/metallic artifacts | Vocoder mismatch | Fine-tune HiFi-GAN on your mel parameters |
| Training loss spikes | LR too high | Reduce learning rate; add gradient clipping |
| Out of memory | Batch size too large | Reduce batch_size; enable gradient checkpointing |
| Poor silence handling | No silence padding in data | Add 0.1–0.3s silence at utterance boundaries |

---

## See Also

- [TTS Algorithms & Theory](/kb/ai/tts/algorithms-theory/) — FastSpeech 2 architecture, HiFi-GAN loss formulas, VITS theory
- [TTS Libraries Comparison](/kb/ai/tts/libraries-comparison/) — Pre-trained models you can fine-tune instead of training from scratch
- [TTS Implementation](/kb/ai/tts/implementation/) — Inference with trained models
- [ASR Fine-Tuning](/kb/ai/asr/fine-tuning/) — Round-trip TTS→ASR evaluation uses the same ASR fine-tuning pipeline
- [VAD Implementation](/kb/ai/vad/implementation/) — Use VAD to auto-segment long studio recordings into training clips
