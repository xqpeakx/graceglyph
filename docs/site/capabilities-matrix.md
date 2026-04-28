# Capabilities Matrix

graceglyph detects terminal capabilities and downgrades rendering behavior when
features are unavailable.

## Capability areas

- Color depth (`monochrome`, `ansi16`, `ansi256`, `truecolor`)
- Hyperlinks (OSC 8)
- Synchronized output
- Bracketed paste + focus reporting
- Graphics protocols (kitty, sixel, iTerm2 images)
- Extended underline support

## Testing profiles

Use deterministic profiles in tests:

- `cap: "dumb"` for conservative fallback behavior
- `cap: "full"` for high-fidelity behavior
- explicit override object for targeted compatibility cases

## Recommendation

Validate critical UX under both `dumb` and `full` profiles so your app remains
usable in minimal terminals and polished in modern emulators.
