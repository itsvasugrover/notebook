---
title: Configuration Files (.conf)
createTime: 2025/12/21 22:21:19
permalink: /kb/embedded/yocto/configuration-files/
---

# Configuration Files (.conf)

Configuration files define global settings, user-specific settings, and machine-specific settings. They set variables that apply to many recipes.

- bitbake.conf: The master configuration file. It sets all the default values (like CC, CXX, CFLAGS, paths, etc.). You should never edit this file directly.
- local.conf: The user-specific configuration. This is where you do most of your customizations for a specific build.
  - MACHINE: Selects the target machine (e.g., MACHINE = "raspberrypi4").
  - DISTRO: Selects the distribution policy (e.g., DISTRO = "poky").
  - PACKAGE_CLASSES: Defines the package backend (e.g., "package_rpm").
  - EXTRA_IMAGE_FEATURES: Adds features like "ssh-server-openssh" or "debug-tweaks".
  - This file is in your build/ directory.
- machine.conf / distro.conf: Machine and distribution-specific configurations, usually provided by a BSP or distro layer.
- conf/layer.conf: As mentioned, the layer's own configuration.

## Key Points: Configuration (.conf)

- Set global, user, machine, and distro-wide variables.
- local.conf is for your local build customizations (MACHINE, DISTRO, etc.).
- bitbake.conf is the core file that sets all defaults. Do not edit it.
