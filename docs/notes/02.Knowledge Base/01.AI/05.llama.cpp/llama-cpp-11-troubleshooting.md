---
title: "Troubleshooting"
createTime: 2026/03/21 10:10:00
permalink: /kb/ai/llama-cpp/troubleshooting/
---

# Troubleshooting

This guide covers the most common build failures, model load errors, and runtime issues encountered when using llama.cpp, along with specific resolution steps.

## Diagnostic First Steps

Before diving into specific errors, gather information:

```bash
# 1. Enable verbose output
llama-cli -m model.gguf -p "test" --verbose

# 2. Inspect the GGUF file
./build/bin/llama-gguf-info -m model.gguf | head -40

# 3. Check available RAM
free -h

# 4. Check GPU and VRAM (NVIDIA)
nvidia-smi

# 5. Check Metal (macOS)
system_profiler SPDisplaysDataType | grep VRAM

# 6. Check file integrity
sha256sum model.gguf   # compare with published hash
```

## Build Errors

### `CUDA not found` / `nvcc not found`

**Error**:
```
CMake Error: Could not find CUDA toolkit.
```

**Fix**:
```bash
# Verify CUDA installation
nvcc --version
nvidia-smi

# If installed but not found, set paths
export CUDA_HOME=/usr/local/cuda
export PATH=$CUDA_HOME/bin:$PATH
export LD_LIBRARY_PATH=$CUDA_HOME/lib64:$LD_LIBRARY_PATH

# Retry build
cmake -B build -DGGML_CUDA=ON
```

### `No CMAKE_CXX_COMPILER found`

**Error**:
```
CMake Error: No CMAKE_CXX_COMPILER could be found.
```

**Fix**:
```bash
# Linux
sudo apt install build-essential

# macOS (must install Xcode command line tools)
xcode-select --install

# Verify
c++ --version
```

### `__hgt` undefined / CUDA compute capability error

**Error**:
```
ggml-cuda.cu: error: identifier "__hgt" is undefined
```

**Cause**: CUDA toolkit too old (needs 12.0+ for half-precision comparisons).

**Fix**: Upgrade CUDA toolkit to 12.x, or limit compute architectures to SM 7.5+:
```bash
cmake -B build -DGGML_CUDA=ON -DCMAKE_CUDA_ARCHITECTURES="75;80;86"
```

### Metal Framework Not Found (macOS)

**Error**:
```
No APPLE_FW_METAL framework found
```

**Fix**: Ensure Xcode (not just command line tools) is installed and active:
```bash
xcode-select -p   # should print /Applications/Xcode.app/Contents/Developer
sudo xcode-select -s /Applications/Xcode.app/Contents/Developer
```

### Vulkan Header Not Found

**Error**:
```
Could NOT find Vulkan
```

**Fix**:
```bash
# Linux
sudo apt install libvulkan-dev vulkan-tools

# Alternatively, install the LunarG SDK:
# https://vulkan.lunarg.com/
```

### C++17 Filesystem Error (Older macOS)

**Error**:
```
'filesystem' file not found
```

**Cause**: macOS < 10.15 does not have `std::filesystem`.

**Fix**: Set deployment target to 10.15 or upgrade macOS:
```bash
cmake -B build -DCMAKE_OSX_DEPLOYMENT_TARGET=10.15
```

## Model Load Errors

### `unknown model architecture`

**Error**:
```
llama_model_loader: error: unknown model architecture: 'gemma3'
```

**Cause**: Your llama.cpp build is too old to support this architecture.

**Fix**: Update llama.cpp:
```bash
git pull
cmake -B build && cmake --build build --config Release -j$(nproc)
```

### Old GGML `.bin` Format

**Error**:
```
error: failed to open model file
```

or the model loads but produces garbage.

**Cause**: The model file is in the old GGML format (not GGUF). All models must now be GGUF.

**Fix**: Download the GGUF version of the model, or convert:
```bash
python convert_hf_to_gguf.py /path/to/hf-model --outfile model.gguf
```

### GGUF Version Mismatch

**Error**:
```
error: unsupported model file version: X
```

**Fix**: The model was created with a newer llama.cpp than your binary. Update your build:
```bash
git pull && cmake --build build --config Release -j$(nproc)
```

### Tensor Load Failure

**Error**:
```
llama_model_loader: error loading tensor data
GGML_ASSERT: read_size == tensor_size
```

**Cause**: File is corrupted or truncated (incomplete download).

**Fix**: Re-download the model, verify the file size matches the expected size:
```bash
huggingface-cli download <repo> <file> --force-download
```

### Permission Denied

**Error**:
```
error opening file: Permission denied
```

**Fix**:
```bash
chmod 644 model.gguf
ls -la model.gguf   # confirm readable
```

## Runtime Errors

### `GGML_ASSERT: n_tokens == 0`

**Cause**: Prompt was empty or the context overflowed before generating began.

**Fix**: Check that your prompt is non-empty. If the context is full, reduce `--ctx-size` or the prompt length.

### Out of Memory — CPU

**Error**:
```
terminate called after throwing an instance of 'std::bad_alloc'
```

Fixes in order of impact:
1. Use a smaller quantization (Q4_K_M instead of Q8_0)
2. Reduce context size: `--ctx-size 2048`
3. Use a smaller model (7B instead of 13B)
4. Enable KV cache quantization: `--cache-type-k q8_0 --cache-type-v q8_0`
5. Disable mmap and let the OS manage: `--no-mmap`

### Out of Memory — GPU / `cudaMalloc failed`

**Error**:
```
CUDA error 2 at /src/ggml-cuda.cu:XXX: out of memory
```

Fixes:
1. Reduce `--n-gpu-layers` to offload fewer layers
2. Reduce `--ctx-size`
3. Use KV cache quantization: `--cache-type-k q8_0`
4. Enable Flash Attention to reduce KV size: `--flash-attn`

### Garbage Output / Repetitive Text

Symptoms: Model repeats phrases, outputs nonsense, or ignores the prompt.

| Cause | Fix |
|-------|-----|
| Wrong chat template | Add `--chat-template llama3` or correct template |
| Temperature too high | Use `--temp 0.7` instead of > 1.5 |
| No repeat penalty | Add `--repeat-penalty 1.1` |
| Model weights corrupted | Verify SHA256 of model file |
| Context already full at start | Reduce `--ctx-size` or shorten prompt |
| Using wrong model type (base vs instruct) | Use `-Instruct` variant |

### Very Slow CPU Inference

Fixes in order of impact:
1. Check `--threads` is set to physical core count: `-t $(nproc)`
2. Enable AVX2: rebuild with `cmake -B build -DGGML_AVX2=ON -DGGML_NATIVE=ON`
3. Use lower quantization (Q3_K_M for speed over Q6_K quality)
4. Reduce context size
5. Use GPU if available

### llama-server Returns 503 `{"error":"server busy"}`

**Cause**: All parallel slots are occupied.

Fixes:
1. Increase `--n-parallel`: `--n-parallel 4`
2. Increase `--ctx-size` proportionally: `--ctx-size 16384`
3. Enable continuous batching: `--cont-batching`
4. Increase `--timeout` for slow hardware

### Python `encode failed` / `tokenize failed`

**Error** (llama-cpp-python):
```
ValueError: Failed to encode string
```

**Fix**: Ensure input is a plain Python string (not bytes):
```python
text = "your text here"   # not b"..."
tokens = llm.tokenize(text.encode("utf-8"))  # must pass bytes to tokenize
```

## Platform-Specific Issues

### macOS: Segfault on Metal

**Symptom**: Process crashes immediately after model load on Apple Silicon.

**Fix**:
1. Delete compiled Metal shaders cache:
   ```bash
   rm -rf ~/Library/Caches/ggml_metallib*
   ```
2. Rebuild:
   ```bash
   cmake -B build && cmake --build build --config Release
   ```

### Windows: DLL Not Found

**Error**:
```
The code execution cannot proceed because LLVM.dll was not found.
```

**Fix**: Install the Visual C++ Redistributable from Microsoft, and ensure CUDA toolkit runtime DLLs are in PATH.

### Windows: Slow Compared to Linux

**Symptom**: Same hardware, significantly fewer tokens/sec on Windows.

**Fix**: Disable memory mapping (Windows mmap has high overhead):
```bash
llama-cli -m model.gguf --no-mmap
```

### Linux: `GLIBCXX_3.4.30 not found` with Prebuilt Binary

**Error**:
```
./llama-cli: /usr/lib/x86_64-linux-gnu/libstdc++.so.6: version GLIBCXX_3.4.30 not found
```

**Cause**: Prebuilt binary was compiled on a newer system with a newer glibc/libstdc++.

**Fix**: Build from source on your system (avoids glibc incompatibility):
```bash
cmake -B build && cmake --build build --config Release -j$(nproc)
```

### AMD ROCm: `hipErrorNoBinaryForGpu`

**Error**:
```
hipErrorNoBinaryForGpu: Unable to find code object for all current devices
```

**Fix**: The binary was compiled for a different GPU architecture. Rebuild with the correct target:
```bash
cmake -B build -DGGML_HIP=ON -DAMDGPU_TARGETS="gfx1100"  # replace with your GPU's gfx code
cmake --build build --config Release -j$(nproc)
```

Find your GPU's gfx code:
```bash
rocminfo | grep "gfx"
```

## Getting Help

If none of the above resolves your issue:

1. Run with `--verbose` and capture the full output
2. Check [GitHub Issues](https://github.com/ggml-org/llama.cpp/issues) — search by error message
3. Open a new issue with: OS, GPU, CUDA/ROCm version, llama.cpp commit (`git rev-parse HEAD`), model name, full error output

## See Also

- [Installation & Build](/kb/ai/llama-cpp/installation-build/) — build flags and prerequisites
- [GPU Acceleration](/kb/ai/llama-cpp/gpu-acceleration/) — GPU-specific configuration
- [Performance Tuning](/kb/ai/llama-cpp/performance-tuning/) — OOM and slow inference optimizations
- [GGUF & Quantization](/kb/ai/llama-cpp/gguf-quantization/) — model format issues
