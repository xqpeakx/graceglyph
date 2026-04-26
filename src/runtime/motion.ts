import { subscribeFrame } from "./frame.js";

/**
 * Motion primitives. `createMotion` builds an animated value that
 * interpolates between `initial` and `target` over `duration` ms, driven
 * by the shared frame scheduler. `motion()` is a convenience wrapper
 * tailored to the §8 surface listed in the roadmap.
 */

export type Easing = (t: number) => number;

// -- bezier easings ----------------------------------------------------------

function bezier(p1x: number, p1y: number, p2x: number, p2y: number): Easing {
  // Cubic Bezier with B(0)=0 and B(1)=1. We invert to find t for x and
  // then read y. Newton-Raphson with a small bisection fallback.
  const sample = (a: number, b: number, t: number): number => {
    const u = 1 - t;
    return 3 * u * u * t * a + 3 * u * t * t * b + t * t * t;
  };
  const sampleDerivative = (a: number, b: number, t: number): number => {
    const u = 1 - t;
    return 3 * u * u * a + 6 * u * t * (b - a) + 3 * t * t * (1 - b);
  };
  return (x: number): number => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let t = x;
    for (let i = 0; i < 8; i++) {
      const currentX = sample(p1x, p2x, t) - x;
      if (Math.abs(currentX) < 1e-5) break;
      const dx = sampleDerivative(p1x, p2x, t);
      if (Math.abs(dx) < 1e-6) break;
      t -= currentX / dx;
    }
    t = Math.min(1, Math.max(0, t));
    return sample(p1y, p2y, t);
  };
}

export const easings = {
  linear: ((t: number) => t) as Easing,
  easeIn: bezier(0.42, 0, 1, 1),
  easeOut: bezier(0, 0, 0.58, 1),
  easeInOut: bezier(0.42, 0, 0.58, 1),
  easeInCubic: bezier(0.55, 0.055, 0.675, 0.19),
  easeOutCubic: bezier(0.215, 0.61, 0.355, 1),
  easeInOutCubic: bezier(0.645, 0.045, 0.355, 1),
  easeInQuart: bezier(0.895, 0.03, 0.685, 0.22),
  easeOutQuart: bezier(0.165, 0.84, 0.44, 1),
  easeInBack: bezier(0.6, -0.28, 0.735, 0.045),
  easeOutBack: bezier(0.175, 0.885, 0.32, 1.275),
} as const;

export type EasingName = keyof typeof easings;

// -- spring physics ----------------------------------------------------------

export interface SpringOptions {
  /** Stiffness. Higher = snappier. Defaults to 170 (Solid-style preset). */
  stiffness?: number;
  /** Damping. Higher = less overshoot. Defaults to 26. */
  damping?: number;
  /** Mass. Defaults to 1. */
  mass?: number;
}

export function spring(options: SpringOptions = {}): Easing {
  const stiffness = options.stiffness ?? 170;
  const damping = options.damping ?? 26;
  const mass = options.mass ?? 1;
  // Closed-form under-damped spring solution normalized so f(0)=0 and
  // f(∞)=1. Sufficient for terminal motion where we cap to 1 at duration.
  const omega0 = Math.sqrt(stiffness / mass);
  const zeta = damping / (2 * Math.sqrt(stiffness * mass));
  return (t: number): number => {
    if (t <= 0) return 0;
    if (t >= 1) return 1;
    const x = t * 4; // scale t into the spring's natural settling time
    if (zeta < 1) {
      const omegaD = omega0 * Math.sqrt(1 - zeta * zeta);
      return (
        1 -
        Math.exp(-zeta * omega0 * x) *
          (Math.cos(omegaD * x) + ((zeta * omega0) / omegaD) * Math.sin(omegaD * x))
      );
    }
    return 1 - Math.exp(-omega0 * x) * (1 + omega0 * x);
  };
}

// -- motion accessor ---------------------------------------------------------

export interface MotionOptions {
  duration?: number;
  easing?: Easing | EasingName;
  /** Auto-start on creation. Defaults to true. */
  autoStart?: boolean;
  /** Hold the final value; otherwise the animation stops scheduling once done. */
  hold?: boolean;
}

export interface MotionHandle<T> {
  /** Read the current value. */
  get(): T;
  /** Animate to a new target with optional override duration/easing. */
  animateTo(target: T, opts?: { duration?: number; easing?: Easing | EasingName }): void;
  /** Pause without resetting progress. Resumes from where it left off. */
  pause(): void;
  resume(): void;
  /** Reset back to the original `initial` value, no animation. */
  reset(): void;
  /** Subscribe to value updates. Returns an unsubscribe function. */
  subscribe(listener: (value: T) => void): () => void;
  /** Tear down. Unsubscribes from the frame scheduler. */
  dispose(): void;
  /** True when an interpolation is in flight. */
  isAnimating(): boolean;
}

const DEFAULT_DURATION = 240;

function resolveEasing(easing: Easing | EasingName | undefined): Easing {
  if (!easing) return easings.easeOut;
  if (typeof easing === "function") return easing;
  return easings[easing];
}

/**
 * Create a motion-tweened number, vector, or array of numbers. Strings and
 * other types pass through without interpolation (useful for status flips).
 */
export function createMotion<T extends number | readonly number[] | string>(
  initial: T,
  options: MotionOptions = {},
): MotionHandle<T> {
  let current: T = initial;
  let from: T = initial;
  let to: T = initial;
  let duration = options.duration ?? DEFAULT_DURATION;
  let easing = resolveEasing(options.easing);
  let elapsed = 0;
  let active = options.autoStart === false ? false : false; // start idle; animateTo wakes us
  let paused = false;
  const listeners = new Set<(value: T) => void>();
  let unsubscribe: (() => void) | null = null;

  function notify(): void {
    for (const listener of listeners) listener(current);
  }

  function ensureSubscription(): void {
    if (unsubscribe) return;
    unsubscribe = subscribeFrame(({ delta }) => {
      if (paused || !active) return;
      elapsed += delta;
      const t = Math.min(1, duration <= 0 ? 1 : elapsed / duration);
      const eased = easing(t);
      current = interpolate(from, to, eased) as T;
      notify();
      if (t >= 1) {
        active = false;
        if (!options.hold) tearDown();
      }
    });
  }

  function tearDown(): void {
    if (!unsubscribe) return;
    unsubscribe();
    unsubscribe = null;
  }

  function animateTo(
    target: T,
    overrides: { duration?: number; easing?: Easing | EasingName } = {},
  ): void {
    from = current;
    to = target;
    elapsed = 0;
    duration = overrides.duration ?? options.duration ?? DEFAULT_DURATION;
    easing = resolveEasing(overrides.easing ?? options.easing);
    paused = false;
    active = true;
    if (duration <= 0) {
      current = target;
      active = false;
      notify();
      return;
    }
    ensureSubscription();
  }

  return {
    get: () => current,
    animateTo,
    pause: () => {
      paused = true;
    },
    resume: () => {
      paused = false;
    },
    reset: () => {
      current = initial;
      from = initial;
      to = initial;
      elapsed = 0;
      active = false;
      notify();
      tearDown();
    },
    subscribe(listener: (value: T) => void): () => void {
      listeners.add(listener);
      listener(current);
      return () => listeners.delete(listener);
    },
    dispose: () => {
      listeners.clear();
      tearDown();
    },
    isAnimating: () => active && !paused,
  };
}

function interpolate(from: unknown, to: unknown, t: number): unknown {
  if (typeof from === "number" && typeof to === "number") {
    return from + (to - from) * t;
  }
  if (Array.isArray(from) && Array.isArray(to) && from.length === to.length) {
    const out = new Array(from.length);
    for (let i = 0; i < from.length; i++) {
      out[i] = (from[i] as number) + ((to[i] as number) - (from[i] as number)) * t;
    }
    return out;
  }
  // Strings / mismatched: snap at the halfway point so consumers can flip
  // labels mid-transition without manual handling.
  return t >= 0.5 ? to : from;
}

/**
 * One-shot helper. Runs `update(value)` on each frame until the
 * animation completes (or `cancel()` is called). Returns a `cancel`
 * function. Useful when you don't need a long-lived handle.
 */
export function motion<T extends number | readonly number[]>(
  initial: T,
  target: T,
  update: (value: T) => void,
  options: MotionOptions = {},
): () => void {
  const handle = createMotion<T>(initial, { ...options, hold: false });
  const stop = handle.subscribe(update);
  handle.animateTo(target);
  return () => {
    stop();
    handle.dispose();
  };
}
