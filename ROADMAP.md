# graceglyph: Roadmap to a category-leading TUI framework

Status: draft. Owner: @cooley. Target horizon: 6–9 months to v1.0.

## Implementation status (rolling)

- [x] §7 route leave guards via `Route.canLeave` and `canNavigateRoute(...)`.
- [x] §7 deep-link normalization helpers (`resolveDeepLinkPath*`) for argv/path inputs.
- [x] §9 testkit ANSI snapshot support via `app.snapshotAnsi()`.
- [x] §9 testkit accessibility queries via `getByRole` and `getByLabel`.

This document is the plan to take graceglyph from "another Node TUI" to the
default choice for terminal apps in TypeScript. It is opinionated on purpose.
Where two paths exist, one is chosen and the other is named so it stays dead.

## 0. Thesis

graceglyph is **"Textual for TypeScript."** Not "Ink with extras." Not a
React-compatible renderer. The wager is:

- Node + TypeScript developers want to build full terminal applications, not
  CLI prompts. Ink solves prompts. Nothing in the JS ecosystem solves apps.
- The framework that wins ships: a styling DSL, a real component library,
  animations, async/streaming primitives, capability detection (truecolor /
  hyperlinks / kitty graphics / sixel), and a docs site with a live preview —
  in the same package.
- The runtime model is **signals + fine-grained reactivity**, not React fibers.
  This is the single biggest architectural decision in the document. See §2.

Anti-goals (explicit, called out so we don't drift):

- Not a React renderer. We will never ship a `react-graceglyph`.
- Not a prompts library. `prompts`, `enquirer`, `inquirer` already exist.
- Not a cross-runtime curses replacement for blessed/blessed-contrib users.
- Not a cross-language port. Node + Bun + Deno, that's it.

Kill criteria (we abandon and recommend Ink/Textual if any of these hit):

- Six months in, no flagship app outside the repo built by a non-author.
- v0.x adoption never crosses 1,000 weekly downloads on npm.
- Frame time at 10k cells stays >50ms after the perf pass.

---

## 1. Foundation pass (weeks 1–2)

Stop pretending the repo is shipped. Make `main` honest.

- Land or revert every uncommitted file. No more "actively hardened" while
  `app-shell.tsx`, `testing.ts`, `create.ts`, and `dashboard-shell.tsx` sit
  untracked. Open one branch per logical chunk and merge.
- Delete `src/widgets/*`. The imperative widget set is superseded and excluded
  from `tsconfig`. Dead code in `main` is a trust hit.
- Re-include or delete: `src/core/application.ts`, `src/core/events.ts`,
  `src/input/focus.ts`, `src/theme/*`. Either tsc compiles all of `src/` or
  we have a build hole.
- Remove `AGENTS.md` from the public repo. Move to `.local/` or out of tree.
- Add CI: GitHub Actions matrix on Node 18/20/22, Bun latest, Deno latest.
  Steps: `tsc --noEmit`, `npm test`, `npm run build`, `node --test dist/`.
- Add `CHANGELOG.md` (Keep a Changelog), `CONTRIBUTING.md`, `SECURITY.md`,
  `CODE_OF_CONDUCT.md`, `.github/ISSUE_TEMPLATE/*`, `.github/PULL_REQUEST_TEMPLATE.md`.
- Add `.editorconfig`, `prettier`, `eslint` (typescript-eslint strict),
  pre-commit via `simple-git-hooks` or `husky`.
- Set up `changesets` for version management.
- Publish `graceglyph@0.1.0` to npm under `--tag next`. Real install URL.
- Add coverage via `c8`, gate at 85% lines / 80% branches in CI.

Acceptance: `git status` is clean on `main`, CI is green on three runtimes,
`npm i graceglyph@next` installs and runs the README hello world end-to-end.

---

## 2. Runtime decision: signals over fibers (weeks 2–4)

The current custom fiber + hooks reconciler will lose to React forever. It
will also lose to SolidJS-style signal runtimes on perf and to Elm/TEA on
predictability. Pick one.

**Decision: signals + fine-grained reactivity** (Solid-style), with
component functions that run once and reactive primitives that drive
targeted re-renders of host nodes.

Rationale:

- TUI is render-cell-bounded. Reactivity that scopes updates to a single
  `<Text>` avoids reconciling thousands of cells per keystroke.
- Hooks-rules-of-hooks is a footgun we don't need to import.
- Component-runs-once is easier to teach to backend developers, who are the
  audience.
- We get `createSignal`, `createMemo`, `createEffect`, `createResource`
  semantics that map cleanly onto `useAsync`, `useInterval`, etc.

Work:

- Replace `src/runtime/fiber.ts`, `reconciler.ts`, `hooks.ts` with a signal
  graph: `signal`, `memo`, `effect`, `resource`, `batch`, `untrack`, `root`.
- New `src/runtime/component.ts`: components are `(props) => ZenElement`,
  run once at mount. Reactive reads inside JSX subscribe their host nodes.
- Keep `src/runtime/host.ts` mostly intact — it already paints and lays out.
  Hosts now subscribe to the signals their props read.
- Migrate `editable.ts`, `focus.ts`, `devtools.ts` to read from signals.
- New JSX runtime that compiles to direct host-node creation calls (no
  intermediate fiber tree). Optional: support both classic and automatic.
- Provide a `useState`-shaped compatibility shim for the first minor version
  so existing examples keep working, then remove in v0.3.

Acceptance:

- All existing tests pass against the signal runtime (port the assertions,
  not the implementation).
- New benchmark: 10k-cell frame at <8ms p50, <16ms p99 on M-class laptop.
- Memory: 50MB resident max for the showcase app.

Alternative considered and rejected: full React via `react-reconciler`. Wins
on ecosystem, loses on bundle size, perf, and the "Textual for TypeScript"
positioning. Ink already occupies that slot.

---

## 3. Rendering & terminal capability layer (weeks 3–6)

The renderer needs to be excellent before the component library matters.

- Capability detection module `src/render/capabilities.ts`:
  - truecolor (`COLORTERM`, `TERM` patterns, terminfo where available)
  - 256-color fallback
  - hyperlinks (OSC 8)
  - kitty graphics protocol
  - sixel
  - iTerm2 inline images
  - underline styles (curly, dotted, double, color)
  - synchronized output (BSU/ESU, mode 2026)
  - title setting, cursor shape, bracketed paste, focus reporting
- Color pipeline: accept hex/rgb/hsl/named, downgrade per capability, cache
  the conversion. Truecolor → 256 → 16 → mono fallback chain.
- Synchronized output: wrap every frame commit in BSU/ESU when supported.
  Eliminates tearing on long frames.
- Image primitives: `<Image src=... protocol="auto">` that picks kitty,
  sixel, iTerm2, or ASCII-art fallback. Lazy-loaded to avoid bundle weight.
- Hyperlink helper: `<Link href=... />` emitting OSC 8 when supported,
  underline + footnote when not.
- Damage-tracking renderer pass: only emit ANSI for cells that changed
  AND whose effective style differs. Keep the existing diff but add
  per-row run-length compression.
- Cursor management: hide during paint, restore at commit, support cursor
  shape requests (`bar`, `block`, `underline`, blink).

Acceptance: capability matrix tested under fake-TTY against xterm, iTerm2,
WezTerm, Kitty, Alacritty, Windows Terminal, GNOME Terminal, Konsole,
tmux, screen, ssh-into-vt100. Document support level per terminal.

---

## 4. Styling system (weeks 4–7)

The current `BoxStyle` object is verbose and has no cascade. Replace with a
fluent + tagged-template DSL inspired by lipgloss, expressed in TypeScript.

- New module `src/style/`:
  - `style()` builder: `style().fg("#7aa2f7").bg("base").bold().padding(1, 2)`
  - Tagged template variant: `` css`fg: #7aa2f7; padding: 1 2; border: round` ``
  - Token system: theme tokens reference (`fg("primary")`).
  - Variants and states: `.when("focused")`, `.when("disabled")`,
    `.when("hover")`, `.when("error")`, `.when("loading")`.
  - Responsive variants by terminal width breakpoints: `.at(">=80")`.
  - Composition: `style.merge(a, b)` with last-write-wins.
- Theme overhaul:
  - Token namespaces: `color.*`, `space.*`, `radius.*` (used for border style),
    `font.*` (bold/italic/underline tokens), `motion.*` (durations).
  - Built-in themes: `light`, `dark`, `solarized-light`, `solarized-dark`,
    `tokyo-night`, `nord`, `dracula`, `gruvbox`. All shipped.
  - Runtime theme switching via `setTheme()` re-renders affected nodes only.
  - User themes defined in TS, validated against a token schema at build time.
- Border presets: `square`, `round`, `double`, `thick`, `dashed`, `ascii`,
  `none`. Per-side override. Truecolor border colors with caps fallback.
- Text decoration: gradient text, rainbow, shadow (offset overlay), glow
  (synthesized via dim halo cells).
- Markdown-in-text helper: `<Markdown>` that renders bold/italic/code/links.

Acceptance: every built-in component restyles via tokens only — no hex
literals in component source.

---

## 5. Layout engine (weeks 5–8)

Flex-only is not enough. Real apps need grid, dock, and constraint-based
layout. Rewrite `src/layout/`.

- Keep flex (current behavior) as the default container.
- Add `Grid` with track sizing: `auto`, fixed cells, `1fr` units, `minmax`,
  named lines, named areas. CSS Grid subset, terminal-cell-sized.
- Add `Dock` for app-shell layouts: `top`/`bottom`/`left`/`right`/`fill`.
- Add absolute / overlay positioning for modals, popovers, tooltips, and
  command palettes. Layered with z-index. Click-through control.
- Add `min`/`max` constraints on every axis, both flex and grid.
- Add `aspectRatio` for fixed-ratio panels (e.g. ASCII art frames).
- Resize-aware breakpoints baked into layout, not just style.
- Layout debugging: `F12` overlay shows live constraints, computed sizes,
  overflow direction, and clipped content per node.
- Performance: layout is incremental. Only nodes whose subtree's intrinsic
  size or available space changed re-layout.

Acceptance: 5,000-node tree re-layouts on resize in <4ms. Showcase app
re-layouts on resize in <1ms.

---

## 6. Component library (weeks 6–12)

This is the moat. Ship 40+ polished components, not 15. Each component:
typed props, theme tokens, mouse + keyboard, accessibility hints,
documented states, and a screenshot in the docs.

Tier 1 — primitives (already partial, finish):

- `Box`, `Row`, `Column`, `Grid`, `Stack`, `Dock`, `Spacer`, `Divider`
- `Text`, `Markdown`, `Code` (syntax-highlighted), `Link`, `Kbd`
- `Button`, `IconButton`, `ToggleButton`, `ButtonGroup`
- `TextInput`, `TextArea`, `MaskedInput`, `NumberInput`, `PasswordInput`
- `Checkbox`, `Radio`, `Switch`, `Slider`, `RangeSlider`
- `Select`, `MultiSelect`, `Combobox`, `Autocomplete`
- `DatePicker`, `TimePicker`

Tier 2 — display:

- `List` (virtualized), `Tree`, `Table` (virtualized, sortable, resizable
  columns, sticky headers), `DataGrid` (cell-edit-capable)
- `Tabs`, `Accordion`, `Stepper`, `Breadcrumbs`, `Pagination`
- `Badge`, `Chip`, `Tag`, `Avatar`, `Pill`
- `Card`, `Panel`, `Window`, `Modal`, `Popover`, `Tooltip`, `Toast`
- `ProgressBar`, `ProgressRing`, `Spinner`, `Skeleton`, `Sparkline`

Tier 3 — chrome and orchestration:

- `AppShell`, `Sidebar`, `TopBar`, `BottomBar`, `StatusBar`
- `CommandPalette`, `HelpOverlay`, `KeyHints`, `Notifications`
- `Form` with validation hookup, `FormField`, `ErrorMessage`
- `Wizard`, `EmptyState`, `ErrorBoundary`, `Suspense`

Tier 4 — visualization:

- `LineChart`, `BarChart`, `Histogram`, `Gauge`, `Heatmap`, `Calendar`
- `LogStream` (filterable, paused, regex), `DiffView`, `JSONViewer`
- `FilePicker`, `PathBreadcrumbs`

Each component lives in `src/components/<name>/index.ts(x)` with:
`Component.tsx`, `Component.types.ts`, `Component.test.ts`, `Component.story.tsx`
(used by docs).

Acceptance: `examples/showcase` demonstrates every component on a single
route, visually exercised by a snapshot test.

---

## 7. App shell, navigation, state (weeks 8–12)

App-shell becomes a real subsystem, not one .tsx file.

- Router: nested routes, route params, query params, programmatic
  navigation, navigation guards (`canLeave`), back/forward stack, deep
  linking via process arguments.
- Layout slots: every shell exposes named regions for sidebars, top bar,
  status bar, content, modals, toasts, command palette.
- Command registry: scoped commands (global, per-route, per-component),
  keyboard shortcut conflict detection, palette grouping, aliases, recent
  commands, fuzzy search.
- Hotkey system: chord support (`g g`, `g s`), context-sensitive bindings,
  per-platform mapping (`Cmd` vs `Ctrl`), localizable labels.
- Persistent state: `usePersistentState` backed by JSON in
  `~/.config/<app>/state.json`, schema-versioned with migrations.
- Notifications/toasts: queueable, durable, dismissable, with action buttons.
- Mouse: drag, drop, drag-resize for split panes, double-click, right-click
  menus, scroll wheel everywhere, hover styling.
- Focus management: focus rings, focus restoration after modal close,
  focus trapping in modals/palettes, programmatic focus, skip links.
- Async data: `createResource` returning `loading`/`error`/`data`/`refetch`,
  with stale-while-revalidate semantics and request deduplication.

Acceptance: building a non-trivial app (see §13) requires zero custom
shell code outside `<AppShell>` configuration.

---

## 8. Animation & async (weeks 10–13)

Modern TUIs animate. Ours will too.

- `motion` primitive: `motion(initial, target, { duration, easing, spring })`
  returns a signal that interpolates over time. Synchronized to frame ticks.
- Transitions: `<Transition show={...} enter="..." leave="...">` with
  presets `fade`, `slide`, `expand`, `bounce`. Rendered via dim/blink/style
  interpolation since terminals can't blend pixels.
- Easings library: standard cubic-bezier presets, springs.
- Frame loop: a single shared 60Hz scheduler that pauses when no animations
  or streams are active. CPU at idle stays at 0%.
- Streaming primitives: `<Stream>` wraps an async iterable and renders
  incrementally with backpressure. Used by log viewer, chat UIs.
- Concurrent rendering: long renders yield to input. Input always has
  priority over animation.

Acceptance: spinner, progress bar, modal slide-in, list reorder all
animate at 60Hz with no input lag during animation.

---

## 9. Testing & DX (weeks 11–14)

The testkit exists; it needs to be the best in the ecosystem.

- `renderTestApp(<App/>, { width, height, cap: "truecolor" })` with full
  capability simulation.
- Visual regression: `app.snapshot()` returns a stable, ANSI-stripped frame
  string; `app.snapshotAnsi()` returns the full ANSI; both diff on save.
- Component-level rendering: `renderComponent(<Button/>)` without app shell.
- User-event style API: `await user.click(button)`, `user.type(input, "hi")`,
  `user.keyboard("{Tab}{Enter}")`, `user.hover(row)`, `user.drag(a).drop(b)`.
- Async helpers: `await screen.findByText("Saved")`, `waitFor`, `act()`-free.
- Accessibility queries: `getByRole`, `getByLabel`.
- Time control: `vi.useFakeTimers`-equivalent scoped to the renderer.
- Property-based input tests: `fast-check` integration generating valid
  ANSI byte sequences and asserting parser invariants.
- Coverage: 90% lines, 85% branches before v1.0.
- Devtools: `F12` overlay gets a network-style timeline (renders, effects,
  input events), a component tree with selection-driven highlight, a perf
  flamegraph for the last 60 frames, and an exportable bug report bundle
  (`graceglyph report` writes a tarball with last frames + tree + warnings).

Acceptance: full Playwright-equivalent ergonomics for terminal tests.

---

## 10. Performance work (weeks 12–15)

Ship benchmarks. Win or learn.

- Benchmark harness `bench/`:
  - 10k cells static render (cold + warm)
  - 1k-row table virtualized scroll
  - 100k-line log stream
  - Resize storm (100 resizes/sec)
  - Input storm (1000 keys/sec)
  - Memory under 1-hour run
- Compare against Ink, blessed, terminal-kit. Publish results in README
  and on the docs site. Re-run on every PR via CI bench.
- Profiling: clinic.js / `--prof` integration documented.
- Targets:
  - Frame time p50 < 8ms, p99 < 16ms at 10k cells
  - Input latency < 4ms keypress-to-paint
  - RSS < 50MB for showcase
  - Cold start < 80ms to first paint

Acceptance: published benchmarks beat Ink on at least three of five
workloads. Where we lose, document it and explain why we don't care.

---

## 11. Distribution & onboarding (weeks 14–16)

Make `graceglyph` the easy choice.

- `npm create graceglyph@latest my-app` actually works. Templates:
  - `dashboard` — app shell, sidebar, multiple routes, persisted state
  - `cli-tool` — single-screen interactive, async loading/error/retry
  - `log-viewer` — streaming logs, filters, pause/resume
  - `crud-app` — list/detail editor, persistent records
  - `chat` — streaming token UI, scrollback
  - `editor` — multi-pane text editor with file tree
- `npm create graceglyph` flow:
  - Pick template, fill in name, pick package manager, pick theme.
  - Outputs a project that starts in <500ms and is <10 deps deep.
- Bun and Deno first-class:
  - Publish to JSR mirror.
  - Bun-native test command. Deno entrypoints in `deno.json`.
- TypeScript zero-config: ship `.d.ts` with declaration maps, no tsconfig
  required to import.
- Single-file binary builds via `bun build --compile` and `deno compile`,
  documented and tested in CI.

Acceptance: time-from-`npm create`-to-running-app under 60 seconds on a
clean machine.

---

## 12. Documentation site (weeks 14–18)

Docs are product. Ship them like product.

- Static site at `graceglyph.dev` (Astro or VitePress).
- Sections:
  - Getting started (10-min path that actually delivers a real app)
  - Concepts (signals, components, layout, styling, capabilities)
  - Components reference — every component, props table, examples,
    interactive playground that runs the actual library in xterm.js
  - Hooks / primitives reference
  - Recipes (forms, async data, file pickers, theming, log streams)
  - Migration guides (from Ink, from blessed)
  - Cookbook (drop-in patterns)
  - API reference auto-generated from TSDoc
  - Performance, capabilities matrix, troubleshooting
- Interactive playground: each example renders into an embedded xterm.js
  fed by a graceglyph runtime running in the browser via the same code.
- Changelog page generated from `changesets`.
- "Why graceglyph" page with honest trade-offs vs Ink and Textual.
- Docs versioned per minor release, with `latest` and `next`.

Acceptance: a reader can land on the homepage, click "Try it," edit a
component, and see the change render — without leaving the browser.

---

## 13. Flagship apps (weeks 16–22)

Marketing is a working tool.

- `gg-monitor` — htop replacement built on graceglyph. Real CPU/mem/proc,
  per-core graphs, kill/renice, tree view, search. Shipped as `npx gg-monitor`.
- `gg-logs` — `tail -f` replacement. Multi-file streaming, regex filters,
  severity highlighting, pause/resume, jump-to-time, syntax highlighting
  per log format (json, nginx, apache, syslog).
- `gg-git` — lazygit-tier git UI. Status, stage hunks, history graph, diff
  view, branch ops, stash, rebase interactive.
- `gg-files` — ranger-tier file manager. Tabs, preview, bulk ops, search,
  bookmarks, archives.
- `gg-chat` — ai chat client demo (model-agnostic) showing streaming-token
  UX as a first-class capability.

Each app is its own published package, links back to graceglyph, and has a
recorded asciinema demo on the docs site. Two of them have to be good
enough that someone uses them daily.

Acceptance: at least one flagship app reaches 1k weekly downloads
independently of graceglyph.

---

## 14. Ecosystem & plugins (weeks 18–24)

Once the core is good, let others extend it.

- Plugin protocol: a plugin exports components, themes, commands, and/or
  middleware. Loaded by app config or CLI flag.
- First-party plugins:
  - `@graceglyph/charts` — heavyweight charting (sparklines stay core)
  - `@graceglyph/markdown` — full markdown renderer with code highlighting
  - `@graceglyph/forms` — schema-driven forms (zod adapter)
  - `@graceglyph/ssh` — render a graceglyph app over SSH for remote tools
  - `@graceglyph/web` — render a graceglyph app to xterm.js in a browser
- Awesome list repo `awesome-graceglyph` curated by maintainers.
- Component author template: `npm create graceglyph-component`.
- Stable plugin API documented and versioned independently from core.

---

## 15. v1.0 release criteria

We don't ship 1.0 until all of the following are true:

- 90-day API freeze on all `graceglyph` and `graceglyph/testing` exports.
- Coverage ≥ 90% lines / 85% branches.
- All capability targets in §3 pass on the documented terminal matrix.
- Perf targets in §10 met on Linux, macOS, Windows Terminal.
- Docs site live with full reference and at least 20 recipes.
- Five public projects building on graceglyph, of which at least three are
  not authored by maintainers.
- 5,000 weekly npm downloads.
- Bun + Deno + Node 18/20/22 supported in CI.
- Zero open `bug` issues older than 30 days.
- A documented deprecation policy and at least one deprecation cycle
  completed during the 0.x line.

---

## Cross-cutting concerns

### Versioning

- Pre-1.0: minor bumps may break, patches do not. Every breaking change
  needs a `changeset` with migration notes.
- Post-1.0: strict semver. Two-minor deprecation cycles minimum.
- Internal-only modules live under `src/_internal/` and are excluded from
  `exports`. We freeze the public surface, not the implementation.

### Accessibility

- Every component has a `label` / `description` prop pair where it makes
  sense. Used by screen-reader-aware terminals (Orca, NVDA via Windows
  Terminal accessibility).
- High-contrast theme shipped.
- Color is never the only signal: every state has a glyph or text fallback.
- Reduced-motion mode disables animations globally.

### Internationalization

- All built-in strings (palette placeholder, error labels, F12 overlay
  copy) routed through a `t()` helper with English defaults and locale
  packs in `@graceglyph/i18n-<lang>`.
- Bidirectional text support in `<Text>` and inputs.
- Grapheme-safe everywhere, already done in §1 of STABILITY.md.

### Security

- No `eval`, no dynamic `Function`, no string-based template execution in
  the runtime path. CodeQL job in CI.
- Input parser fuzzed via property-based tests; ANSI sequences from
  untrusted streams (logs, network) sanitized before rendering text.
- `SECURITY.md` with a real triage SLA.

### Governance

- Single-maintainer for now, but commit conventions and issue triage
  template in place so contributors can show up without being blocked.
- Roadmap (this file) is the source of truth. PRs that don't fit get a
  pointer to the relevant section or a "out of scope" close.
- ADR (`docs/adr/NNNN-title.md`) for every architectural decision worth
  more than 100 lines of code.

---

## Schedule summary

| Weeks | Focus                                        |
| ----- | -------------------------------------------- |
| 1–2   | Foundation, CI, repo hygiene                 |
| 2–4   | Signal runtime migration                     |
| 3–6   | Capabilities + renderer hardening            |
| 4–7   | Styling DSL + theme tokens                   |
| 5–8   | Layout engine: grid, dock, overlay           |
| 6–12  | Component library (40+)                      |
| 8–12  | App shell, router, commands, focus, async    |
| 10–13 | Animation, transitions, frame scheduler      |
| 11–14 | Testing & DX, devtools v2                    |
| 12–15 | Benchmarks, perf pass                        |
| 14–16 | Templates, `create-graceglyph`, distribution |
| 14–18 | Docs site with interactive playground        |
| 16–22 | Flagship apps                                |
| 18–24 | Plugin protocol + first-party plugins        |
| 24    | v1.0 candidate                               |
| 27    | v1.0 release                                 |

---

## Immediate next actions (this week)

1. Land or revert the 18 modified + 11 untracked files. Open one PR per
   logical chunk: `app-shell`, `testing`, `create`, `dashboard-shell`,
   `runtime fixes`, `theme tweaks`, `examples`.
2. Delete `src/widgets/`. Write the migration note.
3. Re-include the four excluded folders/files in `tsconfig` or delete them.
4. Add `.github/workflows/ci.yml` running `tsc --noEmit`, `npm test`,
   `npm run build` on Node 18/20/22.
5. Remove `AGENTS.md` from the repo.
6. Publish `graceglyph@0.1.0-next.0` to npm so the README isn't fiction.
7. Start the signals-runtime ADR. Get §2 on paper before writing the code.

The first commit on this plan should land in 24 hours. The longer the
foundation pass takes, the less credible the rest of the document looks.
