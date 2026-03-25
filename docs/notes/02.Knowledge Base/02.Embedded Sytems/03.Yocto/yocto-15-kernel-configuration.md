---
title: Kernel Configuration
createTime: 2025/12/21 22:21:19
permalink: /kb/embedded/yocto/kernel-configuration/
---

# Kernel Configuration in Yocto

## The Core Principle

You should never edit the kernel source or `.config` file directly. Every manual edit to `.config` is lost on the next `bitbake -c clean`. Yocto provides a reproducible, version-controlled workflow.

## How linux-yocto Works

`linux-yocto` is Yocto's reference kernel recipe. It uses a **two-branch git model** to separate kernel source from configuration:

```
linux-yocto git repository
├── standard branch (v6.6/standard/base)
│   └── actual kernel C source code
└── meta branch (v6.6/standard/base + meta)
    └── .scc and .cfg files (kernel metadata/config fragments)
        └── KMACHINE definitions
        └── BSP-specific config fragments
        └── feature fragments
```

`KMACHINE` maps the Yocto `MACHINE` name to the kernel's internal BSP name:

```bash
# In a machine.conf:
KMACHINE:my-board = "my-board-kmachine"  # matches the entry in the kernel meta branch
```

## Method 1: Config Fragments (Recommended)

Config fragments are small `.cfg` files containing only the delta from the base `defconfig`. This is the correct, maintainable approach.

```bash
# Step 1: Open the interactive kernel config menu
bitbake -c menuconfig virtual/kernel

# Step 2: Make your changes in the TUI (e.g., enable CONFIG_USB_CDC_ACM)

# Step 3: Generate the fragment (diff vs base config)
bitbake -c diffconfig virtual/kernel
# Output: .../linux-yocto/<ver>/defconfig (contains only your changes)
# Example content of the fragment:
#   CONFIG_USB_CDC_ACM=y
#   CONFIG_USB_SERIAL=m

# Step 4: Copy the fragment to your layer
cp .../defconfig meta-myproduct/recipes-kernel/linux/linux-yocto/enable-usb-cdc.cfg

# Step 5: Create a .bbappend to apply the fragment
cat > meta-myproduct/recipes-kernel/linux/linux-yocto_%.bbappend << 'EOF'
FILESEXTRAPATHS:prepend := "${THISDIR}/${PN}:"
SRC_URI += "file://enable-usb-cdc.cfg"
EOF

# Step 6: Rebuild the kernel
bitbake -c cleansstate virtual/kernel
bitbake virtual/kernel

# Step 7: Verify the option was applied
grep USB_CDC_ACM tmp/work/*/linux-yocto/*/build/.config
```

## Method 2: Custom defconfig

For boards where you want to own the complete kernel configuration (common with BSP-specific kernels):

```bash
# Step 1: Place your defconfig in the layer
mkdir -p meta-myproduct/recipes-kernel/linux/linux-yocto/
cp my_board_defconfig meta-myproduct/recipes-kernel/linux/linux-yocto/

# Step 2: .bbappend picks it up
# meta-myproduct/recipes-kernel/linux/linux-yocto_%.bbappend:
FILESEXTRAPATHS:prepend := "${THISDIR}/${PN}:"
SRC_URI    += "file://my_board_defconfig"
KBUILD_DEFCONFIG = "my_board_defconfig"
KCONFIG_MODE     = "--alldefconfig"  # use defconfig, not combining with base
```

## Method 3: SCC Feature Files (linux-yocto only)

For `linux-yocto`, `.scc` files are the native way to group config fragments into named "features" that can be conditionally included:

```bash
# meta-myproduct/recipes-kernel/linux/linux-yocto/features/usb-cdc/usb-cdc.scc
define KFEATURE_DESCRIPTION "USB CDC ACM serial support"
define KFEATURE_COMPATIBILITY all

kconf hardware usb-cdc.cfg   # references usb-cdc.cfg in the same directory
```

```bash
# In .bbappend:
SRC_URI += "file://features/usb-cdc/usb-cdc.scc"
```

## Kernel Recipe Structure in a BSP Layer

```
meta-myproduct/
└── recipes-kernel/
    └── linux/
        ├── linux-yocto_%.bbappend      ← apply fragments to upstream recipe
        └── linux-yocto/                ← directory named after the recipe
            ├── enable-cdc-acm.cfg      ← config fragment: CONFIG_USB_CDC_ACM=y
            ├── disable-ipv6.cfg        ← config fragment: # CONFIG_IPV6 is not set
            └── my-board.scc            ← groups fragments for this machine
```

## Verification Commands

```bash
# Check the final .config that was actually used
cat tmp/work/*/linux-yocto/*/build/.config | grep CONFIG_USB

# Ensure a specific fragment was included
bitbake -e virtual/kernel | grep ^SRC_URI

# Validate config against what was requested (catches typos in option names)
bitbake -c kernel_configcheck virtual/kernel 2>&1 | grep -i error

# Full rebuild from clean state
bitbake -c cleanall virtual/kernel
bitbake virtual/kernel
```
