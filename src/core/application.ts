import { Terminal, TerminalOptions } from "./terminal.js";
import { Renderer } from "../render/renderer.js";
import { InputParser } from "../input/parser.js";
import { FocusManager } from "../input/focus.js";
import { EventBus } from "./events.js";
import { InputEvent, KeyEvent, MouseEvent } from "../input/keys.js";
import { Rect } from "../layout/rect.js";
import type { View } from "../widgets/view.js";
import { Theme, defaultTheme } from "../theme/theme.js";

export interface ApplicationOptions extends TerminalOptions {
  theme?: Theme;
}

/**
 * The heart of the framework: owns the view tree, pumps input through the
 * focus manager, and schedules redraws on dirty state.
 *
 * Retained-mode: views hold state and mark themselves dirty; the app only
 * repaints when something changed or when a resize invalidates the buffer.
 */
export class Application {
  readonly terminal: Terminal;
  readonly renderer: Renderer;
  readonly focus: FocusManager;
  readonly bus: EventBus;
  readonly parser: InputParser;
  theme: Theme;

  private root: View | null = null;
  private running = false;
  private dirty = true;
  private renderScheduled = false;
  private onData?: (buf: Buffer | string) => void;
  private sigintHandler?: () => void;
  private sigtermHandler?: () => void;
  private resizeCleanup?: () => void;
  private parserFlushTimer?: NodeJS.Timeout;

  constructor(opts: ApplicationOptions = {}) {
    this.terminal = new Terminal(opts);
    this.renderer = new Renderer(this.terminal);
    this.focus = new FocusManager();
    this.bus = new EventBus();
    this.parser = new InputParser();
    this.theme = opts.theme ?? defaultTheme();
  }

  setRoot(view: View): void {
    this.root?._unmount(this);
    this.root = view;
    view._mount(this);
    this.focus.focusFirst();
    this.invalidate();
  }

  run(): void {
    if (this.running) return;
    this.running = true;
    this.terminal.start();

    this.onData = (buf) => {
      this.cancelParserFlush();
      const chunk = typeof buf === "string" ? buf : buf.toString("utf8");
      for (const ev of this.parser.feed(chunk)) this.dispatch(ev);
      this.scheduleParserFlush();
    };
    this.terminal.input.on("data", this.onData);

    this.resizeCleanup = this.terminal.onResize(({ width, height }) => {
      this.renderer.resize(width, height);
      this.renderer.invalidate();
      this.dispatch({ type: "resize", width, height });
      this.invalidate();
    });

    this.sigintHandler = () => this.quit();
    this.sigtermHandler = () => this.quit();
    process.on("SIGINT", this.sigintHandler);
    process.on("SIGTERM", this.sigtermHandler);

    this.invalidate();
  }

  quit(): void {
    if (!this.running) return;
    this.running = false;
    if (this.onData) this.terminal.input.off("data", this.onData);
    this.cancelParserFlush();
    this.detachResizeListener();
    this.detachSignalHandlers();
    this.root?._unmount(this);
    this.terminal.stop();
  }

  /** Mark the tree dirty; a repaint is scheduled for the next tick. */
  invalidate(): void {
    this.dirty = true;
    if (this.renderScheduled) return;
    this.renderScheduled = true;
    queueMicrotask(() => this.tick());
  }

  private tick(): void {
    this.renderScheduled = false;
    if (!this.running || !this.dirty) return;
    this.dirty = false;
    this.render();
  }

  private render(): void {
    if (!this.root) return;
    const { width, height } = this.terminal.size();
    const bounds = new Rect(0, 0, width, height);
    const buf = this.renderer.beginFrame();
    this.root.layout(bounds);
    this.root.draw(buf, bounds);
    const focused = this.focus.focused();
    this.renderer.setCursor(focused?.cursorPosition() ?? null);
    this.renderer.flush();
  }

  private dispatch(ev: InputEvent): void {
    if (ev.type === "key") return this.dispatchKey(ev);
    if (ev.type === "mouse") return this.dispatchMouse(ev);
    if (ev.type === "resize") this.bus.emit("resize", ev);
  }

  private dispatchKey(ev: KeyEvent): void {
    // Global shortcuts first.
    if (ev.name === "char" && ev.ctrl && ev.char === "c") {
      this.quit();
      return;
    }
    if (ev.name === "tab") {
      this.focus.focusNext(ev.shift);
      this.invalidate();
      return;
    }

    const focused = this.focus.focused();
    let handled = false;
    if (focused) handled = bubbleKey(focused, ev);
    if (!handled && this.root) bubbleKey(this.root, ev);
    this.bus.emit("key", ev);
  }

  private dispatchMouse(ev: MouseEvent): void {
    if (!this.root) return;
    const hit = this.root.hitTest(ev.x, ev.y);
    if (hit) {
      if (ev.action === "press" && hit.focusable) this.focus.focus(hit);
      bubbleMouse(hit, ev);
    }
    this.bus.emit("mouse", ev);
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
      for (const ev of this.parser.flushPending()) this.dispatch(ev);
    }, 20);
  }

  private cancelParserFlush(): void {
    if (this.parserFlushTimer) {
      clearTimeout(this.parserFlushTimer);
      this.parserFlushTimer = undefined;
    }
  }
}

function bubbleKey(start: View, ev: KeyEvent): boolean {
  let v: View | null = start;
  while (v) {
    if (v.onKey(ev)) return true;
    v = v.parent;
  }
  return false;
}

function bubbleMouse(start: View, ev: MouseEvent): boolean {
  let v: View | null = start;
  while (v) {
    if (v.onMouse(ev)) return true;
    v = v.parent;
  }
  return false;
}
