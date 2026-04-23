import { Rect } from "../layout/rect.js";
import { ScreenBuffer } from "../render/buffer.js";
import { DefaultStyle } from "../render/style.js";
import { View, ViewOptions } from "./view.js";

export interface StatusBarOptions extends ViewOptions {
  text?: string;
}

/**
 * Single-line bar pinned to the bottom of its container. Useful for key hints
 * and status messages.
 */
export class StatusBar extends View {
  private _text: string;

  constructor(opts: StatusBarOptions = {}) {
    super({ ...opts, focusable: false });
    this._text = opts.text ?? "";
    if (this.desired.height === undefined) this.desired.height = 1;
  }

  setText(text: string): void {
    if (this._text === text) return;
    this._text = text;
    this.invalidate();
  }

  protected override computeBounds(container: Rect): Rect {
    const height = this.desired.height ?? 1;
    return new Rect(
      container.x,
      container.bottom - height,
      container.width,
      height,
    );
  }

  protected drawSelf(buf: ScreenBuffer, area: Rect): void {
    const style = this.app?.theme.statusBar ?? DefaultStyle;
    buf.fill(area, " ", style);
    buf.writeText(area.x + 1, area.y, this._text, style, area);
  }
}
