import type { Bench } from "../run.js";
import { InputParser } from "../../src/input/parser.js";

/**
 * 1000 keys/sec input storm: feed the parser a mix of printable chars,
 * arrow keys, and mouse events, and count parsed events. This bounds how
 * expensive the input pipeline is at the worst end of typeahead.
 */
export function inputStorm(bench: Bench): void {
  const parser = new InputParser();
  // Pre-build 1000 events worth of byte payload.
  const chunks: string[] = [];
  for (let i = 0; i < 1000; i++) {
    if (i % 7 === 0) chunks.push("\x1b[A");
    else if (i % 11 === 0) chunks.push("\x1b[<0;5;5M");
    else if (i % 13 === 0) chunks.push("\r");
    else chunks.push(String.fromCharCode(97 + (i % 26)));
  }
  const payload = chunks.join("");

  bench.add({
    name: "input-storm: 1000 mixed events",
    iterations: 200,
    fn: () => {
      const events = parser.feed(payload);
      let parsed = 0;
      for (const event of events) {
        parsed += event.type === "key" || event.type === "mouse" ? 1 : 0;
      }
      if (parsed === 0) {
        throw new Error("parser produced zero events");
      }
    },
  });
}
