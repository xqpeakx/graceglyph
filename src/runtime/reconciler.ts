import { ComponentFn, Fragment, ZenElement, normalizeChildren } from "./element.js";
import { nowMs } from "./clock.js";
import { validateHostFiberProps } from "./diagnostics.js";
import { Fiber, createFiber } from "./fiber.js";
import { cleanupEffects, flushAllFiberEffects, withFiber } from "./hooks.js";
import { buildHostTree as buildHostTreeFromFiber, isRenderableHostType } from "./host.js";

/**
 * Walk the fiber tree, calling function components and reconciling their
 * produced children. Host fibers get their children reconciled in place.
 *
 * The public entry point is `reconcile(root)` — called once on mount and
 * again for each commit (dirty fibers trigger a re-run of `reconcile`
 * starting from them; we re-run from the root for simplicity and correctness).
 */
export function reconcile(fiber: Fiber): void {
  const started = nowMs();
  fiber.dirty = false;

  if (isRenderableHostType(fiber.type)) {
    validateHostFiberProps(fiber);
  }

  if (fiber.type === Fragment) {
    const kids = normalizeChildren(fiber.props.children);
    reconcileChildren(fiber, kids);
  } else if (typeof fiber.type === "function") {
    const output = withFiber(fiber, () => (fiber.type as ComponentFn)(fiber.props));
    const kids = normalizeChildren(output);
    reconcileChildren(fiber, kids);
  } else if (fiber.type === "box") {
    const kids = normalizeChildren(fiber.props.children);
    reconcileChildren(fiber, kids);
  } else if (fiber.type === "text" || fiber.type === "input" || fiber.type === "textarea") {
    clearChildren(fiber);
  } else if (isRenderableHostType(fiber.type)) {
    clearChildren(fiber);
  } else {
    throw new Error(`unknown element type: ${String(fiber.type)}`);
  }

  fiber.mounted = true;
  fiber.renderCount += 1;
  fiber.lastRenderMs = Math.max(0, nowMs() - started);
}

function reconcileChildren(parent: Fiber, newKids: Array<ZenElement | string>): void {
  const old = parent.children;
  const oldByKey = new Map<string, Fiber>();
  for (let i = 0; i < old.length; i++) {
    const f = old[i]!;
    oldByKey.set(fiberKey(f, i), f);
  }

  const next: Fiber[] = [];
  const reused = new Set<Fiber>();

  for (let i = 0; i < newKids.length; i++) {
    const child = newKids[i]!;
    const { type, props, key } = toElement(child);
    const lookup = typedKey(type, key, i);
    const candidate = oldByKey.get(lookup);

    if (candidate && candidate.type === type) {
      candidate.props = props;
      candidate.parent = parent;
      reused.add(candidate);
      next.push(candidate);
      reconcile(candidate);
    } else {
      const f = createFiber(type, props, key ?? null, parent);
      next.push(f);
      reconcile(f);
    }
  }

  for (const f of old) {
    if (!reused.has(f)) unmount(f);
  }
  parent.children = next;
}

function toElement(child: ZenElement | string): {
  type: ZenElement["type"];
  props: Record<string, unknown> & { children?: unknown };
  key: string | number | null;
} {
  if (typeof child === "string") {
    return { type: "text", props: { children: child }, key: null };
  }
  return { type: child.type, props: child.props, key: child.key };
}

function typedKey(type: ZenElement["type"], key: string | number | null, index: number): string {
  const t =
    typeof type === "string"
      ? type
      : type === Fragment
        ? "#frag"
        : ((type as { name?: string }).name ?? "#fn");
  if (key !== null && key !== undefined) return `${t}::${key}`;
  return `${t}#${index}`;
}

function fiberKey(fiber: Fiber, index: number): string {
  return typedKey(fiber.type, fiber.key, index);
}

export function unmount(fiber: Fiber): void {
  for (const c of fiber.children) unmount(c);
  cleanupEffects(fiber);
  fiber.children = [];
  fiber.hostNode = null;
  fiber.parent = null;
}

function clearChildren(fiber: Fiber): void {
  for (const child of fiber.children) unmount(child);
  fiber.children = [];
}

/**
 * @deprecated Host tree assembly now lives in `runtime/host`.
 * Prefer `buildHostTree(...)` from `runtime/host`.
 */
export function buildHostTree(rootFiber: Fiber) {
  return buildHostTreeFromFiber(rootFiber);
}

// -- Effect flush -------------------------------------------------------------

/**
 * @deprecated Effect traversal now lives in `runtime/hooks`.
 * Prefer `flushAllFiberEffects(...)`.
 */
export function flushAllEffects(fiber: Fiber): void {
  // Deprecated compatibility export; use `flushAllFiberEffects` from
  // `runtime/hooks` in new runtime code.
  flushAllFiberEffects(fiber);
}
