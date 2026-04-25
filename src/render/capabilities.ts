/**
 * Terminal capability detection.
 *
 * Detection is intentionally side-effect free: we read environment
 * variables and the output stream's `isTTY` flag, never write probing
 * sequences or block on terminal queries. Apps that want runtime probing
 * can wire it themselves and pass the result via `RuntimeOptions`.
 *
 * The default heuristics err on the conservative side: when in doubt we
 * downgrade. Capabilities can be overridden per-process via env vars
 * (`GRACEGLYPH_FORCE_*`) or per-runtime via the options object.
 */

export type ColorDepth = "monochrome" | "ansi16" | "ansi256" | "truecolor";

export interface Capabilities {
  /** True when stdout is attached to a TTY. */
  readonly isTTY: boolean;
  /** Highest supported color depth. */
  readonly color: ColorDepth;
  /** OSC 8 hyperlinks. */
  readonly hyperlinks: boolean;
  /** Synchronized output (DEC mode 2026 / BSU/ESU). */
  readonly synchronizedOutput: boolean;
  /** Bracketed paste mode. */
  readonly bracketedPaste: boolean;
  /** Focus reporting (DEC mode 1004). */
  readonly focusReporting: boolean;
  /** Kitty graphics protocol. */
  readonly kittyGraphics: boolean;
  /** Sixel graphics. */
  readonly sixel: boolean;
  /** iTerm2 inline images. */
  readonly iterm2Images: boolean;
  /** Curly / dotted / double underline styles (extended SGR). */
  readonly extendedUnderline: boolean;
  /** Bold-as-bright color rendering quirk (legacy 16-color terminals). */
  readonly boldIsBright: boolean;
  /** TERM string we resolved against. */
  readonly term: string;
  /** TERM_PROGRAM string when present. */
  readonly termProgram: string | null;
}

export interface CapabilityOverrides {
  color?: ColorDepth;
  hyperlinks?: boolean;
  synchronizedOutput?: boolean;
  bracketedPaste?: boolean;
  focusReporting?: boolean;
  kittyGraphics?: boolean;
  sixel?: boolean;
  iterm2Images?: boolean;
  extendedUnderline?: boolean;
  boldIsBright?: boolean;
}

export interface DetectInput {
  /** Output stream — used for TTY detection. */
  output?: NodeJS.WriteStream;
  /** Environment to inspect. Defaults to `process.env`. */
  env?: NodeJS.ProcessEnv;
  /** Apply overrides on top of detected values. */
  overrides?: CapabilityOverrides;
}

const TRUECOLOR_TERMS = /(^|[-_])(direct|24bit|truecolor)$/i;
const TERM_256 = /-256(color)?$/i;
const TERM_16 = /^(xterm|screen|tmux|rxvt|linux|ansi|vt100|vt220|vt320|vt340|cygwin|konsole|alacritty|wezterm|kitty|foot|ghostty)/i;

/**
 * Parse a boolean env var. Recognizes "1", "true", "yes", "on" as true and
 * "0", "false", "no", "off" as false. Returns undefined for anything else
 * (including unset).
 */
function parseBoolEnv(value: string | undefined): boolean | undefined {
  if (value === undefined) return undefined;
  const v = value.trim().toLowerCase();
  if (v === "1" || v === "true" || v === "yes" || v === "on") return true;
  if (v === "0" || v === "false" || v === "no" || v === "off") return false;
  return undefined;
}

function parseColorEnv(value: string | undefined): ColorDepth | undefined {
  if (value === undefined) return undefined;
  const v = value.trim().toLowerCase();
  if (v === "truecolor" || v === "24bit" || v === "16m") return "truecolor";
  if (v === "256" || v === "256color" || v === "ansi256") return "ansi256";
  if (v === "16" || v === "ansi16" || v === "basic") return "ansi16";
  if (v === "0" || v === "none" || v === "monochrome" || v === "mono") return "monochrome";
  return undefined;
}

function detectColor(env: NodeJS.ProcessEnv, isTTY: boolean): ColorDepth {
  const force = parseColorEnv(env.GRACEGLYPH_FORCE_COLOR ?? env.FORCE_COLOR);
  if (force !== undefined) return force;
  if (parseBoolEnv(env.NO_COLOR) === true || env.NO_COLOR !== undefined) {
    return "monochrome";
  }
  if (!isTTY) return "monochrome";

  const colorterm = env.COLORTERM?.toLowerCase() ?? "";
  if (colorterm === "truecolor" || colorterm === "24bit") return "truecolor";

  const term = env.TERM ?? "";
  if (TRUECOLOR_TERMS.test(term)) return "truecolor";

  // Trusted truecolor terminals (modern, well-known).
  const program = env.TERM_PROGRAM ?? "";
  if (
    program === "iTerm.app" ||
    program === "WezTerm" ||
    program === "ghostty" ||
    program === "vscode" ||
    program === "Apple_Terminal" && Number(env.TERM_PROGRAM_VERSION ?? 0) >= 400
  ) {
    return "truecolor";
  }
  if (env.KITTY_WINDOW_ID) return "truecolor";
  if (env.WT_SESSION) return "truecolor"; // Windows Terminal
  if (env.ALACRITTY_LOG || env.ALACRITTY_SOCKET) return "truecolor";

  if (TERM_256.test(term)) return "ansi256";
  if (TERM_16.test(term)) return "ansi16";
  if (term === "" || term === "dumb") return "monochrome";
  return "ansi16";
}

function detectHyperlinks(env: NodeJS.ProcessEnv, color: ColorDepth): boolean {
  if (color === "monochrome") return false;
  const program = env.TERM_PROGRAM ?? "";
  if (
    program === "iTerm.app" ||
    program === "WezTerm" ||
    program === "ghostty" ||
    program === "vscode"
  ) {
    return true;
  }
  if (env.KITTY_WINDOW_ID) return true;
  if (env.WT_SESSION) return true;
  if (env.VTE_VERSION && Number(env.VTE_VERSION) >= 5000) return true;
  if (env.ALACRITTY_LOG || env.ALACRITTY_SOCKET) return true;
  if (env.TERM === "foot") return true;
  return false;
}

function detectSynchronizedOutput(env: NodeJS.ProcessEnv): boolean {
  // Mode 2026 is widely supported among modern terminals; assume yes for
  // the same set we already trust for hyperlinks. False negatives are safe
  // (we just emit unsynchronized writes).
  if (env.KITTY_WINDOW_ID) return true;
  if (env.WT_SESSION) return true;
  const program = env.TERM_PROGRAM ?? "";
  if (program === "iTerm.app" || program === "WezTerm" || program === "ghostty") {
    return true;
  }
  if (env.ALACRITTY_LOG || env.ALACRITTY_SOCKET) return true;
  if (env.TERM === "foot") return true;
  return false;
}

function detectKittyGraphics(env: NodeJS.ProcessEnv): boolean {
  if (env.KITTY_WINDOW_ID) return true;
  const program = env.TERM_PROGRAM ?? "";
  if (program === "ghostty" || program === "WezTerm") return true;
  return false;
}

function detectSixel(env: NodeJS.ProcessEnv): boolean {
  const term = env.TERM ?? "";
  if (term === "xterm-direct" || term.startsWith("mlterm")) return true;
  if (env.TERM_PROGRAM === "WezTerm") return true;
  return false;
}

function detectIterm2Images(env: NodeJS.ProcessEnv): boolean {
  return env.TERM_PROGRAM === "iTerm.app" || env.TERM_PROGRAM === "WezTerm";
}

function detectExtendedUnderline(env: NodeJS.ProcessEnv): boolean {
  const program = env.TERM_PROGRAM ?? "";
  if (program === "iTerm.app" || program === "WezTerm" || program === "ghostty") return true;
  if (env.KITTY_WINDOW_ID) return true;
  if (env.VTE_VERSION && Number(env.VTE_VERSION) >= 5200) return true;
  return false;
}

function detectBoldIsBright(env: NodeJS.ProcessEnv): boolean {
  // Apple Terminal renders bold as bright by default; most modern terminals
  // do not. Conservative default: only flag the legacy Apple_Terminal case.
  return env.TERM_PROGRAM === "Apple_Terminal";
}

function detectFocusReporting(env: NodeJS.ProcessEnv, color: ColorDepth): boolean {
  if (color === "monochrome") return false;
  // Modern xterm-derived terminals support DEC 1004; assume yes when we
  // already trust the terminal for synchronized output.
  return detectSynchronizedOutput(env);
}

/**
 * Detect terminal capabilities from environment + output stream.
 *
 * @example
 * ```ts
 * const caps = detectCapabilities({ output: process.stdout });
 * if (caps.color === "truecolor") emitTrueColorEscape();
 * ```
 */
export function detectCapabilities(input: DetectInput = {}): Capabilities {
  const env = input.env ?? process.env;
  const output = input.output ?? process.stdout;
  const isTTY = output.isTTY ?? false;

  const color = detectColor(env, isTTY);
  const supportsTTY = isTTY && color !== "monochrome";
  const overrides = input.overrides ?? {};

  return Object.freeze<Capabilities>({
    isTTY,
    color: overrides.color ?? color,
    hyperlinks: overrides.hyperlinks ?? (supportsTTY && detectHyperlinks(env, color)),
    synchronizedOutput:
      overrides.synchronizedOutput ?? (supportsTTY && detectSynchronizedOutput(env)),
    bracketedPaste:
      overrides.bracketedPaste ?? (parseBoolEnv(env.GRACEGLYPH_BRACKETED_PASTE) ?? supportsTTY),
    focusReporting:
      overrides.focusReporting ?? (supportsTTY && detectFocusReporting(env, color)),
    kittyGraphics: overrides.kittyGraphics ?? (supportsTTY && detectKittyGraphics(env)),
    sixel: overrides.sixel ?? (supportsTTY && detectSixel(env)),
    iterm2Images: overrides.iterm2Images ?? (supportsTTY && detectIterm2Images(env)),
    extendedUnderline:
      overrides.extendedUnderline ?? (supportsTTY && detectExtendedUnderline(env)),
    boldIsBright: overrides.boldIsBright ?? detectBoldIsBright(env),
    term: env.TERM ?? "",
    termProgram: env.TERM_PROGRAM ?? null,
  });
}

/**
 * Capability profile equivalent to a plain dumb terminal. Useful as a
 * baseline in tests and for non-TTY output (CI logs, piped output).
 */
export const DUMB_CAPABILITIES: Capabilities = Object.freeze({
  isTTY: false,
  color: "monochrome",
  hyperlinks: false,
  synchronizedOutput: false,
  bracketedPaste: false,
  focusReporting: false,
  kittyGraphics: false,
  sixel: false,
  iterm2Images: false,
  extendedUnderline: false,
  boldIsBright: false,
  term: "dumb",
  termProgram: null,
});

/**
 * Capability profile assuming a modern truecolor terminal. Useful in tests
 * that need to exercise the high-fidelity render path.
 */
export const FULL_CAPABILITIES: Capabilities = Object.freeze({
  isTTY: true,
  color: "truecolor",
  hyperlinks: true,
  synchronizedOutput: true,
  bracketedPaste: true,
  focusReporting: true,
  kittyGraphics: true,
  sixel: true,
  iterm2Images: true,
  extendedUnderline: true,
  boldIsBright: false,
  term: "xterm-256color",
  termProgram: "graceglyph-test",
});
