import test from "node:test";
import assert from "node:assert/strict";

import {
  Accordion,
  EmptyState,
  Pagination,
  Stepper,
  Table,
  Tooltip,
  Tree,
  h,
  useState,
  type TableColumn,
  type TreeNode,
} from "../src/index.js";
import { renderWithFakeTty, screenText, settleRuntime, waitFor } from "./support/fake-tty.js";

interface Person {
  [key: string]: unknown;
  id: number;
  name: string;
  age: number;
}

const PEOPLE: readonly Person[] = [
  { id: 1, name: "alice", age: 30 },
  { id: 2, name: "bob", age: 24 },
  { id: 3, name: "carol", age: 41 },
];

const COLUMNS: readonly TableColumn<Person>[] = [
  { id: "name", header: "Name", sortable: true, fr: 2 },
  { id: "age", header: "Age", sortable: true, align: "right" },
];

test("table renders header row and body rows", async (t) => {
  const harness = renderWithFakeTty(h(Table, { rows: PEOPLE, columns: COLUMNS }), {
    width: 30,
    height: 6,
  });
  t.after(() => harness.handle.stop());
  await settleRuntime();
  const text = screenText(harness.handle);
  assert.match(text, /Name.*Age/);
  assert.match(text, /alice/);
  assert.match(text, /carol/);
});

test("table sorts ascending then descending then off when header clicked", async (t) => {
  type SortState = { columnId: string; direction: "asc" | "desc" } | null;
  const ref: { sort: SortState } = { sort: null };
  function App() {
    const [s, setS] = useState<SortState>(ref.sort);
    ref.sort = s;
    return h(Table, {
      rows: PEOPLE,
      columns: COLUMNS,
      sort: s ?? undefined,
      onSortChange: setS,
    });
  }
  const harness = renderWithFakeTty(h(App, {}), { width: 30, height: 6 });
  t.after(() => harness.handle.stop());
  await settleRuntime();

  // Click on the Age header. The header is on row 1 of the table; with no
  // sticky-header offset above, that's screen y=0. Pad+Name col is wider; the
  // Age cell starts after a 2-cell padded Name column, so x≈22 in a 30-wide
  // terminal is a safe target.
  const press = (x: number, y: number) => `\x1b[<0;${x + 1};${y + 1}M\x1b[<0;${x + 1};${y + 1}m`;
  harness.input.emitData(press(22, 0));
  await waitFor(() => ref.sort?.columnId === "age");
  assert.equal(ref.sort?.direction, "asc");

  harness.input.emitData(press(22, 0));
  await waitFor(() => ref.sort?.direction === "desc");

  harness.input.emitData(press(22, 0));
  await waitFor(() => ref.sort === null);
});

test("table arrow keys move selection through rows", async (t) => {
  let selected = 0;
  function App() {
    const [v, setV] = useState(selected);
    selected = v;
    return h(Table, {
      rows: PEOPLE,
      columns: COLUMNS,
      selected: v,
      onSelectChange: setV,
    });
  }
  const harness = renderWithFakeTty(h(App, {}), { width: 30, height: 6 });
  t.after(() => harness.handle.stop());
  await settleRuntime();

  harness.input.emitData("\x1b[B"); // down
  await waitFor(() => selected === 1);
  harness.input.emitData("\x1b[B"); // down
  await waitFor(() => selected === 2);
  harness.input.emitData("\x1b[F"); // end
  await settleRuntime();
  assert.equal(selected, 2);
});

test("tree expands and collapses with arrow keys", async (t) => {
  const NODES: readonly TreeNode[] = [
    {
      id: "src",
      label: "src",
      children: [
        { id: "src/index.ts", label: "index.ts" },
        {
          id: "src/components",
          label: "components",
          children: [{ id: "src/components/Button.tsx", label: "Button.tsx" }],
        },
      ],
    },
  ];
  let expanded: Record<string, boolean> = { src: true };
  let selectedId: string | undefined = "src";

  function App() {
    const [e, setE] = useState(expanded);
    expanded = e;
    const [s, setS] = useState(selectedId);
    selectedId = s;
    return h(Tree, {
      nodes: NODES,
      expanded: e,
      onToggle: (id: string, isOpen: boolean) => setE({ ...e, [id]: isOpen }),
      selectedId: s,
      onSelect: (id: string) => setS(id),
    });
  }

  const harness = renderWithFakeTty(h(App, {}), { width: 30, height: 8 });
  t.after(() => harness.handle.stop());
  await settleRuntime();
  assert.match(screenText(harness.handle), /index\.ts/);

  // Move down to "components", then expand it.
  harness.input.emitData("\x1b[B"); // down → index.ts
  await waitFor(() => selectedId === "src/index.ts");
  harness.input.emitData("\x1b[B"); // down → components
  await waitFor(() => selectedId === "src/components");

  harness.input.emitData("\x1b[C"); // right expands
  await waitFor(() => expanded["src/components"] === true);
  assert.match(screenText(harness.handle), /Button\.tsx/);

  harness.input.emitData("\x1b[D"); // left collapses
  await waitFor(() => expanded["src/components"] === false);
});

test("accordion toggles open state on enter", async (t) => {
  let open: readonly string[] = [];
  function App() {
    const [v, setV] = useState<readonly string[]>(open);
    open = v;
    return h(Accordion, {
      items: [
        { id: "a", title: "Section A", content: "alpha body" },
        { id: "b", title: "Section B", content: "bravo body" },
      ],
      openIds: v,
      onChange: setV,
    });
  }
  const harness = renderWithFakeTty(h(App, {}), { width: 30, height: 6 });
  t.after(() => harness.handle.stop());
  await settleRuntime();

  harness.input.emitData("\r"); // enter on first focused header
  await waitFor(() => open.includes("a"));
  assert.match(screenText(harness.handle), /alpha body/);
});

test("accordion in single mode replaces previous open id", async (t) => {
  let open: readonly string[] = ["a"];
  function App() {
    const [v, setV] = useState<readonly string[]>(open);
    open = v;
    return h(Accordion, {
      items: [
        { id: "a", title: "A", content: "ax" },
        { id: "b", title: "B", content: "bx" },
      ],
      openIds: v,
      onChange: setV,
      mode: "single",
    });
  }
  const harness = renderWithFakeTty(h(App, {}), { width: 16, height: 6 });
  t.after(() => harness.handle.stop());
  await settleRuntime();

  // Tab to second header, then activate.
  harness.input.emitData("\t");
  await settleRuntime();
  harness.input.emitData("\r");
  await waitFor(() => open.length === 1 && open[0] === "b");
});

test("stepper renders complete/active/pending markers", async (t) => {
  const harness = renderWithFakeTty(
    h(Stepper, {
      steps: [
        { id: "s1", label: "Plan" },
        { id: "s2", label: "Build" },
        { id: "s3", label: "Ship" },
      ],
      current: 1,
    }),
    { width: 40, height: 2 },
  );
  t.after(() => harness.handle.stop());
  await settleRuntime();
  const text = screenText(harness.handle);
  assert.match(text, /● Plan/);
  assert.match(text, /◉ Build/);
  assert.match(text, /○ Ship/);
});

test("pagination commits page on click", async (t) => {
  let page = 1;
  function App() {
    const [p, setP] = useState(page);
    page = p;
    return h(Pagination, { page: p, pageCount: 5, onChange: setP });
  }
  const harness = renderWithFakeTty(h(App, {}), { width: 60, height: 3 });
  t.after(() => harness.handle.stop());
  await settleRuntime();

  // First/Prev are disabled at page 1, so initial focus lands on the "1"
  // button. One Tab moves to "2".
  harness.input.emitData("\t");
  await settleRuntime();
  harness.input.emitData("\r");
  await waitFor(() => page === 2);
});

test("empty state renders title and description", async (t) => {
  const harness = renderWithFakeTty(
    h(EmptyState, {
      title: "No results",
      description: "Try a different search.",
    }),
    { width: 28, height: 6 },
  );
  t.after(() => harness.handle.stop());
  await settleRuntime();
  const text = screenText(harness.handle);
  assert.match(text, /No results/);
  assert.match(text, /Try a different search/);
});

test("tooltip renders label below child when open", async (t) => {
  const harness = renderWithFakeTty(
    h(Tooltip, { label: "Save (⌘S)", placement: "bottom" }, h("text", {}, "Save")),
    { width: 24, height: 4 },
  );
  t.after(() => harness.handle.stop());
  await settleRuntime();
  const text = screenText(harness.handle);
  assert.match(text, /Save/);
  assert.match(text, /Save \(⌘S\)/);
});
