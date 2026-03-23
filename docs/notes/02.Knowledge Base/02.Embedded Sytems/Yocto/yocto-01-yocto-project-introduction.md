---
title: Introduction
createTime: 2025/12/21 22:21:19
permalink: /kb/embedded/yocto/yocto-project-introduction/
---

# Introduction to the Yocto Project

## What Yocto Is — And What It Isn't

The Yocto Project is **not a Linux distribution**. It is an open-source collaboration project hosted by the Linux Foundation that provides a complete build framework for creating **custom**, **reproducible**, **cross-compiled Linux-based systems** for embedded and IoT devices.

The distinction matters: projects like Ubuntu or Debian ship pre-compiled binaries assembled by someone else. Yocto lets you define every package, every compile flag, every kernel config option, and every filesystem layout — and compiles everything from source for your exact target hardware.

## The OpenEmbedded Relationship

Yocto and OpenEmbedded (OE) are closely related but distinct:

```
OpenEmbedded (OE)
├── OpenEmbedded-Core (oe-core)   ← minimal, architecture-agnostic layer; maintained jointly
├── BitBake                        ← the build engine; hosted by OE, used by Yocto
└── meta-openembedded              ← broader recipe collection (community)

Yocto Project
├── Poky                           ← reference build system = BitBake + oe-core + meta-poky
├── Toaster                        ← web UI for builds
├── devtool / recipetool           ← developer workflow tooling
└── SDK / eSDK                     ← cross-compile toolchains for app developers
```

**OpenEmbedded-Core** is the shared foundation — neither project owns it exclusively. `meta-poky` is the distribution policy layer that makes Poky a specific, opinionated distribution. All of `oe-core` is reusable by any distribution built on Yocto/OE.

## Release Naming and Versioning

Yocto uses alphabetically sequenced codenames. LTS releases have 2-year support windows; standard releases ~7 months.

| Codename   | Version | Release  | LTS |
|------------|---------|----------|-----|
| Kirkstone  | 4.0     | Apr 2022 | ✅  |
| Langdale   | 4.1     | Oct 2022 |     |
| Mickledore | 4.2     | Apr 2023 |     |
| Nanbield   | 4.3     | Oct 2023 |     |
| Scarthgap  | 5.0     | Apr 2024 | ✅  |
| Styhead    | 5.1     | Oct 2024 |     |
| Walnascar  | 5.2     | Apr 2025 |     |

The release codename determines which branch to checkout for **all** layers. Every layer must declare `LAYERSERIES_COMPAT` compatibility with the same release name or the build fails.

## Yocto vs Buildroot

| Aspect | Yocto | Buildroot |
|--------|-------|-----------|
| Output | Custom distro — packages + image | Root filesystem image |
| Package management on target | Full (rpm/ipk/deb) | None by default |
| Incremental builds | sstate-cache (shareable across machines) | Per-machine only |
| First build time | 4–8 hours | 30–90 minutes |
| Learning curve | Steep | Gentle |
| Best for | OTA updates, complex BSPs, app stores | Simple appliances, fast prototyping |
| Reproducibility | Hash-based, deterministic | Makefile-based, lower |

## Core Terminology

| Term | Meaning |
|------|---------|
| Recipe (`.bb`) | Instructions to fetch, build, and install one software package |
| Layer (`meta-*`) | Collection of related recipes, configurations, and classes |
| BitBake | The task scheduler and execution engine |
| Poky | Yocto's reference build system (BitBake + oe-core + meta-poky) |
| BSP Layer | Board Support Package — machine configs, kernel, bootloader for specific hardware |
| sstate-cache | Binary artefacts keyed by a task hash; avoids rebuilding unchanged components |
| `MACHINE` | Selects the target hardware (e.g., `raspberrypi4-64`) |
| `DISTRO` | Selects the distribution policy (e.g., `poky`) |
| Metadata | Everything that is not the build tool: recipes, configs, classes, bbappends |
| Image Recipe | Assembles a root filesystem from packages |
| `WORKDIR` | Per-recipe temporary build directory under `tmp/work/` |
| `D` | Destination — the fake rootfs populated by `do_install` |

## The "Code Once, Deploy Anywhere" Model

The architectural goal is that **the same recipe set produces working images for any hardware by changing only `MACHINE`**. The recipe for `bash` is identical whether targeting ARM, RISC-V, or x86 — the machine config provides the cross-compiler tuple, instruction set flags, and hardware-specific kernel. This is what separates Yocto from ad-hoc cross-compilation scripts.
