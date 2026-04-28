import test from "node:test";
import assert from "node:assert/strict";

import { Rect } from "../src/layout/rect.js";
import { AnsiSeq, cursorTo, hyperlinkClose, hyperlinkOpen } from "../src/render/ansi.js";
import { ScreenBuffer } from "../src/render/buffer.js";
import { Renderer } from "../src/render/renderer.js";
import { DefaultStyle } from "../src/render/style.js";

test("renderer clears the terminal before repainting after resize", () => {
  const terminal = new FakeTerminal(4, 2);
  const renderer = new Renderer(terminal as never);

  draw(renderer.beginFrame(), "abcd", 4, 2);
  renderer.flush();
  terminal.clearWrites();

  terminal.setSize(2, 1);
  renderer.resize(2, 1);
  renderer.invalidate();
  draw(renderer.beginFrame(), "xy", 2, 1);
  renderer.flush();

  const output = terminal.output();
  assert.match(output, new RegExp(escapeRegex(AnsiSeq.reset)));
  assert.match(output, new RegExp(escapeRegex(AnsiSeq.clearScreen)));
  assert.match(output, new RegExp(escapeRegex(cursorTo(0, 0))));
  assert.match(output, /xy/);
});

test("renderer flush only emits changed cells on stable-sized frames", () => {
  const terminal = new FakeTerminal(3, 1);
  const renderer = new Renderer(terminal as never);

  draw(renderer.beginFrame(), "qqq", 3, 1);
  renderer.flush();
  terminal.clearWrites();

  draw(renderer.beginFrame(), "qrq", 3, 1);
  renderer.flush();

  const output = terminal.output();
  assert.doesNotMatch(output, new RegExp(escapeRegex(AnsiSeq.clearScreen)));
  assert.match(output, new RegExp(escapeRegex(cursorTo(1, 0))));
  assert.match(output, /r/);
  assert.doesNotMatch(output, /q/);
});

test("renderer can update cursor position without repainting unchanged cells", () => {
  const terminal = new FakeTerminal(3, 1);
  const renderer = new Renderer(terminal as never);

  draw(renderer.beginFrame(), "abc", 3, 1);
  renderer.setCursor({ x: 0, y: 0 });
  renderer.flush();
  terminal.clearWrites();

  draw(renderer.beginFrame(), "abc", 3, 1);
  renderer.setCursor({ x: 2, y: 0 });
  renderer.flush();

  const output = terminal.output();
  assert.match(output, new RegExp(escapeRegex(cursorTo(2, 0))));
  assert.doesNotMatch(output, /a|b|c/);
});

test("renderer keeps OSC 8 hyperlinks open across contiguous cells", () => {
  const terminal = new FakeTerminal(6, 1);
  const renderer = new Renderer(terminal as never);

  const frameA = renderer.beginFrame();
  frameA.set(0, 0, { char: "H", style: DefaultStyle, width: 1, hyperlink: "https://example.com" });
  frameA.set(1, 0, { char: "i", style: DefaultStyle, width: 1, hyperlink: "https://example.com" });
  renderer.flush();

  const output = terminal.output();
  assert.equal(countOccurrences(output, hyperlinkOpen("https://example.com")), 1);
  assert.equal(countOccurrences(output, hyperlinkClose()), 1);
  assert.match(output, /Hi/);
});

test("renderer emits ansiPrefix before text once per prefixed cell", () => {
  const terminal = new FakeTerminal(6, 1);
  const renderer = new Renderer(terminal as never);

  const frame = renderer.beginFrame();
  frame.set(0, 0, {
    char: "A",
    style: DefaultStyle,
    width: 1,
    ansiPrefix: "\x1b]1337;File=foo\x07",
  });
  frame.set(1, 0, { char: "B", style: DefaultStyle, width: 1 });
  renderer.flush();

  const output = terminal.output();
  assert.match(output, /\x1b\]1337;File=foo\x07AB/);
  assert.equal(countOccurrences(output, "\x1b]1337;File=foo\x07"), 1);
});

class FakeTerminal {
  private chunks: string[] = [];

  constructor(
    private width: number,
    private height: number,
  ) {}

  size(): { width: number; height: number } {
    return { width: this.width, height: this.height };
  }

  setSize(width: number, height: number): void {
    this.width = width;
    this.height = height;
  }

  write(chunk: string): void {
    this.chunks.push(chunk);
  }

  clearWrites(): void {
    this.chunks = [];
  }

  output(): string {
    return this.chunks.join("");
  }
}

function draw(buffer: ScreenBuffer, text: string, width: number, height: number): void {
  buffer.writeText(0, 0, text, DefaultStyle, new Rect(0, 0, width, height));
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function countOccurrences(haystack: string, needle: string): number {
  if (needle.length === 0) return 0;
  let count = 0;
  let index = 0;
  while (true) {
    const next = haystack.indexOf(needle, index);
    if (next < 0) break;
    count += 1;
    index = next + needle.length;
  }
  return count;
}
