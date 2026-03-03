/**
 * See the following documentation for theme configuration:
 * - @see https://theme-plume.vuejs.press/config/intro/ Configuration instructions
 * - @see https://theme-plume.vuejs.press/config/theme/ Theme configuration options
 *
 * Note: Any modification to this file will restart the VuePress service.
 * Some configuration options do not require a restart; it is recommended to configure them in `.vuepress/config.ts`.
 *
 * Important: Do not configure the same options in both files. The options in this file will be overridden.
 */

import { viteBundler } from "@vuepress/bundler-vite";
import { defineUserConfig } from "vuepress";
import { plumeTheme } from "vuepress-theme-plume";

export default defineUserConfig({
  base: "/",
  lang: "en-US",
  locales: {
    "/": {
      title: "Notes",
      lang: "en-US",
      description: "Notes for projects by Vasu Grover",
    },
    // "/zh/": {
    //   title: "笔记",
    //   lang: "zh-CN",
    //   description: "瓦苏·格罗弗 的项目笔记",
    // },
    // "/ja/": {
    //   title: "ノート",
    //   lang: "ja-JP",
    //   description: "ヴァス・グローバー のプロジェクトノート",
    // },
    // "/ko/": {
    //   title: "노트",
    //   lang: "ko-KR",
    //   description: "바수 그로버 의 프로젝트 노트",
    // },
  },

  head: [
    // Configure site icon
    [
      "link",
      {
        rel: "icon",
        type: "image/png",
        href: "/avatar.png",
      },
    ],
  ],

  bundler: viteBundler(),
  shouldPrefetch: false, // Not recommended to enable if the site is large or has many pages

  theme: plumeTheme({
    /* Add your deployment domain, helps with SEO and generates sitemap */
    hostname: 'https://notes.itsvasugrover.com',

    /* Documentation repository configuration, used for editLink */
    // docsRepo: '',
    // docsDir: 'docs',
    // docsBranch: '',

    /* Page information */
    // editLink: true,
    // lastUpdated: true,
    // contributors: true,
    // changelog: false,

    /**
     * Build cache, speeds up compilation
     * @see https://theme-plume.vuejs.press/config/theme/#cache
     */
    cache: "filesystem",

    /**
     * Automatically add frontmatter configuration to markdown files
     * @see https://theme-plume.vuejs.press/config/theme/#autofrontmatter
     */
    autoFrontmatter: {
      permalink: true,  // Generate permanent link
      createTime: true, // Generate creation time
      title: true,      // Generate title
    },

    /* Local search, enabled by default */
    search: { provider: "local" },

    /**
     * Algolia DocSearch
     * To enable this search, set local search to false
     * @see https://theme-plume.vuejs.press/config/plugins/search/#algolia-docsearch
     */
    // search: {
    //   provider: 'algolia',
    //   appId: '',
    //   apiKey: '',
    //   indices: [''],
    // },

    /**
     * Shiki code highlighting
     * @see https://theme-plume.vuejs.press/config/plugins/code-highlight/
     */
    codeHighlighter: {
      twoslash: true, // Enable twoslash
      whitespace: true, // Enable space/Tab highlighting
      lineNumbers: true, // Enable line numbers
    },

    /* Article word count and reading time, set to false to disable */
    // readingTime: true,

    /**
     * markdown
     * @see https://theme-plume.vuejs.press/config/markdown/
     */
    markdown: {
      abbr: true,         // Enable abbr syntax  *[label]: content
      annotation: true,   // Enable annotation syntax  [+label]: content
      pdf: true,          // Enable PDF embedding @[pdf](/xxx.pdf)
      caniuse: true,      // Enable caniuse syntax  @[caniuse](feature_name)
      plot: true,         // Enable hidden text syntax !!xxxx!!
      bilibili: true,     // Enable embedded bilibili video syntax @[bilibili](bid)
      youtube: true,      // Enable embedded YouTube video syntax @[youtube](video_id)
      artPlayer: true,    // Enable embedded artPlayer local video syntax @[artPlayer](url)
      audioReader: true,  // Enable embedded audio reading feature @[audioReader](url)
      icon: { provider: 'iconify' },        // Enable built-in icon syntax  ::icon-name::
      table: true,        // Enable enhanced table container syntax ::: table
      codepen: true,      // Enable embedded codepen syntax @[codepen](user/slash)
      replit: true,       // Enable embedded replit syntax @[replit](user/repl-name)
      codeSandbox: true,  // Enable embedded codeSandbox syntax @[codeSandbox](id)
      jsfiddle: true,     // Enable embedded jsfiddle syntax @[jsfiddle](user/id)
      npmTo: true,        // Enable npm-to container  ::: npm-to
      demo: true,         // Enable demo container  ::: demo
      collapse: true,     // Enable collapse container  ::: collapse
      repl: {             // Enable code demo containers
        go: true,         // ::: go-repl
        rust: true,       // ::: rust-repl
        kotlin: true,     // ::: kotlin-repl
        python: true,     // ::: python-repl
      },
      math: {             // Enable math formulas
        type: 'katex',
      },
      chartjs: true,      // Enable chart.js
      echarts: true,      // Enable ECharts
      mermaid: true,      // Enable mermaid
      flowchart: true,    // Enable flowchart
      image: {
        figure: true,     // Enable figure
        lazyload: true,   // Enable image lazy loading
        mark: true,       // Enable image marking
        size: true,       // Enable image sizing
      },
      include: true,      // Import other markdown file content in Markdown files
      imageSize: 'local', // Enable auto-fill image width and height attributes to avoid page jitter
    },

    /**
     * Watermark
     * @see https://theme-plume.vuejs.press/guide/features/watermark/
     */
    // watermark: true,

    /**
     * Comments
     * @see https://theme-plume.vuejs.press/guide/features/comments/
     */
    comment: {
      provider: 'Giscus', // "Artalk" | "Giscus" | "Twikoo" | "Waline"
      comment: true,
      repo: 'itsvasugrover/notebook',
      repoId: 'R_kgDORdRbKw',
      category: 'General',
      categoryId: 'DIC_kwDORdRbK84C3l12',
      mapping: 'pathname',
      reactionsEnabled: true,
      inputPosition: 'top',
    },

    /**
     * Asset link replacement
     * @see https://theme-plume.vuejs.press/guide/features/replace-assets/
     */
    // replaceAssets: 'https://cdn.example.com',

    /**
     * Encryption feature
     * @see https://theme-plume.vuejs.press/guide/features/encryption/
     */
    // encrypt: {},

    /**
     * Enable llmstxt plugin for more LLM-friendly content
     * @see https://theme-plume.vuejs.press/guide/features/llmstxt/
     */
    llmstxt: {
      // locale: '/',    // By default, only generate LLM-friendly content for the main language
      locale: 'all',  // Generate LLM-friendly content for all languages
    },
    
    plugins: {
      llmstxt: true, // Enable llmstxt plugin
    }
  }),
});
