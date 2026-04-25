import type { BoxProps, BoxStyle, Edges, StyleResolver } from "../runtime/element.js";
import { DefaultColor, type Color } from "../render/style.js";
import { parseColor, type ColorInput } from "../render/color.js";
import { matchesBreakpoint } from "../theme/breakpoints.js";
import type { BorderPreset, Theme, ThemeTokens } from "../theme/theme.js";

export type StyleState = "focused" | "hovered" | "active" | "disabled" | "loading" | "error";

export type StyleBreakpoint =
  | "xs"
  | "sm"
  | "md"
  | "lg"
  | "xl"
  | `${">" | ">=" | "<" | "<="}${number}`;

export interface StyleResolveContext {
  states?: Iterable<StyleState> | Partial<Record<StyleState, boolean>>;
  width?: number;
}

export interface StyledBoxProps extends Partial<BoxProps> {
  style?: BoxStyle;
  borderPreset?: BorderPreset;
}

type SpaceInput = number | keyof ThemeTokens["space"] | string;
type ColorTokenInput = ColorInput | keyof ThemeTokens["color"] | string;

interface StylePatch {
  fg?: ColorTokenInput;
  bg?: ColorTokenInput;
  bold?: boolean;
  dim?: boolean;
  italic?: boolean;
  underline?: boolean;
  inverse?: boolean;
  padding?: EdgesOf<SpaceInput>;
  gap?: SpaceInput;
  width?: number;
  height?: number;
  grow?: number;
  border?: boolean;
  borderPreset?: BorderPreset;
}

type EdgesOf<T> = T | [T, T] | [T, T, T, T];
export type StyleInput = StyleRule | StyleResolver | StyledBoxProps | BoxStyle | null | undefined;

const STATE_ORDER: StyleState[] = ["hovered", "focused", "active", "loading", "error", "disabled"];

export class StyleRule {
  private readonly patch: StylePatch = {};
  private readonly stateVariants = new Map<StyleState, StyleRule>();
  private readonly breakpointVariants: Array<{ query: StyleBreakpoint; rule: StyleRule }> = [];

  constructor(private readonly parentRule: StyleRule | null = null) {}

  fg(value: ColorTokenInput): this {
    this.patch.fg = value;
    return this;
  }

  bg(value: ColorTokenInput): this {
    this.patch.bg = value;
    return this;
  }

  color(value: ColorTokenInput): this {
    return this.fg(value);
  }

  background(value: ColorTokenInput): this {
    return this.bg(value);
  }

  bold(enabled = true): this {
    this.patch.bold = enabled;
    return this;
  }

  dim(enabled = true): this {
    this.patch.dim = enabled;
    return this;
  }

  italic(enabled = true): this {
    this.patch.italic = enabled;
    return this;
  }

  underline(enabled = true): this {
    this.patch.underline = enabled;
    return this;
  }

  inverse(enabled = true): this {
    this.patch.inverse = enabled;
    return this;
  }

  padding(vertical: SpaceInput, horizontal?: SpaceInput): this;
  padding(top: SpaceInput, right: SpaceInput, bottom: SpaceInput, left: SpaceInput): this;
  padding(...values: SpaceInput[]): this {
    if (values.length === 1) this.patch.padding = values[0]!;
    else if (values.length === 2) this.patch.padding = [values[0]!, values[1]!];
    else if (values.length === 4) {
      this.patch.padding = [values[0]!, values[1]!, values[2]!, values[3]!];
    } else {
      throw new Error("graceglyph: padding expects 1, 2, or 4 values");
    }
    return this;
  }

  gap(value: SpaceInput): this {
    this.patch.gap = value;
    return this;
  }

  width(value: number): this {
    this.patch.width = value;
    return this;
  }

  height(value: number): this {
    this.patch.height = value;
    return this;
  }

  grow(value = 1): this {
    this.patch.grow = value;
    return this;
  }

  border(preset: BorderPreset | boolean = "square"): this {
    if (typeof preset === "boolean") {
      this.patch.border = preset;
      if (!preset) this.patch.borderPreset = "none";
      return this;
    }
    this.patch.borderPreset = preset;
    this.patch.border = preset !== "none";
    return this;
  }

  when(state: StyleState): StyleRule;
  when(state: StyleState, rule: StyleInput | ((rule: StyleRule) => StyleInput)): this;
  when(state: StyleState, rule?: StyleInput | ((rule: StyleRule) => StyleInput)): StyleRule | this {
    const next = this.variantForState(state);
    if (rule === undefined) return next;
    const applied = typeof rule === "function" ? rule(next) : rule;
    if (applied && applied !== next) next.mergeIn(applied);
    return this;
  }

  at(query: StyleBreakpoint): StyleRule;
  at(query: StyleBreakpoint, rule: StyleInput | ((rule: StyleRule) => StyleInput)): this;
  at(
    query: StyleBreakpoint,
    rule?: StyleInput | ((rule: StyleRule) => StyleInput),
  ): StyleRule | this {
    const next = new StyleRule(this);
    this.breakpointVariants.push({ query, rule: next });
    if (rule === undefined) return next;
    const applied = typeof rule === "function" ? rule(next) : rule;
    if (applied && applied !== next) next.mergeIn(applied);
    return this;
  }

  done(): StyleRule {
    return this.parentRule ?? this;
  }

  merge(...rules: StyleInput[]): this {
    for (const rule of rules) this.mergeIn(rule);
    return this;
  }

  toBoxStyle(theme?: Theme, context: StyleResolveContext = {}): BoxStyle {
    return this.resolve(theme, context).style ?? {};
  }

  toProps(theme?: Theme, context: StyleResolveContext = {}): StyledBoxProps {
    return this.resolve(theme, context);
  }

  resolve(theme?: Theme, context: StyleResolveContext = {}): StyledBoxProps {
    const out: StyledBoxProps = {};
    applyPatch(out, this.patch, theme);

    const width = context.width;
    if (width != null) {
      for (const { query, rule } of this.breakpointVariants) {
        if (matchesBreakpoint(query, width, theme?.tokens)) {
          mergeProps(out, rule.resolve(theme, context));
        }
      }
    }

    const activeStates = normalizeStates(context.states);
    for (const state of STATE_ORDER) {
      if (!activeStates.has(state)) continue;
      const rule = this.stateVariants.get(state);
      if (rule) mergeProps(out, rule.resolve(theme, context));
    }

    return out;
  }

  private variantForState(state: StyleState): StyleRule {
    let rule = this.stateVariants.get(state);
    if (!rule) {
      rule = new StyleRule(this);
      this.stateVariants.set(state, rule);
    }
    return rule;
  }

  private mergeIn(input: StyleInput): void {
    if (!input) return;
    if (input instanceof StyleRule) {
      Object.assign(this.patch, input.patch);
      for (const [state, variant] of input.stateVariants) {
        this.variantForState(state).mergeIn(variant);
      }
      for (const variant of input.breakpointVariants) {
        const copy = new StyleRule(this);
        copy.mergeIn(variant.rule);
        this.breakpointVariants.push({ query: variant.query, rule: copy });
      }
      return;
    }

    if (
      typeof input === "object" &&
      "toBoxStyle" in input &&
      typeof input.toBoxStyle === "function"
    ) {
      this.mergeIn(input.toBoxStyle());
      return;
    }

    if ("style" in input || "padding" in input || "border" in input || "gap" in input) {
      const props = input as StyledBoxProps;
      if (props.style) this.mergeIn(props.style);
      if (props.padding !== undefined) this.patch.padding = props.padding as EdgesOf<SpaceInput>;
      if (props.gap !== undefined) this.patch.gap = props.gap;
      if (props.width !== undefined) this.patch.width = props.width;
      if (props.height !== undefined) this.patch.height = props.height;
      if (props.grow !== undefined) this.patch.grow = props.grow;
      if (props.border !== undefined) this.patch.border = props.border;
      if (props.borderPreset !== undefined) this.patch.borderPreset = props.borderPreset;
      return;
    }

    const boxStyle = input as BoxStyle;
    if (boxStyle.fg !== undefined) this.patch.fg = boxStyle.fg;
    if (boxStyle.bg !== undefined) this.patch.bg = boxStyle.bg;
    if (boxStyle.bold !== undefined) this.patch.bold = boxStyle.bold;
    if (boxStyle.dim !== undefined) this.patch.dim = boxStyle.dim;
    if (boxStyle.italic !== undefined) this.patch.italic = boxStyle.italic;
    if (boxStyle.underline !== undefined) this.patch.underline = boxStyle.underline;
    if (boxStyle.inverse !== undefined) this.patch.inverse = boxStyle.inverse;
  }
}

export interface StyleFactory {
  (): StyleRule;
  merge(...rules: StyleInput[]): StyleRule;
  from(input: StyleInput): StyleRule;
}

export const style: StyleFactory = Object.assign(() => new StyleRule(), {
  merge: (...rules: StyleInput[]) => new StyleRule().merge(...rules),
  from: (input: StyleInput) => new StyleRule().merge(input),
});

export function css(strings: TemplateStringsArray, ...values: unknown[]): StyleRule {
  const source = strings.reduce(
    (acc, part, index) => acc + part + (index < values.length ? String(values[index]) : ""),
    "",
  );
  const rule = style();

  for (const declaration of source.split(";")) {
    const trimmed = declaration.trim();
    if (!trimmed) continue;
    const sep = trimmed.indexOf(":");
    if (sep < 0) throw new Error(`graceglyph: invalid style declaration "${trimmed}"`);
    const property = trimmed.slice(0, sep).trim().toLowerCase();
    const value = trimmed.slice(sep + 1).trim();
    applyDeclaration(rule, property, value);
  }

  return rule;
}

export function isStyleRule(value: unknown): value is StyleRule {
  return value instanceof StyleRule;
}

function applyDeclaration(rule: StyleRule, property: string, value: string): void {
  switch (property) {
    case "fg":
    case "color":
    case "foreground":
      rule.fg(value);
      break;
    case "bg":
    case "background":
      rule.bg(value);
      break;
    case "bold":
    case "dim":
    case "italic":
    case "underline":
    case "inverse":
      rule[property](parseBoolean(value, property));
      break;
    case "padding": {
      const parts = value.split(/\s+/).filter(Boolean);
      if (parts.length === 1) rule.padding(parseSpace(parts[0]!));
      else if (parts.length === 2) rule.padding(parseSpace(parts[0]!), parseSpace(parts[1]!));
      else if (parts.length === 4) {
        rule.padding(
          parseSpace(parts[0]!),
          parseSpace(parts[1]!),
          parseSpace(parts[2]!),
          parseSpace(parts[3]!),
        );
      } else {
        throw new Error("graceglyph: padding expects 1, 2, or 4 values");
      }
      break;
    }
    case "gap":
      rule.gap(parseSpace(value));
      break;
    case "width":
      rule.width(parseNumber(value, property));
      break;
    case "height":
      rule.height(parseNumber(value, property));
      break;
    case "grow":
      rule.grow(parseNumber(value, property));
      break;
    case "border":
      rule.border(parseBorder(value));
      break;
    default:
      throw new Error(`graceglyph: unsupported style property "${property}"`);
  }
}

function applyPatch(out: StyledBoxProps, patch: StylePatch, theme?: Theme): void {
  const nextStyle: BoxStyle = { ...(out.style ?? {}) };
  if (patch.fg !== undefined) nextStyle.fg = resolveColor(patch.fg, theme);
  if (patch.bg !== undefined) nextStyle.bg = resolveColor(patch.bg, theme);
  if (patch.bold !== undefined) nextStyle.bold = patch.bold;
  if (patch.dim !== undefined) nextStyle.dim = patch.dim;
  if (patch.italic !== undefined) nextStyle.italic = patch.italic;
  if (patch.underline !== undefined) nextStyle.underline = patch.underline;
  if (patch.inverse !== undefined) nextStyle.inverse = patch.inverse;
  if (Object.keys(nextStyle).length > 0) out.style = nextStyle;

  if (patch.padding !== undefined) out.padding = resolveEdges(patch.padding, theme);
  if (patch.gap !== undefined) out.gap = resolveSpace(patch.gap, theme);
  if (patch.width !== undefined) out.width = patch.width;
  if (patch.height !== undefined) out.height = patch.height;
  if (patch.grow !== undefined) out.grow = patch.grow;
  if (patch.border !== undefined) out.border = patch.border;
  if (patch.borderPreset !== undefined) out.borderPreset = patch.borderPreset;
}

function mergeProps(base: StyledBoxProps, next: StyledBoxProps): void {
  if (next.style) base.style = { ...(base.style ?? {}), ...next.style };
  if (next.padding !== undefined) base.padding = next.padding;
  if (next.gap !== undefined) base.gap = next.gap;
  if (next.width !== undefined) base.width = next.width;
  if (next.height !== undefined) base.height = next.height;
  if (next.grow !== undefined) base.grow = next.grow;
  if (next.border !== undefined) base.border = next.border;
  if (next.borderPreset !== undefined) base.borderPreset = next.borderPreset;
}

function resolveColor(input: ColorTokenInput, theme?: Theme): Color {
  if (input == null) return DefaultColor;
  if (typeof input !== "string") return parseColor(input);

  const token = theme?.tokens.color[input];
  if (token !== undefined && token !== input) {
    return resolveColor(token as ColorTokenInput, theme);
  }
  return parseColor(input);
}

function resolveSpace(input: SpaceInput, theme?: Theme): number {
  if (typeof input === "number") return input;
  const token = theme?.tokens.space[input];
  if (token !== undefined) return token;
  const parsed = Number(input);
  if (Number.isFinite(parsed)) return parsed;
  throw new Error(`graceglyph: unknown spacing token "${input}"`);
}

function resolveEdges(input: EdgesOf<SpaceInput>, theme?: Theme): Edges {
  if (!Array.isArray(input)) return resolveSpace(input, theme);
  if (input.length === 2) {
    return [resolveSpace(input[0], theme), resolveSpace(input[1], theme)];
  }
  return [
    resolveSpace(input[0], theme),
    resolveSpace(input[1], theme),
    resolveSpace(input[2], theme),
    resolveSpace(input[3], theme),
  ];
}

function normalizeStates(states: StyleResolveContext["states"]): Set<StyleState> {
  if (!states) return new Set();
  if (Symbol.iterator in Object(states)) return new Set(states as Iterable<StyleState>);
  const active = new Set<StyleState>();
  for (const state of STATE_ORDER) {
    if ((states as Partial<Record<StyleState, boolean>>)[state]) active.add(state);
  }
  return active;
}

function parseSpace(value: string): SpaceInput {
  const n = Number(value);
  return Number.isFinite(n) ? n : value;
}

function parseNumber(value: string, property: string): number {
  const n = Number(value);
  if (!Number.isFinite(n)) {
    throw new Error(`graceglyph: ${property} expects a number`);
  }
  return n;
}

function parseBoolean(value: string, property: string): boolean {
  const normalized = value.trim().toLowerCase();
  if (["true", "yes", "on", "1"].includes(normalized)) return true;
  if (["false", "no", "off", "0"].includes(normalized)) return false;
  throw new Error(`graceglyph: ${property} expects a boolean`);
}

function parseBorder(value: string): BorderPreset | boolean {
  const normalized = value.trim().toLowerCase();
  if (["true", "yes", "on", "1"].includes(normalized)) return true;
  if (["false", "no", "off", "0"].includes(normalized)) return false;
  if (isBorderPreset(normalized)) return normalized;
  throw new Error(`graceglyph: unknown border preset "${value}"`);
}

function isBorderPreset(value: string): value is BorderPreset {
  return (
    value === "square" ||
    value === "round" ||
    value === "double" ||
    value === "thick" ||
    value === "dashed" ||
    value === "ascii" ||
    value === "none"
  );
}
