# Changelog

All notable changes to graceglyph are documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and the project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Pre-1.0: minor versions may break, patches do not. Every breaking change
ships with a migration note in this file.

## [Unreleased]

### Added

- ROADMAP.md describing the path to v1.0.
- ADR directory under `docs/adr/`.
- Reactive primitives in `src/reactive/`: `createSignal`, `createMemo`,
  `createEffect`, `createResource`, `createRoot`, `batch`, `untrack`,
  `onCleanup`. Solid-style fine-grained reactivity with auto-batching for
  diamond-safe at-most-once-per-tick effect runs. See ADR-0001.
- Token-aware styling DSL in `src/style/`: `style()`, `style.merge(...)`,
  tagged-template `css`, state variants, breakpoint variants, spacing tokens,
  and direct host support for style rules.
- Theme token namespaces (`color`, `space`, `radius`, `font`, `motion`,
  `breakpoints`) plus eight built-in themes: `light`, `dark`,
  `solarized-light`, `solarized-dark`, `tokyo-night`, `nord`, `dracula`,
  and `gruvbox`.
- Runtime theme switching through `Runtime#setTheme`, `render(...).setTheme`,
  and `useSetTheme()`.
- Host-level layout modes for `box`: grid tracks (`fixed`, `auto`, `fr`,
  `minmax(...)`), dock regions, absolute positioning, and `zIndex` paint
  ordering. Public `Grid`, `Dock`, and `DockSlot` helpers use the same
  substrate.
- Layout constraints on boxes: `minWidth`, `maxWidth`, `minHeight`,
  `maxHeight`, and `aspectRatio`, surfaced through the inspector.
- Responsive box layout patches via `breakpoints`, keyed by theme breakpoint
  names or comparator queries like `>=100`, plus `display="none"` for
  removing boxes from layout, paint, focus, and hit testing.
- Terminal capability detection (`src/render/capabilities.ts`): truecolor,
  256-color, OSC 8 hyperlinks, kitty graphics, sixel, iTerm2 inline images,
  synchronized output (mode 2026), bracketed paste, focus reporting.
- Color downgrade pipeline (`src/render/color.ts`): hex/rgb/named parsing,
  truecolor → 256 → 16 → mono fallback, cached.
- Synchronized frame commits when terminal advertises mode 2026.
- `<Link>` component emitting OSC 8 with underlined-text fallback.
- Benchmark harness skeleton under `bench/`.
- CI workflow (`.github/workflows/ci.yml`) running tsc, build, and tests on
  Node 18/20/22 across Linux, macOS, and Windows.
- Project meta files: `CONTRIBUTING.md`, `SECURITY.md`, `CODE_OF_CONDUCT.md`,
  issue and PR templates.
- Prettier and ESLint configuration with `lint` and `format` npm scripts.

### Changed

- Cleaned up `.gitignore` (removed Go-template leftovers).
- `tsconfig.json` no longer excludes parts of `src/`. The entire source
  tree type-checks.

### Removed

- Legacy imperative widget set (`src/widgets/`) and its dependencies
  (`src/core/application.ts`, `src/core/events.ts`, `src/input/focus.ts`).
  These were excluded from the build and superseded by `components.tsx`
  and `app-shell.tsx`.
- `AGENTS.md` is no longer tracked.
