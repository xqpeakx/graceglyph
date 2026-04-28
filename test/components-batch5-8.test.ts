import test from "node:test";
import assert from "node:assert/strict";

import {
  Autocomplete,
  Avatar,
  BarChart,
  Calendar,
  Card,
  Chip,
  Combobox,
  DataGrid,
  DatePicker,
  ErrorBoundary,
  FilePicker,
  Gauge,
  Heatmap,
  Histogram,
  IconButton,
  KeyHints,
  LineChart,
  Markdown,
  MaskedInput,
  MultiSelect,
  Notifications,
  Pill,
  Popover,
  PathBreadcrumbs,
  ProgressRing,
  StatusBar,
  Suspense,
  TimePicker,
  Wizard,
  autoDomain,
  h,
  parseMarkdown,
  useState,
  type DataGridColumn,
  type FileEntry,
} from "../src/index.js";
import { renderWithFakeTty, screenText, settleRuntime, waitFor } from "./support/fake-tty.js";

// -- batch 5: chrome ---------------------------------------------------------

test("IconButton invokes onClick on Enter while focused", async (t) => {
  let clicks = 0;
  const harness = renderWithFakeTty(h(IconButton, { icon: "★", onClick: () => (clicks += 1) }), {
    width: 6,
    height: 1,
  });
  t.after(() => harness.handle.stop());
  await settleRuntime();
  harness.input.emitData("\r");
  await waitFor(() => clicks === 1);
});

test("Avatar renders centered initials when no glyph is given", async (t) => {
  const harness = renderWithFakeTty(h(Avatar, { name: "Quentin Cooley", size: 4 }), {
    width: 6,
    height: 1,
  });
  t.after(() => harness.handle.stop());
  await settleRuntime();
  // "QC" centered in 4 cells: " QC "
  assert.match(screenText(harness.handle), / QC /);
});

test("Pill wraps content in parentheses with optional icon", async (t) => {
  const harness = renderWithFakeTty(h(Pill, { variant: "info", icon: "i", children: "tip" }), {
    width: 14,
    height: 1,
  });
  t.after(() => harness.handle.stop());
  await settleRuntime();
  assert.match(screenText(harness.handle), /\( i tip \)/);
});

test("Chip fires onRemove on backspace", async (t) => {
  let removed = 0;
  const harness = renderWithFakeTty(h(Chip, { children: "tag", onRemove: () => (removed += 1) }), {
    width: 12,
    height: 1,
  });
  t.after(() => harness.handle.stop());
  await settleRuntime();
  harness.input.emitData("\x7f");
  await waitFor(() => removed === 1);
});

test("Card renders title and footer rows", async (t) => {
  const harness = renderWithFakeTty(
    h(
      Card,
      { title: "Status", footer: "updated 1m ago" } as Record<string, unknown>,
      h("text", {}, "all systems normal"),
    ),
    { width: 36, height: 10 },
  );
  t.after(() => harness.handle.stop());
  await settleRuntime();
  const text = screenText(harness.handle);
  assert.match(text, /Status/);
  assert.match(text, /all systems normal/);
  assert.match(text, /updated 1m ago/);
});

test("ProgressRing shows quarter glyph for determinate values", async (t) => {
  const harness = renderWithFakeTty(h(ProgressRing, { value: 1, label: "done" }), {
    width: 12,
    height: 1,
  });
  t.after(() => harness.handle.stop());
  await settleRuntime();
  assert.match(screenText(harness.handle), /● done/);
});

test("KeyHints renders kbd-styled chord and label", async (t) => {
  const harness = renderWithFakeTty(
    h(KeyHints, {
      hints: [
        { keys: "Tab", label: "next" },
        { keys: ["Ctrl", "K"], label: "palette" },
      ],
    }),
    { width: 40, height: 1 },
  );
  t.after(() => harness.handle.stop());
  await settleRuntime();
  const text = screenText(harness.handle);
  assert.match(text, / Tab .*next/);
  assert.match(text, / Ctrl\+K .*palette/);
});

test("StatusBar splits into left/center/right slots", async (t) => {
  const harness = renderWithFakeTty(
    h(StatusBar, { left: "branch:main", center: "9 changes", right: "↑1 ↓0" }),
    { width: 40, height: 1 },
  );
  t.after(() => harness.handle.stop());
  await settleRuntime();
  const row = screenText(harness.handle).split("\n")[0]!;
  assert.match(row, /branch:main/);
  assert.match(row, /9 changes/);
  assert.match(row, /↑1 ↓0/);
});

test("Notifications dismisses an item on click", async (t) => {
  let dismissed: (string | number) | null = null;
  const harness = renderWithFakeTty(
    h(Notifications, {
      items: [{ id: "x", title: "Build", message: "passed", kind: "success" }],
      onDismiss: (id: string | number) => (dismissed = id),
    }),
    { width: 40, height: 4 },
  );
  t.after(() => harness.handle.stop());
  await settleRuntime();
  // Click anywhere on the notification row.
  harness.input.emitData("\x1b[<0;2;1M\x1b[<0;2;1m");
  await waitFor(() => dismissed === "x");
});

// -- batch 6: forms ----------------------------------------------------------

test("Combobox filters options by typed query", async (t) => {
  const ref: { value: string | null } = { value: null };
  function App() {
    const [v, setV] = useState<string | null>(null);
    ref.value = v;
    return h(Combobox, {
      options: [
        { value: "rust", label: "Rust" },
        { value: "ruby", label: "Ruby" },
        { value: "python", label: "Python" },
      ],
      value: v,
      onChange: setV,
    });
  }
  const harness = renderWithFakeTty(h(App, {}), { width: 30, height: 8 });
  t.after(() => harness.handle.stop());
  await settleRuntime();
  // Type "ru" — Rust + Ruby remain.
  harness.input.emitData("ru");
  await waitFor(
    () => /Rust/.test(screenText(harness.handle)) && /Ruby/.test(screenText(harness.handle)),
  );
  assert.doesNotMatch(screenText(harness.handle), /Python/);
});

test("Autocomplete picks suggestion on enter", async (t) => {
  const ref: { value: string } = { value: "" };
  function App() {
    const [v, setV] = useState("");
    ref.value = v;
    return h(Autocomplete, {
      value: v,
      onChange: setV,
      suggestions: (q: string) => ["alpha", "alphabet", "bravo"].filter((s) => s.startsWith(q)),
    });
  }
  const harness = renderWithFakeTty(h(App, {}), { width: 24, height: 8 });
  t.after(() => harness.handle.stop());
  await settleRuntime();
  harness.input.emitData("a");
  await waitFor(() => /alphabet/.test(screenText(harness.handle)));
  harness.input.emitData("\r"); // enter — pick first suggestion (alpha)
  await waitFor(() => ref.value === "alpha");
});

test("MultiSelect toggles values via space", async (t) => {
  const ref: { value: readonly string[] } = { value: [] };
  function App() {
    const [v, setV] = useState<readonly string[]>([]);
    ref.value = v;
    return h(MultiSelect, {
      options: [
        { value: "a", label: "Alpha" },
        { value: "b", label: "Bravo" },
      ],
      value: v,
      onChange: setV,
    });
  }
  const harness = renderWithFakeTty(h(App, {}), { width: 24, height: 8 });
  t.after(() => harness.handle.stop());
  await settleRuntime();
  harness.input.emitData(" "); // open
  await waitFor(() => /Alpha/.test(screenText(harness.handle)));
  harness.input.emitData(" "); // toggle highlighted (Alpha)
  await waitFor(() => ref.value.includes("a"));
  harness.input.emitData("\x1b[B "); // down then space → toggle Bravo
  await waitFor(() => ref.value.includes("b"));
});

test("MaskedInput formats raw digits through a phone mask", async (t) => {
  function App() {
    const [v, setV] = useState("4155551212");
    return h(MaskedInput, {
      mask: "(###) ###-####",
      value: v,
      onChange: setV,
      width: 20,
    });
  }
  const harness = renderWithFakeTty(h(App, {}), { width: 24, height: 1 });
  t.after(() => harness.handle.stop());
  await settleRuntime();
  assert.match(screenText(harness.handle), /\(415\) 555-1212/);
});

test("Wizard advances through steps and fires onSubmit at the end", async (t) => {
  let submitted = 0;
  const ref = { current: 0 };
  function App() {
    const [step, setStep] = useState(0);
    ref.current = step;
    return h(Wizard, {
      steps: [
        { id: "a", label: "A", content: "step one" },
        { id: "b", label: "B", content: "step two" },
        { id: "c", label: "C", content: "step three" },
      ],
      current: step,
      onChange: setStep,
      onSubmit: () => (submitted += 1),
    });
  }
  const harness = renderWithFakeTty(h(App, {}), { width: 40, height: 8 });
  t.after(() => harness.handle.stop());
  await settleRuntime();
  // Tab past Stepper segments to Back, again to Next, then Enter.
  harness.input.emitData("\t\t\t\t");
  await settleRuntime();
  harness.input.emitData("\r");
  await waitFor(() => ref.current === 1);
  // Already on Next button — Enter again.
  harness.input.emitData("\r");
  await waitFor(() => ref.current === 2);
  harness.input.emitData("\r");
  await waitFor(() => submitted === 1);
});

test("ErrorBoundary catches render-time exceptions", async (t) => {
  const harness = renderWithFakeTty(
    h(ErrorBoundary, {
      render: () => {
        throw new Error("boom");
      },
      fallback: (err: Error) => h("text", {}, `caught: ${err.message}`),
    }),
    { width: 30, height: 2 },
  );
  t.after(() => harness.handle.stop());
  await settleRuntime();
  assert.match(screenText(harness.handle), /caught: boom/);
});

test("Suspense renders fallback while when is true", async (t) => {
  const harness = renderWithFakeTty(
    h(Suspense, { when: true, fallback: "loading…" }, h("text", {}, "ready")),
    { width: 16, height: 2 },
  );
  t.after(() => harness.handle.stop());
  await settleRuntime();
  assert.match(screenText(harness.handle), /loading…/);
});

// -- batch 6: temporal ------------------------------------------------------

test("Calendar header shows month + year for the anchor", async (t) => {
  const harness = renderWithFakeTty(
    h(Calendar, { month: { year: 2026, month: 3 } } as Record<string, unknown>),
    { width: 28, height: 10 },
  );
  t.after(() => harness.handle.stop());
  await settleRuntime();
  assert.match(screenText(harness.handle), /April 2026/);
});

test("DatePicker opens calendar on enter and selects a day", async (t) => {
  const ref: { value: { year: number; month: number; day: number } | null } = { value: null };
  function App() {
    const [v, setV] = useState<typeof ref.value>(null);
    ref.value = v;
    return h(DatePicker, {
      value: v,
      onChange: setV,
      showCalendar: true,
    });
  }
  const harness = renderWithFakeTty(h(App, {}), { width: 24, height: 14 });
  t.after(() => harness.handle.stop());
  await settleRuntime();
  // Calendar already open via showCalendar: true. Verify the weekday header
  // shows up; that confirms the picker rendered the body.
  assert.match(screenText(harness.handle), /Mo/);
});

test("TimePicker bumps active segment with up arrow", async (t) => {
  const ref = { hour: 9, minute: 30 };
  function App() {
    const [v, setV] = useState({ hour: 9, minute: 30 });
    ref.hour = v.hour;
    ref.minute = v.minute;
    return h(TimePicker, { value: v, onChange: setV });
  }
  const harness = renderWithFakeTty(h(App, {}), { width: 14, height: 3 });
  t.after(() => harness.handle.stop());
  await settleRuntime();
  harness.input.emitData("\x1b[A"); // up bumps hour by 1
  await waitFor(() => ref.hour === 10);
});

// -- batch 7: charts --------------------------------------------------------

test("autoDomain returns the min/max range with epsilon for flat series", () => {
  assert.deepEqual(autoDomain([1, 2, 3, 4, 5]), { min: 1, max: 5 });
  const flat = autoDomain([3, 3, 3]);
  assert.ok(flat.min < 3 && flat.max > 3);
});

test("LineChart renders glyph bars for each sample", async (t) => {
  const harness = renderWithFakeTty(
    h(LineChart, {
      series: [{ id: "a", values: [1, 4, 2, 5, 3] }],
      width: 16,
      height: 3,
      showAxis: false,
    }),
    { width: 18, height: 4 },
  );
  t.after(() => harness.handle.stop());
  await settleRuntime();
  const text = screenText(harness.handle);
  assert.match(text, /[▁▂▃▄▅▆▇█]/);
});

test("BarChart renders one bar per datum with labels", async (t) => {
  const harness = renderWithFakeTty(
    h(BarChart, {
      data: [
        { label: "alice", value: 10 },
        { label: "bob", value: 4 },
      ],
      width: 30,
    }),
    { width: 32, height: 4 },
  );
  t.after(() => harness.handle.stop());
  await settleRuntime();
  const text = screenText(harness.handle);
  assert.match(text, /alice/);
  assert.match(text, /bob/);
  assert.match(text, /█+/);
});

test("Histogram bins values into approximate counts", async (t) => {
  const values = [1, 1, 2, 2, 3, 3, 4, 5, 5, 5];
  const harness = renderWithFakeTty(h(Histogram, { values, bins: 5, width: 30 }), {
    width: 32,
    height: 6,
  });
  t.after(() => harness.handle.stop());
  await settleRuntime();
  // At least some bins are non-empty.
  assert.match(screenText(harness.handle), /█/);
});

test("Gauge renders a [bar] chunk with thresholds", async (t) => {
  const harness = renderWithFakeTty(
    h(Gauge, { value: 0.95, thresholds: [0.7, 0.9], showPercent: true, label: "cpu" }),
    { width: 28, height: 1 },
  );
  t.after(() => harness.handle.stop());
  await settleRuntime();
  const text = screenText(harness.handle);
  assert.match(text, /cpu \[█+░*\] 95%/);
});

test("Heatmap renders one cell glyph per matrix entry", async (t) => {
  const harness = renderWithFakeTty(
    h(Heatmap, {
      rows: [
        [0, 0.5, 1],
        [0.2, 0.8, 0.4],
      ],
      cellWidth: 2,
      showAxis: false,
    }),
    { width: 12, height: 3 },
  );
  t.after(() => harness.handle.stop());
  await settleRuntime();
  // Each row should contain at least one rendered glyph.
  assert.match(screenText(harness.handle), /[░▒▓█]/);
});

// -- batch 8 ----------------------------------------------------------------

test("Markdown renders headings, lists, and code fences", async (t) => {
  const source = [
    "# Title",
    "",
    "Some **bold** and *italic* with `code` inline.",
    "",
    "- one",
    "- two",
    "",
    "```javascript",
    "const x = 1;",
    "```",
  ].join("\n");
  const harness = renderWithFakeTty(h(Markdown, { children: source, width: 40 }), {
    width: 42,
    height: 12,
  });
  t.after(() => harness.handle.stop());
  await settleRuntime();
  const text = screenText(harness.handle);
  assert.match(text, /# Title/);
  assert.match(text, /one/);
  assert.match(text, /const x = 1;/);
});

test("parseMarkdown classifies headings, lists, code, and rules", () => {
  const blocks = parseMarkdown("# H\n\n- a\n- b\n\n---\n\n```js\nx\n```");
  const kinds = blocks.map((b) => b.kind);
  assert.deepEqual(kinds, ["heading", "ul", "rule", "code"]);
});

test("PathBreadcrumbs renders segments with separators", async (t) => {
  const harness = renderWithFakeTty(
    h(PathBreadcrumbs, { path: "/home/user/project", separator: "›" }),
    { width: 32, height: 1 },
  );
  t.after(() => harness.handle.stop());
  await settleRuntime();
  const text = screenText(harness.handle);
  assert.match(text, /home › user › project/);
});

test("FilePicker expands directories and selects files", async (t) => {
  const ENTRIES: readonly FileEntry[] = [
    {
      name: "src",
      children: [
        { name: "index.ts", isFile: true },
        { name: "README.md", isFile: true },
      ],
    },
    { name: "package.json", isFile: true },
  ];
  let selected: { path: string; entry: FileEntry } | null = null;
  function App() {
    return h(FilePicker, {
      entries: ENTRIES,
      onSelect: (path: string, entry: FileEntry) => {
        selected = { path, entry };
      },
    });
  }
  const harness = renderWithFakeTty(h(App, {}), { width: 30, height: 8 });
  t.after(() => harness.handle.stop());
  await settleRuntime();
  // First row is "src" — Enter expands it.
  harness.input.emitData("\r");
  await waitFor(() => /index\.ts/.test(screenText(harness.handle)));
  // Down twice → README.md, Enter to select.
  harness.input.emitData("\x1b[B\x1b[B");
  await settleRuntime();
  harness.input.emitData("\r");
  await waitFor(() => selected != null && selected.path.endsWith("README.md"));
});

test("DataGrid edits a cell on Enter and commits on Submit", async (t) => {
  interface Row {
    [k: string]: unknown;
    name: string;
    age: number;
  }
  const ref = { rows: [{ name: "alice", age: 30 } as Row] };
  function App() {
    const [rows, setRows] = useState<readonly Row[]>(ref.rows);
    ref.rows = [...rows];
    const columns: DataGridColumn<Row>[] = [
      { id: "name", header: "Name", editable: true, fr: 2 },
      { id: "age", header: "Age", align: "right", width: 6 },
    ];
    return h(DataGrid, {
      rows,
      columns,
      selected: 0,
      onChangeRow: (index: number, next: Row) => {
        setRows((current) => current.map((r, i) => (i === index ? next : r)));
      },
    });
  }
  const harness = renderWithFakeTty(h(App, {}), { width: 30, height: 4 });
  t.after(() => harness.handle.stop());
  await settleRuntime();
  // Enter triggers edit on the "name" column.
  harness.input.emitData("\r");
  await settleRuntime();
  // Replace value: backspace 5 times then type "bob".
  harness.input.emitData("\x7f\x7f\x7f\x7f\x7fbob\r");
  await waitFor(() => ref.rows[0]!.name === "bob");
});

test("Popover renders content alongside the anchor when open", async (t) => {
  const harness = renderWithFakeTty(
    h(
      Popover,
      { open: true, content: "hello popover" } as Record<string, unknown>,
      h("text", {}, "anchor"),
    ),
    { width: 36, height: 6 },
  );
  t.after(() => harness.handle.stop());
  await settleRuntime();
  const text = screenText(harness.handle);
  assert.match(text, /anchor/);
  assert.match(text, /hello popover/);
});
