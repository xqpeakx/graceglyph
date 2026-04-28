# Concepts

## Runtime direction

graceglyph is evolving toward a fine-grained reactive runtime where host-level
updates stay narrow and predictable for terminal workloads.

## Rendering model

- Tree-to-host layout with deterministic box/text/input primitives.
- Capability-aware output downgrade paths.
- Diff-based frame emission to avoid unnecessary terminal writes.

## App architecture

- `AppShell` for routes, hotkeys, command palette, and persistent UX affordances.
- Component library for composition-first terminal applications.
- Testing APIs designed for app-level behavior, not only unit-level snapshots.
