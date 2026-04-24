import test from "node:test";
import assert from "node:assert/strict";

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

  assert.deepEqual(events, [{
    type: "key",
    name: "escape",
    char: undefined,
    ctrl: false,
    alt: false,
    shift: false,
    raw: "\x1b",
  }]);
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
