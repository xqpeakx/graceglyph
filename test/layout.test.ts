import test from "node:test";
import assert from "node:assert/strict";

import { Rect } from "../src/layout/rect.js";
import { ScreenBuffer } from "../src/render/buffer.js";
import { DefaultStyle } from "../src/render/style.js";
import { h } from "../src/runtime/element.js";
import { createFiber } from "../src/runtime/fiber.js";
import { layoutTree, paintTree } from "../src/runtime/host.js";
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

test("layout clips overflowing children to the parent inner bounds", () => {
  const tree = h(
    "box",
    { direction: "row", border: true, padding: 1, gap: 1 },
    h("box", { width: 5 }),
    h("box", { width: 5 }),
    h("box", { width: 5 }),
  );

  const root = createFiber(tree.type, tree.props, tree.key, null);
  reconcile(root);

  const host = buildHostTree(root);
  assert.ok(host);

  layoutTree(host, new Rect(0, 0, 12, 6));

  assert.deepEqual(host.children[0]?.layout, new Rect(2, 2, 5, 2));
  assert.deepEqual(host.children[1]?.layout, new Rect(8, 2, 2, 2));
  assert.equal(host.children[2]?.layout.x, 14);
  assert.equal(host.children[2]?.layout.y, 2);
  assert.equal(host.children[2]?.layout.width, 0);
  assert.equal(host.children[2]?.layout.height, 2);
});

test("border titles clip without overwriting frame corners", () => {
  const tree = h(
    "box",
    { border: true, title: "ABCDEFGHIJ", width: 8, height: 3, style: { bg: DefaultStyle.bg } },
  );

  const root = createFiber(tree.type, tree.props, tree.key, null);
  reconcile(root);

  const host = buildHostTree(root);
  assert.ok(host);

  layoutTree(host, new Rect(0, 0, 8, 3));
  const buffer = new ScreenBuffer(8, 3);
  paintTree(host, { buffer, focusedFiber: null });

  assert.equal(readRow(buffer, 0), "┌─ AB…─┐");
});

test("deep nesting with padding and gaps keeps painted content inside the root bounds", () => {
  const tree = h(
    "box",
    { border: true, padding: 1, width: 20, height: 10 },
    h(
      "box",
      { border: true, padding: 1, gap: 1, direction: "row" },
      h(
        "box",
        { border: true, padding: 1, width: 8 },
        h("text", {}, "alpha"),
      ),
      h(
        "box",
        { border: true, padding: 1, width: 12 },
        h("text", {}, "beta"),
      ),
    ),
  );

  const root = createFiber(tree.type, tree.props, tree.key, null);
  reconcile(root);

  const host = buildHostTree(root);
  assert.ok(host);

  layoutTree(host, new Rect(0, 0, 20, 10));
  assertAllDescendantsClipped(host);

  const buffer = new ScreenBuffer(20, 10);
  paintTree(host, { buffer, focusedFiber: null });
  assert.equal(buffer.get(19, 0)?.char, "┐");
  assert.equal(buffer.get(0, 9)?.char, "└");
  assert.equal(buffer.get(19, 9)?.char, "┘");
});

function readRow(buffer: ScreenBuffer, y: number): string {
  let out = "";
  for (let x = 0; x < buffer.width; x++) {
    const cell = buffer.get(x, y);
    if (!cell || cell.width === 0) continue;
    out += cell.char || " ";
  }
  return out;
}

function assertAllDescendantsClipped(node: ReturnType<typeof buildHostTree> extends infer T ? Exclude<T, null> : never): void {
  for (const child of node.children) {
    if (child.layout.width > 0 && child.layout.height > 0) {
      assert.ok(child.layout.x >= node.layout.x);
      assert.ok(child.layout.y >= node.layout.y);
      assert.ok(child.layout.right <= node.layout.right);
      assert.ok(child.layout.bottom <= node.layout.bottom);
    }
    assertAllDescendantsClipped(child);
  }
}
