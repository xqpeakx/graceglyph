import test from "node:test";
import assert from "node:assert/strict";
import fc from "fast-check";

import { InputParser } from "../src/input/parser.js";

test("parser waits for split CSI sequences across chunks", () => {
  const parser = new InputParser();

  assert.deepEqual(parser.feed("\x1b["), []);
  const events = parser.feed("A");

  assert.equal(events.length, 1);
  assert.deepEqual(events[0], {
    type: "key",
    name: "up",
    char: undefined,
    ctrl: false,
    alt: false,
    shift: false,
    raw: "\x1b[A",
  });
});

test("parser waits for split SS3 sequences across chunks", () => {
  const parser = new InputParser();

  assert.deepEqual(parser.feed("\x1bO"), []);
  const events = parser.feed("P");

  assert.equal(events.length, 1);
  assert.equal(events[0]?.type, "key");
  assert.equal(events[0]?.name, "f1");
});

test("parser combines split alt-key sequences", () => {
  const parser = new InputParser();

  assert.deepEqual(parser.feed("\x1b"), []);
  const events = parser.feed("x");

  assert.equal(events.length, 1);
  assert.deepEqual(events[0], {
    type: "key",
    name: "char",
    char: "x",
    ctrl: false,
    alt: true,
    shift: false,
    raw: "\x1bx",
  });
});

test("parser flushes a lone escape when the sequence timeout expires", () => {
  const parser = new InputParser();

  assert.deepEqual(parser.feed("\x1b"), []);
  const events = parser.flushPending();

  assert.deepEqual(events, [
    {
      type: "key",
      name: "escape",
      char: undefined,
      ctrl: false,
      alt: false,
      shift: false,
      raw: "\x1b",
    },
  ]);
});

test("parser degrades incomplete CSI to escape plus remaining characters on flush", () => {
  const parser = new InputParser();

  assert.deepEqual(parser.feed("\x1b["), []);
  const events = parser.flushPending();

  assert.deepEqual(events, [
    {
      type: "key",
      name: "escape",
      char: undefined,
      ctrl: false,
      alt: false,
      shift: false,
      raw: "\x1b",
    },
    {
      type: "key",
      name: "char",
      char: "[",
      ctrl: false,
      alt: false,
      shift: false,
      raw: "[",
    },
  ]);
});

test("parser property: chunked input matches monolithic input", () => {
  const ansiByte = fc.integer({ min: 0, max: 0x7f });
  const textArb = fc
    .array(ansiByte, { maxLength: 96 })
    .map((codes) => codes.map((code) => String.fromCharCode(code)).join(""));
  const chunkSizesArb = fc.array(fc.integer({ min: 1, max: 12 }), { maxLength: 24 });

  fc.assert(
    fc.property(textArb, chunkSizesArb, (input, chunkSizes) => {
      const whole = new InputParser();
      const wholeEvents = [...whole.feed(input), ...whole.flushPending()];

      const chunked = new InputParser();
      const chunkedEvents = feedChunked(chunked, input, chunkSizes);
      assert.deepEqual(chunkedEvents, wholeEvents);
    }),
    { numRuns: 200 },
  );
});

test("parser property: flushPending drains parser buffer completely", () => {
  const ansiByte = fc.integer({ min: 0, max: 0x7f });
  const textArb = fc
    .array(ansiByte, { maxLength: 128 })
    .map((codes) => codes.map((code) => String.fromCharCode(code)).join(""));

  fc.assert(
    fc.property(textArb, (input) => {
      const parser = new InputParser();
      parser.feed(input);
      parser.flushPending();
      assert.equal(parser.hasPendingInput(), false);
    }),
    { numRuns: 200 },
  );
});

function feedChunked(
  parser: InputParser,
  input: string,
  sizes: readonly number[],
): ReturnType<InputParser["feed"]> {
  const events: ReturnType<InputParser["feed"]> = [];
  let index = 0;
  let sizeIndex = 0;
  while (index < input.length) {
    const size = sizes[sizeIndex] ?? 1;
    const next = input.slice(index, index + size);
    events.push(...parser.feed(next));
    index += size;
    sizeIndex += 1;
  }
  events.push(...parser.flushPending());
  return events;
}
