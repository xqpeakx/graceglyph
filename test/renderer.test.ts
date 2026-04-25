import test from "node:test";
import assert from "node:assert/strict";

import { Rect } from "../src/layout/rect.js";
import { AnsiSeq, cursorTo } from "../src/render/ansi.js";
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

class FakeTerminal {
  private chunks: string[] = [];

  constructor(private width: number, private height: number) {}

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
