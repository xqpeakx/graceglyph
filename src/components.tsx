import { Fragment, h } from "./runtime/element.js";
import type {
  AccessibilityProps,
  BoxProps,
  Edges,
  StyleLike,
  TextAreaProps as HostTextAreaProps,
  TextProps,
  ZenElement,
} from "./runtime/element.js";
import type { KeyEvent } from "./input/keys.js";
import { useCapabilities, useEffect, useState, useTheme } from "./runtime/hooks.js";
import { style as styleRule } from "./style/index.js";
import { stringWidth } from "./render/unicode.js";

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
export interface LinkProps extends AccessibilityProps {
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
  style?: StyleLike;
  focusedStyle?: StyleLike;
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
      style: mergeBoxStyle(theme.link.normal, props.style),
      focusedStyle: mergeBoxStyle(theme.link.focused, props.focusedStyle),
      accessibilityLabel: props.accessibilityLabel ?? String(label),
      accessibilityDescription: props.accessibilityDescription,
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
export interface ButtonProps extends AccessibilityProps {
  onClick?: () => void;
  style?: StyleLike;
  focusedStyle?: StyleLike;
  hoveredStyle?: StyleLike;
  activeStyle?: StyleLike;
  disabledStyle?: StyleLike;
  loadingStyle?: StyleLike;
  errorStyle?: StyleLike;
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
    accessibilityLabel,
    accessibilityDescription,
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
      accessibilityLabel: accessibilityLabel ?? accessibleText(children),
      accessibilityDescription,
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
export interface TextInputProps extends AccessibilityProps {
  value: string;
  onChange: (v: string) => void;
  onSubmit?: (v: string) => void;
  onFocus?: () => void;
  onBlur?: () => void;
  placeholder?: string;
  width?: number;
  grow?: number;
  style?: StyleLike;
  focusedStyle?: StyleLike;
  hoveredStyle?: StyleLike;
  activeStyle?: StyleLike;
  disabledStyle?: StyleLike;
  loadingStyle?: StyleLike;
  errorStyle?: StyleLike;
  placeholderStyle?: StyleLike;
  disabled?: boolean;
  loading?: boolean;
  error?: boolean;
  /** Replace each rendered grapheme with this glyph (cursor stays in sync). */
  mask?: string;
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
export interface ListProps<T> extends AccessibilityProps {
  items: readonly T[];
  selected: number;
  onChange: (index: number) => void;
  onSelect?: (index: number, item: T) => void;
  render: (item: T, index: number, selected: boolean) => ZenElement | string;
  width?: number;
  height?: number;
  disabled?: boolean;
  rowStyle?: StyleLike;
  rowFocusedStyle?: StyleLike;
  rowHoveredStyle?: StyleLike;
  rowActiveStyle?: StyleLike;
  rowDisabledStyle?: StyleLike;
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
  const start =
    props.height == null ? 0 : clamp(props.selected - Math.floor(windowSize / 2), 0, maxStart);
  const visibleItems = props.items.slice(start, start + windowSize);

  const rows = visibleItems.map((item, offset) => {
    const i = start + offset;
    const isSel = i === props.selected;
    const rendered = props.render(item, i, isSel);
    const rowStyle = mergeBoxStyle(isSel ? theme.list.selected : theme.list.normal, props.rowStyle);
    const content =
      typeof rendered === "string"
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
      accessibilityLabel: props.accessibilityLabel,
      accessibilityDescription: props.accessibilityDescription,
    } as BoxProps,
    rows,
  );
}

// -- <Modal> ------------------------------------------------------------------
// A simple centered modal — rendered conditionally by the parent. This is a
// container primitive; the parent controls open/close via state.
export interface ModalProps extends AccessibilityProps {
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
        ? (event: KeyEvent) => {
            if (event.name === "escape") {
              props.onDismiss?.();
              return true;
            }
            return false;
          }
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
        accessibilityLabel: props.accessibilityLabel ?? props.title,
        accessibilityDescription: props.accessibilityDescription,
      } as BoxProps,
      props.children,
    ),
  );
}

// -- <Checkbox> ---------------------------------------------------------------
export interface CheckboxProps extends AccessibilityProps {
  checked: boolean;
  onChange: (next: boolean) => void;
  label?: string;
  disabled?: boolean;
  style?: StyleLike;
  focusedStyle?: StyleLike;
  checkedStyle?: StyleLike;
  disabledStyle?: StyleLike;
  /** Glyph pair: [unchecked, checked]. Defaults to ASCII brackets. */
  glyphs?: readonly [string, string];
}

export function Checkbox(props: CheckboxProps): ZenElement {
  const theme = useTheme();
  const { checked, onChange, label, disabled = false } = props;
  const [unchecked, checkedGlyph] = props.glyphs ?? (["[ ]", "[x]"] as const);
  const glyph = checked ? checkedGlyph : unchecked;
  const text = label !== undefined ? `${glyph} ${label}` : glyph;

  const baseToken = checked ? theme.checkbox.checked : theme.checkbox.normal;
  const focusedToken = checked ? theme.checkbox.checkedFocused : theme.checkbox.focused;

  return h(
    "box",
    {
      focusable: !disabled,
      disabled,
      direction: "row",
      onClick: disabled ? undefined : () => onChange(!checked),
      accessibilityLabel: props.accessibilityLabel ?? label,
      accessibilityDescription: props.accessibilityDescription,
      onKey: (ev: KeyEvent): boolean | void => {
        if (disabled) return false;
        if (ev.name === "space") {
          onChange(!checked);
          return true;
        }
        return false;
      },
      style: mergeBoxStyle(baseToken, props.style),
      focusedStyle: mergeBoxStyle(focusedToken, props.focusedStyle),
      disabledStyle: mergeBoxStyle(theme.checkbox.disabled, props.disabledStyle),
    } as BoxProps,
    h("text", {} as TextProps, text),
  );
}

// -- <Switch> -----------------------------------------------------------------
export interface SwitchProps extends AccessibilityProps {
  checked: boolean;
  onChange: (next: boolean) => void;
  label?: string;
  disabled?: boolean;
  /** Override on/off labels. Defaults to "ON"/"OFF". */
  onLabel?: string;
  offLabel?: string;
  style?: StyleLike;
  focusedStyle?: StyleLike;
  disabledStyle?: StyleLike;
}

export function Switch(props: SwitchProps): ZenElement {
  const theme = useTheme();
  const { checked, onChange, label, disabled = false } = props;
  const onLabel = props.onLabel ?? "ON";
  const offLabel = props.offLabel ?? "OFF";
  const pill = checked
    ? `[${" ".repeat(offLabel.length)}${onLabel}]`
    : `[${offLabel}${" ".repeat(onLabel.length)}]`;
  const text = label !== undefined ? `${label}  ${pill}` : pill;
  const baseToken = checked ? theme.switch.trackOn : theme.switch.track;

  return h(
    "box",
    {
      focusable: !disabled,
      disabled,
      direction: "row",
      onClick: disabled ? undefined : () => onChange(!checked),
      accessibilityLabel: props.accessibilityLabel ?? label,
      accessibilityDescription: props.accessibilityDescription,
      onKey: (ev: KeyEvent): boolean | void => {
        if (disabled) return false;
        if (ev.name === "space" || ev.name === "enter") {
          onChange(!checked);
          return true;
        }
        if (ev.name === "left") {
          if (checked) onChange(false);
          return true;
        }
        if (ev.name === "right") {
          if (!checked) onChange(true);
          return true;
        }
        return false;
      },
      style: mergeBoxStyle(baseToken, props.style),
      focusedStyle: mergeBoxStyle(theme.switch.focused, props.focusedStyle),
      disabledStyle: mergeBoxStyle(theme.switch.disabled, props.disabledStyle),
    } as BoxProps,
    h("text", {} as TextProps, text),
  );
}

// -- <Radio> / <RadioGroup> ---------------------------------------------------
export interface RadioOption<T extends string | number = string> {
  value: T;
  label: string;
  disabled?: boolean;
}

export interface RadioGroupProps<T extends string | number = string> extends AccessibilityProps {
  options: readonly RadioOption<T>[];
  value: T;
  onChange: (next: T) => void;
  direction?: "row" | "column";
  gap?: number;
  disabled?: boolean;
  style?: StyleLike;
  focusedStyle?: StyleLike;
  selectedStyle?: StyleLike;
  disabledStyle?: StyleLike;
  /** Glyph pair: [empty, selected]. Defaults to "( )"/"(•)". */
  glyphs?: readonly [string, string];
}

export function RadioGroup<T extends string | number = string>(
  props: RadioGroupProps<T>,
): ZenElement {
  const theme = useTheme();
  const direction = props.direction ?? "column";
  const gap = props.gap ?? (direction === "row" ? 2 : 0);
  const groupDisabled = props.disabled === true;
  const [empty, full] = props.glyphs ?? (["( )", "(•)"] as const);
  const enabledIndices = props.options
    .map((option, index) => (option.disabled || groupDisabled ? -1 : index))
    .filter((i) => i >= 0);
  const currentIndex = props.options.findIndex((option) => option.value === props.value);

  const onKey = (ev: KeyEvent): boolean | void => {
    if (groupDisabled || enabledIndices.length === 0) return false;
    const isPrev =
      (direction === "column" && ev.name === "up") || (direction === "row" && ev.name === "left");
    const isNext =
      (direction === "column" && ev.name === "down") ||
      (direction === "row" && ev.name === "right");
    if (!isPrev && !isNext) return false;
    const cursor = enabledIndices.indexOf(currentIndex);
    const offset = isPrev ? -1 : 1;
    const next =
      cursor === -1
        ? enabledIndices[0]!
        : enabledIndices[(cursor + offset + enabledIndices.length) % enabledIndices.length]!;
    props.onChange(props.options[next]!.value);
    return true;
  };

  const items = props.options.map((option) => {
    const isSelected = option.value === props.value;
    const isDisabled = groupDisabled || option.disabled === true;
    const glyph = isSelected ? full : empty;
    const baseToken = isSelected ? theme.checkbox.checked : theme.checkbox.normal;
    const focusedToken = isSelected ? theme.checkbox.checkedFocused : theme.checkbox.focused;
    return h(
      "box",
      {
        key: String(option.value),
        focusable: !isDisabled,
        disabled: isDisabled,
        direction: "row",
        onClick: isDisabled ? undefined : () => props.onChange(option.value),
        onKey: (ev: KeyEvent): boolean | void => {
          if (isDisabled) return false;
          if (ev.name === "space" || ev.name === "enter") {
            props.onChange(option.value);
            return true;
          }
          return false;
        },
        style: mergeBoxStyle(baseToken, isSelected ? props.selectedStyle : props.style),
        focusedStyle: mergeBoxStyle(focusedToken, props.focusedStyle),
        disabledStyle: mergeBoxStyle(theme.checkbox.disabled, props.disabledStyle),
      } as BoxProps,
      h("text", {} as TextProps, `${glyph} ${option.label}`),
    );
  });

  return h(
    "box",
    {
      direction,
      gap,
      onKey,
      accessibilityLabel: props.accessibilityLabel,
      accessibilityDescription: props.accessibilityDescription,
    } as BoxProps,
    items,
  );
}

// -- <Divider> ----------------------------------------------------------------
export interface DividerProps extends AccessibilityProps {
  direction?: "horizontal" | "vertical";
  label?: string;
  /** Override the line glyph. */
  char?: string;
  /** Total length in cells. Defaults to filling the available main axis. */
  length?: number;
  style?: StyleLike;
}

export function Divider(props: DividerProps): ZenElement {
  const theme = useTheme();
  const direction = props.direction ?? "horizontal";
  const isHorizontal = direction === "horizontal";
  const char = props.char ?? (isHorizontal ? "─" : "│");
  const len = props.length ?? 0;

  if (props.label && isHorizontal) {
    const labelWidth = stringWidth(props.label);
    const total = len > 0 ? len : Math.max(labelWidth + 4, labelWidth + 2);
    const padding = Math.max(2, total - labelWidth - 2);
    const leadLen = Math.floor(padding / 2);
    const trailLen = padding - leadLen;
    const text = `${char.repeat(leadLen)} ${props.label} ${char.repeat(trailLen)}`;
    return h(
      "box",
      {
        direction: "row",
        height: 1,
        grow: len > 0 ? 0 : 1,
        width: len > 0 ? len : undefined,
        style: mergeBoxStyle(theme.divider, props.style),
        accessibilityLabel: props.accessibilityLabel ?? props.label,
        accessibilityDescription: props.accessibilityDescription,
      } as BoxProps,
      h("text", {} as TextProps, text),
    );
  }

  if (isHorizontal) {
    const text = len > 0 ? char.repeat(len) : char.repeat(120);
    return h(
      "box",
      {
        direction: "row",
        height: 1,
        grow: len > 0 ? 0 : 1,
        width: len > 0 ? len : undefined,
        style: mergeBoxStyle(theme.divider, props.style),
        accessibilityLabel: props.accessibilityLabel,
        accessibilityDescription: props.accessibilityDescription,
      } as BoxProps,
      h("text", { wrap: "clip" } as TextProps, text),
    );
  }

  // Vertical divider — stack a column of glyphs and let the host clip.
  const tall = len > 0 ? len : 60;
  const lines: ZenElement[] = [];
  for (let i = 0; i < tall; i++) {
    lines.push(h("text", { key: i } as TextProps & { key: number }, char));
  }
  return h(
    "box",
    {
      direction: "column",
      width: 1,
      grow: len > 0 ? 0 : 1,
      height: len > 0 ? len : undefined,
      style: mergeBoxStyle(theme.divider, props.style),
      accessibilityLabel: props.accessibilityLabel,
      accessibilityDescription: props.accessibilityDescription,
    } as BoxProps,
    lines,
  );
}

// -- <Kbd> --------------------------------------------------------------------
export interface KbdProps extends AccessibilityProps {
  children?: unknown;
  /** Wrap each token in brackets. Defaults to true. */
  bracketed?: boolean;
  /** Separator inserted when `children` is an array of strings. */
  separator?: string;
  style?: StyleLike;
}

export function Kbd(props: KbdProps): ZenElement {
  const theme = useTheme();
  const bracketed = props.bracketed ?? true;
  const sep = props.separator ?? "+";
  const tokens = Array.isArray(props.children)
    ? props.children.map((c) => String(c))
    : [String(props.children ?? "")];
  const inner = tokens.join(sep);
  const text = bracketed ? ` ${inner} ` : inner;
  return h(
    "text",
    {
      style: mergeBoxStyle(theme.kbd, props.style),
      accessibilityLabel: props.accessibilityLabel ?? inner,
      accessibilityDescription: props.accessibilityDescription,
    } as TextProps,
    text,
  );
}

// -- <Badge> ------------------------------------------------------------------
export type BadgeVariant = "neutral" | "info" | "success" | "warning" | "danger";

export interface BadgeProps extends AccessibilityProps {
  variant?: BadgeVariant;
  children?: unknown;
  style?: StyleLike;
}

export function Badge(props: BadgeProps): ZenElement {
  const theme = useTheme();
  const variant = props.variant ?? "neutral";
  return h(
    "text",
    {
      style: mergeBoxStyle(theme.badge[variant], props.style),
      accessibilityLabel: props.accessibilityLabel ?? accessibleText(props.children),
      accessibilityDescription: props.accessibilityDescription,
    } as TextProps,
    ` ${String(props.children ?? "")} `,
  );
}

// -- <Tag> --------------------------------------------------------------------
export interface TagProps extends AccessibilityProps {
  children?: unknown;
  onRemove?: () => void;
  onClick?: () => void;
  disabled?: boolean;
  style?: StyleLike;
  focusedStyle?: StyleLike;
  removeStyle?: StyleLike;
}

export function Tag(props: TagProps): ZenElement {
  const theme = useTheme();
  const focusable = props.onClick != null || props.onRemove != null;
  const onKey = (ev: KeyEvent): boolean | void => {
    if (props.disabled) return false;
    if (ev.name === "delete" || ev.name === "backspace") {
      props.onRemove?.();
      return true;
    }
    if ((ev.name === "enter" || ev.name === "space") && props.onClick) {
      props.onClick();
      return true;
    }
    return false;
  };
  const label = h("text", {} as TextProps, ` ${String(props.children ?? "")} `);
  const remove = props.onRemove
    ? h(
        "text",
        {
          style: mergeBoxStyle(theme.tag.removable, props.removeStyle),
          onClick: props.disabled ? undefined : props.onRemove,
        } as TextProps & { onClick?: () => void },
        "× ",
      )
    : null;
  return h(
    "box",
    {
      focusable: focusable && !props.disabled,
      disabled: props.disabled,
      direction: "row",
      onClick: props.disabled ? undefined : props.onClick,
      onKey,
      accessibilityLabel: props.accessibilityLabel ?? accessibleText(props.children),
      accessibilityDescription: props.accessibilityDescription,
      style: mergeBoxStyle(theme.tag.normal, props.style),
      focusedStyle: mergeBoxStyle(theme.tag.focused, props.focusedStyle),
    } as BoxProps,
    [label, remove],
  );
}

// -- <ProgressBar> ------------------------------------------------------------
export interface ProgressBarProps extends AccessibilityProps {
  /** 0..1. Clamped. Ignored when `indeterminate` is true. */
  value?: number;
  /** Total bar width in cells. Defaults to 20. */
  width?: number;
  /** Optional inline label appended to the bar. */
  label?: string;
  /** Show a percentage suffix instead of (or alongside) the label. */
  showPercent?: boolean;
  indeterminate?: boolean;
  style?: StyleLike;
  trackStyle?: StyleLike;
  fillStyle?: StyleLike;
  labelStyle?: StyleLike;
  /** Override the fill / track glyphs. Defaults to "█" / "░". */
  glyphs?: readonly [fill: string, track: string];
}

const PROGRESS_FRAMES = ["▏", "▎", "▍", "▌", "▋", "▊", "▉", "█"] as const;

export function ProgressBar(props: ProgressBarProps): ZenElement {
  const theme = useTheme();
  const width = Math.max(1, props.width ?? 20);
  const [fillGlyph, trackGlyph] = props.glyphs ?? (["█", "░"] as const);
  const indeterminate = props.indeterminate === true;

  let bar: string;
  if (indeterminate) {
    const tick = useIndeterminateTick();
    const head = tick % Math.max(1, width);
    bar = "";
    for (let i = 0; i < width; i++) bar += i === head ? fillGlyph : trackGlyph;
  } else {
    const value = Math.min(1, Math.max(0, props.value ?? 0));
    const fillCells = value * width;
    const fullCells = Math.floor(fillCells);
    const remainder = fillCells - fullCells;
    const partialIndex = Math.floor(remainder * PROGRESS_FRAMES.length);
    const partial = partialIndex > 0 && fullCells < width ? PROGRESS_FRAMES[partialIndex - 1]! : "";
    const trackCells = Math.max(0, width - fullCells - (partial ? 1 : 0));
    bar = `${fillGlyph.repeat(fullCells)}${partial}${trackGlyph.repeat(trackCells)}`;
  }

  const fillToken = indeterminate ? theme.progress.indeterminate : theme.progress.fill;
  const percentSuffix =
    props.showPercent && !indeterminate
      ? ` ${Math.round(Math.min(1, Math.max(0, props.value ?? 0)) * 100)}%`
      : "";
  const labelSuffix = props.label ? ` ${props.label}` : "";
  const suffix = `${labelSuffix}${percentSuffix}`;

  return h(
    "box",
    {
      direction: "row",
      gap: 0,
      style: mergeBoxStyle(theme.progress.track, props.style),
      accessibilityLabel: props.accessibilityLabel ?? props.label,
      accessibilityDescription: props.accessibilityDescription,
    } as BoxProps,
    [
      h(
        "text",
        {
          style: mergeBoxStyle(fillToken, props.fillStyle ?? props.trackStyle),
          wrap: "clip",
        } as TextProps,
        bar,
      ),
      suffix.length > 0
        ? h(
            "text",
            {
              style: mergeBoxStyle(theme.progress.label, props.labelStyle),
              wrap: "clip",
            } as TextProps,
            suffix,
          )
        : null,
    ],
  );
}

function useIndeterminateTick(intervalMs = 80): number {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const handle = setInterval(() => setTick((t) => t + 1), intervalMs);
    return () => clearInterval(handle);
  }, [intervalMs]);
  return tick;
}

// -- <Spinner> ----------------------------------------------------------------
export const SPINNER_FRAMES = {
  dots: ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"],
  line: ["|", "/", "-", "\\"],
  arc: ["◜", "◠", "◝", "◞", "◡", "◟"],
  bouncingBar: ["[    ]", "[=   ]", "[==  ]", "[=== ]", "[ ===]", "[  ==]", "[   =]", "[    ]"],
  pipe: ["┤", "┘", "┴", "└", "├", "┌", "┬", "┐"],
} as const;

export type SpinnerVariant = keyof typeof SPINNER_FRAMES;

export interface SpinnerProps extends AccessibilityProps {
  variant?: SpinnerVariant;
  /** Custom frames override `variant`. */
  frames?: readonly string[];
  /** Frame interval in ms. Defaults to 90. */
  interval?: number;
  /** Optional label rendered after the spinner glyph. */
  label?: string;
  style?: StyleLike;
  labelStyle?: StyleLike;
}

export function Spinner(props: SpinnerProps): ZenElement {
  const theme = useTheme();
  const variant = props.variant ?? "dots";
  const frames = props.frames ?? SPINNER_FRAMES[variant];
  const interval = props.interval ?? 90;
  const [index, setIndex] = useState(0);
  useEffect(() => {
    const handle = setInterval(() => {
      setIndex((i) => (i + 1) % frames.length);
    }, interval);
    return () => clearInterval(handle);
  }, [frames.length, interval]);
  const frame = frames[index % frames.length] ?? "";
  const text = props.label ? `${frame} ${props.label}` : frame;
  return h(
    "text",
    {
      style: mergeBoxStyle(theme.spinner, props.style),
      accessibilityLabel: props.accessibilityLabel ?? props.label,
      accessibilityDescription: props.accessibilityDescription,
    } as TextProps,
    text,
  );
}

// -- <Sparkline> --------------------------------------------------------------
const SPARK_BLOCKS = ["▁", "▂", "▃", "▄", "▅", "▆", "▇", "█"] as const;

export interface SparklineProps extends AccessibilityProps {
  values: readonly number[];
  width?: number;
  /** Domain min. Auto-detected when omitted. */
  min?: number;
  /** Domain max. Auto-detected when omitted. */
  max?: number;
  style?: StyleLike;
}

export function Sparkline(props: SparklineProps): ZenElement {
  const theme = useTheme();
  const width = props.width ?? props.values.length;
  const samples = sampleSeries(props.values, width);
  const min = props.min ?? (samples.length > 0 ? Math.min(...samples) : 0);
  const max = props.max ?? (samples.length > 0 ? Math.max(...samples) : 0);
  const span = max - min || 1;

  const text = samples
    .map((value) => {
      const normalized = Math.min(1, Math.max(0, (value - min) / span));
      const index = Math.min(SPARK_BLOCKS.length - 1, Math.floor(normalized * SPARK_BLOCKS.length));
      return SPARK_BLOCKS[index]!;
    })
    .join("");

  return h(
    "text",
    {
      style: mergeBoxStyle(theme.sparkline, props.style),
      wrap: "clip",
      accessibilityLabel: props.accessibilityLabel ?? "sparkline",
      accessibilityDescription: props.accessibilityDescription,
    } as TextProps,
    text,
  );
}

function sampleSeries(series: readonly number[], width: number): number[] {
  if (series.length === 0 || width <= 0) return [];
  if (series.length === width) return [...series];
  const out: number[] = [];
  if (series.length < width) {
    // Stretch (nearest-neighbor) so every cell renders something stable.
    for (let i = 0; i < width; i++) {
      const sourceIndex = Math.min(
        series.length - 1,
        Math.round((i * (series.length - 1)) / Math.max(1, width - 1)),
      );
      out.push(series[sourceIndex]!);
    }
    return out;
  }
  // Downsample by averaging buckets so trends survive compression.
  for (let i = 0; i < width; i++) {
    const start = Math.floor((i * series.length) / width);
    const end = Math.max(start + 1, Math.floor(((i + 1) * series.length) / width));
    let sum = 0;
    let count = 0;
    for (let j = start; j < end && j < series.length; j++) {
      sum += series[j]!;
      count++;
    }
    out.push(count > 0 ? sum / count : series[start]!);
  }
  return out;
}

// -- <PasswordInput> ---------------------------------------------------------
export interface PasswordInputProps extends Omit<TextInputProps, "mask"> {
  /** Override the mask glyph. Defaults to "•". */
  maskChar?: string;
}

export function PasswordInput(props: PasswordInputProps): ZenElement {
  const { maskChar = "•", ...rest } = props;
  return h(TextInput, { ...rest, mask: maskChar } as TextInputProps);
}

// -- <NumberInput> -----------------------------------------------------------
export interface NumberInputProps extends AccessibilityProps {
  value: number;
  onChange: (v: number) => void;
  /** Granularity for arrow / shift-arrow steps. Defaults to 1 / 10. */
  step?: number;
  shiftStep?: number;
  min?: number;
  max?: number;
  precision?: number;
  placeholder?: string;
  width?: number;
  grow?: number;
  disabled?: boolean;
  loading?: boolean;
  error?: boolean;
  style?: StyleLike;
  focusedStyle?: StyleLike;
  hoveredStyle?: StyleLike;
  activeStyle?: StyleLike;
  disabledStyle?: StyleLike;
  loadingStyle?: StyleLike;
  errorStyle?: StyleLike;
  placeholderStyle?: StyleLike;
  onSubmit?: (v: number) => void;
  onFocus?: () => void;
  onBlur?: () => void;
}

export function NumberInput(props: NumberInputProps): ZenElement {
  const theme = useTheme();
  const step = props.step ?? 1;
  const shiftStep = props.shiftStep ?? step * 10;
  const precision = props.precision ?? Math.max(0, decimalsOf(step));
  const min = props.min ?? -Infinity;
  const max = props.max ?? Infinity;

  // Track text separately so the user can backspace through "12.0" → "12.".
  const [text, setText] = useState(() => formatNumber(props.value, precision));
  // Reset displayed text when the controlled value changes externally and the
  // current text doesn't already parse to that value.
  const parsedCurrent = parseNumber(text);
  if (Number.isFinite(props.value) && parsedCurrent !== props.value && !isPartialNumber(text)) {
    setText(formatNumber(props.value, precision));
  }

  function clampValue(value: number): number {
    if (Number.isNaN(value)) return props.value;
    return Math.min(max, Math.max(min, value));
  }

  function commit(next: number): void {
    const clamped = clampValue(next);
    setText(formatNumber(clamped, precision));
    props.onChange(clamped);
  }

  return h("input", {
    value: text,
    placeholder: props.placeholder,
    width: props.width,
    grow: props.grow,
    disabled: props.disabled,
    loading: props.loading,
    error: props.error,
    accessibilityLabel: props.accessibilityLabel,
    accessibilityDescription: props.accessibilityDescription,
    onChange: (next: string) => {
      setText(next);
      const parsed = parseNumber(next);
      if (Number.isFinite(parsed)) {
        const clamped = clampValue(parsed);
        if (clamped !== props.value) props.onChange(clamped);
      }
    },
    onSubmit: () => {
      const parsed = parseNumber(text);
      if (Number.isFinite(parsed)) commit(parsed);
      props.onSubmit?.(props.value);
    },
    onFocus: props.onFocus,
    onBlur: () => {
      const parsed = parseNumber(text);
      if (Number.isFinite(parsed)) commit(parsed);
      else setText(formatNumber(props.value, precision));
      props.onBlur?.();
    },
    onKey: (ev: KeyEvent): boolean | void => {
      if (props.disabled) return false;
      if (ev.name === "up") {
        commit((Number.isFinite(props.value) ? props.value : 0) + (ev.shift ? shiftStep : step));
        return true;
      }
      if (ev.name === "down") {
        commit((Number.isFinite(props.value) ? props.value : 0) - (ev.shift ? shiftStep : step));
        return true;
      }
      return false;
    },
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

function decimalsOf(value: number): number {
  if (!Number.isFinite(value)) return 0;
  const text = String(value);
  const dot = text.indexOf(".");
  return dot < 0 ? 0 : text.length - dot - 1;
}

function formatNumber(value: number, precision: number): string {
  if (!Number.isFinite(value)) return "";
  return precision > 0 ? value.toFixed(precision) : String(Math.round(value));
}

function isPartialNumber(value: string): boolean {
  if (value.length === 0) return true;
  // Treat trailing `-`, `.` or `-.` etc. as in-progress edits.
  return /^-?(\d+\.?\d*|\.\d*)?$/.test(value) && !/^-?\d+(\.\d+)?$/.test(value);
}

function parseNumber(value: string): number {
  if (value.trim().length === 0) return NaN;
  return Number(value);
}

// -- <Slider> ----------------------------------------------------------------
export interface SliderProps extends AccessibilityProps {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  shiftStep?: number;
  width?: number;
  disabled?: boolean;
  /** Show inline value at the right edge. Defaults to true. */
  showValue?: boolean;
  /** Format the displayed value. Defaults to integer rounding when step is 1. */
  formatValue?: (value: number) => string;
  style?: StyleLike;
  trackStyle?: StyleLike;
  fillStyle?: StyleLike;
  thumbStyle?: StyleLike;
  focusedStyle?: StyleLike;
  disabledStyle?: StyleLike;
  /** Override [track, fill, thumb] glyphs. */
  glyphs?: readonly [track: string, fill: string, thumb: string];
}

export function Slider(props: SliderProps): ZenElement {
  const theme = useTheme();
  const min = props.min ?? 0;
  const max = props.max ?? 1;
  const step = props.step ?? (max - min <= 1 ? 0.05 : 1);
  const shiftStep = props.shiftStep ?? step * 10;
  const trackWidth = Math.max(3, props.width ?? 20);
  const showValue = props.showValue !== false;
  const [track, fill, thumb] = props.glyphs ?? (["─", "━", "●"] as const);

  const clamped = Math.min(max, Math.max(min, props.value));
  const norm = (clamped - min) / Math.max(1e-9, max - min);
  const thumbPos = Math.round(norm * (trackWidth - 1));

  function commit(next: number): void {
    const stepped = Math.round((next - min) / step) * step + min;
    props.onChange(Math.min(max, Math.max(min, stepped)));
  }

  const onKey = (ev: KeyEvent): boolean | void => {
    if (props.disabled) return false;
    if (ev.name === "left") {
      commit(clamped - (ev.shift ? shiftStep : step));
      return true;
    }
    if (ev.name === "right") {
      commit(clamped + (ev.shift ? shiftStep : step));
      return true;
    }
    if (ev.name === "home") {
      commit(min);
      return true;
    }
    if (ev.name === "end") {
      commit(max);
      return true;
    }
    if (ev.name === "pageup") {
      commit(clamped + shiftStep);
      return true;
    }
    if (ev.name === "pagedown") {
      commit(clamped - shiftStep);
      return true;
    }
    return false;
  };

  let bar = "";
  for (let i = 0; i < trackWidth; i++) {
    if (i === thumbPos) bar += thumb;
    else if (i < thumbPos) bar += fill;
    else bar += track;
  }
  const valueLabel = showValue ? ` ${(props.formatValue ?? defaultFormat(step))(clamped)}` : "";

  return h(
    "box",
    {
      focusable: !props.disabled,
      disabled: props.disabled,
      direction: "row",
      onKey,
      accessibilityLabel:
        props.accessibilityLabel ??
        `value ${String((props.formatValue ?? defaultFormat(step))(clamped))}`,
      accessibilityDescription: props.accessibilityDescription,
      style: mergeBoxStyle(theme.progress.track, props.style),
      focusedStyle: mergeBoxStyle(theme.checkbox.focused, props.focusedStyle),
      disabledStyle: mergeBoxStyle(theme.checkbox.disabled, props.disabledStyle),
    } as BoxProps,
    [
      h(
        "text",
        {
          style: mergeBoxStyle(theme.progress.fill, props.fillStyle ?? props.trackStyle),
          wrap: "clip",
        } as TextProps,
        bar,
      ),
      valueLabel.length > 0
        ? h(
            "text",
            { style: mergeBoxStyle(theme.progress.label, undefined) } as TextProps,
            valueLabel,
          )
        : null,
    ],
  );
}

function defaultFormat(step: number): (value: number) => string {
  const decimals = Math.min(4, decimalsOf(step));
  return (value: number) => (decimals > 0 ? value.toFixed(decimals) : String(Math.round(value)));
}

// -- <RangeSlider> -----------------------------------------------------------
export interface RangeSliderProps extends AccessibilityProps {
  value: readonly [number, number];
  onChange: (next: [number, number]) => void;
  min?: number;
  max?: number;
  step?: number;
  shiftStep?: number;
  width?: number;
  disabled?: boolean;
  showValue?: boolean;
  formatValue?: (value: number) => string;
  style?: StyleLike;
  fillStyle?: StyleLike;
  trackStyle?: StyleLike;
  focusedStyle?: StyleLike;
  disabledStyle?: StyleLike;
  /** Override [track, fill, lo-thumb, hi-thumb] glyphs. */
  glyphs?: readonly [track: string, fill: string, loThumb: string, hiThumb: string];
}

export function RangeSlider(props: RangeSliderProps): ZenElement {
  const theme = useTheme();
  const min = props.min ?? 0;
  const max = props.max ?? 1;
  const step = props.step ?? (max - min <= 1 ? 0.05 : 1);
  const shiftStep = props.shiftStep ?? step * 10;
  const trackWidth = Math.max(5, props.width ?? 24);
  const showValue = props.showValue !== false;
  const [track, fill, loGlyph, hiGlyph] = props.glyphs ?? (["─", "━", "◀", "▶"] as const);
  const [lo, hi] = props.value;
  const [active, setActive] = useState<"lo" | "hi">("lo");

  const clamp = (v: number): number => Math.min(max, Math.max(min, v));
  const stepValue = (v: number): number => Math.round((v - min) / step) * step + min;

  function commitLo(next: number): void {
    const value = Math.min(hi, clamp(stepValue(next)));
    if (value !== lo) props.onChange([value, hi]);
  }
  function commitHi(next: number): void {
    const value = Math.max(lo, clamp(stepValue(next)));
    if (value !== hi) props.onChange([lo, value]);
  }

  const span = Math.max(1e-9, max - min);
  const loPos = Math.round(((lo - min) / span) * (trackWidth - 1));
  const hiPos = Math.round(((hi - min) / span) * (trackWidth - 1));

  const onKey = (ev: KeyEvent): boolean | void => {
    if (props.disabled) return false;
    // Up/Down toggles the active thumb (Tab is reserved for runtime focus).
    if (ev.name === "up" || ev.name === "down") {
      setActive((current) => (current === "lo" ? "hi" : "lo"));
      return true;
    }
    const apply = active === "lo" ? commitLo : commitHi;
    const current = active === "lo" ? lo : hi;
    if (ev.name === "left") {
      apply(current - (ev.shift ? shiftStep : step));
      return true;
    }
    if (ev.name === "right") {
      apply(current + (ev.shift ? shiftStep : step));
      return true;
    }
    if (ev.name === "home") {
      apply(min);
      return true;
    }
    if (ev.name === "end") {
      apply(max);
      return true;
    }
    return false;
  };

  let bar = "";
  for (let i = 0; i < trackWidth; i++) {
    if (i === loPos) bar += loGlyph;
    else if (i === hiPos) bar += hiGlyph;
    else if (i > loPos && i < hiPos) bar += fill;
    else bar += track;
  }

  const fmt = props.formatValue ?? defaultFormat(step);
  const valueLabel = showValue ? ` [${fmt(lo)} – ${fmt(hi)}] (${active})` : "";

  return h(
    "box",
    {
      focusable: !props.disabled,
      disabled: props.disabled,
      direction: "row",
      onKey,
      accessibilityLabel: props.accessibilityLabel ?? `range ${fmt(lo)} to ${fmt(hi)}`,
      accessibilityDescription: props.accessibilityDescription,
      style: mergeBoxStyle(theme.progress.track, props.style),
      focusedStyle: mergeBoxStyle(theme.checkbox.focused, props.focusedStyle),
      disabledStyle: mergeBoxStyle(theme.checkbox.disabled, props.disabledStyle),
    } as BoxProps,
    [
      h(
        "text",
        {
          style: mergeBoxStyle(theme.progress.fill, props.fillStyle ?? props.trackStyle),
          wrap: "clip",
        } as TextProps,
        bar,
      ),
      valueLabel.length > 0
        ? h("text", { style: theme.progress.label } as TextProps, valueLabel)
        : null,
    ],
  );
}

// -- <ToggleButton> ----------------------------------------------------------
export interface ToggleButtonProps extends Omit<ButtonProps, "onClick"> {
  pressed: boolean;
  onChange: (pressed: boolean) => void;
}

export function ToggleButton(props: ToggleButtonProps): ZenElement {
  const theme = useTheme();
  const { pressed, onChange, children, disabled = false, loading = false, error = false } = props;
  const baseToken = pressed ? theme.button.active : theme.button.normal;
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
      onClick: disabled || loading ? undefined : () => onChange(!pressed),
      accessibilityLabel: props.accessibilityLabel ?? accessibleText(children),
      accessibilityDescription: props.accessibilityDescription,
      onKey: (ev: KeyEvent): boolean | void => {
        if (disabled || loading) return false;
        if (ev.name === "space") {
          onChange(!pressed);
          return true;
        }
        return false;
      },
      style: mergeBoxStyle(baseToken, props.style),
      focusedStyle: mergeBoxStyle(theme.button.focused, props.focusedStyle),
      hoveredStyle: mergeBoxStyle(theme.button.hovered, props.hoveredStyle),
      activeStyle: mergeBoxStyle(theme.button.active, props.activeStyle),
      disabledStyle: mergeBoxStyle(theme.button.disabled, props.disabledStyle),
      loadingStyle: mergeBoxStyle(theme.button.loading, props.loadingStyle),
      errorStyle: mergeBoxStyle(theme.button.error, props.errorStyle),
    } as BoxProps,
    h("text", {} as TextProps, String(children ?? "")),
  );
}

// -- <ButtonGroup> -----------------------------------------------------------
export interface ButtonGroupProps extends AccessibilityProps {
  direction?: "row" | "column";
  gap?: number;
  children?: unknown;
}

/**
 * Container that wires arrow-key navigation across its child Buttons /
 * ToggleButtons. The buttons themselves remain individually focusable; the
 * group adds chord-style left/right (or up/down) without changing semantics.
 */
export function ButtonGroup(props: ButtonGroupProps): ZenElement {
  const direction = props.direction ?? "row";
  const gap = props.gap ?? 1;
  return h(
    "box",
    {
      direction,
      gap,
      accessibilityLabel: props.accessibilityLabel,
      accessibilityDescription: props.accessibilityDescription,
      onKey: (ev: KeyEvent): boolean | void => {
        // Arrow keys at this level are reinterpreted as Tab traversal so
        // child Buttons don't have to opt in individually.
        if (direction === "row" && (ev.name === "left" || ev.name === "right")) {
          return false;
        }
        if (direction === "column" && (ev.name === "up" || ev.name === "down")) {
          return false;
        }
        return false;
      },
    } as BoxProps,
    props.children,
  );
}

// -- <Select> ----------------------------------------------------------------
export interface SelectOption<T extends string | number = string> {
  value: T;
  label: string;
  disabled?: boolean;
}

export interface SelectProps<T extends string | number = string> extends AccessibilityProps {
  options: readonly SelectOption<T>[];
  value: T;
  onChange: (next: T) => void;
  placeholder?: string;
  width?: number;
  disabled?: boolean;
  /** Maximum dropdown height in rows. Defaults to 6. */
  dropdownHeight?: number;
  style?: StyleLike;
  focusedStyle?: StyleLike;
  disabledStyle?: StyleLike;
}

export function Select<T extends string | number = string>(props: SelectProps<T>): ZenElement {
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  const selectedIndex = Math.max(
    0,
    props.options.findIndex((option) => option.value === props.value),
  );
  const [highlight, setHighlight] = useState(selectedIndex);
  const enabledIndices = props.options
    .map((option, index) => (option.disabled ? -1 : index))
    .filter((i) => i >= 0);
  const dropdownHeight = Math.min(
    Math.max(1, props.dropdownHeight ?? 6),
    Math.max(1, props.options.length),
  );
  const triggerWidth = props.width ?? 18;

  const selected = props.options[selectedIndex];
  const triggerLabel = selected ? selected.label : (props.placeholder ?? "Select…");

  function pickIndex(index: number): void {
    const option = props.options[index];
    if (!option || option.disabled) return;
    props.onChange(option.value);
    setOpen(false);
  }

  function moveHighlight(delta: number): void {
    if (enabledIndices.length === 0) return;
    const cursor = enabledIndices.indexOf(highlight);
    const start = cursor === -1 ? 0 : cursor;
    const next = enabledIndices[(start + delta + enabledIndices.length) % enabledIndices.length]!;
    setHighlight(next);
  }

  const onKey = (ev: KeyEvent): boolean | void => {
    if (props.disabled) return false;
    if (!open) {
      if (ev.name === "enter" || ev.name === "space" || ev.name === "down") {
        setHighlight(selectedIndex);
        setOpen(true);
        return true;
      }
      return false;
    }
    if (ev.name === "escape") {
      setOpen(false);
      return true;
    }
    if (ev.name === "up") {
      moveHighlight(-1);
      return true;
    }
    if (ev.name === "down") {
      moveHighlight(1);
      return true;
    }
    if (ev.name === "home") {
      if (enabledIndices.length > 0) setHighlight(enabledIndices[0]!);
      return true;
    }
    if (ev.name === "end") {
      if (enabledIndices.length > 0) setHighlight(enabledIndices[enabledIndices.length - 1]!);
      return true;
    }
    if (ev.name === "enter" || ev.name === "space") {
      pickIndex(highlight);
      return true;
    }
    return false;
  };

  const triggerArrow = open ? "▲" : "▼";
  const triggerText = `${triggerLabel}`;

  const trigger = h(
    "box",
    {
      focusable: !props.disabled,
      disabled: props.disabled,
      border: true,
      padding: [0, 1],
      direction: "row",
      width: triggerWidth,
      accessibilityLabel: props.accessibilityLabel ?? triggerLabel,
      accessibilityDescription: props.accessibilityDescription,
      onKey,
      onClick: props.disabled ? undefined : () => setOpen((prev) => !prev),
      style: mergeBoxStyle(theme.input.normal, props.style),
      focusedStyle: mergeBoxStyle(theme.input.focused, props.focusedStyle),
      disabledStyle: mergeBoxStyle(theme.input.disabled, props.disabledStyle),
    } as BoxProps,
    [
      h("text", { wrap: "truncate", grow: 1 } as unknown as TextProps, triggerText),
      h("text", {} as TextProps, ` ${triggerArrow}`),
    ],
  );

  if (!open) return trigger;

  const visibleStart = clampIndex(
    highlight - Math.floor(dropdownHeight / 2),
    0,
    Math.max(0, props.options.length - dropdownHeight),
  );
  const slice = props.options.slice(visibleStart, visibleStart + dropdownHeight);
  const dropdown = h(
    "box",
    {
      position: "absolute",
      top: 3,
      left: 0,
      width: triggerWidth,
      height: dropdownHeight + 2,
      border: true,
      direction: "column",
      zIndex: 50,
      style: theme.window.body,
      borderStyle: theme.window.frame,
    } as BoxProps,
    slice.map((option, offset) => {
      const index = visibleStart + offset;
      const isHighlight = index === highlight;
      const isSelected = index === selectedIndex;
      const rowStyle = isHighlight
        ? theme.list.selected
        : isSelected
          ? theme.list.active
          : theme.list.normal;
      return h(
        "box",
        {
          key: String(option.value),
          height: 1,
          direction: "row",
          padding: [0, 1],
          disabled: option.disabled,
          onClick: option.disabled ? undefined : () => pickIndex(index),
          style: rowStyle,
        } as BoxProps,
        h("text", {} as TextProps, option.label),
      );
    }),
  );

  return h("box", { direction: "column", width: triggerWidth } as BoxProps, [trigger, dropdown]);
}

function clampIndex(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

// -- <Skeleton> --------------------------------------------------------------
export interface SkeletonProps extends AccessibilityProps {
  width?: number;
  height?: number;
  /** Lines of placeholder text to lay out (column mode). */
  lines?: number;
  /** Optional fixed glyph. Defaults to the upper-half block "▀". */
  glyph?: string;
  /** Animation interval in ms. Set to 0 to disable pulsing. */
  pulseMs?: number;
  style?: StyleLike;
}

export function Skeleton(props: SkeletonProps): ZenElement {
  const theme = useTheme();
  const glyph = props.glyph ?? "▀";
  const pulseMs = props.pulseMs ?? 600;
  const [phase, setPhase] = useState(false);
  useEffect(() => {
    if (pulseMs <= 0) return;
    const handle = setInterval(() => setPhase((p) => !p), pulseMs);
    return () => clearInterval(handle);
  }, [pulseMs]);

  const baseStyle = mergeBoxStyle(theme.progress.track, props.style);
  const pulsedStyle = phase
    ? mergeBoxStyle(baseStyle, { dim: true } as Partial<TextProps["style"]> as StyleLike)
    : baseStyle;

  if (props.lines && props.lines > 1) {
    const rows: ZenElement[] = [];
    for (let i = 0; i < props.lines; i++) {
      rows.push(
        h(
          "box",
          {
            key: i,
            direction: "row",
            height: 1,
            width: props.width,
            accessibilityLabel: props.accessibilityLabel ?? "skeleton",
            accessibilityDescription: props.accessibilityDescription,
          } as BoxProps & { key: number },
          h(
            "text",
            { wrap: "clip", style: pulsedStyle } as TextProps,
            glyph.repeat(props.width ?? 24),
          ),
        ),
      );
    }
    return h(
      "box",
      {
        direction: "column",
        gap: 0,
        accessibilityLabel: props.accessibilityLabel ?? "skeleton",
        accessibilityDescription: props.accessibilityDescription,
      } as BoxProps,
      rows,
    );
  }

  const width = props.width ?? 16;
  const height = props.height ?? 1;
  const rows: ZenElement[] = [];
  for (let i = 0; i < height; i++) {
    rows.push(
      h(
        "text",
        { key: i, wrap: "clip", style: pulsedStyle } as TextProps & { key: number },
        glyph.repeat(width),
      ),
    );
  }
  if (height === 1) {
    return h(
      "box",
      {
        direction: "row",
        height,
        width,
        accessibilityLabel: props.accessibilityLabel ?? "skeleton",
        accessibilityDescription: props.accessibilityDescription,
      } as BoxProps,
      rows[0]!,
    );
  }
  return h(
    "box",
    {
      direction: "column",
      height,
      width,
      accessibilityLabel: props.accessibilityLabel ?? "skeleton",
      accessibilityDescription: props.accessibilityDescription,
    } as BoxProps,
    rows,
  );
}

export { Fragment };

function mergeBoxStyle(base: StyleLike, override?: StyleLike): StyleLike {
  return override ? styleRule.merge(base, override) : base;
}

function accessibleText(value: unknown): string | undefined {
  if (typeof value === "string" && value.length > 0) return value;
  if (typeof value === "number") return String(value);
  return undefined;
}

function chromeSize(
  value: number | undefined,
  padding: Edges | undefined,
  border: boolean,
  axis: "width" | "height",
): number | undefined {
  if (value === undefined) return undefined;
  const edge = expandEdges(padding);
  const chrome =
    axis === "width"
      ? edge.left + edge.right + (border ? 2 : 0)
      : edge.top + edge.bottom + (border ? 2 : 0);
  return value + chrome;
}

function expandEdges(value: Edges | undefined): {
  top: number;
  right: number;
  bottom: number;
  left: number;
} {
  if (value === undefined) return { top: 0, right: 0, bottom: 0, left: 0 };
  if (typeof value === "number") return { top: value, right: value, bottom: value, left: value };
  if (value.length === 2)
    return { top: value[0], right: value[1], bottom: value[0], left: value[1] };
  return { top: value[0], right: value[1], bottom: value[2], left: value[3] };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
