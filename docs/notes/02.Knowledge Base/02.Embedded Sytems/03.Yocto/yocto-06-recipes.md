---
title: BitBake Recipes (.bb files)
createTime: 2025/12/21 22:21:19
permalink: /kb/embedded/yocto/recipes/
---

# BitBake Recipes (.bb files)

## Recipe Anatomy

A recipe is a text file (`.bb`) that describes how to obtain, build, and package a single software component. The filename encodes the package name and version: `bash_5.2.21.bb` means package `bash`, version `5.2.21`.

Complete annotated recipe skeleton:

```bash
# ─── Identity ───────────────────────────────────────────────────────────────────────────
SUMMARY     = "GNU Bourne Again Shell"
DESCRIPTION = "Bash is the shell, or command language interpreter."
HOMEPAGE    = "http://tiswww.case.edu/php/chet/bash/bashtop.html"
BUGTRACKER  = "http://savannah.gnu.org/bugs/?group=bash"

# ─── License ───────────────────────────────────────────────────────────────────────────
LICENSE = "GPL-3.0-only"
# Checksum of the license file IN THE SOURCE CODE.
# If upstream changes the license, the build fails until you update this.
LIC_FILES_CHKSUM = "file://COPYING;md5=d32239bcb673463ab874e80d47fae504"

# ─── Versioning ─────────────────────────────────────────────────────────────────────
PV = "5.2.21"  # Package Version (usually from filename)
PE = "0"       # Package Epoch  (increment if version goes backwards)
PR = "r0"      # Package Revision (increment for packaging-only changes)

# ─── Source Fetching ────────────────────────────────────────────────────────────────
SRC_URI = "https://ftp.gnu.org/gnu/bash/bash-${PV}.tar.gz \
           file://0001-fix-local-var-crash.patch \
           file://bash-extra-config.cfg"
# Hash of the tarball (sha256 preferred)
SRC_URI[sha256sum] = "a139c166df7ff4471c5e0733051642ee5556a1f8..."

# For git sources:
# SRC_URI = "git://github.com/user/repo.git;protocol=https;branch=main"
# SRCREV  = "a1b2c3d4e5f6..."   # exact commit; never use a moving tag
# S       = "${WORKDIR}/git"   # default for git fetcher

S = "${WORKDIR}/bash-${PV}"    # Where the extracted source lives

# ─── Dependencies ──────────────────────────────────────────────────────────────────────
DEPENDS  = "ncurses"                     # build-time: sysroot populated before do_configure
RDEPENDS:${PN} = "ncurses-terminfo-base" # runtime: installed on target with this package

# ─── Build System ────────────────────────────────────────────────────────────────────
# Most recipes inherit a class rather than redefining every task:
inherit autotools  # Provides: do_configure (./configure), do_compile (make),
                   #           do_install (make install DESTDIR=${D})

EXTRA_OECONF = "--without-bash-malloc \
                --disable-rpath"

# ─── Package Splitting ──────────────────────────────────────────────────────────────────
PACKAGES = "${PN}-dbg ${PN}-staticdev ${PN}-dev ${PN}-doc ${PN} ${PN}-locale"
FILES:${PN}     = "${bindir}/bash ${bindir}/sh"
FILES:${PN}-dev = "${includedir}/*.h"

# ─── PACKAGECONFIG ────────────────────────────────────────────────────────────────────
# Format: PACKAGECONFIG[flag] = "if-on,if-off,DEPENDS,RDEPENDS"
PACKAGECONFIG ??= ""
PACKAGECONFIG[readline] = "--with-installed-readline,--without-readline,readline"
# Enable readline only if distro includes it:
PACKAGECONFIG:append = " ${@bb.utils.filter('DISTRO_FEATURES', 'readline', d)}"

# ─── Custom Task Overrides ───────────────────────────────────────────────────────────────
do_install:append() {
    ln -sf bash ${D}${bindir}/sh
}
```

## SRC_URI Fetcher Schemes

| Scheme | Example | Notes |
|--------|---------|-------|
| `https://` | tarball download | Requires `SRC_URI[sha256sum]` |
| `git://` | `git://github.com/u/r.git;protocol=https;branch=main` | Use `SRCREV` for exact commit |
| `file://` | `file://mypatch.patch` | Searches `FILESPATH` dirs |
| `npm://` | `npm://registry.npmjs.org;package=express` | `meta-nodejs` fetcher |
| `gitsm://` | git with submodules | Auto-fetches submodules |
| `crate://` | `crate://crates.io/serde/1.0` | Rust — `meta-rust` fetcher |

## Recipe Version Selection

BitBake selects which recipe version to build in this priority order:

1. `PREFERRED_VERSION_bash = "5.2%"` in `local.conf` or `distro.conf` — explicit pin (the `%` is a glob)
2. Highest version number among available `.bb` files
3. `DEFAULT_PREFERENCE` variable in the recipe (rarely used)

```bash
# A git recipe tracking a specific commit with an auto-incrementing version string
PV = "1.0+git${SRCPV}"   # SRCPV = git describe output
SRCREV = "a1b2c3..."      # Pin to exact commit in production; NEVER use AUTOREV
```

## Native vs Target Recipes

```bash
# Build this recipe for the HOST machine (e.g., a code generator tool)
inherit native
# Outputs to tmp/sysroots-components/x86_64/ — not in target image
# Usage in another recipe: DEPENDS = "my-codegen-native"

# Generate both target and native variants from one .bb file:
BBCLASSEXTEND = "native nativesdk"
# Produces:  my-tool_1.0.bb          (target build)
#            my-tool-native_1.0.bb   (host build for DEPENDS)
#            my-tool-nativesdk_1.0.bb (inside the SDK)
```

## The WORKDIR Structure

```
tmp/work/cortexa72-poky-linux/bash/5.2.21-r0/
├── bash-5.2.21/          ← S: source tree, post-patch
├── build/                ← B: out-of-tree build directory
├── image/                ← D: fake rootfs (populated by do_install)
│   └── usr/bin/bash
├── deploy-rpms/          ← generated .rpm packages
├── temp/
│   ├── log.do_fetch          ← fetcher output
│   ├── log.do_compile        ← FIRST place to look on build failure
│   └── run.do_compile        ← the actual shell script that was executed
└── sysroot-destdir/      ← headers/libs exported to STAGING_DIR for dependants
```

When a build fails, `temp/log.do_compile` and `temp/run.do_compile` are the first diagnostic files to examine.
