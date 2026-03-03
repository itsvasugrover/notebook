---
title: BitBake Cheatsheet
createTime: 2025/12/21 22:21:19
permalink: /kb/embedded/yocto/bitbake-cheatsheet/
---

# BitBake Cheatsheet and Useful Commands

## Essential BitBake Commands

### Build Commands

```bash
# Build a target (recipe, image, packagegroup)
bitbake <target-name>

# Common examples:
bitbake core-image-minimal
bitbake hello
bitbake packagegroup-my-demo
bitbake virtual/kernel

# Build specific task of a recipe
bitbake -c <task> <target>
bitbake -c compile hello
bitbake -c install hello

# Force specific task (ignore sstate cache)
bitbake -c <task> -f <target>
```

### Development & Debugging Commands

```bash
# Interactive kernel configuration
bitbake -c menuconfig virtual/kernel

# Generate kernel config fragment from changes
bitbake -c diffconfig virtual/kernel

# Open devshell for a recipe (debug build environment)
bitbake -c devshell <recipe>

# List tasks for a recipe
bitbake -c listtasks <recipe>

# Check recipe syntax
bitbake -p <recipe>

# Show environment for a recipe
bitbake -e <recipe> | grep <variable>

# Show all recipe versions available
bitbake -s | grep <recipe>
```

### Information & Analysis Commands

```bash
# Show dependency graph
bitbake -g <target>

# Show what provides a specific file/package
bitbake -g <target> && cat pn-depends.dot | grep -i <package>

# Check build statistics
bitbake -S printdiff <target>

# Show all recipe providers for a target
bitbake -s | grep <pattern>
```

### Layer Management Commands

```bash
# Create a new layer
bitbake-layers create-layer <layer-path>

# Add a layer to bblayers.conf
bitbake-layers add-layer <layer-path>

# Remove a layer from bblayers.conf
bitbake-layers remove-layer <layer-path>

# Show current layer structure
bitbake-layers show-layers

# Show recipes and their layers
bitbake-layers show-recipes

# Show overlapped recipes (multiple providers)
bitbake-layers show-overlayed
```

### Build Optimization & Cleanup Commands

#### Incremental Build Speed

```bash
# Only rebuild specific recipe (uses sstate cache for dependencies)
bitbake <recipe>

# Force rebuild of specific recipe (ignore sstate)
bitbake -c cleanall <recipe> && bitbake <recipe>

# Reconfigure and rebuild (for autotools/cmake recipes)
bitbake -c reconfigure <recipe>
```

#### Cleaning Commands (Most to Least Aggressive)

```bash
# Remove everything for a specific recipe (source, work directory, output)
bitbake -c cleanall <recipe>

# Remove work directory for a recipe (keeps downloaded source)
bitbake -c cleansstate <recipe>

# Clean shared state cache for a recipe (forces rebuild from source)
bitbake -c cleansstate <recipe>

# Remove temporary work directory for a recipe
bitbake -c clean <recipe>

# Remove downloaded source files for a recipe
bitbake -c cleansrc <recipe>

# Nuclear option - remove entire tmp and sstate-cache (VERY SLOW REBUILD)
rm -rf tmp/ sstate-cache/

# Remove downloads but keep build cache (safe cleanup)
rm -rf downloads/
```

#### Selective Cleaning Patterns

```bash
# Clean all kernel-related items
bitbake -c cleanall virtual/kernel

# Clean entire image and dependencies
bitbake -c cleanall core-image-minimal

# Clean multiple recipes
bitbake -c cleanall recipe1 recipe2 recipe3
```

## Best Practices for Fast Builds

### 1. Configuration Optimizations

In local.conf:

```bash
# Enable parallel builds (use all CPU cores)
BB_NUMBER_THREADS = "8"
PARALLEL_MAKE = "-j 8"

# Optimize build directory (use fast storage)
TMPDIR = "/path/to/fast/ssd/tmp"

# Enable memory optimization
BB_ENV_PASSTHROUGH_ADDITIONS = "MAKEFLAGS"

# Use package feeds for rapid application development
INHERIT += "own-mirrors"
SOURCE_MIRROR_URL = "file:///path/to/shared/sources/"
SSTATE_MIRROR_URL = "file:///path/to/shared/sstate-cache/"
```

### 2. Shared State Cache (sstate) Best Practices

```bash
# Keep sstate-cache on fast storage
# Use network share for team development
SSTATE_MIRROR ?= "file:///path/to/network/sstate-cache/PATH;downloads=yes"

# Preserve sstate between builds
# Don't clean sstate-cache unnecessarily

# Share sstate across projects
SSTATE_DIR = "/shared/sstate-cache"
```

### 3. Disk Space Management

```bash
# Regular cleanup script (save in clean-yocto.sh)
#!/bin/bash
echo "Cleaning Yocto build..."
# Remove failed build work directories
find tmp/work/* -maxdepth 1 -name "temp" -type d -exec rm -rf {} + 2>/dev/null

# Keep downloads, keep sstate, clean failed builds only
du -sh tmp/ downloads/ sstate-cache/

# Optional: Remove old source archives (risky)
# find downloads/ -type f -mtime +30 -delete
```

### Development Workflow Cheatsheet

#### Rapid Application Development Cycle

```bash
# 1. Initial build
bitbake core-image-minimal

# 2. Develop your application
cd /path/to/your/app

# 3. Build just your recipe
bitbake my-custom-app

# 4. Test in QEMU or on hardware
bitbake -c populate_sdk core-image-minimal
# or
bitbake core-image-minimal -c rootfs

# 5. Repeat steps 2-4 rapidly
```

#### Debugging Common Issues

```bash
# Recipe fails to build
bitbake -c cleanall <failing-recipe>
bitbake -c devshell <failing-recipe>  # Then run commands manually

# Dependency issues
bitbake -g <target>
cat pn-depends.dot | dot -Tpng > deps.png

# License checksum error
bitbake -c cleansrc <recipe>  # Then rebuild

# Patch fails to apply
bitbake -c cleanall <recipe>
# Check patch in tmp/work/.../git/ for issues
```

#### Useful One-Liners

```bash
# Find what recipe provides a file
find tmp/work/*/*/*/image/ -name "filename" 2>/dev/null

# Check recipe variables
bitbake -e <recipe> | grep ^S=  # Source directory
bitbake -e <recipe> | grep ^WORKDIR=  # Work directory
bitbake -e <recipe> | grep ^FILES_  # Package files mapping

# Build history analysis
cat buildhistory/package/*/latest/<package>/files

# Check package contents
oe-pkgdata-util list-pkgs | grep <pattern>
oe-pkgdata-util list-pkg-files <package>
```

#### Quick Reference: File Locations

```bash
# Build outputs
tmp/deploy/images/<machine>/  # Final images
tmp/deploy/ipk/  # Individual packages
tmp/deploy/sdk/  # SDK installer

# Build working directories
tmp/work/<arch>/<recipe>/<version>/  # Recipe build area
tmp/work/<arch>/<recipe>/<version>/temp/  # Log files
tmp/work/<arch>/<recipe>/<version>/image/  # Installed files

# Caches
tmp/sstate-control/  # Shared state management
tmp/stamps/  # Task stamps
downloads/  # Downloaded sources
```

**Pro Tip:** Always keep downloads/ and sstate-cache/ between builds when possible. These are your biggest time-savers for incremental builds!
