import test from "node:test";
import assert from "node:assert/strict";

import { createFiber } from "../src/runtime/fiber.js";
import { useState, withFiber } from "../src/runtime/hooks.js";

test("state updates schedule through the owning fiber scheduler", () => {
  const calls: string[] = [];

  const first = createFiber(() => null, {}, null, null);
  first.scheduler = () => calls.push("first");
  let setFirst!: (next: number) => void;
  withFiber(first, () => {
    [, setFirst] = useState(0);
  });

  const second = createFiber(() => null, {}, null, null);
  second.scheduler = () => calls.push("second");
  let setSecond!: (next: number) => void;
  withFiber(second, () => {
    [, setSecond] = useState(0);
  });

  setFirst(1);
  setSecond(1);

  assert.deepEqual(calls, ["first", "second"]);
});

test("child fibers inherit their parent scheduler", () => {
  const calls: string[] = [];
  const parent = createFiber(() => null, {}, null, null);
  parent.scheduler = () => calls.push("parent");

  const child = createFiber(() => null, {}, null, parent);
  let setChild!: (next: number) => void;
  withFiber(child, () => {
    [, setChild] = useState(0);
  });

  setChild(1);

  assert.deepEqual(calls, ["parent"]);
});
