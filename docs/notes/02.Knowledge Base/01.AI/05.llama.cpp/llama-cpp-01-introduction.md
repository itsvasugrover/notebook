---
title: "Introduction to llama.cpp"
createTime: 2026/03/21 10:00:00
permalink: /kb/ai/llama-cpp/introduction/
---

# Introduction to llama.cpp

**llama.cpp** is an open-source inference engine for Large Language Models (LLMs) written in pure C/C++. Its singular goal is to run state-of-the-art language models on commodity hardware — a laptop CPU, a Raspberry Pi, or a developer workstation — with zero dependency on Python, PyTorch, or CUDA. Created by Georgi Gerganov in January 2023, it sparked an entire ecosystem that made local AI practical for the first time.

## The Problem It Solves

Before llama.cpp, running a capable LLM required:

- A powerful NVIDIA GPU (24 GB+ VRAM for a 13B model)
- A Python environment with PyTorch (multi-GB install)
- TensorFlow or Hugging Face Transformers setup overhead
- Cloud API access (and its associated cost and privacy concerns)

This created a hard barrier: AI was only accessible in the cloud or in well-resourced research labs. llama.cpp broke that barrier.

### What Makes It Possible

The key insight behind llama.cpp is **quantization** — representing model weights in lower precision (4-bit integers instead of 32-bit floats). A 7-billion-parameter model that would normally require ~28 GB of VRAM can be reduced to ~4 GB running entirely on a CPU, with only a modest quality loss.

## Key Capabilities

- **CPU-first inference** — runs on any x86, ARM, or Apple Silicon chip; no GPU required
- **GGUF model format** — a portable, memory-mappable file format for quantized models
- **Multiple backends** — CPU (AVX/AVX2/AVX-512), CUDA (NVIDIA), Metal (Apple), Vulkan, OpenCL, ROCm
- **OpenAI-compatible REST server** — drop-in replacement for the OpenAI API (`llama-server`)
- **Python bindings** — `llama-cpp-python` exposes the full API to Python and integrates with LangChain and llama-index
- **Grammar-constrained generation** — force JSON, XML, or any structured output format
- **Multimodal support** — vision models (LLaVA) for image + text understanding
- **LoRA adapter support** — apply fine-tuned adapters without re-quantizing the base model
- **Speculative decoding** — use a small draft model to accelerate output from a large model
- **Zero external dependencies** — one `cmake` build, one binary, done

## Origin Story

On January 10, 2023, Meta released the weights for LLaMA-1. Within days, Georgi Gerganov — the same developer behind `whisper.cpp` — ported the entire inference stack to C++ using his GGML tensor library. The original commit ran a 7B model at **several tokens per second on a MacBook M1** — something that had previously required expensive cloud compute.

The project exploded on GitHub. The community immediately contributed:
- CUDA support (GPU offloading within weeks)
- Quantization schemes (4-bit, 3-bit, 2-bit)
- Windows builds
- REST server (`llama-server`)
- Python bindings (`llama-cpp-python`)

Today llama.cpp supports dozens of model architectures: LLaMA, Mistral, Mixtral, Phi, Gemma, Qwen, DeepSeek, Command-R, and many more.

## Position in the AI Ecosystem

llama.cpp occupies a unique position. It is **not** a training framework — it only does inference. Compare it to alternatives:

| Tool | Language | GPU Required | Focus |
|------|----------|-------------|-------|
| **llama.cpp** | C/C++ | No (optional) | CPU-first local inference |
| Ollama | Go (wraps llama.cpp) | No | User-friendly local LLM manager |
| vLLM | Python | Yes (NVIDIA) | High-throughput server, production scale |
| HuggingFace Transformers | Python | Recommended | Research, fine-tuning, broad model support |
| TensorRT-LLM | C++/Python | Yes (NVIDIA) | NVIDIA-optimized production inference |
| ExLlamaV2 | Python/C++ | Yes (NVIDIA) | Fast quantized inference on NVIDIA GPUs |

**Key distinction from Ollama:** Ollama uses llama.cpp under the hood as its inference engine but wraps it in a model management layer with a daemon, model registry, and simpler CLI. llama.cpp is the lower-level engine that gives you full control.

## Who Should Use llama.cpp

| Persona | Why llama.cpp |
|---------|--------------|
| Embedded / edge developer | Runs on ARM Cortex-A, Raspberry Pi, custom SoCs |
| Privacy-conscious developer | Fully local, no data leaves the machine |
| macOS / Apple Silicon user | Metal backend makes Mac GPUs first-class citizens |
| DevOps / self-hosting | Single static binary, minimal footprint, no Python runtime |
| AI researcher on CPU-only hardware | Fastest path to running a 7B–70B model without cloud |
| Integration developer | OpenAI-compatible API server for drop-in use |

## Supported Model Architectures (as of 2026)

llama.cpp supports a broad and growing list of transformer architectures:

- **LLaMA family** — LLaMA 1/2/3, Llama 3.1/3.2/3.3
- **Mistral family** — Mistral 7B, Mistral-NeMo, Mixtral (MoE)
- **Phi family** — Phi-2, Phi-3, Phi-3.5
- **Gemma family** — Gemma 2B/7B, Gemma 2
- **Qwen family** — Qwen2, Qwen2.5
- **DeepSeek** — DeepSeek-R1, DeepSeek-V3
- **Command-R** — Cohere Command-R, Command-R+
- **Falcon, MPT, GPT-2, GPT-NeoX, BLOOM** and many others
- **Multimodal** — LLaVA, BakLLaVA, MoondreamV2, InternVL

New architectures are usually contributed by the community within days of model releases.

## Quick Start (30 Seconds)

```bash
# 1. Build (CPU only — no GPU required)
git clone https://github.com/ggerganov/llama.cpp
cd llama.cpp
cmake -B build && cmake --build build --config Release -j$(nproc)

# 2. Download a GGUF model (e.g. Llama-3.2-3B-Instruct)
huggingface-cli download \
  bartowski/Llama-3.2-3B-Instruct-GGUF \
  Llama-3.2-3B-Instruct-Q4_K_M.gguf

# 3. Run inference
./build/bin/llama-cli \
  -m Llama-3.2-3B-Instruct-Q4_K_M.gguf \
  -p "Explain what a transformer neural network is in simple terms"
```

That is all it takes to run a billion-parameter language model locally.

## See Also

- [Architecture & Internals](/kb/ai/llama-cpp/architecture/) — how GGML, the compute graph, and backends work under the hood
- [GGUF & Quantization](/kb/ai/llama-cpp/gguf-quantization/) — the model file format and all quantization types explained
- [Installation & Build](/kb/ai/llama-cpp/installation-build/) — full build guide for all platforms and GPU backends
- [CLI Usage](/kb/ai/llama-cpp/cli-usage/) — using `llama-cli` and all its flags
- [Server Mode](/kb/ai/llama-cpp/server/) — running the OpenAI-compatible REST API server
