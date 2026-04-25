import test from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";

import { AnsiSeq } from "../src/render/ansi.js";
import { h } from "../src/runtime/element.js";
import { Runtime } from "../src/runtime/runtime.js";

test("runtime integration flows", async (t) => {
  await t.test("startup and shutdown manage terminal lifecycle cleanly", async () => {
    const harness = createHarness(
      h("input", { value: "draft", width: 8, onChange: () => {} }),
      { width: 12, height: 4, devtools: false },
    );

    harness.runtime.run();
    await settleRuntime();

    assert.deepEqual(harness.input.rawModeHistory, [true]);
    assert.equal(harness.input.resumeCalls, 1);
    assert.equal(harness.input.listenerCount("data"), 1);
    assert.equal(harness.output.listenerCount("resize"), 1);
    assert.match(harness.output.output(), new RegExp(escapeRegex(AnsiSeq.enterAltScreen)));
    assert.match(harness.output.output(), new RegExp(escapeRegex(AnsiSeq.enableMouse)));
    assert.match(harness.output.output(), new RegExp(escapeRegex(AnsiSeq.clearScreen)));

    harness.output.clearWrites();
    harness.runtime.stop();

    assert.deepEqual(harness.input.rawModeHistory, [true, false]);
    assert.equal(harness.input.pauseCalls, 1);
    assert.equal(harness.input.listenerCount("data"), 0);
    assert.equal(harness.output.listenerCount("resize"), 0);
    assert.match(harness.output.output(), new RegExp(escapeRegex(AnsiSeq.disableMouse)));
    assert.match(harness.output.output(), new RegExp(escapeRegex(AnsiSeq.exitAltScreen)));
  });

  await t.test("resize relayouts the host tree and repaints the terminal", async (t) => {
    const harness = createHarness(
      h(
        "box",
        {},
        h("input", { value: "abcdefgh", onChange: () => {} }),
      ),
      { width: 6, height: 2, devtools: false },
    );
    t.after(() => harness.runtime.stop());

    harness.runtime.run();
    await settleRuntime();

    assert.equal(currentHost(harness.runtime)?.children[0]?.layout.width, 6);

    harness.output.clearWrites();
    harness.output.resizeTo(3, 2);
    await settleRuntime();

    assert.equal(currentHost(harness.runtime)?.children[0]?.layout.width, 3);
    assert.match(harness.output.output(), new RegExp(escapeRegex(AnsiSeq.clearScreen)));
    assert.match(harness.output.output(), /gh/);
  });

  await t.test("tab cycles focus through focusable hosts", async (t) => {
    const harness = createHarness(
      h(
        "box",
        { direction: "column" },
        h("input", { value: "first", onChange: () => {} }),
        h("box", { focusable: true, height: 1 }),
        h("textarea", { value: "third", height: 2, onChange: () => {} }),
      ),
      { width: 12, height: 6, devtools: false },
    );
    t.after(() => harness.runtime.stop());

    harness.runtime.run();
    await settleRuntime();

    assert.equal(harness.runtime.focus.current()?.type, "input");
    assert.equal(String(harness.runtime.focus.current()?.props.value ?? ""), "first");

    harness.input.emitData("\t");
    await settleRuntime();
    assert.equal(harness.runtime.focus.current()?.type, "box");

    harness.input.emitData("\t");
    await settleRuntime();
    assert.equal(harness.runtime.focus.current()?.type, "textarea");

    harness.input.emitData("\t");
    await settleRuntime();
    assert.equal(harness.runtime.focus.current()?.type, "input");
  });

  await t.test("keyboard and mouse interactions dispatch through the runtime", async (t) => {
    const clicks: string[] = [];
    const harness = createHarness(
      h(
        "box",
        { direction: "row", gap: 1 },
        h("box", { focusable: true, width: 4, height: 2, onClick: () => clicks.push("left") }),
        h("box", { focusable: true, width: 4, height: 2, onClick: () => clicks.push("right") }),
      ),
      { width: 12, height: 4, devtools: false },
    );
    t.after(() => harness.runtime.stop());

    harness.runtime.run();
    await settleRuntime();

    harness.input.emitData("\r");
    await settleRuntime();
    assert.deepEqual(clicks, ["left"]);

    harness.input.emitData(mousePress(5, 0) + mouseRelease(5, 0));
    await settleRuntime();

    assert.deepEqual(clicks, ["left", "right"]);
    assert.equal(harness.runtime.focus.current()?.layout.x, 5);
  });

  await t.test("cursor placement follows grapheme-aware viewport math", async (t) => {
    const harness = createHarness(
      h("input", { value: "a👍🏽b", width: 3, onChange: () => {} }),
      { width: 6, height: 2, devtools: false },
    );
    t.after(() => harness.runtime.stop());

    harness.runtime.run();
    await settleRuntime();

    assert.deepEqual(currentCursor(harness.runtime), { x: 2, y: 0 });

    harness.input.emitData(mousePress(0, 0));
    await settleRuntime();

    assert.deepEqual(currentCursor(harness.runtime), { x: 0, y: 0 });
  });

  await t.test("f12 toggles the inspector overlay", async (t) => {
    const harness = createHarness(
      h("input", { value: "hi", width: 4, onChange: () => {} }),
      { width: 40, height: 10, devtools: true },
    );
    t.after(() => harness.runtime.stop());

    harness.runtime.run();
    await settleRuntime();

    harness.output.clearWrites();
    harness.input.emitData("\x1b[24~");
    await settleRuntime();

    assert.equal((harness.runtime as any).devtoolsVisible, true);
    assert.equal(currentCursor(harness.runtime), null);
    assert.match(stripAnsi(harness.output.output()), /Inspector/);

    harness.output.clearWrites();
    harness.input.emitData("\x1b[24~");
    await settleRuntime();

    assert.equal((harness.runtime as any).devtoolsVisible, false);
    assert.notEqual(currentCursor(harness.runtime), null);
  });
});

class FakeInput extends EventEmitter {
  readonly isTTY = true;
  readonly rawModeHistory: boolean[] = [];
  resumeCalls = 0;
  pauseCalls = 0;

  setRawMode(value: boolean): void {
    this.rawModeHistory.push(value);
  }

  resume(): void {
    this.resumeCalls += 1;
  }

  pause(): void {
    this.pauseCalls += 1;
  }

  emitData(chunk: string): void {
    this.emit("data", chunk);
  }
}

class FakeOutput extends EventEmitter {
  columns: number;
  rows: number;
  private readonly chunks: string[] = [];

  constructor(width: number, height: number) {
    super();
    this.columns = width;
    this.rows = height;
  }

  write(chunk: string): boolean {
    this.chunks.push(chunk);
    return true;
  }

  output(): string {
    return this.chunks.join("");
  }

  clearWrites(): void {
    this.chunks.length = 0;
  }

  resizeTo(width: number, height: number): void {
    this.columns = width;
    this.rows = height;
    this.emit("resize");
  }
}

function createHarness(
  element: ReturnType<typeof h>,
  opts: { width: number; height: number; devtools: boolean },
): {
  runtime: Runtime;
  input: FakeInput;
  output: FakeOutput;
} {
  const input = new FakeInput();
  const output = new FakeOutput(opts.width, opts.height);
  const runtime = new Runtime({
    input: input as never,
    output: output as never,
    devtools: opts.devtools,
  });
  runtime.mount(element);
  return { runtime, input, output };
}

function currentHost(runtime: Runtime): any {
  return (runtime as any).hostRoot ?? null;
}

function currentCursor(runtime: Runtime): { x: number; y: number } | null {
  return ((runtime.renderer as any).cursorPos ?? null) as { x: number; y: number } | null;
}

async function settleRuntime(): Promise<void> {
  await new Promise<void>((resolve) => setImmediate(resolve));
  await new Promise<void>((resolve) => setImmediate(resolve));
}

function mousePress(x: number, y: number): string {
  return `\x1b[<0;${x + 1};${y + 1}M`;
}

function mouseRelease(x: number, y: number): string {
  return `\x1b[<0;${x + 1};${y + 1}m`;
}

function stripAnsi(value: string): string {
  return value.replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, "");
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
