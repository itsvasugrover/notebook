---
title: Writing a Hello World Recipe
createTime: 2025/12/21 22:21:19
permalink: /kb/embedded/yocto/hello-world-recipe/
---

# Writing a "Hello World" Recipe

Let's create a simple recipe for a "Hello World" C program.

1. Create the Recipe Directory Structure:
   Inside your meta-hello layer:

   ```bash
   mkdir -p recipes-hello/hello/files
   ```

   - recipes-hello/: Category directory for all "hello" related recipes.
   - hello/: Specific recipe directory.
   - files/: Directory for storing patches and source files.

2. Write the "Hello World" Source Code:
   Create recipes-hello/hello/files/hello.c:

   ```c
   #include <stdio.h>

   int main() {
       printf("Hello, Yocto World!\n");
       return 0;
   }
   ```

3. Write the Recipe File:
   Create recipes-hello/hello/hello_1.0.bb:

   ```bash
   SUMMARY = "A simple Hello World program"
   LICENSE = "GPL-2.0-only"
   LIC_FILES_CHKSUM = "file://${COMMON_LICENSE_DIR}/GPL-2.0-only;md5=801f80980d171dd6425610833a22dbe6"

   # Tell bitbake where to find the source. The 'file://' protocol looks in the 'files' subdirectory.
   SRC_URI = "file://hello.c"

   # This is where the source will be unpacked. 'WORKDIR' is a bitbake variable for the build directory.
   S = "${WORKDIR}"

   # We override the do_compile task to tell it how to build our simple program.
   do_compile() {
       ${CC} ${CFLAGS} ${LDFLAGS} hello.c -o hello
   }

   # We override the do_install task to tell it how to install the binary into the target image.
   do_install() {
       # Create the target bin directory (e.g., /usr/bin) inside the image (D is the destination)
       install -d ${D}${bindir}
       # Install the binary, setting execute permissions
       install -m 0755 hello ${D}${bindir}
   }
   ```

4. Build and Test:

   ```bash
   bitbake hello
   ```

   You can test the binary without building a full image:

   ```bash
   # Find the binary in the temporary build directory
   find tmp/work/ -name "hello" -type f
   # Run the binary from the work directory to verify it works
   ./tmp/work/<arch>/hello/<version>/image/usr/bin/hello
   # Output: Hello, Yocto World!
   ```

### Key Points: Hello World Recipe

- Recipe filename follows `<packagename>_<version>.bb` format.
- SRC_URI = "file://..." fetches source from the local files directory.
- do_compile and do_install are the minimal tasks you often need to override for simple programs.
- `${D}` is the root of the target filesystem during installation.
- `${bindir}` automatically expands to the correct binary directory (e.g., /usr/bin).
