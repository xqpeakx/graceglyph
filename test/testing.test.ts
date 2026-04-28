import test from "node:test";
import assert from "node:assert/strict";

import {
  Button,
  Row,
  Text,
  TextInput,
  ansi,
  h,
  renderComponent,
  renderTestApp,
  useEffect,
  useDebouncedValue,
  useInterval,
  useState,
  waitFor,
} from "../src/index.js";
import type { Capabilities } from "../src/index.js";
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
    assert.match(app.snapshotAnsi(), /\x1b\[/);
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

test("renderTestApp exposes role and label queries", async () => {
  function QueryHarness() {
    const [value, setValue] = useState("");
    return h(
      Row,
      { gap: 1 },
      h(Button, {}, "Run"),
      h(TextInput, {
        value,
        onChange: setValue,
        accessibilityLabel: "Search",
      }),
    );
  }

  const app = renderTestApp(h(QueryHarness, {}), {
    width: 48,
    height: 4,
    runtime: { devtools: false },
  });

  try {
    await app.settle();
    const button = app.getByRole("button", { name: /Run/i });
    assert.equal(button.role, "button");
    assert.ok(button.width > 0);

    const input = app.getByLabel("Search");
    assert.equal(input.role, "textbox");

    const boxes = app.queryAllByRole("generic");
    assert.ok(boxes.length > 0);
  } finally {
    app.stop();
  }
});

test("renderComponent mounts a standalone component fixture", async () => {
  const app = renderComponent(h(Button, {}, "Standalone"), {
    width: 24,
    height: 3,
    runtime: { devtools: false },
  });

  try {
    await app.settle();
    assert.match(app.snapshot(), /Standalone/);
    app.getByRole("button", { name: "Standalone" });
  } finally {
    app.stop();
  }
});

test("renderTestApp fake timers drive interval and debounce hooks", async () => {
  function TimerHarness() {
    const [value, setValue] = useState("");
    const debounced = useDebouncedValue(value, 100);
    const [ticks, setTicks] = useState(0);
    useInterval(() => setTicks((current) => current + 1), 50);

    return h(
      Row,
      { gap: 1 },
      h(TextInput, { value, onChange: setValue, accessibilityLabel: "Value" }),
      h(Text, {}, `${debounced}|${ticks}`),
    );
  }

  const app = renderTestApp(h(TimerHarness, {}), {
    width: 48,
    height: 4,
    runtime: { devtools: false },
  });

  try {
    app.useFakeTimers();
    await app.settle();
    await app.type("abc");
    assert.match(app.snapshot(), /\|0/);

    await app.advanceTimersByTime(50);
    assert.match(app.snapshot(), /\|1/);
    assert.doesNotMatch(app.snapshot(), /abc\|/);

    await app.advanceTimersByTime(50);
    assert.match(app.snapshot(), /abc\|2/);
  } finally {
    app.stop();
  }
});

test("renderTestApp runAllTimers drains chained timeouts", async () => {
  function TimeoutHarness() {
    const [status, setStatus] = useState("idle");
    useEffect(() => {
      const first = setTimeout(() => {
        setTimeout(() => setStatus("done"), 10);
      }, 5);
      return () => clearTimeout(first);
    }, []);
    return h(Text, {}, status);
  }

  const app = renderTestApp(h(TimeoutHarness, {}), {
    width: 24,
    height: 3,
    runtime: { devtools: false },
  });

  try {
    app.useFakeTimers();
    await app.settle();
    assert.match(app.snapshot(), /idle/);
    await app.runAllTimers({ maxRuns: 20 });
    assert.match(app.snapshot(), /done/);
  } finally {
    app.stop();
  }
});

test("renderTestApp findBy* and waitFor handle async updates without manual act", async () => {
  function AsyncHarness() {
    const [status, setStatus] = useState("idle");
    const [showButton, setShowButton] = useState(false);
    useEffect(() => {
      const timer = setTimeout(() => {
        setStatus("Saved");
        setShowButton(true);
      }, 80);
      return () => clearTimeout(timer);
    }, []);
    return h(
      Row,
      { gap: 1 },
      h(Text, {}, status),
      showButton ? h(Button, {}, "Done") : null,
    );
  }

  const app = renderTestApp(h(AsyncHarness, {}), {
    width: 40,
    height: 4,
    runtime: { devtools: false },
  });

  try {
    app.useFakeTimers();
    const text = await app.findByText("Saved", { timeoutMs: 200, intervalMs: 20 });
    assert.equal(text.role, "generic");

    const button = await app.findByRole("button", { name: "Done", timeoutMs: 200, intervalMs: 20 });
    assert.equal(button.role, "button");

    const seen = await app.waitFor(() => app.queryByText("Saved"), {
      timeoutMs: 200,
      intervalMs: 20,
    });
    assert.ok(seen);
  } finally {
    app.stop();
  }
});

test("top-level waitFor retries assertions until they pass", async () => {
  let ready = false;
  setTimeout(() => {
    ready = true;
  }, 15);
  await waitFor(() => {
    assert.equal(ready, true);
  }, { timeoutMs: 200, intervalMs: 5, settleTurns: 1 });
});

test("renderTestApp supports explicit capability simulation profiles", async () => {
  const app = renderTestApp(h(Text, {}, "cap"), {
    width: 16,
    height: 2,
    cap: "dumb",
    runtime: { devtools: false },
  });

  try {
    await app.settle();
    const caps = (app.handle.runtime.terminal.capabilities as Capabilities);
    assert.equal(caps.color, "monochrome");
    assert.equal(caps.isTTY, false);
  } finally {
    app.stop();
  }
});

test("user-event helpers support click, type, keyboard, hover, and drag/drop", async () => {
  let clicks = 0;
  const mouseEvents: string[] = [];
  function UserHarness() {
    const [value, setValue] = useState("");
    const [status, setStatus] = useState("idle");
    return h(
      Row,
      { gap: 1 },
      h(Button, { onClick: () => (clicks += 1) }, "Run"),
      h(TextInput, { value, onChange: setValue, accessibilityLabel: "Search" }),
      h(
        "box",
        {
          accessibilityLabel: "Drop zone",
          border: true,
          onMouse: (ev: { action: string }) => {
            mouseEvents.push(ev.action);
            if (ev.action === "release") setStatus("dropped");
          },
        },
        h(Text, {}, status),
      ),
      h(
        "box",
        {
          accessibilityLabel: "Drag source",
          border: true,
          onMouse: () => {},
        },
        h(Text, {}, "Drag me"),
      ),
    );
  }

  const app = renderTestApp(h(UserHarness, {}), {
    width: 72,
    height: 6,
    runtime: { devtools: false },
  });

  try {
    await app.settle();
    await app.user.click(app.getByRole("button", { name: "Run" }));
    assert.equal(clicks, 1);

    await app.user.type(app.getByLabel("Search"), "ok");
    assert.match(app.snapshot(), /ok/);

    await app.user.keyboard("{tab}{enter}");
    assert.equal(clicks, 2);

    await app.user.hover(app.getByLabel("Drop zone"));
    await app.user.drag(app.getByLabel("Drag source")).drop(app.getByLabel("Drop zone"));
    assert.match(app.snapshot(), /dropped/);
    assert.ok(mouseEvents.includes("move"));
  } finally {
    app.stop();
  }
});
