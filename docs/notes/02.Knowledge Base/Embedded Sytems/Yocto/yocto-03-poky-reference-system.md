---
title: Poky Reference System
createTime: 2025/12/21 22:21:19
permalink: /kb/embedded/yocto/poky-reference-system/
---

# Poky Reference System

Poky is the reference build system of the Yocto Project. It is a combination of BitBake and a set of metadata (recipes, configuration files, classes) that form a working, baseline build environment.

Think of it this way:

- Yocto Project is the specification and umbrella project.
- Poky is a ready-to-use, working example of that specification.
- BitBake is the tool that Poky uses to do the actual building.

What's inside Poky?

- BitBake: The tool itself.
- OpenEmbedded-Core (oe-core): A core set of metadata (recipes, classes, etc.) that are system-agnostic and form the foundation of any build. This provides the base functionality.
- Poky-specific metadata: Reference distribution policy configuration (poky.conf) and reference machine definitions.

Getting Started: When you download Poky, you get a fully functional build system that can immediately start building a basic Linux image.

## Key Points: Poky

- The reference distribution and build system for the Yocto Project.
- A combination of BitBake + OpenEmbedded-Core + Metadata.
- Used to bootstrap a new project and as a working example to learn from.
- You typically start with Poky and then customize it for your specific needs.
