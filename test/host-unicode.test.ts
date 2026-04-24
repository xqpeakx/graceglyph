import test from "node:test";
import assert from "node:assert/strict";

import { Rect } from "../src/layout/rect.js";
import { ScreenBuffer } from "../src/render/buffer.js";
import { DefaultStyle } from "../src/render/style.js";
import { h } from "../src/runtime/element.js";
import { createFiber } from "../src/runtime/fiber.js";
import { layoutTree, paintTree } from "../src/runtime/host.js";
import { buildHostTree, reconcile } from "../src/runtime/reconciler.js";

test("paintTree clips combining and wide graphemes without splitting cells", () => {
  const tree = h("text", { wrap: "clip" }, "e\u0301界z");
  const root = createFiber(tree.type, tree.props, tree.key, null);
  reconcile(root);

  const host = buildHostTree(root);
  assert.ok(host);

  layoutTree(host, new Rect(0, 0, 3, 1));
  const buffer = new ScreenBuffer(3, 1);
  paintTree(host, { buffer, focusedFiber: null });

  assert.deepEqual(buffer.get(0, 0), { char: "e\u0301", style: DefaultStyle, width: 1 });
  assert.deepEqual(buffer.get(1, 0), { char: "界", style: DefaultStyle, width: 2 });
  assert.deepEqual(buffer.get(2, 0), { char: "", style: DefaultStyle, width: 0 });
});

test("paintTree keeps single-line input scrolling aligned to emoji graphemes", () => {
  const tree = h("input", { value: "a👍🏽b", width: 3, onChange: () => {} });
  const root = createFiber(tree.type, tree.props, tree.key, null);
  reconcile(root);

  const host = buildHostTree(root);
  assert.ok(host);

  layoutTree(host, new Rect(0, 0, 3, 1));
  const buffer = new ScreenBuffer(3, 1);
  paintTree(host, { buffer, focusedFiber: null });

  assert.deepEqual(buffer.get(0, 0), { char: "👍🏽", style: DefaultStyle, width: 2 });
  assert.deepEqual(buffer.get(1, 0), { char: "", style: DefaultStyle, width: 0 });
  assert.deepEqual(buffer.get(2, 0), { char: "b", style: DefaultStyle, width: 1 });
});
