import test from "node:test";
import assert from "node:assert/strict";

import {
  Text,
  builtInThemes,
  css,
  getTheme,
  h,
  parseColor,
  renderTestApp,
  style,
  themeNames,
  useTheme,
} from "../src/index.js";
import type { ScreenBuffer } from "../src/render/buffer.js";

test("style builder resolves color and spacing tokens", () => {
  const theme = getTheme("tokyo-night");
  const rule = style()
    .fg("primary")
    .bg("surface")
    .padding("xs", "md")
    .border("round")
    .when("focused")
    .fg("accent")
    .bold()
    .done()
    .at(">=100")
    .padding("lg")
    .done();

  const base = rule.toProps(theme, { width: 80 });
  assert.deepEqual(base.style?.fg, parseColor("#7aa2f7"));
  assert.deepEqual(base.style?.bg, parseColor("#24283b"));
  assert.deepEqual(base.padding, [1, 2]);
  assert.equal(base.border, true);
  assert.equal(base.borderPreset, "round");

  const focusedWide = rule.toProps(theme, {
    width: 120,
    states: ["focused"],
  });
  assert.deepEqual(focusedWide.style?.fg, parseColor("#bb9af7"));
  assert.equal(focusedWide.style?.bold, true);
  assert.equal(focusedWide.padding, 3);
});

test("css tagged template parses terminal style declarations", () => {
  const theme = getTheme("nord");
  const rule = css`
    fg: primary;
    bg: panel;
    padding: xs md;
    border: double;
    bold: true;
  `;

  const props = rule.toProps(theme);
  assert.deepEqual(props.style?.fg, parseColor("#88c0d0"));
  assert.deepEqual(props.style?.bg, parseColor("#434c5e"));
  assert.deepEqual(props.padding, [1, 2]);
  assert.equal(props.border, true);
  assert.equal(props.borderPreset, "double");
  assert.equal(props.style?.bold, true);
});

test("style.merge uses last-write-wins semantics", () => {
  const theme = getTheme("dracula");
  const merged = style.merge(
    style().fg("primary").padding("sm"),
    style().fg("danger").bg("surface"),
  );

  const props = merged.toProps(theme);
  assert.deepEqual(props.style?.fg, parseColor("#ff5555"));
  assert.deepEqual(props.style?.bg, parseColor("#343746"));
  assert.equal(props.padding, 1);
});

test("built-in themes expose the roadmap theme set and token namespaces", () => {
  assert.deepEqual(Object.keys(builtInThemes).sort(), [...themeNames].sort());
  assert.equal(themeNames.length, 8);

  for (const name of themeNames) {
    const theme = getTheme(name);
    assert.equal(theme.name, name);
    assert.ok(theme.tokens.color.primary);
    assert.ok(theme.tokens.space.md! > 0);
    assert.equal(theme.tokens.radius.md, "round");
    assert.ok(theme.tokens.motion.normal! > 0);
  }
});

test("host nodes accept style rules directly", async () => {
  const theme = getTheme("tokyo-night");
  const app = renderTestApp(h(Text, { style: style().fg("primary").bg("surface") }, "x"), {
    width: 4,
    height: 2,
    runtime: { devtools: false, theme },
  });

  try {
    await app.settle();
    const front = (app.handle.runtime.renderer as unknown as { front: ScreenBuffer }).front;
    assert.deepEqual(front.get(0, 0)?.style.fg, parseColor("#7aa2f7"));
    assert.deepEqual(front.get(0, 0)?.style.bg, parseColor("#24283b"));
  } finally {
    app.stop();
  }
});

test("runtime theme switching re-renders components that read useTheme", async () => {
  function ThemeName() {
    const theme = useTheme();
    return h(Text, {}, theme.name);
  }

  const app = renderTestApp(h(ThemeName, {}), {
    width: 24,
    height: 2,
    runtime: { devtools: false, theme: getTheme("light") },
  });

  try {
    await app.settle();
    assert.match(app.snapshot(), /light/);

    app.handle.setTheme(getTheme("dracula"));
    await app.settle();

    assert.match(app.snapshot(), /dracula/);
  } finally {
    app.stop();
  }
});
