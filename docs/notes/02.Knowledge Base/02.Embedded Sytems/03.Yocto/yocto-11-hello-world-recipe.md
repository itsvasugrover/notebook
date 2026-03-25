---
title: Writing a Hello World Recipe
createTime: 2025/12/21 22:21:19
permalink: /kb/embedded/yocto/hello-world-recipe/
---

# Writing a "Hello World" Recipe

## The Complete Workflow

This section builds a "Hello World" C program as a proper Yocto recipe: from source through recipe to image inclusion and debugging.

### Step 1: Directory Structure

```bash
# Inside your custom layer
mkdir -p meta-myproduct/recipes-hello/hello/files
```

```
meta-myproduct/
└── recipes-hello/
    └── hello/
        ├── hello_1.0.bb       ← the recipe
        └── files/
            └── hello.c           ← local source file
```

### Step 2: The Source Code

```c
/* meta-myproduct/recipes-hello/hello/files/hello.c */
#include <stdio.h>

int main(void) {
    printf("Hello, Yocto World!\n");
    return 0;
}
```

### Step 3: The Recipe

```bash
# meta-myproduct/recipes-hello/hello/hello_1.0.bb

SUMMARY = "A simple Hello World program"
LICENSE = "GPL-2.0-only"
LIC_FILES_CHKSUM = "file://${COMMON_LICENSE_DIR}/GPL-2.0-only;md5=801f80980d171dd6425610833a22dbe6"

# SRC_URI with file:// looks in the 'files' subdirectory relative to this recipe
SRC_URI = "file://hello.c"

# S = WORKDIR because the source is a single file, not an archive
S = "${WORKDIR}"

do_compile() {
    # ${CC} ${CFLAGS} ${LDFLAGS} are provided by the cross-toolchain
    ${CC} ${CFLAGS} ${LDFLAGS} hello.c -o hello
}

do_install() {
    # D  = destination root (becomes the target rootfs)
    # bindir = /usr/bin (set by bitbake.conf)
    install -d ${D}${bindir}
    install -m 0755 hello ${D}${bindir}/hello
}
```

### Step 4: Build and Inspect

```bash
# Build just this recipe
bitbake hello

# Verify the binary in the staging area (before image assembly)
find tmp/work/ -path "*/hello/1.0-r0/image/usr/bin/hello"

# Check it is a cross-compiled ELF (not your host arch)
file tmp/work/cortexa72-poky-linux/hello/1.0-r0/image/usr/bin/hello
# Expected: ELF 64-bit LSB executable, ARM aarch64

# Open an interactive build shell for debugging
bitbake -c devshell hello
# Inside devshell: ${CC}, ${LD}, ${SYSROOT} are all set; you can run build commands manually
```

### Step 5: Add to an Image

```bash
# Option A: Add directly in local.conf (for quick testing)
IMAGE_INSTALL:append = " hello"

# Option B: Add via a packagegroup (for production)
# In packagegroup-my-apps.bb:
RDEPENDS:${PN} = " hello "

# Option C: Add in the image recipe itself
IMAGE_INSTALL:append = " packagegroup-my-apps"
```

```bash
# Build the image with hello included
bitbake core-image-minimal

# Run in QEMU and test
runqemu qemuarm64 nographic
# (on the QEMU target)
/usr/bin/hello
# Output: Hello, Yocto World!
```

## Extending to a CMake Recipe

For a real application using CMake, the recipe becomes simpler by inheriting the `cmake` class:

```bash
# myapp_2.0.bb
SUMMARY = "My CMake application"
LICENSE = "MIT"
LIC_FILES_CHKSUM = "file://LICENSE;md5=..."

SRC_URI = "git://github.com/myorg/myapp.git;protocol=https;branch=main"
SRCREV  = "a1b2c3d4e5f6..."    # Always pin to a specific commit

S = "${WORKDIR}/git"

inherit cmake

# cmake class provides do_configure, do_compile, do_install automatically
# These optionally extend those tasks:
EXTRA_OECMAKE = "-DENABLE_TESTS=OFF -DBUILD_SHARED_LIBS=ON"

RDEPENDS:${PN} = "libconfig"
```

## Key Variables Reference

| Variable | Value | Meaning |
|----------|-------|---------|
| `${D}` | `${WORKDIR}/image` | Root of the destination filesystem |
| `${bindir}` | `/usr/bin` | Target binary directory |
| `${sbindir}` | `/usr/sbin` | Target sbin directory |
| `${sysconfdir}` | `/etc` | Target config directory |
| `${libdir}` | `/usr/lib` | Target library directory |
| `${datadir}` | `/usr/share` | Target data directory |
| `${CC}` | `aarch64-poky-linux-gcc ...` | Cross-compiler |
| `${CFLAGS}` | `-march=armv8-a ...` | Target compiler flags |
| `${LDFLAGS}` | `-Wl,-O1 ...` | Target linker flags |
