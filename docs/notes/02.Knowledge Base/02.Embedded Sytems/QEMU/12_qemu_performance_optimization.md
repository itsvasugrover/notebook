---
title: QEMU Performance Optimization
createTime: 2026/03/14 14:21:19
permalink: /kb/embedded/qemu/qemu-performance-optimization/
---

# QEMU Performance Optimization

QEMU performance spans several orthogonal dimensions: TCG code generation speed, KVM VM-exit overhead, I/O throughput, and memory access latency. This page covers the mechanisms behind each and the knobs available to tune them.

---

## TCG Execution: The Baseline

Without hardware acceleration, every guest instruction is translated by TCG into host code at runtime. The effective throughput depends on:

1. **Translation block (TB) size**: Larger TBs amortize translation overhead over more native instructions.
2. **TB cache hit rate**: If the same guest code is hot, its TB stays in the cache and executes without retranslation.
3. **TB chaining**: When one TB jumps directly to another, QEMU patches the end of the first TB to jump directly to the start of the second, bypassing the dispatcher. This eliminates most translation-dispatch overhead in tight loops.

### TCG Code Cache Size

The default TCG code cache is 64 MB. For large workloads generating many unique TBs:

```bash
-accel tcg,tb-size=256   # set TB cache to 256 MB
```

Monitor cache occupancy:
```
(qemu) info jit
TCG: code cache size 256M / available 126M
```

### Multi-threaded TCG

By default TCG uses a single thread for all vCPUs. Enable multi-threaded TCG (MTTCG):

```bash
-accel tcg,thread=multi
```

With MTTCG, each vCPU runs as a separate host thread. This improves performance for SMP guests but requires that all device emulation is thread-safe. QEMU upstream has made most device models safe for MTTCG. For embedded single-core targets MTTCG is irrelevant.

**Tradeoff**: MTTCG relaxes memory ordering to the host's model (x86 TSO, ARM weakly ordered). Guest code relying on stricter ordering may behave differently. For test reproducibility on single-core embedded targets, single-thread TCG is safer.

---

## KVM: Hardware Virtualization

KVM (Kernel-based Virtual Machine) uses Intel VT-x / AMD-V hardware extensions to run guest code natively, eliminating TCG entirely for normal execution. Only "privileged" operations cause VM exits.

### When to Use KVM

KVM is appropriate when:
- Guest and host share the same architecture (x86 on x86, AArch64 on AArch64)
- Guest workload is CPU-intensive (compute-bound, not I/O-bound)

KVM is **not available** for cross-architecture emulation (ARM on x86). For embedded Cortex-M targets, TCG is always used.

```bash
# Verify KVM availability
kvm-ok
ls /dev/kvm

# Use KVM
qemu-system-x86_64 -accel kvm -cpu host ...
qemu-system-aarch64 -accel kvm -cpu host ...  # on AArch64 host
```

### Reducing VM Exits

VM exits are expensive (~1000–10000 cycles). Minimize them by:

- **`-cpu host`**: Passes through all host CPU features; the guest uses the same MSRs/registers as the host, reducing trap-on-access exits.
- **VirtIO devices**: The VirtIO protocol batches I/O operations, reducing the number of MMIO accesses (and thus exits) per I/O operation.
- **`-enable-kvm -cpu host,migratable=off`**: Disables migration-unfriendly features but enables maximum performance.

---

## Memory Optimization

### Huge Pages

By default QEMU backs guest RAM with 4 KB anonymous pages. Large pages (2 MB hugepages) reduce TLB pressure significantly for memory-intensive workloads:

```bash
# On the host: allocate 512 hugepages (= 1 GB)
echo 512 | sudo tee /proc/sys/vm/nr_hugepages

# Use hugetlbfs-backed memory
qemu-system-x86_64 -m 1G \
    -mem-path /dev/hugepages \
    -mem-prealloc ...
```

`-mem-prealloc` forces all guest RAM to be faulted in immediately at startup, avoiding gradual page faults during execution.

### Transparent Huge Pages (THP)

Linux THP can automatically back guest RAM with large pages without `hugetlbfs`. Verify it is enabled on the host:

```bash
cat /sys/kernel/mm/transparent_hugepage/enabled
# [always] madvise never
```

QEMU calls `madvise(MADV_HUGEPAGE)` on RAM blocks automatically when THP is `always` or `madvise`.

### NUMA Topology

For multi-socket NUMA hosts, pin QEMU's vCPU threads and guest RAM to the same NUMA node:

```bash
numactl --cpunodebind=0 --membind=0 \
    qemu-system-x86_64 -m 4G -smp 4 -accel kvm ...
```

Crossing NUMA boundaries for memory access adds 50–200 ns latency per access.

---

## CPU Pinning

By default the OS scheduler may migrate QEMU's vCPU threads across physical CPUs, invalidating caches. Pin them:

```bash
# Find QEMU's thread IDs after launch
ps -T -p $(pidof qemu-system-x86_64)

# Pin each vCPU thread to a physical core
taskset -p 0x1 <vcpu0-tid>
taskset -p 0x2 <vcpu1-tid>

# Or at launch with numactl
numactl --physcpubind=2,3 qemu-system-x86_64 ...
```

QEMU also supports `-smp` thread-binding via the `qemu-affinity` script in `scripts/`.

---

## VirtIO: Paravirtualized I/O

VirtIO is a standard for high-performance I/O between a guest driver and a QEMU backend. Instead of emulating a real hardware interface (PCI config cycles, DMA descriptor rings), VirtIO uses shared memory queues (**virtqueues**).

### Virtqueue Mechanism

1. Guest driver places descriptors (buffer address + length) into the **available ring**.
2. Guest writes to the **kick register** (one MMIO write = one VM exit).
3. QEMU host sees the kick, processes all pending descriptors.
4. QEMU places completions in the **used ring**.
5. QEMU injects an interrupt (one VM exit to deliver it, or MSI for x86).

This way, 64 I/O requests share **two** VM exits (kick + interrupt), rather than one exit per register access.

```bash
# VirtIO network card
-device virtio-net-pci,netdev=net0

# VirtIO block device
-drive file=disk.qcow2,format=qcow2,if=virtio

# VirtIO serial
-device virtio-serial-pci -device virtconsole,chardev=con0
```

### vhost-net: Kernel Bypass for Networking

`vhost-net` moves the VirtIO network data path into the Linux kernel (a `vhost-net` kernel thread), bypassing QEMU's userspace for packet processing:

```bash
-netdev tap,id=net0,vhost=on,vhostforce=on \
-device virtio-net-pci,netdev=net0
```

Data path: `guest virtqueue → vhost-net kernel thread → tap fd → kernel bridge/route`

This eliminates two user-kernel context switches per packet burst, achieving near-native network throughput (~10 Gbps range).

### vhost-user: DPDK Userspace Networking

`vhost-user` passes packet buffers via shared memory to a DPDK (or OVS-DPDK) process running in userspace:

```bash
-chardev socket,id=vhu0,path=/tmp/vhost.sock \
-netdev vhost-user,id=net0,chardev=vhu0,queues=2 \
-device virtio-net-pci,netdev=net0,mq=on
```

The DPDK application polls the shared memory ring in a busy loop — no kernel involvement, achieving < 1 µs latency for packet processing.

---

## Block Layer Optimization

### `aio=native` and `cache=none`

For maximum block throughput on Linux, use native Linux AIO with direct I/O (bypassing the page cache):

```bash
-drive file=/dev/sdb,format=raw,if=virtio,cache=none,aio=native
```

`cache=none` sets `O_DIRECT`, bypassing the host page cache. `aio=native` uses `io_submit`/`io_getevents` (Linux AIO) instead of thread-pool async I/O.

### `aio=io_uring`

`io_uring` (Linux 5.1+) outperforms native AIO for most workloads by submitting multiple I/O operations with a single system call:

```bash
-drive file=disk.qcow2,format=qcow2,if=virtio,cache=none,aio=io_uring
```

### Discard/TRIM

Enable TRIM pass-through so the guest can free blocks:

```bash
-drive file=disk.qcow2,format=qcow2,if=virtio,discard=unmap
```

---

## IOMMU and VFIO Device Passthrough

VFIO (Virtual Function I/O) allows QEMU to pass a physical PCIe device directly to the guest, bypassing emulation entirely:

```bash
# Bind device to vfio-pci driver (host)
echo 0000:03:00.0 > /sys/bus/pci/devices/0000:03:00.0/driver/unbind
echo "10de 1b80" > /sys/bus/vfio/drivers/vfio-pci/new_id

# QEMU with VFIO device
qemu-system-x86_64 \
    -device vfio-pci,host=03:00.0 \
    -accel kvm ...
```

Combined with an IOMMU (Intel VT-d / AMD-Vi), VFIO provides DMA address translation, protecting host memory from a misbehaving guest device while still giving the guest direct hardware access.

---

## Performance Measurement

```bash
# Measure guest CPU throughput vs host
# Inside guest:
sysbench cpu --cpu-max-prime=20000 run

# Compare KVM vs TCG
# With TCG:
qemu-system-x86_64 -accel tcg ...
# With KVM:
qemu-system-x86_64 -accel kvm ...

# Guest network throughput (iperf3)
iperf3 -s   # inside guest
iperf3 -c guest-ip -t 10 -P 4   # from host

# Block device throughput (fio inside guest)
fio --name=randread --filename=/dev/vda --rw=randread \
    --bs=4k --iodepth=64 --numjobs=4 --time_based --runtime=10
```

Monitor QEMU's VM exit stats (KVM only):

```bash
# Per-VM exit type counters
cat /sys/kernel/debug/kvm/exits
# or
perf kvm stat record -- qemu-system-x86_64 ...
perf kvm stat report
```
- **Resource Efficiency**: Minimizing the host system's resource usage.
