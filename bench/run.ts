/**
 * Benchmark runner.
 *
 * Each scenario is a function that takes a `Bench` and registers one or
 * more cases. The runner warms each case, samples wall-clock time, and
 * prints a results table. No external bench framework — keep deps light.
 *
 * Usage:
 *   npm run bench                # run all scenarios
 *   npm run bench -- table       # run scenarios matching "table"
 */

import { performance } from "node:perf_hooks";
import { staticFrame } from "./scenarios/static-frame.js";
import { tableScroll } from "./scenarios/table-scroll.js";
import { resizeStorm } from "./scenarios/resize-storm.js";

export interface BenchCase {
  name: string;
  iterations?: number;
  warmup?: number;
  fn: () => void | Promise<void>;
}

export class Bench {
  readonly cases: BenchCase[] = [];

  add(c: BenchCase): void {
    this.cases.push(c);
  }
}

interface Result {
  name: string;
  samples: number;
  meanMs: number;
  medianMs: number;
  p99Ms: number;
  minMs: number;
  maxMs: number;
}

async function runCase(c: BenchCase): Promise<Result> {
  const iterations = c.iterations ?? 200;
  const warmup = c.warmup ?? Math.max(10, Math.floor(iterations * 0.1));

  for (let i = 0; i < warmup; i++) await c.fn();

  const samples: number[] = [];
  for (let i = 0; i < iterations; i++) {
    const t0 = performance.now();
    await c.fn();
    samples.push(performance.now() - t0);
  }
  samples.sort((a, b) => a - b);

  return {
    name: c.name,
    samples: samples.length,
    meanMs: mean(samples),
    medianMs: samples[Math.floor(samples.length / 2)] ?? 0,
    p99Ms: samples[Math.floor(samples.length * 0.99)] ?? 0,
    minMs: samples[0] ?? 0,
    maxMs: samples[samples.length - 1] ?? 0,
  };
}

function mean(xs: number[]): number {
  let total = 0;
  for (const x of xs) total += x;
  return xs.length ? total / xs.length : 0;
}

function format(n: number): string {
  return n < 1 ? n.toFixed(3) : n.toFixed(2);
}

async function main(): Promise<void> {
  const filter = process.argv.slice(2).join(" ").trim().toLowerCase();
  const bench = new Bench();
  staticFrame(bench);
  tableScroll(bench);
  resizeStorm(bench);

  const cases = filter
    ? bench.cases.filter((c) => c.name.toLowerCase().includes(filter))
    : bench.cases;

  if (cases.length === 0) {
    console.error(`no benchmark matched "${filter}"`);
    process.exitCode = 1;
    return;
  }

  const results: Result[] = [];
  for (const c of cases) {
    process.stdout.write(`running ${c.name}... `);
    const r = await runCase(c);
    results.push(r);
    console.log(`${format(r.medianMs)} ms median`);
  }

  console.log("");
  console.log("name".padEnd(40), "samples", " mean", "median", "  p99", "  min", "  max");
  for (const r of results) {
    console.log(
      r.name.padEnd(40),
      String(r.samples).padStart(7),
      format(r.meanMs).padStart(5),
      format(r.medianMs).padStart(6),
      format(r.p99Ms).padStart(5),
      format(r.minMs).padStart(5),
      format(r.maxMs).padStart(5),
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
