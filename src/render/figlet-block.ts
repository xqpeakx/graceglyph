/**
 * Compact 5-row block-letter font used by `BigText`. Each glyph is fixed
 * width (6 cells) so layout math stays trivial. Glyphs use the Unicode
 * full-block (`█`) character against spaces, which downgrades cleanly on
 * any terminal that can render UTF-8.
 *
 * Coverage: A–Z, 0–9, space, hyphen, period, exclamation, question, colon.
 * Anything else falls through as `?` shaped glyph.
 */

export const FIGLET_BLOCK_HEIGHT = 5;
export const FIGLET_BLOCK_WIDTH = 6;

const G = (lines: readonly string[]): readonly string[] => lines.map((l) => l.padEnd(FIGLET_BLOCK_WIDTH, " "));

export const FIGLET_BLOCK: Record<string, readonly string[]> = {
  A: G([
    " ███  ",
    "█   █ ",
    "█████ ",
    "█   █ ",
    "█   █ ",
  ]),
  B: G([
    "████  ",
    "█   █ ",
    "████  ",
    "█   █ ",
    "████  ",
  ]),
  C: G([
    " ████ ",
    "█     ",
    "█     ",
    "█     ",
    " ████ ",
  ]),
  D: G([
    "████  ",
    "█   █ ",
    "█   █ ",
    "█   █ ",
    "████  ",
  ]),
  E: G([
    "█████ ",
    "█     ",
    "████  ",
    "█     ",
    "█████ ",
  ]),
  F: G([
    "█████ ",
    "█     ",
    "████  ",
    "█     ",
    "█     ",
  ]),
  G: G([
    " ████ ",
    "█     ",
    "█  ██ ",
    "█   █ ",
    " ████ ",
  ]),
  H: G([
    "█   █ ",
    "█   █ ",
    "█████ ",
    "█   █ ",
    "█   █ ",
  ]),
  I: G([
    " ███  ",
    "  █   ",
    "  █   ",
    "  █   ",
    " ███  ",
  ]),
  J: G([
    "  ███ ",
    "    █ ",
    "    █ ",
    "█   █ ",
    " ███  ",
  ]),
  K: G([
    "█   █ ",
    "█  █  ",
    "███   ",
    "█  █  ",
    "█   █ ",
  ]),
  L: G([
    "█     ",
    "█     ",
    "█     ",
    "█     ",
    "█████ ",
  ]),
  M: G([
    "█   █ ",
    "██ ██ ",
    "█ █ █ ",
    "█   █ ",
    "█   █ ",
  ]),
  N: G([
    "█   █ ",
    "██  █ ",
    "█ █ █ ",
    "█  ██ ",
    "█   █ ",
  ]),
  O: G([
    " ███  ",
    "█   █ ",
    "█   █ ",
    "█   █ ",
    " ███  ",
  ]),
  P: G([
    "████  ",
    "█   █ ",
    "████  ",
    "█     ",
    "█     ",
  ]),
  Q: G([
    " ███  ",
    "█   █ ",
    "█   █ ",
    "█  █  ",
    " ██ █ ",
  ]),
  R: G([
    "████  ",
    "█   █ ",
    "████  ",
    "█  █  ",
    "█   █ ",
  ]),
  S: G([
    " ████ ",
    "█     ",
    " ███  ",
    "    █ ",
    "████  ",
  ]),
  T: G([
    "█████ ",
    "  █   ",
    "  █   ",
    "  █   ",
    "  █   ",
  ]),
  U: G([
    "█   █ ",
    "█   █ ",
    "█   █ ",
    "█   █ ",
    " ███  ",
  ]),
  V: G([
    "█   █ ",
    "█   █ ",
    "█   █ ",
    " █ █  ",
    "  █   ",
  ]),
  W: G([
    "█   █ ",
    "█   █ ",
    "█ █ █ ",
    "██ ██ ",
    "█   █ ",
  ]),
  X: G([
    "█   █ ",
    " █ █  ",
    "  █   ",
    " █ █  ",
    "█   █ ",
  ]),
  Y: G([
    "█   █ ",
    " █ █  ",
    "  █   ",
    "  █   ",
    "  █   ",
  ]),
  Z: G([
    "█████ ",
    "   █  ",
    "  █   ",
    " █    ",
    "█████ ",
  ]),
  "0": G([
    " ███  ",
    "█  ██ ",
    "█ █ █ ",
    "██  █ ",
    " ███  ",
  ]),
  "1": G([
    "  █   ",
    " ██   ",
    "  █   ",
    "  █   ",
    " ███  ",
  ]),
  "2": G([
    " ███  ",
    "█   █ ",
    "  ██  ",
    " █    ",
    "█████ ",
  ]),
  "3": G([
    "████  ",
    "    █ ",
    " ███  ",
    "    █ ",
    "████  ",
  ]),
  "4": G([
    "█   █ ",
    "█   █ ",
    "█████ ",
    "    █ ",
    "    █ ",
  ]),
  "5": G([
    "█████ ",
    "█     ",
    "████  ",
    "    █ ",
    "████  ",
  ]),
  "6": G([
    " ████ ",
    "█     ",
    "████  ",
    "█   █ ",
    " ███  ",
  ]),
  "7": G([
    "█████ ",
    "    █ ",
    "   █  ",
    "  █   ",
    " █    ",
  ]),
  "8": G([
    " ███  ",
    "█   █ ",
    " ███  ",
    "█   █ ",
    " ███  ",
  ]),
  "9": G([
    " ███  ",
    "█   █ ",
    " ████ ",
    "    █ ",
    " ███  ",
  ]),
  " ": G(["", "", "", "", ""]),
  "-": G([
    "      ",
    "      ",
    " ███  ",
    "      ",
    "      ",
  ]),
  ".": G([
    "      ",
    "      ",
    "      ",
    "      ",
    " ██   ",
  ]),
  "!": G([
    "  █   ",
    "  █   ",
    "  █   ",
    "      ",
    "  █   ",
  ]),
  "?": G([
    " ███  ",
    "█   █ ",
    "  ██  ",
    "      ",
    "  █   ",
  ]),
  ":": G([
    "      ",
    "  █   ",
    "      ",
    "  █   ",
    "      ",
  ]),
};

const FALLBACK_GLYPH = G(["?????", "?   ?", "  ?? ", "     ", "  ?  "]);

/**
 * Render a string as a multi-line block-letter banner.
 *
 * Result is a single string with `\n` separators. Width is `text.length *
 * FIGLET_BLOCK_WIDTH`; every line is padded so columns align.
 */
export function figletBlock(text: string, opts: { spacing?: number } = {}): string {
  const spacing = Math.max(0, opts.spacing ?? 0);
  const upper = text.toUpperCase();
  const rows: string[] = ["", "", "", "", ""];
  for (let i = 0; i < upper.length; i++) {
    const ch = upper[i]!;
    const glyph = FIGLET_BLOCK[ch] ?? FALLBACK_GLYPH;
    for (let r = 0; r < FIGLET_BLOCK_HEIGHT; r++) {
      rows[r] = `${rows[r]!}${glyph[r] ?? ""}`;
      if (i < upper.length - 1 && spacing > 0) {
        rows[r] = `${rows[r]!}${" ".repeat(spacing)}`;
      }
    }
  }
  return rows.join("\n");
}
