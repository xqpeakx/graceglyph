import test from "node:test";
import assert from "node:assert/strict";

import { Rect } from "../src/layout/rect.js";
import { ScreenBuffer } from "../src/render/buffer.js";
import { DefaultStyle } from "../src/render/style.js";

test("screen buffer writes wide characters as a leading cell plus trailing placeholder", () => {
  const buffer = new ScreenBuffer(4, 1);

  buffer.writeText(0, 0, "😀", DefaultStyle, new Rect(0, 0, 4, 1));

  assert.deepEqual(buffer.get(0, 0), { char: "😀", style: DefaultStyle, width: 2 });
  assert.deepEqual(buffer.get(1, 0), { char: "", style: DefaultStyle, width: 0 });
});

test("screen buffer omits wide characters that would overflow the clip rect", () => {
  const buffer = new ScreenBuffer(3, 1);

  buffer.writeText(2, 0, "😀", DefaultStyle, new Rect(0, 0, 3, 1));

  assert.deepEqual(buffer.get(2, 0), { char: " ", style: DefaultStyle, width: 1 });
  assert.equal(buffer.get(1, 0)?.char, " ");
});

test("screen buffer diff only reports changed cells", () => {
  const previous = new ScreenBuffer(3, 1);
  const next = new ScreenBuffer(3, 1);

  next.writeText(1, 0, "x", DefaultStyle, new Rect(0, 0, 3, 1));

  const diffs = [...next.diff(previous)];

  assert.deepEqual(diffs, [
    {
      x: 1,
      y: 0,
      cell: { char: "x", style: DefaultStyle, width: 1 },
    },
  ]);
});
