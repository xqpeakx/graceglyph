import type { HostNode } from "./host.js";
import type { ElementType } from "./element.js";
import type { Theme } from "../theme/theme.js";
import type { Size } from "../layout/rect.js";
import type { Capabilities } from "../render/capabilities.js";

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

export interface FiberEnvironment {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  size: () => Size;
  onResize: (listener: (size: Size) => void) => () => void;
  capabilities: Capabilities;
}

export interface Fiber {
  type: ElementType;
  props: Record<string, unknown> & { children?: unknown };
  key: string | number | null;
  parent: Fiber | null;
  children: Fiber[];
  hooks: Hook[];
  /** Set only on host fibers (type is a string). */
  hostNode: HostNode | null;
  environment: FiberEnvironment | null;
  scheduler: FiberScheduler;
  /** Flagged by setState; reconciler re-runs this fiber on next commit. */
  dirty: boolean;
  /** True once the fiber has produced output at least once. */
  mounted: boolean;
  /** Devtools metadata for component render inspection. */
  renderCount: number;
  lastRenderMs: number;
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
    environment: parent?.environment ?? null,
    scheduler: parent?.scheduler ?? (() => {}),
    dirty: true,
    mounted: false,
    renderCount: 0,
    lastRenderMs: 0,
  };
}
