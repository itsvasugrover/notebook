---
title: QEMU Basic Usage
createTime: 2026/03/14 14:21:19
permalink: /kb/embedded/qemu/qemu-basic-usage/
---

# QEMU Basic Usage

QEMU (Quick Emulator) is a versatile tool for emulating and virtualizing hardware platforms. This section provides an introduction to the basic usage of QEMU, including running a Linux kernel and exploring its command-line options.

## Running a Linux Kernel on QEMU

One of the most common use cases for QEMU is running a Linux kernel. This allows developers to test and debug their systems without requiring physical hardware.

### Steps:
1. **Download a Precompiled Kernel**: Obtain a precompiled Linux kernel and an appropriate root filesystem image.
2. **Run QEMU**: Use the following command to boot the kernel:
   ```sh
   qemu-system-x86_64 -kernel bzImage -initrd rootfs.img -append "console=ttyS0" -nographic
   ```
   Replace `qemu-system-x86_64` with the appropriate QEMU binary for your target architecture.

3. **Interact with the System**: Once the kernel boots, you can interact with the system via the console.

## Exploring QEMU Command-Line Options

QEMU provides a wide range of command-line options to configure the emulated environment. Some commonly used options include:

- `-m <size>`: Set the amount of memory for the virtual machine.
- `-smp <n>`: Specify the number of CPUs.
- `-drive file=<image>,format=<format>`: Attach a disk image to the virtual machine.
- `-netdev user,id=<id>`: Configure networking for the virtual machine.

### Example:
```sh
qemu-system-arm -m 512M -smp 2 -drive file=disk.img,format=qcow2 -netdev user,id=net0
```

This command sets up an ARM virtual machine with 512 MB of RAM, 2 CPUs, and a disk image.

## Common QEMU Commands for Embedded Development

### Running Bootloaders
To test bootloaders:
```bash
qemu-system-arm -M versatilepb -nographic -kernel bootloader.bin
```

### Running with Firmware
To boot with firmware:
```bash
qemu-system-x86_64 -bios firmware.fd -hda disk.img
```

### Testing Custom Images
To run custom built images:
```bash
qemu-system-arm -M versatilepb -kernel zImage -initrd rootfs.img -append "console=ttyAMA0"
```

## Integration with Development Workflows

QEMU integrates well with various embedded development tools:

- **Bootloader Testing**: Use QEMU to test bootloader configurations without physical hardware
- **Firmware Development**: Run firmware in virtualized environments
- **Linux Distribution Testing**: Validate custom built images before deployment

## Getting Started with Different Architectures

For information on supported architectures, see [QEMU Supported Architectures](/kb/embedded/qemu/qemu-supported-architectures/).

## Debugging with QEMU

For debugging capabilities, see [QEMU GDB Debugging](/kb/embedded/qemu/qemu-gdb-debugging/) which provides integration with GDB for system-level debugging.

## Performance Considerations

For optimizing QEMU performance, refer to [QEMU Performance Optimization](/kb/embedded/qemu/qemu-performance-optimization/) which covers techniques like enabling KVM for near-native performance.

## Conclusion

Understanding the basic usage of QEMU is essential for leveraging its full potential in embedded systems development. By mastering these foundational commands, you can begin to explore more advanced features and workflows. QEMU provides a powerful platform for testing, debugging, and validating embedded systems before deployment to physical hardware.
`
</file_path>