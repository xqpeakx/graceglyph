import type { Bench } from "../run.js";
import { ScreenBuffer } from "../../src/render/buffer.js";
import { Rect } from "../../src/layout/rect.js";
import { DefaultStyle } from "../../src/render/style.js";

/**
 * 100k-line log buffer simulating a `tail -f` workload. We tail the last
 * 40 entries each frame and diff against the previous viewport.
 */
export function logStream(bench: Bench): void {
  const W = 160;
  const H = 40;
  const ENTRIES = 100_000;
  const back = new ScreenBuffer(W, H);
  const front = new ScreenBuffer(W, H);
  const clip = new Rect(0, 0, W, H);

  // Pre-build the log corpus once. Per-iteration cost should be paint, not
  // string allocation.
  const lines: string[] = [];
  for (let i = 0; i < ENTRIES; i++) {
    const level = i % 5 === 0 ? "ERR" : i % 3 === 0 ? "WRN" : "INF";
    lines.push(`${level} ${i.toString().padStart(6, "0")} request /api/${i % 32} ok`);
  }

  let head = 0;

  bench.add({
    name: "log-stream: tail 40 of 100k entries",
    iterations: 500,
    fn: () => {
      back.clear();
      const start = (head + ENTRIES - H) % ENTRIES;
      for (let y = 0; y < H; y++) {
        const line = lines[(start + y) % ENTRIES]!;
        back.writeText(0, y, line, DefaultStyle, clip);
      }
      let count = 0;
      for (const _cell of back.diff(front)) count++;
      front.copyFrom(back);
      head++;
      if (count < 0) throw new Error("unreachable");
    },
  });
}
