---
title: Append Files (.bbappend)
createTime: 2025/12/21 22:21:19
permalink: /kb/embedded/yocto/append-files/
---

# Append Files (.bbappend)

A .bbappend file is used to extend or modify an existing recipe from another layer, without having to copy and modify the original .bb file (which is considered bad practice).

Purpose: Customization and Patches. You use a .bbappend to apply a patch, add a file, change dependencies, or append a task to a recipe that you don't control (e.g., from oe-core or a BSP layer).

Naming Convention: The .bbappend file must have exactly the same name as the original .bb file.

- Original Recipe: meta-oe/recipes-core/busybox/busybox_1.36.1.bb
- Your Append: meta-mylayer/recipes-core/busybox/busybox\_%.bbappend (The % is a wildcard for the version)

Common Uses in a .bbappend:

- FILESEXTRAPATHS:prepend: Add new directories to the search path for files (like patches).
- SRC_URI += "file://my-patch.patch": Add a custom patch.
- do_configure:append(): Add extra commands to the end of the configure task.
- `RDEPENDS:${PN} += "my-extra-package"`: Add a runtime dependency.

Example (busybox\_%.bbappend):

```bash
# Add a custom patch
SRC_URI += "file://enable-my-feature.patch"

# Add an extra configuration file
FILESEXTRAPATHS:prepend := "${THISDIR}/files:"
SRC_URI += "file://my-config.cfg"

# Append a command to the install task
do_install:append() {
    install -m 0644 ${WORKDIR}/my-config.cfg ${D}${sysconfdir}/my-config.cfg
}
```

## Key Points: Append Files (.bbappend)

- Used to modify or extend an existing recipe from another layer.
- Must have the same name as the original .bb file.
- The primary mechanism for applying patches and making local customizations.
- Never copy a .bb file to change it; use a .bbappend instead.

## Summary: The Hierarchy of Customization

When BitBake parses a recipe, it combines all these elements in a specific order:

- Base Configuration (bitbake.conf) sets the global environment.
- Layers add their metadata. Higher priority layers override lower ones.
- The original Recipe (.bb) is parsed.
- Any Append Files (.bbappend) from other layers are applied on top.
- The Classes (.bbclass) that the recipe inherits inject their shared logic.

This structure provides an incredibly powerful and maintainable way to build complex, custom embedded Linux systems from a vast collection of open-source software.
