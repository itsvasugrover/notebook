---
title: Environment Variables
createTime: 2026/03/23 00:00:00
permalink: /kb/embedded/uboot/environment/
---

# U-Boot Environment Variables

## Overview

U-Boot's environment is a key-value store of string variables that configure every aspect of the boot process. The environment is persistent (stored in flash/eMMC/file) and can be modified at runtime.

---

## Core Environment API (C Code)

```c
// include/env.h

/* Get variable value (returns NULL if not set) */
char *env_get(const char *name);

/* Get variable as unsigned long (with default value) */
ulong env_get_ulong(const char *name, int base, ulong default_val);

/* Set or create a variable */
int env_set(const char *name, const char *value);

/* Set unsigned long */
int env_set_ulong(const char *name, ulong value);

/* Set hex address value */
int env_set_hex(const char *name, ulong value);

/* Delete a variable */
int env_set(const char *name, NULL);

/* Save environment to persistent storage */
int saveenv(void);

/* Load environment from persistent storage */
int env_load(void);

/* Import env from memory buffer */
int env_import(const char *buf, int check, int flags);

/* Export env to memory buffer */
int env_export(env_t *env_out);
```

---

## Shell Commands for Environment Management

### `printenv` — Display Variables

```bash
# Print all variables
=> printenv

# Print specific variable
=> printenv bootcmd
bootcmd=run distro_bootcmd

# Print variables matching a pattern
=> printenv boot*
bootargs=console=ttyS0,115200n8 root=/dev/mmcblk0p2 rootwait
bootcmd=run distro_bootcmd
bootdelay=3
bootdev=mmc 0
bootfile=Image
```

### `setenv` — Set a Variable

```bash
# Set a simple string variable
=> setenv myvar "hello world"

# Set a variable with spaces (use quotes)
=> setenv bootargs "console=ttyS0,115200 root=/dev/mmcblk0p2 rootwait ro"

# Delete a variable
=> setenv myvar

# Set a multi-command variable (use semicolons)
=> setenv loadkernel "tftp ${kernel_addr_r} Image; tftp ${fdt_addr_r} board.dtb"
```

### `env` — Environment Sub-Commands

```bash
# Print all variables (same as printenv)
=> env print

# Print in sorted order
=> env print -s

# Print with hex addresses
=> env print -a

# Save env to persistent storage
=> env save

# Load env from persistent storage (revert RAM changes)
=> env load

# Import from memory (from RAM address)
=> env import -t ${importaddr} ${filesize}

# Export to memory
=> env export -t ${exportaddr}

# Edit a variable interactively
=> env edit bootcmd

# Ask interactively
=> env ask myvar "Enter value: " 20

# Default: reset to compiled-in defaults
=> env default -a         # Reset all to defaults
=> env default bootcmd    # Reset only bootcmd to default
=> env default -f -a      # Force reset all
```

### `saveenv` — Persist Environment

```bash
=> saveenv
Saving Environment to MMC... Writing to MMC(0)... OK
```

---

## Standard Environment Variables Reference

### Boot Control Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `bootcmd` | `run distro_bootcmd` | Command executed after countdown |
| `bootdelay` | `3` | Seconds before auto-boot (-1=disabled, 0=immediate) |
| `preboot` | (empty) | Command run before countdown starts |
| `bootargs` | (empty) | Linux kernel command line (`/proc/cmdline`) |
| `bootfile` | `uImage` or `Image` | Default filename for network boot |
| `stdout` | `serial` | Default output device |
| `stdin` | `serial` | Default input device |
| `stderr` | `serial` | Default error device |

### Network Variables

| Variable | Description |
|----------|-------------|
| `ipaddr` | Board IP address |
| `serverip` | TFTP/NFS server IP |
| `netmask` | Network mask |
| `gatewayip` | Default gateway |
| `dnsip` | DNS server IP |
| `ethaddr` | Primary Ethernet MAC (e.g., `00:11:22:33:44:55`) |
| `eth1addr` | Second Ethernet MAC |
| `eth2addr` | Third Ethernet MAC |
| `hostname` | Board hostname |
| `netdev` | Network device name (e.g., `eth0`) |
| `usbnet_devaddr` | USB gadget Ethernet MAC |
| `usbnet_hostaddr` | USB host (peer) MAC |

### Memory Load Addresses

| Variable | Typical Value | Description |
|----------|--------------|-------------|
| `kernel_addr_r` | `0x40400000` | Where to load kernel image |
| `fdt_addr_r` | `0x43000000` | Where to load device tree |
| `ramdisk_addr_r` | `0x43800000` | Where to load initramfs |
| `scriptaddr` | `0x40000000` | Where to load boot script |
| `pxefile_addr_r` | `0x40100000` | Where to load PXE config |
| `fdtoverlay_addr_r` | `0x40B00000` | Where to load DT overlays |
| `loadaddr` | `0x42000000` | Generic load address |

### Version / Build Variables

| Variable | Source | Description |
|----------|--------|-------------|
| `ver` | Auto-set | U-Boot version string |
| `board` | Board code | Board name |
| `board_name` | Board code | Short board name |
| `soc` | Architecture | SoC name |
| `cpu` | Architecture | CPU name |

---

## Environment Storage Backends

### 1. Raw MMC/eMMC (Most Common for Production)

```kconfig
CONFIG_ENV_IS_IN_MMC=y
CONFIG_ENV_SIZE=0x10000         # 64 KB
CONFIG_ENV_OFFSET=0x3F0000      # 4 MB - 64 KB offset from start
CONFIG_SYS_MMC_ENV_DEV=0        # eMMC device index
CONFIG_SYS_MMC_ENV_PART=1       # 1=boot1, 2=boot2, 0=user
CONFIG_ENV_OFFSET_REDUND=0x400000  # Optional: redundant copy
```

Writes environment to raw sectors at the specified byte offset in eMMC.

### 2. FAT File

```kconfig
CONFIG_ENV_IS_IN_FAT=y
CONFIG_ENV_SIZE=0x10000
CONFIG_ENV_FAT_INTERFACE="mmc"
CONFIG_ENV_FAT_DEVICE_AND_PART="0:1"   # device:partition
CONFIG_ENV_FAT_FILE="uboot.env"        # Filename on FAT partition
```

### 3. SPI-NOR Flash

```kconfig
CONFIG_ENV_IS_IN_SPI_FLASH=y
CONFIG_ENV_SIZE=0x10000         # Must be multiple of erase sector size
CONFIG_ENV_OFFSET=0x3F0000      # Byte offset in flash
CONFIG_ENV_SECT_SIZE=0x10000    # Erase sector size
CONFIG_ENV_OFFSET_REDUND=0x400000
```

### 4. NAND Flash

```kconfig
CONFIG_ENV_IS_IN_NAND=y
CONFIG_ENV_SIZE=0x20000          # 128 KB (multiple of NAND block)
CONFIG_ENV_OFFSET=0x3C0000       # Byte offset from NAND start
CONFIG_ENV_RANGE=0x60000         # Search range for bad block skipping
CONFIG_ENV_OFFSET_REDUND=0x420000
```

### 5. UBI Volume

```kconfig
CONFIG_ENV_IS_IN_UBI=y
CONFIG_ENV_SIZE=0x20000
CONFIG_ENV_UBI_PART="ubi"           # MTD partition name
CONFIG_ENV_UBI_VOLUME="uboot-env"   # UBI volume name
CONFIG_ENV_UBI_VOLUME_REDUND="uboot-env-redund"
```

### 6. Nowhere (Volatile Only)

```kconfig
CONFIG_ENV_IS_NOWHERE=y
```

Environment lives only in RAM. Lost on reboot. Useful during bring-up or for read-only systems.

---

## Redundant Environment

When `CONFIG_ENV_OFFSET_REDUND` is set, U-Boot maintains two copies of the environment. Each copy has a `flags` byte:

- `0x01` = active (valid)
- `0xFF` = erased/obsolete

On boot, the copy with the highest valid `flags` byte is loaded. On `saveenv`, the inactive copy is written first, then flags are swapped.

```c
// env/common.c — env header structure
typedef struct environment_s {
    uint32_t    crc;          /* CRC32 over data[0..ENV_SIZE-5] */
    uint8_t     flags;        /* Redundancy flag */
    uint8_t     data[ENV_SIZE - ENV_HEADER_SIZE];
} env_t;
```

---

## Environment in FDT (`/config` node)

When `CONFIG_OF_CONTROL=y`, some environments can be stored in the device tree's `/config` node. This is primarily used for passing verified-boot configuration items (like the FIT key name).

```dts
// u-boot.dtsi additions
/ {
    config {
        u-boot,mmc-env-offset = <0x3F0000>;
        u-boot,mmc-env-partition = <1>;
        signature {
            key-mykey {
                required = "conf";
                algo = "sha256,rsa4096";
                rsa,num-bits = <4096>;
                rsa,modulus = <...>;
                rsa,exponent = <65537>;
                rsa,r-squared = <...>;
                rsa,n0-inverse = <...>;
            };
        };
    };
};
```

---

## Scripting with Environment Variables

### Conditional Logic

```bash
# if/else
setenv checkboard "if test ${board} = myboard; then run myboard_boot; else run default_boot; fi"

# Arithmetic/comparison
setenv test_ram "if test ${ram_size} -ge 1073741824; then echo 1GB+; fi"
```

### for Loops

```bash
# Try boot from multiple devices
setenv scan_dev "for dev in 0 1 2; do \
    if mmc dev ${dev}; then \
        run boot_from_mmc; \
    fi; \
done"
```

### String Operations

```bash
# Concatenate
setenv fdtfile "${soc}-${board}.dtb"

# Check if variable is set
test -n "${myvar} && echo "set" || echo "not set"
```

### Hush Shell Reference

| Construct | Syntax | Example |
|-----------|--------|---------|
| Conditional | `if test ...; then ...; fi` | `if test ${a} = b; then` |
| Loop | `for x in list; do ...; done` | `for i in 0 1 2;` |
| While | `while ...; do ...; done` | |
| Variable | `${varname}` | `${bootcmd}` |
| Arithmetic test | `test ${a} -gt 0` | |
| String equal | `test ${a} = b` | |
| File exists | `test -e devtype devnum:part file` | |
| Command chain | `cmd1; cmd2` | |
| And | `cmd1 && cmd2` | |
| Or | `cmd1 || cmd2` | |
| Background (none) | N/A | |

---

## Auto-Generated Environment Variables (DISTRO_DEFAULTS)

When `CONFIG_DISTRO_DEFAULTS=y`, the following vars are auto-defined:

```bash
# Generated by include/config_distro_bootcmd.h

boot_targets=mmc0 mmc1 usb0 pxe dhcp

bootcmd_mmc0=devnum=0; run mmc_boot
bootcmd_mmc1=devnum=1; run mmc_boot
bootcmd_usb0=devnum=0; run usb_boot
bootcmd_pxe=run boot_pxe
bootcmd_dhcp=run boot_dhcp

mmc_boot=if mmc dev ${devnum}; then \
    devtype=mmc; \
    run scan_dev_for_boot_part; \
fi

scan_dev_for_boot_part=\
    part list ${devtype} ${devnum} -bootable devplist; \
    env exists devplist || setenv devplist 1; \
    for distro_bootpart in ${devplist}; do \
        if fstype ${devtype} ${devnum}:${distro_bootpart} bootfstype; then \
            run scan_dev_for_boot; \
        fi; \
    done

scan_dev_for_boot=\
    echo Scanning ${devtype} ${devnum}:${distro_bootpart}...;\
    for prefix in ${boot_prefixes}; do \
        run scan_dev_for_extlinux; \
        run scan_dev_for_scripts; \
    done

boot_prefixes=/ /boot/

scan_dev_for_extlinux=\
    if test -e ${devtype} ${devnum}:${distro_bootpart} \
            ${prefix}extlinux/extlinux.conf; then \
        echo Found extlinux config in \
             ${devtype} ${devnum}:${distro_bootpart}; \
        sysboot ${devtype} ${devnum}:${distro_bootpart} any \
                ${scriptaddr} ${prefix}extlinux/extlinux.conf; \
    fi
```

The `extlinux.conf` format:
```
LABEL linux
    LINUX /boot/Image
    INITRD /boot/initramfs-linux.img
    FDT /boot/dtbs/my-soc-board.dtb
    APPEND root=/dev/mmcblk0p2 rw console=ttyS0,115200 rootwait
```
