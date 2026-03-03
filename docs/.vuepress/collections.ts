/**
 * @see https://theme-plume.vuejs.press/guide/collection/ See the documentation for configuration details.
 *
 * Collections configuration file, which is imported in `.vuepress/plume.config.ts`.
 *
 * Note: You should configure Collections here before starting VuePress. The theme will read the Collections configured here when VuePress starts,
 * and then automatically generate permalinks in Markdown files related to the Collection.
 *
 * When the collection's type is `post`, it represents a document list type (i.e., no sidebar, but with a document list page).
 * This can be used for blog, columns, or other document collections aggregated as article lists (for relatively fragmented content).
 *
 * When the collection's type is `doc`, it represents a document type (i.e., with a sidebar).
 * This can be used for notes, knowledge bases, or documentation collections with a sidebar (for strongly related, systematic content).
 * If the sidebar does not appear, please check your configuration and whether the permalink in the Markdown file
 * starts with the prefix configured in the Collection's link. Whether the sidebar is displayed is determined by whether the page link's prefix matches the `collection.link` prefix.
 */

/**
 * Supported IDEs will provide intelligent hints for configuration options.
 *
 * - `defineCollections` is a helper function for defining a collection group
 * - `defineCollection` is a helper function for defining a single collection configuration
 *
 * Collection configurations defined by `defineCollection` should be included in `defineCollections`.
 */
import { defineCollection, defineCollections } from "vuepress-theme-plume";

/* =================== locale: en-US ======================= */

const enNotes = defineCollection({
  // Type 'doc', this type includes a sidebar
  type: "doc",
  // Directory of the document collection, relative to `docs/`
  dir: "notes",
  // All markdown files in the directory pointed to by `dir` must have permalinks starting with the `linkPrefix` configuration
  // If the prefix does not match, the sidebar cannot be generated.
  // So please ensure all markdown file permalinks start with '/' + `linkPrefix`
  linkPrefix: "/",
  // Document title, used for display in the page breadcrumb navigation
  title: "Notes",
  // Manually configure the sidebar structure
  // sidebar: ["", "foo", "bar"],
  // Automatically generate the sidebar based on file structure
  sidebar: 'auto',
  sidebarCollapsed: true, 
});

export const enCollections = defineCollections([enNotes]);

/* =================== locale: zh-CN ======================= */

// const zhNotes = defineCollection({
//   type: "doc",
//   dir: "zh",
//   linkPrefix: "/",
//   title: "笔记",
//   sidebar: 'auto',
//   sidebarCollapsed: true, 
// });

// export const zhCollections = defineCollections([zhNotes]);

/* =================== locale: ja-JP ======================= */

// const jaNotes = defineCollection({
//   type: "doc",
//   dir: "ja",
//   linkPrefix: "/",
//   title: "ノート",
//   sidebar: 'auto',
//   sidebarCollapsed: true, 
// });

// export const jaCollections = defineCollections([jaNotes]);

/* =================== locale: ko-KR ======================= */

// const koNotes = defineCollection({
//   type: "doc",
//   dir: "ko",
//   linkPrefix: "/",
//   title: "노트",
//   sidebar: 'auto',
//   sidebarCollapsed: true, 
// });

// export const koCollections = defineCollections([koNotes]);
