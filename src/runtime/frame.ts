import { nowMs } from "./clock.js";

/**
 * Shared 60Hz frame scheduler. App code subscribes via `subscribeFrame` (or
 * the `useFrame` hook); the scheduler wakes a single `setInterval` once at
 * least one consumer is registered and tears it down when the last
 * consumer leaves. Idle CPU stays at zero, which is the §8 acceptance bar.
 *
 * Frame callbacks receive a `delta` (ms since last tick) and a monotonic
 * `now` (ms since the scheduler started). Both are derived from
 * `performance.now()` when available so animation math is independent of
 * wall-clock drift.
 */

export type FrameCallback = (frame: { delta: number; now: number; tick: number }) => void;

const TARGET_FPS = 60;
const FRAME_INTERVAL_MS = 1000 / TARGET_FPS;

const callbacks = new Set<FrameCallback>();
let timer: ReturnType<typeof setInterval> | null = null;
let lastTickAt = 0;
let originAt = 0;
let tickCount = 0;

function tick(): void {
  const now = nowMs();
  const delta = lastTickAt === 0 ? 0 : now - lastTickAt;
  lastTickAt = now;
  tickCount += 1;
  const elapsed = now - originAt;
  for (const cb of callbacks) {
    try {
      cb({ delta, now: elapsed, tick: tickCount });
    } catch (err) {
      console.error("graceglyph: frame callback error:", err);
    }
  }
}

function start(): void {
  if (timer) return;
  originAt = nowMs();
  lastTickAt = 0;
  tickCount = 0;
  timer = setInterval(tick, FRAME_INTERVAL_MS);
}

function stop(): void {
  if (!timer) return;
  clearInterval(timer);
  timer = null;
  lastTickAt = 0;
  tickCount = 0;
}

/**
 * Register a frame callback. Returns an unsubscribe function. The shared
 * timer starts on first subscription and stops when the last subscriber
 * unsubscribes — there's no idle CPU when nothing is animating.
 */
export function subscribeFrame(callback: FrameCallback): () => void {
  callbacks.add(callback);
  if (callbacks.size === 1) start();
  return () => {
    callbacks.delete(callback);
    if (callbacks.size === 0) stop();
  };
}

/** Diagnostic helpers used by tests. */
export function frameSchedulerActive(): boolean {
  return timer !== null;
}

export function frameSubscriberCount(): number {
  return callbacks.size;
}

/** Advance the scheduler manually. Tests use this to make timing deterministic. */
export function __testTick(deltaOverride?: number): void {
  const now = nowMs();
  const delta = deltaOverride ?? (lastTickAt === 0 ? FRAME_INTERVAL_MS : now - lastTickAt);
  lastTickAt = now;
  tickCount += 1;
  const elapsed = now - originAt;
  for (const cb of callbacks) {
    try {
      cb({ delta, now: elapsed, tick: tickCount });
    } catch (err) {
      console.error("graceglyph: frame callback error:", err);
    }
  }
}

/** Reset the scheduler. Tests only — never call from production code. */
export function __testReset(): void {
  callbacks.clear();
  stop();
}
