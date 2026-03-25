---
title: Features
createTime: 2025/12/21 22:21:19
permalink: /kb/embedded/yocto/features/
---

# Features in the Yocto Project

## The Three Feature Layers

Yocto has three related but distinct feature systems that work at different scopes:

```
MACHINE_FEATURES    ← what the hardware is capable of (physical)
DISTRO_FEATURES     ← what the software system will support (policy)
IMAGE_FEATURES      ← what this specific image build will include (content)
```

## MACHINE_FEATURES — Hardware Capabilities

Set in `conf/machine/my-board.conf`. Describes physical hardware capabilities. Recipes check this to decide whether to compile and install hardware-specific components.

```bash
MACHINE_FEATURES = "usbhost usbgadget wifi bluetooth alsa touchscreen screen keyboard"
```

| Feature | Hardware it represents |
|---------|------------------------|
| `usbhost` | USB host controller |
| `usbgadget` | USB device/gadget controller |
| `wifi` | 802.11 wireless interface |
| `bluetooth` | Bluetooth radio |
| `alsa` | PCM audio hardware |
| `screen` | Display output |
| `touchscreen` | Touchscreen input |
| `keyboard` | Hardware keyboard |
| `rtc` | Real-time clock |
| `pci` | PCI bus |
| `vfat` | Hardware needs FAT filesystem support (SD card boot) |

## DISTRO_FEATURES — Distribution Policy

Set in `conf/distro/my-distro.conf` or `local.conf`. Controls which system-level software stacks are enabled. Recipes use this to decide whether to build optional support.

```bash
DISTRO_FEATURES = "acl bluetooth ext2 ipv4 ipv6 largefile \
                   usbhost wifi nfs x11 wayland opengl pam systemd"
```

| Feature | What enabling it does |
|---------|-----------------------|
| `systemd` | Use systemd as init; enables systemd integration in all recipes |
| `sysvinit` | Use SysV init |
| `x11` | Enable X11 display server support in packages |
| `wayland` | Enable Wayland compositor support |
| `opengl` | Enable OpenGL/Mesa support |
| `pam` | Enable PAM authentication framework |
| `seccomp` | Enable seccomp syscall filtering |
| `ipv4` / `ipv6` | IP networking stack support |
| `nfs` | NFS filesystem client support |

**Note**: Adding `wayland` to `DISTRO_FEATURES` does not automatically install a Wayland compositor in your image — it enables Wayland *support* to be compiled into packages like Qt, GTK, weston. You still need to add those packages to `IMAGE_INSTALL`.

## IMAGE_FEATURES — Image Content

Set in an image recipe or `local.conf`. Translates feature names into package group inclusions handled by `core-image.bbclass`. This is the highest-level API for controlling what goes into an image.

```bash
# In your image recipe or local.conf:
IMAGE_FEATURES += "ssh-server-openssh debug-tweaks tools-debug"
```

| Feature | Packages installed | Use case |
|---------|-------------------|----------|
| `ssh-server-openssh` | `openssh-sshd` | Remote login |
| `ssh-server-dropbear` | `dropbear` | Smaller SSH |
| `debug-tweaks` | Empty root password, `/etc/securetty` changes | Dev/QA |
| `tools-debug` | `gdb strace ltrace valgrind` | Runtime debugging |
| `tools-sdk` | `gcc make pkg-config binutils` | On-device builds |
| `tools-profile` | `perf oprofile lttng-tools` | Performance profiling |
| `dev-pkgs` | All `-dev` packages for installed libs | On-device linking |
| `read-only-rootfs` | Configures init scripts for read-only `/` | Production |
| `package-management` | `opkg` / `rpm` / `dpkg` on target | OTA updates |
| `nfs-server` | `nfs-utils` | NFS export for dev |

## PACKAGECONFIG — Per-Recipe Feature Flags

`PACKAGECONFIG` is the mechanism inside individual recipes for enabling or disabling optional build-time features that pull in optional dependencies.

```bash
# How PACKAGECONFIG is defined inside a recipe (e.g., curl_8.0.bb):
# Format: PACKAGECONFIG[flag] = "if-enabled-CFLAGS, if-disabled-CFLAGS, DEPENDS, RDEPENDS"
PACKAGECONFIG[ssl]     = "--with-openssl,  --without-openssl,  openssl"
PACKAGECONFIG[gnutls]  = "--with-gnutls,   --without-gnutls,   gnutls"
PACKAGECONFIG[zlib]    = "--with-zlib,     --without-zlib,     zlib"
PACKAGECONFIG[brotli]  = "--with-brotli,   --without-brotli,   brotli"

# The default set of enabled flags:
PACKAGECONFIG ??= "ssl zlib"
```

To override from a `.bbappend` or `local.conf`:

```bash
# Enable gnutls instead of openssl for curl:
PACKAGECONFIG:pn-curl = "gnutls zlib"

# Or append a flag (add brotli support without changing defaults):
PACKAGECONFIG:append:pn-curl = " brotli"
```

## Checking Features in Recipes

```bash
# Conditional from DISTRO_FEATURES:
PACKAGECONFIG:append = " ${@bb.utils.filter('DISTRO_FEATURES', 'x11 wayland', d)}"

# Conditional install from MACHINE_FEATURES:
do_install:append() {
    if ${@bb.utils.contains('MACHINE_FEATURES', 'bluetooth', 'true', 'false', d)}; then
        install -m 0755 ${S}/bt-daemon ${D}${sbindir}/
    fi
}

# Ternary value based on feature:
MY_BACKEND = "${@bb.utils.contains('DISTRO_FEATURES', 'wayland', 'wayland', 'x11', d)}"
```
