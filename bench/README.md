# bench/

Microbenchmarks for graceglyph's hot paths. The runner is a thin
wall-clock sampler; output is a table of mean / median / p99 / min / max
in milliseconds.

```bash
npm run bench                  # all scenarios
npm run bench -- table         # filter by substring
npm run bench:prof             # collect V8 profile for scenario investigation
npm run bench:check            # enforce hard roadmap thresholds
npm run bench:drift            # compare against bench/baseline.json drift policy
npm run bench:compare          # markdown comparison vs competitor artifacts
```

## Scenarios

- `static-frame` — paint and diff a 200×60 buffer (~12k cells).
- `table-scroll` — virtualized 1000-row table, scrolling one row per frame.
- `resize-storm` — rapid resize cycling between 80×24 and 200×60.

Targets (see `ROADMAP.md` §10):

| metric                 | target |
| ---------------------- | ------ |
| static-frame paint p50 | <8 ms  |
| static-frame diff p99  | <16 ms |
| table-scroll p50       | <4 ms  |
| resize-storm p50       | <2 ms  |

These are floors, not ceilings. We expect to beat them on modern hardware.
CI runs the benchmark suite as a smoke check and emits JSON output for
downstream comparison tooling. The bench CI job enforces the four thresholds
above and fails if any exceeded metric regresses past its target. CI also
compares current benchmark medians/tails against `bench/baseline.json` using
`scripts/check-bench-drift.mjs`.

## Baseline and drift policy

- Baseline source: `bench/baseline.json`
- Drift gate: `scripts/check-bench-drift.mjs`
- Default policy:
  - `p50Ms` may regress by at most 35%
  - `p99Ms` may regress by at most 45%

Hard thresholds remain the primary gate; drift is the "early warning" signal
for trends that may still be below absolute ceilings.

## Framework comparisons

- Comparison harness: `scripts/bench-compare.mjs`
- Competitor artifact placeholders:
  - `bench/competitors/ink.json`
  - `bench/competitors/blessed.json`
  - `bench/competitors/terminal-kit.json`

`npm run bench:compare` renders a markdown table for current graceglyph
results against competitor artifacts and a quick "p50 win count" summary.
Populate competitor files with same-machine benchmark captures as we collect
real data.

## Profiling

Use V8 profiling to inspect hotspots when drift/check gates move in the wrong
direction:

```bash
npm run bench:prof -- table
```

This generates a `isolate-*.log` profile file in the project root. Process it
with Node tooling:

```bash
node --prof-process isolate-*.log > bench-profile.txt
```

For focused runs, pass the same filter substring used by `npm run bench -- ...`
so profile output maps directly to one scenario family.

## Adding a scenario

1. Add a file under `bench/scenarios/`.
2. Export a function `(bench: Bench) => void` that calls `bench.add(...)`.
3. Wire it into `bench/run.ts`.
