import test from "node:test";
import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import {
  ApiExplorerApp,
  createStaticApiClient,
  type ApiResponse,
} from "../examples/api-explorer.js";
import {
  DashboardShellApp,
  createMemoryShellStateStore,
} from "../examples/dashboard-shell.js";
import { ExplorerApp } from "../examples/explorer.js";
import {
  GitDashboardApp,
  createStaticGitSource,
  type GitSnapshot,
} from "../examples/git-dashboard.js";
import {
  LogViewerApp,
  createStaticLogSource,
  type LogEntry,
  type LogFile,
} from "../examples/log-viewer.js";
import { h } from "../src/index.js";
import {
  renderWithFakeTty,
  runtimeWarnings,
  screenText,
  settleRuntime,
  waitFor,
} from "./support/fake-tty.js";

const LOG_FILES: readonly LogFile[] = [
  { id: "api", label: "api.log" },
  { id: "worker", label: "worker.log" },
];

const LOG_ENTRIES: readonly LogEntry[] = [
  {
    id: "1",
    fileId: "api",
    fileLabel: "api.log",
    timestamp: Date.now(),
    level: "info",
    message: "server started on port 3000",
  },
  {
    id: "2",
    fileId: "worker",
    fileLabel: "worker.log",
    timestamp: Date.now(),
    level: "error",
    message: "job failed after retry budget",
  },
];

const GIT_SNAPSHOT: GitSnapshot = {
  repoPath: "/workspace/graceglyph",
  branch: "main",
  upstream: "origin/main",
  ahead: 1,
  behind: 0,
  clean: false,
  files: [
    {
      path: "src/index.ts",
      indexStatus: " ",
      worktreeStatus: "M",
      staged: false,
      unstaged: true,
      untracked: false,
    },
    {
      path: "examples/api-explorer.tsx",
      indexStatus: "A",
      worktreeStatus: " ",
      staged: true,
      unstaged: false,
      untracked: false,
    },
  ],
  commits: [
    { hash: "abc1234", subject: "add showcase examples", refs: "HEAD -> main" },
    { hash: "def5678", subject: "harden textarea editing" },
  ],
  diff: [
    "diff --git a/src/index.ts b/src/index.ts",
    "@@ -1,3 +1,4 @@",
    "+export { ApiExplorerApp } from './api';",
  ].join("\n"),
};

const API_RESPONSE: ApiResponse = {
  status: 201,
  statusText: "Created",
  ok: true,
  durationMs: 18,
  headers: {
    "content-type": "application/json",
    "x-request-id": "req_test",
  },
  contentType: "application/json",
  body: JSON.stringify({ ok: true, id: "demo" }),
};

test("log viewer renders streamed logs and filters search text", async () => {
  const harness = renderWithFakeTty(
    h(LogViewerApp, {
      files: LOG_FILES,
      source: createStaticLogSource(LOG_ENTRIES),
      pollMs: 60_000,
    }),
    {
      width: 112,
      height: 30,
      runtime: { devtools: false },
    },
  );

  try {
    await waitFor(() => screenText(harness.handle).includes("job failed after retry budget"));
    assert.deepEqual(runtimeWarnings(harness.handle), []);

    harness.input.emitData("error");
    await waitFor(() => {
      const text = screenText(harness.handle);
      return text.includes("job failed") && !text.includes("server started");
    });
    const text = screenText(harness.handle);
    assert.match(text, /job failed/);
    assert.doesNotMatch(text, /server started/);
  } finally {
    harness.handle.stop();
  }
});

test("git dashboard renders status, history, and staging action", async () => {
  const source = createStaticGitSource(GIT_SNAPSHOT);
  const harness = renderWithFakeTty(
    h(GitDashboardApp, { source }),
    {
      width: 118,
      height: 32,
      runtime: { devtools: false },
    },
  );

  try {
    await waitFor(() => screenText(harness.handle).includes("src/index.ts"));
    assert.match(screenText(harness.handle), /add showcase examples/);
    assert.deepEqual(runtimeWarnings(harness.handle), []);

    harness.input.emitData("s");
    await waitFor(() => screenText(harness.handle).includes("staged src/index.ts"));
  } finally {
    harness.handle.stop();
  }
});

test("api explorer sends through an injected client and pretty prints JSON", async () => {
  const harness = renderWithFakeTty(
    h(ApiExplorerApp, { client: createStaticApiClient(API_RESPONSE) }),
    {
      width: 122,
      height: 34,
      runtime: { devtools: false },
    },
  );

  try {
    await waitFor(() => screenText(harness.handle).includes("API explorer"));
    harness.input.emitData("\x1b[15~");
    await waitFor(() => screenText(harness.handle).includes("201 Created"));
    const text = screenText(harness.handle);
    assert.match(text, /"ok": true/);
    assert.deepEqual(runtimeWarnings(harness.handle), []);
  } finally {
    harness.handle.stop();
  }
});

test("dashboard shell restores state and records launches", async () => {
  const source = createStaticGitSource(GIT_SNAPSHOT);
  const store = createMemoryShellStateStore({
    selectedModuleId: "git-dashboard",
    themeId: "signal",
    launchCounts: { "git-dashboard": 2 },
  });
  const harness = renderWithFakeTty(
    h(DashboardShellApp, { store, examples: { git: { source } } }),
    {
      width: 110,
      height: 30,
      runtime: { devtools: false },
    },
  );

  try {
    await waitFor(() => screenText(harness.handle).includes("opened 2 times"));
    harness.input.emitData("?");
    await waitFor(() => screenText(harness.handle).includes("Open selected module"));
    harness.input.emitData("\x1b");
    await waitFor(() => !screenText(harness.handle).includes("Open selected module  o"));

    harness.input.emitData("o");
    await waitFor(() => screenText(harness.handle).includes("src/index.ts"));
    assert.equal(store.snapshot()?.launchCounts?.["git-dashboard"], 3);
    assert.deepEqual(runtimeWarnings(harness.handle), []);

    harness.input.emitData("?");
    await waitFor(() => screenText(harness.handle).includes("Stage selected file"));
    harness.input.emitData("\x1b");
    await waitFor(() => !screenText(harness.handle).includes("Stage selected file"));

    harness.input.emitData(mousePress(1, 0) + mouseRelease(1, 0));
    await waitFor(() => screenText(harness.handle).includes("opened 3 times"));
    assert.deepEqual(runtimeWarnings(harness.handle), []);
  } finally {
    harness.handle.stop();
  }
});

test("file manager renders preview and action controls", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "graceglyph-files-"));
  await fs.writeFile(path.join(dir, "sample.txt"), "hello from a preview\n", "utf8");

  const harness = renderWithFakeTty(
    h(ExplorerApp, { initialCwd: dir }),
    {
      width: 96,
      height: 28,
      runtime: { devtools: false },
    },
  );

  try {
    await waitFor(() => screenText(harness.handle).includes("sample.txt"));
    const text = screenText(harness.handle);
    assert.match(text, /Rename/);
    assert.match(text, /Copy/);
    assert.match(text, /Delete/);
    assert.deepEqual(runtimeWarnings(harness.handle), []);
  } finally {
    harness.handle.stop();
    await settleRuntime();
    await fs.rm(dir, { recursive: true, force: true });
  }
});

function mousePress(x: number, y: number): string {
  return `\x1b[<0;${x + 1};${y + 1}M`;
}

function mouseRelease(x: number, y: number): string {
  return `\x1b[<0;${x + 1};${y + 1}m`;
}
