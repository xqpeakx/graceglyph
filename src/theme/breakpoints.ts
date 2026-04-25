import type { ThemeTokens } from "./theme.js";

export type BreakpointComparator = `${">" | ">=" | "<" | "<="}${number}`;
export type BreakpointQuery = "xs" | "sm" | "md" | "lg" | "xl" | BreakpointComparator | string;

export interface BreakpointMap<T> {
  base?: T;
  [query: string]: T | undefined;
}

export function resolveBreakpointMap<T>(
  map: BreakpointMap<T> | undefined,
  width: number,
  tokens?: ThemeTokens,
): T | undefined {
  let out: T | undefined;
  for (const value of matchingBreakpointValues(map, width, tokens)) out = value;
  return out;
}

export function matchingBreakpointValues<T>(
  map: BreakpointMap<T> | undefined,
  width: number,
  tokens?: ThemeTokens,
): T[] {
  if (!map) return [];
  const out: T[] = [];
  if (map.base !== undefined) out.push(map.base);
  for (const [query, value] of Object.entries(map)) {
    if (query === "base" || value === undefined) continue;
    if (matchesBreakpoint(query, width, tokens)) out.push(value);
  }
  return out;
}

export function matchesBreakpoint(query: string, width: number, tokens?: ThemeTokens): boolean {
  const named = tokens?.breakpoints?.[query];
  if (named !== undefined) return width >= named;

  const match = query.match(/^(>=|>|<=|<)(\d+)$/);
  if (!match) throw new Error(`graceglyph: unknown breakpoint "${query}"`);
  const op = match[1]!;
  const value = Number(match[2]!);
  if (op === ">=") return width >= value;
  if (op === ">") return width > value;
  if (op === "<=") return width <= value;
  return width < value;
}
