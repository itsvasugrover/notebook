---
title: Architecture
createTime: 2026/03/23 00:00:00
permalink: /kb/embedded/uboot/architecture/
---

# U-Boot Architecture

## Overview of U-Boot's Multi-Stage Design

U-Boot supports a multi-stage loading architecture to cope with constrained early boot environments (tiny SRAM, before DDR is initialized, no cache, etc.). The stages are:

```
TPL → SPL → U-Boot Proper
       ↕
     VPL (optional verification stage)
```

Each stage has progressively more memory, capability, and complexity.

---

## Stage 1: TPL (Tertiary Program Loader)

TPL is the smallest possible stage. It is optional and used on platforms where the on-chip SRAM is extremely limited (e.g., 4–8 KB) and not even enough to fit SPL.

### Purpose
- Ultra-minimal DRAM initialization
- Fit in very tight SRAM (as little as 4 KB)
- Chain-loads SPL into DRAM

### Characteristics
- No DM (Driver Model) support
- No console output in most cases
- Pre-relocation only
- Build artifact: `tpl/u-boot-tpl.bin`
- Enabled via `CONFIG_TPL=y`

### Example platforms using TPL
- Some Rockchip RK3xxx SoCs
- Some Allwinner H6/H616 SoCs

---

## Stage 2: SPL (Secondary Program Loader)

SPL is the workhorse early stage. It runs from SRAM (or from flash if ROM loaded it there) before DRAM is usable.

### Purpose
1. Initialize PLLs and clocks
2. Initialize DDR/LPDDR DRAM
3. Load U-Boot Proper (or Linux directly in some cases) into DRAM
4. Optionally perform authentication of next stage (secure boot)
5. Pass control to U-Boot Proper

### Memory constraints
- Typically 64 KB–256 KB maximum text size (configurable via linker script)
- Runs entirely from SRAM or on-chip memory
- No virtual memory, limited stack

### Build artifacts
- `spl/u-boot-spl.bin` — raw binary
- `spl/u-boot-spl.elf` — ELF with debug symbols
- `spl/u-boot-spl-dtb.bin` — with device tree appended

### Key Kconfig options for SPL
```kconfig
CONFIG_SPL=y
CONFIG_SPL_BUILD=y                # Set automatically during SPL build pass
CONFIG_SPL_TEXT_BASE=0x10000      # SRAM address where SPL executes
CONFIG_SPL_MAX_SIZE=0x40000       # Max SPL binary size
CONFIG_SPL_STACK=0x1001FFFF       # Stack top during SPL
CONFIG_SPL_BSS_START_ADDR=0x...   # BSS section start
CONFIG_SPL_BSS_MAX_SIZE=0x2000

# Source selection
CONFIG_SPL_MMC=y                  # Load from MMC/SD
CONFIG_SPL_NAND_SUPPORT=y         # Load from NAND
CONFIG_SPL_SPI_FLASH_SUPPORT=y    # Load from SPI-NOR
CONFIG_SPL_NET=y                  # Load from network
CONFIG_SPL_USB_HOST_SUPPORT=y     # Load from USB

# Features
CONFIG_SPL_DM=y                   # Driver model in SPL
CONFIG_SPL_OF_CONTROL=y           # Device tree in SPL
CONFIG_SPL_SERIAL=y               # Console UART in SPL
CONFIG_SPL_WATCHDOG=y             # Feed watchdog in SPL
CONFIG_SPL_CRYPTO=y               # Crypto for verified boot

# FIT loading
CONFIG_SPL_LOAD_FIT=y             # Load FIT image
CONFIG_SPL_FIT_IMAGE_TINY=y       # Reduced FIT parser for size
```

### SPL board_init_f() sequence
SPL runs a trimmed version of `board_init_f()`. Key init functions run in SPL:

```c
// arch/arm/lib/crt0.S → _start → board_init_f()
static const init_fnc_t init_sequence_f[] = {
    setup_mon_len,
    fdtdec_setup,     // if SPL_OF_CONTROL
    initf_malloc,
    log_init,
    initf_bootstage,
    arch_cpu_init,    // CPU-specific early init
    mach_cpu_init,    // platform-specific
    initf_dm,         // driver model early init
    board_early_init_f,
    timer_init,
    env_init,
    init_baud_rate,
    serial_init,
    console_init_f,
    display_options,
    checkcpu,
    board_init_f,     // platform DDR init happens here
    ...
};
```

---

## Stage 3: VPL (Verifying Program Loader)

VPL is introduced in newer U-Boot (post-2022) as an optional stage between SPL and U-Boot Proper.

### Purpose
- Cryptographic verification of U-Boot Proper without needing full U-Boot running
- Allows SPL to remain smaller (no crypto) while offloading verification to VPL
- Fits in scenarios where SPL is constrained but you need verification before U-Boot Proper

### Build artifact
- `vpl/u-boot-vpl.bin`

### Kconfig
```kconfig
CONFIG_VPL=y
CONFIG_VPL_TEXT_BASE=0x...
CONFIG_VPL_MAX_SIZE=0x...
```

VPL is relatively new and not yet used on many platforms. It is primarily targeted at high-security embedded systems.

---

## Stage 4: U-Boot Proper

This is the full-featured bootloader that most users interact with via the serial console prompt (`=>` or `U-Boot>`).

### Responsibilities
1. Complete hardware initialization (peripherals, USB, display, etc.)
2. Read environment variables
3. Execute `bootcmd` to load and boot the OS
4. Provide interactive shell for development/recovery
5. Pass device tree and kernel parameters to the kernel

### Build artifacts
- `u-boot` — ELF
- `u-boot.bin` — raw binary
- `u-boot.img` — legacy image format
- `u-boot-dtb.bin` — binary with appended DTB
- `u-boot.itb` — FIT image (SPL + U-Boot + DTB)
- `u-boot-nodtb.bin` — binary without DTB (DTB supplied separately)

### Execution phases: Pre-relocation vs Post-relocation

U-Boot Proper runs in two distinct phases:

#### Pre-relocation phase (`board_init_f()`)
- Runs from flash or wherever it was loaded (possibly SRAM)
- Stack is in SRAM
- Heap is very limited
- Goal: Calculate final DRAM layout, relocate U-Boot to top of DRAM
- Key data structure: `struct global_data *gd` stored in a register (r9 on ARM32, x18 on ARM64)

```
DRAM layout at end of board_init_f():
+---------------------------+  ← Top of DRAM
|     U-Boot code (copy)    |
+---------------------------+
|     Stack                 |
+---------------------------+
|     malloc() pool         |
+---------------------------+
|     FDT copy              |
+---------------------------+
|     Board info / GD       |
+---------------------------+
|     Available DRAM        |
+---------------------------+  ← DRAM base
```

#### Post-relocation phase (`board_init_r()`)
- Runs from the relocated position in DRAM
- Full heap available
- All drivers can be initialized
- Console, storage, network, USB all become available

---

## Global Data Structure (`gd`)

The `struct global_data` (defined in `include/asm-generic/global_data.h`) is the central data structure shared across all of U-Boot. Because BSS and heap are not available pre-relocation, `gd` is allocated on the pre-relocation stack and pointed to by a dedicated register.

```c
struct global_data {
    struct bd_info      *bd;           // Board info
    unsigned long       flags;         // GD_FLG_* flags
    unsigned int        baudrate;      // Console baud rate
    unsigned long       cpu_clk;       // CPU clock in Hz
    unsigned long       bus_clk;       // Bus clock in Hz
    unsigned long       pci_clk;       // PCI clock
    unsigned long       mem_clk;       // Memory clock
    phys_size_t         ram_size;      // DRAM size
    unsigned long       relocaddr;     // Final relocation address
    phys_addr_t         ram_base;      // DRAM base address
    unsigned long       mon_len;       // Monitor length
    unsigned long       irq_sp;        // IRQ stack pointer
    unsigned long       start_addr_sp; // Start stack pointer
    unsigned long       reloc_off;     // Relocation offset
    struct global_data  *new_gd;       // Relocated GD pointer
    const void          *fdt_blob;     // Device tree
    void                *new_fdt;      // Relocated FDT
    unsigned long       fdt_size;      // FDT size
    struct udevice      *dm_root;      // Root DM device
    struct udevice      *dm_root_f;    // Pre-reloc root DM device
    struct list_head    uclass_root;   // uclass list head
    struct udevice      *serial;       // Serial device
    struct udevice      *timer;        // Timer device
    struct udevice      *usbgadget;    // USB gadget device
    // ... more fields
    ulong               env_addr;      // Environment address
    ulong               env_valid;     // Environment validity
    ulong               env_has_init;  // GD_ENV_VALID_*
    ulong               timebase_h;    // Timebase high
    ulong               timebase_l;    // Timebase low
    struct udevice      *cur_serial_dev; // Current serial device
    struct arch_global_data arch;      // Architecture-specific data
#ifdef CONFIG_LOG
    int                 default_log_level;
    struct list_head    log_head;
#endif
};
```

The `gd` pointer register per architecture:
| Architecture | Register holding `gd` |
|---|---|
| ARM32 | r9 |
| ARM64 (AArch64) | x18 |
| RISC-V | gp (x3) |
| x86 | fs segment register |
| MIPS | k0 |
| PowerPC | r2 |

Access macro defined in `include/asm/global_data.h`:
```c
// ARM64 example:
#define DECLARE_GLOBAL_DATA_PTR     register volatile gd_t *gd asm ("x18")
```

---

## Memory Map During Boot

### Typical ARM64 SoC (e.g., 2 GB DRAM at 0x40000000)

```
0xFFFFFFFF  +------------------------------+
             |  (Reserved / Peripherals)    |
0x80000000  +------------------------------+
             |  U-Boot text (relocated)     | ← gd->relocaddr
             |  U-Boot data/BSS             |
             |  U-Boot stack                |
             |  U-Boot malloc pool          |
             |  Device Tree copy            |
             |  Board Info / GD             |
0x40200000  +------------------------------+
             |  Available for kernel/initrd |
0x40080000  +------------------------------+
             |  Linux kernel load address   |
0x40000000  +------------------------------+
             |  DRAM START                  |
```

---

## Init Sequence Architecture

U-Boot's initialization is driven by two function pointer arrays:

### `init_sequence_f[]` (pre-relocation)
Defined in `common/board_f.c`. Each entry is a function returning `int` (0=success, nonzero=fatal):

```c
static const init_fnc_t init_sequence_f[] = {
    setup_mon_len,
    fdtdec_setup,
    initf_malloc,
    log_init,
    initf_bootstage,
    initf_console_record,
    arch_cpu_init,
    mach_cpu_init,
    initf_dm,
    arch_cpu_init_dm,
    mark_bootsource,
    spl_early_init,        // SPL only
    env_init,
    init_baud_rate,
    serial_init,
    console_init_f,
    display_options,
    display_text_info,
    checkcpu,
    print_cpuinfo,
    show_board_info,
    INIT_FUNC_WATCHDOG_INIT
    misc_init_f,
    INIT_FUNC_WATCHDOG_RESET
    init_func_i2c,
    init_func_vid,
    init_func_pci,
    announce_dram_init,
    dram_init,
    setup_dram_config,
    reserve_round_4k,
    reserve_mmu,
    reserve_video,
    reserve_trace,
    reserve_uboot,
    reserve_malloc,
    reserve_board,
    reserve_global_data,
    reserve_fdt,
    reserve_bootstage,
    reserve_bloblist,
    reserve_arch,
    reserve_stacks,
    dram_init_banksize,
    show_dram_config,
    setup_reloc,
    clear_bss,
    NULL,
};
```

### `init_sequence_r[]` (post-relocation)
Defined in `common/board_r.c`:

```c
static init_fnc_t init_sequence_r[] = {
    initr_trace,
    initr_reloc,
    initr_caches,
    initr_reloc_global_data,
    initr_barrier,
    initr_malloc,
    log_init,
    initr_bootstage,
    initr_console_record,
    bootstage_relocate,
    initr_of_live,
    initr_dm,
    board_init,           // ← board_init() called here (post-reloc)
    set_cpu_clk_info,
    initr_serial,
    initr_announce,
    INIT_FUNC_WATCHDOG_RESET
    initr_mmc,
    initr_env,
    initr_secondary_cpus,
    initr_stdio_init_tables,
    initr_jumptable,
    console_init_r,        // ← Console fully operational here
    interrupt_init,
    initr_enable_interrupts,
    initr_ethaddr,
    board_late_init,       // ← board_late_init() hook
    initr_net,
    initr_post,
    initr_ide,
    initr_scsi,
    initr_usb,
    initr_video,
    initr_malloc_check,
    run_main_loop,         // ← Enters main command loop / executes bootcmd
};
```

---

## Architecture-Specific Boot Entry Points

### ARM64 (`arch/arm/cpu/armv8/start.S`)

```asm
_start:
    b   reset          // Jump to reset handler

reset:
    // Save boot0 register (x0 = FDT pointer from ATF, x1-x3 = 0)
    mov x0, x0
    
    // Set up EL (Exception Level)
    bl  save_boot_params
    
    // Disable interrupts, FIQs
    msr daifset, #0xf
    
    // Set up stack
    adr x0, _start
    sub x0, x0, #GD_SIZE
    bic x0, x0, #0xf  
    mov sp, x0
    
    // Clear GD
    mov x1, x0
    mov x2, #GD_SIZE / 8
    0: str xzr, [x1], #8
       subs x2, x2, #1
       bne 0b
    
    // Store gd into x18
    mov x18, x0
    
    bl  board_init_f_alloc_reserve
    bl  board_init_f_init_reserve
    bl  board_init_f
    
    // After board_init_f: jump to relocated U-Boot
    ldr x0, [x18, #GD_RELOCADDR]
    br  x0
```

### RISC-V (`arch/riscv/cpu/start.S`)

```asm
_start:
    // Set up GP (global pointer) = gd
    .option push
    .option norelax
    la  gp, __global_pointer$
    .option pop
    
    // Set mstatus for M-mode
    li  t0, MSTATUS_FS | MSTATUS_XS
    csrs mstatus, t0
    
    // Set up stack
    la  sp, __stack
    li  t0, CONFIG_STACK_SIZE
    add sp, sp, t0
    
    // Init trap vector
    la  t0, _trap_handler
    csrw mtvec, t0
    
    call board_init_f
```
