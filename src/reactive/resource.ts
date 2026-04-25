/**
 * Async resource primitive.
 *
 * Wraps an async fetcher in a reactive object that exposes loading,
 * error, and data signals. The fetcher re-runs whenever its `source`
 * dependency changes, with stale-while-revalidate semantics:
 *
 *  - the previous `data()` value remains visible while a new fetch is in
 *    flight,
 *  - in-flight requests are deduplicated via a monotonic counter so a
 *    slow earlier request can't overwrite a fresher result,
 *  - `refetch()` runs the fetcher again with the latest `source` value
 *    and returns a promise that resolves when the request settles.
 */

import { type Accessor, batch, createEffect, createSignal, untrack } from "./core.js";

export type ResourceState = "unresolved" | "pending" | "ready" | "errored" | "refreshing";

export interface ResourceFetcherInfo<T> {
  /** Current data value, if any. */
  value: T | undefined;
  /** True when this call is a `refetch()` rather than the initial fetch. */
  refetching: boolean;
}

export interface Resource<T> extends Accessor<T | undefined> {
  loading: Accessor<boolean>;
  error: Accessor<unknown>;
  state: Accessor<ResourceState>;
  refetch: () => Promise<T | undefined>;
}

export interface ResourceOptions<T> {
  /** Initial value. */
  initialValue?: T;
}

/**
 * Create a resource that re-fetches whenever `source` changes.
 *
 * @example
 * ```ts
 * const [userId, setUserId] = createSignal(1);
 * const user = createResource(userId, (id) => fetch(`/users/${id}`).then((r) => r.json()));
 * createEffect(() => console.log(user.state(), user()));
 * ```
 */
export function createResource<T, S>(
  source: Accessor<S>,
  fetcher: (source: S, info: ResourceFetcherInfo<T>) => Promise<T> | T,
  options?: ResourceOptions<T>,
): Resource<T>;

/**
 * Create a resource without a source dependency. The fetcher runs once
 * on creation and again on every `refetch()`.
 */
export function createResource<T>(
  fetcher: () => Promise<T> | T,
  options?: ResourceOptions<T>,
): Resource<T>;

export function createResource<T, S>(
  ...args:
    | [
        Accessor<S>,
        (source: S, info: ResourceFetcherInfo<T>) => Promise<T> | T,
        ResourceOptions<T>?,
      ]
    | [() => Promise<T> | T, ResourceOptions<T>?]
): Resource<T> {
  const hasSource = args.length >= 2 && typeof args[1] === "function";
  const source = hasSource ? (args[0] as Accessor<S>) : () => undefined as unknown as S;
  const fetcher = hasSource
    ? (args[1] as (source: S, info: ResourceFetcherInfo<T>) => Promise<T> | T)
    : (_s: S, _info: ResourceFetcherInfo<T>) => (args[0] as () => Promise<T> | T)();
  const options = (hasSource ? args[2] : args[1]) as ResourceOptions<T> | undefined;

  const [data, setData] = createSignal<T | undefined>(options?.initialValue);
  const [error, setError] = createSignal<unknown>(undefined);
  const [loading, setLoading] = createSignal<boolean>(false);
  const [state, setState] = createSignal<ResourceState>(
    options?.initialValue !== undefined ? "ready" : "unresolved",
  );

  let counter = 0;

  const run = async (refetching: boolean): Promise<T | undefined> => {
    const id = ++counter;
    const sourceValue = untrack(source);
    const previous = untrack(data);

    batch(() => {
      setLoading(true);
      setError(() => undefined);
      setState(refetching && previous !== undefined ? "refreshing" : "pending");
    });

    try {
      const value = await fetcher(sourceValue, { value: previous, refetching });
      if (id !== counter) return previous;
      batch(() => {
        setData(() => value);
        setLoading(false);
        setState("ready");
      });
      return value;
    } catch (err) {
      if (id !== counter) return previous;
      batch(() => {
        setError(() => err);
        setLoading(false);
        setState("errored");
      });
      return previous;
    }
  };

  // Auto-run when source changes (or once at creation if no source).
  createEffect(() => {
    source();
    void run(false);
  });

  const accessor = (() => data()) as Resource<T>;
  accessor.loading = loading;
  accessor.error = error;
  accessor.state = state;
  accessor.refetch = () => run(true);

  return accessor;
}
