# graceglyph

Terminal UI toolkit for TypeScript.

Graceglyph is a TUI framework for Node. It uses declarative components, row/column
layout, typed props and events, and a small built-in inspector. The main focus
is avoiding manual coordinates for common layouts.

## Status

Early, but usable. Current focus:

- Declarative components
- Row/column layout
- Typed props and events
- Tree inspector (`F12`)
- Watch-mode examples

## Install

```
npm install graceglyph
```

## Hello world

```tsx
import { App, Button, Column, Text, Window, render, useState } from "graceglyph";

function Counter() {
  const [count, setCount] = useState(0);

  return (
    <App>
      <Window title="Hello" width={40} height={10}>
        <Column gap={1}>
          <Text>Hello world</Text>
          <Text>{count} clicks</Text>
          <Button onClick={() => setCount((value) => value + 1)}>
            Increment
          </Button>
        </Column>
      </Window>
    </App>
  );
}

render(<Counter />);
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
npm run example:showcase
npm run example:todo
npm run example:explorer
```

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
- `Button`
- `List`
- `Modal`

Everything composes down to three host primitives: `box`, `text`, and `input`.

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
