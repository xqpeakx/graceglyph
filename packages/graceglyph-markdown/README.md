# @graceglyph/markdown

Expanded markdown plugin package for `graceglyph`.

## What it provides

- `createMarkdownPlugin(options?)` plugin factory (`id: "@graceglyph/markdown"`).
- `MarkdownDocument` component (task-list + bare-link normalization before render).
- `MarkdownCard` component (panel-wrapped markdown surface).

## Install

```bash
npm install @graceglyph/markdown graceglyph
```

## Use

```ts
import { createPluginRegistry } from "graceglyph";
import { createMarkdownPlugin } from "@graceglyph/markdown";

const registry = createPluginRegistry().use(createMarkdownPlugin({ defaultWidth: 72 }));
const dispose = registry.activate();
```

## Local development

```bash
npm run build
npm test
```
