import { Rect } from "../layout/rect.js";
import { ScreenBuffer } from "../render/buffer.js";
import { DefaultStyle, Style } from "../render/style.js";
import { stringWidth } from "../render/unicode.js";
import { View, ViewOptions } from "./view.js";

export type TextAlign = "left" | "center" | "right";

export interface LabelOptions extends ViewOptions {
  text?: string;
  align?: TextAlign;
  style?: Partial<Style>;
}

export class Label extends View {
  private _text: string;
  align: TextAlign;
  styleOverride?: Partial<Style>;

  constructor(opts: LabelOptions = {}) {
    super({ ...opts, focusable: false });
    this._text = opts.text ?? "";
    this.align = opts.align ?? "left";
    this.styleOverride = opts.style;
    if (this.desired.height === undefined) this.desired.height = 1;
    if (this.desired.width === undefined) {
      this.desired.width = Math.max(1, stringWidth(this._text));
    }
  }

  get text(): string {
    return this._text;
  }

  setText(text: string): void {
    if (this._text === text) return;
    this._text = text;
    this.invalidate();
  }

  protected drawSelf(buf: ScreenBuffer, area: Rect): void {
    const style = { ...(this.app?.theme.base ?? DefaultStyle), ...this.styleOverride };
    const w = stringWidth(this._text);
    let x = area.x;
    if (this.align === "center") x += Math.max(0, Math.floor((area.width - w) / 2));
    else if (this.align === "right") x += Math.max(0, area.width - w);
    buf.writeText(x, area.y, this._text, style, area);
  }
}
