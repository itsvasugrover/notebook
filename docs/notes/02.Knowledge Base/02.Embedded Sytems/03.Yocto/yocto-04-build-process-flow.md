---
title: Build Process Flow
createTime: 2025/12/21 22:21:19
permalink: /kb/embedded/yocto/build-process-flow/
---

# Build Process Flow

## End-to-End Pipeline

Tracing `bitbake core-image-minimal` from invocation to flashable image:

```
bitbake core-image-minimal
        │
        ├── PHASE 1: Parse conf/
        │         ├── bitbake.conf       (default vars, paths, tool flags)
        │         ├── layer.conf files   (each layer registers its BBFILES)
        │         └── local.conf         (MACHINE, DISTRO, user overrides)
        │
        ├── PHASE 2: Parse all .bb + .bbappend + .bbclass files
        │         └── Build per-recipe DataStore for every recipe in BBFILES
        │
        ├── PHASE 3: Resolve target "core-image-minimal"
        │         └── IMAGE_INSTALL → package list
        │              └── DEPENDS → build-time dep tree per package
        │                  └── RDEPENDS → runtime dep tree
        │
        ├── PHASE 4: Task Graph Construction
        │         └── For every recipe × task combination:
        │              do_fetch → do_unpack → do_patch → do_configure
        │              → do_compile → do_install → do_package
        │              → do_package_write_* → do_rootfs → do_image
        │
        ├── PHASE 5: Hash Computation + sstate Lookup
        │         ├── Cache hit  → do_setscene (restore in seconds)
        │         └── Cache miss → execute task, populate sstate-cache
        │
        └── PHASE 6: Assemble Output
                  ├── do_rootfs   → install packages into staged rootfs
                  ├── do_image    → write IMAGE_FSTYPES (ext4, squashfs, wic)
                  └── Output: tmp/deploy/images/<MACHINE>/
```

## Per-Recipe Task Pipeline

For a typical C/C++ recipe (e.g., `bash_5.2.bb`):

| Task | What It Does | Key Variables |
|------|-------------|---------------|
| `do_fetch` | Downloads source using the fetcher matching SRC_URI scheme | `SRC_URI`, `SRCREV`, `DL_DIR` |
| `do_unpack` | Extracts archive or checks out git repo into `${WORKDIR}` | `S` (source dir) |
| `do_patch` | Applies `.patch` files from SRC_URI in order | `PATCHTOOL` |
| `do_configure` | Runs `./configure`, `cmake`, `meson`, etc. | `EXTRA_OECONF`, `EXTRA_OECMAKE` |
| `do_compile` | Compiles the source | `EXTRA_OEMAKE`, `PARALLEL_MAKE` |
| `do_install` | Copies artifacts into `${D}` (fake root staging dir) | `D`, `bindir`, `libdir` |
| `do_package` | Splits `${D}` into sub-packages (main, -dev, -dbg, -doc) | `PACKAGES`, `FILES` |
| `do_package_write_rpm` | Writes `.rpm` files to `tmp/deploy/rpm/` | `PACKAGE_CLASSES` |

## Key Directory Variables

| Variable | Typical Value | Purpose |
|----------|--------------|----------|
| `WORKDIR` | `tmp/work/<tuple>/<pn>/<pv>-<pr>/` | Recipe scratchpad; all build work happens here |
| `S` | `${WORKDIR}/<pn>-<pv>/` | Extracted source tree |
| `B` | `${S}` | Build directory (separate for out-of-tree builds) |
| `D` | `${WORKDIR}/image` | Destination / fake root filesystem |
| `STAGING_DIR_TARGET` | `tmp/sysroots/<machine>/` | Headers/libs from DEPENDS |
| `DEPLOY_DIR_IMAGE` | `tmp/deploy/images/<machine>/` | Final output images |

## do_rootfs and do_image

These tasks run in the image recipe after all packages are built:

**`do_rootfs`**: Installs packages listed in `IMAGE_INSTALL` into a staging rootfs using the target package manager. Runs `ROOTFS_POSTPROCESS_COMMAND` hooks (locale generation, ldconfig, etc.). Produces the populated rootfs directory.

**`do_image`**: For each filesystem type in `IMAGE_FSTYPES`, invokes the corresponding class:

```bash
IMAGE_FSTYPES = "ext4 squashfs wic"
```

- `ext4` → calls `mkfs.ext4` on the rootfs
- `squashfs` → calls `mksquashfs`
- `wic` → calls `wic` with a `.wks` kickstart file to assemble a partitioned disk image (boot + kernel + rootfs in correct layout for the board)

## WIC / WKS Partition Layout

For boards that need a specific partition layout (e.g., SD card with FAT boot + ext4 rootfs):

```bash
# Example: my-board-sdcard.wks
part /boot --source bootimg-partition --ondisk mmcblk0 --fstype=vfat \
     --label boot --active --align 4 --size 64
part /     --source rootfs --ondisk mmcblk0 --fstype=ext4 \
     --label root --align 4 --size 2048
```

The WKS file is referenced via `WKS_FILE = "my-board-sdcard.wks"` in the machine conf. WIC replaces the older `IMAGE_FSTYPES = "sdcard"` approach and is the current standard for producing boot-ready images.

## Multiconfig Builds

For CI pipelines that must produce images for multiple machines:

```bash
# conf/multiconfig/raspberrypi4.conf
MACHINE = "raspberrypi4-64"

# conf/multiconfig/qemux86.conf
MACHINE = "qemux86-64"
```

```bash
# Build both targets in one invocation, sharing sstate-cache
bitbake mc:raspberrypi4:core-image-minimal mc:qemux86:core-image-minimal
```

## Examining the Task Graph

```bash
# Generate task-depends.dot and pn-buildlist
bitbake -g core-image-minimal

# Visualise
dot -Tsvg task-depends.dot -o task-deps.svg

# Check which packages will be included
cat pn-buildlist
```

The `task-depends.dot` file is the authoritative answer to "what will BitBake build and in what order" for a given target.
