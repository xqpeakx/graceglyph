import {
  ComponentFn,
  Fragment,
  HostType,
  ZenElement,
  isElement,
  normalizeChildren,
} from "./element.js";
import { Fiber, createFiber } from "./fiber.js";
import { cleanupEffects, flushEffects, withFiber } from "./hooks.js";
import { HostNode, createHostNode } from "./host.js";

const HOST_TYPES = new Set<string>(["box", "text", "input", "textarea"] satisfies HostType[]);

function isHostType(t: unknown): t is HostType {
  return typeof t === "string" && HOST_TYPES.has(t);
}

/**
 * Walk the fiber tree, calling function components and reconciling their
 * produced children. Host fibers get their children reconciled in place.
 *
 * The public entry point is `reconcile(root)` — called once on mount and
 * again for each commit (dirty fibers trigger a re-run of `reconcile`
 * starting from them; we re-run from the root for simplicity and correctness).
 */
export function reconcile(fiber: Fiber): void {
  fiber.dirty = false;

  if (fiber.type === Fragment) {
    const kids = normalizeChildren(fiber.props.children);
    reconcileChildren(fiber, kids);
  } else if (typeof fiber.type === "function") {
    const output = withFiber(fiber, () =>
      (fiber.type as ComponentFn)(fiber.props),
    );
    const kids = normalizeChildren(output);
    reconcileChildren(fiber, kids);
  } else if (fiber.type === "box") {
    const kids = normalizeChildren(fiber.props.children);
    reconcileChildren(fiber, kids);
  } else if (fiber.type === "text" || fiber.type === "input" || fiber.type === "textarea") {
    clearChildren(fiber);
  } else if (isHostType(fiber.type)) {
    clearChildren(fiber);
  } else {
    throw new Error(`unknown element type: ${String(fiber.type)}`);
  }

  fiber.mounted = true;
}

function reconcileChildren(
  parent: Fiber,
  newKids: Array<ZenElement | string>,
): void {
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
  const t = typeof type === "string" ? type : type === Fragment ? "#frag" : (type as { name?: string }).name ?? "#fn";
  if (key !== null && key !== undefined) return `${t}::${key}`;
  return `${t}#${index}`;
}

function fiberKey(fiber: Fiber, index: number): string {
  return typedKey(fiber.type, fiber.key, index);
}

export function unmount(fiber: Fiber): void {
  cleanupEffects(fiber);
  for (const c of fiber.children) unmount(c);
  fiber.children = [];
  fiber.hostNode = null;
  fiber.parent = null;
}

function clearChildren(fiber: Fiber): void {
  for (const child of fiber.children) unmount(child);
  fiber.children = [];
}

// -- Host tree construction ---------------------------------------------------

/**
 * Build a HostNode tree by walking the fiber tree. Function-component and
 * Fragment fibers are transparent — their children get attached to the
 * nearest host ancestor.
 */
export function buildHostTree(rootFiber: Fiber): HostNode | null {
  const rootSlot: { node: HostNode | null } = { node: null };
  attachHosts(rootFiber, null, rootSlot);
  return rootSlot.node;
}

function attachHosts(
  fiber: Fiber,
  parentHost: HostNode | null,
  rootSlot: { node: HostNode | null },
): void {
  if (isHostType(fiber.type)) {
    let node = fiber.hostNode;
    if (!node) {
      node = createHostNode(fiber);
      fiber.hostNode = node;
    } else {
      node.props = fiber.props;
      node.fiber = fiber;
    }
    node.children = [];
    node.parent = parentHost;
    if (parentHost) parentHost.children.push(node);
    else if (!rootSlot.node) rootSlot.node = node;
    for (const c of fiber.children) attachHosts(c, node, rootSlot);
  } else {
    // function or fragment — pass through
    for (const c of fiber.children) attachHosts(c, parentHost, rootSlot);
  }
}

// -- Effect flush -------------------------------------------------------------

export function flushAllEffects(fiber: Fiber): void {
  flushEffects(fiber);
  for (const c of fiber.children) flushAllEffects(c);
}
