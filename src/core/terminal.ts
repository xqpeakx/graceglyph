import { AnsiSeq } from "../render/ansi.js";
import { Size } from "../layout/rect.js";
import {
  detectCapabilities,
  type Capabilities,
  type CapabilityOverrides,
} from "../render/capabilities.js";

export interface TerminalOptions {
  input?: NodeJS.ReadStream;
  output?: NodeJS.WriteStream;
  useAltScreen?: boolean;
  mouse?: boolean;
  /**
   * Override or supply terminal capabilities. When omitted they are
   * detected from the environment.
   */
  capabilities?: Capabilities | CapabilityOverrides;
}

/**
 * Owns the real TTY: raw mode, alt screen, mouse, resize events, and byte I/O.
 * The renderer and input parser sit on top of this — they never talk to
 * process.stdout/stdin directly.
 */
export class Terminal {
  readonly input: NodeJS.ReadStream;
  readonly output: NodeJS.WriteStream;
  readonly capabilities: Capabilities;
  private readonly useAltScreen: boolean;
  private readonly mouse: boolean;
  private started = false;
  private resizeHandler?: () => void;
  private readonly resizeListeners = new Set<(s: Size) => void>();

  constructor(opts: TerminalOptions = {}) {
    this.input = opts.input ?? process.stdin;
    this.output = opts.output ?? process.stdout;
    this.useAltScreen = opts.useAltScreen ?? true;
    this.mouse = opts.mouse ?? true;
    this.capabilities = resolveCapabilities(this.output, opts.capabilities);
  }

  size(): Size {
    return {
      width: this.output.columns ?? 80,
      height: this.output.rows ?? 24,
    };
  }

  start(): void {
    if (this.started) return;
    this.started = true;
    if (this.input.isTTY && typeof this.input.setRawMode === "function") {
      this.input.setRawMode(true);
    }
    this.input.resume();
    if (this.useAltScreen) this.output.write(AnsiSeq.enterAltScreen);
    this.output.write(AnsiSeq.hideCursor);
    if (this.mouse) this.output.write(AnsiSeq.enableMouse);
    if (this.capabilities.bracketedPaste) {
      this.output.write(AnsiSeq.enableBracketedPaste);
    }
    if (this.capabilities.focusReporting) {
      this.output.write(AnsiSeq.enableFocusReporting);
    }
    this.output.write(AnsiSeq.clearScreen);

    this.resizeHandler = () => {
      const s = this.size();
      for (const l of this.resizeListeners) l(s);
    };
    this.output.on("resize", this.resizeHandler);
  }

  stop(): void {
    if (!this.started) return;
    this.started = false;
    if (this.resizeHandler) {
      this.output.off("resize", this.resizeHandler);
      this.resizeHandler = undefined;
    }
    if (this.capabilities.focusReporting) {
      this.output.write(AnsiSeq.disableFocusReporting);
    }
    if (this.capabilities.bracketedPaste) {
      this.output.write(AnsiSeq.disableBracketedPaste);
    }
    if (this.mouse) this.output.write(AnsiSeq.disableMouse);
    this.output.write(AnsiSeq.showCursor);
    this.output.write(AnsiSeq.reset);
    if (this.useAltScreen) this.output.write(AnsiSeq.exitAltScreen);
    if (this.input.isTTY && typeof this.input.setRawMode === "function") {
      this.input.setRawMode(false);
    }
    this.input.pause();
  }

  write(chunk: string): void {
    this.output.write(chunk);
  }

  onResize(listener: (size: Size) => void): () => void {
    this.resizeListeners.add(listener);
    return () => this.resizeListeners.delete(listener);
  }
}

function resolveCapabilities(
  output: NodeJS.WriteStream,
  override: TerminalOptions["capabilities"],
): Capabilities {
  if (override && "color" in override && "isTTY" in override) {
    // Fully-formed Capabilities object — use as-is.
    return override as Capabilities;
  }
  return detectCapabilities({
    output,
    overrides: (override as CapabilityOverrides | undefined) ?? undefined,
  });
}
