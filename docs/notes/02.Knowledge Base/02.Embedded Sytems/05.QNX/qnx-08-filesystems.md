---
title: QNX Filesystems
createTime: 2026/03/25 00:00:00
permalink: /kb/embedded/qnx/filesystems/
---

# QNX Filesystems

## Filesystem Architecture

In QNX, **every filesystem is a user-space resource manager** process. There is no filesystem code in the kernel. This means:
- A filesystem crash never takes down the OS
- Filesystems can be unmounted and remounted at runtime
- Custom filesystems are just regular user-space processes

### Filesystem Stack

```
Application
  │  open("/mnt/data/file.txt", O_RDONLY)
  ▼
C Library (POSIX VFS layer)
  │  MsgSend → resolves path to filesystem resource manager
  ▼
Filesystem Resource Manager (e.g., fs-qnx6.so)
  │  MsgSend → block device driver
  ▼
Block Device Driver (e.g., devb-sdmmc)
  │  hardware I/O
  ▼
Hardware (eMMC, SD card, NVMe, etc.)
```

---

## Filesystem Types

### QNX6 (Power-Safe Filesystem)

**QNX6** is the primary filesystem for QNX systems. It is a **journaled, power-safe** filesystem designed to guarantee consistency even after a sudden power loss.

Key properties:
- **Atomic transactions**: All metadata updates are transactional
- **Power-safe**: A hard reset at any point leaves the filesystem in a consistent state (never needs `fsck`)
- **Snapshots**: QNX6 maintains two superblock copies; one is always consistent
- **Case-sensitive**: Default behavior
- **Max file size**: 4 GB (32-bit variant) or up to filesystem capacity (64-bit superblock)
- **Block size**: 512 bytes to 64 KB (typically 4 KB)

```bash
# Format a partition as QNX6
mkqnx6fs /dev/hd0t79           # t79 = QNX6 partition type
mkqnx6fs -b 4096 /dev/sd0t79  # 4 KB block size

# Mount QNX6
mount -t qnx6 /dev/sd0t79 /mnt/data

# Or via fs-qnx6.so resource manager (OEM boards)
fs-qnx6 /dev/sd0t79 /mnt/data

# Check filesystem (safe even without unmount)
chkqnx6fs /dev/sd0t79
```

### etfs (Embedded Transaction Filesystem)

**etfs** is QNX's flash-native filesystem optimized for raw NAND/NOR flash (without FTL):

```bash
# Format NAND flash partition
etfsctl -f /dev/fs0 -b 512 -e 16384  # 512-byte page, 16 KB erase block
# Mount etfs
devf-generic -s 0x20000000,0x2000000  # physical base, size
mount -t etfs /dev/fs0 /mnt/flash
```

etfs features:
- Wear-leveling
- Bad block management
- Transaction safety
- Designed for NAND/NOR without hardware FTL

### FAT (devfs-fat)

For interoperability with Windows/Linux:
```bash
# Mount FAT filesystem (FAT12/16/32 auto-detected)
dosfsck /dev/sd0t11            # check FAT (t11 = FAT type)
mount -t dos /dev/sd0t11 /mnt/usb

# Mount with specific options
mount -t dos -o ro,iconv=utf8 /dev/sd0t11 /mnt/usb
```

### tmpfs (RAM filesystem)

```bash
# Mount a tmpfs (backed by system RAM)
mount -t tmpfs tmpfs /tmp
mount -t tmpfs -o size=64m tmpfs /var/run
```

### procfs

```bash
# /proc is mounted at boot by procnto itself
# View process memory maps
cat /proc/4097/maps

# Thread information
cat /proc/4097/as
```

### devfs

The `/dev/` namespace is not a filesystem per se — it is a **dynamic namespace** managed by resolved paths pointing to resource manager processes.

---

## Block Device Drivers (devb-*)

Block devices are managed by the `devb-*` family of drivers. They register block devices in the `/dev/` namespace and provide a block-level resource manager interface to filesystem drivers.

| Driver | Device |
|--------|--------|
| `devb-ahci` | SATA (AHCI) |
| `devb-nvme` | NVMe SSDs |
| `devb-sdmmc` | SD/eMMC |
| `devb-umass` | USB Mass Storage |
| `devb-ram` | RAM disk |
| `devb-mtd-*` | MTD (raw flash) |

```bash
# Start the SATA driver
devb-ahci blk automount=hd0 cam pnpload

# Start the SD/eMMC driver
devb-sdmmc blk automount=sd0 sdio

# After drivers start, block devices appear:
ls /dev/hd0*    # hd0, hd0t77, hd0t79, ...
ls /dev/sd0*    # sd0, sd0t12, ...

# Partition names follow the pattern:
# /dev/sd0     - raw disk
# /dev/sd0t12  - partition of type 12 (FAT16)
# /dev/sd0t79  - partition of type 79 (QNX6)
```

### Disk Partitioning

```bash
# Create a partition table using fdisk equivalent
dinit /dev/sd0                          # initialize with MBR
fdisk /dev/sd0                          # interactive partition editor

# Low-level: write partition table directly
# Using mkqnx6fs on an unpartitioned device
mkqnx6fs -N 65536 /dev/sd0             # file count hint
```

---

## Filesystem Mount Command Reference

```bash
# Mount a QNX6 USB drive
mount -t qnx6 /dev/umass0t79 /mnt/usb

# Mount FAT32 SD card read-only
mount -t dos -o ro /dev/sd0t12 /mnt/sd

# Mount NFS (requires io-pkt running)
mount -t nfs -o nolock 192.168.1.10:/exports /mnt/nfs

# Mount CIFS/SMB
mount -t cifs -o username=user,password=pass //192.168.1.10/share /mnt/smb

# Show all mounted filesystems
mount

# Unmount
umount /mnt/usb
```

---

## Filesystem Cache

QNX uses a **block cache** managed by the `io-blk.so` shared library. The block cache:
- Caches recently read/written disk blocks in RAM
- Write-through or write-back mode configurable
- Shared across all processes using the same block device

```bash
# Configure block device cache size (512 KB cache minimum)
devb-sdmmc blk cache=8m,vnode=512 sdio

# Flush all caches
sync

# Drop caches (for benchmarking or low-memory situations)
sync && echo 3 > /proc/sys/vm/drop_caches  # Linux-style, some QNX versions
```

---

## Filesystem Paths and the Virtual Namespace

QNX uses a **unified virtual namespace** where each path component is resolved by finding the resource manager responsible for that prefix:

```
/usr/local/bin/myapp
   │
   ├── /usr → resolved by qnx6 filesystem at /dev/sd0t79
   └── local/bin/myapp → resolved within qnx6

/dev/ser1
   └── resolved by devc-ser8250 resource manager

/proc/4097/maps
   └── resolved by procnto process manager

/net/192.168.1.5/tmp
   └── resolved by QNET remote filesystem
```

```bash
# See which resource manager owns a path
mount              # shows all registered path prefixes
ls -la / /dev /proc /net
findmnt            # (if available)
```

---

## POSIX File Operations Reference

All standard POSIX file operations work identically on QNX:

```c
#include <fcntl.h>
#include <unistd.h>
#include <sys/stat.h>
#include <dirent.h>

/* Open / Read / Write / Close */
int fd = open("/mnt/data/log.bin", O_WRONLY | O_CREAT | O_TRUNC, 0644);
write(fd, buf, len);
fdatasync(fd);   /* Flush data to media (important for power-safe writes) */
close(fd);

/* Seek */
lseek(fd, 0, SEEK_SET);
lseek64(fd, large_offset, SEEK_SET);

/* Directory operations */
DIR *dir = opendir("/mnt/data");
struct dirent *entry;
while ((entry = readdir(dir)) != NULL) {
    printf("%s\n", entry->d_name);
}
closedir(dir);

/* Stat */
struct stat st;
stat("/mnt/data/log.bin", &st);
printf("Size: %lld bytes\n", (long long)st.st_size);

/* Creating directories */
mkdir("/mnt/data/logs", 0755);

/* Rename (atomic on same filesystem) */
rename("/mnt/data/tmp.bin", "/mnt/data/final.bin");

/* Symbolic links */
symlink("/mnt/data/current.log", "/tmp/log");

/* Hard links */
link("/mnt/data/file.bin", "/mnt/backup/file.bin");
```

---

## Flash Filesystem with MTD

For NOR/NAND flash devices without FTL:

```bash
# Start MTD flash driver for NOR flash at 0x20000000
devf-generic -s 0x20000000,0x02000000

# Erase the flash
flashctl -p /dev/fs0 -ev           # -e erase, -v verbose

# Mount etfs
mount -t etfs /dev/fs0 /mnt/flash

# Write file to flash
cp /usr/bin/myapp /mnt/flash/

# etfs status
etfsctl -s /dev/fs0
```

---

## Filesystem Performance Tips

```bash
# Use larger block size for sequential workloads
mkqnx6fs -b 65536 /dev/sd0t79   # 64 KB blocks

# Enable write caching (data at risk on power loss for non-journaled regions)
devb-sdmmc blk cache=32m,vnode=2048 ...

# For read-heavy workloads, increase vnode (inode) cache
devb-sdmmc blk vnode=4096 ...

# Sequential I/O: use large read() sizes (64 KB+)
# Avoid repeated small writes; use buffered I/O or batch writes

# Check filesystem stats
df -h           # disk free / usage
du -sh /mnt     # directory size
```

---

## Filesystem Summary Table

| Type | Best Use | Journaled/Safe | Flash Native | POSIX |
|------|----------|----------------|--------------|-------|
| QNX6 | General purpose, eMMC, SSD | Yes | No | Full |
| etfs | Raw NAND/NOR flash | Yes | Yes | Full |
| FAT32 | USB interop, SD cards | No | No | Limited |
| tmpfs | /tmp, /run, volatile data | N/A (RAM) | N/A | Full |
| NFS | Network storage, development | Server-side | No | Most |
| QNX4 (legacy) | Old systems only | No | No | Full |
| ramfs/devfs | /dev namespace | N/A | N/A | N/A |
