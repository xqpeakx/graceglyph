import type { HostNode } from "./host.js";

/**
 * Walks the host tree to produce an ordered list of focusable nodes.
 * Nothing is persisted on nodes — the manager rebuilds the list on each
 * commit, then maps the previous focused fiber to whatever is present now.
 */
export class FocusManager {
  private list: HostNode[] = [];
  private currentIndex = -1;

  collect(root: HostNode | null): void {
    const list: HostNode[] = [];
    if (root) walk(root, list);
    const prev = this.current();
    this.list = list;
    if (!prev) {
      this.currentIndex = list.length > 0 ? 0 : -1;
      return;
    }
    // Re-locate the previously focused host (by fiber identity if still mounted,
    // else fall back to staying within range).
    const idx = list.findIndex((n) => n.fiber === prev.fiber);
    this.currentIndex = idx >= 0 ? idx : Math.min(this.currentIndex, list.length - 1);
  }

  current(): HostNode | null {
    if (this.currentIndex < 0) return null;
    return this.list[this.currentIndex] ?? null;
  }

  next(reverse = false): void {
    if (this.list.length === 0) {
      this.currentIndex = -1;
      return;
    }
    const step = reverse ? -1 : 1;
    const base = this.currentIndex < 0 ? 0 : this.currentIndex + step;
    const len = this.list.length;
    this.currentIndex = ((base % len) + len) % len;
  }

  focus(node: HostNode | null): void {
    if (!node) {
      this.currentIndex = -1;
      return;
    }
    const idx = this.list.indexOf(node);
    if (idx >= 0) this.currentIndex = idx;
  }
}

function walk(node: HostNode, out: HostNode[]): void {
  const focusable = node.type === "input" || node.type === "textarea" || node.props.focusable === true;
  if (focusable) out.push(node);
  for (const c of node.children) walk(c, out);
}
