---
title: "Troubleshooting"
createTime: 2026/03/21 12:06:00
permalink: /kb/ai/llama-swap/troubleshooting/
---

# Troubleshooting

This guide covers the most common issues encountered when running llama-swap, including startup failures, model load errors, proxy issues, and performance problems.

## Diagnostic First Steps

```bash
# 1. Run with debug logging
llama-swap --config config.yaml --log-level debug

# 2. Check llama-swap health
curl http://localhost:8080/health

# 3. Check which models are running
curl http://localhost:8080/running

# 4. Verify your config parses correctly
python3 -c "import yaml; yaml.safe_load(open('config.yaml'))" && echo "YAML OK"

# 5. Test llama-server directly (outside llama-swap)
llama-server -m /path/to/model.gguf --port 8081 &
curl http://localhost:8081/health
```

## Startup Issues

### llama-swap Exits Immediately

**Symptom**: Binary exits right away, nothing on port 8080.

**Check**: Did it print an error?

```bash
llama-swap --config config.yaml 2>&1 | head -20
```

Common causes:

| Error Message | Cause | Fix |
|--------------|-------|-----|
| `failed to parse config` | YAML syntax error | Validate YAML (see below) |
| `no such file or directory: config.yaml` | Config file not found | Use `--config /absolute/path/config.yaml` |
| `address already in use :8080` | Port conflict | Use `--listen :8081` or stop conflicting process |

### YAML Parse Error

```
Error: failed to parse config: yaml: line 5: could not find expected ':'
```

**Fix**: Validate your YAML:

```bash
python3 -c "
import yaml, sys
try:
    yaml.safe_load(open('config.yaml'))
    print('YAML OK')
except yaml.YAMLError as e:
    print(f'ERROR: {e}')
    sys.exit(1)
"
```

Common YAML mistakes:
- Tab characters instead of spaces (YAML requires spaces)
- Missing quotes around model names with special characters
- Wrong indentation on the `cmd:` line
- Unescaped `{` or `}` in command strings (must be plain, only `{PORT}` is special)

### Port Already in Use

```
Error: listen tcp :8080: bind: address already in use
```

```bash
# Find what is using port 8080
lsof -i :8080
ss -tlnp | grep 8080

# Kill it or choose a different port
llama-swap --config config.yaml --listen :8081
```

## Model Load Failures

### Health Check Timeout

```
Error: upstream health check timed out after 30s for model "llama3"
```

**Cause**: `llama-server` did not become healthy within `healthCheckTimeout` seconds.

**Fix options**:

1. **Increase timeout** for large models:
   ```yaml
   healthCheckTimeout: 120   # 2 minutes for 70B models
   ```

2. **Test `llama-server` directly** to confirm it starts at all:
   ```bash
   llama-server -m /models/model.gguf --port 8099 -ngl 99
   ```

3. **Check logs** (add `logFile` to the model config):
   ```yaml
   models:
     "llama3":
       cmd: "llama-server -m /models/model.gguf --port {PORT} -ngl 99"
       logFile: "/tmp/llama3-server.log"
   ```
   Then: `tail -f /tmp/llama3-server.log`

### `llama-server` Not Found

```
Error: exec: "llama-server": executable file not found in $PATH
```

**Fix**: Use the absolute path in `cmd`:

```yaml
models:
  "llama3":
    cmd: "/home/user/llama.cpp/build/bin/llama-server -m /models/model.gguf --port {PORT}"
```

Or add the directory to PATH in the systemd service environment:
```ini
Environment=PATH=/home/user/llama.cpp/build/bin:/usr/local/bin:/usr/bin:/bin
```

### Model File Not Found

```
# In llama-server logs:
error: failed to open model file '/models/model.gguf'
```

**Fix**: Verify the path is correct and the file is accessible by the user running llama-swap:

```bash
ls -la /models/model.gguf
# Run as the llama-swap service user:
sudo -u llama ls /models/model.gguf
```

### `{PORT}` Missing from Command

**Symptom**: llama-server fails to start; you may see a port conflict or the health check fails because the server started on the wrong address.

**Fix**: Ensure `{PORT}` (all caps, with curly braces) appears exactly once in every `cmd`:

```yaml
# Wrong
cmd: "llama-server -m model.gguf -ngl 99"

# Correct
cmd: "llama-server -m model.gguf --port {PORT} -ngl 99"
```

## Proxy / API Errors

### HTTP 404: Model Not Found

```json
{"error": "model 'gpt4' not found in config"}
```

**Cause**: The client requested a model name that doesn't exist in your `config.yaml`.

**Fix**: Check the model alias in your config:

```bash
curl http://localhost:8080/v1/models | python3 -m json.tool | grep '"id"'
```

Ensure the client uses exactly the same string as the key in `models:`.

### HTTP 503: Upstream Not Ready

```json
{"error": "upstream not ready: health check failed"}
```

**Cause**: llama-swap started the model server but it didn't respond to `/health` within the timeout.

**Steps**:
1. Increase `healthCheckTimeout`
2. Check server logs (add `logFile:` to the model)
3. Run the server command manually to check for errors

### Requests Hang Indefinitely

**Cause**: A swap is in progress — large model taking a long time to load.

**This is expected** for cold starts of large models. The client is waiting for the model to become healthy.

**Mitigation**:
- Pre-warm models: `curl http://localhost:8080/upstream/llama3/load` before sending inference requests
- Set a request timeout on the client side

### Wrong Response (Seems Like a Different Model)

**Symptom**: You requested `deepseek-coder` but the response seems like a general chat model.

**Cause**: Model swap didn't happen; a cached process from a previous session responded.

**Fix**: Force-unload all models and re-request:

```bash
curl -X DELETE http://localhost:8080/upstream/old-model-name
```

## GPU and Memory Issues

### OOM When Starting Second Model in a Group

**Symptom**: Second model in a group fails to load with CUDA OOM.

**Fix**: Reduce `--n-gpu-layers` for group members so both fit in VRAM:

```yaml
groups:
  "chat-pipeline":
    swap: true
    members: ["llama3", "nomic-embed"]

models:
  "llama3":
    # Reduced from 99 to 28 layers — partial GPU offload
    cmd: "llama-server -m /models/llama-3.1-8b.gguf --port {PORT} -ngl 28"
  "nomic-embed":
    cmd: "llama-server -m /models/nomic-embed.gguf --port {PORT} --embedding -ngl 16"
```

### Slow Model Switching

**Symptom**: Model swaps take much longer than expected.

**Causes and fixes**:

| Cause | Fix |
|-------|-----|
| Model on spinning HDD | Move models to SSD/NVMe |
| Very large model (70B+) | Use smaller quantization (Q3_K_M instead of Q5_K_M) |
| `--mlock` enabled | The OS had to page the previous model out — consider more RAM |
| GPU driver initialization | First swap is always slower due to CUDA context creation |

### llama-server Crashes Immediately (Segfault)

**Cause**: Usually a GPU driver/compatibility issue.

**Debug**:
```bash
# Run server manually with the exact command from config
llama-server -m /models/model.gguf --port 9999 -ngl 99

# Check exit code
echo "Exit: $?"
```

If it segfaults, see the [llama.cpp Troubleshooting guide](/kb/ai/llama-cpp/troubleshooting/) for GPU-specific issues.

## Connectivity Issues

### OpenWebUI Can't Connect

**Symptom**: OpenWebUI shows "connection refused" or no models listed.

**Fix checklist**:
- llama-swap must listen on `0.0.0.0`, not `127.0.0.1`, if OpenWebUI is in Docker:
  ```bash
  llama-swap --config config.yaml --listen 0.0.0.0:8080
  ```
- Use the host's LAN IP in OpenWebUI settings, not `localhost`
- If both are in Docker Compose, use the container service name as the hostname

### API Key Errors

**Symptom**: Client complains about invalid API key.

**Note**: llama-swap does not validate API keys. If you see auth errors, they may come from:
- A `--api-key` flag in your llama-server `cmd` — make sure you include the correct header in client requests
- The client library requiring a non-empty key — use any string like `"not-needed"`

## Log Analysis

Enable debug logging and capture output:

```bash
llama-swap --config config.yaml --log-level debug 2>&1 | tee llama-swap.log
```

Key log lines to look for:

| Log Pattern | Meaning |
|------------|---------|
| `starting model "llama3"` | Swap initiated |
| `model "llama3" is ready` | Health check passed, ready to serve |
| `stopping model "llama3"` | Model being unloaded |
| `health check failed` | llama-server unhealthy |
| `proxying request to :XXXXX` | Request routed to backend |

## See Also

- [Installation](/kb/ai/llama-swap/installation/) — PATH and binary location issues
- [Configuration](/kb/ai/llama-swap/configuration/) — YAML structure and `{PORT}` placeholder
- [Model Management](/kb/ai/llama-swap/model-management/) — groups and VRAM planning
- [llama.cpp Troubleshooting](/kb/ai/llama-cpp/troubleshooting/) — fixing the underlying llama-server
