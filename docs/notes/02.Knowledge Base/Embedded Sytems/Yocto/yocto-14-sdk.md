---
title: SDK
createTime: 2025/12/21 22:21:19
permalink: /kb/embedded/yocto/sdk/
---

# What is SDK in Yocto Project?

The Yocto Project SDK (Software Development Kit) is a self-contained, standalone toolchain and environment that allows you to develop and compile applications outside of the full Yocto build system, but targeting your custom-built Linux image.

What's inside the SDK?

- Cross-compiler (e.g., aarch64-poky-linux-gcc)
- Linker, debugger (gdb)
- Libraries and headers from your target image
- pkg-config, cmake, and other build tools
- qemu emulator for running target binaries on the host

How to generate it?
After building your image, generate the corresponding SDK:

```bash
bitbake -c populate_sdk <image-name>
# Example:
bitbake -c populate_sdk core-image-minimal
```

This creates a .sh installer (e.g., poky-glibc-x86_64-core-image-minimal-aarch64-toolchain-`<version>`.sh) in tmp/deploy/sdk/.

How to use it?

- Run the installer on your development host.
- Source the environment script to set up all necessary variables (PATH, CC, etc.).

  ```bash
  source /path/to/sdk/install-folder/environment-setup-aarch64-poky-linux
  ```

- Now you can compile your application: `$CC hello.c -o hello`. The binary will be built for your target architecture.

### Key Points: SDK

- A standalone cross-development toolchain.
- Allows application development without needing the full Yocto build.
- Generated using `bitbake -c populate_sdk <image-name>`.
- Used by sourcing its environment script to set up cross-compile variables.
