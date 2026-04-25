import { EventEmitter } from "node:events";

import type { MouseButton } from "./input/keys.js";
import type { ScreenBuffer } from "./render/buffer.js";
import type { RenderHandle } from "./runtime/render.js";
import { render } from "./runtime/render.js";
import type { RuntimeOptions } from "./runtime/runtime.js";
import type { ZenElement } from "./runtime/element.js";
import { collectInspectorWarnings } from "./runtime/diagnostics.js";
import type { HostNode } from "./runtime/host.js";

export interface RenderTestAppOptions {
  width?: number;
  height?: number;
  runtime?: Omit<RuntimeOptions, "input" | "output">;
}

export interface KeyboardFlowOptions {
  settleTurns?: number;
}

export interface MouseFlowEvent {
  action: "press" | "release" | "click" | "move";
  x: number;
  y: number;
  button?: MouseButton;
}

export class TestInput extends EventEmitter {
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

export class TestOutput extends EventEmitter {
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

  clearWrites(): void {
    this.chunks.length = 0;
  }

  output(): string {
    return this.chunks.join("");
  }

  resizeTo(width: number, height: number): void {
    this.columns = width;
    this.rows = height;
    this.emit("resize");
  }
}

export interface TestApp {
  handle: RenderHandle;
  input: TestInput;
  output: TestOutput;
  stop(): void;
  settle(turns?: number): Promise<void>;
  frame(): string;
  snapshot(): string;
  warnings(): string[];
  assertNoLayoutWarnings(): void;
  press(key: string, options?: KeyboardFlowOptions): Promise<void>;
  type(text: string, options?: KeyboardFlowOptions): Promise<void>;
  keyboardFlow(keys: readonly string[], options?: KeyboardFlowOptions): Promise<void>;
  mouse(event: MouseFlowEvent, options?: KeyboardFlowOptions): Promise<void>;
  mouseFlow(events: readonly MouseFlowEvent[], options?: KeyboardFlowOptions): Promise<void>;
  click(x: number, y: number, button?: MouseButton, options?: KeyboardFlowOptions): Promise<void>;
  hover(x: number, y: number, options?: KeyboardFlowOptions): Promise<void>;
  resize(width: number, height: number, options?: KeyboardFlowOptions): Promise<void>;
}

export function renderTestApp(element: ZenElement, options: RenderTestAppOptions = {}): TestApp {
  const input = new TestInput();
  const output = new TestOutput(options.width ?? 80, options.height ?? 24);
  const handle = render(element, {
    ...(options.runtime ?? {}),
    input: input as never,
    output: output as never,
  });

  const app: TestApp = {
    handle,
    input,
    output,
    stop: () => handle.stop(),
    settle,
    frame: () => snapshotTerminalFrame(handle),
    snapshot: () => snapshotTerminalFrame(handle),
    warnings: () => collectLayoutWarnings(handle),
    assertNoLayoutWarnings: () => assertNoLayoutWarnings(handle),
    press: async (key, flowOptions) => {
      input.emitData(keySequence(key));
      await settle(flowOptions?.settleTurns);
    },
    type: async (text, flowOptions) => {
      input.emitData(text);
      await settle(flowOptions?.settleTurns);
    },
    keyboardFlow: async (keys, flowOptions) => {
      for (const key of keys) input.emitData(keySequence(key));
      await settle(flowOptions?.settleTurns);
    },
    mouse: async (event, flowOptions) => {
      input.emitData(mouseSequence(event));
      await settle(flowOptions?.settleTurns);
    },
    mouseFlow: async (events, flowOptions) => {
      for (const event of events) input.emitData(mouseSequence(event));
      await settle(flowOptions?.settleTurns);
    },
    click: async (x, y, button = "left", flowOptions) => {
      input.emitData(mouseSequence({ action: "press", x, y, button }));
      input.emitData(mouseSequence({ action: "release", x, y, button }));
      await settle(flowOptions?.settleTurns);
    },
    hover: async (x, y, flowOptions) => {
      input.emitData(mouseSequence({ action: "move", x, y, button: "left" }));
      await settle(flowOptions?.settleTurns);
    },
    resize: async (width, height, flowOptions) => {
      output.resizeTo(width, height);
      await settle(flowOptions?.settleTurns);
    },
  };

  return app;
}

export async function settle(turns = 2): Promise<void> {
  for (let index = 0; index < turns; index++) {
    await new Promise<void>((resolve) => setImmediate(resolve));
  }
}

export function snapshotTerminalFrame(handle: RenderHandle | TestApp): string {
  const runtime = "handle" in handle ? handle.handle.runtime : handle.runtime;
  const front = (runtime.renderer as unknown as { front: ScreenBuffer }).front;
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

export function collectLayoutWarnings(handle: RenderHandle | TestApp): string[] {
  const runtime = "handle" in handle ? handle.handle.runtime : handle.runtime;
  const root = (runtime as unknown as { hostRoot: HostNode | null }).hostRoot;
  return root ? collectInspectorWarnings(root) : [];
}

export function assertNoLayoutWarnings(handle: RenderHandle | TestApp): void {
  const warnings = collectLayoutWarnings(handle);
  if (warnings.length > 0) {
    throw new Error(`layout warnings:\n${warnings.map((warning) => `- ${warning}`).join("\n")}`);
  }
}

export function keySequence(key: string): string {
  const normalized = key.toLowerCase();
  if (normalized.length === 1) return key;
  if (normalized.startsWith("ctrl+") && normalized.length === 6) {
    const char = normalized[5]!;
    return String.fromCharCode(char.charCodeAt(0) - 96);
  }
  if (normalized.startsWith("alt+") && normalized.length === 5) {
    return `\x1b${normalized[4]!}`;
  }

  const map: Record<string, string> = {
    enter: "\r",
    return: "\r",
    escape: "\x1b",
    esc: "\x1b",
    tab: "\t",
    backspace: "\x7f",
    space: " ",
    up: "\x1b[A",
    down: "\x1b[B",
    right: "\x1b[C",
    left: "\x1b[D",
    home: "\x1b[H",
    end: "\x1b[F",
    delete: "\x1b[3~",
    pageup: "\x1b[5~",
    pagedown: "\x1b[6~",
    f1: "\x1bOP",
    f2: "\x1bOQ",
    f3: "\x1bOR",
    f4: "\x1bOS",
    f5: "\x1b[15~",
    f6: "\x1b[17~",
    f7: "\x1b[18~",
    f8: "\x1b[19~",
    f9: "\x1b[20~",
    f10: "\x1b[21~",
    f11: "\x1b[23~",
    f12: "\x1b[24~",
  };
  const sequence = map[normalized];
  if (!sequence) throw new Error(`unsupported test key: ${key}`);
  return sequence;
}

export function mouseSequence(event: MouseFlowEvent): string {
  if (event.action === "click") {
    return `${mouseSequence({ ...event, action: "press" })}${mouseSequence({ ...event, action: "release" })}`;
  }
  const button = event.button ?? "left";
  const code = mouseCode(button, event.action);
  const final = event.action === "release" ? "m" : "M";
  return `\x1b[<${code};${event.x + 1};${event.y + 1}${final}`;
}

function mouseCode(button: MouseButton, action: MouseFlowEvent["action"]): number {
  if (action === "move") return 32;
  if (button === "middle") return 1;
  if (button === "right") return 2;
  if (button === "wheel-up") return 64;
  if (button === "wheel-down") return 65;
  return 0;
}
