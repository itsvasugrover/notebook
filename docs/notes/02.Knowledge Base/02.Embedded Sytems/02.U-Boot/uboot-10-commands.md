---
title: Commands Reference
createTime: 2026/03/23 00:00:00
permalink: /kb/embedded/uboot/commands/
---

# U-Boot Commands Reference

## Command Architecture

Every U-Boot command is registered with the `U_BOOT_CMD()` macro which populates a linker list section (`__u_boot_list_2_cmd_*`). Commands are looked up at runtime by the shell.

```c
// Macro signature:
U_BOOT_CMD(
    name,       // Command name (what you type)
    maxargs,    // Maximum number of arguments
    repeatable, // 1 = auto-repeat on Enter press, 0 = no
    func,       // do_<name>() function pointer
    short_help, // One-line help string
    long_help   // Multi-line help (shown with 'help <name>')
);
```

---

## Boot Commands

### `bootm` — Boot Application Image from Memory

```bash
bootm [addr [initrd[:size]] [fdt]]
```

| Usage | Example |
|-------|---------|
| Legacy uImage | `bootm 0x40400000` |
| FIT image (first config) | `bootm 0x40400000` |
| FIT image (named config) | `bootm 0x40400000#conf-raspberrypi` |
| With initrd + FDT | `bootm ${kernel_addr_r} ${ramdisk_addr_r} ${fdt_addr_r}` |
| No initrd | `bootm ${kernel_addr_r} - ${fdt_addr_r}` |

### `booti` — Boot ARM64 Linux Image (raw `Image` file)

```bash
booti [addr [initrd[:size]] [fdt]]
booti 0x40400000 - 0x43000000
booti ${kernel_addr_r} ${ramdisk_addr_r}:${filesize} ${fdt_addr_r}
```

### `bootz` — Boot ARM32 zImage

```bash
bootz [addr [initrd[:size]] [fdt]]
bootz 0x40400000 - 0x43000000
```

### `bootefi` — Boot UEFI Image

```bash
bootefi [addr [fdt]]
bootefi ${kernel_addr_r}           # Boot EFI application
bootefi bootmgr [${fdt_addr_r}]    # Boot via EFI Boot Manager
bootefi hello                      # Run U-Boot hello world EFI test
```

### `bootflow` — Standard Boot Flow (v2022+)

```bash
bootflow scan [-l] [-b]         # Scan for bootable devices
bootflow list                   # List found boot flows
bootflow boot <index>           # Boot selected flow
bootflow select <index>         # Select without booting
bootflow info                   # Show info about selected flow
```

### `sysboot` — syslinux/extlinux Boot

```bash
sysboot <interface> <devnum[:partnum]> <addr> [filename]
sysboot mmc 0:1 ${scriptaddr} /boot/extlinux/extlinux.conf
```

---

## Memory Commands

### `md` — Memory Display

```bash
md [.b .w .l .q] address [count]
# .b = byte, .w = 2-byte word, .l = 4-byte long, .q = 8-byte quad

md.l 0x40000000 20    # Display 20 32-bit words at 0x40000000
md.b 0x30860000 16    # Display 16 bytes at UART base
md 0x40000000         # Default: 16 long words
```

### `mw` — Memory Write

```bash
mw [.b .w .l .q] address value [count]

mw.l 0x40000000 0xDEADBEEF     # Write one 32-bit value
mw.l 0x40000000 0x0 0x100      # Clear 0x100 longs (1KB) to zero
mw.b 0x30860000 0x55 1         # Write byte 0x55
```

### `cp` — Memory Copy

```bash
cp [.b .w .l] source target count

cp.l 0x40400000 0x40000000 0x20000  # Copy 512KB (in longs)
cp.b 0x40400000 0x42000000 0x100000 # Copy 1MB bytewise
```

### `cmp` — Memory Compare

```bash
cmp [.b .w .l] addr1 addr2 count

cmp.l 0x40000000 0x41000000 0x10000  # Compare 256KB
```

### `nm` — Memory Modify Interactively

```bash
nm [.b .w .l] address
```

---

## Storage Commands

### `mmc` — MMC/SD Commands

```bash
mmc info                     # Show current MMC device info
mmc list                     # List all MMC devices
mmc dev [devnum] [part]      # Switch to device/partition
mmc dev 0                    # Switch to eMMC (device 0)
mmc dev 1 1                  # Switch to SD (device 1), partition 1
mmc read addr blk# cnt       # Read raw blocks
mmc write addr blk# cnt      # Write raw blocks
mmc erase blk# cnt           # Erase blocks
mmc rescan                   # Rescan/reinitialize all MMC devices
mmc part                     # List partitions on current device
mmc boot enable [devnum] [auth] [part]  # Configure eMMC boot partition
mmc boot 0                   # Show boot config of device 0
```

```bash
# Example: read first 4 MB of eMMC into RAM
mmc dev 0
mmc read ${loadaddr} 0 0x2000    # 0x2000 sectors * 512B = 4 MB
```

### `sf` — SPI Flash Commands

```bash
sf probe [bus:cs] [hz] [mode]     # Initialize SPI flash
sf probe                          # Probe with defaults
sf probe 0:0                      # Bus 0, CS 0
sf info                           # Show flash info
sf read addr offset count         # Read bytes
sf write addr offset count        # Write bytes (erase separately)
sf erase offset count             # Erase (aligned to sector size)
sf update addr offset count       # Erase-then-write (safe)
sf protect lock/unlock start_addr length  # Write protection
```

```bash
# Example: update U-Boot in SPI-NOR
sf probe
sf erase 0 0x100000               # Erase first 1 MB
tftp ${loadaddr} u-boot.bin
sf write ${loadaddr} 0 ${filesize}
```

### `nand` — NAND Flash Commands

```bash
nand info                          # Show NAND info
nand erase [clean] [off size]      # Erase blocks
nand read addr off size            # Read raw
nand write addr off size           # Write raw
nand write.yaffs addr off size     # Write YAFFS2 image
nand read.oob addr off size        # Read with OOB
nand write.oob addr off size       # Write with OOB
nand bad                           # Show bad block table
nand torture addr                  # Torture test

# Example: flash kernel to NAND
nand erase.part kernel
tftp ${loadaddr} uImage
nand write ${loadaddr} 0x500000 ${filesize}
```

### `mtd` — Generic MTD Commands (replaces nand/sf in newer U-Boot)

```bash
mtd list                           # List all MTD devices
mtd info [partname]                # Show info
mtd read <partname> addr [offset] [len]
mtd write <partname> addr [offset] [len]
mtd erase <partname> [offset] [len]
mtd bad <partname>                 # Show bad blocks

# Example using partition names:
mtd erase uboot
tftp ${loadaddr} u-boot.bin
mtd write uboot ${loadaddr}
```

---

## Filesystem Commands

### Generic Filesystem Commands (Recommended)

```bash
# These work for any filesystem type (FAT, ext4, etc.)
load <interface> [dev[:part]] <addr> <filename> [bytes [pos]]
save <interface> [dev[:part]] <addr> <filename> len [pos]
ls <interface> [dev[:part]] [directory]
fstype <interface> [dev[:part]] [varname]
size <interface> <dev[:part]> <filename>      # Store file size in ${filesize}

# Examples:
load mmc 0:1 ${kernel_addr_r} /boot/Image
load mmc 0:1 ${fdt_addr_r} /boot/dtbs/my-board.dtb
ls mmc 0:1 /boot
fstype mmc 0:1 fstype_var
size mmc 0:1 /boot/Image   # Sets ${filesize}
```

### `fatload` / `fatls` / `fatwrite`

```bash
fatload <interface> [dev[:part]] <addr> <filename> [bytes [pos]]
fatls <interface> [dev[:part]] [directory]
fatwrite <interface> <dev[:part]> <addr> <filename> <bytes>

fatload mmc 0:1 ${loadaddr} EFI/BOOT/bootaa64.efi
fatls mmc 0:1 /
fatwrite mmc 0:1 ${loadaddr} boot.scr ${filesize}
```

### `ext4load` / `ext4ls` / `ext4write`

```bash
ext4load <interface> [dev[:part]] <addr> <filename>
ext4ls <interface> [dev[:part]] [dir]
ext4write <interface> <dev[:part]> <addr> <filename> <size>

ext4load mmc 0:2 ${kernel_addr_r} /boot/Image
ext4ls mmc 0:2 /boot
```

---

## Network Commands

### `dhcp` — DHCP + TFTP Boot

```bash
dhcp [loadAddress] [bootfilename]
dhcp                    # Get IP and run auto-boot
dhcp ${loadaddr} Image  # Get IP and tftp Image
```

### `tftp` — TFTP Transfer

```bash
tftpboot [loadAddress] [[hostIPaddr:]bootfilename]
tftp ${kernel_addr_r} Image
tftp ${kernel_addr_r} 192.168.1.1:Image
```

### `nfs` — NFS Mount and Load

```bash
nfs [loadAddress] [[hostIPaddr:]path]
nfs ${loadaddr} 192.168.1.1:/srv/nfs/rootfs/boot/Image
```

### `ping` — ICMP Ping

```bash
ping 192.168.1.1
Using dwmac... host 192.168.1.1 is alive
```

### `pxe` — PXE Boot

```bash
pxe get          # Download PXE config from TFTP server
pxe boot         # Boot from PXE config
```

---

## FIT Image / Verified Boot Commands

### `iminfo` — Show Image Info

```bash
iminfo ${loadaddr}
## Checking Image at 40400000 ...
   Legacy image found
   Image Name:   Linux-6.6.20
   Created:      2026-01-15   8:30:00 UTC
   Image Type:   AArch64 Linux Kernel Image (gzip compressed)
   Data Size:    10442752 Bytes = 9.9 MiB
   Load Address: 40400000
   Entry Point:  40400000
   Verifying Checksum ... OK
```

### `imxtract` — Extract Part of Multi-Image

```bash
imxtract ${loadaddr} kernel ${kernel_addr_r}
imxtract ${loadaddr} fdt-1 ${fdt_addr_r}
```

### `fdt` — Flattened Device Tree Manipulation

```bash
fdt addr ${fdt_addr_r}           # Set working FDT address
fdt header                       # Show FDT header
fdt print                        # Print all nodes
fdt print /chosen                # Print /chosen node
fdt list /                       # List root nodes
fdt get value bootargs /chosen bootargs   # Get value into env var
fdt set /chosen bootargs "console=ttyS0,115200"  # Set value
fdt mknode / newnode             # Create new node
fdt rm /chosen newnode           # Remove node
fdt resize [size]                # Increase FDT buffer
fdt apply ${overlay_addr}        # Apply DT overlay
fdt move ${from_addr} ${to_addr} ${size}   # Move FDT to new location
```

---

## USB Commands

```bash
usb start          # Initialize USB host stack
usb info           # Show USB device information
usb tree           # Show USB device tree
usb ls             # List files on USB storage
usb load ...       # Load file from USB storage (same as load usb ...)
usb stop           # Stop USB host stack

# Example: boot from USB stick
usb start
load usb 0:1 ${kernel_addr_r} /boot/Image
load usb 0:1 ${fdt_addr_r} /boot/my-board.dtb
booti ${kernel_addr_r} - ${fdt_addr_r}
```

---

## Environment and Script Commands

```bash
run <variable> [<variable> ...]    # Execute env variable as command
test <conditions>                  # Evaluate test expression
echo <message>                     # Print message
true / false                       # Return 0 / 1
sleep N                            # Sleep N seconds
reset                              # Hard reset board
poweroff                           # Power off (if hardware supports)
```

### `source` — Run Script from Memory

```bash
source ${scriptaddr}               # Execute script at address
source ${scriptaddr}:0             # Execute script at offset 0
```

### `env` Script Execution Example

```bash
# Load and execute a boot script from SD card FAT partition
load mmc 0:1 ${scriptaddr} boot.scr
source ${scriptaddr}
```

---

## GPIO Commands

```bash
gpio input <pin>        # Read GPIO input
gpio set <pin>          # Assert GPIO (high)
gpio clear <pin>        # Deassert GPIO (low)
gpio toggle <pin>       # Toggle GPIO
gpio status [-a] [name] # Show GPIO status

gpio input 89           # Read GPIO 89 (numbered from 0)
gpio set 105            # Set GPIO 105 high
```

---

## I2C Commands

```bash
i2c bus                        # List I2C buses
i2c dev [devnum]               # Switch to bus devnum
i2c probe [addr]               # Probe all/specific I2C addresses
i2c read chip address[.alen] alen addr [# of objects]
i2c write chip address[.alen] alen addr [# of objects]
i2c md chip address[.alen] [# of objects]   # Memory display
i2c mw chip address[.alen] value [count]    # Memory write

# Example: read a register from I2C device at 0x4B, register 0x00
i2c dev 1          # Bus 1
i2c probe          # Find all devices
i2c md 0x4b 0x00 8 # Read 8 bytes from register 0x00
i2c mw 0x4b 0x01 0x55  # Write 0x55 to register 0x01
```

---

## Misc / Utility Commands

```bash
version           # Show U-Boot version, build date, compiler
help              # List all commands
help <cmd>        # Show command help
?                 # Same as help
reset             # Reset the CPU
go <addr> [args]  # Jump to address (for standalone programs)
bdinfo            # Print board info structure
coninfo           # Show available console devices
dm tree           # Show DM device tree
dm uclass         # List all uclasses
dm drivers        # List all drivers
dm devres         # Show device resources
time <command>    # Time a command execution (in ms)
crc32 addr count [addr]  # Calculate CRC32
md5sum addr count # Calculate MD5
sha1sum addr count
sha256sum addr count
```

---

## Writing a Custom U-Boot Command

```c
// cmd/mycmd.c
// SPDX-License-Identifier: GPL-2.0+

#include <command.h>
#include <console.h>
#include <env.h>
#include <log.h>

static int do_mycmd(struct cmd_tbl *cmdtp, int flag, int argc, char *const argv[])
{
    if (argc < 2)
        return CMD_RET_USAGE;
    
    if (!strcmp(argv[1], "hello")) {
        printf("Hello from mycmd!\n");
        return CMD_RET_SUCCESS;
    }
    
    if (!strcmp(argv[1], "info")) {
        printf("Board: %s\n", env_get("board") ?: "unknown");
        return CMD_RET_SUCCESS;
    }
    
    return CMD_RET_USAGE;
}

U_BOOT_LONGHELP(mycmd,
    "hello    - print hello message\n"
    "mycmd info     - print board info\n");

U_BOOT_CMD(
    mycmd, 3, 0, do_mycmd,
    "My custom command",
    mycmd_help_text
);
```

Add to `cmd/Makefile`:
```makefile
obj-$(CONFIG_CMD_MYCMD) += mycmd.o
```

Add to `cmd/Kconfig`:
```kconfig
config CMD_MYCMD
    bool "mycmd — my custom command"
    default n
    help
      Adds the 'mycmd' command for board-specific operations.
```

Enable in defconfig:
```kconfig
CONFIG_CMD_MYCMD=y
```
