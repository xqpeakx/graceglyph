/**
 * Color parsing and capability-aware downgrade.
 *
 * The framework speaks truecolor internally. This module turns
 * user-supplied color values (hex strings, css names, rgb tuples) into the
 * `Color` shape from `style.ts`, and downgrades to the highest fidelity
 * the terminal supports.
 */

import { ansi, rgb, type Color, DefaultColor } from "./style.js";
import type { ColorDepth } from "./capabilities.js";

export type ColorInput =
  | Color
  | string
  | { r: number; g: number; b: number }
  | [number, number, number]
  | null
  | undefined;

const NAMED: Record<string, [number, number, number]> = {
  // Standard CSS / X11 names limited to the set TUI authors actually reach
  // for. Extend as needed.
  black: [0, 0, 0],
  white: [255, 255, 255],
  red: [205, 49, 49],
  green: [13, 188, 121],
  yellow: [229, 229, 16],
  blue: [36, 114, 200],
  magenta: [188, 63, 188],
  cyan: [17, 168, 205],
  gray: [128, 128, 128],
  grey: [128, 128, 128],
  silver: [192, 192, 192],
  maroon: [128, 0, 0],
  olive: [128, 128, 0],
  lime: [0, 255, 0],
  aqua: [0, 255, 255],
  teal: [0, 128, 128],
  navy: [0, 0, 128],
  fuchsia: [255, 0, 255],
  purple: [128, 0, 128],
  orange: [255, 165, 0],
  pink: [255, 192, 203],
};

const ANSI_BASIC_RGB: ReadonlyArray<readonly [number, number, number]> = [
  [0, 0, 0],
  [205, 49, 49],
  [13, 188, 121],
  [229, 229, 16],
  [36, 114, 200],
  [188, 63, 188],
  [17, 168, 205],
  [229, 229, 229],
  [102, 102, 102],
  [241, 76, 76],
  [35, 209, 139],
  [245, 245, 67],
  [59, 142, 234],
  [214, 112, 214],
  [41, 184, 219],
  [255, 255, 255],
];

const cache = new Map<string, Color>();

/**
 * Parse a `ColorInput` into a `Color`. Returns `DefaultColor` for null /
 * undefined. Throws on malformed strings — callers that want soft failure
 * should validate first.
 */
export function parseColor(input: ColorInput): Color {
  if (input == null) return DefaultColor;
  if (typeof input === "object" && !Array.isArray(input) && "kind" in input) {
    return input as Color;
  }
  if (Array.isArray(input)) {
    const [r, g, b] = input;
    return rgb(clamp8(r), clamp8(g), clamp8(b));
  }
  if (typeof input === "object") {
    return rgb(clamp8(input.r), clamp8(input.g), clamp8(input.b));
  }

  const cached = cache.get(input);
  if (cached) return cached;
  const parsed = parseColorString(input);
  cache.set(input, parsed);
  return parsed;
}

function parseColorString(value: string): Color {
  const v = value.trim().toLowerCase();
  if (v === "default" || v === "transparent" || v === "none") return DefaultColor;

  if (v in NAMED) {
    const [r, g, b] = NAMED[v]!;
    return rgb(r, g, b);
  }

  if (v.startsWith("#")) return parseHex(v.slice(1));
  if (v.startsWith("0x")) return parseHex(v.slice(2));

  const rgbMatch = v.match(/^rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)$/);
  if (rgbMatch) {
    return rgb(clamp8(+rgbMatch[1]!), clamp8(+rgbMatch[2]!), clamp8(+rgbMatch[3]!));
  }

  const hslMatch = v.match(
    /^hsl\(\s*(-?\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)%?\s*,\s*(\d+(?:\.\d+)?)%?\s*\)$/,
  );
  if (hslMatch) {
    const [r, g, b] = hslToRgb(+hslMatch[1]!, +hslMatch[2]! / 100, +hslMatch[3]! / 100);
    return rgb(r, g, b);
  }

  // 256-color index, e.g. "ansi(208)" or "ansi:208"
  const ansiMatch = v.match(/^ansi[:(](\d+)\)?$/);
  if (ansiMatch) {
    const code = Number(ansiMatch[1]);
    if (code >= 0 && code <= 255) return ansi(code);
  }

  throw new Error(`graceglyph: cannot parse color "${value}"`);
}

function parseHex(hex: string): Color {
  if (hex.length === 3) {
    const r = parseInt(hex[0]! + hex[0], 16);
    const g = parseInt(hex[1]! + hex[1], 16);
    const b = parseInt(hex[2]! + hex[2], 16);
    return rgb(r, g, b);
  }
  if (hex.length === 6) {
    return rgb(
      parseInt(hex.slice(0, 2), 16),
      parseInt(hex.slice(2, 4), 16),
      parseInt(hex.slice(4, 6), 16),
    );
  }
  if (hex.length === 8) {
    // Drop alpha — terminals can't blend. Document this.
    return rgb(
      parseInt(hex.slice(0, 2), 16),
      parseInt(hex.slice(2, 4), 16),
      parseInt(hex.slice(4, 6), 16),
    );
  }
  throw new Error(`graceglyph: invalid hex color "${hex}"`);
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const hh = ((h % 360) + 360) % 360;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((hh / 60) % 2) - 1));
  const m = l - c / 2;
  let r1 = 0;
  let g1 = 0;
  let b1 = 0;
  if (hh < 60) [r1, g1, b1] = [c, x, 0];
  else if (hh < 120) [r1, g1, b1] = [x, c, 0];
  else if (hh < 180) [r1, g1, b1] = [0, c, x];
  else if (hh < 240) [r1, g1, b1] = [0, x, c];
  else if (hh < 300) [r1, g1, b1] = [x, 0, c];
  else [r1, g1, b1] = [c, 0, x];
  return [
    clamp8(Math.round((r1 + m) * 255)),
    clamp8(Math.round((g1 + m) * 255)),
    clamp8(Math.round((b1 + m) * 255)),
  ];
}

function clamp8(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(255, Math.round(n)));
}

/**
 * Downgrade a color to the highest fidelity the terminal supports.
 */
export function downgrade(color: Color, depth: ColorDepth): Color {
  if (color.kind === "default") return color;
  if (depth === "monochrome") return DefaultColor;
  if (color.kind === "ansi") {
    if (depth === "ansi16") return ansi(color.code & 0x0f);
    return color;
  }
  // RGB
  if (depth === "truecolor") return color;
  if (depth === "ansi256") return ansi(rgbToAnsi256(color.r, color.g, color.b));
  return ansi(rgbToAnsi16(color.r, color.g, color.b));
}

/**
 * Map an RGB triple to the closest xterm 256-color palette index.
 *
 * Uses the standard xterm cube + grayscale ramp formulation, not nearest-
 * neighbor in the full palette. That keeps the result stable across calls
 * and matches what other libraries produce.
 */
export function rgbToAnsi256(r: number, g: number, b: number): number {
  if (r === g && g === b) {
    if (r < 8) return 16;
    if (r > 248) return 231;
    return Math.round(((r - 8) / 247) * 24) + 232;
  }
  return (
    16 + 36 * Math.round((r / 255) * 5) + 6 * Math.round((g / 255) * 5) + Math.round((b / 255) * 5)
  );
}

/**
 * Map an RGB triple to the closest of the 16 ANSI base colors.
 */
export function rgbToAnsi16(r: number, g: number, b: number): number {
  let bestIndex = 0;
  let bestDist = Number.POSITIVE_INFINITY;
  for (let i = 0; i < ANSI_BASIC_RGB.length; i++) {
    const [ar, ag, ab] = ANSI_BASIC_RGB[i]!;
    const d = (ar - r) ** 2 + (ag - g) ** 2 + (ab - b) ** 2;
    if (d < bestDist) {
      bestDist = d;
      bestIndex = i;
    }
  }
  return bestIndex;
}

/**
 * Visible-for-tests cache reset.
 */
export function _resetColorCache(): void {
  cache.clear();
}
