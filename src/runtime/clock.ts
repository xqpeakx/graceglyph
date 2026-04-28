/**
 * Monotonic-ish runtime clock helper.
 *
 * Prefers `performance.now()` when available so animation and perf math
 * are decoupled from wall-clock jumps; falls back to `Date.now()`.
 */
export function nowMs(): number {
  if (typeof performance !== "undefined" && typeof performance.now === "function") {
    return performance.now();
  }
  return Date.now();
}
