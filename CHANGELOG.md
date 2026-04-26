# Changelog

All notable changes to graceglyph are documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and the project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Pre-1.0: minor versions may break, patches do not. Every breaking change
ships with a migration note in this file.

## [Unreleased]

### Added

- §11 `create-graceglyph` now ships the full six-template lineup the roadmap
  calls for. Existing `dashboard`, `cli-tool`, `log-viewer`, `crud-app` plus:
  - `chat` — streaming chat UI driven by `<Stream>` consuming an async
    iterable (token-by-token render, ready to swap in any provider).
  - `editor` — two-pane file browser + textarea editor with live char/line
    counts.
- `--theme <id>` flag accepts every built-in palette (light, dark,
  solarized-light/dark, tokyo-night, nord, dracula, gruvbox, tarnished).
  The scaffolded `src/main.tsx` boots the selected theme via
  `render(<AppRoot />).setTheme(builtInThemes["..."])`.
- Help / list output now documents the available themes alongside the
  template list. Unknown templates and themes fail with a precise
  `unknown template:` / `unknown theme:` message instead of silently
  defaulting.
- 4 new node:test cases in `test/create.test.ts` covering chat / editor
  template scaffolding, the `--theme` bootstrap, and rejection paths for
  bad CLI args. Full suite: 249 pass, 0 fail; tsc --noEmit clean; build
  green.
- §10 perf bench harness fleshed out to all five roadmap workloads:
  `static-frame`, `table-scroll`, `resize-storm`, `log-stream` (100k-line
  tail), and `input-storm` (1000 mixed key + mouse events). Every case
  reports `p50` / `p95` / `p99` / `max` / RSS along with mean and median.
  `npm run bench` prints a comparison-friendly table; `npm run bench --
  --json` emits a structured payload for CI consumption (with Node
  version, platform, arch). 3 new node:test cases assert registration,
  per-workload smoke runs, and finite-percentile output.
- §8 animation & async batch:
  - `src/runtime/frame.ts` — shared 60Hz scheduler. A single `setInterval`
    starts when the first subscriber registers and tears down when the last
    one leaves, so idle CPU stays at zero (the §8 acceptance bar). Exposes
    `subscribeFrame`, plus `frameSchedulerActive` /
    `frameSubscriberCount` diagnostics for tests.
  - `src/runtime/motion.ts` — `createMotion(initial, opts)` returns a
    `MotionHandle` that interpolates numbers, vectors, or arrays over the
    frame loop. Cubic-bezier preset library (`linear`, `easeIn`, `easeOut`,
    `easeInOut`, plus cubic / quart / back variants) and a closed-form
    `spring()` solver. `motion()` one-shot helper for callers that don't
    need a long-lived handle.
  - `useFrame(callback, deps?)` and `useMotion(target, opts?)` hooks, both
    auto-unsubscribing on unmount.
  - `<Transition>` component with `show` toggle and presets (`fade`,
    `slide-up` / `down` / `left` / `right`, `expand`, `bounce`). Optional
    `unmount: true` removes children from the tree once the leave animation
    settles.
  - `<Stream>` component for async iterables. Owns its own buffer, drops
    head entries past `bufferLimit`, and cancels the iterator on unmount;
    `paused` halts iteration without losing buffered chunks.
- 7 new node:test cases in `test/motion.test.ts` covering scheduler
  lifecycle, easing endpoints, spring convergence, motion frame-driven
  interpolation, scheduler tear-down after completion, Transition unmount
  cycle, and Stream incremental rendering. Full suite: 242 pass, 0 fail;
  tsc --noEmit clean; build green.
- ASCII-art rendering primitives in `src/components-ascii.tsx`:
  - `AsciiArt` — multi-line canvas that preserves spacing exactly, with
    optional border and start/center/end alignment.
  - `BigText` — figlet-style block-letter renderer backed by a bundled
    5-row block font (A–Z, 0–9, space, hyphen, period, !, ?, :). Falls back
    to a question-mark glyph for unknown characters; accepts a `glyph`
    override so apps can swap in `*`, `▒`, etc.
  - `Banner` — title (BigText) + optional subtitle + optional artwork,
    bordered and centered by default.
  - `SplashScreen` — full-canvas splash composer with left/right info
    panels and a footer slot.
  - `figletBlock(text, opts?)` exported standalone for callers that want
    the multi-line string without the renderer.
- New `tarnished` built-in theme: high-contrast amber-on-black palette
  designed for splash screens and ASCII canvases. Rendered identically
  on truecolor, 256-color, and ANSI-16 terminals via the existing
  `downgrade` color pipeline.
- `examples/tarnished-splash.tsx` and `dev:tarnished` /
  `example:tarnished` scripts: a working "Build legendary interfaces"
  splash composed of `AsciiArt`, `BigText`, panels, and `Kbd` hints,
  modeled on the Lands Between mockup.
- 8 new node:test cases in `test/components-ascii.test.ts` covering
  glyph row count, alignment math, glyph overrides, banner composition,
  splash layout, and theme registration. Full suite: 235 pass, 0 fail;
  tsc --noEmit clean; npm run build green.
- Public exports and package-root tests for the §6 chrome, form, and temporal
  component batches: `IconButton`, `Avatar`, `Pill`, `Chip`, `Card`,
  `ProgressRing`, `KeyHints`, `Sidebar`, `TopBar`, `BottomBar`, `StatusBar`,
  `Notifications`, `Combobox`, `Autocomplete`, `MultiSelect`, `MaskedInput`,
  `Form`, `FormField`, `ErrorMessage`, `Wizard`, `ErrorBoundary`, `Suspense`,
  `Calendar`, `DatePicker`, and `TimePicker`.
- Host-level accessibility metadata via `accessibilityLabel` and
  `accessibilityDescription`, surfaced in the inspector and accepted by the
  §6 component families.
- `docs/component-library.md` component matrix tracking public exports,
  tokenization, tests, stories, and accessibility coverage for the §6 gate.
- §7 app-shell upgrades: nested `Router` / `Route` composition, scoped
  command registration/filtering, and chord hotkeys such as `g g`.
- Components gallery extended with stories for the chrome, form, resilience,
  and temporal components, plus refreshed dashboard metadata for the full §6
  framework library surface.
- §6 charts batch: `LineChart`, `BarChart`, `Histogram`, `Gauge`, `Heatmap`,
  plus a shared `autoDomain` helper. Theme tokens under `chart.*` propagated
  through every built-in palette.
- §6 file/visualization closeout: `Markdown` (headings, lists, code fences,
  inline bold/italic/code/links — `parseMarkdown` exported standalone),
  `FilePicker` (lazy-expand `FileEntry` tree), `PathBreadcrumbs`, `DataGrid`
  (Table + in-place cell edit driven at the wrapper to keep focus on the
  host), and `Popover` (top/bottom/left/right placement; Escape closes).
- 31 new node:test cases in `test/components-batch5-8.test.ts` covering the
  §6 chrome, form, temporal, chart, file, and overlay primitives — full
  suite at 227 tests, 0 fail; tsc --noEmit clean; build green.
- Visualization components: `Code` (lightweight syntax highlighting for
  json / javascript / typescript / plain, optional line numbers, line
  highlight), `JSONViewer` (recursive collapsible tree built on the same
  token coloring), `DiffView` (unified-diff parser plus +/- coloring,
  optional line numbers and hunk separators), and `LogStream` (severity
  highlight, substring or regex filter, pause/resume, configurable
  timestamps and level glyphs).
- New `src/highlight/index.ts` with `highlight(source, language)` and
  `tokensByLine(tokens)` helpers — re-exported from the package root for
  apps that want to drive their own renderers.
- Theme tokens for `code.*`, `diff.*`, and `log.*`, propagated through
  every built-in palette.
- `parseUnifiedDiff(text)` exported from the package root for callers that
  want the parser without rendering.
- Components gallery extended with a fourth screen demonstrating Code,
  DiffView, JSONViewer, and a live LogStream with filter and pause.
- Data-display components: `Table` (column definitions, sortable headers,
  optional virtualized window via `height`, zebra striping, sticky header,
  keyboard navigation), `Tree` (recursive expand/collapse, indent guides,
  caller-controlled `expanded` map), `Accordion` (single- or multi-open),
  `Stepper` (row/column with pending/active/complete glyphs and connector),
  `Pagination` (windowed numeric buttons with first/last/prev/next),
  `EmptyState`, and `Tooltip` (placement: top/bottom/left/right) — all
  shipped in `src/components-data.tsx`.
- Theme tokens for the new data components: `table.{header,row,rowSelected,
rowAlt}`, `tree.{guide,node}`, `accordion.{header,headerOpen}`,
  `stepper.{pending,active,complete,connector}`, `pagination.{normal,active,
disabled}`, `tooltip` — wired through every built-in palette.
- Components gallery extended with a third screen demonstrating the table,
  tree, accordion, stepper, pagination, tooltip, and empty state.
- Second batch of tier-1/tier-2 components: `Slider`, `RangeSlider`,
  `NumberInput` (typed numeric input with arrow stepping and clamp),
  `PasswordInput` (built on the new `mask` prop), `ToggleButton`,
  `ButtonGroup`, `Select` (single-select dropdown with overlay-positioned
  list), and `Skeleton` (single- or multi-line pulsing placeholder).
- `mask` prop on the `input` host (and `TextInput`): replace each rendered
  grapheme with a single glyph for password-style fields without touching
  the underlying value or cursor math.
- Components gallery example expanded with a second screen demonstrating the
  new inputs, range slider, dropdown, toggle group, and loading skeletons.
- Tier-1 form primitives: `Checkbox`, `Switch`, `RadioGroup` (with
  `RadioOption`), `Divider`, and `Kbd`. All keyboard-focusable, theme-aware,
  and consistent with the existing `Button` / `TextInput` prop shape.
- Tier-2 display primitives: `Badge` (neutral/info/success/warning/danger
  variants), `Tag` (with optional `onRemove` and Backspace/Delete handling),
  `ProgressBar` (determinate, indeterminate, partial-cell glyph fill, optional
  percent suffix), `Spinner` (preset frame sets `dots`, `line`, `arc`,
  `bouncingBar`, `pipe`), and `Sparkline` (auto-domain, downsampled).
- Theme tokens for the new components — `checkbox`, `switch`, `progress`,
  `spinner`, `sparkline`, `badge`, `tag`, `divider`, `kbd` — wired through
  every built-in palette.
- `examples/components-gallery.tsx` plus `dev:components` and
  `example:components` scripts showcasing every new primitive in the
  dashboard shell.
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

- `applyEditableKey` no longer marks `up`/`down`/`pageup`/`pagedown` as
  handled in single-line mode, so wrapper components like `NumberInput`
  receive the bubble. Multi-line behavior is unchanged.
- Cleaned up `.gitignore` (removed Go-template leftovers).
- `tsconfig.json` no longer excludes parts of `src/`. The entire source
  tree type-checks.

### Removed

- Legacy imperative widget set (`src/widgets/`) and its dependencies
  (`src/core/application.ts`, `src/core/events.ts`, `src/input/focus.ts`).
  These were excluded from the build and superseded by `components.tsx`
  and `app-shell.tsx`.
- `AGENTS.md` is no longer tracked.
