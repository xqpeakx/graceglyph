# Performance

graceglyph ships benchmark tooling and CI gates so regressions are visible and
actionable.

## Bench commands

- `npm run bench` for local benchmark runs
- `npm run bench:check` for hard threshold enforcement
- `npm run bench:drift` for baseline drift checks
- `npm run bench:compare` for competitor artifact comparisons
- `npm run bench:prof` for V8 profiling capture

## CI perf gates

- Absolute thresholds gate critical scenarios.
- Baseline drift gate catches trend regressions before threshold failure.

## Investigation workflow

1. Reproduce with `npm run bench -- <scenario>`.
2. Capture profile via `npm run bench:prof -- <scenario>`.
3. Process profile (`node --prof-process isolate-*.log`).
4. Apply focused optimizations and re-run drift + threshold checks.
