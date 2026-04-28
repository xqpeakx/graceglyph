# Why graceglyph

graceglyph is opinionated: it targets full terminal applications with modern
architecture, not only prompt-style CLIs.

## Positioning

- **graceglyph**: app-shell oriented TUI framework for TypeScript.
- **Ink**: React-driven terminal UI with strong React ecosystem alignment.
- **Textual**: Python-first high-level TUI framework with rich app model.

## Trade-offs

Choose graceglyph when you want:

- typed TS-first primitives for larger terminal apps
- capability-aware rendering and perf gates baked into workflow
- first-class testing ergonomics for app behavior

Choose Ink when you need:

- deep React interop above all else

Choose Textual when you need:

- Python ecosystem and deployment model

## Strategy

graceglyph focuses on:

1. low-latency updates via runtime migration toward fine-grained reactivity
2. benchmark-driven performance governance
3. production-grade docs, app-shell patterns, and ecosystem scaffolding
