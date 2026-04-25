import test from "node:test";
import assert from "node:assert/strict";

import { h } from "../src/runtime/element.js";
import { createFiber, type Fiber } from "../src/runtime/fiber.js";
import { useEffect, useState } from "../src/runtime/hooks.js";
import { flushAllEffects, reconcile, unmount } from "../src/runtime/reconciler.js";

test("keyed reordering preserves component identity and state by key", () => {
  function Item(props: { label: string }) {
    const [stable] = useState(() => `${props.label}-state`);
    return h("text", {}, stable);
  }

  const root = createFiber("box", {
    children: [
      h(Item, { key: "a", label: "A" }),
      h(Item, { key: "b", label: "B" }),
    ],
  }, null, null);

  commit(root);

  const firstA = root.children[0]!;
  const firstB = root.children[1]!;

  root.props = {
    children: [
      h(Item, { key: "b", label: "B2" }),
      h(Item, { key: "a", label: "A2" }),
    ],
  };

  commit(root);

  assert.equal(root.children[0], firstB);
  assert.equal(root.children[1], firstA);
  assert.equal(readState(root.children[0]!), "B-state");
  assert.equal(readState(root.children[1]!), "A-state");
});

test("mount, unmount, and remount effects fire in a stable lifecycle order", () => {
  const log: string[] = [];

  function Probe(props: { label: string }) {
    useEffect(() => {
      log.push(`mount ${props.label}`);
      return () => log.push(`cleanup ${props.label}`);
    }, []);
    return h("text", {}, props.label);
  }

  const root = createFiber("box", {
    children: [h(Probe, { key: "probe", label: "alpha" })],
  }, null, null);

  commit(root);
  assert.deepEqual(log, ["mount alpha"]);

  root.props = { children: [] };
  reconcile(root);
  assert.deepEqual(log, ["mount alpha", "cleanup alpha"]);

  root.props = {
    children: [h(Probe, { key: "probe", label: "alpha" })],
  };
  commit(root);
  assert.deepEqual(log, ["mount alpha", "cleanup alpha", "mount alpha"]);
});

test("effects clean up before re-running and process children before parents", () => {
  const log: string[] = [];

  function Child(props: { step: number }) {
    useEffect(() => {
      log.push(`mount child ${props.step}`);
      return () => log.push(`cleanup child ${props.step}`);
    }, [props.step]);
    return h("text", {}, `child ${props.step}`);
  }

  function Parent(props: { step: number }) {
    useEffect(() => {
      log.push(`mount parent ${props.step}`);
      return () => log.push(`cleanup parent ${props.step}`);
    }, [props.step]);
    return h("box", {}, h(Child, { step: props.step }));
  }

  const root = createFiber(Parent, { step: 1 }, null, null);

  commit(root);
  assert.deepEqual(log, [
    "mount child 1",
    "mount parent 1",
  ]);

  log.length = 0;
  root.props = { step: 2 };
  commit(root);
  assert.deepEqual(log, [
    "cleanup child 1",
    "cleanup parent 1",
    "mount child 2",
    "mount parent 2",
  ]);

  log.length = 0;
  unmount(root);
  assert.deepEqual(log, [
    "cleanup child 2",
    "cleanup parent 2",
  ]);
});

test("state updates scheduled during effects settle on the next commit", () => {
  const scheduled: Fiber[] = [];

  function Counter() {
    const [count, setCount] = useState(0);
    useEffect(() => {
      if (count === 0) setCount(1);
    }, [count]);
    return h("text", {}, String(count));
  }

  const root = createFiber(Counter, {}, null, null);
  root.scheduler = (fiber) => scheduled.push(fiber);

  commit(root);

  assert.equal(readState(root), 1);
  assert.deepEqual(scheduled, [root]);
  assert.equal(String(root.children[0]?.props.children ?? ""), "0");

  scheduled.length = 0;
  commit(root);

  assert.equal(String(root.children[0]?.props.children ?? ""), "1");
  assert.deepEqual(scheduled, []);
});

function commit(root: Fiber): void {
  reconcile(root);
  flushAllEffects(root);
}

function readState(fiber: Fiber): unknown {
  return fiber.hooks[0] && fiber.hooks[0].kind === "state"
    ? fiber.hooks[0].value
    : undefined;
}
