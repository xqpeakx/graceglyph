import test from "node:test";
import assert from "node:assert/strict";

import { Rect } from "../src/layout/rect.js";
import { h } from "../src/runtime/element.js";
import { createFiber } from "../src/runtime/fiber.js";
import { layoutTree } from "../src/runtime/host.js";
import { buildHostTree, reconcile } from "../src/runtime/reconciler.js";
import { inspectTree } from "../src/runtime/devtools.js";

test("inspector includes focused node and layout details", () => {
  const tree = h(
    "box",
    { border: true, title: "Root", direction: "column" },
    h("text", {}, "hello"),
    h("input", { value: "draft", onChange: () => {} }),
  );

  const root = createFiber(tree.type, tree.props, tree.key, null);
  reconcile(root);

  const host = buildHostTree(root);
  assert.ok(host);

  layoutTree(host, new Rect(0, 0, 40, 10));
  const focused = host.children[1] ?? null;
  const lines = inspectTree(host, focused);
  const output = lines.join("\n");

  assert.match(output, /Inspector/);
  assert.match(output, /title="Root"/);
  assert.match(output, /> input @1,2 38x1 value="draft"/);
});
