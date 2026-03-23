---
title: Build Process Flow
createTime: 2025/12/21 22:21:19
permalink: /kb/embedded/yocto/build-process-flow/
---

# Build Process Flow

Let's trace a simple build command to see how these components interact.

- You, the Developer: You set up your build environment by sourcing Poky's setup script (source oe-init-build-env). This configures your shell and creates a build directory.
- The Command: You run `bitbake core-image-minimal`.
- BitBake's Job:
  - It first reads your configuration files (like local.conf and bblayers.conf).
  - It locates the recipe for the core-image-minimal target.
  - It then parses all related recipes, building a massive dependency graph of every piece of software needed (the Linux kernel, the C library, BusyBox, etc.).
  - For each recipe (e.g., bash_4.4.bb), it executes tasks:
    - do_fetch: Downloads the source code from the specified URI.
    - do_unpack: Unpacks the source tarball.
    - do_patch: Applies any custom patches.
    - do_configure: Runs ./configure or similar.
    - do_compile: Compiles the source code (e.g., runs make).
    - do_install: Copies the compiled binaries and files into a staging area (`${D}`). This is what will end up in the final image.
    - do_package: Bundles the installed files into packages (e.g., .rpm or .deb).
  - It manages this entire process, ensuring tasks run in the correct order and leveraging multiple CPU cores.
- The Output: After all tasks are complete, BitBake assembles the final output in the tmp/deploy/images/ directory. This includes the root filesystem image (e.g., .ext4, .squashfs), the kernel (zImage), and the bootloader.

## Summary & Analogy

| Component     | Role                                      | Analogy                                                                                             |
| ------------- | ----------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Yocto Project | The Framework & Rulebook                  | The concept of "building a house" and the building codes.                                           |
| BitBake       | The General Contractor & Foreman          | The one who reads the blueprints, hires specialists, and manages the entire construction schedule.  |
| Poky          | The Pre-Designed Model Home & Starter Kit | A complete set of blueprints and materials for a standard, functional house that you can customize. |

### Final Key Takeaways for Your Notes

- Yocto Project: The umbrella project. Defines the methodology.
- BitBake: The engine. Executes the build tasks. It is a separate project that the Yocto Project uses.
- Poky: The reference implementation. A ready-to-use build system containing BitBake and core metadata.
- Metadata: The "source code" of your distribution. This includes:
  - Recipes (.bb): Instructions for building individual packages.
  - Configuration (.conf): Global and machine-specific settings.
  - Classes (.bbclass): Common build functionality shared across recipes.
