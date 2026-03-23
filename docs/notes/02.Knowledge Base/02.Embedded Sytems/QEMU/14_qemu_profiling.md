---
title: QEMU Profiling
createTime: 2026/03/14 14:21:19
permalink: /kb/embedded/qemu/qemu-profiling/
---

# QEMU Profiling

QEMU provides two first-class profiling mechanisms: the **TCG Plugin API** (for instrumenting guest code portably across any emulated architecture) and **host-side profiling** with Linux `perf`. This page covers both in detail.

---

## TCG Plugin API

The TCG Plugin API (introduced in QEMU 4.2, stabilized in 5.2) allows writing portable guest-code instrumentation plugins in C that are loaded at runtime. Plugins run as shared libraries and hook into QEMU's TCG pipeline — they see every translation block and can register callbacks on instruction execution.

### How the Plugin API Works

During TCG translation of each block:
1. QEMU calls the plugin's `vcpu_tb_trans` callback, passing a handle to the TB.
2. Inside that callback, the plugin can register per-TB or per-instruction execution callbacks using `qemu_plugin_register_vcpu_tb_exec_cb` or `qemu_plugin_register_vcpu_insn_exec_cb`.
3. When the translated code runs, QEMU inserts calls to those callbacks inline in the TCG output.

This is more efficient than `-d exec` (which emits a log line per TB) because the callbacks run compiled C code with direct access to the data structures.

### Building Plugins

Plugins are shared libraries built against `qemu-plugin.h`:

```bash
# From the QEMU source tree
ls contrib/plugins/
# insn.c  cache.c  hotpages.c  lockstep.c  ...

# Build all built-in plugins
cd qemu-build
ninja tests/plugins/libinsn.so
ninja tests/plugins/libcache.so
```

### Loading a Plugin

```bash
qemu-system-arm -M mps2-an385 -kernel firmware.elf -nographic \
    -plugin /path/to/libinsn.so,arg="output=/tmp/insn.log"
```

Multiple plugins can be loaded:
```bash
-plugin libinsn.so -plugin libcache.so,arg="icachesize=32768"
```

---

## Built-in Plugins

QEMU ships several ready-to-use plugins:

### `insn` — Instruction Counter

Counts instructions executed per vCPU and optionally per TB:

```bash
qemu-system-arm ... -plugin libinsn.so
# Output at QEMU exit:
# vCPU 0 executed 1234567 instructions
```

The `insn` plugin source (`contrib/plugins/insn.c`) is a good starting point for understanding the API.

### `cache` — Cache Simulator

Simulates L1 instruction and data caches, reporting hit/miss rates:

```bash
qemu-system-arm ... \
    -plugin libcache.so,arg="icachesize=32768,dcachesize=32768,iassoc=4,dassoc=4"
# Output:
# I$ hit rate: 98.3%
# D$ hit rate: 94.1%
```

### `hotpages` — Memory Access Hotspots

Reports the most frequently accessed memory pages:

```bash
qemu-system-arm ... -plugin libhotpages.so
```

---

## Writing a Custom Plugin

### API Overview

```c
#include <qemu-plugin.h>

/* Required symbols in every plugin */
QEMU_PLUGIN_EXPORT int qemu_plugin_version = QEMU_PLUGIN_VERSION;

QEMU_PLUGIN_EXPORT int qemu_plugin_install(qemu_plugin_id_t id,
                                            const qemu_info_t *info,
                                            int argc, char **argv);
```

Key API functions:

| Function | Description |
|----------|-------------|
| `qemu_plugin_register_vcpu_tb_trans_cb` | Called for each new TB being translated |
| `qemu_plugin_register_vcpu_tb_exec_cb` | Callback when a TB executes |
| `qemu_plugin_register_vcpu_insn_exec_cb` | Callback when an instruction executes |
| `qemu_plugin_register_vcpu_mem_cb` | Callback on memory access |
| `qemu_plugin_tb_n_insns` | Number of instructions in a TB handle |
| `qemu_plugin_tb_get_insn` | Get instruction handle from TB |
| `qemu_plugin_insn_vaddr` | Virtual address of an instruction |
| `qemu_plugin_insn_haddr` | Host address of the translated code |
| `qemu_plugin_insn_size` | Byte size of instruction |
| `qemu_plugin_insn_disas` | Disassembly string |
| `qemu_plugin_register_atexit_cb` | Called when QEMU exits (print results) |

### Example: BB Counter (Basic Block Execution Counter)

```c
/* bb_count.c — counts how many times each unique TB executes */
#include "qemu-plugin.h"
#include <glib.h>
#include <stdio.h>

QEMU_PLUGIN_EXPORT int qemu_plugin_version = QEMU_PLUGIN_VERSION;

typedef struct {
    uint64_t vaddr;
    uint64_t exec_count;
    uint32_t n_insns;
} TBRecord;

static GMutex lock;
static GHashTable *tb_table;

static void vcpu_tb_exec(unsigned int vcpu_index, void *udata)
{
    TBRecord *rec = (TBRecord *)udata;
    g_mutex_lock(&lock);
    rec->exec_count++;
    g_mutex_unlock(&lock);
}

static void vcpu_tb_trans(qemu_plugin_id_t id, struct qemu_plugin_tb *tb)
{
    uint64_t vaddr = qemu_plugin_tb_vaddr(tb);
    uint32_t n = qemu_plugin_tb_n_insns(tb);

    g_mutex_lock(&lock);
    TBRecord *rec = g_hash_table_lookup(tb_table,
                                         GUINT_TO_POINTER(vaddr));
    if (!rec) {
        rec = g_new0(TBRecord, 1);
        rec->vaddr   = vaddr;
        rec->n_insns = n;
        g_hash_table_insert(tb_table, GUINT_TO_POINTER(vaddr), rec);
    }
    g_mutex_unlock(&lock);

    /* Register a TB-level exec callback */
    qemu_plugin_register_vcpu_tb_exec_cb(tb, vcpu_tb_exec,
                                          QEMU_PLUGIN_CB_NO_REGS,
                                          (void *)rec);
}

static void plugin_exit(qemu_plugin_id_t id, void *p)
{
    GList *vals = g_hash_table_get_values(tb_table);
    /* Sort by exec count descending */
    vals = g_list_sort(vals, (GCompareFunc)({
        int cmp(TBRecord *a, TBRecord *b) {
            return (b->exec_count > a->exec_count) ? 1 : -1;
        }
        cmp;
    }));

    printf("%-18s  %8s  %s\n", "vaddr", "executions", "insns");
    int i = 0;
    for (GList *l = vals; l && i < 20; l = l->next, i++) {
        TBRecord *r = (TBRecord *)l->data;
        printf("0x%016" PRIx64 "  %8" PRIu64 "  %u\n",
               r->vaddr, r->exec_count, r->n_insns);
    }
}

QEMU_PLUGIN_EXPORT int qemu_plugin_install(qemu_plugin_id_t id,
                                             const qemu_info_t *info,
                                             int argc, char **argv)
{
    g_mutex_init(&lock);
    tb_table = g_hash_table_new_full(g_direct_hash, g_direct_equal,
                                      NULL, g_free);

    qemu_plugin_register_vcpu_tb_trans_cb(id, vcpu_tb_trans);
    qemu_plugin_register_atexit_cb(id, plugin_exit, NULL);
    return 0;
}
```

Build:

```makefile
# Makefile for the plugin
QEMU_SRC := /path/to/qemu
CFLAGS   := -shared -fPIC -O2 -g \
            -I$(QEMU_SRC)/include \
            $(shell pkg-config --cflags glib-2.0)
LDFLAGS  := $(shell pkg-config --libs glib-2.0)

libbb_count.so: bb_count.c
	$(CC) $(CFLAGS) -o $@ $< $(LDFLAGS)
```

Run:

```bash
qemu-system-arm -M mps2-an385 -kernel firmware.elf -nographic \
    -plugin ./libbb_count.so
```

---

## Memory Access Profiling with Plugins

`qemu_plugin_register_vcpu_mem_cb` fires on every memory load/store:

```c
static void vcpu_mem(unsigned int vcpu_index,
                     qemu_plugin_meminfo_t meminfo,
                     uint64_t vaddr, void *udata)
{
    bool is_store = qemu_plugin_mem_is_store(meminfo);
    unsigned size = 1u << qemu_plugin_mem_size_shift(meminfo);

    /* Log MMIO accesses (peripheral region: 0x40000000 – 0x5FFFFFFF) */
    if (vaddr >= 0x40000000 && vaddr < 0x60000000) {
        printf("%s @ 0x%08" PRIx64 " sz=%u\n",
               is_store ? "ST" : "LD", vaddr, size);
    }
}

/* In vcpu_tb_trans: */
for (size_t i = 0; i < qemu_plugin_tb_n_insns(tb); i++) {
    struct qemu_plugin_insn *insn = qemu_plugin_tb_get_insn(tb, i);
    qemu_plugin_register_vcpu_mem_cb(insn, vcpu_mem,
                                      QEMU_PLUGIN_CB_NO_REGS,
                                      QEMU_PLUGIN_MEM_RW, NULL);
}
```

---

## Profiling QEMU with Host `perf`

To profile QEMU's own CPU usage (which parts of the emulator are hot):

```bash
# Record while running a workload in guest
perf record -g -F 99 -- \
    qemu-system-arm -M mps2-an385 -kernel firmware.elf -nographic

perf report --stdio
perf report   # interactive TUI
```

Key functions that show up in busy TCG profiles:

| Symbol | Meaning |
|--------|---------|
| `cpu_exec` | Main execution loop |
| `tb_gen_code` | TCG translation (high = many cache misses) |
| `helper_stl_mmu` / `helper_ldl_mmu` | TCG softmmu memory helpers |
| `memory_region_dispatch_read/write` | MMIO dispatch overhead |
| `arm_cpu_do_interrupt` | Exception entry processing |

### Profiling with `perf kvm` (KVM guests)

For x86/aarch64 guests using KVM:

```bash
perf kvm --host --guest stat record -- qemu-system-x86_64 -accel kvm ...
perf kvm stat report --event=exits
```

This separately attributes time to host-side QEMU code vs. guest vCPU execution time.

---

## `-d op_opt` for TCG Analysis

To see the final optimized TCG ops that drive code generation:

```bash
-d op_opt -D /tmp/tcg.log
```

Examining `op_opt` output shows what the TCG optimizer eliminated (dead stores, constant folding) and what survived — useful when investigating unexpected instruction sequences in `out_asm`.
