---
title: Boot Process
createTime: 2026/03/23 00:00:00
permalink: /kb/embedded/uboot/boot-process/
---

# U-Boot Boot Process

## Overview

The U-Boot boot process has several distinct phases from power-on to kernel handoff. Understanding this flow is essential for debugging, optimizing, and customizing U-Boot behavior.

---

## Phase 0: ROM Boot Code

Before U-Boot runs, the SoC's internal ROM code executes. It:
1. Initializes the minimum required clocks (usually from internal oscillator)
2. Reads boot mode pins/fuses to determine boot source
3. Reads a small header (vendor-specific) from the boot device
4. Loads SPL into SRAM (typically at a fixed address)
5. Jumps to SPL entry point

The ROM code format is vendor-specific:
- **NXP i.MX8M**: Image Vector Table (IVT) format, parsed by ROM; optionally authenticated via HAB
- **Rockchip**: eGON header or IDB (Initial Data Block) format
- **TI AM62x**: X509 certificate-wrapped binary
- **Allwinner**: eGON boot header
- **STM32MP**: Binary with STM32 header (`mkimage -T stm32image`)

---

## Phase 1: SPL Execution

### SPL Entry Point (ARM64)

```
ROM copies SPL to SRAM → jumps to SPL's CONFIG_SPL_TEXT_BASE
    → arch/arm/cpu/armv8/start.S: _start
    → arch/arm/lib/crt0_64.S: _main
    → board_init_f() in common/spl/spl.c
```

### `board_init_f()` in SPL Context

SPL's `board_init_f()` is located in `arch/arm/lib/spl.c` and calls through to `common/spl/spl.c`:

```c
// common/spl/spl.c (simplified)
void board_init_r(gd_t *dummy1, ulong dummy2)
{
    u32 boot_device;
    
    debug(">>" __FILE__ ":" MK_STR(__LINE__) " spl_init()\n");
    
    /* Optionally enable caches */
    spl_enable_dcache();
    
    /* Announce SPL */
    debug("\nU-Boot SPL " PLAIN_VERSION " (" U_BOOT_DATE " - " U_BOOT_TIME ")\n");
    
    /* Print CPU/board info */
    spl_board_init();
    
    /* Initialize DM */
    dm_init_and_scan(true);
    
    /* Determine boot device */
    boot_device = spl_boot_device();
    
    /* Load next stage */
    spl_load_image(boot_device);
}
```

### SPL Load Sequence

SPL tries to load U-Boot Proper (or a FIT image containing it) by calling boot hooks:

```c
// common/spl/spl.c
static struct spl_image_loader *spl_ll_find_loader(uint boot_device)
{
    struct spl_image_loader *drv = ll_entry_start(struct spl_image_loader,
                                                   spl_image_loader);
    const int n_ents = ll_entry_count(struct spl_image_loader,
                                      spl_image_loader);
    
    for (struct spl_image_loader *entry = drv; entry < drv + n_ents; entry++) {
        if (boot_device == entry->boot_device)
            return entry;
    }
    return NULL;
}
```

Each loader is registered with:
```c
SPL_LOAD_IMAGE_METHOD("MMC1", 0, BOOT_DEVICE_MMC1, spl_mmc_load_image);
SPL_LOAD_IMAGE_METHOD("SPI",  0, BOOT_DEVICE_SPI,  spl_spi_load_image);
SPL_LOAD_IMAGE_METHOD("NAND", 0, BOOT_DEVICE_NAND, spl_nand_load_image);
```

### FIT Image Loading in SPL

When `CONFIG_SPL_LOAD_FIT=y`, SPL parses a FIT image to extract U-Boot proper:

```c
// common/spl/spl_fit.c
int spl_load_simple_fit(struct spl_image_info *spl_image,
                         struct spl_load_info *info,
                         ulong sector, const void *fit)
{
    /* Parse FIT node: /images/uboot */
    /* Extract load address and entry point */
    /* Verify signature if CONFIG_SPL_FIT_SIGNATURE */
    /* Load image data into DRAM */
    /* Return entry point to spl_image */
}
```

### Handoff from SPL to U-Boot Proper

After loading, SPL jumps to U-Boot Proper:
```c
// common/spl/spl.c
typedef void __noreturn (*jump_to_image_no_args)(struct spl_image_info *);

static void spl_board_prepare_for_boot(void) { /* optional hook */ }

/* Jump: */
debug("image entry point: 0x%lX\n", spl_image.entry_point);
jump_to_image_no_args = (jump_to_image_no_args)spl_image.entry_point;
spl_board_prepare_for_boot();
jump_to_image_no_args(&spl_image);
/* Never returns */
```

---

## Phase 2: U-Boot Proper — Pre-Relocation (`board_init_f`)

### Entry Point

```
spl handoff → U-Boot ELF entry at CONFIG_SYS_TEXT_BASE
    → arch/arm/cpu/armv8/start.S: _start → reset
    → arch/arm/lib/crt0_64.S: _main
    → common/board_f.c: board_init_f()
```

### `board_init_f()` — Pre-Relocation Init

```c
// common/board_f.c
void board_init_f(ulong boot_flags)
{
    gd->flags = boot_flags;
    gd->have_console = 0;
    
    if (initcall_run_list(init_sequence_f))
        hang();
    
    /* This function must not return */
}
```

### Key Steps in `init_sequence_f[]`

1. **`setup_mon_len()`** — Calculate U-Boot image size from linker symbols
2. **`fdtdec_setup()`** — Locate FDT (appended or from SPL)
3. **`initf_malloc()`** — Initialize pre-relocation malloc pool in `gd->malloc_base`
4. **`arch_cpu_init()`** — Minimal CPU init (disable MMU if enabled, set CPU frequency)
5. **`initf_dm()`** — Initialize Driver Model (pre-relocation subset)
6. **`board_early_init_f()`** — Board-specific early init (clocks, mux)
7. **`serial_init()`** — UART driver probe; console becomes available
8. **`console_init_f()`** — Early console output enabled
9. **`display_options()`** — Print "U-Boot 2026.01 (date)"
10. **`checkcpu()`** / **`print_cpuinfo()`** — Print CPU information
11. **`show_board_info()`** — Print board name/version
12. **`dram_init()`** — Set `gd->ram_size` (BOARD FUNCTION)
13. **`reserve_*()`** functions — Reserve space at top of DRAM for:
    - U-Boot code (relocated copy)
    - Stack
    - malloc heap
    - FDT copy
    - Board info / global data
14. **`setup_reloc()`** — Calculate `gd->reloc_off` = destination - source

### Memory Reservation During `board_init_f`

```c
// common/board_f.c — reserve functions
// Each decrements gd->relocaddr to carve out space:

static int reserve_uboot(void)
{
    // Reserve space for the relocated U-Boot copy
    gd->relocaddr -= gd->mon_len;
    gd->relocaddr &= ~(4096 - 1);    // align to 4 KB
    debug("Reserving %ldk for U-Boot at: %08lx\n",
          gd->mon_len >> 10, gd->relocaddr);
    gd->reloc_off = gd->relocaddr - CONFIG_SYS_TEXT_BASE;
    return 0;
}

static int reserve_malloc(void)
{
    // Reserve malloc heap (CONFIG_SYS_MALLOC_LEN, default 32MB)
    gd->start_addr_sp = gd->relocaddr - TOTAL_MALLOC_LEN;
    debug("Reserving %dk for malloc at: %08lx\n",
          TOTAL_MALLOC_LEN >> 10, gd->start_addr_sp);
    return 0;
}

static int reserve_stacks(void)
{
    // Reserve stack (at least 4 KB, up to CONFIG_STACK_SIZE)
    gd->start_addr_sp -= 16;
    gd->start_addr_sp &= ~0xf;  // 16-byte alignment
    debug("Stack Pointer at: %08lx\n", gd->start_addr_sp);
    gd->stack_base = gd->start_addr_sp;
    return 0;
}
```

### Relocation

After `board_init_f()`:
```c
// arch/arm/lib/crt0_64.S
// After board_init_f returns, _main continues:
ldr     x0, [x18, #GD_START_ADDR_SP]   // new stack pointer
bic     sp, x0, #0xf                    // align stack
ldr     x18, [x18, #GD_NEW_GD]         // new GD location
ldr     x0, [x18, #GD_RELOC_OFF]       // relocation offset

adr     x1, __image_copy_start
ldr     x2, [x18, #GD_RELOCADDR]
bl      relocate_code                   // Copy U-Boot to new location

// Fix up jump table
bl      relocate_vectors

// Clear BSS
// (BSS is in the new location)

// Call board_init_r in the new (relocated) location
ldr     x0, =board_init_r
ldr     x1, [x18, #GD_RELOC_OFF]
add     x0, x0, x1                      // adjust for relocation
br      x0
```

---

## Phase 3: U-Boot Proper — Post-Relocation (`board_init_r`)

### `board_init_r()` Entry

```c
// common/board_r.c
void board_init_r(gd_t *new_gd, ulong dest_addr)
{
    gd = new_gd;        // Switch to relocated GD
    
    if (initcall_run_list(init_sequence_r))
        hang();
    
    /* Never returns — ends in run_main_loop() */
}
```

### Key Steps in `init_sequence_r[]`

1. **`initr_caches()`** — Enable/configure data cache, MMU (if CONFIG_SYS_DCACHE_OFF is not set)
2. **`initr_malloc()`** — Initialize full malloc heap (dlmalloc)
3. **`initr_dm()`** — Full Driver Model init, probe all devices in DT
4. **`board_init()`** — Board-specific post-relocation init (BOARD FUNCTION)
5. **`initr_serial()`** — Re-initialize serial (now with DM)
6. **`initr_announce()`** — Print "Relocating to 0x..." message
7. **`initr_mmc()`** — Probe MMC controllers
8. **`initr_env()`** — Load environment from storage
9. **`console_init_r()`** — Full console initialized; stdout/stderr/stdin configured
10. **`interrupt_init()`** — Timer/IRQ interrupts configured
11. **`board_late_init()`** — Last board hooks (BOARD FUNCTION)
12. **`initr_net()`** — Ethernet subsystem init
13. **`initr_usb()`** — USB stack init
14. **`run_main_loop()`** — Enter interactive loop / execute bootcmd

---

## Phase 4: Main Loop and Boot

### `run_main_loop()` → `main_loop()`

```c
// common/main.c
void main_loop(void)
{
    const char *s;
    
    bootstage_mark_name(BOOTSTAGE_ID_MAIN_LOOP, "main_loop");
    
#ifdef CONFIG_VERSION_VARIABLE
    env_set("ver", version_string);
#endif
    
    cli_init();       // Initialize Hush shell
    run_preboot_environment_command();  // Execute CONFIG_PREBOOT
    
    s = bootdelay_process();    // Handle BOOTDELAY countdown
    if (cli_process_fdt(&s))    // Check FDT for boot command
        cli_secure_boot_cmd(s); // Secure: fixed command if verified
    
    autoboot_command(s);        // Execute bootcmd if no key pressed
    
    cli_loop();                 // Interactive shell prompt
}
```

### Autoboot: The Boot Countdown

```c
// common/autoboot.c
const char *bootdelay_process(void)
{
    char *s;
    int bootdelay;
    
    s = env_get("bootcmd");
    bootdelay = env_get_ulong("bootdelay", 10, CONFIG_BOOTDELAY);
    
    if (bootdelay >= 0) {
        printf("Hit any key to stop autoboot: %d ", bootdelay);
        while (bootdelay > 0) {
            if (abortboot(bootdelay))    // Check for keypress
                goto out;
            bootdelay--;
        }
    }
    return s;  // Return bootcmd string for execution
out:
    return NULL;  // User interrupted
}
```

### Standard Boot Flow (`distro_bootcmd`)

When `CONFIG_DISTRO_DEFAULTS=y`, the default boot sequence tries all storage devices automatically:

```bash
# Generated by include/config_distro_bootcmd.h
# Simplified representation of what distro_bootcmd does:

distro_bootcmd:
  for devtype in mmc usb nvme scsi virtio; do
    for devnum in 0 1 2; do
      # Try to load and boot from each device
      if test -e $devtype $devnum:$bootpart /boot/extlinux/extlinux.conf; then
        run boot_extlinux
      elif test -e $devtype $devnum:$bootpart /EFI/BOOT/bootaa64.efi; then
        run boot_efi
      fi
    done
  done
```

### `bootm` — Boot a Memory Image

`bootm` is the primary command to load and execute a kernel:

```bash
# Boot a legacy uImage from memory address 0x40400000
bootm 0x40400000

# Boot a FIT image: first configuration
bootm 0x40400000

# Boot a FIT image: specific config#1
bootm 0x40400000#conf-1

# Boot a FIT image with separate ramdisk and FDT
bootm ${kernel_addr} ${ramdisk_addr} ${fdt_addr}
```

#### `bootm` Internal Flow

```c
// cmd/bootm.c → common/bootm.c
int do_bootm(...)
{
    // 1. Parse image header (legacy or FIT)
    bootm_start(&images);
    
    // 2. Load all components (kernel, initrd, fdt)
    bootm_load_os(&images, 0);

    // 3. Prepare kernel parameters  
    bootm_os_get_boot_func(&images);  // → boot_fn = do_bootm_linux()
    
    // 4. Disable caches, prepare for kernel
    arch_preboot_os();
    
    // 5. Jump to kernel (never returns)
    boot_fn(0, &images);
}
```

### `booti` — Boot ARM64 Linux Image (uncompressed)

```bash
# Load raw kernel Image file and boot it
booti ${kernel_addr_r} - ${fdt_addr_r}
# '-' means no initrd

# With initrd
booti ${kernel_addr_r} ${ramdisk_addr_r} ${fdt_addr_r}
```

#### ARM64 Kernel Handoff (AArch64)

```c
// arch/arm/lib/bootm.c
static void boot_jump_linux(bootm_headers_t *images, int flag)
{
    // x0 = FDT address
    // x1-x3 = 0 (reserved per ARM64 Linux boot protocol)
    // x4 = 0 (reserved)
    
    unsigned long machid = 0xffffffff;  // Not used for ARM64
    void (*kernel_entry)(int zero, int arch, uint params);
    
    kernel_entry = (void (*)(int, int, uint))images->ep;
    
    // Disable caches before jumping
    cleanup_before_linux();
    
    // Jump to kernel with:
    // r0=0, r1=0xFFFFFFFF (unused), r2=FDT address
    kernel_entry(0, machid, (uint)images->ft_addr);
}
```

### `bootz` — Boot zImage (ARM32 compressed kernel)

```bash
# Boot a compressed ARM32 zImage
bootz ${kernel_addr_r} - ${fdt_addr_r}
```

---

## Standard Boot Environment Variables

These are populated by `include/config_distro_bootcmd.h`:

```bash
# Memory addresses for loading images
kernel_addr_r=0x40400000     # Where to load kernel
fdt_addr_r=0x43000000        # Where to load device tree
ramdisk_addr_r=0x43800000    # Where to load initramfs
scriptaddr=0x40000000        # Where to load boot scripts

# Boot command (executed automatically)
bootcmd=run distro_bootcmd

# Standard TFTP/NFS boot
serverip=192.168.1.1
ipaddr=192.168.1.100
netmask=255.255.255.0
gatewayip=192.168.1.1
bootfile=Image

tftpboot=tftp ${kernel_addr_r} ${serverip}:${bootfile}; \
          tftp ${fdt_addr_r} ${serverip}:${fdtfile}; \
          booti ${kernel_addr_r} - ${fdt_addr_r}
```

---

## Boot Timing / Bootstage

U-Boot records timing for each boot phase with the `bootstage` framework:

```bash
# At U-Boot prompt, show timing report
=> bootstage report

Timer summary in microseconds (us):
       Mark    Elapsed  Stage
          0          0  reset
        268        268  board_init_f start
       5891       5623  board_init_r start (after reloc)
      18234      12343  main_loop
      84521      66287  bootm start
      86112       1591  start_kernel

# Save bootstage data
=> bootstage stash ${stash_addr} ${stash_size}
# This data can be read by Linux kernel (CONFIG_ATAGS_PROC or via FDT)
```
