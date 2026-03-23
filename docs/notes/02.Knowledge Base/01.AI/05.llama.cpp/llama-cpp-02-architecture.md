---
title: "llama.cpp Architecture & Internals"
createTime: 2026/03/21 10:01:00
permalink: /kb/ai/llama-cpp/architecture/
---

# llama.cpp Architecture & Internals

llama.cpp is built on a layered architecture: a low-level tensor library (GGML), a backend abstraction layer, a model-loading pipeline, and the inference loop itself. Understanding these layers helps you reason about performance, memory usage, and how to configure the engine for your hardware.

## The GGML Tensor Library

At the bottom of the stack sits **GGML** — a C library for tensor operations and machine learning, also written by Georgi Gerganov. Everything in llama.cpp is built on top of GGML.

### What GGML Provides

- **Tensor type** (`ggml_tensor`) — a multi-dimensional array with a shape, data type, and a pointer to raw memory
- **Operations** — matrix multiplication (`ggml_mul_mat`), element-wise ops, activation functions, softmax, RoPE, attention, etc.
- **Compute graph** — a directed acyclic graph (DAG) of tensor operations
- **Scratch memory** — a stack-based allocator for intermediate tensor buffers
- **Quantized data types** — native support for Q4_K, Q5_K, Q8_0, and many others (stored and computed without dequantizing to float first)

### GGML vs. PyTorch

| Aspect | GGML | PyTorch |
|--------|------|---------|
| Language | C (no C++ stdlib) | Python / C++ |
| Dependencies | Zero | Python, NumPy, BLAS, CUDA toolkit |
| Dynamic graphs | No — graphs are pre-built | Yes (eager mode) |
| Autograd | No (inference only) | Yes |
| Custom quant types | First-class | Limited |
| Binary footprint | Single static lib (~1 MB) | Hundreds of MB |

## The Compute Graph

llama.cpp does **not** run operations eagerly. Instead, for each forward pass (each batch of tokens), it **builds a compute graph first**, then executes it.

### Graph Build Phase

For a given model and batch:

1. `llama_build_graph()` is called
2. It walks the model's layers — embeddings, attention, FFN, normalization — creating `ggml_tensor` nodes wired together by `ggml_*` operation calls
3. The result is a `ggml_cgraph` — a list of nodes in topological order

No computation happens during this phase. It is purely graph construction.

### Graph Execution Phase

1. `ggml_graph_compute()` is called on the graph
2. The backend scheduler assigns each node to the appropriate backend (CPU, CUDA, Metal, etc.)
3. Each backend executes its assigned nodes using its own optimized kernels
4. Intermediate results flow between nodes through pre-allocated buffers

### Why This Matters

- **Memory is pre-allocated** — scratch buffers and tensor memory are sized and allocated before the graph runs, so there are no heap allocations during inference
- **Backend mixing** — some layers can run on GPU and others on CPU within the same graph (partial GPU offloading)
- **Reproducible graph** — the same graph is reused across tokens (only the KV cache changes), which enables efficient caching

## Backend System

The backend abstraction allows the same model graph to run on different hardware. Each backend implements a standard interface (`ggml_backend_*`) for buffer allocation, data transfer, and kernel execution.

### Available Backends

| Backend | Flag at Build Time | Target Hardware |
|---------|--------------------|-----------------|
| CPU | Always included | x86, ARM, RISC-V (generic fallback) |
| CPU AVX/AVX2/AVX-512 | Auto-detected | Modern x86 CPUs |
| CPU NEON | Auto-detected | ARM Cortex-A / Apple Silicon CPU cores |
| CUDA | `-DGGML_CUDA=ON` | NVIDIA GPUs (sm_60+) |
| Metal | `-DGGML_METAL=ON` | Apple Silicon GPUs (M1/M2/M3/M4) |
| Vulkan | `-DGGML_VULKAN=ON` | AMD, Intel, ARM Mali (cross-platform GPU) |
| OpenCL | `-DGGML_OPENCL=ON` | Legacy GPU support |
| ROCm/HIP | `-DGGML_HIP=ON` | AMD Radeon GPUs |
| SYCL | `-DGGML_SYCL=ON` | Intel Arc GPUs |
| RPC | `-DGGML_RPC=ON` | Remote backend (offload to another machine) |

### Backend Scheduler

When multiple backends are available (e.g., CPU + CUDA), the `ggml_backend_sched` scheduler decides which backend runs which tensor operations. The heuristic:

1. Tensors that fit within GPU VRAM are placed on the GPU backend
2. The remaining tensors (overflow layers) are placed on the CPU backend
3. Transfers between GPU and CPU are injected automatically

This is how **partial GPU offloading** works — you can set `--n-gpu-layers 20` on a model with 32 layers, and layers 0–19 run entirely on GPU while layers 20–31 run on CPU.

## Model Loading Pipeline

When you run `llama-cli -m model.gguf`, here is exactly what happens:

### 1. GGUF File Parsing

```
File -> gguf_init_from_file()
     -> Read magic bytes: "GGUF" (4 bytes)
     -> Read version, tensor count, metadata count
     -> Parse metadata key-value pairs (model name, architecture, context length, etc.)
     -> Build tensor map (name -> offset + shape + type)
```

The file is **memory-mapped** (`mmap`) — not physically loaded into RAM. The OS pages tensors in on demand.

### 2. Model Initialization

- Architecture is detected from the metadata (`general.architecture` key)
- A model struct is allocated matching the detected architecture
- Hyperparameters are read: `n_embd`, `n_head`, `n_layer`, `n_ctx_train`, `rope_freq_base`, etc.

### 3. Tensor Loading

For each tensor in the GGUF file:
- If **GPU offload layers** are configured, tensors for those layers are copied into GPU VRAM
- Remaining tensors stay as mmap pointers into the file — they are read from disk on demand (but rapidly cached by the OS)

### 4. Context Allocation

```
llama_new_context_with_model()
  -> Allocate KV cache (key-value tensors for all attention heads x context length)
  -> Allocate compute scratch buffers
  -> Initialize sampling state
```

The KV cache is the largest variable-size allocation — it grows with context length and number of layers.

## Inference Loop: Prefill and Decode

Transformer inference has two distinct phases that llama.cpp handles differently:

### Prefill Phase (Processing the Prompt)

- All prompt tokens are processed in a **single batched forward pass**
- Tokens: T0, T1, T2, ... Tn processed together
- The attention mechanism sees the full prompt context at once
- KV cache is filled for all prompt positions
- This phase is **compute-bound** — throughput depends on available FLOPS

### Decode Phase (Token-by-Token Generation)

- One new token is generated per forward pass
- The new token attends to all previous KV cache entries
- This phase is **memory-bandwidth-bound** — every decode pass must read all model weights + KV cache
- Speed is measured in **tokens/second**

### Why This Split Matters for Performance

On CPU: a large batch size during prefill maximizes SIMD utilization. During decode, throughput is limited by how fast RAM bandwidth can feed the weights to the CPU.

On GPU: prefill is highly parallelizable across GPU cores. Decode is still bottlenecked by VRAM bandwidth, which is why GPUs with high HBM bandwidth (H100, A100) excel.

## KV Cache

The KV (Key-Value) cache stores the attention keys and values computed for all previous tokens so they don't need to be recomputed each decode step.

### Memory Footprint

For a 7B LLaMA model with default f16 KV, 4096 context:

- Layers: 32, Embedding dim: 4096, Context: 4096, dtype: f16 (2 bytes)
- KV size = 2 x 32 x 4096 x 4096 x 2 = ~2 GB

This is in **addition** to model weights. For long contexts (32K, 128K), the KV cache easily dominates memory usage.

### KV Cache Quantization

llama.cpp supports quantized KV caches to reduce this footprint:

- `--cache-type-k q8_0` — 8-bit keys (~50% memory reduction vs f16)
- `--cache-type-k q4_0` — 4-bit keys (~75% memory reduction, quality impact)
- `--cache-type-v q8_0` — 8-bit values

See [Performance Tuning](/kb/ai/llama-cpp/performance-tuning/) for recommended settings.

## Threading Model

On the CPU backend, llama.cpp uses a manual thread pool. The number of threads used for matrix multiplications is controlled by `-t` / `--threads`.

- **`--threads`** — threads used for generation (decode phase); default = physical cores
- **`--threads-batch`** — threads used for prompt processing (prefill phase); defaults to `--threads`

These two are often set differently because prefill benefits from more threads while decode is memory-bandwidth-limited and does not scale as well beyond physical core count.

## Memory Layout and mlock

By default, model weights are memory-mapped — the OS pages them in as needed from the GGUF file:

- **Cold start**: first inference reads from disk into the page cache
- **Warm start**: subsequent inferences read from RAM (OS page cache)
- **`--mlock`**: forces the OS to pin all model pages in RAM, preventing swap eviction
- **`--no-mmap`**: copies weights directly into heap-allocated buffers instead of mapping the file

## See Also

- [GGUF & Quantization](/kb/ai/llama-cpp/gguf-quantization/) — the file format and how quantized types are stored
- [GPU Acceleration](/kb/ai/llama-cpp/gpu-acceleration/) — how CUDA, Metal, and Vulkan backends integrate into this pipeline
- [Performance Tuning](/kb/ai/llama-cpp/performance-tuning/) — thread counts, batch sizes, KV cache tuning
- [Installation & Build](/kb/ai/llama-cpp/installation-build/) — build flags that control which backends are compiled in
