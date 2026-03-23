---
title: "Introduction to llama-swap"
createTime: 2026/03/21 12:00:00
permalink: /kb/ai/llama-swap/introduction/
---

# Introduction to llama-swap

**llama-swap** is a lightweight HTTP proxy server that sits in front of one or more `llama-server` instances and automatically swaps the active model based on the `model` field in each API request. It exposes a single OpenAI-compatible endpoint while transparently managing which model is loaded in memory at any given time.

## The Problem It Solves

Running multiple LLMs locally creates a resource management problem. You might want:

- A **coding model** (DeepSeek-Coder, CodeLlama) for code generation
- A **chat model** (Llama-3.1-8B) for general conversation
- An **embedding model** (nomic-embed-text) for RAG pipelines
- A **vision model** (LLaVA) for image analysis

Loading all of them simultaneously is impractical. A 7B Q4_K_M model uses roughly 4–5 GB of VRAM, so four such models would require 20 GB — far exceeding what most developer GPUs can hold.

Without llama-swap, you'd need to:
1. Manually restart `llama-server` with a different `--model` flag for each request
2. Run one server per model and route requests yourself
3. Use a full-featured LLM platform (Ollama, LM Studio) which adds complexity

llama-swap solves this with a minimal proxy that handles model switching automatically.

## What llama-swap Does

```
Client (OpenAI SDK / curl / OpenWebUI)
         |
         v
    llama-swap proxy  ← single API endpoint
         |
         |--- on "model: llama-3.1-8b" → starts llama-server with Llama-3.1-8B
         |--- on "model: deepseek-coder" → stops previous, starts DeepSeek-Coder
         |--- on "model: nomic-embed" → starts (or reuses) nomic-embed-text server
         |
    llama-server (llama.cpp)  ← actual inference
```

When a request arrives specifying `"model": "deepseek-coder"`, llama-swap:
1. Checks if `deepseek-coder` is already running
2. If not: stops the currently active model (freeing VRAM), then starts the `deepseek-coder` server
3. Waits for the new server to be healthy
4. Proxies the request to it and returns the response

## Key Features

| Feature | Description |
|---------|-------------|
| **OpenAI-compatible API** | Drop-in replacement for any OpenAI client (`/v1/chat/completions`, `/v1/completions`, `/v1/embeddings`) |
| **Automatic model swapping** | Zero manual intervention; swap happens on every request |
| **YAML configuration** | Map model aliases to full `llama-server` start commands |
| **Model groups** | Keep multiple models resident simultaneously if VRAM allows |
| **TTL unloading** | Auto-unload idle models after a configurable timeout |
| **Persistent models** | Pin high-priority models so they are never swapped out |
| **Health monitoring** | Built-in `/health` endpoint reflecting upstream server health |
| **Swagger UI** | Interactive API docs at `/swagger` |
| **Multimodal support** | Proxy vision models (`--mmproj`) transparently |
| **Minimal footprint** | Single Go binary, no runtime dependencies |

## When to Use llama-swap

| Scenario | Use llama-swap? |
|----------|----------------|
| Single model, always loaded | No — just run `llama-server` directly |
| Multiple models, limited VRAM | **Yes** |
| OpenWebUI or similar frontend needing multiple models | **Yes** |
| CI/automated pipeline switching models per task | **Yes** |
| Production multi-GPU inference (high QPS) | Prefer full platform (vLLM, TGI) |
| Just exploring llama.cpp | No |

## Relationship to llama.cpp

llama-swap does **not** perform inference itself. It delegates entirely to `llama-server` from llama.cpp. You must have llama.cpp built and `llama-server` available. llama-swap manages the lifecycle (start/stop) of those server processes.

```
llama-swap (Go, ~10 MB binary) → manages
llama-server (C++, llama.cpp)  → performs inference
```

## Quick Start (30 seconds)

```bash
# Install llama-swap (Linux/macOS)
curl -LO https://github.com/mostlygeek/llama-swap/releases/latest/download/llama-swap-linux-amd64
chmod +x llama-swap-linux-amd64

# Create a minimal config
cat > config.yaml << 'EOF'
models:
  "llama3":
    cmd: "/path/to/llama-server -m /models/llama-3.1-8b-q4_k_m.gguf --port {PORT} -ngl 99"
  "nomic-embed":
    cmd: "/path/to/llama-server -m /models/nomic-embed-text-q4_k_m.gguf --port {PORT} --embedding"
EOF

# Start the proxy
./llama-swap-linux-amd64 --config config.yaml --listen :8080

# Use it like any OpenAI server
curl http://localhost:8080/v1/chat/completions \
  -d '{"model":"llama3","messages":[{"role":"user","content":"Hello!"}]}'
```

## See Also

- [Installation](/kb/ai/llama-swap/installation/) — downloading, building, and running llama-swap
- [Configuration](/kb/ai/llama-swap/configuration/) — full config.yaml reference
- [Model Management](/kb/ai/llama-swap/model-management/) — groups, TTL, persistence
- [API Reference](/kb/ai/llama-swap/api-reference/) — all endpoints in detail
- [Integration](/kb/ai/llama-swap/integration/) — connecting OpenWebUI, LangChain, and more
