#!/usr/bin/env node

import { promises as fs } from "node:fs";
import * as path from "node:path";

import {
  App,
  Badge,
  Box,
  Column,
  List,
  Panel,
  PathBreadcrumbs,
  Row,
  Text,
  Window,
  builtInThemes,
  h,
  render,
  useEffect,
  useState,
} from "../../src/index.js";

export interface FileItem {
  name: string;
  isDir: boolean;
  size: number;
  modifiedMs: number;
}

export async function listDirectory(
  dir: string,
  showHidden: boolean,
): Promise<FileItem[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const out: FileItem[] = [];
  for (const entry of entries) {
    if (!showHidden && entry.name.startsWith(".")) continue;
    const full = path.join(dir, entry.name);
    let size = 0;
    let modifiedMs = 0;
    try {
      const stat = await fs.stat(full);
      size = stat.size;
      modifiedMs = stat.mtimeMs;
    } catch {
      // unreadable — keep zeros
    }
    out.push({ name: entry.name, isDir: entry.isDirectory(), size, modifiedMs });
  }
  // Directories first, then alphabetical.
  out.sort((a, b) => {
    if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
  return out;
}

export function formatBytes(n: number): string {
  if (n < 1e3) return `${n} B`;
  if (n < 1e6) return `${(n / 1e3).toFixed(1)} KB`;
  if (n < 1e9) return `${(n / 1e6).toFixed(1)} MB`;
  return `${(n / 1e9).toFixed(2)} GB`;
}

export function isProbablyText(buffer: Buffer): boolean {
  const sample = buffer.subarray(0, Math.min(512, buffer.length));
  let suspicious = 0;
  for (const byte of sample) {
    if (byte === 0) return false;
    if (byte < 7 || (byte > 13 && byte < 32)) suspicious++;
  }
  return suspicious / Math.max(1, sample.length) < 0.1;
}

export interface ParsedFilesArgs {
  cwd: string;
  showHidden: boolean;
  theme?: string;
}

export function parseArgs(argv: readonly string[]): ParsedFilesArgs {
  let cwd = process.cwd();
  let showHidden = false;
  let theme: string | undefined;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    if (arg === "--all" || arg === "-a") {
      showHidden = true;
      continue;
    }
    if (arg === "--theme") {
      theme = argv[++i];
      continue;
    }
    if (arg === "--help" || arg === "-h") {
      console.log("gg-files [path] [--all] [--theme name]");
      process.exit(0);
    }
    if (arg.startsWith("--")) throw new Error(`unknown flag: ${arg}`);
    cwd = path.resolve(arg);
  }
  return { cwd, showHidden, theme };
}

interface AppProps {
  initialPath: string;
  showHidden: boolean;
}

function GgFilesApp(props: AppProps) {
  const [cwd, setCwd] = useState(props.initialPath);
  const [items, setItems] = useState<FileItem[]>([]);
  const [selected, setSelected] = useState(0);
  const [preview, setPreview] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    void listDirectory(cwd, props.showHidden).then(
      (entries) => {
        if (cancelled) return;
        setItems(entries);
        setSelected(0);
      },
      (err) => {
        if (cancelled) return;
        setError(String(err instanceof Error ? err.message : err));
        setItems([]);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [cwd, props.showHidden]);

  const current = items[selected];

  useEffect(() => {
    if (!current || current.isDir) {
      setPreview("");
      return;
    }
    let cancelled = false;
    const file = path.join(cwd, current.name);
    void (async () => {
      try {
        const buf = await fs.readFile(file);
        if (cancelled) return;
        if (!isProbablyText(buf)) {
          setPreview(`<binary, ${formatBytes(buf.length)}>`);
          return;
        }
        const text = buf.subarray(0, 8 * 1024).toString("utf8");
        setPreview(text);
      } catch (err) {
        if (cancelled) return;
        setPreview(`<read failed: ${String(err instanceof Error ? err.message : err)}>`);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [current?.name, current?.isDir, cwd]);

  function activate(index: number): void {
    const item = items[index];
    if (!item) return;
    if (item.isDir) {
      setCwd(path.join(cwd, item.name));
      return;
    }
  }

  function goUp(): void {
    const parent = path.dirname(cwd);
    if (parent !== cwd) setCwd(parent);
  }

  return (
    <App>
      <Window title={`gg-files · ${cwd}`} grow={1} padding={1}>
        <Column gap={1} grow={1}>
          <Row gap={1} justify="between">
            <PathBreadcrumbs path={cwd} onSelect={setCwd} />
            {error ? <Badge variant="danger">{error}</Badge> : null}
          </Row>

          <Row gap={1} grow={1}>
            <Panel title="Files" padding={0} width={36}>
              <List
                items={[{ name: "..", isDir: true, size: 0, modifiedMs: 0 }, ...items]}
                selected={selected}
                onChange={(i) => {
                  if (i === 0) {
                    goUp();
                    return;
                  }
                  setSelected(i - 1);
                }}
                onSelect={(i) => {
                  if (i === 0) {
                    goUp();
                    return;
                  }
                  activate(i - 1);
                }}
                height={20}
                render={(item: FileItem) => {
                  const glyph = item.isDir ? "▸" : "·";
                  const size = item.isDir ? "" : ` ${formatBytes(item.size).padStart(9, " ")}`;
                  return `${glyph} ${item.name}${size}`;
                }}
              />
            </Panel>
            <Panel title={current ? current.name : "Preview"} grow={1} padding={1}>
              {current?.isDir ? (
                <Text style={{ dim: true }}>(directory)</Text>
              ) : (
                <Box>
                  <Text wrap="truncate">{preview || "(empty)"}</Text>
                </Box>
              )}
            </Panel>
          </Row>

          <Box>
            <Text style={{ dim: true }}>
              {items.length} entries · {props.showHidden ? "showing hidden" : "hiding hidden"}
            </Text>
          </Box>
        </Column>
      </Window>
    </App>
  );
}

const isMain =
  typeof import.meta?.url === "string" &&
  process.argv[1] !== undefined &&
  import.meta.url === `file://${process.argv[1]}`;

if (isMain) {
  const args = parseArgs(process.argv.slice(2));
  const handle = render(<GgFilesApp initialPath={args.cwd} showHidden={args.showHidden} />);
  if (args.theme && args.theme in builtInThemes) {
    handle.setTheme(builtInThemes[args.theme as keyof typeof builtInThemes]);
  }
}
