---
title: Layers
createTime: 2025/12/21 22:21:19
permalink: /kb/embedded/yocto/layers/
---

# Layers: The Organizational Structure

A layer is a collection of related metadata (recipes, configuration files, classes, etc.) that allows you to organize and customize your build without modifying the core components.

Purpose: Separation of Concerns. Layers let you compartmentalize functionality.

- meta-oe: General OpenEmbedded recipes.
- meta-browser: Recipes for browsers (e.g., Chromium, Firefox).
- meta-mylayer: Your custom, in-house layer for your company's specific applications and configurations.

Key File: Every layer must have a conf/layer.conf file. This file identifies the layer to the build system.

- It defines the BBPATH additions.
- It sets the BBFILES variable to tell BitBake where to find the recipes in this layer.
- It can specify layer dependencies (LAYERDEPENDS) and compatibility (LAYERSERIES_COMPAT).

Priority: Layers have a priority. If two layers define the same recipe, the one from the layer with the higher priority is used. This is managed in conf/bblayers.conf.

## Key Points: Layers

- Containers for metadata (recipes, configs, etc.).
- Promote modularity and reusability.
- conf/layer.conf is the mandatory configuration file for a layer.
- Order matters! Layer priority is set in conf/bblayers.conf.
