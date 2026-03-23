---
title: "API Reference"
createTime: 2026/03/21 12:04:00
permalink: /kb/ai/llama-swap/api-reference/
---

# API Reference

llama-swap exposes an OpenAI-compatible REST API alongside additional management endpoints. All inference endpoints proxy directly to the underlying `llama-server` instance.

## Base URL

Default: `http://localhost:8080`

All OpenAI-compatible endpoints are under `/v1/`. llama-swap management endpoints are at the root.

## OpenAI-Compatible Endpoints

### GET /v1/models

List all models defined in `config.yaml`.

```bash
curl http://localhost:8080/v1/models
```

Response:
```json
{
  "object": "list",
  "data": [
    {"id": "llama3", "object": "model", "created": 1714000000, "owned_by": "llama-swap"},
    {"id": "deepseek-coder", "object": "model", "created": 1714000000, "owned_by": "llama-swap"},
    {"id": "nomic-embed", "object": "model", "created": 1714000000, "owned_by": "llama-swap"}
  ]
}
```

### POST /v1/chat/completions

OpenAI-compatible chat completions. Triggers model swap if the requested model is not loaded.

```bash
curl http://localhost:8080/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "llama3",
    "messages": [
      {"role": "system", "content": "You are a helpful assistant."},
      {"role": "user", "content": "Explain what a mutex is."}
    ],
    "temperature": 0.7,
    "max_tokens": 512
  }'
```

Streaming:
```bash
curl http://localhost:8080/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "llama3",
    "messages": [{"role": "user", "content": "Count to 5"}],
    "stream": true
  }'
```

### POST /v1/completions

OpenAI-compatible text completions.

```bash
curl http://localhost:8080/v1/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "deepseek-coder",
    "prompt": "def binary_search(arr, target):",
    "max_tokens": 256,
    "temperature": 0.1,
    "stop": ["\n\n"]
  }'
```

### POST /v1/embeddings

Generate embedding vectors. The target model must have been started with `--embedding`.

```bash
curl http://localhost:8080/v1/embeddings \
  -H "Content-Type: application/json" \
  -d '{
    "model": "nomic-embed",
    "input": "The quick brown fox jumps over the lazy dog"
  }'
```

Batch embeddings:
```bash
curl http://localhost:8080/v1/embeddings \
  -H "Content-Type: application/json" \
  -d '{
    "model": "nomic-embed",
    "input": [
      "First sentence to embed",
      "Second sentence to embed",
      "Third sentence to embed"
    ]
  }'
```

Response:
```json
{
  "object": "list",
  "data": [
    {"object": "embedding", "index": 0, "embedding": [0.012, -0.034, ...]},
    {"object": "embedding", "index": 1, "embedding": [0.056, -0.078, ...]},
    {"object": "embedding", "index": 2, "embedding": [0.090, -0.123, ...]}
  ],
  "model": "nomic-embed",
  "usage": {"prompt_tokens": 18, "total_tokens": 18}
}
```

## Management Endpoints

### GET /health

Returns the overall health of llama-swap and currently running model servers.

```bash
curl http://localhost:8080/health
```

Response when a model is loaded:
```json
{
  "status": "ok",
  "models": {
    "llama3": {"status": "running", "pid": 12345},
    "nomic-embed": {"status": "running", "pid": 12346}
  }
}
```

Response when no model is loaded:
```json
{"status": "ok", "models": {}}
```

### GET /running

Returns the list of currently running model names.

```bash
curl http://localhost:8080/running
```

Response:
```json
{"running": ["llama3", "nomic-embed"]}
```

Empty:
```json
{"running": []}
```

### DELETE /upstream/{model}

Force-unload a running model. Sends `SIGTERM` to the underlying `llama-server` process and frees its resources.

```bash
curl -X DELETE http://localhost:8080/upstream/llama3
```

Response:
```json
{"status": "ok", "message": "llama3 stopped"}
```

If the model is not running:
```json
{"status": "error", "message": "llama3 is not running"}
```

### GET /upstream/{model}/load

Force-load a model without sending an inference request. Useful for pre-warming a model before expected usage.

```bash
curl http://localhost:8080/upstream/llama3/load
```

Response after successful startup:
```json
{"status": "ok", "message": "llama3 is ready"}
```

### GET /swagger

Interactive Swagger UI documenting all endpoints. Accessible in a browser at:
```
http://localhost:8080/swagger
```

### GET /metrics (if enabled)

Prometheus-compatible metrics endpoint (not available in all builds).

```bash
curl http://localhost:8080/metrics
```

## Native llama-server Passthrough

llama-swap transparently proxies **all** requests to the underlying `llama-server`. This means native llama-server endpoints also work:

```bash
# Native completion endpoint (llama-server specific)
curl http://localhost:8080/completion \
  -H "Content-Type: application/json" \
  -d '{"model":"llama3","prompt":"What is Rust?","n_predict":200,"grammar":""}'

# Check slot status
curl http://localhost:8080/slots
```

The `model` field in the JSON body (or the request URL, depending on the endpoint) is used to route to the correct server.

## Authentication

If `llama-server` was started with `--api-key`, include the key in requests:

```bash
# If your config uses: --api-key mysecretkey
curl http://localhost:8080/v1/chat/completions \
  -H "Authorization: Bearer mysecretkey" \
  -H "Content-Type: application/json" \
  -d '{"model":"llama3","messages":[{"role":"user","content":"Hello"}]}'
```

llama-swap itself does not implement authentication — auth is handled by the upstream `llama-server`.

## Error Responses

| HTTP Status | Cause | Example |
|-------------|-------|---------|
| 404 | Model not found in config | `{"error":"model 'foo' not found"}` |
| 503 | Model failed to start or health check timed out | `{"error":"upstream not ready"}` |
| 500 | llama-server returned an error | Forwarded from upstream |

### Handling Model-Not-Found

```bash
curl http://localhost:8080/v1/chat/completions \
  -d '{"model":"nonexistent","messages":[{"role":"user","content":"test"}]}'

# Response:
# HTTP 404
# {"error": "model 'nonexistent' not found in config"}
```

### Handling Cold-Start Timeout

If `healthCheckTimeout` is exceeded (model takes too long to start):

```
HTTP 503
{"error": "upstream health check timed out after 30s"}
```

Fix: Increase `healthCheckTimeout` in config for large models.

## Request Flow Diagram

```
curl → llama-swap
         │
         ├─ Parse "model" from request body
         ├─ Check if model is running
         │         │
         │    NOT RUNNING
         │         │
         │    ┌────┴──────────────────┐
         │    │  Swap operation       │
         │    │  1. Stop old model(s) │
         │    │  2. Start new model   │
         │    │  3. Poll /health      │
         │    └────┬──────────────────┘
         │         │
         └─ Proxy request to upstream llama-server
                   │
              Response ──→ curl
```

## See Also

- [Integration](/kb/ai/llama-swap/integration/) — using the API with OpenAI clients, OpenWebUI, LangChain
- [Model Management](/kb/ai/llama-swap/model-management/) — force-loading, TTL, and group lifecycle
- [Configuration](/kb/ai/llama-swap/configuration/) — `healthCheckTimeout` and other timing params
- [Troubleshooting](/kb/ai/llama-swap/troubleshooting/) — 503, 404, and model startup errors
