---
title: "ASR Algorithms & Theory"
createTime: 2026/03/21 13:01:00
permalink: /kb/ai/asr/algorithms-theory/
---

# ASR Algorithms & Theory

How modern ASR systems work under the hood — from raw audio to text tokens. Understanding the theory helps you choose the right model, tune for accuracy, and debug when transcription goes wrong.

---

## Audio Feature Extraction

Before any model sees the audio, it is converted into a 2D feature representation.

### From Waveform to Log-Mel Spectrogram

```
Raw audio (waveform)
        │
        ▼  Short-Time Fourier Transform (STFT)
Spectrogram (frequency × time)
        │
        ▼  Mel filterbank (compress to human auditory scale)
Mel Spectrogram
        │
        ▼  log()
Log-Mel Spectrogram  ← what the neural network sees
```

**Key parameters:**

| Parameter | Whisper Default | Meaning |
|-----------|----------------|---------|
| Sample rate | 16,000 Hz | Audio sampling frequency |
| Window size (n_fft) | 400 samples (25ms) | FFT window length |
| Hop length | 160 samples (10ms) | Step between windows |
| Mel bins (n_mels) | 80 | Number of Mel filterbank channels |
| Max audio | 30 seconds | Whisper processes in 30s windows |

### Pre-emphasis Filter

Before feature extraction, a high-pass pre-emphasis filter boosts high frequencies to compensate for the natural roll-off of voiced speech and improve feature quality:

$$\hat{x}[n] = x[n] - \alpha \cdot x[n-1], \quad \alpha \approx 0.97$$

```python
import numpy as np

def preemphasis(signal: np.ndarray, coeff: float = 0.97) -> np.ndarray:
    return np.append(signal[0], signal[1:] - coeff * signal[:-1])
```

### Short-Time Fourier Transform (STFT)

The STFT slides a window over the signal and computes the DFT at each position, producing a time-frequency representation:

$$X[n, k] = \sum_{m=0}^{N-1} x[m + nH] \cdot w[m] \cdot e^{-j 2\pi k m / N}$$

where:
- $n$ = frame index, $k$ = frequency bin
- $H$ = hop length (160 samples = 10ms at 16kHz)
- $N$ = FFT window size (400 samples = 25ms at 16kHz)
- $w[m]$ = Hann window: $w[m] = 0.5\left(1 - \cos\!\left(\frac{2\pi m}{N-1}\right)\right)$

The magnitude spectrogram is $|X[n, k]|^2$ (power spectrogram).

### Mel Scale and Filterbank

The Mel scale maps linear Hz to a perceptual scale:

$$m = 2595 \log_{10}\!\left(1 + \frac{f}{700}\right) \qquad f = 700\left(10^{m/2595} - 1\right)$$

A bank of $M$ triangular filters (default $M = 80$) is applied to the power spectrogram. Filter $j$ has center at Mel frequency $m_j$:

$$S[n, j] = \sum_{k} |X[n, k]|^2 \cdot H_j[k]$$

### Why Log-Mel?

Human hearing is logarithmic and more sensitive to lower frequencies. The Mel scale warps the frequency axis to match human perception, and the log transform compresses the dynamic range. This makes features more robust to volume changes.

$$\text{Log-Mel}[n, j] = \log\!\left(S[n, j] + \epsilon\right), \quad \epsilon \approx 10^{-10}$$

```python
import librosa
import numpy as np

def extract_log_mel(audio: np.ndarray, sr: int = 16000,
                    n_mels: int = 80, n_fft: int = 400,
                    hop_length: int = 160) -> np.ndarray:
    """Compute log-mel spectrogram matching Whisper's pre-processing."""
    audio = preemphasis(audio)
    mel = librosa.feature.melspectrogram(
        y=audio, sr=sr,
        n_mels=n_mels, n_fft=n_fft, hop_length=hop_length,
        window="hann", center=True, pad_mode="reflect",
    )
    log_mel = np.log(mel + 1e-10)
    return log_mel  # shape: (n_mels, time_frames)
```

---

## Connectionist Temporal Classification (CTC)

CTC is the output mechanism used in Wav2Vec2, HuBERT, and older Whisper encoder-only variants.

### The Alignment Problem

Audio frames and text tokens don't align 1:1. "Hello" spoken over 50 frames maps to 5 characters. CTC solves this.

### How CTC Works

1. The model outputs a probability distribution over characters **per frame** (including a blank token `ε`)
2. CTC training marginalizes over all valid alignments
3. At inference, greedy or beam-search decoding collapses sequences:

```
Frame outputs:   h h ε h e e ε l ε l ε o o ε
CTC collapse:    h   h e   ε l   l   o
Remove blanks:   h   h e     l   l   o
Merge repeats:     h e       l   o
Result:          "hello"
```

### CTC Decoding

```python
# Greedy decode (fast, less accurate)
tokens = [vocab[t.argmax()] for t in frame_logits]
result = ctc_collapse(tokens)

# Beam search decode (slower, more accurate)
from pyctcdecode import build_ctcdecoder
decoder = build_ctcdecoder(["<unk>", ...vocab...], kenlm_model="lm.binary")
text = decoder.decode(logits)
```

---

## Encoder-Decoder (Whisper Architecture)

Whisper uses a sequence-to-sequence Transformer — the same architecture as translation models. This is why Whisper can also **translate** speech to English.

### Architecture Diagram

```
Audio (30s, 16kHz)
        │
        ▼
Log-Mel Spectrogram [80 × 3000]
        │
        ▼  2× Conv1D (stride 2 → 1500 frames)
        │
        ▼  Positional Embedding
        │
     ┌──┴──────────────────────────────┐
     │        ENCODER                  │
     │  Transformer blocks × N         │
     │  (Multi-head self-attention)     │
     └──┬──────────────────────────────┘
        │ encoder hidden states
        ▼
     ┌──┴──────────────────────────────┐
     │        DECODER                  │
     │  Transformer blocks × N         │
     │  (Masked self-attn + cross-attn)│
     └──┬──────────────────────────────┘
        │
        ▼
   Token probabilities → BPE text
```

### Special Tokens

Whisper's decoder is controlled by a set of special tokens prepended before generation:

```
<|startoftranscript|>
<|en|>              ← language token (auto-detected or forced)
<|transcribe|>      ← task: transcribe (or <|translate|> for EN translation)
<|notimestamps|>    ← disable word timestamps
```

This is why you can force the language:
```python
result = model.transcribe(audio, language="fr")   # force French
result = model.transcribe(audio, task="translate") # translate to English
```

---

## Byte-Pair Encoding (BPE) Tokenization

Whisper uses BPE tokenization (50,257 tokens for multilingual model):

- Common words → single token (`"hello"` → `[3306]`)  
- Rare words → subword tokens (`"photosynthesis"` → `["photo", "synth", "esis"]`)  
- Numbers, punctuation, timestamps → special tokens

This means WER (Word Error Rate) is distinct from the actual token error rate.

---

## Wav2Vec 2.0 / HuBERT Architecture

These models use **self-supervised pre-training** on unlabeled audio, then fine-tuning on labeled transcripts.

### Pre-training Phase

```
Raw audio waveform
        │
        ▼  CNN feature extractor
Feature vectors [T × 512]
        │
   ┌────┴──────┐
   │ quantizer │ → discrete units (codebook)
   └────┬──────┘
        │
        ▼ Transformer encoder (BERT-style masking)
Contextualized representations
        │
        ▼ Contrastive loss on masked frames
```

### Fine-tuning Phase

```
Labeled (audio, transcript) pairs
        │
        ▼ Freeze or fine-tune CNN features
        │
CTC head on top of Transformer → text
```

**Why this matters:** Wav2Vec2 pre-trained on 960h (LibriSpeech) or 60k hours (LV-60k) learns general speech representations. Fine-tuning only needs a few hours of transcribed data, making it ideal for low-resource languages.

---

## RNN-T (Recurrent Neural Network Transducer)

RNN-T is the dominant architecture for **on-device streaming ASR** (used in Google's Gboard, Apple Dictation, and Amazon Alexa on-device). Unlike CTC, it has a language model built in; unlike Whisper, it is truly streaming with no look-ahead.

### Architecture

```
Audio frames (streaming)
        │
        ▼  Encoder (LSTM or Conformer)
Encoder output h_t  (one per audio frame)
                          +
Text history u_{1..k}
        ▼  Prediction Network (LSTM)
Prediction output g_u

        h_t ⊕ g_u
            ↓  Joint Network (linear + tanh)
        logits over vocab + blank
            ↓  RNN-T loss / beam search
     token emitted (or blank — advance audio frame)
```

### Key Insight: Two Independent Axes

RNN-T defines a joint distribution over all possible alignment paths $(t, u)$:

$$P(y | x) = \sum_{\text{paths}} \prod_{(t,u)} P(z_{t,u} | h_t, g_u)$$

- Blank token $\varnothing$: advance the audio frame (no output)
- Any other token: emit a label and advance the text position

This allows the model to generate output tokens at any time without waiting for the whole audio.

### Why It Matters for Streaming

| | CTC | RNN-T | Whisper |
|--|-----|-------|---------|
| Language model | ❌ external | ✅ built-in | ✅ built-in |
| Streaming | ✅ | ✅ | ❌ (30s window) |
| Offline accuracy | Good | Excellent | Best |
| On-device use | ✅ | ✅ | Limited |

---

## Conformer Architecture

The **Conformer** (Convolution-augmented Transformer) is the state-of-the-art encoder for both CTC and RNN-T models. Used in NeMo Conformer-CTC, Whisper large-v3 (hybrid), and Wav2Vec 2.0 xlsr.

```
Input features (Log-Mel)
        │
        ▼  Conv subsampling (2×) → reduces time dimension
        │
  ┌─────┴──────────────────────────────────┐
  │         Conformer Block × N            │
  │                                        │
  │   Feed-Forward (½ scale)               │
  │       ↓                                │
  │   Multi-Head Self-Attention            │  ← captures long-range context
  │       ↓                                │
  │   Convolution Module                   │  ← captures local patterns
  │     (depth-wise conv, GLU, BN)         │
  │       ↓                                │
  │   Feed-Forward (½ scale)               │
  │       ↓                                │
  │   Layer Norm                           │
  └─────┬──────────────────────────────────┘
        │
  CTC head −→ text   (or RNN-T joint network)
```

The convolution module in each block:

$$\text{ConvModule}(x) = \text{LayerNorm}(x + \text{GLU}(\text{DWConv}(\text{BN}(\text{PW Conv}(x)))))$$

Conformer outperforms pure Transformer encoders on LibriSpeech by ~10% relative WER because local convolutions capture phoneme-level details that attention alone misses.

---

Greedy decoding picks the single highest-probability token at each step. Beam search keeps the top-K hypotheses (beams) and is significantly more accurate:

```
Beam size 3, step 1:
  "the" (0.4), "a" (0.3), "one" (0.2)

Beam size 3, step 2 (from "the"):
  "the cat" (0.35), "the dog" (0.30), "the car" (0.20)
```

```python
# faster-whisper beam search
segments, info = model.transcribe(
    audio,
    beam_size=5,        # default 5; raise to 10 for better accuracy
    best_of=5,          # number of candidates in sampling
    patience=1.0,       # beam search patience factor
    temperature=0.0,    # 0 = greedy, 0.2–0.8 = stochastic
)
```

---

## Language Model Shallow Fusion

CTC models (like Wav2Vec2) can be combined with an external n-gram language model for better accuracy:

```
Acoustic score (CTC) + λ × LM score → best sequence
```

```python
from pyctcdecode import build_ctcdecoder
import kenlm

lm_model = kenlm.Model("5gram_lm.binary")
decoder = build_ctcdecoder(
    labels=vocab,
    kenlm_model=lm_model,
    alpha=0.5,    # LM weight
    beta=1.5,    # word insertion bonus
)
text = decoder.decode(logits_np, beam_width=100)
```

---

## Word Timestamps

Whisper can output word-level timestamps using cross-attention alignment:

```python
result = model.transcribe(audio, word_timestamps=True)
for seg in result["segments"]:
    for word in seg["words"]:
        print(f"{word['start']:.2f}-{word['end']:.2f}: {word['word']}")
# 0.00-0.40: Hello
# 0.40-0.80: world
```

### Dynamic Time Warping (DTW) Alignment

Whisper's word timestamps use DTW on cross-attention weights between audio frames and output tokens. faster-whisper computes these more efficiently using CTranslate2's built-in DTW.

---

## Whisper vs Wav2Vec2 Trade-offs

| Aspect | Whisper | Wav2Vec2 |
|--------|---------|---------|
| Architecture | Encoder-Decoder | Encoder + CTC |
| Training | Supervised (680k hr) | Self-supervised + fine-tuned |
| Multilingual | Yes (100+ languages) | Model-specific |
| Translation | Yes (→ English) | No |
| Fine-tuning | Harder (seq2seq) | Easier (linear CTC head) |
| Domain adaptation | Limited | Strong |
| Streaming | Harder (needs full 30s window) | Easier (frame-by-frame) |
| Hallucinations | Prone on silence | Less prone |
| Best accuracy (English) | ✅ | Close |

---

## Evaluation: Word Error Rate (WER)

$$WER = \frac{S + D + I}{N}$$

Where:
- $S$ = substitutions (wrong word)
- $D$ = deletions (missed word)
- $I$ = insertions (extra word)
- $N$ = total words in reference

```python
from jiwer import wer, cer

reference = "the cat sat on the mat"
hypothesis = "the cat set on the mat"

print(f"WER: {wer(reference, hypothesis):.3f}")   # 0.167 (1/6 words wrong)
print(f"CER: {cer(reference, hypothesis):.3f}")   # character-level
```

---

## MFCC: The DCT Step

While Log-Mel spectrograms are the input to modern end-to-end models (Whisper, Wav2Vec2), classic HMM-GMM systems and some lightweight models still use **Mel-Frequency Cepstral Coefficients (MFCCs)**. The key step that differentiates MFCCs from log-mel features is the Discrete Cosine Transform (DCT).

### Derivation

Starting from $L$ log-filterbank energies $s_j$ (where $j = 1 \dots L$), the $n$-th MFCC coefficient is:

$$c_n = \sum_{j=1}^{L} s_j \cos\!\left(\frac{\pi n (j - 0.5)}{L}\right), \quad n = 1, 2, \dots, N$$

```python
import numpy as np
import librosa

def compute_mfcc(audio: np.ndarray, sr: int = 16000,
                 n_mfcc: int = 13, n_mels: int = 40) -> np.ndarray:
    """
    Compute MFCC from raw audio using the DCT on log-mel filterbank energies.
    Returns shape (n_mfcc, time_frames).
    """
    # Step 1: log-mel filterbank energies
    mel = librosa.feature.melspectrogram(
        y=audio, sr=sr, n_mels=n_mels, n_fft=400, hop_length=160,
        window="hann", fmin=0, fmax=8000,
    )
    log_mel = np.log(mel + 1e-10)  # (n_mels, T)

    # Step 2: DCT-II along the mel axis (compresses to n_mfcc coefficients)
    # librosa.feature.mfcc does exactly this under the hood
    mfcc = librosa.feature.mfcc(S=log_mel, n_mfcc=n_mfcc)
    # mfcc[0] = mean energy (often discarded), mfcc[1:] = spectral shape

    # Step 3: Delta and delta-delta (first and second order derivatives)
    delta  = librosa.feature.delta(mfcc)
    delta2 = librosa.feature.delta(mfcc, order=2)

    # Concatenate: (3 × n_mfcc, T)
    return np.vstack([mfcc, delta, delta2])
```

**Why DCT?** The DCT decorrelates the filterbank channels (adjacent Mel bins are highly correlated). The first few coefficients capture most of the spectral shape; later coefficients capture fine detail. Keeping only 13 out of 40 bins is a 3× compression without losing perceptually important information.

**Why modern models don't use MFCCs:** Neural networks learn their own feature representations; the decorrelation step buys nothing. Log-mel spectrograms feed more information to the network and yield better accuracy.

---

## Whisper Hallucination Suppression

Whisper is prone to generating plausible-sounding text on silence or very noisy audio. The following parameters and strategies suppress this:

```python
from faster_whisper import WhisperModel

model = WhisperModel("base.en", device="cpu", compute_type="int8")

segments, info = model.transcribe(
    audio,
    language="en",
    # --- Hallucination suppression ---
    no_speech_threshold=0.6,          # if no-speech prob > this, return "" for that segment
    compression_ratio_threshold=2.4,  # gzip compression ratio; >2.4 = likely repetitive hallucination
    log_prob_threshold=-1.0,          # avg log-prob; < -1.0 = low-confidence output
    condition_on_previous_text=False, # disabling prevents carries-over hallucinations
    beam_size=5,
    temperature=0.0,                  # greedy; stochastic temperatures increase hallucination risk
)

# Post-filter: skip segments flagged as no-speech
for seg in segments:
    if seg.no_speech_prob > 0.5:
        continue  # skip this segment
    print(seg.text)
```

**Root cause:** Whisper was trained on 30-second audio chunks. When silence is fed, the decoder still generates — it predicts the most probable token given its training distribution (which sometimes includes filler text). The `no_speech_threshold` uses the probability assigned to the `<|nospeech|>` token by a separate classifier head.

---

## Inverse Text Normalization (ITN)

ASR output is raw spoken form. Downstream NLP, NER, or display pipelines need written form. ITN converts spoken form back to written form:

| Spoken (ASR output) | Written (ITN output) |
|---------------------|---------------------|
| "twenty twenty six" | "2026" |
| "three point one four" | "3.14" |
| "one hundred and fifty dollars" | "$150" |
| "john at example dot com" | "john@example.com" |
| "the fifteenth of march" | "March 15th" |

```python
# Option 1: Rule-based (nemo_text_processing — production grade)
# pip install nemo_text_processing
from nemo_text_processing.inverse_text_normalization.inverse_normalize import InverseNormalizer

normalizer = InverseNormalizer(lang="en", cache_dir="/tmp/nemo_itn")

def itn(text: str) -> str:
    return normalizer.normalize(text, verbose=False)

print(itn("twenty twenty six"))       # → "2026"
print(itn("three point one four"))    # → "3.14"
print(itn("one hundred and fifty dollars"))  # → "$150"


# Option 2: Simple regex for numbers (quick & dirty)
import re
from word2number import w2n  # pip install word2number

def itn_simple(text: str) -> str:
    # Replace number words with digits
    words = text.split()
    result = []
    i = 0
    while i < len(words):
        # Try converting longest span first
        converted = False
        for span in range(min(6, len(words) - i), 0, -1):
            chunk = " ".join(words[i:i+span])
            try:
                num = w2n.word_to_num(chunk)
                result.append(str(num))
                i += span
                converted = True
                break
            except ValueError:
                pass
        if not converted:
            result.append(words[i])
            i += 1
    return " ".join(result)
```

---

## See Also

- [Introduction to ASR](/kb/ai/asr/introduction/)
- [ASR Libraries Comparison](/kb/ai/asr/libraries-comparison/)
- [ASR Implementation](/kb/ai/asr/implementation/)
- [ASR Cheatsheet](/kb/ai/asr/cheatsheet/)
- [VAD Algorithms & Theory](/kb/ai/vad/algorithms-theory/) — Log-Mel, MFCC, and spectral features appear in both VAD and ASR; pre-processing stages are shared
- [TTS Algorithms & Theory](/kb/ai/tts/algorithms-theory/) — The acoustic features (mel-spectrograms, vocoders) produced by TTS are the same representations consumed by ASR
