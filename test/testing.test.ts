import test from "node:test";
import assert from "node:assert/strict";

import { Button, Row, Text, ansi, h, renderTestApp } from "../src/index.js";
import type { ScreenBuffer } from "../src/render/buffer.js";

test("renderTestApp snapshots frames and simulates keyboard/mouse flows", async () => {
  let clicks = 0;
  const app = renderTestApp(
    h(
      Row,
      { gap: 1 },
      h(
        Button,
        {
          disabled: true,
          onClick: () => {
            clicks += 10;
          },
        },
        "Disabled",
      ),
      h(
        Button,
        {
          onClick: () => {
            clicks += 1;
          },
        },
        "Run",
      ),
    ),
    { width: 32, height: 4, runtime: { devtools: false } },
  );

  try {
    await app.settle();
    assert.match(app.snapshot(), /Disabled/);
    assert.match(app.frame(), /Run/);
    app.assertNoLayoutWarnings();

    await app.press("enter");
    assert.equal(clicks, 1);

    await app.click(1, 0);
    assert.equal(clicks, 1);

    await app.click(13, 0);
    assert.equal(clicks, 2);
  } finally {
    app.stop();
  }
});

test("mouse hover applies hover styles to non-focused controls", async () => {
  const app = renderTestApp(h(Row, { gap: 1 }, h(Button, {}, "One"), h(Button, {}, "Two")), {
    width: 24,
    height: 4,
    runtime: { devtools: false },
  });

  try {
    await app.settle();
    await app.hover(9, 0);

    const front = (app.handle.runtime.renderer as unknown as { front: ScreenBuffer }).front;
    assert.deepEqual(front.get(9, 0)?.style.bg, ansi(6));
  } finally {
    app.stop();
  }
});

test("renderTestApp exposes layout warning assertions", async () => {
  const app = renderTestApp(
    h("box", { width: 10, height: 1, border: true, padding: 1 }, h(Text, {}, "will collapse")),
    { width: 10, height: 1, runtime: { devtools: false } },
  );

  try {
    await app.settle();
    assert.ok(app.warnings().length > 0);
    assert.throws(() => app.assertNoLayoutWarnings(), /layout warnings/);
  } finally {
    app.stop();
  }
});
