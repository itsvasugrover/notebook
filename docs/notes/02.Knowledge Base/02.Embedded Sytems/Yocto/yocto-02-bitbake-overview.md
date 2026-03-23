---
title: BitBake Overview
createTime: 2025/12/21 22:21:19
permalink: /kb/embedded/yocto/bitbake-overview/
---

# BitBake Overview

## What BitBake Is

BitBake is a **generic task execution engine** — conceptually similar to GNU Make but with a Python-based metadata language, a parallel task scheduler, and a shared-state cache system. It is maintained as a standalone project by the OpenEmbedded community and used by both Yocto and OpenEmbedded builds.

The core job: read a collection of text files (recipes, configuration, classes), construct a dependency graph of all tasks needed to satisfy a build request, then execute those tasks in the correct order — parallelising where possible, skipping tasks whose outputs are cached.

## Parsing Phases

BitBake startup follows four sequential phases before any task executes:

```
Phase 1: Configuration Parsing
  └─ Read bitbake.conf → site.conf → local.conf → bblayers.conf
  └─ Result: global DataStore (the `d` object at conf scope)

Phase 2: Recipe Parsing
  └─ For each .bb file found via BBFILES:
     ├─ Parse recipe variables into per-recipe DataStore
     ├─ Apply inherited .bbclass files (inject task functions)
     └─ Apply .bbappend files from higher-priority layers

Phase 3: Dependency Resolution
  └─ Build task dependency graph from DEPENDS, RDEPENDS, [deptask], [recrdeptask]
  └─ Generate task hash (signature) for each node

Phase 4: Task Execution
  ├─ Check sstate-cache for matching hash
  ├─ If hit:  restore cached output via do_setscene (~1 second)
  └─ If miss: execute task, then write output to sstate-cache
```

## The DataStore (`d` Object)

Every recipe runs with its own DataStore — a key/value store holding all variables for that recipe's context. In Python code within a recipe or class, `d` is always the DataStore:

```python
python do_my_task() {
    # Read a variable
    srcdir = d.getVar('S')

    # Write a variable
    d.setVar('MY_FLAG', '1')

    # Expand a variable (process ${} references)
    workdir = d.expand('${WORKDIR}/output')

    # Append to a variable
    d.appendVar('CFLAGS', ' -DMY_DEFINE=1')
}
```

## Variable Assignment Operators

BitBake has distinct assignment operators with different expansion semantics. This is the #1 source of hard-to-diagnose build problems.

| Operator | When `${VAR}` expands | Notes |
|----------|-----------------------|-------|
| `VAR = "val"` | Parse time | Standard assignment |
| `VAR := "val"` | Forced parse time | Immediately expands RHS |
| `VAR ?= "val"` | Parse time | Only if VAR not already set |
| `VAR ??= "val"` | Parse time | Lowest priority default |
| `VAR += "val"` | Parse time | Appends with a space |
| `VAR .= "val"` | Parse time | Appends without space |
| `VAR:prepend = "val"` | At variable read time | Applied after all `=` assignments |
| `VAR:append = "val"` | At variable read time | Applied after all `=` assignments |
| `VAR:remove = "val"` | At variable read time | Removes token from the value |

The `:append` and `:prepend` operators use a **deferred model** — stored as modifiers, applied to the final value only when the variable is read. This is why a `.bbappend` can use `SRC_URI:append = " file://patch.patch"` and guarantee the result, regardless of parse order.

## sstate-cache: Task Hash Mechanics

The sstate-cache is BitBake's most important performance feature. Each task has a **signature hash** computed from:

1. The set of input variables that affect that task's output
2. The task's function body (shell or Python code)
3. The signatures of all tasks it depends on

If the computed hash matches an entry in the sstate-cache, BitBake runs `do_setscene` — restoring cached output in seconds instead of recompiling.

```bash
# Inspect what went into a task's hash signature
bitbake-dumpsig -d tmp/stamps/<arch>/<recipe>/<ver>/do_compile.sigdata.<hash>

# Compare two signatures to find why a cache miss occurred
bitbake-dumpsig -d <sig1> <sig2>
```

Common cause of unexpected cache misses: a variable included in sigdata that changes between builds (e.g., a `DATE` variable, hostname, or a `SRCREV` pointing at a moving branch). Add such variables to `BB_HASHBASE_WHITELIST` to exclude them from hash computation.

## Task Execution and Parallelism

```bash
# Number of BitBake tasks running simultaneously (across recipes)
BB_NUMBER_THREADS = "8"   # typically = number of logical CPUs

# Parallelism within a single make invocation
PARALLEL_MAKE = "-j 8"
```

BitBake maintains a runqueue of ready tasks (tasks whose dependencies are all complete) and feeds them to a thread pool of `BB_NUMBER_THREADS` workers. Multiple recipes can compile simultaneously.

## Anonymous Python Functions

BitBake supports anonymous Python functions that run **at parse time** (not at task execution time), useful for computing variable values dynamically:

```python
# Runs when the recipe is parsed, before any task executes
python () {
    machine = d.getVar('MACHINE')
    if machine.startswith('raspberrypi'):
        d.setVar('ENABLE_GPU', '1')
    else:
        d.setVar('ENABLE_GPU', '0')
}
```

## Useful Introspection Commands

```bash
# Dump the complete variable environment for a recipe (invaluable for debugging)
bitbake -e myrecipe | grep ^WORKDIR=
bitbake -e myrecipe | grep ^SRC_URI=
bitbake -e myrecipe > /tmp/env.txt

# Show which layer provides a recipe
bitbake-layers show-recipes | grep my-recipe

# Show the task dependency graph (generates .dot files)
bitbake -g core-image-minimal
dot -Tsvg task-depends.dot > task-deps.svg

# List all tasks for a recipe
bitbake -c listtasks myrecipe

# Open an interactive shell with the recipe's full build environment
bitbake -c devshell myrecipe
```
