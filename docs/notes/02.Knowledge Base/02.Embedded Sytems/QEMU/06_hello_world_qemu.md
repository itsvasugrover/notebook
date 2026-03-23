---
title: Hello World QEMU
createTime: 2026/03/14 14:21:19
permalink: /kb/embedded/qemu/hello-world-qemu/
---

# Hello World QEMU

Running a "Hello World" program on QEMU is a fundamental step in understanding how to emulate and test software for embedded systems. This guide walks you through the process of setting up and running a simple "Hello World" program on QEMU.

## Prerequisites

Before proceeding, ensure you have the following:
- [QEMU installed](/kb/embedded/qemu/qemu-installation/) on your system.
- A cross-compilation toolchain for your target architecture (e.g., ARM, x86).
- Basic knowledge of compiling and running C programs.

## Steps to Run "Hello World" on QEMU

### 1. Write the "Hello World" Program
Create a simple C program named `hello.c`:
```c
#include <stdio.h>

int main() {
    printf("Hello, World!\n");
    return 0;
}
```

### 2. Cross-Compile the Program
Use a cross-compiler to compile the program for your target architecture. For example, to compile for ARM:
```sh
arm-linux-gnueabi-gcc -o hello hello.c
```

### 3. Set Up QEMU
Run QEMU with the appropriate system emulator for your target architecture. For example, to emulate an ARM system:
```sh
qemu-system-arm -M versatilepb -kernel zImage -initrd rootfs.img -append "console=ttyAMA0" -nographic
```

### 4. Transfer and Run the Program
Once the system is running:
1. Transfer the `hello` binary to the emulated system using a method like `scp` or by including it in the root filesystem.
2. Run the program:
   ```sh
   ./hello
   ```

You should see the output:
```
Hello, World!
```

## Integration with Development Workflows

The "Hello World" example serves as a foundation for more complex embedded development workflows:

- **Bootloader Integration**: Test bootloader configurations with QEMU
- **System Integration**: Include simple programs in custom built images
- **MCU Development**: Use as a starting point for [MCU emulation](/kb/embedded/qemu/qemu-mcu-emulation/)

## Debugging with Hello World

This simple example is perfect for learning [QEMU GDB Debugging](/kb/embedded/qemu/qemu-gdb-debugging/) techniques:
```bash
qemu-system-arm -M versatilepb -kernel zImage -initrd rootfs.img -append "console=ttyAMA0" -nographic -s -S
```

## Conclusion

Running a "Hello World" program on QEMU is a simple yet powerful way to get started with embedded systems development. It demonstrates the basic workflow of writing, cross-compiling, and running software on an emulated platform. This foundational example can be expanded to more complex applications and integrated with QEMU's advanced features.