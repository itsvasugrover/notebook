---
title: "Performance Tuning"
createTime: 2026/03/21 10:08:00
permalink: /kb/ai/llama-cpp/performance-tuning/
---

# Performance Tuning

llama.cpp exposes detailed controls for CPU threads, batch sizes, flash attention, KV cache formats, memory mapping, and context scaling. This guide covers each systematically, starting from the most impactful changes.

## Understanding Prefill vs Decode

LLM inference has two distinct phases with different performance characteristics:

| Phase | Also called | Bottleneck | Measured as |
|-------|------------|-----------|-------------|
| **Prefill** | Prompt processing (pp) | Compute (FLOPS) | tokens/sec on the input prompt |
| **Decode** | Token generation (tg) | Memory bandwidth | tokens/sec of output |

Prefill is fast (parallelizable over the prompt). Decode is slow (sequential — each token depends on the previous). Almost all optimizations below affect decode speed more than prefill.

## Step 1: GPU Offload (Biggest Gain)

If you have a GPU, set `--n-gpu-layers 99` first, then tune everything else.

```bash
llama-cli -m model.gguf --n-gpu-layers 99
```

This alone typically yields 5–20× faster decode. See [GPU Acceleration](/kb/ai/llama-cpp/gpu-acceleration/) for details.

## Step 2: Flash Attention

Flash Attention is an algorithmically optimized attention kernel that reduces KV memory usage from O(n²) to O(n), which allows longer contexts without quadratic slowdown.

```bash
llama-cli -m model.gguf --flash-attn
```

**Impact**: 
- Reduces VRAM usage for large contexts (often 30–50%)
- Speeds up prefill by 1.3–2× at long contexts
- Minimal difference at short contexts (< 2048 tokens)
- Supported on CUDA, Metal, and Vulkan backends

## Step 3: CPU Thread Tuning

The `--threads` flag controls inference threads. There is an optimal value that is **not** "maximum":

```bash
# Rule: Set to physical core count, not logical (HT/SMT) count
llama-cli -m model.gguf --threads 8 --threads-batch 16
```

| Flag | Recommendation |
|------|---------------|
| `--threads` / `-t` | Physical cores (not HT threads) |
| `--threads-batch` / `-tb` | All logical threads (physical × 2) |

### Finding Your Core Count

```bash
# Linux
lscpu | grep -E "^CPU\(s\)|Thread.*core|Core.*socket"

# macOS
sysctl -n hw.physicalcpu    # physical
sysctl -n hw.logicalcpu     # logical
```

### Thread Count Benchmark Loop

```bash
for t in 2 4 6 8 12 16; do
  echo -n "threads=$t: "
  ./build/bin/llama-bench -m model.gguf -t $t -n 64 | grep -oP "\d+\.\d+ t/s" | tail -1
done
```

### Thread Contention Warning

Setting threads higher than physical cores often **hurts** performance on CPU-bound workloads due to cache thrashing. On a 12-core CPU: use `-t 12`, not `-t 24`.

## Step 4: Batch Size Tuning

| Flag | Controls | Typical Sweet Spot |
|------|---------|-------------------|
| `--batch-size` / `-b` | Logical batch for prompt processing | 512–2048 |
| `--ubatch-size` / `-ub` | Physical micro-batch (VRAM-limited) | 128–512 |

```bash
# Larger batch = faster prefill, more VRAM
llama-server -m model.gguf -b 2048 -ub 512
```

Increasing `-b` improves prompt processing speed. Increasing `-ub` beyond VRAM capacity causes OOM. Start with `-ub 512` and halve it if you get OOM errors.

## Step 5: KV Cache Quantization

The KV cache (key-value cache) stores intermediary attention states. On long contexts it can use as much VRAM as the model itself. Quantizing it reduces VRAM significantly with minimal quality loss:

```bash
llama-cli -m model.gguf \
  --cache-type-k q8_0 \
  --cache-type-v q8_0
```

| KV Type | Memory | Quality |
|---------|--------|---------|
| `f16` (default) | 100% | Reference |
| `q8_0` | 50% | Near-identical |
| `q4_0` | 25% | Slightly degraded; use if needed |

**VRAM for KV cache (7B model, Q8_0 keys/values)**:
| Context | KV VRAM |
|---------|---------|
| 4096 tokens | ~0.8 GB |
| 16384 tokens | ~3.2 GB |
| 32768 tokens | ~6.4 GB |
| 131072 tokens | ~26 GB |

## Step 6: Memory Mapping Flags

| Flag | Default | Behavior |
|------|---------|----------|
| `--mmap` | ON | Model is memory-mapped; OS pages tensors in on demand. Fast start, low RAM use. |
| `--no-mmap` | — | Load entire model into RAM upfront. Slower start, but more consistent timing. |
| `--mlock` | OFF | Pin model in RAM so OS never swaps it out. Requires elevated limits. |

### When to Use `--no-mmap`

- Benchmarking (consistent timing, no OS paging artifacts)
- Model loaded over network filesystem (NFS, SMB)
- When Windows shows erratic performance

### Enabling `--mlock` on Linux

```bash
# Temporarily increase locked memory limit
ulimit -l unlimited
./build/bin/llama-cli -m model.gguf --mlock

# Permanently edit /etc/security/limits.conf
# username hard memlock unlimited
```

## Step 7: RoPE Scaling for Extended Context

Many models have a max context defined in their GGUF metadata, but can be run at longer contexts by scaling the Rotary Position Embedding (RoPE) frequencies.

```bash
# LLaMA-3.1 extended to 128K context (official)
llama-cli -m llama-3.1-8b.gguf \
  --ctx-size 131072 \
  --rope-freq-base 500000

# Linear scaling (extend by 4×)
llama-cli -m model.gguf \
  --ctx-size 16384 \
  --rope-scaling linear \
  --rope-freq-scale 0.25

# YaRN scaling (higher quality than linear)
llama-cli -m model.gguf \
  --ctx-size 32768 \
  --rope-scaling yarn \
  --rope-yarn-orig-ctx 4096
```

| Scaling Type | When to Use |
|-------------|------------|
| `linear` | 2–4× context extension; fast, some degradation |
| `yarn` | Best quality for 4–16× extension |
| `ntk` | Good alternative to YaRN |

## Step 8: Prompt Caching

If you run many inferences with the same long system prompt, cache the KV state after prefill:

```bash
# First run (slow): evaluates system prompt and saves cache
llama-cli -m model.gguf \
  -f system_prompt.txt \
  --prompt-cache kv_cache.bin

# Subsequent runs (fast): load cache, skip system prompt prefill
llama-cli -m model.gguf \
  -f system_prompt.txt \
  --prompt-cache kv_cache.bin \
  -p "Now answer the question: ..."
```

## Quantization Impact on Speed

For CPU inference, lower quantization = fewer bytes per weight = faster decode:

| Quantization | Relative Decode Speed (CPU) |
|-------------|----------------------------|
| F32 | 0.25× |
| F16 | 0.5× |
| Q8_0 | 0.7× |
| Q6_K | 0.85× |
| Q4_K_M | 1.0× (reference) |
| Q3_K_M | 1.2× |
| Q2_K | 1.6× |

For GPU inference, the gains from lower quantization are smaller because the bottleneck is PCIe/NVLink transfer, not compute.

## `llama-bench` Reference

```bash
./build/bin/llama-bench \
  -m model.gguf \
  -p 512 \
  -n 128 \
  -ngl 0,99 \
  -t 4,8,16 \
  -r 3
```

| Flag | Description |
|------|-------------|
| `-p N` | Prompt tokens (tests prefill) |
| `-n N` | Generated tokens (tests decode) |
| `-ngl` | GPU layers list to test |
| `-t` | Thread counts list to test |
| `-r N` | Repetitions (average for stability) |

Sample output:
```
model             |   ngl | threads |    pp512 |   tg128 |
llama-3.1-8B Q4   |     0 |       8 |   342 t/s|  18 t/s |
llama-3.1-8B Q4   |    99 |       8 |  1840 t/s| 120 t/s |
```

## Hardware-Specific Recommendations

### Apple Silicon (M1/M2/M3/M4)

```bash
llama-cli -m model.gguf \
  --n-gpu-layers 99 \
  --flash-attn \
  --threads $(sysctl -n hw.physicalcpu)
```

- Always use full GPU offload (unified memory = no VRAM limit)
- Flash attention is fully supported and provides significant gains at long contexts

### Linux + NVIDIA GPU

```bash
llama-cli -m model.gguf \
  --n-gpu-layers 99 \
  --flash-attn \
  --cache-type-k q8_0 \
  --cache-type-v q8_0 \
  --batch-size 2048
```

### CPU-Only (x86 Linux)

```bash
llama-cli -m model-q4_k_m.gguf \
  --threads $(nproc) \
  --threads-batch $(nproc) \
  --no-mmap \
  --batch-size 512
```

Use Q4_K_M or lower quantization. Avoid Q8_0 on CPU-only if RAM < 16 GB.

### Raspberry Pi 5 (ARM64)

```bash
llama-cli -m tiny-model-q4_k_m.gguf \
  --threads 4 \
  --ctx-size 512 \
  -n 64
```

Use only tiny models (1B–3B) with aggressive quantization.

## See Also

- [GPU Acceleration](/kb/ai/llama-cpp/gpu-acceleration/) — `n-gpu-layers` and multi-GPU splits
- [Architecture & Internals](/kb/ai/llama-cpp/architecture/) — KV cache internals and threading model
- [GGUF & Quantization](/kb/ai/llama-cpp/gguf-quantization/) — quant type trade-offs
- [CLI Usage](/kb/ai/llama-cpp/cli-usage/) — all flags in one place
- [Server](/kb/ai/llama-cpp/server/) — continuous batching for concurrent requests
