---
title: Packagegroups
createTime: 2025/12/21 22:21:19
permalink: /kb/embedded/yocto/packagegroups/
---

# What is Packagegroup in the Yocto Project?

A packagegroup is a special type of recipe whose sole purpose is to group together other packages to simplify image creation.

Why use it? Instead of listing dozens of individual packages in your IMAGE_INSTALL variable, you create a packagegroup (e.g., packagegroup-my-iot-core) that includes them all. You then only add packagegroup-my-iot-core to IMAGE_INSTALL.

Structure of a Packagegroup Recipe (packagegroup-my-demo.bb):

```bash
SUMMARY = "My demo package group"
LICENSE = "MIT"

# Inherit the packagegroup class - this is mandatory!
inherit packagegroup

# Define the packages this group will pull in
RDEPENDS:${PN} = " \
    hello \
    htop \
    nginx \
    my-custom-app \
"

# Optional: Conditionally include packages
RDEPENDS:${PN}:append = " ${@bb.utils.contains('DISTRO_FEATURES', 'x11', 'firefox', '', d)}"
```

### Key Points: Packagegroup

- A logical collection of packages defined in a single recipe.
- Must inherit packagegroup.
- Uses `RDEPENDS:${PN}` to list all the packages to be included.
- Simplifies conf/local.conf and image recipe files by reducing clutter.
