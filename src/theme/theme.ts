import { ansi, DefaultColor, type Style } from "../render/style.js";
import { parseColor, type ColorInput } from "../render/color.js";

export type BorderPreset = "square" | "round" | "double" | "thick" | "dashed" | "ascii" | "none";

export interface ThemeTokens {
  color: Record<string, ColorInput>;
  space: Record<string, number>;
  radius: Record<string, BorderPreset>;
  font: Record<string, Partial<Pick<Style, "bold" | "dim" | "italic" | "underline" | "inverse">>>;
  motion: Record<string, number>;
  breakpoints: Record<string, number>;
}

export interface Theme {
  name: string;
  tokens: ThemeTokens;
  base: Style;
  window: { frame: Style; title: Style; body: Style };
  button: {
    normal: Style;
    focused: Style;
    hovered: Style;
    active: Style;
    disabled: Style;
    loading: Style;
    error: Style;
  };
  input: {
    normal: Style;
    focused: Style;
    hovered: Style;
    disabled: Style;
    loading: Style;
    error: Style;
    placeholder: Style;
  };
  list: {
    normal: Style;
    selected: Style;
    hovered: Style;
    active: Style;
    disabled: Style;
  };
  link: { normal: Style; focused: Style; visited: Style };
  statusBar: Style;
  checkbox: {
    normal: Style;
    focused: Style;
    checked: Style;
    checkedFocused: Style;
    disabled: Style;
  };
  switch: {
    track: Style;
    trackOn: Style;
    thumb: Style;
    thumbOn: Style;
    focused: Style;
    disabled: Style;
  };
  progress: {
    track: Style;
    fill: Style;
    indeterminate: Style;
    label: Style;
  };
  spinner: Style;
  sparkline: Style;
  badge: {
    neutral: Style;
    info: Style;
    success: Style;
    warning: Style;
    danger: Style;
  };
  tag: {
    normal: Style;
    focused: Style;
    removable: Style;
  };
  divider: Style;
  kbd: Style;
  table: { header: Style; row: Style; rowSelected: Style; rowAlt: Style };
  tree: { guide: Style; node: Style };
  accordion: { header: Style; headerOpen: Style };
  stepper: { pending: Style; active: Style; complete: Style; connector: Style };
  pagination: { normal: Style; active: Style; disabled: Style };
  tooltip: Style;
  code: {
    base: Style;
    keyword: Style;
    string: Style;
    number: Style;
    comment: Style;
    punctuation: Style;
    boolean: Style;
    null: Style;
    function: Style;
  };
  diff: {
    base: Style;
    add: Style;
    remove: Style;
    hunk: Style;
    meta: Style;
    context: Style;
  };
  log: {
    base: Style;
    debug: Style;
    info: Style;
    warn: Style;
    error: Style;
    timestamp: Style;
    paused: Style;
  };
  avatar: { base: Style; accent: Style };
  card: { base: Style; header: Style };
  chart: {
    axis: Style;
    grid: Style;
    series: Style;
    seriesAlt: Style;
    pointer: Style;
    label: Style;
  };
  notification: {
    info: Style;
    success: Style;
    warning: Style;
    danger: Style;
  };
  formField: { label: Style; description: Style; error: Style };
}

interface SemanticPalette {
  foreground: string;
  background: string;
  surface: string;
  panel: string;
  border: string;
  muted: string;
  primary: string;
  primaryText: string;
  accent: string;
  success: string;
  warning: string;
  danger: string;
  link: string;
  visited: string;
  selection: string;
  disabled: string;
}

export const themeNames = [
  "light",
  "dark",
  "solarized-light",
  "solarized-dark",
  "tokyo-night",
  "nord",
  "dracula",
  "gruvbox",
  "tarnished",
] as const;

export type BuiltInThemeName = (typeof themeNames)[number];

const mk = (overrides: Partial<Style> = {}): Style => ({
  fg: DefaultColor,
  bg: DefaultColor,
  bold: false,
  dim: false,
  italic: false,
  underline: false,
  inverse: false,
  ...overrides,
});

function c(value: ColorInput) {
  return parseColor(value);
}

function baseTokens(colors: Record<string, ColorInput>): ThemeTokens {
  return {
    color: {
      ...colors,
      fg: colors.foreground,
      bg: colors.background,
      base: colors.background,
      text: colors.foreground,
      panelText: colors.foreground,
      focus: colors.primary,
      info: colors.accent,
    },
    space: {
      none: 0,
      px: 1,
      xs: 1,
      sm: 1,
      md: 2,
      lg: 3,
      xl: 4,
      "2xl": 6,
    },
    radius: {
      none: "none",
      sm: "square",
      md: "round",
      lg: "double",
      xl: "thick",
    },
    font: {
      normal: {},
      strong: { bold: true },
      subtle: { dim: true },
      emphasis: { italic: true },
      link: { underline: true },
      inverse: { inverse: true },
    },
    motion: {
      instant: 0,
      fast: 90,
      normal: 160,
      slow: 260,
    },
    breakpoints: {
      xs: 40,
      sm: 64,
      md: 80,
      lg: 100,
      xl: 132,
    },
  };
}

function defaultTokens(): ThemeTokens {
  return baseTokens({
    foreground: ansi(7),
    background: DefaultColor,
    surface: DefaultColor,
    panel: DefaultColor,
    border: ansi(7),
    muted: ansi(8),
    primary: ansi(4),
    primaryText: ansi(15),
    accent: ansi(6),
    success: ansi(2),
    warning: ansi(3),
    danger: ansi(1),
    link: ansi(4),
    visited: ansi(5),
    selection: ansi(4),
    disabled: ansi(8),
  });
}

export function defaultTheme(): Theme {
  return {
    name: "default",
    tokens: defaultTokens(),
    base: mk(),
    window: {
      frame: mk({ fg: ansi(7) }),
      title: mk({ bold: true }),
      body: mk(),
    },
    button: {
      normal: mk({ fg: ansi(0), bg: ansi(7) }),
      focused: mk({ fg: ansi(15), bg: ansi(4), bold: true }),
      hovered: mk({ fg: ansi(0), bg: ansi(6), bold: true }),
      active: mk({ fg: ansi(15), bg: ansi(2), bold: true }),
      disabled: mk({ fg: ansi(8), bg: ansi(7), dim: true }),
      loading: mk({ fg: ansi(0), bg: ansi(3), bold: true }),
      error: mk({ fg: ansi(15), bg: ansi(1), bold: true }),
    },
    input: {
      normal: mk({ bg: ansi(8) }),
      focused: mk({ bg: ansi(4), fg: ansi(15) }),
      hovered: mk({ bg: ansi(6), fg: ansi(0) }),
      disabled: mk({ bg: ansi(8), fg: ansi(7), dim: true }),
      loading: mk({ bg: ansi(3), fg: ansi(0) }),
      error: mk({ bg: ansi(1), fg: ansi(15) }),
      placeholder: mk({ dim: true }),
    },
    list: {
      normal: mk(),
      selected: mk({ inverse: true }),
      hovered: mk({ underline: true }),
      active: mk({ fg: ansi(15), bg: ansi(4), bold: true }),
      disabled: mk({ dim: true }),
    },
    link: {
      normal: mk({ fg: ansi(4), underline: true }),
      focused: mk({ fg: ansi(12), underline: true, bold: true }),
      visited: mk({ fg: ansi(5), underline: true }),
    },
    statusBar: mk({ fg: ansi(0), bg: ansi(7) }),
    checkbox: {
      normal: mk(),
      focused: mk({ fg: ansi(4), bold: true }),
      checked: mk({ fg: ansi(2), bold: true }),
      checkedFocused: mk({ fg: ansi(15), bg: ansi(2), bold: true }),
      disabled: mk({ dim: true }),
    },
    switch: {
      track: mk({ fg: ansi(8) }),
      trackOn: mk({ fg: ansi(2) }),
      thumb: mk({ fg: ansi(7) }),
      thumbOn: mk({ fg: ansi(15), bold: true }),
      focused: mk({ fg: ansi(4), bold: true }),
      disabled: mk({ dim: true }),
    },
    progress: {
      track: mk({ fg: ansi(8) }),
      fill: mk({ fg: ansi(2) }),
      indeterminate: mk({ fg: ansi(4) }),
      label: mk({ dim: true }),
    },
    spinner: mk({ fg: ansi(4), bold: true }),
    sparkline: mk({ fg: ansi(4) }),
    badge: {
      neutral: mk({ fg: ansi(0), bg: ansi(7), bold: true }),
      info: mk({ fg: ansi(15), bg: ansi(4), bold: true }),
      success: mk({ fg: ansi(15), bg: ansi(2), bold: true }),
      warning: mk({ fg: ansi(0), bg: ansi(3), bold: true }),
      danger: mk({ fg: ansi(15), bg: ansi(1), bold: true }),
    },
    tag: {
      normal: mk({ fg: ansi(0), bg: ansi(7) }),
      focused: mk({ fg: ansi(15), bg: ansi(4), bold: true }),
      removable: mk({ fg: ansi(1), bold: true }),
    },
    divider: mk({ fg: ansi(8) }),
    kbd: mk({ fg: ansi(0), bg: ansi(7), bold: true }),
    table: {
      header: mk({ fg: ansi(15), bg: ansi(8), bold: true }),
      row: mk(),
      rowSelected: mk({ inverse: true }),
      rowAlt: mk({ dim: true }),
    },
    tree: {
      guide: mk({ fg: ansi(8) }),
      node: mk(),
    },
    accordion: {
      header: mk({ fg: ansi(7), bold: true }),
      headerOpen: mk({ fg: ansi(15), bg: ansi(4), bold: true }),
    },
    stepper: {
      pending: mk({ fg: ansi(8) }),
      active: mk({ fg: ansi(15), bg: ansi(4), bold: true }),
      complete: mk({ fg: ansi(2), bold: true }),
      connector: mk({ fg: ansi(8) }),
    },
    pagination: {
      normal: mk({ fg: ansi(7) }),
      active: mk({ fg: ansi(15), bg: ansi(4), bold: true }),
      disabled: mk({ fg: ansi(8), dim: true }),
    },
    tooltip: mk({ fg: ansi(0), bg: ansi(11) }),
    code: {
      base: mk(),
      keyword: mk({ fg: ansi(5), bold: true }),
      string: mk({ fg: ansi(2) }),
      number: mk({ fg: ansi(3) }),
      comment: mk({ fg: ansi(8), italic: true }),
      punctuation: mk({ fg: ansi(7) }),
      boolean: mk({ fg: ansi(3), bold: true }),
      null: mk({ fg: ansi(8) }),
      function: mk({ fg: ansi(4), bold: true }),
    },
    diff: {
      base: mk(),
      add: mk({ fg: ansi(2) }),
      remove: mk({ fg: ansi(1) }),
      hunk: mk({ fg: ansi(6) }),
      meta: mk({ fg: ansi(8), bold: true }),
      context: mk({ dim: true }),
    },
    log: {
      base: mk(),
      debug: mk({ fg: ansi(8) }),
      info: mk({ fg: ansi(6) }),
      warn: mk({ fg: ansi(3), bold: true }),
      error: mk({ fg: ansi(1), bold: true }),
      timestamp: mk({ fg: ansi(8) }),
      paused: mk({ fg: ansi(3), bold: true }),
    },
    avatar: {
      base: mk({ fg: ansi(15), bg: ansi(4), bold: true }),
      accent: mk({ fg: ansi(0), bg: ansi(6), bold: true }),
    },
    card: {
      base: mk(),
      header: mk({ bold: true }),
    },
    chart: {
      axis: mk({ fg: ansi(8) }),
      grid: mk({ fg: ansi(8), dim: true }),
      series: mk({ fg: ansi(4) }),
      seriesAlt: mk({ fg: ansi(5) }),
      pointer: mk({ fg: ansi(3), bold: true }),
      label: mk({ dim: true }),
    },
    notification: {
      info: mk({ fg: ansi(15), bg: ansi(4), bold: true }),
      success: mk({ fg: ansi(15), bg: ansi(2), bold: true }),
      warning: mk({ fg: ansi(0), bg: ansi(3), bold: true }),
      danger: mk({ fg: ansi(15), bg: ansi(1), bold: true }),
    },
    formField: {
      label: mk({ bold: true }),
      description: mk({ dim: true }),
      error: mk({ fg: ansi(1), bold: true }),
    },
  };
}

function makeSemanticTheme(name: BuiltInThemeName, palette: SemanticPalette): Theme {
  const tokens = baseTokens({ ...palette });
  return {
    name,
    tokens,
    base: mk({ fg: c(palette.foreground), bg: c(palette.background) }),
    window: {
      frame: mk({ fg: c(palette.border), bg: c(palette.background) }),
      title: mk({ fg: c(palette.primary), bg: c(palette.background), bold: true }),
      body: mk({ fg: c(palette.foreground), bg: c(palette.background) }),
    },
    button: {
      normal: mk({ fg: c(palette.primaryText), bg: c(palette.primary), bold: true }),
      focused: mk({ fg: c(palette.primaryText), bg: c(palette.accent), bold: true }),
      hovered: mk({ fg: c(palette.primaryText), bg: c(palette.accent), bold: true }),
      active: mk({ fg: c(palette.primaryText), bg: c(palette.success), bold: true }),
      disabled: mk({ fg: c(palette.disabled), bg: c(palette.panel), dim: true }),
      loading: mk({ fg: c(palette.primaryText), bg: c(palette.warning), bold: true }),
      error: mk({ fg: c(palette.primaryText), bg: c(palette.danger), bold: true }),
    },
    input: {
      normal: mk({ fg: c(palette.foreground), bg: c(palette.surface) }),
      focused: mk({ fg: c(palette.foreground), bg: c(palette.selection) }),
      hovered: mk({ fg: c(palette.foreground), bg: c(palette.panel) }),
      disabled: mk({ fg: c(palette.disabled), bg: c(palette.panel), dim: true }),
      loading: mk({ fg: c(palette.foreground), bg: c(palette.panel) }),
      error: mk({ fg: c(palette.primaryText), bg: c(palette.danger) }),
      placeholder: mk({ fg: c(palette.muted), dim: true }),
    },
    list: {
      normal: mk({ fg: c(palette.foreground), bg: c(palette.background) }),
      selected: mk({ fg: c(palette.primaryText), bg: c(palette.primary), bold: true }),
      hovered: mk({ fg: c(palette.foreground), bg: c(palette.panel), underline: true }),
      active: mk({ fg: c(palette.primaryText), bg: c(palette.accent), bold: true }),
      disabled: mk({ fg: c(palette.disabled), bg: c(palette.background), dim: true }),
    },
    link: {
      normal: mk({ fg: c(palette.link), underline: true }),
      focused: mk({ fg: c(palette.accent), underline: true, bold: true }),
      visited: mk({ fg: c(palette.visited), underline: true }),
    },
    statusBar: mk({ fg: c(palette.primaryText), bg: c(palette.primary) }),
    checkbox: {
      normal: mk({ fg: c(palette.foreground), bg: c(palette.background) }),
      focused: mk({ fg: c(palette.primary), bg: c(palette.background), bold: true }),
      checked: mk({ fg: c(palette.success), bg: c(palette.background), bold: true }),
      checkedFocused: mk({ fg: c(palette.primaryText), bg: c(palette.success), bold: true }),
      disabled: mk({ fg: c(palette.disabled), bg: c(palette.background), dim: true }),
    },
    switch: {
      track: mk({ fg: c(palette.muted), bg: c(palette.panel) }),
      trackOn: mk({ fg: c(palette.success), bg: c(palette.panel) }),
      thumb: mk({ fg: c(palette.foreground), bg: c(palette.panel) }),
      thumbOn: mk({ fg: c(palette.primaryText), bg: c(palette.success), bold: true }),
      focused: mk({ fg: c(palette.primary), bg: c(palette.background), bold: true }),
      disabled: mk({ fg: c(palette.disabled), bg: c(palette.panel), dim: true }),
    },
    progress: {
      track: mk({ fg: c(palette.muted), bg: c(palette.panel) }),
      fill: mk({ fg: c(palette.success), bg: c(palette.panel) }),
      indeterminate: mk({ fg: c(palette.primary), bg: c(palette.panel) }),
      label: mk({ fg: c(palette.muted), bg: c(palette.background), dim: true }),
    },
    spinner: mk({ fg: c(palette.primary), bg: c(palette.background), bold: true }),
    sparkline: mk({ fg: c(palette.primary), bg: c(palette.background) }),
    badge: {
      neutral: mk({ fg: c(palette.primaryText), bg: c(palette.muted), bold: true }),
      info: mk({ fg: c(palette.primaryText), bg: c(palette.primary), bold: true }),
      success: mk({ fg: c(palette.primaryText), bg: c(palette.success), bold: true }),
      warning: mk({ fg: c(palette.primaryText), bg: c(palette.warning), bold: true }),
      danger: mk({ fg: c(palette.primaryText), bg: c(palette.danger), bold: true }),
    },
    tag: {
      normal: mk({ fg: c(palette.foreground), bg: c(palette.panel) }),
      focused: mk({ fg: c(palette.primaryText), bg: c(palette.primary), bold: true }),
      removable: mk({ fg: c(palette.danger), bg: c(palette.panel), bold: true }),
    },
    divider: mk({ fg: c(palette.border), bg: c(palette.background) }),
    kbd: mk({ fg: c(palette.foreground), bg: c(palette.panel), bold: true }),
    table: {
      header: mk({ fg: c(palette.primaryText), bg: c(palette.panel), bold: true }),
      row: mk({ fg: c(palette.foreground), bg: c(palette.background) }),
      rowSelected: mk({ fg: c(palette.primaryText), bg: c(palette.primary), bold: true }),
      rowAlt: mk({ fg: c(palette.foreground), bg: c(palette.surface) }),
    },
    tree: {
      guide: mk({ fg: c(palette.border), bg: c(palette.background) }),
      node: mk({ fg: c(palette.foreground), bg: c(palette.background) }),
    },
    accordion: {
      header: mk({ fg: c(palette.foreground), bg: c(palette.panel), bold: true }),
      headerOpen: mk({ fg: c(palette.primaryText), bg: c(palette.primary), bold: true }),
    },
    stepper: {
      pending: mk({ fg: c(palette.muted), bg: c(palette.background) }),
      active: mk({ fg: c(palette.primaryText), bg: c(palette.primary), bold: true }),
      complete: mk({ fg: c(palette.success), bg: c(palette.background), bold: true }),
      connector: mk({ fg: c(palette.border), bg: c(palette.background) }),
    },
    pagination: {
      normal: mk({ fg: c(palette.foreground), bg: c(palette.background) }),
      active: mk({ fg: c(palette.primaryText), bg: c(palette.primary), bold: true }),
      disabled: mk({ fg: c(palette.disabled), bg: c(palette.background), dim: true }),
    },
    tooltip: mk({ fg: c(palette.primaryText), bg: c(palette.warning) }),
    code: {
      base: mk({ fg: c(palette.foreground), bg: c(palette.surface) }),
      keyword: mk({ fg: c(palette.accent), bg: c(palette.surface), bold: true }),
      string: mk({ fg: c(palette.success), bg: c(palette.surface) }),
      number: mk({ fg: c(palette.warning), bg: c(palette.surface) }),
      comment: mk({ fg: c(palette.muted), bg: c(palette.surface), italic: true }),
      punctuation: mk({ fg: c(palette.muted), bg: c(palette.surface) }),
      boolean: mk({ fg: c(palette.warning), bg: c(palette.surface), bold: true }),
      null: mk({ fg: c(palette.muted), bg: c(palette.surface) }),
      function: mk({ fg: c(palette.primary), bg: c(palette.surface), bold: true }),
    },
    diff: {
      base: mk({ fg: c(palette.foreground), bg: c(palette.background) }),
      add: mk({ fg: c(palette.success), bg: c(palette.background) }),
      remove: mk({ fg: c(palette.danger), bg: c(palette.background) }),
      hunk: mk({ fg: c(palette.accent), bg: c(palette.background), bold: true }),
      meta: mk({ fg: c(palette.muted), bg: c(palette.background), bold: true }),
      context: mk({ fg: c(palette.muted), bg: c(palette.background) }),
    },
    log: {
      base: mk({ fg: c(palette.foreground), bg: c(palette.background) }),
      debug: mk({ fg: c(palette.muted), bg: c(palette.background) }),
      info: mk({ fg: c(palette.accent), bg: c(palette.background) }),
      warn: mk({ fg: c(palette.warning), bg: c(palette.background), bold: true }),
      error: mk({ fg: c(palette.danger), bg: c(palette.background), bold: true }),
      timestamp: mk({ fg: c(palette.muted), bg: c(palette.background) }),
      paused: mk({ fg: c(palette.warning), bg: c(palette.background), bold: true }),
    },
    avatar: {
      base: mk({ fg: c(palette.primaryText), bg: c(palette.primary), bold: true }),
      accent: mk({ fg: c(palette.primaryText), bg: c(palette.accent), bold: true }),
    },
    card: {
      base: mk({ fg: c(palette.foreground), bg: c(palette.surface) }),
      header: mk({ fg: c(palette.primary), bg: c(palette.surface), bold: true }),
    },
    chart: {
      axis: mk({ fg: c(palette.border), bg: c(palette.background) }),
      grid: mk({ fg: c(palette.border), bg: c(palette.background), dim: true }),
      series: mk({ fg: c(palette.primary), bg: c(palette.background) }),
      seriesAlt: mk({ fg: c(palette.accent), bg: c(palette.background) }),
      pointer: mk({ fg: c(palette.warning), bg: c(palette.background), bold: true }),
      label: mk({ fg: c(palette.muted), bg: c(palette.background), dim: true }),
    },
    notification: {
      info: mk({ fg: c(palette.primaryText), bg: c(palette.primary), bold: true }),
      success: mk({ fg: c(palette.primaryText), bg: c(palette.success), bold: true }),
      warning: mk({ fg: c(palette.primaryText), bg: c(palette.warning), bold: true }),
      danger: mk({ fg: c(palette.primaryText), bg: c(palette.danger), bold: true }),
    },
    formField: {
      label: mk({ fg: c(palette.foreground), bg: c(palette.background), bold: true }),
      description: mk({ fg: c(palette.muted), bg: c(palette.background), dim: true }),
      error: mk({ fg: c(palette.danger), bg: c(palette.background), bold: true }),
    },
  };
}

const PALETTES: Record<BuiltInThemeName, SemanticPalette> = {
  light: {
    foreground: "#111827",
    background: "#f8fafc",
    surface: "#ffffff",
    panel: "#e2e8f0",
    border: "#94a3b8",
    muted: "#64748b",
    primary: "#2563eb",
    primaryText: "#ffffff",
    accent: "#0891b2",
    success: "#059669",
    warning: "#d97706",
    danger: "#dc2626",
    link: "#2563eb",
    visited: "#7c3aed",
    selection: "#dbeafe",
    disabled: "#94a3b8",
  },
  dark: {
    foreground: "#e5e7eb",
    background: "#111827",
    surface: "#1f2937",
    panel: "#374151",
    border: "#6b7280",
    muted: "#9ca3af",
    primary: "#60a5fa",
    primaryText: "#0f172a",
    accent: "#22d3ee",
    success: "#34d399",
    warning: "#f59e0b",
    danger: "#f87171",
    link: "#93c5fd",
    visited: "#c084fc",
    selection: "#1e3a8a",
    disabled: "#6b7280",
  },
  "solarized-light": {
    foreground: "#586e75",
    background: "#fdf6e3",
    surface: "#eee8d5",
    panel: "#eee8d5",
    border: "#93a1a1",
    muted: "#839496",
    primary: "#268bd2",
    primaryText: "#fdf6e3",
    accent: "#2aa198",
    success: "#859900",
    warning: "#b58900",
    danger: "#dc322f",
    link: "#268bd2",
    visited: "#6c71c4",
    selection: "#d7d1bd",
    disabled: "#93a1a1",
  },
  "solarized-dark": {
    foreground: "#839496",
    background: "#002b36",
    surface: "#073642",
    panel: "#073642",
    border: "#586e75",
    muted: "#657b83",
    primary: "#268bd2",
    primaryText: "#fdf6e3",
    accent: "#2aa198",
    success: "#859900",
    warning: "#b58900",
    danger: "#dc322f",
    link: "#268bd2",
    visited: "#6c71c4",
    selection: "#12404a",
    disabled: "#586e75",
  },
  "tokyo-night": {
    foreground: "#c0caf5",
    background: "#1a1b26",
    surface: "#24283b",
    panel: "#292e42",
    border: "#565f89",
    muted: "#9aa5ce",
    primary: "#7aa2f7",
    primaryText: "#10131f",
    accent: "#bb9af7",
    success: "#9ece6a",
    warning: "#e0af68",
    danger: "#f7768e",
    link: "#7dcfff",
    visited: "#bb9af7",
    selection: "#33467c",
    disabled: "#565f89",
  },
  nord: {
    foreground: "#d8dee9",
    background: "#2e3440",
    surface: "#3b4252",
    panel: "#434c5e",
    border: "#4c566a",
    muted: "#a3be8c",
    primary: "#88c0d0",
    primaryText: "#2e3440",
    accent: "#81a1c1",
    success: "#a3be8c",
    warning: "#ebcb8b",
    danger: "#bf616a",
    link: "#8fbcbb",
    visited: "#b48ead",
    selection: "#4c566a",
    disabled: "#6b7280",
  },
  dracula: {
    foreground: "#f8f8f2",
    background: "#282a36",
    surface: "#343746",
    panel: "#44475a",
    border: "#6272a4",
    muted: "#bfbfb8",
    primary: "#bd93f9",
    primaryText: "#282a36",
    accent: "#8be9fd",
    success: "#50fa7b",
    warning: "#f1fa8c",
    danger: "#ff5555",
    link: "#8be9fd",
    visited: "#ff79c6",
    selection: "#44475a",
    disabled: "#6272a4",
  },
  gruvbox: {
    foreground: "#ebdbb2",
    background: "#282828",
    surface: "#3c3836",
    panel: "#504945",
    border: "#7c6f64",
    muted: "#a89984",
    primary: "#83a598",
    primaryText: "#282828",
    accent: "#d3869b",
    success: "#b8bb26",
    warning: "#fabd2f",
    danger: "#fb4934",
    link: "#83a598",
    visited: "#d3869b",
    selection: "#665c54",
    disabled: "#7c6f64",
  },
  // High-contrast amber-on-black palette designed for splash screens and
  // ASCII-art canvases. Inspired by the "tarnished gold" feel — most ANSI
  // terminals render this faithfully even on 256-color or 16-color modes.
  tarnished: {
    foreground: "#d4a256",
    background: "#0a0805",
    surface: "#120e08",
    panel: "#1a140a",
    border: "#a87d3d",
    muted: "#7a5a2c",
    primary: "#f5c46a",
    primaryText: "#0a0805",
    accent: "#e8b85c",
    success: "#c9a14a",
    warning: "#f0c870",
    danger: "#c0413a",
    link: "#f5c46a",
    visited: "#a87d3d",
    selection: "#3d2f1a",
    disabled: "#5a4324",
  },
};

export const builtInThemes: Readonly<Record<BuiltInThemeName, Theme>> = Object.freeze(
  Object.fromEntries(
    themeNames.map((name) => [name, makeSemanticTheme(name, PALETTES[name])]),
  ) as Record<BuiltInThemeName, Theme>,
);

export function getTheme(name: BuiltInThemeName): Theme {
  return makeSemanticTheme(name, PALETTES[name]);
}

export function darkTheme(): Theme {
  return getTheme("dark");
}
