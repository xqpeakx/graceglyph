import test from "node:test";
import assert from "node:assert/strict";

import { createFiber } from "../src/runtime/fiber.js";
import {
  cleanupEffects,
  flushEffects,
  useState,
  useTerminalSize,
  useTheme,
  withFiber,
} from "../src/runtime/hooks.js";
import { defaultTheme } from "../src/theme/theme.js";
import { DUMB_CAPABILITIES } from "../src/render/capabilities.js";

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

test("state updates skip scheduler when value is unchanged", () => {
  const calls: string[] = [];
  const fiber = createFiber(() => null, {}, null, null);
  fiber.scheduler = () => calls.push("commit");
  let setValue!: (next: number) => void;

  withFiber(fiber, () => {
    [, setValue] = useState(1);
  });

  setValue(1);
  setValue(2);

  assert.deepEqual(calls, ["commit"]);
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

test("useTheme returns the mounted runtime theme", () => {
  const theme = defaultTheme();
  const fiber = createFiber(() => null, {}, null, null);
  fiber.environment = {
    theme,
    setTheme: () => {},
    size: () => ({ width: 80, height: 24 }),
    onResize: () => () => {},
    capabilities: DUMB_CAPABILITIES,
  };

  let value = null;
  withFiber(fiber, () => {
    value = useTheme();
  });

  assert.equal(value, theme);
});

test("useTerminalSize subscribes to resize events and releases the listener on cleanup", () => {
  const calls: string[] = [];
  const listeners = new Set<(size: { width: number; height: number }) => void>();
  const fiber = createFiber(() => null, {}, null, null);
  fiber.scheduler = () => calls.push("commit");
  fiber.environment = {
    theme: defaultTheme(),
    setTheme: () => {},
    size: () => ({ width: 80, height: 24 }),
    onResize: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    capabilities: DUMB_CAPABILITIES,
  };

  let size = null;
  withFiber(fiber, () => {
    size = useTerminalSize();
  });
  assert.deepEqual(size, { width: 80, height: 24 });

  flushEffects(fiber);
  assert.equal(listeners.size, 1);

  const listener = listeners.values().next().value as (size: {
    width: number;
    height: number;
  }) => void;
  listener({ width: 100, height: 30 });
  assert.deepEqual(calls, ["commit"]);

  withFiber(fiber, () => {
    size = useTerminalSize();
  });
  assert.deepEqual(size, { width: 100, height: 30 });

  cleanupEffects(fiber);
  assert.equal(listeners.size, 0);
});
