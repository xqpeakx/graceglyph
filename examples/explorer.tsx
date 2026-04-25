/** @jsx h */

import { constants as fsConstants, promises as fs } from "node:fs";
import * as path from "node:path";
import {
  App,
  Button,
  Column,
  List,
  Modal,
  Row,
  Text,
  TextInput,
  Window,
  h,
  useCommand,
  useEffect,
  useState,
  useTerminalSize,
} from "../src/index.js";
import type { KeyEvent } from "../src/index.js";
import { runExample } from "./_entry.js";

interface Entry {
  name: string;
  isDir: boolean;
  size: number;
}

type FileAction = "rename" | "copy" | "delete";
type FileSortMode = "name" | "type" | "size";

export interface ExplorerAppProps {
  initialCwd?: string;
}

export function ExplorerApp(props: ExplorerAppProps = {}) {
  const size = useTerminalSize();
  const stacked = size.width < 76;
  const compact = stacked && size.height < 23;
  const [cwd, setCwd] = useState(props.initialCwd ?? process.cwd());
  const [refreshToken, setRefreshToken] = useState(0);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [selected, setSelected] = useState(0);
  const [previewLines, setPreviewLines] = useState<string[]>(["Loading..."]);
  const [previewSelected, setPreviewSelected] = useState(0);
  const [status, setStatus] = useState("Loading directory...");
  const [action, setAction] = useState<FileAction | null>(null);
  const [actionValue, setActionValue] = useState("");
  const [showHidden, setShowHidden] = useState(false);
  const [sortMode, setSortMode] = useState<FileSortMode>("name");

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
          if (!showHidden && name.startsWith(".")) continue;
          try {
            const stats = await fs.stat(path.join(cwd, name));
            loaded.push({ name, isDir: stats.isDirectory(), size: stats.size });
          } catch {
            // Skip unreadable entries rather than failing the directory load.
          }
        }

        loaded.sort((left, right) => compareEntries(left, right, sortMode));

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
  }, [cwd, refreshToken, showHidden, sortMode]);

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
    if (event.name !== "char" || !event.char) return false;

    const key = event.char.toLowerCase();
    if (key === "r") {
      openAction("rename");
      return true;
    }
    if (key === "y") {
      openAction("copy");
      return true;
    }
    if (key === "d") {
      openAction("delete");
      return true;
    }
    if (key === ".") {
      setShowHidden((value) => !value);
      return true;
    }
    if (key === "s") {
      setSortMode((value) => nextSortMode(value));
      return true;
    }
    return false;
  }

  function openEntry(index: number): void {
    const entry = entries[index];
    if (!entry?.isDir) return;
    setCwd(path.resolve(cwd, entry.name));
  }

  function activeEntry(): Entry | null {
    const entry = entries[selected] ?? null;
    if (!entry || entry.name === "..") return null;
    return entry;
  }

  function openAction(next: FileAction): void {
    const entry = activeEntry();
    if (!entry) {
      setStatus("Select a file or directory first.");
      return;
    }
    setAction(next);
    setActionValue(next === "copy" ? copyName(entry.name) : entry.name);
  }

  async function performAction(): Promise<void> {
    const entry = activeEntry();
    if (!entry || !action) return;

    const source = path.resolve(cwd, entry.name);
    try {
      if (action === "delete") {
        await fs.rm(source, { recursive: true, force: false });
        setStatus(`Deleted ${entry.name}`);
      } else {
        const target = resolveTarget(cwd, actionValue);
        if (action === "rename") {
          await fs.rename(source, target);
          setStatus(`Renamed ${entry.name} to ${path.basename(target)}`);
        } else {
          await copyEntry(source, target);
          setStatus(`Copied ${entry.name} to ${path.basename(target)}`);
        }
      }
      setAction(null);
      setRefreshToken((value) => value + 1);
    } catch (error) {
      setStatus(`${action} failed: ${messageOf(error)}`);
    }
  }

  useCommand(
    {
      id: "file-manager.parent",
      title: "Go to parent directory",
      group: "File manager",
      keys: ["backspace"],
      run: () => {
        const parent = path.dirname(cwd);
        if (parent !== cwd) setCwd(parent);
      },
    },
    [cwd],
  );
  useCommand(
    {
      id: "file-manager.reload",
      title: "Reload directory",
      group: "File manager",
      keys: ["f5"],
      run: () => setRefreshToken((value) => value + 1),
    },
    [],
  );
  useCommand(
    {
      id: "file-manager.rename",
      title: "Rename selected entry",
      group: "File manager",
      keys: ["r"],
      run: () => openAction("rename"),
    },
    [entries, selected],
  );
  useCommand(
    {
      id: "file-manager.copy",
      title: "Copy selected entry",
      group: "File manager",
      keys: ["y"],
      run: () => openAction("copy"),
    },
    [entries, selected],
  );
  useCommand(
    {
      id: "file-manager.delete",
      title: "Delete selected entry",
      group: "File manager",
      keys: ["d"],
      run: () => openAction("delete"),
    },
    [entries, selected],
  );
  useCommand(
    {
      id: "file-manager.hidden",
      title: showHidden ? "Hide dotfiles" : "Show dotfiles",
      group: "File manager",
      keys: ["."],
      run: () => setShowHidden((value) => !value),
    },
    [showHidden],
  );
  useCommand(
    {
      id: "file-manager.sort",
      title: "Cycle file sort",
      group: "File manager",
      keys: ["s"],
      run: () => setSortMode((value) => nextSortMode(value)),
    },
    [],
  );

  const listHeight = compact
    ? Math.max(4, Math.min(8, size.height - 10))
    : stacked
      ? Math.max(3, Math.min(7, Math.floor((size.height - 14) / 2)))
      : Math.max(6, Math.min(14, size.height - 12));

  return (
    <App>
      <Window title="Explorer" grow={1} padding={compact ? 0 : 1} onKey={onWindowKey}>
        <Column gap={compact ? 0 : 1} grow={1}>
          <Text>{cwd}</Text>
          <Text style={{ dim: true }}>
            {entries.length} entries · {status} · sort {sortMode} ·{" "}
            {showHidden ? "hidden shown" : "hidden off"} · r/y/d actions
          </Text>

          {stacked ? (
            compact ? (
              <Column gap={0} grow={1}>
                <Text>Entries</Text>
                <List
                  items={entries}
                  selected={selected}
                  onChange={setSelected}
                  onSelect={openEntry}
                  height={listHeight}
                  render={(entry) =>
                    entry.isDir ? `${entry.name}/` : `${entry.name} · ${formatSize(entry.size)}`
                  }
                />
                <Text style={{ dim: true }}>{previewLines[0] ?? "(no preview)"}</Text>
              </Column>
            ) : (
              <Column gap={1} grow={1}>
                <Text>Entries</Text>
                <List
                  items={entries}
                  selected={selected}
                  onChange={setSelected}
                  onSelect={openEntry}
                  height={listHeight}
                  render={(entry) =>
                    entry.isDir ? `${entry.name}/` : `${entry.name} · ${formatSize(entry.size)}`
                  }
                />

                <Text>Preview</Text>
                <List
                  items={previewLines}
                  selected={previewSelected}
                  onChange={setPreviewSelected}
                  height={listHeight}
                  render={(line) => line}
                />
              </Column>
            )
          ) : (
            <Row gap={2} grow={1}>
              <Column width={38} gap={1}>
                <Text>Entries</Text>
                <List
                  items={entries}
                  selected={selected}
                  onChange={setSelected}
                  onSelect={openEntry}
                  height={listHeight}
                  render={(entry) =>
                    entry.isDir ? `${entry.name}/` : `${entry.name} · ${formatSize(entry.size)}`
                  }
                />
              </Column>

              <Column grow={1} gap={1}>
                <Text>Preview</Text>
                <List
                  items={previewLines}
                  selected={previewSelected}
                  onChange={setPreviewSelected}
                  height={listHeight}
                  render={(line) => line}
                />
              </Column>
            </Row>
          )}

          {!compact && (
            <Row gap={1}>
              <Button onClick={() => openAction("rename")}>Rename</Button>
              <Button onClick={() => openAction("copy")}>Copy</Button>
              <Button onClick={() => openAction("delete")}>Delete</Button>
              <Button onClick={() => setRefreshToken((value) => value + 1)}>Reload</Button>
              <Button onClick={() => setShowHidden((value) => !value)}>
                {showHidden ? "Hide dotfiles" : "Show dotfiles"}
              </Button>
              <Button onClick={() => setSortMode((value) => nextSortMode(value))}>
                Sort {sortMode}
              </Button>
            </Row>
          )}

          {action && (
            <Modal
              title={actionTitle(action)}
              width={46}
              height={action === "delete" ? 7 : 8}
              onDismiss={() => setAction(null)}
            >
              <Column gap={1}>
                <Text>{actionPrompt(action, activeEntry()?.name ?? "")}</Text>
                {action !== "delete" && (
                  <TextInput
                    value={actionValue}
                    onChange={setActionValue}
                    onSubmit={() => void performAction()}
                    placeholder="target name"
                  />
                )}
                <Row gap={1}>
                  <Button onClick={() => setAction(null)}>Cancel</Button>
                  <Button onClick={() => void performAction()}>{actionButton(action)}</Button>
                </Row>
              </Column>
            </Modal>
          )}
        </Column>
      </Window>
    </App>
  );
}

runExample(<ExplorerApp />, import.meta.url);

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

function compareEntries(left: Entry, right: Entry, sortMode: FileSortMode): number {
  if (left.name === "..") return -1;
  if (right.name === "..") return 1;

  if (sortMode === "type" && left.isDir !== right.isDir) {
    return left.isDir ? -1 : 1;
  }
  if (sortMode === "size" && left.size !== right.size) {
    return right.size - left.size;
  }
  return left.name.localeCompare(right.name);
}

function nextSortMode(mode: FileSortMode): FileSortMode {
  if (mode === "name") return "type";
  if (mode === "type") return "size";
  return "name";
}

function isBinary(buffer: Buffer): boolean {
  const limit = Math.min(buffer.length, 4096);
  for (let index = 0; index < limit; index++) {
    if (buffer[index] === 0) return true;
  }
  return false;
}

function copyName(name: string): string {
  const extension = path.extname(name);
  const stem = extension ? name.slice(0, -extension.length) : name;
  return extension ? `${stem}.copy${extension}` : `${name}.copy`;
}

function actionTitle(action: FileAction): string {
  if (action === "rename") return "Rename entry";
  if (action === "copy") return "Copy entry";
  return "Delete entry";
}

function actionPrompt(action: FileAction, name: string): string {
  if (action === "rename") return `Rename ${name}`;
  if (action === "copy") return `Copy ${name}`;
  return `Delete ${name}? This cannot be undone.`;
}

function actionButton(action: FileAction): string {
  if (action === "rename") return "Rename";
  if (action === "copy") return "Copy";
  return "Delete";
}

function resolveTarget(cwd: string, value: string): string {
  const targetName = value.trim();
  if (targetName.length === 0) throw new Error("target name is required");
  const target = path.resolve(cwd, targetName);
  const root = path.resolve(cwd);
  if (target !== root && !target.startsWith(`${root}${path.sep}`)) {
    throw new Error("target must stay in the current directory");
  }
  return target;
}

async function copyEntry(source: string, target: string): Promise<void> {
  const stats = await fs.stat(source);
  if (stats.isDirectory()) {
    await fs.cp(source, target, { recursive: true, errorOnExist: true, force: false });
    return;
  }
  await fs.copyFile(source, target, fsConstants.COPYFILE_EXCL);
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
