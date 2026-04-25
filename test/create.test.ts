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

test("create-graceglyph scaffolds selected templates", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "graceglyph-create-"));
  const target = path.join(dir, "example");

  await execFileAsync(process.execPath, [
    "--loader",
    "ts-node/esm",
    "src/create.ts",
    "example",
    "--dir",
    target,
    "--template",
    "log-viewer",
  ], { cwd: repoRoot });

  const packageJson = JSON.parse(await fs.readFile(path.join(target, "package.json"), "utf8")) as {
    name: string;
    scripts: Record<string, string>;
  };
  const main = await fs.readFile(path.join(target, "src/main.tsx"), "utf8");
  const appTest = await fs.readFile(path.join(target, "test/app.test.ts"), "utf8");

  assert.equal(packageJson.name, "example");
  assert.equal(packageJson.scripts.dev, "node --loader ts-node/esm src/main.tsx");
  assert.match(main, /AppShell/);
  assert.match(main, /useInterval/);
  assert.match(appTest, /renderTestApp/);
});
