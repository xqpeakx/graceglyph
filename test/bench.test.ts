import test from "node:test";
import assert from "node:assert/strict";

import { Bench, registerAllScenarios, runCase } from "../bench/run.js";

test("bench: registers the documented five workloads", () => {
  const bench = new Bench();
  registerAllScenarios(bench);
  const names = bench.cases.map((c) => c.name);
  assert.ok(names.some((n) => n.includes("static-frame")));
  assert.ok(names.some((n) => n.includes("table-scroll")));
  assert.ok(names.some((n) => n.includes("resize-storm")));
  assert.ok(names.some((n) => n.includes("log-stream")));
  assert.ok(names.some((n) => n.includes("input-storm")));
});

test("bench: runCase produces finite p50/p99 with shrunken iteration count", async () => {
  const bench = new Bench();
  registerAllScenarios(bench);
  // Pick a fast workload and shrink iterations so this test stays cheap.
  const target = bench.cases.find((c) => c.name.includes("static-frame: 200x60 paint"));
  assert.ok(target);
  const result = await runCase({ ...target!, iterations: 20, warmup: 4 });
  assert.equal(result.samples, 20);
  assert.ok(Number.isFinite(result.p50Ms));
  assert.ok(Number.isFinite(result.p99Ms));
  assert.ok(result.p99Ms >= result.p50Ms);
  assert.ok(result.rssKb > 0);
});

test("bench: every workload runs at least one iteration without throwing", async () => {
  const bench = new Bench();
  registerAllScenarios(bench);
  for (const c of bench.cases) {
    const result = await runCase({ ...c, iterations: 4, warmup: 1 });
    assert.equal(result.samples, 4, `${c.name} sample count`);
    assert.ok(result.p50Ms >= 0, `${c.name} p50 finite`);
  }
});
