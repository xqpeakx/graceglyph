import type { KeyEvent } from "../input/keys.js";
import {
  columnForIndex,
  indexForColumn,
  nextGraphemeEnd,
  previousGraphemeStart,
  sliceColumns,
  snapIndexToGraphemeBoundary,
} from "../render/unicode.js";

export type EditableMode = "single-line" | "multi-line";

export interface EditableState {
  cursor: number;
  scrollX: number;
  scrollY: number;
  preferredColumn: number | null;
}

interface LineInfo {
  start: number;
  end: number;
  text: string;
}

export interface EditableKeyResult {
  handled: boolean;
  nextValue: string;
}

export function createEditableState(value = ""): EditableState {
  return {
    cursor: value.length,
    scrollX: 0,
    scrollY: 0,
    preferredColumn: null,
  };
}

export function syncEditableState(state: EditableState, value: string): void {
  state.cursor = snapIndexToGraphemeBoundary(value, clamp(state.cursor, 0, value.length));
  state.scrollX = Math.max(0, state.scrollX);
  state.scrollY = Math.max(0, state.scrollY);
}

export function ensureEditableViewport(
  state: EditableState,
  value: string,
  width: number,
  height: number,
  mode: EditableMode,
): void {
  syncEditableState(state, value);

  if (mode === "single-line") {
    state.scrollX = clampScroll(state.scrollX, state.cursor, width);
    state.scrollY = 0;
    return;
  }

  const position = locateCursor(value, state.cursor);
  state.scrollX = clampScroll(state.scrollX, position.column, width);
  state.scrollY = clampScroll(state.scrollY, position.line, height);
}

export function getCursorOffset(
  state: EditableState,
  value: string,
  width: number,
  height: number,
  mode: EditableMode,
): { x: number; y: number } {
  ensureEditableViewport(state, value, width, height, mode);
  if (mode === "single-line") {
    return { x: Math.max(0, state.cursor - state.scrollX), y: 0 };
  }

  const position = locateCursor(value, state.cursor);
  return {
    x: Math.max(0, position.column - state.scrollX),
    y: Math.max(0, position.line - state.scrollY),
  };
}

export function getVisibleLines(
  state: EditableState,
  value: string,
  width: number,
  height: number,
  mode: EditableMode,
): string[] {
  ensureEditableViewport(state, value, width, height, mode);

  if (mode === "single-line") {
    return [sliceColumns(value, state.scrollX, width)];
  }

  const lines = getLines(value);
  const visible: string[] = [];
  for (let row = 0; row < height; row++) {
    const line = lines[state.scrollY + row]?.text ?? "";
    visible.push(sliceColumns(line, state.scrollX, width));
  }
  return visible;
}

export function moveCursorToPoint(
  state: EditableState,
  value: string,
  x: number,
  y: number,
  width: number,
  height: number,
  mode: EditableMode,
): void {
  syncEditableState(state, value);

  if (mode === "single-line") {
    state.cursor = indexForColumn(value, state.scrollX + Math.max(0, x));
    state.preferredColumn = null;
    ensureEditableViewport(state, value, width, height, mode);
    return;
  }

  const lines = getLines(value);
  const targetLine = clamp(state.scrollY + Math.max(0, y), 0, lines.length - 1);
  const targetColumn = Math.max(0, state.scrollX + x);
  state.cursor = indexForLineColumn(lines, targetLine, targetColumn);
  state.preferredColumn = null;
  ensureEditableViewport(state, value, width, height, mode);
}

export function applyEditableKey(
  state: EditableState,
  value: string,
  ev: KeyEvent,
  opts: {
    mode: EditableMode;
    width: number;
    height: number;
    onSubmit?: (value: string) => void;
  },
): EditableKeyResult {
  syncEditableState(state, value);
  let nextValue = value;
  let handled = true;

  switch (ev.name) {
    case "left":
      state.cursor = previousGraphemeStart(value, state.cursor);
      state.preferredColumn = null;
      break;
    case "right":
      state.cursor = nextGraphemeEnd(value, state.cursor);
      state.preferredColumn = null;
      break;
    case "home":
      if (opts.mode === "multi-line" && !ev.ctrl) {
        const position = locateCursor(value, state.cursor);
        state.cursor = position.info.start;
      } else {
        state.cursor = 0;
      }
      state.preferredColumn = null;
      break;
    case "end":
      if (opts.mode === "multi-line" && !ev.ctrl) {
        const position = locateCursor(value, state.cursor);
        state.cursor = position.info.end;
      } else {
        state.cursor = value.length;
      }
      state.preferredColumn = null;
      break;
    case "up":
      if (opts.mode === "single-line") break;
      moveCursorByLines(state, value, -1);
      break;
    case "down":
      if (opts.mode === "single-line") break;
      moveCursorByLines(state, value, 1);
      break;
    case "pageup":
      if (opts.mode === "single-line") break;
      moveCursorByLines(state, value, -Math.max(1, opts.height - 1));
      break;
    case "pagedown":
      if (opts.mode === "single-line") break;
      moveCursorByLines(state, value, Math.max(1, opts.height - 1));
      break;
    case "backspace":
      if (state.cursor > 0) {
        const start = previousGraphemeStart(value, state.cursor);
        nextValue = value.slice(0, start) + value.slice(state.cursor);
        state.cursor = start;
      }
      state.preferredColumn = null;
      break;
    case "delete":
      if (state.cursor < value.length) {
        const end = nextGraphemeEnd(value, state.cursor);
        nextValue = value.slice(0, state.cursor) + value.slice(end);
      }
      state.preferredColumn = null;
      break;
    case "enter":
      if (opts.mode === "single-line") {
        opts.onSubmit?.(value);
      } else {
        nextValue = insertAtCursor(value, state, "\n");
      }
      state.preferredColumn = null;
      break;
    case "space":
      nextValue = insertAtCursor(value, state, " ");
      state.preferredColumn = null;
      break;
    case "char":
      if (ev.ctrl || ev.alt || !ev.char || ev.char.length !== 1) {
        handled = false;
        break;
      }
      nextValue = insertAtCursor(value, state, ev.char);
      state.preferredColumn = null;
      break;
    default:
      handled = false;
      break;
  }

  if (handled) {
    ensureEditableViewport(state, nextValue, opts.width, opts.height, opts.mode);
  }

  return { handled, nextValue };
}

function moveCursorByLines(state: EditableState, value: string, delta: number): void {
  const position = locateCursor(value, state.cursor);
  const lines = position.lines;
  const targetLine = clamp(position.line + delta, 0, lines.length - 1);
  const goal = state.preferredColumn ?? position.column;
  state.cursor = indexForLineColumn(lines, targetLine, goal);
  state.preferredColumn = goal;
}

function insertAtCursor(value: string, state: EditableState, text: string): string {
  const next = value.slice(0, state.cursor) + text + value.slice(state.cursor);
  state.cursor += text.length;
  return next;
}

function locateCursor(value: string, cursor: number): {
  line: number;
  column: number;
  info: LineInfo;
  lines: LineInfo[];
} {
  const lines = getLines(value);
  const clamped = clamp(cursor, 0, value.length);

  for (let i = 0; i < lines.length; i++) {
    const info = lines[i]!;
    if (clamped <= info.end) {
      return {
        line: i,
        column: columnForIndex(info.text, clamped - info.start),
        info,
        lines,
      };
    }
  }

  const info = lines[lines.length - 1]!;
  return {
    line: lines.length - 1,
    column: columnForIndex(info.text, info.end - info.start),
    info,
    lines,
  };
}

function getLines(value: string): LineInfo[] {
  const lines: LineInfo[] = [];
  let start = 0;

  for (let i = 0; i <= value.length; i++) {
    if (i === value.length || value[i] === "\n") {
      lines.push({
        start,
        end: i,
        text: value.slice(start, i),
      });
      start = i + 1;
    }
  }

  return lines;
}

function indexForLineColumn(lines: LineInfo[], line: number, column: number): number {
  const info = lines[clamp(line, 0, lines.length - 1)]!;
  return info.start + indexForColumn(info.text, column);
}

function clampScroll(scroll: number, cursor: number, size: number): number {
  if (size <= 0) return 0;
  if (cursor < scroll) return cursor;
  if (cursor >= scroll + size) return cursor - size + 1;
  return scroll;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
