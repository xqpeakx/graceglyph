import { DefaultStyle, Style, stylesEqual } from "./style.js";

export interface Cell {
  char: string;
  style: Style;
  /** 1 for narrow, 2 for wide (CJK/emoji). 0 marks the trailing half of a wide cell. */
  width: 0 | 1 | 2;
  /** Optional OSC 8 hyperlink URL for this cell. */
  hyperlink?: string;
  /** Optional raw ANSI payload emitted before this cell's char. */
  ansiPrefix?: string;
}

export function blankCell(): Cell {
  return { char: " ", style: DefaultStyle, width: 1 };
}

export function cellsEqual(a: Cell, b: Cell): boolean {
  return (
    a.char === b.char &&
    a.width === b.width &&
    a.hyperlink === b.hyperlink &&
    a.ansiPrefix === b.ansiPrefix &&
    stylesEqual(a.style, b.style)
  );
}
