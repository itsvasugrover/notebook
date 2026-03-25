---
title: Layers
createTime: 2025/12/21 22:21:19
permalink: /kb/embedded/yocto/layers/
---

# Layers: Architecture and Internals

## What a Layer Is

A layer is a directory containing a `conf/layer.conf` file that registers it with BitBake. Everything else — recipes, classes, machine configs, bbappends — is optional content the layer contributes.

The fundamental value of layers is **separation of concerns without forking**. When your product needs to change how `busybox` is configured, you create a `.bbappend` in your product layer instead of modifying the upstream `busybox_1.36.1.bb` in `oe-core`. When oe-core upgrades to `busybox_1.37.0.bb`, your `.bbappend` with a `%` wildcard continues to apply automatically.

## `conf/layer.conf` — Anatomy

A complete `layer.conf` for a custom product layer:

```bash
# Add this layer's path to BitBake's search path
BBPATH .= ":${LAYERDIR}"

# Where BitBake should look for .bb and .bbappend files
BBFILES += "${LAYERDIR}/recipes-*/*/*.bb \
             ${LAYERDIR}/recipes-*/*/*.bbappend"

# Internal name for this layer (must be unique across all layers)
BBFILE_COLLECTIONS += "meta-myproduct"

# All .bb/.bbappend files belonging to this collection
BBFILE_PATTERN_meta-myproduct = "^${LAYERDIR}/"

# Priority: higher number wins when two layers define conflicting recipes
BBFILE_PRIORITY_meta-myproduct = "10"

# Other layers this layer requires
LAYERDEPENDS_meta-myproduct = "core openembedded-layer"

# Yocto releases this layer is tested against
LAYERSERIES_COMPAT_meta-myproduct = "scarthgap styhead"
```

`BBFILE_PRIORITY` is the conflict resolution mechanism: if both `meta-oe` (priority 6) and `meta-myproduct` (priority 10) provide a recipe for `openssl`, `meta-myproduct`'s version wins. This is how you override upstream recipes without forking.

## Layer Types and Priority Ranges

| Type | Priority | Examples | Purpose |
|------|----------|---------|----------|
| oe-core | 5 | `meta` | Minimal cross-arch base |
| Distribution | 5 | `meta-poky` | Distro policy, preferred versions |
| OpenEmbedded | 6–7 | `meta-oe`, `meta-python`, `meta-multimedia` | Broad recipe collection |
| BSP / Machine | 8–9 | `meta-raspberrypi`, `meta-ti`, `meta-freescale` | Hardware support |
| Product / Custom | 10+ | `meta-myproduct` | Application recipes and overrides |

## `bblayers.conf` — Registering Layers

```bash
# build/conf/bblayers.conf
BBPATH = "${TOPDIR}"

BBLAYERS ?= " \
  /opt/yocto/poky/meta \
  /opt/yocto/poky/meta-poky \
  /opt/yocto/poky/meta-yocto-bsp \
  /opt/yocto/meta-openembedded/meta-oe \
  /opt/yocto/meta-openembedded/meta-python \
  /opt/yocto/meta-raspberrypi \
  /opt/yocto/meta-myproduct \
"
```

Manage this file with `bitbake-layers` commands rather than editing by hand:

```bash
# Add a layer (validates LAYERDEPENDS and LAYERSERIES_COMPAT)
bitbake-layers add-layer /opt/yocto/meta-myproduct

# Show all active layers and their priorities
bitbake-layers show-layers

# See all recipes and which layer provides each
bitbake-layers show-recipes

# Find recipes that are shadowed by higher-priority layers
bitbake-layers show-overlayed
```

## BSP Layer vs Feature Layer

**BSP Layer** (e.g., `meta-raspberrypi`): Contains machine `.conf` files, kernel recipes, bootloader recipes, and hardware-specific userspace. Governed by the silicon/board vendor.

```
meta-raspberrypi/
├── conf/
│   ├── layer.conf
│   └── machine/
│       ├── raspberrypi4-64.conf   # DEFAULTTUNE, serial console, etc.
│       └── raspberrypi5.conf
├── recipes-bsp/
│   └── bootfiles/              # GPU firmware, config.txt, etc.
├── recipes-kernel/
│   └── linux/
│       └── linux-raspberrypi_6.6.bb
└── wic/
    └── sdimage-raspberrypi.wks  # SD card partition layout
```

**Feature Layer** (e.g., `meta-python`): Adds capabilities without owning any machine. No `conf/machine/` directory. Can be used with any `MACHINE`.

## Creating a Custom Layer

```bash
# From the poky directory with build env sourced
bitbake-layers create-layer ../../meta-myproduct

# The generated structure:
# meta-myproduct/
# ├── conf/layer.conf      (pre-filled with correct BBFILE_COLLECTIONS)
# ├── COPYING.MIT
# └── README

# Register it immediately
bitbake-layers add-layer ../../meta-myproduct
```

Always place your layer **outside** the `poky/` directory so it survives `git pull` on Poky.
