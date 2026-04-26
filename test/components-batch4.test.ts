import test from "node:test";
import assert from "node:assert/strict";

import {
  Code,
  DiffView,
  JSONViewer,
  LogStream,
  h,
  highlight,
  parseUnifiedDiff,
  tokensByLine,
} from "../src/index.js";
import { renderWithFakeTty, screenText, settleRuntime } from "./support/fake-tty.js";

test("highlight tokenizes javascript keywords, strings, numbers, comments", () => {
  const tokens = highlight(
    `// hi\nconst foo = "bar";\nfunction add(a, b) { return a + b; }`,
    "javascript",
  );
  const kinds = new Set(tokens.map((t) => t.kind));
  assert.ok(kinds.has("comment"));
  assert.ok(kinds.has("keyword"));
  assert.ok(kinds.has("string"));
  assert.ok(kinds.has("function"));
  // Combined into runs — adjacent same-kind tokens merge.
  for (let i = 1; i < tokens.length; i++) {
    if (tokens[i]!.kind === tokens[i - 1]!.kind) {
      assert.fail("adjacent same-kind tokens should be merged");
    }
  }
});

test("highlight emits one boolean and one null token in JSON", () => {
  const tokens = highlight(`{"x": true, "y": null}`, "json");
  assert.ok(tokens.find((t) => t.kind === "boolean" && t.text === "true"));
  assert.ok(tokens.find((t) => t.kind === "null" && t.text === "null"));
});

test("tokensByLine splits on newlines", () => {
  const tokens = highlight(`a\nb\n`, "javascript");
  const lines = tokensByLine(tokens);
  assert.equal(lines.length, 3); // trailing newline produces an empty trailing line
  assert.equal(lines[0]!.map((t) => t.text).join(""), "a");
  assert.equal(lines[1]!.map((t) => t.text).join(""), "b");
});

test("Code component renders source with optional line numbers", async (t) => {
  const harness = renderWithFakeTty(
    h(Code, {
      children: `const x = 1;\nconst y = 2;`,
      language: "typescript",
      showLineNumbers: true,
    }),
    { width: 30, height: 4 },
  );
  t.after(() => harness.handle.stop());
  await settleRuntime();
  const text = screenText(harness.handle);
  assert.match(text, / 1 {2}const x = 1;/);
  assert.match(text, / 2 {2}const y = 2;/);
});

test("JSONViewer renders objects with collapse markers", async (t) => {
  const harness = renderWithFakeTty(
    h(JSONViewer, {
      value: { name: "alice", tags: ["a", "b"], age: 30, active: true },
      defaultExpandDepth: -1,
    }),
    { width: 40, height: 12 },
  );
  t.after(() => harness.handle.stop());
  await settleRuntime();
  const text = screenText(harness.handle);
  assert.match(text, /"name": "alice"/);
  assert.match(text, /"age": 30/);
  assert.match(text, /"active": true/);
  assert.match(text, /▾ \{/);
});

test("JSONViewer collapses arrays when expand depth is shallow", async (t) => {
  const harness = renderWithFakeTty(
    h(JSONViewer, {
      value: { items: [1, 2, 3] },
      defaultExpandDepth: 0,
    }),
    { width: 30, height: 4 },
  );
  t.after(() => harness.handle.stop());
  await settleRuntime();
  // root is collapsed at depth 0, so we expect a collapsed object marker
  assert.match(screenText(harness.handle), /▸ \{ … \} \(1\)/);
});

test("parseUnifiedDiff classifies hunks, adds, removes, context", () => {
  const text = [
    "diff --git a/foo b/foo",
    "index 1234..5678 100644",
    "--- a/foo",
    "+++ b/foo",
    "@@ -1,3 +1,3 @@",
    " keep",
    "-old",
    "+new",
    " keep",
  ].join("\n");
  const lines = parseUnifiedDiff(text);
  const kinds = lines.map((l) => l.kind);
  assert.ok(kinds.includes("meta"));
  assert.ok(kinds.includes("hunk"));
  assert.ok(kinds.includes("add"));
  assert.ok(kinds.includes("remove"));
  const removeLine = lines.find((l) => l.kind === "remove")!;
  assert.equal(removeLine.text, "old");
  assert.equal(removeLine.oldLine, 2);
  const addLine = lines.find((l) => l.kind === "add")!;
  assert.equal(addLine.text, "new");
  assert.equal(addLine.newLine, 2);
});

test("DiffView renders + / - prefixes for add and remove lines", async (t) => {
  const unified = ["@@ -1,3 +1,3 @@", " keep", "-old", "+new", " keep"].join("\n");
  const harness = renderWithFakeTty(h(DiffView, { unified }), {
    width: 24,
    height: 6,
  });
  t.after(() => harness.handle.stop());
  await settleRuntime();
  const text = screenText(harness.handle);
  assert.match(text, /-\s+old/);
  assert.match(text, /\+\s+new/);
});

test("LogStream tails the most recent entries within height", async (t) => {
  const entries = Array.from({ length: 12 }, (_, i) => ({
    id: i,
    level: i % 4 === 0 ? ("error" as const) : ("info" as const),
    message: `event ${i}`,
  }));
  const harness = renderWithFakeTty(h(LogStream, { entries, height: 4 }), { width: 30, height: 4 });
  t.after(() => harness.handle.stop());
  await settleRuntime();
  const text = screenText(harness.handle);
  // Tail: events 8..11 should be visible; 0..7 should not.
  assert.match(text, /event 11/);
  assert.match(text, /event 8/);
  assert.doesNotMatch(text, /event 0\b/);
});

test("LogStream filters by substring", async (t) => {
  const entries = [
    { id: 1, message: "build started" },
    { id: 2, message: "build failed: oops" },
    { id: 3, message: "deploy started" },
    { id: 4, message: "deploy succeeded" },
  ];
  const harness = renderWithFakeTty(h(LogStream, { entries, filter: "deploy", height: 3 }), {
    width: 30,
    height: 3,
  });
  t.after(() => harness.handle.stop());
  await settleRuntime();
  const text = screenText(harness.handle);
  assert.match(text, /deploy started/);
  assert.match(text, /deploy succeeded/);
  assert.doesNotMatch(text, /build started/);
  assert.doesNotMatch(text, /build failed/);
});

test("LogStream pause holds the current viewport at the head", async (t) => {
  const entries = Array.from({ length: 10 }, (_, i) => ({
    id: i,
    message: `line ${i}`,
  }));
  const harness = renderWithFakeTty(h(LogStream, { entries, height: 3, paused: true }), {
    width: 24,
    height: 3,
  });
  t.after(() => harness.handle.stop());
  await settleRuntime();
  const text = screenText(harness.handle);
  assert.match(text, /line 0/);
  assert.match(text, /line 2/);
  assert.doesNotMatch(text, /line 9/);
});
