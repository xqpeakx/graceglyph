# Migration from Ink

Ink is excellent for React-style terminal interfaces. graceglyph is optimized
for full app-shell style TUIs with framework-owned layout, routing, and test DX.

## Mental model shift

- Ink: React component tree + React lifecycle.
- graceglyph: TUI-first component/runtime model with compatibility hooks during
  migration and signal-first direction.

## Quick mapping

- `render(<App />)` in Ink -> `render(<AppRoot />)` in graceglyph.
- Layout primitives map to `Box`, `Row`, `Column`, `Grid`.
- Input controls map to `TextInput`, `TextArea`, `Checkbox`, `Slider`, etc.
- App structure maps to `AppShell` + route-aware command palette/hotkeys.

## Suggested migration sequence

1. Port UI shell and primitives first.
2. Keep hook-based logic, then progressively move to reactive primitives.
3. Replace Ink test strategy with `graceglyph/testing` snapshots + queries.
4. Enable fake timers and async find/wait helpers for deterministic tests.
