---
title: Poky Reference System
createTime: 2025/12/21 22:21:19
permalink: /kb/embedded/yocto/poky-reference-system/
---

# Poky Reference System

## What Poky Is

Poky is the **reference build system** provided by the Yocto Project. It is a git repository that aggregates four components:

- **BitBake** (`bitbake/`) — the build engine
- **OpenEmbedded-Core** (`meta/`) — the minimal, architecture-agnostic metadata layer
- **meta-poky** — the distribution policy layer (defines the "poky" distro)
- **meta-yocto-bsp** — reference BSP for example machines (qemuarm, qemux86, etc.)

When you `git clone` Poky and run a build, you are using all four components together. Poky is a starting point — real products typically evolve into their own layer stack that keeps Poky as an unmodified upstream dependency.

## Source Tree Layout

```
poky/
├── bitbake/                    # BitBake tool source
│   ├── bin/bitbake             # The bitbake executable
│   └── lib/bb/                 # Core BitBake Python modules
│
├── meta/                       # OpenEmbedded-Core (oe-core)
│   ├── conf/
│   │   ├── bitbake.conf        # Master variable defaults (NEVER edit this)
│   │   └── machine/            # Example machine configs (qemuarm, qemux86)
│   ├── classes/                # Core .bbclass files (base, image, kernel, cmake, etc.)
│   ├── recipes-core/           # Core userspace (busybox, init-ifupdown, etc.)
│   ├── recipes-kernel/         # Kernel and module recipes
│   └── recipes-devtools/       # Build tools (gcc, binutils, gdb, etc.)
│
├── meta-poky/                  # Poky distribution policy
│   └── conf/
│       └── distro/
│           └── poky.conf       # Sets DISTRO="poky", DISTRO_FEATURES, tool versions
│
├── meta-yocto-bsp/             # Reference BSPs
│   └── conf/machine/           # Machine conf files for reference boards
│
├── scripts/                    # Helper scripts (runqemu, devtool, recipetool, etc.)
├── oe-init-build-env           # Setup script — source this before building
└── documentation/              # Yocto Project docs source
```

## `oe-init-build-env` — What It Does

You run this once per shell session before using `bitbake`:

```bash
source oe-init-build-env [build-dir]
```

Internally it:
1. Sets `BUILDDIR` to the specified build directory (default: `build/`)
2. Creates `$BUILDDIR/conf/local.conf` from a template if absent
3. Creates `$BUILDDIR/conf/bblayers.conf` from a template if absent
4. Prepends `poky/bitbake/bin` and `poky/scripts` to `PATH`
5. Sets `BB_ENV_PASSTHROUGH_ADDITIONS` to allow certain env vars into BitBake's sandbox
6. `cd`s you into `$BUILDDIR`

After sourcing, `bitbake` is on your `PATH` and your working directory is the build directory.

## `poky.conf` — The Distribution Policy File

`meta-poky/conf/distro/poky.conf` defines what the "poky" distribution means. Key variables it sets:

```bash
DISTRO      = "poky"
DISTRO_NAME = "Poky (Yocto Project Reference Distro)"
DISTRO_VERSION = "5.0"

# Package format: ipk, rpm, or deb
PACKAGE_CLASSES ?= "package_rpm"

# Distribution-level feature flags
DISTRO_FEATURES = "acl bluetooth ext2 ipv4 ipv6 largefile usbgadget \
                   usbhost wifi nfs zeroconf pci x11 vfat"

# Preferred versions for key toolchain components
PREFERRED_VERSION_linux-yocto ?= "6.6%"
PREFERRED_VERSION_binutils    = "2.42%"
PREFERRED_VERSION_gcc         = "13.%"
```

## Release Branch Mapping

All layers used in a project must be on matching release branches:

| Codename   | Poky Branch  | Support Window   |
|------------|-------------|------------------|
| Kirkstone  | `kirkstone` | LTS 2022–2024    |
| Langdale   | `langdale`  | Oct 2022–Apr 2023|
| Mickledore | `mickledore`| Standard         |
| Nanbield   | `nanbield`  | Standard         |
| Scarthgap  | `scarthgap` | LTS 2024–2026    |
| Styhead    | `styhead`   | Standard         |
| Walnascar  | `walnascar` | Standard         |

If `meta-openembedded` is on `scarthgap` but Poky is on `styhead`, recipe parsing will fail or produce unpredictable results.

## Starting a Project with Poky

```bash
# 1. Clone Poky at a known release
git clone git://git.yoctoproject.org/poky -b scarthgap

# 2. Clone extra layers alongside poky (same branch)
git clone git://git.openembedded.org/meta-openembedded -b scarthgap
git clone git://git.yoctoproject.org/meta-raspberrypi  -b scarthgap

# 3. Initialize the build environment
cd poky
source oe-init-build-env ../build

# 4. Edit conf/bblayers.conf to register layers
# 5. Edit conf/local.conf to set MACHINE, DISTRO, etc.
# 6. Build
bitbake core-image-minimal
```

For real products, Poky is typically vendored using `repo` (Google's git management tool) or as git submodules, with a manifest tracking exact commits for all layers — ensuring reproducible builds months later.
