---
title: QEMU GDB Debugging
createTime: 2026/03/14 14:21:19
permalink: /kb/embedded/qemu/qemu-gdb-debugging/
---

# QEMU GDB Debugging

Debugging is a critical part of embedded systems development, and QEMU provides robust support for debugging with GDB (GNU Debugger). This document explains how to use QEMU and GDB together to debug embedded systems, enabling developers to identify and resolve issues efficiently.

## Why Use GDB with QEMU?

Using GDB with QEMU offers several advantages:
- **Hardware Emulation**: Debug software without requiring physical hardware.
- **Non-Intrusive Debugging**: Inspect and modify the system state without affecting the execution flow.
- **Breakpoints and Watchpoints**: Pause execution at specific points or monitor variable changes.
- **Instruction-Level Debugging**: Step through code at the assembly level for detailed analysis.

## Prerequisites

Before starting, ensure you have the following:
- **QEMU Installed**: A working installation of QEMU for your target architecture.
- **GDB Installed**: The GNU Debugger installed on your development machine.
- **Cross-Compilation Toolchain**: A toolchain for building the target binary (e.g., `arm-none-eabi-gcc` for ARM).
- **Debug Symbols**: Compile your code with debugging symbols enabled (`-g` flag).

## Steps to Debug with QEMU and GDB

### 1. Compile the Target Program
1. Write your program (e.g., `main.c`):
   ```c
   #include <stdio.h>

   int main() {
       int x = 42;
       printf("Value of x: %d\n", x);
       return 0;
   }
   ```
2. Compile the program with debugging symbols:
   ```bash
   arm-none-eabi-gcc -g -o program.elf main.c
   ```

### 2. Start QEMU with GDB Server
Run QEMU with the `-s` and `-S` options:
- `-s`: Starts a GDB server on port 1234.
- `-S`: Pauses the CPU at startup, waiting for GDB to connect.

Example command:
```bash
qemu-system-arm -M versatilepb -m 128M -kernel program.elf -s -S
```

### 3. Connect GDB to QEMU
1. Launch GDB:
   ```bash
   arm-none-eabi-gdb program.elf
   ```
2. Connect to the QEMU GDB server:
   ```bash
   target remote :1234
   ```

### 4. Debug the Program
Use GDB commands to debug the program:
- **Set Breakpoints**:
  ```bash
  break main
  ```
- **Run the Program**:
  ```bash
  continue
  ```
- **Inspect Variables**:
  ```bash
  print x
  ```
- **Step Through Code**:
  ```bash
  step
  ```
- **Disassemble Instructions**:
  ```bash
  disassemble
  ```

### 5. Analyze and Fix Issues
- Use GDB's powerful features to analyze the program's behavior.
- Modify variables, inspect memory, and step through code to identify and resolve issues.

## Integration with Other QEMU Features

### Combined with Peripheral Emulation
When debugging embedded systems, you can combine GDB debugging with [QEMU Peripheral Emulation](/kb/embedded/qemu/qemu-peripheral-emulation/) to simulate hardware interactions.

### Enhanced with Tracing
For more detailed debugging, combine GDB with [QEMU Tracing and Logging](/kb/embedded/qemu/qemu-tracing-logging/) to get comprehensive system insights.

### Performance Analysis
Use GDB debugging in conjunction with [QEMU Profiling](/kb/embedded/qemu/qemu-profiling/) to analyze performance bottlenecks.

## Best Practices for QEMU GDB Debugging
1. **Enable Debug Symbols**: Always compile with the `-g` flag to include debugging information.
2. **Use Source-Level Debugging**: Keep source files accessible to GDB for easier debugging.
3. **Test Incrementally**: Debug small sections of code before integrating them into the full system.
4. **Document Findings**: Record debugging steps and resolutions for future reference.

## Related Topics

For more information on related debugging and development topics:
- [QEMU Architecture](/kb/embedded/qemu/qemu-architecture/) - Understand QEMU's internal structure
- [QEMU Basic Usage](/kb/embedded/qemu/qemu-basic-usage/) - Learn basic QEMU commands
- [QEMU MCU Emulation](/kb/embedded/qemu/qemu-mcu-emulation/) - Debug MCU firmware
- [QEMU Debugging](/kb/embedded/qemu/qemu-debugging/) - General debugging techniques

## Conclusion

QEMU and GDB provide a powerful combination for debugging embedded systems. By leveraging QEMU's emulation capabilities and GDB's debugging features, developers can efficiently identify and resolve issues, ensuring the reliability and performance of their systems. Mastery of these tools is essential for modern embedded systems development.
`
