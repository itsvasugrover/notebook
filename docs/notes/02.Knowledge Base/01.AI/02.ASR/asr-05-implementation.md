---
title: "ASR Implementation"
createTime: 2026/03/21 13:04:00
permalink: /kb/ai/asr/implementation/
---

# ASR Implementation

Complete, production-ready Python implementations for each major ASR library. Every section is self-contained and directly runnable.

---

## faster-whisper (Recommended)

### Basic File Transcription

```python
# faster_whisper_basic.py
from faster_whisper import WhisperModel

def transcribe_file(filepath: str,
                    model_size: str = "base.en",
                    device: str = "cpu",
                    compute_type: str = "int8") -> str:
    """
    Transcribe an audio file using faster-whisper.
    Returns the full transcript as a single string.
    """
    model = WhisperModel(model_size, device=device, compute_type=compute_type)
    segments, info = model.transcribe(filepath, beam_size=5)
    
    text = " ".join(seg.text.strip() for seg in segments)
    return text


if __name__ == "__main__":
    transcript = transcribe_file("speech.wav")
    print(transcript)
```

### With Timestamps and Word-Level Output

```python
# faster_whisper_timestamps.py
from faster_whisper import WhisperModel
from dataclasses import dataclass

@dataclass
class WordResult:
    word: str
    start: float
    end: float
    probability: float

@dataclass
class SegmentResult:
    text: str
    start: float
    end: float
    words: list[WordResult]
    avg_logprob: float
    no_speech_prob: float


def transcribe_with_timestamps(filepath: str,
                                model: WhisperModel) -> list[SegmentResult]:
    """
    Transcribe with per-segment and per-word timestamps.
    """
    segments, info = model.transcribe(
        filepath,
        beam_size=5,
        word_timestamps=True,
        vad_filter=True,               # skip silence with built-in VAD
        vad_parameters={
            "min_silence_duration_ms": 500,
        },
    )
    
    results = []
    for seg in segments:
        words = []
        if seg.words:
            for w in seg.words:
                words.append(WordResult(
                    word=w.word,
                    start=w.start,
                    end=w.end,
                    probability=w.probability,
                ))
        results.append(SegmentResult(
            text=seg.text.strip(),
            start=seg.start,
            end=seg.end,
            words=words,
            avg_logprob=seg.avg_logprob,
            no_speech_prob=seg.no_speech_prob,
        ))
    return results


if __name__ == "__main__":
    model = WhisperModel("base.en", device="cpu", compute_type="int8")
    results = transcribe_with_timestamps("speech.wav", model)
    
    for seg in results:
        print(f"[{seg.start:.2f}s → {seg.end:.2f}s] {seg.text}")
        for w in seg.words:
            conf = "✓" if w.probability > 0.8 else "?"
            print(f"   {w.start:.2f}-{w.end:.2f} {conf} {w.word}")
```

### Batch Transcription (Multiple Files)

```python
# batch_transcribe.py
import os
import csv
from pathlib import Path
from faster_whisper import WhisperModel

def batch_transcribe(audio_dir: str,
                     output_csv: str = "transcripts.csv",
                     model_size: str = "base.en",
                     extensions: tuple = (".wav", ".mp3", ".flac", ".ogg", ".m4a")):
    """
    Transcribe all audio files in a directory.
    Saves results to a CSV file.
    """
    model = WhisperModel(model_size, device="cpu", compute_type="int8")
    
    audio_files = [
        p for p in Path(audio_dir).rglob("*")
        if p.suffix.lower() in extensions
    ]
    
    print(f"Found {len(audio_files)} audio files")
    
    with open(output_csv, "w", newline="", encoding="utf-8") as csvfile:
        writer = csv.writer(csvfile)
        writer.writerow(["filename", "duration_s", "language", "transcript"])
        
        for i, filepath in enumerate(audio_files):
            print(f"[{i+1}/{len(audio_files)}] {filepath.name}")
            try:
                segments, info = model.transcribe(
                    str(filepath),
                    beam_size=5,
                    vad_filter=True,
                )
                text = " ".join(seg.text.strip() for seg in segments)
                writer.writerow([
                    filepath.name,
                    round(info.duration, 2),
                    info.language,
                    text
                ])
            except Exception as e:
                print(f"  ERROR: {e}")
                writer.writerow([filepath.name, "", "", f"ERROR: {e}"])
    
    print(f"\nResults saved to {output_csv}")


if __name__ == "__main__":
    batch_transcribe("./recordings", "transcripts.csv")
```

---

## openai-whisper

```python
# openai_whisper_impl.py
import whisper
import numpy as np
import torch

def load_whisper(model_size: str = "base.en", device: str = None) -> whisper.Whisper:
    """Load a Whisper model, auto-selecting GPU if available."""
    if device is None:
        device = "cuda" if torch.cuda.is_available() else "cpu"
    return whisper.load_model(model_size, device=device)


def transcribe_numpy(model: whisper.Whisper,
                     audio: np.ndarray,
                     sr: int = 16000,
                     language: str = None,
                     task: str = "transcribe") -> dict:
    """
    Transcribe from a float32 numpy array (VAD output).
    
    Args:
        audio: float32 numpy array at 16kHz
        language: force language code ("en", "fr", etc.) or None for auto
        task: "transcribe" or "translate" (→ English)
    """
    # Whisper expects fp32 at 16kHz
    if sr != 16000:
        import librosa
        audio = librosa.resample(audio, orig_sr=sr, target_sr=16000)
    
    audio = audio.astype(np.float32)
    
    result = model.transcribe(
        audio,
        language=language,
        task=task,
        fp16=model.device.type == "cuda",
        word_timestamps=True,
        verbose=False,
        condition_on_previous_text=True,
        no_speech_threshold=0.6,
        logprob_threshold=-1.0,
        compression_ratio_threshold=2.4,
    )
    return result


def format_srt(result: dict) -> str:
    """Convert Whisper result to SRT subtitle format."""
    def fmt_time(t: float) -> str:
        h = int(t // 3600)
        m = int((t % 3600) // 60)
        s = int(t % 60)
        ms = int((t % 1) * 1000)
        return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"
    
    lines = []
    for i, seg in enumerate(result["segments"], 1):
        lines.append(str(i))
        lines.append(f"{fmt_time(seg['start'])} --> {fmt_time(seg['end'])}")
        lines.append(seg["text"].strip())
        lines.append("")
    return "\n".join(lines)


if __name__ == "__main__":
    model = load_whisper("small.en")
    result = transcribe_numpy(model, np.zeros(16000 * 5))  # 5s test
    print(result["text"])
    
    # Save as SRT
    with open("subtitles.srt", "w") as f:
        f.write(format_srt(result))
```

---

## Wav2Vec2 (HuggingFace)

```python
# wav2vec2_impl.py
import torch
import numpy as np
import soundfile as sf
from transformers import Wav2Vec2ForCTC, Wav2Vec2Processor

class Wav2Vec2ASR:
    def __init__(self, model_name: str = "facebook/wav2vec2-base-960h",
                 device: str = None):
        self.device = device or ("cuda" if torch.cuda.is_available() else "cpu")
        print(f"Loading {model_name} on {self.device}...")
        self.processor = Wav2Vec2Processor.from_pretrained(model_name)
        self.model = Wav2Vec2ForCTC.from_pretrained(model_name).to(self.device)
        self.model.eval()
    
    def transcribe(self, audio: np.ndarray, sr: int = 16000) -> str:
        """
        Transcribe a float32 numpy audio array.
        Audio must be mono at 16kHz.
        """
        if sr != 16000:
            import librosa
            audio = librosa.resample(audio, orig_sr=sr, target_sr=16000)
        
        inputs = self.processor(
            audio,
            sampling_rate=16000,
            return_tensors="pt",
            padding=True,
        )
        
        input_values = inputs.input_values.to(self.device)
        attention_mask = inputs.attention_mask.to(self.device) if "attention_mask" in inputs else None
        
        with torch.no_grad():
            logits = self.model(
                input_values,
                attention_mask=attention_mask,
            ).logits
        
        predicted_ids = torch.argmax(logits, dim=-1)
        transcription = self.processor.batch_decode(predicted_ids)
        return transcription[0]
    
    def transcribe_file(self, filepath: str) -> str:
        audio, sr = sf.read(filepath, dtype="float32", always_2d=False)
        if audio.ndim > 1:
            audio = audio.mean(axis=1)
        return self.transcribe(audio, sr)
    
    def transcribe_long(self, filepath: str,
                         chunk_s: float = 30.0,
                         overlap_s: float = 1.0) -> str:
        """Transcribe long audio files by chunking."""
        audio, sr = sf.read(filepath, dtype="float32", always_2d=False)
        if audio.ndim > 1:
            audio = audio.mean(axis=1)
        
        chunk_size = int(chunk_s * sr)
        overlap = int(overlap_s * sr)
        parts = []
        
        for start in range(0, len(audio), chunk_size - overlap):
            chunk = audio[start:start + chunk_size]
            if len(chunk) < sr:   # skip very short trailing chunks
                break
            parts.append(self.transcribe(chunk, sr))
        
        return " ".join(parts)


if __name__ == "__main__":
    asr = Wav2Vec2ASR()
    print(asr.transcribe_file("speech.wav"))
```

---

## Vosk

```python
# vosk_impl.py
from vosk import Model, KaldiRecognizer
import wave
import json
import soundfile as sf
import numpy as np
import os

class VoskASR:
    def __init__(self, model_path: str, sample_rate: int = 16000):
        if not os.path.exists(model_path):
            raise FileNotFoundError(f"Vosk model not found: {model_path}")
        self.model = Model(model_path)
        self.sample_rate = sample_rate
    
    def transcribe_file(self, filepath: str) -> str:
        """Transcribe a WAV file using Vosk."""
        wf = wave.open(filepath, "rb")
        assert wf.getframerate() == self.sample_rate, \
            f"Expected {self.sample_rate}Hz, got {wf.getframerate()}Hz"
        assert wf.getnchannels() == 1, "Must be mono audio"
        assert wf.getsampwidth() == 2, "Must be 16-bit PCM"
        
        rec = KaldiRecognizer(self.model, self.sample_rate)
        rec.SetWords(True)
        
        results = []
        while True:
            data = wf.readframes(4000)
            if not data:
                break
            if rec.AcceptWaveform(data):
                r = json.loads(rec.Result())
                if r.get("text"):
                    results.append(r["text"])
        
        final = json.loads(rec.FinalResult())
        if final.get("text"):
            results.append(final["text"])
        
        return " ".join(results)
    
    def transcribe_stream(self, audio_bytes: bytes):
        """Generator: yield partial and final results from a byte stream."""
        rec = KaldiRecognizer(self.model, self.sample_rate)
        rec.SetWords(True)
        
        chunk_size = 4000 * 2  # 4000 frames × 2 bytes
        for i in range(0, len(audio_bytes), chunk_size):
            chunk = audio_bytes[i:i + chunk_size]
            if rec.AcceptWaveform(chunk):
                r = json.loads(rec.Result())
                if r.get("text"):
                    yield ("final", r["text"])
            else:
                r = json.loads(rec.PartialResult())
                if r.get("partial"):
                    yield ("partial", r["partial"])
        
        r = json.loads(rec.FinalResult())
        if r.get("text"):
            yield ("final", r["text"])


if __name__ == "__main__":
    asr = VoskASR("vosk-model-small-en-us-0.15")
    text = asr.transcribe_file("speech.wav")
    print("Vosk:", text)
```

---

## Language Auto-Detection

```python
# lang_detection.py
from faster_whisper import WhisperModel

model = WhisperModel("base", device="cpu", compute_type="int8")  # multilingual model (no .en suffix)

def detect_language(filepath: str, duration_s: float = 10.0) -> tuple[str, float]:
    """
    Detect the spoken language in an audio file.
    Only processes first duration_s seconds for speed.
    Returns (language_code, probability).
    """
    import soundfile as sf
    import numpy as np
    
    audio, sr = sf.read(filepath, dtype="float32", always_2d=False)
    # Only use first N seconds for detection
    audio = audio[:int(duration_s * sr)]
    
    _, info = model.transcribe(
        audio,
        beam_size=1,
        language=None,  # auto-detect
        condition_on_previous_text=False,
    )
    return info.language, info.language_probability


if __name__ == "__main__":
    lang, prob = detect_language("speech.wav")
    print(f"Detected: {lang} ({prob:.1%})")
```

---

## Evaluating Accuracy (WER)

```python
# evaluate_asr.py
from jiwer import wer, cer, process_words
from faster_whisper import WhisperModel
import json

def evaluate_on_dataset(model: WhisperModel,
                         manifest_path: str) -> dict:
    """
    Evaluate ASR on a JSON manifest file.
    Manifest format: [{"audio": "path.wav", "text": "reference transcript"}, ...]
    """
    with open(manifest_path) as f:
        dataset = json.load(f)
    
    references = []
    hypotheses = []
    
    for item in dataset:
        segs, _ = model.transcribe(item["audio"])
        hyp = " ".join(s.text.strip() for s in segs).lower()
        ref = item["text"].strip().lower()
        references.append(ref)
        hypotheses.append(hyp)
        print(f"REF: {ref}")
        print(f"HYP: {hyp}")
        print()
    
    error = wer(references, hypotheses)
    char_error = cer(references, hypotheses)
    
    return {
        "WER": round(error, 4),
        "CER": round(char_error, 4),
        "num_samples": len(dataset),
    }


if __name__ == "__main__":
    model = WhisperModel("base.en", device="cpu", compute_type="int8")
    results = evaluate_on_dataset(model, "test_manifest.json")
    print(f"WER: {results['WER']:.1%}")
    print(f"CER: {results['CER']:.1%}")
```

---

## See Also

- [ASR Algorithms & Theory](/kb/ai/asr/algorithms-theory/)
- [Real-Time Streaming ASR](/kb/ai/asr/real-time-streaming/)
- [ASR Integration Guide](/kb/ai/asr/integration/)
- [ASR Troubleshooting](/kb/ai/asr/troubleshooting/)
- [VAD Implementation](/kb/ai/vad/implementation/) — The audio arrays produced by VAD are consumed directly by the implementations here
- [TTS Implementation](/kb/ai/tts/implementation/) — Feed ASR transcript to LLM, then synthesize the response with TTS
