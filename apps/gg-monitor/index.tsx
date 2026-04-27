#!/usr/bin/env node

import * as os from "node:os";

import {
  App,
  Badge,
  BarChart,
  Box,
  Column,
  Gauge,
  Panel,
  Row,
  Sparkline,
  Text,
  Window,
  builtInThemes,
  h,
  render,
  useEffect,
  useState,
} from "../../src/index.js";

interface CpuSample {
  user: number;
  nice: number;
  sys: number;
  idle: number;
  irq: number;
}

export interface SystemSnapshot {
  loadAvg: readonly [number, number, number];
  totalMemBytes: number;
  freeMemBytes: number;
  /** Per-core utilization in 0..1, derived from delta against `previous`. */
  cpuUtil: readonly number[];
  uptimeSec: number;
  hostname: string;
  platform: string;
  arch: string;
}

function readCpu(): CpuSample[] {
  return os.cpus().map((c) => ({ ...c.times }));
}

export function deltaUtil(prev: readonly CpuSample[], curr: readonly CpuSample[]): number[] {
  const out: number[] = [];
  for (let i = 0; i < curr.length; i++) {
    const a = prev[i];
    const b = curr[i]!;
    if (!a) {
      out.push(0);
      continue;
    }
    const idleDelta = b.idle - a.idle;
    const totalDelta =
      b.user -
      a.user +
      (b.nice - a.nice) +
      (b.sys - a.sys) +
      (b.idle - a.idle) +
      (b.irq - a.irq);
    if (totalDelta <= 0) {
      out.push(0);
      continue;
    }
    out.push(Math.max(0, Math.min(1, 1 - idleDelta / totalDelta)));
  }
  return out;
}

export function snapshot(prev: readonly CpuSample[]): {
  system: SystemSnapshot;
  cpu: CpuSample[];
} {
  const cpu = readCpu();
  const util = deltaUtil(prev, cpu);
  return {
    cpu,
    system: {
      loadAvg: os.loadavg() as [number, number, number],
      totalMemBytes: os.totalmem(),
      freeMemBytes: os.freemem(),
      cpuUtil: util,
      uptimeSec: os.uptime(),
      hostname: os.hostname(),
      platform: process.platform,
      arch: process.arch,
    },
  };
}

function formatBytes(n: number): string {
  if (n >= 1e12) return `${(n / 1e12).toFixed(2)} TB`;
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)} GB`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(0)} MB`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(0)} KB`;
  return `${n} B`;
}

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return d > 0 ? `${d}d ${h}h ${m}m` : h > 0 ? `${h}h ${m}m` : `${m}m`;
}

interface GgMonitorAppProps {
  intervalMs?: number;
}

function GgMonitorApp(props: GgMonitorAppProps) {
  const interval = props.intervalMs ?? 1000;
  const [prevCpu, setPrevCpu] = useState<readonly CpuSample[]>(readCpu);
  const [snap, setSnap] = useState<SystemSnapshot | null>(null);
  const [history, setHistory] = useState<number[]>([]);

  useEffect(() => {
    const handle = setInterval(() => {
      const next = snapshot(prevCpu);
      setPrevCpu(next.cpu);
      setSnap(next.system);
      const avg =
        next.system.cpuUtil.reduce((a, b) => a + b, 0) /
        Math.max(1, next.system.cpuUtil.length);
      setHistory((current) => {
        const updated = [...current, avg];
        return updated.length > 64 ? updated.slice(-64) : updated;
      });
    }, interval);
    return () => clearInterval(handle);
  }, [interval, prevCpu]);

  if (!snap) {
    return (
      <App>
        <Window title="gg-monitor" grow={1} padding={1}>
          <Text style={{ dim: true }}>collecting metrics…</Text>
        </Window>
      </App>
    );
  }

  const memUsed = snap.totalMemBytes - snap.freeMemBytes;
  const memUtil = memUsed / Math.max(1, snap.totalMemBytes);
  const avgCpu =
    snap.cpuUtil.reduce((a, b) => a + b, 0) / Math.max(1, snap.cpuUtil.length);

  const cpuBars = snap.cpuUtil.map((value, index) => ({
    label: `core${index}`,
    value: Math.round(value * 100),
  }));

  return (
    <App>
      <Window title={`gg-monitor · ${snap.hostname}`} grow={1} padding={1}>
        <Column gap={1} grow={1}>
          <Row gap={2}>
            <Box>
              <Text>{snap.platform}/{snap.arch} · uptime {formatUptime(snap.uptimeSec)}</Text>
            </Box>
            <Badge variant={avgCpu > 0.9 ? "danger" : avgCpu > 0.7 ? "warning" : "info"}>
              CPU {Math.round(avgCpu * 100)}%
            </Badge>
            <Badge variant={memUtil > 0.9 ? "danger" : memUtil > 0.7 ? "warning" : "info"}>
              MEM {Math.round(memUtil * 100)}%
            </Badge>
            <Text style={{ dim: true }}>
              load: {snap.loadAvg.map((n) => n.toFixed(2)).join(" ")}
            </Text>
          </Row>

          <Row gap={1}>
            <Panel title="CPU history" grow={1} padding={1}>
              <Column gap={1}>
                <Sparkline values={history} />
                <Gauge value={avgCpu} thresholds={[0.7, 0.9]} showPercent label="avg" width={28} />
              </Column>
            </Panel>
            <Panel title="Memory" width={36} padding={1}>
              <Column gap={1}>
                <Gauge value={memUtil} thresholds={[0.7, 0.9]} showPercent label="used" width={20} />
                <Text style={{ dim: true }}>
                  used: {formatBytes(memUsed)} / {formatBytes(snap.totalMemBytes)}
                </Text>
                <Text style={{ dim: true }}>free: {formatBytes(snap.freeMemBytes)}</Text>
              </Column>
            </Panel>
          </Row>

          <Panel title="Per-core utilization" grow={1} padding={0}>
            <BarChart data={cpuBars} max={100} showValue width={60} />
          </Panel>
        </Column>
      </Window>
    </App>
  );
}

export interface ParsedMonitorArgs {
  intervalMs: number;
  theme?: string;
}

export function parseArgs(argv: readonly string[]): ParsedMonitorArgs {
  let intervalMs = 1000;
  let theme: string | undefined;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    if (arg === "--interval" || arg === "-i") {
      const next = argv[++i];
      const ms = Number(next);
      if (!Number.isFinite(ms) || ms < 100) {
        throw new Error("--interval requires a number ≥ 100 (ms)");
      }
      intervalMs = ms;
      continue;
    }
    if (arg === "--theme") {
      theme = argv[++i];
      continue;
    }
    if (arg === "--help" || arg === "-h") {
      console.log("gg-monitor [--interval ms] [--theme name]");
      console.log("");
      console.log("Live CPU / memory / load average via the os module.");
      process.exit(0);
    }
    throw new Error(`unknown flag: ${arg}`);
  }
  return { intervalMs, theme };
}

const isMain =
  typeof import.meta?.url === "string" &&
  process.argv[1] !== undefined &&
  import.meta.url === `file://${process.argv[1]}`;

if (isMain) {
  const args = parseArgs(process.argv.slice(2));
  const handle = render(<GgMonitorApp intervalMs={args.intervalMs} />);
  if (args.theme && args.theme in builtInThemes) {
    handle.setTheme(builtInThemes[args.theme as keyof typeof builtInThemes]);
  }
}
