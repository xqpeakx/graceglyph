import { Terminal, TerminalOptions } from "../core/terminal.js";
import { InputParser } from "../input/parser.js";
import type { InputEvent, KeyEvent, MouseEvent } from "../input/keys.js";
import { Rect } from "../layout/rect.js";
import { Renderer } from "../render/renderer.js";
import type { BoxProps, InputProps, ZenElement } from "./element.js";
import { Fiber, createFiber } from "./fiber.js";
import { FocusManager } from "./focus.js";
import { HostNode, layoutTree, paintTree } from "./host.js";
import { paintInspector } from "./devtools.js";
import {
  buildHostTree,
  flushAllEffects,
  reconcile,
  unmount,
} from "./reconciler.js";
import { setScheduler } from "./hooks.js";

export interface RuntimeOptions extends TerminalOptions {
  devtools?: boolean;
}

export class Runtime {
  readonly terminal: Terminal;
  readonly renderer: Renderer;
  readonly parser: InputParser;
  readonly focus: FocusManager;

  private rootFiber: Fiber | null = null;
  private hostRoot: HostNode | null = null;
  private running = false;
  private commitScheduled = false;
  private onData?: (chunk: Buffer | string) => void;
  private readonly devtoolsEnabled: boolean;
  private devtoolsVisible = false;

  constructor(opts: RuntimeOptions = {}) {
    this.terminal = new Terminal(opts);
    this.renderer = new Renderer(this.terminal);
    this.parser = new InputParser();
    this.focus = new FocusManager();
    this.devtoolsEnabled = opts.devtools ?? true;
    // Any setState — from any fiber — triggers a single coalesced commit.
    setScheduler(() => this.scheduleCommit());
  }

  mount(element: ZenElement): void {
    this.withFatalBoundary("mount", () => {
      const root = createFiber(
        element.type,
        element.props,
        element.key,
        null,
      );
      this.rootFiber = root;
      reconcile(root);
      this.rebuildAndPaint();
    });
  }

  run(): void {
    if (this.running) return;
    this.withFatalBoundary("startup", () => {
      this.running = true;
      this.terminal.start();

      this.onData = (chunk) => {
        this.withFatalBoundary("input", () => {
          const s = typeof chunk === "string" ? chunk : chunk.toString("utf8");
          for (const ev of this.parser.feed(s)) this.dispatch(ev);
        });
      };
      this.terminal.input.on("data", this.onData);

      this.terminal.onResize(({ width, height }) => {
        this.withFatalBoundary("resize", () => {
          this.renderer.resize(width, height);
          this.renderer.invalidate();
          this.scheduleCommit();
        });
      });

      process.on("SIGINT", () => this.stop());
      process.on("SIGTERM", () => this.stop());

      this.scheduleCommit();
    });
  }

  stop(): void {
    if (!this.running) return;
    this.running = false;
    if (this.onData) this.terminal.input.off("data", this.onData);
    if (this.rootFiber) unmount(this.rootFiber);
    this.terminal.stop();
  }

  // -- Commit pipeline --------------------------------------------------------

  private scheduleCommit(): void {
    if (this.commitScheduled) return;
    this.commitScheduled = true;
    queueMicrotask(() => {
      this.commitScheduled = false;
      if (!this.running && !this.rootFiber) return;
      this.withFatalBoundary("commit", () => this.commit());
    });
  }

  private commit(): void {
    if (!this.rootFiber) return;
    reconcile(this.rootFiber);
    this.rebuildAndPaint();
    flushAllEffects(this.rootFiber);
  }

  private rebuildAndPaint(): void {
    if (!this.rootFiber) return;
    this.hostRoot = buildHostTree(this.rootFiber);
    this.focus.collect(this.hostRoot);
    if (!this.running) return;

    const { width, height } = this.terminal.size();
      const bounds = new Rect(0, 0, width, height);
      const buffer = this.renderer.beginFrame();
    if (this.hostRoot) {
      layoutTree(this.hostRoot, bounds);
      const focused = this.focus.current();
      paintTree(this.hostRoot, { buffer, focusedFiber: focused?.fiber ?? null });
      if (this.devtoolsEnabled && this.devtoolsVisible) {
        paintInspector(buffer, this.hostRoot, focused);
        this.renderer.setCursor(null);
      } else {
        // Input cursor: if focused is an input, position cursor at end of value
        if (focused && focused.type === "input") {
          const props = focused.props as unknown as InputProps;
          const value = String(props.value ?? "");
          const maxW = Math.max(0, focused.layout.width - 1);
          const cx = focused.layout.x + Math.min(value.length, maxW);
          this.renderer.setCursor({ x: cx, y: focused.layout.y });
        } else {
          this.renderer.setCursor(null);
        }
      }
    } else {
      this.renderer.setCursor(null);
    }
    this.renderer.flush();
  }

  // -- Input dispatch ---------------------------------------------------------

  private dispatch(ev: InputEvent): void {
    if (ev.type === "resize") return;
    if (ev.type === "key") return this.dispatchKey(ev);
    if (ev.type === "mouse") return this.dispatchMouse(ev);
  }

  private dispatchKey(ev: KeyEvent): void {
    // Global: Ctrl+C quits.
    if (ev.name === "char" && ev.ctrl && ev.char === "c") {
      this.stop();
      return;
    }
    if (this.devtoolsEnabled && ev.name === "f12") {
      this.devtoolsVisible = !this.devtoolsVisible;
      this.scheduleCommit();
      return;
    }
    // Global: Tab/Shift-Tab cycles focus.
    if (ev.name === "tab") {
      this.focus.next(ev.shift);
      this.scheduleCommit();
      return;
    }

    const focused = this.focus.current();
    if (!focused) return;

    // Input host handles its own editing; anything unhandled bubbles.
    if (focused.type === "input") {
      if (handleInputKey(focused, ev, () => this.scheduleCommit())) return;
    }

    // Bubble up fiber chain, invoking onKey props / onClick shortcuts.
    let f: Fiber | null = focused.fiber;
    while (f) {
      const props = f.props as BoxProps;
      if (typeof props.onKey === "function") {
        if (props.onKey(ev) === true) return;
      }
      if (typeof props.onClick === "function") {
        if ((ev.name === "enter" || ev.name === "space")) {
          props.onClick();
          return;
        }
      }
      f = f.parent;
    }
  }

  private dispatchMouse(ev: MouseEvent): void {
    if (!this.hostRoot) return;
    const hit = hitTest(this.hostRoot, ev.x, ev.y);
    if (!hit) return;

    if (ev.action === "press" && ev.button === "left") {
      this.focus.focus(hit);
      this.scheduleCommit();
    }

    let f: Fiber | null = hit.fiber;
    while (f) {
      const props = f.props as BoxProps;
      if (typeof props.onMouse === "function") {
        if (props.onMouse(ev) === true) return;
      }
      if (
        typeof props.onClick === "function" &&
        ev.action === "release" &&
        ev.button === "left"
      ) {
        props.onClick();
        return;
      }
      f = f.parent;
    }
  }

  private withFatalBoundary<T>(phase: string, fn: () => T): T {
    try {
      return fn();
    } catch (error) {
      this.emergencyStop();
      throw decorateFatalError(phase, error);
    }
  }

  private emergencyStop(): void {
    this.running = false;
    if (this.onData) {
      this.terminal.input.off("data", this.onData);
      this.onData = undefined;
    }
    this.hostRoot = null;
    this.rootFiber = null;
    try {
      this.terminal.stop();
    } catch {
      // Best-effort terminal recovery after a fatal user-land exception.
    }
  }
}

function hitTest(node: HostNode, x: number, y: number): HostNode | null {
  if (!node.layout.contains(x, y)) return null;
  for (let i = node.children.length - 1; i >= 0; i--) {
    const h = hitTest(node.children[i]!, x, y);
    if (h) return h;
  }
  return node;
}

function handleInputKey(
  host: HostNode,
  ev: KeyEvent,
  commit: () => void,
): boolean {
  const props = host.props as unknown as InputProps;
  const value = String(props.value ?? "");
  let next: string | null = null;
  switch (ev.name) {
    case "backspace":
      next = value.slice(0, -1);
      break;
    case "enter":
      props.onSubmit?.(value);
      return true;
    case "space":
      next = value + " ";
      break;
    case "char":
      if (ev.ctrl || ev.alt) return false;
      if (ev.char && ev.char.length === 1) next = value + ev.char;
      break;
    default:
      return false;
  }
  if (next !== null) {
    props.onChange(next);
    commit();
    return true;
  }
  return false;
}

function decorateFatalError(phase: string, error: unknown): Error {
  const cause = error instanceof Error ? error : new Error(String(error));
  const wrapped = new Error(`graceglyph fatal error during ${phase}: ${cause.message}`);
  if (cause.stack) {
    const [, ...rest] = cause.stack.split("\n");
    wrapped.stack = [wrapped.message, ...rest].join("\n");
  }
  return wrapped;
}
