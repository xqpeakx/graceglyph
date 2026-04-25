import { Rect } from "../layout/rect.js";
import { ScreenBuffer } from "../render/buffer.js";
import { DefaultStyle, Style, mergeStyle } from "../render/style.js";
import { clipColumns, stringWidth, truncateColumns } from "../render/unicode.js";
import {
  commitEditableState,
  createEditableState,
  ensureEditableViewport,
  getVisibleLines,
  type EditableState,
} from "./editable.js";
import type { BoxProps, Edges, HostType, TextProps, InputProps, TextAreaProps } from "./element.js";
import type { Fiber } from "./fiber.js";

export interface HostNode {
  type: HostType;
  /** Current props — copied from fiber on each commit. */
  props: Record<string, unknown>;
  children: HostNode[];
  parent: HostNode | null;
  layout: Rect;
  editableState: EditableState | null;
  /** Back-pointer so event dispatch can walk fiber ancestry. */
  fiber: Fiber;
}

export function createHostNode(fiber: Fiber): HostNode {
  return {
    type: fiber.type as HostType,
    props: fiber.props,
    children: [],
    parent: null,
    layout: Rect.empty(),
    editableState: fiber.type === "input" || fiber.type === "textarea"
      ? createEditableState(String(fiber.props.value ?? ""))
      : null,
    fiber,
  };
}

// -- Flex layout --------------------------------------------------------------

interface Edge { top: number; right: number; bottom: number; left: number; }

function edges(p: Edges | undefined): Edge {
  if (p == null) return { top: 0, right: 0, bottom: 0, left: 0 };
  if (typeof p === "number") return { top: p, right: p, bottom: p, left: p };
  if (p.length === 2) return { top: p[0], right: p[1], bottom: p[0], left: p[1] };
  return { top: p[0], right: p[1], bottom: p[2], left: p[3] };
}

/**
 * Measure a node's intrinsic size (what it wants when given unlimited space)
 * on a single axis. Used to size non-growing children before distributing
 * remaining space to growing ones.
 */
function measure(node: HostNode, axis: "main" | "cross", direction: "row" | "column"): number {
  const props = node.props as unknown as BoxProps & TextProps & InputProps & TextAreaProps;
  const mainIsWidth = direction === "row";

  if (node.type === "text") {
    const text = textOf(props.children);
    if (axis === "main") return mainIsWidth ? stringWidth(text) : 1;
    return mainIsWidth ? 1 : stringWidth(text);
  }
  if (node.type === "input") {
    if (axis === "main") {
      return mainIsWidth ? (props.width ?? 20) : 1;
    }
    return mainIsWidth ? 1 : (props.width ?? 20);
  }
  if (node.type === "textarea") {
    const width = props.width ?? 24;
    const height = props.height ?? 6;
    if (axis === "main") return mainIsWidth ? width : height;
    return mainIsWidth ? height : width;
  }

  // box — recursive
  const explicit = axis === "main"
    ? (mainIsWidth ? props.width : props.height)
    : (mainIsWidth ? props.height : props.width);
  if (explicit != null) return explicit;

  const pad = edges(props.padding);
  const borderPad = props.border ? 1 : 0;
  const innerExtra = (
    axis === "main"
      ? (mainIsWidth ? pad.left + pad.right : pad.top + pad.bottom)
      : (mainIsWidth ? pad.top + pad.bottom : pad.left + pad.right)
  ) + borderPad * 2;

  const childDir = (props.direction ?? "column") as "row" | "column";
  const gap = props.gap ?? 0;
  const flowChildren = node.children.filter((child) => !(child.props as BoxProps).overlay);
  const n = flowChildren.length;
  if (n === 0) return innerExtra;

  // If the parent's axis matches the children's main axis, sum; else max.
  const childAxis: "main" | "cross" =
    (axis === "main" && childDir === direction) ||
    (axis === "cross" && childDir !== direction)
      ? "main"
      : "cross";

  if (childAxis === "main") {
    let total = gap * (n - 1);
    for (const c of flowChildren) total += measure(c, "main", childDir);
    return innerExtra + total;
  } else {
    let maxV = 0;
    for (const c of flowChildren) maxV = Math.max(maxV, measure(c, "cross", childDir));
    return innerExtra + maxV;
  }
}

export function layoutTree(root: HostNode, container: Rect): void {
  layoutNode(root, container);
}

function layoutNode(node: HostNode, container: Rect): void {
  const props = node.props as unknown as BoxProps & TextProps & InputProps & TextAreaProps;

  if (node.type === "text") {
    const text = textOf(props.children);
    const w = Math.min(stringWidth(text), container.width);
    const h = Math.min(1, container.height);
    node.layout = new Rect(container.x, container.y, w, h);
    return;
  }
  if (node.type === "input") {
    const w = Math.min(props.width ?? container.width, container.width);
    node.layout = new Rect(container.x, container.y, w, Math.min(1, container.height));
    syncEditable(node, "single-line");
    return;
  }
  if (node.type === "textarea") {
    const w = Math.min(props.width ?? container.width, container.width);
    const h = Math.min(props.height ?? container.height, container.height);
    node.layout = new Rect(container.x, container.y, w, h);
    syncEditable(node, "multi-line");
    return;
  }

  // box
  const width = Math.min(props.width ?? container.width, container.width);
  const height = Math.min(props.height ?? container.height, container.height);
  node.layout = new Rect(container.x, container.y, width, height);

  const pad = edges(props.padding);
  const borderPad = props.border ? 1 : 0;
  const inner = node.layout.inset(
    pad.top + borderPad,
    pad.right + borderPad,
    pad.bottom + borderPad,
    pad.left + borderPad,
  );

  const direction: "row" | "column" = props.direction ?? "column";
  const gap = props.gap ?? 0;
  const align: BoxProps["align"] = props.align ?? "stretch";
  const justify: BoxProps["justify"] = props.justify ?? "start";
  const flowChildren = node.children.filter((child) => !(child.props as BoxProps).overlay);
  const overlayChildren = node.children.filter((child) => (child.props as BoxProps).overlay);
  const n = flowChildren.length;
  if (n === 0) {
    for (const child of overlayChildren) layoutNode(child, inner);
    return;
  }

  const mainIsWidth = direction === "row";
  const innerMain = mainIsWidth ? inner.width : inner.height;
  const innerCross = mainIsWidth ? inner.height : inner.width;

  // First pass — assign sizes on the main axis
  const sizes: number[] = new Array(n);
  let totalFixed = gap * Math.max(0, n - 1);
  let growSum = 0;
  for (let i = 0; i < n; i++) {
    const child = flowChildren[i]!;
    const cp = child.props as unknown as BoxProps;
    const grow = cp.grow ?? 0;
    if (grow > 0) {
      sizes[i] = 0;
      growSum += grow;
    } else {
      sizes[i] = Math.max(0, measure(child, "main", direction));
      totalFixed += sizes[i]!;
    }
  }
  const remaining = Math.max(0, innerMain - totalFixed);
  if (growSum > 0 && remaining > 0) {
    let used = 0;
    for (let i = 0; i < n; i++) {
      const cp = flowChildren[i]!.props as unknown as BoxProps;
      const grow = cp.grow ?? 0;
      if (grow > 0) {
        const take = i === n - 1 ? remaining - used : Math.floor((grow / growSum) * remaining);
        sizes[i] = take;
        used += take;
      }
    }
  }

  // Compute start offset on main axis for justify
  const totalMain = sizes.reduce((a, b) => a + b, 0) + gap * Math.max(0, n - 1);
  const free = Math.max(0, innerMain - totalMain);
  let offset = 0;
  let spacing = gap;
  if (growSum === 0) {
    if (justify === "center") offset = Math.floor(free / 2);
    else if (justify === "end") offset = free;
    else if (justify === "between" && n > 1) spacing = gap + Math.floor(free / (n - 1));
    else if (justify === "around" && n > 0) {
      const slot = Math.floor(free / n);
      offset = Math.floor(slot / 2);
      spacing = gap + slot;
    }
  }

  // Position children
  let pos = (mainIsWidth ? inner.x : inner.y) + offset;
  for (let i = 0; i < n; i++) {
    const child = flowChildren[i]!;
    const cp = child.props as unknown as BoxProps;
    const mainSize = sizes[i]!;
    const crossMeasure = measure(child, "cross", direction);
    let crossSize = align === "stretch" ? innerCross : Math.min(innerCross, crossMeasure);
    if (cp.height != null && mainIsWidth) crossSize = Math.min(cp.height, innerCross);
    if (cp.width != null && !mainIsWidth) crossSize = Math.min(cp.width, innerCross);

    const crossStart = mainIsWidth ? inner.y : inner.x;
    let crossOffset = 0;
    if (align === "center") crossOffset = Math.floor((innerCross - crossSize) / 2);
    else if (align === "end") crossOffset = innerCross - crossSize;

    const childRect = mainIsWidth
      ? new Rect(pos, crossStart + crossOffset, mainSize, crossSize)
      : new Rect(crossStart + crossOffset, pos, crossSize, mainSize);
    layoutNode(child, childRect.intersect(inner));
    pos += mainSize + spacing;
  }

  for (const child of overlayChildren) layoutNode(child, inner);
}

// -- Paint --------------------------------------------------------------------

export interface PaintContext {
  buffer: ScreenBuffer;
  focusedFiber: Fiber | null;
}

export function paintTree(root: HostNode, ctx: PaintContext): void {
  paintNode(root, ctx);
}

function paintNode(node: HostNode, ctx: PaintContext): void {
  const props = node.props as unknown as BoxProps & TextProps & InputProps & TextAreaProps;
  const { buffer } = ctx;
  const { layout } = node;
  if (layout.width === 0 || layout.height === 0) return;

  const focused = ctx.focusedFiber === node.fiber;
  const fillStyle = applyBoxStyle(applyBoxStyle(DefaultStyle, props.style), focused ? props.focusedStyle : undefined);

  if (node.type === "text") {
    // Paint background first if given so wide strings with short area align.
    if (props.style?.bg) buffer.fill(layout, " ", fillStyle);
    const text = textOf(props.children);
    const truncated = truncate(text, layout.width, props.wrap ?? "truncate");
    buffer.writeText(layout.x, layout.y, truncated, fillStyle, layout);
    return;
  }

  if (node.type === "input") {
    const base: Style = { ...fillStyle, bg: fillStyle.bg ?? DefaultStyle.bg };
    buffer.fill(layout, " ", base);
    const value = String(props.value ?? "");
    if (value.length === 0 && props.placeholder) {
      const phStyle = applyBoxStyle({ ...base, dim: true }, props.placeholderStyle);
      buffer.writeText(layout.x, layout.y, truncate(props.placeholder, layout.width, "truncate"), phStyle, layout);
    } else {
      const state = ensureEditableState(node, value);
      const visible = getVisibleLines(state, value, layout.width, layout.height, "single-line")[0] ?? "";
      buffer.writeText(layout.x, layout.y, visible, base, layout);
    }
    return;
  }

  if (node.type === "textarea") {
    const base: Style = { ...fillStyle, bg: fillStyle.bg ?? DefaultStyle.bg };
    buffer.fill(layout, " ", base);
    const value = String(props.value ?? "");
    if (value.length === 0 && props.placeholder) {
      const phStyle = applyBoxStyle({ ...base, dim: true }, props.placeholderStyle);
      const placeholderLines = props.placeholder.split("\n");
      for (let row = 0; row < Math.min(layout.height, placeholderLines.length); row++) {
        buffer.writeText(
          layout.x,
          layout.y + row,
          clipColumns(placeholderLines[row]!, layout.width),
          phStyle,
          layout,
        );
      }
    } else {
      const state = ensureEditableState(node, value);
      const visible = getVisibleLines(state, value, layout.width, layout.height, "multi-line");
      for (let row = 0; row < Math.min(layout.height, visible.length); row++) {
        buffer.writeText(layout.x, layout.y + row, visible[row]!, base, layout);
      }
    }
    return;
  }

  // box
  const frameStyle = applyBoxStyle(fillStyle, props.borderStyle);
  const titleStyle = applyBoxStyle(frameStyle, props.titleStyle);
  buffer.fill(layout, " ", fillStyle);
  if (props.border) drawBorder(buffer, layout, frameStyle, props.title, titleStyle, focused);
  for (const child of node.children) paintNode(child, ctx);
}

function drawBorder(
  buf: ScreenBuffer,
  area: Rect,
  style: Style,
  title: string | undefined,
  titleStyle: Style,
  focused: boolean,
): void {
  if (area.width < 2 || area.height < 2) return;
  const frameStyle: Style = focused ? { ...style, bold: true } : style;
  const x2 = area.right - 1;
  const y2 = area.bottom - 1;
  buf.set(area.x, area.y, { char: "┌", style: frameStyle, width: 1 });
  buf.set(x2, area.y, { char: "┐", style: frameStyle, width: 1 });
  buf.set(area.x, y2, { char: "└", style: frameStyle, width: 1 });
  buf.set(x2, y2, { char: "┘", style: frameStyle, width: 1 });
  for (let x = area.x + 1; x < x2; x++) {
    buf.set(x, area.y, { char: "─", style: frameStyle, width: 1 });
    buf.set(x, y2, { char: "─", style: frameStyle, width: 1 });
  }
  for (let y = area.y + 1; y < y2; y++) {
    buf.set(area.x, y, { char: "│", style: frameStyle, width: 1 });
    buf.set(x2, y, { char: "│", style: frameStyle, width: 1 });
  }
  if (title) {
    const text = ` ${title} `;
    const maxW = Math.max(0, area.width - 4);
    const shown = truncate(text, maxW, "truncate");
    const themedTitle = mergeStyle(titleStyle, { bold: true });
    buf.writeText(area.x + 2, area.y, shown, themedTitle, area);
  }
}

// -- Helpers ------------------------------------------------------------------

export function textOf(children: unknown): string {
  if (children == null || children === false || children === true) return "";
  if (typeof children === "string") return children;
  if (typeof children === "number") return String(children);
  if (Array.isArray(children)) return children.map(textOf).join("");
  return "";
}

function truncate(s: string, width: number, mode: "truncate" | "clip"): string {
  if (mode === "clip") return clipColumns(s, width);
  return truncateColumns(s, width);
}

function toStyle(s: TextProps["style"]): Style {
  return {
    fg: s?.fg ?? DefaultStyle.fg,
    bg: s?.bg ?? DefaultStyle.bg,
    bold: s?.bold ?? false,
    dim: s?.dim ?? false,
    italic: s?.italic ?? false,
    underline: s?.underline ?? false,
    inverse: s?.inverse ?? false,
  };
}

function applyBoxStyle(base: Style, patch: BoxProps["style"]): Style {
  if (!patch) return base;
  return mergeStyle(base, {
    fg: patch.fg ?? base.fg,
    bg: patch.bg ?? base.bg,
    bold: patch.bold ?? base.bold,
    dim: patch.dim ?? base.dim,
    italic: patch.italic ?? base.italic,
    underline: patch.underline ?? base.underline,
    inverse: patch.inverse ?? base.inverse,
  });
}

function ensureEditableState(node: HostNode, value: string): EditableState {
  if (!node.editableState) node.editableState = createEditableState(value);
  commitEditableState(node.editableState, value);
  return node.editableState;
}

function syncEditable(node: HostNode, mode: "single-line" | "multi-line"): void {
  const value = String(node.props.value ?? "");
  const state = ensureEditableState(node, value);
  ensureEditableViewport(state, value, node.layout.width, node.layout.height, mode);
}
