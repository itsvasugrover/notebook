---
title: "Advanced Features"
createTime: 2026/03/21 10:09:00
permalink: /kb/ai/llama-cpp/advanced-features/
---

# Advanced Features

This guide covers capabilities beyond basic text generation: constrained output via grammars, vision/multimodal models, embeddings, LoRA adapters, speculative decoding, and extended context via context shifting.

## Grammar-Constrained Generation

llama.cpp can constrain model output to match a formal grammar, ensuring the model always produces valid JSON, SQL, or any custom format — regardless of which model you use.

### GBNF Grammar Format

Grammars are defined in GBNF (GGML BNF), a variant of Backus-Naur Form:

```gbnf
# Grammar for a name-age JSON object
root   ::= "{" ws name-kv "," ws age-kv "}"
name-kv ::= ""name"" ws ":" ws string
age-kv  ::= ""age"" ws ":" ws number
string  ::= """ [a-zA-Z ]+ """
number  ::= [0-9]+
ws     ::= [ \t\n]*
```

Built-in grammars (in the `grammars/` directory):

| File | Constrains output to |
|------|---------------------|
| `json.gbnf` | Any valid JSON value |
| `json_arr.gbnf` | JSON array of objects |
| `list.gbnf` | Markdown bullet list |
| `chess.gbnf` | UCI chess moves |
| `c.gbnf` | C code |
| `arithmetic.gbnf` | Arithmetic expressions |

### Using Grammars via CLI

```bash
# Use built-in JSON grammar
llama-cli -m model.gguf \
  -p "List 3 European capitals as JSON array of objects with name and country:" \
  --grammar-file grammars/json_arr.gbnf

# Custom grammar file
llama-cli -m model.gguf \
  -p "Generate a task:" \
  --grammar-file my_task.gbnf
```

### JSON Schema Mode (Easiest)

Instead of writing a grammar, provide a JSON Schema directly:

```bash
llama-cli -m model.gguf \
  -p "Extract: Alice is 34, senior engineer at Acme Corp" \
  --json-schema '{"type":"object","properties":{"name":{"type":"string"},"age":{"type":"integer"},"title":{"type":"string"},"company":{"type":"string"}},"required":["name","age"]}'
```

### Via the Server API

```bash
curl http://localhost:8080/completion \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Generate a color in hex format:",
    "grammar": "root ::= \"#\" [0-9a-fA-F]{6}"
  }'
```

Or with JSON schema:

```bash
curl http://localhost:8080/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [{"role":"user","content":"Generate 3 user records"}],
    "response_format": {
      "type": "json_object",
      "schema": {
        "type":"array",
        "items":{"type":"object","properties":{"id":{"type":"integer"},"name":{"type":"string"},"email":{"type":"string"}}}
      }
    }
  }'
```

## Multimodal: LLaVA and Vision Models

llama.cpp supports **LLaVA** (Large Language and Vision Assistant) and similar multimodal architectures that combine a vision encoder with a language model.

### Supported Multimodal Models

| Model | Type | Notes |
|-------|------|-------|
| LLaVA-1.5 | Image + text | Original architecture |
| LLaVA-1.6 / LLaVA-NeXT | Image + text | Improved tiles |
| MobileVLM | Lightweight | Mobile-optimized |
| Qwen2-VL | Image + text | Strong OCR capability |
| InternVL2 | Image + text | High benchmark scores |
| SmolVLM | 256M–2B | Very small and fast |

### File Requirements

Multimodal models require **two files**:
1. **Language model** GGUF (`model.gguf`)
2. **Multimodal projector** GGUF (`mmproj-model.gguf`) — encodes images into the language model space

```bash
# Download both files for LLaVA-1.6
huggingface-cli download mys/ggml_llava-v1.5-7b \
  ggml-model-q4_k.gguf \
  mmproj-model-f16.gguf
```

### Using `llava-cli`

```bash
./build/bin/llava-cli \
  -m ggml-model-q4_k.gguf \
  --mmproj mmproj-model-f16.gguf \
  --image photo.jpg \
  -p "Describe what you see in this image"
```

### Multimodal via Server API

```bash
curl http://localhost:8080/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [{
      "role": "user",
      "content": [
        {"type": "text", "text": "What is in this image?"},
        {"type": "image_url", "image_url": {"url": "data:image/jpeg;base64,<BASE64_DATA>"}}
      ]
    }]
  }'
```

Start the server with both model files:
```bash
llama-server \
  -m ggml-model-q4_k.gguf \
  --mmproj mmproj-model-f16.gguf \
  --port 8080
```

## Embeddings

Embeddings convert text into dense numeric vectors for semantic search, RAG pipelines, and clustering.

### Recommended Embedding Models

| Model | Dimensions | Notes |
|-------|-----------|-------|
| `nomic-embed-text-v1.5` | 768 | Good balance; 8192 token ctx |
| `mxbai-embed-large-v1` | 1024 | High quality; 512 token ctx |
| `all-MiniLM-L6-v2` | 384 | Fast and small |
| `gte-large` | 1024 | Strong multilingual |
| `bge-m3` | 1024 | Multilingual, supports 8192 ctx |

### CLI: `llama-embedding`

```bash
./build/bin/llama-embedding \
  -m nomic-embed-text-v1.5-q4_k_m.gguf \
  --log-disable \
  -p "The quick brown fox"
```

### Server API: POST /v1/embeddings

```bash
curl http://localhost:8080/v1/embeddings \
  -d '{"input": "text to embed", "model": "nomic-embed-text"}'
```

Start embedding server:
```bash
llama-server -m nomic-embed-text-v1.5-q4_k_m.gguf --embedding
```

### Normalization

Always L2-normalize embedding vectors before similarity comparison:

```python
import numpy as np

def normalize(v):
    return v / np.linalg.norm(v)

a = normalize(np.array(embedding_a))
b = normalize(np.array(embedding_b))
similarity = np.dot(a, b)  # cosine similarity
```

## LoRA Adapters

LoRA (Low-Rank Adaptation) is a parameter-efficient fine-tuning technique. You can load LoRA adapters on top of a base GGUF model to get fine-tuned behavior without a separate full model.

### Runtime LoRA Application

```bash
# Apply a single LoRA adapter
llama-cli -m base-model.gguf \
  --lora lora-adapter.gguf \
  -p "Continue the story..."

# Apply with custom scale (1.0 = full strength)
llama-cli -m base-model.gguf \
  --lora lora-adapter.gguf \
  --lora-scaled 0.7

# Stack multiple LoRA adapters
llama-cli -m base-model.gguf \
  --lora lora-style.gguf \
  --lora lora-persona.gguf
```

### Converting LoRA Weights

```bash
# Convert a HuggingFace PEFT LoRA to GGUF
python convert_lora_to_gguf.py \
  --base /path/to/base-hf-model \
  --lora /path/to/peft-lora \
  --outfile lora-adapter.gguf
```

### Via Server API

```bash
curl http://localhost:8080/v1/chat/completions \
  -d '{
    "messages": [{"role":"user","content":"Write a Hemingway-style short story opening"}],
    "lora": [{"id": 0, "scale": 1.0}]
  }'
```

List available LoRAs pre-loaded in the server with `GET /lora-adapters`.

## Speculative Decoding

Speculative decoding uses a small, fast **draft model** to predict multiple tokens ahead, which the large **target model** then verifies in parallel. When the draft is correct, multiple tokens are emitted per step — giving effectively more than 1 token per target model step.

### How It Works

1. Draft model generates N candidate tokens cheaply
2. Target model evaluates all N candidates in a single parallel pass
3. For each correct candidate, accept + advance; reject the first mismatch
4. Repeat

Expected speedup: 1.5–3× for well-matched model pairs.

### Using `llama-speculative`

```bash
./build/bin/llama-speculative \
  -m target-llama-3.1-70b-q4.gguf \
  --model-draft draft-llama-3.2-1b-q8.gguf \
  --n-gpu-layers 80 \
  --draft-n-gpu-layers 32 \
  -p "Write a technical blog post about Rust async" \
  -n 512
```

### Draft Model Selection

| Target Model | Recommended Draft | Expected Speedup |
|-------------|-----------------|-----------------|
| Llama-3.1-70B | Llama-3.2-1B-Instruct | 1.5–2× |
| Llama-3.1-8B | Llama-3.2-1B-Instruct | 1.3–1.8× |
| Mixtral-8x7B | Mistral-7B | 1.4–1.9× |

Draft model must be from the **same model family** to have useful token alignment.

## Context Shifting (Infinite Context Approximation)

When the context fills up, llama.cpp can **shift the window** forward, discarding old tokens while retaining recent context:

```bash
llama-cli -m model.gguf \
  --ctx-size 4096 \
  --keep 256 \      # Keep first 256 tokens (typically the system prompt)
  -i
```

`--keep N` preserves the first N tokens permanently. When the context fills, older tokens beyond the keep region are dropped, and the window slides forward.

This allows effectively infinite-length conversations at the cost of some memory loss.

## See Also

- [CLI Usage](/kb/ai/llama-cpp/cli-usage/) — all flags including `--grammar-file`, `--json-schema`, `--lora`
- [Server](/kb/ai/llama-cpp/server/) — grammar/JSON schema and LoRA via REST API
- [Python Bindings](/kb/ai/llama-cpp/python-bindings/) — JSON schema and grammar via `llama-cpp-python`
- [Performance Tuning](/kb/ai/llama-cpp/performance-tuning/) — optimizing the inference engine
- [GGUF & Quantization](/kb/ai/llama-cpp/gguf-quantization/) — converting LoRA adapters to GGUF
