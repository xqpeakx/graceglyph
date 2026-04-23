# zenterm

Cross-platform, retained-mode TUI framework for Node.

Zenterm provides a structured, event-driven environment for building windowed
applications that run entirely in a terminal — no raw ANSI, no manual cursor
juggling. Compose widgets, handle events, and let the framework handle the
diff-based redraws.

## Status

Early. The core loop, diff renderer, input parser, focus manager, and a
starter widget set (`Window`, `Label`, `Button`, `TextField`, `ListView`,
`StatusBar`, `Dialog`) are in place. APIs may change.

## Install

```
npm install zenterm
```

## Hello world

```ts
import { Application, Label, Window } from "zenterm";

const app = new Application();
const root = new Window({ title: " zenterm ", border: true });
root.add(new Label({ x: 2, y: 1, text: "Hello, terminal." }));
app.setRoot(root);
app.run();
```

Run the bundled examples:

```
npm run example:explorer    # file browser — the flagship demo app
npm run example:todo        # working todo app (split pane, modal, shortcuts)
npm run example:showcase    # widget gallery — every widget in one screen
npm run example:form        # text fields, list, submit button
npm run example:hello       # minimal window + label
```

Ctrl+C exits. Tab / Shift+Tab cycles focus. F2 toggles between the
default and dark themes in the larger examples.

### explorer

A two-pane file browser that shows the framework in real use — async
`fs` I/O driving a live-updated preview from list selection, breadcrumb
navigation, focus shuttled between panes on enter/escape. Start from
any directory:

```
npm run example:explorer
# or point it at somewhere else:
cd ~/projects && node --loader ts-node/esm /path/to/zenterm/examples/explorer.ts
```

Keys: `enter` opens a directory or focuses the preview · `backspace`
goes up · `tab` cycles panes · `F5` reloads · `F2` switches theme.

### todo

Multi-pane task manager with a modal confirmation before clearing done
tasks. `n` focuses the input, `d` deletes the focused task, `enter` on
the list toggles done.

## Architecture

- **Application** — event loop, dirty tracking, render scheduling.
- **Terminal** — owns the TTY: raw mode, alt screen, mouse, resize.
- **Renderer** — double-buffered cell grid with diff-based flush.
- **InputParser** — stdin bytes → `KeyEvent` / `MouseEvent`.
- **FocusManager** — tab navigation, active-view tracking.
- **View** — base widget; holds children, bounds, event hooks.
- **Theme** — reusable style bundles consumed by widgets.

Subsystems are loosely coupled — you can instantiate `Renderer` or
`InputParser` standalone if you want to build something weirder.

## Custom widgets

Extend `View`, implement `drawSelf`, and optionally override `onKey` /
`onMouse`. Call `this.invalidate()` when internal state changes.

```ts
class Counter extends View {
  private n = 0;
  constructor() { super({ focusable: true, width: 10, height: 1 }); }

  protected drawSelf(buf: ScreenBuffer, area: Rect) {
    buf.writeText(area.x, area.y, `count: ${this.n}`, DefaultStyle, area);
  }

  onKey(ev: KeyEvent): boolean {
    if (!this.focused) return false;
    if (ev.name === "up")   { this.n++; this.invalidate(); return true; }
    if (ev.name === "down") { this.n--; this.invalidate(); return true; }
    return false;
  }
}
```

## Build

```
npm install
npm run build
```

## License

MIT — see [LICENSE](LICENSE).
