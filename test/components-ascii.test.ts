import test from "node:test";
import assert from "node:assert/strict";

import {
  AsciiArt,
  Banner,
  BigText,
  SplashScreen,
  builtInThemes,
  figletBlock,
  h,
} from "../src/index.js";
import { renderWithFakeTty, screenText, settleRuntime } from "./support/fake-tty.js";

test("figletBlock produces the documented row count and width", () => {
  const out = figletBlock("HI");
  const rows = out.split("\n");
  assert.equal(rows.length, 5);
  // Each glyph is 6 cells; "HI" → 12 cells.
  for (const row of rows) {
    assert.equal(row.length, 12);
  }
  // The middle row of the H glyph is solid block — assert it contains █.
  assert.match(rows[2]!, /█/);
});

test("figletBlock falls back to a glyph for unknown characters", () => {
  const out = figletBlock("@");
  // 5 rows of 6 cells each.
  assert.equal(out.split("\n").length, 5);
});

test("AsciiArt preserves trailing spaces and aligns content", async (t) => {
  const harness = renderWithFakeTty(
    h(AsciiArt, { children: "abc\nxy\nz", align: "center", width: 5 } as Record<string, unknown>),
    { width: 8, height: 4 },
  );
  t.after(() => harness.handle.stop());
  await settleRuntime();
  const rows = screenText(harness.handle).split("\n").slice(0, 3);
  // "abc" centered in 5 cells: " abc "
  assert.match(rows[0]!, / abc /);
  // "xy" centered in 5: floor(3/2)=1 prefix, ceil(3/2)=2 suffix → " xy  "
  assert.match(rows[1]!, / xy {2}/);
  // "z" centered in 5: "  z  "
  assert.match(rows[2]!, /  z  /);
});

test("BigText renders block-letter glyphs in five rows", async (t) => {
  const harness = renderWithFakeTty(
    h(BigText, { children: "GG" }),
    { width: 16, height: 6 },
  );
  t.after(() => harness.handle.stop());
  await settleRuntime();
  const text = screenText(harness.handle);
  // Expect at least one ████ run somewhere in the canvas.
  assert.match(text, /█{3,}/);
  // 5 row block + maybe trailing — first 5 should each contain a glyph cell.
  const rows = text.split("\n").slice(0, 5);
  const filled = rows.filter((r) => r.includes("█"));
  assert.ok(filled.length >= 4, "expected at least 4 rows with block glyphs");
});

test("BigText accepts a glyph override", async (t) => {
  const harness = renderWithFakeTty(
    h(BigText, { children: "X", glyph: "*" }),
    { width: 12, height: 6 },
  );
  t.after(() => harness.handle.stop());
  await settleRuntime();
  const text = screenText(harness.handle);
  assert.match(text, /\*+/);
  assert.doesNotMatch(text, /█/);
});

test("Banner stacks art, title, and subtitle", async (t) => {
  const harness = renderWithFakeTty(
    h(Banner, {
      title: "OK",
      subtitle: "ready to ship",
      art: "* * *",
    } as Record<string, unknown>),
    { width: 36, height: 16 },
  );
  t.after(() => harness.handle.stop());
  await settleRuntime();
  const text = screenText(harness.handle);
  assert.match(text, /\* \* \*/);
  assert.match(text, /█/);
  assert.match(text, /ready to ship/);
});

test("SplashScreen lays out left/right panels and footer", async (t) => {
  const harness = renderWithFakeTty(
    h(SplashScreen, {
      title: "GG",
      subtitle: "TUI",
      leftPanel: "left",
      rightPanel: "right",
      footer: "press any key",
    } as Record<string, unknown>),
    { width: 70, height: 14 },
  );
  t.after(() => harness.handle.stop());
  await settleRuntime();
  const text = screenText(harness.handle);
  assert.match(text, /left/);
  assert.match(text, /right/);
  assert.match(text, /press any key/);
});

test("tarnished theme is registered and accessible", () => {
  assert.ok(builtInThemes.tarnished);
  // base palette should be amber-on-black, not the default off-white-on-black.
  assert.equal(builtInThemes.tarnished.name, "tarnished");
});
