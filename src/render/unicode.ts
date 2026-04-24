import { COMBINING_RANGES, WIDE_RANGES } from "./unicode-width.generated.js";

const SEGMENTER = typeof Intl !== "undefined" && typeof Intl.Segmenter === "function"
  ? new Intl.Segmenter(undefined, { granularity: "grapheme" })
  : null;
const ZERO_WIDTH_NON_JOINER = 0x200c;
const ZERO_WIDTH_JOINER = 0x200d;
const VARIATION_SELECTOR_16 = 0xfe0f;
const REGIONAL_INDICATOR_START = 0x1f1e6;
const REGIONAL_INDICATOR_END = 0x1f1ff;
const EMOJI_MODIFIER_START = 0x1f3fb;
const EMOJI_MODIFIER_END = 0x1f3ff;
const LANGUAGE_TAG = 0xe0001;
const TAG_START = 0xe0020;
const TAG_END = 0xe007f;

export interface Grapheme {
  text: string;
  start: number;
  end: number;
  width: number;
}

function inRanges(ranges: ReadonlyArray<readonly [number, number]>, codePoint: number): boolean {
  let lo = 0;
  let hi = ranges.length - 1;

  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const [start, end] = ranges[mid]!;
    if (codePoint < start) {
      hi = mid - 1;
      continue;
    }
    if (codePoint > end) {
      lo = mid + 1;
      continue;
    }
    return true;
  }

  return false;
}

function codePointLength(codePoint: number): number {
  return codePoint > 0xffff ? 2 : 1;
}

function isRegionalIndicator(codePoint: number): boolean {
  return codePoint >= REGIONAL_INDICATOR_START && codePoint <= REGIONAL_INDICATOR_END;
}

function isEmojiModifier(codePoint: number): boolean {
  return codePoint >= EMOJI_MODIFIER_START && codePoint <= EMOJI_MODIFIER_END;
}

function isTagCodePoint(codePoint: number): boolean {
  return codePoint === LANGUAGE_TAG || (codePoint >= TAG_START && codePoint <= TAG_END);
}

function isCombiningCodePoint(codePoint: number): boolean {
  return inRanges(COMBINING_RANGES, codePoint);
}

function isWideCodePoint(codePoint: number): boolean {
  return inRanges(WIDE_RANGES, codePoint);
}

function isZeroWidthCodePoint(codePoint: number): boolean {
  if (codePoint < 0x20) return true;
  if (codePoint >= 0x7f && codePoint < 0xa0) return true;
  if (codePoint === ZERO_WIDTH_NON_JOINER || codePoint === ZERO_WIDTH_JOINER) return true;
  if (isTagCodePoint(codePoint)) return true;
  return isCombiningCodePoint(codePoint);
}

function isGraphemeExtendCodePoint(codePoint: number): boolean {
  if (codePoint === ZERO_WIDTH_NON_JOINER) return true;
  if (isTagCodePoint(codePoint)) return true;
  if (isEmojiModifier(codePoint)) return true;
  return isCombiningCodePoint(codePoint);
}

function splitGraphemesFallback(value: string): Grapheme[] {
  const out: Grapheme[] = [];
  let index = 0;

  while (index < value.length) {
    const start = index;
    const first = value.codePointAt(index)!;
    index += codePointLength(first);

    if (isRegionalIndicator(first)) {
      const next = value.codePointAt(index);
      if (next !== undefined && isRegionalIndicator(next)) {
        index += codePointLength(next);
      }
    }

    while (index < value.length) {
      const next = value.codePointAt(index)!;
      if (!isGraphemeExtendCodePoint(next)) break;
      index += codePointLength(next);
    }

    while (index < value.length) {
      const next = value.codePointAt(index)!;
      if (next !== ZERO_WIDTH_JOINER) break;
      index += codePointLength(next);
      if (index >= value.length) break;

      const joined = value.codePointAt(index)!;
      index += codePointLength(joined);

      while (index < value.length) {
        const extend = value.codePointAt(index)!;
        if (!isGraphemeExtendCodePoint(extend)) break;
        index += codePointLength(extend);
      }
    }

    const text = value.slice(start, index);
    out.push({
      text,
      start,
      end: index,
      width: graphemeWidth(text),
    });
  }

  return out;
}

export function charWidth(codePoint: number): 0 | 1 | 2 {
  // Control characters render as zero-width here; callers should filter/replace.
  if (isZeroWidthCodePoint(codePoint)) return 0;
  if (isWideCodePoint(codePoint)) return 2;
  return 1;
}

export function graphemeWidth(value: string): number {
  let width = 0;
  let hasEmojiPresentationOverride = false;
  let regionalIndicators = 0;

  for (const ch of value) {
    const cp = ch.codePointAt(0);
    if (cp === undefined) continue;
    if (cp === VARIATION_SELECTOR_16 || cp === ZERO_WIDTH_JOINER) {
      hasEmojiPresentationOverride = true;
    }
    if (isRegionalIndicator(cp)) regionalIndicators += 1;
    width = Math.max(width, charWidth(cp));
  }

  if (hasEmojiPresentationOverride || regionalIndicators >= 2) {
    return Math.max(width, 2);
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

  return splitGraphemesFallback(value);
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

export function snapColumnToBoundary(value: string, column: number): number {
  const target = Math.max(0, column);
  let used = 0;

  for (const grapheme of splitGraphemes(value)) {
    const next = used + grapheme.width;
    if (target < next) return used;
    if (target === next) return next;
    used = next;
  }

  return used;
}
