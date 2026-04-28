/**
 * Fine-grained reactivity primitives.
 *
 * The model is intentionally close to SolidJS / Preact signals:
 *
 *  - `createSignal(initial)` returns a `[get, set]` pair. Reads inside a
 *    tracking scope register that scope as a subscriber.
 *  - `createEffect(fn)` runs `fn` immediately, tracks every signal read
 *    during the run, and re-runs whenever any of those signals change.
 *    `fn` may return a cleanup that runs before the next re-run and on
 *    final disposal.
 *  - `createMemo(fn)` is a derived signal whose value is recomputed lazily
 *    when its dependencies change.
 *  - `batch(fn)` coalesces updates: signal sets inside `fn` are queued and
 *    flushed once when the outermost batch returns. Diamond dependencies
 *    fire each affected effect at most once per flush.
 *  - `untrack(fn)` reads signals without subscribing the current scope.
 *  - `createRoot(fn)` creates a tracking root and gives the caller a
 *    `dispose()` that tears down every effect created underneath it.
 *  - `onCleanup(fn)` registers a cleanup on the current owner.
 *
 * The primitives are runtime-agnostic. They do not know about graceglyph
 * components, fibers, or hosts; the runtime is wired up in a follow-up
 * change (see ADR-0001).
 */

export interface SignalOptions<T> {
  /**
   * Equality predicate. If it returns true the new value is treated as
   * equal to the old and observers are not notified. Defaults to `Object.is`.
   * Pass `false` to disable equality checks (every set notifies).
   */
  equals?: ((a: T, b: T) => boolean) | false;
}

export type Accessor<T> = () => T;
export type Setter<T> = (next: T | ((prev: T) => T)) => T;

interface Computation {
  /** The function to re-run when a tracked source changes. */
  fn: () => void;
  /** Signals this computation currently reads from. */
  sources: Set<SignalNode>;
  /** Cleanup callbacks registered via `onCleanup` during the last run. */
  cleanups: (() => void)[];
  /** Owners spawned during the last run; cleaned up before re-run / dispose. */
  children: Set<Computation>;
  parent: Computation | null;
  disposed: boolean;
}

interface SignalNode<T = unknown> {
  value: T;
  observers: Set<Computation>;
  equals: ((a: T, b: T) => boolean) | false;
}

let currentObserver: Computation | null = null;
let currentOwner: Computation | null = null;
let batchDepth = 0;
const pendingFlush: Set<Computation> = new Set();

/**
 * Create a writable reactive signal.
 */
export function createSignal<T>(initial: T, options?: SignalOptions<T>): [Accessor<T>, Setter<T>] {
  const node: SignalNode<T> = {
    value: initial,
    observers: new Set(),
    equals: options?.equals ?? Object.is,
  };

  const read: Accessor<T> = () => {
    if (currentObserver && !currentObserver.disposed) {
      node.observers.add(currentObserver);
      currentObserver.sources.add(node as SignalNode);
    }
    return node.value;
  };

  const write: Setter<T> = (next) => {
    const value = typeof next === "function" ? (next as (prev: T) => T)(node.value) : next;
    if (node.equals !== false && node.equals(node.value, value)) {
      return node.value;
    }
    node.value = value;
    if (node.observers.size === 0) return value;
    // Always queue observers. Outside an explicit batch we drain the queue
    // synchronously after this set returns; this gives diamond dependencies
    // and chained memos at-most-once-per-tick semantics for free.
    for (const obs of node.observers) pendingFlush.add(obs);
    if (batchDepth === 0) flushPending();
    return value;
  };

  return [read, write];
}

/**
 * Create an effect: a tracking scope that re-runs when any read signal
 * changes. Returns a disposer that detaches the effect from its sources
 * and runs cleanups.
 */
export function createEffect(fn: () => void | (() => void)): () => void {
  const computation: Computation = {
    fn: () => {
      const result = fn();
      if (typeof result === "function") {
        computation.cleanups.push(result);
      }
    },
    sources: new Set(),
    cleanups: [],
    children: new Set(),
    parent: currentOwner,
    disposed: false,
  };

  if (currentOwner) currentOwner.children.add(computation);
  runComputation(computation);

  return () => disposeComputation(computation);
}

/**
 * Create a derived signal. The function is re-evaluated when its inputs
 * change; observers of the memo see the new value but are not notified
 * if the value is `Object.is`-equal to the previous one.
 */
export function createMemo<T>(fn: () => T, options?: SignalOptions<T>): Accessor<T> {
  let initialized = false;
  let signal: [Accessor<T>, Setter<T>];
  createEffect(() => {
    const value = fn();
    if (!initialized) {
      signal = createSignal(value, options);
      initialized = true;
    } else {
      signal![1](() => value);
    }
  });
  return () => signal![0]();
}

/**
 * Run `fn`, deferring observer notifications until the outermost batch
 * returns. Each affected computation runs at most once per flush.
 */
export function batch<T>(fn: () => T): T {
  batchDepth++;
  try {
    return fn();
  } finally {
    batchDepth--;
    if (batchDepth === 0 && pendingFlush.size > 0) flushPending();
  }
}

function flushPending(): void {
  // Run computations breadth-first to keep ordering deterministic.
  while (pendingFlush.size > 0) {
    const next = pendingFlush.values().next().value as Computation;
    pendingFlush.delete(next);
    if (!next.disposed) runComputation(next);
  }
}

/**
 * Read signals inside `fn` without subscribing the current scope.
 */
export function untrack<T>(fn: () => T): T {
  const prev = currentObserver;
  currentObserver = null;
  try {
    return fn();
  } finally {
    currentObserver = prev;
  }
}

/**
 * Create a tracking root. `fn` receives a `dispose()` that tears down
 * every effect created underneath this root and runs their cleanups.
 *
 * Roots are required at the top of a tree of effects so that they have
 * something to clean up against. The runtime creates one per mounted
 * tree; tests typically wrap their assertions in `createRoot`.
 */
export function createRoot<T>(fn: (dispose: () => void) => T): T {
  const root: Computation = {
    fn: () => {},
    sources: new Set(),
    cleanups: [],
    children: new Set(),
    parent: null,
    disposed: false,
  };
  const dispose = () => disposeComputation(root);

  const prevOwner = currentOwner;
  const prevObserver = currentObserver;
  currentOwner = root;
  currentObserver = null;
  try {
    return fn(dispose);
  } finally {
    currentOwner = prevOwner;
    currentObserver = prevObserver;
  }
}

/**
 * Register a cleanup on the current owner. Cleanups run before the
 * effect re-runs and on final disposal.
 */
export function onCleanup(fn: () => void): void {
  if (currentOwner) currentOwner.cleanups.push(fn);
}

/**
 * Returns the current owner, useful for plumbing reactive scopes through
 * external integrations. Internal: do not rely on this in user code.
 */
export function _currentOwner(): unknown {
  return currentOwner;
}

// -- internals --------------------------------------------------------------

function runComputation(c: Computation): void {
  if (c.disposed) return;
  cleanupComputation(c);

  const prevObserver = currentObserver;
  const prevOwner = currentOwner;
  currentObserver = c;
  currentOwner = c;
  try {
    c.fn();
  } finally {
    currentObserver = prevObserver;
    currentOwner = prevOwner;
  }
}

function cleanupComputation(c: Computation): void {
  // Detach from prior sources so we collect a fresh dep set this run.
  for (const src of c.sources) src.observers.delete(c);
  c.sources.clear();

  // Dispose children spawned in the previous run.
  if (c.children.size > 0) {
    const snapshot = Array.from(c.children);
    c.children.clear();
    for (const child of snapshot) disposeComputation(child);
  }

  // Run user-registered cleanups in reverse order of registration.
  if (c.cleanups.length > 0) {
    const snapshot = c.cleanups;
    c.cleanups = [];
    for (let i = snapshot.length - 1; i >= 0; i--) {
      try {
        snapshot[i]!();
      } catch (err) {
        reportCleanupError(err);
      }
    }
  }
}

function disposeComputation(c: Computation): void {
  if (c.disposed) return;
  c.disposed = true;
  cleanupComputation(c);
  if (c.parent) c.parent.children.delete(c);
  pendingFlush.delete(c);
}

function reportCleanupError(err: unknown): void {
  const message = err instanceof Error ? (err.stack ?? err.message) : String(err);
   
  console.error(`graceglyph: cleanup error: ${message}`);
}
