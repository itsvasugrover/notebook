---
title: "LLM Foundations 01 — Transformer Architecture"
createTime: 2026/03/21 20:20:00
permalink: /kb/ai/llm-foundations/transformer-architecture/
tags:
  - llm
  - transformer
  - attention
  - deep-learning
  - neural-networks
  - architecture
  - theory
description: "A comprehensive deep-dive into the Transformer architecture: self-attention, multi-head attention, FFN, normalization, positional encoding, KV cache, parameter counts, and implementation details."
---

# LLM Foundations 01 — Transformer Architecture

> **Series**: LLM Foundations (01 / 13)  
> **Prerequisites**: Basic linear algebra, neural networks, backpropagation  
> **Next**: [02 — Tokenization](./llm-foundations-02-tokenization.md)

---

## Table of Contents

1. [Overview](#1-overview)
2. [High-Level Architecture](#2-high-level-architecture)
3. [Self-Attention Mechanism](#3-self-attention-mechanism)
4. [Multi-Head Attention](#4-multi-head-attention)
5. [Feed-Forward Networks (FFN)](#5-feed-forward-networks-ffn)
6. [Residual Connections & Layer Normalization](#6-residual-connections--layer-normalization)
7. [Positional Encoding](#7-positional-encoding)
8. [Decoder-Specific: Masked Self-Attention & Cross-Attention](#8-decoder-specific-masked-self-attention--cross-attention)
9. [Architecture Variants: GPT vs BERT vs T5](#9-architecture-variants-gpt-vs-bert-vs-t5)
10. [KV Cache](#10-kv-cache)
11. [Parameter Count Formulas](#11-parameter-count-formulas)
12. [Common Implementation Details](#12-common-implementation-details)
13. [See Also](#13-see-also)

---

## 1. Overview

### What Is the Transformer?

The **Transformer** ([Vaswani et al., 2017 — "Attention Is All You Need"](https://arxiv.org/abs/1706.03762)) is a sequence-to-sequence neural architecture that relies entirely on **attention mechanisms**, discarding recurrence and convolution. It is the foundation of virtually every modern LLM (GPT, BERT, T5, LLaMA, Gemini, Claude).

### Why It Replaced RNNs/LSTMs

| Dimension | RNN / LSTM | Transformer |
|---|---|---|
| **Sequential computation** | Must process token $t$ before $t+1$ | All tokens processed in parallel |
| **Long-range dependencies** | Gradient vanishes over long sequences | Direct $O(1)$ path via attention |
| **Training speed** | Slow (sequential backprop through time) | Fast (parallelizable on GPUs/TPUs) |
| **Memory during training** | $O(n)$ hidden states | $O(n^2)$ attention matrices |
| **Context length** | Practical limit ≈ few hundred tokens | Scales to thousands (with tricks) |
| **Scalability** | Hard to scale beyond ~10 M params | Scales to trillions of params |

Key limitations of LSTMs that motivated the switch:
- **Vanishing/exploding gradients** over long sequences despite gating.
- **Sequential bottleneck**: GPU parallelism cannot be exploited within a sequence.
- **Fixed-size hidden state** bottleneck in encoder-decoder RNNs (solved partially by Bahdanau attention, but Transformers generalize this fully).

---

## 2. High-Level Architecture

### 2.1 Encoder-Decoder (Original, e.g., T5, BART)

```
Input Tokens                   Output Tokens (shifted right)
     │                                   │
 [Embedding + Pos Enc]           [Embedding + Pos Enc]
     │                                   │
 ┌───▼───────────────┐           ┌───────▼───────────────┐
 │  Encoder Block ×N │           │   Decoder Block ×N    │
 │  ┌─────────────┐  │           │  ┌──────────────────┐ │
 │  │ Self-Attn   │  │           │  │ Masked Self-Attn │ │
 │  │ (bidirect.) │  │           │  └──────────────────┘ │
 │  └─────────────┘  │     ┌────►│  ┌──────────────────┐ │
 │  ┌─────────────┐  │     │     │  │  Cross-Attention  │ │
 │  │    FFN      │  ├─────┘     │  └──────────────────┘ │
 │  └─────────────┘  │           │  ┌──────────────────┐ │
 └───────────────────┘           │  │      FFN         │ │
                                 │  └──────────────────┘ │
                                 └───────────────────────┘
                                             │
                                      Linear + Softmax
                                             │
                                      Next Token Prob
```

### 2.2 Encoder-Only (e.g., BERT, RoBERTa)

- Only the encoder stack is used.
- Bidirectional attention (every token attends to every other token).
- Ideal for **understanding** tasks: classification, NER, QA with context.

```
Input Tokens → Embedding → [Encoder Block × N] → Contextual Representations
```

### 2.3 Decoder-Only (e.g., GPT, LLaMA, Mistral)

- Only the decoder stack, but with **no cross-attention** (no encoder to attend to).
- Causal / **autoregressive** masked self-attention.
- Ideal for **generation** tasks: text generation, instruction following.

```
Input Tokens → Embedding → [Causal Decoder Block × N] → Linear → Softmax → Next Token
```

---

## 3. Self-Attention Mechanism

### 3.1 Intuition

Self-attention allows each position in a sequence to **attend to all other positions** in the same sequence, weighting how much each position should contribute to the current token's representation.

> "The word 'it' in 'The animal didn't cross the street because **it** was too tired' — what does 'it' refer to? Self-attention figures this out."

### 3.2 Query, Key, Value Matrices

Given an input matrix $X \in \mathbb{R}^{n \times d_{model}}$ (sequence of $n$ tokens, each with dimension $d_{model}$), we project it into three spaces:

$$Q = X W^Q, \quad K = X W^K, \quad V = X W^V$$

Where:
- $W^Q, W^K \in \mathbb{R}^{d_{model} \times d_k}$ — query and key projection matrices
- $W^V \in \mathbb{R}^{d_{model} \times d_v}$ — value projection matrix
- $Q, K \in \mathbb{R}^{n \times d_k}$, $V \in \mathbb{R}^{n \times d_v}$

**Conceptual roles:**
| Matrix | Role | Analogy |
|---|---|---|
| **Query** $Q$ | What am I looking for? | Search query |
| **Key** $K$ | What do I offer to match? | Database index key |
| **Value** $V$ | What information do I carry? | Database value |

### 3.3 Scaled Dot-Product Attention

$$\text{Attention}(Q, K, V) = \text{softmax}\!\left(\frac{QK^T}{\sqrt{d_k}}\right)V$$

Step-by-step:

1. **Dot products**: $QK^T \in \mathbb{R}^{n \times n}$ — raw attention scores between all pairs of tokens.
2. **Scale**: Divide by $\sqrt{d_k}$ to keep dot products in a reasonable range; without this, large $d_k$ causes extremely small softmax gradients (softmax saturation).
3. **Softmax**: Convert scores to a probability distribution (rows sum to 1), giving **attention weights** $A \in \mathbb{R}^{n \times n}$.
4. **Weighted sum**: Multiply by $V$ — each output token is a weighted combination of all value vectors.

$$A_{ij} = \frac{\exp(q_i \cdot k_j / \sqrt{d_k})}{\sum_{l=1}^{n} \exp(q_i \cdot k_l / \sqrt{d_k})}$$

For **masked** (causal) attention, positions $j > i$ are set to $-\infty$ before softmax:

$$\text{mask}_{ij} = \begin{cases} 0 & j \leq i \\ -\infty & j > i \end{cases}$$

### 3.4 PyTorch Implementation

```python
import torch
import torch.nn.functional as F
import math

def scaled_dot_product_attention(
    Q: torch.Tensor,   # (batch, heads, seq, d_k)
    K: torch.Tensor,   # (batch, heads, seq, d_k)
    V: torch.Tensor,   # (batch, heads, seq, d_v)
    mask: torch.Tensor | None = None,
    dropout_p: float = 0.0,
) -> tuple[torch.Tensor, torch.Tensor]:
    d_k = Q.size(-1)
    
    # (batch, heads, seq_q, seq_k)
    scores = torch.matmul(Q, K.transpose(-2, -1)) / math.sqrt(d_k)
    
    if mask is not None:
        scores = scores.masked_fill(mask == 0, float('-inf'))
    
    attn_weights = F.softmax(scores, dim=-1)
    
    if dropout_p > 0.0:
        attn_weights = F.dropout(attn_weights, p=dropout_p)
    
    # (batch, heads, seq_q, d_v)
    output = torch.matmul(attn_weights, V)
    return output, attn_weights
```

### 3.5 Complexity Analysis

| Operation | Time Complexity | Space Complexity |
|---|---|---|
| $QK^T$ computation | $O(n^2 d_k)$ | $O(n^2)$ |
| Softmax | $O(n^2)$ | $O(n^2)$ |
| Weighted sum $AV$ | $O(n^2 d_v)$ | $O(n d_v)$ |
| **Total** | $O(n^2 d)$ | $O(n^2)$ |

The **quadratic** $O(n^2)$ memory cost in sequence length $n$ is the main bottleneck for long contexts. Efficient alternatives (Flash Attention, Sparse Attention, Linear Attention) address this — see [11 — Inference Optimization](./llm-foundations-11-inference-optimization.md).

> **Flash Attention** (Dao et al., 2022) achieves $O(n^2)$ FLOPs but only $O(n)$ HBM memory by tiling the computation and never materializing the full attention matrix.

---

## 4. Multi-Head Attention

### 4.1 Motivation

A single attention head learns one type of relationship. **Multi-head attention** runs $h$ attention heads in parallel, each in a lower-dimensional subspace, allowing the model to jointly attend to information from different representation subspaces.

### 4.2 Formula

$$\text{MultiHead}(Q, K, V) = \text{Concat}(\text{head}_1, \ldots, \text{head}_h) \, W^O$$

Where each head $i$ is:

$$\text{head}_i = \text{Attention}(Q W_i^Q,\; K W_i^K,\; V W_i^V)$$

With projection matrices:
- $W_i^Q, W_i^K \in \mathbb{R}^{d_{model} \times d_k}$ where $d_k = d_{model} / h$
- $W_i^V \in \mathbb{R}^{d_{model} \times d_v}$ where $d_v = d_{model} / h$
- $W^O \in \mathbb{R}^{h d_v \times d_{model}}$ — output projection

The total computation is similar to a single head with full $d_{model}$, since each head uses $d_k = d_{model}/h$.

### 4.3 Architecture Diagram

```
         Input X (n × d_model)
              │
    ┌─────────┼──────────┐
    │         │          │
  Head 1    Head 2  ... Head h
  W^Q_1     W^Q_2       W^Q_h
  W^K_1     W^K_2       W^K_h
  W^V_1     W^V_2       W^V_h
    │         │          │
  Attn_1   Attn_2    Attn_h
    │         │          │
    └────┬────┘──────────┘
         │
    Concatenate → (n × h·d_v) = (n × d_model)
         │
       W^O  (output projection)
         │
    Output (n × d_model)
```

### 4.4 PyTorch Implementation

```python
import torch
import torch.nn as nn
import math

class MultiHeadAttention(nn.Module):
    def __init__(self, d_model: int, num_heads: int, dropout: float = 0.1):
        super().__init__()
        assert d_model % num_heads == 0, "d_model must be divisible by num_heads"
        
        self.d_model = d_model
        self.num_heads = num_heads
        self.d_k = d_model // num_heads
        
        # Fused QKV projection (efficient)
        self.W_qkv = nn.Linear(d_model, 3 * d_model, bias=False)
        self.W_o = nn.Linear(d_model, d_model, bias=False)
        self.dropout = nn.Dropout(dropout)
    
    def forward(
        self,
        x: torch.Tensor,           # (batch, seq, d_model)
        mask: torch.Tensor | None = None,
    ) -> torch.Tensor:
        batch, seq, _ = x.shape
        
        # Project and split into Q, K, V
        qkv = self.W_qkv(x)  # (batch, seq, 3*d_model)
        Q, K, V = qkv.chunk(3, dim=-1)
        
        # Reshape for multi-head: (batch, heads, seq, d_k)
        def reshape(t):
            return t.view(batch, seq, self.num_heads, self.d_k).transpose(1, 2)
        
        Q, K, V = reshape(Q), reshape(K), reshape(V)
        
        # Scaled dot-product attention
        scores = torch.matmul(Q, K.transpose(-2, -1)) / math.sqrt(self.d_k)
        if mask is not None:
            scores = scores.masked_fill(mask == 0, float('-inf'))
        
        attn = self.dropout(torch.softmax(scores, dim=-1))
        out = torch.matmul(attn, V)  # (batch, heads, seq, d_k)
        
        # Concatenate heads
        out = out.transpose(1, 2).contiguous().view(batch, seq, self.d_model)
        
        return self.W_o(out)
```

### 4.5 Variants

| Variant | Description | Used In |
|---|---|---|
| **MHA** (Multi-Head Attention) | All heads use full KV | Original Transformer, early GPT |
| **MQA** (Multi-Query Attention) | Single shared KV, multiple Q heads | PaLM, Falcon |
| **GQA** (Grouped-Query Attention) | Groups of Q heads share KV | LLaMA 2/3, Mistral, Gemma |
| **MLA** (Multi-Head Latent Attention) | Low-rank KV compression | DeepSeek-V2/V3 |

**GQA** reduces KV cache size without significant quality loss. With $G$ groups and $h$ query heads: each group has $h/G$ query heads sharing one KV head. Defined by $n_{\text{kv\_heads}} = h / G$.

---

## 5. Feed-Forward Networks (FFN)

### 5.1 Standard FFN

After attention, each position passes through an identical **two-layer MLP** (applied position-wise):

$$\text{FFN}(x) = \text{Activation}(x W_1 + b_1) \, W_2 + b_2$$

- $W_1 \in \mathbb{R}^{d_{model} \times d_{ff}}$, $W_2 \in \mathbb{R}^{d_{ff} \times d_{model}}$
- Typically $d_{ff} = 4 \times d_{model}$ (e.g., $d_{model}=1024 \Rightarrow d_{ff}=4096$)
- Original activation: ReLU

### 5.2 Activation Functions

| Activation | Formula | Properties |
|---|---|---|
| **ReLU** | $\max(0, x)$ | Simple; dead neuron problem |
| **GELU** | $x \cdot \Phi(x)$ where $\Phi$ is CDF of $\mathcal{N}(0,1)$ | Smooth; used in GPT-2, BERT |
| **SiLU / Swish** | $x \cdot \sigma(x)$ | Self-gated; used in LLaMA |
| **SwiGLU** | $\text{SiLU}(xW_1) \odot (xW_3)$ | Gated; ±1% better perplexity |

### 5.3 SwiGLU (Used in LLaMA, PaLM, Gemma)

$$\text{SwiGLU}(x, W, V, b, c) = \text{SiLU}(xW + b) \odot (xV + c)$$

Simplified (no bias):

$$\text{FFN}_{\text{SwiGLU}}(x) = \left(\text{SiLU}(xW_1) \odot xW_3\right) W_2$$

This requires **three** weight matrices instead of two. To keep parameter count similar to the standard FFN, $d_{ff}$ is reduced: typically $d_{ff} = \frac{2}{3} \times 4 d_{model}$, rounded to a multiple of 64.

```python
import torch
import torch.nn as nn
import torch.nn.functional as F

class SwiGLUFFN(nn.Module):
    """Feed-Forward Network with SwiGLU activation (as in LLaMA)."""
    def __init__(self, d_model: int, d_ff: int | None = None):
        super().__init__()
        if d_ff is None:
            # LLaMA convention: 2/3 * 4 * d_model, rounded to multiple of 256
            d_ff = int(2 / 3 * 4 * d_model)
            d_ff = ((d_ff + 255) // 256) * 256
        
        self.w1 = nn.Linear(d_model, d_ff, bias=False)  # gate
        self.w2 = nn.Linear(d_ff, d_model, bias=False)  # down
        self.w3 = nn.Linear(d_model, d_ff, bias=False)  # up
    
    def forward(self, x: torch.Tensor) -> torch.Tensor:
        # SiLU(gate) * up, then project down
        return self.w2(F.silu(self.w1(x)) * self.w3(x))
```

---

## 6. Residual Connections & Layer Normalization

### 6.1 Residual Connections

Introduced by He et al. for ResNets, residual connections **add the input to the output** of each sub-layer:

$$x_{out} = x + \text{SubLayer}(x)$$

Benefits:
- Gradient highway: gradients flow directly to earlier layers without passing through many non-linearities.
- Allows very deep networks (100+ layers) to train stably.
- Network can learn residuals (small changes) rather than full mappings.

### 6.2 Post-LN vs Pre-LN

**Post-LN** (original Transformer):
$$x_{out} = \text{LayerNorm}(x + \text{SubLayer}(x))$$

**Pre-LN** (modern default):
$$x_{out} = x + \text{SubLayer}(\text{LayerNorm}(x))$$

| Aspect | Post-LN | Pre-LN |
|---|---|---|
| **Training stability** | Unstable at large scale; needs careful LR warmup | More stable; less warmup needed |
| **Final performance** | Slightly better (when it converges) | Slightly worse but reliable |
| **Gradient flow** | Gradients can vanish near input layers | Gradients flow better to early layers |
| **Used in** | Original BERT, original Transformer | GPT-2+, LLaMA, modern models |

### 6.3 LayerNorm

For a vector $x \in \mathbb{R}^d$:

$$\text{LayerNorm}(x) = \frac{x - \mu}{\sigma + \epsilon} \odot \gamma + \beta$$

Where:
- $\mu = \frac{1}{d}\sum_i x_i$ — mean over the feature dimension
- $\sigma = \sqrt{\frac{1}{d}\sum_i (x_i - \mu)^2}$ — standard deviation
- $\gamma, \beta \in \mathbb{R}^d$ — learnable scale and shift
- $\epsilon \approx 10^{-5}$ — numerical stability

Unlike **BatchNorm** (normalizes over batch), **LayerNorm** normalizes over the feature dimension of a single example — no dependency on batch size, works for variable-length sequences.

### 6.4 RMSNorm (Used in LLaMA, Gemma, Mistral)

**Root Mean Square Normalization** — removes the mean-centering step:

$$\text{RMSNorm}(x) = \frac{x}{\sqrt{\frac{1}{d}\sum_i x_i^2 + \epsilon}} \odot \gamma$$

Benefits:
- **Simpler**: no mean subtraction, no bias $\beta$
- **~10-15% faster** than LayerNorm in practice
- Empirically matches LayerNorm quality

```python
class RMSNorm(nn.Module):
    def __init__(self, d_model: int, eps: float = 1e-6):
        super().__init__()
        self.eps = eps
        self.weight = nn.Parameter(torch.ones(d_model))
    
    def forward(self, x: torch.Tensor) -> torch.Tensor:
        # Compute RMS over last dimension
        rms = x.pow(2).mean(dim=-1, keepdim=True).add(self.eps).sqrt()
        return (x / rms) * self.weight
```

### 6.5 Full Transformer Block (Pre-LN, modern)

```python
class TransformerBlock(nn.Module):
    def __init__(self, d_model: int, num_heads: int, d_ff: int, dropout: float = 0.1):
        super().__init__()
        self.norm1 = RMSNorm(d_model)
        self.attn = MultiHeadAttention(d_model, num_heads, dropout)
        self.norm2 = RMSNorm(d_model)
        self.ffn = SwiGLUFFN(d_model, d_ff)
        self.dropout = nn.Dropout(dropout)
    
    def forward(self, x: torch.Tensor, mask: torch.Tensor | None = None) -> torch.Tensor:
        # Pre-LN: normalize before sublayer, add residual
        x = x + self.dropout(self.attn(self.norm1(x), mask=mask))
        x = x + self.dropout(self.ffn(self.norm2(x)))
        return x
```

---

## 7. Positional Encoding

> **Detailed coverage**: [03 — Positional Encodings](./llm-foundations-03-positional-encodings.md)

### 7.1 Why Needed

Self-attention is **permutation-invariant**: swapping the order of tokens produces the same (reordered) output. Without positional information, "cat sat on mat" and "mat on sat cat" are indistinguishable. Positional encodings inject order information.

### 7.2 Sinusoidal Encoding (Vaswani et al., 2017)

For position $pos$ and dimension $i$:

$$PE_{(pos, 2i)} = \sin\!\left(\frac{pos}{10000^{2i/d_{model}}}\right)$$

$$PE_{(pos, 2i+1)} = \cos\!\left(\frac{pos}{10000^{2i/d_{model}}}\right)$$

- Each dimension oscillates at a different frequency (geometric series from $2\pi$ to $10000 \cdot 2\pi$).
- The pattern is fixed (not learned).
- Added directly to the token embeddings: $x \leftarrow x + PE$.

### 7.3 Modern Alternatives

| Method | Where Used | Key Property |
|---|---|---|
| **Sinusoidal** (fixed) | Original Transformer | Generalizes to unseen lengths |
| **Learned Absolute** | BERT, GPT-2 | Better in-distribution performance |
| **RoPE** (Rotary PE) | LLaMA, Mistral, GPT-NeoX | Relative positions; extends to longer contexts |
| **ALiBi** | MPT, BLOOM | Bias-based; strong length extrapolation |
| **NoPE** | Some recent models | No PE; relies on attention patterns |

---

## 8. Decoder-Specific: Masked Self-Attention & Cross-Attention

### 8.1 Causal (Masked) Self-Attention

In **autoregressive generation**, the model must predict token $t+1$ based only on tokens $1 \ldots t$. The **causal mask** prevents attending to future tokens:

$$\text{mask}_{ij} = \begin{cases} 1 & j \leq i \\ 0 & j > i \end{cases}$$

Implemented as an upper-triangular matrix filled with $-\infty$ before softmax:

```python
def causal_mask(seq_len: int, device: torch.device) -> torch.Tensor:
    """Returns lower-triangular boolean mask for causal attention."""
    # True = attend, False = mask out
    return torch.tril(torch.ones(seq_len, seq_len, device=device)).bool()

# In attention:
# scores.masked_fill(~mask, float('-inf'))
```

### 8.2 Cross-Attention

In encoder-decoder models (T5, BART), the decoder queries the encoder's output:

$$\text{CrossAttention}(Q_{dec}, K_{enc}, V_{enc}) = \text{softmax}\!\left(\frac{Q_{dec} K_{enc}^T}{\sqrt{d_k}}\right) V_{enc}$$

- **Queries** come from the decoder (what the decoder is looking for)
- **Keys and Values** come from the encoder output (the encoded source)
- The decoder can focus on relevant parts of the input at each generation step

### 8.3 Full Decoder Block (Encoder-Decoder)

```
Input (decoder side)
       │
   RMSNorm
       │
  Causal Self-Attention  ← attends only to previous decoder tokens
       │ + residual
   RMSNorm
       │
  Cross-Attention  ← Q from decoder; K, V from encoder output
       │ + residual
   RMSNorm
       │
      FFN
       │ + residual
   Output
```

---

## 9. Architecture Variants: GPT vs BERT vs T5

### 9.1 Comparison Table

| Feature | GPT (Decoder-only) | BERT (Encoder-only) | T5 (Enc-Dec) |
|---|---|---|---|
| **Attention type** | Causal (unidirectional) | Bidirectional | Bidirectional enc + Causal dec |
| **Training objective** | Next-token prediction (CLM) | MLM + NSP | Span denoising (T5-style) |
| **Use case** | Text generation, instruction following | Understanding, classification | Seq2Seq, translation, summarization |
| **Context** | Left context only | Full context | Full enc context / left dec context |
| **Examples** | GPT-4, LLaMA, Mistral, Falcon | BERT, RoBERTa, DeBERTa | T5, BART, mT5 |
| **KV Cache** | Yes (efficient autoregressive) | N/A (no generation) | Yes (decoder side) |

### 9.2 GPT-style Decoder-Only (Dominant Modern Architecture)

Modern LLMs almost exclusively use the **decoder-only** architecture because:

1. **Simpler**: No cross-attention, one stack of blocks.
2. **Unifies pretraining and finetuning**: CLM naturally extends to few-shot and instruction following.
3. **Scales better**: Empirically, decoder-only models seem to scale more efficiently.
4. **Flexible context**: Can condition on arbitrary prefixes.

```
Token IDs: [T1, T2, T3, T4]
                │
          Token Embedding
                │
         + Positional Enc.
                │
    ┌───────────────────────┐
    │  Causal Decoder Block │ ×N
    │  (RMSNorm → Masked    │
    │   Self-Attn + Residual│
    │   RMSNorm → FFN +     │
    │   Residual)           │
    └───────────────────────┘
                │
           RMSNorm  (final norm)
                │
          Linear (unembedding)
          W ∈ ℝ^(d_model × V)
                │
           Logits over vocab
```

### 9.3 BERT-style Encoder-Only

```
[CLS] The cat sat [MASK] the mat [SEP]
         │
   Bidirectional self-attention (all tokens attend to all)
         │
   Contextual representations
         │
 [CLS] token → Classification Head
 [MASK] position → MLM prediction head
```

---

## 10. KV Cache

> **Detailed coverage**: [11 — Inference Optimization](./llm-foundations-11-inference-optimization.md)

### 10.1 The Problem

During **training**, all tokens are processed in parallel (teacher forcing). During **inference** (autoregressive generation), each new token requires computing attention over the entire context.

Naive approach: recompute $K$ and $V$ for all previous tokens at every step → $O(n^2)$ computation per token → very slow.

### 10.2 KV Cache Solution

Cache the $K$ and $V$ projections from all previous steps. At step $t$:
- Compute $Q_t, K_t, V_t$ only for the new token
- Append $K_t$ to cached $K_{1:t-1}$ and $V_t$ to cached $V_{1:t-1}$
- Compute attention using full $K_{1:t}$, $V_{1:t}$ but only $Q_t$

```python
# Pseudocode for KV-cached inference
kv_cache = {}  # layer_id -> (K_cache, V_cache)

for step in range(max_new_tokens):
    # Only pass the new token, not the full sequence
    new_token_embedding = embed(new_token)
    
    for layer_id, layer in enumerate(transformer_blocks):
        K_new = new_token_embedding @ layer.W_k  # (1, d_k)
        V_new = new_token_embedding @ layer.W_v  # (1, d_v)
        
        if layer_id in kv_cache:
            K_full = torch.cat([kv_cache[layer_id][0], K_new], dim=0)
            V_full = torch.cat([kv_cache[layer_id][1], V_new], dim=0)
        else:
            K_full, V_full = K_new, V_new
        
        kv_cache[layer_id] = (K_full, V_full)
        
        Q = new_token_embedding @ layer.W_q  # (1, d_k)
        attn_out = attention(Q, K_full, V_full)
        # ... rest of layer
```

### 10.3 Memory Cost of KV Cache

For one layer, the KV cache holds $2 \times n \times d_{model}$ values per layer. For full model:

$$\text{KV Cache Memory} = 2 \times n \times d_{model} \times N_{layers} \times \text{bytes\_per\_element}$$

Example (LLaMA-3 8B, BF16, $n=4096$):
- $d_{model} = 4096$, $N_{layers} = 32$
- $2 \times 4096 \times 4096 \times 32 \times 2 \approx 2.1 \text{ GB}$

This is why **GQA** and **MQA** are important: they reduce $n_{kv\_heads}$, shrinking the KV cache significantly.

---

## 11. Parameter Count Formulas

Understanding parameter counts is essential for reasoning about model size, memory, and FLOP budgets.

### 11.1 Embedding Layer

$$P_{embed} = V \times d_{model}$$

Where $V$ = vocabulary size (e.g., 32000 for LLaMA, 128000 for LLaMA-3).

The **unembedding** (output) layer is often **weight-tied** to the input embedding, adding 0 extra params.

### 11.2 Attention Layer (MHA, per layer)

For one transformer layer:

| Component | Parameters |
|---|---|
| $W^Q$ | $d_{model} \times d_{model}$ |
| $W^K$ | $d_{model} \times d_{model}$ |
| $W^V$ | $d_{model} \times d_{model}$ |
| $W^O$ | $d_{model} \times d_{model}$ |
| **Total MHA** | $4 d_{model}^2$ |

For **GQA** with $n_{heads}$ query heads and $n_{kv}$ KV heads:

$$P_{attn} = d_{model} \times (n_{heads} + 2 n_{kv}) \times d_k + d_{model}^2$$

Where $d_k = d_{model} / n_{heads}$.

### 11.3 FFN Layer (per layer)

**Standard FFN** (2 matrices):
$$P_{FFN} = 2 \times d_{model} \times d_{ff}$$

**SwiGLU FFN** (3 matrices):
$$P_{FFN} = 3 \times d_{model} \times d_{ff}$$

### 11.4 Layer Norm / RMSNorm (per layer)

$$P_{norm} = 2 \times d_{model} \quad \text{(LayerNorm: } \gamma \text{ and } \beta\text{)}$$
$$P_{norm} = d_{model} \quad \text{(RMSNorm: only } \gamma\text{)}$$

Each transformer block has 2 norm layers.

### 11.5 Total Parameter Count

For a model with $L$ layers, vocabulary $V$, $d_{model}$, $d_{ff}$:

$$P_{total} = P_{embed} + L \times (P_{attn} + P_{FFN} + P_{norms})$$

$$P_{total} \approx V \cdot d_{model} + L \left(4 d_{model}^2 + 2 d_{model} \cdot d_{ff}\right)$$

With $d_{ff} = 4 d_{model}$:

$$P_{total} \approx V \cdot d_{model} + L \cdot 12 \, d_{model}^2$$

**Verification — LLaMA-2 7B** ($L=32$, $d_{model}=4096$, $d_{ff}=11008$ with SwiGLU, $V=32000$):

| Component | Params |
|---|---|
| Embeddings | $32000 \times 4096 = 131 \text{M}$ |
| Attention (×32) | $32 \times 4 \times 4096^2 = 2147 \text{M}$ |
| FFN/SwiGLU (×32) | $32 \times 3 \times 4096 \times 11008 = 4328 \text{M}$ |
| RMSNorm (×32×2 + 1) | $\approx 1 \text{M}$ |
| **Total** | **≈ 6.6 B** ✓ |

---

## 12. Common Implementation Details

### 12.1 Dropout

Applied in several places (typically disabled during inference):
- **Attention dropout**: applied to attention weights $A$ after softmax.
- **Residual dropout**: applied to the output of each sub-layer before adding to residual.
- **Embedding dropout**: applied after positional encoding (some models).

Typical values: $p = 0.1$ for smaller models, $p = 0.0$ for very large models (often not beneficial at >10B params).

### 12.2 Weight Initialization

**Xavier (Glorot) Uniform**:
$$W \sim \mathcal{U}\!\left(-\sqrt{\frac{6}{n_{in} + n_{out}}},\; \sqrt{\frac{6}{n_{in} + n_{out}}}\right)$$

Designed to keep variance constant through the network assuming linear activations.

**Kaiming (He) Normal** (for ReLU activations):
$$W \sim \mathcal{N}\!\left(0,\; \sqrt{\frac{2}{n_{in}}}\right)$$

**Scaled initialization** (GPT-2 style — for residual connections):
Output projection $W^O$ and FFN $W_2$ are scaled by $\frac{1}{\sqrt{2L}}$ where $L$ is the number of layers. This prevents variance blow-up through many residual additions.

```python
def _init_weights(module: nn.Module, n_layers: int) -> None:
    if isinstance(module, nn.Linear):
        nn.init.normal_(module.weight, mean=0.0, std=0.02)
        if module.bias is not None:
            nn.init.zeros_(module.bias)
    elif isinstance(module, nn.Embedding):
        nn.init.normal_(module.weight, mean=0.0, std=0.02)

# Scale output projections
def scale_residual_projections(model: nn.Module, n_layers: int) -> None:
    scale = 1.0 / math.sqrt(2 * n_layers)
    for name, param in model.named_parameters():
        if name.endswith(('W_o.weight', 'w2.weight')):
            param.data.mul_(scale)
```

### 12.3 Numerical Precision

| Precision | Bits | Range | Usage |
|---|---|---|---|
| FP32 | 32 | Large | Training master weights, optimizer states |
| BF16 | 16 | Large (same as FP32) | Modern training (A100, H100), preferred over FP16 |
| FP16 | 16 | Limited ($\approx 65504$) | Training with loss scaling required |
| INT8 | 8 | — | Inference quantization |
| INT4 | 4 | — | Aggressive inference quantization |

> **BF16 vs FP16**: BF16 has the same exponent range as FP32 (8 bits) but reduced mantissa (7 bits vs 10). FP16 has limited exponent range, causing overflow during training without gradient scaling. Most modern LLM training uses BF16.

### 12.4 Bias Terms

Many modern LLMs (LLaMA, Mistral, Gemma) **remove biases** from linear layers:
- Reduces parameters slightly.
- Works well with RMSNorm (which also has no bias).
- Empirically makes no quality difference at scale.

### 12.5 Flash Attention

**Flash Attention** (Dao et al., 2022) is now the standard attention implementation:
- Fuses softmax + attention into a single GPU kernel.
- Never materializes the $n \times n$ attention matrix in HBM (global GPU memory).
- Uses tiling to keep intermediate results in SRAM (fast on-chip memory).
- Same mathematical result as standard attention but significantly faster and more memory-efficient.

```python
# PyTorch 2.0+ has built-in scaled_dot_product_attention with Flash Attention backend
from torch.nn.functional import scaled_dot_product_attention

# Flash Attention is used automatically if:
# - CUDA device
# - No custom mask (or specific mask types)
# - Appropriate dtypes

output = scaled_dot_product_attention(
    query, key, value,
    attn_mask=None,       # None triggers Flash Attention path
    dropout_p=0.0,
    is_causal=True,       # Efficient causal masking
)
```

### 12.6 Gradient Checkpointing

For large models, storing all intermediate activations for backpropagation requires $O(L \cdot n \cdot d_{model})$ memory. **Gradient checkpointing** (activation checkpointing) trades compute for memory:
- Store only a subset of activations (e.g., every block's input).
- Recompute intermediate activations during the backward pass.
- Typically adds ~33% computation overhead but can halve memory usage.

```python
from torch.utils.checkpoint import checkpoint

# Wrap forward pass with gradient checkpointing
def forward_with_checkpoint(self, x, mask=None):
    return checkpoint(self._forward, x, mask, use_reentrant=False)
```

---

## 13. See Also

### Within LLM Foundations Series

| File | Topic |
|---|---|
| [00 — Index](./llm-foundations-00-index.md) | Series overview and learning path |
| [02 — Tokenization](./llm-foundations-02-tokenization.md) | BPE, WordPiece, SentencePiece, vocabulary design |
| [03 — Positional Encodings](./llm-foundations-03-positional-encodings.md) | RoPE, ALiBi, sinusoidal, learned — deep dive |
| [04 — Scaling Laws & Compute](./llm-foundations-04-scaling-laws-compute.md) | Chinchilla scaling, compute-optimal training |
| [05 — Advanced Architectures](./llm-foundations-05-advanced-architectures.md) | MoE, SSMs, Mamba, hybrid models |
| [06 — Parameter Efficiency](./llm-foundations-06-parameter-efficiency.md) | LoRA, adapters, prefix tuning |
| [07 — Training Techniques](./llm-foundations-07-training-techniques.md) | Optimizers, learning rate schedules, distributed training |
| [08 — Low-Rank Training](./llm-foundations-08-low-rank-training.md) | LoRA, QLoRA, GaLore deep dive |
| [09 — RLHF & Alignment](./llm-foundations-09-rlhf-alignment.md) | RLHF, PPO, DPO, Constitutional AI |
| [10 — Quantization Deep Dive](./llm-foundations-10-quantization-deep-dive.md) | GPTQ, AWQ, GGUF quantization formats |
| [11 — Inference Optimization](./llm-foundations-11-inference-optimization.md) | KV cache, speculative decoding, Flash Attention |
| [12 — Test-Time Compute](./llm-foundations-12-test-time-compute.md) | Chain-of-thought, search, o1-style reasoning |
| [13 — SOTA Benchmarks](./llm-foundations-13-sota-benchmarks.md) | MMLU, HumanEval, BIG-Bench, evaluation methodology |

### Related Knowledge Base Notes

- [llama.cpp Architecture](../05.llama.cpp/llama-cpp-02-architecture.md) — Practical implementation of transformer inference in C++
- [llama.cpp Quantization](../05.llama.cpp/llama-cpp-03-gguf-quantization.md) — GGUF format and quantization in practice
- [ASR Algorithms & Theory](../02.ASR/asr-02-algorithms-theory.md) — Transformer application in speech recognition (Whisper)

---

*Last updated: 2026-03-21 | Series: LLM Foundations | File: 01/13*
