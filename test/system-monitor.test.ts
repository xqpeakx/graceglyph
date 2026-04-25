import test from "node:test";
import assert from "node:assert/strict";

import { SystemMonitorApp } from "../examples/system-monitor.js";
import {
  createStaticMonitorSource,
  type MonitorSnapshot,
} from "../examples/system-monitor-data.js";
import { h } from "../src/index.js";
import {
  renderWithFakeTty,
  runtimeWarnings,
  screenText,
  settleRuntime,
  waitFor,
} from "./support/fake-tty.js";

const SNAPSHOT: MonitorSnapshot = {
  capturedAt: Date.now(),
  hostname: "devbox",
  platform: "darwin",
  uptimeSeconds: 8_400,
  cpuPercent: 42.5,
  loadAverage: [1.2, 1.1, 0.9],
  memoryTotal: 32 * 1024 ** 3,
  memoryUsed: 12 * 1024 ** 3,
  diskPath: process.cwd(),
  diskTotal: 512 * 1024 ** 3,
  diskUsed: 211 * 1024 ** 3,
  networkRxPerSecond: 2.4 * 1024 ** 2,
  networkTxPerSecond: 384 * 1024,
  networkInterfaces: ["en0", "lo0"],
  processes: [
    { pid: 310, cpuPercent: 64.2, memoryPercent: 8.4, state: "R", command: "node", args: "node server.js" },
    { pid: 120, cpuPercent: 12.1, memoryPercent: 5.7, state: "S", command: "postgres", args: "postgres: writer process" },
    { pid: 88, cpuPercent: 4.3, memoryPercent: 2.2, state: "S", command: "nginx", args: "nginx: master process" },
  ],
};

test("system monitor renders live panels without structural warnings", async () => {
  const harness = renderWithFakeTty(
    h(SystemMonitorApp, { source: createStaticMonitorSource(SNAPSHOT), pollMs: 60_000 }),
    {
      width: 110,
      height: 30,
      runtime: { devtools: false },
    },
  );

  try {
    await waitFor(() => screenText(harness.handle).includes("System monitor"));
    const text = screenText(harness.handle);
    assert.match(text, /CPU/);
    assert.match(text, /Memory/);
    assert.match(text, /Disk/);
    assert.match(text, /Network/);
    assert.match(text, /Processes \(3\)/);
    assert.deepEqual(runtimeWarnings(harness.handle), []);
  } finally {
    harness.handle.stop();
  }
});

test("system monitor supports keyboard sort shortcuts and process filtering", async () => {
  const harness = renderWithFakeTty(
    h(SystemMonitorApp, { source: createStaticMonitorSource(SNAPSHOT), pollMs: 60_000 }),
    {
      width: 110,
      height: 30,
      runtime: { devtools: false },
    },
  );

  try {
    await waitFor(() => screenText(harness.handle).includes("sort cpu desc"));

    harness.input.emitData("\t\t\t\t");
    await settleRuntime();
    harness.input.emitData("n");
    await waitFor(() => screenText(harness.handle).includes("sort name asc"));

    harness.input.emitData("\t");
    await settleRuntime();
    harness.input.emitData("node");
    await waitFor(() => screenText(harness.handle).includes("filter node"));

    const text = screenText(harness.handle);
    assert.match(text, /node server\.js/);
    assert.doesNotMatch(text, /postgres/);
    assert.doesNotMatch(text, /nginx/);
    assert.deepEqual(runtimeWarnings(harness.handle), []);
  } finally {
    harness.handle.stop();
  }
});

test("system monitor adapts cleanly to a narrower terminal", async () => {
  const harness = renderWithFakeTty(
    h(SystemMonitorApp, { source: createStaticMonitorSource(SNAPSHOT), pollMs: 60_000 }),
    {
      width: 84,
      height: 26,
      runtime: { devtools: false },
    },
  );

  try {
    await waitFor(() => screenText(harness.handle).includes("System monitor"));
    assert.deepEqual(runtimeWarnings(harness.handle), []);
  } finally {
    harness.handle.stop();
  }
});
