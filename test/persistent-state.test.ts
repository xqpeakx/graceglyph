import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { createFiber } from "../src/runtime/fiber.js";
import { withFiber } from "../src/runtime/hooks.js";
import { usePersistentState } from "../src/index.js";

test("usePersistentState reads values from a filesystem state file", () => {
  const dir = mkdtempSync(join(tmpdir(), "graceglyph-state-"));
  const file = join(dir, "state.json");
  writeFileSync(file, JSON.stringify({ counter: "2" }), "utf8");

  const prev = process.env.GRACEGLYPH_STATE_FILE;
  process.env.GRACEGLYPH_STATE_FILE = file;
  try {
    const fiber = createFiber(() => null, {}, null, null);
    let value = -1;
    withFiber(fiber, () => {
      [value] = usePersistentState<number>("counter", 0);
    });
    assert.equal(value, 2);
  } finally {
    if (prev === undefined) delete process.env.GRACEGLYPH_STATE_FILE;
    else process.env.GRACEGLYPH_STATE_FILE = prev;
  }
});

test("usePersistentState writes updated values to the filesystem state file", () => {
  const dir = mkdtempSync(join(tmpdir(), "graceglyph-state-"));
  const file = join(dir, "state.json");

  const prev = process.env.GRACEGLYPH_STATE_FILE;
  process.env.GRACEGLYPH_STATE_FILE = file;
  try {
    const fiber = createFiber(() => null, {}, null, null);
    let setValue!: (next: number) => void;
    withFiber(fiber, () => {
      [, setValue] = usePersistentState<number>("counter", 0);
    });

    setValue(7);

    const raw = readFileSync(file, "utf8");
    assert.deepEqual(JSON.parse(raw), { counter: "7" });
  } finally {
    if (prev === undefined) delete process.env.GRACEGLYPH_STATE_FILE;
    else process.env.GRACEGLYPH_STATE_FILE = prev;
  }
});
