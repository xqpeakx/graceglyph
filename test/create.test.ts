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
  const main = await readIfExists(path.join(target, "src/main.tsx"));
  const pkg = JSON.parse(await fs.readFile(path.join(target, "package.json"), "utf8")) as {
    name: string;
    scripts: Record<string, string>;
  };
  return { target, main, pkg };
}

async function readIfExists(file: string): Promise<string> {
  try {
    return await fs.readFile(file, "utf8");
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code?: string }).code === "ENOENT"
    ) {
      return "";
    }
    throw error;
  }
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

test("create-graceglyph scaffolds the plugin template", async () => {
  const { target, pkg } = await scaffold("plugin");
  const index = await fs.readFile(path.join(target, "src/index.ts"), "utf8");
  assert.match(pkg.name, /^@graceglyph\//);
  assert.match(index, /definePlugin/);
  assert.match(index, /createPlugin/);
});

test("create-graceglyph scaffolds the component template", async () => {
  const { target, pkg } = await scaffold("component");
  const index = await fs.readFile(path.join(target, "src/index.tsx"), "utf8");
  const componentTest = await fs.readFile(path.join(target, "test/component.test.ts"), "utf8");
  assert.match(pkg.name, /^@graceglyph\//);
  assert.equal(pkg.scripts.build, "tsc -p tsconfig.json");
  assert.match(index, /export function StatTile/);
  assert.match(componentTest, /renderComponent/);
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

test("create-graceglyph-component defaults to component template", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "graceglyph-create-component-"));
  const target = path.join(dir, "kit");
  await execFileAsync(
    process.execPath,
    ["--loader", "ts-node/esm", "src/create-component.ts", "kit", "--dir", target],
    { cwd: repoRoot },
  );
  const pkg = JSON.parse(await fs.readFile(path.join(target, "package.json"), "utf8")) as {
    name: string;
  };
  const entry = await fs.readFile(path.join(target, "src/index.tsx"), "utf8");
  assert.match(pkg.name, /^@graceglyph\//);
  assert.match(entry, /StatTile/);
});
