import type { KeyEvent, MouseEvent } from "../input/keys.js";
import type { Color } from "../render/style.js";

export const Fragment = Symbol.for("zenterm.fragment");
export type FragmentType = typeof Fragment;

export type ComponentFn<P = Record<string, unknown>> = (
  props: P & { children?: unknown },
) => ZenNode;

export type ElementType = HostType | FragmentType | ComponentFn<any>;

export type HostType = "box" | "text" | "input";

export interface ZenElement<P = Record<string, unknown>> {
  $$type: "element";
  type: ElementType;
  props: P & { children?: unknown };
  key: string | number | null;
}

export type ZenNode =
  | ZenElement
  | ZenElement[]
  | string
  | number
  | boolean
  | null
  | undefined
  | Array<ZenNode>;

export function isElement(value: unknown): value is ZenElement {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as { $$type?: unknown }).$$type === "element"
  );
}

/**
 * JSX factory. Compiled `<Foo x={1}>text</Foo>` becomes
 * `h(Foo, { x: 1 }, "text")`.
 */
export function h(
  type: ElementType,
  props?: Record<string, any> | null,
  ...children: unknown[]
): ZenElement {
  const { key, ...rest } = (props ?? {}) as Record<string, any>;
  const merged: Record<string, unknown> = rest;
  if (children.length === 1) merged.children = children[0];
  else if (children.length > 1) merged.children = children;
  return {
    $$type: "element",
    type,
    props: merged as { children?: unknown },
    key: (key as string | number | null | undefined) ?? null,
  };
}

/** Flatten any ZenNode-ish value into a dense array of elements-or-text. */
export function normalizeChildren(input: unknown): Array<ZenElement | string> {
  const out: Array<ZenElement | string> = [];
  visit(input, out);
  return out;
}

function visit(node: unknown, out: Array<ZenElement | string>): void {
  if (node == null || node === false || node === true) return;
  if (Array.isArray(node)) {
    for (const n of node) visit(n, out);
    return;
  }
  if (typeof node === "string") {
    if (node.length > 0) out.push(node);
    return;
  }
  if (typeof node === "number") {
    out.push(String(node));
    return;
  }
  if (isElement(node)) {
    out.push(node);
    return;
  }
  // Silently drop unknown; callers should not produce these.
}

// -- Shared prop shapes -------------------------------------------------------

export type Edges = number | [number, number] | [number, number, number, number];

export interface BoxStyle {
  fg?: Color;
  bg?: Color;
  bold?: boolean;
  dim?: boolean;
  italic?: boolean;
  underline?: boolean;
  inverse?: boolean;
}

export type FlexDirection = "row" | "column";
export type FlexAlign = "start" | "center" | "end" | "stretch";
export type FlexJustify = "start" | "center" | "end" | "between" | "around";

export interface BoxProps {
  /** Layout direction for children. Default: "column". */
  direction?: FlexDirection;
  /** Space between children on the main axis. */
  gap?: number;
  /** Inner padding — number (all sides) or [v,h] or [t,r,b,l]. */
  padding?: Edges;
  /** Cross-axis alignment for children. */
  align?: FlexAlign;
  /** Main-axis distribution for children. */
  justify?: FlexJustify;
  /** Fixed main-axis size (cells). */
  width?: number;
  /** Fixed cross-axis size (cells). */
  height?: number;
  /** Flex grow factor. Default 0. */
  grow?: number;
  /** Draw a single-line border around the box. */
  border?: boolean;
  /** Title rendered into the top border (border must be true). */
  title?: string;
  /** Background + foreground style for the box chrome. */
  style?: BoxStyle;
  /** Make the box keyboard-focusable (Tab reaches it). */
  focusable?: boolean;
  /** Fires when box has focus and a key is pressed. Return true to stop bubble. */
  onKey?: (ev: KeyEvent) => boolean | void;
  /** Fires on any mouse event inside the box. */
  onMouse?: (ev: MouseEvent) => boolean | void;
  /** Convenience: Enter or Space while focused, or a left-click. */
  onClick?: () => void;
  onFocus?: () => void;
  onBlur?: () => void;
  children?: unknown;
}

export interface TextProps {
  /** Text color / weight. */
  style?: BoxStyle;
  /** Wrap mode: truncate (default) or clip. */
  wrap?: "truncate" | "clip";
  children?: unknown;
}

export interface InputProps {
  value: string;
  placeholder?: string;
  onChange: (value: string) => void;
  onSubmit?: (value: string) => void;
  width?: number;
  style?: BoxStyle;
}
