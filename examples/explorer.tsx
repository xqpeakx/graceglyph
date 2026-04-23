/** @jsxRuntime automatic */
/** @jsxImportSource ../src */

import { promises as fs } from "node:fs";
import * as path from "node:path";
import {
  App,
  Column,
  List,
  Panel,
  Row,
  Text,
  Window,
  render,
  useEffect,
  useState,
} from "../src/index.js";
import type { KeyEvent } from "../src/index.js";

interface Entry {
  name: string;
  isDir: boolean;
  size: number;
}

function ExplorerApp() {
  const [cwd, setCwd] = useState(process.cwd());
  const [refreshToken, setRefreshToken] = useState(0);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [selected, setSelected] = useState(0);
  const [previewLines, setPreviewLines] = useState<string[]>(["Loading..."]);
  const [previewSelected, setPreviewSelected] = useState(0);
  const [status, setStatus] = useState("Loading directory...");

  useEffect(() => {
    let cancelled = false;

    async function loadDirectory(): Promise<void> {
      setStatus(`Loading ${cwd}`);
      try {
        const names = await fs.readdir(cwd);
        const loaded: Entry[] = [];
        if (path.dirname(cwd) !== cwd) {
          loaded.push({ name: "..", isDir: true, size: 0 });
        }

        for (const name of names) {
          if (name.startsWith(".")) continue;
          try {
            const stats = await fs.stat(path.join(cwd, name));
            loaded.push({ name, isDir: stats.isDirectory(), size: stats.size });
          } catch {
            // Skip unreadable entries rather than failing the directory load.
          }
        }

        loaded.sort((left, right) => {
          if (left.name === "..") return -1;
          if (right.name === "..") return 1;
          if (left.isDir !== right.isDir) return left.isDir ? -1 : 1;
          return left.name.localeCompare(right.name);
        });

        if (cancelled) return;
        setEntries(loaded);
        setSelected(0);
      } catch (error) {
        if (cancelled) return;
        setEntries([]);
        setPreviewLines([`<error reading directory: ${messageOf(error)}>`]);
        setStatus(`Could not read ${cwd}`);
      }
    }

    void loadDirectory();
    return () => {
      cancelled = true;
    };
  }, [cwd, refreshToken]);

  useEffect(() => {
    let cancelled = false;
    const entry = entries[selected];

    async function loadPreview(): Promise<void> {
      if (!entry) {
        setPreviewLines(["<empty directory>"]);
        setStatus("(empty)");
        return;
      }

      const fullPath = path.resolve(cwd, entry.name);
      setStatus(entry.isDir ? `${entry.name}/` : `${entry.name} · ${formatSize(entry.size)}`);

      if (entry.isDir) {
        try {
          const names = (await fs.readdir(fullPath)).filter((name) => !name.startsWith("."));
          if (cancelled) return;
          const lines = [`<directory · ${names.length} entries>`, ""];
          for (const name of names.slice(0, 40)) lines.push(`  ${name}`);
          if (names.length > 40) lines.push(`  … ${names.length - 40} more`);
          setPreviewLines(lines);
        } catch (error) {
          if (!cancelled) setPreviewLines([`<error: ${messageOf(error)}>`]);
        }
        return;
      }

      if (entry.size === 0) {
        setPreviewLines(["<empty file>"]);
        return;
      }

      if (entry.size > 512 * 1024) {
        setPreviewLines([`<${formatSize(entry.size)} · too large to preview>`]);
        return;
      }

      try {
        const data = await fs.readFile(fullPath);
        if (cancelled) return;
        if (isBinary(data)) {
          setPreviewLines([`<binary · ${formatSize(entry.size)}>`]);
          return;
        }
        const lines = data
          .toString("utf8")
          .split(/\r?\n/)
          .slice(0, 200)
          .map((line) => line.replace(/\t/g, "  "));
        setPreviewLines(lines.length > 0 ? lines : ["<empty file>"]);
      } catch (error) {
        if (!cancelled) setPreviewLines([`<error: ${messageOf(error)}>`]);
      }
    }

    void loadPreview();
    return () => {
      cancelled = true;
    };
  }, [cwd, entries, selected]);

  useEffect(() => {
    setPreviewSelected((index) => clamp(index, previewLines.length));
  }, [previewLines.length]);

  function onWindowKey(event: KeyEvent): boolean | void {
    if (event.ctrl || event.alt) return false;
    if (event.name === "backspace") {
      const parent = path.dirname(cwd);
      if (parent !== cwd) setCwd(parent);
      return true;
    }
    if (event.name === "f5") {
      setRefreshToken((value) => value + 1);
      return true;
    }
    return false;
  }

  function openEntry(index: number): void {
    const entry = entries[index];
    if (!entry?.isDir) return;
    setCwd(path.resolve(cwd, entry.name));
  }

  return (
    <App>
      <Window title="Explorer" width={92} height={26} onKey={onWindowKey}>
        <Column gap={1} grow={1}>
          <Panel title="Path" height={3}>
            <Text>{cwd}</Text>
          </Panel>

          <Row gap={1} grow={1}>
            <Panel title="Entries" width={38}>
              <List
                items={entries}
                selected={selected}
                onChange={setSelected}
                onSelect={openEntry}
                height={14}
                render={(entry) => (
                  entry.isDir
                    ? `${entry.name}/`
                    : `${entry.name} · ${formatSize(entry.size)}`
                )}
              />
            </Panel>

            <Panel title="Preview" grow={1}>
              <List
                items={previewLines}
                selected={previewSelected}
                onChange={setPreviewSelected}
                height={14}
                render={(line) => line}
              />
            </Panel>
          </Row>

          <Text style={{ dim: true }}>
            {entries.length} entries · {status} · Backspace: up · F5: reload · F12: inspector
          </Text>
        </Column>
      </Window>
    </App>
  );
}

render(<ExplorerApp />);

function clamp(index: number, length: number): number {
  if (length === 0) return 0;
  return Math.min(index, length - 1);
}

function formatSize(size: number): string {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  if (size < 1024 * 1024 * 1024) return `${(size / 1024 / 1024).toFixed(1)} MB`;
  return `${(size / 1024 / 1024 / 1024).toFixed(1)} GB`;
}

function isBinary(buffer: Buffer): boolean {
  const limit = Math.min(buffer.length, 4096);
  for (let index = 0; index < limit; index++) {
    if (buffer[index] === 0) return true;
  }
  return false;
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
