---
title: "Python Bindings (llama-cpp-python)"
createTime: 2026/03/21 10:06:00
permalink: /kb/ai/llama-cpp/python-bindings/
---

# Python Bindings (llama-cpp-python)

`llama-cpp-python` is the official Python binding for llama.cpp. It compiles the llama.cpp C++ library as a Python extension and exposes it through a high-level API that mirrors the OpenAI SDK interface.

## Installation

### CPU (Standard)

```bash
pip install llama-cpp-python
```

### GPU-Accelerated

```bash
# CUDA
CMAKE_ARGS="-DGGML_CUDA=ON" pip install llama-cpp-python

# Apple Metal
CMAKE_ARGS="-DGGML_METAL=ON" pip install llama-cpp-python

# Vulkan
CMAKE_ARGS="-DGGML_VULKAN=ON" pip install llama-cpp-python

# ROCm
CMAKE_ARGS="-DGGML_HIP=ON -DAMDGPU_TARGETS=gfx1100" pip install llama-cpp-python
```

### Prebuilt Wheels (Faster)

```bash
# CPU
pip install llama-cpp-python \
  --extra-index-url https://abetlen.github.io/llama-cpp-python/whl/cpu

# CUDA 12
pip install llama-cpp-python \
  --extra-index-url https://abetlen.github.io/llama-cpp-python/whl/cu121
```

### Upgrading

```bash
pip install --upgrade llama-cpp-python --no-cache-dir
```

## The `Llama` Class

The main entry point is `llama_cpp.Llama`. Key constructor parameters:

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `model_path` | str | *required* | Path to GGUF file |
| `n_ctx` | int | 512 | Context window size |
| `n_batch` | int | 512 | Batch size for prompt processing |
| `n_threads` | int | auto | CPU inference threads |
| `n_threads_batch` | int | auto | CPU threads for batch processing |
| `n_gpu_layers` | int | 0 | Layers to offload to GPU |
| `flash_attn` | bool | False | Enable Flash Attention |
| `use_mmap` | bool | True | Memory-map model file |
| `use_mlock` | bool | False | Lock model in RAM |
| `embedding` | bool | False | Enable embedding mode |
| `seed` | int | -1 | RNG seed (-1 = random) |
| `verbose` | bool | True | Print loading info |

### Basic Load

```python
from llama_cpp import Llama

llm = Llama(
    model_path="./models/llama-3.1-8b-instruct-q4_k_m.gguf",
    n_ctx=4096,
    n_gpu_layers=99,   # -1 or 99 = offload all layers
    flash_attn=True,
    verbose=False
)
```

### Context Manager

```python
with Llama(model_path="model.gguf", n_ctx=2048) as llm:
    output = llm("Hello world")
# Memory is released when the block exits
```

## Text Completion

```python
output = llm(
    "What is the capital of Germany?",
    max_tokens=64,
    temperature=0.7,
    top_p=0.95,
    repeat_penalty=1.1,
    stop=["\n", "Q:"]
)

print(output["choices"][0]["text"])
# -> "The capital of Germany is Berlin."
```

### Response Structure

```python
{
    "id": "cmpl-...",
    "object": "text_completion",
    "model": "llama-3.1-8b-instruct-q4_k_m.gguf",
    "choices": [{
        "text": "The capital of Germany is Berlin.",
        "index": 0,
        "finish_reason": "stop"   # or "length"
    }],
    "usage": {
        "prompt_tokens": 10,
        "completion_tokens": 8,
        "total_tokens": 18
    }
}
```

### Streaming Completion

```python
stream = llm(
    "Tell me a short story:",
    max_tokens=256,
    stream=True
)

for chunk in stream:
    print(chunk["choices"][0]["text"], end="", flush=True)
```

## Chat Completions

```python
response = llm.create_chat_completion(
    messages=[
        {"role": "system", "content": "You are a concise assistant."},
        {"role": "user", "content": "Explain decorators in Python"}
    ],
    temperature=0.7,
    max_tokens=512
)

print(response["choices"][0]["message"]["content"])
```

### Multi-Turn Conversation

```python
messages = [{"role": "system", "content": "You are a helpful assistant."}]

while True:
    user_input = input("You: ").strip()
    if not user_input:
        break

    messages.append({"role": "user", "content": user_input})

    response = llm.create_chat_completion(messages=messages, max_tokens=512)
    reply = response["choices"][0]["message"]["content"]
    messages.append({"role": "assistant", "content": reply})

    print(f"Assistant: {reply}")
```

### Streaming Chat

```python
stream = llm.create_chat_completion(
    messages=[{"role": "user", "content": "Write a Python class for a stack"}],
    stream=True
)

for chunk in stream:
    delta = chunk["choices"][0]["delta"]
    if "content" in delta:
        print(delta["content"], end="", flush=True)
```

## Embeddings

```python
# Load with embedding=True
embed_model = Llama(
    model_path="./models/nomic-embed-text-v1.5.Q4_K_M.gguf",
    n_ctx=2048,
    embedding=True,
    verbose=False
)

result = embed_model.create_embedding("The quick brown fox")
vector = result["data"][0]["embedding"]   # list of floats
print(f"Embedding dim: {len(vector)}")    # e.g. 768
```

### Batch Embeddings

```python
texts = ["sentence one", "sentence two", "sentence three"]
result = embed_model.create_embedding(texts)
vectors = [item["embedding"] for item in result["data"]]
```

## Tokenization

```python
# Tokenize text to token IDs
tokens = llm.tokenize(b"Hello, world!")
print(tokens)  # e.g. [9906, 29892, 3186, 29991]

# Decode token IDs back to text
text = llm.detokenize(tokens)
print(text)  # b'Hello, world!'
```

## Structured Output / JSON Schema

```python
import json

response = llm.create_chat_completion(
    messages=[{
        "role": "user",
        "content": "Extract: Alice is 34, works at Acme Corp"
    }],
    response_format={
        "type": "json_object",
        "schema": {
            "type": "object",
            "properties": {
                "name":    {"type": "string"},
                "age":     {"type": "integer"},
                "company": {"type": "string"}
            },
            "required": ["name", "age", "company"]
        }
    },
    temperature=0
)

data = json.loads(response["choices"][0]["message"]["content"])
# {"name": "Alice", "age": 34, "company": "Acme Corp"}
```

## LangChain Integration

```bash
pip install langchain-community
```

```python
from langchain_community.llms import LlamaCpp
from langchain_community.chat_models import ChatLlamaCpp
from langchain_core.messages import HumanMessage

# Chat model
chat = ChatLlamaCpp(
    model_path="./models/llama-3.1-8b-instruct-q4_k_m.gguf",
    n_ctx=4096,
    n_gpu_layers=99,
    temperature=0.7,
    verbose=False
)

result = chat.invoke([HumanMessage(content="Explain list comprehensions")])
print(result.content)
```

### LCEL Chain

```python
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser

prompt = ChatPromptTemplate.from_messages([
    ("system", "You are a Python tutor."),
    ("user", "{question}")
])

chain = prompt | chat | StrOutputParser()
print(chain.invoke({"question": "What is a generator?"}))
```

## llama-index Integration

```bash
pip install llama-index llama-index-llms-llama-cpp
```

```python
from llama_index.llms.llama_cpp import LlamaCPP
from llama_index.core import Settings

llm = LlamaCPP(
    model_path="./models/llama-3.1-8b-instruct-q4_k_m.gguf",
    model_kwargs={"n_gpu_layers": 99},
    context_window=4096,
    max_new_tokens=512,
    verbose=False
)

Settings.llm = llm

from llama_index.core import VectorStoreIndex, SimpleDirectoryReader
docs = SimpleDirectoryReader("./docs").load_data()
index = VectorStoreIndex.from_documents(docs)
query_engine = index.as_query_engine()
print(query_engine.query("What does this document say about deployment?"))
```

## Built-in Python Server

`llama-cpp-python` ships its own OpenAI-compatible HTTP server:

```bash
python -m llama_cpp.server \
  --model ./models/llama-3.1-8b-instruct-q4_k_m.gguf \
  --n_gpu_layers 99 \
  --n_ctx 4096 \
  --host 0.0.0.0 \
  --port 8000
```

The API is compatible with the same endpoints as `llama-server`.

## Async Usage

For async Python applications:

```python
import asyncio
from concurrent.futures import ThreadPoolExecutor

_executor = ThreadPoolExecutor(max_workers=1)

async def generate(prompt: str) -> str:
    loop = asyncio.get_event_loop()
    result = await loop.run_in_executor(
        _executor,
        lambda: llm(prompt, max_tokens=256)
    )
    return result["choices"][0]["text"]
```

## See Also

- [Server](/kb/ai/llama-cpp/server/) — use `llama-server` instead for multi-user / production scenarios
- [Installation & Build](/kb/ai/llama-cpp/installation-build/) — building from source if prebuilt wheels don't work
- [Advanced Features](/kb/ai/llama-cpp/advanced-features/) — grammar constraints, vision, and LoRA via Python
- [Performance Tuning](/kb/ai/llama-cpp/performance-tuning/) — `n_ctx`, `n_batch`, and GPU layer settings
