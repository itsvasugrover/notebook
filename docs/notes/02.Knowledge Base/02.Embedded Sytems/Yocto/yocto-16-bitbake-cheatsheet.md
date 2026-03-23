---
title: BitBake Cheatsheet
createTime: 2025/12/21 22:21:19
permalink: /kb/embedded/yocto/bitbake-cheatsheet/
---

# BitBake Cheatsheet

## Build Commands

```bash
# Build a target (image, recipe, packagegroup)
bitbake core-image-minimal
bitbake virtual/kernel
bitbake myapp
bitbake packagegroup-my-apps

# Run a specific task of a recipe
bitbake -c fetch      myapp
bitbake -c compile    myapp
bitbake -c install    myapp
bitbake -c package    myapp

# Force re-run of a task (ignore sstate cache for that task)
bitbake -c compile -f myapp

# Force complete rebuild (clean sstate, re-fetch, recompile)
bitbake -c cleanall   myapp && bitbake myapp
```

## Cleaning Commands (Least to Most Aggressive)

```bash
# Remove build artifacts, keep downloaded source and sstate
bitbake -c clean myapp

# Remove sstate entry for a recipe (forces rebuild from source next time)
bitbake -c cleansstate myapp

# Remove everything: sstate, WORKDIR, downloaded source
bitbake -c cleanall myapp

# Nuclear: remove entire tmp/ directory (all build artefacts, keeps downloads)
rm -rf tmp/

# Full reset (removes tmp/, sstate-cache/, keeps downloads/)
rm -rf tmp/ sstate-cache/
```

## Inspection and Debugging

```bash
# Dump the full variable environment for a recipe (most useful debug command)
bitbake -e myapp
bitbake -e myapp | grep ^SRC_URI=
bitbake -e myapp | grep ^WORKDIR=
bitbake -e myapp | grep ^do_compile  # show the actual task function

# Open an interactive shell with the recipe's full build environment
# (CC, CFLAGS, LDFLAGS, PKG_CONFIG_PATH, etc. all set)
bitbake -c devshell myapp

# List all tasks defined for a recipe
bitbake -c listtasks myapp

# Show which version of each recipe BitBake will use
bitbake -s
bitbake -s | grep openssl

# Parse all recipes and check for syntax errors
bitbake -p
```

## Dependency Analysis

```bash
# Generate dependency graph (.dot files)
bitbake -g core-image-minimal
# Produces: task-depends.dot, pn-buildlist

# Visualise
dot -Tsvg task-depends.dot -o task-deps.svg

# Check what would be included in an image
cat pn-buildlist

# Find what recipe provides a virtual target or a package name
bitbake -e virtual/kernel | grep ^PN=
bitbake-layers show-recipes | grep "^openssl"

# Show recipe-level DEPENDS (build-time) graph
bitbake -g myapp && cat pn-depends.dot
```

## sstate-cache Debugging

```bash
# Compare two task signatures to find why a rebuild was triggered
bitbake-dumpsig tmp/stamps/.../do_compile.sigdata.abc123
bitbake-dumpsig -d tmp/stamps/.../do_compile.sigdata.abc123 \
                   tmp/stamps/.../do_compile.sigdata.def456

# Show what variables contributed to a task's hash
bitbake-diffsigs tmp/stamps/.../do_compile.sigdata.abc123 \
                 tmp/stamps/.../do_compile.sigdata.def456

# Check sstate-cache hit rate during build (look for 'Setscene')
bitbake core-image-minimal 2>&1 | grep -i setscene | wc -l
```

## Layer Management

```bash
# Create a new layer
bitbake-layers create-layer meta-myproduct

# Add a layer (validates LAYERDEPENDS and LAYERSERIES_COMPAT)
bitbake-layers add-layer /path/to/meta-myproduct

# Remove a layer
bitbake-layers remove-layer /path/to/meta-myproduct

# Show all registered layers with their priorities
bitbake-layers show-layers

# Show all recipes and which layer provides each
bitbake-layers show-recipes
bitbake-layers show-recipes | grep "^busybox"

# Show recipes overridden by a higher-priority layer
bitbake-layers show-overlayed

# Show which appends apply to a recipe
bitbake-layers show-appends | grep busybox
```

## SDK and Toolchain

```bash
# Generate standard SDK
bitbake -c populate_sdk core-image-minimal
# Output: tmp/deploy/sdk/*.sh

# Generate extensible SDK (includes devtool)
bitbake -c populate_sdk_ext core-image-minimal

# devtool: add a new recipe from source
devtool add myapp /path/to/source

# devtool: build and deploy to a running target
devtool build myapp
devtool deploy-target myapp root@192.168.1.10

# devtool: finish recipe (commits changes back to your layer)
devtool finish myapp meta-myproduct
```

## Kernel Specific

```bash
# Interactive kernel config
bitbake -c menuconfig virtual/kernel

# Generate config fragment from your changes
bitbake -c diffconfig virtual/kernel

# Verify config fragments were applied correctly
bitbake -c kernel_configcheck virtual/kernel

# Build only the kernel (skip rootfs and image steps)
bitbake virtual/kernel
```

## QEMU / Testing

```bash
# Run the image in QEMU (after building)
runqemu qemux86-64 nographic
runqemu qemuarm64 
runqemu qemux86-64 core-image-minimal

# Run QEMU with GDB attached
runqemu qemux86-64 nographic slirp gdb

# Check build for CVE vulnerabilities
INHERIT += "cve-check"  # add to local.conf
bitbake core-image-minimal -c cve_check
```

## Quick File Location Reference

```bash
# Final images
tmp/deploy/images/<MACHINE>/

# Per-recipe build directory
tmp/work/<arch>/<recipe>/<version>/

# Build logs (check first when a recipe fails)
tmp/work/<arch>/<recipe>/<version>/temp/log.do_compile
tmp/work/<arch>/<recipe>/<version>/temp/run.do_compile

# SDK output
tmp/deploy/sdk/

# Package feeds
tmp/deploy/rpm/     # or ipk/ or deb/

# sstate-cache
sstate-cache/

# Downloaded sources
downloads/

# Task stamps (hash-based rebuild tracking)
tmp/stamps/
```
