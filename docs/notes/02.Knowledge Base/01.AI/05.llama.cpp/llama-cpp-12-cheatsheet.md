---
title: "Cheatsheet"
createTime: 2026/03/21 10:11:00
permalink: /kb/ai/llama-cpp/cheatsheet/
---

# llama.cpp Cheatsheet

Quick reference for installation, all key flags, server API endpoints, Python bindings, and common recipes.

## Installation

```bash
# Build from source (CPU)
git clone https://github.com/ggml-org/llama.cpp && cd llama.cpp
cmake -B build && cmake --build build --config Release -j$(nproc)

# Build with CUDA
cmake -B build -DGGML_CUDA=ON
cmake --build build --config Release -j$(nproc)

# Build with Metal (macOS — auto-detected)
cmake -B build && cmake --build build --config Release -j$(nproc)

# Build with Vulkan
cmake -B build -DGGML_VULKAN=ON
cmake --build build --config Release -j$(nproc)

# Python bindings (CPU)
pip install llama-cpp-python

# Python bindings (CUDA)
CMAKE_ARGS="-DGGML_CUDA=ON" pip install llama-cpp-python

# Download a model
pip install huggingface-hub
huggingface-cli download bartowski/Meta-Llama-3.1-8B-Instruct-GGUF \
  Meta-Llama-3.1-8B-Instruct-Q4_K_M.gguf --local-dir ./models
```

## Build Flags Quick Reference

| Flag | When to Use |
|------|------------|
| `-DGGML_CUDA=ON` | NVIDIA GPU |
| `-DGGML_METAL=ON` | Force Metal (auto on macOS) |
| `-DGGML_VULKAN=ON` | Cross-platform GPU (AMD/Intel/NVIDIA) |
| `-DGGML_HIP=ON` | AMD GPU via ROCm |
| `-DGGML_BLAS=ON` | CPU BLAS acceleration |
| `-DGGML_NATIVE=ON` | Optimize for host CPU (-march=native) |
| `-DCMAKE_CUDA_ARCHITECTURES="native"` | CUDA: auto-detect local GPU |
| `-DAMDGPU_TARGETS="gfx1100"` | ROCm: specify AMD GPU arch |

## `llama-cli` Essential Flags

### Core

| Flag | Description |
|------|-------------|
| `-m FILE` | Model path (GGUF) |
| `-p TEXT` | Prompt text |
| `-f FILE` | Prompt from file |
| `-n N` | Max tokens to generate (-1 = unlimited) |
| `-c N` | Context size |
| `-sp TEXT` | System prompt |

### GPU

| Flag | Description |
|------|-------------|
| `-ngl N` | GPU layers (99 = all) |
| `--split-mode {layer,row}` | Multi-GPU strategy |
| `--tensor-split A,B` | VRAM ratio per GPU |
| `--main-gpu N` | Primary GPU index |

### Performance

| Flag | Description |
|------|-------------|
| `-t N` | CPU threads (= physical cores) |
| `-tb N` | CPU batch threads (= logical cores) |
| `-b N` | Logical batch size |
| `-ub N` | Micro batch size |
| `-fa` | Flash Attention |
| `--mlock` | Pin model in RAM |
| `--no-mmap` | Load fully into RAM |

### KV Cache

| Flag | Description |
|------|-------------|
| `--cache-type-k TYPE` | Key cache type (f16, q8_0, q4_0) |
| `--cache-type-v TYPE` | Value cache type |
| `--keep N` | Tokens to keep on context shift |

### Sampling

| Flag | Default | Description |
|------|---------|-------------|
| `--temp N` | 0.8 | Temperature |
| `--top-p N` | 0.9 | Nucleus sampling |
| `--top-k N` | 40 | Top-K sampling |
| `--repeat-penalty N` | 1.0 | Repetition penalty |
| `-s N` | -1 | Random seed |

### Chat / Interactive

| Flag | Description |
|------|-------------|
| `-cnv` | Conversation mode (auto chat template) |
| `-i` | Interactive mode (raw) |
| `--chat-template NAME` | Template: llama3, chatml, mistral, gemma |

### Structured Output

| Flag | Description |
|------|-------------|
| `--grammar-file FILE` | GBNF grammar file |
| `--json-schema JSON` | JSON schema string |

### Context & RoPE

| Flag | Description |
|------|-------------|
| `-c N` | Context window size |
| `--rope-freq-base N` | RoPE base freq (e.g. 500000 for Llama-3.1) |
| `--rope-scaling TYPE` | linear, yarn, ntk |
| `--prompt-cache FILE` | Save/load KV cache |

### Advanced

| Flag | Description |
|------|-------------|
| `--lora FILE` | Apply LoRA adapter |
| `--lora-scaled FILE SCALE` | LoRA with scale (0.0–1.0) |
| `-r TEXT` | Stop on reverse prompt |
| `--verbose` | Verbose logging |

## `llama-server` Additional Flags

| Flag | Description |
|------|-------------|
| `--host ADDR` | Bind address (0.0.0.0 for network) |
| `--port N` | Port (default: 8080) |
| `--api-key KEY` | Require Bearer auth |
| `-np N` | Parallel slots |
| `-cb` | Continuous batching |
| `--mmproj FILE` | Multimodal projector |
| `--embedding` | Enable embedding endpoint |
| `--log-disable` | Suppress server logs |

## Server API Quick Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Server status |
| GET | `/v1/models` | List models |
| POST | `/v1/chat/completions` | OpenAI chat API |
| POST | `/v1/completions` | OpenAI text completions |
| POST | `/v1/embeddings` | Embeddings |
| POST | `/completion` | Native completion (grammar, etc.) |
| GET | `/slots` | Slot status |
| GET | `/lora-adapters` | List loaded LoRAs |

### Minimal Curl Examples

```bash
# Chat
curl localhost:8080/v1/chat/completions \
  -d '{"messages":[{"role":"user","content":"Hi"}]}'

# Embed
curl localhost:8080/v1/embeddings \
  -d '{"input":"text to embed"}'

# Stream chat
curl localhost:8080/v1/chat/completions \
  -d '{"messages":[{"role":"user","content":"Count to 5"}],"stream":true}'

# Grammar-constrained
curl localhost:8080/completion \
  -d '{"prompt":"List 3 colors as JSON array:","grammar":"root ::= \"[\" items \"]\"\nitems ::= string | string \",\" items\nstring ::= \"\\\"\"\ [a-z]+ \"\\\"\""}'
```

## Python Bindings Quick Reference

```python
from llama_cpp import Llama

# Load
llm = Llama(model_path="model.gguf", n_ctx=4096, n_gpu_layers=99, verbose=False)

# Complete
out = llm("Prompt here", max_tokens=128, temperature=0.7)
print(out["choices"][0]["text"])

# Chat
out = llm.create_chat_completion(
    messages=[{"role":"user","content":"Hello"}],
    max_tokens=128
)
print(out["choices"][0]["message"]["content"])

# Stream chat
for chunk in llm.create_chat_completion(messages=[...], stream=True):
    print(chunk["choices"][0]["delta"].get("content",""), end="")

# Embed
embed = Llama(model_path="embed.gguf", embedding=True)
vec = embed.create_embedding("text")["data"][0]["embedding"]

# Tokenize
tokens = llm.tokenize(b"hello world")
text = llm.detokenize(tokens)
```

## Quantization Quick Reference

| Type | Bits | 7B Size | Quality | Use When |
|------|------|---------|---------|----------|
| `F16` | 16 | 14 GB | Reference | VRAM/RAM not constrained |
| `Q8_0` | 8 | 7.2 GB | Near-perfect | Highest quality with size savings |
| `Q6_K` | 6.57 | 5.9 GB | Excellent | Quality-focused |
| `Q5_K_M` | 5.68 | 5.1 GB | Very good | Quality + size balance |
| **`Q4_K_M`** | **4.85** | **4.4 GB** | **Good** | **Default recommendation** |
| `Q4_K_S` | 4.58 | 4.1 GB | Good | Slightly smaller than Q4_K_M |
| `Q3_K_M` | 3.74 | 3.3 GB | Fair | RAM < 6 GB |
| `IQ4_XS` | 4.25 | 3.9 GB | Good | Better than Q4_K_S |
| `Q2_K` | 2.94 | 2.7 GB | Poor | Extreme space constraints only |

## Chat Templates by Model Family

| Template | Models |
|----------|--------|
| `llama3` | Llama-3.x Instruct |
| `llama2` | Llama-2-chat |
| `chatml` | Qwen, Yi, Phi-3, InternLM |
| `mistral` | Mistral/Mixtral Instruct |
| `gemma` | Gemma Instruct |
| `deepseek2` | DeepSeek-V2/V3 |
| `command-r` | Command-R, Command-R+ |
| `phi3` | Phi-3 Mini/Medium |

## Performance Checklist

- [ ] Use `--n-gpu-layers 99` if GPU is available
- [ ] Enable `--flash-attn` (`-fa`)
- [ ] Set `--threads` to physical core count
- [ ] Use `--cache-type-k q8_0 --cache-type-v q8_0` for large contexts
- [ ] Prefer Q4_K_M or Q5_K_M over Q8_0 for speed
- [ ] Set `--ctx-size` to what you actually need, not max
- [ ] Use `-b 2048` for faster prompt processing
- [ ] Enable `--cont-batching` on server with `-np 4`

## Useful Utility Commands

```bash
# Quantize a model
./build/bin/llama-quantize model-f16.gguf model-q4_k_m.gguf Q4_K_M

# Inspect a GGUF file
./build/bin/llama-gguf-info -m model.gguf

# Benchmark
./build/bin/llama-bench -m model.gguf -ngl 0,99 -t 4,8 -r 3

# Create importance matrix
./build/bin/llama-imatrix -m model-f16.gguf -f calibration.txt -o imatrix.dat

# Convert HuggingFace model
python convert_hf_to_gguf.py /hf-model-dir --outfile model.gguf --outtype f16

# Convert LoRA adapter
python convert_lora_to_gguf.py --base /hf-base --lora /peft-lora --outfile lora.gguf
```

## See Also

- [Introduction](/kb/ai/llama-cpp/introduction/) — what llama.cpp is and why you need it
- [Architecture](/kb/ai/llama-cpp/architecture/) — GGML, compute graph, backend system
- [GGUF & Quantization](/kb/ai/llama-cpp/gguf-quantization/) — format details and quant types
- [Installation & Build](/kb/ai/llama-cpp/installation-build/) — building from source
- [CLI Usage](/kb/ai/llama-cpp/cli-usage/) — complete `llama-cli` reference
- [Server](/kb/ai/llama-cpp/server/) — complete `llama-server` and REST API reference
- [Python Bindings](/kb/ai/llama-cpp/python-bindings/) — `llama-cpp-python` full guide
- [GPU Acceleration](/kb/ai/llama-cpp/gpu-acceleration/) — CUDA, Metal, Vulkan, ROCm
- [Performance Tuning](/kb/ai/llama-cpp/performance-tuning/) — systematic optimization guide
- [Advanced Features](/kb/ai/llama-cpp/advanced-features/) — grammars, vision, LoRA, speculative decoding
- [Troubleshooting](/kb/ai/llama-cpp/troubleshooting/) — error reference
