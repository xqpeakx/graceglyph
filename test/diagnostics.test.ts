import test from "node:test";
import assert from "node:assert/strict";

import { inspectTree } from "../src/runtime/devtools.js";
import { h } from "../src/runtime/element.js";
import { createFiber } from "../src/runtime/fiber.js";
import { Runtime } from "../src/runtime/runtime.js";
import { layoutTree } from "../src/runtime/host.js";
import { buildHostTree, reconcile } from "../src/runtime/reconciler.js";
import { Rect } from "../src/layout/rect.js";

test("invalid host props fail with a clear diagnostic", () => {
  const root = createFiber(
    "input",
    {
      value: 42,
      onChange: () => {},
    } as unknown as Record<string, unknown>,
    null,
    null,
  );

  assert.throws(
    () => reconcile(root),
    /invalid prop "value" on <input>; expected a string, got 42 \(number\)/,
  );
});

test("invalid accessibility metadata fails with a clear diagnostic", () => {
  const root = createFiber(
    "box",
    {
      accessibilityLabel: 42,
    } as unknown as Record<string, unknown>,
    null,
    null,
  );

  assert.throws(
    () => reconcile(root),
    /invalid prop "accessibilityLabel" on <box>; expected a string, got 42 \(number\)/,
  );
});

test("fatal runtime errors include a component stack", () => {
  function Bomb(): never {
    throw new Error("boom");
  }

  function Wrapper() {
    return h(Bomb, {});
  }

  const runtime = new Runtime({ devtools: false });

  assert.throws(
    () => runtime.mount(h(Wrapper, {})),
    (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.match(error.message, /graceglyph fatal error during mount: boom/);
      assert.match(error.message, /Component stack:/);
      assert.match(error.message, /in Bomb/);
      assert.match(error.message, /in Wrapper/);
      return true;
    },
  );
});

test("inspector surfaces layout warnings for constrained nodes", () => {
  const tree = h(
    "box",
    { border: true, title: "Too wide for this frame", width: 8, height: 4 },
    h(
      "box",
      { direction: "row", gap: 1 },
      h("box", { width: 4 }),
      h("box", { width: 4 }),
      h("box", { width: 4 }),
    ),
  );

  const root = createFiber(tree.type, tree.props, tree.key, null);
  reconcile(root);

  const host = buildHostTree(root);
  assert.ok(host);

  layoutTree(host, new Rect(0, 0, 8, 4));
  const output = inspectTree(host, null).join("\n");

  assert.match(output, /warnings: [1-9]/);
  assert.match(output, /title is truncated to fit the border/);
  assert.match(output, /width clipped/);
});

test("invalid layout constraints fail with a clear diagnostic", () => {
  const root = createFiber(
    "box",
    {
      minWidth: 12,
      maxWidth: 4,
    } as unknown as Record<string, unknown>,
    null,
    null,
  );

  assert.throws(
    () => reconcile(root),
    /invalid prop "minWidth" on <box>; expected less than or equal to maxWidth/,
  );
});

test("invalid breakpoint layout patches fail with a clear diagnostic", () => {
  const root = createFiber(
    "box",
    {
      breakpoints: {
        ">=80": {
          direction: "sideways",
        },
      },
    } as unknown as Record<string, unknown>,
    null,
    null,
  );

  assert.throws(
    () => reconcile(root),
    /invalid prop "breakpoints\.>=80\.direction" on <box>; expected one of "row", "column"/,
  );
});
