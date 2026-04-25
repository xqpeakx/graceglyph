import type { Bench } from "../run.js";
import { ScreenBuffer } from "../../src/render/buffer.js";
import { DefaultStyle } from "../../src/render/style.js";

/**
 * Hammer ScreenBuffer with rapid resizes, the worst case for any
 * cell-based diff renderer. Each frame resizes to a new dimension and
 * paints something so we measure realloc + clear + write costs together.
 */
export function resizeStorm(bench: Bench): void {
  const buf = new ScreenBuffer(80, 24);
  let i = 0;

  bench.add({
    name: "resize-storm: cycle 80x24 .. 200x60",
    iterations: 1000,
    fn: () => {
      const w = 80 + ((i * 7) % 121);
      const h = 24 + ((i * 5) % 37);
      buf.resize(w, h);
      for (let y = 0; y < h; y++) {
        buf.set(y % w, y, { char: "x", style: DefaultStyle, width: 1 });
      }
      i++;
    },
  });
}
