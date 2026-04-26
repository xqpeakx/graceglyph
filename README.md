╔═╗┬─┐┌─┐┌─┐┌─┐╔═╗┬ ┬ ┬┌─┐┬ ┬
║ ╦├┬┘├─┤│  ├┤ ║ ╦│ └┬┘├─┘├─┤
╚═╝┴└─┴ ┴└─┘└─┘╚═╝┴─┘┴ ┴  ┴ ┴

Graceglyph is a TUI framework for Node and TypeScript. It uses declarative
components, row/column layout, typed props and events, and a built-in
inspector so building terminal UI feels closer to building a modern app than
fighting manual coordinates.

Supported package entrypoints are:

- `graceglyph`
- `graceglyph/jsx-runtime`
- `graceglyph/jsx-dev-runtime`
- `graceglyph/testing`

Deep imports into internal source files are not part of the supported API.

## Status

Early, but actively hardened. Current focus:

- Declarative components
- Row/column layout
- Typed props and events
- Multiline `TextArea`
- Tree inspector (`F12`)
- App shell, command palette, help overlay, and toasts
- Terminal testkit and project templates
- Tokenized styling DSL and built-in themes
- Watch-mode examples
- Automated runtime and onboarding smoke coverage

## First Run

```bash
npm install
npm run example:showcase
```

`example:showcase` is the single example application. Its home screen houses
the system monitor, log viewer, git dashboard, API explorer, file manager, and
smaller component demos in one running TUI. Open a module from the list, then
press `Escape` or `F1` to return home.

Useful keys on first run:

- `Tab` / `Shift+Tab`: move focus
- `Enter`: activate buttons and selected list items
- `Escape` / `F1`: return to the showcase home screen from a module
- `:`: open the command palette
- `?`: open the active shortcut/help overlay
- `Ctrl+C`: exit
- `F12`: open the inspector and warning panel

Mouse input works across the same controls: click buttons, list rows, fields,
tabs, filters, and the in-module Home control.

## Install

```
npm install graceglyph
```

## Hello world

```tsx
import {
  App,
  Button,
  Column,
  Row,
  Text,
  TextArea,
  TextInput,
  Window,
  render,
  useState,
} from "graceglyph";

function QuickNote() {
  const [subject, setSubject] = useState("Hello graceglyph");
  const [body, setBody] = useState("Write a few lines here.");
  const [status, setStatus] = useState("draft");

  return (
    <App>
      <Window title="Quick note" width={60} height={16}>
        <Column gap={1} grow={1}>
          <Text>{subject}</Text>
          <TextInput value={subject} onChange={setSubject} placeholder="Subject" />
          <TextArea value={body} onChange={setBody} grow={1} />
          <Row gap={1}>
            <Button onClick={() => setStatus("saved")}>Save</Button>
            <Text>{status}</Text>
          </Row>
        </Column>
      </Window>
    </App>
  );
}

render(<QuickNote />);
```

For automatic JSX without `h(...)` boilerplate, use:

```
{
  "compilerOptions": {
    "jsx": "react-jsx",
    "jsxImportSource": "graceglyph"
  }
}
```

Run the bundled examples:

```bash
npm run example:showcase
```

The other `example:*` scripts are compatibility shortcuts into the same
showcase application with that module opened first.

Use watch mode while iterating:

```bash
npm run dev:showcase
```

`Ctrl+C` exits. `Tab` / `Shift+Tab` cycles focus. `F12` toggles the inspector.

## Ten-minute path

If you want to validate whether graceglyph feels pleasant fast, this is the
short path:

1. Run `npm run dev:showcase`.
2. Open the system monitor from the showcase list.
3. Change one metric panel title or accent in `examples/system-monitor.tsx`.
4. Edit the default refresh cadence or key hints.
5. Resize the terminal and toggle `F12` to inspect the tree and warnings.

If that loop feels awkward, the framework still needs work.

## Components

Current built-ins:

- `App`
- `AppShell`
- `Window`
- `Panel`
- `Row`
- `Column`
- `Grid`
- `Dock`
- `DockSlot`
- `Stack`
- `SplitPane`
- `ScrollView`
- `Text`
- `TextInput`
- `TextArea`
- `Button`
- `List`
- `Modal`
- `Router`
- `Route`
- `Tabs`
- `CommandPalette`
- `HelpOverlay`
- `ToastViewport`

Everything composes down to four host primitives: `box`, `text`, `input`, and `textarea`.

## Layout

The host layout engine supports flex, grid, dock, and absolute overlays on the
same `box` primitive.

```tsx
import { Dock, DockSlot, Grid, Panel, Text } from "graceglyph";

<Dock grow={1}>
  <DockSlot side="top" height={3}>
    <Text>toolbar</Text>
  </DockSlot>
  <DockSlot side="left" width={24}>
    <Text>navigation</Text>
  </DockSlot>
  <DockSlot>
    <Grid columns="24 1fr" rows="auto 1fr" gap={1}>
      <Panel title="Summary">fixed</Panel>
      <Panel title="Details">fluid</Panel>
    </Grid>
  </DockSlot>
</Dock>;
```

Grid tracks accept fixed cell counts, `auto`, `fr`, and `minmax(...)`.
Grid item placement uses 1-based lines:
`gridColumn={2}`, `gridColumn={[1, 3]}`, `gridRowSpan={2}`. Absolute children
can be placed with `position="absolute"`, `top`, `right`, `bottom`, `left`,
and `zIndex`. Boxes also support `minWidth`, `maxWidth`, `minHeight`,
`maxHeight`, and `aspectRatio` constraints.

Boxes can change layout at breakpoints without a wrapper component. Patches
are layout-only, merge in order, and use either theme breakpoint names
(`sm`, `md`, `lg`) or comparator queries (`>=100`, `<80`):

```tsx
<Box
  direction="column"
  breakpoints={{
    md: { direction: "row", gap: 1 },
    ">=120": { gridColumns: "28 1fr", layout: "grid" },
  }}
>
  <Box width={28}>nav</Box>
  <Box grow={1}>content</Box>
</Box>
```

Use `display="none"` or a breakpoint patch like `{ display: "none" }` to
remove a box from layout, paint, focus, and mouse hit testing.

## Styling

Graceglyph accepts the original object style shape and the newer token-aware
DSL:

```tsx
import { Box, Text, css, getTheme, render, style } from "graceglyph";

const panel = style()
  .fg("foreground")
  .bg("surface")
  .padding("sm", "md")
  .border("round")
  .when("focused")
  .fg("accent")
  .bold()
  .done();

render(
  <Box {...panel.toProps(getTheme("tokyo-night"))}>
    <Text style={style().fg("primary").underline()}>Styled text</Text>
  </Box>,
  { theme: getTheme("tokyo-night") },
);
```

The tagged-template form is useful for compact declarations:

```tsx
const commandStyle = css`
  fg: primary;
  bg: panel;
  padding: xs md;
  border: double;
`;
```

Built-in themes: `light`, `dark`, `solarized-light`, `solarized-dark`,
`tokyo-night`, `nord`, `dracula`, and `gruvbox`. Use `getTheme(name)` for a
fresh theme instance, or `render(...).setTheme(nextTheme)` / `useSetTheme()` to
switch at runtime.

## App Shell

Graceglyph includes shell primitives for full terminal applications, not just
single-screen widgets:

- `AppShell`: window chrome, breadcrumbs, `Escape` back navigation, command palette, help overlay, and toasts
- `Router` / `Route`: declarative route selection inside the terminal
- `Tabs`: mouse and keyboard reachable tab controls
- `useCommand` / `useCommands` / `useHotkeys`: a global command registry that can drive menus, help, and shortcuts
- `useAsync`, `useInterval`, `useDebouncedValue`, `usePersistentState`, `useFocusWithin`, `useClipboard`, `useMouse`: app-building hooks for common terminal UI state
- `Button`, `List`, `TextInput`, `TextArea`, and host boxes support consistent `focused`, `hovered`, `active`, `disabled`, `loading`, and `error` states

`F12` opens devtools with layout boxes, focus path, render counts, recent input
events, and layout warnings.

## Testing

Use `graceglyph/testing` to test terminal apps without private fixtures:

```tsx
import test from "node:test";
import assert from "node:assert/strict";
import { renderTestApp } from "graceglyph/testing";
import { AppRoot } from "../src/main.js";

test("main flow", async () => {
  const app = renderTestApp(<AppRoot />, { width: 100, height: 28 });
  try {
    await app.press(":");
    await app.type("refresh");
    await app.press("enter");
    assert.match(app.snapshot(), /refreshed/);
    app.assertNoLayoutWarnings();
  } finally {
    app.stop();
  }
});
```

The testkit can snapshot terminal frames, simulate keyboard and mouse flows,
resize the terminal, and assert that the inspector has no layout warnings.

## Templates

Project templates are available through the `create-graceglyph` CLI:

```bash
npm create graceglyph@latest my-app -- --template dashboard
npm create graceglyph@latest logs -- --template log-viewer
```

Available templates:

- `dashboard`: app shell, tabs, metrics, commands, and persisted state
- `cli-tool`: interactive command runner with async loading/error/retry state
- `log-viewer`: streaming logs with filtering and pause/resume controls
- `crud-app`: list/detail editor with persistent records

## Examples

`example:showcase` is the single example app. It contains:

- system monitor: live CPU, memory, disk, network, and process panels
- log viewer: live multi-file stream with text/regex filtering and severity highlighting
- git dashboard: status, staging, history, and diff preview panes
- API explorer: request editing, saved collections, response timing, headers, and JSON preview
- file manager: directory navigation, preview panes, rename, copy, and delete flows
- composer, form, and todo demos for editing, inputs, lists, modals, and basic state

The system monitor uses native counters and process tables when the host
provides them, and degrades to safe fallbacks when a command is unavailable.

## Editing

`TextInput` is a single-line controlled input.

`TextArea` is a multiline controlled input with:

- arrow-key cursor movement
- horizontal and vertical scrolling
- click-to-position cursor placement
- `Home` / `End`
- `PageUp` / `PageDown`
- `Enter` inserting a newline

```tsx
import { App, Column, TextArea, TextInput, Window, render, useState } from "graceglyph";

function Composer() {
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");

  return (
    <App>
      <Window title="Composer" width={60} height={16}>
        <Column gap={1} grow={1}>
          <TextInput value={subject} onChange={setSubject} placeholder="Subject" />
          <TextArea
            value={body}
            onChange={setBody}
            grow={1}
            placeholder={"Write a few lines\\nwith real structure."}
          />
        </Column>
      </Window>
    </App>
  );
}

render(<Composer />);
```

## Layout

Most apps should not need manual coordinates. Layout uses:

- `direction="row" | "column"`
- `grow`
- `gap`
- `padding`
- `align`
- `justify`
- terminal resize reflow

Custom components are plain functions over those primitives and hooks.

## Debugging

When something goes wrong, graceglyph now tries to fail early and explain it in
developer terms instead of leaving the terminal in a weird state.

- fatal runtime errors include the phase (`mount`, `commit`, `input`, `resize`) and a component stack
- built-in host components validate runtime props and throw on bad values like negative widths, invalid enums, or missing `onChange`
- `F12` opens the inspector, which now includes warning lines for clipped layouts, truncated titles, and collapsed children

If a layout feels off, run an example in watch mode, resize the terminal, and
toggle the inspector while moving focus with `Tab`.

## Terminal capabilities

graceglyph detects terminal capabilities at startup (truecolor, OSC 8
hyperlinks, synchronized output, bracketed paste, focus reporting, kitty
graphics, sixel, iTerm2 inline images, extended underline styles) and
adapts the render output accordingly. Override or inspect them via
`detectCapabilities()` and the `useCapabilities()` hook:

```tsx
import { useCapabilities, Link, render, App } from "graceglyph";

function Footer() {
  const caps = useCapabilities();
  return (
    <App>
      <Link href="https://graceglyph.dev">Docs</Link>
      <Text>
        color: {caps.color}, hyperlinks: {String(caps.hyperlinks)}
      </Text>
    </App>
  );
}
```

Force a specific profile with `FORCE_COLOR=truecolor` or disable color
output with `NO_COLOR=1`. Both follow the conventional environment
variables.

## Reactive primitives

graceglyph also exposes a fine-grained reactivity API alongside the
hooks-style runtime. These are the primitives the framework will move
to as its primary authoring model (see [ADR-0001](./docs/adr/0001-signal-runtime.md)):

```ts
import {
  createSignal,
  createMemo,
  createEffect,
  createResource,
  batch,
  untrack,
  createRoot,
  onCleanup,
} from "graceglyph";

const dispose = createRoot((dispose) => {
  const [count, setCount] = createSignal(0);
  const doubled = createMemo(() => count() * 2);

  createEffect(() => {
    console.log("count:", count(), "doubled:", doubled());
  });

  batch(() => {
    setCount(1);
    setCount(2); // effect runs once for the batch
  });

  return dispose;
});
```

`createResource` wraps an async fetcher in a signal-shaped object with
`loading`, `error`, `state`, and `refetch`:

```ts
const [userId, setUserId] = createSignal(1);
const user = createResource(userId, (id) => fetch(`/users/${id}`).then((r) => r.json()));

createEffect(() => {
  if (user.loading()) console.log("loading…");
  else if (user.error()) console.error(user.error());
  else console.log(user());
});
```

The hooks API (`useState`, `useEffect`, …) remains supported and will
continue to work through the 0.x line. Mix-and-match is fine.

## Roadmap

The path to v1.0 is tracked in [`ROADMAP.md`](./ROADMAP.md). Architectural
decisions live under [`docs/adr/`](./docs/adr/).

## Customizing

The easiest way to start a real app is to copy the structure from
`examples/hello.tsx`:

- keep a single `render(<App />)` entrypoint
- compose with `Window`, `Panel`, `Row`, and `Column`
- keep inputs controlled with `useState`
- start from one screen, then add modal flows or lists after the base layout feels good

## Build

```bash
npm install
npm run build
npm test
```

## License

MIT — see [LICENSE](LICENSE).
