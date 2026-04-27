#!/usr/bin/env node

import { promises as fs, watch as fsWatch, type FSWatcher } from "node:fs";
import * as path from "node:path";

import {
  App,
  Badge,
  Box,
  Button,
  Column,
  LogStream,
  Panel,
  Row,
  Text,
  TextInput,
  Window,
  builtInThemes,
  h,
  render,
  useEffect,
  useState,
  type LogEntry as LogStreamEntry,
} from "../../src/index.js";

interface ParsedArgs {
  files: string[];
  follow: boolean;
  level?: string;
  regex?: string;
  theme?: string;
}

export function parseArgs(argv: readonly string[]): ParsedArgs {
  const files: string[] = [];
  let follow = true;
  let level: string | undefined;
  let regex: string | undefined;
  let theme: string | undefined;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    if (arg === "--no-follow") {
      follow = false;
      continue;
    }
    if (arg === "--level" || arg === "-l") {
      level = argv[++i];
      continue;
    }
    if (arg === "--regex" || arg === "-r") {
      regex = argv[++i];
      continue;
    }
    if (arg === "--theme") {
      theme = argv[++i];
      continue;
    }
    if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    }
    if (arg.startsWith("--")) {
      throw new Error(`unknown flag: ${arg}`);
    }
    files.push(arg);
  }
  return { files, follow, level, regex, theme };
}

function printHelp(): void {
  console.log("gg-logs <file...> [--regex pattern] [--level info] [--theme tarnished]");
  console.log("");
  console.log("Streams one or more log files. Tail mode by default; --no-follow disables.");
}

const LEVEL_PATTERN = /\b(DEBUG|INFO|WARN|ERROR|FATAL|TRACE)\b/i;

export interface ParsedLine {
  raw: string;
  level: "debug" | "info" | "warn" | "error";
  timestamp?: number;
  message: string;
}

export function parseLine(raw: string): ParsedLine {
  const match = LEVEL_PATTERN.exec(raw);
  let level: ParsedLine["level"] = "info";
  if (match) {
    const lvl = match[1]!.toUpperCase();
    if (lvl === "DEBUG" || lvl === "TRACE") level = "debug";
    else if (lvl === "WARN") level = "warn";
    else if (lvl === "ERROR" || lvl === "FATAL") level = "error";
  }
  // Best-effort ISO timestamp pickup at the head of the line.
  const tsMatch = /^(\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?)/.exec(
    raw,
  );
  const timestamp = tsMatch ? Date.parse(tsMatch[1]!) : undefined;
  return {
    raw,
    level,
    timestamp: Number.isFinite(timestamp) ? timestamp : undefined,
    message: raw,
  };
}

interface FileTail {
  path: string;
  label: string;
  cursor: number;
  watcher: FSWatcher | null;
}

/**
 * Tail one or more files. Each new line emits a `LogEntry` via `onEntry`.
 * Returns a cleanup function that stops every watcher.
 */
export async function tailFiles(
  files: readonly string[],
  follow: boolean,
  onEntry: (entry: LogStreamEntry) => void,
): Promise<() => void> {
  const tails: FileTail[] = [];
  let id = 0;

  for (const file of files) {
    const resolved = path.resolve(file);
    const label = path.basename(resolved);
    let cursor = 0;
    try {
      const stat = await fs.stat(resolved);
      cursor = Math.max(0, stat.size - 8 * 1024);
    } catch {
      // File doesn't exist yet — start at 0 and wait for it.
      cursor = 0;
    }

    const tail: FileTail = { path: resolved, label, cursor, watcher: null };
    tails.push(tail);

    async function readNew(): Promise<void> {
      try {
        const handle = await fs.open(resolved, "r");
        try {
          const { size } = await handle.stat();
          if (size < tail.cursor) {
            // File was rotated/truncated — restart at 0.
            tail.cursor = 0;
          }
          const length = size - tail.cursor;
          if (length <= 0) return;
          const buffer = Buffer.alloc(length);
          await handle.read(buffer, 0, length, tail.cursor);
          tail.cursor = size;
          for (const line of buffer.toString("utf8").split("\n")) {
            if (line.length === 0) continue;
            const parsed = parseLine(line);
            onEntry({
              id: ++id,
              level: parsed.level,
              timestamp: parsed.timestamp,
              message: `[${tail.label}] ${parsed.message}`,
            });
          }
        } finally {
          await handle.close();
        }
      } catch {
        // ignore — file may not exist yet
      }
    }

    await readNew();
    if (follow) {
      try {
        tail.watcher = fsWatch(resolved, { persistent: true }, () => {
          void readNew();
        });
      } catch {
        // best-effort; some filesystems don't support fs.watch
      }
    }
  }

  return () => {
    for (const t of tails) t.watcher?.close();
  };
}

interface AppProps {
  files: readonly string[];
  follow: boolean;
  initialLevel?: string;
  initialRegex?: string;
}

function GgLogsApp(props: AppProps) {
  const [entries, setEntries] = useState<LogStreamEntry[]>([]);
  const [filter, setFilter] = useState(props.initialRegex ?? "");
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    let stop: (() => void) | null = null;
    void tailFiles(props.files, props.follow, (entry) => {
      setEntries((current) => {
        const next = [...current, entry];
        return next.length > 1024 ? next.slice(-1024) : next;
      });
    }).then((cleanup) => {
      stop = cleanup;
    });
    return () => stop?.();
  }, [props.files, props.follow]);

  const visible = props.initialLevel
    ? entries.filter((e) => e.level === props.initialLevel)
    : entries;

  return (
    <App>
      <Window title={`gg-logs · ${props.files.join(", ")}`} grow={1} padding={1}>
        <Column gap={1} grow={1}>
          <Row gap={1}>
            <Text>filter:</Text>
            <TextInput value={filter} onChange={setFilter} grow={1} placeholder="substring or regex" />
            <Button onClick={() => setPaused((v) => !v)}>{paused ? "Resume" : "Pause"}</Button>
            {paused ? <Badge variant="warning">paused</Badge> : null}
          </Row>
          <Panel title="Stream" grow={1} padding={0}>
            <LogStream entries={visible} filter={toFilter(filter)} paused={paused} showTimestamp height={20} />
          </Panel>
          <Box>
            <Text style={{ dim: true }}>
              {entries.length} entries · {props.follow ? "follow" : "static"} ·{" "}
              {props.files.length} file{props.files.length === 1 ? "" : "s"}
            </Text>
          </Box>
        </Column>
      </Window>
    </App>
  );
}

function toFilter(value: string): string | RegExp {
  if (value.startsWith("/") && value.length > 2 && value.lastIndexOf("/") > 0) {
    const last = value.lastIndexOf("/");
    const pattern = value.slice(1, last);
    const flags = value.slice(last + 1);
    try {
      return new RegExp(pattern, flags);
    } catch {
      return value;
    }
  }
  return value;
}

const isMain =
  typeof import.meta?.url === "string" &&
  process.argv[1] !== undefined &&
  import.meta.url === `file://${process.argv[1]}`;

if (isMain) {
  const args = parseArgs(process.argv.slice(2));
  if (args.files.length === 0) {
    printHelp();
    process.exit(1);
  }
  const handle = render(
    <GgLogsApp
      files={args.files}
      follow={args.follow}
      initialLevel={args.level}
      initialRegex={args.regex}
    />,
  );
  if (args.theme && args.theme in builtInThemes) {
    handle.setTheme(builtInThemes[args.theme as keyof typeof builtInThemes]);
  }
}
