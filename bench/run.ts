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
import { logStream } from "./scenarios/log-stream.js";
import { inputStorm } from "./scenarios/input-storm.js";

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

export interface Result {
  name: string;
  samples: number;
  meanMs: number;
  medianMs: number;
  p50Ms: number;
  p95Ms: number;
  p99Ms: number;
  minMs: number;
  maxMs: number;
  rssKb: number;
}

export async function runCase(c: BenchCase): Promise<Result> {
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

  const memory = process.memoryUsage();

  const pick = (p: number): number =>
    samples[Math.min(samples.length - 1, Math.floor(samples.length * p))] ?? 0;

  return {
    name: c.name,
    samples: samples.length,
    meanMs: mean(samples),
    medianMs: pick(0.5),
    p50Ms: pick(0.5),
    p95Ms: pick(0.95),
    p99Ms: pick(0.99),
    minMs: samples[0] ?? 0,
    maxMs: samples[samples.length - 1] ?? 0,
    rssKb: Math.round(memory.rss / 1024),
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

/** Register every shipped scenario on `bench`. Exposed so tests can drive
 *  the same suite without going through CLI argv. */
export function registerAllScenarios(bench: Bench): void {
  staticFrame(bench);
  tableScroll(bench);
  resizeStorm(bench);
  logStream(bench);
  inputStorm(bench);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const jsonMode = args.includes("--json");
  const filterArgs = args.filter((a) => a !== "--json");
  const filter = filterArgs.join(" ").trim().toLowerCase();

  const bench = new Bench();
  registerAllScenarios(bench);

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
    if (!jsonMode) process.stdout.write(`running ${c.name}... `);
    const r = await runCase(c);
    results.push(r);
    if (!jsonMode) console.log(`${format(r.medianMs)} ms p50`);
  }

  if (jsonMode) {
    console.log(
      JSON.stringify(
        {
          node: process.versions.node,
          platform: process.platform,
          arch: process.arch,
          results,
        },
        null,
        2,
      ),
    );
    return;
  }

  console.log("");
  console.log("name".padEnd(40), "samples", "  p50", "  p95", "  p99", "  max", " RSS-MB");
  for (const r of results) {
    console.log(
      r.name.padEnd(40),
      String(r.samples).padStart(7),
      format(r.p50Ms).padStart(5),
      format(r.p95Ms).padStart(5),
      format(r.p99Ms).padStart(5),
      format(r.maxMs).padStart(5),
      (r.rssKb / 1024).toFixed(1).padStart(7),
    );
  }
}

const isMain =
  typeof import.meta?.url === "string" &&
  process.argv[1] !== undefined &&
  import.meta.url === `file://${process.argv[1]}`;

if (isMain) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
