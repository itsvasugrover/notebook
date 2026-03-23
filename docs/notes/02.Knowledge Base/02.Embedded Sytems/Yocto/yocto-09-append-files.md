---
title: Append Files (.bbappend)
createTime: 2025/12/21 22:21:19
permalink: /kb/embedded/yocto/append-files/
---

# Append Files (.bbappend)

## Purpose and Mechanism

A `.bbappend` file extends or overrides a recipe without modifying the original `.bb` file. This is the cornerstone of the Yocto layering model: you never fork upstream recipes; you append to them.

When BitBake parses a recipe:
1. Parses the base `.bb` file
2. Finds all `.bbappend` files whose name matches (using glob patterns)
3. Applies the `.bbappend` content in layer priority order (lowest to highest)

The result is as if the `.bbappend` content were appended to the `.bb` file, with layer priority deciding which wins in conflicts.

## Naming Convention

```
Original recipe:          meta-oe/recipes-core/busybox/busybox_1.36.1.bb
Version-locked append:    meta-myproduct/recipes-core/busybox/busybox_1.36.1.bbappend
Version wildcard append:  meta-myproduct/recipes-core/busybox/busybox_%.bbappend
```

The `%` wildcard matches any version. Use it so your append continues to apply when the upstream recipe is version-bumped.

## FILESEXTRAPATHS — Adding File Search Paths

Before adding a local file to `SRC_URI` in a `.bbappend`, you must tell BitBake where to find it:

```bash
# Prepend THIS file's containing directory to the file search path
# THISDIR = directory containing this .bbappend file
FILESEXTRAPATHS:prepend := "${THISDIR}/${PN}:"

# Or with a literal subdirectory:
FILESEXTRAPATHS:prepend := "${THISDIR}/files:"
```

Without this, `file://mypatch.patch` in `SRC_URI` will only search the base recipe's directories and fail to find your file.

## Common Patterns

### Applying Patches

```bash
# meta-myproduct/recipes-core/busybox/busybox_%.bbappend
FILESEXTRAPATHS:prepend := "${THISDIR}/${PN}:"

# Patches are applied in order; git-format-patch output is preferred
SRC_URI:append = " file://0001-enable-httpd-cgi.patch \
                   file://0002-fix-segfault-in-sh.patch"
```

### Changing Build Configuration

```bash
# autotools recipe: extend configure flags
EXTRA_OECONF:append = " --enable-my-feature"

# CMake recipe: extend cmake flags
EXTRA_OECMAKE:append = " -DMY_OPTION=ON"

# Kernel: add a config fragment
FILESEXTRAPATHS:prepend := "${THISDIR}/${PN}:"
SRC_URI:append = " file://enable-usb-serial.cfg"
```

### Modifying Task Functions

```bash
# Add steps AFTER the inherited do_install
do_install:append() {
    install -d ${D}${sysconfdir}/busybox
    install -m 0644 ${WORKDIR}/my-busybox.conf \
        ${D}${sysconfdir}/busybox/busybox.conf
}

# Add steps BEFORE do_configure
do_configure:prepend() {
    export EXTRA_DEFINE="-DPRODUCT_NAME=mydevice"
}
```

### Changing Dependencies

```bash
# Add a runtime dependency alongside this package
RDEPENDS:${PN}:append = " ca-certificates"

# Add a build-time dependency
DEPENDS:append = " openssl-native"
```

### Disabling a Recipe

```bash
# Prevent this recipe from being built (e.g., replaced by your own version)
python () {
    raise bb.parse.SkipRecipe("Replaced by meta-myproduct version")
}
```

## Task Flag Modifiers

Task flags control scheduling and dependency behaviour:

```bash
# Force this task to run even if inputs haven't changed
do_my_task[nostamp] = "1"

# This task depends on another recipe's task completing first
do_compile[depends] = "my-codegen-native:do_populate_sysroot"

# Run do_populate_sysroot for every recipe in DEPENDS before do_configure
do_configure[deptask] = "do_populate_sysroot"

# Recursively run do_package_write_ipk for every RDEPEND
do_build[recrdeptask] += "do_package_write_ipk"
```

## The Override Syntax Change (Honister / 3.4+)

| Era | Old syntax | New syntax |
|-----|-----------|------------|
| Before Honister | `SRC_URI_append` | `SRC_URI:append` |
| Before Honister | `do_install_append` | `do_install:append` |
| Before Honister | `RDEPENDS_${PN}` | `RDEPENDS:${PN}` |
| Before Honister | `KERNEL_IMAGETYPE_raspberrypi4` | `KERNEL_IMAGETYPE:raspberrypi4` |

The old underscore syntax still parses with a warning in some releases, but the colon syntax is required from Scarthgap onward. Scan your layer for old syntax:

```bash
# Find files still using old underscore-based append/prepend
grep -r "_append\|_prepend\|_remove" meta-myproduct/ \
    --include="*.bb" --include="*.bbappend" --include="*.bbclass"
# Any match needs updating to colon syntax
```

## The Full Customization Hierarchy

```
bitbake.conf                       ← global defaults
    ↓ (layer priority order)
Recipe (.bb)                       ← base package instructions
    ↓ (same layer priority order)
Append files (.bbappend)           ← overlay customizations
    ↓
Inherited classes (.bbclass)       ← injected build logic
    ↓
Final DataStore                    ← :append/:prepend applied last
```
