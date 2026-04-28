# Migration from blessed

blessed gives imperative building blocks. graceglyph provides a declarative,
typed component system aimed at larger maintainable terminal applications.

## Mental model shift

- blessed: manually mutate widgets and screen buffers.
- graceglyph: describe UI state in components, let runtime reconcile/layout/paint.

## Mapping strategy

- Screen/container blocks -> `AppShell`, `Panel`, `Box`.
- Lists/tables -> `List`, `Table`, `Tree`.
- Form controls -> `TextInput`, `TextArea`, `Checkbox`, `Select`.
- Event handlers -> component props (`onClick`, keyboard commands, mouse flow).

## Practical migration sequence

1. Recreate shell layout in graceglyph primitives.
2. Wrap imperative state in typed state/resource helpers.
3. Replace direct key/mouse handling with command + focus abstractions.
4. Port regression tests into `renderTestApp` snapshots and role/label queries.
