import test from "node:test";
import assert from "node:assert/strict";

import {
  parseColor,
  downgrade,
  rgbToAnsi16,
  rgbToAnsi256,
  _resetColorCache,
} from "../src/render/color.js";
import { ansi, DefaultColor, rgb } from "../src/render/style.js";

test("parseColor accepts hex shorthand", () => {
  _resetColorCache();
  assert.deepEqual(parseColor("#fff"), rgb(255, 255, 255));
  assert.deepEqual(parseColor("#000"), rgb(0, 0, 0));
});

test("parseColor accepts six-digit hex", () => {
  _resetColorCache();
  assert.deepEqual(parseColor("#7aa2f7"), rgb(0x7a, 0xa2, 0xf7));
});

test("parseColor accepts rgb() and hsl()", () => {
  _resetColorCache();
  assert.deepEqual(parseColor("rgb(10, 20, 30)"), rgb(10, 20, 30));
  const hsl = parseColor("hsl(0, 100%, 50%)");
  assert.equal(hsl.kind, "rgb");
});

test("parseColor accepts named colors", () => {
  _resetColorCache();
  assert.deepEqual(parseColor("red"), rgb(205, 49, 49));
});

test("parseColor returns default for null/undefined/transparent", () => {
  _resetColorCache();
  assert.deepEqual(parseColor(null), DefaultColor);
  assert.deepEqual(parseColor(undefined), DefaultColor);
  assert.deepEqual(parseColor("transparent"), DefaultColor);
});

test("parseColor accepts ansi(N) form", () => {
  _resetColorCache();
  assert.deepEqual(parseColor("ansi(208)"), ansi(208));
  assert.deepEqual(parseColor("ansi:208"), ansi(208));
});

test("parseColor throws on garbage input", () => {
  _resetColorCache();
  assert.throws(() => parseColor("not-a-color"));
});

test("downgrade truecolor→ansi256 maps the cube correctly", () => {
  const c = rgb(255, 0, 0);
  const down = downgrade(c, "ansi256");
  assert.equal(down.kind, "ansi");
  if (down.kind === "ansi") {
    // 255,0,0 lands at index 16 + 36*5 + 6*0 + 0 = 196
    assert.equal(down.code, 196);
  }
});

test("downgrade truecolor→ansi16 produces a basic color index", () => {
  const c = rgb(255, 255, 255);
  const down = downgrade(c, "ansi16");
  assert.equal(down.kind, "ansi");
  if (down.kind === "ansi") {
    assert.ok(down.code >= 0 && down.code < 16);
  }
});

test("downgrade to monochrome removes color", () => {
  assert.deepEqual(downgrade(rgb(255, 0, 0), "monochrome"), DefaultColor);
});

test("rgbToAnsi256 maps grayscale to the gray ramp", () => {
  // gray 128 should land somewhere in 232..255
  const code = rgbToAnsi256(128, 128, 128);
  assert.ok(code >= 232 && code <= 255, `expected gray ramp, got ${code}`);
});

test("rgbToAnsi16 picks reasonable nearest neighbors", () => {
  assert.equal(rgbToAnsi16(0, 0, 0), 0); // black
  assert.equal(rgbToAnsi16(255, 255, 255), 15); // bright white
});
