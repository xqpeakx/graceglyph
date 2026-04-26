import { h } from "./runtime/element.js";
import type {
  AccessibilityProps,
  BoxProps,
  StyleLike,
  TextProps,
  ZenElement,
} from "./runtime/element.js";
import type { KeyEvent } from "./input/keys.js";
import { useTheme } from "./runtime/hooks.js";
import { style as styleRule } from "./style/index.js";
import { stringWidth } from "./render/unicode.js";

/**
 * Data-display components: Table, Tree, Accordion, Stepper, Pagination,
 * EmptyState, Tooltip. These compose host primitives directly so users can
 * read the source and adapt them.
 */

// -- helpers ------------------------------------------------------------------

function mergeBoxStyle(base: StyleLike, override?: StyleLike): StyleLike {
  return override ? styleRule.merge(base, override) : base;
}

function clampIndex(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

// -- <Table> ------------------------------------------------------------------
export type TableSortDirection = "asc" | "desc";

export interface TableSortState {
  columnId: string;
  direction: TableSortDirection;
}

export interface TableColumn<T> {
  id: string;
  /** Header label. Defaults to `id`. */
  header?: string;
  /** Fixed cell width. When omitted, the column gets `fr` distribution. */
  width?: number;
  /** Flex factor when `width` is omitted. Defaults to 1. */
  fr?: number;
  /** Right-align numeric columns. */
  align?: "left" | "right";
  /** Cell renderer. Falls back to String(row[id]) when omitted. */
  cell?: (row: T, index: number, selected: boolean) => string | ZenElement;
  /** When true, clicking the header toggles sort on this column. */
  sortable?: boolean;
  /** Custom comparator. Falls back to `String` collation. */
  compare?: (a: T, b: T) => number;
}

export interface TableProps<T> extends AccessibilityProps {
  rows: readonly T[];
  columns: readonly TableColumn<T>[];
  /** Selected row index, or -1 for none. */
  selected?: number;
  onSelectChange?: (index: number) => void;
  onActivate?: (index: number, row: T) => void;
  /** Visible rows. Defaults to all (no virtualization). */
  height?: number;
  /** Total table width. Defaults to filling parent. */
  width?: number;
  /** Sort state. When sortable columns are present and this is omitted,
   *  the table manages no sort and renders rows as-is. */
  sort?: TableSortState;
  onSortChange?: (sort: TableSortState | null) => void;
  /** Stripe alternating rows. */
  zebra?: boolean;
  /** Sticky header. Defaults to true. */
  stickyHeader?: boolean;
  rowKey?: (row: T, index: number) => string | number;
  headerStyle?: StyleLike;
  rowStyle?: StyleLike;
  rowSelectedStyle?: StyleLike;
  rowAltStyle?: StyleLike;
}

export function Table<T extends Record<string, unknown>>(props: TableProps<T>): ZenElement {
  const theme = useTheme();
  const {
    rows,
    columns,
    selected = -1,
    onSelectChange,
    onActivate,
    height,
    sort,
    onSortChange,
    zebra = false,
    stickyHeader = true,
  } = props;

  const sortedRows = applySort(rows, columns, sort);
  const totalHeight = sortedRows.length;
  const headerRows = stickyHeader ? 1 : 0;
  const bodyHeight = height === undefined ? totalHeight : Math.max(0, height - headerRows);
  const visible =
    bodyHeight === 0 || bodyHeight >= sortedRows.length
      ? { start: 0, rows: [...sortedRows] }
      : windowSlice(sortedRows, selected, bodyHeight);

  function move(delta: number): void {
    if (sortedRows.length === 0 || !onSelectChange) return;
    const next = clampIndex(selected < 0 ? 0 : selected + delta, 0, sortedRows.length - 1);
    onSelectChange(next);
  }

  function toggleSort(columnId: string): void {
    if (!onSortChange) return;
    if (!sort || sort.columnId !== columnId) {
      onSortChange({ columnId, direction: "asc" });
      return;
    }
    if (sort.direction === "asc") {
      onSortChange({ columnId, direction: "desc" });
      return;
    }
    onSortChange(null);
  }

  const onKey = (ev: KeyEvent): boolean | void => {
    if (ev.name === "up") {
      move(-1);
      return true;
    }
    if (ev.name === "down") {
      move(1);
      return true;
    }
    if (ev.name === "home") {
      onSelectChange?.(0);
      return true;
    }
    if (ev.name === "end") {
      onSelectChange?.(Math.max(0, sortedRows.length - 1));
      return true;
    }
    if (ev.name === "pageup") {
      move(-Math.max(1, bodyHeight - 1));
      return true;
    }
    if (ev.name === "pagedown") {
      move(Math.max(1, bodyHeight - 1));
      return true;
    }
    if (ev.name === "enter") {
      if (selected >= 0 && sortedRows[selected] && onActivate) {
        onActivate(selected, sortedRows[selected]!);
        return true;
      }
      return false;
    }
    return false;
  };

  const headerCells = columns.map((column) => {
    const sortGlyph =
      sort && sort.columnId === column.id ? (sort.direction === "asc" ? " ▲" : " ▼") : "";
    const label = `${column.header ?? column.id}${sortGlyph}`;
    return h(
      "box",
      {
        key: column.id,
        direction: "row",
        width: column.width,
        grow: column.width === undefined ? (column.fr ?? 1) : 0,
        padding: [0, 1],
        onClick: column.sortable ? () => toggleSort(column.id) : undefined,
        style: mergeBoxStyle(theme.table.header, props.headerStyle),
      } as BoxProps,
      h(
        "text",
        {
          wrap: "truncate",
          style: column.align === "right" ? ({ bold: true } as StyleLike) : undefined,
        } as TextProps,
        label,
      ),
    );
  });

  const headerRow = h(
    "box",
    {
      direction: "row",
      height: 1,
      style: mergeBoxStyle(theme.table.header, props.headerStyle),
    } as BoxProps,
    headerCells,
  );

  const bodyRows = visible.rows.map((row, offset) => {
    const realIndex = visible.start + offset;
    const isSelected = realIndex === selected;
    const baseStyle = isSelected
      ? mergeBoxStyle(theme.table.rowSelected, props.rowSelectedStyle)
      : zebra && realIndex % 2 === 1
        ? mergeBoxStyle(theme.table.rowAlt, props.rowAltStyle)
        : mergeBoxStyle(theme.table.row, props.rowStyle);
    const cells = columns.map((column) => {
      const value =
        column.cell?.(row, realIndex, isSelected) ??
        String((row as Record<string, unknown>)[column.id] ?? "");
      const cellNode =
        typeof value === "string"
          ? h(
              "text",
              {
                wrap: "truncate",
                style: baseStyle,
              } as TextProps,
              value,
            )
          : value;
      return h(
        "box",
        {
          key: column.id,
          direction: "row",
          width: column.width,
          grow: column.width === undefined ? (column.fr ?? 1) : 0,
          padding: [0, 1],
          style: baseStyle,
          justify: column.align === "right" ? "end" : "start",
        } as BoxProps,
        cellNode,
      );
    });
    return h(
      "box",
      {
        key: props.rowKey ? props.rowKey(row, realIndex) : realIndex,
        direction: "row",
        height: 1,
        style: baseStyle,
        onClick: () => {
          onSelectChange?.(realIndex);
          onActivate?.(realIndex, row);
        },
      } as BoxProps,
      cells,
    );
  });

  return h(
    "box",
    {
      focusable: true,
      direction: "column",
      width: props.width,
      height,
      onKey,
      accessibilityLabel: props.accessibilityLabel,
      accessibilityDescription: props.accessibilityDescription,
    } as BoxProps,
    [stickyHeader ? headerRow : null, ...bodyRows],
  );
}

function applySort<T>(
  rows: readonly T[],
  columns: readonly TableColumn<T>[],
  sort: TableSortState | undefined,
): readonly T[] {
  if (!sort) return rows;
  const column = columns.find((c) => c.id === sort.columnId);
  if (!column || column.sortable !== true) return rows;
  const compare =
    column.compare ??
    ((a: T, b: T) => {
      const va = (a as Record<string, unknown>)[column.id];
      const vb = (b as Record<string, unknown>)[column.id];
      if (typeof va === "number" && typeof vb === "number") return va - vb;
      return String(va ?? "").localeCompare(String(vb ?? ""));
    });
  const copy = [...rows];
  copy.sort((a, b) => (sort.direction === "asc" ? compare(a, b) : compare(b, a)));
  return copy;
}

function windowSlice<T>(
  items: readonly T[],
  selected: number,
  bodyHeight: number,
): { start: number; rows: T[] } {
  if (bodyHeight >= items.length) return { start: 0, rows: [...items] };
  const half = Math.floor(bodyHeight / 2);
  const maxStart = Math.max(0, items.length - bodyHeight);
  const start = clampIndex(selected < 0 ? 0 : selected - half, 0, maxStart);
  return { start, rows: items.slice(start, start + bodyHeight) };
}

// -- <Tree> -------------------------------------------------------------------
export interface TreeNode {
  id: string;
  label: string;
  children?: readonly TreeNode[];
}

export interface TreeProps extends AccessibilityProps {
  nodes: readonly TreeNode[];
  /** Map of node id → expanded?. Caller controls so state can be persisted. */
  expanded: Record<string, boolean>;
  onToggle: (id: string, expanded: boolean) => void;
  selectedId?: string;
  onSelect?: (id: string, node: TreeNode) => void;
  /** Number of cells per indent level. Defaults to 2. */
  indent?: number;
  /** Glyph pair: [collapsed, expanded]. */
  glyphs?: readonly [collapsed: string, expanded: string, leaf: string];
  /** Total tree height. */
  height?: number;
  width?: number;
  guideStyle?: StyleLike;
  nodeStyle?: StyleLike;
  selectedStyle?: StyleLike;
}

interface FlatTreeRow {
  node: TreeNode;
  depth: number;
}

export function Tree(props: TreeProps): ZenElement {
  const theme = useTheme();
  const indent = Math.max(1, props.indent ?? 2);
  const [collapsedGlyph, expandedGlyph, leafGlyph] = props.glyphs ?? (["▸", "▾", "·"] as const);
  const flat = flattenTree(props.nodes, props.expanded);
  const selectedIndex = props.selectedId
    ? flat.findIndex((row) => row.node.id === props.selectedId)
    : -1;

  function move(delta: number): void {
    if (flat.length === 0 || !props.onSelect) return;
    const next = clampIndex(selectedIndex < 0 ? 0 : selectedIndex + delta, 0, flat.length - 1);
    const row = flat[next]!;
    props.onSelect(row.node.id, row.node);
  }

  const onKey = (ev: KeyEvent): boolean | void => {
    if (ev.name === "up") {
      move(-1);
      return true;
    }
    if (ev.name === "down") {
      move(1);
      return true;
    }
    if (ev.name === "left") {
      const row = flat[selectedIndex];
      if (row && row.node.children && row.node.children.length > 0 && props.expanded[row.node.id]) {
        props.onToggle(row.node.id, false);
      }
      return true;
    }
    if (ev.name === "right") {
      const row = flat[selectedIndex];
      if (
        row &&
        row.node.children &&
        row.node.children.length > 0 &&
        !props.expanded[row.node.id]
      ) {
        props.onToggle(row.node.id, true);
      }
      return true;
    }
    if (ev.name === "enter" || ev.name === "space") {
      const row = flat[selectedIndex];
      if (row && row.node.children && row.node.children.length > 0) {
        props.onToggle(row.node.id, !props.expanded[row.node.id]);
      }
      return true;
    }
    return false;
  };

  const visibleRows = props.height ? windowSlice(flat, selectedIndex, props.height).rows : flat;

  const rowNodes = visibleRows.map((row) => {
    const hasChildren = row.node.children && row.node.children.length > 0;
    const isOpen = !!props.expanded[row.node.id];
    const glyph = hasChildren ? (isOpen ? expandedGlyph : collapsedGlyph) : leafGlyph;
    const guide = " ".repeat(row.depth * indent);
    const isSelected = row.node.id === props.selectedId;
    const baseStyle = isSelected
      ? mergeBoxStyle(theme.list.selected, props.selectedStyle)
      : mergeBoxStyle(theme.tree.node, props.nodeStyle);
    return h(
      "box",
      {
        key: row.node.id,
        direction: "row",
        height: 1,
        onClick: () => {
          props.onSelect?.(row.node.id, row.node);
          if (hasChildren) props.onToggle(row.node.id, !isOpen);
        },
        style: baseStyle,
      } as BoxProps,
      [
        h("text", { style: mergeBoxStyle(theme.tree.guide, props.guideStyle) } as TextProps, guide),
        h("text", { style: baseStyle } as TextProps, `${glyph} ${row.node.label}`),
      ],
    );
  });

  return h(
    "box",
    {
      focusable: true,
      direction: "column",
      width: props.width,
      height: props.height,
      onKey,
      accessibilityLabel: props.accessibilityLabel,
      accessibilityDescription: props.accessibilityDescription,
    } as BoxProps,
    rowNodes,
  );
}

function flattenTree(
  nodes: readonly TreeNode[],
  expanded: Record<string, boolean>,
  depth = 0,
  out: FlatTreeRow[] = [],
): FlatTreeRow[] {
  for (const node of nodes) {
    out.push({ node, depth });
    if (node.children && expanded[node.id]) {
      flattenTree(node.children, expanded, depth + 1, out);
    }
  }
  return out;
}

// -- <Accordion> --------------------------------------------------------------
export interface AccordionItem {
  id: string;
  title: string;
  content: ZenElement | string;
  disabled?: boolean;
}

export interface AccordionProps extends AccessibilityProps {
  items: readonly AccordionItem[];
  /** Open item ids. Multi-open by default; pass `mode="single"` to enforce one. */
  openIds: readonly string[];
  onChange: (openIds: readonly string[]) => void;
  mode?: "single" | "multi";
  headerStyle?: StyleLike;
  headerOpenStyle?: StyleLike;
}

export function Accordion(props: AccordionProps): ZenElement {
  const theme = useTheme();
  const mode = props.mode ?? "multi";
  const openSet = new Set(props.openIds);

  function toggle(id: string): void {
    const isOpen = openSet.has(id);
    if (mode === "single") {
      props.onChange(isOpen ? [] : [id]);
      return;
    }
    if (isOpen) {
      props.onChange(props.openIds.filter((existing) => existing !== id));
    } else {
      props.onChange([...props.openIds, id]);
    }
  }

  const sections: ZenElement[] = [];
  for (const item of props.items) {
    const isOpen = openSet.has(item.id);
    sections.push(
      h(
        "box",
        {
          key: `${item.id}-header`,
          focusable: !item.disabled,
          disabled: item.disabled,
          direction: "row",
          height: 1,
          padding: [0, 1],
          onClick: item.disabled ? undefined : () => toggle(item.id),
          onKey: (ev: KeyEvent): boolean | void => {
            if (item.disabled) return false;
            if (ev.name === "enter" || ev.name === "space") {
              toggle(item.id);
              return true;
            }
            return false;
          },
          style: isOpen
            ? mergeBoxStyle(theme.accordion.headerOpen, props.headerOpenStyle)
            : mergeBoxStyle(theme.accordion.header, props.headerStyle),
        } as BoxProps,
        h("text", {} as TextProps, `${isOpen ? "▾" : "▸"} ${item.title}`),
      ),
    );
    if (isOpen) {
      sections.push(
        h(
          "box",
          {
            key: `${item.id}-content`,
            direction: "column",
            padding: [0, 2],
          } as BoxProps,
          typeof item.content === "string"
            ? h("text", {} as TextProps, item.content)
            : item.content,
        ),
      );
    }
  }

  return h(
    "box",
    {
      direction: "column",
      gap: 0,
      accessibilityLabel: props.accessibilityLabel,
      accessibilityDescription: props.accessibilityDescription,
    } as BoxProps,
    sections,
  );
}

// -- <Stepper> ----------------------------------------------------------------
export interface StepperStep {
  id: string;
  label: string;
}

export interface StepperProps extends AccessibilityProps {
  steps: readonly StepperStep[];
  current: number;
  onChange?: (next: number) => void;
  /** Layout direction. Defaults to row. */
  direction?: "row" | "column";
  /** Glyph pair: [pendingMark, currentMark, completedMark]. */
  glyphs?: readonly [pending: string, current: string, complete: string];
  /** Connector glyph between steps. */
  connector?: string;
  pendingStyle?: StyleLike;
  activeStyle?: StyleLike;
  completeStyle?: StyleLike;
  connectorStyle?: StyleLike;
}

export function Stepper(props: StepperProps): ZenElement {
  const theme = useTheme();
  const direction = props.direction ?? "row";
  const [pending, current, complete] = props.glyphs ?? (["○", "◉", "●"] as const);
  const connector = props.connector ?? (direction === "row" ? "──" : "│");

  const items: ZenElement[] = [];
  props.steps.forEach((step, index) => {
    const isComplete = index < props.current;
    const isActive = index === props.current;
    const mark = isComplete ? complete : isActive ? current : pending;
    const tokenStyle = isComplete
      ? mergeBoxStyle(theme.stepper.complete, props.completeStyle)
      : isActive
        ? mergeBoxStyle(theme.stepper.active, props.activeStyle)
        : mergeBoxStyle(theme.stepper.pending, props.pendingStyle);
    items.push(
      h(
        "box",
        {
          key: step.id,
          direction: "row",
          padding: direction === "row" ? [0, 1] : [0, 0],
          onClick: props.onChange ? () => props.onChange?.(index) : undefined,
          focusable: !!props.onChange,
          style: tokenStyle,
        } as BoxProps,
        h("text", {} as TextProps, `${mark} ${step.label}`),
      ),
    );
    if (index < props.steps.length - 1) {
      items.push(
        h(
          "text",
          {
            key: `${step.id}-connector`,
            style: mergeBoxStyle(theme.stepper.connector, props.connectorStyle),
          } as TextProps & { key: string },
          connector,
        ),
      );
    }
  });

  return h(
    "box",
    {
      direction,
      gap: direction === "row" ? 0 : 0,
      align: direction === "row" ? "center" : "start",
      accessibilityLabel: props.accessibilityLabel,
      accessibilityDescription: props.accessibilityDescription,
    } as BoxProps,
    items,
  );
}

// -- <Pagination> -------------------------------------------------------------
export interface PaginationProps extends AccessibilityProps {
  page: number;
  pageCount: number;
  onChange: (next: number) => void;
  /** Number of numeric buttons to show. Defaults to 5. */
  windowSize?: number;
  disabled?: boolean;
  normalStyle?: StyleLike;
  activeStyle?: StyleLike;
  disabledStyle?: StyleLike;
}

export function Pagination(props: PaginationProps): ZenElement {
  const theme = useTheme();
  const windowSize = Math.max(1, props.windowSize ?? 5);
  const lastPage = Math.max(1, props.pageCount);
  const safePage = clampIndex(props.page, 1, lastPage);

  function pageButton(label: string, target: number, disabled: boolean, key: string): ZenElement {
    const isActive = target === safePage && !disabled;
    return h(
      "box",
      {
        key,
        focusable: !disabled && !props.disabled,
        disabled: disabled || props.disabled,
        direction: "row",
        padding: [0, 1],
        onClick: disabled || props.disabled ? undefined : () => props.onChange(target),
        onKey: (ev: KeyEvent): boolean | void => {
          if (disabled || props.disabled) return false;
          if (ev.name === "enter" || ev.name === "space") {
            props.onChange(target);
            return true;
          }
          return false;
        },
        style: disabled
          ? mergeBoxStyle(theme.pagination.disabled, props.disabledStyle)
          : isActive
            ? mergeBoxStyle(theme.pagination.active, props.activeStyle)
            : mergeBoxStyle(theme.pagination.normal, props.normalStyle),
      } as BoxProps,
      h("text", {} as TextProps, label),
    );
  }

  const half = Math.floor(windowSize / 2);
  let start = clampIndex(safePage - half, 1, Math.max(1, lastPage - windowSize + 1));
  const end = Math.min(lastPage, start + windowSize - 1);
  start = Math.max(1, end - windowSize + 1);

  const buttons: ZenElement[] = [];
  buttons.push(pageButton("‹‹", 1, safePage === 1, "first"));
  buttons.push(pageButton("‹", Math.max(1, safePage - 1), safePage === 1, "prev"));

  for (let p = start; p <= end; p++) {
    buttons.push(pageButton(String(p), p, false, `p-${p}`));
  }

  buttons.push(pageButton("›", Math.min(lastPage, safePage + 1), safePage === lastPage, "next"));
  buttons.push(pageButton("››", lastPage, safePage === lastPage, "last"));

  return h(
    "box",
    {
      direction: "row",
      gap: 1,
      accessibilityLabel: props.accessibilityLabel,
      accessibilityDescription: props.accessibilityDescription,
    } as BoxProps,
    buttons,
  );
}

// -- <EmptyState> -------------------------------------------------------------
export interface EmptyStateProps extends AccessibilityProps {
  /** Title rendered in bold. */
  title: string;
  /** Optional subtitle / description. */
  description?: string;
  /** Optional ASCII art / icon. */
  icon?: string;
  /** Inline action region (buttons, links). */
  action?: ZenElement;
  align?: "start" | "center" | "end";
  width?: number;
  style?: StyleLike;
}

export function EmptyState(props: EmptyStateProps): ZenElement {
  const align = props.align ?? "center";
  const children: ZenElement[] = [];
  if (props.icon) {
    const lines = props.icon.split("\n");
    for (const [i, line] of lines.entries()) {
      children.push(h("text", { key: `icon-${i}` } as TextProps & { key: string }, line));
    }
  }
  children.push(h("text", { style: { bold: true } as StyleLike } as TextProps, props.title));
  if (props.description) {
    children.push(h("text", { style: { dim: true } as StyleLike } as TextProps, props.description));
  }
  if (props.action) {
    children.push(props.action);
  }
  return h(
    "box",
    {
      direction: "column",
      align,
      justify: "center",
      gap: 1,
      padding: 1,
      width: props.width,
      style: props.style,
      accessibilityLabel: props.accessibilityLabel ?? props.title,
      accessibilityDescription: props.accessibilityDescription ?? props.description,
    } as BoxProps,
    children,
  );
}

// -- <Tooltip> ----------------------------------------------------------------
export type TooltipPlacement = "top" | "bottom" | "left" | "right";

export interface TooltipProps extends AccessibilityProps {
  /** Anchor child. Should be focusable / hoverable for the trigger to work. */
  children: ZenElement | string;
  /** Tooltip body. */
  label: string;
  placement?: TooltipPlacement;
  /** Force-open state. When undefined, opens on focus / hover of child. */
  open?: boolean;
  style?: StyleLike;
  width?: number;
}

export function Tooltip(props: TooltipProps): ZenElement {
  const theme = useTheme();
  const placement = props.placement ?? "bottom";
  const open = props.open ?? true;
  // Reserve space for the 1-cell padding on each side so the body always fits.
  const labelWidth = props.width ?? Math.min(60, stringWidth(props.label) + 4);

  const child =
    typeof props.children === "string"
      ? h("text", {} as TextProps, props.children)
      : props.children;

  if (!open) return h("box", { direction: "column" } as BoxProps, child);

  const labelBox = h(
    "box",
    {
      width: labelWidth,
      height: 1,
      padding: [0, 1],
      style: mergeBoxStyle(theme.tooltip, props.style),
      accessibilityLabel: props.accessibilityLabel ?? "tooltip",
      accessibilityDescription: props.accessibilityDescription ?? props.label,
    } as BoxProps,
    h("text", { wrap: "truncate" } as TextProps, props.label),
  );

  if (placement === "top") {
    return h("box", { direction: "column" } as BoxProps, [labelBox, child]);
  }
  if (placement === "left") {
    return h("box", { direction: "row", gap: 1 } as BoxProps, [labelBox, child]);
  }
  if (placement === "right") {
    return h("box", { direction: "row", gap: 1 } as BoxProps, [child, labelBox]);
  }
  return h("box", { direction: "column" } as BoxProps, [child, labelBox]);
}
