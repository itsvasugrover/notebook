---
title: BitBake Recipes (.bb files)
createTime: 2025/12/21 22:21:19
permalink: /kb/embedded/yocto/recipes/
---

# BitBake Recipes (.bb files)

A recipe is the fundamental building block, a .bb file that contains all the information needed by BitBake to build a single package (e.g., an application, a library, the kernel, an image).

Think of it as a instruction manual for building one piece of software.

Key Elements of a Recipe:

- Recipe Header:
  - SUMMARY: A short description.
  - DESCRIPTION: A longer description.
  - HOMEPAGE: The upstream software's website.
  - BUGTRACKER: Where to report bugs.
- License and Version:
  - LICENSE: The software's license (e.g., "GPL-2.0-only", "MIT").
  - LIC_FILES_CHKSUM: A checksum of the license file in the source code. This is a critical security and integrity check to ensure the license hasn't changed.
  - SRC_URI: The URL to fetch the source code from (http, git, svn, local file). This is one of the most important variables.
  - SRCREV: The specific revision to use if fetching from a SCM like Git (a commit hash).
  - PV: Package Version. Can be set manually or automatically parsed from the recipe filename (e.g., bash_4.4.bb has PV = "4.4").
- Dependencies:
  - DEPENDS: Build-time dependencies. These must be built and available before this recipe's compilation task starts. (e.g., cmake-native, libssl).
  - `RDEPENDS:${PN}`: Runtime dependencies. These packages must be installed on the target device for this package to run. (e.g., a Python script has `RDEPENDS:${PN}` = "python3").
- Tasks and Functions:
  - The real work happens in task functions, which are shell or Python scripts.
  - do_configure(): Prepares the build (e.g., runs cmake or ./configure).
  - do_compile(): Compiles the source code (e.g., runs make).
  - do_install(): Installs the built artifacts into a staging directory (`${D}`). This is what will end up in the final image.
  - You can override these functions to add custom steps.

Example Skeleton of a Recipe (myapp_1.0.bb):

```bb
SUMMARY = "My custom application"
LICENSE = "CLOSED"
LIC_FILES_CHKSUM = "file://${COMMON_LICENSE_DIR}/GPL-2.0-only;md5=801f80980d171dd6425610833a22dbe6"

SRC_URI = "git://git@github.com/company/myapp.git;protocol=ssh;branch=main"
SRCREV = "a1b2c3d4e5f67890..."

DEPENDS = "qtbase"
RDEPENDS:${PN} = "libconfig"

S = "${WORKDIR}/git"

do_install() {
    install -d ${D}${bindir}
    install -m 0755 ${S}/myapp ${D}${bindir}
}
```

## Key Points: Recipes (.bb)

- The instruction manual for building a single package.
- SRC_URI defines where to get the source code.
- LIC_FILES_CHKSUM is a critical security feature.
- DEPENDS (build-time) vs. RDEPENDS (run-time).
- Task functions (do_compile, do_install) define the build steps.
