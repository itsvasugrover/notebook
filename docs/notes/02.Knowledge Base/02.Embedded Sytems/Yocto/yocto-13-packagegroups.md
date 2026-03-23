---
title: Packagegroups
createTime: 2025/12/21 22:21:19
permalink: /kb/embedded/yocto/packagegroups/
---

# Packagegroups

## What a Packagegroup Is

A packagegroup is a special recipe whose sole purpose is to declare a named collection of packages. It has no source to fetch or compile — only runtime dependencies.

**Why use it**: Instead of listing 20 individual packages in every image recipe and in `local.conf`, you maintain one packagegroup. Every image that needs those 20 packages just includes the one packagegroup.

## Minimal Packagegroup Recipe

```bash
# meta-myproduct/recipes-core/packagegroups/packagegroup-my-iot-core.bb

SUMMARY = "Core packages for my IoT product"
LICENSE  = "MIT"

# Mandatory: inherit the packagegroup class
inherit packagegroup

# RDEPENDS:${PN} lists every package this group pulls in
RDEPENDS:${PN} = " \
    myapp \
    nginx \
    python3 \
    openssh \
    curl \
    tzdata \
"

# Optional: conditionally include packages based on DISTRO_FEATURES
RDEPENDS:${PN}:append = " \
    ${@bb.utils.contains('DISTRO_FEATURES', 'x11', 'matchbox-wm', '', d)} \
    ${@bb.utils.contains('DISTRO_FEATURES', 'wayland', 'weston', '', d)} \
"
```

## Sub-package Splitting in Packagegroups

A packagegroup recipe can define multiple packages, each with its own dependency list. This lets images include only the subset they need:

```bash
# packagegroup-my-debug.bb
SUMMARY = "Debug tools packagegroup"
LICENSE  = "MIT"
inherit packagegroup

# Define multiple sub-packages
PACKAGES = "${PN} ${PN}-extended ${PN}-profile"

# Base debug set
RDEPENDS:${PN} = "\
    gdb \
    strace \
    ltrace \
"

# Extended debug set (includes the base)
RDEPENDS:${PN}-extended = "\
    ${PN} \
    valgrind \
    tcpdump \
    iperf3 \
"

# Profiling set
RDEPENDS:${PN}-profile = "\
    perf \
    lttng-tools \
    babeltrace2 \
"
```

Usage in an image:

```bash
IMAGE_INSTALL:append = " packagegroup-my-debug-extended"
```

## RDEPENDS vs RRECOMMENDS vs RSUGGESTS

| Variable | Behaviour |
|----------|-----------|
| `RDEPENDS:${PN}` | Hard dependency — the package manager **requires** these to be installed when this package is installed |
| `RRECOMMENDS:${PN}` | Soft dependency — installed automatically if available, but the install succeeds without them |
| `RSUGGESTS:${PN}` | Informational only — not installed automatically; surfaced as suggestions by the package manager |
| `RCONFLICTS:${PN}` | Cannot be installed at the same time as these packages |
| `RREPLACES:${PN}` | This package replaces (and can uninstall) these packages |

```bash
# In a packagegroup or any recipe:
RDEPENDS:${PN}    = "libssl"        # MUST be present
RRECOMMENDS:${PN} = "ca-certificates"  # installed if available
RSUGGESTS:${PN}   = "curl"          # just a hint
```

## Packagegroup Best Practices

```bash
# 1. Use packagegroups to build logical product compositions:
#    packagegroup-product-core     ← always installed
#    packagegroup-product-debug    ← included in dev builds
#    packagegroup-product-ota      ← OTA update client packages

# 2. Refence from the image recipe:
IMAGE_INSTALL = " \
    packagegroup-core-boot \
    packagegroup-my-iot-core \
    ${@bb.utils.contains('IMAGE_FEATURES', 'tools-debug', \
        'packagegroup-my-debug', '', d)} \
"

# 3. Build and inspect:
bitbake packagegroup-my-iot-core
# Check what would be installed:
bitbake -e packagegroup-my-iot-core | grep ^RDEPENDS
```
