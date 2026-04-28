# @graceglyph/markdown

`@graceglyph/markdown` is the first external plugin package shipped alongside
core `graceglyph`.

## Package

- Name: `@graceglyph/markdown`
- Location in this repository: `packages/graceglyph-markdown`
- Plugin id: `@graceglyph/markdown`

## Features

- `MarkdownDocument` component:
  - normalizes task-list markers (`- [ ]` / `- [x]`) to visible check glyphs
  - rewrites bare links (`https://...`) into markdown links for consistent render
- `MarkdownCard` component:
  - wraps markdown content in a panel shell for app dashboards and inspectors
- `createMarkdownPlugin(options?)`:
  - contributes `MarkdownDocument` and `MarkdownCard` to the plugin registry
  - optionally registers a markdown help command (`markdown.help`)

## Example

```ts
import { createPluginRegistryFromConfig, renderWithPlugins } from "graceglyph";
import { createMarkdownPlugin } from "@graceglyph/markdown";

const registry = await createPluginRegistryFromConfig(
  { plugins: [createMarkdownPlugin({ defaultWidth: 72 })] },
  process.argv, // supports --plugin and -p flags
);
const dispose = registry.activate();
```

Or bootstrap render + plugin loading in one call:

```ts
const app = await renderWithPlugins(<AppRoot />, {
  plugins: [createMarkdownPlugin({ defaultWidth: 72 })],
  argv: process.argv,
});
```
