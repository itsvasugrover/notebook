---
title: Best Practices
createTime: 2025/12/21 22:21:19
permalink: /kb/embedded/yocto/best-practices/
---

# Best Practices for Fast Builds

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
