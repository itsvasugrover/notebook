---
title: Features
createTime: 2025/12/21 22:21:19
permalink: /kb/embedded/yocto/features/
---

# Understanding about the MACHINE_FEATURES and DISTRO_FEATURES in the Yocto Project

These are key configuration variables that control what components are included in the build.

| Aspect           | MACHINE_FEATURES                                     | DISTRO_FEATURES                                |
| ---------------- | ---------------------------------------------------- | ---------------------------------------------- |
| Purpose          | Hardware-specific capabilities.                      | Software/System-level capabilities.            |
| Scope            | Tied to the BSP/Machine (MACHINE conf).              | Tied to the Distribution Policy (DISTRO conf). |
| Examples         | alsa, bluetooth, wifi, screen, touchscreen, keyboard | x11, wayland, systemd, sysvinit, opengl, pam   |
| Usage in Recipes | Check with: contains('MACHINE_FEATURES', 'wifi')     | Check with: contains('DISTRO_FEATURES', 'x11') |

Example in a Recipe:

```bb
# This PACKAGECONFIG block for a library might enable X11 support only if the distro has it
PACKAGECONFIG ??= "${@bb.utils.filter('DISTRO_FEATURES', 'x11', d)}"

# A recipe might install a Bluetooth daemon only if the machine supports it
do_install:append() {
    if bb.utils.contains('MACHINE_FEATURES', 'bluetooth', true, false, d); then
        install -m 0755 ${S}/bluetooth-daemon ${D}${sbindir}
    fi
}
```

### Key Points: FEATURES

- MACHINE_FEATURES = "What my hardware can do" (physical capabilities).
- DISTRO_FEATURES = "What my software system will support" (system services, UI).
- Recipes use bb.utils.contains() to conditionally include features based on these variables.
