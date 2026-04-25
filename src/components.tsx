import { Fragment, h } from "./runtime/element.js";
import type {
  BoxProps,
  BoxStyle,
  Edges,
  TextAreaProps as HostTextAreaProps,
  TextProps,
  ZenElement,
} from "./runtime/element.js";
import type { KeyEvent } from "./input/keys.js";
import { useCapabilities, useTheme } from "./runtime/hooks.js";

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
  const theme = useTheme();
  const {
    title,
    padding = 1,
    width,
    height,
    style,
    borderStyle,
    titleStyle,
    children,
    ...rest
  } = props;
  return h(
    "box",
    {
      border: true,
      title,
      padding,
      width: chromeSize(width, padding, true, "width"),
      height: chromeSize(height, padding, true, "height"),
      style: mergeBoxStyle(theme.window.body, style),
      borderStyle: mergeBoxStyle(theme.window.frame, borderStyle),
      titleStyle: mergeBoxStyle(theme.window.title, titleStyle),
      ...rest,
    } as BoxProps,
    children,
  );
}

// -- <App> --------------------------------------------------------------------
// Passthrough root that fills the terminal. Provides a sensible default
// container so <Window>s inside it sit on a clean background.
export function App(props: { children?: unknown }): ZenElement {
  const theme = useTheme();
  return h(
    "box",
    { width: undefined, height: undefined, grow: 1, style: theme.base } as BoxProps,
    props.children,
  );
}

// -- <Window> -----------------------------------------------------------------
export interface WindowProps extends Omit<BoxProps, "border" | "direction"> {
  title?: string;
  direction?: BoxProps["direction"];
}

export function Window(props: WindowProps): ZenElement {
  const theme = useTheme();
  const {
    title,
    padding = 1,
    direction = "column",
    width,
    height,
    style,
    borderStyle,
    titleStyle,
    children,
    ...rest
  } = props;
  return h(
    "box",
    {
      border: true,
      title,
      padding,
      direction,
      width: chromeSize(width, padding, true, "width"),
      height: chromeSize(height, padding, true, "height"),
      style: mergeBoxStyle(theme.window.body, style),
      borderStyle: mergeBoxStyle(theme.window.frame, borderStyle),
      titleStyle: mergeBoxStyle(theme.window.title, titleStyle),
      ...rest,
    } as BoxProps,
    children,
  );
}

// -- <Text> -------------------------------------------------------------------
export function Text(props: TextProps): ZenElement {
  return h("text", props as Record<string, unknown>, props.children);
}

// -- <Link> -------------------------------------------------------------------
export interface LinkProps {
  /** Destination URL. Required for OSC 8 emission and footnote fallback. */
  href: string;
  /**
   * Visible label. Falls back to `href` when omitted, matching common HTML
   * authoring expectations.
   */
  children?: unknown;
  /** Optional in-app handler. Fires on Enter / Space / mouse click. */
  onClick?: () => void;
  /**
   * When true, the URL is appended in parentheses even if the terminal
   * supports OSC 8. Useful for printable output.
   */
  showHref?: boolean;
  style?: Partial<TextProps["style"]>;
  focusedStyle?: Partial<TextProps["style"]>;
}

/**
 * Hyperlink component. Emits styled (underlined, theme-colored) text and,
 * on terminals that advertise OSC 8 support, marks the cells as a clickable
 * hyperlink. On terminals that lack OSC 8, the URL renders as a parenthetical
 * footnote so it remains discoverable.
 */
export function Link(props: LinkProps): ZenElement {
  const theme = useTheme();
  const caps = useCapabilities();
  const label = props.children ?? props.href;
  const hasNativeLink = caps.hyperlinks;
  const showFootnote = props.showHref ?? !hasNativeLink;

  const text = showFootnote ? `${label} (${props.href})` : String(label);

  return h(
    "text",
    {
      onClick: props.onClick,
      style: { ...theme.link.normal, ...(props.style ?? {}) },
      focusedStyle: { ...theme.link.focused, ...(props.focusedStyle ?? {}) },
      // The runtime ignores unknown text props today; a follow-up pass will
      // teach the renderer to wrap these cells in OSC 8 when caps.hyperlinks
      // is true. The capability flag is already detected and threaded.
      "data-href": props.href,
      focusable: props.onClick != null,
    } as Record<string, unknown>,
    text,
  );
}

// -- <Button> -----------------------------------------------------------------
export interface ButtonProps {
  onClick?: () => void;
  style?: BoxStyle;
  focusedStyle?: BoxStyle;
  hoveredStyle?: BoxStyle;
  activeStyle?: BoxStyle;
  disabledStyle?: BoxStyle;
  loadingStyle?: BoxStyle;
  errorStyle?: BoxStyle;
  disabled?: boolean;
  loading?: boolean;
  error?: boolean;
  children?: unknown;
}

export function Button(props: ButtonProps): ZenElement {
  const theme = useTheme();
  const {
    onClick,
    children,
    style,
    focusedStyle,
    hoveredStyle,
    activeStyle,
    disabledStyle,
    loadingStyle,
    errorStyle,
    disabled = false,
    loading = false,
    error = false,
  } = props;
  // The box becomes focusable; the runtime translates Enter/Space into onClick.
  return h(
    "box",
    {
      focusable: !disabled,
      disabled,
      loading,
      error,
      border: true,
      padding: [0, 1],
      direction: "row",
      onClick: disabled || loading ? undefined : onClick,
      style: mergeBoxStyle(theme.button.normal, style),
      focusedStyle: mergeBoxStyle(theme.button.focused, focusedStyle),
      hoveredStyle: mergeBoxStyle(theme.button.hovered, hoveredStyle),
      activeStyle: mergeBoxStyle(theme.button.active, activeStyle),
      disabledStyle: mergeBoxStyle(theme.button.disabled, disabledStyle),
      loadingStyle: mergeBoxStyle(theme.button.loading, loadingStyle),
      errorStyle: mergeBoxStyle(theme.button.error, errorStyle),
    } as BoxProps,
    h("text", {}, children),
  );
}

// -- <TextInput> --------------------------------------------------------------
export interface TextInputProps {
  value: string;
  onChange: (v: string) => void;
  onSubmit?: (v: string) => void;
  onFocus?: () => void;
  onBlur?: () => void;
  placeholder?: string;
  width?: number;
  grow?: number;
  style?: BoxStyle;
  focusedStyle?: BoxStyle;
  hoveredStyle?: BoxStyle;
  activeStyle?: BoxStyle;
  disabledStyle?: BoxStyle;
  loadingStyle?: BoxStyle;
  errorStyle?: BoxStyle;
  placeholderStyle?: BoxStyle;
  disabled?: boolean;
  loading?: boolean;
  error?: boolean;
}

export function TextInput(props: TextInputProps): ZenElement {
  const theme = useTheme();
  return h("input", {
    ...props,
    style: mergeBoxStyle(theme.input.normal, props.style),
    focusedStyle: mergeBoxStyle(theme.input.focused, props.focusedStyle),
    hoveredStyle: mergeBoxStyle(theme.input.hovered, props.hoveredStyle),
    activeStyle: props.activeStyle,
    disabledStyle: mergeBoxStyle(theme.input.disabled, props.disabledStyle),
    loadingStyle: mergeBoxStyle(theme.input.loading, props.loadingStyle),
    errorStyle: mergeBoxStyle(theme.input.error, props.errorStyle),
    placeholderStyle: mergeBoxStyle(theme.input.placeholder, props.placeholderStyle),
  } as unknown as Record<string, unknown>);
}

// -- <TextArea> --------------------------------------------------------------
export interface TextAreaProps extends HostTextAreaProps {}

export function TextArea(props: TextAreaProps): ZenElement {
  const theme = useTheme();
  return h("textarea", {
    ...props,
    style: mergeBoxStyle(theme.input.normal, props.style),
    focusedStyle: mergeBoxStyle(theme.input.focused, props.focusedStyle),
    hoveredStyle: mergeBoxStyle(theme.input.hovered, props.hoveredStyle),
    activeStyle: props.activeStyle,
    disabledStyle: mergeBoxStyle(theme.input.disabled, props.disabledStyle),
    loadingStyle: mergeBoxStyle(theme.input.loading, props.loadingStyle),
    errorStyle: mergeBoxStyle(theme.input.error, props.errorStyle),
    placeholderStyle: mergeBoxStyle(theme.input.placeholder, props.placeholderStyle),
  } as unknown as Record<string, unknown>);
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
  disabled?: boolean;
  rowStyle?: BoxStyle;
  rowFocusedStyle?: BoxStyle;
  rowHoveredStyle?: BoxStyle;
  rowActiveStyle?: BoxStyle;
  rowDisabledStyle?: BoxStyle;
}

export function List<T>(props: ListProps<T>): ZenElement {
  const theme = useTheme();
  const onKey = (ev: KeyEvent): boolean | void => {
    if (props.disabled) return false;
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

  const windowSize = props.height == null ? props.items.length : Math.max(1, props.height);
  const maxStart = Math.max(0, props.items.length - windowSize);
  const start = props.height == null
    ? 0
    : clamp(props.selected - Math.floor(windowSize / 2), 0, maxStart);
  const visibleItems = props.items.slice(start, start + windowSize);

  const rows = visibleItems.map((item, offset) => {
    const i = start + offset;
    const isSel = i === props.selected;
    const rendered = props.render(item, i, isSel);
    const rowStyle = mergeBoxStyle(isSel ? theme.list.selected : theme.list.normal, props.rowStyle);
    const content = typeof rendered === "string"
      ? h("text", { style: rowStyle } as TextProps, rendered.length > 0 ? rendered : " ")
      : rendered;
    return h(
      "box",
      {
        direction: "row",
        height: 1,
        disabled: props.disabled,
        style: rowStyle,
        focusedStyle: props.rowFocusedStyle,
        hoveredStyle: mergeBoxStyle(theme.list.hovered, props.rowHoveredStyle),
        activeStyle: mergeBoxStyle(theme.list.active, props.rowActiveStyle),
        disabledStyle: mergeBoxStyle(theme.list.disabled, props.rowDisabledStyle),
        onClick: () => {
          if (props.disabled) return;
          props.onChange(i);
          props.onSelect?.(i, item);
        },
      } as BoxProps,
      content,
    );
  });

  return h(
    "box",
    {
      focusable: true,
      disabled: props.disabled,
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
  onDismiss?: () => void;
  children?: unknown;
}

export function Modal(props: ModalProps): ZenElement {
  const theme = useTheme();
  return h(
    "box",
    {
      width: undefined,
      height: undefined,
      grow: 1,
      overlay: true,
      align: "center",
      justify: "center",
      focusScope: "contain",
      onKey: props.onDismiss
        ? ((event: KeyEvent) => {
          if (event.name === "escape") {
            props.onDismiss?.();
            return true;
          }
          return false;
        })
        : undefined,
    } as BoxProps,
    h(
      "box",
      {
        border: true,
        title: props.title,
        padding: 1,
        width: chromeSize(props.width ?? 40, 1, true, "width"),
        height: chromeSize(props.height ?? 10, 1, true, "height"),
        style: theme.window.body,
        borderStyle: theme.window.frame,
        titleStyle: theme.window.title,
      } as BoxProps,
      props.children,
    ),
  );
}

export { Fragment };

function mergeBoxStyle(base: BoxStyle, override?: BoxStyle): BoxStyle {
  return { ...base, ...(override ?? {}) };
}

function chromeSize(
  value: number | undefined,
  padding: Edges | undefined,
  border: boolean,
  axis: "width" | "height",
): number | undefined {
  if (value === undefined) return undefined;
  const edge = expandEdges(padding);
  const chrome = axis === "width"
    ? edge.left + edge.right + (border ? 2 : 0)
    : edge.top + edge.bottom + (border ? 2 : 0);
  return value + chrome;
}

function expandEdges(value: Edges | undefined): { top: number; right: number; bottom: number; left: number } {
  if (value === undefined) return { top: 0, right: 0, bottom: 0, left: 0 };
  if (typeof value === "number") return { top: value, right: value, bottom: value, left: value };
  if (value.length === 2) return { top: value[0], right: value[1], bottom: value[0], left: value[1] };
  return { top: value[0], right: value[1], bottom: value[2], left: value[3] };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
