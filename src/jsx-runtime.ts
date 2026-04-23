import {
  Fragment,
  h,
  type BoxProps,
  type ElementType,
  type InputProps,
  type TextProps,
  type ZenElement,
} from "./runtime/element.js";

type JSXProps = Record<string, unknown> | null | undefined;

function withKey(
  props: JSXProps,
  key: string | number | undefined,
): Record<string, unknown> {
  const next = { ...(props ?? {}) };
  if (key !== undefined) next.key = key;
  return next;
}

export function jsx(
  type: ElementType,
  props: JSXProps,
  key?: string | number,
): ZenElement {
  return h(type, withKey(props, key));
}

export const jsxs = jsx;

export function jsxDEV(
  type: ElementType,
  props: JSXProps,
  key?: string | number,
): ZenElement {
  return jsx(type, props, key);
}

export { Fragment };

export namespace JSX {
  export type Element = ZenElement;

  export interface IntrinsicElements {
    box: BoxProps;
    text: TextProps;
    input: InputProps;
  }

  export interface ElementChildrenAttribute {
    children: unknown;
  }
}
