import { EventEmitter } from "node:events";

import type { MouseButton } from "./input/keys.js";
import type { ScreenBuffer } from "./render/buffer.js";
import {
  DUMB_CAPABILITIES,
  FULL_CAPABILITIES,
  type Capabilities,
  type CapabilityOverrides,
  type ColorDepth,
} from "./render/capabilities.js";
import type { RenderHandle } from "./runtime/render.js";
import { render } from "./runtime/render.js";
import type { RuntimeOptions } from "./runtime/runtime.js";
import type { ZenElement } from "./runtime/element.js";
import { collectInspectorWarnings } from "./runtime/diagnostics.js";
import { textOf, type HostNode } from "./runtime/host.js";

export interface RenderTestAppOptions {
  width?: number;
  height?: number;
  runtime?: Omit<RuntimeOptions, "input" | "output">;
  cap?: "dumb" | "full" | ColorDepth | Capabilities | CapabilityOverrides;
}

export type RenderComponentOptions = RenderTestAppOptions;

export interface KeyboardFlowOptions {
  settleTurns?: number;
}

export interface FakeTimerRunOptions extends KeyboardFlowOptions {
  maxRuns?: number;
}

export interface WaitForOptions extends KeyboardFlowOptions {
  timeoutMs?: number;
  intervalMs?: number;
}

export type FindByOptions = WaitForOptions;

export interface FindByRoleOptions extends WaitForOptions {
  name?: string | RegExp;
}

export interface UserKeyboardOptions extends KeyboardFlowOptions {
  literalBraces?: boolean;
}

export interface TestUser {
  click(target: TestLocator, options?: KeyboardFlowOptions): Promise<void>;
  type(target: TestLocator, text: string, options?: KeyboardFlowOptions): Promise<void>;
  keyboard(sequence: string, options?: UserKeyboardOptions): Promise<void>;
  hover(target: TestLocator, options?: KeyboardFlowOptions): Promise<void>;
  drag(
    source: TestLocator,
    options?: KeyboardFlowOptions,
  ): {
    drop(target: TestLocator, dropOptions?: KeyboardFlowOptions): Promise<void>;
  };
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

interface ScheduledTimer {
  id: number;
  kind: "timeout" | "interval";
  dueAt: number;
  intervalMs: number;
  callback: (...args: unknown[]) => void;
  args: unknown[];
}

class FakeClock {
  private nowMs: number;
  private nextId = 1;
  private readonly timers = new Map<number, ScheduledTimer>();
  private readonly originalSetTimeout = globalThis.setTimeout;
  private readonly originalClearTimeout = globalThis.clearTimeout;
  private readonly originalSetInterval = globalThis.setInterval;
  private readonly originalClearInterval = globalThis.clearInterval;
  private readonly originalDateNow = Date.now;

  constructor(startMs: number) {
    this.nowMs = startMs;
  }

  install(): void {
    globalThis.setTimeout = ((
      callback: (...args: unknown[]) => void,
      delay?: number,
      ...args: unknown[]
    ) => {
      return this.schedule("timeout", callback, delay ?? 0, args) as unknown as ReturnType<
        typeof setTimeout
      >;
    }) as typeof setTimeout;
    globalThis.clearTimeout = ((handle: ReturnType<typeof setTimeout>) => {
      this.clear(Number(handle));
    }) as typeof clearTimeout;
    globalThis.setInterval = ((
      callback: (...args: unknown[]) => void,
      delay?: number,
      ...args: unknown[]
    ) => {
      return this.schedule("interval", callback, delay ?? 0, args) as unknown as ReturnType<
        typeof setInterval
      >;
    }) as typeof setInterval;
    globalThis.clearInterval = ((handle: ReturnType<typeof setInterval>) => {
      this.clear(Number(handle));
    }) as typeof clearInterval;
    Date.now = () => this.nowMs;
  }

  uninstall(): void {
    globalThis.setTimeout = this.originalSetTimeout;
    globalThis.clearTimeout = this.originalClearTimeout;
    globalThis.setInterval = this.originalSetInterval;
    globalThis.clearInterval = this.originalClearInterval;
    Date.now = this.originalDateNow;
    this.timers.clear();
  }

  advanceBy(ms: number): void {
    const target = this.nowMs + Math.max(0, Math.floor(ms));
    while (true) {
      const nextDue = this.nextDueAt();
      if (nextDue === null || nextDue > target) break;
      this.nowMs = nextDue;
      this.fireDue(nextDue);
    }
    this.nowMs = target;
  }

  runAll(maxRuns = 10_000): void {
    let runs = 0;
    while (this.timers.size > 0) {
      if (runs >= maxRuns) {
        throw new Error(`fake timers exceeded maxRuns (${maxRuns}) while draining`);
      }
      const nextDue = this.nextDueAt();
      if (nextDue === null) break;
      this.nowMs = nextDue;
      this.fireDue(nextDue);
      runs += 1;
    }
  }

  private schedule(
    kind: "timeout" | "interval",
    callback: (...args: unknown[]) => void,
    delay: number,
    args: unknown[],
  ): number {
    const safeDelay = Math.max(0, Number.isFinite(delay) ? Math.floor(delay) : 0);
    const intervalMs = kind === "interval" ? Math.max(1, safeDelay) : 0;
    const id = this.nextId++;
    this.timers.set(id, {
      id,
      kind,
      dueAt: this.nowMs + safeDelay,
      intervalMs,
      callback,
      args,
    });
    return id;
  }

  private clear(id: number): void {
    this.timers.delete(id);
  }

  private nextDueAt(): number | null {
    let min: number | null = null;
    for (const timer of this.timers.values()) {
      if (min === null || timer.dueAt < min) min = timer.dueAt;
    }
    return min;
  }

  private fireDue(dueAt: number): void {
    const due = Array.from(this.timers.values())
      .filter((timer) => timer.dueAt <= dueAt)
      .sort((left, right) => left.dueAt - right.dueAt || left.id - right.id);
    for (const timer of due) {
      const current = this.timers.get(timer.id);
      if (!current) continue;
      if (current.kind === "timeout") this.timers.delete(current.id);
      else current.dueAt = this.nowMs + current.intervalMs;
      current.callback(...current.args);
    }
  }
}

let activeFakeClock: { owner: object; clock: FakeClock } | null = null;

export interface TestApp {
  handle: RenderHandle;
  input: TestInput;
  output: TestOutput;
  stop(): void;
  settle(turns?: number): Promise<void>;
  frame(): string;
  snapshot(): string;
  snapshotAnsi(): string;
  queryByText(text: string | RegExp): TestLocator | null;
  getByText(text: string | RegExp): TestLocator;
  findByText(text: string | RegExp, options?: FindByOptions): Promise<TestLocator>;
  getByLabel(label: string | RegExp): TestLocator;
  findByLabel(label: string | RegExp, options?: FindByOptions): Promise<TestLocator>;
  getByRole(role: TestRole, options?: { name?: string | RegExp }): TestLocator;
  findByRole(role: TestRole, options?: FindByRoleOptions): Promise<TestLocator>;
  queryAllByRole(role: TestRole, options?: { name?: string | RegExp }): TestLocator[];
  waitFor<T>(assertion: () => T, options?: WaitForOptions): Promise<T>;
  user: TestUser;
  useFakeTimers(): void;
  useRealTimers(): void;
  advanceTimersByTime(ms: number, options?: KeyboardFlowOptions): Promise<void>;
  runAllTimers(options?: FakeTimerRunOptions): Promise<void>;
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
  const fakeTimerOwner = {};
  const input = new TestInput();
  const output = new TestOutput(options.width ?? 80, options.height ?? 24);
  const runtime = { ...(options.runtime ?? {}) };
  const cap = resolveTestCapabilities(options.cap);
  if (cap) runtime.capabilities = cap;
  const handle = render(element, {
    ...runtime,
    input: input as never,
    output: output as never,
  });

  const app: TestApp = {
    handle,
    input,
    output,
    stop: () => {
      app.useRealTimers();
      handle.stop();
    },
    settle,
    frame: () => snapshotTerminalFrame(handle),
    snapshot: () => snapshotTerminalFrame(handle),
    snapshotAnsi: () => snapshotTerminalAnsi(app),
    queryByText: (text) => queryLocatorsByText(handle, text)[0] ?? null,
    getByText: (text) => {
      const match = queryLocatorsByText(handle, text)[0];
      if (!match) throw new Error(`unable to find text: ${String(text)}`);
      return match;
    },
    findByText: async (text, options) => waitFor(() => app.getByText(text), options),
    getByLabel: (label) => {
      const root = hostRoot(handle);
      const match = findNodes(root, (node) => labelMatches(accessibilityLabel(node), label))[0];
      if (!match) throw new Error(`unable to find node by label: ${String(label)}`);
      return toLocator(match);
    },
    findByLabel: async (label, options) => waitFor(() => app.getByLabel(label), options),
    getByRole: (role, options) => {
      const match = queryLocatorsByRole(handle, role, options)[0];
      if (!match) {
        throw new Error(
          options?.name
            ? `unable to find role "${role}" with name ${String(options.name)}`
            : `unable to find role "${role}"`,
        );
      }
      return match;
    },
    findByRole: async (role, options) => {
      const roleOptions = options?.name ? { name: options.name } : undefined;
      return waitFor(() => app.getByRole(role, roleOptions), options);
    },
    queryAllByRole: (role, options) => queryLocatorsByRole(handle, role, options),
    waitFor: async <T>(assertion: () => T, options?: WaitForOptions) => waitFor(assertion, options),
    user: undefined as unknown as TestUser,
    useFakeTimers: () => {
      if (activeFakeClock && activeFakeClock.owner !== fakeTimerOwner) {
        throw new Error("fake timers are already active for another test app");
      }
      if (activeFakeClock) return;
      const clock = new FakeClock(Date.now());
      clock.install();
      activeFakeClock = { owner: fakeTimerOwner, clock };
    },
    useRealTimers: () => {
      if (!activeFakeClock || activeFakeClock.owner !== fakeTimerOwner) return;
      activeFakeClock.clock.uninstall();
      activeFakeClock = null;
    },
    advanceTimersByTime: async (ms, timerOptions) => {
      if (!activeFakeClock || activeFakeClock.owner !== fakeTimerOwner) {
        throw new Error("fake timers are not active for this test app");
      }
      activeFakeClock.clock.advanceBy(ms);
      await settle(timerOptions?.settleTurns);
    },
    runAllTimers: async (timerOptions) => {
      if (!activeFakeClock || activeFakeClock.owner !== fakeTimerOwner) {
        throw new Error("fake timers are not active for this test app");
      }
      activeFakeClock.clock.runAll(timerOptions?.maxRuns);
      await settle(timerOptions?.settleTurns);
    },
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
  app.user = createUser(app);

  return app;
}

/**
 * Render a standalone component under the test runtime without requiring an
 * explicit app shell wrapper in the test fixture.
 */
export function renderComponent(
  element: ZenElement,
  options: RenderComponentOptions = {},
): TestApp {
  return renderTestApp(element, options);
}

export async function settle(turns = 2): Promise<void> {
  for (let index = 0; index < turns; index++) {
    await new Promise<void>((resolve) => setImmediate(resolve));
  }
}

export async function waitFor<T>(assertion: () => T, options: WaitForOptions = {}): Promise<T> {
  const timeoutMs = options.timeoutMs ?? 1000;
  const intervalMs = options.intervalMs ?? 16;
  const startedAt = Date.now();
  let lastError: unknown;

  while (Date.now() - startedAt <= timeoutMs) {
    try {
      return assertion();
    } catch (error) {
      lastError = error;
    }

    await settle(options.settleTurns);
    if (activeFakeClock) {
      activeFakeClock.clock.advanceBy(intervalMs);
    } else {
      await new Promise<void>((resolve) => setTimeout(resolve, intervalMs));
    }
  }

  const reason =
    lastError instanceof Error ? lastError.message : String(lastError ?? "unknown assertion error");
  throw new Error(`waitFor timed out after ${timeoutMs}ms: ${reason}`);
}

function resolveTestCapabilities(
  cap: RenderTestAppOptions["cap"],
): Capabilities | CapabilityOverrides | undefined {
  if (!cap) return undefined;
  if (cap === "dumb") return DUMB_CAPABILITIES;
  if (cap === "full") return FULL_CAPABILITIES;
  if (typeof cap === "string") {
    return { color: cap, isTTY: cap !== "monochrome" };
  }
  return cap;
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

export function snapshotTerminalAnsi(app: TestApp): string {
  return app.output.output();
}

export type TestRole = "button" | "textbox" | "generic";

export interface TestLocator {
  role: TestRole;
  x: number;
  y: number;
  width: number;
  height: number;
  label?: string;
  description?: string;
}

function queryLocatorsByRole(
  handle: RenderHandle,
  role: TestRole,
  options?: { name?: string | RegExp },
): TestLocator[] {
  const root = hostRoot(handle);
  const nodes = findNodes(root, (node) => {
    if (nodeRole(node) !== role) return false;
    if (!options?.name) return true;
    return labelMatches(accessibilityLabel(node), options.name);
  });
  return nodes.map(toLocator);
}

function queryLocatorsByText(handle: RenderHandle, text: string | RegExp): TestLocator[] {
  const root = hostRoot(handle);
  const nodes = findNodes(root, (node) => textMatches(visibleText(node), text)).filter(
    (node) => !hasMatchingDescendant(node, text),
  );
  return nodes.map(toLocator);
}

function createUser(app: TestApp): TestUser {
  return {
    click: async (target, options) => {
      const point = locatorPoint(target);
      await app.click(point.x, point.y, "left", options);
    },
    type: async (target, text, options) => {
      const point = locatorPoint(target);
      await app.click(point.x, point.y, "left", options);
      await app.type(text, options);
    },
    keyboard: async (sequence, options) => {
      const keys = parseKeyboardTokens(sequence, options?.literalBraces ?? false);
      await app.keyboardFlow(keys, options);
    },
    hover: async (target, options) => {
      const point = locatorPoint(target);
      await app.hover(point.x, point.y, options);
    },
    drag: (source, options) => ({
      drop: async (target, dropOptions) => {
        const from = locatorPoint(source);
        const to = locatorPoint(target);
        await app.mouseFlow(
          [
            { action: "press", x: from.x, y: from.y, button: "left" },
            { action: "move", x: to.x, y: to.y, button: "left" },
            { action: "release", x: to.x, y: to.y, button: "left" },
          ],
          dropOptions ?? options,
        );
      },
    }),
  };
}

function locatorPoint(target: TestLocator): { x: number; y: number } {
  return {
    x: target.x + Math.max(0, Math.floor((target.width - 1) / 2)),
    y: target.y + Math.max(0, Math.floor((target.height - 1) / 2)),
  };
}

function parseKeyboardTokens(sequence: string, literalBraces: boolean): string[] {
  if (literalBraces) return sequence.split("");
  const keys: string[] = [];
  let index = 0;
  while (index < sequence.length) {
    if (sequence[index] !== "{") {
      keys.push(sequence[index]!);
      index += 1;
      continue;
    }
    const close = sequence.indexOf("}", index + 1);
    if (close === -1) {
      keys.push(sequence[index]!);
      index += 1;
      continue;
    }
    const token = sequence.slice(index + 1, close).trim();
    if (token.length === 0) {
      keys.push("{");
      keys.push("}");
    } else {
      keys.push(token);
    }
    index = close + 1;
  }
  return keys;
}

export function collectLayoutWarnings(handle: RenderHandle | TestApp): string[] {
  const runtime = "handle" in handle ? handle.handle.runtime : handle.runtime;
  const root = (runtime as unknown as { hostRoot: HostNode | null }).hostRoot;
  return root ? collectInspectorWarnings(root) : [];
}

function hostRoot(handle: RenderHandle | TestApp): HostNode {
  const runtime = "handle" in handle ? handle.handle.runtime : handle.runtime;
  const root = (runtime as unknown as { hostRoot: HostNode | null }).hostRoot;
  if (!root) throw new Error("test app has no mounted host root");
  return root;
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

function findNodes(root: HostNode, predicate: (node: HostNode) => boolean): HostNode[] {
  const matches: HostNode[] = [];
  const stack: HostNode[] = [root];
  while (stack.length > 0) {
    const node = stack.pop()!;
    if (node.hidden) continue;
    if (predicate(node)) matches.push(node);
    for (let index = node.children.length - 1; index >= 0; index--) {
      const child = node.children[index];
      if (child) stack.push(child);
    }
  }
  return matches;
}

function nodeRole(node: HostNode): TestRole {
  if (node.type === "input" || node.type === "textarea") return "textbox";
  if (node.type === "box") {
    const clickable = typeof node.props.onClick === "function";
    const focusable = node.resolvedProps.focusable === true;
    const bordered = node.resolvedProps.border === true;
    const labeled = typeof node.resolvedProps.accessibilityLabel === "string";
    if (clickable || (focusable && bordered && labeled)) return "button";
  }
  return "generic";
}

function accessibilityLabel(node: HostNode): string {
  const explicit = node.resolvedProps.accessibilityLabel;
  if (typeof explicit === "string" && explicit.length > 0) return explicit;
  if (node.type === "text") return textOf(node.resolvedProps.children);
  return "";
}

function labelMatches(label: string, expected: string | RegExp): boolean {
  if (typeof expected === "string") return label === expected;
  return expected.test(label);
}

function textMatches(label: string, expected: string | RegExp): boolean {
  if (label.length === 0) return false;
  if (typeof expected === "string") return label.includes(expected);
  return expected.test(label);
}

function hasMatchingDescendant(node: HostNode, expected: string | RegExp): boolean {
  const stack = [...node.children];
  while (stack.length > 0) {
    const current = stack.pop()!;
    if (current.hidden) continue;
    if (textMatches(visibleText(current), expected)) return true;
    for (const child of current.children) stack.push(child);
  }
  return false;
}

function visibleText(node: HostNode): string {
  if (node.hidden) return "";
  if (node.type === "text") return textOf(node.resolvedProps.children);
  let value = "";
  for (const child of node.children) value += visibleText(child);
  return value;
}

function toLocator(node: HostNode): TestLocator {
  return {
    role: nodeRole(node),
    x: node.layout.x,
    y: node.layout.y,
    width: node.layout.width,
    height: node.layout.height,
    label: accessibilityLabel(node) || undefined,
    description:
      typeof node.resolvedProps.accessibilityDescription === "string"
        ? node.resolvedProps.accessibilityDescription
        : undefined,
  };
}
