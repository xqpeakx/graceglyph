import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";

import { ExplorerApp } from "../examples/explorer.js";
import { FormApp } from "../examples/form.js";
import { HelloApp } from "../examples/hello.js";
import { TodoApp } from "../examples/todo.js";
import { App, Button, Column, Text, TextInput, Window, h, useState } from "../src/index.js";
import {
  renderWithFakeTty,
  runtimeWarnings,
  screenText,
  settleRuntime,
  waitFor,
} from "./support/fake-tty.js";

test("onboarding and example smoke flows", async (t) => {
  await t.test('"useful in 10 minutes" app flow works through the public API', async () => {
    function QuickStartApp() {
      const [name, setName] = useState("");
      const [status, setStatus] = useState("draft");

      return h(
        App,
        {},
        h(
          Window,
          { title: "Quick start", grow: 1 },
          h(
            Column,
            { gap: 1, grow: 1 },
            h(Text, {}, "Type a name, then save."),
            h(TextInput, { value: name, onChange: setName, placeholder: "name" }),
            h(
              Button,
              { onClick: () => setStatus(name.trim() ? `saved ${name.trim()}` : "saved") },
              "Save",
            ),
            h(Text, {}, status),
          ),
        ),
      );
    }

    const harness = renderWithFakeTty(h(QuickStartApp, {}), {
      width: 40,
      height: 14,
      runtime: { devtools: false },
    });

    try {
      await waitFor(() => screenText(harness.handle).includes("Quick start"));
      assert.deepEqual(runtimeWarnings(harness.handle), []);
      harness.input.emitData("sam");
      await settleRuntime();
      harness.input.emitData("\t\r");
      await waitFor(() => screenText(harness.handle).includes("saved sam"));
      assert.deepEqual(runtimeWarnings(harness.handle), []);
    } finally {
      harness.handle.stop();
    }
  });

  await t.test("hello example opens its preview modal", async () => {
    const harness = renderWithFakeTty(h(HelloApp, {}), {
      width: 92,
      height: 28,
      runtime: { devtools: false },
    });

    try {
      await waitFor(() => screenText(harness.handle).includes("Hello graceglyph"));
      assert.match(screenText(harness.handle), /Templates/);
      assert.match(screenText(harness.handle), /Build a real draft fast/);
      assert.deepEqual(runtimeWarnings(harness.handle), []);

      harness.input.emitData("\t\t\t\t\t\r");
      await waitFor(() => screenText(harness.handle).includes("Preview"));
      assert.deepEqual(runtimeWarnings(harness.handle), []);
    } finally {
      harness.handle.stop();
    }
  });

  await t.test("form example accepts input and submits from the field", async () => {
    const harness = renderWithFakeTty(h(FormApp, {}), {
      width: 70,
      height: 24,
      runtime: { devtools: false },
    });

    try {
      await waitFor(() => screenText(harness.handle).includes("Signup form"));
      harness.input.emitData("owen\r");
      await waitFor(() => screenText(harness.handle).includes("hello owen (engineer)"));
      assert.deepEqual(runtimeWarnings(harness.handle), []);
    } finally {
      harness.handle.stop();
    }
  });

  await t.test("todo example opens the clear-done modal from the keyboard", async () => {
    const harness = renderWithFakeTty(h(TodoApp, {}), {
      width: 90,
      height: 28,
      runtime: { devtools: false },
    });

    try {
      await waitFor(() => screenText(harness.handle).includes("Todo"));
      harness.input.emitData("c");
      await waitFor(() => screenText(harness.handle).includes("Clear completed tasks?"));
      assert.match(screenText(harness.handle), /Cancel/);
      assert.match(screenText(harness.handle), /Clear/);
      assert.deepEqual(runtimeWarnings(harness.handle), []);
    } finally {
      harness.handle.stop();
    }
  });

  await t.test("explorer example loads a temp directory and previews a file", async () => {
    const originalCwd = process.cwd();
    const tempRoot = await mkdtemp(path.join(os.tmpdir(), "graceglyph-explorer-"));
    const filePath = path.join(tempRoot, "notes.txt");
    await writeFile(filePath, "hello from explorer\nsecond line\n", "utf8");
    process.chdir(tempRoot);

    const harness = renderWithFakeTty(h(ExplorerApp, {}), {
      width: 100,
      height: 28,
      runtime: { devtools: false },
    });

    try {
      await waitFor(() => screenText(harness.handle).includes("notes.txt"));
      harness.input.emitData("\x1b[B");
      await waitFor(() => screenText(harness.handle).includes("hello from explorer"));
      assert.deepEqual(runtimeWarnings(harness.handle), []);
    } finally {
      harness.handle.stop();
      process.chdir(originalCwd);
      await rm(tempRoot, { recursive: true, force: true });
    }
  });

  await t.test("examples stay structurally sound in common narrow terminals", async () => {
    const cases: Array<{
      name: string;
      element: ReturnType<typeof h>;
      width: number;
      height: number;
      expect: RegExp;
    }> = [
      { name: "hello", element: h(HelloApp, {}), width: 60, height: 20, expect: /Templates/ },
      { name: "form", element: h(FormApp, {}), width: 48, height: 18, expect: /Signup form/ },
      { name: "todo", element: h(TodoApp, {}), width: 60, height: 20, expect: /Todo/ },
      { name: "explorer", element: h(ExplorerApp, {}), width: 64, height: 20, expect: /Explorer/ },
    ];

    for (const testCase of cases) {
      const harness = renderWithFakeTty(testCase.element, {
        width: testCase.width,
        height: testCase.height,
        runtime: { devtools: false },
      });

      try {
        await waitFor(() => testCase.expect.test(screenText(harness.handle)));
        assert.deepEqual(
          runtimeWarnings(harness.handle),
          [],
          `${testCase.name} emitted structural warnings`,
        );
      } finally {
        harness.handle.stop();
      }
    }
  });
});
