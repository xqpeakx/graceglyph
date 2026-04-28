# bench/

Microbenchmarks for graceglyph's hot paths. The runner is a thin
wall-clock sampler; output is a table of mean / median / p99 / min / max
in milliseconds.

```bash
npm run bench                  # all scenarios
npm run bench -- table         # filter by substring
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
downstream comparison tooling.

## Adding a scenario

1. Add a file under `bench/scenarios/`.
2. Export a function `(bench: Bench) => void` that calls `bench.add(...)`.
3. Wire it into `bench/run.ts`.
