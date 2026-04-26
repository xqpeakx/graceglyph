/**
 * Tiny syntax highlighter. Returns a flat list of token spans for the
 * languages we ship out of the box (json, javascript / typescript, plain).
 * The output is intentionally coarse — this is for in-terminal token
 * coloring, not an editor-grade lexer.
 */

export type CodeLanguage = "json" | "javascript" | "typescript" | "plain";

export type CodeTokenKind =
  | "keyword"
  | "string"
  | "number"
  | "comment"
  | "punctuation"
  | "boolean"
  | "null"
  | "function"
  | "base";

export interface CodeToken {
  kind: CodeTokenKind;
  text: string;
}

const JS_KEYWORDS = new Set([
  "as",
  "async",
  "await",
  "break",
  "case",
  "catch",
  "class",
  "const",
  "continue",
  "debugger",
  "default",
  "delete",
  "do",
  "else",
  "enum",
  "export",
  "extends",
  "finally",
  "for",
  "from",
  "function",
  "if",
  "implements",
  "import",
  "in",
  "instanceof",
  "interface",
  "let",
  "new",
  "of",
  "private",
  "protected",
  "public",
  "readonly",
  "return",
  "satisfies",
  "static",
  "super",
  "switch",
  "this",
  "throw",
  "try",
  "type",
  "typeof",
  "var",
  "void",
  "while",
  "with",
  "yield",
]);

const JS_BOOLEANS = new Set(["true", "false"]);
const JS_NULLS = new Set(["null", "undefined"]);

export function highlight(source: string, language: CodeLanguage): CodeToken[] {
  switch (language) {
    case "json":
      return highlightJson(source);
    case "javascript":
    case "typescript":
      return highlightJs(source);
    default:
      return [{ kind: "base", text: source }];
  }
}

// -- JSON ---------------------------------------------------------------------

function highlightJson(source: string): CodeToken[] {
  const out: CodeToken[] = [];
  let i = 0;
  while (i < source.length) {
    const ch = source[i]!;
    if (ch === '"') {
      const start = i;
      i++;
      while (i < source.length && source[i] !== '"') {
        if (source[i] === "\\" && i + 1 < source.length) i += 2;
        else i++;
      }
      i = Math.min(source.length, i + 1);
      out.push({ kind: "string", text: source.slice(start, i) });
      continue;
    }
    if (/[\d-]/.test(ch) && (ch !== "-" || /\d/.test(source[i + 1] ?? ""))) {
      const start = i;
      while (i < source.length && /[-+\d.eE]/.test(source[i]!)) i++;
      out.push({ kind: "number", text: source.slice(start, i) });
      continue;
    }
    if (/[a-z]/.test(ch)) {
      const start = i;
      while (i < source.length && /[a-z]/.test(source[i]!)) i++;
      const word = source.slice(start, i);
      if (JS_BOOLEANS.has(word)) out.push({ kind: "boolean", text: word });
      else if (word === "null") out.push({ kind: "null", text: word });
      else out.push({ kind: "base", text: word });
      continue;
    }
    if ("{}[],:".includes(ch)) {
      out.push({ kind: "punctuation", text: ch });
      i++;
      continue;
    }
    // whitespace and other glyphs flow through as base.
    const start = i;
    while (i < source.length && !/[\s"\d{}[\],:a-z-]/.test(source[i]!)) i++;
    if (i === start) {
      out.push({ kind: "base", text: ch });
      i++;
    } else {
      out.push({ kind: "base", text: source.slice(start, i) });
    }
    while (i < source.length && /\s/.test(source[i]!)) {
      out.push({ kind: "base", text: source[i]! });
      i++;
    }
  }
  return mergeAdjacent(out);
}

// -- JavaScript / TypeScript -------------------------------------------------

function highlightJs(source: string): CodeToken[] {
  const out: CodeToken[] = [];
  let i = 0;
  while (i < source.length) {
    const ch = source[i]!;
    const next = source[i + 1] ?? "";

    // Line comment.
    if (ch === "/" && next === "/") {
      const start = i;
      while (i < source.length && source[i] !== "\n") i++;
      out.push({ kind: "comment", text: source.slice(start, i) });
      continue;
    }
    // Block comment.
    if (ch === "/" && next === "*") {
      const start = i;
      i += 2;
      while (i < source.length && !(source[i] === "*" && source[i + 1] === "/")) i++;
      i = Math.min(source.length, i + 2);
      out.push({ kind: "comment", text: source.slice(start, i) });
      continue;
    }
    // String — single, double, or template (no interpolation parsing).
    if (ch === '"' || ch === "'" || ch === "`") {
      const quote = ch;
      const start = i;
      i++;
      while (i < source.length && source[i] !== quote) {
        if (source[i] === "\\" && i + 1 < source.length) i += 2;
        else i++;
      }
      i = Math.min(source.length, i + 1);
      out.push({ kind: "string", text: source.slice(start, i) });
      continue;
    }
    // Number.
    if (/[\d]/.test(ch) || (ch === "." && /\d/.test(next))) {
      const start = i;
      while (i < source.length && /[\d._eExXoObBnA-F]/.test(source[i]!)) i++;
      out.push({ kind: "number", text: source.slice(start, i) });
      continue;
    }
    // Identifier / keyword.
    if (/[A-Za-z_$]/.test(ch)) {
      const start = i;
      while (i < source.length && /[A-Za-z0-9_$]/.test(source[i]!)) i++;
      const word = source.slice(start, i);
      if (JS_KEYWORDS.has(word)) out.push({ kind: "keyword", text: word });
      else if (JS_BOOLEANS.has(word)) out.push({ kind: "boolean", text: word });
      else if (JS_NULLS.has(word)) out.push({ kind: "null", text: word });
      else if (source[i] === "(") out.push({ kind: "function", text: word });
      else out.push({ kind: "base", text: word });
      continue;
    }
    // Punctuation cluster.
    if (/[(){}[\];,.:?!=<>+\-*/%&|^~]/.test(ch)) {
      out.push({ kind: "punctuation", text: ch });
      i++;
      continue;
    }
    out.push({ kind: "base", text: ch });
    i++;
  }
  return mergeAdjacent(out);
}

function mergeAdjacent(tokens: CodeToken[]): CodeToken[] {
  const out: CodeToken[] = [];
  for (const token of tokens) {
    const prev = out[out.length - 1];
    if (prev && prev.kind === token.kind) {
      prev.text += token.text;
    } else {
      out.push({ ...token });
    }
  }
  return out;
}

/**
 * Split tokens at newline boundaries. Consumers render line-by-line.
 */
export function tokensByLine(tokens: readonly CodeToken[]): CodeToken[][] {
  const lines: CodeToken[][] = [[]];
  for (const token of tokens) {
    const parts = token.text.split("\n");
    parts.forEach((part, index) => {
      if (part.length > 0) lines[lines.length - 1]!.push({ kind: token.kind, text: part });
      if (index < parts.length - 1) lines.push([]);
    });
  }
  return lines;
}
