import type { Bench } from "../run.js";
import { ScreenBuffer } from "../../src/render/buffer.js";
import { Rect } from "../../src/layout/rect.js";
import { DefaultStyle } from "../../src/render/style.js";

/**
 * Simulate a 1000-row virtualized table scrolling one row per frame.
 * Each frame paints a 30-row visible window into a 120-cell-wide buffer.
 */
export function tableScroll(bench: Bench): void {
  const W = 120;
  const H = 30;
  const ROWS = 1000;
  const back = new ScreenBuffer(W, H);
  const front = new ScreenBuffer(W, H);
  const clip = new Rect(0, 0, W, H);

  const rows: string[] = [];
  for (let i = 0; i < ROWS; i++) {
    rows.push(`row ${i.toString().padStart(4, "0")}: ${"x".repeat(80)}`);
  }

  let scroll = 0;

  bench.add({
    name: "table-scroll: 1000 rows × 30 visible",
    iterations: 500,
    fn: () => {
      back.clear();
      const start = scroll % (ROWS - H);
      for (let y = 0; y < H; y++) {
        const row = rows[(start + y) % ROWS]!;
        back.writeText(0, y, row, DefaultStyle, clip);
      }
      let count = 0;
      for (const _ of back.diff(front)) count++;
      front.copyFrom(back);
      scroll++;
      if (count < 0) throw new Error("unreachable");
    },
  });
}
