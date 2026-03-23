---
title: "Cheatsheet"
createTime: 2026/03/21 12:07:00
permalink: /kb/ai/llama-swap/cheatsheet/
---

# llama-swap Cheatsheet

Quick reference for installation, config schema, all endpoints, and common recipes.

## Installation

```bash
# Download binary (Linux x86_64)
curl -LO https://github.com/mostlygeek/llama-swap/releases/latest/download/llama-swap-linux-amd64
chmod +x llama-swap-linux-amd64 && sudo mv llama-swap-linux-amd64 /usr/local/bin/llama-swap

# Build from source (requires Go 1.21+)
git clone https://github.com/mostlygeek/llama-swap && cd llama-swap
go build -o llama-swap ./cmd/llama-swap

# Docker
docker run -d --name llama-swap -p 8080:8080 \
  -v ./config.yaml:/config.yaml -v /models:/models \
  ghcr.io/mostlygeek/llama-swap:latest --config /config.yaml
```

## Launch Command

```bash
llama-swap [flags]

Flags:
  --config FILE      Config file path (default: config.yaml)
  --listen ADDR      Listen address (default: :8080)
  --log-level LEVEL  debug | info | warn | error  (default: info)
  --version          Print version
```

## Minimal config.yaml

```yaml
models:
  "llama3":
    cmd: "llama-server -m /models/llama-3.1-8b-q4_k_m.gguf --port {PORT} -ngl 99"
```

## Full config.yaml Schema

```yaml
# Global settings
healthCheckTimeout: 30       # seconds to wait for server startup
healthCheckInterval: 500     # ms between health polls
modelTTL: 0                  # global idle TTL (0 = never unload)

models:
  "alias":
    cmd: "llama-server -m /path/to/model.gguf --port {PORT} [flags]"
    persist: false           # never auto-unload if true
    ttl: 0                   # per-model TTL override (0 = use global)
    logFile: "/tmp/alias.log" # redirect server stdout/stderr

groups:
  "group-name":
    swap: true               # swap group atomically
    members:
      - "alias-1"
      - "alias-2"
```

## Common Model Configs

```yaml
models:
  # General chat (GPU, flash attention, parallel slots)
  "llama3":
    cmd: >
      llama-server -m /models/llama-3.1-8b-instruct-q4_k_m.gguf
      --port {PORT} -ngl 99 --flash-attn -c 8192 -np 2 --cont-batching

  # Coding model
  "deepseek-coder":
    cmd: >
      llama-server -m /models/deepseek-coder-v2-lite-q4_k_m.gguf
      --port {PORT} -ngl 99 --flash-attn -c 16384

  # Embedding model (always loaded)
  "nomic-embed":
    cmd: "llama-server -m /models/nomic-embed-text-q4_k_m.gguf --port {PORT} --embedding -ngl 99"
    persist: true

  # Vision model (auto-unload after 2 min)
  "llava":
    cmd: >
      llama-server -m /models/llava-v1.6-q4_k_m.gguf
      --mmproj /models/llava-v1.6-mmproj-f16.gguf
      --port {PORT} -ngl 99
    ttl: 120

  # Small fast model (never unload)
  "llama3-3b":
    cmd: "llama-server -m /models/llama-3.2-3b-q4_k_m.gguf --port {PORT} -ngl 99"
    persist: true

# Run chat + embed together
groups:
  "rag-pipeline":
    swap: true
    members: ["llama3", "nomic-embed"]
```

## API Endpoints Quick Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Overall health + running models |
| GET | `/running` | List of currently running model names |
| GET | `/v1/models` | List all configured models |
| POST | `/v1/chat/completions` | OpenAI chat API (triggers swap) |
| POST | `/v1/completions` | OpenAI text completions |
| POST | `/v1/embeddings` | Embeddings (model must have `--embedding`) |
| DELETE | `/upstream/{model}` | Force-unload a running model |
| GET | `/upstream/{model}/load` | Force-load a model |
| GET | `/swagger` | Interactive API docs |

## curl Recipes

```bash
# Health check
curl http://localhost:8080/health

# List models
curl http://localhost:8080/v1/models | python3 -m json.tool

# Chat
curl http://localhost:8080/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{"model":"llama3","messages":[{"role":"user","content":"Hello"}],"max_tokens":100}'

# Stream chat
curl http://localhost:8080/v1/chat/completions \
  -d '{"model":"llama3","messages":[{"role":"user","content":"Count to 5"}],"stream":true}'

# Embed
curl http://localhost:8080/v1/embeddings \
  -d '{"model":"nomic-embed","input":"text to embed"}'

# Force unload
curl -X DELETE http://localhost:8080/upstream/llama3

# Pre-warm (load without inference)
curl http://localhost:8080/upstream/llama3/load
```

## Python Quick Start

```python
from openai import OpenAI

client = OpenAI(base_url="http://localhost:8080/v1", api_key="not-needed")

# Chat
response = client.chat.completions.create(
    model="llama3",
    messages=[{"role": "user", "content": "Hello"}]
)
print(response.choices[0].message.content)

# Embed
vec = client.embeddings.create(model="nomic-embed", input="hello").data[0].embedding

# Stream
for chunk in client.chat.completions.create(model="llama3", messages=[...], stream=True):
    print(chunk.choices[0].delta.content or "", end="")
```

## Integration Summary

| Tool | Config |
|------|--------|
| OpenAI SDK | `base_url="http://localhost:8080/v1", api_key="not-needed"` |
| LangChain | `ChatOpenAI(base_url="...", model="alias")` |
| OpenWebUI | Settings → Connections → API Base URL: `http://localhost:8080/v1` |
| Continue.dev | `"apiBase": "http://localhost:8080/v1"` in config.json |
| llama-index | `api_base="http://localhost:8080/v1"` |
| env vars | `OPENAI_API_BASE=http://localhost:8080/v1` |

## OAI Alias Trick (Drop-in Replacement)

Name your models to match OpenAI model names for fully transparent switching:

```yaml
models:
  "gpt-4o":
    cmd: "llama-server -m /models/llama-3.1-70b-q4_k_m.gguf --port {PORT} -ngl 99"
  "gpt-4o-mini":
    cmd: "llama-server -m /models/llama-3.2-3b-q4_k_m.gguf --port {PORT} -ngl 99"
  "text-embedding-3-small":
    cmd: "llama-server -m /models/nomic-embed-text-q4_k_m.gguf --port {PORT} --embedding"
    persist: true
```

## Quick Troubleshooting

| Symptom | Fix |
|---------|-----|
| `binary not found` | Use absolute path in `cmd:` |
| `address in use` | Change `--listen` port or kill existing process |
| `YAML parse error` | Validate with `python3 -c "import yaml; yaml.safe_load(open('config.yaml'))"` |
| `health check timeout` | Increase `healthCheckTimeout:` / add `logFile:` to debug |
| `model not found` | Check alias matches exactly what client sends |
| `OOM in group` | Reduce `-ngl` for each group member |
| `{PORT} not substituted` | Ensure `{PORT}` (uppercase, with braces) is in `cmd:` |

## See Also

- [Introduction](/kb/ai/llama-swap/introduction/) — architecture and use cases
- [Installation](/kb/ai/llama-swap/installation/) — download and systemd service
- [Configuration](/kb/ai/llama-swap/configuration/) — full config.yaml reference
- [Model Management](/kb/ai/llama-swap/model-management/) — TTL, groups, persistence
- [API Reference](/kb/ai/llama-swap/api-reference/) — all endpoints in detail
- [Integration](/kb/ai/llama-swap/integration/) — OpenWebUI, LangChain, Continue.dev
- [Troubleshooting](/kb/ai/llama-swap/troubleshooting/) — error reference
- [llama.cpp Introduction](/kb/ai/llama-cpp/introduction/) — the underlying inference engine
