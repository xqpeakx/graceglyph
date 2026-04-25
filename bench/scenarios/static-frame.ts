import type { Bench } from "../run.js";
import { ScreenBuffer } from "../../src/render/buffer.js";
import { DefaultStyle } from "../../src/render/style.js";

/**
 * Paint a 200x60 buffer (~12k cells) and diff against a fresh empty buffer.
 * Approximates the work a non-trivial app does each frame.
 */
export function staticFrame(bench: Bench): void {
  const W = 200;
  const H = 60;

  const back = new ScreenBuffer(W, H);
  const front = new ScreenBuffer(W, H);

  bench.add({
    name: "static-frame: 200x60 paint",
    iterations: 500,
    fn: () => {
      back.clear();
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          back.set(x, y, {
            char: ((x + y) & 1) === 0 ? "." : "#",
            style: DefaultStyle,
            width: 1,
          });
        }
      }
    },
  });

  bench.add({
    name: "static-frame: 200x60 diff (full)",
    iterations: 500,
    fn: () => {
      front.clear();
      back.clear();
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          back.set(x, y, { char: "x", style: DefaultStyle, width: 1 });
        }
      }
      // Consume the iterator.
      let count = 0;
      for (const _ of back.diff(front)) count++;
      if (count === 0) throw new Error("diff produced zero cells");
    },
  });
}
