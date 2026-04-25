import type { HostNode } from "./host.js";

/**
 * Walks the host tree to produce an ordered list of focusable nodes.
 * Nothing is persisted on nodes — the manager rebuilds the list on each
 * commit, then maps the previous focused fiber to whatever is present now.
 */
export class FocusManager {
  private list: HostNode[] = [];
  private currentIndex = -1;
  private activeScope: HostNode | null = null;
  private returnFocusFiber: HostNode["fiber"] | null = null;

  collect(root: HostNode | null): void {
    const prev = this.current();
    const nextScope = root ? findActiveScope(root) : null;
    const list: HostNode[] = [];
    if (nextScope) {
      if ((!this.activeScope || this.activeScope.fiber !== nextScope.fiber) && prev && !containsNode(nextScope, prev)) {
        this.returnFocusFiber = prev.fiber;
      }
      walk(nextScope, list);
    } else if (root) {
      walk(root, list);
    }

    this.list = list;
    this.activeScope = nextScope;

    let preferredFiber = prev?.fiber ?? null;
    if (!nextScope && this.returnFocusFiber) {
      preferredFiber = this.returnFocusFiber;
      this.returnFocusFiber = null;
    }

    if (preferredFiber) {
      const idx = list.findIndex((n) => n.fiber === preferredFiber);
      if (idx >= 0) {
        this.currentIndex = idx;
        return;
      }
    }

    this.currentIndex = list.length > 0 ? 0 : -1;
  }

  current(): HostNode | null {
    if (this.currentIndex < 0) return null;
    return this.list[this.currentIndex] ?? null;
  }

  scope(): HostNode | null {
    return this.activeScope;
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

function findActiveScope(node: HostNode): HostNode | null {
  let active = node.props.focusScope === "contain" ? node : null;
  for (const child of node.children) {
    const nested = findActiveScope(child);
    if (nested) active = nested;
  }
  return active;
}

function containsNode(root: HostNode, target: HostNode): boolean {
  if (root.fiber === target.fiber) return true;
  return root.children.some((child) => containsNode(child, target));
}
