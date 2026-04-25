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
  const lines = inspectTree(host, focused, ["key char:s", "mouse left press @1,2"]);
  const output = lines.join("\n");

  assert.match(output, /Inspector/);
  assert.match(output, /title="Root"/);
  assert.match(output, /focus path: box > input/);
  assert.match(output, /events:/);
  assert.match(output, /key char:s/);
  assert.match(output, /> input @1,2 38x1 value="draft".*renders=1/);
});

test("inspector describes layout modes and constraints", () => {
  const tree = h(
    "box",
    { layout: "dock", minWidth: 10, maxWidth: 40, aspectRatio: 2 },
    h("box", { dock: "left", width: 8 }),
    h("box", { dock: "fill", layout: "grid", gridColumns: "1fr 1fr" }),
    h("box", { position: "absolute", right: 1, top: 1, width: 4, height: 2 }),
  );

  const root = createFiber(tree.type, tree.props, tree.key, null);
  reconcile(root);

  const host = buildHostTree(root);
  assert.ok(host);

  layoutTree(host, new Rect(0, 0, 30, 10));
  const output = inspectTree(host, null).join("\n");

  assert.match(output, /layout=dock/);
  assert.match(output, /constraints\(w=10..40\)/);
  assert.match(output, /ratio=2/);
  assert.match(output, /dock=left/);
  assert.match(output, /layout=grid/);
  assert.match(output, /pos=absolute/);
});
