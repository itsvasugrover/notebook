---
title: Configuration System
createTime: 2026/03/23 00:00:00
permalink: /kb/embedded/uboot/configuration/
---

# U-Boot Configuration System

## Overview: Kconfig

U-Boot uses the same Kconfig configuration system as the Linux kernel. Configuration is stored in `.config` and compiled into `include/autoconf.mk` and `include/generated/autoconf.h`.

Every `CONFIG_` symbol you see in source files is controlled by Kconfig.

---

## The `.config` File

After running `make <board>_defconfig`, a `.config` file is created:

```kconfig
# Automatically generated file; DO NOT EDIT.
# U-Boot 2026.01 Configuration
#
CONFIG_CREATE_ARCH_SYMLINK=y
CONFIG_LINKER_LIST_ALIGN=8
CONFIG_ARCH_FIXUP_FDT_MEMORY=y
CONFIG_HAVE_ARCH_IOREMAP=y
CONFIG_SYS_SUPPORTS_64BIT_KERNEL=y
CONFIG_CPU_V8=y
CONFIG_ARM64=y
CONFIG_ARCH_ARM=y
# CONFIG_ARCH_FIXUP_FDT is not set
CONFIG_SYS_TEXT_BASE=0x40200000
CONFIG_NR_DRAM_BANKS=2
CONFIG_ENV_SIZE=0x2000
CONFIG_ENV_OFFSET=0x3F0000
# ... hundreds more options
```

---

## defconfig Files

### What is a defconfig?
A `defconfig` is a **minimal fragment** of `.config` containing only the settings that differ from defaults. It lives in `configs/<board>_defconfig`.

### Loading a defconfig
```bash
make rpi_4_defconfig       # Loads configs/rpi_4_defconfig
make qemu_arm64_defconfig  # Loads configs/qemu_arm64_defconfig
```

### Saving changes back to defconfig
After modifying with `menuconfig`, save only the non-default values:
```bash
make savedefconfig
# Creates defconfig in current directory (or O=/)

# Move it to configs/
cp defconfig configs/myboard_defconfig
```

### Anatomy of a defconfig
```kconfig
# configs/myboard_defconfig
CONFIG_ARM=y              # Required: architecture selection
CONFIG_ARCH_MY_SOC=y      # Required: SoC selection
CONFIG_TARGET_MYBOARD=y   # Required: board selection
CONFIG_SYS_TEXT_BASE=0x40200000   # U-Boot load address in DRAM
CONFIG_NR_DRAM_BANKS=1
CONFIG_ENV_SIZE=0x10000
CONFIG_ENV_OFFSET=0x3F0000
CONFIG_BOOTDELAY=3
CONFIG_USE_BOOTCOMMAND=y
CONFIG_BOOTCOMMAND="run distro_bootcmd"
CONFIG_SYS_MALLOC_LEN=0x2000000  # 32 MB heap
CONFIG_SPL=y
CONFIG_SPL_TEXT_BASE=0x00020000
CONFIG_SPL_MMC=y
CONFIG_MMC=y
CONFIG_MMC_SDHCI=y
CONFIG_MMC_SDHCI_SDMA=y
CONFIG_DISTRO_DEFAULTS=y
CONFIG_CMD_EXT4=y
CONFIG_CMD_FAT=y
CONFIG_CMD_FS_GENERIC=y
CONFIG_EFI_LOADER=y
```

---

## menuconfig — Interactive Configuration

```bash
make menuconfig    # ncurses TUI
make xconfig       # Qt GUI
make nconfig       # Alternative ncurses TUI (faster)
```

### Navigation (menuconfig)
| Key | Action |
|-----|--------|
| Arrow keys | Navigate |
| Enter | Enter submenu |
| Space/Y | Enable option |
| N | Disable option |
| M | Enable as module (U-Boot doesn't use modules, but syntax is valid) |
| ? | Show help text |
| / | Search for symbol |
| Esc Esc | Go back |
| S | Save |
| Q | Quit |

### Searching for a Symbol
Press `/` and type the symbol name (without `CONFIG_`):
```
Search: BOOTCOMMAND
```
Results show the symbol, its current value, architecture constraints, and location in the menu tree.

---

## Key Configuration Categories

### System / Architecture
```kconfig
CONFIG_ARM=y                   # ARM architecture
CONFIG_ARM64=y                 # AArch64 (64-bit ARM)
CONFIG_RISCV=y                 # RISC-V
CONFIG_X86=y                   # x86

CONFIG_ARCH_<SOC>=y            # SoC family (CONFIG_ARCH_IMX8M, CONFIG_ARCH_ROCKCHIP, etc.)
CONFIG_TARGET_<BOARD>=y        # Specific board
CONFIG_SYS_TEXT_BASE=0x...     # U-Boot load/link address in DRAM
CONFIG_SYS_MALLOC_LEN=0x...    # Heap size (32MB typical)
CONFIG_NR_DRAM_BANKS=1         # Number of DRAM banks
CONFIG_SYS_LOAD_ADDR=0x...     # Default load address for tftp/fatload
```

### SPL Configuration
```kconfig
CONFIG_SPL=y                        # Enable SPL stage
CONFIG_SPL_TEXT_BASE=0x100000       # SPL SRAM load address
CONFIG_SPL_MAX_SIZE=0x50000         # Max SPL size (320 KB)
CONFIG_SPL_STACK=0x18000            # SPL stack address
CONFIG_SPL_BSS_START_ADDR=0x18000   # SPL BSS
CONFIG_SPL_BSS_MAX_SIZE=0x1000

CONFIG_SPL_DM=y                     # Driver model in SPL
CONFIG_SPL_OF_CONTROL=y             # Device tree in SPL
CONFIG_SPL_SERIAL=y                 # Console in SPL
CONFIG_SPL_WATCHDOG=y               # Watchdog in SPL
CONFIG_SPL_MMC=y                    # MMC load in SPL
CONFIG_SPL_LOAD_FIT=y               # Load FIT image
CONFIG_SPL_LOAD_FIT_ADDRESS=0x...   # FIT load address (DRAM)
CONFIG_SPL_FIT_IMAGE_TINY=y         # Minimal FIT parser

# SPL NAND
CONFIG_SPL_NAND_SUPPORT=y
CONFIG_SPL_NAND_SIMPLE=y

# SPL SPI-NOR
CONFIG_SPL_SPI_FLASH_SUPPORT=y
CONFIG_SPL_SPI=y
```

### Environment
```kconfig
CONFIG_ENV_SIZE=0x10000         # Size of environment block (64 KB)
CONFIG_ENV_OFFSET=0x3F0000      # Offset in storage device
CONFIG_ENV_IS_IN_MMC=y          # Store in raw MMC sectors
CONFIG_ENV_IS_IN_FAT=y          # Store in FAT file
CONFIG_ENV_IS_IN_NAND=y         # Store in NAND
CONFIG_ENV_IS_IN_SPI_FLASH=y    # Store in SPI-NOR
CONFIG_ENV_IS_IN_UBI=y          # Store in UBI volume
CONFIG_ENV_IS_NOWHERE=y         # Volatile (no persistence)

CONFIG_ENV_FAT_INTERFACE="mmc"  # When using FAT: interface
CONFIG_ENV_FAT_DEVICE_AND_PART="0:1"  # Device:partition
CONFIG_ENV_FAT_FILE="uboot.env" # Filename

CONFIG_BOOTDELAY=3              # Auto-boot delay in seconds (-1 = disabled)
CONFIG_USE_BOOTCOMMAND=y
CONFIG_BOOTCOMMAND="run distro_bootcmd"
CONFIG_USE_PREBOOT=y
CONFIG_PREBOOT=""               # Command run before boot prompt
```

### Network
```kconfig
CONFIG_NET=y                    # Enable networking
CONFIG_CMD_NET=y                # Network commands (ping, tftp, etc.)
CONFIG_CMD_DHCP=y               # DHCP command
CONFIG_CMD_PING=y               # Ping command
CONFIG_CMD_TFTPBOOT=y           # tftp command

CONFIG_TFTP_BLOCKSIZE=1468      # TFTP block size
CONFIG_NET_RETRY_COUNT=10       # Retries
CONFIG_NET_RANDOM_ETHADDR=y     # Random MAC if not set in env

CONFIG_DM_ETH=y                 # DM-based Ethernet
CONFIG_PHY_MICREL=y             # Micrel PHY driver
CONFIG_PHY_REALTEK=y            # Realtek PHY driver

CONFIG_PXE_UTILS=y              # PXE boot support
CONFIG_CMD_PXE=y
```

### Storage
```kconfig
# MMC/SD
CONFIG_MMC=y
CONFIG_DM_MMC=y
CONFIG_MMC_SDHCI=y
CONFIG_MMC_SDHCI_SDMA=y
CONFIG_MMC_SDHCI_ADMA=y

# SPI-NOR
CONFIG_MTD=y
CONFIG_DM_SPI_FLASH=y
CONFIG_SPI_FLASH=y
CONFIG_SPI_FLASH_WINBOND=y
CONFIG_SPI_FLASH_MACRONIX=y
CONFIG_SPI_FLASH_STMICRO=y
CONFIG_SPI_FLASH_ISSI=y

# NAND
CONFIG_MTD_RAW_NAND=y
CONFIG_NAND_MXS=y               # NXP GPMI NAND
CONFIG_CMD_NAND=y

# UBI/UBIFS
CONFIG_CMD_UBI=y
CONFIG_CMD_UBIFS=y
CONFIG_MTD_UBI=y
CONFIG_MTD_UBI_FASTMAP=y        # UBI fastmap for fast scanning
```

### Filesystems
```kconfig
CONFIG_FS_FAT=y
CONFIG_FAT_WRITE=y
CONFIG_FS_EXT4=y
CONFIG_EXT4_WRITE=y
CONFIG_CMD_FAT=y
CONFIG_CMD_EXT4=y
CONFIG_CMD_EXT4_WRITE=y
CONFIG_CMD_FS_GENERIC=y         # Generic load/save/ls commands
CONFIG_FS_SQUASHFS=y            # SquashFS read
CONFIG_FS_EROFS=y               # EROFS read
```

### USB
```kconfig
CONFIG_USB=y
CONFIG_DM_USB=y
CONFIG_USB_XHCI_HCD=y
CONFIG_USB_EHCI_HCD=y
CONFIG_USB_OHCI_HCD=y
CONFIG_CMD_USB=y
CONFIG_USB_STORAGE=y
CONFIG_USB_KEYBOARD=y
CONFIG_USB_HOST_ETHER=y         # USB-Ethernet adapter
CONFIG_USB_GADGET=y             # USB Device (Gadget)
CONFIG_CI_UDC=y                 # ChipIdea UDC (NXP, etc.)
CONFIG_USB_GADGET_DOWNLOAD=y
CONFIG_G_DNL_VENDOR_NUM=0x0483
CONFIG_G_DNL_PRODUCT_NUM=0xDF00
CONFIG_G_DNL_MANUFACTURER="My Company"
CONFIG_CMD_DFU=y                # DFU firmware update
CONFIG_DFU_MMC=y
CONFIG_DFU_RAM=y
CONFIG_CMD_FASTBOOT=y           # Android fastboot
CONFIG_FASTBOOT_FLASH=y
CONFIG_FASTBOOT_FLASH_MMC=y
```

### Verified Boot / Security
```kconfig
CONFIG_FIT=y                    # FIT image support
CONFIG_FIT_SIGNATURE=y          # FIT signature verification
CONFIG_FIT_VERBOSE=y            # Show verification details
CONFIG_RSA=y                    # RSA crypto library
CONFIG_RSA_VERIFY=y
CONFIG_RSA_VERIFY_WITH_PKEY=y   # Use public key embedded in DTB
CONFIG_ASYMMETRIC_KEY_TYPE=y
CONFIG_ASYMMETRIC_PUBLIC_KEY_SUBTYPE=y
CONFIG_X509_CERTIFICATE_PARSER=y
CONFIG_PKCS7_MESSAGE_PARSER=y
CONFIG_SHA256=y
CONFIG_SHA384=y
CONFIG_SHA512=y

# UEFI Secure Boot
CONFIG_EFI_LOADER=y
CONFIG_EFI_SECURE_BOOT=y
CONFIG_EFI_CAPSULE_AUTHENTICATE=y
CONFIG_EFI_CAPSULE_UPDATE=y

# TPM
CONFIG_TPM=y
CONFIG_TPM2_TIS_SPI=y
CONFIG_CMD_TPM=y
CONFIG_CMD_TPM2=y
CONFIG_MEASURED_BOOT=y          # Extend PCRs with boot measurements
```

### Display / Video
```kconfig
CONFIG_DM_VIDEO=y
CONFIG_VIDEO_LOGO=y
CONFIG_VIDEO_BMP_LOGO=y
CONFIG_SPLASH_SCREEN=y
CONFIG_SPLASH_SOURCE=y
CONFIG_CMD_BMP=y
CONFIG_VIDEO_SIMPLE=y           # Simple framebuffer
CONFIG_DISPLAY=y
CONFIG_VIDEO_MIPI_DSI=y
CONFIG_VIDEO_HDMI=y
CONFIG_PANEL=y
```

### Debug / Misc
```kconfig
CONFIG_DEBUG_UART=y                    # Enable debug UART (very early)
CONFIG_DEBUG_UART_NS16550=y            # NS16550-compatible UART
CONFIG_DEBUG_UART_BASE=0x30860000      # UART base address
CONFIG_DEBUG_UART_CLOCK=24000000       # UART input clock in Hz
CONFIG_DEBUG_UART_SHIFT=2              # Register stride (shift)

CONFIG_LOG=y                           # Logging framework
CONFIG_LOGLEVEL=6                      # 6=INFO, 7=DEBUG
CONFIG_SPL_LOG=y
CONFIG_LOG_MAX_LEVEL=7

CONFIG_PANIC_HANG=y                    # Hang on panic instead of reset
CONFIG_AUTOBOOT_KEYED=y                # Keyed autoboot (require password)
CONFIG_AUTOBOOT_ENCRYPTION=y
CONFIG_AUTOBOOT_MENUKEY=0              # Menu key
```

---

## `include/configs/` — Legacy Board Headers

**Note**: In U-Boot 2026.01, the legacy `include/configs/<board>.h` header approach has been fully deprecated in favor of pure Kconfig. However, you may still encounter it in older or partially migrated boards.

Legacy header pattern (now discouraged):
```c
// include/configs/myboard.h  (LEGACY - avoid in new boards)
#ifndef __MYBOARD_CONFIG_H
#define __MYBOARD_CONFIG_H

// These are now in Kconfig as CONFIG_SYS_TEXT_BASE etc.
#define CONFIG_SYS_TEXT_BASE    0x40200000
#define CONFIG_SYS_MALLOC_LEN   SZ_32M
// ...

#endif
```

In 2026.01, all boards must use `Kconfig` / `defconfig` only. The `include/configs/` directory exists but should have minimal or empty board headers.

---

## Checking the Effective Configuration

```bash
# Show all active CONFIG_ symbols and their values
grep -v "^#" .config | grep "CONFIG_" | sort

# Check a specific option
grep CONFIG_ENV_IS_IN .config

# Show how a config affects the compilation
make V=1 2>&1 | head -20

# Validate .config against current Kconfig (find newly obsolete options)
make olddefconfig
```

---

## `Kconfig` Files — Writing Configuration

Each Kconfig entry in the source:

```kconfig
# drivers/mmc/Kconfig
config MMC_SDHCI
    bool "Support for SDHCI controllers"
    depends on MMC && DM_MMC
    select MMC_SDHCI_IO_ACCESSORS if ARCH_SUNXI
    help
      This selects the Secure Digital Host Controller Interface.
      If you have a controller with this interface, say Y or M here.
      
      If unsure, say N.

config MMC_SDHCI_ADMA
    bool "Support ADMA (Advanced DMA) in SDHCI driver"
    depends on MMC_SDHCI
    help
      Enable Advanced DMA (ADMA2) support for the SDHCI driver.
      ADMA provides a scatter-gather DMA interface.

menuconfig MMC
    bool "MMC/SD/SDIO card support"
    default y if ARCH_SUNXI
    help
      This enables support for accessing MMC, SD, micro-SD and
      SDIO cards via SPI or the dedicated MMC controller.
```

### Kconfig Symbol Types
| Type | Description |
|------|-------------|
| `bool` | Yes/No |
| `tristate` | Yes/Module/No (rarely used in U-Boot) |
| `int` | Integer value |
| `hex` | Hex value |
| `string` | String value |

### Kconfig Keywords
| Keyword | Meaning |
|---------|---------|
| `depends on X` | Only shown/active if X is enabled |
| `select X` | Automatically enables X when this is enabled |
| `imply X` | Suggests enabling X (user can override) |
| `default Y` | Default value is Y |
| `default Y if CONDITION` | Default Y only when condition is true |
| `range 0 100` | Valid range for int/hex types |
| `choice` / `endchoice` | Exclusive selection group |
| `menu` / `endmenu` | Menu grouping |
| `config` | Define a symbol |
| `menuconfig` | Define a symbol that is also a submenu |
