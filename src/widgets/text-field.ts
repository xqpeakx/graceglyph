import { KeyEvent } from "../input/keys.js";
import { Rect } from "../layout/rect.js";
import { ScreenBuffer } from "../render/buffer.js";
import { DefaultStyle } from "../render/style.js";
import { View, ViewOptions } from "./view.js";

export interface TextFieldOptions extends ViewOptions {
  value?: string;
  placeholder?: string;
  onChange?: (value: string) => void;
  onSubmit?: (value: string) => void;
}

export class TextField extends View {
  private value: string;
  placeholder: string;
  onChange?: (value: string) => void;
  onSubmit?: (value: string) => void;
  private cursor = 0;
  private scroll = 0;

  constructor(opts: TextFieldOptions = {}) {
    super({ ...opts, focusable: true });
    this.value = opts.value ?? "";
    this.cursor = this.value.length;
    this.placeholder = opts.placeholder ?? "";
    this.onChange = opts.onChange;
    this.onSubmit = opts.onSubmit;
    if (this.desired.height === undefined) this.desired.height = 1;
  }

  get text(): string {
    return this.value;
  }

  setText(value: string): void {
    this.value = value;
    this.cursor = Math.min(this.cursor, value.length);
    this.invalidate();
  }

  protected drawSelf(buf: ScreenBuffer, area: Rect): void {
    const theme = this.app?.theme;
    const normal = theme?.input.normal ?? DefaultStyle;
    const focused = theme?.input.focused ?? DefaultStyle;
    const placeholder = theme?.input.placeholder ?? DefaultStyle;
    const base = this.focused ? focused : normal;

    buf.fill(area, " ", base);

    this.updateScroll(area.width);

    const visible = this.value.slice(this.scroll, this.scroll + area.width);
    if (this.value.length === 0 && this.placeholder && !this.focused) {
      const ph = this.placeholder.slice(0, area.width);
      buf.writeText(area.x, area.y, ph, placeholder, area);
    } else {
      buf.writeText(area.x, area.y, visible, base, area);
    }
  }

  private updateScroll(width: number): void {
    if (this.cursor < this.scroll) this.scroll = this.cursor;
    else if (this.cursor >= this.scroll + width) this.scroll = this.cursor - width + 1;
  }

  override cursorPosition(): { x: number; y: number } | null {
    if (!this.focused) return null;
    const x = this.bounds.x + (this.cursor - this.scroll);
    const y = this.bounds.y;
    return { x, y };
  }

  override onKey(ev: KeyEvent): boolean {
    if (!this.focused) return false;
    switch (ev.name) {
      case "left":
        if (this.cursor > 0) this.cursor--;
        break;
      case "right":
        if (this.cursor < this.value.length) this.cursor++;
        break;
      case "home":
        this.cursor = 0;
        break;
      case "end":
        this.cursor = this.value.length;
        break;
      case "backspace":
        if (this.cursor > 0) {
          this.value = this.value.slice(0, this.cursor - 1) + this.value.slice(this.cursor);
          this.cursor--;
          this.onChange?.(this.value);
        }
        break;
      case "delete":
        if (this.cursor < this.value.length) {
          this.value = this.value.slice(0, this.cursor) + this.value.slice(this.cursor + 1);
          this.onChange?.(this.value);
        }
        break;
      case "enter":
        this.onSubmit?.(this.value);
        break;
      case "space":
        this.insert(" ");
        break;
      case "char":
        if (ev.ctrl || ev.alt || !ev.char || ev.char.length !== 1) return false;
        this.insert(ev.char);
        break;
      default:
        return false;
    }
    this.invalidate();
    return true;
  }

  private insert(ch: string): void {
    this.value = this.value.slice(0, this.cursor) + ch + this.value.slice(this.cursor);
    this.cursor++;
    this.onChange?.(this.value);
  }
}
