import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promises as fs } from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

const execFileAsync = promisify(execFile);
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

async function scaffold(
  template: string,
  extraArgs: readonly string[] = [],
): Promise<{ target: string; main: string; pkg: { name: string; scripts: Record<string, string> } }> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "graceglyph-create-"));
  const target = path.join(dir, "example");
  await execFileAsync(
    process.execPath,
    [
      "--loader",
      "ts-node/esm",
      "src/create.ts",
      "example",
      "--dir",
      target,
      "--template",
      template,
      ...extraArgs,
    ],
    { cwd: repoRoot },
  );
  const main = await fs.readFile(path.join(target, "src/main.tsx"), "utf8");
  const pkg = JSON.parse(await fs.readFile(path.join(target, "package.json"), "utf8")) as {
    name: string;
    scripts: Record<string, string>;
  };
  return { target, main, pkg };
}

test("create-graceglyph scaffolds the log-viewer template with smoke test", async () => {
  const { target, main, pkg } = await scaffold("log-viewer");
  const appTest = await fs.readFile(path.join(target, "test/app.test.ts"), "utf8");
  assert.equal(pkg.name, "example");
  assert.equal(pkg.scripts.dev, "node --loader ts-node/esm src/main.tsx");
  assert.match(main, /AppShell/);
  assert.match(main, /useInterval/);
  assert.match(appTest, /renderTestApp/);
});

test("create-graceglyph scaffolds the chat template with streaming setup", async () => {
  const { main } = await scaffold("chat");
  assert.match(main, /Stream/);
  assert.match(main, /tokenize/);
  assert.match(main, /role: "assistant"/);
});

test("create-graceglyph scaffolds the editor template with file list", async () => {
  const { main } = await scaffold("editor");
  assert.match(main, /TextArea/);
  assert.match(main, /FileEntry/);
  assert.match(main, /README\.md/);
});

test("create-graceglyph wires the --theme flag into bootstrap", async () => {
  const { main } = await scaffold("dashboard", ["--theme", "tarnished"]);
  assert.match(main, /builtInThemes\["tarnished"\]/);
  assert.match(main, /setTheme/);
});

test("create-graceglyph rejects unknown templates and themes", async () => {
  await assert.rejects(
    execFileAsync(
      process.execPath,
      ["--loader", "ts-node/esm", "src/create.ts", "ex", "--template", "nope"],
      { cwd: repoRoot },
    ),
    /unknown template/,
  );
  await assert.rejects(
    execFileAsync(
      process.execPath,
      ["--loader", "ts-node/esm", "src/create.ts", "ex", "--theme", "neon-future"],
      { cwd: repoRoot },
    ),
    /unknown theme/,
  );
});
