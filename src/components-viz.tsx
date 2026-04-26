import { h } from "./runtime/element.js";
import type {
  AccessibilityProps,
  BoxProps,
  StyleLike,
  TextProps,
  ZenElement,
} from "./runtime/element.js";
import type { KeyEvent } from "./input/keys.js";
import { useEffect, useState, useTheme } from "./runtime/hooks.js";
import { style as styleRule } from "./style/index.js";
import {
  highlight,
  tokensByLine,
  type CodeLanguage,
  type CodeToken,
  type CodeTokenKind,
} from "./highlight/index.js";

/**
 * Visualization components: Code, JSONViewer, DiffView, LogStream.
 */

function mergeBoxStyle(base: StyleLike, override?: StyleLike): StyleLike {
  return override ? styleRule.merge(base, override) : base;
}

// -- <Code> -------------------------------------------------------------------
export interface CodeProps extends AccessibilityProps {
  /** Source text. */
  children: string;
  language?: CodeLanguage;
  /** Show 1-based line numbers. */
  showLineNumbers?: boolean;
  /** Highlight a specific 1-based line. */
  highlightLine?: number;
  /** Optional fixed height for scrolling. */
  height?: number;
  /** Optional fixed width. */
  width?: number;
  /** Wrap mode for over-long lines. Defaults to "truncate". */
  wrap?: TextProps["wrap"];
  style?: StyleLike;
}

export function Code(props: CodeProps): ZenElement {
  const theme = useTheme();
  const language = props.language ?? "plain";
  const tokens = highlight(props.children ?? "", language);
  const lineTokens = tokensByLine(tokens);
  const gutter = props.showLineNumbers ? Math.max(2, String(lineTokens.length).length) : 0;

  const lineNodes = lineTokens.map((line, index) => {
    const lineNumber = index + 1;
    const isHighlight = props.highlightLine === lineNumber;
    const spans: ZenElement[] = [];
    if (props.showLineNumbers) {
      spans.push(
        h(
          "text",
          {
            style: theme.code.comment,
          } as TextProps,
          `${String(lineNumber).padStart(gutter, " ")}  `,
        ),
      );
    }
    for (const [tokenIndex, token] of line.entries()) {
      spans.push(
        h(
          "text",
          {
            key: `${index}-${tokenIndex}`,
            style: tokenStyle(theme, token.kind),
          } as TextProps & { key: string },
          token.text,
        ),
      );
    }
    if (line.length === 0 && !props.showLineNumbers) {
      spans.push(h("text", {} as TextProps, " "));
    }
    return h(
      "box",
      {
        key: index,
        direction: "row",
        height: 1,
        style: isHighlight
          ? mergeBoxStyle(theme.code.base, { inverse: true } as StyleLike)
          : theme.code.base,
      } as BoxProps,
      spans,
    );
  });

  return h(
    "box",
    {
      direction: "column",
      width: props.width,
      height: props.height,
      style: mergeBoxStyle(theme.code.base, props.style),
      accessibilityLabel: props.accessibilityLabel ?? `${language} code block`,
      accessibilityDescription: props.accessibilityDescription,
    } as BoxProps,
    lineNodes,
  );
}

function tokenStyle(theme: ReturnType<typeof useTheme>, kind: CodeTokenKind) {
  switch (kind) {
    case "keyword":
      return theme.code.keyword;
    case "string":
      return theme.code.string;
    case "number":
      return theme.code.number;
    case "comment":
      return theme.code.comment;
    case "punctuation":
      return theme.code.punctuation;
    case "boolean":
      return theme.code.boolean;
    case "null":
      return theme.code.null;
    case "function":
      return theme.code.function;
    default:
      return theme.code.base;
  }
}

// -- <JSONViewer> ------------------------------------------------------------
export interface JSONViewerProps extends AccessibilityProps {
  value: unknown;
  /** Number of spaces per indent level. Defaults to 2. */
  indent?: number;
  /** Initial expand depth. -1 = all, 0 = collapsed root, etc. */
  defaultExpandDepth?: number;
  height?: number;
  width?: number;
}

interface JsonRow {
  /** Cell-perfect indentation prefix. */
  indent: string;
  /** Optional collapse marker glyph (▸ / ▾ / ""). */
  marker: string;
  /** Optional key, already string-quoted. */
  key?: string;
  /** Inline value tokens after the key. */
  value: CodeToken[];
  /** id for expand/collapse state. */
  path: string;
  /** True if this row owns expandable children. */
  expandable: boolean;
}

export function JSONViewer(props: JSONViewerProps): ZenElement {
  const indent = props.indent ?? 2;
  const initialDepth = props.defaultExpandDepth ?? 1;
  const [expanded, setExpanded] = useState<Record<string, boolean>>(() =>
    initialExpanded(props.value, initialDepth),
  );

  const rows: JsonRow[] = [];
  flattenJson(props.value, null, 0, indent, expanded, rows, "$");

  const theme = useTheme();
  const lineNodes = rows.map((row) =>
    h(
      "box",
      {
        key: row.path,
        direction: "row",
        height: 1,
        onClick: row.expandable
          ? () =>
              setExpanded((prev) => ({
                ...prev,
                [row.path]: !prev[row.path],
              }))
          : undefined,
      } as BoxProps,
      [
        h("text", { style: theme.code.comment } as TextProps, row.indent),
        h("text", { style: theme.code.punctuation } as TextProps, row.marker),
        row.key != null
          ? h("text", { style: theme.code.string } as TextProps, `${row.key}: `)
          : null,
        ...row.value.map((token, index) =>
          h(
            "text",
            {
              key: `${row.path}-v-${index}`,
              style: tokenStyle(theme, token.kind),
            } as TextProps & { key: string },
            token.text,
          ),
        ),
      ],
    ),
  );

  return h(
    "box",
    {
      focusable: true,
      direction: "column",
      width: props.width,
      height: props.height,
      style: theme.code.base,
      accessibilityLabel: props.accessibilityLabel ?? "JSON viewer",
      accessibilityDescription: props.accessibilityDescription,
    } as BoxProps,
    lineNodes,
  );
}

function flattenJson(
  value: unknown,
  key: string | null,
  depth: number,
  indent: number,
  expanded: Record<string, boolean>,
  out: JsonRow[],
  path: string,
): void {
  const pad = " ".repeat(depth * indent);
  if (Array.isArray(value)) {
    const isOpen = expanded[path] !== false;
    out.push({
      indent: pad,
      marker: isOpen ? "▾ " : "▸ ",
      key: key !== null ? quoteKey(key) : undefined,
      value: [{ kind: "punctuation", text: isOpen ? "[" : `[ … ] (${value.length})` }],
      path,
      expandable: value.length > 0,
    });
    if (isOpen && value.length > 0) {
      value.forEach((child, index) => {
        flattenJson(child, null, depth + 1, indent, expanded, out, `${path}.${index}`);
      });
      out.push({
        indent: pad,
        marker: "  ",
        value: [{ kind: "punctuation", text: "]" }],
        path: `${path}.close`,
        expandable: false,
      });
    }
    return;
  }
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>);
    const isOpen = expanded[path] !== false;
    out.push({
      indent: pad,
      marker: entries.length > 0 ? (isOpen ? "▾ " : "▸ ") : "  ",
      key: key !== null ? quoteKey(key) : undefined,
      value: [{ kind: "punctuation", text: isOpen ? "{" : `{ … } (${entries.length})` }],
      path,
      expandable: entries.length > 0,
    });
    if (isOpen && entries.length > 0) {
      for (const [childKey, childValue] of entries) {
        flattenJson(childValue, childKey, depth + 1, indent, expanded, out, `${path}.${childKey}`);
      }
      out.push({
        indent: pad,
        marker: "  ",
        value: [{ kind: "punctuation", text: "}" }],
        path: `${path}.close`,
        expandable: false,
      });
    }
    return;
  }
  // Primitive.
  out.push({
    indent: pad,
    marker: "  ",
    key: key !== null ? quoteKey(key) : undefined,
    value: primitiveTokens(value),
    path,
    expandable: false,
  });
}

function quoteKey(key: string): string {
  return `"${key}"`;
}

function primitiveTokens(value: unknown): CodeToken[] {
  if (value === null) return [{ kind: "null", text: "null" }];
  if (typeof value === "boolean") return [{ kind: "boolean", text: String(value) }];
  if (typeof value === "number") return [{ kind: "number", text: String(value) }];
  if (typeof value === "string") return [{ kind: "string", text: JSON.stringify(value) }];
  if (typeof value === "undefined") return [{ kind: "null", text: "undefined" }];
  return [{ kind: "base", text: String(value) }];
}

function initialExpanded(value: unknown, depth: number): Record<string, boolean> {
  const out: Record<string, boolean> = {};
  if (depth < 0) {
    walkPaths(value, "$", out, () => true);
    return out;
  }
  walkPaths(value, "$", out, (currentDepth) => currentDepth < depth);
  return out;
}

function walkPaths(
  value: unknown,
  path: string,
  out: Record<string, boolean>,
  predicate: (depth: number) => boolean,
  depth = 0,
): void {
  if (Array.isArray(value)) {
    out[path] = predicate(depth);
    value.forEach((child, index) =>
      walkPaths(child, `${path}.${index}`, out, predicate, depth + 1),
    );
    return;
  }
  if (value && typeof value === "object") {
    out[path] = predicate(depth);
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      walkPaths(v, `${path}.${k}`, out, predicate, depth + 1);
    }
  }
}

// -- <DiffView> --------------------------------------------------------------
export type DiffLineKind = "context" | "add" | "remove" | "hunk" | "meta";

export interface DiffLine {
  kind: DiffLineKind;
  text: string;
  /** Line number on the "before" side, when known. */
  oldLine?: number;
  /** Line number on the "after" side, when known. */
  newLine?: number;
}

export interface DiffViewProps extends AccessibilityProps {
  /** Pre-parsed lines. When `unified` is set, this is ignored. */
  lines?: readonly DiffLine[];
  /** Raw unified-diff text. Will be parsed. */
  unified?: string;
  showLineNumbers?: boolean;
  height?: number;
  width?: number;
}

export function DiffView(props: DiffViewProps): ZenElement {
  const theme = useTheme();
  const lines = props.unified ? parseUnifiedDiff(props.unified) : (props.lines ?? []);
  const gutterWidth = props.showLineNumbers
    ? Math.max(
        3,
        String(lines.reduce((m, l) => Math.max(m, l.newLine ?? l.oldLine ?? 0), 0)).length,
      )
    : 0;

  const rendered = lines.map((line, index) => {
    const style = styleForDiff(theme, line.kind);
    const segments: ZenElement[] = [];
    if (props.showLineNumbers) {
      segments.push(
        h(
          "text",
          {
            style: theme.diff.context,
          } as TextProps,
          `${pad(String(line.oldLine ?? ""), gutterWidth)} ${pad(
            String(line.newLine ?? ""),
            gutterWidth,
          )} `,
        ),
      );
    }
    segments.push(h("text", { wrap: "truncate", style } as TextProps, prefixGlyph(line)));
    segments.push(h("text", { wrap: "truncate", style } as TextProps, line.text));
    return h(
      "box",
      {
        key: index,
        direction: "row",
        height: 1,
        style,
      } as BoxProps,
      segments,
    );
  });

  return h(
    "box",
    {
      direction: "column",
      width: props.width,
      height: props.height,
      style: theme.diff.base,
      accessibilityLabel: props.accessibilityLabel ?? "diff view",
      accessibilityDescription: props.accessibilityDescription,
    } as BoxProps,
    rendered,
  );
}

function pad(value: string, width: number): string {
  if (value.length >= width) return value;
  return " ".repeat(width - value.length) + value;
}

function prefixGlyph(line: DiffLine): string {
  switch (line.kind) {
    case "add":
      return "+ ";
    case "remove":
      return "- ";
    case "hunk":
      return "  ";
    case "meta":
      return "  ";
    default:
      return "  ";
  }
}

function styleForDiff(theme: ReturnType<typeof useTheme>, kind: DiffLineKind) {
  switch (kind) {
    case "add":
      return theme.diff.add;
    case "remove":
      return theme.diff.remove;
    case "hunk":
      return theme.diff.hunk;
    case "meta":
      return theme.diff.meta;
    default:
      return theme.diff.context;
  }
}

export function parseUnifiedDiff(text: string): DiffLine[] {
  const out: DiffLine[] = [];
  let oldLine = 0;
  let newLine = 0;
  for (const raw of text.split("\n")) {
    if (raw.startsWith("@@")) {
      const match = /@@\s+-(\d+)(?:,\d+)?\s+\+(\d+)(?:,\d+)?\s+@@/.exec(raw);
      if (match) {
        oldLine = Number(match[1]);
        newLine = Number(match[2]);
      }
      out.push({ kind: "hunk", text: raw });
      continue;
    }
    if (
      raw.startsWith("diff ") ||
      raw.startsWith("index ") ||
      raw.startsWith("--- ") ||
      raw.startsWith("+++ ")
    ) {
      out.push({ kind: "meta", text: raw });
      continue;
    }
    if (raw.startsWith("+")) {
      out.push({ kind: "add", text: raw.slice(1), newLine });
      newLine++;
      continue;
    }
    if (raw.startsWith("-")) {
      out.push({ kind: "remove", text: raw.slice(1), oldLine });
      oldLine++;
      continue;
    }
    if (raw.length > 0 || out.length > 0) {
      out.push({
        kind: "context",
        text: raw.startsWith(" ") ? raw.slice(1) : raw,
        oldLine,
        newLine,
      });
      oldLine++;
      newLine++;
    }
  }
  return out;
}

// -- <LogStream> -------------------------------------------------------------
export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogEntry {
  id?: string | number;
  timestamp?: number;
  level?: LogLevel;
  message: string;
}

export interface LogStreamProps extends AccessibilityProps {
  entries: readonly LogEntry[];
  /** Visible rows. Defaults to all entries (no scroll). */
  height?: number;
  width?: number;
  /** Substring or RegExp filter. */
  filter?: string | RegExp;
  /** Show timestamps when present on entries. */
  showTimestamp?: boolean;
  /** Pause auto-scroll (still renders, but holds the current viewport). */
  paused?: boolean;
  /** Override level → glyph mapping. */
  levelGlyphs?: Partial<Record<LogLevel, string>>;
}

const DEFAULT_LEVEL_GLYPHS: Record<LogLevel, string> = {
  debug: "·",
  info: "i",
  warn: "!",
  error: "x",
};

export function LogStream(props: LogStreamProps): ZenElement {
  const theme = useTheme();
  const filtered = filterLogs(props.entries, props.filter);
  const height = props.height ?? filtered.length;
  const start = props.paused ? 0 : Math.max(0, filtered.length - height);
  const visible = filtered.slice(start, start + height);
  const glyphs = { ...DEFAULT_LEVEL_GLYPHS, ...(props.levelGlyphs ?? {}) };

  const rows = visible.map((entry, index) => {
    const segments: ZenElement[] = [];
    if (props.showTimestamp && entry.timestamp != null) {
      segments.push(
        h(
          "text",
          { style: theme.log.timestamp } as TextProps,
          `${formatTimestamp(entry.timestamp)} `,
        ),
      );
    }
    if (entry.level) {
      segments.push(
        h(
          "text",
          { style: levelStyle(theme, entry.level) } as TextProps,
          `${glyphs[entry.level]} `,
        ),
      );
    }
    segments.push(
      h(
        "text",
        { wrap: "truncate", style: levelStyle(theme, entry.level) } as TextProps,
        entry.message,
      ),
    );
    return h(
      "box",
      {
        key: entry.id ?? `${start + index}`,
        direction: "row",
        height: 1,
      } as BoxProps,
      segments,
    );
  });

  // Pad to height when paused or short so the viewport doesn't reflow.
  while (rows.length < (props.height ?? rows.length)) {
    rows.push(
      h(
        "box",
        { key: `pad-${rows.length}`, direction: "row", height: 1 } as BoxProps,
        h("text", { style: theme.log.base } as TextProps, ""),
      ),
    );
  }

  return h(
    "box",
    {
      direction: "column",
      width: props.width,
      height: props.height,
      style: theme.log.base,
      accessibilityLabel: props.accessibilityLabel ?? "log stream",
      accessibilityDescription: props.accessibilityDescription,
    } as BoxProps,
    rows,
  );
}

function filterLogs(entries: readonly LogEntry[], filter: string | RegExp | undefined): LogEntry[] {
  if (!filter) return [...entries];
  if (filter instanceof RegExp) {
    return entries.filter((entry) => filter.test(entry.message));
  }
  const needle = filter.toLowerCase();
  if (needle.length === 0) return [...entries];
  return entries.filter((entry) => entry.message.toLowerCase().includes(needle));
}

function levelStyle(theme: ReturnType<typeof useTheme>, level: LogLevel | undefined) {
  if (!level) return theme.log.base;
  switch (level) {
    case "debug":
      return theme.log.debug;
    case "info":
      return theme.log.info;
    case "warn":
      return theme.log.warn;
    case "error":
      return theme.log.error;
    default:
      return theme.log.base;
  }
}

function formatTimestamp(ts: number): string {
  const d = new Date(ts);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  const ss = String(d.getSeconds()).padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
}

// Re-export so consumers can build interactive log surfaces around the
// streaming primitive without depending on a separate hook module.
export { useEffect, useState };

// Suppress unused-import warnings for KeyEvent — it's exported for parity
// with components-data.tsx so future scroll/filter wiring lands without an
// import shuffle.
export type { KeyEvent };
