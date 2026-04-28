import { h } from "./runtime/element.js";
import type {
  AccessibilityProps,
  BoxProps,
  StyleLike,
  TextProps,
  ZenElement,
} from "./runtime/element.js";
import { useEffect, useMotion, useState, useTheme } from "./runtime/hooks.js";
import { style as styleRule } from "./style/index.js";
import type { Easing, EasingName } from "./runtime/motion.js";

function mergeBoxStyle(base: StyleLike, override?: StyleLike): StyleLike {
  return override ? styleRule.merge(base, override) : base;
}

// -- <Transition> ------------------------------------------------------------
export type TransitionPreset = "fade" | "slide-up" | "slide-down" | "slide-left" | "slide-right" | "expand" | "bounce";

export interface TransitionProps extends AccessibilityProps {
  show: boolean;
  children?: unknown;
  preset?: TransitionPreset;
  /** Override the per-edge motion. */
  enter?: TransitionPreset;
  leave?: TransitionPreset;
  /** Duration in ms. Defaults to 220. */
  duration?: number;
  easing?: Easing | EasingName;
  /** When true, fully unmount children when leave animation completes. */
  unmount?: boolean;
}

/**
 * Transition wraps `children` with an enter/leave animation gate. In a
 * pixel-poor terminal we can't blend opacity, so motion is expressed
 * through `dim`, `bold`, and shifted padding. The wrapper still stays
 * mounted while the leave animation runs so consumers can compose
 * cross-fades by toggling `show`.
 */
export function Transition(props: TransitionProps): ZenElement {
  const duration = props.duration ?? 220;
  const enterPreset = props.enter ?? props.preset ?? "fade";
  const leavePreset = props.leave ?? props.preset ?? "fade";

  // Track whether children are visible at all (unmount support after leave).
  const [mounted, setMounted] = useState(props.show);
  const target = props.show ? 1 : 0;
  const progress = useMotion(target, { duration, easing: props.easing }) as number;

  useEffect(() => {
    if (props.show) {
      if (!mounted) setMounted(true);
      return;
    }
    if (!props.unmount) return;
    const handle = setTimeout(() => setMounted(false), duration + 32);
    return () => clearTimeout(handle);
  }, [props.show, duration, props.unmount, mounted]);

  if (!mounted && !props.show) return h("box", { display: "none" } as BoxProps);

  const preset = props.show ? enterPreset : leavePreset;
  const styling = stylingFor(preset, progress);
  return h(
    "box",
    {
      direction: "column",
      padding: [styling.paddingTop, 0, 0, styling.paddingLeft] as [number, number, number, number],
      style: styling.style,
      accessibilityLabel: props.accessibilityLabel,
      accessibilityDescription: props.accessibilityDescription,
    } as BoxProps,
    props.children,
  );
}

interface PresetStyling {
  style: StyleLike;
  paddingTop: number;
  paddingLeft: number;
}

function stylingFor(preset: TransitionPreset, progress: number): PresetStyling {
  // Clamp + invert for clarity.
  const t = Math.min(1, Math.max(0, progress));
  const base: PresetStyling = { style: {} as StyleLike, paddingTop: 0, paddingLeft: 0 };
  switch (preset) {
    case "fade":
      return { ...base, style: t < 0.5 ? ({ dim: true } as StyleLike) : ({} as StyleLike) };
    case "slide-up":
      return { ...base, paddingTop: Math.round((1 - t) * 2) };
    case "slide-down":
      return { ...base, paddingTop: Math.round(t * 2) };
    case "slide-left":
      return { ...base, paddingLeft: Math.round((1 - t) * 4) };
    case "slide-right":
      return { ...base, paddingLeft: Math.round(t * 4) };
    case "expand":
      return {
        style: t < 0.5 ? ({ dim: true } as StyleLike) : ({} as StyleLike),
        paddingTop: Math.round((1 - t) * 1),
        paddingLeft: Math.round((1 - t) * 2),
      };
    case "bounce":
      return {
        style: t < 0.4 ? ({ bold: true, dim: true } as StyleLike) : ({} as StyleLike),
        paddingTop: t < 0.4 ? 1 : 0,
        paddingLeft: 0,
      };
    default:
      return base;
  }
}

// -- <Stream> ----------------------------------------------------------------
export interface StreamProps<T> extends AccessibilityProps {
  /** Async iterable producing one chunk at a time. */
  source: AsyncIterable<T> | (() => AsyncIterable<T>);
  /** Render a single chunk. */
  render: (item: T, index: number) => ZenElement | string;
  /** Maximum buffered items before dropping head entries. Defaults to 200. */
  bufferLimit?: number;
  /** Tail mode keeps the latest items in view. Defaults to true. */
  tail?: boolean;
  /** Visible row count. Defaults to 12. */
  height?: number;
  width?: number;
  /** Pause iteration without losing buffered entries. */
  paused?: boolean;
  style?: StyleLike;
}

/**
 * Render an async iterable progressively. The Stream owns its own buffer
 * and unsubscribes from the iterator on unmount, so callers can safely
 * pass long-lived sources (logs, websockets, model outputs).
 */
export function Stream<T>(props: StreamProps<T>): ZenElement {
  const theme = useTheme();
  const [items, setItems] = useState<T[]>([]);
  const limit = props.bufferLimit ?? 200;
  const height = props.height ?? 12;
  const tail = props.tail !== false;

  useEffect(() => {
    if (props.paused) return;
    let cancelled = false;
    const iterable = typeof props.source === "function" ? props.source() : props.source;
    const iterator = iterable[Symbol.asyncIterator]();

    async function pump(): Promise<void> {
      while (!cancelled) {
        try {
          const result = await iterator.next();
          if (cancelled) return;
          if (result.done) return;
          setItems((prev) => {
            const next = [...prev, result.value as T];
            return next.length > limit ? next.slice(-limit) : next;
          });
        } catch (err) {
           
          console.error("graceglyph Stream: iterator error:", err);
          return;
        }
      }
    }

    void pump();
    return () => {
      cancelled = true;
      try {
        void iterator.return?.();
      } catch {
        // best-effort
      }
    };
  }, [props.source, props.paused, limit]);

  const start = tail ? Math.max(0, items.length - height) : 0;
  const visible = items.slice(start, start + height);

  const rendered = visible.map((item, offset) => {
    const node = props.render(item, start + offset);
    return h(
      "box",
      { key: start + offset, height: 1 } as BoxProps & { key: number },
      typeof node === "string" ? h("text", {} as TextProps, node) : node,
    );
  });

  // Pad with blanks so the viewport doesn't reflow when the buffer is short.
  while (rendered.length < height) {
    rendered.push(
      h(
        "box",
        { key: `pad-${rendered.length}`, height: 1 } as BoxProps & { key: string },
        h("text", { style: theme.log.base } as TextProps, ""),
      ),
    );
  }

  return h(
    "box",
    {
      direction: "column",
      width: props.width,
      height,
      style: mergeBoxStyle(theme.log.base, props.style),
      accessibilityLabel: props.accessibilityLabel ?? "stream",
      accessibilityDescription: props.accessibilityDescription,
    } as BoxProps,
    rendered,
  );
}
