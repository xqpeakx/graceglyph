import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(process.cwd());
const PACKAGE_JSON = resolve(ROOT, "packages/graceglyph-markdown/package.json");
const SOURCE_FILE = resolve(ROOT, "packages/graceglyph-markdown/src/index.ts");

test("first external markdown plugin package is present with scoped id", () => {
  const pkg = JSON.parse(readFileSync(PACKAGE_JSON, "utf8")) as {
    name?: string;
    peerDependencies?: Record<string, string>;
  };
  assert.equal(pkg.name, "@graceglyph/markdown");
  assert.equal(typeof pkg.peerDependencies?.graceglyph, "string");
});

test("external markdown plugin source defines stable plugin id", () => {
  const source = readFileSync(SOURCE_FILE, "utf8");
  assert.match(source, /id:\s*"@graceglyph\/markdown"/);
  assert.match(source, /export function createMarkdownPlugin/);
  assert.match(source, /MarkdownDocument/);
  assert.match(source, /MarkdownCard/);
});
