import type { HostNode } from "./host.js";
import type { ElementType } from "./element.js";

export type FiberScheduler = (fiber: Fiber) => void;

export type Hook =
  | { kind: "state"; value: unknown }
  | {
      kind: "effect";
      deps: unknown[] | null;
      cleanup: (() => void) | null;
      pending: (() => void | (() => void)) | null;
    }
  | { kind: "ref"; value: { current: unknown } }
  | { kind: "memo"; value: unknown; deps: unknown[] | null };

export interface Fiber {
  type: ElementType;
  props: Record<string, unknown> & { children?: unknown };
  key: string | number | null;
  parent: Fiber | null;
  children: Fiber[];
  hooks: Hook[];
  /** Set only on host fibers (type is a string). */
  hostNode: HostNode | null;
  scheduler: FiberScheduler;
  /** Flagged by setState; reconciler re-runs this fiber on next commit. */
  dirty: boolean;
  /** True once the fiber has produced output at least once. */
  mounted: boolean;
}

export function createFiber(
  type: ElementType,
  props: Record<string, unknown>,
  key: string | number | null,
  parent: Fiber | null,
): Fiber {
  return {
    type,
    props,
    key,
    parent,
    children: [],
    hooks: [],
    hostNode: null,
    scheduler: parent?.scheduler ?? (() => {}),
    dirty: true,
    mounted: false,
  };
}
