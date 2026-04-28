# Migration Notes

## Current runtime transition

The framework is in a staged migration from fiber/hook compatibility paths
toward signal-first primitives.

## Compatibility hooks

`useState`, `useEffect`, `useRef`, `useMemo`, and `useCallback` remain
available today but are treated as compatibility APIs during the transition.

Prefer reactive primitives for new code:

- `createSignal`
- `createEffect`
- `createMemo`
- `batch`
- `createResource`

## Practical migration strategy

1. Keep existing app behavior stable with compatibility hooks.
2. Move isolated state slices to `createSignal`.
3. Replace side-effect hooks with `createEffect` + `onCleanup`.
4. Update tests to use new async and timer controls in `graceglyph/testing`.
