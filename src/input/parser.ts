import { InputEvent, KeyEvent, KeyName, MouseEvent } from "./keys.js";

/**
 * Parses raw stdin chunks into high-level input events.
 * Supports: printable chars, control chars, CSI arrow/nav keys, F1-F12,
 * xterm SGR mouse (CSI < b;x;y M/m), and Alt-prefixed escape sequences.
 *
 * This is a pragmatic subset — terminals are inconsistent, so we match the
 * common cases and fall back to emitting raw bytes as a char event.
 */
export class InputParser {
  private buffer = "";

  feed(chunk: string): InputEvent[] {
    this.buffer += chunk;
    const events: InputEvent[] = [];
    while (this.buffer.length > 0) {
      const before = this.buffer.length;
      const ev = this.parseOne();
      if (ev) events.push(ev);
      if (this.buffer.length === before) break; // incomplete sequence, wait for more
    }
    return events;
  }

  hasPendingInput(): boolean {
    return this.buffer.length > 0;
  }

  flushPending(): InputEvent[] {
    const events: InputEvent[] = [];

    while (this.buffer.length > 0) {
      const ev = this.parseOne(true);
      if (ev) {
        events.push(ev);
        continue;
      }

      const ch = this.buffer[0]!;
      this.buffer = this.buffer.slice(1);
      if (ch === "\x1b") {
        events.push(keyEvent("escape", { raw: ch }));
      } else {
        events.push(this.parseControlChar(ch));
      }
    }

    return events;
  }

  private parseOne(flush = false): InputEvent | null {
    const s = this.buffer;
    const ch = s[0]!;

    // CSI sequences: ESC [ ...
    if (ch === "\x1b" && s[1] === "[") {
      return this.parseCsi(flush);
    }

    // SS3 sequences: ESC O X — some terminals use these for F1-F4/arrows.
    if (ch === "\x1b" && s[1] === "O") {
      if (s.length < 3) {
        if (!flush) return null;
      } else {
        const code = s[2]!;
        this.buffer = s.slice(3);
        const map: Record<string, KeyName> = {
          A: "up", B: "down", C: "right", D: "left",
          H: "home", F: "end",
          P: "f1", Q: "f2", R: "f3", S: "f4",
        };
        const name = map[code];
        if (name) return keyEvent(name, { raw: s.slice(0, 3) });
        return keyEvent("char", { char: code, raw: s.slice(0, 3) });
      }
    }

    // Lone ESC or Alt+key
    if (ch === "\x1b") {
      if (s.length === 1) {
        if (!flush) return null;
        this.buffer = "";
        return keyEvent("escape", { raw: ch });
      }
      // Alt + char
      const next = s[1]!;
      this.buffer = s.slice(2);
      return keyEvent("char", { char: next, alt: true, raw: s.slice(0, 2) });
    }

    // Control chars
    this.buffer = s.slice(1);
    return this.parseControlChar(ch);
  }

  private parseCsi(flush: boolean): InputEvent | null {
    const s = this.buffer;
    // Find final byte: 0x40-0x7E
    let i = 2;
    while (i < s.length) {
      const code = s.charCodeAt(i);
      if (code >= 0x40 && code <= 0x7e) break;
      i++;
    }
    if (i >= s.length) {
      if (!flush) return null; // incomplete
      this.buffer = s.slice(1);
      return keyEvent("escape", { raw: "\x1b" });
    }
    const seq = s.slice(0, i + 1);
    const params = s.slice(2, i);
    const final = s[i]!;
    this.buffer = s.slice(i + 1);

    // SGR mouse: ESC [ < b ; x ; y (M|m)
    if (params.startsWith("<") && (final === "M" || final === "m")) {
      return this.parseSgrMouse(params.slice(1), final === "M", seq);
    }

    // Arrow / nav keys
    const simple: Record<string, KeyName> = {
      A: "up", B: "down", C: "right", D: "left",
      H: "home", F: "end",
    };
    if (params === "" && simple[final]) {
      return keyEvent(simple[final]!, { raw: seq });
    }

    // Modified navigation and tilde keys: CSI <n> ; <mods> ~
    // e.g. CSI 3~ = delete, CSI 5~ = pageup, CSI 6~ = pagedown, CSI 1;5A = ctrl+up
    const parts = params.split(";");
    const n = Number(parts[0] ?? "");
    const mods = parseMods(parts[1]);
    if (final === "~") {
      const tildeMap: Record<number, KeyName> = {
        1: "home", 2: "home", 3: "delete", 4: "end",
        5: "pageup", 6: "pagedown", 7: "home", 8: "end",
        11: "f1", 12: "f2", 13: "f3", 14: "f4",
        15: "f5", 17: "f6", 18: "f7", 19: "f8",
        20: "f9", 21: "f10", 23: "f11", 24: "f12",
      };
      const name = tildeMap[n];
      if (name) return keyEvent(name, { raw: seq, ...mods });
    }
    if (simple[final]) {
      return keyEvent(simple[final]!, { raw: seq, ...mods });
    }

    // Unknown — emit as raw char so apps can bind custom sequences.
    return keyEvent("char", { char: seq, raw: seq });
  }

  private parseSgrMouse(params: string, isPress: boolean, raw: string): MouseEvent | null {
    const [bStr, xStr, yStr] = params.split(";");
    const b = Number(bStr);
    const x = Number(xStr) - 1;
    const y = Number(yStr) - 1;
    if (!Number.isFinite(b) || !Number.isFinite(x) || !Number.isFinite(y)) return null;

    const shift = (b & 4) !== 0;
    const alt = (b & 8) !== 0;
    const ctrl = (b & 16) !== 0;
    const motion = (b & 32) !== 0;
    const code = b & 0b11000011;

    let button: MouseEvent["button"] = "left";
    if (code === 0) button = "left";
    else if (code === 1) button = "middle";
    else if (code === 2) button = "right";
    else if (code === 64) button = "wheel-up";
    else if (code === 65) button = "wheel-down";

    let action: MouseEvent["action"] = isPress ? "press" : "release";
    if (motion) action = "move";
    // Wheels are reported as press events only — surface as a single press.
    if (button === "wheel-up" || button === "wheel-down") action = "press";

    return { type: "mouse", button, action, x, y, ctrl, alt, shift };
  }

  private parseControlChar(ch: string): KeyEvent {
    const code = ch.charCodeAt(0);
    if (code === 0x0d || code === 0x0a) {
      return keyEvent("enter", { raw: ch });
    }
    if (code === 0x09) return keyEvent("tab", { raw: ch });
    if (code === 0x7f || code === 0x08) return keyEvent("backspace", { raw: ch });
    if (code === 0x20) return keyEvent("space", { char: " ", raw: ch });
    if (code < 0x20) {
      // Ctrl + letter. Ctrl+A == 0x01, so add 0x60 to get lowercase letter.
      const letter = String.fromCharCode(code + 0x60);
      return keyEvent("char", { char: letter, ctrl: true, raw: ch });
    }
    return keyEvent("char", { char: ch, raw: ch });
  }
}

function parseMods(s: string | undefined): { ctrl?: boolean; alt?: boolean; shift?: boolean } {
  if (!s) return {};
  const m = Number(s);
  if (!Number.isFinite(m) || m < 2) return {};
  const bits = m - 1;
  return {
    shift: (bits & 1) !== 0,
    alt: (bits & 2) !== 0,
    ctrl: (bits & 4) !== 0,
  };
}

function keyEvent(
  name: KeyName,
  opts: { char?: string; ctrl?: boolean; alt?: boolean; shift?: boolean; raw: string },
): KeyEvent {
  return {
    type: "key",
    name,
    char: opts.char,
    ctrl: opts.ctrl ?? false,
    alt: opts.alt ?? false,
    shift: opts.shift ?? false,
    raw: opts.raw,
  };
}
