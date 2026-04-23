import { Rect } from "../layout/rect.js";
import { blankCell, Cell, cellsEqual } from "./cell.js";
import { DefaultStyle, Style } from "./style.js";
import { charWidth } from "./unicode.js";

/**
 * Fixed-size cell grid. The renderer holds two buffers (front/back) and
 * diffs them to produce the minimal ANSI stream on flush.
 */
export class ScreenBuffer {
  private cells: Cell[];

  constructor(
    public width: number,
    public height: number,
  ) {
    this.cells = new Array(width * height);
    this.clear();
  }

  resize(width: number, height: number): void {
    this.width = width;
    this.height = height;
    this.cells = new Array(width * height);
    this.clear();
  }

  clear(style: Style = DefaultStyle): void {
    for (let i = 0; i < this.cells.length; i++) {
      this.cells[i] = { char: " ", style, width: 1 };
    }
  }

  get(x: number, y: number): Cell | undefined {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return undefined;
    return this.cells[y * this.width + x];
  }

  set(x: number, y: number, cell: Cell): void {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return;
    this.cells[y * this.width + x] = cell;
  }

  /** Write a string starting at (x, y), clipped to the given rect. */
  writeText(x: number, y: number, text: string, style: Style, clip: Rect): void {
    if (y < clip.y || y >= clip.bottom) return;
    let cx = x;
    for (const ch of text) {
      if (cx >= clip.right) break;
      const cp = ch.codePointAt(0) ?? 0x20;
      const w = charWidth(cp);
      if (w === 0) continue;
      if (cx >= clip.x) {
        this.set(cx, y, { char: ch, style, width: w });
        if (w === 2 && cx + 1 < clip.right) {
          this.set(cx + 1, y, { char: "", style, width: 0 });
        }
      }
      cx += w;
    }
  }

  fill(rect: Rect, char: string, style: Style): void {
    for (let y = rect.y; y < rect.bottom; y++) {
      for (let x = rect.x; x < rect.right; x++) {
        this.set(x, y, { char, style, width: 1 });
      }
    }
  }

  /** Copy contents from another buffer. Used to seed the front buffer. */
  copyFrom(other: ScreenBuffer): void {
    if (other.width !== this.width || other.height !== this.height) {
      this.resize(other.width, other.height);
    }
    for (let i = 0; i < this.cells.length; i++) {
      const c = other.cells[i]!;
      this.cells[i] = { char: c.char, style: c.style, width: c.width };
    }
  }

  /** Yield diffs vs. `prev` as a list of (x, y, cell) tuples in row-major order. */
  *diff(prev: ScreenBuffer): Generator<{ x: number; y: number; cell: Cell }> {
    if (prev.width !== this.width || prev.height !== this.height) {
      // Size changed — emit everything.
      for (let y = 0; y < this.height; y++) {
        for (let x = 0; x < this.width; x++) {
          yield { x, y, cell: this.cells[y * this.width + x]! };
        }
      }
      return;
    }
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const i = y * this.width + x;
        const a = this.cells[i]!;
        const b = prev.cells[i]!;
        if (!cellsEqual(a, b)) yield { x, y, cell: a };
      }
    }
  }
}

function _unused(_: Cell): void {
  // keep blankCell referenced for bundlers
  blankCell();
}
