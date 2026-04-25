import test from "node:test";
import assert from "node:assert/strict";

import {
  detectCapabilities,
  DUMB_CAPABILITIES,
  FULL_CAPABILITIES,
} from "../src/render/capabilities.js";

const ttyOutput = { isTTY: true } as unknown as NodeJS.WriteStream;
const nonTtyOutput = { isTTY: false } as unknown as NodeJS.WriteStream;

test("non-TTY output downgrades to monochrome regardless of TERM", () => {
  const caps = detectCapabilities({
    output: nonTtyOutput,
    env: { TERM: "xterm-256color", COLORTERM: "truecolor" },
  });
  assert.equal(caps.color, "monochrome");
  assert.equal(caps.isTTY, false);
  assert.equal(caps.hyperlinks, false);
});

test("COLORTERM=truecolor wins over TERM hints", () => {
  const caps = detectCapabilities({
    output: ttyOutput,
    env: { TERM: "xterm", COLORTERM: "truecolor" },
  });
  assert.equal(caps.color, "truecolor");
});

test("TERM=xterm-256color resolves to ansi256", () => {
  const caps = detectCapabilities({
    output: ttyOutput,
    env: { TERM: "xterm-256color" },
  });
  assert.equal(caps.color, "ansi256");
});

test("TERM=dumb resolves to monochrome", () => {
  const caps = detectCapabilities({
    output: ttyOutput,
    env: { TERM: "dumb" },
  });
  assert.equal(caps.color, "monochrome");
});

test("NO_COLOR forces monochrome", () => {
  const caps = detectCapabilities({
    output: ttyOutput,
    env: { TERM: "xterm-256color", COLORTERM: "truecolor", NO_COLOR: "1" },
  });
  assert.equal(caps.color, "monochrome");
});

test("FORCE_COLOR=truecolor escalates from dumb terminal", () => {
  const caps = detectCapabilities({
    output: nonTtyOutput,
    env: { TERM: "dumb", FORCE_COLOR: "truecolor" },
  });
  assert.equal(caps.color, "truecolor");
});

test("kitty terminal advertises hyperlinks, sync output, and kitty graphics", () => {
  const caps = detectCapabilities({
    output: ttyOutput,
    env: { TERM: "xterm-kitty", KITTY_WINDOW_ID: "1" },
  });
  assert.equal(caps.hyperlinks, true);
  assert.equal(caps.synchronizedOutput, true);
  assert.equal(caps.kittyGraphics, true);
});

test("explicit overrides take precedence over detection", () => {
  const caps = detectCapabilities({
    output: ttyOutput,
    env: { TERM: "xterm" },
    overrides: { color: "monochrome", hyperlinks: true },
  });
  assert.equal(caps.color, "monochrome");
  assert.equal(caps.hyperlinks, true);
});

test("DUMB and FULL profiles are frozen", () => {
  assert.equal(Object.isFrozen(DUMB_CAPABILITIES), true);
  assert.equal(Object.isFrozen(FULL_CAPABILITIES), true);
  assert.equal(DUMB_CAPABILITIES.color, "monochrome");
  assert.equal(FULL_CAPABILITIES.color, "truecolor");
});
