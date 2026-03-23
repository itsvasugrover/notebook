---
title: "Fine-Tuning ASR Models"
createTime: 2026/03/21 13:09:00
permalink: /kb/ai/asr/fine-tuning/
---

# Fine-Tuning ASR Models

Pre-trained ASR models like Whisper and Wav2Vec2 can be fine-tuned on custom domain data — vastly improving accuracy on specialized vocabulary (medical, legal, engineering), accents, or low-resource languages.

---

## When to Fine-Tune

| Situation | Recommendation |
|-----------|----------------|
| Domain-specific vocabulary (e.g., "CUDA", "XTTS", "CI/CD") | Fine-tune Whisper or Wav2Vec2 |
| Specific accent or speaker style | Fine-tune Whisper small/medium |
| Low-resource language (<100h available) | Fine-tune Wav2Vec2 (self-supervised pre-training helps) |
| General English, standard speech | Use `base.en` or `small.en` as-is |
| Non-English with 100+ hours | Fine-tune Whisper multilingual |

---

## Data Requirements

| Model | Min Labeled Hours | Sweet Spot | Format |
|-------|------------------|------------|--------|
| Whisper (fine-tune) | ~1–5h | 10–100h | (audio, transcript) pairs |
| Wav2Vec2 (fine-tune) | ~15 min | 1–10h | (audio, transcript) pairs |
| Wav2Vec2 (from scratch) | 100h+ unlabeled + 1h labeled | — | Any audio + small labeled set |

Prepare your data as a HuggingFace `Dataset` with `audio` (path or bytes) and `sentence` (transcript) columns.

---

## Fine-Tuning Whisper with HuggingFace Transformers

### 1. Install Dependencies

```bash
pip install transformers datasets accelerate evaluate jiwer
pip install torch torchaudio soundfile librosa
```

### 2. Prepare Dataset

```python
# prepare_dataset.py
from datasets import Dataset, Audio
import pandas as pd

# Your CSV: columns [audio_path, transcript]
df = pd.read_csv("training_data.csv")
dataset = Dataset.from_dict({
    "audio": df["audio_path"].tolist(),
    "sentence": df["transcript"].tolist(),
})
dataset = dataset.cast_column("audio", Audio(sampling_rate=16000))
dataset = dataset.train_test_split(test_size=0.1)
print(dataset)
```

### 3. Feature Extraction

```python
from transformers import WhisperFeatureExtractor, WhisperTokenizer, WhisperProcessor

MODEL_ID = "openai/whisper-small"   # "tiny", "base", "small", "medium"
LANGUAGE = "English"
TASK = "transcribe"

feature_extractor = WhisperFeatureExtractor.from_pretrained(MODEL_ID)
tokenizer = WhisperTokenizer.from_pretrained(MODEL_ID, language=LANGUAGE, task=TASK)
processor = WhisperProcessor.from_pretrained(MODEL_ID, language=LANGUAGE, task=TASK)


def prepare_dataset(batch):
    audio = batch["audio"]
    batch["input_features"] = feature_extractor(
        audio["array"], sampling_rate=audio["sampling_rate"]
    ).input_features[0]
    batch["labels"] = tokenizer(batch["sentence"]).input_ids
    return batch


dataset = dataset.map(prepare_dataset, remove_columns=dataset["train"].column_names)
```

### 4. Data Collator

```python
from dataclasses import dataclass
from typing import Any, Dict, List, Union
import torch


@dataclass
class DataCollatorSpeechSeq2Seq:
    processor: Any
    decoder_start_token_id: int

    def __call__(self, features: List[Dict[str, Union[List[int], torch.Tensor]]]) -> Dict[str, torch.Tensor]:
        input_features = [{"input_features": f["input_features"]} for f in features]
        batch = self.processor.feature_extractor.pad(input_features, return_tensors="pt")
        label_features = [{"input_ids": f["labels"]} for f in features]
        labels_batch = self.processor.tokenizer.pad(label_features, return_tensors="pt")
        # Replace padding with -100 (ignored in loss)
        labels = labels_batch["input_ids"].masked_fill(
            labels_batch.attention_mask.ne(1), -100
        )
        # Cut decoder start token if present
        if (labels[:, 0] == self.decoder_start_token_id).all().cpu().item():
            labels = labels[:, 1:]
        batch["labels"] = labels
        return batch


model = WhisperForConditionalGeneration.from_pretrained(MODEL_ID)
model.config.forced_decoder_ids = None
model.config.suppress_tokens = []

data_collator = DataCollatorSpeechSeq2Seq(
    processor=processor,
    decoder_start_token_id=model.config.decoder_start_token_id,
)
```

### 5. WER Metric

```python
import evaluate
from transformers.models.whisper.english_normalizer import BasicTextNormalizer

metric = evaluate.load("wer")
normalizer = BasicTextNormalizer()


def compute_metrics(pred):
    pred_ids = pred.predictions
    label_ids = pred.label_ids
    label_ids[label_ids == -100] = tokenizer.pad_token_id
    pred_str = tokenizer.batch_decode(pred_ids, skip_special_tokens=True)
    label_str = tokenizer.batch_decode(label_ids, skip_special_tokens=True)
    # Normalize for comparison
    pred_str = [normalizer(p) for p in pred_str]
    label_str = [normalizer(l) for l in label_str]
    # Filter empty references
    pred_str = [p for p, l in zip(pred_str, label_str) if len(l) > 0]
    label_str = [l for l in label_str if len(l) > 0]
    wer_score = 100 * metric.compute(predictions=pred_str, references=label_str)
    return {"wer": wer_score}
```

### 6. Training Loop

```python
from transformers import Seq2SeqTrainer, Seq2SeqTrainingArguments

training_args = Seq2SeqTrainingArguments(
    output_dir="./whisper-finetuned",
    per_device_train_batch_size=8,        # reduce if OOM
    gradient_accumulation_steps=2,        # effective batch = 16
    learning_rate=1e-5,
    warmup_steps=500,
    max_steps=4000,
    gradient_checkpointing=True,
    fp16=True,                            # GPU only; set False for CPU
    evaluation_strategy="steps",
    per_device_eval_batch_size=8,
    predict_with_generate=True,
    generation_max_length=225,
    save_steps=1000,
    eval_steps=1000,
    logging_steps=25,
    report_to=["tensorboard"],
    load_best_model_at_end=True,
    metric_for_best_model="wer",
    greater_is_better=False,
    push_to_hub=False,
)

trainer = Seq2SeqTrainer(
    model=model,
    args=training_args,
    train_dataset=dataset["train"],
    eval_dataset=dataset["test"],
    data_collator=data_collator,
    compute_metrics=compute_metrics,
    tokenizer=processor.feature_extractor,
)
trainer.train()
trainer.save_model("./whisper-finetuned/best")
```

### 7. Inference with Fine-Tuned Model

```python
from faster_whisper import WhisperModel

# Convert to CTranslate2 format for faster inference
# pip install ctranslate2
import subprocess
subprocess.run([
    "ct2-transformers-converter",
    "--model", "./whisper-finetuned/best",
    "--output_dir", "./whisper-finetuned-ct2",
    "--quantization", "int8",
])

model = WhisperModel("./whisper-finetuned-ct2", device="cpu", compute_type="int8")
segments, _ = model.transcribe("test.wav", language="en")
print(" ".join(s.text for s in segments))
```

---

## Fine-Tuning Wav2Vec2 (Lower Data Requirement)

### When Wav2Vec2 is Better Than Whisper for Fine-Tuning

- You have **<1 hour** of labeled data
- You need a **specific domain** (e.g., child speech, elderly speech, one accent)
- You want **deterministic, streaming** output
- You need **custom vocabulary** (e.g., command words only)

Wav2Vec2 is easier to fine-tune than Whisper because it only needs a CTC head, not full seq2seq training.

### Fine-Tuning in ~20 Lines

```python
# wav2vec2_finetune.py — minimal fine-tuning example
from transformers import (
    Wav2Vec2ForCTC, Wav2Vec2Processor,
    TrainingArguments, Trainer
)
from datasets import load_dataset, Audio
import torch

MODEL_ID = "facebook/wav2vec2-base-960h"
processor = Wav2Vec2Processor.from_pretrained(MODEL_ID)
model = Wav2Vec2ForCTC.from_pretrained(MODEL_ID)

# Freeze the feature extractor (saves memory, speeds training)
model.freeze_feature_extractor()


def preprocess(batch):
    audio = batch["audio"]
    inputs = processor(audio["array"], sampling_rate=16000, return_tensors="pt", padding=True)
    batch["input_values"] = inputs.input_values[0]
    with processor.as_target_processor():
        labels = processor(batch["sentence"], return_tensors="pt", padding=True)
    batch["labels"] = labels.input_ids[0]
    return batch


# Load your dataset here (replace with your actual data)
dataset = load_dataset("timit_asr", split="train[:1000]")
dataset = dataset.cast_column("audio", Audio(sampling_rate=16000))
dataset = dataset.map(preprocess, remove_columns=dataset.column_names)

training_args = TrainingArguments(
    output_dir="./wav2vec2-finetuned",
    num_train_epochs=10,
    per_device_train_batch_size=16,
    learning_rate=3e-4,
    warmup_steps=200,
    save_steps=500,
    eval_steps=500,
    fp16=True,
)

trainer = Trainer(
    model=model,
    args=training_args,
    train_dataset=dataset,
)
trainer.train()
```

---

## Dataset Preparation Tips

### Recording Your Own Training Data

Requirements for good training data:
- Quiet environment (SNR > 30 dB)
- Consistent microphone (same device as deployment)
- 16kHz, mono, 16-bit PCM WAV
- No music, no reverb, no background noise
- Speaker variety if possible (multiple speakers generalize better)
- Balanced sentence length (mix short commands and long sentences)

Minimum viable dataset (fine-tuning Wav2Vec2):
- 15–30 minutes: improve on a narrow domain
- 1–5 hours: solid domain adaptation
- 10+ hours: significant phoneme coverage

### Augmentation (Expand Small Datasets)

```python
import numpy as np
import soundfile as sf


def augment_audio(audio: np.ndarray, sr: int = 16000) -> list[np.ndarray]:
    """Generate augmented copies of an audio clip."""
    augmented = [audio]

    # Speed perturbation (0.9×, 1.1×)
    from scipy.signal import resample_poly
    from math import gcd
    for factor in [0.9, 1.1]:
        n = int(len(audio) / factor)
        aug = np.interp(np.linspace(0, len(audio), n), np.arange(len(audio)), audio)
        augmented.append(aug.astype(np.float32))

    # Volume variation (±10%)
    for gain in [0.9, 1.1]:
        augmented.append((audio * gain).astype(np.float32))

    # Add AWGN noise at 30 dB SNR
    rms = np.sqrt(np.mean(audio ** 2))
    noise_rms = rms / (10 ** (30 / 20))
    noise = np.random.randn(len(audio)) * noise_rms
    augmented.append((audio + noise).astype(np.float32))

    return augmented
```

---

## See Also

- [ASR Algorithms & Theory](/kb/ai/asr/algorithms-theory/) — Wav2Vec2 pre-training and CTC theory
- [ASR Libraries Comparison](/kb/ai/asr/libraries-comparison/) — Model size and architecture reference
- [ASR Implementation](/kb/ai/asr/implementation/) — Inference with fine-tuned models
- [ASR Troubleshooting](/kb/ai/asr/troubleshooting/) — Common training and inference issues
- [VAD Implementation](/kb/ai/vad/implementation/) — Segment your audio before building training data
