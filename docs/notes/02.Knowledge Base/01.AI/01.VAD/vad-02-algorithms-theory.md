---
title: "VAD Algorithms & Theory"
createTime: 2026/03/21 12:01:00
permalink: /kb/ai/vad/algorithms-theory/
---

# VAD Algorithms & Theory

Understanding how VAD algorithms work internally helps you choose the right one, tune its parameters, and debug unexpected behavior.

---

## Signal Fundamentals

Audio is a waveform — a time series of amplitude values. VAD splits this waveform into short **frames** and classifies each frame.

```
Amplitude
  |        ___         ___________         ___
  |       /   \       /           \       /   \
  |______/     \_____/             \_____/     \____
  ↑                                                    Time
  |← frame →|← frame →|← frame →|← frame →|
```

### Sample Rate and Frame Size

The frame size controls how fine-grained the VAD decision is:

| Sample Rate | Frame (10ms) | Frame (20ms) | Frame (30ms) |
|-------------|-------------|-------------|-------------|
| 8,000 Hz    | 80 samples  | 160 samples | 240 samples |
| 16,000 Hz   | 160 samples | 320 samples | 480 samples |
| 32,000 Hz   | 320 samples | 640 samples | 960 samples |

**Shorter frames = finer resolution but noisier decisions.**  
**Longer frames = smoother but higher latency.**

---

## Algorithm 1: Energy-Based VAD

### How It Works

Compute the Root Mean Square (RMS) energy of each frame and compare against a threshold.

$$E_{rms} = \sqrt{\frac{1}{N} \sum_{i=0}^{N-1} x_i^2}$$

```python
import numpy as np

def energy_vad(samples: np.ndarray, threshold: float = 0.02) -> bool:
    rms = np.sqrt(np.mean(samples.astype(np.float32) ** 2))
    return rms > threshold
```

### Adaptive Threshold

A static threshold fails in changing noise conditions. Adaptive threshold tracks background noise:

```python
class AdaptiveEnergyVAD:
    def __init__(self, noise_alpha=0.95, speech_threshold_factor=3.0):
        self.noise_level = 0.01
        self.noise_alpha = noise_alpha
        self.factor = speech_threshold_factor

    def is_speech(self, frame: np.ndarray) -> bool:
        rms = np.sqrt(np.mean(frame.astype(np.float32) ** 2))
        threshold = self.noise_level * self.factor
        if rms < threshold:
            # Update noise estimate (exponential moving average)
            self.noise_level = self.noise_alpha * self.noise_level + (1 - self.noise_alpha) * rms
        return rms > threshold
```

### Pros and Cons

| Pros | Cons |
|------|------|
| Zero dependencies | Fails with background music |
| Microsecond latency | Sensitive to microphone gain |
| No model needed | HVAC / fan noise = false positives |
| Easy to tune | Quiet speech = false negatives |

---

## Algorithm 2: Zero Crossing Rate (ZCR)

ZCR counts the number of times the signal crosses zero per frame.

$$ZCR = \frac{1}{N-1} \sum_{i=1}^{N-1} \mathbb{1}[x_i \cdot x_{i-1} < 0]$$

```python
def zero_crossing_rate(frame: np.ndarray) -> float:
    signs = np.sign(frame)
    signs[signs == 0] = 1
    crossings = np.sum(np.diff(signs) != 0)
    return crossings / len(frame)
```

- **Silence**: very low ZCR  
- **Speech**: moderate ZCR (voiced ~0.1, unvoiced consonants higher)  
- **White noise**: very high ZCR

ZCR alone is weak. It's best **combined with energy**:

```python
def combined_vad(frame, energy_threshold=0.02, zcr_threshold=0.3):
    energy = np.sqrt(np.mean(frame.astype(float) ** 2))
    zcr = zero_crossing_rate(frame)
    return energy > energy_threshold or zcr > zcr_threshold
```

---

## Algorithm 3: Spectral-Based VAD

Speech has a characteristic spectral distribution. Spectral features are more robust than raw energy.

### MFCC-Based Features

Mel-Frequency Cepstral Coefficients (MFCCs) represent the short-term power spectrum of audio in a way that mirrors human hearing.

```python
import librosa

def spectral_vad(audio, sr=16000, threshold=0.5):
    # Extract MFCC features
    mfcc = librosa.feature.mfcc(y=audio, sr=sr, n_mfcc=13)
    # Simple energy in lower MFCCs (proxy for voiced speech)
    energy = np.mean(mfcc[:4, :] ** 2, axis=0)
    return energy > threshold
```

### Spectral Centroid

Speech has a higher spectral centroid than low-frequency noise (HVAC, traffic):

```python
centroid = librosa.feature.spectral_centroid(y=audio, sr=sr)
```

---

## Algorithm 4: GMM-Based VAD (WebRTC)

Google's WebRTC VAD (used in Chrome, Zoom, WhatsApp) uses Gaussian Mixture Models (GMMs) trained on a fixed set of features.

### How It Works

1. Extract 6 features per frame (MFCC sub-band energies)
2. Score each frame against two GMMs: one for speech, one for noise
3. Compute a likelihood ratio
4. Apply aggressiveness mode to set the threshold

```
Features: [f1, f2, f3, f4, f5, f6]
                    │
         ┌──────────┴──────────┐
         ▼                     ▼
   P(frame|speech)    P(frame|noise)
         │                     │
         └──────────┬──────────┘
                    ▼
            Likelihood Ratio
                    │
            > threshold? → SPEECH
```

### Aggressiveness Modes

| Mode | Description | False Positives | False Negatives |
|------|-------------|----------------|----------------|
| 0    | Least aggressive — passes most audio | High | Low |
| 1    | Balanced | Medium | Medium |
| 2    | More aggressive filtering | Low | Medium |
| 3    | Most aggressive — only clear speech | Very Low | High |

### Limitations

- Fixed GMM trained on specific data — doesn't adapt to all microphones
- Only works with 8000, 16000, or 32000 Hz input
- Frame size must be exactly 10, 20, or 30ms

---

## Algorithm 5: DNN/ML-Based VAD

### Silero VAD Architecture

Silero VAD is a JITSCRIPT (TorchScript) compiled LSTM model:

```
Input:     float32 audio frame (512 or 256 samples at 16kHz)
           ↓
Encoder:   1D Conv layers → feature extraction
           ↓
RNN:       LSTM × 2 layers → temporal context
           ↓
Output:    single float in [0, 1] — speech probability
```

Key properties:
- **~2 MB** model size (JIT compiled)
- Processes **512 samples (32ms)** at 16kHz
- Returns speech probability per chunk
- No internet required at inference
- CPU inference: ~0.5ms per chunk on modern CPU

### pyannote.audio Architecture

```
Input:     1–5 second audio windows
           ↓
WavLM/    Pre-trained Transformer (SSL features)
HuBERT:   ↓
           Frame-level speech probability
           ↓
Output:    Annotation with speech/non-speech timestamps
```

Much heavier (300MB+) but extremely accurate. Also outputs speaker identity (diarization).

---

## Smoothing and Post-processing

Raw per-frame VAD output is noisy. Post-processing is critical.

### Median Filtering

```python
from scipy.ndimage import median_filter

# Smooth the binary VAD output over a window of 5 frames
smoothed = median_filter(vad_output, size=5)
```

### Hysteresis (Onset/Offset Delay)

Avoid chopping speech mid-utterance by requiring N consecutive frames before switching state:

```python
class HysteresisVAD:
    def __init__(self, onset_frames=3, offset_frames=10):
        self.onset_frames = onset_frames    # frames before activating
        self.offset_frames = offset_frames  # frames before deactivating
        self.speech_counter = 0
        self.silence_counter = 0
        self.is_speaking = False

    def update(self, is_speech: bool) -> bool:
        if is_speech:
            self.speech_counter += 1
            self.silence_counter = 0
            if self.speech_counter >= self.onset_frames:
                self.is_speaking = True
        else:
            self.silence_counter += 1
            self.speech_counter = 0
            if self.silence_counter >= self.offset_frames:
                self.is_speaking = False
        return self.is_speaking
```

### Speech Segment Padding

Always add padding before speech onset and after offset to avoid clipping:

```python
def pad_segments(segments, pre_pad=0.3, post_pad=0.5, audio_duration=None):
    padded = []
    for seg in segments:
        start = max(0.0, seg["start"] - pre_pad)
        end = seg["end"] + post_pad
        if audio_duration:
            end = min(audio_duration, end)
        padded.append({"start": start, "end": end})
    return padded
```

---

## Evaluation Metrics

| Metric | Formula | Meaning |
|--------|---------|---------|
| **Precision** | TP / (TP + FP) | Of detected speech, how much is real speech? |
| **Recall** | TP / (TP + FN) | Of real speech, how much was detected? |
| **F1 Score** | 2 × P × R / (P + R) | Balance of precision and recall |
| **Detection Error Rate** | (FA + Miss) / Total speech | pyannote standard metric |
| **Latency** | ms from speech onset to detection | Time to react |

### False Alarm Rate and Miss Rate

$$FAR = \frac{\text{Non-speech classified as speech}}{\text{Total non-speech frames}}$$

$$MR = \frac{\text{Speech classified as non-speech}}{\text{Total speech frames}}$$

### Detection Cost Function (DCF)

The standard NIST evaluation metric balances the two error types weighted by their prior probability:

$$C_{det} = C_{FA} \cdot P_{FA} \cdot P_{target} + C_{miss} \cdot P_{miss} \cdot (1 - P_{target})$$

$$\text{normalized DCF} = \min_\theta \frac{C_{det}}{C_{det,default}}$$

where $C_{det,default} = \min(C_{FA} \cdot P_{target},\ C_{miss} \cdot (1 - P_{target}))$.

In the standard NIST SRE setting: $C_{FA} = 1$, $C_{miss} = 10$, $P_{target} = 0.01$ — misses are penalized 10× more than false alarms.

### Cascade Effect: VAD Errors on ASR

VAD errors propagate directly into ASR quality:

| VAD Error | Effect on ASR |
|-----------|--------------|
| **False positive** (noise → speech) | Whisper hallucinates text from silence; WER increases |
| **False negative** (speech → silence) | Beginning/end of utterance clipped; words deleted |
| **Late onset** detection | First word(s) missing from transcript |
| **Early offset** detection | Sentence split mid-utterance; two partial transcripts |
| **Choppy segments** (<300ms) | Whisper cannot decode very short clips reliably |

This is why the choice of VAD threshold, silence padding, and minimum segment duration directly controls ASR WER — not just VAD accuracy alone.

```python
# Measure VAD impact on ASR WER
from jiwer import wer

def vad_asr_roundtrip(audio: np.ndarray, sr: int,
                      vad_threshold: float, asr_model) -> float:
    """Run VAD then ASR; return WER vs ground truth."""
    timestamps = get_speech_timestamps(
        torch.tensor(audio), vad_model,
        threshold=vad_threshold, sampling_rate=sr,
        return_seconds=True
    )
    segments_text = []
    for ts in timestamps:
        chunk = audio[int(ts["start"]*sr):int(ts["end"]*sr)]
        segs, _ = asr_model.transcribe(chunk, beam_size=5)
        segments_text.append(" ".join(s.text for s in segs))
    return " ".join(segments_text)
```

### Benchmark Comparison (16kHz, clean speech)

| Library | F1 Score | Latency | CPU Load |
|---------|----------|---------|----------|
| silero-vad | ~0.97 | 1–2ms/chunk | Low |
| pyannote VAD | ~0.95 | 50–200ms | High |
| webrtcvad (mode 3) | ~0.89 | <1ms | Minimal |
| energy-based | ~0.75 | <0.1ms | Negligible |

---


## Pitch (F0) as a Speech Discriminator

Voiced human speech is produced by periodic vocal-fold vibration, resulting in a **fundamental frequency (F0)** of 80–300 Hz for most speakers. Stationary noises (HVAC, fans, electrical hum) lack this periodicity. Detecting F0 is therefore a powerful speech discriminator in challenging environments.

### Autocorrelation F0 Estimation

The simplest F0 detector uses the autocorrelation of the waveform:

$$R[k] = \sum_{n=0}^{N-1-k} x[n] \cdot x[n + k]$$

The lag $k^*$ at which $R[k]$ peaks (after the zero-lag peak) gives the period $T_0 = k^*/f_s$, so $F0 = f_s / k^*$.

```python
import numpy as np

def detect_f0(frame: np.ndarray, sr: int = 16000,
              f0_min: float = 60, f0_max: float = 400) -> float | None:
    """
    Estimate F0 from a single audio frame using autocorrelation.
    Returns F0 in Hz, or None if frame is unvoiced.
    """
    lag_min = int(sr / f0_max)  # minimum lag for f0_max
    lag_max = int(sr / f0_min)  # maximum lag for f0_min

    # Normalize frame
    frame = frame - frame.mean()
    if np.abs(frame).max() < 1e-6:
        return None  # silence

    # Compute autocorrelation
    corr = np.correlate(frame, frame, mode="full")
    corr = corr[len(corr) // 2:]  # keep positive lags only

    # Normalize by zero-lag power
    if corr[0] < 1e-10:
        return None
    corr_norm = corr / corr[0]

    # Find peak in valid lag range
    search = corr_norm[lag_min:lag_max]
    if len(search) == 0:
        return None
    peak_lag = lag_min + np.argmax(search)

    # Voicing threshold: peak autocorrelation > 0.3
    if corr_norm[peak_lag] < 0.3:
        return None  # unvoiced

    return sr / peak_lag


def f0_vad(frame: np.ndarray, sr: int = 16000) -> bool:
    """Speech detected if F0 is found in the human speech range."""
    return detect_f0(frame, sr) is not None
```

**When to use F0-based VAD:** effective when the background has energy in the same frequency bands as speech (music, narrow-band noise). Pure energy VAD would fail there; F0 detection correctly classifies voiced speech.

---

## CMVN — Cepstral Mean and Variance Normalization

CMVN normalizes acoustic features across a recording or session to reduce the effect of microphone variation, room acoustics, and channel mismatch. It is standard in HMM-GMM ASR and also applied as a pre-processing step to ASR input features.

### Global CMVN

Given a sequence of $T$ feature vectors $\{\mathbf{f}_t\}_{t=1}^{T}$ (e.g., MFCCs or log-mel), compute the global mean and variance and normalize:

$$\hat{\mathbf{f}}_t = \frac{\mathbf{f}_t - \boldsymbol{\mu}}{\boldsymbol{\sigma}}, \qquad \boldsymbol{\mu} = \frac{1}{T}\sum_t \mathbf{f}_t, \quad \sigma_k^2 = \frac{1}{T}\sum_t (f_{t,k} - \mu_k)^2$$

```python
import numpy as np

def apply_cmvn(features: np.ndarray, eps: float = 1e-8) -> np.ndarray:
    """
    Apply Cepstral Mean and Variance Normalization to a feature matrix.
    
    features: shape (n_features, time_frames) — e.g. MFCCs
    returns: normalized features of the same shape
    """
    mean = features.mean(axis=1, keepdims=True)
    std  = features.std(axis=1, keepdims=True) + eps
    return (features - mean) / std


# Sliding-window CMVN (for streaming — normalize over a 3s window)
from collections import deque

class SlidingCMVN:
    def __init__(self, window_frames: int = 300):  # 300 × 10ms = 3s
        self.buf = deque(maxlen=window_frames)

    def normalize(self, frame: np.ndarray) -> np.ndarray:
        self.buf.append(frame)
        stack = np.stack(list(self.buf), axis=1)  # (n_feat, window)
        mean = stack.mean(axis=1)
        std  = stack.std(axis=1) + 1e-8
        return (frame - mean) / std
```

**Why CMVN matters for VAD:** A VAD trained on clean close-mic data may fail on a different microphone or in a reverberant room. CMVN normalizes the feature distribution so the model sees the same statistical shape regardless of recording conditions.

---

## Multi-Microphone / Beamforming VAD

Real-world devices — smart speakers, conference systems, hearing aids — use microphone arrays. Beamforming combines multiple microphone signals to suppress noise from all directions except the target direction, dramatically improving VAD accuracy in noisy environments.

### Delay-and-Sum Beamforming

Given $M$ microphones and a target direction $\theta$, the delay-and-sum beamformer aligns and adds signals:

$$y[n] = \frac{1}{M} \sum_{m=1}^{M} x_m[n - d_m(\theta)]$$

where $d_m(\theta) = \lfloor f_s \cdot \tau_m(\theta) \rfloor$ is the delay in samples for microphone $m$ given target direction $\theta$, and $\tau_m(\theta)$ is the time-of-arrival difference relative to a reference mic.

```python
import numpy as np

def delay_and_sum(signals: np.ndarray, delays: list[int]) -> np.ndarray:
    """
    Delay-and-sum beamforming.
    
    signals: shape (M, T) — M microphone signals, T samples
    delays:  list of M integer delays (samples)
    returns: beamformed signal, shape (T,)
    """
    M, T = signals.shape
    max_delay = max(delays)
    output_len = T - max_delay
    output = np.zeros(output_len, dtype=np.float32)

    for m, d in enumerate(delays):
        output += signals[m, d:d + output_len]

    return output / M


def estimate_delays(mic_positions: np.ndarray, direction_deg: float,
                    sr: int = 16000, speed_of_sound: float = 343.0) -> list[int]:
    """
    Estimate inter-microphone delays for a given target direction.
    
    mic_positions: shape (M, 2) — 2D positions in meters
    direction_deg: target direction in degrees (0 = positive x-axis)
    """
    theta = np.radians(direction_deg)
    unit_vec = np.array([np.cos(theta), np.sin(theta)])

    # Project each mic position onto the direction vector
    projections = mic_positions @ unit_vec

    # Convert to samples (relative to the mic at position 0)
    projections -= projections[0]
    delays = -np.round(projections * sr / speed_of_sound).astype(int)

    # Make all delays non-negative
    delays -= delays.min()
    return delays.tolist()
```

**Practical impact:** Delay-and-sum beamforming on a 4-mic linear array can improve SNR by ~6 dB ($10 \log_{10} M$). Combined with Silero VAD, this reduces false positives from diffuse room noise by up to 90% in reverberant environments.

---

## See Also

- [Introduction to VAD](/kb/ai/vad/introduction/)
- [VAD Libraries Comparison](/kb/ai/vad/libraries-comparison/)
- [VAD Implementation](/kb/ai/vad/implementation/)
- [VAD Cheatsheet](/kb/ai/vad/cheatsheet/)
- [ASR Algorithms & Theory](/kb/ai/asr/algorithms-theory/) — Log-Mel spectrograms, MFCC, and CMVN used in VAD are the same features consumed by ASR acoustic models
- [TTS Algorithms & Theory](/kb/ai/tts/algorithms-theory/) — Pitch (F0) and energy features in TTS prosody modeling are the same acoustic cues VAD uses for speech/non-speech classification
