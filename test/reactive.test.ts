import test from "node:test";
import assert from "node:assert/strict";

import {
  batch,
  createEffect,
  createMemo,
  createResource,
  createRoot,
  createSignal,
  onCleanup,
  untrack,
} from "../src/reactive/index.js";

test("signal: read returns initial value, write updates it", () => {
  const [count, setCount] = createSignal(0);
  assert.equal(count(), 0);
  setCount(1);
  assert.equal(count(), 1);
});

test("signal: setter accepts an updater function", () => {
  const [count, setCount] = createSignal(10);
  setCount((prev) => prev + 5);
  assert.equal(count(), 15);
});

test("signal: equals predicate suppresses redundant notifications", () => {
  createRoot((dispose) => {
    let runs = 0;
    const [value, setValue] = createSignal({ x: 1 }, { equals: (a, b) => a.x === b.x });
    createEffect(() => {
      value();
      runs++;
    });
    setValue({ x: 1 });
    setValue({ x: 1 });
    setValue({ x: 2 });
    assert.equal(runs, 2); // initial run + one change
    dispose();
  });
});

test("signal: equals=false fires on every set", () => {
  createRoot((dispose) => {
    let runs = 0;
    const [value, setValue] = createSignal(0, { equals: false });
    createEffect(() => {
      value();
      runs++;
    });
    setValue(0);
    setValue(0);
    assert.equal(runs, 3); // initial + two no-op-equal sets
    dispose();
  });
});

test("effect: runs once on creation and again on dependency change", () => {
  createRoot((dispose) => {
    const calls: number[] = [];
    const [count, setCount] = createSignal(0);
    createEffect(() => {
      calls.push(count());
    });
    setCount(1);
    setCount(2);
    assert.deepEqual(calls, [0, 1, 2]);
    dispose();
  });
});

test("effect: cleanup runs before re-run and on disposal", () => {
  createRoot((dispose) => {
    const log: string[] = [];
    const [count, setCount] = createSignal(0);
    createEffect(() => {
      const v = count();
      log.push(`run ${v}`);
      return () => log.push(`cleanup ${v}`);
    });
    setCount(1);
    setCount(2);
    dispose();
    assert.deepEqual(log, [
      "run 0",
      "cleanup 0",
      "run 1",
      "cleanup 1",
      "run 2",
      "cleanup 2",
    ]);
  });
});

test("effect: disposed effect stops reacting", () => {
  createRoot((rootDispose) => {
    let runs = 0;
    const [count, setCount] = createSignal(0);
    const dispose = createEffect(() => {
      count();
      runs++;
    });
    setCount(1);
    assert.equal(runs, 2);
    dispose();
    setCount(2);
    setCount(3);
    assert.equal(runs, 2);
    rootDispose();
  });
});

test("memo: caches result and propagates to downstream effects", () => {
  createRoot((dispose) => {
    const [a, setA] = createSignal(1);
    const [b, setB] = createSignal(2);
    let memoRuns = 0;
    const sum = createMemo(() => {
      memoRuns++;
      return a() + b();
    });

    const seen: number[] = [];
    createEffect(() => {
      seen.push(sum());
    });

    setA(10);
    setB(20);
    assert.equal(memoRuns, 3); // initial + setA + setB
    assert.deepEqual(seen, [3, 12, 30]);
    dispose();
  });
});

test("batch: defers observer runs until the outer batch returns", () => {
  createRoot((dispose) => {
    const [a, setA] = createSignal(0);
    const [b, setB] = createSignal(0);
    const calls: number[] = [];
    createEffect(() => {
      calls.push(a() + b());
    });

    batch(() => {
      setA(1);
      setB(2);
      setA(3);
    });

    // 1 initial run + 1 batched run, even though three sets happened.
    assert.deepEqual(calls, [0, 5]);
    dispose();
  });
});

test("batch: diamond dependencies fire downstream effect once", () => {
  createRoot((dispose) => {
    const [base, setBase] = createSignal(1);
    const left = createMemo(() => base() * 2);
    const right = createMemo(() => base() * 3);
    let downstreamRuns = 0;
    createEffect(() => {
      left();
      right();
      downstreamRuns++;
    });
    setBase(2);
    assert.equal(downstreamRuns, 2); // initial + one for the change
    dispose();
  });
});

test("untrack: read does not subscribe", () => {
  createRoot((dispose) => {
    const [a, setA] = createSignal(0);
    const [b, setB] = createSignal(0);
    let runs = 0;
    createEffect(() => {
      a();
      untrack(() => b());
      runs++;
    });
    setB(1);
    setB(2);
    assert.equal(runs, 1);
    setA(1);
    assert.equal(runs, 2);
    dispose();
  });
});

test("createRoot: dispose tears down nested effects", () => {
  let runs = 0;
  const [count, setCount] = createSignal(0);

  const dispose = createRoot((dispose) => {
    createEffect(() => {
      count();
      runs++;
    });
    return dispose;
  });

  setCount(1);
  assert.equal(runs, 2);
  dispose();
  setCount(2);
  setCount(3);
  assert.equal(runs, 2);
});

test("onCleanup: registered cleanup runs on owner disposal", () => {
  const log: string[] = [];
  const dispose = createRoot((dispose) => {
    createEffect(() => {
      onCleanup(() => log.push("inner"));
    });
    onCleanup(() => log.push("outer"));
    return dispose;
  });
  dispose();
  // cleanups run from the inside out
  assert.deepEqual(log, ["inner", "outer"]);
});

test("nested effects: parent disposal cleans up children", () => {
  let inner = 0;
  const dispose = createRoot((dispose) => {
    const [count, setCount] = createSignal(0);
    createEffect(() => {
      count();
      createEffect(() => {
        inner++;
      });
    });
    setCount(1);
    setCount(2);
    return dispose;
  });
  // 1 (initial outer) + 1 (initial inner) = 2 inner runs at start; after each
  // outer re-run a fresh inner is created → 3 outer runs total → 3 inner runs
  assert.equal(inner, 3);
  dispose();
});

test("resource: initial fetch resolves data and clears loading", async () => {
  await createRoot(async (dispose) => {
    const r = createResource(async () => 42);
    assert.equal(r.state(), "pending");
    assert.equal(r.loading(), true);
    await tick(2);
    assert.equal(r.loading(), false);
    assert.equal(r(), 42);
    assert.equal(r.state(), "ready");
    dispose();
  });
});

test("resource: rejected fetch surfaces the error", async () => {
  await createRoot(async (dispose) => {
    const r = createResource(async () => {
      throw new Error("boom");
    });
    await tick(2);
    assert.equal(r.state(), "errored");
    assert.equal((r.error() as Error).message, "boom");
    dispose();
  });
});

test("resource: refetch updates value and goes through 'refreshing'", async () => {
  await createRoot(async (dispose) => {
    let n = 0;
    const r = createResource(async () => ++n);
    await tick(2);
    assert.equal(r(), 1);
    const states: string[] = [];
    createEffect(() => {
      states.push(r.state());
    });
    const promise = r.refetch();
    assert.equal(r.state(), "refreshing");
    const value = await promise;
    assert.equal(value, 2);
    assert.equal(r(), 2);
    assert.equal(r.state(), "ready");
    assert.ok(states.includes("refreshing"));
    dispose();
  });
});

test("resource: source change triggers re-fetch", async () => {
  await createRoot(async (dispose) => {
    const [id, setId] = createSignal(1);
    const r = createResource(id, async (i) => `user:${i}`);
    await tick(2);
    assert.equal(r(), "user:1");
    setId(2);
    await tick(2);
    assert.equal(r(), "user:2");
    dispose();
  });
});

function tick(times = 1): Promise<void> {
  return new Promise((resolve) => {
    let i = 0;
    const next = () => {
      if (++i >= times) resolve();
      else queueMicrotask(next);
    };
    queueMicrotask(next);
  });
}
