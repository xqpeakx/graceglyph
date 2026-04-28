# Troubleshooting

## App does not render as expected

- Confirm terminal is a TTY.
- Check capability profile and color depth assumptions.
- Use `renderTestApp(..., { cap: "dumb" })` to validate fallback paths.

## Input behavior feels inconsistent

- Verify focus placement and command bindings.
- Inspect parser behavior with input parser tests.
- Use deterministic fake timers and async helpers in tests.

## Performance regressed

- Run `npm run bench:check` and `npm run bench:drift`.
- Capture profile with `npm run bench:prof`.
- Compare against baseline and recent commits.

## Layout warnings in tests

- Call `app.warnings()` and `app.assertNoLayoutWarnings()`.
- Check parent constraints (`min/max`, border/padding, display/overlay settings).
