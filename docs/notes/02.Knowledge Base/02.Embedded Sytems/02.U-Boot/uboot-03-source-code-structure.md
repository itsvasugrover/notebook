---
title: Source Code Structure
createTime: 2026/03/23 00:00:00
permalink: /kb/embedded/uboot/source-code-structure/
---

# U-Boot Source Code Structure

## Top-Level Directory Layout

After cloning U-Boot v2026.01, the root of the repository contains:

```
u-boot/
├── arch/                  # Architecture-specific code
├── board/                 # Board-specific code
├── cmd/                   # Built-in shell commands
├── common/                # Core U-Boot logic (board_f.c, board_r.c, etc.)
├── configs/               # Board defconfig files (*.defconfig)
├── disk/                  # Disk partition handling (MBR, GPT, etc.)
├── doc/                   # Documentation (RST format, built with Sphinx)
├── drivers/               # Device drivers (DM-based)
├── dts/                   # Device tree source files and upstream bindings
├── env/                   # Environment variable backends
├── fs/                    # Filesystem drivers (FAT, ext4, etc.)
├── include/               # Header files
├── lib/                   # General utility libraries
├── Makefile               # Top-level Makefile
├── Kconfig                # Top-level Kconfig entry
├── net/                   # Network stack (TFTP, NFS, DHCP, etc.)
├── post/                  # Power-On Self Test routines
├── scripts/               # Build scripts, Coccinelle, checkpatch
├── spl/                   # SPL-specific wrappers
├── test/                  # Unit tests (sandbox-based)
├── tools/                 # Host-side tools (mkimage, dumpimage, etc.)
└── tpl/                   # TPL-specific wrappers
```

---

## `arch/` — Architecture-Specific Code

Each architecture has its own subdirectory:

```
arch/
├── arm/
│   ├── cpu/
│   │   ├── arm720t/
│   │   ├── arm920t/
│   │   ├── arm926ejs/
│   │   ├── arm1176/
│   │   ├── armv7/           # Cortex-A7, A9, A15, A17
│   │   │   ├── start.S      # ARM32 entry point
│   │   │   ├── cache.c
│   │   │   ├── cpu.c
│   │   │   └── mmu.c
│   │   └── armv8/           # Cortex-A53, A55, A72, A73, A76, A78 ...
│   │       ├── start.S      # ARM64 entry point
│   │       ├── cache.S
│   │       ├── cpu.c
│   │       ├── transition.S # EL switching
│   │       └── mmu.c
│   ├── dts/                 # ARM DTS overrides
│   ├── include/
│   │   └── asm/
│   │       ├── arch-*/      # SoC-specific headers (arch-imx8m/, arch-rockchip/, etc.)
│   │       ├── global_data.h
│   │       ├── u-boot-arm.lds  # Linker script template
│   │       └── ...
│   ├── lib/
│   │   ├── crt0.S           # C runtime startup before board_init_f
│   │   ├── crt0_64.S        # ARM64 version
│   │   ├── relocate.S       # Relocation code
│   │   └── bootm.c          # bootm for ARM
│   └── mach-*/              # Machine-specific code (mach-imx/, mach-rockchip/, etc.)
├── riscv/
│   ├── cpu/
│   │   ├── start.S          # RISC-V entry
│   │   ├── cpu.c
│   │   └── interrupts.c
│   ├── include/asm/
│   └── lib/
├── x86/
│   ├── cpu/
│   │   ├── start.S          # x86 16→32→64-bit transition
│   │   ├── start16.S        # Real-mode start
│   │   └── cpu.c
│   ├── include/asm/
│   └── lib/
├── mips/
├── powerpc/
└── ...
```

### Key arch files explained

| File | Purpose |
|------|---------|
| `arch/arm/cpu/armv8/start.S` | Assembly entry point for ARM64; sets up stack, clears GD, calls `board_init_f` |
| `arch/arm/lib/crt0_64.S` | C runtime zero (CRT0); position-independent setup before C main |
| `arch/arm/lib/relocate.S` | Relocates U-Boot from load address to top of DRAM |
| `arch/arm/lib/bootm.c` | `do_bootm_linux()` — passes kernel parameters and jumps to kernel |
| `arch/*/include/asm/global_data.h` | Defines `DECLARE_GLOBAL_DATA_PTR` and arch register for `gd` |

---

## `board/` — Board-Specific Code

Each vendor/board has a subdirectory under `board/`:

```
board/
├── toradex/
│   └── verdin-imx8mm/
│       ├── verdin-imx8mm.c  # board_init(), board_late_init()
│       ├── Makefile
│       └── Kconfig
├── raspberrypi/
│   └── rpi/
│       ├── rpi.c
│       └── Makefile
├── rockchip/
│   └── evb_rk3399/
├── freescale/             # NXP boards (legacy naming)
│   └── imx8mq_evk/
│       ├── imx8mq_evk.c
│       ├── spl.c          # SPL-specific board init
│       ├── Makefile
│       └── Kconfig
├── ti/
│   └── am62x/
└── vendor/
    └── myboard/           # Your custom board goes here
        ├── myboard.c
        ├── spl.c
        ├── Makefile
        └── Kconfig
```

### Mandatory board functions

```c
// board/<vendor>/<board>/<board>.c

// Called post-relocation to finish hardware init
int board_init(void)
{
    // e.g., configure GPIOs, set env vars from fuses, etc.
    return 0;
}

// Called just before main_loop() — last chance for board setup
int board_late_init(void)
{
    // Set bootargs, detect boot mode, etc.
    return 0;
}

// Called pre-relocation to initialize external DRAM
int dram_init(void)
{
    gd->ram_size = get_ram_size((void *)CFG_SYS_SDRAM_BASE, SZ_2G);
    return 0;
}

// Populate DRAM bank info
int dram_init_banksize(void)
{
    gd->bd->bi_dram[0].start = CFG_SYS_SDRAM_BASE;
    gd->bd->bi_dram[0].size  = gd->ram_size;
    return 0;
}
```

---

## `configs/` — defconfig Files

Every supported board has a `<board>_defconfig` file:

```
configs/
├── rpi_4_defconfig
├── rpi_arm64_defconfig
├── verdin-imx8mm_defconfig
├── rock5b-rk3588_defconfig
├── qemu_arm64_defconfig
├── sandbox_defconfig
└── myboard_defconfig    ← your custom board
```

These are minimal Kconfig fragments specifying only non-default values. They are used with:
```bash
make myboard_defconfig
```

---

## `include/` — Header Files

```
include/
├── asm-generic/
│   ├── global_data.h        # struct global_data definition
│   ├── gpio.h
│   └── sections.h
├── configs/                 # Legacy board config headers (deprecated in 2026.01)
├── dm/                      # Driver Model headers
│   ├── device.h             # struct udevice
│   ├── uclass.h             # struct uclass / uclass_id
│   ├── uclass-id.h          # Enum of all UCLASS_* IDs
│   └── ...
├── env.h                    # Environment API
├── image.h                  # Legacy and FIT image structures
├── fit.h                    # FIT image format
├── linux/                   # Linux kernel header ports
│   ├── types.h
│   ├── list.h
│   ├── err.h
│   └── ...
├── net.h                    # Network API
├── malloc.h                 # Heap allocator
├── spl.h                    # SPL API
└── u-boot/
    └── u-boot.lds.h         # Linker script helpers
```

---

## `drivers/` — Device Drivers

All drivers in U-Boot use the Driver Model (DM). The structure mirrors Linux kernel driver categories:

```
drivers/
├── clk/              # Clock framework drivers
│   ├── clk-uclass.c
│   ├── clk_fixed_rate.c
│   └── clk-imx8mm.c
├── core/             # Driver Model core
│   ├── device.c      # udevice alloc/probe/remove
│   ├── uclass.c      # uclass registration and lookup
│   ├── lists.c       # Driver/uclass list management
│   ├── ofnode.c      # Device tree node abstraction
│   └── root.c        # Root udevice and DM init
├── gpio/             # GPIO uclass
│   ├── gpio-uclass.c
│   └── mxc_gpio.c
├── i2c/              # I2C uclass + bus drivers
├── mmc/              # MMC/SD uclass
│   ├── mmc-uclass.c
│   ├── sdhci.c
│   └── fsl_esdhc_imx.c
├── mtd/              # Raw flash (NOR/NAND)
│   ├── nand/
│   │   ├── raw/
│   │   └── spi/
│   └── spi/
│       └── sf_probe.c
├── net/              # Ethernet drivers
│   ├── designware.c
│   ├── dwc_eth_qos.c
│   └── fec_mxc.c
├── pci/              # PCIe uclass
├── phy/              # PHY uclass (USB-PHY, SerDes, etc.)
├── pinctrl/          # Pin controller uclass
├── power/            # PMIC, regulator uclass
│   ├── pmic/
│   └── regulator/
├── pwm/              # PWM uclass
├── reset/            # Reset controller uclass
├── rtc/              # Real-time clock uclass
├── serial/           # UART uclass
│   ├── serial-uclass.c
│   ├── ns16550.c
│   └── serial_mxc.c
├── spi/              # SPI uclass + master drivers
│   ├── spi-uclass.c
│   ├── spi-mem.c
│   └── fsl_qspi.c
├── tpm/              # TPM 1.2/2.0 uclass
├── usb/              # USB host/gadget
│   ├── host/
│   │   ├── ehci-hcd.c
│   │   └── xhci.c
│   └── gadget/
│       ├── f_dfu.c      # DFU gadget
│       └── f_fastboot.c # Fastboot gadget
└── watchdog/         # Watchdog uclass
```

---

## `cmd/` — Shell Commands

Every interactive command is a separate file:

```
cmd/
├── bootm.c           # bootm, bootz, booti
├── bootflow.c        # bootflow scan/boot (new in 2023+)
├── bootefi.c         # UEFI boot (bootefi)
├── bootstd.c         # Standard boot
├── env.c             # env print/set/save/load
├── fat.c             # fatload, fatls, fatwrite
├── ext4.c            # ext4load, ext4ls
├── gpio.c            # gpio command
├── i2c.c             # i2c read/write/probe
├── md.c              # md, mw, cp (memory commands)
├── mmc.c             # mmc info/list/read/write
├── mtd.c             # mtd read/write/erase
├── nand.c            # Legacy NAND commands
├── net.c             # ping, tftp, dhcp, nfs
├── part.c            # part list/start/size
├── sf.c              # sf (SPI flash) commands
├── spl.c             # spl export/uboot
├── tpm.c             # TPM commands
├── tpm2.c            # TPM2 commands
├── ums.c             # USB Mass Storage
├── usb.c             # usb start/info/ls/load
├── ubi.c             # UBIFS commands
└── version.c         # version command
```

Each command is registered with the `U_BOOT_CMD()` or `U_BOOT_LONGHELP()` macros:

```c
// cmd/mmc.c
U_BOOT_CMD(
    mmc, 29, 1, do_mmcops,
    "MMC sub system",
    "info - display info of the current MMC device\n"
    "mmc read addr blk# cnt\n"
    "mmc write addr blk# cnt\n"
    ...
);
```

---

## `common/` — Core U-Boot Logic

```
common/
├── board_f.c         # board_init_f() and init_sequence_f[]
├── board_r.c         # board_init_r() and init_sequence_r[]
├── board_info.c      # show_board_info()
├── bootstage.c       # Timing/profiling instrumentation
├── cli.c             # Command-line interface
├── cli_hush.c        # Hush shell parser (if/while/for/case)
├── cli_readline.c    # Line editing, history
├── command.c         # Command dispatch table
├── console.c         # Console abstraction layer
├── dlmalloc.c        # Doug Lea malloc implementation
├── image.c           # Legacy uImage handling
├── image-fit.c       # FIT image parsing and verification
├── image-fit-sig.c   # FIT image signature verification
├── main.c            # main_loop() — the interactive prompt
├── malloc_simple.c   # Simple allocator for pre-reloc use
├── memsize.c         # get_ram_size() probing
├── spl.c             # SPL common flow
├── spl_fit.c         # SPL FIT image loading
└── usb_stor.c        # USB storage support
```

---

## `tools/` — Host-Side Utilities

```
tools/
├── mkimage.c         # Main mkimage tool: create legacy/FIT/ext images
├── dumpimage.c       # Extract/display image contents
├── fit_check_sign.c  # Verify FIT image signature (host side)
├── fit_image.c       # FIT image creation helpers
├── imagetool.c       # Generic image tool framework
├── imagetool.h
├── imximage.c        # NXP i.MX boot image creator
├── kwbimage.c        # Marvell Kirkwood boot image creator
├── rkcommon.c        # Rockchip image helpers
├── rkspi.c           # Rockchip SPI image creator
├── rksd.c            # Rockchip SD image creator
├── socfpgaimage.c    # Intel SoCFPGA image creator
├── stm32image.c      # STM32MP image creator
├── sunxi_egon.c      # Allwinner eGON image
├── fdtgrep.c         # FDT grep/filter utility
├── binman/           # Binary image manager (Python)
│   ├── binman.py
│   ├── etype/        # Entry types for binman
│   └── ftest.py      # Functional tests
└── patman/           # Patch manager (Python)
    ├── patman.py
    └── ...
```

### `mkimage` — Critical Tool

```bash
# Create a legacy uImage (kernel)
mkimage -A arm64 -O linux -T kernel -C none \
        -a 0x40080000 -e 0x40080000 \
        -n "Linux Kernel" -d Image uImage

# Create a FIT image from .its file
mkimage -f myimage.its myimage.itb

# Verify a FIT image signature
mkimage -F -k /path/to/keys -r myimage.itb

# Display FIT image info
mkimage -l myimage.itb

# Create an NXP i.MX8 boot image
mkimage -n imx8mq -T imximage -e 0x40200000 -d u-boot-dtb.bin flash.bin
```

---

## `env/` — Environment Backends

```
env/
├── attr.c           # Attribute/flag handling per variable
├── common.c         # Common env API (env_get, env_set, etc.)
├── embedded.c       # Compiled-in default environment
├── eeprom.c         # Store env in I2C EEPROM
├── fat.c            # Store env on FAT filesystem
├── ext4.c           # Store env on ext4 filesystem
├── flash.c          # Store env in NOR flash
├── mmc.c            # Store env in raw MMC/eMMC sectors
├── nand.c           # Store env in NAND flash
├── nvram.c          # Dallas/Maxim NVRAM
├── nowhere.c        # Volatile (no persistence, reset on reboot)
├── remote.c         # Remote env (JTAG/remote access)
├── sf.c             # Store env in SPI-NOR flash
└── ubi.c            # Store env in UBI volume
```

---

## `fs/` — Filesystems

```
fs/
├── fat/             # FAT12/16/32 and exFAT
├── ext4/            # ext2/3/4 read/write
├── squashfs/        # SquashFS read-only
├── erofs/           # EROFS read-only
├── btrfs/           # Btrfs read
├── jffs2/           # JFFS2 for NOR flash
├── ubifs/           # UBIFS for NAND flash
├── sandbox/         # Sandbox FS for testing
└── fs.c             # Unified FS API (fs_read, fs_write, etc.)
```

---

## `lib/` — Utility Libraries

```
lib/
├── crypto/          # Cryptographic primitives
│   ├── rsa.c        # RSA signature verification
│   ├── ecdsa.c      # ECDSA (P-256, P-384) verification
│   ├── sha1.c
│   ├── sha256.c
│   ├── sha512.c
│   ├── md5.c
│   └── aes.c
├── efi_loader/      # UEFI runtime support
│   ├── efi_boottime.c  # EFI Boot Services
│   ├── efi_runtime.c   # EFI Runtime Services
│   ├── efi_file.c      # EFI File Protocol
│   ├── efi_image_loader.c  # PE/COFF loader
│   └── efi_secureboot.c    # UEFI Secure Boot
├── lzma/            # LZMA decompressor
├── lzo/             # LZO decompressor
├── zlib/            # zlib (gzip) decompressor
├── zstd/            # Zstandard decompressor
├── libfdt/          # Flattened Device Tree library
│   ├── fdt.c
│   ├── fdt_ro.c
│   ├── fdt_rw.c
│   └── fdt_wip.c
├── fdtdec.c         # U-Boot FDT decode helper
├── hashtable.c      # Hash table (used for env)
├── string.c         # String utilities (strtoul, etc.)
├── time.c           # Timers
└── uuid.c           # UUID generation/parsing
```

---

## `test/` — Automated Tests

U-Boot has a comprehensive test suite run via the Sandbox target:

```
test/
├── boot/            # Boot-related tests
├── cmd/             # Command unit tests
├── common/          # Core functionality tests
├── dm/              # Driver model tests
├── env/             # Environment tests
├── overlay/         # DT overlay tests
├── py/              # Python-based integration tests (pytest)
│   ├── tests/
│   │   ├── test_net.py
│   │   ├── test_ums.py
│   │   ├── test_fit.py
│   │   └── test_efi_*.py
│   └── conftest.py
└── ut.c             # Unit test runner command
```

Running tests:
```bash
# Build sandbox target
make sandbox_defconfig && make -j$(nproc)

# Run all unit tests
./u-boot -c "ut all"

# Run specific test suite
./u-boot -c "ut dm"

# Run Python integration tests
pytest test/py/ --bd sandbox --build
```
