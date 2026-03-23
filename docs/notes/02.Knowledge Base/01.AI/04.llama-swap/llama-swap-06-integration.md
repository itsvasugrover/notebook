---
title: "Integration Guide"
createTime: 2026/03/21 12:05:00
permalink: /kb/ai/llama-swap/integration/
---

# Integration Guide

llama-swap presents a standard OpenAI-compatible API, which means any tool or library that works with OpenAI's API works with llama-swap — just change the `base_url` to point to your llama-swap instance.

## OpenAI Python SDK

```python
from openai import OpenAI

client = OpenAI(
    base_url="http://localhost:8080/v1",
    api_key="not-needed"   # required by client library, ignored by llama-swap
)

# Chat
response = client.chat.completions.create(
    model="llama3",
    messages=[{"role": "user", "content": "Explain merge sort"}],
    temperature=0.7,
    max_tokens=512
)
print(response.choices[0].message.content)

# Stream
stream = client.chat.completions.create(
    model="llama3",
    messages=[{"role": "user", "content": "Write a Rust hello world"}],
    stream=True
)
for chunk in stream:
    if chunk.choices[0].delta.content:
        print(chunk.choices[0].delta.content, end="", flush=True)

# Embeddings
embedding = client.embeddings.create(
    model="nomic-embed",
    input="Query text to embed"
)
vector = embedding.data[0].embedding
```

### Switching Models in One Application

With llama-swap, the same client can seamlessly use different models:

```python
def chat(model: str, prompt: str) -> str:
    return client.chat.completions.create(
        model=model,
        messages=[{"role": "user", "content": prompt}],
        max_tokens=512
    ).choices[0].message.content

# These run with automatic model swapping
code = chat("deepseek-coder", "Write a Python binary search function")
summary = chat("llama3", f"Explain this code: {code}")
vector = client.embeddings.create(model="nomic-embed", input=summary).data[0].embedding
```

## OpenWebUI

[OpenWebUI](https://github.com/open-webui/open-webui) is a popular self-hosted chat interface. Connect it to llama-swap to expose all your local models through a single UI.

### Setup

1. Start llama-swap on `http://localhost:8080`
2. In OpenWebUI: **Settings → Connections → OpenAI API**
3. Set:
   - **API Base URL**: `http://localhost:8080/v1`
   - **API Key**: `not-needed` (any non-empty value)
4. Save and refresh — all models from your llama-swap config appear in the model dropdown

### Docker Compose Example

```yaml
version: "3.8"
services:
  llama-swap:
    image: ghcr.io/mostlygeek/llama-swap:latest
    volumes:
      - ./config.yaml:/config.yaml
      - /path/to/models:/models
    ports:
      - "8080:8080"
    command: ["--config", "/config.yaml"]
    deploy:
      resources:
        reservations:
          devices:
            - driver: nvidia
              count: all
              capabilities: [gpu]

  openwebui:
    image: ghcr.io/open-webui/open-webui:main
    environment:
      OPENAI_API_BASE_URL: "http://llama-swap:8080/v1"
      OPENAI_API_KEY: "not-needed"
    ports:
      - "3000:8080"
    depends_on:
      - llama-swap
```

## LangChain

```bash
pip install langchain-openai
```

```python
from langchain_openai import ChatOpenAI, OpenAIEmbeddings
from langchain_core.messages import HumanMessage
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser

# Chat model
chat = ChatOpenAI(
    base_url="http://localhost:8080/v1",
    api_key="not-needed",
    model="llama3",
    temperature=0.7
)

# Embeddings model
embeddings = OpenAIEmbeddings(
    base_url="http://localhost:8080/v1",
    api_key="not-needed",
    model="nomic-embed"
)

# Simple chain
chain = ChatPromptTemplate.from_template("Explain {topic} briefly") | chat | StrOutputParser()
print(chain.invoke({"topic": "async/await"}))

# RAG pipeline — embeddings auto-switch to nomic-embed, chat to llama3
from langchain_community.vectorstores import FAISS
from langchain_core.runnables import RunnablePassthrough

texts = ["Python is interpreted", "Rust uses a borrow checker", "Go has goroutines"]
vectorstore = FAISS.from_texts(texts, embeddings)  # uses nomic-embed
retriever = vectorstore.as_retriever()

rag_chain = (
    {"context": retriever, "question": RunnablePassthrough()}
    | ChatPromptTemplate.from_template("Context: {context}\nQuestion: {question}")
    | chat   # uses llama3
    | StrOutputParser()
)
print(rag_chain.invoke("What language has goroutines?"))
```

## llama-index

```bash
pip install llama-index llama-index-llms-openai llama-index-embeddings-openai
```

```python
from llama_index.llms.openai import OpenAI as LlamaOpenAI
from llama_index.embeddings.openai import OpenAIEmbedding
from llama_index.core import Settings, VectorStoreIndex, SimpleDirectoryReader

Settings.llm = LlamaOpenAI(
    model="llama3",
    api_base="http://localhost:8080/v1",
    api_key="not-needed"
)

Settings.embed_model = OpenAIEmbedding(
    model="nomic-embed",
    api_base="http://localhost:8080/v1",
    api_key="not-needed"
)

docs = SimpleDirectoryReader("./docs").load_data()
index = VectorStoreIndex.from_documents(docs)     # uses nomic-embed automatically
engine = index.as_query_engine()
print(engine.query("What is the main topic?"))    # uses llama3 automatically
```

## Continue.dev (VS Code AI Extension)

Add llama-swap as a provider in `~/.continue/config.json`:

```json
{
  "models": [
    {
      "title": "Llama 3.1 8B",
      "provider": "openai",
      "model": "llama3",
      "apiBase": "http://localhost:8080/v1",
      "apiKey": "not-needed"
    },
    {
      "title": "DeepSeek Coder",
      "provider": "openai",
      "model": "deepseek-coder",
      "apiBase": "http://localhost:8080/v1",
      "apiKey": "not-needed"
    }
  ],
  "tabAutocompleteModel": {
    "title": "DeepSeek Coder",
    "provider": "openai",
    "model": "deepseek-coder",
    "apiBase": "http://localhost:8080/v1",
    "apiKey": "not-needed"
  },
  "embeddingsProvider": {
    "provider": "openai",
    "model": "nomic-embed",
    "apiBase": "http://localhost:8080/v1",
    "apiKey": "not-needed"
  }
}
```

## Aider (AI Pair Programming)

```bash
pip install aider-chat
aider \
  --openai-api-base http://localhost:8080/v1 \
  --openai-api-key not-needed \
  --model openai/deepseek-coder
```

## curl Examples

```bash
# Test model routing: chat with llama3
curl http://localhost:8080/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{"model":"llama3","messages":[{"role":"user","content":"Hello"}],"max_tokens":20}'

# Switch to coding model
curl http://localhost:8080/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{"model":"deepseek-coder","messages":[{"role":"user","content":"Write fizzbuzz in Python"}]}'

# Embed
curl http://localhost:8080/v1/embeddings \
  -H "Content-Type: application/json" \
  -d '{"model":"nomic-embed","input":"Hello world"}'
```

## Ollama API Compatibility

llama-swap does not natively expose the Ollama API (`/api/chat`, `/api/generate`). If your tool requires the Ollama API format, use [litellm](https://github.com/BerriAI/litellm) as a translation layer:

```bash
pip install litellm
litellm --model openai/llama3 --api_base http://localhost:8080/v1
```

## Environment Variable Configuration

For applications that read API config from environment variables:

```bash
export OPENAI_API_BASE="http://localhost:8080/v1"
export OPENAI_API_KEY="not-needed"

# Many tools (openai CLI, LangChain, etc.) auto-read these
openai chat.completions.create -m llama3 -q "Hello"
```

## See Also

- [API Reference](/kb/ai/llama-swap/api-reference/) — all endpoints and request/response formats
- [Configuration](/kb/ai/llama-swap/configuration/) — setting up models for use with these integrations
- [Model Management](/kb/ai/llama-swap/model-management/) — keeping embedding models persistent for low-latency RAG
- [llama.cpp Python Bindings](/kb/ai/llama-cpp/python-bindings/) — alternative to llama-swap for single-process Python apps
