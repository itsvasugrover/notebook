---
title: "GPU Acceleration"
createTime: 2026/03/21 10:07:00
permalink: /kb/ai/llama-cpp/gpu-acceleration/
---

# GPU Acceleration

GPU acceleration is the most impactful single change you can make to llama.cpp inference speed. GPU memory bandwidth is the primary bottleneck for decode speed — modern GPUs are 20–100× faster than CPUs at moving model weights through the compute units.

## Why GPU Acceleration Matters

| Hardware | Memory Bandwidth | Relative Decode Speed |
|----------|-----------------|----------------------|
| Core i7-13700K (DDR5) | ~80 GB/s | 1× (baseline) |
| Apple M2 (unified) | ~100 GB/s | ~1.2× |
| RTX 3090 (GDDR6X) | ~936 GB/s | ~8× |
| RTX 4090 (GDDR6X) | ~1008 GB/s | ~10× |
| H100 SXM (HBM3) | ~3350 GB/s | ~30× |

Inference decode is **memory-bandwidth bound** — the GPU spends most of its time reading model weights, not computing matrix products. More bandwidth = more tokens per second.

## The `--n-gpu-layers` Flag

This is the primary GPU control. It specifies how many transformer layers to place on the GPU backend.

| Value | Behavior |
|-------|----------|
| `0` | CPU-only (default) |
| `1` to N | Partial offload: first N layers on GPU |
| `-1` or `999` | Offload all layers (recommended when VRAM fits the model) |

### Layer Counts by Model

| Model | Total Layers |
|-------|-------------|
| 3B (Llama-3.2) | 28 |
| 7B / 8B (Llama-3.1) | 32 |
| 13B | 40 |
| 34B (CodeLlama) | 48 |
| 70B (Llama-3.1) | 80 |
| 405B (Llama-3.1) | 126 |

```bash
# Full GPU offload — all layers on GPU
llama-cli -m model.gguf --n-gpu-layers 99

# Partial offload — first 20 layers on GPU, rest on CPU
llama-cli -m model.gguf --n-gpu-layers 20
```

## Estimating VRAM Requirements

```
VRAM needed ≈ model_file_size × 1.1 + KV_cache

KV cache = 2 × ctx_size × n_layers × n_heads × head_dim × dtype_bytes
```

Approximate VRAM for full offload of Q4_K_M models:

| Model | Q4_K_M Size | VRAM Needed |
|-------|------------|-------------|
| 3B | ~2.0 GB | ~2.2 GB |
| 7B / 8B | ~4.4 GB | ~4.9 GB |
| 13B | ~7.9 GB | ~8.7 GB |
| 70B | ~40 GB | ~44 GB |

Rule of thumb: **VRAM ≈ GGUF file size + 10% overhead**.

## Partial Offload Behavior

When GPU VRAM isn't enough for the full model, partial offloading still helps. The first N layers go to GPU, remaining layers stay on CPU. Execution alternates between GPU and CPU per layer.

- Tokens/second scales roughly linearly with fraction offloaded
- Example: RTX 3050 (8GB) running 13B model (8.7 GB needed): offload ~32/40 layers → ~80% of full GPU speed

## CUDA Backend (NVIDIA)

### Requirements

- NVIDIA GPU (SM 5.0+ / Maxwell or newer)
- CUDA Toolkit 11.8 or 12.x must be installed (`nvcc --version` to verify)
- `libcuda.so` / `nvcuda.dll` present at runtime

### Usage

```bash
./build/bin/llama-cli \
  -m model.gguf \
  --n-gpu-layers 99 \
  --flash-attn
```

### Multi-GPU: Layer Split

```bash
# Distribute layers across GPUs proportionally (default: equal)
./build/bin/llama-server \
  -m model.gguf \
  --n-gpu-layers 80 \
  --split-mode layer

# Custom split: GPU 0 gets 75%, GPU 1 gets 25% of layers
./build/bin/llama-server \
  -m model.gguf \
  --n-gpu-layers 80 \
  --tensor-split 3,1
```

### Multi-GPU: Row Split (`--split-mode row`)

Row split divides individual tensors across GPUs rather than splitting at the layer boundary. This reduces inter-GPU communication and is typically better for models where layer split causes GPU stalls.

### CUDA-Specific Flags

| Flag | Description |
|------|-------------|
| `--main-gpu N` | Which GPU to use for computation that doesn't split |
| `--split-mode {layer,row,none}` | Multi-GPU tensor distribution strategy |
| `--tensor-split S,S,...` | Memory ratio per GPU |

### CUDA VRAM Fragmentation Fix

If you get `cudaMalloc failed: out of memory` despite seemingly having enough VRAM:

```bash
# Set memory pool fraction to avoid fragmentation
GGML_CUDA_MALLOC_MAX_SIZE_FRACTION=0.95 ./build/bin/llama-cli -m model.gguf -ngl 99
```

## Metal Backend (Apple Silicon)

### How It Works

On Apple Silicon (M1/M2/M3/M4), the CPU and GPU share the same DRAM — **unified memory**. This means Metal can use all system RAM as VRAM. A MacBook with 64 GB RAM can fully offload a 70B Q4_K_M model that would require a $10,000 NVIDIA GPU otherwise.

### Usage

```bash
# Metal is auto-detected; just set n-gpu-layers
./build/bin/llama-cli \
  -m model.gguf \
  --n-gpu-layers 99
```

### Apple Silicon Performance (rough estimates, Q4_K_M)

| Chip | Bandwidth | 7B tok/s | 13B tok/s |
|------|-----------|----------|----------|
| M1 | 68 GB/s | ~35 tok/s | ~18 tok/s |
| M2 | 100 GB/s | ~50 tok/s | ~27 tok/s |
| M3 | 120 GB/s | ~60 tok/s | ~32 tok/s |
| M3 Max | 300 GB/s | ~100 tok/s | ~55 tok/s |

### Metal Notes

- `--flash-attn` is supported and recommended
- First run is slower (Metal shader compilation is cached after first use)
- Do not use `GGML_METAL=OFF` unless debugging

## Vulkan Backend

Vulkan is a cross-platform graphics API that works on NVIDIA, AMD, and Intel GPUs. Use it when CUDA or ROCm is unavailable.

### When to Use Vulkan

- AMD GPU on Windows (ROCm has limited Windows support)
- Intel Arc GPU (no CUDA, no ROCm)
- Linux AMD when ROCm installation is impractical
- Any GPU on a system without vendor SDK installed

### Usage

```bash
./build/bin/llama-cli -m model.gguf --n-gpu-layers 99
# Vulkan device is auto-selected

# List available Vulkan devices
GGML_VULKAN_DEVICE=list ./build/bin/llama-cli -m model.gguf --n-gpu-layers 1

# Select specific device
GGML_VULKAN_DEVICE=1 ./build/bin/llama-cli -m model.gguf --n-gpu-layers 99
```

### Vulkan vs CUDA Performance

Vulkan is typically 10–30% slower than CUDA for the same NVIDIA GPU due to lower-level optimization. Use CUDA when available.

## ROCm / HIP Backend (AMD)

### Supported AMD GPUs

| Architecture | GPUs |
|-------------|------|
| RDNA 3 (gfx1100) | RX 7900 XTX/XT, RX 7800 XT |
| RDNA 2 (gfx1030) | RX 6900/6800/6700 XT |
| RDNA/Vega | RX 5700/5600, Radeon VII |
| CDNA (data center) | MI50, MI100, MI200, MI300 |

### Usage

```bash
./build/bin/llama-cli \
  -m model.gguf \
  --n-gpu-layers 99

# Use specific AMD GPU
HIP_VISIBLE_DEVICES=0 ./build/bin/llama-cli -m model.gguf --n-gpu-layers 99
```

### ROCm vs Vulkan for AMD

| Scenario | Recommendation |
|----------|---------------|
| Linux + supported RDNA 2/3 GPU | ROCm (significantly faster) |
| Windows + AMD GPU | Vulkan (ROCm Windows support is limited) |
| Unsupported AMD GPU | Vulkan |

## Benchmarking with `llama-bench`

```bash
./build/bin/llama-bench \
  -m model.gguf \
  -n 128 \
  -ngl 0,99 \
  -t 4,8
```

Output columns:
| Column | Meaning |
|--------|---------|
| `pp` | Prompt processing (prefill) speed [tokens/s] |
| `tg` | Token generation (decode) speed [tokens/s] |
| `n_gpu_layers` | Number of GPU layers |
| `n_threads` | CPU thread count |

```
model           |   ngl | threads |    pp512 |   tg128 |
Llama-3.1-8B Q4 |     0 |       8 |   342 t/s|  18 t/s |
Llama-3.1-8B Q4 |    99 |       8 |  1840 t/s| 120 t/s |
```

## See Also

- [Installation & Build](/kb/ai/llama-cpp/installation-build/) — building with CUDA/Metal/Vulkan/ROCm flags
- [Performance Tuning](/kb/ai/llama-cpp/performance-tuning/) — flash attention, batch sizes, thread tuning
- [Architecture & Internals](/kb/ai/llama-cpp/architecture/) — backend abstraction and how tensors are routed
- [Troubleshooting](/kb/ai/llama-cpp/troubleshooting/) — GPU memory errors and driver issues
