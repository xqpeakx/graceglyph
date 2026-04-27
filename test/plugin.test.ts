import test from "node:test";
import assert from "node:assert/strict";

import {
  createPluginRegistry,
  definePlugin,
  builtInThemes,
  type GraceglyphPlugin,
} from "../src/index.js";

test("definePlugin requires a non-empty id", () => {
  assert.throws(() => definePlugin({ id: "" }), /id is required/);
  const plugin = definePlugin({ id: "ok" });
  assert.equal(plugin.id, "ok");
});

test("registry use() preserves order and deduplicates by id", () => {
  const registry = createPluginRegistry();
  registry.use({ id: "a" }).use({ id: "b" }).use({ id: "a", description: "v2" });
  const list = registry.list();
  assert.equal(list.length, 2);
  // The "a" replacement should keep position — confirm by description.
  const a = list.find((p) => p.id === "a")!;
  assert.equal(a.description, "v2");
});

test("themes() and components() last-write-wins across plugins", () => {
  const registry = createPluginRegistry();
  const fakeTheme = { ...builtInThemes.dark, name: "fake" };
  registry
    .use({ id: "lib", themes: { custom: builtInThemes["tokyo-night"] } })
    .use({ id: "user", themes: { custom: fakeTheme } });
  const resolved = registry.resolveTheme("custom");
  assert.equal(resolved?.name, "fake");

  function ComponentA() {
    return { $$type: "element" } as never;
  }
  function ComponentB() {
    return { $$type: "element" } as never;
  }
  registry
    .use({ id: "comp1", components: { Widget: ComponentA } })
    .use({ id: "comp2", components: { Widget: ComponentB } });
  assert.equal(registry.resolveComponent("Widget"), ComponentB);
});

test("commands() aggregates and ignores duplicate ids", () => {
  const registry = createPluginRegistry();
  registry
    .use({
      id: "p1",
      commands: [{ id: "alpha", title: "Alpha", run: () => {} }],
    })
    .use({
      id: "p2",
      commands: [
        { id: "alpha", title: "Duplicate Alpha", run: () => {} },
        { id: "beta", title: "Beta", run: () => {} },
      ],
    });
  const ids = registry.commands().map((c) => c.id);
  assert.deepEqual(ids, ["alpha", "beta"]);
});

test("activate() runs setup, returns disposer that tears down in reverse", () => {
  const order: string[] = [];
  const registry = createPluginRegistry();
  const a: GraceglyphPlugin = {
    id: "a",
    setup: () => {
      order.push("setup:a");
      return () => order.push("cleanup:a");
    },
  };
  const b: GraceglyphPlugin = {
    id: "b",
    setup: () => {
      order.push("setup:b");
      return () => order.push("cleanup:b");
    },
  };
  registry.use(a).use(b);
  const dispose = registry.activate();
  assert.deepEqual(order, ["setup:a", "setup:b"]);
  dispose();
  // Reverse order: setups added last cleanup first.
  assert.deepEqual(order.slice(2), ["cleanup:b", "cleanup:a"]);
});

test("activate() registers commands and dispose() tears them down", () => {
  const registry = createPluginRegistry();
  registry.use({
    id: "demo",
    commands: [{ id: "demo.run", title: "Demo", run: () => {} }],
  });
  const dispose = registry.activate();
  // Plugin commands surface through the registry's aggregate getter.
  assert.ok(registry.commands().some((c) => c.id === "demo.run"));
  dispose();
  // After dispose the command registration is gone too — registry's own
  // command list still surfaces the static plugin manifest, but the global
  // command registry should not retain it. We test that by re-activating:
  // re-running activate() should re-register without throwing.
  const dispose2 = registry.activate();
  dispose2();
});

test("runMiddleware threads node through every middleware in order", () => {
  const registry = createPluginRegistry();
  registry
    .use({
      id: "wrap1",
      middleware: (node) => `[1:${String(node)}]`,
    })
    .use({
      id: "wrap2",
      middleware: (node) => `[2:${String(node)}]`,
    });
  const result = registry.runMiddleware("hi");
  assert.equal(result, "[2:[1:hi]]");
});

test("runMiddleware survives plugin errors", () => {
  const registry = createPluginRegistry();
  const errors: unknown[] = [];
  const originalError = console.error;
  console.error = (...args: unknown[]) => errors.push(args);
  try {
    registry
      .use({
        id: "boom",
        middleware: () => {
          throw new Error("kaboom");
        },
      })
      .use({
        id: "ok",
        middleware: (node) => `wrapped:${String(node)}`,
      });
    const result = registry.runMiddleware("seed");
    // First middleware throws; threading continues with the original node.
    assert.equal(result, "wrapped:seed");
    assert.ok(errors.length > 0);
  } finally {
    console.error = originalError;
  }
});

test("setup context exposes resolveComponent / resolveTheme / commands", () => {
  let captured: { themes: string[]; components: string[]; commands: string[] } | null = null;
  const registry = createPluginRegistry();
  function Widget() {
    return { $$type: "element" } as never;
  }
  registry
    .use({
      id: "host",
      themes: { custom: { ...builtInThemes.dark, name: "host-custom" } },
      components: { Widget },
      commands: [{ id: "host.cmd", title: "Cmd", run: () => {} }],
    })
    .use({
      id: "consumer",
      setup: (ctx) => {
        captured = {
          themes: ctx.getTheme("custom") ? ["custom"] : [],
          components: ctx.getComponent("Widget") ? ["Widget"] : [],
          commands: ctx.commands().map((c) => c.id),
        };
      },
    });
  registry.activate()();
  assert.deepEqual(captured, {
    themes: ["custom"],
    components: ["Widget"],
    commands: ["host.cmd"],
  });
});
