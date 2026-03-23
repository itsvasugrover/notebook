---
title: "GGUF Format & Quantization"
createTime: 2026/03/21 10:02:00
permalink: /kb/ai/llama-cpp/gguf-quantization/
---

# GGUF Format & Quantization

GGUF is the model file format used by llama.cpp. It encodes both model metadata and (optionally quantized) weights in a single portable file. Understanding the format and the available quantization schemes is essential for choosing the right balance of speed, memory, and output quality.

## History: GGML Format to GGUF

llama.cpp originally used a bespoke binary format nicknamed **GGML format** (`.bin` files). It worked but had limitations:

- No metadata — architecture info was hardcoded in the loader
- No versioning — breaking changes required running conversion scripts repeatedly
- Not extensible — adding new fields broke existing files

In August 2023, **GGUF** (GGML Universal File Format) was introduced to replace it. GGUF is:

- **Self-describing** — all metadata (architecture, context length, tokenizer, rope params, etc.) is stored inside the file
- **Extensible** — new metadata keys can be added without breaking old readers
- **Memory-mappable** — tensors are aligned for direct `mmap` access
- **Multi-tensor** — stores all model tensors in one file (no sidecar files)

GGML `.bin` files are no longer supported. All models must be in GGUF format.

## GGUF File Structure

A GGUF file is a sequential binary format:

```
+------------------------------------------+
|  Magic: "GGUF" (4 bytes)                 |
|  Version: uint32 (currently 3)           |
|  Tensor count: uint64                    |
|  Metadata KV count: uint64               |
+------------------------------------------+
|  Metadata Key-Value Pairs                |
|  general.architecture = "llama"          |
|  general.name = "Llama-3.2-3B-Instruct"  |
|  llama.context_length = 131072           |
|  llama.embedding_length = 3072           |
|  llama.block_count = 28                  |
|  llama.attention.head_count = 24         |
|  llama.rope.freq_base = 500000.0         |
|  tokenizer.ggml.model = "gpt2"           |
+------------------------------------------+
|  Tensor Info Array                       |
|  name, n_dims, dims, type, offset        |
+------------------------------------------+
|  Padding to alignment boundary           |
+------------------------------------------+
|  Tensor Data (all tensors packed)        |
|  (memory-mapped directly into process)   |
+------------------------------------------+
```

### Inspecting GGUF Metadata

```bash
# Built-in tool
./build/bin/llama-gguf-info -m model.gguf

# Or with Python
pip install gguf
python3 -c "
from gguf import GGUFReader
reader = GGUFReader('model.gguf')
for key, field in reader.fields.items():
    print(f'{key}: {field.parts}')
"
```

## Quantization Fundamentals

Neural network weights are originally trained as 32-bit floats. **Quantization** maps these floats to a smaller representation — typically integers — to reduce memory usage and improve throughput.

### How Block Quantization Works

llama.cpp uses **block quantization**: weights are split into fixed-size blocks (typically 32 floats), and each block stores a shared scale factor plus quantized integers.

```
Original block (32 x f32 = 128 bytes):
[3.14, -0.22, 1.07, ..., 0.88]

After Q4_0 (32 x 4-bit + 1 scale = 18 bytes):
scale = max(|values|) / 7
quantized = round(value / scale)  -> stored as 4-bit int
```

The **K-quant** family (Q4_K, Q5_K, Q6_K, etc.) uses **super-blocks** of 256 weights with multiple nested scale factors, which significantly improves quality at the same bit-width.

## Complete Quantization Reference

### Floating-Point Formats

| Type | Bits/Weight | Size (7B) | Notes |
|------|------------|-----------|-------|
| `F32` | 32 | ~28 GB | Full precision; reference quality |
| `F16` | 16 | ~14 GB | Half precision; minimal quality loss |
| `BF16` | 16 | ~14 GB | Brain float; better range than F16 |

### K-Quant Family (Recommended)

| Type | Bits/Weight | Size (7B) | Quality vs F16 | Use Case |
|------|------------|-----------|----------------|----------|
| `Q6_K` | 6.57 | ~5.9 GB | Excellent | When quality matters most |
| `Q5_K_M` | 5.68 | ~5.1 GB | Very good | Recommended balance for 7B |
| `Q5_K_S` | 5.52 | ~4.9 GB | Very good | Slightly smaller than Q5_K_M |
| `Q4_K_M` | 4.85 | ~4.4 GB | Good | **Most popular; best size/quality default** |
| `Q4_K_S` | 4.58 | ~4.1 GB | Good | Smaller than Q4_K_M |
| `Q3_K_L` | 3.88 | ~3.5 GB | Fair | Large variant of Q3_K |
| `Q3_K_M` | 3.74 | ~3.3 GB | Fair | When RAM is tight |
| `Q3_K_S` | 3.50 | ~3.2 GB | Fair | Smallest Q3 variant |
| `Q2_K` | 2.94 | ~2.7 GB | Poor | Last resort |

> **Naming convention**: `QX_K_M` = X-bit K-quant, **M**edium quality. `_S` = Small. `_L` = Large.

### Standard Integer Quants (Legacy)

| Type | Bits/Weight | Size (7B) | Notes |
|------|------------|-----------|-------|
| `Q8_0` | 8 | ~7.2 GB | Near-lossless; use when size is not constrained |
| `Q5_1` | 5 | ~4.7 GB | Slightly better than Q5_0 |
| `Q5_0` | 5 | ~4.6 GB | Legacy 5-bit |
| `Q4_1` | 4 | ~3.9 GB | Legacy 4-bit with offset |
| `Q4_0` | 4 | ~3.8 GB | Legacy 4-bit; now outperformed by K-quants |

### iQuant / IQ Family (Importance-Weighted)

IQ quants use **importance matrices** — a calibration dataset identifies which weights matter most, and those receive higher precision.

| Type | Bits/Weight | Size (7B) | Notes |
|------|------------|-----------|-------|
| `IQ4_NL` | 4.50 | ~4.1 GB | Quality close to Q4_K_M |
| `IQ4_XS` | 4.25 | ~3.9 GB | Good quality, smaller than Q4_K_S |
| `IQ3_M` | 3.70 | ~3.4 GB | Importance-weighted 3-bit medium |
| `IQ3_S` | 3.50 | ~3.2 GB | Importance-weighted 3-bit small |
| `IQ3_XXS` | 3.06 | ~2.8 GB | Very aggressive 3-bit |
| `IQ2_M` | 2.72 | ~2.5 GB | Best quality in the 2-bit range |
| `IQ2_S` | 2.50 | ~2.3 GB | 2-bit small variant |
| `IQ2_XS` | 2.31 | ~2.1 GB | Ultra-compressed; heavy quality loss |
| `IQ2_XXS` | 2.06 | ~1.9 GB | Extreme compression; experimentation only |
| `IQ1_S` | 1.56 | ~1.4 GB | Near-unusable for instruction-following |

## Choosing the Right Quantization

### Decision Guide

```
Do you have GPU VRAM to spare?
  YES -> Use Q6_K or Q5_K_M for best quality
  NO  -> Continue:

What is your RAM budget?
  > 8 GB  -> Q5_K_M or Q4_K_M (recommended default)
  4-8 GB  -> Q4_K_M or Q4_K_S
  2-4 GB  -> Q3_K_M or IQ4_XS
  < 2 GB  -> IQ2_M (quality will be noticeably reduced)
```

**Q4_K_M is the standard recommendation** for 7B models. It fits in 4–5 GB RAM, runs well on CPU, and retains ~99% of the original model quality for most tasks.

### Perplexity Comparison (LLaMA-3-8B, wikitext-2)

| Quantization | Perplexity | Delta vs F16 |
|-------------|-----------|--------------|
| F16 | 6.12 | baseline |
| Q8_0 | 6.13 | +0.01 |
| Q6_K | 6.15 | +0.03 |
| Q5_K_M | 6.17 | +0.05 |
| Q4_K_M | 6.22 | +0.10 |
| Q3_K_M | 6.62 | +0.50 |
| Q2_K | 7.41 | +1.29 |

## Creating Quantized Models

### From HuggingFace Safetensors to GGUF

```bash
# Install Python dependencies
pip install -r requirements/requirements-convert_hf_to_gguf.txt

# Step 1: Convert HuggingFace model to F16 GGUF
python convert_hf_to_gguf.py \
  /path/to/hf-model-directory \
  --outfile model-f16.gguf \
  --outtype f16

# Step 2: Quantize F16 GGUF to target format
./build/bin/llama-quantize \
  model-f16.gguf \
  model-Q4_K_M.gguf \
  Q4_K_M
```

### Quantizing with Importance Matrix

```bash
# Generate importance matrix from a calibration corpus
./build/bin/llama-imatrix \
  -m model-f16.gguf \
  -f calibration_data.txt \
  -o imatrix.dat \
  --chunks 128

# Quantize using the importance matrix
./build/bin/llama-quantize \
  --imatrix imatrix.dat \
  model-f16.gguf \
  model-IQ4_XS.gguf \
  IQ4_XS
```

## Where to Download GGUF Models

Pre-quantized GGUF models are widely available on Hugging Face:

| Source | Notes |
|--------|-------|
| `bartowski/*` | High-quality K-quant and IQ-quant conversions |
| `unsloth/*` | Dynamic quantization; often higher quality at same size |
| `TheBloke/*` | Large catalog; K-quants; older but reliable |
| Model author repos | Some authors release official GGUF files |
| `lmstudio-community/*` | Community-vetted GGUF files |

```bash
pip install huggingface-hub
huggingface-cli download bartowski/Meta-Llama-3.1-8B-Instruct-GGUF \
  Meta-Llama-3.1-8B-Instruct-Q4_K_M.gguf \
  --local-dir ./models
```

## See Also

- [Architecture & Internals](/kb/ai/llama-cpp/architecture/) — how GGUF tensors are memory-mapped and fed into the inference pipeline
- [Installation & Build](/kb/ai/llama-cpp/installation-build/) — `llama-quantize` and conversion scripts are built alongside the main tools
- [Performance Tuning](/kb/ai/llama-cpp/performance-tuning/) — KV cache quantization and the impact of quant choice on inference speed
- [Troubleshooting](/kb/ai/llama-cpp/troubleshooting/) — GGUF version mismatch errors and model load failures
