---
title: Best Practices
createTime: 2025/12/21 22:21:19
permalink: /kb/embedded/yocto/best-practices/
---

# Best Practices

## Layer Organization

### Keep Layers Focused

One concern per layer. Don't put kernel fragments, application recipes, and machine configs all in one layer:

```
meta-mycompany-bsp/        ← machine configs, kernel, bootloader
meta-mycompany-distro/     ← distro policy, preferred versions
meta-myapp/                ← your application recipes only
meta-myapp-integration/    ← bbappends to integrate your app with system packages
```

### Never Modify Upstream Layers

Never edit files in `poky/`, `meta-oe/`, or any layer you don't own. Always use `.bbappend` files in your own layer. Upstream files can be `git pull`-ed without conflicts.

### Keep Layers Outside `poky/`

```bash
# Good layout:
/opt/yocto/
├── poky/                   # upstream, never modified
├── meta-openembedded/      # upstream, never modified
├── meta-raspberrypi/       # upstream, never modified
├── meta-myproduct/         # your layer, version-controlled separately
└── build/                  # build directory
```

## Recipe Quality

### Always Pin SRCREV

```bash
# BAD: AUTOREV fetches HEAD every time = non-reproducible builds
SRCREV = "${AUTOREV}"    # NEVER in production

# GOOD: Pin to an exact commit hash
SRCREV = "a1b2c3d4e5f678901234567890abcdef12345678"

# To update the pin:
git log --oneline -5  # find the new commit on your upstream
# Update SRCREV + PV in the recipe, then commit your layer change
```

### Always Specify LIC_FILES_CHKSUM

```bash
# This checksum verifies the license file in the source hasn't changed
# If upstream changes their license, your build fails and alerts you
LIC_FILES_CHKSUM = "file://COPYING;md5=d32239bcb673463ab874e80d47fae504"

# Use CLOSED only for truly proprietary code with no license file:
LICENSE = "CLOSED"
# (No LIC_FILES_CHKSUM needed for CLOSED)
```

### Use BBCLASSEXTEND for Tools Needed at Build-Time

```bash
# A recipe providing a code generator:
BBCLASSEXTEND = "native"

# Now other recipes can use it at build time:
DEPENDS = "my-codegen-native"
```

### Use PACKAGECONFIG for Optional Dependencies

```bash
# Avoid hard-coding optional features:
# BAD:
DEPENDS = "openssl gnutls curl"

# GOOD: let the distro/user opt in:
PACKAGECONFIG ??= "openssl"
PACKAGECONFIG[openssl]  = "--with-openssl,  --without-openssl,  openssl"
PACKAGECONFIG[gnutls]   = "--with-gnutls,   --without-gnutls,   gnutls"
PACKAGECONFIG[curl]     = "--with-curl,     --without-curl,     curl"
```

## sstate-cache Discipline

### Share sstate Across the Team

```bash
# In local.conf (or a shared site.conf):
SSTATE_DIR = "/srv/yocto/sstate-cache"   # NFS or shared SSD
DL_DIR     = "/srv/yocto/downloads"      # shared downloads

# Pull sstate from a CI server:
SSTATE_MIRRORS = "file://.* https://yocto-cache.example.com/sstate/PATH"
```

With a warm shared sstate-cache, a fresh checkout + `bitbake core-image-minimal` completes in minutes instead of hours.

### Don't Clean Unless You Must

```bash
# Instead of cleaning everything:
rm -rf tmp/  # SLOW

# Just clean the broken recipe:
bitbake -c cleansstate myapp
bitbake myapp

# Or force a single task:
bitbake -c compile -f myapp
```

## Security Practices

### Enable CVE Checking

```bash
# local.conf:
INHERIT += "cve-check"
# Adds cve_check task to every recipe; reports known CVEs against NVD database
# Run: bitbake core-image-minimal -c cve_check
# Report: tmp/deploy/cve/
```

### Remove `debug-tweaks` in Production

```bash
# Development image:
IMAGE_FEATURES += "debug-tweaks"  # empty root password, etc.

# Production image: ensure this is NOT present
# Set a real root password via:
INHERIT += "extrausers"
EXTRA_USERS_PARAMS = "usermod -P 'SecurePass123' root;"
```

### Use `read-only-rootfs`

```bash
# For production devices with no OTA:
IMAGE_FEATURES += "read-only-rootfs"
# Configures /etc/fstab and init to mount / as read-only
# Mutable data goes in a separate /data partition
```

## CI/CD Integration

### Use repo or git submodules for Reproducibility

```xml
<!-- default.xml for repo manifest -->
<manifest>
  <remote name="yocto" fetch="git://git.yoctoproject.org"/>
  <remote name="oe"    fetch="git://git.openembedded.org"/>
  <remote name="mine"  fetch="ssh://git.example.com"/>

  <project name="poky"              remote="yocto" revision="scarthgap"/>
  <project name="meta-openembedded" remote="oe"    revision="scarthgap"/>
  <project name="meta-myproduct"    remote="mine"  revision="main"/>
</manifest>
```

```bash
# Reproducible checkout:
repo init -u git://git.example.com/manifests -b release-1.5
repo sync
source poky/oe-init-build-env build
bitbake my-product-image
```

### Makefile Wrapper for CI

```makefile
# Makefile in project root
BUILD_DIR ?= build
IMAGE     ?= my-product-image
MACHINE   ?= my-board

setup:
	source poky/oe-init-build-env $(BUILD_DIR)

build: setup
	cd $(BUILD_DIR) && MACHINE=$(MACHINE) bitbake $(IMAGE)

sdk: setup
	cd $(BUILD_DIR) && bitbake -c populate_sdk $(IMAGE)

clean-recipe:
	cd $(BUILD_DIR) && bitbake -c cleansstate $(RECIPE)
```

## Release Upgrade Checklist

When upgrading Yocto releases (e.g., Kirkstone → Scarthgap):

```bash
# 1. Update all layer branches in your repo manifest
git -C poky              checkout scarthgap
git -C meta-openembedded checkout scarthgap
git -C meta-raspberrypi  checkout scarthgap

# 2. Check LAYERSERIES_COMPAT in your custom layers
grep LAYERSERIES_COMPAT meta-myproduct/conf/layer.conf
# Update: LAYERSERIES_COMPAT_meta-myproduct = "scarthgap styhead"

# 3. Scan for old underscore override syntax
grep -rn "_append\|_prepend\|_remove" meta-myproduct/ \
    --include="*.bb" --include="*.bbappend"
# Migrate any found to colon syntax:
# SRC_URI_append → SRC_URI:append

# 4. Check PREFERRED_VERSION pins still match available versions
bitbake -s | grep linux-yocto   # confirm preferred version resolves

# 5. Do a test build with a fresh tmp/
rm -rf build/tmp
bitbake my-product-image

# 6. Run in QEMU and smoke-test before merging
runqemu qemux86-64 nographic
```
