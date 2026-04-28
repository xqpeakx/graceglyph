# Changelog

All notable changes to graceglyph are documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and the project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Pre-1.0: minor versions may break, patches do not. Every breaking change
ships with a migration note in this file.

## [Unreleased]

### Added

- §7 navigation hardening:
  - `Route` now accepts `canLeave?: boolean | (() => boolean)`.
  - `canNavigateRoute(currentPath, nextPath, children)` evaluates active
    route guard chains before allowing navigation.
  - `AppShell` now accepts `canNavigate(currentPath, nextPath)` and applies
    it to breadcrumb/Escape back navigation.
  - Deep-link helpers `resolveDeepLinkPath(...)` and
    `resolveDeepLinkPathFromArgv(...)` normalize query/hash-heavy paths and
    skip option values while scanning argv.
- §9 testkit DX:
  - `renderTestApp` now exposes `snapshotAnsi()` for full ANSI regression
    snapshots alongside plain-frame `snapshot()`.
  - `renderTestApp(..., { cap })` now supports deterministic capability
    simulation (`"dumb"`, `"full"`, color-depth presets, or explicit
    overrides) for terminal-profile-specific assertions.
  - Added `renderComponent(<Component />)` convenience helper for component-
    scoped fixtures that do not need an explicit app wrapper.
  - Added user-event ergonomics on `TestApp.user`:
    `click(locator)`, `type(locator, text)`, `keyboard("{Tab}{Enter}")`,
    `hover(locator)`, and `drag(source).drop(target)`.
  - Accessibility query locators are now available:
    `getByRole`, `queryAllByRole`, and `getByLabel`.
  - Fake-timer controls are now available directly on `TestApp`:
    `useFakeTimers()`, `advanceTimersByTime(ms)`, `runAllTimers()`, and
    `useRealTimers()`. Timers are scoped to one active test app at a time.
  - Async helpers landed for act-free tests:
    `waitFor(...)`, `queryByText`, `getByText`, `findByText(...)`,
    `findByRole(...)`, and `findByLabel(...)`.
  - Parser fuzz/property coverage now includes `fast-check` invariants for
    chunked vs monolithic parsing parity and full pending-buffer drain.
  - New `TestLocator` / `TestRole` types exported from package root.
- New test coverage in `test/app-shell.test.ts` and `test/testing.test.ts`
  for route guard behavior, query/hash route normalization, deep-link argv
  parsing, ANSI snapshots, and accessibility queries.
- Persistent-state backend now prefers filesystem storage:
  `~/.config/<app>/state.json` by default, with
  `GRACEGLYPH_STATE_FILE`, `GRACEGLYPH_APP_ID`, and `XDG_CONFIG_HOME`
  overrides; localStorage remains a fallback.
- Runtime hook compatibility pass: `useState` in `src/runtime/hooks.ts`
  stores values in a signal-backed cell internally while preserving existing
  hook semantics and fiber scheduler behavior.
  - Effect flushing ownership moved from `src/runtime/reconciler.ts` into
    `src/runtime/hooks.ts` via `flushAllFiberEffects(...)`, shrinking
    reconciler responsibilities while keeping a deprecated compatibility
    shim export (`flushAllEffects`) for existing tests/integrations.
  - Host-tree assembly ownership moved from `src/runtime/reconciler.ts`
    into `src/runtime/host.ts` (`buildHostTree(...)`), with a deprecated
    reconciler compatibility shim retained for migration safety.
  - Fiber compatibility hooks now carry deprecation annotations (`useState`,
    `useEffect`, `useRef`, `useMemo`, `useCallback`) to steer new code
    toward signal primitives (`createSignal`, `createEffect`, `createMemo`).
  - Compatibility hooks now emit one-time runtime deprecation warnings
    outside test runs, clarifying migration targets and planned removal.
  - Runtime timing now uses shared `runtime/clock.nowMs()` across
    reconciler, frame scheduler, and perf timeline to keep monotonic clock
    behavior consistent while reducing duplicated timing helpers.
  - Host-type classification now lives in `runtime/host`
    (`isRenderableHostType`) and reconciler consumes that source of truth.
  - Reconciler tests now flush effects through `flushAllFiberEffects(...)`
    by default; deprecated `flushAllEffects(...)` is covered by an explicit
    compatibility test.
- Added initial `Image` component primitive in `src/components.tsx` with
  capability-aware protocol selection (`auto` -> kitty/sixel/iTerm2/ascii),
  ASCII fallback rendering, and test coverage in `test/components.test.ts`.
- CI/dx alignment:
  - Added `c8` coverage tooling and `npm run test:coverage`.
  - CI now runs dedicated coverage and bench jobs.
  - Bench CI now enforces roadmap thresholds via
    `scripts/check-bench-thresholds.mjs` and `npm run bench:check`
    (static-frame paint/diff, table-scroll, resize-storm).
  - Added benchmark drift gating via `bench/baseline.json` and
    `scripts/check-bench-drift.mjs` (`npm run bench:drift`), now wired into
    the CI bench job as an early-regression signal alongside hard thresholds.
  - Added benchmark comparison harness `scripts/bench-compare.mjs` and
    `npm run bench:compare`, plus placeholder competitor result artifacts for
    Ink, blessed, and terminal-kit under `bench/competitors/*.json`.
  - Added `npm run bench:prof` and `bench/README.md` profiling guidance for
    `node --prof` / `node --prof-process` workflows on scenario-filtered runs.
  - Bootstrapped docs site infrastructure with VitePress under `docs/site`,
    including initial pages for Getting Started, Concepts, Component Index,
    and Migration Notes. Added `docs:dev`, `docs:build`, `docs:preview` and a
    dedicated CI docs job (`npm run docs:build`).
- Added docs expansion pages for migration from Ink/blessed, capabilities
  matrix, performance workflow, and troubleshooting guidance.
- Added `docs/site/why-graceglyph.md` and linked it in docs navigation to
  document positioning and trade-offs vs Ink/Textual.
- Extended `create-graceglyph` with a `plugin` template that scaffolds a
  plugin-author package (`src/index.ts`, `test/plugin.test.ts`, build/test
  scripts) for ecosystem package development.
- Added plugin versioning policy documentation (`docs/site/plugin-versioning.md`)
  and linked it in docs navigation for ecosystem package maintainers.
  - Added `.github/workflows/codeql.yml` to run CodeQL on pushes, pull
    requests, and a weekly schedule for JavaScript/TypeScript analysis.
  - Bench docs updated to match actual CI behavior.
- Bug-report typing/runtime fix in `src/runtime/bug-report.ts` restored
  clean `npm run typecheck` by aligning inspector tree types and call shape.

- §14 plugin protocol shipped. `src/plugin.ts` exposes
  `GraceglyphPlugin`, `createPluginRegistry`, and `definePlugin`.
  Plugins contribute components, themes, commands, render middleware,
  and an optional `setup(context)` hook with a teardown thunk. Resolution
  follows last-registration-wins; commands aggregate and dedupe by id;
  middleware runs in registration order with per-plugin error isolation
  (a thrown middleware function logs and the chain continues with the
  prior node). `registry.activate()` returns a single LIFO disposer that
  runs `setup` cleanups and then unregisters every plugin command.
- 9 new node:test cases in `test/plugin.test.ts` covering id
  validation, dedupe-on-replace, theme/component last-write-wins,
  command aggregation, setup/cleanup ordering, middleware threading,
  and error survival. Public exports: `createPluginRegistry`,
  `definePlugin`, `GraceglyphPlugin`, `PluginRegistry`, `PluginContext`,
  `PluginMiddleware`, `PluginRenderInfo`. Full suite: 278 pass, 0 fail;
  tsc --noEmit clean; build green.
- §13 flagship apps — final three binaries:
  - `gg-files` — real directory browser via `fs.readdir` + `fs.stat`.
    Sorts directories first; preview pane reads the first 8 KB of any
    text file (binary buffers are flagged via NUL-byte sniff). `--all`
    shows dotfiles. `PathBreadcrumbs` lets the user jump back to any
    parent in one click.
  - `gg-git` — shells out to `git status --porcelain`, `branch
    --show-current`, `rev-list --left-right --count`, `diff`, and
    `log` via `execFile`. Tabs route between Status / Diff / Log;
    `parseUnifiedDiff` powers the diff pane.
  - `gg-chat` — pluggable streaming chat client. `echoModel` reflects
    the user's input token-by-token via `Stream`-style consumption.
    Real providers swap into a single `ChatModel` interface — the
    renderer is provider-agnostic.
- 10 new node:test cases covering byte/text formatting, directory
  listing sort + hidden filter, porcelain parsing edge cases, argv
  handling for all three apps, and echoModel iteration shape.
  `bin` entries: `gg-files`, `gg-git`, `gg-chat`. Helper npm scripts:
  `app:gg-files`, `app:gg-git`, `app:gg-chat`. Full suite: 269 pass,
  0 fail; tsc --noEmit clean; build green. **§13 complete** — all
  five flagship apps ship from the main package.
- §13 flagship apps — first two binaries ship as part of the main package:
  - `gg-logs` (apps/gg-logs/index.tsx) — real `tail -f` over fs.watch.
    Accepts one or more file paths via argv, supports substring/`/regex/`
    filtering, severity inference from log shapes (DEBUG/INFO/WARN/ERROR),
    ISO-8601 timestamp extraction, pause/resume, and theme override.
  - `gg-monitor` (apps/gg-monitor/index.tsx) — live CPU / memory / load
    average dashboard built on `os.cpus()` / `os.totalmem()` /
    `os.loadavg()`. Per-core BarChart, CPU history Sparkline, threshold-
    aware Gauges, and human-readable byte / uptime formatting.
- New `bin` entries: `gg-logs` and `gg-monitor` in package.json so the
  binaries land in `node_modules/.bin` once the package publishes. Helper
  npm scripts `app:gg-logs` and `app:gg-monitor` for development.
- Pure helpers (`parseLine`, `parseArgs`, `deltaUtil`, `snapshot`)
  exported from each app for unit-test consumption.
- 10 new node:test cases in `test/apps.test.ts` covering log parsing,
  argv handling, severity inference, ISO timestamp pickup, CPU delta
  math, and SystemSnapshot shape. Full suite: 259 pass, 0 fail; tsc
  --noEmit clean; build green.
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
