import { Rect } from "../layout/rect.js";
import { ScreenBuffer } from "../render/buffer.js";
import { ansi, DefaultStyle, Style } from "../render/style.js";
import { clipColumns, stringWidth, truncateColumns } from "../render/unicode.js";
import { collectInspectorWarnings } from "./diagnostics.js";
import type { BoxProps, InputProps, TextAreaProps, TextProps } from "./element.js";
import { textOf, type HostNode } from "./host.js";

interface InspectorLine {
  text: string;
  style: Style;
}

const panelStyle: Style = {
  ...DefaultStyle,
  fg: ansi(255),
  bg: ansi(236),
};

const frameStyle: Style = {
  ...panelStyle,
  fg: ansi(250),
};

const headerStyle: Style = {
  ...panelStyle,
  fg: ansi(117),
  bold: true,
};

const hintStyle: Style = {
  ...panelStyle,
  fg: ansi(244),
};

const focusStyle: Style = {
  ...panelStyle,
  fg: ansi(220),
  bold: true,
};

const detailStyle: Style = {
  ...panelStyle,
  fg: ansi(151),
};

const warningStyle: Style = {
  ...panelStyle,
  fg: ansi(216),
  bold: true,
};

const treeStyle: Style = {
  ...panelStyle,
  fg: ansi(252),
};

export function inspectTree(
  root: HostNode,
  focused: HostNode | null,
  events: readonly string[] = [],
  maxLines = Number.MAX_SAFE_INTEGER,
): string[] {
  const lines: string[] = [];
  const warnings = collectInspectorWarnings(root);
  lines.push("Inspector");
  lines.push("F12 toggle");
  if (focused) lines.push(`focus: ${describeNode(focused)}`);
  else lines.push("focus: (none)");
  if (focused) lines.push(`focus path: ${focusPath(focused)}`);
  lines.push(`warnings: ${warnings.length}`);
  for (const warning of warnings) lines.push(`! ${warning}`);
  if (events.length > 0) {
    lines.push("events:");
    for (const event of events.slice(-5)) lines.push(`  ${event}`);
  }
  lines.push("");
  collectTree(root, focused, 0, lines, maxLines);
  return lines.slice(0, maxLines);
}

export function paintInspector(
  buffer: ScreenBuffer,
  root: HostNode,
  focused: HostNode | null,
  events: readonly string[] = [],
): void {
  if (buffer.width < 28 || buffer.height < 8) return;

  const width = Math.min(Math.max(36, Math.floor(buffer.width * 0.45)), 58);
  const area = new Rect(buffer.width - width, 0, width, buffer.height);
  buffer.fill(area, " ", panelStyle);
  drawFrame(buffer, area);

  const content = area.inset(1);
  const lines = buildLines(root, focused, events, content.height);
  for (let i = 0; i < lines.length && i < content.height; i++) {
    buffer.writeText(
      content.x,
      content.y + i,
      truncate(lines[i]!.text, content.width),
      lines[i]!.style,
      content,
    );
  }
}

function buildLines(
  root: HostNode,
  focused: HostNode | null,
  events: readonly string[],
  height: number,
): InspectorLine[] {
  const raw = inspectTree(root, focused, events, Math.max(0, height));
  return raw.map((text, index) => {
    if (index === 0) return { text, style: headerStyle };
    if (index === 1) return { text, style: hintStyle };
    if (text.startsWith("focus:")) return { text, style: detailStyle };
    if (text.startsWith("focus path:")) return { text, style: detailStyle };
    if (text.startsWith("warnings:")) return { text, style: detailStyle };
    if (text.startsWith("events:")) return { text, style: detailStyle };
    if (text.startsWith("  ")) return { text, style: hintStyle };
    if (text.startsWith("!")) return { text, style: warningStyle };
    if (text.length === 0) return { text, style: panelStyle };
    if (text.startsWith(">")) return { text, style: focusStyle };
    return { text, style: treeStyle };
  });
}

function collectTree(
  node: HostNode,
  focused: HostNode | null,
  depth: number,
  out: string[],
  maxLines: number,
): void {
  if (out.length >= maxLines) return;
  const prefix = `${"  ".repeat(depth)}${node === focused ? ">" : "-"}`;
  out.push(`${prefix} ${describeNode(node)}`);
  for (const child of node.children) {
    if (out.length >= maxLines) return;
    collectTree(child, focused, depth + 1, out, maxLines);
  }
}

function describeNode(node: HostNode): string {
  const props = node.resolvedProps as Partial<BoxProps & TextProps & InputProps & TextAreaProps>;
  const parts = [
    node.type,
    `@${node.layout.x},${node.layout.y}`,
    `${node.layout.width}x${node.layout.height}`,
  ];

  if (node.type === "box") {
    if (node.hidden) parts.push("display=none");
    if (props.layout && props.layout !== "flex") parts.push(`layout=${props.layout}`);
    if (props.title) parts.push(`title=${quote(String(props.title))}`);
    if (props.direction) parts.push(`dir=${props.direction}`);
    if (props.dock) parts.push(`dock=${props.dock}`);
    if (props.position) parts.push(`pos=${props.position}`);
    if (props.border) parts.push("border");
    if (props.focusable) parts.push("focusable");
    if (props.aspectRatio) parts.push(`ratio=${props.aspectRatio}`);
    const constraints = describeConstraints(props);
    if (constraints) parts.push(constraints);
  } else if (node.type === "text") {
    const text = preview(textOf(props.children));
    if (text) parts.push(quote(text));
  } else if (node.type === "input" || node.type === "textarea") {
    parts.push(`value=${quote(preview(String(props.value ?? "")))}`);
  }

  if (props.accessibilityLabel) {
    parts.push(`a11y=${quote(preview(props.accessibilityLabel))}`);
  }
  if (props.accessibilityDescription) {
    parts.push(`desc=${quote(preview(props.accessibilityDescription))}`);
  }

  const fiber = node.fiber;
  if (fiber.renderCount > 0) {
    parts.push(`renders=${fiber.renderCount}`);
    if (fiber.lastRenderMs >= 8) parts.push(`slow=${fiber.lastRenderMs.toFixed(1)}ms`);
  }

  return parts.join(" ");
}

function describeConstraints(props: Partial<BoxProps>): string {
  const parts: string[] = [];
  if (props.minWidth != null || props.maxWidth != null) {
    parts.push(`w=${props.minWidth ?? ""}..${props.maxWidth ?? ""}`);
  }
  if (props.minHeight != null || props.maxHeight != null) {
    parts.push(`h=${props.minHeight ?? ""}..${props.maxHeight ?? ""}`);
  }
  return parts.length > 0 ? `constraints(${parts.join(" ")})` : "";
}

function focusPath(node: HostNode): string {
  const names: string[] = [];
  for (let current: HostNode | null = node; current; current = current.parent) {
    names.push(current.type);
  }
  return names.reverse().join(" > ");
}

function drawFrame(buffer: ScreenBuffer, area: Rect): void {
  if (area.width < 2 || area.height < 2) return;
  const x2 = area.right - 1;
  const y2 = area.bottom - 1;
  buffer.set(area.x, area.y, { char: "┌", style: frameStyle, width: 1 });
  buffer.set(x2, area.y, { char: "┐", style: frameStyle, width: 1 });
  buffer.set(area.x, y2, { char: "└", style: frameStyle, width: 1 });
  buffer.set(x2, y2, { char: "┘", style: frameStyle, width: 1 });

  for (let x = area.x + 1; x < x2; x++) {
    buffer.set(x, area.y, { char: "─", style: frameStyle, width: 1 });
    buffer.set(x, y2, { char: "─", style: frameStyle, width: 1 });
  }

  for (let y = area.y + 1; y < y2; y++) {
    buffer.set(area.x, y, { char: "│", style: frameStyle, width: 1 });
    buffer.set(x2, y, { char: "│", style: frameStyle, width: 1 });
  }
}

function quote(value: string): string {
  return `"${value}"`;
}

function preview(value: string): string {
  value = value.replace(/\n/g, "↵");
  if (value.length === 0) return "";
  return truncateColumns(value, 20);
}

function truncate(value: string, width: number): string {
  if (stringWidth(value) <= width) return value;
  if (width <= 1) return clipColumns("…", width);
  return truncateColumns(value, width);
}
