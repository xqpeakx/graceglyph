import { KeyEvent } from "../input/keys.js";
import { Rect } from "../layout/rect.js";
import { ScreenBuffer } from "../render/buffer.js";
import { DefaultStyle } from "../render/style.js";
import { View, ViewOptions } from "./view.js";

export interface ListViewOptions<T> extends ViewOptions {
  items?: T[];
  render?: (item: T, index: number) => string;
  onSelect?: (item: T, index: number) => void;
  onChange?: (item: T, index: number) => void;
}

export class ListView<T> extends View {
  private items: T[];
  private renderItem: (item: T, index: number) => string;
  onSelect?: (item: T, index: number) => void;
  onChange?: (item: T, index: number) => void;
  private selected = 0;
  private scroll = 0;

  constructor(opts: ListViewOptions<T> = {}) {
    super({ ...opts, focusable: true });
    this.items = opts.items ?? [];
    this.renderItem = opts.render ?? ((item) => String(item));
    this.onSelect = opts.onSelect;
    this.onChange = opts.onChange;
  }

  setItems(items: T[]): void {
    this.items = items;
    if (this.selected >= items.length) this.selected = Math.max(0, items.length - 1);
    this.invalidate();
  }

  selectedIndex(): number {
    return this.selected;
  }

  selectedItem(): T | undefined {
    return this.items[this.selected];
  }

  protected drawSelf(buf: ScreenBuffer, area: Rect): void {
    const theme = this.app?.theme;
    const normal = theme?.list.normal ?? DefaultStyle;
    const selected = theme?.list.selected ?? DefaultStyle;
    buf.fill(area, " ", normal);

    this.updateScroll(area.height);

    for (let row = 0; row < area.height; row++) {
      const idx = this.scroll + row;
      if (idx >= this.items.length) break;
      const style = idx === this.selected && this.focused ? selected : normal;
      const text = this.renderItem(this.items[idx]!, idx).slice(0, area.width);
      // Pad to full width so the row highlight spans it.
      const padded = text + " ".repeat(Math.max(0, area.width - text.length));
      buf.writeText(area.x, area.y + row, padded, style, area);
    }
  }

  private updateScroll(height: number): void {
    if (this.selected < this.scroll) this.scroll = this.selected;
    else if (this.selected >= this.scroll + height) {
      this.scroll = this.selected - height + 1;
    }
  }

  override onKey(ev: KeyEvent): boolean {
    if (!this.focused || this.items.length === 0) return false;
    switch (ev.name) {
      case "up":
        if (this.selected > 0) this.selected--;
        break;
      case "down":
        if (this.selected < this.items.length - 1) this.selected++;
        break;
      case "home":
        this.selected = 0;
        break;
      case "end":
        this.selected = this.items.length - 1;
        break;
      case "pageup":
        this.selected = Math.max(0, this.selected - this.bounds.height);
        break;
      case "pagedown":
        this.selected = Math.min(this.items.length - 1, this.selected + this.bounds.height);
        break;
      case "enter":
        this.onSelect?.(this.items[this.selected]!, this.selected);
        return true;
      default:
        return false;
    }
    this.onChange?.(this.items[this.selected]!, this.selected);
    this.invalidate();
    return true;
  }
}
