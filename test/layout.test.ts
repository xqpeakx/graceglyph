import test from "node:test";
import assert from "node:assert/strict";

import { Rect } from "../src/layout/rect.js";
import { h } from "../src/runtime/element.js";
import { createFiber } from "../src/runtime/fiber.js";
import { layoutTree } from "../src/runtime/host.js";
import { buildHostTree, reconcile } from "../src/runtime/reconciler.js";

test("row layout distributes remaining space to growing children inside border and padding", () => {
  const tree = h(
    "box",
    { direction: "row", border: true, padding: 1, gap: 1 },
    h("box", { width: 3 }),
    h("box", { grow: 1 }),
    h("box", { width: 4 }),
  );

  const root = createFiber(tree.type, tree.props, tree.key, null);
  reconcile(root);

  const host = buildHostTree(root);
  assert.ok(host);

  layoutTree(host, new Rect(0, 0, 20, 6));

  assert.deepEqual(host.layout, new Rect(0, 0, 20, 6));
  assert.deepEqual(host.children[0]?.layout, new Rect(2, 2, 3, 2));
  assert.deepEqual(host.children[1]?.layout, new Rect(6, 2, 7, 2));
  assert.deepEqual(host.children[2]?.layout, new Rect(14, 2, 4, 2));
});

test("column layout honors justify and align for non-growing children", () => {
  const tree = h(
    "box",
    { direction: "column", justify: "end", align: "center", gap: 1 },
    h("box", { width: 6, height: 1 }),
    h("box", { width: 4, height: 2 }),
  );

  const root = createFiber(tree.type, tree.props, tree.key, null);
  reconcile(root);

  const host = buildHostTree(root);
  assert.ok(host);

  layoutTree(host, new Rect(0, 0, 20, 10));

  assert.deepEqual(host.children[0]?.layout, new Rect(7, 6, 6, 1));
  assert.deepEqual(host.children[1]?.layout, new Rect(8, 8, 4, 2));
});
