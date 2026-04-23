import type { Application } from "../core/application.js";
import type { KeyEvent, MouseEvent } from "../input/keys.js";
import { Rect } from "../layout/rect.js";
import type { ScreenBuffer } from "../render/buffer.js";

export interface ViewOptions {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  focusable?: boolean;
}

/**
 * Base class for all widgets. Holds layout state, parent/child links, and
 * the standard event hooks. Subclasses override `drawSelf` to paint into
 * their computed bounds.
 */
export abstract class View {
  parent: View | null = null;
  children: View[] = [];
  app: Application | null = null;
  bounds: Rect = Rect.empty();
  focusable: boolean;
  desired: { x?: number; y?: number; width?: number; height?: number };
  private _focused = false;

  constructor(opts: ViewOptions = {}) {
    this.focusable = opts.focusable ?? false;
    this.desired = {
      x: opts.x,
      y: opts.y,
      width: opts.width,
      height: opts.height,
    };
  }

  get focused(): boolean {
    return this._focused;
  }

  add(child: View): this {
    child.parent = this;
    this.children.push(child);
    if (this.app) child._mount(this.app);
    this.invalidate();
    return this;
  }

  remove(child: View): this {
    const idx = this.children.indexOf(child);
    if (idx >= 0) {
      this.children.splice(idx, 1);
      if (this.app) child._unmount(this.app);
      child.parent = null;
      this.invalidate();
    }
    return this;
  }

  invalidate(): void {
    this.app?.invalidate();
  }

  /** Compute `bounds` for this view and its subtree given a parent area. */
  layout(container: Rect): void {
    this.bounds = this.computeBounds(container);
    for (const c of this.children) c.layout(this.bounds);
  }

  protected computeBounds(container: Rect): Rect {
    const d = this.desired;
    const x = container.x + (d.x ?? 0);
    const y = container.y + (d.y ?? 0);
    const width = d.width ?? container.width - (d.x ?? 0);
    const height = d.height ?? container.height - (d.y ?? 0);
    return new Rect(x, y, Math.max(0, width), Math.max(0, height))
      .intersect(container);
  }

  draw(buf: ScreenBuffer, clip: Rect): void {
    const area = this.bounds.intersect(clip);
    if (area.width === 0 || area.height === 0) return;
    this.drawSelf(buf, area);
    for (const c of this.children) c.draw(buf, area);
  }

  protected abstract drawSelf(buf: ScreenBuffer, area: Rect): void;

  hitTest(x: number, y: number): View | null {
    if (!this.bounds.contains(x, y)) return null;
    // Children in reverse order so top-most wins.
    for (let i = this.children.length - 1; i >= 0; i--) {
      const hit = this.children[i]!.hitTest(x, y);
      if (hit) return hit;
    }
    return this;
  }

  onKey(_ev: KeyEvent): boolean {
    return false;
  }

  onMouse(_ev: MouseEvent): boolean {
    return false;
  }

  onFocus(): void {
    this._focused = true;
    this.invalidate();
  }

  onBlur(): void {
    this._focused = false;
    this.invalidate();
  }

  cursorPosition(): { x: number; y: number } | null {
    return null;
  }

  /** @internal */
  _mount(app: Application): void {
    this.app = app;
    if (this.focusable) app.focus.register(this);
    for (const c of this.children) c._mount(app);
  }

  /** @internal */
  _unmount(app: Application): void {
    for (const c of this.children) c._unmount(app);
    if (this.focusable) app.focus.unregister(this);
    this.app = null;
  }
}
