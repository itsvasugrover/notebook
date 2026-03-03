---
title: Creating a New Meta Layer
createTime: 2025/12/21 22:21:19
permalink: /kb/embedded/yocto/creating-meta-layer/
---

# Create a New Meta Layer

Layers are the standard way to organize custom code. You should never add your recipes directly to poky/meta.

Steps:

1. Navigate to Your Source Directory:

   ```bash
   cd /path/to/your/yocto-project/
   ```

2. Use the Layer Creation Tool:
   The bitbake-layers script automates layer creation with the correct structure.

   ```bash
   # Syntax: bitbake-layers create-layer <layer-path>
   bitbake-layers create-layer meta-hello
   ```

   This creates a meta-hello directory with the proper structure:

   ```bash
   meta-hello/
   ├── conf
   │   └── layer.conf        # Layer configuration file
   ├── COPYING.MIT          # License file for the layer
   ├── README               # Basic readme
   └── recipes-example
       └── example
           └── example_0.1.bb  # Example recipe
   ```

3. Add the Layer to Your Build:
   Edit your build/conf/bblayers.conf file and add the path to your new layer to the BBLAYERS variable.

   ```bash
   BBLAYERS ?= " \
     /path/to/poky/meta \
     /path/to/poky/meta-poky \
     /path/to/poky/meta-yocto-bsp \
     /path/to/your/yocto-project/meta-hello \
   "
   ```

### Key Points: Creating a Layer

- Use bitbake-layers create-layer to ensure correct structure.
- The conf/layer.conf file is automatically generated and is crucial.
- You must add the layer path to BBLAYERS in bblayers.conf for it to be seen.
