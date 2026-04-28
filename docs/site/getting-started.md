# Getting Started

## Install

```bash
npm install graceglyph
```

## Minimal app

```ts
import { App, Box, Text, render } from "graceglyph";

function AppRoot() {
  return (
    <App>
      <Box border padding={1}>
        <Text>Hello from graceglyph</Text>
      </Box>
    </App>
  );
}

render(<AppRoot />);
```

## Recommended workflow

1. Start with `AppShell` for route + command foundations.
2. Keep state colocated with reactive primitives or compatibility hooks.
3. Use `renderTestApp` from `graceglyph/testing` for deterministic TUI tests.
4. Run `npm run typecheck` and `npm test` in CI on every change.
