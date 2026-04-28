# Component Authoring Template

Use the component template to bootstrap publishable `graceglyph` UI packages:

```bash
# component-only entrypoint
npx create-graceglyph-component my-component-kit

# equivalent generic entrypoint
npx create-graceglyph my-component-kit --template component
```

## What it scaffolds

- package metadata with `graceglyph` as a peer dependency
- TS + JSX config for component packages
- starter component (`StatTile`) in `src/index.tsx`
- render-level component test in `test/component.test.ts`

## Intended flow

1. Replace `StatTile` with your package's primitives.
2. Add component snapshots and interaction tests.
3. Publish under a scoped package (`@your-scope/...`) and declare support range
   for `graceglyph`.
