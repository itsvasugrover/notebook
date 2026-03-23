---
title: "Installation & Build Guide"
createTime: 2026/03/21 10:03:00
permalink: /kb/ai/llama-cpp/installation-build/
---

# Installation & Build Guide

llama.cpp offers multiple paths to get running: build from source for maximum hardware optimization, use prebuilt binaries for convenience, or install the Python bindings via pip. This guide covers all three.

## Prerequisites

| Tool | Minimum Version | Purpose |
|------|----------------|---------|
| Git | 2.x | Cloning the repository |
| CMake | 3.14 | Build system |
| C++ compiler | C++17 support | Compilation |
| CUDA Toolkit | 11.8+ (12.x recommended) | CUDA backend |
| ROCm | 5.x | AMD GPU backend |
| Vulkan SDK | 1.3+ | Vulkan backend |

### Install Prerequisites

**Linux (Debian/Ubuntu)**:
```bash
sudo apt update && sudo apt install -y \
  git cmake build-essential
```

**macOS**:
```bash
xcode-select --install
brew install cmake
```

**Windows**:
- Install Visual Studio 2022 (or Build Tools) with Desktop C++ workload
- Or install MinGW-w64 via MSYS2 or winget
- Install CMake from cmake.org

## Clone the Repository

```bash
git clone https://github.com/ggml-org/llama.cpp
cd llama.cpp
```

To use a specific release tag:
```bash
git clone --branch b4820 https://github.com/ggml-org/llama.cpp
```

## CPU-Only Build

```bash
cmake -B build
cmake --build build --config Release -j$(nproc)
```

Binaries are placed in `build/bin/`.

### SIMD Optimization Flags

By default, CMake auto-detects AVX/AVX2 support. Override explicitly:

| Flag | Default | Description |
|------|---------|-------------|
| `GGML_AVX` | ON (auto) | Enable AVX instructions |
| `GGML_AVX2` | ON (auto) | Enable AVX2 (recommended) |
| `GGML_AVX512` | OFF | Enable AVX-512 (Intel only) |
| `GGML_FMA` | ON (auto) | Fused multiply-add |
| `GGML_F16C` | ON (auto) | F16 conversion intrinsics |
| `GGML_NATIVE` | OFF | Optimize for the exact host CPU (`-march=native`) |

```bash
cmake -B build -DGGML_NATIVE=ON
cmake --build build --config Release -j$(nproc)
```

## CUDA Build (NVIDIA GPUs)

### Requirements
- NVIDIA GPU with Compute Capability 5.0+ (Maxwell or newer)
- CUDA Toolkit 11.8 or 12.x installed
- `nvcc` in PATH

### Build

```bash
cmake -B build \
  -DGGML_CUDA=ON \
  -DCMAKE_CUDA_ARCHITECTURES="75;80;86;89;90"

cmake --build build --config Release -j$(nproc)
```

**Auto-detect current GPU only** (faster compile):
```bash
cmake -B build \
  -DGGML_CUDA=ON \
  -DCMAKE_CUDA_ARCHITECTURES="native"
```

Common CUDA architectures:
| Architecture | Value | GPU Series |
|-------------|-------|------------|
| Turing | 75 | RTX 2000 series |
| Ampere | 80, 86 | RTX 3000 series, A100 |
| Ada Lovelace | 89 | RTX 4000 series |
| Hopper | 90 | H100 |
| Blackwell | 100 | RTX 5000 series |

## Metal Build (Apple Silicon & AMD)

Metal is **automatically detected and enabled** on macOS. No extra flags needed.

```bash
cmake -B build
cmake --build build --config Release -j$(nproc)
```

To explicitly disable Metal:
```bash
cmake -B build -DGGML_METAL=OFF
```

> Metal provides access to the unified memory pool on Apple Silicon, allowing the GPU to use ordinary RAM. A MacBook Pro M2 with 32 GB RAM can run a 13B Q4_K_M model entirely on GPU.

## Vulkan Build (Cross-Platform GPU)

Vulkan works on NVIDIA, AMD, and Intel GPUs across Linux and Windows as a fallback when CUDA/ROCm are unavailable.

**Linux prerequisites**:
```bash
sudo apt install libvulkan-dev vulkan-tools glslc
```

**Windows**: Install the LunarG Vulkan SDK from vulkan.lunarg.com.

**Build**:
```bash
cmake -B build -DGGML_VULKAN=ON
cmake --build build --config Release -j$(nproc)
```

## ROCm / HIP Build (AMD GPUs)

### Requirements
- ROCm 5.x or 6.x installed
- Supported AMD GPU (see architecture table below)

```bash
CC=/opt/rocm/bin/amdclang CXX=/opt/rocm/bin/amdclang++ \
cmake -B build \
  -DGGML_HIP=ON \
  -DAMDGPU_TARGETS="gfx1100;gfx1030;gfx906"

cmake --build build --config Release -j$(nproc)
```

Common AMD GPU architecture codes:
| Code | GPU Example |
|------|------------|
| `gfx1100` | RX 7900 XT/XTX (RDNA 3) |
| `gfx1030` | RX 6800/6900 (RDNA 2) |
| `gfx906` | MI50, RX 5700 XT (Vega 20) |
| `gfx90a` | MI200 series |
| `gfx940` | MI300 series |

## OpenBLAS Build (CPU Linear Algebra)

```bash
sudo apt install libopenblas-dev   # Linux
brew install openblas              # macOS

cmake -B build -DGGML_BLAS=ON -DGGML_BLAS_VENDOR=OpenBLAS
cmake --build build --config Release -j$(nproc)
```

## Windows Build

**MSVC (Visual Studio)**:
```powershell
cmake -B build -G "Visual Studio 17 2022" -A x64
cmake --build build --config Release
```

**MSVC + Ninja (faster)**:
```powershell
cmake -B build -G Ninja -DCMAKE_BUILD_TYPE=Release
cmake --build build
```

## Complete CMake Flags Reference

| Flag | Default | Description |
|------|---------|-------------|
| `GGML_CUDA` | OFF | Enable CUDA backend |
| `GGML_METAL` | ON (macOS) | Enable Metal backend |
| `GGML_VULKAN` | OFF | Enable Vulkan backend |
| `GGML_HIP` | OFF | Enable ROCm/HIP backend |
| `GGML_BLAS` | OFF | Enable BLAS backend |
| `GGML_BLAS_VENDOR` | Generic | OpenBLAS, MKL, Accelerate |
| `GGML_NATIVE` | OFF | -march=native optimization |
| `GGML_LTO` | OFF | Link-time optimization |
| `GGML_STATIC` | OFF | Static linking |
| `LLAMA_BUILD_TESTS` | OFF | Build test binaries |
| `LLAMA_BUILD_EXAMPLES` | ON | Build example binaries |
| `CMAKE_CUDA_ARCHITECTURES` | — | CUDA arch string |
| `AMDGPU_TARGETS` | — | ROCm arch string |
| `CMAKE_BUILD_TYPE` | Release | Release/Debug/RelWithDebInfo |

## Prebuilt Binaries

If you don't need custom compilation flags, prebuilt binaries are available:

| Platform | URL |
|----------|-----|
| Linux (CPU) | github.com/ggml-org/llama.cpp/releases |
| Linux (CUDA 12) | Same; look for `cudart` suffix |
| macOS (arm64) | Same; Metal enabled |
| Windows (CPU) | Same; `win-x64` suffix |
| Windows (CUDA) | Same; `win-cuda12` suffix |

```bash
# Example: Linux CUDA 12 release
wget https://github.com/ggml-org/llama.cpp/releases/download/b4820/llama-b4820-bin-ubuntu-x64.zip
unzip llama-b4820-bin-ubuntu-x64.zip
```

## Python pip Install

For Python-only usage, install via pip (builds from source or uses prebuilt wheels):

```bash
# CPU
pip install llama-cpp-python

# CUDA
CMAKE_ARGS="-DGGML_CUDA=ON" pip install llama-cpp-python

# Metal
CMAKE_ARGS="-DGGML_METAL=ON" pip install llama-cpp-python
```

For full details see the [Python Bindings](/kb/ai/llama-cpp/python-bindings/) guide.

## Verifying the Build

```bash
# Check binary exists and shows help
./build/bin/llama-cli --help

# Quick model load test (replace with your model path)
./build/bin/llama-cli \
  -m ./models/llama-3.2-3b-instruct-q4_k_m.gguf \
  -p "Hello" \
  -n 10
```

Expected first lines of output:
```
llama_model_loader: loaded meta data with ... key-value pairs
llama_model_loader: - general.architecture = llama
```

## See Also

- [CLI Usage](/kb/ai/llama-cpp/cli-usage/) — using the built binaries
- [GPU Acceleration](/kb/ai/llama-cpp/gpu-acceleration/) — choosing `n-gpu-layers` after a CUDA/Metal build
- [GGUF & Quantization](/kb/ai/llama-cpp/gguf-quantization/) — converting and quantizing models
- [Server](/kb/ai/llama-cpp/server/) — the HTTP API server binary
- [Troubleshooting](/kb/ai/llama-cpp/troubleshooting/) — build errors and dependency issues
