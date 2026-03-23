---
title: "Installation & Setup"
createTime: 2026/03/21 12:01:00
permalink: /kb/ai/llama-swap/installation/
---

# Installation & Setup

llama-swap is a single Go binary with no runtime dependencies. You can download a prebuilt release or build from source.

## Prerequisites

| Requirement | Notes |
|------------|-------|
| **llama-server** | Must be built and on your PATH or referenced by absolute path. See the [llama.cpp Installation guide](/kb/ai/llama-cpp/installation-build/). |
| **GGUF models** | Downloaded and accessible on disk |
| OS | Linux (x86_64, arm64), macOS (x86_64, arm64), Windows (x86_64) |

## Option 1: Download Prebuilt Binary

Visit the [Releases page](https://github.com/mostlygeek/llama-swap/releases) and download the binary for your platform.

### Linux (x86_64)

```bash
# Replace X.Y.Z with the latest version
curl -LO https://github.com/mostlygeek/llama-swap/releases/latest/download/llama-swap-linux-amd64
chmod +x llama-swap-linux-amd64

# Optionally move to PATH
sudo mv llama-swap-linux-amd64 /usr/local/bin/llama-swap
```

### Linux (ARM64 — Raspberry Pi, Apple Silicon in Docker)

```bash
curl -LO https://github.com/mostlygeek/llama-swap/releases/latest/download/llama-swap-linux-arm64
chmod +x llama-swap-linux-arm64
sudo mv llama-swap-linux-arm64 /usr/local/bin/llama-swap
```

### macOS

```bash
# Apple Silicon
curl -LO https://github.com/mostlygeek/llama-swap/releases/latest/download/llama-swap-darwin-arm64
chmod +x llama-swap-darwin-arm64
sudo mv llama-swap-darwin-arm64 /usr/local/bin/llama-swap
```

### Windows

Download `llama-swap-windows-amd64.exe` from the Releases page and place it somewhere on your PATH.

### Verify

```bash
llama-swap --version
```

## Option 2: Build from Source

Requires Go 1.21 or later.

```bash
# Install Go if needed (Linux)
wget https://go.dev/dl/go1.22.0.linux-amd64.tar.gz
sudo tar -C /usr/local -xzf go1.22.0.linux-amd64.tar.gz
export PATH=$PATH:/usr/local/go/bin

# Clone and build
git clone https://github.com/mostlygeek/llama-swap
cd llama-swap
go build -o llama-swap ./cmd/llama-swap

# Verify
./llama-swap --version
```

## Option 3: Docker

```bash
# Pull image
docker pull ghcr.io/mostlygeek/llama-swap:latest

# Run with config and models mounted
docker run -d \
  --name llama-swap \
  -p 8080:8080 \
  -v /path/to/config.yaml:/config.yaml \
  -v /path/to/models:/models \
  ghcr.io/mostlygeek/llama-swap:latest \
  --config /config.yaml

# With GPU (NVIDIA)
docker run -d \
  --name llama-swap \
  --gpus all \
  -p 8080:8080 \
  -v /path/to/config.yaml:/config.yaml \
  -v /path/to/models:/models \
  ghcr.io/mostlygeek/llama-swap:latest \
  --config /config.yaml
```

## Command-Line Flags

| Flag | Default | Description |
|------|---------|-------------|
| `--config FILE` | `config.yaml` | Path to configuration file |
| `--listen ADDR` | `:8080` | HTTP listen address |
| `--log-level LEVEL` | `info` | Logging verbosity: `debug`, `info`, `warn`, `error` |
| `--version` | — | Print version and exit |

### Examples

```bash
# Default — config.yaml in current directory, port 8080
llama-swap

# Custom config and port
llama-swap --config /etc/llama-swap/config.yaml --listen :9000

# Debug logging
llama-swap --config config.yaml --log-level debug
```

## Running as a systemd Service

Create `/etc/systemd/system/llama-swap.service`:

```ini
[Unit]
Description=llama-swap model proxy
After=network.target

[Service]
Type=simple
User=llama
WorkingDirectory=/opt/llama-swap
ExecStart=/usr/local/bin/llama-swap \
  --config /opt/llama-swap/config.yaml \
  --listen :8080
Restart=on-failure
RestartSec=5
Environment=PATH=/opt/llama.cpp/build/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now llama-swap
sudo journalctl -u llama-swap -f
```

> **PATH Note**: The `Environment=PATH=...` line must include the directory where `llama-server` lives, since systemd services don't inherit the user's PATH.

## Verifying the Setup

```bash
# Check llama-swap is running
curl http://localhost:8080/health

# List configured models
curl http://localhost:8080/v1/models

# Test a model request (triggers first load)
curl http://localhost:8080/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{"model":"llama3","messages":[{"role":"user","content":"ping"}],"max_tokens":5}'
```

You should see the model name in the `/v1/models` response and a reply in the completions response.

## See Also

- [Configuration](/kb/ai/llama-swap/configuration/) — setting up config.yaml
- [Introduction](/kb/ai/llama-swap/introduction/) — architecture overview
- [llama.cpp Installation](/kb/ai/llama-cpp/installation-build/) — building the required `llama-server` binary
- [Troubleshooting](/kb/ai/llama-swap/troubleshooting/) — startup errors and path issues
