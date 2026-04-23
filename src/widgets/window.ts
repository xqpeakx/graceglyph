import { Rect } from "../layout/rect.js";
import { ScreenBuffer } from "../render/buffer.js";
import { DefaultStyle, Style } from "../render/style.js";
import { View, ViewOptions } from "./view.js";

export interface WindowOptions extends ViewOptions {
  title?: string;
  border?: boolean;
  style?: Partial<Style>;
}

/**
 * Window — a framed container with optional title. Children are laid out
 * inside the interior (one cell of padding on all sides when bordered).
 */
export class Window extends View {
  title: string;
  border: boolean;
  styleOverride?: Partial<Style>;

  constructor(opts: WindowOptions = {}) {
    super(opts);
    this.title = opts.title ?? "";
    this.border = opts.border ?? true;
    this.styleOverride = opts.style;
  }

  protected override computeBounds(container: Rect): Rect {
    return super.computeBounds(container);
  }

  override layout(container: Rect): void {
    this.bounds = this.computeBounds(container);
    const inner = this.border ? this.bounds.inset(1) : this.bounds;
    for (const c of this.children) c.layout(inner);
  }

  protected drawSelf(buf: ScreenBuffer, area: Rect): void {
    const theme = this.app?.theme;
    const frame = { ...(theme?.window.frame ?? DefaultStyle), ...this.styleOverride };
    const bodyStyle = { ...(theme?.window.body ?? DefaultStyle), ...this.styleOverride };

    buf.fill(area, " ", bodyStyle);

    if (!this.border) return;

    const { x, y, right, bottom } = area;
    const last = { x: right - 1, y: bottom - 1 };

    // corners
    buf.set(x, y, { char: "┌", style: frame, width: 1 });
    buf.set(last.x, y, { char: "┐", style: frame, width: 1 });
    buf.set(x, last.y, { char: "└", style: frame, width: 1 });
    buf.set(last.x, last.y, { char: "┘", style: frame, width: 1 });

    // top/bottom
    for (let i = x + 1; i < last.x; i++) {
      buf.set(i, y, { char: "─", style: frame, width: 1 });
      buf.set(i, last.y, { char: "─", style: frame, width: 1 });
    }
    // sides
    for (let j = y + 1; j < last.y; j++) {
      buf.set(x, j, { char: "│", style: frame, width: 1 });
      buf.set(last.x, j, { char: "│", style: frame, width: 1 });
    }

    if (this.title) {
      const titleStyle = theme?.window.title ?? DefaultStyle;
      const text = ` ${this.title} `;
      buf.writeText(x + 2, y, text, titleStyle, area);
    }
  }
}
