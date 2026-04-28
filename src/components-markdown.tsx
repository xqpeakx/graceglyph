import { h } from "./runtime/element.js";
import type {
  AccessibilityProps,
  BoxProps,
  StyleLike,
  TextProps,
  ZenElement,
} from "./runtime/element.js";
import { useTheme } from "./runtime/hooks.js";
import { style as styleRule } from "./style/index.js";
import { Code } from "./components-viz.js";
import type { CodeLanguage } from "./highlight/index.js";

function mergeBoxStyle(base: StyleLike, override?: StyleLike): StyleLike {
  return override ? styleRule.merge(base, override) : base;
}

/**
 * Tiny markdown renderer. Handles headings, bold/italic/code spans, fenced
 * code blocks (with optional language), unordered + ordered lists, block
 * quotes, and inline links. Anything else passes through as plain text.
 *
 * Intentionally narrow scope — full CommonMark + GFM lives in a future
 * `@graceglyph/markdown` plugin (see roadmap §14).
 */

export interface MarkdownProps extends AccessibilityProps {
  children: string;
  width?: number;
  style?: StyleLike;
}

export function Markdown(props: MarkdownProps): ZenElement {
  const theme = useTheme();
  const blocks = parseMarkdown(props.children ?? "");
  const nodes: ZenElement[] = [];
  for (const block of blocks) {
    if (block.kind === "heading") {
      nodes.push(
        h(
          "text",
          {
            key: nodes.length,
            style: mergeBoxStyle(theme.window.title, {
              bold: true,
            } as StyleLike),
          } as TextProps & { key: number },
          `${"#".repeat(block.level)} ${block.text}`,
        ),
      );
      continue;
    }
    if (block.kind === "code") {
      nodes.push(
        h(Code, {
          key: nodes.length,
          children: block.code,
          language: (block.language as CodeLanguage) ?? "plain",
        } as Record<string, unknown>),
      );
      continue;
    }
    if (block.kind === "quote") {
      nodes.push(
        h(
          "box",
          { key: nodes.length, direction: "row", padding: [0, 1] } as BoxProps & { key: number },
          h("text", { style: { dim: true } as StyleLike } as TextProps, `▌ ${block.text}`),
        ),
      );
      continue;
    }
    if (block.kind === "ul" || block.kind === "ol") {
      block.items.forEach((item, i) => {
        const bullet = block.kind === "ol" ? `${i + 1}.` : "•";
        nodes.push(
          h(
            "box",
            { key: `${nodes.length}-${i}`, direction: "row" } as BoxProps & { key: string },
            [
              h("text", { style: { dim: true } as StyleLike } as TextProps, ` ${bullet} `),
              renderInline(item),
            ],
          ),
        );
      });
      continue;
    }
    if (block.kind === "paragraph") {
      nodes.push(
        h(
          "box",
          { key: nodes.length, direction: "row" } as BoxProps & { key: number },
          renderInline(block.text),
        ),
      );
      continue;
    }
    if (block.kind === "rule") {
      nodes.push(
        h(
          "text",
          { key: nodes.length, style: theme.divider } as TextProps & { key: number },
          "─".repeat(props.width ?? 40),
        ),
      );
    }
  }
  return h(
    "box",
    {
      direction: "column",
      gap: 0,
      width: props.width,
      style: props.style,
      accessibilityLabel: props.accessibilityLabel,
      accessibilityDescription: props.accessibilityDescription,
    } as BoxProps,
    nodes,
  );
}

// -- inline rendering --------------------------------------------------------

function renderInline(text: string): ZenElement {
  const tokens = tokenizeInline(text);
  return h("text", { wrap: "truncate" } as TextProps, tokens.map((t) => t.text).join(""));
}

interface InlineToken {
  kind: "text" | "bold" | "italic" | "code" | "link";
  text: string;
}

function tokenizeInline(input: string): InlineToken[] {
  const out: InlineToken[] = [];
  let i = 0;
  while (i < input.length) {
    if (input.startsWith("**", i)) {
      const end = input.indexOf("**", i + 2);
      if (end !== -1) {
        out.push({ kind: "bold", text: input.slice(i + 2, end) });
        i = end + 2;
        continue;
      }
    }
    if (input[i] === "*") {
      const end = input.indexOf("*", i + 1);
      if (end !== -1) {
        out.push({ kind: "italic", text: input.slice(i + 1, end) });
        i = end + 1;
        continue;
      }
    }
    if (input[i] === "`") {
      const end = input.indexOf("`", i + 1);
      if (end !== -1) {
        out.push({ kind: "code", text: input.slice(i + 1, end) });
        i = end + 1;
        continue;
      }
    }
    if (input[i] === "[") {
      const close = input.indexOf("]", i + 1);
      const open = input.indexOf("(", close + 1);
      const closeUrl = input.indexOf(")", open + 1);
      if (close !== -1 && open === close + 1 && closeUrl !== -1) {
        const label = input.slice(i + 1, close);
        out.push({ kind: "link", text: label });
        i = closeUrl + 1;
        continue;
      }
    }
    out.push({ kind: "text", text: input[i]! });
    i += 1;
  }
  return mergeText(out);
}

function mergeText(tokens: InlineToken[]): InlineToken[] {
  const out: InlineToken[] = [];
  for (const token of tokens) {
    const prev = out[out.length - 1];
    if (prev && prev.kind === "text" && token.kind === "text") {
      prev.text += token.text;
    } else {
      out.push({ ...token });
    }
  }
  return out;
}

// -- block parser ------------------------------------------------------------

type Block =
  | { kind: "heading"; level: number; text: string }
  | { kind: "paragraph"; text: string }
  | { kind: "code"; language?: string; code: string }
  | { kind: "quote"; text: string }
  | { kind: "ul"; items: string[] }
  | { kind: "ol"; items: string[] }
  | { kind: "rule" };

export function parseMarkdown(input: string): Block[] {
  const lines = input.split("\n");
  const blocks: Block[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i]!;
    if (line.trim().length === 0) {
      i++;
      continue;
    }
    const heading = /^(#{1,6})\s+(.*)$/.exec(line);
    if (heading) {
      blocks.push({ kind: "heading", level: heading[1]!.length, text: heading[2]! });
      i++;
      continue;
    }
    if (line.startsWith("```")) {
      const language = line.slice(3).trim() || undefined;
      const buf: string[] = [];
      i++;
      while (i < lines.length && !lines[i]!.startsWith("```")) {
        buf.push(lines[i]!);
        i++;
      }
      if (i < lines.length) i++;
      blocks.push({ kind: "code", language, code: buf.join("\n") });
      continue;
    }
    if (/^[-*_]{3,}\s*$/.test(line)) {
      blocks.push({ kind: "rule" });
      i++;
      continue;
    }
    if (line.startsWith("> ")) {
      const buf: string[] = [line.slice(2)];
      i++;
      while (i < lines.length && lines[i]!.startsWith("> ")) {
        buf.push(lines[i]!.slice(2));
        i++;
      }
      blocks.push({ kind: "quote", text: buf.join(" ") });
      continue;
    }
    if (/^\s*[-*+]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*+]\s+/.test(lines[i]!)) {
        items.push(lines[i]!.replace(/^\s*[-*+]\s+/, ""));
        i++;
      }
      blocks.push({ kind: "ul", items });
      continue;
    }
    if (/^\s*\d+\.\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i]!)) {
        items.push(lines[i]!.replace(/^\s*\d+\.\s+/, ""));
        i++;
      }
      blocks.push({ kind: "ol", items });
      continue;
    }
    // Paragraph: greedy until blank line.
    const buf: string[] = [line];
    i++;
    while (
      i < lines.length &&
      lines[i]!.trim().length > 0 &&
      !/^(#{1,6}\s|>\s|```|\s*[-*+]\s|\s*\d+\.\s)/.test(lines[i]!)
    ) {
      buf.push(lines[i]!);
      i++;
    }
    blocks.push({ kind: "paragraph", text: buf.join(" ") });
  }
  return blocks;
}
