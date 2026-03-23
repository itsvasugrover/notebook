---
title: "CLI Usage"
createTime: 2026/03/21 10:04:00
permalink: /kb/ai/llama-cpp/cli-usage/
---

# CLI Usage

`llama-cli` is the command-line inference binary. It handles one-shot prompts, interactive chat sessions, prompt caching, and structured output — all without running a server.

## Quick Reference

```bash
# Single prompt, print response, exit
./build/bin/llama-cli -m model.gguf -p "Explain what a tensor is"

# Interactive chat session (conversational)
./build/bin/llama-cli -m model.gguf -cnv

# Read prompt from file
./build/bin/llama-cli -m model.gguf -f prompt.txt

# GPU-accelerated inference
./build/bin/llama-cli -m model.gguf -p "Hello" --n-gpu-layers 99
```

## Core Flags

### Model and Input

| Flag | Short | Description |
|------|-------|-------------|
| `--model` | `-m` | Path to GGUF model file **(required)** |
| `--prompt` | `-p` | Prompt string |
| `--file` | `-f` | Read prompt from file |
| `--system-prompt` | `-sp` | System prompt text |
| `--in-prefix` | | Prefix appended before every user input |
| `--in-suffix` | | Suffix appended after every user input |
| `--reverse-prompt` | `-r` | Stop and return control on this string |

### Output Control

| Flag | Short | Description |
|------|-------|-------------|
| `--n-predict` | `-n` | Max tokens to generate (-1 = infinite) |
| `--no-display-prompt` | | Suppress prompt echo on non-interactive mode |
| `--log-disable` | | Disable progress/status output |
| `--verbose` | `-v` | Verbose logging to stderr |

## Context and Memory Flags

| Flag | Description |
|------|-------------|
| `--ctx-size N` / `-c N` | Context window size (default: 4096 or model max) |
| `--rope-scaling TYPE` | RoPE scaling type: `linear`, `yarn`, `ntk` |
| `--rope-freq-base N` | RoPE base frequency (override for extended context) |
| `--rope-freq-scale N` | RoPE frequency scale factor |
| `--mlock` | Lock model in RAM (prevents swapping) |
| `--no-mmap` | Disable memory mapping (load fully into RAM) |
| `--keep N` | Number of initial tokens to keep on context shift |

## Sampling Parameters

Sampling controls how the model chooses the next token:

| Flag | Default | Description |
|------|---------|-------------|
| `--temp` / `-t` | 0.8 | Temperature: 0 = deterministic, >1 = creative |
| `--top-p` | 0.9 | Nucleus sampling cutoff |
| `--top-k` | 40 | Top-K sampling (0 = disabled) |
| `--min-p` | 0.0 | Minimum probability cutoff |
| `--repeat-penalty` | 1.0 | Penalize repeated tokens (1.1–1.3 typical) |
| `--repeat-last-n` | 64 | Window for repeat penalty |
| `--mirostat` | 0 | Mirostat mode: 0 (off), 1, or 2 |
| `--mirostat-lr` | 0.1 | Mirostat learning rate (eta) |
| `--mirostat-ent` | 5.0 | Mirostat target entropy (tau) |
| `--seed` / `-s` | -1 | RNG seed (-1 = random) |

### Temperature Guide

| Temperature | Behavior | Best For |
|-------------|----------|----------|
| 0.0 | Greedy (deterministic) | Classification, extraction |
| 0.1–0.4 | Focused, less varied | Code generation, factual Q&A |
| 0.7–0.9 | Balanced | Chat, general purpose |
| 1.0–1.2 | More creative | Brainstorming, creative writing |
| >1.5 | Unpredictable/random | Experimentation only |

## Performance Flags

| Flag | Description |
|------|-------------|
| `--threads N` / `-t N` | CPU inference threads (default: system count) |
| `--threads-batch N` / `-tb N` | CPU threads for prompt processing |
| `--batch-size N` / `-b N` | Logical batch size for prompt processing |
| `--ubatch-size N` / `-ub N` | Physical micro-batch size |
| `--flash-attn` / `-fa` | Enable Flash Attention (reduces KV memory) |
| `--n-gpu-layers N` / `-ngl N` | Layers to offload to GPU |
| `--split-mode` | Multi-GPU split: `none`, `layer` (default), `row` |
| `--tensor-split` | Comma-separated GPU memory ratios |
| `--main-gpu N` | Primary GPU index (default: 0) |

## Interactive Chat Mode

Interactive mode keeps the model loaded and accepts input repeatedly:

```bash
./build/bin/llama-cli \
  -m model.gguf \
  -cnv \
  --chat-template llama3
```

Important interactive flags:

| Flag | Description |
|------|-------------|
| `-cnv` | Conversation mode (applies chat template automatically) |
| `-i` | Interactive mode (raw; you control prefixes) |
| `--interactive-first` | Wait for user input before generating |
| `--chat-template NAME` | Built-in chat template to use |
| `--multiline-input` | Allow multi-line input (end with `\`) |
| `--color` | Colorize output (user input vs model output) |

### Built-in Chat Templates

| Template Name | Models |
|---------------|--------|
| `llama2` | Llama-2-chat models |
| `llama3` | Llama-3 and 3.1 Instruct |
| `chatml` | Qwen, Yi, phi-3, many others |
| `mistral` | Mistral Instruct, Mixtral |
| `gemma` | Gemma Instruct |
| `deepseek2` | DeepSeek-V2/V3 |
| `command-r` | Cohere Command-R |
| `phi3` | Microsoft Phi-3 |
| `orion` | OrionStar models |
| `zephyr` | Zephyr models |

Most models include their chat template inside the GGUF file; llama.cpp reads it automatically. Use `--chat-template` only to override.

### In-Session Commands

While in interactive mode, type these commands at the prompt:

| Command | Action |
|---------|--------|
| `/clear` | Clear conversation history |
| `/save <filename>` | Save conversation to file |
| `/load <filename>` | Load saved conversation |
| `Ctrl+C` | Interrupt current generation |
| `Ctrl+D` | Exit session |

### Custom System Prompt

```bash
./build/bin/llama-cli \
  -m model.gguf \
  -cnv \
  --chat-template chatml \
  -sp "You are a senior C++ engineer. Answer concisely and show code examples."
```

## Prompt Caching

Prompt caching saves the KV cache state after prefill so repeated or shared prompt prefixes skip re-evaluation:

```bash
# First run: computes and saves the cache
./build/bin/llama-cli \
  -m model.gguf \
  -f base_context.txt \
  --prompt-cache cache.bin \
  -n 200

# Subsequent runs: reuses the saved cache
./build/bin/llama-cli \
  -m model.gguf \
  -f base_context.txt \
  --prompt-cache cache.bin \
  --prompt-cache-all \
  -p "Based on the above context, ..."
```

| Flag | Description |
|------|-------------|
| `--prompt-cache FILE` | Path to cache file |
| `--prompt-cache-ro` | Read-only; don't update cache |
| `--prompt-cache-all` | Save all tokens (not just the prefix) |

## Stop Sequences

Stop sequences tell the model to stop generating when a specific string is produced:

```bash
# Stop at triple-backtick to capture just the code block
./build/bin/llama-cli \
  -m model.gguf \
  -p "Write a Python hello world function:
\`\`\`python" \
  -r "\`\`\`"
```

Multiple stop sequences: repeat `--reverse-prompt` / `-r` flags.

## Typical Workflows

### Code Generation

```bash
./build/bin/llama-cli \
  -m codellama-7b-instruct.gguf \
  -p "[INST] Write a Python function to parse a JSON file and return a list of dicts. [/INST]" \
  --temp 0.2 \
  --top-p 0.9 \
  --repeat-penalty 1.1 \
  -n 512
```

### Document Summarization

```bash
./build/bin/llama-cli \
  -m model.gguf \
  -f long_document.txt \
  -p "\n\nSummarize the above document in 5 bullet points:" \
  --temp 0.3 \
  -n 300
```

### JSON Output

```bash
./build/bin/llama-cli \
  -m model.gguf \
  -p 'Extract person name and age from: "Alice is 34 years old". Respond in JSON:' \
  --json-schema '{"type":"object","properties":{"name":{"type":"string"},"age":{"type":"integer"}}}' \
  --temp 0
```

## See Also

- [Server](/kb/ai/llama-cpp/server/) — HTTP API for multi-user / OpenAI-compatible access
- [GPU Acceleration](/kb/ai/llama-cpp/gpu-acceleration/) — `--n-gpu-layers` in depth
- [Performance Tuning](/kb/ai/llama-cpp/performance-tuning/) — threads, batch size, flash attention
- [Advanced Features](/kb/ai/llama-cpp/advanced-features/) — grammars, vision models, LoRA
- [Cheatsheet](/kb/ai/llama-cpp/cheatsheet/) — all flags at a glance
