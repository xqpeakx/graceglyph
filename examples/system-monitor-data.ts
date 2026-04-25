import { execFile } from "node:child_process";
import { statfs } from "node:fs/promises";
import * as os from "node:os";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export interface MonitorProcess {
  pid: number;
  cpuPercent: number;
  memoryPercent: number;
  state: string;
  command: string;
  args: string;
}

export interface MonitorSnapshot {
  capturedAt: number;
  hostname: string;
  platform: string;
  uptimeSeconds: number;
  cpuPercent: number;
  loadAverage: [number, number, number];
  memoryTotal: number;
  memoryUsed: number;
  diskPath: string;
  diskTotal: number;
  diskUsed: number;
  networkRxPerSecond: number;
  networkTxPerSecond: number;
  networkInterfaces: string[];
  processes: MonitorProcess[];
}

export interface MonitorSource {
  readSnapshot(): Promise<MonitorSnapshot>;
}

interface CpuTotals {
  idle: number;
  total: number;
}

interface NetworkTotals {
  available: boolean;
  rxBytes: number;
  txBytes: number;
  interfaces: string[];
}

export interface SystemMonitorSourceOptions {
  diskPath?: string;
}

export function createSystemMonitorSource(
  options: SystemMonitorSourceOptions = {},
): MonitorSource {
  const diskPath = options.diskPath ?? process.cwd();
  let previousCpu = readCpuTotals();
  let previousNetwork: NetworkTotals | null = null;
  let previousNetworkAt = Date.now();

  return {
    async readSnapshot(): Promise<MonitorSnapshot> {
      const capturedAt = Date.now();
      const cpuTotals = readCpuTotals();
      const cpuPercent = computeCpuPercent(previousCpu, cpuTotals);
      previousCpu = cpuTotals;

      const [disk, network, processes] = await Promise.all([
        readDiskUsage(diskPath),
        readNetworkTotals(),
        readProcessTable(),
      ]);

      let networkRxPerSecond = 0;
      let networkTxPerSecond = 0;
      if (previousNetwork && previousNetwork.available && network.available) {
        const elapsedSeconds = Math.max(0.25, (capturedAt - previousNetworkAt) / 1000);
        networkRxPerSecond = Math.max(0, (network.rxBytes - previousNetwork.rxBytes) / elapsedSeconds);
        networkTxPerSecond = Math.max(0, (network.txBytes - previousNetwork.txBytes) / elapsedSeconds);
      }
      previousNetwork = network;
      previousNetworkAt = capturedAt;

      const loadAverage = os.loadavg();
      const totalMemory = os.totalmem();
      const freeMemory = os.freemem();

      return {
        capturedAt,
        hostname: os.hostname(),
        platform: process.platform,
        uptimeSeconds: os.uptime(),
        cpuPercent,
        loadAverage: [
          loadAverage[0] ?? 0,
          loadAverage[1] ?? 0,
          loadAverage[2] ?? 0,
        ],
        memoryTotal: totalMemory,
        memoryUsed: Math.max(0, totalMemory - freeMemory),
        diskPath,
        diskTotal: disk.total,
        diskUsed: disk.used,
        networkRxPerSecond,
        networkTxPerSecond,
        networkInterfaces: network.interfaces,
        processes,
      };
    },
  };
}

export function createStaticMonitorSource(
  snapshot: MonitorSnapshot,
): MonitorSource {
  return {
    async readSnapshot(): Promise<MonitorSnapshot> {
      return snapshot;
    },
  };
}

async function readDiskUsage(
  diskPath: string,
): Promise<{ total: number; used: number }> {
  try {
    const stats = await statfs(diskPath);
    const blockSize = toNumber(stats.bsize);
    const totalBlocks = toNumber(stats.blocks);
    const freeBlocks = toNumber(stats.bfree);
    const total = Math.max(0, blockSize * totalBlocks);
    const used = Math.max(0, total - blockSize * freeBlocks);
    return { total, used };
  } catch {
    return { total: 0, used: 0 };
  }
}

async function readProcessTable(): Promise<MonitorProcess[]> {
  try {
    const { stdout } = await execFileAsync(
      "ps",
      ["-axo", "pid=,pcpu=,pmem=,state=,comm=,args="],
      { timeout: 1200, maxBuffer: 1024 * 1024 },
    );
    const output = String(stdout);
    const processes = output
      .split(/\r?\n/)
      .map(parseProcessRow)
      .filter((row): row is MonitorProcess => row !== null);
    if (processes.length > 0) {
      return processes.slice(0, 160);
    }
  } catch {
    // Fall through to a current-process-only snapshot.
  }

  return [currentProcessFallback()];
}

function parseProcessRow(row: string): MonitorProcess | null {
  const match = row.match(/^\s*(\d+)\s+([\d.]+)\s+([\d.]+)\s+(\S+)\s+(\S+)\s*(.*)$/);
  if (!match) return null;

  const pid = Number(match[1]);
  if (!Number.isFinite(pid)) return null;

  const cpuPercent = clampPercent(Number(match[2]));
  const memoryPercent = clampPercent(Number(match[3]));
  const state = match[4] ?? "?";
  const command = match[5] ?? "unknown";
  const args = (match[6] ?? "").trim();

  return {
    pid,
    cpuPercent,
    memoryPercent,
    state,
    command,
    args,
  };
}

function currentProcessFallback(): MonitorProcess {
  return {
    pid: process.pid,
    cpuPercent: 0,
    memoryPercent: clampPercent((process.memoryUsage().rss / Math.max(1, os.totalmem())) * 100),
    state: "R",
    command: process.title || "node",
    args: process.argv.slice(1).join(" "),
  };
}

async function readNetworkTotals(): Promise<NetworkTotals> {
  if (process.platform === "linux") {
    return readLinuxNetworkTotals();
  }
  if (process.platform === "darwin") {
    return readDarwinNetworkTotals();
  }

  const interfaces = Object.keys(os.networkInterfaces()).sort();
  return {
    available: false,
    rxBytes: 0,
    txBytes: 0,
    interfaces,
  };
}

async function readLinuxNetworkTotals(): Promise<NetworkTotals> {
  try {
    const { readFile } = await import("node:fs/promises");
    const text = await readFile("/proc/net/dev", "utf8");
    let rxBytes = 0;
    let txBytes = 0;
    const interfaces: string[] = [];

    for (const line of text.split(/\r?\n/).slice(2)) {
      const [rawName, rawValues] = line.split(":");
      if (!rawName || !rawValues) continue;
      const name = rawName.trim();
      const values = rawValues.trim().split(/\s+/);
      const rx = Number(values[0] ?? "0");
      const tx = Number(values[8] ?? "0");
      if (!Number.isFinite(rx) || !Number.isFinite(tx)) continue;
      interfaces.push(name);
      rxBytes += rx;
      txBytes += tx;
    }

    return {
      available: interfaces.length > 0,
      rxBytes,
      txBytes,
      interfaces: interfaces.sort(),
    };
  } catch {
    return {
      available: false,
      rxBytes: 0,
      txBytes: 0,
      interfaces: Object.keys(os.networkInterfaces()).sort(),
    };
  }
}

async function readDarwinNetworkTotals(): Promise<NetworkTotals> {
  try {
    const { stdout } = await execFileAsync(
      "netstat",
      ["-ibn"],
      { timeout: 1200, maxBuffer: 1024 * 1024 },
    );
    const lines = String(stdout).split(/\r?\n/).filter((line) => line.trim().length > 0);
    const header = lines.find((line) => line.includes("Ibytes") && line.includes("Obytes"));
    if (!header) throw new Error("netstat header missing");

    const headerColumns = header.trim().split(/\s+/);
    const nameIndex = headerColumns.indexOf("Name");
    const rxIndex = headerColumns.indexOf("Ibytes");
    const txIndex = headerColumns.indexOf("Obytes");
    if (nameIndex < 0 || rxIndex < 0 || txIndex < 0) {
      throw new Error("netstat columns missing");
    }

    const seen = new Map<string, { rxBytes: number; txBytes: number }>();
    for (const line of lines.slice(lines.indexOf(header) + 1)) {
      const columns = line.trim().split(/\s+/);
      if (columns.length <= Math.max(nameIndex, rxIndex, txIndex)) continue;
      const name = columns[nameIndex] ?? "";
      const rxBytes = Number(columns[rxIndex] ?? "NaN");
      const txBytes = Number(columns[txIndex] ?? "NaN");
      if (!name || !Number.isFinite(rxBytes) || !Number.isFinite(txBytes)) continue;

      const existing = seen.get(name);
      if (!existing) {
        seen.set(name, { rxBytes, txBytes });
        continue;
      }
      existing.rxBytes = Math.max(existing.rxBytes, rxBytes);
      existing.txBytes = Math.max(existing.txBytes, txBytes);
    }

    const interfaces = Array.from(seen.keys()).sort();
    return {
      available: interfaces.length > 0,
      rxBytes: interfaces.reduce((total, name) => total + (seen.get(name)?.rxBytes ?? 0), 0),
      txBytes: interfaces.reduce((total, name) => total + (seen.get(name)?.txBytes ?? 0), 0),
      interfaces,
    };
  } catch {
    return {
      available: false,
      rxBytes: 0,
      txBytes: 0,
      interfaces: Object.keys(os.networkInterfaces()).sort(),
    };
  }
}

function readCpuTotals(): CpuTotals {
  let idle = 0;
  let total = 0;
  for (const cpu of os.cpus()) {
    const times = cpu.times;
    idle += times.idle;
    total += times.user + times.nice + times.sys + times.irq + times.idle;
  }
  return { idle, total };
}

function computeCpuPercent(previous: CpuTotals, next: CpuTotals): number {
  const totalDelta = next.total - previous.total;
  const idleDelta = next.idle - previous.idle;
  if (totalDelta <= 0) return 0;
  return clampPercent(((totalDelta - idleDelta) / totalDelta) * 100);
}

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, value));
}

function toNumber(value: bigint | number): number {
  return typeof value === "bigint" ? Number(value) : value;
}
