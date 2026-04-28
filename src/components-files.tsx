import { h } from "./runtime/element.js";
import type {
  AccessibilityProps,
  BoxProps,
  StyleLike,
  TextProps,
  ZenElement,
} from "./runtime/element.js";
import { useState, useTheme } from "./runtime/hooks.js";
import { style as styleRule } from "./style/index.js";
import { List } from "./components.js";

function mergeBoxStyle(base: StyleLike, override?: StyleLike): StyleLike {
  return override ? styleRule.merge(base, override) : base;
}

// -- <PathBreadcrumbs> -------------------------------------------------------
export interface PathBreadcrumbsProps extends AccessibilityProps {
  /** Filesystem-style path or URL fragment. */
  path: string;
  /** Optional separator override. Defaults to "/" or " ›  ". */
  separator?: string;
  /** Click handler for each path segment, receives full prefix path. */
  onSelect?: (segmentPath: string) => void;
  style?: StyleLike;
  separatorStyle?: StyleLike;
}

export function PathBreadcrumbs(props: PathBreadcrumbsProps): ZenElement {
  const theme = useTheme();
  const sep = props.separator ?? "/";
  const segments = splitPath(props.path);
  const items: ZenElement[] = [];
  let prefix = props.path.startsWith("/") ? "/" : "";
  segments.forEach((segment, i) => {
    if (i > 0) {
      items.push(
        h(
          "text",
          {
            key: `sep-${i}`,
            style: mergeBoxStyle(theme.formField.description, props.separatorStyle),
          } as TextProps & { key: string },
          ` ${sep} `,
        ),
      );
    }
    const fullPath = prefix === "/" ? `/${segment}` : prefix.length === 0 ? segment : `${prefix}${sep}${segment}`;
    prefix = fullPath;
    items.push(
      h(
        "text",
        {
          key: `seg-${i}-${segment}`,
          style: mergeBoxStyle(theme.link.normal, props.style),
          onClick: props.onSelect ? () => props.onSelect?.(fullPath) : undefined,
        } as TextProps & { key: string; onClick?: () => void },
        segment,
      ),
    );
  });
  return h(
    "box",
    {
      direction: "row",
      accessibilityLabel: props.accessibilityLabel ?? props.path,
      accessibilityDescription: props.accessibilityDescription,
    } as BoxProps,
    items,
  );
}

function splitPath(path: string): string[] {
  return path.split(/[\\/]+/).filter((s) => s.length > 0);
}

// -- <FilePicker> -----------------------------------------------------------
export interface FileEntry {
  name: string;
  /** Children load lazily. Provide `loader` for async expansion. */
  children?: readonly FileEntry[];
  loader?: () => Promise<readonly FileEntry[]>;
  /** Marks the entry as a leaf (file). */
  isFile?: boolean;
  /** Optional metadata rendered next to the row. */
  badge?: string;
}

export interface FilePickerProps extends AccessibilityProps {
  /** Root entries — usually a single directory. */
  entries: readonly FileEntry[];
  /** Selected path, joined by "/". */
  selectedPath?: string;
  onSelect?: (path: string, entry: FileEntry) => void;
  /** Optional substring filter applied to entry names. */
  filter?: string;
  /** Visible rows. Defaults to 12. */
  height?: number;
  width?: number;
  showHidden?: boolean;
  style?: StyleLike;
}

interface FlatEntry {
  entry: FileEntry;
  depth: number;
  path: string;
}

export function FilePicker(props: FilePickerProps): ZenElement {
  const theme = useTheme();
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const flat = flattenEntries(props.entries, expanded, "", props.showHidden ?? false);
  const filtered = props.filter
    ? flat.filter((row) => row.entry.name.toLowerCase().includes(props.filter!.toLowerCase()))
    : flat;
  const [selected, setSelected] = useState(0);
  const height = props.height ?? Math.min(12, filtered.length || 1);

  function activate(index: number): void {
    const row = filtered[index];
    if (!row) return;
    if (row.entry.isFile || (!row.entry.children && !row.entry.loader)) {
      props.onSelect?.(row.path, row.entry);
      return;
    }
    setExpanded((prev) => ({ ...prev, [row.path]: !prev[row.path] }));
  }

  return h(
    "box",
    {
      direction: "column",
      width: props.width,
      accessibilityLabel: props.accessibilityLabel ?? "file picker",
      accessibilityDescription: props.accessibilityDescription,
      style: props.style,
    } as BoxProps,
    h(List, {
      items: filtered,
      selected,
      onChange: setSelected,
      onSelect: (i: number) => activate(i),
      height,
      render: (row: FlatEntry, _index: number, isSel: boolean) => {
        const indent = " ".repeat(row.depth * 2);
        const glyph = row.entry.isFile
          ? "·"
          : expanded[row.path]
            ? "▾"
            : "▸";
        const badge = row.entry.badge ? ` ${row.entry.badge}` : "";
        return h(
          "text",
          {
            wrap: "truncate",
            style: isSel ? theme.list.selected : theme.list.normal,
          } as TextProps,
          `${indent}${glyph} ${row.entry.name}${badge}`,
        );
      },
    } as Record<string, unknown>),
  );
}

function flattenEntries(
  entries: readonly FileEntry[],
  expanded: Record<string, boolean>,
  prefix: string,
  showHidden: boolean,
  depth = 0,
  out: FlatEntry[] = [],
): FlatEntry[] {
  for (const entry of entries) {
    if (!showHidden && entry.name.startsWith(".")) continue;
    const path = prefix.length === 0 ? entry.name : `${prefix}/${entry.name}`;
    out.push({ entry, depth, path });
    if (entry.children && expanded[path]) {
      flattenEntries(entry.children, expanded, path, showHidden, depth + 1, out);
    }
  }
  return out;
}
