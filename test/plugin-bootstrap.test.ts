import test from "node:test";
import assert from "node:assert/strict";
import { resolve } from "node:path";

import { h, renderWithPlugins, type GraceglyphPlugin } from "../src/index.js";
import { TestInput, TestOutput } from "../src/testing.js";

test("renderWithPlugins loads config plugins and disposes on stop", async () => {
  let setupCalls = 0;
  let cleanupCalls = 0;
  const inline: GraceglyphPlugin = {
    id: "inline.bootstrap",
    setup: () => {
      setupCalls += 1;
      return () => {
        cleanupCalls += 1;
      };
    },
  };

  const handle = await renderWithPlugins(h("text", {}, "hello"), {
    plugins: [inline],
    input: new TestInput() as never,
    output: new TestOutput(20, 4) as never,
    useAltScreen: false,
    mouse: false,
  });
  assert.ok(handle.registry.list().some((plugin) => plugin.id === "inline.bootstrap"));
  assert.equal(setupCalls, 1);
  handle.stop();
  assert.equal(cleanupCalls, 1);
});

test("renderWithPlugins supports CLI plugin args via argv", async () => {
  const fixturePath = resolve("test/fixtures/plugin-loader-fixture.ts");
  const handle = await renderWithPlugins(h("text", {}, "argv"), {
    argv: ["node", "app.js", "--plugin", fixturePath],
    input: new TestInput() as never,
    output: new TestOutput(20, 4) as never,
    useAltScreen: false,
    mouse: false,
  });
  assert.ok(handle.registry.list().some((plugin) => plugin.id === "fixture.factory"));
  handle.stop();
});

test("renderWithPlugins disposePlugins is idempotent", async () => {
  let cleanupCalls = 0;
  const inline: GraceglyphPlugin = {
    id: "inline.idempotent",
    setup: () => () => {
      cleanupCalls += 1;
    },
  };
  const handle = await renderWithPlugins(h("text", {}, "idempotent"), {
    plugins: [inline],
    input: new TestInput() as never,
    output: new TestOutput(20, 4) as never,
    useAltScreen: false,
    mouse: false,
  });

  handle.disposePlugins();
  handle.disposePlugins();
  handle.stop();
  assert.equal(cleanupCalls, 1);
});
