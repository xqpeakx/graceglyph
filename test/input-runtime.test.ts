import test from "node:test";
import assert from "node:assert/strict";

import { FormApp } from "../examples/form.js";
import { h } from "../src/index.js";
import { renderWithFakeTty, screenText, settleRuntime } from "./support/fake-tty.js";

test("controlled input accumulates multiple characters from a single chunk", async () => {
  const harness = renderWithFakeTty(h(FormApp, {}), {
    width: 70,
    height: 24,
    runtime: { devtools: false },
  });

  try {
    await settleRuntime(4);
    harness.input.emitData("owen");
    await settleRuntime(4);
    assert.match(screenText(harness.handle), /Name       owen/);
  } finally {
    harness.handle.stop();
  }
});

test("single-chunk submit sees the latest controlled input value", async () => {
  const harness = renderWithFakeTty(h(FormApp, {}), {
    width: 70,
    height: 24,
    runtime: { devtools: false },
  });

  try {
    await settleRuntime(4);
    harness.input.emitData("owen\r");
    await settleRuntime(4);
    assert.match(screenText(harness.handle), /hello owen \(engineer\)/);
  } finally {
    harness.handle.stop();
  }
});
