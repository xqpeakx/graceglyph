import test from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";

import { Button, List, Modal, h, type KeyEvent, useState } from "../src/index.js";
import { AnsiSeq } from "../src/render/ansi.js";
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

  await t.test("focus lifecycle callbacks fire on initial focus and transitions", async (t) => {
    const events: string[] = [];
    const harness = createHarness(
      h(
        "box",
        { direction: "row", gap: 1 },
        h("box", {
          focusable: true,
          width: 4,
          height: 1,
          onFocus: () => events.push("first:focus"),
          onBlur: () => events.push("first:blur"),
        }),
        h("box", {
          focusable: true,
          width: 4,
          height: 1,
          onFocus: () => events.push("second:focus"),
          onBlur: () => events.push("second:blur"),
        }),
      ),
      { width: 12, height: 4, devtools: false },
    );
    t.after(() => harness.runtime.stop());

    harness.runtime.run();
    await settleRuntime();

    assert.deepEqual(events, ["first:focus"]);

    harness.input.emitData("\t");
    await settleRuntime();
    assert.deepEqual(events, ["first:focus", "first:blur", "second:focus"]);
  });

  await t.test("modal focus scopes trap tab navigation and restore background focus", async (t) => {
    let backgroundClicks = 0;

    function ModalHarness() {
      const [open, setOpen] = useState(false);

      return h(
        "box",
        {
          direction: "column",
          onKey: (event: KeyEvent) => {
            if (event.name === "char" && event.char === "o") {
              setOpen(true);
              return true;
            }
            return false;
          },
        },
        h("box", { focusable: true, width: 8, height: 1, onClick: () => { backgroundClicks += 1; } }),
        h("box", { focusable: true, width: 8, height: 1, onClick: () => { backgroundClicks += 1; } }),
        open
          ? h(
            Modal,
            { title: "Dialog", width: 24, height: 4, onDismiss: () => setOpen(false) },
            h(
              "box",
              { direction: "row", gap: 1 },
              h(Button, { onClick: () => setOpen(false) }, "Cancel"),
              h(Button, { onClick: () => setOpen(false) }, "Confirm"),
            ),
          )
          : null,
      );
    }

    const harness = createHarness(h(ModalHarness, {}), {
      width: 50,
      height: 16,
      devtools: false,
    });
    t.after(() => harness.runtime.stop());

    harness.runtime.run();
    await settleRuntime();

    assert.equal(harness.runtime.focus.current()?.layout.y, 0);

    harness.input.emitData("o");
    await settleRuntime();

    assert.match(stripAnsi(harness.output.output()), /Dialog/);
    const modalFocusY = harness.runtime.focus.current()?.layout.y ?? -1;
    assert.ok(modalFocusY > 0);

    harness.input.emitData("\t");
    await settleRuntime();
    assert.equal(harness.runtime.focus.current()?.layout.y, modalFocusY);

    harness.input.emitData("\t");
    await settleRuntime();
    assert.equal(harness.runtime.focus.current()?.layout.y, modalFocusY);

    harness.input.emitData(mousePress(0, 0) + mouseRelease(0, 0));
    await settleRuntime();
    assert.equal(backgroundClicks, 0);
    assert.equal(harness.runtime.focus.current()?.layout.y, modalFocusY);

    harness.input.emitData("\r");
    await settleRuntime();

    assert.doesNotMatch(currentScreen(harness.runtime), /Dialog/);
    assert.equal(harness.runtime.focus.current()?.layout.y, 0);
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

  await t.test("mouse clicks focus list ancestors and activate rows", async (t) => {
    const events: string[] = [];

    function ListHarness() {
      const [selected, setSelected] = useState(0);
      return h(List, {
        items: ["alpha", "beta", "gamma"],
        selected,
        onChange: setSelected,
        onSelect: (_index: number, item: string) => events.push(`open:${item}`),
        height: 3,
        render: (item: string) => item,
      });
    }

    const harness = createHarness(h(ListHarness, {}), {
      width: 20,
      height: 5,
      devtools: false,
    });
    t.after(() => harness.runtime.stop());

    harness.runtime.run();
    await settleRuntime();

    harness.input.emitData(mousePress(0, 1) + mouseRelease(0, 1));
    await settleRuntime();

    assert.deepEqual(events, ["open:beta"]);
    assert.equal(harness.runtime.focus.current()?.layout.height, 3);

    harness.input.emitData("\r");
    await settleRuntime();

    assert.deepEqual(events, ["open:beta", "open:beta"]);
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

  await t.test("focus-only commits avoid rerendering unrelated components while local state stays local", async (t) => {
    let parentRenders = 0;
    let leftRenders = 0;
    let rightRenders = 0;

    function LeftCounter() {
      leftRenders += 1;
      const [count, setCount] = useState(0);
      return h("box", { focusable: true, width: 6, height: 1, onClick: () => setCount((value) => value + 1) }, String(count));
    }

    function RightStatic() {
      rightRenders += 1;
      return h("box", { focusable: true, width: 6, height: 1 }, "static");
    }

    function CounterApp() {
      parentRenders += 1;
      return h("box", { direction: "row", gap: 1 }, h(LeftCounter, {}), h(RightStatic, {}));
    }

    const harness = createHarness(h(CounterApp, {}), {
      width: 20,
      height: 4,
      devtools: false,
    });
    t.after(() => harness.runtime.stop());

    harness.runtime.run();
    await settleRuntime();

    const baseline = {
      parent: parentRenders,
      left: leftRenders,
      right: rightRenders,
    };

    harness.input.emitData("\t");
    await settleRuntime();
    assert.deepEqual(
      { parent: parentRenders, left: leftRenders, right: rightRenders },
      baseline,
    );

    harness.input.emitData("\t");
    await settleRuntime();
    harness.input.emitData("\r");
    await settleRuntime();

    assert.equal(parentRenders, baseline.parent);
    assert.equal(leftRenders, baseline.left + 1);
    assert.equal(rightRenders, baseline.right);
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

function currentScreen(runtime: Runtime): string {
  const front = (runtime.renderer as any).front;
  const rows: string[] = [];

  for (let y = 0; y < front.height; y++) {
    let row = "";
    for (let x = 0; x < front.width; x++) {
      const cell = front.get(x, y);
      if (!cell || cell.width === 0) continue;
      row += cell.char || " ";
    }
    rows.push(row);
  }

  return rows.join("\n");
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
