import test from "node:test";
import assert from "node:assert/strict";

import {
  AppShell,
  CommandPalette,
  Route,
  Router,
  h,
  registerCommand,
  useCommand,
  useState,
} from "../src/index.js";
import {
  renderWithFakeTty,
  runtimeWarnings,
  screenText,
  settleRuntime,
  waitFor,
} from "./support/fake-tty.js";

test("router selects a route by path and falls back cleanly", async () => {
  const harness = renderWithFakeTty(
    h(
      Router,
      { path: "/logs", fallback: h("text", {}, "missing") },
      h(Route, { path: "/", title: "Home" }, h("text", {}, "home")),
      h(Route, { path: "/logs", title: "Logs" }, h("text", {}, "logs")),
    ),
    {
      width: 40,
      height: 6,
      runtime: { devtools: false },
    },
  );

  try {
    await waitFor(() => screenText(harness.handle).includes("logs"));
    assert.doesNotMatch(screenText(harness.handle), /home/);
    assert.deepEqual(runtimeWarnings(harness.handle), []);
  } finally {
    harness.handle.stop();
  }
});

test("command palette exposes registered commands and runs them by keyboard", async () => {
  let runs = 0;
  const cleanup = registerCommand({
    id: "test.run",
    title: "Run test command",
    group: "Test",
    keys: ["ctrl+r"],
    run: () => {
      runs += 1;
    },
  });

  const harness = renderWithFakeTty(h(CommandPalette, { open: true, onClose: () => {} }), {
    width: 80,
    height: 20,
    runtime: { devtools: false },
  });

  try {
    await waitFor(() => screenText(harness.handle).includes("Run test command"));
    harness.input.emitData("\r");
    await settleRuntime();
    assert.equal(runs, 1);
    assert.deepEqual(runtimeWarnings(harness.handle), []);
  } finally {
    harness.handle.stop();
    cleanup();
  }
});

test("app shell handles command hotkeys and escape breadcrumb navigation", async () => {
  function ShellHarness() {
    const [path, setPath] = useState("/details");
    const [status, setStatus] = useState("idle");
    useCommand(
      {
        id: "test.save",
        title: "Save",
        group: "Test",
        keys: ["s"],
        run: () => setStatus("saved"),
      },
      [setStatus],
    );

    return h(
      AppShell,
      {
        title: "Shell",
        path,
        onNavigate: setPath,
        breadcrumbs: [
          { label: "Home", path: "/" },
          { label: "Details", path: "/details" },
        ],
      },
      h("text", {}, `${path} ${status}`),
    );
  }

  const harness = renderWithFakeTty(h(ShellHarness, {}), {
    width: 80,
    height: 24,
    runtime: { devtools: false },
  });

  try {
    await waitFor(() => screenText(harness.handle).includes("/details idle"));
    harness.input.emitData("s");
    await waitFor(() => screenText(harness.handle).includes("/details saved"));

    harness.input.emitData("\x1b");
    await waitFor(() => screenText(harness.handle).includes("/ saved"));
    assert.deepEqual(runtimeWarnings(harness.handle), []);
  } finally {
    harness.handle.stop();
  }
});
