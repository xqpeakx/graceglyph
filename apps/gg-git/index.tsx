#!/usr/bin/env node

import { execFile } from "node:child_process";
import { promisify } from "node:util";

import {
  App,
  Badge,
  Box,
  Column,
  DiffView,
  List,
  Panel,
  Row,
  Tabs,
  Text,
  Window,
  builtInThemes,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  h,
  parseUnifiedDiff,
  render,
  useEffect,
  useState,
} from "../../src/index.js";

const exec = promisify(execFile);

export interface GitStatusEntry {
  path: string;
  index: string;
  worktree: string;
}

export function parsePorcelain(stdout: string): GitStatusEntry[] {
  const out: GitStatusEntry[] = [];
  for (const line of stdout.split("\n")) {
    if (line.length < 4) continue;
    const index = line[0]!;
    const worktree = line[1]!;
    const path = line.slice(3);
    out.push({ index, worktree, path });
  }
  return out;
}

async function git(cwd: string, args: readonly string[]): Promise<string> {
  const { stdout } = await exec("git", [...args], { cwd, maxBuffer: 16 * 1024 * 1024 });
  return stdout;
}

export interface GitSummary {
  branch: string;
  upstream: string | null;
  ahead: number;
  behind: number;
  status: GitStatusEntry[];
}

export async function readGitSummary(cwd: string): Promise<GitSummary> {
  const status = parsePorcelain(await git(cwd, ["status", "--porcelain"]));
  let branch = "HEAD";
  let upstream: string | null = null;
  let ahead = 0;
  let behind = 0;
  try {
    branch = (await git(cwd, ["branch", "--show-current"])).trim() || "HEAD";
  } catch {
    // detached
  }
  try {
    upstream = (await git(cwd, ["rev-parse", "--abbrev-ref", "@{u}"])).trim();
    const counts = (
      await git(cwd, ["rev-list", "--left-right", "--count", `${branch}...${upstream}`])
    ).trim();
    const [a, b] = counts.split(/\s+/).map((n) => Number(n));
    ahead = a ?? 0;
    behind = b ?? 0;
  } catch {
    // no upstream — leave defaults
  }
  return { branch, upstream, ahead, behind, status };
}

export async function readDiff(cwd: string, target: string): Promise<string> {
  try {
    return await git(cwd, ["diff", "--", target]);
  } catch {
    return "";
  }
}

export async function readLog(cwd: string, limit = 20): Promise<string[]> {
  try {
    const stdout = await git(cwd, ["log", `-n${limit}`, "--pretty=format:%h %s (%an, %ar)"]);
    return stdout.split("\n").filter((line) => line.length > 0);
  } catch {
    return [];
  }
}

export interface ParsedGitArgs {
  cwd: string;
  theme?: string;
}

export function parseArgs(argv: readonly string[]): ParsedGitArgs {
  let cwd = process.cwd();
  let theme: string | undefined;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    if (arg === "--theme") {
      theme = argv[++i];
      continue;
    }
    if (arg === "--help" || arg === "-h") {
      process.stdout.write("gg-git [path] [--theme name]\n");
      process.exit(0);
    }
    if (arg.startsWith("--")) throw new Error(`unknown flag: ${arg}`);
    cwd = arg;
  }
  return { cwd, theme };
}

interface AppProps {
  cwd: string;
}

const TABS = [
  { id: "status", label: "Status" },
  { id: "diff", label: "Diff" },
  { id: "log", label: "Log" },
] as const;

function GgGitApp(props: AppProps) {
  const [tab, setTab] = useState<string>("status");
  const [summary, setSummary] = useState<GitSummary | null>(null);
  const [selected, setSelected] = useState(0);
  const [diff, setDiff] = useState<string>("");
  const [logLines, setLogLines] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function refresh(): Promise<void> {
    setError(null);
    try {
      const next = await readGitSummary(props.cwd);
      setSummary(next);
      setLogLines(await readLog(props.cwd, 30));
    } catch (err) {
      setError(String(err instanceof Error ? err.message : err));
    }
  }

  useEffect(() => {
    void refresh();
  }, [props.cwd]);

  useEffect(() => {
    if (tab !== "diff" || !summary) return;
    const entry = summary.status[selected];
    if (!entry) {
      setDiff("");
      return;
    }
    let cancelled = false;
    void readDiff(props.cwd, entry.path).then((text) => {
      if (!cancelled) setDiff(text);
    });
    return () => {
      cancelled = true;
    };
  }, [tab, selected, summary?.status, props.cwd]);

  const diffLines = parseUnifiedDiff(diff);

  return (
    <App>
      <Window title={`gg-git · ${props.cwd}`} grow={1} padding={1}>
        <Column gap={1} grow={1}>
          <Row gap={1}>
            <Badge variant="info">{summary?.branch ?? "…"}</Badge>
            {summary?.upstream ? (
              <Text style={{ dim: true }}>
                ↑{summary.ahead} ↓{summary.behind} · {summary.upstream}
              </Text>
            ) : null}
            {error ? <Badge variant="danger">{error}</Badge> : null}
          </Row>

          <Tabs tabs={TABS} selectedId={tab} onChange={setTab} />

          {tab === "status" ? (
            <Panel title="Working tree" grow={1} padding={0}>
              {summary && summary.status.length > 0 ? (
                <List
                  items={summary.status}
                  selected={selected}
                  onChange={setSelected}
                  height={18}
                  render={(entry: GitStatusEntry) =>
                    `${entry.index}${entry.worktree}  ${entry.path}`
                  }
                />
              ) : (
                <Box padding={1}>
                  <Text style={{ dim: true }}>working tree clean</Text>
                </Box>
              )}
            </Panel>
          ) : null}

          {tab === "diff" ? (
            <Panel title="Diff" grow={1} padding={0}>
              {diffLines.length > 0 ? (
                <DiffView lines={diffLines} showLineNumbers height={18} />
              ) : (
                <Box padding={1}>
                  <Text style={{ dim: true }}>no diff for selection</Text>
                </Box>
              )}
            </Panel>
          ) : null}

          {tab === "log" ? (
            <Panel title="Recent commits" grow={1} padding={0}>
              <List
                items={logLines}
                selected={0}
                onChange={() => {}}
                height={18}
                render={(line: string) => line}
              />
            </Panel>
          ) : null}
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
  const handle = render(<GgGitApp cwd={args.cwd} />);
  if (args.theme && args.theme in builtInThemes) {
    handle.setTheme(builtInThemes[args.theme as keyof typeof builtInThemes]);
  }
}
