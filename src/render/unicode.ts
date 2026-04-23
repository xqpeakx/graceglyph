// East Asian Wide ranges — conservative subset sufficient for common CJK + emoji.
// Full-fidelity width (UAX #11) is a follow-up; this handles the 95% case.
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

export function charWidth(codePoint: number): 0 | 1 | 2 {
  // Control characters render as zero-width here; callers should filter/replace.
  if (codePoint < 0x20) return 0;
  if (codePoint === 0x7f) return 0;
  for (const [lo, hi] of WIDE_RANGES) {
    if (codePoint < lo) return 1;
    if (codePoint <= hi) return 2;
  }
  return 1;
}

export function stringWidth(s: string): number {
  let w = 0;
  for (const ch of s) {
    const cp = ch.codePointAt(0);
    if (cp === undefined) continue;
    w += charWidth(cp);
  }
  return w;
}
