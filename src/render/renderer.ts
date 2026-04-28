import { Terminal } from "../core/terminal.js";
import { AnsiSeq, cursorTo, hyperlinkClose, hyperlinkOpen, styleSgr } from "./ansi.js";
import { ScreenBuffer } from "./buffer.js";
import { DefaultStyle, Style, stylesEqual } from "./style.js";

/**
 * Double-buffered diff renderer. Call `beginFrame` to get a fresh back buffer,
 * draw into it via widgets, then call `flush` to push minimal diffs to the TTY.
 */
export class Renderer {
  private front: ScreenBuffer;
  private back: ScreenBuffer;
  private cursorVisible = false;
  private cursorPos: { x: number; y: number } | null = null;
  private clearPending = false;

  constructor(private readonly terminal: Terminal) {
    const { width, height } = terminal.size();
    this.front = new ScreenBuffer(width, height);
    this.back = new ScreenBuffer(width, height);
  }

  resize(width: number, height: number): void {
    this.front.resize(width, height);
    this.back.resize(width, height);
    this.clearPending = true;
  }

  beginFrame(): ScreenBuffer {
    this.back.clear();
    return this.back;
  }

  setCursor(pos: { x: number; y: number } | null): void {
    this.cursorPos = pos;
  }

  flush(): void {
    const out: string[] = [];
    let lastStyle: Style = DefaultStyle;
    let styleSet = false;
    let lastPos: { x: number; y: number } | null = null;
    let activeHyperlink: string | null = null;
    let textRun = "";

    const flushTextRun = (): void => {
      if (textRun.length === 0) return;
      out.push(textRun);
      textRun = "";
    };

    const sync = this.terminal.capabilities?.synchronizedOutput ?? false;
    if (sync) out.push(AnsiSeq.beginSynchronized);
    out.push(AnsiSeq.hideCursor);

    if (this.clearPending) {
      out.push(AnsiSeq.reset);
      out.push(AnsiSeq.clearScreen);
      out.push(cursorTo(0, 0));
      lastPos = { x: 0, y: 0 };
      this.clearPending = false;
    }

    for (const { x, y, cell } of this.back.diff(this.front)) {
      if (cell.width === 0) continue; // trailing half of wide cell
      const needsCursorMove = !lastPos || lastPos.x !== x || lastPos.y !== y;
      const needsStyleUpdate = !styleSet || !stylesEqual(cell.style, lastStyle);
      if (needsCursorMove) {
        flushTextRun();
        out.push(cursorTo(x, y));
      }
      if (needsStyleUpdate) {
        flushTextRun();
        out.push(styleSgr(cell.style));
        lastStyle = cell.style;
        styleSet = true;
      }
      const nextHyperlink = cell.hyperlink ?? null;
      if (nextHyperlink !== activeHyperlink) {
        flushTextRun();
        if (activeHyperlink) out.push(hyperlinkClose());
        if (nextHyperlink) out.push(hyperlinkOpen(nextHyperlink));
        activeHyperlink = nextHyperlink;
      }
      if (cell.ansiPrefix) {
        flushTextRun();
        out.push(cell.ansiPrefix);
      }
      textRun += cell.char || " ";
      lastPos = { x: x + cell.width, y };
    }

    flushTextRun();
    if (activeHyperlink) out.push(hyperlinkClose());

    // Swap buffers.
    this.front.copyFrom(this.back);

    if (this.cursorPos) {
      out.push(cursorTo(this.cursorPos.x, this.cursorPos.y));
      out.push(AnsiSeq.showCursor);
      this.cursorVisible = true;
    } else if (this.cursorVisible) {
      out.push(AnsiSeq.hideCursor);
      this.cursorVisible = false;
    }

    if (sync) out.push(AnsiSeq.endSynchronized);

    if (out.length > 0) this.terminal.write(out.join(""));
  }

  /** Force a full repaint on next flush (e.g. after resize or alt-screen toggle). */
  invalidate(): void {
    this.front.clear();
    this.clearPending = true;
  }
}
