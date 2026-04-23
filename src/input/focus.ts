import type { View } from "../widgets/view.js";

/**
 * Tracks which view currently has keyboard focus and handles tab navigation.
 * Views register themselves via `register` when mounted; the manager keeps
 * them in document order so tab/shift-tab iterate predictably.
 */
export class FocusManager {
  private focusables: View[] = [];
  private current: View | null = null;

  register(view: View): void {
    if (!this.focusables.includes(view)) this.focusables.push(view);
  }

  unregister(view: View): void {
    const idx = this.focusables.indexOf(view);
    if (idx >= 0) this.focusables.splice(idx, 1);
    if (this.current === view) this.current = null;
  }

  clear(): void {
    this.focusables = [];
    this.current = null;
  }

  focused(): View | null {
    return this.current;
  }

  focus(view: View | null): void {
    if (this.current === view) return;
    const prev = this.current;
    this.current = view;
    prev?.onBlur();
    view?.onFocus();
  }

  focusFirst(): void {
    const first = this.focusables.find((v) => v.focusable);
    if (first) this.focus(first);
  }

  focusNext(reverse = false): void {
    const list = this.focusables.filter((v) => v.focusable);
    if (list.length === 0) return;
    const idx = this.current ? list.indexOf(this.current) : -1;
    const step = reverse ? -1 : 1;
    const next = list[(idx + step + list.length) % list.length]!;
    this.focus(next);
  }
}
