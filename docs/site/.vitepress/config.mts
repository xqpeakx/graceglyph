import { defineConfig } from "vitepress";

export default defineConfig({
  title: "graceglyph",
  description: "A next-generation TUI framework for TypeScript",
  srcDir: ".",
  themeConfig: {
    nav: [
      { text: "Getting Started", link: "/getting-started" },
      { text: "Why graceglyph", link: "/why-graceglyph" },
      { text: "Concepts", link: "/concepts" },
      { text: "Components", link: "/components/" },
      { text: "Migration", link: "/migration-notes" },
      { text: "Performance", link: "/performance" },
      { text: "Capabilities", link: "/capabilities-matrix" },
      { text: "Plugin Policy", link: "/plugin-versioning" },
    ],
    sidebar: [
      {
        text: "Guide",
        items: [
          { text: "Getting Started", link: "/getting-started" },
          { text: "Why graceglyph", link: "/why-graceglyph" },
          { text: "Concepts", link: "/concepts" },
          { text: "Migration Notes", link: "/migration-notes" },
          { text: "Migration from Ink", link: "/migration-from-ink" },
          { text: "Migration from blessed", link: "/migration-from-blessed" },
          { text: "Troubleshooting", link: "/troubleshooting" },
          { text: "Plugin Versioning", link: "/plugin-versioning" },
        ],
      },
      {
        text: "Reference",
        items: [
          { text: "Component Index", link: "/components/" },
          { text: "Capabilities Matrix", link: "/capabilities-matrix" },
          { text: "Performance", link: "/performance" },
        ],
      },
    ],
    socialLinks: [{ icon: "github", link: "https://github.com/<owner>/graceglyph" }],
    search: {
      provider: "local",
    },
  },
});
