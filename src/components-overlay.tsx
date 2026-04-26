import { h } from "./runtime/element.js";
import type {
  AccessibilityProps,
  BoxProps,
  StyleLike,
  TextProps,
  ZenElement,
} from "./runtime/element.js";
import type { KeyEvent } from "./input/keys.js";
import { useState, useTheme } from "./runtime/hooks.js";
import { style as styleRule } from "./style/index.js";
import { Table } from "./components-data.js";
import type { TableColumn, TableSortState } from "./components-data.js";

function mergeBoxStyle(base: StyleLike, override?: StyleLike): StyleLike {
  return override ? styleRule.merge(base, override) : base;
}

// -- <Popover> ---------------------------------------------------------------
export type PopoverPlacement = "top" | "bottom" | "left" | "right";

export interface PopoverProps extends AccessibilityProps {
  /** Anchor child rendered inline. */
  children: ZenElement | string;
  /** Popover content shown when `open` is true. */
  content: ZenElement | string;
  open: boolean;
  onClose?: () => void;
  placement?: PopoverPlacement;
  width?: number;
  height?: number;
  /** When true, clicking outside the popover (anywhere) closes it. */
  dismissOnOutsideClick?: boolean;
  style?: StyleLike;
}

export function Popover(props: PopoverProps): ZenElement {
  const theme = useTheme();
  const placement = props.placement ?? "bottom";

  const child =
    typeof props.children === "string"
      ? h("text", {} as TextProps, props.children)
      : props.children;

  if (!props.open) {
    return h(
      "box",
      {
        direction: "column",
        accessibilityLabel: props.accessibilityLabel,
      } as BoxProps,
      child,
    );
  }

  const popoverBox = h(
    "box",
    {
      width: props.width ?? 32,
      height: props.height,
      border: true,
      padding: 1,
      style: mergeBoxStyle(theme.window.body, props.style),
      borderStyle: theme.window.frame,
      onKey: (ev: KeyEvent): boolean | void => {
        if (ev.name === "escape") {
          props.onClose?.();
          return true;
        }
        return false;
      },
    } as BoxProps,
    typeof props.content === "string"
      ? h("text", {} as TextProps, props.content)
      : props.content,
  );

  if (placement === "top") {
    return h("box", { direction: "column" } as BoxProps, [popoverBox, child]);
  }
  if (placement === "left") {
    return h("box", { direction: "row", gap: 1 } as BoxProps, [popoverBox, child]);
  }
  if (placement === "right") {
    return h("box", { direction: "row", gap: 1 } as BoxProps, [child, popoverBox]);
  }
  return h("box", { direction: "column" } as BoxProps, [child, popoverBox]);
}

// -- <DataGrid> --------------------------------------------------------------
// Editable table. Built on Table, adds a per-row, per-column edit mode that
// renders a TextInput inside the active cell.

export interface DataGridColumn<T> extends TableColumn<T> {
  /** Make the column user-editable. */
  editable?: boolean;
  /** Read the underlying string for editing. Defaults to String(row[id]). */
  toEdit?: (row: T) => string;
  /** Apply an edit. The grid invokes onChangeRow with the patched row. */
  fromEdit?: (row: T, raw: string) => T;
}

export interface DataGridProps<T> extends AccessibilityProps {
  rows: readonly T[];
  columns: readonly DataGridColumn<T>[];
  selected?: number;
  onSelectChange?: (index: number) => void;
  /** Called when a cell edit commits. */
  onChangeRow?: (index: number, next: T) => void;
  height?: number;
  width?: number;
  sort?: TableSortState;
  onSortChange?: (sort: TableSortState | null) => void;
  zebra?: boolean;
  rowKey?: (row: T, index: number) => string | number;
}

export function DataGrid<T extends Record<string, unknown>>(
  props: DataGridProps<T>,
): ZenElement {
  const [editing, setEditing] = useState<{ row: number; column: string; draft: string } | null>(
    null,
  );
  const selected = props.selected ?? -1;

  function beginEdit(rowIndex: number, columnId: string): void {
    const column = props.columns.find((c) => c.id === columnId);
    if (!column || !column.editable) return;
    const row = props.rows[rowIndex];
    if (!row) return;
    const draft = column.toEdit
      ? column.toEdit(row)
      : String((row as Record<string, unknown>)[columnId] ?? "");
    setEditing({ row: rowIndex, column: columnId, draft });
  }

  function commitEdit(): void {
    if (!editing) return;
    const column = props.columns.find((c) => c.id === editing.column);
    const row = props.rows[editing.row];
    if (!column || !row) {
      setEditing(null);
      return;
    }
    const next = column.fromEdit
      ? column.fromEdit(row, editing.draft)
      : ({ ...(row as Record<string, unknown>), [editing.column]: editing.draft } as T);
    props.onChangeRow?.(editing.row, next);
    setEditing(null);
  }

  const columnsForRender: TableColumn<T>[] = props.columns.map((column) => ({
    ...column,
    cell: (row: T, index: number, isSelected: boolean) => {
      if (editing && editing.row === index && editing.column === column.id) {
        // While editing, the wrapper handles keystrokes — render the live
        // draft as text with a trailing caret so the user sees their edits.
        return `${editing.draft}▏`;
      }
      const fallback = column.cell
        ? column.cell(row, index, isSelected)
        : String((row as Record<string, unknown>)[column.id] ?? "");
      return fallback;
    },
  }));

  // Edit-mode key handling lives at the wrapper level so focus stays on the
  // Table host. Without this dance the TextInput would need autofocus, which
  // the runtime doesn't support yet (see roadmap §7).
  const onKey = (ev: KeyEvent): boolean | void => {
    if (editing) {
      if (ev.name === "escape") {
        setEditing(null);
        return true;
      }
      if (ev.name === "enter") {
        commitEdit();
        return true;
      }
      if (ev.name === "backspace") {
        setEditing({ ...editing, draft: editing.draft.slice(0, -1) });
        return true;
      }
      if (ev.name === "char" && ev.char && !ev.ctrl && !ev.alt) {
        setEditing({ ...editing, draft: editing.draft + ev.char });
        return true;
      }
      if (ev.name === "space") {
        setEditing({ ...editing, draft: `${editing.draft} ` });
        return true;
      }
      return true;
    }
    if (ev.name === "enter" && selected >= 0) {
      const editable = props.columns.find((c) => c.editable);
      if (editable) {
        beginEdit(selected, editable.id);
        return true;
      }
    }
    return false;
  };

  return h(
    "box",
    { direction: "column", onKey } as BoxProps,
    h(Table, {
      rows: props.rows,
      columns: columnsForRender,
      selected,
      onSelectChange: editing ? undefined : props.onSelectChange,
      onActivate: editing
        ? undefined
        : (index: number) => {
            const editable = props.columns.find((c) => c.editable);
            if (editable) beginEdit(index, editable.id);
          },
      height: props.height,
      width: props.width,
      sort: props.sort,
      onSortChange: props.onSortChange,
      zebra: props.zebra,
      rowKey: props.rowKey,
      accessibilityLabel: props.accessibilityLabel ?? "data grid",
      accessibilityDescription: props.accessibilityDescription,
    } as Record<string, unknown>),
  );
}
