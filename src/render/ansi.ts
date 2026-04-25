import { Color, Style } from "./style.js";

const ESC = "\x1b";
export const CSI = `${ESC}[`;
const OSC = `${ESC}]`;
const ST = `${ESC}\\`;

export const AnsiSeq = {
  clearScreen: `${CSI}2J`,
  hideCursor: `${CSI}?25l`,
  showCursor: `${CSI}?25h`,
  enterAltScreen: `${CSI}?1049h`,
  exitAltScreen: `${CSI}?1049l`,
  enableMouse: `${CSI}?1000h${CSI}?1002h${CSI}?1003h${CSI}?1006h`,
  disableMouse: `${CSI}?1006l${CSI}?1003l${CSI}?1002l${CSI}?1000l`,
  enableBracketedPaste: `${CSI}?2004h`,
  disableBracketedPaste: `${CSI}?2004l`,
  enableFocusReporting: `${CSI}?1004h`,
  disableFocusReporting: `${CSI}?1004l`,
  beginSynchronized: `${CSI}?2026h`,
  endSynchronized: `${CSI}?2026l`,
  reset: `${CSI}0m`,
} as const;

/**
 * Emit an OSC 8 hyperlink wrapper around `text`. Caller is responsible for
 * checking `caps.hyperlinks` before using.
 */
export function hyperlink(url: string, text: string, id?: string): string {
  const params = id ? `id=${id}` : "";
  return `${OSC}8;${params};${url}${ST}${text}${OSC}8;;${ST}`;
}

export function cursorTo(x: number, y: number): string {
  // ANSI uses 1-based coordinates; we convert from our 0-based model.
  return `${CSI}${y + 1};${x + 1}H`;
}

export function colorSgr(color: Color, layer: "fg" | "bg"): string {
  if (color.kind === "default") return layer === "fg" ? "39" : "49";
  if (color.kind === "ansi") {
    const base = layer === "fg" ? 30 : 40;
    if (color.code < 8) return String(base + color.code);
    if (color.code < 16) return String(base + 60 + (color.code - 8));
    return `${layer === "fg" ? "38" : "48"};5;${color.code}`;
  }
  return `${layer === "fg" ? "38" : "48"};2;${color.r};${color.g};${color.b}`;
}

export function styleSgr(style: Style): string {
  const parts: string[] = ["0"];
  if (style.bold) parts.push("1");
  if (style.dim) parts.push("2");
  if (style.italic) parts.push("3");
  if (style.underline) parts.push("4");
  if (style.inverse) parts.push("7");
  parts.push(colorSgr(style.fg, "fg"));
  parts.push(colorSgr(style.bg, "bg"));
  return `${CSI}${parts.join(";")}m`;
}
