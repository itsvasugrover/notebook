---
title: "llama-server: HTTP API"
createTime: 2026/03/21 10:05:00
permalink: /kb/ai/llama-cpp/server/
---

# llama-server: HTTP API

`llama-server` is an HTTP server that exposes an OpenAI-compatible REST API. It handles concurrent requests through continuous batching, making it the right choice for applications, chatbots, and any multi-user scenario.

## Starting the Server

### Minimal

```bash
./build/bin/llama-server -m model.gguf
```

This starts the server on `http://127.0.0.1:8080` with 4096 context, 1 parallel slot, and CPU-only inference.

### Production Example

```bash
./build/bin/llama-server \
  --model ./models/llama-3.1-8b-instruct-q4_k_m.gguf \
  --host 0.0.0.0 \
  --port 8080 \
  --ctx-size 16384 \
  --n-parallel 4 \
  --n-gpu-layers 99 \
  --flash-attn \
  --cont-batching \
  --log-disable
```

## Server Configuration Flags

### Model and Context

| Flag | Description |
|------|-------------|
| `-m / --model FILE` | GGUF model file path **(required)** |
| `-c / --ctx-size N` | Total context size (must be `n-parallel × max_tokens` or larger) |
| `--n-predict N` | Hard limit on tokens per request (-1 = unlimited) |
| `--cache-type-k TYPE` | KV cache type for keys (f16, q8_0, q4_0) |
| `--cache-type-v TYPE` | KV cache type for values |

### Network

| Flag | Default | Description |
|------|---------|-------------|
| `--host ADDR` | 127.0.0.1 | Bind address (use 0.0.0.0 for network access) |
| `--port N` | 8080 | Listening port |
| `--timeout N` | 600 | Request timeout in seconds |
| `--api-key KEY` | — | Require `Authorization: Bearer KEY` header |
| `--ssl-key-file` | — | TLS private key |
| `--ssl-cert-file` | — | TLS certificate |

### Throughput and Parallelism

| Flag | Default | Description |
|------|---------|-------------|
| `--n-parallel N` / `-np N` | 1 | Concurrent request slots |
| `--cont-batching` / `-cb` | OFF | Enable continuous batching |
| `--batch-size N` / `-b N` | 2048 | Logical batch size |
| `--ubatch-size N` / `-ub N` | 512 | Physical batch size |

### GPU

| Flag | Description |
|------|-------------|
| `--n-gpu-layers N` / `-ngl N` | Layers to offload |
| `--split-mode MODE` | `none`, `layer`, `row` |
| `--tensor-split RATIOS` | GPU memory ratios (e.g. `3,1` for 75%/25%) |
| `--main-gpu N` | Primary GPU index |
| `--flash-attn` / `-fa` | Enable Flash Attention |

## API Endpoints

### Health Check

```bash
curl http://localhost:8080/health
```

Response: `{"status": "ok"}` (or `"loading model"` while initializing)

### List Models

```bash
curl http://localhost:8080/v1/models
```

### Chat Completions (OpenAI-Compatible)

```bash
curl http://localhost:8080/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "llama-3.1-8b-instruct",
    "messages": [
      {"role": "system", "content": "You are a helpful assistant."},
      {"role": "user", "content": "What is the capital of France?"}
    ],
    "temperature": 0.7,
    "max_tokens": 256
  }'
```

Response structure:
```json
{
  "id": "chatcmpl-...",
  "object": "chat.completion",
  "created": 1714000000,
  "model": "llama-3.1-8b-instruct",
  "choices": [{
    "index": 0,
    "message": {
      "role": "assistant",
      "content": "The capital of France is Paris."
    },
    "finish_reason": "stop"
  }],
  "usage": {
    "prompt_tokens": 28,
    "completion_tokens": 9,
    "total_tokens": 37
  }
}
```

### Text Completions

```bash
curl http://localhost:8080/v1/completions \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "def fibonacci(n):",
    "max_tokens": 200,
    "temperature": 0.2,
    "stop": ["\n\n"]
  }'
```

### Embeddings

```bash
curl http://localhost:8080/v1/embeddings \
  -H "Content-Type: application/json" \
  -d '{
    "input": "The quick brown fox",
    "model": "nomic-embed-text"
  }'
```

### Native Completion Endpoint

The `/completion` endpoint (not `/v1/completions`) exposes server-native parameters:

```bash
curl http://localhost:8080/completion \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "What is Rust?",
    "n_predict": 300,
    "temperature": 0.7,
    "grammar": "",
    "json_schema": null,
    "stream": false
  }'
```

Native-only parameters: `grammar`, `json_schema`, `samplers`, `mirostat`, `ignore_eos`, `cache_prompt`.

### Slot Status

```bash
curl http://localhost:8080/slots
```

Returns the state of each parallel slot (idle, processing, or waiting).

## Streaming Responses

Set `"stream": true` to receive Server-Sent Events (SSE):

```bash
curl http://localhost:8080/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [{"role": "user", "content": "Count to 5"}],
    "stream": true
  }'
```

Each SSE event looks like:
```
data: {"choices":[{"delta":{"content":"1"},"index":0}]}

data: {"choices":[{"delta":{"content":","},"index":0}]}

data: [DONE]
```

## Continuous Batching

With `--cont-batching`, the server can insert new requests mid-generation rather than queuing them. Combined with `--n-parallel N`, this dramatically improves throughput.

**Sizing rule**: set `--ctx-size` to at least `n-parallel × expected_max_tokens`:
```bash
# 4 parallel slots, max 4096 tokens each = 16384 total context
--n-parallel 4 --ctx-size 16384
```

## Using with OpenAI Client Libraries

### Python `openai` Package

```python
from openai import OpenAI

client = OpenAI(
    base_url="http://localhost:8080/v1",
    api_key="not-needed"  # required by client, ignored by server (unless --api-key set)
)

response = client.chat.completions.create(
    model="llama",
    messages=[{"role": "user", "content": "Explain async/await in Python"}],
    temperature=0.7,
    max_tokens=512
)
print(response.choices[0].message.content)
```

### Streaming

```python
stream = client.chat.completions.create(
    model="llama",
    messages=[{"role": "user", "content": "Write a haiku about code"}],
    stream=True
)
for chunk in stream:
    if chunk.choices[0].delta.content:
        print(chunk.choices[0].delta.content, end="", flush=True)
```

### LangChain

```python
from langchain_openai import ChatOpenAI

llm = ChatOpenAI(
    base_url="http://localhost:8080/v1",
    api_key="not-needed",
    model="llama"
)
result = llm.invoke("What is a neural network?")
```

## Running as a systemd Service

Create `/etc/systemd/system/llama-server.service`:

```ini
[Unit]
Description=llama.cpp HTTP server
After=network.target

[Service]
Type=simple
User=llama
WorkingDirectory=/opt/llama.cpp
ExecStart=/opt/llama.cpp/build/bin/llama-server \
  --model /opt/models/llama-3.1-8b-instruct-q4_k_m.gguf \
  --host 0.0.0.0 \
  --port 8080 \
  --ctx-size 8192 \
  --n-parallel 2 \
  --n-gpu-layers 99 \
  --cont-batching \
  --log-disable
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now llama-server
sudo journalctl -u llama-server -f
```

## See Also

- [CLI Usage](/kb/ai/llama-cpp/cli-usage/) — for single-prompt usage without a server
- [Python Bindings](/kb/ai/llama-cpp/python-bindings/) — embed inference directly in Python without the server
- [GPU Acceleration](/kb/ai/llama-cpp/gpu-acceleration/) — maximizing server throughput with GPU
- [Performance Tuning](/kb/ai/llama-cpp/performance-tuning/) — continuous batching, context sizing
- [Advanced Features](/kb/ai/llama-cpp/advanced-features/) — grammars and JSON schema via server API
