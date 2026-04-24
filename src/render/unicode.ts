// East Asian Wide ranges — conservative subset sufficient for common CJK + emoji.
// Full-fidelity width (UAX #11) is still a follow-up, but grapheme-aware
// measurement keeps cursoring and clipping coherent for combined emoji and marks.
const WIDE_RANGES: ReadonlyArray<readonly [number, number]> = [
  [0x1100, 0x115f],
  [0x2e80, 0x303e],
  [0x3041, 0x33ff],
  [0x3400, 0x4dbf],
  [0x4e00, 0x9fff],
  [0xa000, 0xa4cf],
  [0xac00, 0xd7a3],
  [0xf900, 0xfaff],
  [0xfe30, 0xfe4f],
  [0xff00, 0xff60],
  [0xffe0, 0xffe6],
  [0x1f300, 0x1f64f],
  [0x1f900, 0x1f9ff],
  [0x20000, 0x2fffd],
  [0x30000, 0x3fffd],
];

const MARK_REGEX = /\p{Mark}/u;
const SEGMENTER = typeof Intl !== "undefined" && typeof Intl.Segmenter === "function"
  ? new Intl.Segmenter(undefined, { granularity: "grapheme" })
  : null;

export interface Grapheme {
  text: string;
  start: number;
  end: number;
  width: number;
}

export function charWidth(codePoint: number): 0 | 1 | 2 {
  // Control characters render as zero-width here; callers should filter/replace.
  if (codePoint < 0x20) return 0;
  if (codePoint === 0x7f) return 0;
  if (codePoint === 0x200c || codePoint === 0x200d) return 0;
  if ((codePoint >= 0xfe00 && codePoint <= 0xfe0f) || (codePoint >= 0xe0100 && codePoint <= 0xe01ef)) {
    return 0;
  }
  if (MARK_REGEX.test(String.fromCodePoint(codePoint))) return 0;
  for (const [lo, hi] of WIDE_RANGES) {
    if (codePoint < lo) return 1;
    if (codePoint <= hi) return 2;
  }
  return 1;
}

export function graphemeWidth(value: string): number {
  let width = 0;
  for (const ch of value) {
    const cp = ch.codePointAt(0);
    if (cp === undefined) continue;
    width = Math.max(width, charWidth(cp));
  }
  return width;
}

export function splitGraphemes(value: string): Grapheme[] {
  if (value.length === 0) return [];

  if (SEGMENTER) {
    return Array.from(SEGMENTER.segment(value), ({ segment, index }) => ({
      text: segment,
      start: index,
      end: index + segment.length,
      width: graphemeWidth(segment),
    }));
  }

  const out: Grapheme[] = [];
  let index = 0;
  for (const ch of value) {
    out.push({
      text: ch,
      start: index,
      end: index + ch.length,
      width: graphemeWidth(ch),
    });
    index += ch.length;
  }
  return out;
}

export function stringWidth(value: string): number {
  let width = 0;
  for (const grapheme of splitGraphemes(value)) width += grapheme.width;
  return width;
}

export function clipColumns(value: string, width: number): string {
  return sliceColumns(value, 0, width);
}

export function truncateColumns(value: string, width: number): string {
  if (width <= 0) return "";
  if (stringWidth(value) <= width) return value;
  if (width === 1) return "…";

  const ellipsis = "…";
  const available = width - stringWidth(ellipsis);
  return clipColumns(value, available) + ellipsis;
}

export function sliceColumns(value: string, start: number, width: number): string {
  if (width <= 0) return "";
  const targetStart = Math.max(0, start);
  let offset = 0;
  let remaining = width;
  let out = "";

  for (const grapheme of splitGraphemes(value)) {
    const next = offset + grapheme.width;
    if (next <= targetStart) {
      offset = next;
      continue;
    }
    if (offset < targetStart) {
      offset = next;
      continue;
    }
    if (grapheme.width > remaining) break;
    out += grapheme.text;
    remaining -= grapheme.width;
    offset = next;
    if (remaining === 0) break;
  }

  return out;
}

export function snapIndexToGraphemeBoundary(value: string, index: number): number {
  const clamped = Math.min(value.length, Math.max(0, index));
  if (clamped === 0 || clamped === value.length) return clamped;

  for (const grapheme of splitGraphemes(value)) {
    if (clamped === grapheme.start || clamped === grapheme.end) return clamped;
    if (clamped < grapheme.end) return grapheme.start;
  }

  return value.length;
}

export function previousGraphemeStart(value: string, index: number): number {
  const target = snapIndexToGraphemeBoundary(value, index);
  if (target === 0) return 0;

  for (const grapheme of splitGraphemes(value)) {
    if (target <= grapheme.end) return grapheme.start;
  }

  return 0;
}

export function nextGraphemeEnd(value: string, index: number): number {
  const target = snapIndexToGraphemeBoundary(value, index);
  for (const grapheme of splitGraphemes(value)) {
    if (target < grapheme.end) return grapheme.end;
  }
  return value.length;
}

export function columnForIndex(value: string, index: number): number {
  const target = snapIndexToGraphemeBoundary(value, index);
  let width = 0;
  for (const grapheme of splitGraphemes(value)) {
    if (grapheme.end > target) break;
    width += grapheme.width;
  }
  return width;
}

export function indexForColumn(value: string, column: number): number {
  const target = Math.max(0, column);
  let used = 0;

  for (const grapheme of splitGraphemes(value)) {
    const next = used + grapheme.width;
    if (target < next) {
      if (grapheme.width <= 1) return grapheme.start;
      return target - used < grapheme.width / 2 ? grapheme.start : grapheme.end;
    }
    if (target === next) return grapheme.end;
    used = next;
  }

  return value.length;
}
