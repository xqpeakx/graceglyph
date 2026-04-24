import type {
  BoxProps,
  InputProps,
  TextAreaProps,
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
      textarea: TextAreaProps;
    }
    type Element = ZenElement;
    interface IntrinsicAttributes {
      key?: string | number;
    }
    interface ElementChildrenAttribute {
      children: unknown;
    }
  }
}

export {};
