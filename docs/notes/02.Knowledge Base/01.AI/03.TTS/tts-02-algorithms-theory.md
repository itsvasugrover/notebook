---
title: "TTS Algorithms & Theory"
createTime: 2026/03/21 14:01:00
permalink: /kb/ai/tts/algorithms-theory/
---

# TTS Algorithms & Theory

Understanding how modern neural TTS systems work — from raw text through phonemes, mel-spectrograms, vocoders, and all the way to a waveform — is essential for debugging quality issues, tuning inference, and building your own systems.

---

## TTS Pipeline Anatomy

```
Raw Text
    ↓ Text Normalization
    ↓ Grapheme-to-Phoneme (G2P)
Phoneme Sequence
    ↓ Acoustic Model
Mel-Spectrogram
    ↓ Vocoder
Waveform (PCM)
```

Each stage has specific failure modes and tuning knobs.

---

## Stage 1 — Text Normalization

Before phonemization, text must be normalized into speakable form:

| Input | Normalized |
|-------|-----------|
| `$14.99` | "fourteen dollars and ninety-nine cents" |
| `2026-03-21` | "March twenty-first, twenty twenty-six" |
| `Dr. Smith` | "Doctor Smith" |
| `GPU` | "G P U" (or "Graphics Processing Unit" with context) |
| `3.14` | "three point one four" |
| `1,000` | "one thousand" |

Libraries: `num2words`, `inflect`, custom regex pipelines. XTTS-v2 and Kokoro handle this internally via their text normalizers.

---

## Stage 2 — Grapheme-to-Phoneme (G2P)

Converts written characters to phonemes (IPA or ARPAbet symbols). Critical for correct pronunciation, especially:
- Heteronyms: "lead" /liːd/ vs /lɛd/, "read" /riːd/ vs /rɛd/
- Abbreviations, proper nouns, loan words

### ARPAbet (used by CMU Pronouncing Dictionary)
```
"hello" → HH AH0 L OW1
"world" → W ER1 L D
```

### IPA (International Phonetic Alphabet)
```
"hello" → həˈloʊ
"world" → wɜːld
```

### Tools

| Library | Approach | Languages |
|---------|----------|-----------|
| `phonemizer` (eSpeak backend) | Rule-based + dict | 100+ |
| `g2p-en` | Seq2seq model | English |
| `gruut` | Dictionary + neural fallback | 10+ |
| Kokoro built-in | `misaki` G2P library | EN, JA, ZH, FR, KO, PT |
| XTTS-v2 | Integrated per-language | 17 languages |

---

## Stage 3 — Acoustic Models

### Tacotron 2 (2018)

Seq2seq encoder-decoder with **location-sensitive attention**. Encodes phonemes to hidden states, then autoregressively decodes mel-spectrogram frames.

```
Encoder: CNN + BiLSTM → context vectors
Attention: location-sensitive (previous weights + conv features)
Decoder: LSTM → mel-spectrogram (2 frames per step)
Stop Token: sigmoid predicts end of utterance
Post-net: 5-layer CNN residual refinement of mel output
```

### Tacotron 2 Attention Formula

The location-sensitive attention mechanism attends over encoder states $h$ at step $t$:

$$e_{t,i} = w^\top \tanh\!\left(W_1 h_i + W_2 d_t + W_3 * \alpha_{t-1} + b\right)$$
$$\alpha_{t,i} = \frac{\exp(e_{t,i})}{\sum_j \exp(e_{t,j})}$$

where $d_t$ is the decoder state, $\alpha_{t-1}$ is the previous attention weight vector, and $*$ denotes convolution. The convolution over previous attention weights provides "where to look next" — preventing the common Tacotron failure mode of getting stuck.

**Weakness**: Attention failures cause repeated words, skipped syllables, or early cutoff. Slow — autoregressive (sequential).

---

### FastSpeech 2 (2020)

**Non-autoregressive** (fully parallel). Uses a duration predictor to expand phoneme hidden states to match the target mel length, then generates all frames in parallel.

```
Encoder: Transformer (phonemes → hidden)
    ↓
Duration Predictor → length regulator (repeat each phoneme hidden state)
Pitch Predictor   → add pitch contour (F0)
Energy Predictor  → add energy contour
    ↓
Decoder: Transformer (parallel) → mel-spectrogram
```

**Advantage**: 30–50× faster than Tacotron 2. No attention collapse. Explicit control of duration, pitch, energy.

$$\mathcal{L} = \mathcal{L}_{mel} + \lambda_d \mathcal{L}_{dur} + \lambda_p \mathcal{L}_{pitch} + \lambda_e \mathcal{L}_{energy}$$

---

### VITS (2021) — Variational Inference with adversarial learning for TTS

End-to-end model — no separate vocoder. Combines:
- **VAE**: latent variable $z$ captures prosody/style
- **Normalizing flow**: $f: z \rightarrow mel$, invertible for training
- **HiFi-GAN discriminators**: adversarial training for waveform realism

```
Training:
  Text encoder → μ, σ (prior)
  Audio encoder → posterior q(z|x)
  KL divergence: align prior and posterior
  Flow: z → mel → waveform via HiFi-GAN generator
  Discriminators: multi-period + multi-scale waveform discrimination

Inference:
  Text encoder → prior → sample z → flow → waveform
```

$$\mathcal{L}_{VITS} = \mathcal{L}_{recon} + \mathcal{L}_{KL} + \mathcal{L}_{adv} + \mathcal{L}_{fm}$$

VITS is the backbone of Coqui TTS, MeloTTS, and OpenVoice.

---

## Stage 4 — Vocoders

Converts mel-spectrograms to waveforms. The vocoder determines audio quality more than the acoustic model in many cases.

### WaveNet (2016)
Autoregressive dilated causal convolutions. Excellent quality, extremely slow (slower than real-time on CPU).

### WaveGlow (2018)
Normalizing flow-based. Parallel inference. Faster but large model.

### HiFi-GAN (2020) — Current Standard
GAN-based. Generator: transposed convolutions with multi-receptive field fusion (MRF). Discriminators: multi-period (MPD) + multi-scale (MSD).

```
Generator: Conv → [TransposedConv → MRF] × 4 → Conv → Tanh
MRF: parallel dilated convolutions at different dilation rates
MPD: discriminate at periods {2, 3, 5, 7, 11}
MSD: discriminate at scales {1×, 2×, 4×}
```

**HiFi-GAN Training Losses:**

$$\mathcal{L}_{G} = \mathcal{L}_{adv}(G) + \lambda_{fm} \mathcal{L}_{fm}(G) + \lambda_{mel} \mathcal{L}_{mel}(G)$$

- **Adversarial loss** (least-squares GAN):
$$\mathcal{L}_{adv}(G) = \mathbb{E}_{z}\left[(D(G(z)) - 1)^2\right]$$
$$\mathcal{L}_{adv}(D) = \mathbb{E}_{(x,z)}\left[(D(x)-1)^2 + (D(G(z)))^2\right]$$

- **Feature matching loss** (intermediate discriminator layer L1):
$$\mathcal{L}_{fm}(G) = \mathbb{E}_{(x,z)}\left[\sum_{i=1}^{T}\frac{1}{N_i}\left\|D^i(x) - D^i(G(z))\right\|_1\right]$$

- **Mel-spectrogram reconstruction loss**:
$$\mathcal{L}_{mel}(G) = \mathbb{E}_{(x,z)}\left[\left\|\phi(x) - \phi(G(z))\right\|_1\right]$$

where $\phi(\cdot)$ computes the log-mel spectrogram.

RTF < 0.01 on CPU for V1 (smaller model). **Default vocoder in FastSpeech 2, Kokoro, StyleTTS2.**

### BigVGAN (2022)
HiFi-GAN with anti-aliased multiperiodic composites. Better generalization to unseen speakers.

---


## Neural Audio Codecs (EnCodec / DAC)

Used by codec-LM TTS (Bark, XTTS-v2, VoiceCraft). Compress audio into discrete token streams at multiple bitrate levels.

```
Audio waveform
    ↓ Encoder (strided convolutions)
    ↓ Residual Vector Quantization (RVQ)
       Level 1: coarse tokens  (semantics, prosody)
       Level 2: fine tokens    (timbre)
       Level 3-8: detail tokens (waveform fidelity)
    ↓ Decoder (mirrored architecture)
Reconstructed waveform
```

At 24kHz, EnCodec at 1.5kbps uses 8 codebooks × 75 tokens/second = 600 tokens/s. Generating 1 second of speech requires generating ~600 tokens autoregressively — hence Bark's slowness.

---

## Flow Matching (F5-TTS / E2-TTS)

Flow matching is a continuous normalizing flow trained with a simpler, more stable loss than diffusion. Instead of predicting noise, it predicts the **velocity field** that transports a noise distribution to the data distribution.

```
During training:
  x₀ ~ noise, x₁ ~ data (mel-spectrogram)
  xₜ = (1-t)x₀ + tx₁           (straight-path interpolation)
  vθ(xₜ, t, condition) ≈ x₁ - x₀   (model learns velocity)

During inference:
  Start from x₀ ~ N(0,I)
  Integrate ODE: dx/dt = vθ(xₜ, t, text)
  Arrive at x₁ = mel-spectrogram
```

F5-TTS adds a **flat-start** process (no separate text encoder — text tokens are directly injected at positions matching aligned audio tokens). Voice cloning is achieved by providing a reference spectrogram as conditioning.

**Advantage over diffusion**: Straight trajectory → fewer solver steps → faster inference than DDPM while matching quality.

---

## Speaker Embeddings & Voice Cloning

### Speaker Embedding (Fixed Voices)
A fixed vector $\mathbf{e}_s \in \mathbb{R}^{256}$ extracted from a speaker encoder (e.g., d-vector, x-vector, ECAPA-TDNN) is injected into the acoustic model as a conditioning signal. The model learns to match the voice of that speaker.

### Zero-Shot Voice Cloning
The speaker encoder takes a **reference audio clip** (3–10s) at inference time and produces an embedding that conditions the model on an unseen voice.

```
Reference audio (3s of target voice)
    ↓ Speaker Encoder (ECAPA-TDNN or d-vector network)
Speaker embedding vector ∈ ℝ²⁵⁶
    ↓ Injected into acoustic model (adds to decoder hidden states)
Model generates speech in target voice
```

Used by XTTS-v2, F5-TTS, OpenVoice V2.

### Tone Color Transfer (OpenVoice V2)
Decouples **base tone** (speaker timbre, accent) from **style** (speed, pitch, emotion). A converter network applies a source voice's tone color to any target voice's content, enabling flexible cross-speaker style mixing.

---

## Prosody Modeling

Prosody covers rhythm, stress, intonation, and pacing — the part that makes speech sound human rather than robotic.

| Feature | What controls it | Model component |
|---------|-----------------|----------------|
| Pitch (F0) | Intonation, questions, emotion | Pitch predictor (FastSpeech 2), VAE latent (VITS) |
| Duration | Syllable timing, speech rate | Duration predictor, length regulator |
| Energy | Loudness, stress | Energy predictor |
| Pause | Sentence breaks | Silence tokens, punctuation rules |

Modern end-to-end models (VITS, F5-TTS) learn prosody implicitly from data rather than explicit labels.

---

## Diffusion-Based TTS (GradTTS / DiffSpeech)

Before flow matching (F5-TTS), **diffusion models** (DDPM-based) were the state-of-the-art for high-quality neural TTS. Understanding them is important because many open-source tools (DiffSpeech, Grad-TTS, NaturalSpeech 2) still use this approach.

### Forward and Reverse Process

Diffusion models define a forward noising process that gradually destroys the data (mel-spectrogram $x_0$) by adding Gaussian noise:

$$q(x_t | x_{t-1}) = \mathcal{N}(x_t;\, \sqrt{1-\beta_t}\, x_{t-1},\, \beta_t I)$$

Over $T$ steps (typically $T = 1000$), $x_T \approx \mathcal{N}(0, I)$. The model learns the **reverse process** — denoising step by step:

$$p_\theta(x_{t-1} | x_t, \text{text}) = \mathcal{N}(x_{t-1};\, \mu_\theta(x_t, t, \text{text}),\, \Sigma_\theta)$$

### Training Objective (simplified DDPM)

Instead of predicting $x_{t-1}$ directly, the model predicts the noise $\epsilon$ that was added:

$$\mathcal{L}_{\text{DDPM}} = \mathbb{E}_{x_0, t, \epsilon}\left[\|\epsilon - \epsilon_\theta(x_t, t, \text{text})\|^2\right]$$

where $x_t = \sqrt{\bar{\alpha}_t}\, x_0 + \sqrt{1 - \bar{\alpha}_t}\, \epsilon$ and $\bar{\alpha}_t = \prod_{s=1}^{t}(1 - \beta_s)$.

### GradTTS Architecture

```
Text phonemes
    ↓ Text encoder (Transformer)
Prior μ_enc, σ_enc              ← used as the "clean" signal for diffusion
    ↓  Forward process: add noise → x_T
    ↓  Reverse (U-Net score estimator conditioned on text encoder output):
    x_{T} → x_{T-1} → ... → x_0 = mel-spectrogram
    ↓  HiFi-GAN vocoder
Waveform
```

**Key difference from VITS:** GradTTS uses diffusion in the mel-spectrogram space (not waveform). It achieves higher quality than VITS in perceptual tests but is 10–50× slower at inference due to the many denoising steps.

### Accelerated Sampling

Practical diffusion TTS uses far fewer than 1000 steps:

| Sampler | Steps | Speed | Quality |
|---------|-------|-------|---------|
| DDPM (original) | 1000 | Slow | Best |
| DDIM | 50–100 | 10× faster | Very good |
| DPM-Solver | 10–20 | 50× faster | Good |
| Flow matching (F5-TTS) | 16–32 NFE | Fast | Best-in-class |

Flow matching (covered above) supersedes diffusion for TTS precisely because it achieves similar or better quality with straight trajectories and far fewer solver steps.

---

## Multi-Speaker Training Theory

Multi-speaker TTS extends single-speaker models to produce speech in many different voices from a single model.

### Speaker Embedding Injection

A speaker embedding $\mathbf{e}_s \in \mathbb{R}^d$ (typically $d = 256$) is injected into the acoustic model as a conditioning signal. The embedding can come from:

1. **Lookup table** (closed-set): $\mathbf{e}_s = E[s]$ where $E \in \mathbb{R}^{N \times d}$ is a learned embedding matrix for $N$ known speakers.
2. **Speaker encoder** (open-set): $\mathbf{e}_s = f_\phi(\text{ref audio})$ — run a trained encoder on a reference clip to get the embedding of an **unseen** speaker at inference time.

The embedding is injected at the decoder input:

$$\hat{h}_i = h_i + W_s \mathbf{e}_s, \quad W_s \in \mathbb{R}^{d_{\text{hidden}} \times d}$$

This conditions every decoder step on the speaker without modifying the phoneme encoder.

### Speaker Encoder Architectures

| Architecture | Output dim | Key Feature |
|-------------|-----------|-------------|
| d-vector (GE2E) | 256 | Generalized End-to-End loss; trained to separate speakers |
| x-vector (TDNN) | 512 | Time-delay neural network; standard in speaker verification |
| ECAPA-TDNN | 192 | Squeeze-excitation + channel-attention; state-of-the-art |

**Generalized End-to-End (GE2E) Loss** for training the speaker encoder:

$$\mathcal{L}_{\text{GE2E}} = -\frac{1}{NM}\sum_{i,j} \log \frac{e^{w \cos(\mathbf{e}_{ij}, \mathbf{c}_i) + b}}{\sum_{k=1}^{N} e^{w \cos(\mathbf{e}_{ij}, \mathbf{c}_k) + b}}$$

where $\mathbf{e}_{ij}$ is the $j$-th utterance embedding of speaker $i$, $\mathbf{c}_i$ is the centroid of speaker $i$'s embeddings, and $w, b$ are learnable scalar parameters. The loss pulls utterances of the same speaker toward each other and pushes different speakers apart — producing a speaker space where nearby vectors sound similar.

### Adapter Layers (Low-Data Fine-Tuning)

Rather than training a large multi-speaker model, **adapter layers** add a small number of trainable parameters to a frozen backbone:

```python
import torch.nn as nn

class SpeakerAdapter(nn.Module):
    """
    Lightweight bottleneck adapter for each speaker.
    Inserted after each Transformer block in the decoder.
    """
    def __init__(self, hidden_dim: int, bottleneck: int = 64):
        super().__init__()
        self.down = nn.Linear(hidden_dim, bottleneck)
        self.act  = nn.ReLU()
        self.up   = nn.Linear(bottleneck, hidden_dim)
        nn.init.zeros_(self.up.weight)
        nn.init.zeros_(self.up.bias)
    
    def forward(self, x):
        return x + self.up(self.act(self.down(x)))  # residual connection
```

At training, the backbone is frozen and only adapters are trained — requiring as little as 15 minutes of speech per new speaker.

---

## TTS Evaluation Metrics

### Mean Opinion Score (MOS)

Human listeners rate speech naturalness on a 1–5 scale:

| Score | Description |
|-------|-------------|
| 5 | Excellent — indistinguishable from natural speech |
| 4 | Good — natural with minor flaws |
| 3 | Fair — noticeable artifacts, acceptable |
| 2 | Poor — unnatural, difficult to understand |
| 1 | Bad — completely unnatural |

**Automated MOS (UTMOS, MOSNet):** predict MOS without human listeners using a neural regression model trained on human ratings.

### MUSHRA (MUltiple Stimuli with Hidden Reference and Anchor)

ITU-R BS.1534 standard. Listeners hear several systems + a hidden reference simultaneously and rate each on 0–100. Anchors (degraded references) establish a lower bound. MUSHRA is more sensitive than MOS for differentiating systems that are already near human quality.

### Objective Metrics

| Metric | What it measures |
|--------|-----------------|
| **MCD** (Mel Cepstral Distortion) | Spectral distance between generated and reference mel-cepstrum |
| **F0 RMSE** | Pitch accuracy vs. reference speaker |
| **RTF** (Real-Time Factor) | synthesis\_time / audio\_duration — must be < 1.0 for real-time |
| **Round-trip WER** | Run ASR on TTS output; compare text to original. Low WER = high intelligibility |

$$\text{MCD} = \frac{10\sqrt{2}}{\ln 10} \sqrt{\sum_{k=1}^{K} (c_k - \hat{c}_k)^2}$$

where $c_k$ and $\hat{c}_k$ are the $k$-th MFCC coefficients of the reference and generated speech.

---

## See Also

- [TTS Libraries Comparison](/kb/ai/tts/libraries-comparison/)
- [TTS Implementation](/kb/ai/tts/implementation/)
- [TTS Training from Scratch](/kb/ai/tts/training-from-scratch/) — HiFi-GAN training losses, multi-speaker setup, UTMOS evaluation code
- [ASR Algorithms & Theory](/kb/ai/asr/algorithms-theory/) — Mel-spectrograms, BPE tokenization, and acoustic representations are used by both TTS (to generate) and ASR (to recognize) speech
- [VAD Algorithms & Theory](/kb/ai/vad/algorithms-theory/) — Pitch (F0), energy, and spectral features in TTS prosody modeling are the same acoustic cues VAD uses for speech/non-speech classification
