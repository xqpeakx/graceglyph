* graceglyph

Terminal UI toolkit for TypeScript.

Graceglyph is a TUI framework for Node. It uses declarative components, row/column
layout, typed props and events, and a small built-in inspector. The main focus
is avoiding manual coordinates for common layouts.

## Status

Early, but usable. Current focus:

- Declarative components
- Row/column layout
- Typed props and events
- Multiline `TextArea`
- Tree inspector (`F12`)
- Watch-mode examples

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
npm run example:hello
npm run example:form
npm run example:todo
npm run example:explorer
```

`example:hello` is the best demo right now. It exercises list navigation,
single-line input, multiline editing, live preview, and modal presentation in
one screen.

Use watch mode while iterating:

```bash
npm run dev:hello
npm run dev:todo
npm run dev:explorer
```

`Ctrl+C` exits. `Tab` / `Shift+Tab` cycles focus. `F12` toggles the inspector.

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

## Build

```bash
npm install
npm run build
npm test
```

## License

MIT — see [LICENSE](LICENSE).
