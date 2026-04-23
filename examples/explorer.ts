/**
 * zenterm · explorer — a file browser built on zenterm.
 *
 * A deliberately realistic example: the kind of app someone would reach
 * for the framework to build. Split-pane layout, async I/O wired into
 * list selection, focus shuttled between panes on navigation, and a
 * status bar that stays in sync with the current selection.
 *
 * Controls:
 *   up / down       move through entries
 *   enter           open directory, or focus preview for a file
 *   backspace       go up one directory
 *   tab             cycle focus (list ↔ preview)
 *   escape          return focus to the list from the preview
 *   F5              reload current directory
 *   F2              toggle theme
 *   ctrl+c          quit
 */
import { promises as fs } from "node:fs";
import * as path from "node:path";
import {
  Application,
  KeyEvent,
  Label,
  ListView,
  StatusBar,
  Window,
  darkTheme,
  defaultTheme,
} from "../src/index.js";

interface Entry {
  name: string;
  isDir: boolean;
  size: number;
}

const app = new Application();
const root = new Window({ title: " zenterm · explorer ", border: true });

let cwd = process.cwd();
let entries: Entry[] = [];

// -- Path header --------------------------------------------------------------
const pathLabel = new Label({
  x: 2, y: 1, width: 200, text: cwd, style: { bold: true },
});
root.add(pathLabel);

// -- Directory list (left pane) ----------------------------------------------
const list = new ListView<Entry>({
  x: 2, y: 3, width: 36, height: 16,
  items: entries,
  render: (e) => {
    if (e.isDir) return `${e.name}/`;
    const size = fmtSize(e.size);
    const pad = Math.max(1, 28 - e.name.length);
    return `${e.name}${" ".repeat(pad)}${size}`;
  },
  onChange: (_entry, idx) => {
    void loadPreview(idx);
    updateStatus();
  },
  onSelect: (entry) => {
    if (entry.isDir) {
      cwd = path.resolve(cwd, entry.name);
      void refresh();
    } else {
      app.focus.focus(preview);
      app.invalidate();
    }
  },
});
root.add(list);

// -- Preview pane (right) -----------------------------------------------------
const previewLines: string[] = [];
const preview = new ListView<string>({
  x: 40, y: 3, width: 200, height: 16,
  items: previewLines,
  render: (line) => line,
});
root.add(preview);

// -- Status bar ---------------------------------------------------------------
const status = new StatusBar({ text: "" });
root.add(status);

// -- Data loading -------------------------------------------------------------
async function refresh(): Promise<void> {
  pathLabel.setText(cwd);
  try {
    const names = await fs.readdir(cwd);
    const loaded: Entry[] = [];
    if (path.dirname(cwd) !== cwd) {
      loaded.push({ name: "..", isDir: true, size: 0 });
    }
    for (const name of names) {
      if (name.startsWith(".")) continue; // hide dotfiles — F6 could toggle later
      try {
        const st = await fs.stat(path.join(cwd, name));
        loaded.push({ name, isDir: st.isDirectory(), size: st.size });
      } catch {
        // unreadable entry — skip rather than crash
      }
    }
    loaded.sort((a, b) => {
      if (a.name === "..") return -1;
      if (b.name === "..") return 1;
      if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
    entries = loaded;
    list.setItems(entries);
    await loadPreview(0);
    updateStatus();
  } catch (err) {
    entries = [];
    list.setItems(entries);
    setPreview([`<error reading directory: ${errMsg(err)}>`]);
    updateStatus();
  }
}

async function loadPreview(idx: number): Promise<void> {
  const entry = entries[idx];
  if (!entry) {
    setPreview([]);
    return;
  }
  const full = path.resolve(cwd, entry.name);

  if (entry.isDir) {
    try {
      const names = (await fs.readdir(full)).filter((n) => !n.startsWith("."));
      const lines = [`<directory · ${names.length} entries>`, ""];
      for (const n of names.slice(0, 60)) lines.push(`  ${n}`);
      if (names.length > 60) lines.push(`  … ${names.length - 60} more`);
      setPreview(lines);
    } catch (err) {
      setPreview([`<error: ${errMsg(err)}>`]);
    }
    return;
  }

  if (entry.size === 0) {
    setPreview(["<empty file>"]);
    return;
  }
  if (entry.size > 512 * 1024) {
    setPreview([`<${fmtSize(entry.size)} — too large to preview>`]);
    return;
  }

  try {
    const data = await fs.readFile(full);
    if (isBinary(data)) {
      setPreview([`<binary · ${fmtSize(entry.size)}>`]);
      return;
    }
    const text = data.toString("utf8");
    const lines = text.split(/\r?\n/).slice(0, 500).map((l) => l.replace(/\t/g, "  "));
    setPreview(lines);
  } catch (err) {
    setPreview([`<error: ${errMsg(err)}>`]);
  }
}

function setPreview(lines: string[]): void {
  previewLines.length = 0;
  previewLines.push(...lines);
  preview.setItems(previewLines);
}

// -- Helpers ------------------------------------------------------------------
function fmtSize(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} K`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} M`;
  return `${(n / 1024 / 1024 / 1024).toFixed(1)} G`;
}

function isBinary(buf: Buffer): boolean {
  const n = Math.min(buf.length, 4096);
  for (let i = 0; i < n; i++) {
    if (buf[i] === 0) return true;
  }
  return false;
}

function errMsg(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function updateStatus(): void {
  const entry = entries[list.selectedIndex()];
  const tag = entry
    ? entry.isDir
      ? `${entry.name}/`
      : `${entry.name} · ${fmtSize(entry.size)}`
    : "(empty)";
  status.setText(
    `${entries.length} entries  ·  ${tag}  ·  enter: open  bksp: up  tab: pane  F5: reload  F2: theme  ^C: quit`,
  );
}

// -- Global shortcuts ---------------------------------------------------------
app.bus.on("key", (ev) => {
  const e = ev as KeyEvent;
  if (e.ctrl || e.alt) return;

  if (e.name === "backspace" && app.focus.focused() === list) {
    const parent = path.dirname(cwd);
    if (parent !== cwd) {
      cwd = parent;
      void refresh();
    }
    return;
  }

  if (e.name === "escape" && app.focus.focused() === preview) {
    app.focus.focus(list);
    app.invalidate();
    return;
  }

  if (e.name === "f5") {
    void refresh();
    return;
  }

  if (e.name === "f2") {
    app.theme = app.theme.name === "dark" ? defaultTheme() : darkTheme();
    app.renderer.invalidate();
    app.invalidate();
  }
});

// -- Boot ---------------------------------------------------------------------
app.setRoot(root);
app.focus.focus(list);
app.run();
void refresh();
