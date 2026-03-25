---
title: Patching Workflow
createTime: 2026/03/23 00:00:00
permalink: /kb/embedded/edk2/patching/
---

# EDK2 Patching Workflow

## Why Patching Matters in EDK2

EDK2 platforms are rarely built from upstream `edk2` HEAD alone. Vendor platforms and product firmware typically maintain a **patch series** on top of a pinned upstream commit. This is because:

1. Upstream `edk2` evolves independently of product release schedules
2. Vendor-specific hardware quirks require changes to generic modules
3. Security CVEs require backporting fixes without pulling in unrelated upstream changes
4. Architectural review takes time; features needed for a product ship window exist as patches before upstream acceptance

Understanding how to create, maintain, and update patch series is a core EDK2 engineering skill.

---

## EDK2 Repository Setup for Patching

EDK2 uses git submodules extensively. At minimum:

```bash
# Clone with submodules
git clone --recurse-submodules https://github.com/tianocore/edk2.git
cd edk2

# Or initialize submodules in an existing clone
git submodule update --init --recursive

# Critical submodules:
# - CryptoPkg/Library/OpensslLib/openssl   (OpenSSL for CryptoPkg)
# - MdeModulePkg/Library/BrotliCustomDecompressLib/brotli
# - BaseTools/Source/C/BrotliCompress/brotli
# - UnitTestFrameworkPkg/Library/CmockaLib/cmocka
# - RedfishPkg/ dependencies (multiple)
```

### Working with Platform Repos

A typical platform repository structure:

```
my-platform-firmware/
├── edk2/              ← EDK2 upstream (git submodule, pinned to a commit)
├── edk2-platforms/    ← Community platform packages (git submodule)
├── edk2-non-osi/      ← Non-OSI blobs (git submodule)
├── patches/
│   ├── edk2/          ← Patch series for edk2 submodule
│   │   ├── 0001-MdePkg-Fix-PcdLib-null-pointer.patch
│   │   ├── 0002-ArmPkg-Add-MySoC-GIC-quirk.patch
│   │   └── series     ← (optional quilt series file)
│   └── edk2-platforms/
│       └── 0001-Add-MySoC-board-support.patch
├── MySoCPkg/          ← Proprietary platform package (in-tree)
└── Makefile           ← Top-level build orchestration
```

---

## Creating Patches with git format-patch

### Single Patch

After making changes to edk2/ and committing:

```bash
cd edk2/

# Make your change
vim MdeModulePkg/Universal/Variable/RuntimeDxe/Variable.c

# Commit with EDK2 code review style
git add MdeModulePkg/Universal/Variable/RuntimeDxe/Variable.c
git commit -s -m "MdeModulePkg/Variable: Fix integer overflow in GetVariable

The DataSize parameter is UINTN but the internal calculation
DataSize + sizeof(Header) can overflow on 32-bit builds.

Add overflow check before the addition.

Cc: Someone Reviewer <someone@example.com>
Reviewed-by: (pending)
Signed-off-by: Your Name <you@company.com>"

# Create a patch file
git format-patch -1 HEAD
# Outputs: 0001-MdeModulePkg-Variable-Fix-integer-overflow-in-GetVar.patch
```

### Patch Series (Multiple Commits)

```bash
# Format a range of commits as a numbered series
git format-patch origin/main..HEAD
# Outputs:
# 0001-MdePkg-Add-new-PCD-for-MySoC.patch
# 0002-ArmPkg-Support-MySoC-GIC-topology.patch
# 0003-MySoCPkg-Add-platform-memory-map.patch

# With a cover letter (explains the series)
git format-patch --cover-letter origin/main..HEAD
# Also outputs: 0000-cover-letter.patch
```

### Patch File Format

The `.patch` file produced is RFC 2822 mail format:

```
From 3a1bc2d4e5f6 Mon Sep 17 00:00:00 2001
From: Your Name <you@company.com>
Date: Mon, 23 Mar 2026 10:00:00 +0000
Subject: [PATCH 1/3] MdePkg: Fix PcdLib null pointer dereference

Details of the change...

Cc: reviewer@tianocore.org
Signed-off-by: Your Name <you@company.com>
---
 MdePkg/Library/BasePcdLib/BasePcdLib.c | 5 +++--
 1 file changed, 3 insertions(+), 2 deletions(-)

diff --git a/MdePkg/Library/BasePcdLib/BasePcdLib.c b/MdePkg/Library/BasePcdLib/BasePcdLib.c
index abc123..def456 100644
--- a/MdePkg/Library/BasePcdLib/BasePcdLib.c
+++ b/MdePkg/Library/BasePcdLib/BasePcdLib.c
@@ -45,7 +45,8 @@ LibPcdGet8 (IN UINTN TokenNumber)
```

---

## Applying Patches with git am

```bash
# Apply a single patch
git am -3 /path/to/patches/edk2/0001-MdePkg-Fix-PcdLib-null-pointer.patch

# Apply an entire series
git am -3 /path/to/patches/edk2/*.patch

# Apply from stdin (from email)
git am -3 < received-patch.patch

# -3 flag: 3-way merge; if the patch doesn't apply cleanly, attempt a merge
# Without -3: hard fail on context mismatch
```

### Handling Patch Conflicts

When `git am` fails due to a context mismatch (common when rebasing patches onto a newer EDK2 base):

```bash
# git am stops with an error like:
# error: patch failed: MdePkg/Library/BasePcdLib/BasePcdLib.c:43
# Patch failed at 0001-MdePkg-Fix-PcdLib-null-pointer.patch

# Option 1: Apply with fuzz factor
git am --abort
git apply --reject --whitespace=fix 0001-MdePkg-Fix-PcdLib-null-pointer.patch
# Manually resolve .rej files, then:
git add MdePkg/Library/BasePcdLib/BasePcdLib.c
git am --continue

# Option 2: Use git apply for inspection first
git apply --check 0001-MdePkg-Fix-PcdLib-null-pointer.patch
# Check which hunks fail

# Option 3: Abort and manually re-create the patch
git am --abort
# Make the change manually, commit, re-format-patch
```

---

## Maintaining a Patch Series with Quilt

`quilt` is a classical patch management tool that tracks a stack of patches and their application state. It is especially useful for vendor firmware trees that must track many patches over long periods.

### Initial Setup

```bash
# Install quilt
sudo apt-get install quilt

# Configure quilt to work with git-tracked files
cat > ~/.quiltrc << 'EOF'
QUILT_PATCHES=patches
QUILT_DIFF_ARGS="--no-timestamps --no-index -p ab --color=auto"
QUILT_REFRESH_ARGS="--no-timestamps --no-index -p ab"
QUILT_PATCH_OPTS="--unified"
EOF

cd edk2/
export QUILT_PATCHES=../patches/edk2
```

### Quilt Workflow

```bash
# See all patches in the series
quilt series

# Apply all patches in the series
quilt push -a

# Apply one patch at a time
quilt push

# Pop (unapply) patches
quilt pop
quilt pop -a   # unapply all

# Create a new patch
quilt new 0004-ArmPkg-Fix-timer-interrupt-routing.patch
quilt add ArmPkg/Drivers/TimerDxe/Timer.c   # register file with this patch
# Edit the file
vim ArmPkg/Drivers/TimerDxe/Timer.c
# Refresh (update) the patch with current changes
quilt refresh

# Edit the top patch's metadata (commit message analog)
quilt header -e
```

### Updating Patches for a New EDK2 Base

When upgrading the pinned EDK2 commit:

```bash
# 1. Save the current patch series
quilt pop -a   # unapply all patches from current base

# 2. Update the submodule to the new commit
cd ..
git -C edk2 fetch origin
git -C edk2 checkout <new-commit-sha>
cd edk2

# 3. Re-apply patches one at a time, fixing conflicts
quilt push         # apply first patch
# If it fails:
quilt push --fuzz=2  # looser context matching
# Manually fix any rejections, then:
quilt refresh      # update the patch with the fixed hunks
quilt push         # next patch
```

---

## EDK2 Upstream Contribution Process

If a patch should be merged upstream (not just maintained as a local fix), EDK2 uses an email-based code review process via mailing lists.

### Step 1: Identify the Correct Mailing List

Each EDK2 package has a maintainer and mailing list. Check `Maintainers.txt` at the repo root:

```
P: MdePkg
M: Michael D Kinney <michael.d.kinney@intel.com>
M: Liming Gao <gaoliming@byosoft.com.cn>
R: Zhiguang Liu <zhiguang.liu@intel.com>
F: MdePkg/

P: ArmPkg
M: Ard Biesheuvel <ardb+tianocore@kernel.org>
M: Leif Lindholm <quic_llindhol@quicinc.com>
F: ArmPkg/
```

### Step 2: Check Coding Standards

EDK2 enforces strict code style. Run the checker before submitting:

```bash
# ECC (EDK2 Coding Conventions Checker)
python3 BaseTools/Source/Python/Ecc/Ecc.py -c MdePkg -s

# OR use the Ecc plugin via Stuart
stuart_ci_build -c .pytool/CISettings.py --ignore-ci-skip -p MdePkg

# Check copyright header
# Every new file must have:
# SPDX-License-Identifier: BSD-2-Clause-Patent
# and an EDK2 copyright header
```

### Step 3: Send the Patch via Email

```bash
# Configure git to use your email
git config --global sendemail.smtpserver smtp.example.com
git config --global sendemail.smtpuser you@example.com

# Send to maintainer and mailing list
git send-email \
    --to="devel@edk2.groups.io" \
    --cc="michael.d.kinney@intel.com" \
    0001-MdePkg-Fix-integer-overflow.patch

# For a series:
git send-email \
    --to="devel@edk2.groups.io" \
    --cc="ardb+tianocore@kernel.org" \
    --annotate \
    0000-cover-letter.patch 0001-*.patch 0002-*.patch
```

### Step 4: Version a Revised Patch

After review feedback, revise and re-send with a version tag:

```bash
# Re-format with version number
git format-patch -v2 origin/main..HEAD

# Outputs: v2-0001-MdePkg-Fix-integer-overflow.patch
# Add changelog in the cover letter and below the --- line in individual patches:
```

```
---
v2:
 - Fix typo in comment (Reviewer Name)
 - Add ASSERT for NULL check (Reviewer Name)
 - Remove redundant blank line

 MdePkg/Library/BasePcdLib/BasePcdLib.c | 5 +++--
 1 file changed, 3 insertions(+), 2 deletions(-)
```

---

## Out-of-Tree Vendor Patches: Best Practices

### Patch Naming Convention

```
0001-<Package>-<short-description>.patch
     │         └── Lowercase, hyphens, imperative mood ("Fix", "Add", "Remove")
     └── Prefix number for ordering
```

### Tagging Patches for Maintainability

Add a tag in the commit message to track why a patch exists:

```
[VENDOR] MdePkg: Disable feature X for MySoC power saving
[SECURITY-CVE-2024-1234] SecurityPkg: Backport fix for buffer overflow
[BACKPORT-edk2-stable202408] NetworkPkg: TLS 1.3 session ticket
[WORKAROUND] ArmPkg: Disable MMIO cache on rev < 2.0 silicon
```

### Generating a human-readable patch status

```bash
# Show which patches are applied and their current status
quilt applied
quilt series --complete

# Or with git: list all commits since the base
git log --oneline <base-commit>..HEAD
```

### Testing Before Submitting Upstream

```bash
# Build test (compile only, no runtime test)
build -p MdePkg/MdePkg.dsc -a X64 -a AARCH64 -t GCC5 -b DEBUG

# Run EDK2 unit tests (if applicable)
build -p UnitTestFrameworkPkg/Test/UnitTestFrameworkPkgHostTest.dsc -a X64 -t GCC5
# Run the host-side tests
Build/UnitTestFrameworkPkgHostTest/DEBUG_GCC5/X64/SampleUnitTestHost
```
