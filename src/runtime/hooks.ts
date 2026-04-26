import type { Fiber, FiberEnvironment, Hook } from "./fiber.js";
import { attachFiberToError, formatComponentStack } from "./diagnostics.js";
import type { Theme } from "../theme/theme.js";
import type { Size } from "../layout/rect.js";
import type { Capabilities } from "../render/capabilities.js";
import { subscribeFrame, type FrameCallback } from "./frame.js";
import { createMotion, type MotionHandle, type MotionOptions } from "./motion.js";

let currentFiber: Fiber | null = null;
let hookIndex = 0;

export function withFiber<T>(fiber: Fiber, fn: () => T): T {
  const prevFiber = currentFiber;
  const prevIndex = hookIndex;
  currentFiber = fiber;
  hookIndex = 0;
  try {
    return fn();
  } catch (error) {
    attachFiberToError(error, fiber);
    throw error;
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

function getEnvironment(): FiberEnvironment {
  if (!currentFiber?.environment) {
    throw new Error("runtime hooks require a mounted graceglyph runtime");
  }
  return currentFiber.environment;
}

export function useState<T>(initial: T | (() => T)): [T, (next: T | ((prev: T) => T)) => void] {
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

export function useTheme(): Theme {
  return getEnvironment().theme;
}

export function useSetTheme(): (theme: Theme) => void {
  return getEnvironment().setTheme;
}

export function useCapabilities(): Capabilities {
  return getEnvironment().capabilities;
}

export function useTerminalSize(): Size {
  const environment = getEnvironment();
  const [size, setSize] = useState<Size>(() => environment.size());

  useEffect(
    () =>
      environment.onResize((next) => {
        setSize((prev) => (prev.width === next.width && prev.height === next.height ? prev : next));
      }),
    [environment],
  );

  return size;
}

/**
 * Subscribe to the shared 60Hz frame loop while this fiber is mounted. The
 * callback receives `delta`, `now`, and `tick` from the scheduler. Auto-
 * unsubscribes on unmount.
 */
export function useFrame(callback: FrameCallback, deps: unknown[] = []): void {
  useEffect(() => subscribeFrame(callback), deps);
}

/**
 * Drive a tween from the shared frame loop. Returns the current value;
 * change `target` to animate. Useful for opacity, layout offsets, etc.
 */
export function useMotion<T extends number | readonly number[] | string>(
  target: T,
  options?: MotionOptions,
): T {
  const handle = useRef<MotionHandle<T> | null>(null);
  const last = useRef<T>(target);
  const [value, setValue] = useState<T>(target);

  useEffect(() => {
    const m = createMotion<T>(target, options);
    handle.current = m;
    last.current = target;
    const unsubscribe = m.subscribe((v) => setValue(v));
    return () => {
      unsubscribe();
      m.dispose();
      handle.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (handle.current && !Object.is(last.current, target)) {
    handle.current.animateTo(target);
    last.current = target;
  }

  return value;
}

export function useEffect(effect: () => void | (() => void), deps?: unknown[]): void {
  const hook = getHook<Extract<Hook, { kind: "effect" }>>(() => ({
    kind: "effect",
    deps: null,
    cleanup: null,
    pending: null,
  }));
  const nextDeps = deps ?? null;
  const shouldRun = hook.deps === null || nextDeps === null || !arraysEqual(hook.deps, nextDeps);
  if (shouldRun) {
    hook.pending = effect;
    hook.deps = nextDeps;
  }
}

/** Called by the reconciler before running pending effect setups. */
export function cleanupPendingEffects(fiber: Fiber): void {
  for (const hook of fiber.hooks) {
    if (hook.kind !== "effect") continue;
    if (hook.pending) {
      if (hook.cleanup) {
        try {
          hook.cleanup();
        } catch (err) {
          reportEffectError(err, fiber);
        }
        hook.cleanup = null;
      }
    }
  }
}

/** Called by the reconciler after pending cleanups have run. */
export function flushEffects(fiber: Fiber): void {
  for (const hook of fiber.hooks) {
    if (hook.kind !== "effect") continue;
    if (hook.pending) {
      try {
        const result = hook.pending();
        hook.cleanup = typeof result === "function" ? result : null;
      } catch (err) {
        reportEffectError(err, fiber);
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
        reportEffectError(err, fiber);
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

function reportEffectError(err: unknown, fiber: Fiber): void {
  const details = err instanceof Error ? err.message : String(err);
  const stack = formatComponentStack(fiber);
  // eslint-disable-next-line no-console
  console.error(
    stack.length > 0
      ? `graceglyph: effect error: ${details}\n${stack}`
      : `graceglyph: effect error: ${details}`,
  );
}
