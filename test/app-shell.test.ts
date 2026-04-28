import test from "node:test";
import assert from "node:assert/strict";

import {
  AppShell,
  canNavigateRoute,
  CommandPalette,
  Route,
  resolveDeepLinkPath,
  resolveDeepLinkPathFromArgv,
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

test("router composes nested routes with parent shells", async () => {
  const harness = renderWithFakeTty(
    h(
      Router,
      { path: "/settings/profile", fallback: h("text", {}, "missing") },
      h(
        Route,
        { path: "/settings", title: "Settings" },
        h("text", {}, "settings shell"),
        h(Route, { path: "profile", title: "Profile" }, h("text", {}, "profile pane")),
      ),
    ),
    {
      width: 50,
      height: 8,
      runtime: { devtools: false },
    },
  );

  try {
    await waitFor(() => screenText(harness.handle).includes("profile pane"));
    const text = screenText(harness.handle);
    assert.match(text, /settings shell/);
    assert.doesNotMatch(text, /missing/);
    assert.deepEqual(runtimeWarnings(harness.handle), []);
  } finally {
    harness.handle.stop();
  }
});

test("router matches pathnames with query/hash suffixes", async () => {
  const harness = renderWithFakeTty(
    h(
      Router,
      { path: "/logs?tab=errors#tail", fallback: h("text", {}, "missing") },
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
    assert.doesNotMatch(screenText(harness.handle), /missing/);
    assert.deepEqual(runtimeWarnings(harness.handle), []);
  } finally {
    harness.handle.stop();
  }
});

test("canNavigateRoute blocks leaving route when canLeave is false", () => {
  const routes = h(
    Route,
    { path: "/settings", canLeave: false },
    h(Route, { path: "profile" }, h("text", {}, "profile")),
  );
  assert.equal(canNavigateRoute("/settings/profile", "/", routes), false);
});

test("deep-link helpers normalize argv and query/hash paths", () => {
  assert.equal(resolveDeepLinkPath("/apps/logs?pane=tail#row-4"), "/apps/logs");
  assert.equal(resolveDeepLinkPathFromArgv(["node", "app", "--theme", "dark", "/logs?x=1"]), "/logs");
  assert.equal(resolveDeepLinkPathFromArgv(["node", "app"], "/"), "/");
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

test("command palette filters registered commands by scope", async () => {
  const cleanupApp = registerCommand(
    {
      id: "app.sync",
      title: "Sync workspace",
      group: "App",
      run: () => undefined,
    },
    { scope: "workspace" },
  );
  const cleanupAdmin = registerCommand(
    {
      id: "admin.rotate",
      title: "Rotate keys",
      group: "Admin",
      run: () => undefined,
    },
    { scope: "admin" },
  );

  const harness = renderWithFakeTty(
    h(CommandPalette, { open: true, onClose: () => {}, scope: "workspace" }),
    {
      width: 80,
      height: 20,
      runtime: { devtools: false },
    },
  );

  try {
    await waitFor(() => screenText(harness.handle).includes("Sync workspace"));
    assert.doesNotMatch(screenText(harness.handle), /Rotate keys/);
    assert.deepEqual(runtimeWarnings(harness.handle), []);
  } finally {
    harness.handle.stop();
    cleanupApp();
    cleanupAdmin();
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

test("app shell respects navigation guards before breadcrumb back", async () => {
  function ShellHarness() {
    const [path, setPath] = useState("/details");
    return h(
      AppShell,
      {
        title: "Shell",
        path,
        onNavigate: setPath,
        canNavigate: () => false,
        breadcrumbs: [
          { label: "Home", path: "/" },
          { label: "Details", path: "/details" },
        ],
      },
      h("text", {}, path),
    );
  }

  const harness = renderWithFakeTty(h(ShellHarness, {}), {
    width: 80,
    height: 24,
    runtime: { devtools: false },
  });

  try {
    await waitFor(() => screenText(harness.handle).includes("/details"));
    harness.input.emitData("\x1b");
    await settleRuntime();
    assert.match(screenText(harness.handle), /\/details/);
    assert.deepEqual(runtimeWarnings(harness.handle), []);
  } finally {
    harness.handle.stop();
  }
});

test("app shell handles chord command hotkeys", async () => {
  function ShellHarness() {
    const [status, setStatus] = useState("idle");
    return h(
      AppShell,
      {
        title: "Shell",
        path: "/",
        onNavigate: () => undefined,
        commands: [
          {
            id: "nav.home",
            title: "Go home",
            group: "Navigation",
            keys: ["g g"],
            run: () => setStatus("home"),
          },
        ],
      },
      h("text", {}, status),
    );
  }

  const harness = renderWithFakeTty(h(ShellHarness, {}), {
    width: 80,
    height: 20,
    runtime: { devtools: false },
  });

  try {
    await waitFor(() => screenText(harness.handle).includes("idle"));
    harness.input.emitData("g");
    await settleRuntime();
    assert.match(screenText(harness.handle), /idle/);
    harness.input.emitData("g");
    await waitFor(() => screenText(harness.handle).includes("home"));
    assert.deepEqual(runtimeWarnings(harness.handle), []);
  } finally {
    harness.handle.stop();
  }
});
