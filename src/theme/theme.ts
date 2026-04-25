import { ansi, DefaultColor, Style } from "../render/style.js";

export interface Theme {
  name: string;
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
}

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

export function defaultTheme(): Theme {
  return {
    name: "default",
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
  };
}

export function darkTheme(): Theme {
  const base = defaultTheme();
  return {
    ...base,
    name: "dark",
    base: mk({ fg: ansi(15), bg: ansi(0) }),
    window: {
      frame: mk({ fg: ansi(8) }),
      title: mk({ fg: ansi(15), bold: true }),
      body: mk({ fg: ansi(15) }),
    },
  };
}
