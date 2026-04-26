import { h } from "./runtime/element.js";
import type {
  AccessibilityProps,
  BoxProps,
  StyleLike,
  TextProps,
  ZenElement,
} from "./runtime/element.js";
import type { KeyEvent } from "./input/keys.js";
import { useEffect, useState, useTheme } from "./runtime/hooks.js";
import { style as styleRule } from "./style/index.js";
import { Kbd } from "./components.js";

function mergeBoxStyle(base: StyleLike, override?: StyleLike): StyleLike {
  return override ? styleRule.merge(base, override) : base;
}

function accessibleText(value: unknown): string | undefined {
  if (typeof value === "string" && value.length > 0) return value;
  if (typeof value === "number") return String(value);
  return undefined;
}

// -- <IconButton> ------------------------------------------------------------
export interface IconButtonProps extends AccessibilityProps {
  /** Single glyph or short string. */
  icon: string;
  onClick?: () => void;
  disabled?: boolean;
  loading?: boolean;
  error?: boolean;
  /** Accessible label for screen-reader-aware terminals. */
  ariaLabel?: string;
  style?: StyleLike;
  focusedStyle?: StyleLike;
  hoveredStyle?: StyleLike;
}

export function IconButton(props: IconButtonProps): ZenElement {
  const theme = useTheme();
  const { icon, onClick, disabled = false, loading = false, error = false } = props;
  return h(
    "box",
    {
      focusable: !disabled,
      disabled,
      loading,
      error,
      direction: "row",
      padding: [0, 1],
      onClick: disabled || loading ? undefined : onClick,
      accessibilityLabel: props.accessibilityLabel ?? props.ariaLabel,
      accessibilityDescription: props.accessibilityDescription,
      onKey: (ev: KeyEvent): boolean | void => {
        if (disabled || loading) return false;
        if (ev.name === "space" || ev.name === "enter") {
          onClick?.();
          return true;
        }
        return false;
      },
      style: mergeBoxStyle(theme.button.normal, props.style),
      focusedStyle: mergeBoxStyle(theme.button.focused, props.focusedStyle),
      hoveredStyle: mergeBoxStyle(theme.button.hovered, props.hoveredStyle),
      activeStyle: theme.button.active,
      disabledStyle: theme.button.disabled,
      loadingStyle: theme.button.loading,
      errorStyle: theme.button.error,
    } as BoxProps,
    h(
      "text",
      {
        accessibilityLabel: props.accessibilityLabel ?? props.ariaLabel,
        accessibilityDescription: props.accessibilityDescription,
      } as TextProps,
      icon,
    ),
  );
}

// -- <Avatar> ----------------------------------------------------------------
export interface AvatarProps extends AccessibilityProps {
  /** Display name. The first letter (or initials) becomes the glyph. */
  name?: string;
  /** Override the rendered glyph(s). */
  glyph?: string;
  /** Size in cells (1 = 1 cell wide, 2 = 2 cells, etc). Defaults to 3. */
  size?: number;
  variant?: "primary" | "accent";
  style?: StyleLike;
}

export function Avatar(props: AvatarProps): ZenElement {
  const theme = useTheme();
  const size = Math.max(1, props.size ?? 3);
  const glyph = props.glyph ?? initialsFor(props.name ?? "");
  const tokenStyle = props.variant === "accent" ? theme.avatar.accent : theme.avatar.base;
  const padding = Math.max(0, size - glyph.length);
  const text = " ".repeat(Math.floor(padding / 2)) + glyph + " ".repeat(Math.ceil(padding / 2));
  return h(
    "box",
    {
      direction: "row",
      width: size,
      height: 1,
      accessibilityLabel: props.accessibilityLabel ?? props.name ?? glyph,
      accessibilityDescription: props.accessibilityDescription,
      style: mergeBoxStyle(tokenStyle, props.style),
    } as BoxProps,
    h("text", {} as TextProps, text),
  );
}

function initialsFor(name: string): string {
  const trimmed = name.trim();
  if (trimmed.length === 0) return "?";
  const parts = trimmed.split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("");
}

// -- <Pill> -------------------------------------------------------------------
export interface PillProps extends AccessibilityProps {
  variant?: "neutral" | "info" | "success" | "warning" | "danger";
  /** Optional leading glyph. */
  icon?: string;
  children?: unknown;
  style?: StyleLike;
}

export function Pill(props: PillProps): ZenElement {
  const theme = useTheme();
  const variant = props.variant ?? "neutral";
  const tokenStyle = theme.badge[variant];
  const text = props.icon
    ? `( ${props.icon} ${String(props.children ?? "")} )`
    : `( ${String(props.children ?? "")} )`;
  return h(
    "text",
    {
      style: mergeBoxStyle(tokenStyle, props.style),
      accessibilityLabel: props.accessibilityLabel ?? accessibleText(props.children),
      accessibilityDescription: props.accessibilityDescription,
    } as TextProps,
    text,
  );
}

// -- <Chip> -------------------------------------------------------------------
// Kept as a separate export for §6's Chip / Tag distinction. Currently
// renders a Tag-style row with an optional leading glyph.
export interface ChipProps extends AccessibilityProps {
  /** Leading icon / status glyph. */
  icon?: string;
  children?: unknown;
  onRemove?: () => void;
  onClick?: () => void;
  disabled?: boolean;
  style?: StyleLike;
}

export function Chip(props: ChipProps): ZenElement {
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
  const label = `${props.icon ? `${props.icon} ` : ""}${String(props.children ?? "")}`;
  return h(
    "box",
    {
      focusable: focusable && !props.disabled,
      disabled: props.disabled,
      direction: "row",
      onClick: props.disabled ? undefined : props.onClick,
      accessibilityLabel: props.accessibilityLabel ?? label,
      accessibilityDescription: props.accessibilityDescription,
      onKey,
      style: mergeBoxStyle(theme.tag.normal, props.style),
      focusedStyle: theme.tag.focused,
    } as BoxProps,
    [
      h("text", {} as TextProps, ` ${label} `),
      props.onRemove
        ? h(
            "text",
            {
              style: theme.tag.removable,
              onClick: props.disabled ? undefined : props.onRemove,
            } as TextProps & { onClick?: () => void },
            "× ",
          )
        : null,
    ],
  );
}

// -- <Card> -------------------------------------------------------------------
export interface CardProps extends AccessibilityProps {
  title?: string;
  /** Footer rendered as a separate row at the bottom. */
  footer?: ZenElement | string;
  children?: unknown;
  width?: number;
  height?: number;
  padding?: BoxProps["padding"];
  style?: StyleLike;
  headerStyle?: StyleLike;
  footerStyle?: StyleLike;
}

export function Card(props: CardProps): ZenElement {
  const theme = useTheme();
  const padding = props.padding ?? 1;
  const sections: ZenElement[] = [];
  if (props.title) {
    sections.push(
      h(
        "text",
        {
          style: mergeBoxStyle(theme.card.header, props.headerStyle),
        } as TextProps,
        props.title,
      ),
    );
  }
  sections.push(h("box", { direction: "column", grow: 1 } as BoxProps, props.children));
  if (props.footer != null) {
    sections.push(
      h(
        "box",
        {
          direction: "row",
          height: 1,
          style: mergeBoxStyle(theme.card.header, props.footerStyle),
        } as BoxProps,
        typeof props.footer === "string" ? h("text", {} as TextProps, props.footer) : props.footer,
      ),
    );
  }
  return h(
    "box",
    {
      direction: "column",
      border: true,
      padding,
      gap: 1,
      width: props.width,
      height: props.height,
      accessibilityLabel: props.accessibilityLabel ?? props.title,
      accessibilityDescription: props.accessibilityDescription,
      style: mergeBoxStyle(theme.card.base, props.style),
      borderStyle: theme.window.frame,
    } as BoxProps,
    sections,
  );
}

// -- <ProgressRing> ----------------------------------------------------------
const RING_FRAMES = ["◐", "◓", "◑", "◒"] as const;

export interface ProgressRingProps extends AccessibilityProps {
  /** When provided, renders a fill marker. 0..1. Otherwise spins. */
  value?: number;
  label?: string;
  /** Frame interval in ms. Defaults to 120. Indeterminate only. */
  intervalMs?: number;
  style?: StyleLike;
  labelStyle?: StyleLike;
}

export function ProgressRing(props: ProgressRingProps): ZenElement {
  const theme = useTheme();
  const isDeterminate = typeof props.value === "number";
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (isDeterminate) return;
    const handle = setInterval(() => setTick((t) => t + 1), props.intervalMs ?? 120);
    return () => clearInterval(handle);
  }, [isDeterminate, props.intervalMs]);

  const glyph = isDeterminate
    ? quarterGlyphForValue(Math.min(1, Math.max(0, props.value ?? 0)))
    : RING_FRAMES[tick % RING_FRAMES.length]!;
  const text = props.label ? `${glyph} ${props.label}` : glyph;
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

function quarterGlyphForValue(value: number): string {
  if (value <= 0.0) return "○";
  if (value < 0.25) return "◜";
  if (value < 0.5) return RING_FRAMES[0]!;
  if (value < 0.75) return RING_FRAMES[1]!;
  if (value < 1.0) return RING_FRAMES[2]!;
  return "●";
}

// -- <KeyHints> --------------------------------------------------------------
export interface KeyHint {
  /** Key chord, e.g. "Ctrl+K" or just "?". */
  keys: string | readonly string[];
  /** Short description shown next to the chord. */
  label: string;
}

export interface KeyHintsProps extends AccessibilityProps {
  hints: readonly KeyHint[];
  /** Layout direction. Defaults to row. */
  direction?: "row" | "column";
  separator?: string;
  style?: StyleLike;
}

export function KeyHints(props: KeyHintsProps): ZenElement {
  const direction = props.direction ?? "row";
  const sep = props.separator ?? "  ";
  const items: ZenElement[] = [];
  props.hints.forEach((hint, i) => {
    items.push(
      h("box", { key: `hint-${i}`, direction: "row", gap: 0 } as BoxProps, [
        h(Kbd, { children: hint.keys }),
        h("text", { style: { dim: true } as StyleLike } as TextProps, ` ${hint.label}`),
      ]),
    );
    if (direction === "row" && i < props.hints.length - 1) {
      items.push(
        h(
          "text",
          { key: `sep-${i}`, style: { dim: true } as StyleLike } as TextProps & { key: string },
          sep,
        ),
      );
    }
  });
  return h(
    "box",
    {
      direction,
      gap: direction === "column" ? 0 : 0,
      style: props.style,
      accessibilityLabel: props.accessibilityLabel ?? "key hints",
      accessibilityDescription: props.accessibilityDescription,
    } as BoxProps,
    items,
  );
}

// -- Layout slots: Sidebar / TopBar / BottomBar / StatusBar ------------------
export interface SlotProps extends AccessibilityProps {
  width?: number;
  height?: number;
  padding?: BoxProps["padding"];
  children?: unknown;
  style?: StyleLike;
}

export function Sidebar(props: SlotProps): ZenElement {
  const theme = useTheme();
  return h(
    "box",
    {
      direction: "column",
      width: props.width ?? 24,
      height: props.height,
      padding: props.padding ?? 1,
      accessibilityLabel: props.accessibilityLabel,
      accessibilityDescription: props.accessibilityDescription,
      style: mergeBoxStyle(theme.window.body, props.style),
      borderStyle: theme.window.frame,
    } as BoxProps,
    props.children,
  );
}

export function TopBar(props: SlotProps): ZenElement {
  const theme = useTheme();
  return h(
    "box",
    {
      direction: "row",
      height: props.height ?? 1,
      padding: props.padding ?? [0, 1],
      align: "center",
      accessibilityLabel: props.accessibilityLabel,
      accessibilityDescription: props.accessibilityDescription,
      style: mergeBoxStyle(theme.window.title, props.style),
    } as BoxProps,
    props.children,
  );
}

export function BottomBar(props: SlotProps): ZenElement {
  const theme = useTheme();
  return h(
    "box",
    {
      direction: "row",
      height: props.height ?? 1,
      padding: props.padding ?? [0, 1],
      align: "center",
      accessibilityLabel: props.accessibilityLabel,
      accessibilityDescription: props.accessibilityDescription,
      style: mergeBoxStyle(theme.statusBar, props.style),
    } as BoxProps,
    props.children,
  );
}

export interface StatusBarProps extends AccessibilityProps {
  /** Left-aligned section. */
  left?: ZenElement | string;
  /** Center section. */
  center?: ZenElement | string;
  /** Right-aligned section. */
  right?: ZenElement | string;
  height?: number;
  style?: StyleLike;
}

export function StatusBar(props: StatusBarProps): ZenElement {
  const theme = useTheme();
  const wrap = (slot: ZenElement | string | undefined): ZenElement | null => {
    if (slot == null) return null;
    return typeof slot === "string" ? h("text", {} as TextProps, slot) : slot;
  };
  return h(
    "box",
    {
      direction: "row",
      height: props.height ?? 1,
      padding: [0, 1],
      justify: "between",
      accessibilityLabel: props.accessibilityLabel ?? "status bar",
      accessibilityDescription: props.accessibilityDescription,
      style: mergeBoxStyle(theme.statusBar, props.style),
    } as BoxProps,
    [
      h("box", { direction: "row", grow: 1 } as BoxProps, wrap(props.left)),
      h("box", { direction: "row", justify: "center", grow: 1 } as BoxProps, wrap(props.center)),
      h("box", { direction: "row", justify: "end", grow: 1 } as BoxProps, wrap(props.right)),
    ],
  );
}

// -- <Notifications> ---------------------------------------------------------
export type NotificationKind = "info" | "success" | "warning" | "danger";

export interface NotificationItem {
  id: string | number;
  kind?: NotificationKind;
  title?: string;
  message: string;
  /** Auto-dismiss after `ttlMs`. Caller still owns the queue. */
  ttlMs?: number;
}

export interface NotificationsProps extends AccessibilityProps {
  items: readonly NotificationItem[];
  onDismiss?: (id: string | number) => void;
  width?: number;
}

export function Notifications(props: NotificationsProps): ZenElement {
  const theme = useTheme();
  return h(
    "box",
    {
      direction: "column",
      gap: 1,
      width: props.width ?? 40,
      accessibilityLabel: props.accessibilityLabel ?? "notifications",
      accessibilityDescription: props.accessibilityDescription,
    } as BoxProps,
    props.items.map((item) =>
      h(
        "box",
        {
          key: item.id,
          direction: "row",
          padding: [0, 1],
          justify: "between",
          style: theme.notification[item.kind ?? "info"],
          onClick: props.onDismiss ? () => props.onDismiss?.(item.id) : undefined,
        } as BoxProps,
        [
          h("box", { direction: "column", grow: 1 } as BoxProps, [
            item.title
              ? h("text", { style: { bold: true } as StyleLike } as TextProps, item.title)
              : null,
            h("text", { wrap: "truncate" } as TextProps, item.message),
          ]),
          props.onDismiss
            ? h("text", { style: { bold: true } as StyleLike } as TextProps, "×")
            : null,
        ],
      ),
    ),
  );
}
