import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  Badge,
  Checkbox,
  Column,
  Divider,
  DUMB_CAPABILITIES,
  FULL_CAPABILITIES,
  Image,
  Kbd,
  Link,
  ProgressBar,
  RadioGroup,
  Row,
  Sparkline,
  Spinner,
  Switch,
  Tag,
  h,
  useState,
} from "../src/index.js";
import { renderWithFakeTty, screenText, settleRuntime, waitFor } from "./support/fake-tty.js";

test("checkbox toggles state on space", async (t) => {
  let value = false;
  function App() {
    const [v, setV] = useState(value);
    value = v;
    return h(Checkbox, { checked: v, onChange: setV, label: "Notify me" });
  }
  const harness = renderWithFakeTty(h(App, {}), { width: 24, height: 3 });
  t.after(() => harness.handle.stop());
  await settleRuntime();
  assert.match(screenText(harness.handle), /\[ \] Notify me/);

  harness.input.emitData(" ");
  await waitFor(() => /\[x\] Notify me/.test(screenText(harness.handle)));
  assert.equal(value, true);
});

test("switch flips with arrow keys and space", async (t) => {
  let value = false;
  function App() {
    const [v, setV] = useState(value);
    value = v;
    return h(Switch, { checked: v, onChange: setV, label: "Auto" });
  }
  const harness = renderWithFakeTty(h(App, {}), { width: 24, height: 3 });
  t.after(() => harness.handle.stop());
  await settleRuntime();
  assert.match(screenText(harness.handle), /Auto +\[OFF {2}\]/);

  harness.input.emitData(" ");
  await waitFor(() => /\[ {3}ON\]/.test(screenText(harness.handle)));
  assert.equal(value, true);

  harness.input.emitData("\x1b[D"); // left arrow turns it back off
  await waitFor(() => /\[OFF {2}\]/.test(screenText(harness.handle)));
  assert.equal(value, false);
});

test("radio group cycles through enabled options", async (t) => {
  let selected: "a" | "b" | "c" = "a";
  function App() {
    const [v, setV] = useState<"a" | "b" | "c">(selected);
    selected = v;
    return h(RadioGroup, {
      value: v,
      onChange: setV,
      options: [
        { value: "a", label: "Alpha" },
        { value: "b", label: "Bravo" },
        { value: "c", label: "Charlie" },
      ],
    });
  }
  const harness = renderWithFakeTty(h(App, {}), { width: 24, height: 5 });
  t.after(() => harness.handle.stop());
  await settleRuntime();

  const text = screenText(harness.handle);
  assert.match(text, /\(•\) Alpha/);
  assert.match(text, /\( \) Bravo/);

  harness.input.emitData("\x1b[B"); // down
  await waitFor(() => selected === "b");
  assert.match(screenText(harness.handle), /\(•\) Bravo/);

  harness.input.emitData("\x1b[B"); // down
  await waitFor(() => selected === "c");
  assert.match(screenText(harness.handle), /\(•\) Charlie/);

  harness.input.emitData("\x1b[B"); // wraps
  await waitFor(() => selected === "a");
});

test("progress bar fills proportionally", async (t) => {
  const harness = renderWithFakeTty(h(ProgressBar, { value: 0.5, width: 10 }), {
    width: 14,
    height: 2,
  });
  t.after(() => harness.handle.stop());
  await settleRuntime();
  const text = screenText(harness.handle);
  assert.match(text, /█████░░░░░/);
});

test("progress bar appends percent suffix", async (t) => {
  const harness = renderWithFakeTty(h(ProgressBar, { value: 0.42, width: 10, showPercent: true }), {
    width: 20,
    height: 2,
  });
  t.after(() => harness.handle.stop());
  await settleRuntime();
  assert.match(screenText(harness.handle), / 42%/);
});

test("spinner advances frames", async (t) => {
  const frames = ["A", "B", "C"];
  const harness = renderWithFakeTty(h(Spinner, { frames, interval: 5 }), { width: 4, height: 1 });
  t.after(() => harness.handle.stop());
  await settleRuntime();
  const initial = screenText(harness.handle).trim();
  await waitFor(() => screenText(harness.handle).trim() !== initial);
  const next = screenText(harness.handle).trim();
  assert.notEqual(next, initial);
  assert.ok(frames.includes(next));
});

test("sparkline renders one block per sample", async (t) => {
  const harness = renderWithFakeTty(h(Sparkline, { values: [1, 2, 3, 4, 5, 6, 7, 8] }), {
    width: 10,
    height: 1,
  });
  t.after(() => harness.handle.stop());
  await settleRuntime();
  const row = screenText(harness.handle).split("\n")[0]!;
  assert.match(row, /[▁▂▃▄▅▆▇█]{8}/);
});

test("sparkline downsamples long series to fit width", async (t) => {
  const series = Array.from({ length: 100 }, (_, i) => Math.sin(i / 5));
  const harness = renderWithFakeTty(h(Sparkline, { values: series, width: 10 }), {
    width: 14,
    height: 1,
  });
  t.after(() => harness.handle.stop());
  await settleRuntime();
  const row = screenText(harness.handle).split("\n")[0]!;
  const trimmed = row.trim();
  assert.equal([...trimmed].length, 10);
});

test("badge wraps content with breathing room", async (t) => {
  const harness = renderWithFakeTty(h(Badge, { variant: "success", children: "OK" }), {
    width: 6,
    height: 1,
  });
  t.after(() => harness.handle.stop());
  await settleRuntime();
  assert.match(screenText(harness.handle), / OK /);
});

test("tag fires onRemove on backspace", async (t) => {
  let removed = 0;
  const harness = renderWithFakeTty(
    h(Tag, {
      children: "graceglyph",
      onRemove: () => {
        removed += 1;
      },
    }),
    { width: 16, height: 1 },
  );
  t.after(() => harness.handle.stop());
  await settleRuntime();

  harness.input.emitData("\x7f"); // backspace
  await waitFor(() => removed === 1);
  assert.equal(removed, 1);
});

test("kbd renders a bracketed token", async (t) => {
  const harness = renderWithFakeTty(h(Kbd, { children: ["Ctrl", "K"] }), { width: 12, height: 1 });
  t.after(() => harness.handle.stop());
  await settleRuntime();
  assert.match(screenText(harness.handle), / Ctrl\+K /);
});

test("divider renders a horizontal rule with label", async (t) => {
  const harness = renderWithFakeTty(h(Column, {}, h(Divider, { label: "Settings", length: 20 })), {
    width: 22,
    height: 2,
  });
  t.after(() => harness.handle.stop());
  await settleRuntime();
  const text = screenText(harness.handle);
  assert.match(text, /─+ Settings ─+/);
});

test("divider expands to fill available width by default", async (t) => {
  const harness = renderWithFakeTty(h(Row, { width: 12 }, h(Divider, {})), {
    width: 14,
    height: 1,
  });
  t.after(() => harness.handle.stop());
  await settleRuntime();
  const row = screenText(harness.handle).split("\n")[0]!;
  // Expect a contiguous run of horizontal-line glyphs that spans the row.
  assert.match(row, /─{12}/);
});

test("image auto protocol prefers kitty when available", async (t) => {
  const harness = renderWithFakeTty(h(Image, { src: "/tmp/cat.png", alt: "Cat" }), {
    width: 40,
    height: 6,
    runtime: {
      capabilities: {
        ...FULL_CAPABILITIES,
        kittyGraphics: true,
        sixel: false,
        iterm2Images: false,
      },
    },
  });
  t.after(() => harness.handle.stop());
  await settleRuntime();
  const text = screenText(harness.handle);
  const raw = harness.output.output();
  assert.match(text, /protocol: kitty \(native\)/);
  assert.match(raw, /\x1b_Ga=T,t=f,f=100.*;L3RtcC9jYXQucG5n\x1b\\/);
});

test("image auto protocol falls back to ascii on dumb terminals", async (t) => {
  const harness = renderWithFakeTty(h(Image, { src: "/tmp/cat.png", alt: "Cat art" }), {
    width: 40,
    height: 6,
    runtime: { capabilities: DUMB_CAPABILITIES },
  });
  t.after(() => harness.handle.stop());
  await settleRuntime();
  const text = screenText(harness.handle);
  assert.match(text, /protocol: ascii/);
  assert.match(text, /\[ascii\] Cat art/);
});

test("image emits OSC 1337 payload for iTerm2 inline images", async (t) => {
  const dir = mkdtempSync(join(tmpdir(), "graceglyph-image-"));
  const src = join(dir, "pixel.bin");
  writeFileSync(src, Buffer.from([0, 1, 2, 3, 4]));
  const harness = renderWithFakeTty(h(Image, { src, alt: "Pixel", protocol: "iterm2" }), {
    width: 40,
    height: 6,
    runtime: { capabilities: { ...FULL_CAPABILITIES, kittyGraphics: false, sixel: false } },
  });
  t.after(() => harness.handle.stop());
  await settleRuntime();
  const raw = harness.output.output();
  assert.match(raw, /\x1b\]1337;File=name=.*;size=5;inline=1:[A-Za-z0-9+/=]+\x07/);
  assert.match(screenText(harness.handle), /protocol: iterm2 \(native\)/);
});

test("image emits sixel stream when source is sixel data", async (t) => {
  const sixel = "\x1bPq#1;2;0;0;0~\x1b\\";
  const harness = renderWithFakeTty(h(Image, { src: sixel, alt: "Sixel", protocol: "sixel" }), {
    width: 40,
    height: 6,
    runtime: { capabilities: { ...FULL_CAPABILITIES, kittyGraphics: false, iterm2Images: false } },
  });
  t.after(() => harness.handle.stop());
  await settleRuntime();
  const raw = harness.output.output();
  assert.match(raw, /\x1bPq#1;2;0;0;0~\x1b\\/);
  assert.match(screenText(harness.handle), /protocol: sixel \(native\)/);
});

test("link emits OSC 8 sequences when hyperlinks are supported", async (t) => {
  const harness = renderWithFakeTty(h(Link, { href: "https://example.com", children: "docs" }), {
    width: 20,
    height: 2,
    runtime: { capabilities: FULL_CAPABILITIES },
  });
  t.after(() => harness.handle.stop());
  await settleRuntime();
  const raw = harness.output.output();
  assert.match(raw, /\x1b\]8;;https:\/\/example\.com\x1b\\/);
  assert.match(raw, /\x1b\]8;;\x1b\\/);
});

test("link falls back to visible href on non-hyperlink terminals", async (t) => {
  const harness = renderWithFakeTty(h(Link, { href: "https://example.com", children: "docs" }), {
    width: 40,
    height: 2,
    runtime: { capabilities: DUMB_CAPABILITIES },
  });
  t.after(() => harness.handle.stop());
  await settleRuntime();
  const text = screenText(harness.handle);
  assert.match(text, /docs \(https:\/\/example.com\)/);
});
