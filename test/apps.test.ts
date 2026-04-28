import test from "node:test";
import assert from "node:assert/strict";

import { parseArgs as parseLogsArgs, parseLine } from "../apps/gg-logs/index.js";
import { deltaUtil, parseArgs as parseMonitorArgs, snapshot } from "../apps/gg-monitor/index.js";

// -- gg-logs ----------------------------------------------------------------

test("gg-logs parseArgs collects files and flags", () => {
  const result = parseLogsArgs([
    "/var/log/app.log",
    "--regex",
    "ERROR",
    "--level",
    "warn",
    "--theme",
    "tarnished",
  ]);
  assert.deepEqual(result.files, ["/var/log/app.log"]);
  assert.equal(result.regex, "ERROR");
  assert.equal(result.level, "warn");
  assert.equal(result.theme, "tarnished");
  assert.equal(result.follow, true);
});

test("gg-logs parseArgs respects --no-follow", () => {
  const result = parseLogsArgs(["a.log", "b.log", "--no-follow"]);
  assert.deepEqual(result.files, ["a.log", "b.log"]);
  assert.equal(result.follow, false);
});

test("gg-logs parseArgs throws on unknown flags", () => {
  assert.throws(() => parseLogsArgs(["--frobnicate"]), /unknown flag/);
});

test("gg-logs parseLine classifies severity from common log shapes", () => {
  assert.equal(parseLine("2026-04-25 12:00:00 INFO  request /api/x ok").level, "info");
  assert.equal(parseLine("2026-04-25 12:00:00 WARN cache miss").level, "warn");
  assert.equal(parseLine("ERROR upstream returned 503").level, "error");
  assert.equal(parseLine("DEBUG gc collected 4MB").level, "debug");
  assert.equal(parseLine("plain message with no level").level, "info");
});

test("gg-logs parseLine extracts ISO timestamps when present", () => {
  const parsed = parseLine("2026-04-25T12:00:00Z INFO ok");
  assert.ok(typeof parsed.timestamp === "number");
  assert.ok(Number.isFinite(parsed.timestamp!));
});

// -- gg-monitor -------------------------------------------------------------

test("gg-monitor deltaUtil reports zero util when nothing changed", () => {
  const sample = [{ user: 100, nice: 0, sys: 50, idle: 850, irq: 0 }];
  const out = deltaUtil(sample, sample);
  assert.deepEqual(out, [0]);
});

test("gg-monitor deltaUtil computes proportional busy fraction", () => {
  const a = [{ user: 0, nice: 0, sys: 0, idle: 0, irq: 0 }];
  const b = [{ user: 75, nice: 0, sys: 25, idle: 100, irq: 0 }];
  const [util] = deltaUtil(a, b);
  // 100 idle out of 200 total → 50% busy.
  assert.ok(Math.abs(util! - 0.5) < 1e-9);
});

test("gg-monitor snapshot returns a complete SystemSnapshot", () => {
  const before = Array.from({ length: 4 }, () => ({
    user: 0,
    nice: 0,
    sys: 0,
    idle: 0,
    irq: 0,
  }));
  const result = snapshot(before);
  assert.ok(result.system.totalMemBytes > 0);
  assert.equal(result.system.loadAvg.length, 3);
  assert.ok(typeof result.system.hostname === "string");
  assert.ok(result.system.cpuUtil.length >= 1);
  assert.ok(result.cpu.length === result.system.cpuUtil.length);
});

test("gg-monitor parseArgs accepts --interval and --theme", () => {
  const result = parseMonitorArgs(["--interval", "500", "--theme", "tarnished"]);
  assert.equal(result.intervalMs, 500);
  assert.equal(result.theme, "tarnished");
});

test("gg-monitor parseArgs rejects too-short intervals", () => {
  assert.throws(() => parseMonitorArgs(["--interval", "10"]), /≥ 100/);
});
