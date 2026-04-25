import { EventEmitter } from "node:events";

import { render } from "../../src/index.js";
import type { RenderHandle, RuntimeOptions, ZenElement } from "../../src/index.js";
import type { ScreenBuffer } from "../../src/render/buffer.js";
import { collectInspectorWarnings } from "../../src/runtime/diagnostics.js";
import type { HostNode } from "../../src/runtime/host.js";

export interface FakeRenderHarness {
  handle: RenderHandle;
  input: FakeInput;
  output: FakeOutput;
}

export class FakeInput extends EventEmitter {
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

export class FakeOutput extends EventEmitter {
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

export function renderWithFakeTty(
  element: ZenElement,
  opts: { width: number; height: number; runtime?: Omit<RuntimeOptions, "input" | "output"> },
): FakeRenderHarness {
  const input = new FakeInput();
  const output = new FakeOutput(opts.width, opts.height);
  const handle = render(element, {
    ...(opts.runtime ?? {}),
    input: input as never,
    output: output as never,
  });
  return { handle, input, output };
}

export async function settleRuntime(turns = 2): Promise<void> {
  for (let index = 0; index < turns; index++) {
    await new Promise<void>((resolve) => setImmediate(resolve));
  }
}

export async function waitFor(
  predicate: () => boolean,
  opts: { timeoutMs?: number; intervalMs?: number } = {},
): Promise<void> {
  const timeoutMs = opts.timeoutMs ?? 1500;
  const intervalMs = opts.intervalMs ?? 10;
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    await settleRuntime();
    if (predicate()) return;
    await new Promise<void>((resolve) => setTimeout(resolve, intervalMs));
  }

  throw new Error("timed out waiting for runtime state");
}

export function screenText(handle: RenderHandle): string {
  const front = (handle.runtime.renderer as unknown as { front: ScreenBuffer }).front;
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

export function runtimeWarnings(handle: RenderHandle): string[] {
  const root = (handle.runtime as unknown as { hostRoot: HostNode | null }).hostRoot;
  return root ? collectInspectorWarnings(root) : [];
}
