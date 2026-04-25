/** @jsx h */

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
  useState,
  useTerminalSize,
} from "../src/index.js";
import type { KeyEvent } from "../src/index.js";
import { runExample } from "./_entry.js";
import {
  createSystemMonitorSource,
  type MonitorProcess,
  type MonitorSnapshot,
  type MonitorSource,
} from "./system-monitor-data.js";

type ProcessSortKey = "cpu" | "memory" | "pid" | "name";

interface HistoryState {
  cpu: number[];
  memory: number[];
  disk: number[];
  network: number[];
}

export interface SystemMonitorAppProps {
  source?: MonitorSource;
  pollMs?: number;
}

export function SystemMonitorApp(props: SystemMonitorAppProps = {}) {
  const size = useTerminalSize();
  const compact = size.height < 28;
  const stacked = size.width < 106;
  const [liveSource] = useState(() => createSystemMonitorSource());
  const source = props.source ?? liveSource;
  const pollMs = props.pollMs ?? 1200;
  const historyLimit = size.width >= 132 ? 28 : size.width >= 106 ? 24 : 18;
  const [snapshot, setSnapshot] = useState<MonitorSnapshot | null>(null);
  const [history, setHistory] = useState<HistoryState>(() => ({
    cpu: [],
    memory: [],
    disk: [],
    network: [],
  }));
  const [selectedPid, setSelectedPid] = useState<number | null>(null);
  const [sortKey, setSortKey] = useState<ProcessSortKey>("cpu");
  const [descending, setDescending] = useState(true);
  const [filter, setFilter] = useState("");
  const [paused, setPaused] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState(0);

  useEffect(() => {
    let cancelled = false;
    let timer: NodeJS.Timeout | null = null;

    async function refresh(): Promise<void> {
      try {
        const next = await source.readSnapshot();
        if (cancelled) return;
        setSnapshot(next);
        setLastUpdated(next.capturedAt);
        setLastError(null);
        setHistory((current) => ({
          cpu: appendPoint(current.cpu, next.cpuPercent, historyLimit),
          memory: appendPoint(
            current.memory,
            percentOf(next.memoryUsed, next.memoryTotal),
            historyLimit,
          ),
          disk: appendPoint(current.disk, percentOf(next.diskUsed, next.diskTotal), historyLimit),
          network: appendPoint(
            current.network,
            clampPercent(scaleNetworkTraffic(next.networkRxPerSecond, next.networkTxPerSecond)),
            historyLimit,
          ),
        }));
      } catch (error) {
        if (cancelled) return;
        setLastError(messageOf(error));
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
  }, [source, pollMs, paused, refreshToken, historyLimit]);

  const processes = sortProcesses(
    filterProcesses(snapshot?.processes ?? [], filter),
    sortKey,
    descending,
  );

  useEffect(() => {
    if (processes.length === 0) {
      if (selectedPid !== null) setSelectedPid(null);
      return;
    }
    if (!processes.some((process) => process.pid === selectedPid)) {
      setSelectedPid(processes[0]!.pid);
    }
  }, [processes, selectedPid]);

  const selectedIndex = Math.max(
    0,
    processes.findIndex((process) => process.pid === selectedPid),
  );
  const selectedProcess = processes[selectedIndex] ?? null;
  const memoryPercent = snapshot ? percentOf(snapshot.memoryUsed, snapshot.memoryTotal) : 0;
  const diskPercent = snapshot ? percentOf(snapshot.diskUsed, snapshot.diskTotal) : 0;
  const listHeight = stacked
    ? compact
      ? Math.max(4, Math.min(8, size.height - 20))
      : Math.max(6, Math.min(10, size.height - 18))
    : size.width >= 132
      ? Math.max(9, Math.min(16, size.height - 16))
      : Math.max(4, Math.min(10, size.height - 26));
  const processRowWidth = stacked
    ? Math.max(32, size.width - 12)
    : Math.max(30, Math.floor(size.width * 0.45));

  function onWindowKey(event: KeyEvent): boolean | void {
    if (event.ctrl || event.alt) return false;
    if (event.name === "space") {
      setPaused((value) => !value);
      return true;
    }
    if (event.name !== "char") return false;
    if (!event.char) return false;

    const key = event.char.toLowerCase();
    if (key === "c") {
      setSortKey("cpu");
      setDescending(true);
      return true;
    }
    if (key === "m") {
      setSortKey("memory");
      setDescending(true);
      return true;
    }
    if (key === "p") {
      setSortKey("pid");
      setDescending(false);
      return true;
    }
    if (key === "n") {
      setSortKey("name");
      setDescending(false);
      return true;
    }
    if (key === "r") {
      setDescending((value) => !value);
      return true;
    }
    if (key === "u") {
      setRefreshToken((value) => value + 1);
      return true;
    }
    return false;
  }

  useCommand(
    {
      id: "system-monitor.pause",
      title: paused ? "Resume polling" : "Pause polling",
      group: "System monitor",
      keys: ["space"],
      run: () => setPaused((value) => !value),
    },
    [paused],
  );
  useCommand(
    {
      id: "system-monitor.refresh",
      title: "Refresh metrics",
      group: "System monitor",
      keys: ["u"],
      run: () => setRefreshToken((value) => value + 1),
    },
    [],
  );
  useCommand(
    {
      id: "system-monitor.sort-cpu",
      title: "Sort processes by CPU",
      group: "System monitor",
      keys: ["c"],
      run: () => {
        setSortKey("cpu");
        setDescending(true);
      },
    },
    [],
  );
  useCommand(
    {
      id: "system-monitor.sort-memory",
      title: "Sort processes by memory",
      group: "System monitor",
      keys: ["m"],
      run: () => {
        setSortKey("memory");
        setDescending(true);
      },
    },
    [],
  );
  useCommand(
    {
      id: "system-monitor.reverse",
      title: "Reverse process sort",
      group: "System monitor",
      keys: ["r"],
      run: () => setDescending((value) => !value),
    },
    [],
  );

  const statusLine = buildStatusLine({
    snapshot,
    pollMs,
    paused,
    lastUpdated,
    lastError,
    processCount: processes.length,
    sortKey,
    descending,
    filter,
  });

  return (
    <App>
      <Window title="System monitor" grow={1} padding={compact ? 0 : 1} onKey={onWindowKey}>
        <Column gap={0} grow={1}>
          {!compact && (
            <Text style={{ dim: true }}>
              A live terminal dashboard: sort with c/m/p/n, reverse with r, refresh with u, pause
              with Space.
            </Text>
          )}

          {size.width >= 132 ? (
            <Row gap={1}>
              <MetricPanel
                title="CPU"
                accent={ansi(6)}
                primary={`${formatPercent(snapshot?.cpuPercent ?? 0)} busy`}
                secondary={`load ${formatLoadAverage(snapshot?.loadAverage ?? [0, 0, 0])}`}
                sparkline={sparkline(history.cpu)}
              />
              <MetricPanel
                title="Memory"
                accent={ansi(4)}
                primary={`${formatBytes(snapshot?.memoryUsed ?? 0)} / ${formatBytes(snapshot?.memoryTotal ?? 0)}`}
                secondary={`${formatPercent(memoryPercent)} used`}
                sparkline={sparkline(history.memory)}
              />
              <MetricPanel
                title="Disk"
                accent={ansi(3)}
                primary={`${formatBytes(snapshot?.diskUsed ?? 0)} / ${formatBytes(snapshot?.diskTotal ?? 0)}`}
                secondary={`${formatPercent(diskPercent)} on ${shortPath(snapshot?.diskPath ?? process.cwd())}`}
                sparkline={sparkline(history.disk)}
              />
              <MetricPanel
                title="Network"
                accent={ansi(2)}
                primary={`rx ${formatRate(snapshot?.networkRxPerSecond ?? 0)}`}
                secondary={`tx ${formatRate(snapshot?.networkTxPerSecond ?? 0)} · ${formatInterfaceSummary(snapshot?.networkInterfaces ?? [])}`}
                sparkline={sparkline(history.network)}
              />
            </Row>
          ) : (
            <Column gap={0}>
              <Row gap={1}>
                <MetricPanel
                  title="CPU"
                  accent={ansi(6)}
                  primary={`${formatPercent(snapshot?.cpuPercent ?? 0)} busy`}
                  secondary={`load ${formatLoadAverage(snapshot?.loadAverage ?? [0, 0, 0])}`}
                  sparkline={sparkline(history.cpu)}
                />
                <MetricPanel
                  title="Memory"
                  accent={ansi(4)}
                  primary={`${formatBytes(snapshot?.memoryUsed ?? 0)} / ${formatBytes(snapshot?.memoryTotal ?? 0)}`}
                  secondary={`${formatPercent(memoryPercent)} used`}
                  sparkline={sparkline(history.memory)}
                />
              </Row>
              <Row gap={1}>
                <MetricPanel
                  title="Disk"
                  accent={ansi(3)}
                  primary={`${formatBytes(snapshot?.diskUsed ?? 0)} / ${formatBytes(snapshot?.diskTotal ?? 0)}`}
                  secondary={`${formatPercent(diskPercent)} on ${shortPath(snapshot?.diskPath ?? process.cwd())}`}
                  sparkline={sparkline(history.disk)}
                />
                <MetricPanel
                  title="Network"
                  accent={ansi(2)}
                  primary={`rx ${formatRate(snapshot?.networkRxPerSecond ?? 0)}`}
                  secondary={`tx ${formatRate(snapshot?.networkTxPerSecond ?? 0)} · ${formatInterfaceSummary(snapshot?.networkInterfaces ?? [])}`}
                  sparkline={sparkline(history.network)}
                />
              </Row>
            </Column>
          )}

          {stacked ? (
            <Column gap={0} grow={1}>
              <ProcessPanel
                processes={processes}
                selectedIndex={selectedIndex}
                listHeight={listHeight}
                rowWidth={processRowWidth}
                onSelect={(index) => {
                  setSelectedPid(processes[index]?.pid ?? null);
                }}
              />
              {!compact && (
                <SelectionPanel
                  snapshot={snapshot}
                  process={selectedProcess}
                  filter={filter}
                  visibleCount={processes.length}
                />
              )}
            </Column>
          ) : (
            <Row gap={1} grow={1}>
              <ProcessPanel
                processes={processes}
                selectedIndex={selectedIndex}
                listHeight={listHeight}
                rowWidth={processRowWidth}
                onSelect={(index) => {
                  setSelectedPid(processes[index]?.pid ?? null);
                }}
              />
              <SelectionPanel
                snapshot={snapshot}
                process={selectedProcess}
                filter={filter}
                visibleCount={processes.length}
              />
            </Row>
          )}

          {stacked ? (
            <Column gap={0}>
              <TextInput value={filter} onChange={setFilter} placeholder="filter processes..." />
              <Row gap={1}>
                <Button onClick={() => setRefreshToken((value) => value + 1)}>Refresh</Button>
                <Button onClick={() => setPaused((value) => !value)}>
                  {paused ? "Resume" : "Pause"}
                </Button>
                <Button onClick={() => setFilter("")}>Clear</Button>
              </Row>
            </Column>
          ) : (
            <Row gap={1}>
              <TextInput
                value={filter}
                onChange={setFilter}
                placeholder="filter processes..."
                grow={1}
              />
              <Button onClick={() => setRefreshToken((value) => value + 1)}>Refresh</Button>
              <Button onClick={() => setPaused((value) => !value)}>
                {paused ? "Resume" : "Pause"}
              </Button>
              <Button onClick={() => setFilter("")}>Clear</Button>
            </Row>
          )}

          <Text style={{ dim: true }}>{statusLine}</Text>
        </Column>
      </Window>
    </App>
  );
}

runExample(<SystemMonitorApp />, import.meta.url);

function MetricPanel(props: {
  title: string;
  accent: ReturnType<typeof ansi>;
  primary: string;
  secondary: string;
  sparkline: string;
}) {
  return (
    <Panel
      title={props.title}
      padding={0}
      height={3}
      grow={1}
      borderStyle={{ fg: props.accent }}
      titleStyle={{ fg: props.accent, bold: true }}
    >
      <Column gap={0} grow={1}>
        <Text style={{ bold: true }}>{props.primary}</Text>
        <Text style={{ dim: true }}>{props.secondary}</Text>
        <Text style={{ fg: props.accent }}>{props.sparkline}</Text>
      </Column>
    </Panel>
  );
}

function ProcessPanel(props: {
  processes: MonitorProcess[];
  selectedIndex: number;
  listHeight: number;
  rowWidth: number;
  onSelect: (index: number) => void;
}) {
  return (
    <Panel title={`Processes (${props.processes.length})`} padding={0} grow={1}>
      <Column gap={0} grow={1}>
        <Text style={{ dim: true }}>{formatProcessHeader(props.rowWidth)}</Text>
        {props.processes.length > 0 ? (
          <List
            items={props.processes}
            selected={props.selectedIndex}
            onChange={props.onSelect}
            height={props.listHeight}
            render={(process) => formatProcessRow(process, props.rowWidth)}
          />
        ) : (
          <Text style={{ dim: true }}>No processes match the current filter.</Text>
        )}
      </Column>
    </Panel>
  );
}

function SelectionPanel(props: {
  snapshot: MonitorSnapshot | null;
  process: MonitorProcess | null;
  filter: string;
  visibleCount: number;
}) {
  return (
    <Panel title="Selected" padding={0} width={36}>
      <Column gap={0} grow={1}>
        <Text style={{ bold: true }}>
          {props.process
            ? `${props.process.command} · pid ${props.process.pid}`
            : (props.snapshot?.hostname ?? "Loading host...")}
        </Text>
        <Text style={{ dim: true }}>
          {props.process
            ? `${formatPercent(props.process.cpuPercent)} cpu · ${formatPercent(props.process.memoryPercent)} mem · ${props.process.state}`
            : `${props.snapshot?.platform ?? process.platform} · uptime ${formatDuration(props.snapshot?.uptimeSeconds ?? 0)}`}
        </Text>
        <Text>
          {truncateText(
            props.process?.args || shortPath(props.snapshot?.diskPath ?? process.cwd()),
            34,
          )}
        </Text>
        <Text style={{ dim: true }}>
          {props.snapshot
            ? `${props.visibleCount} visible · ${formatInterfaceSummary(props.snapshot.networkInterfaces)}`
            : "Collecting live system counters..."}
        </Text>
      </Column>
    </Panel>
  );
}

function sortProcesses(
  processes: MonitorProcess[],
  sortKey: ProcessSortKey,
  descending: boolean,
): MonitorProcess[] {
  const sorted = [...processes];
  sorted.sort((left, right) => {
    const direction = descending ? -1 : 1;
    if (sortKey === "cpu") {
      return (
        compareNumbers(left.cpuPercent, right.cpuPercent, direction) ||
        compareNumbers(left.pid, right.pid, -1)
      );
    }
    if (sortKey === "memory") {
      return (
        compareNumbers(left.memoryPercent, right.memoryPercent, direction) ||
        compareNumbers(left.pid, right.pid, -1)
      );
    }
    if (sortKey === "pid") {
      return compareNumbers(left.pid, right.pid, direction);
    }
    return (
      direction * left.command.localeCompare(right.command) ||
      compareNumbers(left.pid, right.pid, -1)
    );
  });
  return sorted;
}

function filterProcesses(processes: MonitorProcess[], filter: string): MonitorProcess[] {
  const query = filter.trim().toLowerCase();
  if (query.length === 0) return processes;
  return processes.filter(
    (process) =>
      process.command.toLowerCase().includes(query) ||
      process.args.toLowerCase().includes(query) ||
      String(process.pid).includes(query),
  );
}

function appendPoint(values: number[], next: number, limit: number): number[] {
  const trimmed = values.length >= limit ? values.slice(values.length - limit + 1) : values;
  return [...trimmed, next];
}

function sparkline(values: number[]): string {
  const blocks = "▁▂▃▄▅▆▇█";
  if (values.length === 0) return "waiting for samples";
  const maxValue = Math.max(1, ...values);
  return values
    .map((value) => {
      const index = Math.max(
        0,
        Math.min(blocks.length - 1, Math.round((value / maxValue) * (blocks.length - 1))),
      );
      return blocks[index] ?? blocks[0]!;
    })
    .join("");
}

function scaleNetworkTraffic(rxPerSecond: number, txPerSecond: number): number {
  const peak = Math.max(rxPerSecond, txPerSecond);
  if (peak <= 0) return 0;
  return Math.min(100, Math.log10(peak + 1) * 20);
}

function formatProcessHeader(width: number): string {
  const nameWidth = Math.max(8, width - 25);
  return `${padLeft("PID", 6)} ${padLeft("CPU", 5)} ${padLeft("MEM", 5)} ${padRight("S", 1)} ${padRight("NAME", nameWidth)}`;
}

function formatProcessRow(process: MonitorProcess, width: number): string {
  const nameWidth = Math.max(8, width - 25);
  return [
    padLeft(String(process.pid), 6),
    padLeft(process.cpuPercent.toFixed(1), 5),
    padLeft(process.memoryPercent.toFixed(1), 5),
    padRight(process.state.slice(0, 1), 1),
    padRight(truncateText(process.command, nameWidth), nameWidth),
  ].join(" ");
}

function buildStatusLine(props: {
  snapshot: MonitorSnapshot | null;
  pollMs: number;
  paused: boolean;
  lastUpdated: number | null;
  lastError: string | null;
  processCount: number;
  sortKey: ProcessSortKey;
  descending: boolean;
  filter: string;
}): string {
  const cadence = props.paused
    ? "paused"
    : `refresh ${Math.max(0.1, props.pollMs / 1000).toFixed(1)}s`;
  const updated = props.lastUpdated ? `updated ${formatClock(props.lastUpdated)}` : "warming up";
  const error = props.lastError ? ` · fallback ${truncateText(props.lastError, 28)}` : "";
  const filterSummary =
    props.filter.trim().length > 0 ? truncateText(props.filter.trim(), 12) : "all";
  return `${props.snapshot?.hostname ?? "host"} · ${cadence} · ${updated} · sort ${props.sortKey} ${props.descending ? "desc" : "asc"} · filter ${filterSummary} · ${props.processCount} rows${error}`;
}

function compareNumbers(left: number, right: number, direction: number): number {
  if (left === right) return 0;
  return left < right ? -direction : direction;
}

function truncateText(value: string, width: number): string {
  if (width <= 1) return value.slice(0, Math.max(0, width));
  if (value.length <= width) return value;
  return `${value.slice(0, Math.max(0, width - 1))}…`;
}

function padLeft(value: string, width: number): string {
  return value.length >= width ? value : `${" ".repeat(width - value.length)}${value}`;
}

function padRight(value: string, width: number): string {
  return value.length >= width ? value : `${value}${" ".repeat(width - value.length)}`;
}

function shortPath(value: string): string {
  return value.replace(process.cwd(), ".");
}

function percentOf(part: number, whole: number): number {
  if (whole <= 0) return 0;
  return clampPercent((part / whole) * 100);
}

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, value));
}

function formatPercent(value: number): string {
  return `${clampPercent(value).toFixed(1)}%`;
}

function formatBytes(value: number): string {
  if (value <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let amount = value;
  let unitIndex = 0;
  while (amount >= 1024 && unitIndex < units.length - 1) {
    amount /= 1024;
    unitIndex += 1;
  }
  const fixed = amount >= 10 || unitIndex === 0 ? amount.toFixed(0) : amount.toFixed(1);
  return `${fixed} ${units[unitIndex]}`;
}

function formatRate(value: number): string {
  return `${formatBytes(value)}/s`;
}

function formatDuration(seconds: number): string {
  const totalSeconds = Math.max(0, Math.floor(seconds));
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function formatClock(value: number): string {
  return new Date(value).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function formatLoadAverage(values: [number, number, number]): string {
  return values.map((value) => value.toFixed(2)).join(" / ");
}

function formatInterfaceSummary(interfaces: string[]): string {
  if (interfaces.length === 0) return "no interfaces";
  if (interfaces.length === 1) return interfaces[0]!;
  return `${interfaces[0]} +${interfaces.length - 1}`;
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
