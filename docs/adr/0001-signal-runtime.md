# ADR-0001: Replace fiber + hooks reconciler with signals

- Status: Proposed
- Date: 2026-04-25
- Deciders: maintainers
- Refs: ROADMAP §2

## Context

The current runtime reimplements a small subset of React: fibers, a
reconciler (`src/runtime/reconciler.ts`), and a hooks system
(`src/runtime/hooks.ts`). It supports `useState`, `useEffect`, `useRef`,
`useMemo`, `useCallback`, and a handful of framework-specific hooks.

This costs us:

- A reconciler that has to compete with React's decade of edge-case work
  (keyed reorder, Suspense semantics, concurrent mode, error boundaries).
- A custom hooks model with the rules-of-hooks footgun and no devtools
  integration with the wider React ecosystem.
- Re-render granularity at the component level. A signal change anywhere
  in a tree forces re-running its component function, which is wasteful
  for a renderer where the cost of paint is per-cell.
- A "almost React" surface that loses to "actual React" forever — Ink
  occupies the React-renderer-for-Node niche.

graceglyph's positioning (ROADMAP §0) is "Textual for TypeScript," not
"Ink with extras." That positioning is undermined by mimicking React.

## Decision

Replace the reconciler with a signals + fine-grained reactivity runtime in
the SolidJS lineage:

- `signal<T>(initial)` — readable value plus a setter; reads inside reactive
  scopes register a dependency.
- `memo<T>(fn)` — derived signal recomputed when its dependencies change.
- `effect(fn)` — runs on mount and again whenever any read signal changes;
  returns a disposer.
- `resource<T>(fetcher)` — async signal that exposes `loading`, `error`,
  `data`, and `refetch`. Replaces the existing `useAsync` hook.
- `batch(fn)` — coalesces multiple sets into a single reactive flush.
- `untrack(fn)` — read signals without subscribing the current scope.
- `root(fn)` — tracking root that owns a tree of effects and is disposed
  with the tree.

Components are plain `(props) => ZenElement` functions that run **once at
mount**. Reactive reads inside JSX subscribe their nearest host node, so a
signal change paints only the affected cells — typically a single `<Text>`
or attribute on a `<box>`.

Lifecycle hooks (`onMount`, `onCleanup`) are exposed as functions, not
hooks-rules-of-hooks-style positional calls.

We ship a compatibility layer for one minor version that exports
`useState`, `useEffect`, `useRef`, `useMemo`, `useCallback` as thin
adapters over the signal primitives so existing examples and external
code keep working. The shim is removed in v0.3.

## Consequences

Easier:

- Cell-granular updates. A keystroke into `<TextInput>` repaints one row,
  not the whole panel.
- Predictable execution: no "why did my component re-render twice in
  StrictMode" questions, because components don't re-run.
- Smaller runtime surface area to test.
- A natural fit for streaming primitives (§8) and async resources.

Harder:

- Migration cost: every component, hook, and test currently relies on
  React-shaped behavior. The compat shim absorbs most of it; some
  framework-internal hooks have to be rewritten.
- Mental-model shift for users who think in React. The migration guide
  has to be excellent.
- We give up future cheap interop with React libraries (we never had
  much) and with React DevTools.

## Alternatives considered

- **Keep the fiber reconciler.** Cheapest, but it fails the positioning
  test and locks in a worse-than-React experience forever.
- **Adopt `react-reconciler` and host React directly.** Wins on
  ecosystem, loses on bundle size, perf, and "Textual for TypeScript"
  thesis. Ink already occupies that slot — building a second one does
  not differentiate.
- **Elm/TEA-style message passing.** Predictable but verbose; raises the
  bar for trivial UIs and isn't where the wider TypeScript community is.
- **Vue-style proxy reactivity.** Equivalent on capability; signals are
  closer to what library authors are converging on (Solid, Preact
  signals, Svelte 5 runes, Angular signals).

## Rollout

1. Land `src/_internal/reactive/` with `signal`, `memo`, `effect`,
   `batch`, `untrack`, `root`. Tested in isolation.
2. Land `src/_internal/reactive/resource.ts` with the async primitive.
3. Rewrite `src/runtime/host.ts` to subscribe host nodes to signals read
   while building their props.
4. Replace `src/runtime/reconciler.ts` with a one-pass tree builder that
   creates host nodes inside reactive scopes.
5. Keep `src/runtime/hooks.ts` as a compat shim that maps `useState` to
   `signal`, `useEffect` to `effect`, etc. Mark each export `@deprecated`
   in v0.2.
6. Remove the shim in v0.3.

Each step is one PR with one ADR update and full test coverage.

### Progress (2026-04-27)

- Step 1 is complete via `src/reactive/*` + `test/reactive.test.ts`.
- Step 5 is underway:
  - compatibility hooks are signal-backed where possible (`useState`)
  - compatibility hooks are explicitly `@deprecated`
  - runtime emits one-time migration warnings for compatibility hooks.
- Runtime responsibilities have started moving out of the reconciler:
  - effect traversal now lives in `runtime/hooks` (`flushAllFiberEffects`)
  - host-tree assembly now lives in `runtime/host` (`buildHostTree`),
    with deprecated reconciler shims preserved during migration.
