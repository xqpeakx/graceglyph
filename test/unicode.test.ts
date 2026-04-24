import test from "node:test";
import assert from "node:assert/strict";

import {
  charWidth,
  clipColumns,
  columnForIndex,
  indexForColumn,
  nextGraphemeEnd,
  previousGraphemeStart,
  sliceColumns,
  snapColumnToBoundary,
  stringWidth,
  truncateColumns,
} from "../src/render/unicode.js";

test("stringWidth treats combining marks as part of a single cell", () => {
  assert.equal(stringWidth("e\u0301"), 1);
});

test("stringWidth treats joined emoji clusters as a single wide grapheme", () => {
  assert.equal(stringWidth("👨‍👩‍👧‍👦"), 2);
  assert.equal(stringWidth("👍🏽"), 2);
  assert.equal(stringWidth("❤️"), 2);
  assert.equal(stringWidth("🇺🇸"), 2);
});

test("charWidth does not classify unassigned code points as wide", () => {
  assert.equal(charWidth(0x378), 1);
});

test("column and index helpers snap to grapheme boundaries", () => {
  const value = "a👍🏽b";

  assert.equal(nextGraphemeEnd(value, 1), 5);
  assert.equal(previousGraphemeStart(value, 5), 1);
  assert.equal(columnForIndex(value, 5), 3);
  assert.equal(indexForColumn(value, 2), 5);
  assert.equal(snapColumnToBoundary(value, 2), 1);
});

test("column clipping and truncation preserve grapheme integrity", () => {
  assert.equal(clipColumns("a👍🏽b", 3), "a👍🏽");
  assert.equal(sliceColumns("a👍🏽b", 1, 2), "👍🏽");
  assert.equal(truncateColumns("ab👍🏽cd", 5), "ab👍🏽…");
});
