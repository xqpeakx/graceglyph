/**
 * Perf timeline: a ring buffer of frame samples for §9 devtools v2. The
 * runtime drives it via `record(phase, durationMs)` from any instrumented
 * code path; the F12 overlay (and bug-report bundle) read frames back out.
 *
 * The recorder is intentionally cheap: a fixed-size array of plain objects,
 * no allocations in the hot path beyond the sample. Recording can be
 * disabled wholesale via `setEnabled(false)` for production runs.
 */

export type PerfPhase = "render" | "effect" | "input" | "paint" | "layout" | "custom";

export interface PerfSample {
  /** Monotonic frame counter — increments once per `mark`. */
  frame: number;
  /** Phase label for grouping in flamegraphs. */
  phase: PerfPhase;
  /** Phase duration in ms. */
  durationMs: number;
  /** Optional human label, e.g. component name. */
  label?: string;
  /** Wall-clock timestamp (ms since timeline start). */
  at: number;
}

export interface PerfTimelineOptions {
  /** Ring buffer capacity. Defaults to 240 (≈4s at 60Hz). */
  capacity?: number;
}

export interface PerfTimeline {
  /** Capture a phase sample for the current frame. */
  record(phase: PerfPhase, durationMs: number, label?: string): void;
  /** Wrap a synchronous fn, timing it and recording the result. */
  measure<T>(phase: PerfPhase, fn: () => T, label?: string): T;
  /** Advance to a new frame number. Call once per render commit. */
  mark(): void;
  /** Toggle recording without dropping the buffer. */
  setEnabled(enabled: boolean): void;
  enabled(): boolean;
  /** Snapshot the buffer in chronological order (oldest first). */
  frames(): PerfSample[];
  /** Aggregate per-phase totals across every retained sample. */
  summarize(): Record<PerfPhase, { count: number; totalMs: number; meanMs: number; maxMs: number }>;
  /** Reset the buffer and frame counter. */
  reset(): void;
  /** Capacity (max samples retained). */
  capacity(): number;
}

const DEFAULT_CAPACITY = 240;

function clock(): number {
  if (typeof performance !== "undefined" && typeof performance.now === "function") {
    return performance.now();
  }
  return Date.now();
}

export function createPerfTimeline(options: PerfTimelineOptions = {}): PerfTimeline {
  const capacity = Math.max(8, options.capacity ?? DEFAULT_CAPACITY);
  const buffer: (PerfSample | null)[] = new Array(capacity).fill(null);
  let head = 0; // next write index
  let size = 0; // populated count
  let frame = 0;
  let enabled = true;
  const start = clock();

  function record(phase: PerfPhase, durationMs: number, label?: string): void {
    if (!enabled) return;
    if (!Number.isFinite(durationMs) || durationMs < 0) return;
    const sample: PerfSample = {
      frame,
      phase,
      durationMs,
      ...(label !== undefined ? { label } : {}),
      at: clock() - start,
    };
    buffer[head] = sample;
    head = (head + 1) % capacity;
    if (size < capacity) size++;
  }

  function measure<T>(phase: PerfPhase, fn: () => T, label?: string): T {
    if (!enabled) return fn();
    const t0 = clock();
    try {
      return fn();
    } finally {
      record(phase, clock() - t0, label);
    }
  }

  function frames(): PerfSample[] {
    if (size === 0) return [];
    const out: PerfSample[] = [];
    // Oldest first: read `size` items starting from the oldest slot.
    const start = (head - size + capacity) % capacity;
    for (let i = 0; i < size; i++) {
      const sample = buffer[(start + i) % capacity];
      if (sample) out.push(sample);
    }
    return out;
  }

  function summarize(): ReturnType<PerfTimeline["summarize"]> {
    const out: ReturnType<PerfTimeline["summarize"]> = {
      render: empty(),
      effect: empty(),
      input: empty(),
      paint: empty(),
      layout: empty(),
      custom: empty(),
    };
    for (const sample of frames()) {
      const slot = out[sample.phase];
      slot.count += 1;
      slot.totalMs += sample.durationMs;
      if (sample.durationMs > slot.maxMs) slot.maxMs = sample.durationMs;
    }
    for (const phase of Object.keys(out) as PerfPhase[]) {
      const slot = out[phase];
      slot.meanMs = slot.count > 0 ? slot.totalMs / slot.count : 0;
    }
    return out;
  }

  function empty(): { count: number; totalMs: number; meanMs: number; maxMs: number } {
    return { count: 0, totalMs: 0, meanMs: 0, maxMs: 0 };
  }

  return {
    record,
    measure,
    mark() {
      frame += 1;
    },
    setEnabled(value) {
      enabled = value;
    },
    enabled: () => enabled,
    frames,
    summarize,
    reset() {
      buffer.fill(null);
      head = 0;
      size = 0;
      frame = 0;
    },
    capacity: () => capacity,
  };
}
