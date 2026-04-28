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

function mergeBoxStyle(base: StyleLike, override?: StyleLike): StyleLike {
  return override ? styleRule.merge(base, override) : base;
}

// -- shared scale helpers ----------------------------------------------------

export interface AxisDomain {
  min: number;
  max: number;
}

export function autoDomain(values: readonly number[], pad = 0): AxisDomain {
  if (values.length === 0) return { min: 0, max: 1 };
  let min = values[0]!;
  let max = values[0]!;
  for (const v of values) {
    if (v < min) min = v;
    if (v > max) max = v;
  }
  if (min === max) {
    const epsilon = Math.abs(min) > 0 ? Math.abs(min) * 0.1 : 1;
    return { min: min - epsilon, max: max + epsilon };
  }
  const span = max - min;
  return { min: min - span * pad, max: max + span * pad };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

// -- <LineChart> -------------------------------------------------------------
export interface LineSeries {
  id: string;
  values: readonly number[];
  /** Override the series stroke. Falls back to chart palette. */
  style?: StyleLike;
}

export interface LineChartProps extends AccessibilityProps {
  series: readonly LineSeries[];
  width?: number;
  height?: number;
  /** Force a domain. When omitted, derived from `series` values. */
  domain?: AxisDomain;
  /** Show numeric Y axis labels at the left. */
  showAxis?: boolean;
  showGrid?: boolean;
  /** Optional X-axis labels — drawn under the chart, evenly distributed. */
  xLabels?: readonly string[];
  style?: StyleLike;
}

const LINE_GLYPHS = ["▁", "▂", "▃", "▄", "▅", "▆", "▇", "█"] as const;

export function LineChart(props: LineChartProps): ZenElement {
  const theme = useTheme();
  const width = Math.max(4, props.width ?? 32);
  const height = Math.max(2, props.height ?? 6);
  const allValues: number[] = [];
  for (const s of props.series) for (const v of s.values) allValues.push(v);
  const domain = props.domain ?? autoDomain(allValues);
  const span = Math.max(1e-9, domain.max - domain.min);

  const showAxis = props.showAxis !== false;
  const labelWidth = showAxis ? Math.max(4, String(Math.round(domain.max)).length + 1) : 0;
  const plotWidth = Math.max(2, width - labelWidth);

  // Build a (height x plotWidth) glyph buffer per series, then composite.
  const buffer: string[][] = Array.from({ length: height }, () =>
    Array.from({ length: plotWidth }, () => " "),
  );
  const styleBuffer: (StyleLike | undefined)[][] = Array.from({ length: height }, () =>
    Array.from({ length: plotWidth }, () => undefined),
  );

  props.series.forEach((s, seriesIndex) => {
    if (s.values.length === 0) return;
    const samples = sample(s.values, plotWidth);
    const seriesStyle =
      s.style ?? (seriesIndex % 2 === 0 ? theme.chart.series : theme.chart.seriesAlt);
    for (let x = 0; x < plotWidth; x++) {
      const value = samples[x]!;
      const norm = clamp((value - domain.min) / span, 0, 1);
      // Map to a fractional row; lower y = higher value.
      const filled = norm * (height * LINE_GLYPHS.length);
      const yTop = Math.max(0, height - 1 - Math.floor(filled / LINE_GLYPHS.length));
      const partial = Math.floor(filled % LINE_GLYPHS.length);
      // Fill below.
      for (let y = height - 1; y > yTop; y--) {
        buffer[y]![x] = LINE_GLYPHS[LINE_GLYPHS.length - 1]!;
        styleBuffer[y]![x] = seriesStyle;
      }
      if (yTop >= 0 && yTop < height) {
        const glyph = LINE_GLYPHS[Math.max(0, partial - 1)] ?? LINE_GLYPHS[0]!;
        buffer[yTop]![x] = glyph;
        styleBuffer[yTop]![x] = seriesStyle;
      }
    }
  });

  const rows: ZenElement[] = [];
  for (let y = 0; y < height; y++) {
    const segments: ZenElement[] = [];
    if (showAxis) {
      const value = domain.max - (y / Math.max(1, height - 1)) * span;
      const label = formatAxisLabel(value).padStart(labelWidth - 1, " ");
      segments.push(h("text", { style: theme.chart.label } as TextProps, `${label} `));
    }
    // Group adjacent cells with the same style for fewer text nodes.
    let runStyle: StyleLike | undefined = undefined;
    let runText = "";
    const flush = () => {
      if (runText.length === 0) return;
      segments.push(
        h("text", { style: runStyle ?? theme.chart.series, wrap: "clip" } as TextProps, runText),
      );
      runText = "";
    };
    for (let x = 0; x < plotWidth; x++) {
      const cellStyle = styleBuffer[y]![x];
      if (cellStyle !== runStyle) {
        flush();
        runStyle = cellStyle;
      }
      runText += buffer[y]![x]!;
    }
    flush();
    rows.push(h("box", { key: y, direction: "row", height: 1 } as BoxProps, segments));
  }

  if (props.xLabels && props.xLabels.length > 0) {
    const labels = props.xLabels;
    const stride = Math.max(1, Math.floor(plotWidth / labels.length));
    let row = "";
    let nextLabelIndex = 0;
    for (let x = 0; x < plotWidth; x++) {
      if (
        nextLabelIndex < labels.length &&
        x === Math.min(plotWidth - 1, nextLabelIndex * stride)
      ) {
        const label = labels[nextLabelIndex] ?? "";
        row += label;
        x += Math.max(0, label.length - 1);
        nextLabelIndex++;
      } else {
        row += " ";
      }
    }
    rows.push(
      h("box", { direction: "row", height: 1 } as BoxProps, [
        showAxis ? h("text", {} as TextProps, " ".repeat(labelWidth)) : null,
        h("text", { wrap: "clip", style: theme.chart.label } as TextProps, row.slice(0, plotWidth)),
      ]),
    );
  }

  return h(
    "box",
    {
      direction: "column",
      width,
      height: rows.length,
      accessibilityLabel: props.accessibilityLabel ?? "line chart",
      accessibilityDescription: props.accessibilityDescription,
      style: mergeBoxStyle(theme.chart.axis, props.style),
    } as BoxProps,
    rows,
  );
}

function formatAxisLabel(value: number): string {
  if (Math.abs(value) >= 1000) return `${Math.round(value / 100) / 10}k`;
  if (Math.abs(value) < 0.01 && value !== 0) return value.toExponential(0);
  return value.toFixed(Math.abs(value) < 10 ? 1 : 0);
}

function sample(series: readonly number[], width: number): number[] {
  if (series.length === width) return [...series];
  const out: number[] = [];
  if (series.length < width) {
    for (let i = 0; i < width; i++) {
      const sourceIndex = Math.min(
        series.length - 1,
        Math.round((i * (series.length - 1)) / Math.max(1, width - 1)),
      );
      out.push(series[sourceIndex]!);
    }
    return out;
  }
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

// -- <BarChart> --------------------------------------------------------------
export interface BarDatum {
  label: string;
  value: number;
  /** Override the bar style. */
  style?: StyleLike;
}

export interface BarChartProps extends AccessibilityProps {
  data: readonly BarDatum[];
  /** Total chart width (label + bar). */
  width?: number;
  /** Force domain max. Defaults to max of `data`. */
  max?: number;
  /** Show numeric value next to each bar. */
  showValue?: boolean;
  /** Cell width reserved for labels. Defaults to max label length. */
  labelWidth?: number;
  style?: StyleLike;
  barStyle?: StyleLike;
}

export function BarChart(props: BarChartProps): ZenElement {
  const theme = useTheme();
  const labelWidth =
    props.labelWidth ?? props.data.reduce((m, d) => Math.max(m, d.label.length), 0);
  const max = props.max ?? Math.max(0, ...props.data.map((d) => d.value));
  const totalWidth = Math.max(20, props.width ?? 40);
  const valueLabelReserve = props.showValue !== false ? 6 : 0;
  const barWidth = Math.max(4, totalWidth - labelWidth - 2 - valueLabelReserve);

  const rows = props.data.map((d, index) => {
    const norm = max > 0 ? clamp(d.value / max, 0, 1) : 0;
    const filled = Math.round(norm * barWidth);
    const bar = "█".repeat(filled) + " ".repeat(Math.max(0, barWidth - filled));
    const valueText =
      props.showValue !== false ? ` ${formatAxisLabel(d.value).padStart(5, " ")}` : "";
    return h(
      "box",
      {
        key: `${d.label}-${index}`,
        direction: "row",
        height: 1,
      } as BoxProps,
      [
        h("text", { style: theme.chart.label } as TextProps, d.label.padEnd(labelWidth, " ")),
        h("text", {} as TextProps, "  "),
        h(
          "text",
          {
            wrap: "clip",
            style: mergeBoxStyle(theme.chart.series, d.style ?? props.barStyle),
          } as TextProps,
          bar,
        ),
        valueText.length > 0
          ? h("text", { style: theme.chart.label } as TextProps, valueText)
          : null,
      ],
    );
  });

  return h(
    "box",
    {
      direction: "column",
      width: totalWidth,
      accessibilityLabel: props.accessibilityLabel ?? "bar chart",
      accessibilityDescription: props.accessibilityDescription,
      style: mergeBoxStyle(theme.chart.axis, props.style),
    } as BoxProps,
    rows,
  );
}

// -- <Histogram> -------------------------------------------------------------
export interface HistogramProps extends AccessibilityProps {
  values: readonly number[];
  /** Number of bins. Defaults to ~ sqrt(values.length). */
  bins?: number;
  width?: number;
  /** Range. Defaults to autoDomain. */
  domain?: AxisDomain;
  showCounts?: boolean;
  style?: StyleLike;
  barStyle?: StyleLike;
}

export function Histogram(props: HistogramProps): ZenElement {
  const theme = useTheme();
  const bins = Math.max(1, props.bins ?? Math.max(4, Math.round(Math.sqrt(props.values.length))));
  const domain = props.domain ?? autoDomain(props.values);
  const span = Math.max(1e-9, domain.max - domain.min);
  const counts = new Array(bins).fill(0) as number[];
  for (const v of props.values) {
    const idx = Math.min(bins - 1, Math.max(0, Math.floor(((v - domain.min) / span) * bins)));
    counts[idx]! += 1;
  }
  const data: BarDatum[] = counts.map((c, i) => {
    const start = domain.min + (i / bins) * span;
    const end = domain.min + ((i + 1) / bins) * span;
    return { label: `${formatAxisLabel(start)}–${formatAxisLabel(end)}`, value: c };
  });
  return h(BarChart, {
    data,
    width: props.width,
    showValue: props.showCounts !== false,
    style: props.style,
    barStyle: mergeBoxStyle(theme.chart.seriesAlt, props.barStyle),
    accessibilityLabel: props.accessibilityLabel ?? "histogram",
    accessibilityDescription: props.accessibilityDescription,
  });
}

// -- <Gauge> -----------------------------------------------------------------
export interface GaugeProps extends AccessibilityProps {
  /** 0..1 fill ratio. Clamped. */
  value: number;
  /** Total cells across the gauge bar. Defaults to 18. */
  width?: number;
  /** Optional thresholds; pass [warn, danger] in 0..1 to color zones. */
  thresholds?: readonly [warn: number, danger: number];
  label?: string;
  showPercent?: boolean;
  style?: StyleLike;
}

export function Gauge(props: GaugeProps): ZenElement {
  const theme = useTheme();
  const width = Math.max(6, props.width ?? 18);
  const value = clamp(props.value, 0, 1);
  const filled = Math.round(value * width);
  const [warn = 0.7, danger = 0.9] = props.thresholds ?? [];
  const fillStyle =
    value >= danger
      ? theme.notification.danger
      : value >= warn
        ? theme.notification.warning
        : theme.chart.series;
  const bar = "█".repeat(filled) + "░".repeat(Math.max(0, width - filled));
  const suffix = props.showPercent ? ` ${Math.round(value * 100)}%` : "";
  const label = props.label ? `${props.label} ` : "";
  return h(
    "text",
    {
      style: mergeBoxStyle(fillStyle, props.style),
      accessibilityLabel: props.accessibilityLabel ?? props.label ?? "gauge",
      accessibilityDescription: props.accessibilityDescription,
    } as TextProps,
    `${label}[${bar}]${suffix}`,
  );
}

// -- <Heatmap> ---------------------------------------------------------------
export interface HeatmapProps extends AccessibilityProps {
  /** 2D row-major matrix of values. */
  rows: readonly (readonly number[])[];
  /** Force domain. Defaults to autoDomain over all cells. */
  domain?: AxisDomain;
  /** Width of each cell in characters. Defaults to 2. */
  cellWidth?: number;
  showAxis?: boolean;
  rowLabels?: readonly string[];
  colLabels?: readonly string[];
  style?: StyleLike;
}

const HEATMAP_GLYPHS = [" ", "░", "▒", "▓", "█"] as const;

export function Heatmap(props: HeatmapProps): ZenElement {
  const theme = useTheme();
  const cellWidth = Math.max(1, props.cellWidth ?? 2);
  const flat: number[] = [];
  for (const row of props.rows) for (const v of row) flat.push(v);
  const domain = props.domain ?? autoDomain(flat);
  const span = Math.max(1e-9, domain.max - domain.min);

  const labelWidth =
    props.showAxis !== false && props.rowLabels
      ? props.rowLabels.reduce((m, l) => Math.max(m, l.length), 0) + 1
      : 0;

  const rowNodes = props.rows.map((row, ri) => {
    const segments: ZenElement[] = [];
    if (labelWidth > 0) {
      segments.push(
        h(
          "text",
          { style: theme.chart.label } as TextProps,
          (props.rowLabels?.[ri] ?? "").padEnd(labelWidth, " "),
        ),
      );
    }
    for (const [ci, value] of row.entries()) {
      const norm = clamp((value - domain.min) / span, 0, 1);
      const glyph =
        HEATMAP_GLYPHS[
          Math.min(HEATMAP_GLYPHS.length - 1, Math.floor(norm * HEATMAP_GLYPHS.length))
        ]!;
      segments.push(
        h(
          "text",
          {
            key: `${ri}-${ci}`,
            style: norm > 0.5 ? theme.chart.series : theme.chart.seriesAlt,
          } as TextProps & { key: string },
          glyph.repeat(cellWidth),
        ),
      );
    }
    return h("box", { key: ri, direction: "row", height: 1 } as BoxProps, segments);
  });

  if (props.showAxis !== false && props.colLabels && props.colLabels.length > 0) {
    const segments: ZenElement[] = [];
    if (labelWidth > 0) segments.push(h("text", {} as TextProps, " ".repeat(labelWidth)));
    let row = "";
    for (const label of props.colLabels) row += label.slice(0, cellWidth).padEnd(cellWidth, " ");
    segments.push(h("text", { style: theme.chart.label, wrap: "clip" } as TextProps, row));
    rowNodes.unshift(h("box", { direction: "row", height: 1 } as BoxProps, segments));
  }

  return h(
    "box",
    {
      direction: "column",
      accessibilityLabel: props.accessibilityLabel ?? "heatmap",
      accessibilityDescription: props.accessibilityDescription,
      style: mergeBoxStyle(theme.chart.axis, props.style),
    } as BoxProps,
    rowNodes,
  );
}
