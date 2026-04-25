/** @jsx h */

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import {
  App,
  Button,
  Column,
  List,
  Panel,
  Row,
  Text,
  Window,
  ansi,
  h,
  useCommand,
  useEffect,
  useState,
  useTerminalSize,
} from "../src/index.js";
import type { KeyEvent, ZenElement } from "../src/index.js";
import { runExample } from "./_entry.js";

const execFileAsync = promisify(execFile);

export interface GitStatusFile {
  path: string;
  indexStatus: string;
  worktreeStatus: string;
  staged: boolean;
  unstaged: boolean;
  untracked: boolean;
}

export interface GitCommit {
  hash: string;
  subject: string;
  refs?: string;
}

export interface GitSnapshot {
  repoPath: string;
  branch: string;
  upstream?: string;
  ahead: number;
  behind: number;
  files: GitStatusFile[];
  commits: GitCommit[];
  diff: string;
  clean: boolean;
  message?: string;
}

export interface GitSource {
  readSnapshot(selectedPath?: string): Promise<GitSnapshot>;
  stage(path: string): Promise<void>;
  unstage(path: string): Promise<void>;
}

export interface GitDashboardAppProps {
  source?: GitSource;
}

type GitFileFilter = "all" | "staged" | "unstaged" | "untracked";

export function GitDashboardApp(props: GitDashboardAppProps = {}) {
  const size = useTerminalSize();
  const compact = size.height < 24;
  const stacked = size.width < 104;
  const [liveSource] = useState(() => createGitSource(process.cwd()));
  const source = props.source ?? liveSource;
  const [snapshot, setSnapshot] = useState<GitSnapshot | null>(null);
  const [selectedFile, setSelectedFile] = useState(0);
  const [selectedCommit, setSelectedCommit] = useState(0);
  const [activePane, setActivePane] = useState<"files" | "commits">("files");
  const [fileFilter, setFileFilter] = useState<GitFileFilter>("all");
  const [status, setStatus] = useState("loading repository");
  const [refreshToken, setRefreshToken] = useState(0);

  const files = snapshot?.files ?? [];
  const visibleFiles = filterGitFiles(files, fileFilter);
  const commits = snapshot?.commits ?? [];
  const activeFile = visibleFiles[selectedFile] ?? null;
  const fileCounts = countGitFiles(files);
  const diffLines = formatDiffLines(snapshot?.diff ?? "", stacked ? size.width - 8 : Math.floor(size.width * 0.42));
  const fileListHeight = stacked
    ? Math.max(4, Math.min(8, Math.floor((size.height - 16) / 2)))
    : Math.max(4, Math.min(6, size.height - 26));
  const commitListHeight = stacked
    ? Math.max(3, Math.min(6, Math.floor((size.height - 18) / 2)))
    : Math.max(3, Math.min(4, size.height - 28));
  const diffHeight = stacked
    ? Math.max(4, Math.min(8, size.height - 18))
    : Math.max(7, Math.min(13, size.height - 19));

  useEffect(() => {
    let cancelled = false;
    async function refresh(): Promise<void> {
      try {
        const next = await source.readSnapshot(activeFile?.path);
        if (cancelled) return;
        setSnapshot(next);
        setStatus(next.message ?? "repository refreshed");
      } catch (error) {
        if (!cancelled) setStatus(`git error: ${messageOf(error)}`);
      }
    }

    void refresh();
    return () => {
      cancelled = true;
    };
  }, [source, activeFile?.path, refreshToken]);

  useEffect(() => {
    setSelectedFile((index) => clamp(index, visibleFiles.length));
  }, [visibleFiles.length]);

  useEffect(() => {
    setSelectedCommit((index) => clamp(index, commits.length));
  }, [commits.length]);

  async function stageSelected(): Promise<void> {
    if (!activeFile) return;
    try {
      if (activeFile.staged && !activeFile.unstaged) {
        await source.unstage(activeFile.path);
        setStatus(`unstaged ${activeFile.path}`);
      } else {
        await source.stage(activeFile.path);
        setStatus(`staged ${activeFile.path}`);
      }
      setRefreshToken((value) => value + 1);
    } catch (error) {
      setStatus(`stage failed: ${messageOf(error)}`);
    }
  }

  function onWindowKey(event: KeyEvent): boolean | void {
    if (event.ctrl || event.alt) return false;
    if (event.name === "f5") {
      setRefreshToken((value) => value + 1);
      return true;
    }
    if (event.name !== "char" || !event.char) return false;

    const key = event.char.toLowerCase();
    if (key === "s") {
      void stageSelected();
      return true;
    }
    if (key === "r") {
      setRefreshToken((value) => value + 1);
      return true;
    }
    if (key === "1") {
      setFileFilter("all");
      return true;
    }
    if (key === "2") {
      setFileFilter("unstaged");
      return true;
    }
    if (key === "3") {
      setFileFilter("staged");
      return true;
    }
    if (key === "4") {
      setFileFilter("untracked");
      return true;
    }
    if (key === "f") {
      setActivePane("files");
      return true;
    }
    if (key === "h") {
      setActivePane("commits");
      return true;
    }
    return false;
  }

  useCommand({
    id: "git-dashboard.stage",
    title: activeFile?.staged && !activeFile.unstaged ? "Unstage selected file" : "Stage selected file",
    group: "Git dashboard",
    keys: ["s"],
    run: () => {
      void stageSelected();
    },
  }, [activeFile?.path, activeFile?.staged, activeFile?.unstaged]);
  useCommand({
    id: "git-dashboard.refresh",
    title: "Refresh repository status",
    group: "Git dashboard",
    keys: ["r", "f5"],
    run: () => setRefreshToken((value) => value + 1),
  }, []);
  useCommand({
    id: "git-dashboard.filter.all",
    title: "Show all files",
    group: "Git dashboard",
    keys: ["1"],
    run: () => setFileFilter("all"),
  }, []);
  useCommand({
    id: "git-dashboard.filter.unstaged",
    title: "Show unstaged files",
    group: "Git dashboard",
    keys: ["2"],
    run: () => setFileFilter("unstaged"),
  }, []);
  useCommand({
    id: "git-dashboard.filter.staged",
    title: "Show staged files",
    group: "Git dashboard",
    keys: ["3"],
    run: () => setFileFilter("staged"),
  }, []);
  useCommand({
    id: "git-dashboard.filter.untracked",
    title: "Show untracked files",
    group: "Git dashboard",
    keys: ["4"],
    run: () => setFileFilter("untracked"),
  }, []);

  return (
    <App>
      <Window title="Git dashboard" grow={1} padding={compact ? 0 : 1} onKey={onWindowKey}>
        <Column gap={compact ? 0 : 1} grow={1}>
          <RepoSummary snapshot={snapshot} status={status} />
          <Row gap={1}>
            <FilterButton active={fileFilter === "all"} onClick={() => setFileFilter("all")}>
              All {fileCounts.all}
            </FilterButton>
            <FilterButton active={fileFilter === "unstaged"} onClick={() => setFileFilter("unstaged")}>
              Unstaged {fileCounts.unstaged}
            </FilterButton>
            <FilterButton active={fileFilter === "staged"} onClick={() => setFileFilter("staged")}>
              Staged {fileCounts.staged}
            </FilterButton>
            <FilterButton active={fileFilter === "untracked"} onClick={() => setFileFilter("untracked")}>
              New {fileCounts.untracked}
            </FilterButton>
          </Row>

          {stacked ? (
            <Column gap={compact ? 0 : 1} grow={1}>
              <GitFilesPanel
                files={visibleFiles}
                selected={selectedFile}
                onChange={(index) => {
                  setSelectedFile(index);
                  setActivePane("files");
                }}
                height={fileListHeight}
                active={activePane === "files"}
              />
              <GitCommitPanel
                commits={commits}
                selected={selectedCommit}
                onChange={(index) => {
                  setSelectedCommit(index);
                  setActivePane("commits");
                }}
                height={commitListHeight}
                active={activePane === "commits"}
              />
              <DiffPanel lines={diffLines} height={diffHeight} />
            </Column>
          ) : (
            <Row gap={1} grow={1}>
              <Column width={42} gap={1}>
                <GitFilesPanel
                files={visibleFiles}
                  selected={selectedFile}
                  onChange={(index) => {
                    setSelectedFile(index);
                    setActivePane("files");
                  }}
                  height={fileListHeight}
                  active={activePane === "files"}
                />
                <GitCommitPanel
                  commits={commits}
                  selected={selectedCommit}
                  onChange={(index) => {
                    setSelectedCommit(index);
                    setActivePane("commits");
                  }}
                  height={commitListHeight}
                  active={activePane === "commits"}
                />
              </Column>
              <DiffPanel lines={diffLines} height={diffHeight} />
            </Row>
          )}

          <Row gap={1}>
            <Button onClick={() => void stageSelected()}>{activeFile?.staged && !activeFile.unstaged ? "Unstage" : "Stage"}</Button>
            <Button onClick={() => setRefreshToken((value) => value + 1)}>Refresh</Button>
            <Text style={{ dim: true }}>
              s stage toggle | 1-4 filters | f files | h history | F5 refresh
            </Text>
          </Row>
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

runExample(<GitDashboardApp />, import.meta.url);

export function createGitSource(repoPath: string): GitSource {
  let workingTree = repoPath;
  return {
    async readSnapshot(selectedPath?: string): Promise<GitSnapshot> {
      try {
        const root = (await git(repoPath, ["rev-parse", "--show-toplevel"])).trim();
        workingTree = root;
        const statusText = await git(root, ["status", "--porcelain=v1", "-b"]);
        const files = parseStatusFiles(statusText);
        const target = selectedPath && files.some((file) => file.path === selectedPath)
          ? selectedPath
          : files[0]?.path;
        const [commits, diff] = await Promise.all([
          readCommits(root),
          readDiff(root, target),
        ]);
        const branch = parseBranch(statusText);
        return {
          repoPath: root,
          branch: branch.branch,
          upstream: branch.upstream,
          ahead: branch.ahead,
          behind: branch.behind,
          files,
          commits,
          diff,
          clean: files.length === 0,
        };
      } catch (error) {
        return {
          repoPath,
          branch: "(not a git repository)",
          ahead: 0,
          behind: 0,
          files: [],
          commits: [],
          diff: "",
          clean: true,
          message: messageOf(error),
        };
      }
    },
    async stage(filePath: string): Promise<void> {
      await git(workingTree, ["add", "--", filePath]);
    },
    async unstage(filePath: string): Promise<void> {
      await git(workingTree, ["restore", "--staged", "--", filePath]);
    },
  };
}

export function createStaticGitSource(snapshot: GitSnapshot): GitSource {
  let current = snapshot;
  return {
    async readSnapshot(): Promise<GitSnapshot> {
      return current;
    },
    async stage(filePath: string): Promise<void> {
      current = {
        ...current,
        message: `staged ${filePath}`,
        files: current.files.map((file) => file.path === filePath
          ? { ...file, staged: true, indexStatus: file.indexStatus === "?" ? "A" : file.indexStatus }
          : file),
      };
    },
    async unstage(filePath: string): Promise<void> {
      current = {
        ...current,
        message: `unstaged ${filePath}`,
        files: current.files.map((file) => file.path === filePath
          ? { ...file, staged: false, indexStatus: " " }
          : file),
      };
    },
  };
}

function RepoSummary(props: { snapshot: GitSnapshot | null; status: string }) {
  const snapshot = props.snapshot;
  const dirty = snapshot ? snapshot.files.length : 0;
  const branch = snapshot?.branch ?? "loading";
  const upstream = snapshot?.upstream ? ` -> ${snapshot.upstream}` : "";
  const divergence = snapshot && (snapshot.ahead > 0 || snapshot.behind > 0)
    ? ` | +${snapshot.ahead} -${snapshot.behind}`
    : "";

  return (
    <Panel title="Status" padding={0}>
      <Column gap={0}>
        <Text style={{ bold: true }}>{branch}{upstream}{divergence}</Text>
        <Text style={{ dim: true }}>
          {snapshot?.repoPath ?? process.cwd()} | {dirty === 0 ? "clean working tree" : `${dirty} changed file${dirty === 1 ? "" : "s"}`} | {props.status}
        </Text>
      </Column>
    </Panel>
  );
}

function GitFilesPanel(props: {
  files: GitStatusFile[];
  selected: number;
  onChange: (index: number) => void;
  height: number;
  active: boolean;
}) {
  return (
    <Panel title={props.active ? "Files *" : "Files"} padding={0}>
      {props.files.length > 0 ? (
        <List
          items={props.files}
          selected={props.selected}
          onChange={props.onChange}
          height={props.height}
          render={(file) => formatFileRow(file, 38)}
        />
      ) : (
        <Text style={{ dim: true }}>No working tree changes.</Text>
      )}
    </Panel>
  );
}

function GitCommitPanel(props: {
  commits: GitCommit[];
  selected: number;
  onChange: (index: number) => void;
  height: number;
  active: boolean;
}) {
  return (
    <Panel title={props.active ? "History *" : "History"} padding={0}>
      {props.commits.length > 0 ? (
        <List
          items={props.commits}
          selected={props.selected}
          onChange={props.onChange}
          height={props.height}
          render={(commit) => formatCommitRow(commit, 38)}
        />
      ) : (
        <Text style={{ dim: true }}>No commits available.</Text>
      )}
    </Panel>
  );
}

function DiffPanel(props: { lines: readonly string[]; height: number }) {
  const selected = 0;
  return (
    <Panel title="Diff preview" padding={0} grow={1}>
      {props.lines.length > 0 ? (
        <List
          items={props.lines}
          selected={selected}
          onChange={() => undefined}
          height={props.height}
          render={(line) => formatDiffLine(line)}
        />
      ) : (
        <Text style={{ dim: true }}>Select a changed file to preview its diff.</Text>
      )}
    </Panel>
  );
}

async function git(repoPath: string, args: readonly string[]): Promise<string> {
  const { stdout } = await execFileAsync(
    "git",
    ["-C", repoPath, ...args],
    { timeout: 2000, maxBuffer: 2 * 1024 * 1024 },
  );
  return String(stdout);
}

async function readCommits(repoPath: string): Promise<GitCommit[]> {
  try {
    const text = await git(repoPath, ["log", "--decorate=short", "--pretty=format:%h%x09%d%x09%s", "-n", "24"]);
    return text
      .split(/\r?\n/)
      .filter((line) => line.trim().length > 0)
      .map((line) => {
        const [hash = "", refs = "", subject = ""] = line.split("\t");
        return {
          hash,
          refs: refs.trim().replace(/^\((.*)\)$/, "$1"),
          subject,
        };
      });
  } catch {
    return [];
  }
}

async function readDiff(repoPath: string, selectedPath: string | undefined): Promise<string> {
  if (!selectedPath) {
    const [unstaged, staged] = await Promise.all([
      git(repoPath, ["diff", "--stat"]).catch(() => ""),
      git(repoPath, ["diff", "--cached", "--stat"]).catch(() => ""),
    ]);
    return [unstaged, staged].filter((part) => part.trim().length > 0).join("\n");
  }

  const unstaged = await git(repoPath, ["diff", "--", selectedPath]).catch(() => "");
  if (unstaged.trim().length > 0) return unstaged;
  return git(repoPath, ["diff", "--cached", "--", selectedPath]).catch(() => "");
}

function parseBranch(statusText: string): { branch: string; upstream?: string; ahead: number; behind: number } {
  const line = statusText.split(/\r?\n/)[0] ?? "";
  const raw = line.startsWith("## ") ? line.slice(3) : "unknown";
  const match = raw.match(/^([^\s.]+|\S+?)(?:\.\.\.([^\s\[]+))?(?:\s+\[(.*)\])?/);
  const details = match?.[3] ?? "";
  return {
    branch: match?.[1] ?? raw,
    upstream: match?.[2],
    ahead: Number(details.match(/ahead (\d+)/)?.[1] ?? 0),
    behind: Number(details.match(/behind (\d+)/)?.[1] ?? 0),
  };
}

function parseStatusFiles(statusText: string): GitStatusFile[] {
  return statusText
    .split(/\r?\n/)
    .filter((line) => line.length > 0 && !line.startsWith("## "))
    .map((line) => {
      const indexStatus = line[0] ?? " ";
      const worktreeStatus = line[1] ?? " ";
      const rawPath = line.slice(3);
      const filePath = rawPath.includes(" -> ") ? rawPath.split(" -> ").pop() ?? rawPath : rawPath;
      const untracked = indexStatus === "?" && worktreeStatus === "?";
      return {
        path: filePath,
        indexStatus,
        worktreeStatus,
        staged: !untracked && indexStatus !== " ",
        unstaged: untracked || worktreeStatus !== " ",
        untracked,
      };
    });
}

function filterGitFiles(files: readonly GitStatusFile[], filter: GitFileFilter): GitStatusFile[] {
  if (filter === "staged") return files.filter((file) => file.staged);
  if (filter === "unstaged") return files.filter((file) => file.unstaged);
  if (filter === "untracked") return files.filter((file) => file.untracked);
  return [...files];
}

function countGitFiles(files: readonly GitStatusFile[]): Record<GitFileFilter, number> {
  return {
    all: files.length,
    staged: files.filter((file) => file.staged).length,
    unstaged: files.filter((file) => file.unstaged).length,
    untracked: files.filter((file) => file.untracked).length,
  };
}

function formatFileRow(file: GitStatusFile, width: number): string {
  const staged = file.staged ? "S" : " ";
  const unstaged = file.unstaged ? "U" : " ";
  const status = file.untracked ? "??" : `${file.indexStatus}${file.worktreeStatus}`;
  return truncate(`${staged}${unstaged} ${status} ${file.path}`, width);
}

function formatCommitRow(commit: GitCommit, width: number): string {
  const refs = commit.refs ? ` (${commit.refs})` : "";
  return truncate(`${commit.hash} ${commit.subject}${refs}`, width);
}

function formatDiffLines(diff: string, width: number): string[] {
  return diff
    .split(/\r?\n/)
    .filter((line) => line.length > 0)
    .slice(0, 180)
    .map((line) => truncate(line.replace(/\t/g, "  "), Math.max(24, width)));
}

function formatDiffLine(line: string): ZenElement {
  if (line.startsWith("+") && !line.startsWith("+++")) {
    return <Text style={{ fg: ansi(2) }}>{line}</Text>;
  }
  if (line.startsWith("-") && !line.startsWith("---")) {
    return <Text style={{ fg: ansi(1) }}>{line}</Text>;
  }
  if (line.startsWith("@@")) {
    return <Text style={{ fg: ansi(6), bold: true }}>{line}</Text>;
  }
  return <Text>{line}</Text>;
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
