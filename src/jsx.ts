import type {
  BoxProps,
  InputProps,
  TextProps,
  ZenElement,
} from "./runtime/element.js";

// Global JSX namespace — picked up by TS when jsxFactory = h.
declare global {
  namespace JSX {
    interface IntrinsicElements {
      box: BoxProps;
      text: TextProps;
      input: InputProps;
    }
    type Element = ZenElement;
    interface ElementChildrenAttribute {
      children: unknown;
    }
  }
}

export {};
