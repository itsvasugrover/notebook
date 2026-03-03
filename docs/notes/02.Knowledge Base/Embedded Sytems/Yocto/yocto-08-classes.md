---
title: Classes (.bbclass)
createTime: 2025/12/21 22:21:19
permalink: /kb/embedded/yocto/classes/
---

# Classes (.bbclass)

A class file contains common build logic that can be inherited and shared by multiple recipes. It's a mechanism for code reuse and enforcing standard behaviors.

Purpose: Don't Repeat Yourself (DRY). If 100 cmake-based recipes all need to run the same do_configure task, that logic is placed in the cmake class.

How it works: A recipe uses the inherit directive to use a class.

Common Examples:

- base.bbclass: Defines the fundamental tasks like do_fetch, do_unpack. Almost every recipe inherits this implicitly.
- cmake.bbclass: Automatically defines do_configure, do_compile, and do_install tasks for CMake-based projects.
- autotools.bbclass: Does the same for Autotools-based projects (./configure && make && make install).
- kernel.bbclass: Contains the complex logic for building the Linux kernel.
- systemd.bbclass: Handles integration with the systemd init system.

Example in a recipe:

```bash
inherit cmake pkgconfig
```

This one line gives the recipe all the functionality of building with CMake and handling pkg-config.

## Key Points: Classes (.bbclass)

- Shared, reusable logic for common build processes.
- Recipes inherit classes to get this functionality.
- Examples: cmake, autotools, kernel, systemd.
