import { Rect } from "../layout/rect.js";
import { ScreenBuffer } from "../render/buffer.js";
import { DefaultStyle, Style, mergeStyle } from "../render/style.js";
import { clipColumns, splitGraphemes, stringWidth, truncateColumns } from "../render/unicode.js";
import type { StyleResolveContext } from "../style/index.js";
import type { Theme } from "../theme/theme.js";
import { matchingBreakpointValues } from "../theme/breakpoints.js";
import {
  commitEditableState,
  createEditableState,
  ensureEditableViewport,
  getVisibleLines,
  type EditableState,
} from "./editable.js";
import type {
  BoxProps,
  BoxLayoutProps,
  BoxStyle,
  Edges,
  GridLine,
  GridTrackList,
  GridTrackSize,
  HostType,
  InputProps,
  TextProps,
  TextAreaProps,
} from "./element.js";
import type { Fiber } from "./fiber.js";

export interface HostNode {
  type: HostType;
  /** Current props — copied from fiber on each commit. */
  props: Record<string, unknown>;
  /** Props after layout breakpoint patches have been applied for the latest pass. */
  resolvedProps: Record<string, unknown>;
  children: HostNode[];
  parent: HostNode | null;
  layout: Rect;
  hidden: boolean;
  editableState: EditableState | null;
  /** Back-pointer so event dispatch can walk fiber ancestry. */
  fiber: Fiber;
}

export function createHostNode(fiber: Fiber): HostNode {
  return {
    type: fiber.type as HostType,
    props: fiber.props,
    resolvedProps: fiber.props,
    children: [],
    parent: null,
    layout: Rect.empty(),
    hidden: false,
    editableState:
      fiber.type === "input" || fiber.type === "textarea"
        ? createEditableState(String(fiber.props.value ?? ""))
        : null,
    fiber,
  };
}

const RENDERABLE_HOST_TYPES = new Set<HostType>(["box", "text", "input", "textarea"]);

export function isRenderableHostType(type: unknown): type is HostType {
  return typeof type === "string" && RENDERABLE_HOST_TYPES.has(type as HostType);
}

function isHostFiber(fiber: Fiber): boolean {
  return isRenderableHostType(fiber.type);
}

/**
 * Build a HostNode tree by walking the fiber tree. Function-component and
 * Fragment fibers are transparent — their children get attached to the
 * nearest host ancestor.
 */
export function buildHostTree(rootFiber: Fiber): HostNode | null {
  const rootSlot: { node: HostNode | null } = { node: null };
  attachHosts(rootFiber, null, rootSlot);
  return rootSlot.node;
}

function attachHosts(
  fiber: Fiber,
  parentHost: HostNode | null,
  rootSlot: { node: HostNode | null },
): void {
  if (isHostFiber(fiber)) {
    let node = fiber.hostNode;
    if (!node) {
      node = createHostNode(fiber);
      fiber.hostNode = node;
    } else {
      node.props = fiber.props;
      node.fiber = fiber;
    }
    node.children = [];
    node.parent = parentHost;
    if (parentHost) parentHost.children.push(node);
    else if (!rootSlot.node) rootSlot.node = node;
    for (const child of fiber.children) attachHosts(child, node, rootSlot);
  } else {
    for (const child of fiber.children) attachHosts(child, parentHost, rootSlot);
  }
}

// -- Flex layout --------------------------------------------------------------

interface Edge {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

type Axis = "width" | "height";

type TrackSpec =
  | { kind: "fixed"; value: number }
  | { kind: "auto" }
  | { kind: "fr"; value: number }
  | { kind: "minmax"; min: TrackSpec; max: TrackSpec };

interface GridPlacement {
  child: HostNode;
  column: number;
  row: number;
  columnSpan: number;
  rowSpan: number;
}

type ResolvedBoxProps = Omit<BoxProps, keyof BoxLayoutProps | "breakpoints"> & BoxLayoutProps;

const LAYOUT_PROP_KEYS = [
  "display",
  "layout",
  "direction",
  "gap",
  "padding",
  "align",
  "justify",
  "width",
  "height",
  "minWidth",
  "maxWidth",
  "minHeight",
  "maxHeight",
  "aspectRatio",
  "grow",
  "border",
  "overlay",
  "position",
  "top",
  "right",
  "bottom",
  "left",
  "zIndex",
  "gridColumns",
  "gridRows",
  "gridAutoColumns",
  "gridAutoRows",
  "gridColumn",
  "gridRow",
  "gridColumnSpan",
  "gridRowSpan",
  "dock",
] as const satisfies readonly (keyof BoxLayoutProps)[];

function edges(p: Edges | undefined): Edge {
  if (p == null) return { top: 0, right: 0, bottom: 0, left: 0 };
  if (typeof p === "number") return { top: p, right: p, bottom: p, left: p };
  if (p.length === 2) return { top: p[0], right: p[1], bottom: p[0], left: p[1] };
  return { top: p[0], right: p[1], bottom: p[2], left: p[3] };
}

function resolveBoxProps(node: HostNode, width: number): ResolvedBoxProps {
  const raw = node.props as unknown as BoxProps;
  const patches = matchingBreakpointValues(
    raw.breakpoints,
    width,
    node.fiber.environment?.theme.tokens,
  );
  if (patches.length === 0) return raw as ResolvedBoxProps;

  const next = { ...raw } as Record<string, unknown>;
  for (const patch of patches) {
    for (const key of LAYOUT_PROP_KEYS) {
      if (key in patch) next[key] = patch[key];
    }
  }
  return next as ResolvedBoxProps;
}

function propsForLayout(
  node: HostNode,
  width: number,
): BoxProps & TextProps & InputProps & TextAreaProps {
  if (node.type === "box") {
    return resolveBoxProps(node, width) as BoxProps & TextProps & InputProps & TextAreaProps;
  }
  return node.props as unknown as BoxProps & TextProps & InputProps & TextAreaProps;
}

/**
 * Measure a node's intrinsic size (what it wants when given unlimited space)
 * on a single axis. Used to size non-growing children before distributing
 * remaining space to growing ones.
 */
function measure(
  node: HostNode,
  axis: "main" | "cross",
  direction: "row" | "column",
  contextWidth = 0,
): number {
  const props = propsForLayout(node, contextWidth);
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
  const explicit =
    axis === "main"
      ? mainIsWidth
        ? props.width
        : props.height
      : mainIsWidth
        ? props.height
        : props.width;
  if (explicit != null) return constrainAxis(explicit, props, mainIsWidth ? "width" : "height");
  if (props.aspectRatio != null && Number.isFinite(props.aspectRatio) && props.aspectRatio > 0) {
    if (axis === "main" && mainIsWidth && props.height != null) {
      return constrainAxis(Math.round(props.height * props.aspectRatio), props, "width");
    }
    if (axis === "main" && !mainIsWidth && props.width != null) {
      return constrainAxis(Math.round(props.width / props.aspectRatio), props, "height");
    }
    if (axis === "cross" && mainIsWidth && props.width != null) {
      return constrainAxis(Math.round(props.width / props.aspectRatio), props, "height");
    }
    if (axis === "cross" && !mainIsWidth && props.height != null) {
      return constrainAxis(Math.round(props.height * props.aspectRatio), props, "width");
    }
  }

  const pad = edges(props.padding);
  const borderPad = props.border ? 1 : 0;
  const innerExtra =
    (axis === "main"
      ? mainIsWidth
        ? pad.left + pad.right
        : pad.top + pad.bottom
      : mainIsWidth
        ? pad.top + pad.bottom
        : pad.left + pad.right) +
    borderPad * 2;

  const childDir = (props.direction ?? "column") as "row" | "column";
  const gap = props.gap ?? 0;
  const flowChildren = node.children.filter(
    (child) => !isDisplayNone(child, contextWidth) && !isOutOfFlow(child, contextWidth),
  );
  const n = flowChildren.length;
  if (n === 0) return innerExtra;

  // If the parent's axis matches the children's main axis, sum; else max.
  const childAxis: "main" | "cross" =
    (axis === "main" && childDir === direction) || (axis === "cross" && childDir !== direction)
      ? "main"
      : "cross";

  if (childAxis === "main") {
    let total = gap * (n - 1);
    for (const c of flowChildren) total += measure(c, "main", childDir, contextWidth);
    return innerExtra + total;
  } else {
    let maxV = 0;
    for (const c of flowChildren)
      maxV = Math.max(maxV, measure(c, "cross", childDir, contextWidth));
    return innerExtra + maxV;
  }
}

export function layoutTree(root: HostNode, container: Rect): void {
  layoutNode(root, container);
}

function hideSubtree(node: HostNode): void {
  node.hidden = true;
  node.layout = Rect.empty();
  for (const child of node.children) hideSubtree(child);
}

function layoutNode(node: HostNode, container: Rect, contextWidth = container.width): void {
  const props = propsForLayout(node, contextWidth);
  node.resolvedProps = props as unknown as Record<string, unknown>;

  if (node.type === "text") {
    node.hidden = false;
    const text = textOf(props.children);
    const w = Math.min(stringWidth(text), container.width);
    const h = Math.min(1, container.height);
    node.layout = new Rect(container.x, container.y, w, h);
    return;
  }
  if (node.type === "input") {
    node.hidden = false;
    const w = Math.min(props.width ?? container.width, container.width);
    node.layout = new Rect(container.x, container.y, w, Math.min(1, container.height));
    syncEditable(node, "single-line");
    return;
  }
  if (node.type === "textarea") {
    node.hidden = false;
    const w = Math.min(props.width ?? container.width, container.width);
    const h = Math.min(props.height ?? container.height, container.height);
    node.layout = new Rect(container.x, container.y, w, h);
    syncEditable(node, "multi-line");
    return;
  }

  // box
  if (props.display === "none") {
    hideSubtree(node);
    return;
  }
  node.hidden = false;
  const constrained = resolveBoxSize(props, container);
  const width = constrained.width;
  const height = constrained.height;
  node.layout = new Rect(container.x, container.y, width, height);

  const pad = edges(props.padding);
  const borderPad = props.border ? 1 : 0;
  const inner = node.layout.inset(
    pad.top + borderPad,
    pad.right + borderPad,
    pad.bottom + borderPad,
    pad.left + borderPad,
  );

  const layoutMode = props.layout ?? "flex";
  const gap = props.gap ?? 0;
  for (const child of node.children) {
    if (isDisplayNone(child, inner.width)) hideSubtree(child);
    else child.hidden = false;
  }
  const flowChildren = node.children.filter(
    (child) => !child.hidden && !isOutOfFlow(child, inner.width),
  );
  const overlayChildren = node.children.filter(
    (child) => !child.hidden && isOutOfFlow(child, inner.width),
  );

  if (layoutMode === "grid") {
    layoutGridChildren(node, inner, flowChildren, gap);
    layoutOverlayChildren(overlayChildren, inner);
    return;
  }

  if (layoutMode === "dock") {
    layoutDockChildren(inner, flowChildren);
    layoutOverlayChildren(overlayChildren, inner);
    return;
  }

  const direction: "row" | "column" = props.direction ?? "column";
  const align: BoxProps["align"] = props.align ?? "stretch";
  const justify: BoxProps["justify"] = props.justify ?? "start";
  const n = flowChildren.length;
  if (n === 0) {
    layoutOverlayChildren(overlayChildren, inner);
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
    const cp = propsForLayout(child, inner.width);
    const grow = cp.grow ?? 0;
    if (grow > 0) {
      sizes[i] = 0;
      growSum += grow;
    } else {
      sizes[i] = Math.max(0, measure(child, "main", direction, inner.width));
      totalFixed += sizes[i]!;
    }
  }
  const remaining = Math.max(0, innerMain - totalFixed);
  if (growSum > 0 && remaining > 0) {
    let used = 0;
    for (let i = 0; i < n; i++) {
      const cp = propsForLayout(flowChildren[i]!, inner.width);
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
    const cp = propsForLayout(child, inner.width);
    const mainSize = constrainAxis(sizes[i]!, cp, mainIsWidth ? "width" : "height");
    const crossMeasure = measure(child, "cross", direction, inner.width);
    let crossSize = align === "stretch" ? innerCross : Math.min(innerCross, crossMeasure);
    if (cp.height != null && mainIsWidth) crossSize = Math.min(cp.height, innerCross);
    if (cp.width != null && !mainIsWidth) crossSize = Math.min(cp.width, innerCross);
    crossSize = constrainAxis(crossSize, cp, mainIsWidth ? "height" : "width");

    const crossStart = mainIsWidth ? inner.y : inner.x;
    let crossOffset = 0;
    if (align === "center") crossOffset = Math.floor((innerCross - crossSize) / 2);
    else if (align === "end") crossOffset = innerCross - crossSize;

    const childRect = mainIsWidth
      ? new Rect(pos, crossStart + crossOffset, mainSize, crossSize)
      : new Rect(crossStart + crossOffset, pos, crossSize, mainSize);
    layoutNode(child, childRect.intersect(inner), inner.width);
    pos += mainSize + spacing;
  }

  layoutOverlayChildren(overlayChildren, inner);
}

function layoutGridChildren(
  node: HostNode,
  inner: Rect,
  flowChildren: HostNode[],
  gap: number,
): void {
  const props = node.resolvedProps as unknown as BoxProps;
  const explicitColumns = parseTrackList(props.gridColumns);
  const explicitRows = parseTrackList(props.gridRows);
  const autoColumn = parseTrack(props.gridAutoColumns ?? "auto");
  const autoRow = parseTrack(props.gridAutoRows ?? "auto");
  const placements = placeGridChildren(
    flowChildren,
    Math.max(1, explicitColumns.length),
    inner.width,
  );

  let columnCount = Math.max(1, explicitColumns.length);
  let rowCount = explicitRows.length;
  for (const placement of placements) {
    columnCount = Math.max(columnCount, placement.column + placement.columnSpan);
    rowCount = Math.max(rowCount, placement.row + placement.rowSpan);
  }
  rowCount = Math.max(1, rowCount);

  const columns = expandTracks(explicitColumns, columnCount, autoColumn);
  const rows = expandTracks(explicitRows, rowCount, autoRow);
  const autoWidths = intrinsicTrackSizes(placements, columns.length, "width", inner.width);
  const autoHeights = intrinsicTrackSizes(placements, rows.length, "height", inner.width);
  const columnSizes = resolveTracks(columns, inner.width, gap, autoWidths);
  const rowSizes = resolveTracks(rows, inner.height, gap, autoHeights);

  for (const placement of placements) {
    const x = trackOffset(inner.x, columnSizes, gap, placement.column);
    const y = trackOffset(inner.y, rowSizes, gap, placement.row);
    const width = spanSize(columnSizes, gap, placement.column, placement.columnSpan);
    const height = spanSize(rowSizes, gap, placement.row, placement.rowSpan);
    layoutNode(placement.child, new Rect(x, y, width, height).intersect(inner), inner.width);
  }
}

function layoutDockChildren(inner: Rect, flowChildren: HostNode[]): void {
  let remaining = inner;
  const fillChildren: HostNode[] = [];

  for (const child of flowChildren) {
    const props = propsForLayout(child, inner.width);
    const dock = props.dock ?? "fill";
    if (dock === "fill") {
      fillChildren.push(child);
      continue;
    }

    if (dock === "top") {
      const height = Math.min(remaining.height, dockSize(child, "height", inner.width));
      layoutNode(child, new Rect(remaining.x, remaining.y, remaining.width, height), inner.width);
      remaining = new Rect(
        remaining.x,
        remaining.y + height,
        remaining.width,
        Math.max(0, remaining.height - height),
      );
      continue;
    }

    if (dock === "bottom") {
      const height = Math.min(remaining.height, dockSize(child, "height", inner.width));
      layoutNode(
        child,
        new Rect(remaining.x, remaining.bottom - height, remaining.width, height),
        inner.width,
      );
      remaining = new Rect(
        remaining.x,
        remaining.y,
        remaining.width,
        Math.max(0, remaining.height - height),
      );
      continue;
    }

    if (dock === "left") {
      const width = Math.min(remaining.width, dockSize(child, "width", inner.width));
      layoutNode(child, new Rect(remaining.x, remaining.y, width, remaining.height), inner.width);
      remaining = new Rect(
        remaining.x + width,
        remaining.y,
        Math.max(0, remaining.width - width),
        remaining.height,
      );
      continue;
    }

    const width = Math.min(remaining.width, dockSize(child, "width", inner.width));
    layoutNode(
      child,
      new Rect(remaining.right - width, remaining.y, width, remaining.height),
      inner.width,
    );
    remaining = new Rect(
      remaining.x,
      remaining.y,
      Math.max(0, remaining.width - width),
      remaining.height,
    );
  }

  for (const child of fillChildren) layoutNode(child, remaining, inner.width);
}

function layoutOverlayChildren(children: HostNode[], inner: Rect): void {
  for (const child of children) {
    layoutNode(child, overlayRect(child, inner), inner.width);
  }
}

function resolveBoxSize(props: BoxProps, container: Rect): { width: number; height: number } {
  let width = constrainAxis(
    Math.min(props.width ?? container.width, container.width),
    props,
    "width",
  );
  let height = constrainAxis(
    Math.min(props.height ?? container.height, container.height),
    props,
    "height",
  );

  const ratio = props.aspectRatio;
  if (ratio != null && Number.isFinite(ratio) && ratio > 0) {
    if (props.width != null && props.height == null) {
      height = constrainAxis(Math.round(width / ratio), props, "height");
    } else if (props.height != null && props.width == null) {
      width = constrainAxis(Math.round(height * ratio), props, "width");
    } else if (props.width == null && props.height == null && height > 0) {
      const ratioWidth = Math.round(height * ratio);
      if (ratioWidth <= container.width) width = constrainAxis(ratioWidth, props, "width");
      else height = constrainAxis(Math.round(width / ratio), props, "height");
    }
  }

  return {
    width: Math.min(width, container.width),
    height: Math.min(height, container.height),
  };
}

function constrainAxis(value: number, props: BoxProps, axis: Axis): number {
  const min = axis === "width" ? props.minWidth : props.minHeight;
  const max = axis === "width" ? props.maxWidth : props.maxHeight;
  let next = Math.max(0, Math.floor(value));
  if (min != null) next = Math.max(next, Math.max(0, Math.floor(min)));
  if (max != null) next = Math.min(next, Math.max(0, Math.floor(max)));
  return next;
}

function isOutOfFlow(child: HostNode, width: number): boolean {
  const props = propsForLayout(child, width);
  return props.overlay === true || props.position === "absolute";
}

function isDisplayNone(child: HostNode, width: number): boolean {
  return propsForLayout(child, width).display === "none";
}

function overlayRect(child: HostNode, inner: Rect): Rect {
  const props = propsForLayout(child, inner.width);
  const left = props.left ?? 0;
  const top = props.top ?? 0;
  const hasRight = props.right != null;
  const hasBottom = props.bottom != null;
  const width =
    props.width ??
    (hasRight ? Math.max(0, inner.width - left - props.right!) : Math.max(0, inner.width - left));
  const height =
    props.height ??
    (hasBottom ? Math.max(0, inner.height - top - props.bottom!) : Math.max(0, inner.height - top));
  const x = hasRight && props.width != null ? inner.right - props.right! - width : inner.x + left;
  const y =
    hasBottom && props.height != null ? inner.bottom - props.bottom! - height : inner.y + top;
  return new Rect(x, y, width, height).intersect(inner);
}

function dockSize(child: HostNode, axis: Axis, contextWidth: number): number {
  const props = propsForLayout(child, contextWidth);
  if (axis === "width")
    return constrainAxis(props.width ?? intrinsicWidth(child, contextWidth), props, "width");
  return constrainAxis(props.height ?? intrinsicHeight(child, contextWidth), props, "height");
}

function placeGridChildren(
  children: HostNode[],
  initialColumnCount: number,
  contextWidth: number,
): GridPlacement[] {
  const placements: GridPlacement[] = [];
  const occupied = new Set<string>();
  let cursorRow = 0;
  let cursorColumn = 0;
  let columnCount = initialColumnCount;

  for (const child of children) {
    const props = propsForLayout(child, contextWidth);
    const column = gridLineStart(props.gridColumn);
    const row = gridLineStart(props.gridRow);
    const columnSpan = gridLineSpan(props.gridColumn, props.gridColumnSpan);
    const rowSpan = gridLineSpan(props.gridRow, props.gridRowSpan);

    let placedColumn = column == null ? -1 : column;
    let placedRow = row == null ? -1 : row;
    columnCount = Math.max(columnCount, placedColumn + columnSpan);

    if (placedColumn < 0 || placedRow < 0) {
      const found = findGridSlot(
        occupied,
        columnCount,
        columnSpan,
        rowSpan,
        placedRow >= 0 ? placedRow : cursorRow,
        placedColumn >= 0 ? placedColumn : cursorColumn,
      );
      placedColumn = placedColumn >= 0 ? placedColumn : found.column;
      placedRow = placedRow >= 0 ? placedRow : found.row;
      cursorRow = found.row;
      cursorColumn = found.column + columnSpan;
      if (cursorColumn >= columnCount) {
        cursorColumn = 0;
        cursorRow += 1;
      }
    }

    markGridSlot(occupied, placedColumn, placedRow, columnSpan, rowSpan);
    placements.push({
      child,
      column: placedColumn,
      row: placedRow,
      columnSpan,
      rowSpan,
    });
  }

  return placements;
}

function gridLineStart(line: GridLine | undefined): number | null {
  if (line == null) return null;
  const value = Array.isArray(line) ? line[0] : line;
  return Math.max(0, Math.floor(value) - 1);
}

function gridLineSpan(line: GridLine | undefined, explicitSpan: number | undefined): number {
  if (explicitSpan != null) return Math.max(1, Math.floor(explicitSpan));
  if (!Array.isArray(line)) return 1;
  return Math.max(1, Math.floor(line[1]) - Math.floor(line[0]));
}

function findGridSlot(
  occupied: Set<string>,
  columnCount: number,
  columnSpan: number,
  rowSpan: number,
  startRow: number,
  startColumn: number,
): { column: number; row: number } {
  for (let row = Math.max(0, startRow); ; row++) {
    const columnStart = row === startRow ? Math.max(0, startColumn) : 0;
    for (let column = columnStart; column + columnSpan <= columnCount; column++) {
      if (gridSlotOpen(occupied, column, row, columnSpan, rowSpan)) return { column, row };
    }
  }
}

function gridSlotOpen(
  occupied: Set<string>,
  column: number,
  row: number,
  columnSpan: number,
  rowSpan: number,
): boolean {
  for (let y = row; y < row + rowSpan; y++) {
    for (let x = column; x < column + columnSpan; x++) {
      if (occupied.has(`${x}:${y}`)) return false;
    }
  }
  return true;
}

function markGridSlot(
  occupied: Set<string>,
  column: number,
  row: number,
  columnSpan: number,
  rowSpan: number,
): void {
  for (let y = row; y < row + rowSpan; y++) {
    for (let x = column; x < column + columnSpan; x++) occupied.add(`${x}:${y}`);
  }
}

function parseTrackList(value: GridTrackList | undefined): TrackSpec[] {
  if (value == null) return [];
  const parts = typeof value === "string" ? splitTrackList(value) : [...value];
  return parts.map((part) => parseTrack(part as GridTrackSize));
}

function splitTrackList(value: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let current = "";
  for (const char of value.trim()) {
    if (char === "(") depth += 1;
    if (char === ")") depth = Math.max(0, depth - 1);
    if (/\s/.test(char) && depth === 0) {
      if (current.trim()) out.push(current.trim());
      current = "";
      continue;
    }
    current += char;
  }
  if (current.trim()) out.push(current.trim());
  return out;
}

function parseTrack(value: GridTrackSize): TrackSpec {
  if (typeof value === "number") return { kind: "fixed", value: Math.max(0, Math.floor(value)) };
  const trimmed = value.trim();
  if (trimmed === "auto") return { kind: "auto" };

  const fr = trimmed.match(/^(\d+(?:\.\d+)?)fr$/);
  if (fr) return { kind: "fr", value: Math.max(0, Number(fr[1])) };

  const fixed = Number(trimmed);
  if (Number.isFinite(fixed)) return { kind: "fixed", value: Math.max(0, Math.floor(fixed)) };

  const minmax = trimmed.match(/^minmax\((.*),(.*)\)$/);
  if (minmax) {
    return {
      kind: "minmax",
      min: parseTrack(minmax[1]!.trim() as GridTrackSize),
      max: parseTrack(minmax[2]!.trim() as GridTrackSize),
    };
  }

  throw new Error(`graceglyph: invalid grid track "${value}"`);
}

function expandTracks(specs: TrackSpec[], count: number, autoTrack: TrackSpec): TrackSpec[] {
  const out = specs.slice(0, count);
  while (out.length < count) out.push(autoTrack);
  return out;
}

function intrinsicTrackSizes(
  placements: GridPlacement[],
  trackCount: number,
  axis: Axis,
  contextWidth: number,
): number[] {
  const sizes = new Array<number>(trackCount).fill(0);
  for (const placement of placements) {
    const index = axis === "width" ? placement.column : placement.row;
    const span = axis === "width" ? placement.columnSpan : placement.rowSpan;
    if (span !== 1 || index >= sizes.length) continue;
    sizes[index] = Math.max(
      sizes[index]!,
      axis === "width"
        ? intrinsicWidth(placement.child, contextWidth)
        : intrinsicHeight(placement.child, contextWidth),
    );
  }
  return sizes;
}

function resolveTracks(
  specs: TrackSpec[],
  available: number,
  gap: number,
  autoSizes: readonly number[],
): number[] {
  const gaps = gap * Math.max(0, specs.length - 1);
  const sizes = new Array<number>(specs.length).fill(0);
  const flex: Array<{ index: number; weight: number }> = [];

  for (let index = 0; index < specs.length; index++) {
    const base = trackBase(specs[index]!, autoSizes[index] ?? 0);
    sizes[index] = base.size;
    if (base.flex > 0) flex.push({ index, weight: base.flex });
  }

  const fixedTotal = sizes.reduce((total, size) => total + size, 0) + gaps;
  const remaining = Math.max(0, available - fixedTotal);
  const totalWeight = flex.reduce((total, item) => total + item.weight, 0);

  if (remaining > 0 && totalWeight > 0) {
    let used = 0;
    for (let i = 0; i < flex.length; i++) {
      const item = flex[i]!;
      const share =
        i === flex.length - 1
          ? remaining - used
          : Math.floor((item.weight / totalWeight) * remaining);
      sizes[item.index] = (sizes[item.index] ?? 0) + share;
      used += share;
    }
  }

  return sizes;
}

function trackBase(spec: TrackSpec, autoSize: number): { size: number; flex: number } {
  if (spec.kind === "fixed") return { size: spec.value, flex: 0 };
  if (spec.kind === "auto") return { size: autoSize, flex: 0 };
  if (spec.kind === "fr") return { size: 0, flex: spec.value };

  const min = trackMin(spec.min, autoSize);
  if (spec.max.kind === "fr") return { size: min, flex: spec.max.value };
  if (spec.max.kind === "auto") return { size: Math.max(min, autoSize), flex: 0 };
  if (spec.max.kind === "fixed") return { size: Math.max(min, spec.max.value), flex: 0 };
  const nested = trackBase(spec.max, autoSize);
  return { size: Math.max(min, nested.size), flex: nested.flex };
}

function trackMin(spec: TrackSpec, autoSize: number): number {
  if (spec.kind === "fixed") return spec.value;
  if (spec.kind === "auto") return autoSize;
  if (spec.kind === "fr") return 0;
  return trackMin(spec.min, autoSize);
}

function trackOffset(start: number, sizes: readonly number[], gap: number, index: number): number {
  let offset = start;
  for (let i = 0; i < index; i++) offset += sizes[i]! + gap;
  return offset;
}

function spanSize(sizes: readonly number[], gap: number, start: number, span: number): number {
  let size = 0;
  for (let i = start; i < Math.min(sizes.length, start + span); i++) {
    if (i > start) size += gap;
    size += sizes[i]!;
  }
  return size;
}

function intrinsicWidth(node: HostNode, contextWidth: number): number {
  return measure(node, "main", "row", contextWidth);
}

function intrinsicHeight(node: HostNode, contextWidth: number): number {
  return measure(node, "main", "column", contextWidth);
}

// -- Paint --------------------------------------------------------------------

export interface PaintContext {
  buffer: ScreenBuffer;
  focusedFiber: Fiber | null;
  hoveredFiber?: Fiber | null;
  activeFiber?: Fiber | null;
}

export function paintTree(root: HostNode, ctx: PaintContext): void {
  paintNode(root, ctx);
}

function paintNode(node: HostNode, ctx: PaintContext): void {
  const props = node.resolvedProps as unknown as BoxProps & TextProps & InputProps & TextAreaProps;
  const { buffer } = ctx;
  const { layout } = node;
  if (node.hidden || layout.width === 0 || layout.height === 0) return;

  const focused = ctx.focusedFiber === node.fiber;
  const hovered = ctx.hoveredFiber === node.fiber;
  const active = ctx.activeFiber === node.fiber;
  const theme = node.fiber.environment?.theme;
  const styleContext: StyleResolveContext = {
    width: layout.width,
    states: {
      focused,
      hovered,
      active,
      loading: !!props.loading,
      error: !!props.error,
      disabled: !!props.disabled,
    },
  };
  const fillStyle = stateStyle(
    applyBoxStyle(DefaultStyle, props.style, theme, styleContext),
    props,
    {
      focused,
      hovered,
      active,
    },
    theme,
    styleContext,
  );

  if (node.type === "text") {
    // Paint background first if given so wide strings with short area align.
    if (fillStyle.bg.kind !== "default") buffer.fill(layout, " ", fillStyle);
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
      const phStyle = applyBoxStyle(
        { ...base, dim: true },
        props.placeholderStyle,
        theme,
        styleContext,
      );
      buffer.writeText(
        layout.x,
        layout.y,
        truncate(props.placeholder, layout.width, "truncate"),
        phStyle,
        layout,
      );
    } else {
      const state = ensureEditableState(node, value);
      const visible =
        getVisibleLines(state, value, layout.width, layout.height, "single-line")[0] ?? "";
      const painted = props.mask ? maskGraphemes(visible, props.mask) : visible;
      buffer.writeText(layout.x, layout.y, painted, base, layout);
    }
    return;
  }

  if (node.type === "textarea") {
    const base: Style = { ...fillStyle, bg: fillStyle.bg ?? DefaultStyle.bg };
    buffer.fill(layout, " ", base);
    const value = String(props.value ?? "");
    if (value.length === 0 && props.placeholder) {
      const phStyle = applyBoxStyle(
        { ...base, dim: true },
        props.placeholderStyle,
        theme,
        styleContext,
      );
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
  const frameStyle = applyBoxStyle(fillStyle, props.borderStyle, theme, styleContext);
  const titleStyle = applyBoxStyle(frameStyle, props.titleStyle, theme, styleContext);
  buffer.fill(layout, " ", fillStyle);
  if (props.border) drawBorder(buffer, layout, frameStyle, props.title, titleStyle, focused);
  for (const child of paintOrder(node.children)) paintNode(child, ctx);
}

function paintOrder(children: readonly HostNode[]): HostNode[] {
  return [...children].sort((left, right) => {
    const leftZ = (left.resolvedProps as BoxProps).zIndex ?? 0;
    const rightZ = (right.resolvedProps as BoxProps).zIndex ?? 0;
    return leftZ - rightZ;
  });
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

/**
 * Replace each visible grapheme with `mask`, repeated proportionally to the
 * grapheme's terminal width so masked output preserves cursor alignment.
 */
function maskGraphemes(value: string, mask: string): string {
  if (!mask) return value;
  let out = "";
  for (const grapheme of splitGraphemes(value)) {
    const width = Math.max(1, grapheme.width);
    out += mask.repeat(width);
  }
  return out;
}

function applyBoxStyle(
  base: Style,
  patch: BoxProps["style"],
  theme?: Theme,
  context?: StyleResolveContext,
): Style {
  const resolved = resolveStyleLike(patch, theme, context);
  if (!resolved) return base;
  return mergeStyle(base, {
    fg: resolved.fg ?? base.fg,
    bg: resolved.bg ?? base.bg,
    bold: resolved.bold ?? base.bold,
    dim: resolved.dim ?? base.dim,
    italic: resolved.italic ?? base.italic,
    underline: resolved.underline ?? base.underline,
    inverse: resolved.inverse ?? base.inverse,
  });
}

function resolveStyleLike(
  patch: BoxProps["style"],
  theme?: Theme,
  context?: StyleResolveContext,
): BoxStyle | undefined {
  if (!patch) return undefined;
  if (
    typeof patch === "object" &&
    "toBoxStyle" in patch &&
    typeof patch.toBoxStyle === "function"
  ) {
    return patch.toBoxStyle(theme, context);
  }
  return patch as BoxStyle;
}

function stateStyle(
  base: Style,
  props: BoxProps & InputProps & TextAreaProps,
  state: { focused: boolean; hovered: boolean; active: boolean },
  theme?: Theme,
  context?: StyleResolveContext,
): Style {
  let next = base;
  if (state.hovered) next = applyBoxStyle(next, props.hoveredStyle, theme, context);
  if (state.focused) next = applyBoxStyle(next, props.focusedStyle, theme, context);
  if (state.active) next = applyBoxStyle(next, props.activeStyle, theme, context);
  if (props.loading) next = applyBoxStyle(next, props.loadingStyle, theme, context);
  if (props.error) next = applyBoxStyle(next, props.errorStyle, theme, context);
  if (props.disabled) next = applyBoxStyle(next, props.disabledStyle, theme, context);
  return next;
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
