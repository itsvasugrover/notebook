---
title: Kernel Configuration
createTime: 2025/12/21 22:21:19
permalink: /kb/embedded/yocto/kernel-configuration/
---

# Update kernel configuration in Yocto Project

You should never edit the kernel's .config file directly. The Yocto Project provides a maintainable workflow.

### Method 1: Using menuconfig and Configuration Fragments (Recommended)

1. Launch the Interactive Menu:

   ```bash
   bitbake -c menuconfig virtual/kernel
   ```

   This opens the Linux kernel configuration menu.

2. Make Your Changes: Navigate and enable/disable options (e.g., CONFIG_USB_SERIAL).

3. Save the Changes: When you exit and save, it will not overwrite the original kernel config. Instead, it saves the differences to a file in the WORKDIR (e.g., defconfig).

4. Create a Config Fragment:
   Compare the new config with the original to create a fragment containing only your changes.

   ```bash
   bitbake -c diffconfig virtual/kernel
   ```

   This command outputs the differences. Copy this output and create a .cfg file in your BSP layer.

5. Create a .bbappend for the Kernel:
   Create a file in your layer: recipes-kernel/linux/linux-yocto\_%.bbappend

   ```bash
   FILESEXTRAPATHS:prepend := "${THISDIR}/${PN}:"
   SRC_URI += "file://my-kernel-changes.cfg"
   ```

6. Rebuild the Kernel:

   ```bash
   bitbake -c clean virtual/kernel
   bitbake virtual/kernel
   ```

### Method 2: Using a Custom defconfig File

If you have a complete configuration file (my_defconfig):

1. Place it in your layer: recipes-kernel/linux/linux-yocto/my_defconfig.

2. Create a .bbappend file:

   ```bash
   FILESEXTRAPATHS:prepend := "${THISDIR}/${PN}:"
   SRC_URI += "file://my_defconfig"
   KERNEL_DEFCONFIG = "my_defconfig"
   ```

### Key Points: Kernel Configuration

- Never edit the kernel source or .config directly.
- Use bitbake -c menuconfig virtual/kernel for interactive changes.
- Use bitbake -c diffconfig to generate a config fragment of your changes.
- Use a .bbappend file and SRC_URI to apply your fragments or custom defconfig.
- This method ensures your changes are maintainable and survive kernel upgrades.
