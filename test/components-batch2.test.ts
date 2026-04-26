import test from "node:test";
import assert from "node:assert/strict";

import {
  ButtonGroup,
  Button,
  Column,
  NumberInput,
  PasswordInput,
  RangeSlider,
  Select,
  Skeleton,
  Slider,
  ToggleButton,
  h,
  useState,
} from "../src/index.js";
import { renderWithFakeTty, screenText, settleRuntime, waitFor } from "./support/fake-tty.js";

test("slider increments by step on right arrow", async (t) => {
  let v = 0.5;
  function App() {
    const [value, setValue] = useState(v);
    v = value;
    return h(Slider, { value, onChange: setValue, min: 0, max: 1, step: 0.1, width: 10 });
  }
  const harness = renderWithFakeTty(h(App, {}), { width: 24, height: 2 });
  t.after(() => harness.handle.stop());
  await settleRuntime();

  harness.input.emitData("\x1b[C"); // right
  await waitFor(() => Math.abs(v - 0.6) < 1e-6);
});

test("slider clamps at min and max", async (t) => {
  let v = 0;
  function App() {
    const [value, setValue] = useState(v);
    v = value;
    return h(Slider, { value, onChange: setValue, min: 0, max: 5, step: 1, width: 10 });
  }
  const harness = renderWithFakeTty(h(App, {}), { width: 24, height: 2 });
  t.after(() => harness.handle.stop());
  await settleRuntime();

  harness.input.emitData("\x1b[D"); // left at min stays clamped
  await settleRuntime();
  assert.equal(v, 0);

  harness.input.emitData("\x1b[F"); // end
  await waitFor(() => v === 5);
});

test("range slider arrow keys drive active thumb; up/down swap focus", async (t) => {
  let lo = 1;
  let hi = 9;
  function App() {
    const [value, setValue] = useState<[number, number]>([lo, hi]);
    [lo, hi] = value;
    return h(RangeSlider, {
      value,
      onChange: setValue,
      min: 0,
      max: 10,
      step: 1,
      width: 12,
    });
  }
  const harness = renderWithFakeTty(h(App, {}), { width: 40, height: 2 });
  t.after(() => harness.handle.stop());
  await settleRuntime();

  harness.input.emitData("\x1b[D"); // left moves the lo thumb
  await waitFor(() => lo === 0);

  // Up arrow swaps to the hi thumb; left then decrements it.
  harness.input.emitData("\x1b[A");
  await settleRuntime();
  harness.input.emitData("\x1b[D");
  await waitFor(() => hi === 8);
});

test("number input increments on up arrow and clamps to max", async (t) => {
  let value = 5;
  function App() {
    const [v, setV] = useState(value);
    value = v;
    return h(NumberInput, { value: v, onChange: setV, min: 0, max: 6, step: 1 });
  }
  const harness = renderWithFakeTty(h(App, {}), { width: 18, height: 2 });
  t.after(() => harness.handle.stop());
  await settleRuntime();

  harness.input.emitData("\x1b[A"); // up
  await waitFor(() => value === 6);

  harness.input.emitData("\x1b[A"); // up — clamp to max
  await settleRuntime();
  assert.equal(value, 6);
});

test("password input renders mask glyph instead of text", async (t) => {
  function App() {
    const [v, setV] = useState("hunter2");
    return h(PasswordInput, { value: v, onChange: setV, width: 12 });
  }
  const harness = renderWithFakeTty(h(App, {}), { width: 14, height: 1 });
  t.after(() => harness.handle.stop());
  await settleRuntime();

  const text = screenText(harness.handle);
  assert.match(text, /•{7}/);
  assert.doesNotMatch(text, /hunter2/);
});

test("toggle button flips pressed state on space", async (t) => {
  let pressed = false;
  function App() {
    const [v, setV] = useState(pressed);
    pressed = v;
    return h(ToggleButton, { pressed: v, onChange: setV, children: "Mute" });
  }
  const harness = renderWithFakeTty(h(App, {}), { width: 12, height: 3 });
  t.after(() => harness.handle.stop());
  await settleRuntime();

  harness.input.emitData(" ");
  await waitFor(() => pressed === true);
});

test("button group cycles focus across children with Tab", async (t) => {
  const clicks: string[] = [];
  const harness = renderWithFakeTty(
    h(
      ButtonGroup,
      { direction: "row" },
      h(Button, { onClick: () => clicks.push("a") }, "A"),
      h(Button, { onClick: () => clicks.push("b") }, "B"),
      h(Button, { onClick: () => clicks.push("c") }, "C"),
    ),
    { width: 18, height: 4 },
  );
  t.after(() => harness.handle.stop());
  await settleRuntime();

  harness.input.emitData("\r"); // enter on first focused button
  await waitFor(() => clicks.length === 1);
  assert.equal(clicks[0], "a");

  harness.input.emitData("\t");
  await settleRuntime();
  harness.input.emitData("\r");
  await waitFor(() => clicks.length === 2);
  assert.equal(clicks[1], "b");
});

test("select opens, navigates, and commits on enter", async (t) => {
  let value = "alpha";
  function App() {
    const [v, setV] = useState(value);
    value = v;
    return h(Select, {
      value: v,
      onChange: setV,
      options: [
        { value: "alpha", label: "Alpha" },
        { value: "bravo", label: "Bravo" },
        { value: "charlie", label: "Charlie" },
      ],
      width: 16,
    });
  }
  const harness = renderWithFakeTty(h(App, {}), { width: 24, height: 12 });
  t.after(() => harness.handle.stop());
  await settleRuntime();

  // open with Enter
  harness.input.emitData("\r");
  await waitFor(
    () => /Bravo/.test(screenText(harness.handle)) && /Charlie/.test(screenText(harness.handle)),
  );

  harness.input.emitData("\x1b[B"); // down
  await settleRuntime();
  harness.input.emitData("\r");
  await waitFor(() => value === "bravo");
});

test("select closes on escape without committing", async (t) => {
  let value = "alpha";
  function App() {
    const [v, setV] = useState(value);
    value = v;
    return h(Select, {
      value: v,
      onChange: setV,
      options: [
        { value: "alpha", label: "Alpha" },
        { value: "bravo", label: "Bravo" },
      ],
      width: 16,
    });
  }
  const harness = renderWithFakeTty(h(App, {}), { width: 24, height: 12 });
  t.after(() => harness.handle.stop());
  await settleRuntime();

  harness.input.emitData("\r"); // open
  await waitFor(() => /Bravo/.test(screenText(harness.handle)));

  harness.input.emitData("\x1b"); // escape
  await waitFor(() => !/Bravo/.test(screenText(harness.handle)));
  assert.equal(value, "alpha");
});

test("skeleton renders fixed-width block placeholder", async (t) => {
  const harness = renderWithFakeTty(h(Column, {}, h(Skeleton, { width: 10, pulseMs: 0 })), {
    width: 14,
    height: 2,
  });
  t.after(() => harness.handle.stop());
  await settleRuntime();
  const row = screenText(harness.handle).split("\n")[0]!;
  assert.match(row, /▀{10}/);
});

test("skeleton renders multi-line placeholder", async (t) => {
  const harness = renderWithFakeTty(h(Skeleton, { width: 8, lines: 3, pulseMs: 0 }), {
    width: 12,
    height: 4,
  });
  t.after(() => harness.handle.stop());
  await settleRuntime();
  const text = screenText(harness.handle).split("\n").slice(0, 3).join("\n");
  assert.equal(text.split("\n").filter((row) => /▀{8}/.test(row)).length, 3);
});
