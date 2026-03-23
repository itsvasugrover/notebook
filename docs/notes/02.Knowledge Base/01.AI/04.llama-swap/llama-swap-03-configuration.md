---
title: "Configuration Reference"
createTime: 2026/03/21 12:02:00
permalink: /kb/ai/llama-swap/configuration/
---

# Configuration Reference

llama-swap is configured through a YAML file (default: `config.yaml`). This file defines every model llama-swap can serve and the exact `llama-server` command used to start it.

## Minimal Config

```yaml
models:
  "llama3":
    cmd: "llama-server -m /models/llama-3.1-8b-instruct-q4_k_m.gguf --port {PORT} -ngl 99"
```

This defines one model named `"llama3"`. When a request arrives with `"model": "llama3"`, llama-swap runs the specified command, substituting `{PORT}` with a free port it allocates, then proxies the request to that server.

## Full Configuration Schema

```yaml
# ─────────────────────────────────────────────────────────────
# Top-level settings
# ─────────────────────────────────────────────────────────────

# How long to wait for a model server to become healthy after starting (seconds)
healthCheckTimeout: 30

# Polling interval when waiting for health (milliseconds)
healthCheckInterval: 500

# Automatically stop an idle model after this many seconds (0 = never)
# Can be overridden per-model
modelTTL: 0

# ─────────────────────────────────────────────────────────────
# Model definitions
# ─────────────────────────────────────────────────────────────
models:
  "model-alias":
    # Shell command to start the llama-server instance.
    # {PORT} is replaced with the allocated port number.
    cmd: "llama-server -m /path/to/model.gguf --port {PORT}"

    # Keep this model always loaded; never auto-unload it (default: false)
    persist: false

    # Override global TTL for this model (seconds, 0 = use global)
    ttl: 0

    # Path to log file for this model's llama-server output
    # Omit to discard server output (recommended for production)
    logFile: "/var/log/llama-swap/model-alias.log"

    # Proxy request path prefix override (advanced; default: inferred)
    proxy: ""

# ─────────────────────────────────────────────────────────────
# Model groups (run multiple models simultaneously)
# ─────────────────────────────────────────────────────────────
groups:
  "group-name":
    # Swap entire group atomically; only one group active at a time
    swap: true
    members:
      - "model-alias-1"
      - "model-alias-2"
```

## The `{PORT}` Placeholder

`{PORT}` is **mandatory** in every `cmd`. llama-swap allocates a free port and substitutes it before starting the server. This prevents port conflicts when multiple models are running simultaneously (in a group) or being cycled.

```yaml
# Correct
cmd: "llama-server -m model.gguf --port {PORT} -ngl 99"

# Wrong — hard-coded port causes conflicts
cmd: "llama-server -m model.gguf --port 8081 -ngl 99"
```

## Complete Example

```yaml
healthCheckTimeout: 60
healthCheckInterval: 1000
modelTTL: 300    # Unload models idle for 5 minutes

models:
  # ── Chat models ──────────────────────────────────────────
  "llama-3.1-8b":
    cmd: >
      llama-server
      -m /models/llama-3.1-8b-instruct-q4_k_m.gguf
      --port {PORT}
      -ngl 99
      --flash-attn
      -c 8192
      -np 2
      --cont-batching
    persist: false
    ttl: 600

  "llama-3.2-3b":
    cmd: >
      llama-server
      -m /models/llama-3.2-3b-instruct-q4_k_m.gguf
      --port {PORT}
      -ngl 99
      -c 4096

  # ── Coding models ────────────────────────────────────────
  "deepseek-coder":
    cmd: >
      llama-server
      -m /models/deepseek-coder-v2-lite-instruct-q4_k_m.gguf
      --port {PORT}
      -ngl 99
      --flash-attn
      -c 16384

  # ── Embedding models ─────────────────────────────────────
  "nomic-embed":
    cmd: >
      llama-server
      -m /models/nomic-embed-text-v1.5-q4_k_m.gguf
      --port {PORT}
      --embedding
      -ngl 99
    persist: true    # Always keep embedding model loaded

  # ── Vision models ────────────────────────────────────────
  "llava-1.6":
    cmd: >
      llama-server
      -m /models/llava-v1.6-mistral-7b-q4_k_m.gguf
      --mmproj /models/llava-v1.6-mistral-7b-mmproj-f16.gguf
      --port {PORT}
      -ngl 99
    ttl: 120

groups:
  # Run both the chat and embed model simultaneously
  "chat-with-embed":
    swap: true
    members:
      - "llama-3.1-8b"
      - "nomic-embed"
```

## Configuration Fields Reference

### Top-Level Fields

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `healthCheckTimeout` | int | 30 | Seconds to wait for a server to become healthy |
| `healthCheckInterval` | int | 500 | Milliseconds between health check polls |
| `modelTTL` | int | 0 | Global idle TTL in seconds (0 = never unload) |

### Per-Model Fields

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `cmd` | string | *required* | Full shell command to start `llama-server`; must include `{PORT}` |
| `persist` | bool | false | If true, this model is never auto-unloaded due to TTL or swapping |
| `ttl` | int | 0 | Per-model idle TTL override (seconds, 0 = use global) |
| `logFile` | string | — | Write server stdout/stderr to this file |
| `proxy` | string | — | Custom path prefix for proxying (advanced) |

### Group Fields

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `swap` | bool | true | Swap the whole group atomically |
| `members` | list | *required* | Model aliases included in this group |

## YAML Multi-Line Commands

For readability, use YAML block scalars or folded scalars for long commands:

```yaml
# Block scalar (literal — newlines preserved, use trailing space for continuation)
cmd: |
  llama-server   -m /models/model.gguf   --port {PORT}

# Folded scalar (newlines become spaces — preferred)
cmd: >
  llama-server
  -m /models/model.gguf
  --port {PORT}
  -ngl 99
  -c 8192
```

The folded scalar (`>`) is cleanest: each line becomes a space, so the final command is one long string.

## Environment Variables in Config

Standard shell variable expansion is **not** performed. Use absolute paths or ensure the PATH in the launch environment includes the correct directories. Alternatively, write a wrapper script:

```bash
#!/bin/bash
# /opt/scripts/start-llama.sh
export LD_LIBRARY_PATH=/usr/local/cuda/lib64:$LD_LIBRARY_PATH
exec /opt/llama.cpp/build/bin/llama-server "$@"
```

```yaml
models:
  "model":
    cmd: "/opt/scripts/start-llama.sh -m /models/model.gguf --port {PORT} -ngl 99"
```

## Validating Config

llama-swap does not have a dedicated validate command, but you can perform a dry-run check:

```bash
# Start with debug logging and immediately request /v1/models
llama-swap --config config.yaml --log-level debug &
sleep 1
curl http://localhost:8080/v1/models
```

If the model list returns the names defined in your config, the YAML parsed correctly. Any YAML syntax errors will crash llama-swap at startup with a parse error message.

## See Also

- [Model Management](/kb/ai/llama-swap/model-management/) — groups, TTL, and persistence in depth
- [Installation](/kb/ai/llama-swap/installation/) — command-line flags
- [API Reference](/kb/ai/llama-swap/api-reference/) — endpoints available once llama-swap is running
- [Troubleshooting](/kb/ai/llama-swap/troubleshooting/) — YAML parse errors and server startup failures
