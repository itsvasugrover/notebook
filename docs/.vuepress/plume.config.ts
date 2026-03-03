/**
 * See the following documentation for theme configuration:
 * - @see https://theme-plume.vuejs.press/config/intro/ Configuration instructions
 * - @see https://theme-plume.vuejs.press/config/theme/ Theme configuration options
 *
 * Note: Modifications to this file do not restart the VuePress service, but take effect via hot update.
 * However, some configuration options do not support hot update. Please refer to the documentation.
 * For options that do not support hot update, configure them in the `.vuepress/config.ts` file.
 *
 * Important: Do not configure the same options in both files. The options in this file will override those in `.vuepress/config.ts`.
 */

import { defineThemeConfig } from "vuepress-theme-plume";
import { enCollections } from "./collections";
// import { enNavbar } from "./navbar";

/**
 * @see https://theme-plume.vuejs.press/config/theme/
 */
export default defineThemeConfig({
  logo: "/avatar.png",

  appearance: true, // Enable dark mode

  social: [
    { icon: "github", link: "https://github.com/itsvasugrover" },
    { icon: "twitter", link: "https://twitter.com/itsvasugrover" },
    { icon: "linkedin", link: "https://www.linkedin.com/in/itsvasugrover/" },
  ],
  navbarSocialInclude: ['github', 'twitter', 'linkedin'], // Allow social links to be displayed in the navbar
  // aside: true, // Page sidebar, displayed on the right by default
  // outline: [2, 3], // Page outline, displays h2 and h3 by default

  /**
   * Article copyright information
   * @see https://theme-plume.vuejs.press/guide/features/copyright/
   */
  copyright: false,

  // prevPage: true,   // Enable previous page link
  // nextPage: true,   // Enable next page link
  // createTime: true, // Display article creation time

  /* Site footer */
  footer: {
    message: "",
    copyright: "© 2026 Vasu Grover. All rights reserved.",
  },

  /* Transition animation @see https://theme-plume.vuejs.press/config/theme/#transition */
  // transition: {
  //   page: true,        // Enable page transition animation
  //   postList: true,    // Enable blog post list transition animation
  //   appearance: 'fade',  // Enable dark mode transition animation, or set animation type
  // },

  locales: {
    "/": {
      /**
       * @see https://theme-plume.vuejs.press/config/theme/#profile
       */
      profile: {
        avatar: "/avatar.png",
        name: "Notes",
        description: "Notes for projects by Vasu Grover",
        // circle: true,
        // location: '',
        // organization: '',
      },

      // navbar: enNavbar,
      collections: enCollections,

      /**
       * Bulletin board
       * @see https://theme-plume.vuejs.press/guide/features/bulletin/
       */
      // bulletin: {
      //   layout: 'top-right',
      //   contentType: 'markdown',
      //   title: '',
      //   content: '',
      // },
    }
  },
});
