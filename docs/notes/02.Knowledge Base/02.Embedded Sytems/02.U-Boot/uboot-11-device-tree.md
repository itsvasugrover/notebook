---
title: Device Tree Support
createTime: 2026/03/23 00:00:00
permalink: /kb/embedded/uboot/device-tree/
---

# U-Boot Device Tree Support

## Overview

U-Boot uses the Flattened Device Tree (FDT) standard — the same binary format (`.dtb`) and source format (`.dts`) as the Linux kernel. The device tree describes the hardware to U-Boot at runtime, replacing compile-time `#define` constants.

As of U-Boot 2026.01:
- `CONFIG_OF_CONTROL=y` — U-Boot reads its own configuration from the DTB
- `CONFIG_OF_LIVE=y` — Preferred: uses a "live" tree (parsed into linked nodes) for runtime modifications
- `CONFIG_OFNODE=y` — Abstraction layer that works with both flat and live trees

---

## How U-Boot Finds Its Device Tree

U-Boot can get the DTB from several sources (in priority order):

1. **Appended DTB** (most common): DTB appended to the U-Boot binary
   - Enabled by `CONFIG_OF_EMBED=y` (embed in binary) or built with `u-boot-dtb.bin`
   - When building: `cat u-boot-nodtb.bin arch/arm/dts/my-board.dtb > u-boot-dtb.bin`

2. **Passed by SPL** via `gd->fdt_blob` (SPL loads FIT containing U-Boot + DTB)

3. **FIT image parameter** — SPL passes FDT address in `gd->fdt_blob`

4. **Passed by ATF/BL31** — Some platforms pass FDT in `x0` register at boot

5. **Embedded** (`CONFIG_OF_EMBED_DTB=y`) — DTB compiled directly into U-Boot binary text region

6. **Sandbox** — Host filesystem for testing

---

## DTB Build Integration

### `arch/arm/dts/Makefile`
```makefile
# All dtb-$(CONFIG_xxx) entries compile if CONFIG_xxx=y
dtb-$(CONFIG_TARGET_MYBOARD) += mysoc-myboard.dtb

# To compile a .dts file from kernel DTS (with U-Boot additions):
# Use the include mechanism, see below
```

### `arch/arm/dts/mysoc-myboard.dts` (U-Boot version)

U-Boot maintains its own DTS files that include Linux DTS files and add U-Boot-specific properties:

```dts
// arch/arm/dts/mysoc-myboard.dts
/dts-v1/;

// Include Linux kernel DTS if desired (shared hardware description)
// #include "../../../../linux/arch/arm64/boot/dts/myvendor/mysoc.dtsi"
// OR: use U-Boot's own dtsi files
#include "mysoc.dtsi"

/ {
    model = "MyVendor MyBoard";
    compatible = "myvendor,myboard", "myvendor,mysoc";

    chosen {
        // stdout-path tells U-Boot which serial node to use as console
        stdout-path = "serial0:115200n8";
        // Alternatively with the node reference:
        // stdout-path = &uart0;
        
        // tick-timer: which timer to use for U-Boot timing
        tick-timer = &timer0;
    };

    aliases {
        // These tell U-Boot which devices correspond to mmc0, eth0, etc.
        serial0 = &uart0;
        mmc0 = &usdhc1;
        mmc1 = &usdhc2;
        ethernet0 = &fec1;
        i2c0 = &i2c1;
        spi0 = &ecspi1;
        usb0 = &usbotg1;
    };

    memory@40000000 {
        device_type = "memory";
        reg = <0x0 0x40000000 0x0 0x40000000>;  // 1 GB
    };
};

&uart0 {
    status = "okay";
    // U-Boot reads clock-frequency for baud rate calculation if not auto
};

&usdhc1 {
    // eMMC: mark as non-removable
    non-removable;
    bus-width = <8>;
    status = "okay";
    
    // U-Boot specific: partition for environment
    u-boot,dm-spl;   // Include this device in SPL DM scan
    u-boot,dm-pre-proper; // Include before U-Boot Proper fully starts
};
```

---

## U-Boot-Specific DT Properties

Many U-Boot-specific properties control driver probing and behavior:

| Property | Scope | Meaning |
|----------|-------|---------|
| `u-boot,dm-pre-reloc` | Any device | Probe this device pre-relocation in U-Boot Proper |
| `u-boot,dm-spl` | Any device | Include this device in SPL driver scan |
| `u-boot,dm-tpl` | Any device | Include this device in TPL driver scan |
| `u-boot,dm-pre-proper` | Any device | Probe before `board_init_r()` completes |
| `stdout-path` | `/chosen` | Console output device path |
| `tick-timer` | `/chosen` | U-Boot timer device |
| `u-boot,bootcount-device` | Bootcount | Device for bootcount register |
| `u-boot,env-offset` | Storage | Override env offset |
| `u-boot,mmc-env-partition` | MMC | eMMC partition for env |
| `bootph-all` | Any device | Alias for `u-boot,dm-pre-reloc` (newer U-Boot preferred) |
| `bootph-pre-ram` | Any device | Probe in SPL (same as `u-boot,dm-spl`) |
| `bootph-pre-sram` | Any device | Probe in TPL |
| `bootph-some-ram` | Any device | Probe in VPL |

> **Note**: In U-Boot 2026.01, the newer `bootph-*` properties (from the `bootph` bindings) are preferred over `u-boot,dm-*`. They are defined in `include/dt-bindings/phase/phases.h`.

### Using `bootph-*` Properties

```dts
#include <dt-bindings/phase/phases.h>

&uart0 {
    bootph-all;    // Available in all phases (TPL, SPL, VPL, U-Boot Proper)
    status = "okay";
};

&usdhc1 {
    bootph-pre-ram;  // Available in SPL (before DRAM, from SRAM)
    status = "okay";
};

&ethernet0 {
    // Not needed in early phases — omit bootph-* entirely
    status = "okay";
};
```

---

## The `/config` Node (U-Boot Configuration)

The `/config` node in the DTB is read by U-Boot at startup to configure runtime behavior:

```dts
/ {
    config {
        // MMC environment location
        u-boot,mmc-env-offset = <0x3F0000>;  // Byte offset
        u-boot,mmc-env-partition = <1>;       // Boot partition 1
        u-boot,mmc-env-offset-redundant = <0x400000>;

        // Silent console (no output until env is loaded)
        // silent_linux = "yes";

        // Verified boot: public key hash in DTB
        // This is the key U-Boot looks for when verifying FIT images
        // See uboot-14-secure-boot.md and uboot-15-chain-of-trust.md
        signature {
            key-my-signing-key {
                required = "conf";
                algo = "sha256,rsa4096";
                key-name-hint = "my-signing-key";
                rsa,num-bits = <4096>;
                rsa,modulus = <...>;       // Key-specific values
                rsa,exponent = <65537>;    // Populated by mkimage -K
                rsa,r-squared = <...>;
                rsa,n0-inverse = <...>;
            };
        };
    };
};
```

---

## Runtime FDT Manipulation

U-Boot can modify the FDT (passed to the kernel) at runtime using the `fdt` command or `ft_board_setup()`.

### `fdt` Command Examples

```bash
# Set the FDT to work on
fdt addr ${fdt_addr_r}

# Show the tree size
fdt header

# Navigate and print
fdt print /                   # Print all nodes
fdt print /memory             # Print memory node
fdt list /chosen              # List chosen node

# Modify
fdt set /chosen bootargs "console=ttyS0,115200 root=/dev/mmcblk0p2 rootwait"

# Add node
fdt mknode /chosen mynode

# Add property
fdt set /chosen mynode myprop 0x1234

# Remove property or node
fdt rm /chosen mynode

# Resize FDT buffer before modifications
fdt resize 4096

# Apply DT overlay
load mmc 0:1 ${fdtoverlay_addr_r} /boot/dtbs/overlay-wifi.dtbo
fdt apply ${fdtoverlay_addr_r}
```

### `ft_board_setup()` — Programmatic FDT Fixups

```c
// board/myvendor/myboard/myboard.c
int ft_board_setup(void *blob, struct bd_info *bd)
{
    int node;
    u64 ram_start = CFG_SYS_SDRAM_BASE;
    u64 ram_size  = gd->ram_size;

    // 1. Fix up memory node
    fdt_fixup_memory(blob, ram_start, ram_size);

    // 2. Fix up MAC address
    u8 mac[6];
    eth_env_get_enetaddr("ethaddr", mac);
    node = fdt_path_offset(blob, "/soc/ethernet@30BE0000");
    if (node >= 0)
        fdt_setprop(blob, node, "local-mac-address", mac, 6);

    // 3. Fix up based on hardware revision
    if (mysoc_get_board_rev() == 2) {
        /* Disable LCD on rev1 boards */
        int lcd = fdt_path_offset(blob, "/lcd");
        if (lcd >= 0)
            fdt_set_node_status(blob, lcd, FDT_STATUS_DISABLED);
    }

    // 4. Pass boot device info
    node = fdt_path_offset(blob, "/chosen");
    if (node < 0) {
        node = fdt_add_subnode(blob, 0, "chosen");
    }
    char cmdline[256];
    snprintf(cmdline, sizeof(cmdline), 
             "console=ttyS0,115200 root=%s rootwait",
             (gd->boot_dev == BOOT_DEVICE_MMC1) ? 
             "/dev/mmcblk0p2" : "/dev/mmcblk1p2");
    fdt_setprop_string(blob, node, "bootargs", cmdline);

    return 0;
}
```

---

## libfdt API Reference

U-Boot uses `libfdt` (the reference FDT library) for all DT operations:

```c
// Reading
int fdt_path_offset(const void *fdt, const char *path);
int fdt_subnode_offset(const void *fdt, int parentoffset, const char *name);
int fdt_node_offset_by_compatible(const void *fdt, int start, const char *compatible);
const void *fdt_getprop(const void *fdt, int nodeoffset, const char *name, int *lenp);
const char *fdt_get_name(const void *fdt, int nodeoffset, int *lenp);
uint32_t fdt_get_phandle(const void *fdt, int nodeoffset);

// Macros for typed access
u32 fdt_read_uint32(const void *fdt, int node, const char *prop, u32 *out);
u64 fdt_read_uint64(const void *fdt, int node, const char *prop, u64 *out);

// Writing (modifies the flat blob in-place — requires pre-allocated space)
int fdt_setprop(void *fdt, int nodeoffset, const char *name,
                const void *val, int len);
int fdt_setprop_u32(void *fdt, int nodeoffset, const char *name, uint32_t val);
int fdt_setprop_u64(void *fdt, int nodeoffset, const char *name, uint64_t val);
int fdt_setprop_string(void *fdt, int nodeoffset, const char *name, const char *str);
int fdt_delprop(void *fdt, int nodeoffset, const char *name);
int fdt_add_subnode(void *fdt, int parentoffset, const char *name);
int fdt_del_node(void *fdt, int nodeoffset);
int fdt_resize(void *fdt, void *buf, int bufsize);

// Iterating
// Parent/child traversal:
fdt_first_subnode(fdt, offset)      → first child node
fdt_next_subnode(fdt, offset)       → next sibling node

// Node iteration macro:
fdt_for_each_subnode(node, fdt, parent) {
    const char *name = fdt_get_name(fdt, node, NULL);
    printf("Node: %s\n", name);
}
```

---

## `ofnode` API — U-Boot Abstraction Layer

U-Boot wraps both flat FDT and live tree access through the `ofnode` abstraction. Drivers should use `ofnode` APIs rather than raw `libfdt`:

```c
// include/dm/ofnode.h

// Get node for a device
struct ofnode node = dev_ofnode(dev);

// Read properties
int ofnode_read_u32(ofnode node, const char *propname, u32 *outp);
int ofnode_read_u64(ofnode node, const char *propname, u64 *outp);
const char *ofnode_read_string(ofnode node, const char *propname);
bool ofnode_read_bool(ofnode node, const char *propname);
int ofnode_read_string_index(ofnode node, const char *propname, int index, const char **outp);
int ofnode_read_s32(ofnode node, const char *propname, s32 *outp);
int ofnode_read_size(ofnode node, const char *propname, size_t *outp);

// Resolve phandles
ofnode ofnode_parse_phandle(ofnode node, const char *phandle_name, int index);

// Navigate
ofnode ofnode_first_subnode(ofnode node);
ofnode ofnode_next_subnode(ofnode node);
bool ofnode_valid(ofnode node);

// Compatibility check
bool ofnode_device_is_compatible(ofnode node, const char *compat);

// Find nodes
ofnode ofnode_path(const char *path);
ofnode ofnode_by_compatible(ofnode from, const char *compat);

// Usage in a driver:
static int mydrv_probe(struct udevice *dev)
{
    u32 clock_freq;
    const char *label;
    
    if (ofnode_read_u32(dev_ofnode(dev), "clock-frequency", &clock_freq))
        clock_freq = 24000000;  // Default if not specified
    
    label = ofnode_read_string(dev_ofnode(dev), "label");
    
    debug("clock=%u label=%s\n", clock_freq, label ?: "(none)");
    return 0;
}
```

---

## Device Tree Compiler (DTC)

```bash
# Compile .dts to .dtb
dtc -I dts -O dtb -o board.dtb board.dts

# Decompile .dtb to .dts (inspect a binary DTB)
dtc -I dtb -O dts -o board.dts board.dtb

# Check DTS syntax
dtc -I dts -O null board.dts

# Include Linux kernel bind-checked schemas (requires dtschema)
dtc -I dts -O dtb -@ board.dts        # With overlay support (-@)
```

### Building DTBs as Part of U-Boot

```bash
make arch/arm/dts/mysoc-myboard.dtb   # Build just the DTB
make dtbs                              # Build all DTBs for current config
```
