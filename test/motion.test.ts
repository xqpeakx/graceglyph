import test from "node:test";
import assert from "node:assert/strict";

import {
  Stream,
  Transition,
  createMotion,
  easings,
  h,
  spring,
  subscribeFrame,
  useState,
} from "../src/index.js";
import {
  __testReset,
  __testTick,
  frameSchedulerActive,
  frameSubscriberCount,
} from "../src/runtime/frame.js";
import { renderWithFakeTty, screenText, settleRuntime, waitFor } from "./support/fake-tty.js";

test("frame scheduler stays idle until a subscriber registers", () => {
  __testReset();
  assert.equal(frameSubscriberCount(), 0);
  assert.equal(frameSchedulerActive(), false);
  const cancel = subscribeFrame(() => {});
  assert.equal(frameSchedulerActive(), true);
  cancel();
  assert.equal(frameSchedulerActive(), false);
});

test("easings.linear and easings.easeOut respect endpoints", () => {
  for (const fn of [easings.linear, easings.easeOut, easings.easeInOut]) {
    assert.equal(fn(0), 0);
    assert.ok(Math.abs(fn(1) - 1) < 1e-6);
  }
  // easeOut should be ahead of linear at t=0.25.
  assert.ok(easings.easeOut(0.25) > easings.linear(0.25));
});

test("spring tween ends at 1", () => {
  const fn = spring();
  assert.equal(fn(0), 0);
  assert.ok(Math.abs(fn(1) - 1) < 1e-6);
});

test("createMotion interpolates between values across frame ticks", () => {
  __testReset();
  const m = createMotion<number>(0, { duration: 200, easing: easings.linear });
  const samples: number[] = [];
  m.subscribe((v) => samples.push(v));
  m.animateTo(100);
  __testTick(50);
  __testTick(50);
  __testTick(50);
  __testTick(50);
  // After 200ms of linear motion we should be at the target (with some
  // floating-point slack).
  const last = samples[samples.length - 1]!;
  assert.ok(last >= 99.9, `expected ~100, got ${last}`);
  m.dispose();
});

test("createMotion stops scheduling after completion when hold is false", () => {
  __testReset();
  const m = createMotion<number>(0, { duration: 100, easing: easings.linear });
  m.animateTo(10);
  __testTick(60);
  __testTick(60);
  // Animation ran to completion; scheduler should let go.
  assert.equal(frameSubscriberCount(), 0);
  m.dispose();
});

test("Transition unmounts children after leave when configured", async (t) => {
  __testReset();
  function App() {
    const [show, setShow] = useState(true);
    setTimeout(() => setShow(false), 5);
    return h(Transition, {
      show,
      preset: "fade",
      duration: 30,
      unmount: true,
    } as Record<string, unknown>, h("text", {}, "hello world"));
  }
  const harness = renderWithFakeTty(h(App, {}), { width: 16, height: 2 });
  t.after(() => harness.handle.stop());
  await settleRuntime();
  assert.match(screenText(harness.handle), /hello world/);
  await waitFor(() => !/hello world/.test(screenText(harness.handle)), { timeoutMs: 800 });
});

test("Stream consumes async iterable progressively", async (t) => {
  async function* source(): AsyncGenerator<string> {
    for (const msg of ["alpha", "bravo", "charlie", "delta"]) {
      yield msg;
      await new Promise((resolve) => setTimeout(resolve, 5));
    }
  }
  const harness = renderWithFakeTty(
    h(Stream, {
      source: source(),
      render: (item: string) => item,
      height: 4,
    } as Record<string, unknown>),
    { width: 16, height: 4 },
  );
  t.after(() => harness.handle.stop());
  await waitFor(() => /charlie/.test(screenText(harness.handle)));
  await waitFor(() => /delta/.test(screenText(harness.handle)));
});
