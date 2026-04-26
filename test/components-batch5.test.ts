import test from "node:test";
import assert from "node:assert/strict";

import {
  Autocomplete,
  Avatar,
  Calendar,
  Card,
  Chip,
  Combobox,
  DatePicker,
  ErrorBoundary,
  ErrorMessage,
  FormField,
  IconButton,
  KeyHints,
  MaskedInput,
  MultiSelect,
  Notifications,
  Pill,
  ProgressRing,
  StatusBar,
  Suspense,
  TimePicker,
  Wizard,
  h,
  useState,
} from "../src/index.js";
import { renderWithFakeTty, screenText, settleRuntime, waitFor } from "./support/fake-tty.js";

test("chrome components render through the package root", async (t) => {
  const harness = renderWithFakeTty(
    h("box", { direction: "column", gap: 1 }, [
      h(Avatar, { name: "Ada Lovelace" }),
      h(Pill, { variant: "info", icon: "i" }, "member"),
      h(KeyHints, { hints: [{ keys: ["Ctrl", "K"], label: "palette" }] }),
      h(Card, { title: "Profile", footer: "ready" }, "body"),
    ]),
    { width: 40, height: 14 },
  );
  t.after(() => harness.handle.stop());
  await settleRuntime();
  const text = screenText(harness.handle);
  assert.match(text, /Profile/);
  assert.match(text, /AL/);
  assert.match(text, /\( i member \)/);
  assert.match(text, /Ctrl\+K/);
  assert.match(text, /ready/);
});

test("icon button and chip expose keyboard actions", async (t) => {
  let iconClicks = 0;
  let removed = 0;
  const harness = renderWithFakeTty(
    h("box", { direction: "row", gap: 1 }, [
      h(IconButton, { icon: "R", onClick: () => (iconClicks += 1) }),
      h(Chip, { onRemove: () => (removed += 1) }, "cache"),
    ]),
    { width: 24, height: 2 },
  );
  t.after(() => harness.handle.stop());
  await settleRuntime();

  harness.input.emitData("\r");
  await waitFor(() => iconClicks === 1);

  harness.input.emitData("\t");
  await settleRuntime();
  harness.input.emitData("\x7f");
  await waitFor(() => removed === 1);
});

test("status bar and notifications render chrome slots", async (t) => {
  const harness = renderWithFakeTty(
    h("box", { direction: "column", gap: 1 }, [
      h(StatusBar, { left: "main", center: "syncing", right: "ready" }),
      h(Notifications, {
        items: [{ id: "1", kind: "success", title: "Saved", message: "Settings persisted" }],
      }),
    ]),
    { width: 48, height: 5 },
  );
  t.after(() => harness.handle.stop());
  await settleRuntime();
  const text = screenText(harness.handle);
  assert.match(text, /main/);
  assert.match(text, /syncing/);
  assert.match(text, /ready/);
  assert.match(text, /Saved/);
  assert.match(text, /Settings persisted/);
});

test("combobox filters and commits a matching option", async (t) => {
  let value: string | null = null;
  function App() {
    const [v, setV] = useState<string | null>(value);
    value = v;
    return h(Combobox, {
      value: v,
      onChange: setV,
      options: [
        { value: "alpha", label: "Alpha" },
        { value: "bravo", label: "Bravo" },
        { value: "charlie", label: "Charlie" },
      ],
      width: 18,
    });
  }
  const harness = renderWithFakeTty(h(App, {}), { width: 28, height: 8 });
  t.after(() => harness.handle.stop());
  await settleRuntime();

  harness.input.emitData("br");
  await waitFor(() => /Bravo/.test(screenText(harness.handle)));
  harness.input.emitData("\r");
  await waitFor(() => value === "bravo");
});

test("autocomplete commits the highlighted suggestion", async (t) => {
  let selected = "";
  function App() {
    const [v, setV] = useState("");
    return h(Autocomplete, {
      value: v,
      onChange: setV,
      onSelect: (next: string) => (selected = next),
      suggestions: (query: string) =>
        ["alpha", "amber", "bravo"].filter((x) => x.startsWith(query)),
      width: 18,
    });
  }
  const harness = renderWithFakeTty(h(App, {}), { width: 28, height: 8 });
  t.after(() => harness.handle.stop());
  await settleRuntime();

  harness.input.emitData("a");
  await waitFor(() => /alpha/.test(screenText(harness.handle)));
  harness.input.emitData("\r");
  await waitFor(() => selected === "alpha");
});

test("multi-select toggles options from the dropdown", async (t) => {
  let value: readonly string[] = [];
  function App() {
    const [v, setV] = useState<readonly string[]>(value);
    value = v;
    return h(MultiSelect, {
      value: v,
      onChange: setV,
      options: [
        { value: "alpha", label: "Alpha" },
        { value: "bravo", label: "Bravo" },
      ],
      width: 20,
    });
  }
  const harness = renderWithFakeTty(h(App, {}), { width: 30, height: 8 });
  t.after(() => harness.handle.stop());
  await settleRuntime();

  harness.input.emitData("\r");
  await waitFor(() => /\[ \] Alpha/.test(screenText(harness.handle)));
  harness.input.emitData("\r");
  await waitFor(() => value.includes("alpha"));
});

test("masked input, form field, and error message render formatted form chrome", async (t) => {
  const harness = renderWithFakeTty(
    h(FormField, { label: "Phone", description: "US format", error: "Required" }, [
      h(MaskedInput, {
        mask: "(###) ###-####",
        value: "1234567890",
        onChange: () => {},
        width: 16,
      }),
      h(ErrorMessage, {}, "Try again"),
    ]),
    { width: 32, height: 6 },
  );
  t.after(() => harness.handle.stop());
  await settleRuntime();
  const text = screenText(harness.handle);
  assert.match(text, /Phone/);
  assert.match(text, /US format/);
  assert.match(text, /\(123\) 456-7890/);
  assert.match(text, /Required/);
  assert.match(text, /Try again/);
});

test("wizard advances and submits through button actions", async (t) => {
  let current = 0;
  let submitted = false;
  function App() {
    const [step, setStep] = useState(current);
    current = step;
    return h(Wizard, {
      current: step,
      onChange: setStep,
      onSubmit: () => (submitted = true),
      steps: [
        { id: "one", label: "One", content: "First step" },
        { id: "two", label: "Two", content: "Second step" },
      ],
    });
  }
  const harness = renderWithFakeTty(h(App, {}), { width: 40, height: 10 });
  t.after(() => harness.handle.stop());
  await settleRuntime();

  harness.input.emitData("\r");
  await waitFor(() => current === 1);
  harness.input.emitData("\r");
  await waitFor(() => submitted === true);
});

test("error boundary and suspense render fallback content", async (t) => {
  const harness = renderWithFakeTty(
    h("box", { direction: "column" }, [
      h(ErrorBoundary, {
        render: () => {
          throw new Error("boom");
        },
        fallback: (error: Error) => h("text", {}, `caught: ${error.message}`),
      }),
      h("box", {}, h("text", {}, "separator")),
      h(Suspense, { when: true, fallback: "loading" }, h("text", {}, "loaded")),
    ]),
    { width: 32, height: 5 },
  );
  t.after(() => harness.handle.stop());
  await settleRuntime();
  const text = screenText(harness.handle);
  assert.match(text, /caught: boom/);
  assert.match(text, /loading/);
});

test("calendar arrow keys select adjacent dates", async (t) => {
  let selected = { year: 2026, month: 3, day: 10 };
  function App() {
    const [date, setDate] = useState(selected);
    selected = date;
    return h(Calendar, {
      month: { year: 2026, month: 3 },
      selected: date,
      onSelect: setDate,
    });
  }
  const harness = renderWithFakeTty(h(App, {}), { width: 32, height: 10 });
  t.after(() => harness.handle.stop());
  await settleRuntime();

  harness.input.emitData("\x1b[C");
  await waitFor(() => selected.day === 11);
});

test("date picker and time picker expose temporal controls", async (t) => {
  let time = { hour: 9, minute: 30 };
  function App() {
    const [tValue, setTime] = useState(time);
    time = tValue;
    return h("box", { direction: "column", gap: 1 }, [
      h(DatePicker, {
        value: { year: 2026, month: 3, day: 26 },
        onChange: () => {},
        width: 16,
      }),
      h(TimePicker, { value: tValue, onChange: setTime }),
    ]);
  }
  const harness = renderWithFakeTty(h(App, {}), { width: 32, height: 5 });
  t.after(() => harness.handle.stop());
  await settleRuntime();
  assert.match(screenText(harness.handle), /2026-04-26/);

  harness.input.emitData("\t");
  await settleRuntime();
  harness.input.emitData("\x1b[A");
  await waitFor(() => time.hour === 10);
});

test("progress ring renders determinate and indeterminate states", async (t) => {
  const harness = renderWithFakeTty(
    h("box", { direction: "column" }, [
      h(ProgressRing, { value: 1, label: "complete" }),
      h(ProgressRing, { intervalMs: 0, label: "working" }),
    ]),
    { width: 24, height: 3 },
  );
  t.after(() => harness.handle.stop());
  await settleRuntime();
  const text = screenText(harness.handle);
  assert.match(text, /● complete/);
  assert.match(text, /working/);
});
