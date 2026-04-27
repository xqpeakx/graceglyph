import test from "node:test";
import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import {
  formatBytes,
  isProbablyText,
  listDirectory,
  parseArgs as parseFilesArgs,
} from "../apps/gg-files/index.js";
import { parsePorcelain, parseArgs as parseGitArgs } from "../apps/gg-git/index.js";
import { echoModel, parseArgs as parseChatArgs } from "../apps/gg-chat/index.js";

// -- gg-files ---------------------------------------------------------------

test("gg-files formatBytes scales the unit by magnitude", () => {
  assert.equal(formatBytes(0), "0 B");
  assert.equal(formatBytes(800), "800 B");
  assert.equal(formatBytes(2_500), "2.5 KB");
  assert.equal(formatBytes(1_500_000), "1.5 MB");
  assert.equal(formatBytes(1_500_000_000), "1.50 GB");
});

test("gg-files isProbablyText rejects buffers with NUL bytes", () => {
  assert.equal(isProbablyText(Buffer.from("hello world\n")), true);
  assert.equal(isProbablyText(Buffer.from([0x00, 0x01, 0x02, 0x03])), false);
});

test("gg-files listDirectory sorts directories first and respects --all", async () => {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "gg-files-"));
  try {
    await fs.mkdir(path.join(tmp, "alpha"));
    await fs.writeFile(path.join(tmp, "beta.txt"), "hi");
    await fs.writeFile(path.join(tmp, ".hidden"), "x");
    const visible = await listDirectory(tmp, false);
    assert.deepEqual(
      visible.map((e) => e.name),
      ["alpha", "beta.txt"],
    );
    const all = await listDirectory(tmp, true);
    assert.ok(all.some((e) => e.name === ".hidden"));
  } finally {
    await fs.rm(tmp, { recursive: true, force: true });
  }
});

test("gg-files parseArgs accepts a path and --all", () => {
  const args = parseFilesArgs(["/var/log", "--all", "--theme", "tarnished"]);
  assert.equal(args.cwd, path.resolve("/var/log"));
  assert.equal(args.showHidden, true);
  assert.equal(args.theme, "tarnished");
});

// -- gg-git -----------------------------------------------------------------

test("gg-git parsePorcelain extracts index/worktree/path", () => {
  const stdout = [" M src/foo.ts", "?? new.txt", "M  staged.ts"].join("\n");
  const entries = parsePorcelain(stdout);
  assert.equal(entries.length, 3);
  assert.deepEqual(entries[0], { index: " ", worktree: "M", path: "src/foo.ts" });
  assert.deepEqual(entries[1], { index: "?", worktree: "?", path: "new.txt" });
  assert.deepEqual(entries[2], { index: "M", worktree: " ", path: "staged.ts" });
});

test("gg-git parsePorcelain ignores blank lines and short rows", () => {
  const entries = parsePorcelain("\n   \nMM\nMM ok.ts");
  assert.equal(entries.length, 1);
  assert.equal(entries[0]!.path, "ok.ts");
});

test("gg-git parseArgs handles --theme and a path arg", () => {
  const args = parseGitArgs(["--theme", "nord", "/repo"]);
  assert.equal(args.theme, "nord");
  assert.equal(args.cwd, "/repo");
});

// -- gg-chat ----------------------------------------------------------------

test("gg-chat echoModel streams non-empty tokens", async () => {
  const model = echoModel({ delayMs: 0 });
  const tokens: string[] = [];
  for await (const tok of model.stream([
    { id: 1, role: "user", content: "hello" },
  ])) {
    tokens.push(tok);
  }
  assert.ok(tokens.length > 0);
  const reply = tokens.join("");
  assert.match(reply, /you said: hello/);
});

test("gg-chat parseArgs accepts --delay and --theme", () => {
  const args = parseChatArgs(["--delay", "100", "--theme", "dracula"]);
  assert.equal(args.intervalMs, 100);
  assert.equal(args.theme, "dracula");
});

test("gg-chat parseArgs rejects negative --delay", () => {
  assert.throws(() => parseChatArgs(["--delay", "-1"]), /non-negative/);
});
