import type { HostNode } from "./host.js";
import type {
  BoxProps,
  BoxStyle,
  Edges,
  ElementType,
  HostType,
  InputProps,
  TextAreaProps,
  TextProps,
} from "./element.js";
import type { Fiber } from "./fiber.js";
import { stringWidth } from "../render/unicode.js";
import { textOf } from "./host.js";

const FIBER_SYMBOL = Symbol.for("graceglyph.diagnostics.fiber");

type DiagnosticProps = Partial<BoxProps & TextProps & InputProps & TextAreaProps>;

export function attachFiberToError(error: unknown, fiber: Fiber): void {
  if (!isObject(error)) return;
  if (FIBER_SYMBOL in error) return;
  Object.defineProperty(error, FIBER_SYMBOL, {
    value: fiber,
    configurable: true,
  });
}

export function fiberForError(error: unknown): Fiber | null {
  if (!isObject(error) || !(FIBER_SYMBOL in error)) return null;
  return (error as Record<PropertyKey, unknown>)[FIBER_SYMBOL] as Fiber | null;
}

export function formatComponentStack(fiber: Fiber | null): string {
  if (!fiber) return "";
  const lines: string[] = [];
  for (let current: Fiber | null = fiber; current; current = current.parent) {
    lines.push(`  in ${elementTypeName(current.type)}`);
  }
  return ["Component stack:", ...lines].join("\n");
}

export function validateHostFiberProps(fiber: Fiber): void {
  if (typeof fiber.type !== "string") return;
  const type = fiber.type as HostType;
  const props = fiber.props as DiagnosticProps;

  switch (type) {
    case "box":
      validateBoxProps(fiber, props);
      return;
    case "text":
      validateTextProps(fiber, props);
      return;
    case "input":
      validateInputProps(fiber, props);
      return;
    case "textarea":
      validateTextAreaProps(fiber, props);
      return;
  }
}

export function collectInspectorWarnings(root: HostNode): string[] {
  const warnings: string[] = [];
  collectNodeWarnings(root, null, warnings);
  return warnings;
}

function collectNodeWarnings(node: HostNode, parent: HostNode | null, out: string[]): void {
  const props = node.props as DiagnosticProps;
  const location = `${node.type} @${node.layout.x},${node.layout.y}`;

  if (parent && !parent.layout.contains(node.layout.x, node.layout.y)) {
    out.push(`${location} starts outside parent bounds`);
  }
  if (parent && (node.layout.right > parent.layout.right || node.layout.bottom > parent.layout.bottom)) {
    out.push(`${location} overflows parent bounds`);
  }

  const requestedWidth = typeof props.width === "number" ? props.width : null;
  if (requestedWidth !== null && node.layout.width < requestedWidth) {
    out.push(`${location} width clipped from ${requestedWidth} to ${node.layout.width}`);
  }

  const requestedHeight = typeof props.height === "number" ? props.height : null;
  if (requestedHeight !== null && node.layout.height < requestedHeight) {
    out.push(`${location} height clipped from ${requestedHeight} to ${node.layout.height}`);
  }

  if (node.layout.width === 0 || node.layout.height === 0) {
    const hasTextContent = node.type === "text" && textOf(props.children).length > 0;
    if (node.children.length > 0 || requestedWidth !== null || requestedHeight !== null || props.grow || hasTextContent) {
      out.push(`${location} collapsed to ${node.layout.width}x${node.layout.height}`);
    }
  }

  if (node.type === "box") {
    if (props.title) {
      const titleWidth = stringWidth(` ${String(props.title)} `);
      const maxWidth = Math.max(0, node.layout.width - 4);
      if (titleWidth > maxWidth) {
        out.push(`${location} title is truncated to fit the border`);
      }
    }

    const inner = innerSpace(node.layout, props);
    if (node.children.length > 0 && (inner.width === 0 || inner.height === 0)) {
      out.push(`${location} has no inner space left for children`);
    }
  }

  for (const child of node.children) collectNodeWarnings(child, node, out);
}

function innerSpace(layout: { width: number; height: number }, props: DiagnosticProps): { width: number; height: number } {
  const pad = expandEdges(props.padding);
  const border = props.border ? 1 : 0;
  return {
    width: Math.max(0, layout.width - pad.left - pad.right - border * 2),
    height: Math.max(0, layout.height - pad.top - pad.bottom - border * 2),
  };
}

function validateBoxProps(fiber: Fiber, props: DiagnosticProps): void {
  validateOptionalEnum(fiber, "direction", props.direction, ["row", "column"]);
  validateOptionalEnum(fiber, "align", props.align, ["start", "center", "end", "stretch"]);
  validateOptionalEnum(fiber, "justify", props.justify, ["start", "center", "end", "between", "around"]);
  validateOptionalInteger(fiber, "gap", props.gap);
  validateOptionalInteger(fiber, "width", props.width);
  validateOptionalInteger(fiber, "height", props.height);
  validateOptionalNumber(fiber, "grow", props.grow);
  validateOptionalBoolean(fiber, "border", props.border);
  validateOptionalBoolean(fiber, "focusable", props.focusable);
  validateOptionalBoolean(fiber, "overlay", props.overlay);
  validateOptionalBoolean(fiber, "disabled", props.disabled);
  validateOptionalBoolean(fiber, "loading", props.loading);
  validateOptionalBoolean(fiber, "error", props.error);
  validateOptionalEnum(fiber, "focusScope", props.focusScope, ["contain"]);
  validateOptionalString(fiber, "title", props.title);
  validateOptionalFunction(fiber, "onKey", props.onKey);
  validateOptionalFunction(fiber, "onMouse", props.onMouse);
  validateOptionalFunction(fiber, "onClick", props.onClick);
  validateOptionalFunction(fiber, "onFocus", props.onFocus);
  validateOptionalFunction(fiber, "onBlur", props.onBlur);
  validateOptionalPadding(fiber, props.padding);
  validateOptionalStyle(fiber, props.style);
  validateOptionalStyle(fiber, props.focusedStyle);
  validateOptionalStyle(fiber, props.hoveredStyle);
  validateOptionalStyle(fiber, props.activeStyle);
  validateOptionalStyle(fiber, props.disabledStyle);
  validateOptionalStyle(fiber, props.loadingStyle);
  validateOptionalStyle(fiber, props.errorStyle);
  validateOptionalStyle(fiber, props.borderStyle);
  validateOptionalStyle(fiber, props.titleStyle);
  if (props.title !== undefined && props.border !== true) {
    throw invalidPropError(fiber, "title", "a string only when border={true}", props.title);
  }
}

function validateTextProps(fiber: Fiber, props: DiagnosticProps): void {
  validateOptionalEnum(fiber, "wrap", props.wrap, ["truncate", "clip"]);
  validateOptionalStyle(fiber, props.style);
}

function validateInputProps(fiber: Fiber, props: DiagnosticProps): void {
  validateRequiredString(fiber, "value", props.value);
  validateRequiredFunction(fiber, "onChange", props.onChange);
  validateOptionalString(fiber, "placeholder", props.placeholder);
  validateOptionalFunction(fiber, "onSubmit", props.onSubmit);
  validateOptionalFunction(fiber, "onFocus", props.onFocus);
  validateOptionalFunction(fiber, "onBlur", props.onBlur);
  validateOptionalInteger(fiber, "width", props.width);
  validateOptionalNumber(fiber, "grow", props.grow);
  validateOptionalBoolean(fiber, "disabled", props.disabled);
  validateOptionalBoolean(fiber, "loading", props.loading);
  validateOptionalBoolean(fiber, "error", props.error);
  validateOptionalStyle(fiber, props.style);
  validateOptionalStyle(fiber, props.focusedStyle);
  validateOptionalStyle(fiber, props.hoveredStyle);
  validateOptionalStyle(fiber, props.activeStyle);
  validateOptionalStyle(fiber, props.disabledStyle);
  validateOptionalStyle(fiber, props.loadingStyle);
  validateOptionalStyle(fiber, props.errorStyle);
  validateOptionalStyle(fiber, props.placeholderStyle);
  if (props.children !== undefined) {
    throw invalidPropError(fiber, "children", "undefined", props.children);
  }
}

function validateTextAreaProps(fiber: Fiber, props: DiagnosticProps): void {
  validateRequiredString(fiber, "value", props.value);
  validateRequiredFunction(fiber, "onChange", props.onChange);
  validateOptionalString(fiber, "placeholder", props.placeholder);
  validateOptionalFunction(fiber, "onFocus", props.onFocus);
  validateOptionalFunction(fiber, "onBlur", props.onBlur);
  validateOptionalInteger(fiber, "width", props.width);
  validateOptionalInteger(fiber, "height", props.height);
  validateOptionalNumber(fiber, "grow", props.grow);
  validateOptionalBoolean(fiber, "disabled", props.disabled);
  validateOptionalBoolean(fiber, "loading", props.loading);
  validateOptionalBoolean(fiber, "error", props.error);
  validateOptionalStyle(fiber, props.style);
  validateOptionalStyle(fiber, props.focusedStyle);
  validateOptionalStyle(fiber, props.hoveredStyle);
  validateOptionalStyle(fiber, props.activeStyle);
  validateOptionalStyle(fiber, props.disabledStyle);
  validateOptionalStyle(fiber, props.loadingStyle);
  validateOptionalStyle(fiber, props.errorStyle);
  validateOptionalStyle(fiber, props.placeholderStyle);
  if (props.children !== undefined) {
    throw invalidPropError(fiber, "children", "undefined", props.children);
  }
}

function validateOptionalPadding(fiber: Fiber, padding: Edges | undefined): void {
  if (padding === undefined) return;
  if (typeof padding === "number") {
    validateNumberValue(fiber, "padding", padding, true);
    return;
  }
  if (!Array.isArray(padding) || (padding.length !== 2 && padding.length !== 4)) {
    throw invalidPropError(fiber, "padding", "a number, [vertical, horizontal], or [top, right, bottom, left]", padding);
  }
  for (const value of padding) validateNumberValue(fiber, "padding", value, true);
}

function validateOptionalStyle(fiber: Fiber, style: BoxStyle | undefined): void {
  if (style === undefined) return;
  if (!isObject(style)) {
    throw invalidPropError(fiber, "style", "an object", style);
  }
  validateOptionalBoolean(fiber, "style.bold", style.bold);
  validateOptionalBoolean(fiber, "style.dim", style.dim);
  validateOptionalBoolean(fiber, "style.italic", style.italic);
  validateOptionalBoolean(fiber, "style.underline", style.underline);
  validateOptionalBoolean(fiber, "style.inverse", style.inverse);
}

function validateRequiredString(fiber: Fiber, prop: string, value: unknown): void {
  if (typeof value !== "string") throw invalidPropError(fiber, prop, "a string", value);
}

function validateOptionalString(fiber: Fiber, prop: string, value: unknown): void {
  if (value === undefined) return;
  if (typeof value !== "string") throw invalidPropError(fiber, prop, "a string", value);
}

function validateRequiredFunction(fiber: Fiber, prop: string, value: unknown): void {
  if (typeof value !== "function") throw invalidPropError(fiber, prop, "a function", value);
}

function validateOptionalFunction(fiber: Fiber, prop: string, value: unknown): void {
  if (value === undefined) return;
  if (typeof value !== "function") throw invalidPropError(fiber, prop, "a function", value);
}

function validateOptionalBoolean(fiber: Fiber, prop: string, value: unknown): void {
  if (value === undefined) return;
  if (typeof value !== "boolean") throw invalidPropError(fiber, prop, "a boolean", value);
}

function validateOptionalInteger(fiber: Fiber, prop: string, value: unknown): void {
  if (value === undefined) return;
  validateNumberValue(fiber, prop, value, true);
}

function validateOptionalNumber(fiber: Fiber, prop: string, value: unknown): void {
  if (value === undefined) return;
  validateNumberValue(fiber, prop, value, false);
}

function validateOptionalEnum<T extends string>(fiber: Fiber, prop: string, value: unknown, options: readonly T[]): void {
  if (value === undefined) return;
  if (typeof value !== "string" || !options.includes(value as T)) {
    throw invalidPropError(fiber, prop, `one of ${options.map((option) => JSON.stringify(option)).join(", ")}`, value);
  }
}

function validateNumberValue(fiber: Fiber, prop: string, value: unknown, integer: boolean): void {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || (integer && !Number.isInteger(value))) {
    throw invalidPropError(
      fiber,
      prop,
      integer ? "a non-negative integer" : "a non-negative finite number",
      value,
    );
  }
}

function invalidPropError(fiber: Fiber, prop: string, expected: string, actual: unknown): Error {
  const error = new Error(
    `invalid prop "${prop}" on <${elementTypeName(fiber.type)}>; expected ${expected}, got ${describeValue(actual)}`,
  );
  attachFiberToError(error, fiber);
  return error;
}

function expandEdges(value: Edges | undefined): { top: number; right: number; bottom: number; left: number } {
  if (value === undefined) return { top: 0, right: 0, bottom: 0, left: 0 };
  if (typeof value === "number") return { top: value, right: value, bottom: value, left: value };
  if (value.length === 2) return { top: value[0], right: value[1], bottom: value[0], left: value[1] };
  return { top: value[0], right: value[1], bottom: value[2], left: value[3] };
}

function describeValue(value: unknown): string {
  if (value === undefined) return "undefined";
  if (value === null) return "null";
  if (typeof value === "string") return JSON.stringify(value);
  if (typeof value === "number" || typeof value === "boolean") return `${String(value)} (${typeof value})`;
  if (typeof value === "function") return `function ${value.name || "(anonymous)"}`;
  if (Array.isArray(value)) return `array(${value.length})`;
  if (typeof value === "object") return "object";
  return typeof value;
}

function isObject(value: unknown): value is Record<PropertyKey, unknown> {
  return typeof value === "object" && value !== null;
}

export function elementTypeName(type: ElementType): string {
  if (typeof type === "string") return type;
  if (typeof type === "symbol") return "Fragment";
  return (type as { displayName?: string; name?: string }).displayName
    ?? (type as { name?: string }).name
    ?? "Anonymous";
}
