* graceglyph

Graceglyph is a TUI framework for Node and TypeScript. It uses declarative
components, row/column layout, typed props and events, and a built-in
inspector so building terminal UI feels closer to building a modern app than
fighting manual coordinates.

Supported package entrypoints are:

- `graceglyph`
- `graceglyph/jsx-runtime`
- `graceglyph/jsx-dev-runtime`

Deep imports into internal source files are not part of the supported API.

## Status

Early, but actively hardened. Current focus:

- Declarative components
- Row/column layout
- Typed props and events
- Multiline `TextArea`
- Tree inspector (`F12`)
- Watch-mode examples
- Automated runtime and onboarding smoke coverage

## First Run

```bash
npm install
npm run example:monitor
```

`example:monitor` is the flagship demo. It exercises live updates, multi-panel
layout, keyboard navigation, sorting, filtering, and dense data rendering in
one screen.

Useful keys on first run:

- `Tab` / `Shift+Tab`: move focus
- `Enter`: activate buttons and selected list items
- `Ctrl+C`: exit
- `F12`: open the inspector and warning panel

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
npm run example:monitor
npm run example:hello
npm run example:form
npm run example:todo
npm run example:explorer
```

Use watch mode while iterating:

```bash
npm run dev:monitor
npm run dev:hello
npm run dev:todo
npm run dev:explorer
```

`Ctrl+C` exits. `Tab` / `Shift+Tab` cycles focus. `F12` toggles the inspector.

## Ten-minute path

If you want to validate whether graceglyph feels pleasant fast, this is the
short path:

1. Run `npm run dev:monitor`.
2. Change one metric panel title or accent in `examples/system-monitor.tsx`.
3. Edit the default refresh cadence or key hints.
4. Filter the process list and change the sort shortcuts.
5. Resize the terminal and toggle `F12` to inspect the tree and warnings.

If that loop feels awkward, the framework still needs work.

## Components

Current built-ins:

- `App`
- `Window`
- `Panel`
- `Row`
- `Column`
- `Text`
- `TextInput`
- `TextArea`
- `Button`
- `List`
- `Modal`

Everything composes down to four host primitives: `box`, `text`, `input`, and `textarea`.

## Examples

- `example:monitor`: flagship system monitor with live CPU, memory, disk, network, and process panels
- `example:hello`: composer flow with templates, textarea editing, preview, and modal UX
- `example:form`: smallest useful controlled-form flow with list selection
- `example:todo`: list management, keyboard shortcuts, and confirmation modal
- `example:explorer`: async filesystem loading and preview panes

`example:monitor` uses native counters and process tables when the host
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
