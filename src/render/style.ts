export type Color =
  | { kind: "default" }
  | { kind: "ansi"; code: number }
  | { kind: "rgb"; r: number; g: number; b: number };

export const DefaultColor: Color = { kind: "default" };

export function ansi(code: number): Color {
  return { kind: "ansi", code };
}

export function rgb(r: number, g: number, b: number): Color {
  return { kind: "rgb", r, g, b };
}

export interface Style {
  fg: Color;
  bg: Color;
  bold: boolean;
  dim: boolean;
  italic: boolean;
  underline: boolean;
  inverse: boolean;
}

export const DefaultStyle: Style = {
  fg: DefaultColor,
  bg: DefaultColor,
  bold: false,
  dim: false,
  italic: false,
  underline: false,
  inverse: false,
};

export function mergeStyle(base: Style, overrides: Partial<Style>): Style {
  return { ...base, ...overrides };
}

export function stylesEqual(a: Style, b: Style): boolean {
  return (
    colorsEqual(a.fg, b.fg) &&
    colorsEqual(a.bg, b.bg) &&
    a.bold === b.bold &&
    a.dim === b.dim &&
    a.italic === b.italic &&
    a.underline === b.underline &&
    a.inverse === b.inverse
  );
}

export function colorsEqual(a: Color, b: Color): boolean {
  if (a.kind !== b.kind) return false;
  if (a.kind === "default") return true;
  if (a.kind === "ansi" && b.kind === "ansi") return a.code === b.code;
  if (a.kind === "rgb" && b.kind === "rgb") {
    return a.r === b.r && a.g === b.g && a.b === b.b;
  }
  return false;
}
