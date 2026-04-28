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
import { reconcile, unmount } from "./reconciler.js";
import { fiberForError, formatComponentStack } from "./diagnostics.js";
import { flushAllFiberEffects } from "./hooks.js";
import { buildHostTree } from "./host.js";

export interface RuntimeOptions extends TerminalOptions {
  devtools?: boolean;
  theme?: Theme;
}

export class Runtime {
  readonly terminal: Terminal;
  readonly renderer: Renderer;
  readonly parser: InputParser;
  readonly focus: FocusManager;

  private rootFiber: Fiber | null = null;
  private themeValue: Theme;
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
  private readonly eventLog: string[] = [];
  private hoveredFiber: Fiber | null = null;
  private activeFiber: Fiber | null = null;
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
    this.themeValue = opts.theme ?? defaultTheme();
    this.environment = {
      theme: this.themeValue,
      setTheme: (theme) => this.setTheme(theme),
      size: () => this.terminal.size(),
      onResize: (listener) => this.terminal.onResize(listener),
      capabilities: this.terminal.capabilities,
    };
  }

  get theme(): Theme {
    return this.themeValue;
  }

  setTheme(theme: Theme): void {
    if (Object.is(this.themeValue, theme)) return;
    this.themeValue = theme;
    this.environment.theme = theme;
    this.fullReconcile = true;
    this.hostTreeDirty = true;
    this.layoutDirty = true;
    this.scheduleCommit();
  }

  mount(element: ZenElement): void {
    this.withFatalBoundary("mount", () => {
      const root = createFiber(element.type, element.props, element.key, null);
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
    if (needsReconcile) flushAllFiberEffects(this.rootFiber);
  }

  private rebuildAndPaint(): void {
    if (!this.rootFiber) return;
    if (this.hostTreeDirty || !this.hostRoot) {
      this.hostRoot = buildHostTree(this.rootFiber);
      this.hostTreeDirty = false;
      this.layoutDirty = true;
    }
    if (!this.running) return;

    const { width, height } = this.terminal.size();
    const bounds = new Rect(0, 0, width, height);
    const buffer = this.renderer.beginFrame();
    if (this.hostRoot) {
      if (this.layoutDirty) {
        layoutTree(this.hostRoot, bounds);
        this.layoutDirty = false;
      }
      this.focus.collect(this.hostRoot);
      this.notifyFocusTransition(this.focus.current());
      const focused = this.focus.current();
      paintTree(this.hostRoot, {
        buffer,
        focusedFiber: focused?.fiber ?? null,
        hoveredFiber: this.hoveredFiber,
        activeFiber: this.activeFiber,
      });
      if (this.devtoolsEnabled && this.devtoolsVisible) {
        paintInspector(buffer, this.hostRoot, focused, this.eventLog);
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
    this.recordInputEvent(ev);
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
      if (props.disabled) {
        f = f.parent;
        continue;
      }
      if (typeof props.onKey === "function") {
        if (props.onKey(ev) === true) return;
      }
      if (typeof props.onClick === "function") {
        if (ev.name === "enter" || ev.name === "space") {
          props.onClick();
          return;
        }
      }
      f = f.parent;
    }
  }

  private recordInputEvent(ev: InputEvent): void {
    const label =
      ev.type === "key"
        ? `key ${ev.ctrl ? "C-" : ""}${ev.alt ? "M-" : ""}${ev.shift ? "S-" : ""}${ev.name}${ev.char ? `:${ev.char}` : ""}`
        : ev.type === "mouse"
          ? `mouse ${ev.button} ${ev.action} @${ev.x},${ev.y}`
          : `resize ${ev.width}x${ev.height}`;
    this.eventLog.push(label);
    if (this.eventLog.length > 30) this.eventLog.splice(0, this.eventLog.length - 30);
  }

  private dispatchMouse(ev: MouseEvent): void {
    if (!this.hostRoot) return;
    const scope = this.focus.scope();
    const hit = scope ? hitTest(scope, ev.x, ev.y) : hitTest(this.hostRoot, ev.x, ev.y);
    if (!hit) {
      if (this.hoveredFiber || this.activeFiber) {
        this.hoveredFiber = null;
        this.activeFiber = null;
        this.scheduleCommit();
      }
      return;
    }

    const interactive = nearestInteractive(hit);
    this.updateHover(interactive);

    if (ev.action === "press" && ev.button === "left") {
      const focusTarget = nearestFocusable(hit);
      this.focus.focus(focusTarget);
      this.activeFiber = interactive?.fiber ?? null;
      if (focusTarget && isEditableHost(focusTarget)) {
        const state = focusTarget.editableState ?? {
          cursor: String(focusTarget.props.value ?? "").length,
          scrollX: 0,
          scrollY: 0,
          preferredColumn: null,
          pendingValue: null,
        };
        focusTarget.editableState = state;
        commitEditableState(state, String(focusTarget.props.value ?? ""));
        moveCursorToPoint(
          state,
          String(focusTarget.props.value ?? ""),
          ev.x - focusTarget.layout.x,
          ev.y - focusTarget.layout.y,
          focusTarget.layout.width,
          focusTarget.layout.height,
          focusTarget.type === "textarea" ? "multi-line" : "single-line",
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
        !props.disabled &&
        typeof props.onClick === "function" &&
        ev.action === "release" &&
        ev.button === "left"
      ) {
        props.onClick();
        this.activeFiber = null;
        this.scheduleCommit();
        return;
      }
      f = f.parent;
    }

    if (ev.action === "release" && this.activeFiber) {
      this.activeFiber = null;
      this.scheduleCommit();
    }
  }

  private updateHover(host: HostNode | null): void {
    const next = host?.fiber ?? null;
    if (this.hoveredFiber === next) return;
    this.hoveredFiber = next;
    this.scheduleCommit();
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
  if (node.hidden || !node.layout.contains(x, y)) return null;
  for (let i = node.children.length - 1; i >= 0; i--) {
    const h = hitTest(node.children[i]!, x, y);
    if (h) return h;
  }
  return node;
}

function handleEditableKey(host: HostNode, ev: KeyEvent, commit: () => void): boolean {
  const props = host.props as unknown as InputProps;
  if (props.disabled) return false;
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

function isFocusableHost(host: HostNode): boolean {
  return (
    !host.hidden &&
    host.resolvedProps.disabled !== true &&
    (isEditableHost(host) || host.resolvedProps.focusable === true)
  );
}

function nearestFocusable(host: HostNode): HostNode | null {
  for (let current: HostNode | null = host; current; current = current.parent) {
    if (isFocusableHost(current)) return current;
  }
  return null;
}

function nearestInteractive(host: HostNode): HostNode | null {
  for (let current: HostNode | null = host; current; current = current.parent) {
    if (current.hidden || current.resolvedProps.disabled === true) continue;
    if (
      isEditableHost(current) ||
      current.resolvedProps.focusable === true ||
      typeof current.props.onClick === "function" ||
      typeof current.props.onMouse === "function"
    ) {
      return current;
    }
  }
  return null;
}

function isAncestor(parent: Fiber, child: Fiber): boolean {
  for (let current: Fiber | null = child.parent; current; current = current.parent) {
    if (current === parent) return true;
  }
  return false;
}

function callLifecycleHandler(host: HostNode, name: "onFocus" | "onBlur"): void {
  const handler = (host.props as unknown as BoxProps & Partial<InputProps>)[name];
  if (typeof handler === "function") handler();
}

function decorateFatalError(phase: string, error: unknown): Error {
  const cause = error instanceof Error ? error : new Error(String(error));
  const componentStack = formatComponentStack(fiberForError(error));
  const message =
    componentStack.length > 0
      ? `graceglyph fatal error during ${phase}: ${cause.message}\n${componentStack}`
      : `graceglyph fatal error during ${phase}: ${cause.message}`;
  const wrapped = new Error(message);
  if (cause.stack) {
    const [, ...rest] = cause.stack.split("\n");
    wrapped.stack = [wrapped.message, ...rest].join("\n");
  }
  return wrapped;
}
