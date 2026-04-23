import { Fragment, h } from "./runtime/element.js";
import type { BoxProps, BoxStyle, TextProps, ZenElement } from "./runtime/element.js";
import type { KeyEvent } from "./input/keys.js";

/**
 * Built-in components. Deliberately thin — each one is a handful of lines
 * over the host primitives so users can read the source and see exactly
 * how to write their own.
 */

// -- <Box> / <Row> / <Column> ------------------------------------------------
export function Box(props: BoxProps): ZenElement {
  return h("box", props as BoxProps, props.children);
}

export function Row(props: Omit<BoxProps, "direction">): ZenElement {
  return h("box", { direction: "row", ...props } as BoxProps, props.children);
}

export function Column(props: Omit<BoxProps, "direction">): ZenElement {
  return h("box", { direction: "column", ...props } as BoxProps, props.children);
}

export interface PanelProps extends Omit<BoxProps, "border"> {
  title?: string;
}

export function Panel(props: PanelProps): ZenElement {
  const { title, padding = 1, children, ...rest } = props;
  return h(
    "box",
    { border: true, title, padding, ...rest } as BoxProps,
    children,
  );
}

// -- <App> --------------------------------------------------------------------
// Passthrough root that fills the terminal. Provides a sensible default
// container so <Window>s inside it sit on a clean background.
export function App(props: { children?: unknown }): ZenElement {
  return h("box", { width: undefined, height: undefined, grow: 1 } as BoxProps, props.children);
}

// -- <Window> -----------------------------------------------------------------
export interface WindowProps extends Omit<BoxProps, "border" | "direction"> {
  title?: string;
  direction?: BoxProps["direction"];
}

export function Window(props: WindowProps): ZenElement {
  const { title, padding = 1, direction = "column", children, ...rest } = props;
  return h(
    "box",
    { border: true, title, padding, direction, ...rest } as BoxProps,
    children,
  );
}

// -- <Text> -------------------------------------------------------------------
export function Text(props: TextProps): ZenElement {
  return h("text", props as Record<string, unknown>, props.children);
}

// -- <Button> -----------------------------------------------------------------
export interface ButtonProps {
  onClick?: () => void;
  style?: BoxStyle;
  focusedStyle?: BoxStyle;
  children?: unknown;
}

export function Button(props: ButtonProps): ZenElement {
  const { onClick, children, style, focusedStyle } = props;
  // The box becomes focusable; the runtime translates Enter/Space into onClick.
  return h(
    "box",
    {
      focusable: true,
      border: true,
      padding: [0, 1],
      direction: "row",
      onClick,
      style: style ?? { bg: { kind: "ansi", code: 7 }, fg: { kind: "ansi", code: 0 } },
    } as BoxProps,
    h("text", {}, children),
  );
}

// -- <TextInput> --------------------------------------------------------------
export interface TextInputProps {
  value: string;
  onChange: (v: string) => void;
  onSubmit?: (v: string) => void;
  placeholder?: string;
  width?: number;
  style?: BoxStyle;
}

export function TextInput(props: TextInputProps): ZenElement {
  return h("input", props as unknown as Record<string, unknown>);
}

// -- <Spacer> -----------------------------------------------------------------
export function Spacer(props: { size?: number } = {}): ZenElement {
  return h("box", { width: props.size ?? 1, height: props.size ?? 1 } as BoxProps);
}

// -- <List> -------------------------------------------------------------------
export interface ListProps<T> {
  items: readonly T[];
  selected: number;
  onChange: (index: number) => void;
  onSelect?: (index: number, item: T) => void;
  render: (item: T, index: number, selected: boolean) => ZenElement | string;
  width?: number;
  height?: number;
}

export function List<T>(props: ListProps<T>): ZenElement {
  const onKey = (ev: KeyEvent): boolean | void => {
    if (ev.name === "up") {
      if (props.selected > 0) props.onChange(props.selected - 1);
      return true;
    }
    if (ev.name === "down") {
      if (props.selected < props.items.length - 1) props.onChange(props.selected + 1);
      return true;
    }
    if (ev.name === "home") {
      props.onChange(0);
      return true;
    }
    if (ev.name === "end") {
      props.onChange(Math.max(0, props.items.length - 1));
      return true;
    }
    if (ev.name === "enter") {
      if (props.items[props.selected] !== undefined) {
        props.onSelect?.(props.selected, props.items[props.selected]!);
      }
      return true;
    }
    return false;
  };

  const rows = props.items.map((item, i) => {
    const isSel = i === props.selected;
    const rendered = props.render(item, i, isSel);
    const content = typeof rendered === "string"
      ? h("text", { style: isSel ? { inverse: true } : undefined } as TextProps, rendered)
      : rendered;
    return h(
      "box",
      {
        direction: "row",
        height: 1,
        style: isSel ? { inverse: true } : undefined,
      } as BoxProps,
      content,
    );
  });

  return h(
    "box",
    {
      focusable: true,
      direction: "column",
      width: props.width,
      height: props.height,
      onKey,
    } as BoxProps,
    rows,
  );
}

// -- <Modal> ------------------------------------------------------------------
// A simple centered modal — rendered conditionally by the parent. This is a
// container primitive; the parent controls open/close via state.
export interface ModalProps {
  title?: string;
  width?: number;
  height?: number;
  children?: unknown;
}

export function Modal(props: ModalProps): ZenElement {
  return h(
    "box",
    {
      width: undefined,
      height: undefined,
      grow: 1,
      align: "center",
      justify: "center",
    } as BoxProps,
    h(
      "box",
      {
        border: true,
        title: props.title,
        padding: 1,
        width: props.width ?? 40,
        height: props.height ?? 10,
      } as BoxProps,
      props.children,
    ),
  );
}

export { Fragment };
