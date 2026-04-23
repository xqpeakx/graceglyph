import test from "node:test";
import assert from "node:assert/strict";

import { Fragment, normalizeChildren } from "../src/runtime/element.js";
import { jsxs, jsx } from "../src/jsx-runtime.js";

test("jsx runtime forwards props and explicit keys", () => {
  const node = jsx("text", { children: "hello" }, "greeting");

  assert.equal(node.type, "text");
  assert.equal(node.key, "greeting");
  assert.equal(node.props.children, "hello");
});

test("jsx runtime preserves fragments and nested children", () => {
  const fragment = jsxs(Fragment, {
    children: [
      jsx("text", { children: "alpha" }),
      "beta",
    ],
  });

  assert.equal(fragment.type, Fragment);
  assert.deepEqual(
    normalizeChildren(fragment.props.children).map((child) => (
      typeof child === "string" ? child : child.type
    )),
    ["text", "beta"],
  );
});
