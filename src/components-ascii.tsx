import { h } from "./runtime/element.js";
import type {
  AccessibilityProps,
  BoxProps,
  StyleLike,
  TextProps,
  ZenElement,
} from "./runtime/element.js";
import { useTheme } from "./runtime/hooks.js";
import { style as styleRule } from "./style/index.js";
import { figletBlock } from "./render/figlet-block.js";
import { stringWidth } from "./render/unicode.js";

function mergeBoxStyle(base: StyleLike, override?: StyleLike): StyleLike {
  return override ? styleRule.merge(base, override) : base;
}

// -- <AsciiArt> --------------------------------------------------------------
export interface AsciiArtProps extends AccessibilityProps {
  /** Multi-line art. Each `\n` becomes one terminal row. Trailing spaces preserved. */
  children: string;
  /** Force the column count for measurement. Defaults to longest line width. */
  width?: number;
  /** Overall height. Defaults to line count. */
  height?: number;
  /** Horizontal alignment when `width` is wider than the content. */
  align?: "start" | "center" | "end";
  /** Override per-row style (color, dim, bold, etc.). */
  style?: StyleLike;
  /** Optional border around the canvas. */
  border?: boolean;
  borderStyle?: StyleLike;
  /** When true, blank lines render an empty row instead of being collapsed. */
  preserveBlankLines?: boolean;
}

export function AsciiArt(props: AsciiArtProps): ZenElement {
  const theme = useTheme();
  const lines = (props.children ?? "").split("\n");
  const naturalWidth = lines.reduce((m, line) => Math.max(m, stringWidth(line)), 0);
  const totalWidth = props.width ?? naturalWidth;
  const align = props.align ?? "start";

  const rendered = lines.map((line, i) => {
    const w = stringWidth(line);
    const pad = Math.max(0, totalWidth - w);
    let prefix = "";
    let suffix = "";
    if (align === "center") {
      prefix = " ".repeat(Math.floor(pad / 2));
      suffix = " ".repeat(Math.ceil(pad / 2));
    } else if (align === "end") {
      prefix = " ".repeat(pad);
    } else {
      suffix = " ".repeat(pad);
    }
    const text = `${prefix}${line}${suffix}`;
    if (text.length === 0 && !props.preserveBlankLines) {
      return h("text", { key: i } as TextProps & { key: number }, " ");
    }
    return h(
      "text",
      {
        key: i,
        wrap: "clip",
        style: mergeBoxStyle(theme.spinner, props.style),
      } as TextProps & { key: number },
      text.length === 0 ? " " : text,
    );
  });

  return h(
    "box",
    {
      direction: "column",
      gap: 0,
      width: totalWidth + (props.border ? 2 : 0),
      height: props.height ?? lines.length + (props.border ? 2 : 0),
      border: props.border,
      borderStyle: props.borderStyle ?? theme.window.frame,
      accessibilityLabel: props.accessibilityLabel ?? "ascii art",
      accessibilityDescription: props.accessibilityDescription,
    } as BoxProps,
    rendered,
  );
}

// -- <BigText> ---------------------------------------------------------------
export interface BigTextProps extends AccessibilityProps {
  /** Source text. Letters fall back to a question-mark glyph. */
  children: string;
  /** Spacing between glyphs (in cells). Defaults to 0. */
  spacing?: number;
  /** Horizontal alignment when used inside a constrained parent. */
  align?: "start" | "center" | "end";
  /** Theme token override — defaults to the spinner accent. */
  style?: StyleLike;
  /** Override character used for filled cells. Defaults to "█". */
  glyph?: string;
}

export function BigText(props: BigTextProps): ZenElement {
  const text = figletBlock(props.children, { spacing: props.spacing });
  const replaced = props.glyph && props.glyph !== "█" ? text.replaceAll("█", props.glyph) : text;
  return h(AsciiArt, {
    children: replaced,
    align: props.align,
    style: props.style,
    accessibilityLabel: props.accessibilityLabel ?? props.children,
    accessibilityDescription: props.accessibilityDescription,
  } as Record<string, unknown>);
}

// -- <Banner> ---------------------------------------------------------------
export interface BannerProps extends AccessibilityProps {
  /** Title rendered with `BigText`. */
  title: string;
  /** Optional subtitle rendered as a single text row. */
  subtitle?: string;
  /** Decorative ASCII art shown above the title. */
  art?: string;
  /** Width override; defaults to natural width of the largest section. */
  width?: number;
  /** Border around the banner. Defaults to true. */
  border?: boolean;
  align?: "start" | "center" | "end";
  /** Optional block-text glyph override. */
  glyph?: string;
  style?: StyleLike;
  borderStyle?: StyleLike;
  subtitleStyle?: StyleLike;
}

export function Banner(props: BannerProps): ZenElement {
  const theme = useTheme();
  const align = props.align ?? "center";
  const sections: ZenElement[] = [];
  if (props.art) {
    sections.push(h(AsciiArt, { children: props.art, align } as Record<string, unknown>));
  }
  sections.push(
    h(BigText, {
      children: props.title,
      align,
      glyph: props.glyph,
      style: props.style,
    } as Record<string, unknown>),
  );
  if (props.subtitle) {
    sections.push(
      h(
        "text",
        {
          style: mergeBoxStyle(theme.window.title, props.subtitleStyle),
        } as TextProps,
        props.subtitle,
      ),
    );
  }
  return h(
    "box",
    {
      direction: "column",
      gap: 1,
      align,
      padding: 1,
      width: props.width,
      border: props.border ?? true,
      borderStyle: props.borderStyle ?? theme.window.frame,
      accessibilityLabel: props.accessibilityLabel ?? props.title,
      accessibilityDescription: props.accessibilityDescription ?? props.subtitle,
    } as BoxProps,
    sections,
  );
}

// -- <SplashScreen> ---------------------------------------------------------
export interface SplashScreenProps extends AccessibilityProps {
  /** Decorative art rendered as a wide canvas. */
  art?: string;
  /** Block-text title. */
  title: string;
  /** Subtitle rendered below the title. */
  subtitle?: string;
  /** Side panels (left and right of the title). */
  leftPanel?: ZenElement | string;
  rightPanel?: ZenElement | string;
  /** Footer row at the bottom. */
  footer?: ZenElement | string;
  /** Border around the splash region. Defaults to true. */
  border?: boolean;
  /** Override the splash glyph (e.g. " " for a sparser look). */
  glyph?: string;
  style?: StyleLike;
}

/**
 * High-level layout helper for full-screen splash / title screens. Composes
 * a `Banner` with optional left/right info panels and a footer. The result
 * fills its parent so it can drop straight into an `<App>` shell.
 */
export function SplashScreen(props: SplashScreenProps): ZenElement {
  const theme = useTheme();
  const wrap = (slot: ZenElement | string | undefined): ZenElement | null => {
    if (slot == null) return null;
    return typeof slot === "string" ? h("text", {} as TextProps, slot) : slot;
  };
  const center = h(Banner, {
    title: props.title,
    subtitle: props.subtitle,
    art: props.art,
    glyph: props.glyph,
    border: false,
    style: props.style,
  } as Record<string, unknown>);

  const middleRow = h(
    "box",
    { direction: "row", gap: 2, justify: "between", grow: 1 } as BoxProps,
    [
      props.leftPanel
        ? h("box", { direction: "column", width: 24 } as BoxProps, wrap(props.leftPanel))
        : null,
      h("box", { direction: "column", grow: 1, align: "center" } as BoxProps, center),
      props.rightPanel
        ? h("box", { direction: "column", width: 24 } as BoxProps, wrap(props.rightPanel))
        : null,
    ],
  );

  return h(
    "box",
    {
      direction: "column",
      grow: 1,
      padding: 1,
      gap: 1,
      border: props.border ?? true,
      borderStyle: theme.window.frame,
      style: props.style,
      accessibilityLabel: props.accessibilityLabel ?? props.title,
      accessibilityDescription: props.accessibilityDescription ?? props.subtitle,
    } as BoxProps,
    [
      middleRow,
      props.footer
        ? h(
            "box",
            { direction: "row", justify: "center", height: 1 } as BoxProps,
            wrap(props.footer),
          )
        : null,
    ],
  );
}

// Re-export the figlet helper so apps can render block text without going
// through the BigText component (e.g. for static rendering, snapshots).
export { figletBlock } from "./render/figlet-block.js";
