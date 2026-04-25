import {
  Fragment,
  h,
  type BoxProps,
  type ElementType,
  type InputProps,
  type TextAreaProps,
  type TextProps,
  type ZenElement,
} from "./runtime/element.js";

type JSXProps = Record<string, unknown> | null | undefined;

function withKey(props: JSXProps, key: string | number | undefined): Record<string, unknown> {
  const next = { ...(props ?? {}) };
  if (key !== undefined) next.key = key;
  return next;
}

export function jsxDEV(type: ElementType, props: JSXProps, key?: string | number): ZenElement {
  return h(type, withKey(props, key));
}

export { jsxDEV as jsx, jsxDEV as jsxs, Fragment };

export namespace JSX {
  export type Element = ZenElement;
  export interface IntrinsicAttributes {
    key?: string | number;
  }

  export interface IntrinsicElements {
    box: BoxProps;
    text: TextProps;
    input: InputProps;
    textarea: TextAreaProps;
  }

  export interface ElementChildrenAttribute {
    children: unknown;
  }
}
