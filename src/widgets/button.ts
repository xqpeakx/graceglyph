import { KeyEvent, MouseEvent } from "../input/keys.js";
import { Rect } from "../layout/rect.js";
import { ScreenBuffer } from "../render/buffer.js";
import { DefaultStyle } from "../render/style.js";
import { stringWidth } from "../render/unicode.js";
import { View, ViewOptions } from "./view.js";

export interface ButtonOptions extends ViewOptions {
  label: string;
  onPress?: () => void;
}

export class Button extends View {
  label: string;
  onPress?: () => void;
  private pressed = false;

  constructor(opts: ButtonOptions) {
    super({ ...opts, focusable: true });
    this.label = opts.label;
    this.onPress = opts.onPress;
    if (this.desired.height === undefined) this.desired.height = 1;
    if (this.desired.width === undefined) {
      this.desired.width = stringWidth(this.label) + 4;
    }
  }

  protected drawSelf(buf: ScreenBuffer, area: Rect): void {
    const theme = this.app?.theme;
    const style = this.pressed
      ? theme?.button.pressed
      : this.focused
        ? theme?.button.focused
        : theme?.button.normal;
    const resolved = style ?? DefaultStyle;

    buf.fill(area, " ", resolved);
    const text = `[ ${this.label} ]`;
    const w = stringWidth(text);
    const x = area.x + Math.max(0, Math.floor((area.width - w) / 2));
    const y = area.y + Math.floor(area.height / 2);
    buf.writeText(x, y, text, resolved, area);
  }

  override onKey(ev: KeyEvent): boolean {
    if (!this.focused) return false;
    if (ev.name === "enter" || (ev.name === "space")) {
      this.trigger();
      return true;
    }
    return false;
  }

  override onMouse(ev: MouseEvent): boolean {
    if (ev.button !== "left") return false;
    if (ev.action === "press") {
      this.pressed = true;
      this.invalidate();
      return true;
    }
    if (ev.action === "release") {
      if (this.pressed) {
        this.pressed = false;
        this.trigger();
        this.invalidate();
      }
      return true;
    }
    return false;
  }

  private trigger(): void {
    this.pressed = true;
    this.invalidate();
    queueMicrotask(() => {
      this.pressed = false;
      this.invalidate();
    });
    this.onPress?.();
  }
}
