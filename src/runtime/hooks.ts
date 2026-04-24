import type { Fiber, Hook } from "./fiber.js";

let currentFiber: Fiber | null = null;
let hookIndex = 0;

export function withFiber<T>(fiber: Fiber, fn: () => T): T {
  const prevFiber = currentFiber;
  const prevIndex = hookIndex;
  currentFiber = fiber;
  hookIndex = 0;
  try {
    return fn();
  } finally {
    currentFiber = prevFiber;
    hookIndex = prevIndex;
  }
}

function getHook<T extends Hook>(factory: () => T): T {
  if (!currentFiber) {
    throw new Error("hooks can only be called inside a component");
  }
  const i = hookIndex++;
  let hook = currentFiber.hooks[i] as T | undefined;
  if (!hook) {
    hook = factory();
    currentFiber.hooks[i] = hook;
  }
  return hook;
}

export function useState<T>(
  initial: T | (() => T),
): [T, (next: T | ((prev: T) => T)) => void] {
  const fiber = currentFiber!;
  const hook = getHook<Extract<Hook, { kind: "state" }>>(() => ({
    kind: "state",
    value: typeof initial === "function" ? (initial as () => T)() : initial,
  }));
  const setState = (next: T | ((prev: T) => T)) => {
    const prev = hook.value as T;
    const nextValue = typeof next === "function" ? (next as (p: T) => T)(prev) : next;
    if (Object.is(prev, nextValue)) return;
    hook.value = nextValue;
    fiber.scheduler(fiber);
  };
  return [hook.value as T, setState];
}

export function useRef<T>(initial: T): { current: T } {
  const hook = getHook<Extract<Hook, { kind: "ref" }>>(() => ({
    kind: "ref",
    value: { current: initial },
  }));
  return hook.value as { current: T };
}

export function useMemo<T>(compute: () => T, deps: unknown[]): T {
  const hook = getHook<Extract<Hook, { kind: "memo" }>>(() => ({
    kind: "memo",
    value: undefined,
    deps: null,
  }));
  if (hook.deps === null || !arraysEqual(hook.deps, deps)) {
    hook.value = compute();
    hook.deps = deps;
  }
  return hook.value as T;
}

export function useCallback<T extends (...args: any[]) => any>(fn: T, deps: unknown[]): T {
  return useMemo(() => fn, deps);
}

export function useEffect(
  effect: () => void | (() => void),
  deps?: unknown[],
): void {
  const hook = getHook<Extract<Hook, { kind: "effect" }>>(() => ({
    kind: "effect",
    deps: null,
    cleanup: null,
    pending: null,
  }));
  const nextDeps = deps ?? null;
  const shouldRun =
    hook.deps === null ||
    nextDeps === null ||
    !arraysEqual(hook.deps, nextDeps);
  if (shouldRun) {
    hook.pending = effect;
    hook.deps = nextDeps;
  }
}

/** Called by the reconciler after the commit pass. */
export function flushEffects(fiber: Fiber): void {
  for (const hook of fiber.hooks) {
    if (hook.kind !== "effect") continue;
    if (hook.pending) {
      if (hook.cleanup) {
        try {
          hook.cleanup();
        } catch (err) {
          reportEffectError(err);
        }
      }
      try {
        const result = hook.pending();
        hook.cleanup = typeof result === "function" ? result : null;
      } catch (err) {
        reportEffectError(err);
      }
      hook.pending = null;
    }
  }
}

/** Called when a fiber is unmounted. Runs all cleanup functions. */
export function cleanupEffects(fiber: Fiber): void {
  for (const hook of fiber.hooks) {
    if (hook.kind === "effect" && hook.cleanup) {
      try {
        hook.cleanup();
      } catch (err) {
        reportEffectError(err);
      }
      hook.cleanup = null;
    }
  }
}

function arraysEqual(a: unknown[], b: unknown[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (!Object.is(a[i], b[i])) return false;
  }
  return true;
}

function reportEffectError(err: unknown): void {
  // eslint-disable-next-line no-console
  console.error("graceglyph: effect error:", err);
}
