import { ansi, DefaultColor, Style } from "../render/style.js";

export interface Theme {
  name: string;
  base: Style;
  window: { frame: Style; title: Style; body: Style };
  button: { normal: Style; focused: Style; pressed: Style };
  input: { normal: Style; focused: Style; placeholder: Style };
  list: { normal: Style; selected: Style };
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
      pressed: mk({ fg: ansi(15), bg: ansi(2), bold: true }),
    },
    input: {
      normal: mk({ bg: ansi(8) }),
      focused: mk({ bg: ansi(4), fg: ansi(15) }),
      placeholder: mk({ dim: true }),
    },
    list: {
      normal: mk(),
      selected: mk({ inverse: true }),
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
