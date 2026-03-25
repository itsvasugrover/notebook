---
title: Classes (.bbclass)
createTime: 2025/12/21 22:21:19
permalink: /kb/embedded/yocto/classes/
---

# Classes (.bbclass)

## What Classes Do

A `.bbclass` file is a reusable module of BitBake code. When a recipe calls `inherit cmake`, it pulls in the entire text of `cmake.bbclass` as if it had been written at the bottom of the recipe — providing pre-built `do_configure`, `do_compile`, and `do_install` task definitions tuned for CMake projects.

Classes solve the "2000 recipes all need the same 50-line configure task" problem. They can:
- Define or override task functions
- Add new tasks with `addtask`
- Set default variable values
- Register BitBake event handlers
- Export functions to shell

## EXPORT_FUNCTIONS

When a class defines a task that a recipe might want to override *while still calling the class version*, `EXPORT_FUNCTIONS` is used:

```bash
# In cmake.bbclass:
cmake_do_configure() {
    cmake -DCMAKE_TOOLCHAIN_FILE=... ${EXTRA_OECMAKE} ${S}
}
EXPORT_FUNCTIONS do_configure
```

After `EXPORT_FUNCTIONS do_configure`, the class version is stored as `cmake_do_configure`. A recipe can override `do_configure` and still call `cmake_do_configure`:

```bash
# In a recipe:
inherit cmake

do_configure:prepend() {
    export MY_ENV_VAR="value"   # runs before cmake's do_configure
}
# cmake_do_configure still runs; :prepend just adds a preamble
```

## Build System Classes

| Class | `inherit` Keyword | What it provides |
|-------|------------------|------------------|
| `autotools` | `autotools` | `./configure && make && make install DESTDIR=${D}` |
| `cmake` | `cmake` | `cmake -B build && cmake --build && cmake --install` |
| `meson` | `meson` | `meson setup && ninja && ninja install` |
| `cargo` | `cargo` | Rust crates via `cargo build` |
| `go` | `go` | Go modules |
| `setuptools3` | `setuptools3` | Python packages via `setup.py` |
| `python3-poetry-core` | `python3-poetry-core` | Python packages with Poetry |

## Packaging and Integration Classes

| Class | Purpose |
|-------|---------|
| `pkgconfig` | Generates `.pc` files; sets `PKG_CONFIG_PATH` for DEPENDS resolution |
| `update-rc.d` | Installs SysV init scripts into `/etc/rcX.d/` |
| `systemd` | Installs and enables systemd units; uses `SYSTEMD_SERVICE` variable |
| `useradd` | Creates user accounts on target via `USERADD_PARAM` |
| `mime` | Registers MIME types with update-mime-database |
| `gettext` | Handles i18n and locale file packaging |

## Image Assembly Classes

| Class | Purpose |
|-------|---------|
| `image` | Core rootfs assembly: `do_rootfs`, `do_image` |
| `core-image` | Extends `image`; adds `IMAGE_FEATURES` → package group mapping |
| `image-buildinfo` | Writes build metadata (date, machine, layers) into the rootfs |
| `populate_sdk` | Generates standard SDK (`.sh` installer) |
| `populate_sdk_ext` | Generates extensible SDK (eSDK) with embedded `devtool` |

## Utility Classes

| Class | Purpose |
|-------|---------|
| `native` | Rebase recipe to build for the host machine |
| `nativesdk` | Rebase recipe to build inside the SDK environment |
| `cross` | Used internally by cross-compiler recipes (gcc, binutils) |
| `devshell` | Provides `do_devshell` task — opens shell with recipe's full build env |
| `externalsrc` | Build from a local directory instead of fetching (`EXTERNALSRC`) |
| `cve-check` | Scans recipe CPE identifiers against the NVD CVE database |
| `buildstats` | Records per-task build time statistics |

## `image.bbclass` Internals

```python
# (simplified from meta/classes-recipe/image.bbclass)
python do_rootfs() {
    # 1. Create an empty rootfs staging directory
    # 2. Install all packages in IMAGE_INSTALL using the selected package manager
    #    (rpm/ipk/deb depending on PACKAGE_CLASSES)
    # 3. Run ROOTFS_POSTPROCESS_COMMAND hooks
    #    (locale generation, ldconfig, runinterp, etc.)
    # 4. Remove dev files if "dev-pkgs" not in IMAGE_FEATURES
    # 5. Run IMAGE_POSTPROCESS_COMMAND hooks
}

python do_image() {
    # For each type in IMAGE_FSTYPES:
    #   Call the corresponding image type handler
    #   e.g., image_types_wic.bbclass for "wic"
    #         image_types.bbclass for "ext4", "squashfs", "tar.gz"
}
```

## IMAGE_FEATURES Reference

`IMAGE_FEATURES` is processed by `core-image.bbclass` to translate feature names into package group additions:

```bash
IMAGE_FEATURES += "ssh-server-openssh debug-tweaks tools-debug"
```

| Feature | What it installs | Use case |
|---------|-----------------|----------|
| `ssh-server-openssh` | OpenSSH sshd | Remote login |
| `ssh-server-dropbear` | Dropbear SSH | Smaller SSH footprint |
| `debug-tweaks` | Empty root password, allowed passwordless sudo | Development only |
| `tools-debug` | gdb, strace, valgrind | Runtime debugging |
| `tools-sdk` | gcc, make, pkg-config on target | On-device compilation |
| `dev-pkgs` | All `-dev` packages for installed libs | Linking on target |
| `read-only-rootfs` | Configures rootfs for read-only mount | Factory/production |
| `package-management` | Includes package manager (rpm/opkg/dpkg) | OTA updates |

## Writing a Custom Class

```bash
# meta-myproduct/classes/deploy-strip.bbclass

# Append to do_install for every recipe that inherits this class
do_install:append() {
    # Strip debug symbols from shared libraries to reduce image size
    find ${D} -name "*.so*" -type f \
        -exec ${STRIP} --strip-unneeded {} \;
}

# Define and register a new task
python do_validate_licenses() {
    lic = d.getVar('LICENSE')
    if 'GPL-3' in lic:
        bb.warn("Recipe %s uses GPL-3: verify license policy" % d.getVar('PN'))
}
addtask validate_licenses after do_configure before do_compile
```
