---
title: "LLM Foundations 03 — Positional Encodings"
tags:
  - llm
  - transformers
  - positional-encodings
  - rope
  - alibi
  - attention
  - deep-learning
description: >
  A comprehensive deep-dive into positional encodings for large language models:
  sinusoidal, learned, relative, RoPE, ALiBi, sliding-window attention, NoPE,
  and context-length extension techniques (YaRN, NTK, LongRoPE).
---

# LLM Foundations 03 — Positional Encodings

> **Series position:** 03 / 13 · [← 02 Tokenization](./llm-foundations-02-tokenization.md) · [→ 04 Scaling Laws](./llm-foundations-04-scaling-laws-compute.md)

---

## Table of Contents

1. [Why Position Matters](#1-why-position-matters)
2. [Absolute Sinusoidal Encodings (Vaswani 2017)](#2-absolute-sinusoidal-encodings-vaswani-2017)
3. [Learned Absolute Positional Embeddings](#3-learned-absolute-positional-embeddings)
4. [Relative Positional Encodings](#4-relative-positional-encodings)
5. [Rotary Position Embedding (RoPE)](#5-rotary-position-embedding-rope)
6. [ALiBi — Attention with Linear Biases](#6-alibi--attention-with-linear-biases)
7. [Sliding Window Attention](#7-sliding-window-attention)
8. [NoPE — No Positional Encoding](#8-nope--no-positional-encoding)
9. [Context Length Extension Techniques](#9-context-length-extension-techniques)
10. [Master Comparison Table](#10-master-comparison-table)
11. [Practical Implications](#11-practical-implications)
12. [See Also](#see-also)

---

## 1. Why Position Matters

### 1.1 Transformers Are Permutation-Invariant

The self-attention mechanism computes a weighted sum over all value vectors, where the weights depend only on **query–key dot products**. Nothing in the raw attention formula references the sequential order of tokens:

$$
\text{Attention}(Q, K, V) = \text{softmax}\!\left(\frac{QK^\top}{\sqrt{d_k}}\right)V
$$

If you shuffle the input tokens, every query still "sees" the same set of keys — the only thing that changes is which key corresponds to which position. Without an explicit signal, the model **cannot distinguish** these shuffled inputs.

Concretely, for a sequence $\mathbf{x} = [x_1, x_2, \ldots, x_n]$ and a permutation $\sigma$:

$$
\text{Attention}(\mathbf{x}_{\sigma(1)}, \ldots, \mathbf{x}_{\sigma(n)}) = \sigma\bigl(\text{Attention}(\mathbf{x}_1, \ldots, \mathbf{x}_n)\bigr)
$$

The output is just a permuted version of the original output — the model has learned nothing about structure.

### 1.2 What Happens With No Position Signal?

| Effect | Why It Happens |
|---|---|
| Word-order blindness | "The dog bit the man" ≡ "The man bit the dog" |
| Syntactic parsing failure | Subject/object roles are positional |
| Autoregressive generation breaks | Next-token prediction requires knowing *current* position |
| No length generalisation | Model cannot distinguish short vs long sequences |

Empirically, a no-position transformer trained on language tasks achieves near-chance performance on tasks requiring word order (e.g., subject-verb agreement, NLI).

### 1.3 The Solution Space

Position information can be injected in three conceptually distinct locations:

1. **Input injection** — add / concatenate positional vectors to token embeddings before the first layer.
2. **Attention score modification** — add a position-dependent bias to $QK^\top$ at every layer.
3. **Rotation of Q/K** — rotate the query and key vectors by an angle that encodes absolute position, so their dot product reveals relative distance.

Each of the major techniques below falls into one of these categories.

---

## 2. Absolute Sinusoidal Encodings (Vaswani 2017)

### 2.1 The Formula

The original *Attention Is All You Need* paper defines a deterministic, non-learned positional encoding for each position $pos \in \{0,\ldots,n-1\}$ and embedding dimension index $i \in \{0,\ldots,d_{model}/2 - 1\}$:

$$
PE_{(pos,\, 2i)} = \sin\!\left(\frac{pos}{10000^{2i/d_{model}}}\right)
$$

$$
PE_{(pos,\, 2i+1)} = \cos\!\left(\frac{pos}{10000^{2i/d_{model}}}\right)
$$

The final positional encoding for position $pos$ is a $d_{model}$-dimensional vector where each pair of dimensions $(2i, 2i+1)$ forms a 2D sinusoidal wave with a specific frequency.

### 2.2 Geometric Interpretation

Define the **angular frequency** for dimension pair $i$:

$$
\omega_i = \frac{1}{10000^{2i/d_{model}}}
$$

Then:

$$
PE_{pos} = \bigl[\sin(\omega_0 \cdot pos),\; \cos(\omega_0 \cdot pos),\; \sin(\omega_1 \cdot pos),\; \cos(\omega_1 \cdot pos),\; \ldots\bigr]
$$

This can be seen as a **multi-frequency clock**:
- Low $i$ → high frequency (rotates fast with $pos$, encodes fine-grained local position).
- High $i$ → low frequency (rotates slowly, encodes coarse global position).

The wavelengths form a geometric progression:

$$
\lambda_i = 2\pi \cdot 10000^{2i/d_{model}}
$$

- Shortest wavelength: $\lambda_0 = 2\pi \approx 6.28$ tokens.
- Longest wavelength: $\lambda_{d/2-1} = 2\pi \cdot 10000 \approx 62{,}832$ tokens.

With $d_{model} = 512$, the 256 frequency bands cover six orders of magnitude of periodicity.

### 2.3 Why It Generalises Slightly Beyond Training Length

Because the sinusoidal values at position $pos + k$ can be expressed as a **linear function** of $PE_{pos}$ (rotation by angle $\omega_i k$), the model can, in principle, extrapolate to positions it never saw—though in practice performance degrades for significantly larger positions.

The key identity is:

$$
\begin{bmatrix} \sin(\omega (pos+k)) \\ \cos(\omega (pos+k)) \end{bmatrix}
= \begin{bmatrix} \cos(\omega k) & \sin(\omega k) \\ -\sin(\omega k) & \cos(\omega k) \end{bmatrix}
\begin{bmatrix} \sin(\omega \cdot pos) \\ \cos(\omega \cdot pos) \end{bmatrix}
$$

A linear layer can therefore learn to compute relative offsets, providing limited but real extrapolation power.

### 2.4 PyTorch Implementation

```python
import torch
import torch.nn as nn
import math

class SinusoidalPositionalEncoding(nn.Module):
    """
    Fixed (non-learned) sinusoidal positional encoding.
    Vaswani et al., 2017 — "Attention Is All You Need"
    """
    def __init__(self, d_model: int, max_seq_len: int = 5000, dropout: float = 0.1):
        super().__init__()
        self.dropout = nn.Dropout(p=dropout)

        # Build the PE matrix: shape (max_seq_len, d_model)
        pe = torch.zeros(max_seq_len, d_model)
        position = torch.arange(0, max_seq_len, dtype=torch.float).unsqueeze(1)  # (T, 1)

        # Compute the division term: 10000^(2i/d_model)
        div_term = torch.exp(
            torch.arange(0, d_model, 2, dtype=torch.float)
            * (-math.log(10000.0) / d_model)
        )  # shape: (d_model/2,)

        pe[:, 0::2] = torch.sin(position * div_term)  # even indices
        pe[:, 1::2] = torch.cos(position * div_term)  # odd indices

        # Register as buffer (not a parameter — not updated by optimizer)
        pe = pe.unsqueeze(0)  # (1, max_seq_len, d_model)
        self.register_buffer("pe", pe)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        """
        Args:
            x: token embeddings, shape (batch, seq_len, d_model)
        Returns:
            x + positional encoding, same shape
        """
        x = x + self.pe[:, : x.size(1)]
        return self.dropout(x)


# Quick sanity check
if __name__ == "__main__":
    enc = SinusoidalPositionalEncoding(d_model=512, max_seq_len=2048)
    dummy = torch.randn(2, 128, 512)
    out = enc(dummy)
    print(out.shape)  # torch.Size([2, 128, 512])
```

### 2.5 Properties Summary

| Property | Value |
|---|---|
| Learned parameters | None (fixed) |
| Max context | Soft limit (~5000 in original, extendable) |
| Extrapolation | Limited but non-zero |
| Memory overhead | $O(L \cdot d)$ buffer, not gradient |
| Used by | Original Transformer (Vaswani 2017) |

---

## 3. Learned Absolute Positional Embeddings

### 3.1 Approach

Rather than computing positions analytically, simply **train a lookup table** $E_{pos} \in \mathbb{R}^{L_{max} \times d_{model}}$ where $L_{max}$ is the maximum supported sequence length:

$$
\text{input}_i = \text{TokenEmbed}(x_i) + E_{pos}[i]
$$

Every position index $i$ maps to a unique, freely-optimised embedding vector.

### 3.2 Usage in GPT and BERT

- **GPT-1 / GPT-2 (OpenAI):** Learned position embeddings with $L_{max} = 1024$ (GPT-2 medium). In GPT-2, the positional embedding table has shape `(1024, 768)`.
- **BERT (Google):** Learned position embeddings with $L_{max} = 512$.
- **OPT:** Learned absolute positions up to 2048.

In code (HuggingFace style):

```python
import torch.nn as nn

class GPT2Embeddings(nn.Module):
    def __init__(self, vocab_size: int, d_model: int, max_pos: int = 1024):
        super().__init__()
        self.token_embed = nn.Embedding(vocab_size, d_model)
        self.pos_embed   = nn.Embedding(max_pos, d_model)   # ← learned positional

    def forward(self, input_ids: "torch.Tensor") -> "torch.Tensor":
        B, T = input_ids.shape
        positions = torch.arange(T, device=input_ids.device)
        return self.token_embed(input_ids) + self.pos_embed(positions)
```

### 3.3 Advantages

- Simple to implement.
- Model can learn position-specific patterns (e.g., "position 0 is usually BOS").
- Fits naturally into existing embedding infrastructure.

### 3.4 Limitations

| Limitation | Detail |
|---|---|
| **Hard maximum context** | No extrapolation beyond $L_{max}$ — index out-of-range error |
| **Parameter cost** | $L_{max} \times d_{model}$ parameters (e.g., 512 × 768 = 393K for BERT) |
| **Poor generalisation at boundaries** | Position 511 seen rarely; performance drops near max |
| **No structural inductive bias** | Must learn from scratch that position 5 is "5 away from 1" |

---

## 4. Relative Positional Encodings

### 4.1 Motivation

Absolute encodings assign a fixed vector to each position. But what the model usually needs is **relative distance** — "how far is token $j$ from token $i$?" — not the absolute index of either. Relative encodings encode the gap $i - j$ directly.

### 4.2 Shaw et al. (2018) — Attention Logit Bias

Shaw, Uszkoreit & Vaswani (2018) modified the attention score to include relative position information:

$$
e_{ij} = \frac{x_i W_Q (x_j W_K + a_{ij}^K)^\top}{\sqrt{d_k}}
$$

$$
\text{output}_i = \sum_j \alpha_{ij} (x_j W_V + a_{ij}^V)
$$

where $a_{ij}^K$ and $a_{ij}^V$ are **learned relative position embeddings** for the offset $\text{clip}(j - i, -k, k)$ clipped to range $[-k, k]$.

**Key insight:** At most $2k + 1$ distinct relative positions are needed, regardless of sequence length.

```python
import torch
import torch.nn as nn

class RelativeAttentionShaw(nn.Module):
    """Simplified Shaw et al. 2018 relative position attention."""
    def __init__(self, d_model: int, n_heads: int, max_relative: int = 16):
        super().__init__()
        self.n_heads = n_heads
        self.d_k = d_model // n_heads
        self.max_rel = max_relative

        self.W_Q = nn.Linear(d_model, d_model)
        self.W_K = nn.Linear(d_model, d_model)
        self.W_V = nn.Linear(d_model, d_model)

        # Relative position embeddings: (2*max_rel+1, d_k)
        self.rel_key_embed = nn.Embedding(2 * max_relative + 1, self.d_k)

    def _clip_offset(self, offset: int) -> int:
        return max(-self.max_rel, min(self.max_rel, offset)) + self.max_rel

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        B, T, C = x.shape
        Q = self.W_Q(x).view(B, T, self.n_heads, self.d_k).transpose(1, 2)
        K = self.W_K(x).view(B, T, self.n_heads, self.d_k).transpose(1, 2)
        V = self.W_V(x).view(B, T, self.n_heads, self.d_k).transpose(1, 2)

        # Standard attention scores: (B, H, T, T)
        scores = torch.matmul(Q, K.transpose(-2, -1)) / (self.d_k ** 0.5)

        # Add relative position bias to scores
        # Build relative indices: (T, T) of clipped offsets
        offsets = [[self._clip_offset(j - i) for j in range(T)] for i in range(T)]
        offset_ids = torch.tensor(offsets, device=x.device)       # (T, T)
        rel_emb = self.rel_key_embed(offset_ids)                   # (T, T, d_k)

        # Q * rel_emb^T; broadcast over batch and heads
        rel_scores = torch.einsum("bhtd,ijd->bhij", Q, rel_emb) / (self.d_k ** 0.5)
        scores = scores + rel_scores

        attn = torch.softmax(scores, dim=-1)
        return torch.matmul(attn, V).transpose(1, 2).contiguous().view(B, T, C)
```

### 4.3 T5 Relative Position Bias

Google's T5 (Raffel et al., 2020) uses a simpler approach:

- Bucket relative positions into a fixed number of buckets (e.g., 32).
- Small offsets get individual buckets; large offsets share logarithmically-spaced buckets.
- A **scalar bias** per (head, bucket) is added to attention logits — no dimensional overhead.

$$
a_{ij} = b(i - j) \in \mathbb{R}
$$

where $b$ is a learnable 1D lookup over bucketed offsets.

**Bucketing formula:**

$$
\text{bucket}(\Delta) = \begin{cases}
|\Delta| & \text{if } |\Delta| < \text{num\_exact} \\
\text{num\_exact} + \left\lfloor \log\!\left(\frac{|\Delta|}{\text{num\_exact}}\right) \cdot \frac{n_{\text{buckets}} - \text{num\_exact}}{\log(L_{\max}/\text{num\_exact})} \right\rfloor & \text{otherwise}
\end{cases}
$$

```python
import math
import torch
import torch.nn as nn

def t5_bucket_relative_positions(
    query_len: int,
    key_len: int,
    num_buckets: int = 32,
    max_distance: int = 128,
    bidirectional: bool = True,
) -> torch.Tensor:
    """Returns bucketed relative position IDs of shape (query_len, key_len)."""
    relative_pos = torch.arange(key_len).unsqueeze(0) - torch.arange(query_len).unsqueeze(1)
    # relative_pos: (q, k)

    if bidirectional:
        num_buckets //= 2
        relative_buckets = (relative_pos > 0).long() * num_buckets
        relative_pos = relative_pos.abs()
    else:
        relative_pos = -torch.minimum(relative_pos, torch.zeros_like(relative_pos))

    max_exact = num_buckets // 2
    is_small = relative_pos < max_exact

    val_if_large = max_exact + (
        torch.log(relative_pos.float() / max_exact)
        / math.log(max_distance / max_exact)
        * (num_buckets - max_exact)
    ).long().clamp(max=num_buckets - 1)

    relative_buckets += torch.where(is_small, relative_pos.long(), val_if_large)
    return relative_buckets
```

### 4.4 Absolute vs Relative: Comparison

| Aspect | Absolute | Relative |
|---|---|---|
| Encodes | Position index $i$ | Offset $i - j$ |
| Extrapolation | None (learned) / limited (sinusoidal) | Better (clip to $[-k, k]$) |
| Memory | $O(L_{max} \cdot d)$ | $O(k \cdot d)$ or $O(\text{buckets})$ |
| Computation | Zero overhead at attention | Small overhead per layer ($O(T^2 d)$) |
| Multi-head sharing | Shared | Often per-head (biases) |
| Used by | GPT-2, BERT, OPT | T5, Transformer-XL, DeBERTa |

---

## 5. Rotary Position Embedding (RoPE)

RoPE (Su et al., 2021 — *RoFormer*) is currently the **dominant positional encoding** for open-weight LLMs. It encodes position by rotating Q and K vectors, ensuring the attention score depends only on *relative* distance.

### 5.1 Core Idea

Instead of adding a positional vector to the token embedding, RoPE applies a **position-dependent rotation** to the query and key vectors *inside each attention head*, right before the dot product:

$$
\tilde{q}_m = R_{\Theta,m}^d \, q_m, \qquad \tilde{k}_n = R_{\Theta,n}^d \, k_n
$$

The key property is that the inner product of two rotated vectors depends only on their **relative position** $m - n$:

$$
\tilde{q}_m^\top \tilde{k}_n = q_m^\top R_{\Theta,m-n}^d \, k_n = f(q_m, k_n, m-n)
$$

### 5.2 Mathematical Derivation

#### 2D Case (one frequency band)

For a single frequency $\theta$, the rotation of vector $\mathbf{v} = [v_1, v_2]^\top$ at position $m$ is:

$$
R_{\theta,m} \mathbf{v} =
\begin{bmatrix} \cos(m\theta) & -\sin(m\theta) \\ \sin(m\theta) & \cos(m\theta) \end{bmatrix}
\begin{bmatrix} v_1 \\ v_2 \end{bmatrix}
$$

The inner product of two rotated vectors:

$$
(R_{\theta,m} \mathbf{q})^\top (R_{\theta,n} \mathbf{k})
= \mathbf{q}^\top R_{\theta,m}^\top R_{\theta,n} \mathbf{k}
= \mathbf{q}^\top R_{\theta, n-m} \mathbf{k}
$$

This equals $\mathbf{q}^\top R_{\theta, n-m} \mathbf{k}$, which depends **only on the relative position** $n - m$. ✓

#### Full $d$-dimensional Case

The $d$-dimensional rotation matrix $R_{\Theta,m}^d$ is block-diagonal, with each $2 \times 2$ block handling one frequency:

$$
R_{\Theta,m}^d = \begin{bmatrix}
\cos(m\theta_0) & -\sin(m\theta_0) & 0 & \cdots & 0 \\
\sin(m\theta_0) & \cos(m\theta_0) & 0 & \cdots & 0 \\
0 & 0 & \cos(m\theta_1) & -\sin(m\theta_1) & \vdots \\
0 & 0 & \sin(m\theta_1) & \cos(m\theta_1) & \vdots \\
\vdots & & & & \ddots \\
\end{bmatrix}
$$

### 5.3 Base Frequencies

The frequencies follow the same geometric schedule as sinusoidal encodings:

$$
\theta_i = 10000^{-2i/d_{\text{head}}}, \qquad i = 0, 1, \ldots, \frac{d_{\text{head}}}{2} - 1
$$

- Low $i$ → high frequency → sensitive to nearby positions.
- High $i$ → low frequency → encodes long-range position.

### 5.4 Efficient Implementation with Complex Numbers

The rotation can be computed efficiently using complex number multiplication:

$$
R_{\theta, m} \mathbf{v} \equiv \bigl(v_1 + i \, v_2\bigr) \cdot e^{i m \theta}
$$

In PyTorch, this translates to element-wise complex multiplication:

```python
import torch
import torch.nn as nn
from typing import Tuple

def precompute_rope_freqs(
    d_head: int,
    max_seq_len: int,
    base: float = 10000.0,
    device: torch.device = torch.device("cpu"),
) -> Tuple[torch.Tensor, torch.Tensor]:
    """
    Precompute cos and sin caches for RoPE.

    Returns:
        cos_cache: (max_seq_len, d_head/2)
        sin_cache: (max_seq_len, d_head/2)
    """
    half_dim = d_head // 2
    # theta_i = base^(-2i/d_head) for i in [0, half_dim)
    theta = 1.0 / (base ** (torch.arange(0, half_dim, device=device).float() / half_dim))

    # positions: (max_seq_len,)
    positions = torch.arange(max_seq_len, device=device).float()

    # freqs: (max_seq_len, half_dim) = outer product
    freqs = torch.outer(positions, theta)  # m * theta_i

    return freqs.cos(), freqs.sin()


def apply_rope(
    x: torch.Tensor,
    cos: torch.Tensor,
    sin: torch.Tensor,
) -> torch.Tensor:
    """
    Apply RoPE to query or key tensor.

    Args:
        x:   (batch, n_heads, seq_len, d_head)
        cos: (seq_len, d_head/2)
        sin: (seq_len, d_head/2)
    Returns:
        Rotated tensor, same shape as x
    """
    B, H, T, D = x.shape
    half = D // 2

    # Split into first and second halves
    x1 = x[..., :half]   # (B, H, T, D/2)
    x2 = x[..., half:]   # (B, H, T, D/2)

    # Broadcast cos/sin to match (B, H, T, D/2)
    cos_ = cos[:T].unsqueeze(0).unsqueeze(0)  # (1, 1, T, D/2)
    sin_ = sin[:T].unsqueeze(0).unsqueeze(0)

    # Rotate: [x1, x2] -> [x1*cos - x2*sin, x2*cos + x1*sin]
    rotated_x1 = x1 * cos_ - x2 * sin_
    rotated_x2 = x2 * cos_ + x1 * sin_

    return torch.cat([rotated_x1, rotated_x2], dim=-1)


class RoPEAttention(nn.Module):
    """Multi-head attention with Rotary Position Embedding."""

    def __init__(self, d_model: int, n_heads: int, max_seq_len: int = 4096, base: float = 10000.0):
        super().__init__()
        assert d_model % n_heads == 0
        self.n_heads = n_heads
        self.d_head = d_model // n_heads
        self.W_Q = nn.Linear(d_model, d_model, bias=False)
        self.W_K = nn.Linear(d_model, d_model, bias=False)
        self.W_V = nn.Linear(d_model, d_model, bias=False)
        self.out  = nn.Linear(d_model, d_model, bias=False)

        cos_cache, sin_cache = precompute_rope_freqs(
            self.d_head, max_seq_len, base=base
        )
        self.register_buffer("cos_cache", cos_cache)
        self.register_buffer("sin_cache", sin_cache)

    def forward(self, x: torch.Tensor, mask: torch.Tensor = None) -> torch.Tensor:
        B, T, C = x.shape
        H, D = self.n_heads, self.d_head

        def split_heads(t):
            return t.view(B, T, H, D).transpose(1, 2)  # (B, H, T, D)

        Q = split_heads(self.W_Q(x))
        K = split_heads(self.W_K(x))
        V = split_heads(self.W_V(x))

        # Apply RoPE to Q and K
        Q = apply_rope(Q, self.cos_cache, self.sin_cache)
        K = apply_rope(K, self.cos_cache, self.sin_cache)

        # Scaled dot-product attention
        scores = torch.matmul(Q, K.transpose(-2, -1)) / (D ** 0.5)
        if mask is not None:
            scores = scores.masked_fill(mask == 0, float("-inf"))
        attn = torch.softmax(scores, dim=-1)

        out = torch.matmul(attn, V)            # (B, H, T, D)
        out = out.transpose(1, 2).contiguous().view(B, T, C)
        return self.out(out)
```

### 5.5 Alternative Interleaved Implementation

Some codebases (LLaMA 2, Mistral) use a different pairing: instead of splitting the first vs second halves, they interleave pairs $(x_0, x_1), (x_2, x_3), \ldots$:

```python
def rotate_half(x: torch.Tensor) -> torch.Tensor:
    """Rotate the last dimension by interleaving pairs."""
    x1 = x[..., ::2]   # even indices
    x2 = x[..., 1::2]  # odd indices
    return torch.stack([-x2, x1], dim=-1).flatten(-2)

def apply_rope_interleaved(x, cos, sin):
    # cos/sin shape: (seq_len, d_head)
    return x * cos + rotate_half(x) * sin
```

### 5.6 Long-Context Extensions for RoPE

The base frequency $\theta_i = 10000^{-2i/d}$ determines the maximum "distinguishable period" of each dimension. When a model is trained on length $L$ but runs on length $L' > L$, high-frequency dimensions wrap around and become aliased—the model has not learned to distinguish these positions.

#### 5.6.1 Position Interpolation (Chen et al., 2023)

Scale down all position indices by the ratio $s = L/L'$:

$$
m \leftarrow m \cdot \frac{L}{L'}
$$

After this scaling, a sequence of length $L'$ occupies the same positional range $[0, L)$ as the training distribution. Fine-tuning for a small number of steps (1000–10,000) suffices to recover near-original performance.

```python
def apply_position_interpolation(positions: torch.Tensor, train_len: int, target_len: int):
    scale = train_len / target_len
    return positions * scale
```

#### 5.6.2 NTK-Aware Scaling

Neural Tangent Kernel (NTK) scaling changes the **base** $b$ instead of scaling positions. Proposed by /u/bloc97 on Reddit (2023):

$$
b' = b \cdot \left(\frac{L'}{L}\right)^{d / (d - 2)}
$$

This uniformly spreads the frequency spectrum so that **no dimension is aliased**. Unlike linear interpolation, it preserves short-context performance (no change for distances $< L$).

```python
def ntk_scaled_base(
    original_base: float,
    train_len: int,
    target_len: int,
    d_head: int,
) -> float:
    scale = target_len / train_len
    return original_base * (scale ** (d_head / (d_head - 2)))
```

#### 5.6.3 YaRN (Peng et al., 2023)

YaRN (*Yet Another RoPE extensioN*) observes that different frequency bands need different treatment:

- **High frequency** (small $\theta_i$): no scaling needed — these dimensions already cover short distances fine.
- **Medium frequency**: NTK-style interpolation.
- **Low frequency** (large $\theta_i$, near $1/10000$): linear interpolation is better.

YaRN blends these strategies per dimension, plus applies an **attention temperature** correction $\sqrt{L/L'}$ to counteract the softmax sharpening from reduced positional variance.

$$
\tilde{\theta}_i = \begin{cases}
\theta_i & r_i < 1 \quad\text{(high freq, no change)} \\
\theta_i / s & r_i > \gamma \quad\text{(linear interp)} \\
\text{NTK blend} & \text{otherwise}
\end{cases}
$$

where $r_i = d_{\text{head}} / (2\pi \lambda_i)$ is the ratio of dimension $i$'s wavelength to context length.

#### 5.6.4 LongRoPE (Ding et al., 2024)

LongRoPE searches for **non-uniform** rescaling factors per dimension using an evolutionary algorithm, then performs a two-stage fine-tuning process:

1. Train at 256k context with the found scaling.
2. Recover short-context performance by reverting to $8 \times$ scaling for short sequences.

#### 5.6.5 How LLaMA / Mistral / Qwen Use RoPE

| Model | Base $\theta$ | Context | Extension Method |
|---|---|---|---|
| LLaMA 2 (7–70B) | 10,000 | 4,096 | None |
| LLaMA 3 (8–70B) | 500,000 | 8,192 (→ 128k) | High base + fine-tuning |
| Mistral 7B | 10,000 | 8,192 | Sliding window + RoPE |
| Mistral v0.3 | 1,000,000 | 32,768 | High base |
| Qwen 1.5 | 1,000,000 | 32,768 | High base + NTK |
| Qwen 2.5 (72B) | 1,000,000 | 128,000 | YaRN-style |
| Phi-3 mini | 10,000 → 500,000 | 128,000 | LongRoPE |

---

## 6. ALiBi — Attention with Linear Biases

### 6.1 Core Idea

ALiBi (Press et al., 2022 — *Train Short, Test Long*) adds no positional embedding at all. Instead, it subtracts a **linear penalty** proportional to key-query distance directly from attention logits:

$$
\text{softmax}\!\left(q_i K^\top + m_h \cdot \left[-|i - j|\right]_{j=0}^{T}\right)
$$

where $m_h$ is a **head-specific** slope and $-|i - j|$ is the negative absolute distance.

### 6.2 The Bias Matrix

For a sequence of length $T$, the ALiBi bias matrix for a single head with slope $m$ is:

$$
B = m \cdot
\begin{bmatrix}
0    & -1  & -2  & -3  & \cdots \\
0    &  0  & -1  & -2  & \cdots \\
0    &  0  &  0  & -1  & \cdots \\
\vdots & & & & \ddots
\end{bmatrix}
$$

(Causal masking zeros out the upper triangle.)

This is **not learned** — the slopes $m_h$ are geometric:

$$
m_h = 2^{-8h/n_{\text{heads}}}, \quad h = 1, \ldots, n_{\text{heads}}
$$

For 8 heads: $m \in \{2^{-1}, 2^{-2}, \ldots, 2^{-8}\} = \{0.5, 0.25, \ldots, 0.0039\}$.

### 6.3 ALiBi Properties

```python
import torch
import torch.nn as nn
import math

def get_alibi_slopes(n_heads: int) -> torch.Tensor:
    """
    Compute ALiBi per-head slopes m_h.
    Press et al. 2022: m_h = 2^(-8h/n_heads)
    """
    def compute_slopes(n: int):
        ratio = 2 ** (-8 / n)
        return torch.tensor([ratio ** (h + 1) for h in range(n)])

    if math.log2(n_heads).is_integer():
        slopes = compute_slopes(n_heads)
    else:
        # Handle non-power-of-2 head counts: combine two power-of-2 sets
        closest_pow2 = 2 ** math.floor(math.log2(n_heads))
        slopes = compute_slopes(closest_pow2)
        extra  = compute_slopes(2 * closest_pow2)[::2][: n_heads - closest_pow2]
        slopes = torch.cat([slopes, extra])
    return slopes


def compute_alibi_bias(
    seq_len: int,
    n_heads: int,
    device: torch.device = torch.device("cpu"),
) -> torch.Tensor:
    """
    Compute ALiBi bias matrix.

    Returns:
        bias: (n_heads, seq_len, seq_len) — to be added to raw attention scores
    """
    slopes = get_alibi_slopes(n_heads).to(device)           # (H,)
    positions = torch.arange(seq_len, device=device)        # (T,)
    rel_dist = positions.unsqueeze(0) - positions.unsqueeze(1)  # (T, T)
    rel_dist = -rel_dist.abs()                              # (T, T) — negative distances

    # bias[h, i, j] = m_h * (-|i - j|)
    bias = slopes.view(-1, 1, 1) * rel_dist.unsqueeze(0)   # (H, T, T)
    return bias
```

### 6.4 Extrapolation Properties

ALiBi's linear penalty **smoothly penalizes** long-range attention across any length, making it naturally zero-shot extensible:

- At training length $L$: distances are $0, 1, \ldots, L-1$.
- At inference length $2L$: distances go up to $2L - 1$, all still in-distribution for the bias function.

This is ALiBi's main advantage over RoPE in its base form: **no fine-tuning needed** to extend context.

However, ALiBi has weaker absolute-position discrimination:
- Cannot distinguish "token at position 5" from "same token at position 500 attending to something 5 steps away."

### 6.5 Models Using ALiBi

| Model | Organisation | Notes |
|---|---|---|
| BLOOM (176B) | BigScience | First large-scale ALiBi model |
| MPT-7B / MPT-30B | MosaicML | 65k context using ALiBi |
| BioMedLM | Stanford | Domain-specific |

### 6.6 ALiBi vs RoPE: Key Differences

| Property | ALiBi | RoPE |
|---|---|---|
| Position injection point | Attention logit bias | Q/K rotation (before dot-product) |
| Zero-shot length generalisation | Yes (linear penalty scales naturally) | No (aliasing at $> L_{train}$) |
| Short-range accuracy | Slightly weaker (no high-freq dims) | Excellent |
| Fine-tuning for long context | Not needed | Needed for $> 2\times$ extension |
| Integration with Flash Attention | Requires modification | Native (kernel-fused) |
| Current adoption (2024) | Declining | Dominant |

---

## 7. Sliding Window Attention

### 7.1 Concept

In standard attention, every token $i$ attends to **every** other token, giving $O(T^2)$ complexity. Sliding Window Attention (SWA) restricts each token to attend only within a **local window** of size $w$:

$$
e_{ij} = \begin{cases}
q_i \cdot k_j / \sqrt{d_k} & \text{if } |i - j| \leq w/2 \\
-\infty & \text{otherwise}
\end{cases}
$$

This reduces attention complexity to $O(T \cdot w)$.

### 7.2 Relation to Positional Context

SWA is **implicitly a positional mechanism**: tokens more than $w$ positions apart simply cannot attend to each other. This constrains the positional range the model can use within a single layer — but across $L$ layers, information can propagate up to $L \cdot w$ positions (receptive field grows linearly with depth).

### 7.3 Sparse Attention Patterns

The full $T \times T$ attention matrix is replaced with a banded sparse pattern:

```
T=8, w=4 (each row shows which keys are attended to):
Position:  0  1  2  3  4  5  6  7
Token 0: [ ■  ■  ■  .  .  .  .  . ]
Token 1: [ ■  ■  ■  ■  .  .  .  . ]
Token 2: [ ■  ■  ■  ■  ■  .  .  . ]
Token 3: [ .  ■  ■  ■  ■  ■  .  . ]
Token 4: [ .  .  ■  ■  ■  ■  ■  . ]
Token 5: [ .  .  .  ■  ■  ■  ■  ■ ]
Token 6: [ .  .  .  .  ■  ■  ■  ■ ]
Token 7: [ .  .  .  .  .  ■  ■  ■ ]
                             (causal variant looks different)
```

### 7.4 Mistral and Grouped-Query + Sliding Window

Mistral 7B (Jiang et al., 2023) combines two efficiency techniques:

1. **Grouped-Query Attention (GQA):** Multiple query heads share a smaller number of key/value heads.
2. **Sliding Window Attention (SWA):** $w = 4096$ per layer.

With 32 layers and $w = 4096$, effective receptive field = $32 \times 4096 = 131{,}072$ tokens.

```python
import torch
import torch.nn as nn
import torch.nn.functional as F

def sliding_window_mask(seq_len: int, window_size: int, causal: bool = True) -> torch.Tensor:
    """
    Create a (seq_len, seq_len) boolean attention mask for sliding-window attention.
    True = attend, False = mask out.
    """
    i = torch.arange(seq_len).unsqueeze(1)
    j = torch.arange(seq_len).unsqueeze(0)
    # Local window condition
    local = (i - j).abs() <= window_size // 2
    # Causal condition
    if causal:
        causal_mask = j <= i
        return local & causal_mask
    return local


# Usage in attention:
# mask = sliding_window_mask(seq_len, window_size=4096)
# scores.masked_fill_(~mask, float("-inf"))
```

### 7.5 Global Tokens

For tasks requiring long-range reasoning, SWA is often augmented with **global tokens** (e.g., a `[CLS]` token) that attend to the entire sequence:

- Longformer (Beltagy et al., 2020): local + global attention.
- BigBird (Zaheer et al., 2020): local + global + random attention.

In these models, a small set of designated global positions bypass the window restriction.

---

## 8. NoPE — No Positional Encoding

### 8.1 Research Finding

A 2023 paper by Haviv et al. (*Transformer Language Models without Positional Encodings Still Learn Positional Information*) showed that **decoder-only LLMs without any explicit positional encoding** can still learn to track positions implicitly.

The mechanism: causal masking provides a directional asymmetry. The attention pattern for token $T$ looks at all preceding tokens — even without position IDs, the **causal structure** creates an implicit positional signal through the attention distribution.

### 8.2 Why It Works (Intuition)

In a causally masked transformer:

$$
\alpha_{ij} = 0 \quad \forall j > i
$$

For token $i$, the softmax is computed over exactly $i + 1$ available keys. As $i$ grows, the denominator of the softmax includes more terms — this by itself is a positional signal the model can exploit. The **relative number of masked-out versus unmasked keys** is a proxy for absolute position.

Additionally, residual stream statistics evolve with depth and with how many preceding tokens have "contributed" to the state.

### 8.3 Practical Results

| Configuration | Short-context (≤512) | Long-context |
|---|---|---|
| Sinusoidal PE | Baseline | Degrades at >training length |
| RoPE | Strong | Strong with extensions |
| ALiBi | Strong | Very strong extrapolation |
| **NoPE** | Competitive (~1-2% loss vs RoPE) | **Best extrapolation** |

NoPE models generalise to **much longer** sequences (up to 4× training length with no degradation in one study), because there is no positional signal to become "out-of-distribution."

### 8.4 Limitations

- Cannot encode precise absolute position (may hurt tasks requiring absolute indexing).
- Weaker in very short sequences (1–8 tokens) where causal structure gives little signal.
- Results are still contested — most production models still use explicit PE.

---

## 9. Context Length Extension Techniques

### 9.1 The Core Problem

Models trained on context $L$ have their positional encoding system calibrated to that range. Running inference at $L' > L$ causes:

- **Sinusoidal/Learned:** Positions $> L$ have no trained representation → catastrophic degradation.
- **RoPE:** High-frequency dimensions wrap around (aliasing); attention score distribution collapses.
- **ALiBi:** Natural extrapolation but accuracy degrades for very long distances.

### 9.2 Position Interpolation (PI)

**Chen et al., 2023** — *Extending Context Window of Large Language Models via Positional Interpolation*

Compress all position indices into $[0, L)$:

$$
m' = m \cdot \frac{L}{L'} \quad \Rightarrow \quad \theta'_m = m' \cdot \theta_i = \frac{mL}{L'} \cdot \theta_i
$$

Then fine-tune for ~1000 steps with the interpolated positions. This was applied to extend LLaMA from 2k → 32k context.

**Pros:** Simple, works well.  
**Cons:** Degrades short-context performance (high-frequency dimensions become indistinguishable for nearby tokens).

### 9.3 NTK-Aware Scaling (Dynamic)

Instead of scaling positions, scale the **base**:

$$
b_{\text{new}} = b \cdot \left(\frac{L'}{L}\right)^{d/(d-2)}
$$

**Dynamic NTK** (no fine-tuning required) adjusts the base per-request based on actual sequence length:

```python
def dynamic_ntk_rope(
    d_head: int,
    seq_len: int,
    train_len: int,
    base: float = 10000.0,
) -> Tuple[torch.Tensor, torch.Tensor]:
    """Dynamically adjust RoPE base using NTK scaling."""
    if seq_len > train_len:
        scale = seq_len / train_len
        base = base * (scale ** (d_head / (d_head - 2)))
    return precompute_rope_freqs(d_head, seq_len, base=base)
```

### 9.4 YaRN Scaling

As described in §5.6.3, YaRN applies **dimension-dependent** interpolation:

- Leave high-frequency dimensions untouched.
- Apply NTK-style scaling to mid-frequency dimensions.
- Apply linear interpolation to low-frequency dimensions.
- Apply attention temperature correction: multiply scores by $\sqrt{L/L'}$.

YaRN at 2× extension requires only 400 fine-tuning steps; at 16× extension ~10k steps.

### 9.5 LongRoPE

Uses an **evolutionary search** to find the optimal non-uniform rescale factor per dimension, then fine-tunes in two stages:

1. **Stage 1:** Train at $4 \times L'$ with found scaling (exploits out-of-distribution positions to find stable scaling).
2. **Stage 2:** Fine-tune with $1 \times$ context while restoring short-context scaling for short inputs.

LongRoPE achieves 2M token context for Phi-3 mini (3.8B parameters).

### 9.6 Summary Comparison Table

| Method | Fine-tuning Required | Short Context Impact | Max Extension | Complexity |
|---|---|---|---|---|
| Position Interpolation | Yes (~1k steps) | Minor degradation | 8–16× | Very simple |
| NTK Scaling (static) | No | None | 2–4× | Simple |
| NTK Scaling (dynamic) | No | None | 4–8× | Simple |
| YaRN | Yes (small) | None | 8–16× | Moderate |
| LongRoPE | Yes (full) | None (explicit fix) | 128–512× | Complex |
| ALiBi (zero-shot) | No | None | 4–8× | N/A (ALiBi) |

---

## 10. Master Comparison Table

| Method | Extrapolation | Memory Cost | Attn Overhead | Models | Notes |
|---|---|---|---|---|
| **Sinusoidal (fixed)** | Limited | Zero (buffer) | Zero | Original Transformer | Good baseline |
| **Learned Absolute** | None | $L_{max} \times d$ | Zero | GPT-2, BERT, OPT | Hard max context |
| **Shaw Relative** | Better | $O(k \cdot d)$ | $O(T^2 d)$ | TransformerXL | Rarely used now |
| **T5 Bias** | Good | $O(\text{buckets})$ scalar | Small | T5, Flan-T5, UL2 | Scalars only |
| **RoPE** | With extension | Zero (computed) | Negligible | LLaMA 1–3, Mistral, Qwen, Gemma | Current standard |
| **ALiBi** | Excellent | Zero (computed) | Negligible | BLOOM, MPT | Declining adoption |
| **NoPE** | Best | Zero | Zero | Research, Mamba variants | No explicit encoding |

---

## 11. Practical Implications

### 11.1 Choosing a PE for a New Model

- **General-purpose LLM:** Use **RoPE** with a high base (≥ 500,000) and plan to extend via YaRN.
- **Fixed-length encoder (BERT-style):** **Learned absolute** is fine if $L_{max}$ is fixed.
- **Long-context from day 1:** Use **ALiBi** or **RoPE + YaRN** with large training context.
- **Research / ablation:** Try **NoPE** to establish an implicit position baseline.

### 11.2 Extending Context of an Existing RoPE Model

1. **Quick test (no fine-tuning):** Use Dynamic NTK scaling. ≤4× extension with minimal degradation.
2. **Production quality (2–8×):** Fine-tune with YaRN for 400–10k steps on long-document data.
3. **Extreme extension (>8×):** Use LongRoPE's two-stage procedure or full pre-training continuation.

**Data requirements for extension fine-tuning:**
- Needs genuine long-context data (not repeated short docs).
- Typical mixture: 80% long (>target length), 20% short (for retention).
- Learning rate: 10% of original pre-training LR.
- Steps: 100–10,000 depending on extension ratio.

### 11.3 Flash Attention Compatibility

| PE Method | Flash Attention 2 Compatible? | Notes |
|---|---|---|
| Sinusoidal / Learned | Yes | PE is applied before attention |
| RoPE | Yes | Applied to Q/K before kernel |
| ALiBi | Partial | Requires custom kernel pass (bias addition) |
| T5 Bias | Partial | Requires custom kernel |
| NoPE | Yes (trivially) | No modification needed |

### 11.4 Memory and Speed Budgets

For a model with $d_{\text{model}} = 4096$, $H = 32$ heads, $d_h = 128$:

| PE | Params Added | Per-layer FLOP overhead |
|---|---|---|
| Sinusoidal | 0 | 0 |
| Learned (4096 ctx) | 4096 × 4096 = **16.8M** | 0 |
| Learned (128k ctx) | 128k × 4096 = **537M** | 0 |
| RoPE | 0 | ~2M multiply-adds per layer |
| ALiBi | 0 (32 scalars) | ~T² addtions per layer |
| T5 Bias | 32 × 32 = 1024 scalars | ~T² additions |

### 11.5 KV Cache and Positional Consistency

When using KV caching for autoregressive generation, the key/value representations are computed at specific positions and cached. This works natively for absolute and RoPE approaches because:

- **Absolute:** Position embedding is baked in at encoding time.
- **RoPE:** Rotation is applied to K before caching; at decode time, Q is rotated with the new position, K retains its original rotation.
- **ALiBi:** Bias is applied dynamically at each step — the cached K doesn't need re-rotation.

For **sliding window** caches, the cache must be implemented as a **rolling buffer** of size $w$, evicting old key-value pairs:

```python
class RollingKVCache:
    """Circular buffer KV cache for sliding window attention."""
    def __init__(self, max_size: int, n_heads: int, d_head: int):
        self.max_size = max_size
        self.k_cache = torch.zeros(1, n_heads, max_size, d_head)
        self.v_cache = torch.zeros(1, n_heads, max_size, d_head)
        self.ptr = 0
        self.size = 0

    def update(self, k: torch.Tensor, v: torch.Tensor):
        """Insert a single new key/value at the current pointer."""
        idx = self.ptr % self.max_size
        self.k_cache[:, :, idx] = k.squeeze(2)
        self.v_cache[:, :, idx] = v.squeeze(2)
        self.ptr += 1
        self.size = min(self.size + 1, self.max_size)

    def get(self) -> Tuple[torch.Tensor, torch.Tensor]:
        return self.k_cache[:, :, : self.size], self.v_cache[:, :, : self.size]
```

---

## See Also

| # | File | Topic |
|---|---|---|
| 00 | [llm-foundations-00-index.md](./llm-foundations-00-index.md) | Series index |
| 01 | [llm-foundations-01-transformer-architecture.md](./llm-foundations-01-transformer-architecture.md) | Transformer architecture |
| 02 | [llm-foundations-02-tokenization.md](./llm-foundations-02-tokenization.md) | Tokenization (BPE, WordPiece, SentencePiece) |
| **03** | **llm-foundations-03-positional-encodings.md** | **← You are here** |
| 04 | [llm-foundations-04-scaling-laws-compute.md](./llm-foundations-04-scaling-laws-compute.md) | Scaling laws and compute |
| 05 | [llm-foundations-05-advanced-architectures.md](./llm-foundations-05-advanced-architectures.md) | Advanced architectures |
| 06 | [llm-foundations-06-parameter-efficiency.md](./llm-foundations-06-parameter-efficiency.md) | Parameter efficiency (LoRA, QLoRA) |
| 07 | [llm-foundations-07-training-techniques.md](./llm-foundations-07-training-techniques.md) | Training techniques |
| 08 | [llm-foundations-08-low-rank-training.md](./llm-foundations-08-low-rank-training.md) | Low-rank training |
| 09 | [llm-foundations-09-rlhf-alignment.md](./llm-foundations-09-rlhf-alignment.md) | RLHF and alignment |
| 10 | [llm-foundations-10-quantization-deep-dive.md](./llm-foundations-10-quantization-deep-dive.md) | Quantization |
| 11 | [llm-foundations-11-inference-optimization.md](./llm-foundations-11-inference-optimization.md) | Inference optimization |
| 12 | [llm-foundations-12-test-time-compute.md](./llm-foundations-12-test-time-compute.md) | Test-time compute |
| 13 | [llm-foundations-13-sota-benchmarks.md](./llm-foundations-13-sota-benchmarks.md) | SOTA benchmarks |
