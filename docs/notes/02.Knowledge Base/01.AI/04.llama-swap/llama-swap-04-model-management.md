---
title: "Model Management"
createTime: 2026/03/21 12:03:00
permalink: /kb/ai/llama-swap/model-management/
---

# Model Management

llama-swap manages the lifecycle of `llama-server` processes. Understanding how models are loaded, unloaded, and grouped is essential for getting the right balance between response latency and memory efficiency.

## The Swap Lifecycle

Every incoming request goes through this pipeline:

```
1. Request arrives → extract "model" field from JSON body
2. Lookup model alias in config
3. Is the model already running?
   YES → proxy request directly (fast path, ~0 ms overhead)
   NO  → trigger a swap:
         a. Stop all currently running non-persistent models
         b. Start the requested model's llama-server
         c. Wait for health check to pass
         d. Proxy the request
4. Return the response
```

The **first request** to any model incurs a cold-start penalty: the time to launch `llama-server` and load the GGUF file into memory. Subsequent requests to the same model are instant (already running).

### Typical Cold-Start Times

| Scenario | Cold-Start Latency |
|----------|--------------------|
| Small model (3B) from SSD, CPU | 1–3 s |
| Medium model (7B) from SSD, GPU | 2–5 s |
| Large model (70B) from SSD, GPU | 10–30 s |
| Any model from HDD | 2–3× slower |
| Any model, second request | < 50 ms |

## Persistent Models

Mark a model as `persist: true` to prevent it from ever being swapped out:

```yaml
models:
  "nomic-embed":
    cmd: "llama-server -m /models/nomic-embed-text-q4_k_m.gguf --port {PORT} --embedding -ngl 99"
    persist: true

  "llama3":
    cmd: "llama-server -m /models/llama-3.1-8b-q4_k_m.gguf --port {PORT} -ngl 99"
    persist: false   # default; will be stopped when swapping to another model
```

**When to use `persist: true`**:
- Embedding models used by every RAG request (benefits from always being warm)
- A small assistant model used for meta-tasks (routing, classification)
- Any model where cold-start latency is unacceptable

**Caution**: Persistent models consume VRAM/RAM permanently. Ensure your persistent models collectively fit in memory alongside any swappable model that could be active.

## TTL: Auto-Unloading Idle Models

The TTL (Time To Live) setting automatically stops an idle model server after a period of inactivity:

```yaml
# Global TTL: unload any model idle for 5 minutes
modelTTL: 300

models:
  "llava-1.6":
    cmd: "llama-server -m /models/llava.gguf --mmproj /models/mmproj.gguf --port {PORT} -ngl 99"
    ttl: 120   # Override: unload this heavy model after 2 minutes

  "llama3":
    cmd: "llama-server -m /models/llama-3.1-8b.gguf --port {PORT} -ngl 99"
    ttl: 0     # Override: never auto-unload (ignore global TTL)
```

### TTL Priority

```
Model ttl > 0    → use model's ttl
Model ttl == 0   → use global modelTTL
Global modelTTL == 0 → never auto-unload
```

### TTL Strategy Guide

| Use Case | Recommended TTL |
|----------|----------------|
| Machine with plenty of VRAM | 0 (never unload) |
| Interactive chat models | 600 s (10 min) |
| Batch/scripted pipelines | 60 s |
| Large models (70B+) used occasionally | 120 s |
| Embedding models used constantly | 0 + `persist: true` |

## Groups: Running Multiple Models Simultaneously

By default, only one model runs at a time. Use **groups** to allow multiple models to run concurrently:

```yaml
models:
  "llama3":
    cmd: "llama-server -m /models/llama-3.1-8b-q4_k_m.gguf --port {PORT} -ngl 40"
  "nomic-embed":
    cmd: "llama-server -m /models/nomic-embed-text-q4_k_m.gguf --port {PORT} --embedding -ngl 32"

groups:
  "chat-pipeline":
    swap: true
    members:
      - "llama3"
      - "nomic-embed"
```

When a request arrives for any model that is a **member of a group**, llama-swap loads all models in that group together. All group members start simultaneously and run concurrently.

### Group Swap Behavior

With `swap: true`, groups are mutually exclusive:

```
Request for "llama3" (member of "chat-pipeline"):
  → Stop any active model NOT in "chat-pipeline"
  → Start "llama3" + "nomic-embed" together (if not already running)

Request for "deepseek-coder" (not in any group):
  → Stop entire "chat-pipeline" group (both llama3 and nomic-embed)
  → Start "deepseek-coder"
```

### VRAM Planning for Groups

When using groups, all member models run simultaneously. Plan VRAM accordingly:

```
Group VRAM = sum(each model's VRAM requirement)
```

Example (RTX 4090, 24 GB VRAM):
- `llama3` (8B Q4_K_M) at 40 layers: ~3.5 GB
- `nomic-embed` (text Q4_K_M) at 32 layers: ~0.4 GB
- Total: ~3.9 GB — fits comfortably

Reduce `--n-gpu-layers` for group members to leave room for multiple models in VRAM simultaneously.

## Model Naming and Aliases

The key in `models:` is the alias that clients use in the `"model"` field of API requests. You can name models anything:

```yaml
models:
  "gpt-4":                  # Clients think they are calling GPT-4
    cmd: "llama-server -m /models/llama-3.1-70b-q4_k_m.gguf --port {PORT} -ngl 99"

  "text-embedding-ada-002": # OpenAI embedding model alias
    cmd: "llama-server -m /models/nomic-embed-text-q4_k_m.gguf --port {PORT} --embedding"
```

This allows drop-in replacement for OpenAI API calls without changing client code — just point `base_url` to llama-swap.

## Monitoring Running Models

llama-swap exposes model state information through the API:

```bash
# List defined models and their status
curl http://localhost:8080/v1/models

# Detailed health + loaded model info
curl http://localhost:8080/health

# Unload a specific model via API
curl -X DELETE http://localhost:8080/upstream/llama3
```

### Checking Which Model is Running

```bash
# The /running endpoint shows currently active models
curl http://localhost:8080/running

# Output:
# {"running": ["llama3", "nomic-embed"]}
```

## Manual Model Control

```bash
# Force-unload a model (frees its VRAM immediately)
curl -X DELETE http://localhost:8080/upstream/llama3

# Force-load a model without sending an inference request
curl http://localhost:8080/upstream/llama3/load
```

## Swap Concurrency

If two requests arrive simultaneously for **different** models (neither loaded), llama-swap serializes the swap operations — they do not race. The first request triggers the swap; the second waits until the swap completes, then proceeds.

If two requests arrive for the **same** model, the second waits for the model to become healthy, then both are served by the now-running instance.

## See Also

- [Configuration](/kb/ai/llama-swap/configuration/) — full config.yaml fields for TTL, persist, and groups
- [API Reference](/kb/ai/llama-swap/api-reference/) — endpoints for monitoring and controlling models
- [Performance Tuning](/kb/ai/llama-cpp/performance-tuning/) — tuning llama-server GPU layers within a group
- [Troubleshooting](/kb/ai/llama-swap/troubleshooting/) — model startup failures and timeout errors
