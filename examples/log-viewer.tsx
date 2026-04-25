/** @jsx h */

import { promises as fs } from "node:fs";
import * as path from "node:path";
import {
  App,
  Button,
  Column,
  List,
  Panel,
  Row,
  Text,
  TextInput,
  Window,
  ansi,
  h,
  useCommand,
  useEffect,
  useRef,
  useState,
  useTerminalSize,
} from "../src/index.js";
import type { KeyEvent, ZenElement } from "../src/index.js";
import { runExample } from "./_entry.js";

export type LogLevel = "debug" | "info" | "warn" | "error";
type LogLevelFilter = "all" | LogLevel;

export interface LogFile {
  id: string;
  label: string;
  path?: string;
}

export interface LogEntry {
  id: string;
  fileId: string;
  fileLabel: string;
  timestamp: number;
  level: LogLevel;
  message: string;
}

export type LogCursor = Record<string, number>;

export interface LogBatch {
  entries: LogEntry[];
  cursor: LogCursor;
}

export interface LogSource {
  read(cursor: LogCursor): Promise<LogBatch>;
}

export interface LogViewerAppProps {
  files?: readonly LogFile[];
  source?: LogSource;
  pollMs?: number;
}

const DEMO_FILES: readonly LogFile[] = [
  { id: "api", label: "api.log" },
  { id: "worker", label: "worker.log" },
  { id: "deploy", label: "deploy.log" },
] as const;

const DEMO_MESSAGES: ReadonlyArray<{ level: LogLevel; message: string }> = [
  { level: "info", message: "GET /v1/projects 200 42ms request_id=req_9102" },
  { level: "debug", message: "cache hit key=session:active ttl=83s" },
  { level: "warn", message: "retrying queue flush after lock contention" },
  { level: "info", message: "worker claimed job build-index priority=normal" },
  { level: "error", message: "upstream timeout while syncing billing events" },
  { level: "info", message: "deployment health check passed region=iad" },
] as const;

export function LogViewerApp(props: LogViewerAppProps = {}) {
  const size = useTerminalSize();
  const compact = size.height < 24;
  const stacked = size.width < 92;
  const [demoSource] = useState(() => createDemoLogSource(DEMO_FILES));
  const source = props.source ?? demoSource;
  const files = props.files ?? DEMO_FILES;
  const pollMs = props.pollMs ?? 900;
  const cursorRef = useRef<LogCursor>({});
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [selectedFileId, setSelectedFileId] = useState("all");
  const [selectedLog, setSelectedLog] = useState(0);
  const [query, setQuery] = useState("");
  const [regexMode, setRegexMode] = useState(false);
  const [levelFilter, setLevelFilter] = useState<LogLevelFilter>("all");
  const [paused, setPaused] = useState(false);
  const [refreshToken, setRefreshToken] = useState(0);
  const [status, setStatus] = useState("waiting for logs");

  useEffect(() => {
    let cancelled = false;
    let timer: NodeJS.Timeout | null = null;

    async function refresh(): Promise<void> {
      try {
        const batch = await source.read(cursorRef.current);
        if (cancelled) return;
        cursorRef.current = batch.cursor;
        if (batch.entries.length > 0) {
          setEntries((current) => [...current, ...batch.entries].slice(-600));
          setStatus(`streamed ${batch.entries.length} line${batch.entries.length === 1 ? "" : "s"}`);
        } else {
          setStatus("stream idle");
        }
      } catch (error) {
        if (!cancelled) setStatus(`stream error: ${messageOf(error)}`);
      }
    }

    void refresh();
    if (!paused) {
      timer = setInterval(() => {
        void refresh();
      }, pollMs);
    }

    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
    };
  }, [source, pollMs, paused, refreshToken]);

  const filter = compileLogFilter(query, regexMode);
  const tabs = [{ id: "all", label: "all files" }, ...files];
  const activeFile = tabs.find((file) => file.id === selectedFileId) ?? tabs[0]!;
  const visibleEntries = entries.filter((entry) => (
    (selectedFileId === "all" || entry.fileId === selectedFileId)
    && (levelFilter === "all" || entry.level === levelFilter)
    && filter.matches(entry)
  ));
  const counts = countEntries(entries);
  const selectedEntry = visibleEntries[selectedLog] ?? null;
  const listHeight = stacked
    ? Math.max(5, Math.min(8, size.height - 20))
    : Math.max(6, Math.min(12, size.height - 18));
  const tabHeight = stacked ? Math.min(4, tabs.length) : Math.max(4, Math.min(8, tabs.length));
  const rowWidth = stacked ? Math.max(36, size.width - 8) : Math.max(44, size.width - 42);

  useEffect(() => {
    setSelectedLog((index) => clamp(index, visibleEntries.length));
  }, [visibleEntries.length]);

  function onWindowKey(event: KeyEvent): boolean | void {
    if (event.ctrl || event.alt) return false;
    if (event.name === "space") {
      setPaused((value) => !value);
      return true;
    }
    if (event.name === "f5") {
      setRefreshToken((value) => value + 1);
      return true;
    }
    if (event.name !== "char" || !event.char) return false;

    const key = event.char.toLowerCase();
    if (key === "r") {
      setRegexMode((value) => !value);
      return true;
    }
    if (key === "c") {
      setQuery("");
      return true;
    }
    if (key === "1") {
      setLevelFilter("all");
      return true;
    }
    if (key === "2") {
      setLevelFilter("error");
      return true;
    }
    if (key === "3") {
      setLevelFilter("warn");
      return true;
    }
    if (key === "4") {
      setLevelFilter("info");
      return true;
    }
    if (key === "t") {
      const current = tabs.findIndex((file) => file.id === selectedFileId);
      const next = tabs[(current + 1) % tabs.length] ?? tabs[0]!;
      setSelectedFileId(next.id);
      return true;
    }
    return false;
  }

  useCommand({
    id: "log-viewer.pause",
    title: paused ? "Resume log stream" : "Pause log stream",
    group: "Log viewer",
    keys: ["space"],
    run: () => setPaused((value) => !value),
  }, [paused]);
  useCommand({
    id: "log-viewer.refresh",
    title: "Poll logs now",
    group: "Log viewer",
    keys: ["f5"],
    run: () => setRefreshToken((value) => value + 1),
  }, []);
  useCommand({
    id: "log-viewer.regex",
    title: regexMode ? "Disable regex filtering" : "Enable regex filtering",
    group: "Log viewer",
    keys: ["r"],
    run: () => setRegexMode((value) => !value),
  }, [regexMode]);
  useCommand({
    id: "log-viewer.clear-search",
    title: "Clear search",
    group: "Log viewer",
    keys: ["c"],
    run: () => setQuery(""),
  }, []);
  useCommand({
    id: "log-viewer.level.all",
    title: "Show all log levels",
    group: "Log viewer",
    keys: ["1"],
    run: () => setLevelFilter("all"),
  }, []);
  useCommand({
    id: "log-viewer.level.error",
    title: "Show error logs",
    group: "Log viewer",
    keys: ["2"],
    run: () => setLevelFilter("error"),
  }, []);
  useCommand({
    id: "log-viewer.level.warn",
    title: "Show warning logs",
    group: "Log viewer",
    keys: ["3"],
    run: () => setLevelFilter("warn"),
  }, []);
  useCommand({
    id: "log-viewer.level.info",
    title: "Show info logs",
    group: "Log viewer",
    keys: ["4"],
    run: () => setLevelFilter("info"),
  }, []);

  return (
    <App>
      <Window title="Log viewer" grow={1} padding={compact ? 0 : 1} onKey={onWindowKey}>
        <Column gap={compact ? 0 : 1} grow={1}>
          {!compact && (
            <Text style={{ dim: true }}>
              Stream logs, switch files with t, toggle regex with r, pause with Space, refresh with F5.
            </Text>
          )}

          <Row gap={1}>
            <TextInput
              value={query}
              onChange={setQuery}
              placeholder={regexMode ? "regex filter..." : "search logs..."}
              grow={1}
            />
            <Button onClick={() => setRegexMode((value) => !value)}>
              {regexMode ? "Regex" : "Text"}
            </Button>
            <Button onClick={() => setPaused((value) => !value)}>
              {paused ? "Resume" : "Pause"}
            </Button>
            <Button onClick={() => setQuery("")}>Clear</Button>
          </Row>

          <Row gap={1}>
            <FilterButton active={levelFilter === "all"} onClick={() => setLevelFilter("all")}>All</FilterButton>
            <FilterButton active={levelFilter === "error"} onClick={() => setLevelFilter("error")}>Errors</FilterButton>
            <FilterButton active={levelFilter === "warn"} onClick={() => setLevelFilter("warn")}>Warnings</FilterButton>
            <FilterButton active={levelFilter === "info"} onClick={() => setLevelFilter("info")}>Info</FilterButton>
            {!compact && (
              <Text style={{ dim: true }}>
                1 all | 2 errors | 3 warnings | 4 info
              </Text>
            )}
          </Row>

          {stacked ? (
            <Column gap={compact ? 0 : 1} grow={1}>
              <Panel title={`Files (${activeFile.label})`} padding={0}>
                <List
                  items={tabs}
                  selected={Math.max(0, tabs.findIndex((file) => file.id === selectedFileId))}
                  onChange={(index) => setSelectedFileId(tabs[index]?.id ?? "all")}
                  height={tabHeight}
                  render={(file) => formatFileTab(file, entries)}
                />
              </Panel>
              <LogListPanel
                entries={visibleEntries}
                selected={selectedLog}
                onChange={setSelectedLog}
                height={listHeight}
                width={rowWidth}
              />
              {!compact && <LogDetailPanel entry={selectedEntry} filterError={filter.error} counts={counts} />}
            </Column>
          ) : (
            <Row gap={1} grow={1}>
              <Column width={28} gap={1}>
                <Panel title="Files" padding={0}>
                  <List
                    items={tabs}
                    selected={Math.max(0, tabs.findIndex((file) => file.id === selectedFileId))}
                    onChange={(index) => setSelectedFileId(tabs[index]?.id ?? "all")}
                    height={tabHeight}
                    render={(file) => formatFileTab(file, entries)}
                  />
                </Panel>
                <LogDetailPanel entry={selectedEntry} filterError={filter.error} counts={counts} />
              </Column>
              <LogListPanel
                entries={visibleEntries}
                selected={selectedLog}
                onChange={setSelectedLog}
                height={listHeight}
                width={rowWidth}
              />
            </Row>
          )}

          <Text style={{ dim: true }}>
            {status} | {visibleEntries.length} visible | {entries.length} buffered | level {levelFilter} | mode {regexMode ? "regex" : "text"}
          </Text>
        </Column>
      </Window>
    </App>
  );
}

function FilterButton(props: { active: boolean; onClick: () => void; children: unknown }) {
  return (
    <Button
      onClick={props.onClick}
      style={props.active ? { fg: ansi(15), bg: ansi(4), bold: true } : undefined}
    >
      {props.children}
    </Button>
  );
}

const cliLogSource = createCliLogSource(process.argv.slice(2));
runExample(
  <LogViewerApp files={cliLogSource.files} source={cliLogSource.source} />,
  import.meta.url,
);

export function createDemoLogSource(files: readonly LogFile[] = DEMO_FILES): LogSource {
  let sequence = 0;

  return {
    async read(cursor: LogCursor): Promise<LogBatch> {
      const nextCursor = { ...cursor };
      const count = sequence === 0 ? 8 : 2;
      const entries: LogEntry[] = [];

      for (let offset = 0; offset < count; offset++) {
        const file = files[(sequence + offset) % files.length] ?? DEMO_FILES[0]!;
        const template = DEMO_MESSAGES[(sequence + offset) % DEMO_MESSAGES.length]!;
        const id = `${file.id}-${sequence + offset}`;
        entries.push({
          id,
          fileId: file.id,
          fileLabel: file.label,
          timestamp: Date.now() + offset,
          level: template.level,
          message: template.message,
        });
        nextCursor[file.id] = (nextCursor[file.id] ?? 0) + 1;
      }

      sequence += count;
      return { entries, cursor: nextCursor };
    },
  };
}

export function createStaticLogSource(entries: readonly LogEntry[]): LogSource {
  let delivered = false;
  return {
    async read(cursor: LogCursor): Promise<LogBatch> {
      if (delivered) return { entries: [], cursor };
      delivered = true;
      return {
        entries: [...entries],
        cursor: { ...cursor, static: entries.length },
      };
    },
  };
}

export function createFileLogSource(paths: readonly string[]): { files: LogFile[]; source: LogSource } {
  const files = paths.map((filePath, index) => ({
    id: `file-${index}`,
    label: path.basename(filePath),
    path: path.resolve(filePath),
  }));

  return {
    files,
    source: {
      async read(cursor: LogCursor): Promise<LogBatch> {
        const nextCursor = { ...cursor };
        const entries: LogEntry[] = [];

        for (const file of files) {
          if (!file.path) continue;
          try {
            const stats = await fs.stat(file.path);
            const previous = Math.min(nextCursor[file.id] ?? 0, stats.size);
            if (stats.size <= previous) continue;

            const text = await readFileSlice(file.path, previous, stats.size);
            nextCursor[file.id] = stats.size;
            for (const line of text.split(/\r?\n/).filter((value) => value.length > 0)) {
              entries.push(parseLogLine(file, line, `${file.id}-${previous}-${entries.length}`));
            }
          } catch (error) {
            entries.push({
              id: `${file.id}-error-${Date.now()}`,
              fileId: file.id,
              fileLabel: file.label,
              timestamp: Date.now(),
              level: "error",
              message: `could not read ${file.path}: ${messageOf(error)}`,
            });
          }
        }

        return { entries, cursor: nextCursor };
      },
    },
  };
}

function LogListPanel(props: {
  entries: LogEntry[];
  selected: number;
  onChange: (index: number) => void;
  height: number;
  width: number;
}) {
  return (
    <Panel title={`Stream (${props.entries.length})`} padding={0} grow={1}>
      {props.entries.length > 0 ? (
        <List
          items={props.entries}
          selected={props.selected}
          onChange={props.onChange}
          height={props.height}
          render={(entry) => formatLogRow(entry, props.width)}
        />
      ) : (
        <Text style={{ dim: true }}>No log lines match the current file and filter.</Text>
      )}
    </Panel>
  );
}

function LogDetailPanel(props: {
  entry: LogEntry | null;
  filterError: string | null;
  counts: Record<LogLevel, number>;
}) {
  const entry = props.entry;
  return (
    <Panel title="Details" padding={0} grow={1}>
      <Column gap={0} grow={1}>
        {props.filterError ? (
          <Text style={{ fg: ansi(1), bold: true }}>regex error: {props.filterError}</Text>
        ) : (
          <Text style={{ dim: true }}>
            errors {props.counts.error} | warnings {props.counts.warn} | info {props.counts.info}
          </Text>
        )}
        <Text style={entry ? levelStyle(entry.level) : { dim: true }}>
          {entry ? `${entry.level.toUpperCase()} ${entry.fileLabel}` : "Select a log line"}
        </Text>
        <Text>{entry ? formatTime(entry.timestamp) : "Waiting for stream data."}</Text>
        <Text style={{ dim: !entry }}>{entry?.message ?? "Use search or regex mode to narrow the stream."}</Text>
      </Column>
    </Panel>
  );
}

function createCliLogSource(args: readonly string[]): { files: readonly LogFile[]; source: LogSource } {
  const paths = args.filter((arg) => arg.trim().length > 0);
  if (paths.length === 0) {
    return { files: DEMO_FILES, source: createDemoLogSource(DEMO_FILES) };
  }
  return createFileLogSource(paths);
}

async function readFileSlice(filePath: string, start: number, end: number): Promise<string> {
  const maxBytes = 256 * 1024;
  const actualStart = Math.max(start, end - maxBytes);
  const handle = await fs.open(filePath, "r");
  try {
    const length = end - actualStart;
    const buffer = Buffer.alloc(length);
    const { bytesRead } = await handle.read(buffer, 0, length, actualStart);
    return buffer.subarray(0, bytesRead).toString("utf8");
  } finally {
    await handle.close();
  }
}

function parseLogLine(file: LogFile, line: string, id: string): LogEntry {
  const lower = line.toLowerCase();
  const level: LogLevel = lower.includes("error") || lower.includes("fatal")
    ? "error"
    : lower.includes("warn")
      ? "warn"
      : lower.includes("debug") || lower.includes("trace")
        ? "debug"
        : "info";
  return {
    id,
    fileId: file.id,
    fileLabel: file.label,
    timestamp: Date.now(),
    level,
    message: line,
  };
}

function compileLogFilter(
  query: string,
  regexMode: boolean,
): { matches: (entry: LogEntry) => boolean; error: string | null } {
  const trimmed = query.trim();
  if (trimmed.length === 0) return { matches: () => true, error: null };

  if (!regexMode) {
    const lower = trimmed.toLowerCase();
    return {
      matches: (entry) => `${entry.fileLabel} ${entry.level} ${entry.message}`.toLowerCase().includes(lower),
      error: null,
    };
  }

  try {
    const pattern = new RegExp(trimmed, "i");
    return {
      matches: (entry) => pattern.test(`${entry.fileLabel} ${entry.level} ${entry.message}`),
      error: null,
    };
  } catch (error) {
    return {
      matches: () => false,
      error: messageOf(error),
    };
  }
}

function formatFileTab(file: Pick<LogFile, "id" | "label">, entries: readonly LogEntry[]): string {
  const count = file.id === "all"
    ? entries.length
    : entries.filter((entry) => entry.fileId === file.id).length;
  return `${file.label} (${count})`;
}

function formatLogRow(entry: LogEntry, width: number): ZenElement {
  const level = entry.level.toUpperCase().padEnd(5, " ");
  const text = `${formatTime(entry.timestamp)} ${entry.fileLabel.padEnd(10, " ")} ${level} ${entry.message}`;
  return <Text style={levelStyle(entry.level)}>{truncate(text, width)}</Text>;
}

function countEntries(entries: readonly LogEntry[]): Record<LogLevel, number> {
  const counts: Record<LogLevel, number> = { debug: 0, info: 0, warn: 0, error: 0 };
  for (const entry of entries) counts[entry.level] += 1;
  return counts;
}

function levelStyle(level: LogLevel) {
  if (level === "error") return { fg: ansi(1), bold: true };
  if (level === "warn") return { fg: ansi(3), bold: true };
  if (level === "debug") return { fg: ansi(6), dim: true };
  return { fg: ansi(2) };
}

function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function truncate(value: string, width: number): string {
  if (value.length <= width) return value;
  return `${value.slice(0, Math.max(0, width - 3))}...`;
}

function clamp(index: number, length: number): number {
  if (length === 0) return 0;
  return Math.min(index, length - 1);
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
