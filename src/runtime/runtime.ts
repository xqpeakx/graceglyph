import { Terminal, TerminalOptions } from "../core/terminal.js";
import { InputParser } from "../input/parser.js";
import type { InputEvent, KeyEvent, MouseEvent } from "../input/keys.js";
import { Rect } from "../layout/rect.js";
import { Renderer } from "../render/renderer.js";
import type { Theme } from "../theme/theme.js";
import { defaultTheme } from "../theme/theme.js";
import {
  applyEditableKey,
  commitEditableState,
  getCursorOffset,
  moveCursorToPoint,
} from "./editable.js";
import type { BoxProps, InputProps, ZenElement } from "./element.js";
import { Fiber, createFiber, type FiberEnvironment } from "./fiber.js";
import { FocusManager } from "./focus.js";
import { HostNode, layoutTree, paintTree } from "./host.js";
import { paintInspector } from "./devtools.js";
import {
  buildHostTree,
  flushAllEffects,
  reconcile,
  unmount,
} from "./reconciler.js";
import { fiberForError, formatComponentStack } from "./diagnostics.js";

export interface RuntimeOptions extends TerminalOptions {
  devtools?: boolean;
  theme?: Theme;
}

export class Runtime {
  readonly terminal: Terminal;
  readonly renderer: Renderer;
  readonly parser: InputParser;
  readonly focus: FocusManager;
  readonly theme: Theme;

  private rootFiber: Fiber | null = null;
  private hostRoot: HostNode | null = null;
  private running = false;
  private commitScheduled = false;
  private readonly environment: FiberEnvironment;
  private readonly dirtyFibers = new Set<Fiber>();
  private fullReconcile = false;
  private hostTreeDirty = true;
  private layoutDirty = true;
  private notifiedFocus: HostNode | null = null;
  private onData?: (chunk: Buffer | string) => void;
  private readonly devtoolsEnabled: boolean;
  private devtoolsVisible = false;
  private sigintHandler?: () => void;
  private sigtermHandler?: () => void;
  private resizeCleanup?: () => void;
  private parserFlushTimer?: NodeJS.Timeout;

  constructor(opts: RuntimeOptions = {}) {
    this.terminal = new Terminal(opts);
    this.renderer = new Renderer(this.terminal);
    this.parser = new InputParser();
    this.focus = new FocusManager();
    this.devtoolsEnabled = opts.devtools ?? true;
    this.theme = opts.theme ?? defaultTheme();
    this.environment = {
      theme: this.theme,
      size: () => this.terminal.size(),
      onResize: (listener) => this.terminal.onResize(listener),
    };
  }

  mount(element: ZenElement): void {
    this.withFatalBoundary("mount", () => {
      const root = createFiber(
        element.type,
        element.props,
        element.key,
        null,
      );
      root.environment = this.environment;
      root.scheduler = (fiber) => this.scheduleCommit(fiber);
      this.rootFiber = root;
      reconcile(root);
      this.fullReconcile = true;
      this.hostTreeDirty = true;
      this.layoutDirty = true;
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
          this.cancelParserFlush();
          const s = typeof chunk === "string" ? chunk : chunk.toString("utf8");
          for (const ev of this.parser.feed(s)) {
            this.dispatch(ev);
            this.flushScheduledCommit();
          }
          this.scheduleParserFlush();
        });
      };
      this.terminal.input.on("data", this.onData);

      this.resizeCleanup = this.terminal.onResize(({ width, height }) => {
        this.withFatalBoundary("resize", () => {
          this.renderer.resize(width, height);
          this.renderer.invalidate();
          this.layoutDirty = true;
          this.scheduleCommit();
        });
      });

      this.sigintHandler = () => this.stop();
      this.sigtermHandler = () => this.stop();
      process.on("SIGINT", this.sigintHandler);
      process.on("SIGTERM", this.sigtermHandler);

      this.scheduleCommit();
    });
  }

  stop(): void {
    if (!this.running) return;
    this.notifyFocusTransition(null);
    this.running = false;
    if (this.onData) this.terminal.input.off("data", this.onData);
    this.cancelParserFlush();
    this.detachResizeListener();
    this.detachSignalHandlers();
    if (this.rootFiber) unmount(this.rootFiber);
    this.terminal.stop();
  }

  // -- Commit pipeline --------------------------------------------------------

  private scheduleCommit(fiber?: Fiber): void {
    if (fiber) this.markDirtyFiber(fiber);
    if (this.commitScheduled) return;
    this.commitScheduled = true;
    queueMicrotask(() => {
      if (!this.commitScheduled) return;
      this.commitScheduled = false;
      if (!this.running && !this.rootFiber) return;
      this.withFatalBoundary("commit", () => this.commit());
    });
  }

  private flushScheduledCommit(): void {
    if (!this.commitScheduled) return;
    this.commitScheduled = false;
    if (!this.running && !this.rootFiber) return;
    this.withFatalBoundary("commit", () => this.commit());
  }

  private commit(): void {
    if (!this.rootFiber) return;
    const needsReconcile = this.fullReconcile || this.dirtyFibers.size > 0;
    if (needsReconcile) {
      const targets = this.fullReconcile ? [this.rootFiber] : Array.from(this.dirtyFibers);
      for (const fiber of targets) {
        reconcile(fiber);
      }
      this.dirtyFibers.clear();
      this.fullReconcile = false;
      this.hostTreeDirty = true;
      this.layoutDirty = true;
    }
    this.rebuildAndPaint();
    if (needsReconcile) flushAllEffects(this.rootFiber);
  }

  private rebuildAndPaint(): void {
    if (!this.rootFiber) return;
    if (this.hostTreeDirty || !this.hostRoot) {
      this.hostRoot = buildHostTree(this.rootFiber);
      this.hostTreeDirty = false;
      this.layoutDirty = true;
    }
    this.focus.collect(this.hostRoot);
    if (!this.running) return;
    this.notifyFocusTransition(this.focus.current());

    const { width, height } = this.terminal.size();
    const bounds = new Rect(0, 0, width, height);
    const buffer = this.renderer.beginFrame();
    if (this.hostRoot) {
      if (this.layoutDirty) {
        layoutTree(this.hostRoot, bounds);
        this.layoutDirty = false;
      }
      const focused = this.focus.current();
      paintTree(this.hostRoot, { buffer, focusedFiber: focused?.fiber ?? null });
      if (this.devtoolsEnabled && this.devtoolsVisible) {
        paintInspector(buffer, this.hostRoot, focused);
        this.renderer.setCursor(null);
      } else {
        if (focused && isEditableHost(focused)) {
          const props = focused.props as unknown as InputProps;
          const value = String(props.value ?? "");
          const offset = getCursorOffset(
            focused.editableState ?? {
              cursor: value.length,
              scrollX: 0,
              scrollY: 0,
              preferredColumn: null,
              pendingValue: null,
            },
            value,
            focused.layout.width,
            focused.layout.height,
            focused.type === "textarea" ? "multi-line" : "single-line",
          );
          this.renderer.setCursor({
            x: focused.layout.x + Math.min(offset.x, Math.max(0, focused.layout.width - 1)),
            y: focused.layout.y + Math.min(offset.y, Math.max(0, focused.layout.height - 1)),
          });
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
    if (isEditableHost(focused)) {
      if (handleEditableKey(focused, ev, () => this.scheduleCommit())) return;
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
    const scope = this.focus.scope();
    const hit = scope
      ? hitTest(scope, ev.x, ev.y)
      : hitTest(this.hostRoot, ev.x, ev.y);
    if (!hit) return;

    if (ev.action === "press" && ev.button === "left") {
      this.focus.focus(hit);
      if (isEditableHost(hit)) {
        const state = hit.editableState ?? {
          cursor: String(hit.props.value ?? "").length,
          scrollX: 0,
          scrollY: 0,
          preferredColumn: null,
          pendingValue: null,
        };
        hit.editableState = state;
        commitEditableState(state, String(hit.props.value ?? ""));
        moveCursorToPoint(
          state,
          String(hit.props.value ?? ""),
          ev.x - hit.layout.x,
          ev.y - hit.layout.y,
          hit.layout.width,
          hit.layout.height,
          hit.type === "textarea" ? "multi-line" : "single-line",
        );
      }
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
    this.notifyFocusTransition(null);
    this.running = false;
    if (this.onData) {
      this.terminal.input.off("data", this.onData);
      this.onData = undefined;
    }
    this.cancelParserFlush();
    this.detachResizeListener();
    this.detachSignalHandlers();
    this.dirtyFibers.clear();
    this.fullReconcile = false;
    this.hostTreeDirty = true;
    this.layoutDirty = true;
    this.hostRoot = null;
    this.rootFiber = null;
    try {
      this.terminal.stop();
    } catch {
      // Best-effort terminal recovery after a fatal user-land exception.
    }
  }

  private detachSignalHandlers(): void {
    if (this.sigintHandler) {
      process.off("SIGINT", this.sigintHandler);
      this.sigintHandler = undefined;
    }
    if (this.sigtermHandler) {
      process.off("SIGTERM", this.sigtermHandler);
      this.sigtermHandler = undefined;
    }
  }

  private detachResizeListener(): void {
    if (this.resizeCleanup) {
      this.resizeCleanup();
      this.resizeCleanup = undefined;
    }
  }

  private scheduleParserFlush(): void {
    if (!this.parser.hasPendingInput()) return;
    this.parserFlushTimer = setTimeout(() => {
      this.parserFlushTimer = undefined;
      if (!this.running) return;
      this.withFatalBoundary("input", () => {
        for (const ev of this.parser.flushPending()) {
          this.dispatch(ev);
          this.flushScheduledCommit();
        }
      });
    }, 20);
  }

  private cancelParserFlush(): void {
    if (this.parserFlushTimer) {
      clearTimeout(this.parserFlushTimer);
      this.parserFlushTimer = undefined;
    }
  }

  private markDirtyFiber(fiber: Fiber): void {
    if (this.fullReconcile) return;

    for (const existing of Array.from(this.dirtyFibers)) {
      if (isAncestor(existing, fiber)) return;
      if (isAncestor(fiber, existing)) this.dirtyFibers.delete(existing);
    }

    this.dirtyFibers.add(fiber);
  }

  private notifyFocusTransition(next: HostNode | null): void {
    if (this.notifiedFocus?.fiber === next?.fiber) {
      this.notifiedFocus = next;
      return;
    }

    if (this.notifiedFocus) callLifecycleHandler(this.notifiedFocus, "onBlur");
    if (next) callLifecycleHandler(next, "onFocus");
    this.notifiedFocus = next;
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

function handleEditableKey(
  host: HostNode,
  ev: KeyEvent,
  commit: () => void,
): boolean {
  const props = host.props as unknown as InputProps;
  const committedValue = String(props.value ?? "");
  const state = host.editableState ?? {
    cursor: committedValue.length,
    scrollX: 0,
    scrollY: 0,
    preferredColumn: null,
    pendingValue: null,
  };
  host.editableState = state;
  const value = state.pendingValue ?? committedValue;
  const result = applyEditableKey(state, value, ev, {
    mode: host.type === "textarea" ? "multi-line" : "single-line",
    width: host.layout.width,
    height: host.layout.height,
    onSubmit: host.type === "input" ? props.onSubmit : undefined,
  });
  if (!result.handled) return false;
  if (result.nextValue !== committedValue) {
    state.pendingValue = result.nextValue;
  } else if (state.pendingValue !== null) {
    state.pendingValue = null;
  }
  if (result.nextValue !== committedValue) {
    props.onChange(result.nextValue);
  }
  commit();
  return true;
}

function isEditableHost(host: HostNode): boolean {
  return host.type === "input" || host.type === "textarea";
}

function isAncestor(parent: Fiber, child: Fiber): boolean {
  for (let current: Fiber | null = child.parent; current; current = current.parent) {
    if (current === parent) return true;
  }
  return false;
}

function callLifecycleHandler(host: HostNode, name: "onFocus" | "onBlur"): void {
  const handler = (host.props as unknown as (BoxProps & Partial<InputProps>))[name];
  if (typeof handler === "function") handler();
}

function decorateFatalError(phase: string, error: unknown): Error {
  const cause = error instanceof Error ? error : new Error(String(error));
  const componentStack = formatComponentStack(fiberForError(error));
  const message = componentStack.length > 0
    ? `graceglyph fatal error during ${phase}: ${cause.message}\n${componentStack}`
    : `graceglyph fatal error during ${phase}: ${cause.message}`;
  const wrapped = new Error(message);
  if (cause.stack) {
    const [, ...rest] = cause.stack.split("\n");
    wrapped.stack = [wrapped.message, ...rest].join("\n");
  }
  return wrapped;
}
