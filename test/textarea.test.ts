import test from "node:test";
import assert from "node:assert/strict";

import { Rect } from "../src/layout/rect.js";
import {
  applyEditableKey,
  createEditableState,
  getCursorOffset,
  getVisibleLines,
  moveCursorToPoint,
} from "../src/runtime/editable.js";
import { inspectTree } from "../src/runtime/devtools.js";
import { h } from "../src/runtime/element.js";
import { createFiber } from "../src/runtime/fiber.js";
import { layoutTree } from "../src/runtime/host.js";
import { buildHostTree, reconcile } from "../src/runtime/reconciler.js";

test("textarea enter inserts a newline and advances the cursor", () => {
  const state = createEditableState("alpha");
  const result = applyEditableKey(state, "alpha", key("enter"), {
    mode: "multi-line",
    width: 10,
    height: 4,
  });

  assert.equal(result.handled, true);
  assert.equal(result.nextValue, "alpha\n");
  assert.equal(state.cursor, 6);
  assert.deepEqual(getCursorOffset(state, result.nextValue, 10, 4, "multi-line"), { x: 0, y: 1 });
});

test("textarea keeps horizontal scroll in sync with the cursor", () => {
  const value = "123456\nabcdef\nxyz";
  const state = createEditableState(value);
  state.cursor = 6;

  const lines = getVisibleLines(state, value, 4, 2, "multi-line");

  assert.deepEqual(lines, ["456", "def"]);
  assert.deepEqual(getCursorOffset(state, value, 4, 2, "multi-line"), { x: 3, y: 0 });
});

test("textarea mouse positioning maps viewport coordinates back to the document", () => {
  const value = "abcd\nefgh\nijkl";
  const state = createEditableState(value);
  state.scrollX = 1;
  state.scrollY = 1;

  moveCursorToPoint(state, value, 2, 1, 6, 3, "multi-line");

  assert.equal(state.cursor, 13);
});

test("textarea editing moves and deletes by grapheme clusters", () => {
  const value = "a👍🏽b";
  const state = createEditableState(value);

  const moved = applyEditableKey(state, value, key("left"), {
    mode: "single-line",
    width: 10,
    height: 1,
  });
  assert.equal(moved.nextValue, value);
  assert.equal(state.cursor, 5);

  const deleted = applyEditableKey(state, value, key("backspace"), {
    mode: "single-line",
    width: 10,
    height: 1,
  });
  assert.equal(deleted.nextValue, "ab");
  assert.equal(state.cursor, 1);
});

test("inspector describes textarea nodes", () => {
  const tree = h(
    "box",
    {},
    h("textarea", { value: "alpha\nbeta", onChange: () => {}, height: 3 }),
  );

  const root = createFiber(tree.type, tree.props, tree.key, null);
  reconcile(root);

  const host = buildHostTree(root);
  assert.ok(host);

  layoutTree(host, new Rect(0, 0, 20, 10));
  const focused = host.children[0] ?? null;
  const output = inspectTree(host, focused).join("\n");

  assert.match(output, /> textarea @0,0 20x3 value="alpha↵beta"/);
});

function key(name: "enter" | "left" | "backspace") {
  return {
    type: "key" as const,
    name,
    ctrl: false,
    alt: false,
    shift: false,
    raw: "",
  };
}
