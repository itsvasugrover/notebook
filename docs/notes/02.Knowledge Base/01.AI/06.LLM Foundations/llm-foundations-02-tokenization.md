---
title: "LLM Foundations 02 — Tokenization"
tags: [llm, tokenization, bpe, wordpiece, sentencepiece, tiktoken, nlp, transformers]
description: "A comprehensive deep-dive into tokenization for large language models: BPE, WordPiece, Unigram, SentencePiece, byte-level encoding, tiktoken, special tokens, and practical pitfalls."
---

# LLM Foundations 02 — Tokenization

> **Series**: LLM Foundations (02/13)  
> **Prerequisites**: [01 — Transformer Architecture](./llm-foundations-01-transformer-architecture.md)

---

## Table of Contents

1. [What is Tokenization?](#1-what-is-tokenization)
2. [Vocabulary Size Tradeoffs](#2-vocabulary-size-tradeoffs)
3. [Byte Pair Encoding (BPE)](#3-byte-pair-encoding-bpe)
4. [WordPiece](#4-wordpiece)
5. [Unigram Language Model Tokenizer](#5-unigram-language-model-tokenizer)
6. [SentencePiece](#6-sentencepiece)
7. [Byte-Level Tokenization](#7-byte-level-tokenization)
8. [Tiktoken](#8-tiktoken)
9. [Special Tokens & Chat Templates](#9-special-tokens--chat-templates)
10. [Tokenization Artifacts & Pitfalls](#10-tokenization-artifacts--pitfalls)
11. [Token Count vs Character Count](#11-token-count-vs-character-count)
12. [Practical Python Examples](#12-practical-python-examples)
13. [Comparison Table](#13-comparison-table)
14. [See Also](#see-also)

---

## 1. What is Tokenization?

Neural language models operate on **discrete integer indices**, not raw text. Tokenization is the process that bridges the gap: it converts a raw string into a sequence of integers (token IDs) that are then looked up in an embedding table.

```
"Hello, world!" ──tokenize──► [9906, 11, 1917, 0]
                  ◄──decode──
```

### Why Not Characters or Words?

There are three natural granularities:

| Granularity | Example | Pros | Cons |
|---|---|---|---|
| **Character-level** | `['H','e','l','l','o']` | Zero OOV, tiny vocab | Very long sequences; no morphological sharing |
| **Word-level** | `['Hello', ',', 'world', '!']` | Natural units | Huge vocab (millions); OOV for rare words |
| **Subword** | `['He', 'llo', ',', 'world', '!']` | Balance; handles morphology | Requires a training step |

Subword tokenization is the industry standard because it:
- Keeps vocabulary sizes tractable ($\sim$32k–200k tokens)
- Avoids out-of-vocabulary (OOV) tokens in practice
- Captures shared morphology (e.g., `run`, `running`, `runner` share `run`)
- Keeps sequence lengths manageable for the attention mechanism ($O(n^2)$ cost)

### Tokenization Pipeline

```
Raw Text
   │
   ▼
Pre-tokenization (split on whitespace / regex)
   │
   ▼
Subword Segmentation (BPE / WordPiece / Unigram)
   │
   ▼
Integer IDs  ──► Embedding Lookup  ──► Model
```

---

## 2. Vocabulary Size Tradeoffs

The vocabulary $V$ is the set of all tokens the model knows. Its size is a fundamental hyperparameter.

### Impact on Memory

Each token requires an **embedding row** of dimension $d_{model}$. The embedding matrix size is:

$$\text{Embedding params} = |V| \times d_{model}$$

For GPT-2 ($|V|=50{,}257$, $d_{model}=768$): $\approx 38.6\text{M parameters}$ just in the embedding table.  
For GPT-4 (estimated $|V|\approx100{,}000$, $d_{model}\approx12{,}288$): $\approx 1.2\text{B embedding params}$.

The **language model head** (final linear layer mapping hidden states back to vocabulary logits) has the same shape and is often weight-tied to the embedding matrix:

$$\text{LM Head} = d_{model} \times |V|$$

### Impact on Sequence Length

A larger vocabulary means common multi-character patterns become single tokens, **reducing sequence length**. This directly reduces attention cost (quadratic in sequence length) and memory.

For the same text passage:
- `|V|=1,000` → sequence length $\approx 2\times$ that of `|V|=50,000`

### OOV Handling

| Vocab Size | OOV Risk | Strategy |
|---|---|---|
| Small ($<$10k) | High | Fall back to character/byte level |
| Medium (32k–64k) | Low for English | Rare words split into pieces |
| Large (100k+) | Very low | Most multilingual text covered |
| Byte-level | Zero | Every byte is in vocab |

### The Fertility Problem

**Fertility** = average number of tokens per word. For English, well-tuned tokenizers achieve fertility $\approx 1.3$–$1.5$. For morphologically rich languages (Finnish, Turkish) or non-Latin scripts (Chinese, Arabic), fertility can reach $3$–$6$ tokens/word, effectively penalizing these languages.

---

## 3. Byte Pair Encoding (BPE)

BPE was originally a data compression algorithm (Philip Gage, 1994) adapted for NLP by Sennrich et al. (2016) and further refined for GPT-2 (Radford et al., 2019).

### 3.1 Original NLP BPE (Sennrich 2016)

**Core idea**: Start with a character vocabulary. Iteratively merge the most frequent adjacent symbol pair until the desired vocabulary size is reached.

#### Algorithm

```
Input:  pre-tokenized corpus (list of words with end-of-word marker </w>)
        desired vocabulary size V

1. Initialize vocabulary with all characters + </w>
2. Count frequency of each word in corpus
3. Repeat until |vocab| == V:
   a. Count all adjacent symbol pairs across all word occurrences
      (weighted by word frequency)
   b. Find the most frequent pair (A, B)
   c. Merge A B → AB in every word occurrence
   d. Add AB to vocabulary
   e. Record merge rule: (A, B) → AB
4. Output: merge rules list + final vocabulary
```

#### Worked Example

Classic corpus: `{"low": 5, "lower": 2, "newest": 6, "widest": 3}`

After adding end-of-word marker and splitting into characters:

```
l o w </w>        : 5
l o w e r </w>    : 2
n e w e s t </w>  : 6
w i d e s t </w>  : 3
```

**Initial vocabulary**: `{l, o, w, e, r, n, s, t, i, d, </w>}`

**Iteration 1**: Count all pairs.

| Pair | Count |
|---|---|
| `e s` | 6+3=9 |
| `s t` | 6+3=9 |
| `l o` | 5+2=7 |
| `o w` | 5+2=7 |
| ... | ... |

Tie between `(e, s)` and `(s, t)`. Assume we pick `(e, s)` first.

Merge `e s` → `es`:
```
l o w </w>        : 5
l o w e r </w>    : 2
n e w es t </w>   : 6
w i d es t </w>   : 3
```

**Iteration 2**: `(s, t)` no longer exists (absorbed). Next top pair:

| Pair | Count |
|---|---|
| `es t` | 6+3=9 |
| `l o` | 7 |
| `o w` | 7 |

Merge `es t` → `est`:
```
l o w </w>        : 5
l o w e r </w>    : 2
n e w est </w>    : 6
w i d est </w>    : 3
```

**Iteration 3**: Merge `(l, o)` → `lo`:
```
lo w </w>         : 5
lo w e r </w>     : 2
n e w est </w>    : 6
w i d est </w>    : 3
```

**Iteration 4**: Merge `(lo, w)` → `low`:
```
low </w>          : 5
low e r </w>      : 2
n e w est </w>    : 6
w i d est </w>    : 3
```

Continuing in this fashion, common substrings naturally emerge as tokens: `low`, `est`, `new`, etc.

#### Encoding New Text

To tokenize a new word, apply the learned merge rules **in order** (the order matters!):

```python
def bpe_encode(word, merge_rules):
    # Start with characters
    symbols = list(word) + ['</w>']
    for (A, B) in merge_rules:
        i = 0
        while i < len(symbols) - 1:
            if symbols[i] == A and symbols[i+1] == B:
                symbols = symbols[:i] + [A+B] + symbols[i+2:]
            else:
                i += 1
    return symbols
```

The merged form of `"lowest"` would be: `['low', 'est', '</w>']` → tokens `low`, `est`.

### 3.2 GPT-2 Byte-Level BPE

GPT-2 introduced a crucial improvement: treat the **raw bytes** (0–255) as the base vocabulary instead of Unicode characters.

**Motivation**: Unicode has ~143,000 characters. Using all as base symbols is wasteful. But using only ASCII misses the world's languages. Bytes are universal.

**Base vocabulary size**: 256 bytes (one per possible byte value 0x00–0xFF)

**Byte-to-Unicode mapping**: GPT-2 maps each byte to a printable Unicode character for readability (using a lookup table), so `0x20` (space) becomes `Ġ`, etc.

```python
# GPT-2 bytes_to_unicode mapping (simplified)
def bytes_to_unicode():
    bs = list(range(ord('!'), ord('~')+1))  # printable ASCII
    bs += list(range(ord('¡'), ord('¬')+1))
    bs += list(range(ord('®'), ord('ÿ')+1))
    cs = bs[:]
    n = 0
    for b in range(256):
        if b not in bs:
            bs.append(b)
            cs.append(256 + n)
            n += 1
    return dict(zip(bs, [chr(c) for c in cs]))
```

**Effect**: The tokenizer can represent any byte sequence without ever producing an `[UNK]` token. Non-ASCII text is simply encoded as byte sequences.

**Pre-tokenization regex**: GPT-2 uses a regex to first split text into "words" before applying BPE:

```python
import regex as re
GPT2_PATTERN = r"""'s|'t|'re|'ve|'m|'ll|'d| ?\p{L}+| ?\p{N}+| ?[^\s\p{L}\p{N}]+|\s+(?!\S)|\s+"""
```

This means `"Hello world"` splits into `[" Hello", " world"]` (note leading space), which is then BPE-encoded independently. The leading space is part of the token, which is why GPT-2 tokens like `" the"` are distinct from `"the"`.

### 3.3 GPT-4 / LLaMA Tokenizers

| Model | Algorithm | Vocab Size | Pre-tokenizer |
|---|---|---|---|
| GPT-2 | Byte-level BPE | 50,257 | Regex (GPT-2 pattern) |
| GPT-3.5/4 (cl100k_base) | Byte-level BPE | 100,277 | Regex (tiktoken) |
| GPT-4o (o200k_base) | Byte-level BPE | 200,019 | Regex (tiktoken) |
| LLaMA 1/2 | SentencePiece BPE | 32,000 | SentencePiece |
| LLaMA 3 | Tiktoken BPE | 128,256 | Tiktoken |
| Mistral | SentencePiece BPE | 32,000 | SentencePiece |

---

## 4. WordPiece

WordPiece is BERT's tokenizer (Schuster & Nakamura, 2012; used in BERT by Devlin et al., 2019).

### Key Differences from BPE

Instead of merging the **most frequent** pair, WordPiece merges the pair that **maximizes the language model likelihood** of the training data. Concretely, it picks the pair $(A, B)$ that maximizes:

$$\text{score}(A, B) = \frac{\text{count}(AB)}{\text{count}(A) \times \text{count}(B)}$$

This is a pointwise mutual information (PMI) criterion. A high score means $AB$ co-occurs much more than expected by chance.

**Intuition**: BPE greedily merges frequent pairs (which may just be common letter combinations); WordPiece prefers merges that are *informative* — pairs that are often seen together but rarely apart.

### The `##` Prefix Convention

WordPiece marks subword continuations with `##`:

```
"unaffable" → ["un", "##aff", "##able"]
"tokenization" → ["token", "##ization"]
```

The `##` means "this piece continues the previous piece without a space." Tokens without `##` are word-initial.

This convention is specific to BERT-family models. During decoding:
- `"token"` → start of word
- `"##ization"` → continuation, no space before it

### WordPiece Training (Simplified)

```
1. Initialize vocab with all individual characters
2. Repeat until |vocab| == V:
   a. For each adjacent pair (A, B) in the corpus:
      score = freq(AB) / (freq(A) * freq(B))
   b. Merge the pair with highest score
   c. Add merged token to vocab
```

### Usage with HuggingFace

```python
from transformers import BertTokenizer

tokenizer = BertTokenizer.from_pretrained("bert-base-uncased")
tokens = tokenizer.tokenize("unaffable tokenization")
# ['un', '##aff', '##able', 'token', '##ization']
ids = tokenizer.encode("unaffable tokenization")
# [101, 4895, 18327, 3085, 19204, 3989, 102]
# 101=[CLS], 102=[SEP]
```

---

## 5. Unigram Language Model Tokenizer

Proposed by Kudo (2018), the Unigram tokenizer takes a fundamentally different, **probabilistic** approach.

### Core Idea

Rather than a bottom-up merge process, Unigram starts with a **large vocabulary** and prunes it.

For a given text $X = x_1 x_2 \ldots x_n$, a segmentation $\mathbf{x} = (x_1, \ldots, x_k)$ into subwords has probability:

$$P(\mathbf{x}) = \prod_{i=1}^{k} p(x_i)$$

where $p(x_i)$ is a unigram probability for each subword piece. The **best segmentation** is:

$$\mathbf{x}^* = \arg\max_{\mathbf{x} \in S(X)} P(\mathbf{x})$$

where $S(X)$ is the set of all possible segmentations of $X$.

### Training via EM

**E-step**: For each word, compute the expected counts of each subword using the Viterbi algorithm (dynamic programming over all segmentations).

**M-step**: Re-estimate $p(x_i)$ from expected counts using maximum likelihood:

$$p(x_i) \leftarrow \frac{\text{expected count of } x_i}{\sum_j \text{expected count of } x_j}$$

**Pruning**: After each EM iteration, remove the bottom $\eta\%$ (e.g., 10–20%) of tokens by their contribution to the total log-likelihood loss. Repeat until target vocabulary size is reached.

The **vocabulary pruning score** for token $x$ is:

$$\text{loss}(x) = \sum_{s \in \text{corpus}} \log P(s) - \log P(s \mid \text{vocab} \setminus \{x\})$$

i.e., how much would total log-likelihood decrease if we removed $x$?

### Probabilistic Segmentation

A key advantage: Unigram supports **sampling multiple segmentations** from $P(\mathbf{x})$, which can be used as a data augmentation technique (subword regularization).

```
"Hello" might segment as:
 - ["He", "llo"]     with prob 0.6
 - ["H", "ello"]     with prob 0.3
 - ["Hel", "lo"]     with prob 0.1
```

During training, sampling different segmentations improves robustness.

---

## 6. SentencePiece

SentencePiece (Kudo & Richardson, 2018) is a **library and file format**, not a new algorithm. It wraps BPE and Unigram in a language-agnostic framework.

### Key Design Decisions

#### No Whitespace Pre-tokenization

Traditional tokenizers split text on whitespace first, then apply subword algorithms. This assumes whitespace = word boundary — valid for English, broken for Chinese, Japanese, Thai, etc.

SentencePiece treats the **entire text stream as a sequence of Unicode code points**, normalizing whitespace as part of the token:

```
"Hello world" → ["▁Hello", "▁world"]
"こんにちは世界" → ["▁こんにちは", "世界"]  (no assumed word boundaries)
```

The `▁` (U+2581, LOWER ONE EIGHTH BLOCK) represents **"preceded by whitespace"**. It is always attached to the first character of a word. This means:

- `"Hello"` (start of sentence/after space) → `▁Hello`
- `"world"` (after space) → `▁world`  
- Continuation pieces (mid-word) → no `▁`

#### Lossless Encoding

SentencePiece decoding is always exact — you can perfectly recover the original text (including all spaces) from tokens.

```python
# Encoding then decoding is identity
text = "Hello  world\n"
tokens = sp.encode(text, out_type=str)
recovered = "".join(tokens).replace("▁", " ").lstrip()
# == text (modulo normalization settings)
```

#### Normalization

SentencePiece applies Unicode NFKC normalization by default and lowercasing optionally. This is configurable.

### BPE Backend

```
spm_train --input=corpus.txt \
          --model_prefix=mymodel \
          --vocab_size=32000 \
          --model_type=bpe \
          --character_coverage=0.9995
```

### Unigram Backend

```
spm_train --input=corpus.txt \
          --model_prefix=mymodel \
          --vocab_size=32000 \
          --model_type=unigram \
          --character_coverage=0.9995
```

The `character_coverage` parameter controls what fraction of Unicode characters to include directly; characters below the threshold are mapped to `<unk>`.

### Models Using SentencePiece

| Model | Backend | Vocab Size |
|---|---|---|
| T5 | SentencePiece Unigram | 32,100 |
| LLaMA 1 | SentencePiece BPE | 32,000 |
| LLaMA 2 | SentencePiece BPE | 32,000 |
| Mistral 7B | SentencePiece BPE | 32,000 |
| mT5 | SentencePiece Unigram | 250,100 |
| ALBERT | SentencePiece Unigram | 30,000 |
| XLNet | SentencePiece Unigram | 32,000 |

### Python Usage

```python
import sentencepiece as spm

sp = spm.SentencePieceProcessor(model_file='llama2.model')

text = "The quick brown fox"
ids = sp.encode(text, out_type=int)
# [450, 4996, 17354, 1701]

pieces = sp.encode(text, out_type=str)
# ['▁The', '▁quick', '▁brown', '▁fox']

decoded = sp.decode(ids)
# "The quick brown fox"
```

---

## 7. Byte-Level Tokenization

When the base vocabulary is the 256 possible byte values (0x00–0xFF), the tokenizer is **byte-level**.

### Motivation

- **Zero OOV**: Any text (any language, any encoding, emoji, binary data) can be represented
- **No character coverage parameter** needed
- Handles corrupted or mixed-encoding text gracefully

### How It Works

```
"Hello" (UTF-8: 48 65 6C 6C 6F)
  → bytes: [0x48, 0x65, 0x6C, 0x6C, 0x6F]
  → tokens: [72, 101, 108, 108, 111]  (raw byte indices)
```

For non-ASCII like `"café"` (UTF-8: 63 61 66 C3 A9):
```
  → bytes: [0x63, 0x61, 0x66, 0xC3, 0xA9]
  → 5 byte tokens
```

Pure byte-level tokenization gives very **long sequences** (every character is at least 1 token, multi-byte UTF-8 characters become multiple tokens). This is why practical implementations layer BPE **on top** of bytes:

1. Represent the byte sequence using 256 base tokens
2. Apply BPE merges over that byte vocabulary
3. Common byte patterns (ASCII words, common UTF-8 sequences) become single merged tokens

This is exactly GPT-2's byte-level BPE described in §3.2.

### Comparison

| Approach | Vocab | OOV | Sequence Length |
|---|---|---|---|
| Pure character | ~1000–50000 | Possible | Long |
| Pure byte | 256 | Never | Very long |
| Byte-level BPE | 50k–200k | Never | Normal |
| Word-level | Millions | Common | Short |

---

## 8. Tiktoken

Tiktoken is OpenAI's production tokenizer library, implemented in Rust with Python bindings. It is dramatically faster than Python-based tokenizers (claims up to $3\text{–}6\times$ faster).

### Architecture

- **Algorithm**: Byte-level BPE
- **Implementation**: Rust core, no Python overhead in the hot path
- **Encoding format**: Vocabulary stored as `{bytes: token_id}` dictionary

### Available Encodings

| Encoding Name | Models | Vocab Size | Notes |
|---|---|---|---|
| `r50k_base` | GPT-2, Codex | 50,257 | Legacy |
| `p50k_base` | text-davinci | 50,281 | Slight modification |
| `p50k_edit` | edit models | 50,281 | Adds few special tokens |
| `cl100k_base` | GPT-3.5, GPT-4, Ada v2 | 100,277 | Current standard |
| `o200k_base` | GPT-4o, o1, o3 | 200,019 | Latest (2024) |

### cl100k_base vs r50k_base

`cl100k_base` has a completely different vocabulary from `r50k_base`:
- Doubled vocabulary size → shorter sequences
- Better handling of non-English text
- Different pre-tokenization regex (improved handling of digits)

Key regex change: digits are **never merged** across boundaries in `cl100k_base`, so numbers like `12345` tokenize as `[1, 2, 3, 4, 5]` (individual digits) rather than arbitrary multi-digit chunks.

### o200k_base

Introduced with GPT-4o (2024):
- 200,019 tokens — 2× the `cl100k_base` vocabulary
- Better multilingual coverage
- More single-token representations for common programming patterns
- Average sequence length for English text reduced by ~20%

### Python Usage

```python
import tiktoken

# Load encoding
enc = tiktoken.get_encoding("cl100k_base")

# Encode
text = "Hello, world! 你好"
tokens = enc.encode(text)
print(tokens)          # [9906, 11, 1917, 0, 220, 57668, 53901]
print(len(tokens))     # 7

# Decode
decoded = enc.decode(tokens)
print(decoded)         # "Hello, world! 你好"

# Inspect token bytes
for tok in tokens:
    print(tok, enc.decode_single_token_bytes(tok))
# 9906  b'Hello'
# 11    b','
# ...

# Count tokens for a model
enc_gpt4 = tiktoken.encoding_for_model("gpt-4")

def count_tokens(text: str, model: str = "gpt-4") -> int:
    enc = tiktoken.encoding_for_model(model)
    return len(enc.encode(text))
```

### Token Counting for API Cost Estimation

```python
import tiktoken

def estimate_cost(prompt: str, model: str = "gpt-4o") -> dict:
    enc = tiktoken.encoding_for_model(model)
    n_tokens = len(enc.encode(prompt))
    # GPT-4o pricing: $5/1M input tokens, $15/1M output tokens (illustrative)
    cost_usd = n_tokens * 5e-6
    return {"tokens": n_tokens, "estimated_input_cost_usd": cost_usd}
```

---

## 9. Special Tokens & Chat Templates

Special tokens are tokens with designated semantic roles that are not part of normal text. They are added to the vocabulary alongside regular subword tokens.

### Standard Special Tokens

| Token | BERT Name | GPT Name | Purpose |
|---|---|---|---|
| Beginning of sequence | `[CLS]` | `<\|endoftext\|>` | Marks start of input |
| End of sequence | `[SEP]` | `<\|endoftext\|>` | Marks end of sequence |
| Padding | `[PAD]` | (varies) | Pads batches to equal length |
| Unknown | `[UNK]` | (none in BPE) | Out-of-vocabulary fallback |
| Mask | `[MASK]` | — | MLM training objective (BERT) |
| Separator | `[SEP]` | — | Separates segments (BERT) |

### LLM Chat Template Special Tokens

Modern instruction-tuned models use special tokens to structure conversations:

#### Llama 2 Chat Format
```
<s>[INST] <<SYS>>
You are a helpful assistant.
<</SYS>>

Hello, how are you? [/INST] I'm doing well, thank you! </s>
<s>[INST] What's the weather? [/INST]
```

Token IDs: `<s>` = 1, `</s>` = 2, `[INST]` = 518+29914 (2-token sequence)

#### Llama 3 Chat Format
```
<|begin_of_text|>
<|start_header_id|>system<|end_header_id|>
You are a helpful assistant.<|eot_id|>
<|start_header_id|>user<|end_header_id|>
Hello!<|eot_id|>
<|start_header_id|>assistant<|end_header_id|>
```

#### ChatML Format (OpenAI / Mistral)
```
<|im_start|>system
You are a helpful assistant.<|im_end|>
<|im_start|>user
Hello!<|im_end|>
<|im_start|>assistant
```

### HuggingFace Chat Templates

```python
from transformers import AutoTokenizer

tokenizer = AutoTokenizer.from_pretrained("meta-llama/Meta-Llama-3-8B-Instruct")

messages = [
    {"role": "system", "content": "You are helpful."},
    {"role": "user", "content": "What is 2+2?"},
]

# apply_chat_template handles all special tokens automatically
prompt = tokenizer.apply_chat_template(
    messages,
    tokenize=False,         # return string, not token IDs
    add_generation_prompt=True  # append assistant start token
)
print(prompt)
```

### Adding Custom Special Tokens

```python
from transformers import AutoTokenizer

tokenizer = AutoTokenizer.from_pretrained("gpt2")

# Add new special tokens
special_tokens = {"additional_special_tokens": ["<|tool_call|>", "<|tool_result|>"]}
tokenizer.add_special_tokens(special_tokens)

# IMPORTANT: resize model embeddings to match new vocab size
# model.resize_token_embeddings(len(tokenizer))
```

---

## 10. Tokenization Artifacts & Pitfalls

### 10.1 Number Tokenization Inconsistency

Different numbers tokenize into wildly different numbers of tokens:

```python
import tiktoken
enc = tiktoken.get_encoding("cl100k_base")

for n in ["1", "12", "123", "1234", "12345", "123456"]:
    tok = enc.encode(n)
    print(f"{n:>8} → {tok}  ({len(tok)} tokens)")

# Output (cl100k_base):
#        1 → [16]  (1 token)
#       12 → [717]  (1 token)
#      123 → [4513]  (1 token)
#     1234 → [4513, 19]  (2 tokens? No...)
# (actual output varies; the point is inconsistency)
```

**Impact**: Arithmetic is hard for LLMs partly because the same mathematical relationship (adding 1) produces completely different token sequences: `"99"` and `"100"` might be 1 token vs 3 tokens.

In `cl100k_base`, individual digits are separate tokens, making arithmetic slightly more consistent, but multi-digit number representation is still fragmented.

### 10.2 Code Tokenization Inefficiencies

Indentation-heavy languages (Python) waste many tokens on whitespace:

```python
enc = tiktoken.get_encoding("cl100k_base")
code = "    " * 4  # 16 spaces (common in deeply nested Python)
print(len(enc.encode(code)))  # Often 4-8 tokens just for spaces!
```

Common patterns:
- 4 spaces of indentation → often 1 token
- 8 spaces → sometimes 1 or 2 tokens
- `\n    ` (newline + indent) → may be 1 merged token

Code-specific tokenizers (like those in Codex or Code Llama) are trained to handle these patterns more efficiently.

### 10.3 Non-English Language Fertility

**Fertility** measures how many tokens are needed per word. Higher = less efficient:

| Language | Approx. tokens/word | vs. English |
|---|---|---|
| English | 1.3 | 1× |
| French | 1.4 | 1.1× |
| Spanish | 1.5 | 1.2× |
| Russian | 2.5 | 1.9× |
| Arabic | 3.0 | 2.3× |
| Chinese | 1.5–2.5 | 1.5× |
| Hindi | 2.8 | 2.2× |
| Thai | 4.0+ | 3× |

A Hindi prompt using 1,000 tokens conveys roughly $1000 / 2.8 \approx 357$ word-equivalents, vs 1,000 words for English. This means:
1. API costs are higher per semantic unit
2. Context windows are "smaller" in effective information capacity
3. Models may perform worse on non-English tasks (less training data + less efficient encoding)

### 10.4 Leading Space Sensitivity

Many tokenizers (GPT-2, GPT-4) distinguish between `"Hello"` and `" Hello"` (space + Hello):

```python
enc = tiktoken.get_encoding("cl100k_base")
print(enc.encode("Hello"))    # [9906]
print(enc.encode(" Hello"))   # [22691]  — different token!
print(enc.encode("hello"))    # [15339]  — lowercase is yet another token
```

This means prompts like:
```python
# BUG: missing leading space
prompt = "The capital of France is" + "Paris"
# Tokenizes differently from:
prompt = "The capital of France is" + " Paris"  # correct
```

### 10.5 "Glitch" Tokens (Solid Tokens)

Some tokens in vocabulary are rarely or never seen in training data (often due to the crawled web corpus having repetitive strings in URLs, code, etc.). These "solid" or "glitch" tokens cause anomalous model behavior.

Famous examples in GPT-2's vocabulary:
- `SolidGoldMagikarp` (a Reddit username that appeared in word frequency lists used during tokenizer training but almost never in actual training text)
- The model, when prompted with this token, sometimes produces bizarre outputs

**Root cause**: The token exists in the vocabulary (has an embedding), but the embedding was never meaningfully updated during training because the token essentially never appeared in the training corpus. The embedding is at its random initialization value.

**Detection**:
```python
# Tokens with embeddings far from the mean may be "glitch" tokens
# (requires access to model weights)
import torch
embeddings = model.transformer.wte.weight  # [vocab_size, d_model]
norms = embeddings.norm(dim=-1)
# Tokens with very low norms may be under-trained
```

### 10.6 Tokenization at Boundaries

The same word tokenizes differently depending on context (prior characters):

```python
enc = tiktoken.get_encoding("cl100k_base")

# "token" by itself
print(enc.encode("token"))         # [2316]

# "token" after a space  
print(enc.encode(" token"))        # [4037]

# "tokenization"
print(enc.encode("tokenization"))  # [35434, 2065]
```

This means a model's representation of a word depends on its position relative to whitespace, which can cause unexpected behavior in few-shot prompts where examples are formatted inconsistently.

---

## 11. Token Count vs Character Count

### Rough Heuristics

| Content Type | Chars per Token | Tokens per Word |
|---|---|---|
| English prose | ~4 | ~1.3 |
| English technical text | ~3.5 | ~1.4 |
| Source code (Python/JS) | ~3 | ~1.5 |
| Dense code (C/C++) | ~2.5 | ~2 |
| JSON/XML | ~3 | varies |
| Chinese text | ~1.5 | ~1.5 |
| Arabic text | ~2 | ~3 |

### Mathematical Approximation

For rough cost/context estimation with English text:

$$N_{\text{tokens}} \approx \frac{N_{\text{chars}}}{4} \approx \frac{N_{\text{words}}}{0.75}$$

So 1,000 English words ≈ 1,333 tokens.

A 1,500-word essay ≈ 2,000 tokens.

A 100-page document (~50,000 words) ≈ 66,000 tokens — near or exceeding many context windows.

### Context Window Capacity

| Model | Context (tokens) | Approx. English words |
|---|---|---|
| GPT-3 | 4,096 | ~3,000 |
| GPT-4 | 8,192 / 128,000 | ~6,000 / ~96,000 |
| GPT-4o | 128,000 | ~96,000 |
| Claude 3 | 200,000 | ~150,000 |
| Llama 3.1 | 128,000 | ~96,000 |
| Gemini 1.5 Pro | 1,000,000 | ~750,000 |

---

## 12. Practical Python Examples

### 12.1 HuggingFace `tokenizers` Library

```python
from tokenizers import Tokenizer
from tokenizers.models import BPE
from tokenizers.trainers import BpeTrainer
from tokenizers.pre_tokenizers import Whitespace

# Train a BPE tokenizer from scratch
tokenizer = Tokenizer(BPE(unk_token="[UNK]"))
tokenizer.pre_tokenizer = Whitespace()

trainer = BpeTrainer(
    vocab_size=1000,
    special_tokens=["[UNK]", "[CLS]", "[SEP]", "[PAD]", "[MASK]"]
)

# Train on files
files = ["corpus.txt"]
tokenizer.train(files, trainer)

# Save
tokenizer.save("my-tokenizer.json")

# Use
encoding = tokenizer.encode("Hello, world!")
print(encoding.tokens)   # ['Hello', ',', 'world', '!']
print(encoding.ids)      # [45, 12, 234, 8]
```

### 12.2 Loading Pre-trained Tokenizers (HuggingFace)

```python
from transformers import AutoTokenizer

# GPT-2
gpt2_tok = AutoTokenizer.from_pretrained("gpt2")
enc = gpt2_tok("Hello world, this is GPT-2 tokenization!")
print(enc['input_ids'])
# [15496, 995, 11, 428, 318, 402, 11571, 12, 17, 11241, 1634, 0]

# BERT (WordPiece)
bert_tok = AutoTokenizer.from_pretrained("bert-base-uncased")
enc = bert_tok("unaffable tokenization")
print(enc['input_ids'])
# [101, 4895, 18327, 3085, 19204, 3989, 102]
# [CLS] un ##aff ##able token ##ization [SEP]

# LLaMA 2
llama_tok = AutoTokenizer.from_pretrained("meta-llama/Llama-2-7b-hf")
enc = llama_tok("Hello world")
print(enc['input_ids'])   # [1, 15043, 3186]  (1 = <s>)

# Batch encoding with padding
batch = ["Short.", "This is a longer sentence."]
enc = bert_tok(batch, padding=True, truncation=True, return_tensors="pt")
print(enc['input_ids'].shape)   # [2, max_length]
print(enc['attention_mask'])    # 1 = real token, 0 = padding
```

### 12.3 Tiktoken

```python
import tiktoken

# List available encodings
print(tiktoken.list_encoding_names())
# ['gpt2', 'r50k_base', 'p50k_base', 'p50k_edit', 'cl100k_base', 'o200k_base']

enc = tiktoken.get_encoding("cl100k_base")

# Basic encode/decode
text = "The transformer architecture uses attention."
tokens = enc.encode(text)
print(tokens)
print(enc.decode(tokens) == text)  # True

# Encode with special tokens disallowed (default)
try:
    enc.encode("<|endoftext|>")    # raises DisallowedSpecialError
except tiktoken.exceptions.DisallowedSpecialError:
    pass

# Allow specific special tokens
enc.encode("<|endoftext|>", allowed_special={"<|endoftext|>": 0})
# or allow all:
enc.encode("<|endoftext|>", allowed_special="all")

# Token inspection
for tok_id in enc.encode("Hello"):
    bytes_repr = enc.decode_single_token_bytes(tok_id)
    print(f"ID {tok_id}: {bytes_repr}")

# Batch encoding (efficient)
texts = ["Hello", "World", "foo bar baz"] * 100
all_tokens = [enc.encode(t) for t in texts]
```

### 12.4 SentencePiece

```python
import sentencepiece as spm

# Train a SentencePiece model
spm.SentencePieceTrainer.train(
    input='corpus.txt',
    model_prefix='my_sp_model',
    vocab_size=8000,
    model_type='bpe',           # or 'unigram', 'char', 'word'
    character_coverage=0.9995,  # cover 99.95% of Unicode chars
    pad_id=3,
    unk_id=0,
    bos_id=1,
    eos_id=2,
    pad_piece='<pad>',
    unk_piece='<unk>',
    bos_piece='<s>',
    eos_piece='</s>',
)

# Load and use
sp = spm.SentencePieceProcessor(model_file='my_sp_model.model')

# Encode to IDs
ids = sp.encode("Hello, world!", out_type=int)
print(ids)

# Encode to pieces
pieces = sp.encode("Hello, world!", out_type=str)
print(pieces)  # ['▁Hello', ',', '▁world', '!']

# Decode
text = sp.decode(ids)
print(text)  # "Hello, world!"

# Sample multiple segmentations (subword regularization)
for _ in range(3):
    sampled = sp.sample_encode_as_pieces("tokenization", nbest_size=-1, alpha=0.1)
    print(sampled)

# Vocabulary inspection
vocab_size = sp.get_piece_size()
print(f"Vocab size: {vocab_size}")
print(sp.id_to_piece(42))    # token at ID 42
print(sp.piece_to_id('▁the'))  # ID of token '▁the'
```

### 12.5 Token Fertility Analysis

```python
import tiktoken
from transformers import AutoTokenizer

def fertility_analysis(text: str):
    """Compare tokenization across different tokenizers."""
    word_count = len(text.split())
    
    results = {}
    
    # Tiktoken cl100k_base
    enc = tiktoken.get_encoding("cl100k_base")
    tok_count = len(enc.encode(text))
    results['cl100k_base'] = {
        'tokens': tok_count,
        'fertility': tok_count / word_count
    }
    
    # BERT
    bert = AutoTokenizer.from_pretrained("bert-base-uncased")
    tok_count = len(bert.tokenize(text))
    results['bert'] = {
        'tokens': tok_count,
        'fertility': tok_count / word_count
    }
    
    return results

# Compare on English vs code vs non-English
texts = {
    "english": "The quick brown fox jumps over the lazy dog.",
    "code": "def fibonacci(n: int) -> int:\n    if n <= 1:\n        return n\n    return fibonacci(n-1) + fibonacci(n-2)",
    "chinese": "快速的棕色狐狸跳过了懒惰的狗。",
}

for name, text in texts.items():
    result = fertility_analysis(text)
    print(f"\n{name}:")
    for tok_name, data in result.items():
        print(f"  {tok_name}: {data['tokens']} tokens, fertility={data['fertility']:.2f}")
```

---

## 13. Comparison Table

| Feature | BPE | Byte-Level BPE | WordPiece | Unigram LM | SentencePiece | Char-level | Byte-level |
|---|---|---|---|---|---|---|---|
| **Algorithm** | Bottom-up merge | Bottom-up merge | PMI-based merge | Top-down prune | Library (BPE/Unigram) | N/A | N/A |
| **Base unit** | Characters | Bytes (256) | Characters | Characters | Unicode codepoints | Characters | Bytes |
| **OOV handling** | `[UNK]` possible | Never OOV | `[UNK]` possible | `[UNK]` possible | Rare (configurable) | Never OOV | Never OOV |
| **Merge criterion** | Frequency | Frequency | PMI / likelihood | EM log-likelihood | Algorithm-dependent | — | — |
| **Probabilistic** | No | No | No | Yes (EM) | Optional (Unigram) | No | No |
| **Whitespace handling** | Pre-split required | Pre-split (regex) | Pre-split required | Pre-split required | None (baked in) | — | — |
| **Language agnostic** | Mostly | Yes | Mostly | Mostly | Yes | Yes | Yes |
| **Sequence length** | Medium | Medium | Medium | Medium | Medium | Long | Very Long |
| **Typical vocab size** | 32k–50k | 50k–200k | 30k–32k | 32k–250k | 32k–250k | ~100–10k | 256 |
| **Subword regularization** | No | No | No | Yes | Yes (Unigram) | No | No |
| **Key users** | Original GPT | GPT-2/3/4, LLaMA3 | BERT, RoBERTa | XLNet, ALBERT | T5, LLaMA1/2, Mistral | Rare | Rare (ByT5) |
| **Decoding** | Deterministic | Deterministic | Deterministic | Viterbi/sample | Deterministic | Trivial | Trivial |
| **Training speed** | Fast | Fast | Medium | Slow (EM iters) | Medium | Trivial | Trivial |

### When to Choose What

- **Building a new English LLM**: Byte-level BPE with `cl100k_base`-sized vocab (100k)
- **Multilingual model**: SentencePiece Unigram with high `character_coverage`
- **Encoder-only (BERT-like)**: WordPiece
- **Generative multilingual**: SentencePiece BPE or Unigram
- **Zero-OOV critical**: Byte-level BPE or SentencePiece
- **Subword regularization**: SentencePiece Unigram
- **Production serving with OpenAI models**: Tiktoken

---

## See Also

| File | Topic |
|---|---|
| [00 — Index](./llm-foundations-00-index.md) | Series overview |
| [01 — Transformer Architecture](./llm-foundations-01-transformer-architecture.md) | Self-attention, FFN, layer norm |
| [03 — Positional Encodings](./llm-foundations-03-positional-encodings.md) | RoPE, ALiBi, sinusoidal |
| [04 — Scaling Laws & Compute](./llm-foundations-04-scaling-laws-compute.md) | Chinchilla laws, FLOP budgets |
| [05 — Advanced Architectures](./llm-foundations-05-advanced-architectures.md) | MoE, SSM, Mamba |
| [06 — Parameter Efficiency](./llm-foundations-06-parameter-efficiency.md) | LoRA, adapters, prefix tuning |
| [07 — Training Techniques](./llm-foundations-07-training-techniques.md) | Pre-training, SFT, loss functions |
| [08 — Low-Rank Training](./llm-foundations-08-low-rank-training.md) | LoRA math, PEFT methods |
| [09 — RLHF & Alignment](./llm-foundations-09-rlhf-alignment.md) | PPO, DPO, Constitutional AI |
| [10 — Quantization Deep Dive](./llm-foundations-10-quantization-deep-dive.md) | INT8, INT4, GPTQ, AWQ |
| [11 — Inference Optimization](./llm-foundations-11-inference-optimization.md) | KV cache, speculative decoding |
| [12 — Test-Time Compute](./llm-foundations-12-test-time-compute.md) | Chain-of-thought, search |
| [13 — SOTA Benchmarks](./llm-foundations-13-sota-benchmarks.md) | MMLU, HumanEval, BIG-Bench |

---

*Last updated: 2026-03-21*
