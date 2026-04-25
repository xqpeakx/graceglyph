/** @jsx h */

import { promises as fs } from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import {
  App,
  AppShell,
  Box,
  Button,
  Column,
  type Command,
  List,
  Panel,
  Row,
  Text,
  Window,
  ansi,
  h,
  useEffect,
  useState,
  useTerminalSize,
} from "../src/index.js";
import type { KeyEvent } from "../src/index.js";
import { ApiExplorerApp } from "./api-explorer.js";
import type { ApiExplorerAppProps } from "./api-explorer.js";
import { runExample } from "./_entry.js";
import { ExplorerApp } from "./explorer.js";
import type { ExplorerAppProps } from "./explorer.js";
import { FormApp } from "./form.js";
import { GitDashboardApp } from "./git-dashboard.js";
import type { GitDashboardAppProps } from "./git-dashboard.js";
import { HelloApp } from "./hello.js";
import { LogViewerApp } from "./log-viewer.js";
import type { LogViewerAppProps } from "./log-viewer.js";
import { SystemMonitorApp } from "./system-monitor.js";
import type { SystemMonitorAppProps } from "./system-monitor.js";
import { TodoApp } from "./todo.js";

export interface ShowcaseModule {
  id: string;
  title: string;
  command: string;
  category: string;
  summary: string;
  features: readonly string[];
}

export interface DashboardShellState {
  selectedModuleId: string;
  themeId: string;
  launchCounts: Record<string, number>;
  lastOpenedAt?: number;
}

export interface DashboardShellStateStore {
  load(): Promise<Partial<DashboardShellState> | null>;
  save(state: DashboardShellState): Promise<void>;
}

export interface ShowcaseExampleProps {
  api?: ApiExplorerAppProps;
  files?: ExplorerAppProps;
  git?: GitDashboardAppProps;
  logs?: LogViewerAppProps;
  monitor?: SystemMonitorAppProps;
}

export interface DashboardShellAppProps {
  modules?: readonly ShowcaseModule[];
  store?: DashboardShellStateStore;
  examples?: ShowcaseExampleProps;
  initialModuleId?: string;
  initialOpenModuleId?: string;
}

export const SHOWCASE_MODULES: readonly ShowcaseModule[] = [
  {
    id: "system-monitor",
    title: "System monitor",
    command: "showcase://system-monitor",
    category: "ops",
    summary: "Live CPU, memory, disk, network, and process telemetry.",
    features: ["metric panels", "sparklines", "process filtering", "keyboard sorting"],
  },
  {
    id: "log-viewer",
    title: "Log viewer",
    command: "showcase://log-viewer",
    category: "ops",
    summary: "Streaming multi-file log tail with search and regex filters.",
    features: ["live stream", "regex search", "severity highlights", "file tabs"],
  },
  {
    id: "git-dashboard",
    title: "Git dashboard",
    command: "showcase://git-dashboard",
    category: "dev",
    summary: "Working tree status, staging, history, and diff preview.",
    features: ["status overview", "stage toggle", "commit history", "diff panel"],
  },
  {
    id: "api-explorer",
    title: "API explorer",
    command: "showcase://api-explorer",
    category: "data",
    summary: "Send HTTP requests and inspect structured responses.",
    features: ["method picker", "saved collections", "JSON viewer", "timing and headers"],
  },
  {
    id: "file-manager",
    title: "File manager",
    command: "showcase://file-manager",
    category: "files",
    summary: "Directory navigation, preview panes, and common file actions.",
    features: ["preview pane", "rename", "copy", "delete confirmation"],
  },
  {
    id: "hello",
    title: "Composer",
    command: "showcase://hello",
    category: "editing",
    summary: "Template-driven message composer with textarea editing and preview.",
    features: ["textarea editing", "modal preview", "template list", "event log"],
  },
  {
    id: "form",
    title: "Signup form",
    command: "showcase://form",
    category: "basics",
    summary: "Small controlled form with input, list selection, and submit flow.",
    features: ["controlled input", "list selection", "submit action", "responsive layout"],
  },
  {
    id: "todo",
    title: "Todo list",
    command: "showcase://todo",
    category: "basics",
    summary: "Keyboard-first list management with modal confirmation.",
    features: ["list updates", "keyboard shortcuts", "modal flow", "stateful UI"],
  },
] as const;

const THEMES = [
  { id: "graphite", label: "Graphite", accent: ansi(6) },
  { id: "terminal", label: "Terminal", accent: ansi(2) },
  { id: "signal", label: "Signal", accent: ansi(3) },
] as const;

export function DashboardShellApp(props: DashboardShellAppProps = {}) {
  const size = useTerminalSize();
  const compact = size.height < 24;
  const stacked = size.width < 94;
  const modules = props.modules ?? SHOWCASE_MODULES;
  const [store] = useState(() => props.store ?? createFileShellStateStore());
  const [state, setState] = useState<DashboardShellState>(() => (
    defaultShellState(modules, props.initialModuleId)
  ));
  const [selected, setSelected] = useState(() => selectedIndexFor(modules, state.selectedModuleId));
  const [openedModuleId, setOpenedModuleId] = useState<string | null>(() => (
    resolveModuleId(modules, props.initialOpenModuleId)
  ));
  const [hydrated, setHydrated] = useState(false);
  const [status, setStatus] = useState("loading shell state");

  const activeModule = modules[selected] ?? modules[0]!;
  const openedModule = openedModuleId
    ? modules.find((module) => module.id === openedModuleId) ?? null
    : null;
  const theme = THEMES.find((item) => item.id === state.themeId) ?? THEMES[0]!;
  const listHeight = stacked
    ? Math.max(5, Math.min(9, Math.floor((size.height - 14) / 2)))
    : Math.max(5, Math.min(7, size.height - 24));

  useEffect(() => {
    let cancelled = false;
    async function loadState(): Promise<void> {
      try {
        const loaded = await store.load();
        if (cancelled) return;
        const next = mergeState(
          defaultShellState(modules, props.initialModuleId),
          loaded,
          modules,
          props.initialModuleId,
        );
        setState(next);
        setSelected(selectedIndexFor(modules, next.selectedModuleId));
        setStatus(loaded ? "restored shell state" : "new shell state");
      } catch (error) {
        if (!cancelled) setStatus(`state load failed: ${messageOf(error)}`);
      } finally {
        if (!cancelled) setHydrated(true);
      }
    }

    void loadState();
    return () => {
      cancelled = true;
    };
  }, [store, modules, props.initialModuleId]);

  useEffect(() => {
    if (!hydrated) return;
    let cancelled = false;
    async function saveState(): Promise<void> {
      try {
        await store.save(state);
        if (!cancelled) setStatus("shell state saved");
      } catch (error) {
        if (!cancelled) setStatus(`state save failed: ${messageOf(error)}`);
      }
    }
    void saveState();
    return () => {
      cancelled = true;
    };
  }, [hydrated, state, store]);

  function selectModule(index: number): void {
    const next = modules[index];
    if (!next) return;
    setSelected(index);
    setState((current) => ({ ...current, selectedModuleId: next.id }));
  }

  function openModule(index: number): void {
    const module = modules[index];
    if (!module) return;
    setSelected(index);
    setState((current) => ({
      ...current,
      selectedModuleId: module.id,
      lastOpenedAt: Date.now(),
      launchCounts: {
        ...current.launchCounts,
        [module.id]: (current.launchCounts[module.id] ?? 0) + 1,
      },
    }));
    setOpenedModuleId(module.id);
    setStatus(`opened ${module.title}; Escape returns home`);
  }

  function cycleTheme(): void {
    const current = THEMES.findIndex((item) => item.id === theme.id);
    const next = THEMES[(current + 1) % THEMES.length] ?? THEMES[0]!;
    setState((value) => ({ ...value, themeId: next.id }));
  }

  function launchSelected(): void {
    openModule(selected);
  }

  function resetState(): void {
    const next = defaultShellState(modules, props.initialModuleId);
    setState(next);
    setSelected(selectedIndexFor(modules, next.selectedModuleId));
    setOpenedModuleId(null);
    setStatus("shell state reset");
  }

  function closeModule(): void {
    if (!openedModule) return;
    setOpenedModuleId(null);
    setStatus(`returned from ${openedModule.title}`);
  }

  function navigate(pathName: string): void {
    if (pathName === "/") {
      closeModule();
      return;
    }
    const id = pathName.startsWith("/apps/") ? pathName.slice("/apps/".length) : pathName;
    const index = modules.findIndex((module) => module.id === id);
    if (index >= 0) openModule(index);
  }

  const pathName = openedModule ? `/apps/${openedModule.id}` : "/";
  const breadcrumbs = openedModule
    ? [
      { label: "Showcase", path: "/" },
      { label: openedModule.title, path: pathName },
    ]
    : [{ label: "Showcase", path: "/" }];
  const commands = createShellCommands({
    modules,
    selected,
    openedModuleId: openedModule?.id ?? null,
    openModule,
    selectModule,
    launchSelected,
    cycleTheme,
    resetState,
    closeModule,
  });

  function onWindowKey(event: KeyEvent): boolean | void {
    if (event.ctrl || event.alt) return false;
    if (event.name !== "char" || !event.char) return false;
    const key = event.char.toLowerCase();
    if (key === "o") {
      launchSelected();
      return true;
    }
    if (key === "t") {
      cycleTheme();
      return true;
    }
    if (key === "r") {
      resetState();
      return true;
    }
    return false;
  }

  function onModuleKey(event: KeyEvent): boolean | void {
    if (event.name === "escape" || event.name === "f1") {
      closeModule();
      return true;
    }
    return false;
  }

  if (openedModule) {
    return (
      <AppShell
        title={openedModule.title}
        path={pathName}
        onNavigate={navigate}
        breadcrumbs={breadcrumbs}
        commands={commands}
        padding={compact ? 0 : 1}
        windowBorderStyle={{ fg: theme.accent }}
        windowTitleStyle={{ fg: theme.accent, bold: true }}
        chrome={false}
      >
        <Box grow={1} onKey={onModuleKey}>
          {renderShowcaseModule(openedModule, props.examples)}
        </Box>
        <Box
          overlay
          focusable
          width={16}
          height={1}
          onClick={closeModule}
          style={{ fg: ansi(0), bg: theme.accent, bold: true }}
          focusedStyle={{ fg: ansi(15), bg: ansi(4), bold: true }}
        >
          <Text> Home / F1 </Text>
        </Box>
      </AppShell>
    );
  }

  return (
    <AppShell
      title="Dashboard shell"
      path={pathName}
      onNavigate={navigate}
      breadcrumbs={breadcrumbs}
      commands={commands}
      padding={compact ? 0 : 1}
      windowBorderStyle={{ fg: theme.accent }}
      windowTitleStyle={{ fg: theme.accent, bold: true }}
    >
      <Box
        grow={1}
        onKey={onWindowKey}
      >
        <Column gap={compact ? 0 : 1} grow={1}>
          {!compact && (
            <Text style={{ dim: true }}>
              One showcase application. Open a module here, then press Escape or F1 to return home.
            </Text>
          )}

          {stacked ? (
            <Column gap={compact ? 0 : 1} grow={1}>
              <ModuleList
                modules={modules}
                selected={selected}
                onChange={selectModule}
                onOpen={openModule}
                height={listHeight}
                counts={state.launchCounts}
                accent={theme.accent}
              />
              <ModuleDetails module={activeModule} state={state} accent={theme.accent} />
              {!compact && <ShellStatePanel state={state} themeLabel={theme.label} />}
            </Column>
          ) : (
            <Row gap={1} grow={1}>
              <Column width={34} gap={1}>
                <ModuleList
                  modules={modules}
                  selected={selected}
                  onChange={selectModule}
                  onOpen={openModule}
                  height={listHeight}
                  counts={state.launchCounts}
                  accent={theme.accent}
                />
                <ShellStatePanel state={state} themeLabel={theme.label} />
              </Column>
              <ModuleDetails module={activeModule} state={state} accent={theme.accent} />
            </Row>
          )}

          <Row gap={1}>
            <Button onClick={launchSelected}>Open</Button>
            <Button onClick={cycleTheme}>Theme</Button>
            <Button onClick={resetState}>Reset</Button>
            <Text style={{ dim: true }}>
              Enter/o open in-place | t theme | r reset | {status}
            </Text>
          </Row>
        </Column>
      </Box>
    </AppShell>
  );
}

runExample(
  <DashboardShellApp initialModuleId={process.argv[2]} initialOpenModuleId={process.argv[2]} />,
  import.meta.url,
);

function createShellCommands(props: {
  modules: readonly ShowcaseModule[];
  selected: number;
  openedModuleId: string | null;
  openModule: (index: number) => void;
  selectModule: (index: number) => void;
  launchSelected: () => void;
  cycleTheme: () => void;
  resetState: () => void;
  closeModule: () => void;
}): Command[] {
  const commands: Command[] = props.openedModuleId
    ? [
      {
        id: "showcase.home",
        title: "Return to showcase home",
        group: "Showcase",
        keys: ["f1"],
        run: props.closeModule,
      },
    ]
    : [
      {
        id: "showcase.open",
        title: "Open selected module",
        group: "Showcase",
        keys: ["o", "enter"],
        run: props.launchSelected,
      },
      {
        id: "showcase.theme",
        title: "Cycle shell theme",
        group: "Showcase",
        keys: ["t"],
        run: props.cycleTheme,
      },
      {
        id: "showcase.reset",
        title: "Reset shell state",
        group: "Showcase",
        keys: ["r"],
        run: props.resetState,
      },
    ];

  for (const [index, module] of props.modules.entries()) {
    commands.push({
      id: `showcase.module.${module.id}`,
      title: `Open ${module.title}`,
      group: "Apps",
      keys: index === props.selected && !props.openedModuleId ? ["o"] : undefined,
      run: () => {
        props.selectModule(index);
        props.openModule(index);
      },
    });
  }

  return commands;
}

export function createFileShellStateStore(filePath = defaultShellStatePath()): DashboardShellStateStore {
  return {
    async load(): Promise<Partial<DashboardShellState> | null> {
      try {
        const text = await fs.readFile(filePath, "utf8");
        return JSON.parse(text) as Partial<DashboardShellState>;
      } catch (error) {
        if (isMissingFile(error)) return null;
        throw error;
      }
    },
    async save(state: DashboardShellState): Promise<void> {
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      await fs.writeFile(filePath, `${JSON.stringify(state, null, 2)}\n`, "utf8");
    },
  };
}

export function createMemoryShellStateStore(
  initial: Partial<DashboardShellState> | null = null,
): DashboardShellStateStore & { snapshot(): Partial<DashboardShellState> | null } {
  let current = initial;
  return {
    async load(): Promise<Partial<DashboardShellState> | null> {
      return current;
    },
    async save(state: DashboardShellState): Promise<void> {
      current = state;
    },
    snapshot(): Partial<DashboardShellState> | null {
      return current;
    },
  };
}

function ModuleList(props: {
  modules: readonly ShowcaseModule[];
  selected: number;
  onChange: (index: number) => void;
  onOpen: (index: number) => void;
  height: number;
  counts: Record<string, number>;
  accent: ReturnType<typeof ansi>;
}) {
  return (
    <Panel title="Apps" padding={0} borderStyle={{ fg: props.accent }}>
      <List
        items={props.modules}
        selected={props.selected}
        onChange={props.onChange}
        onSelect={(index) => props.onOpen(index)}
        height={props.height}
        render={(module) => {
          const count = props.counts[module.id] ?? 0;
          return `${module.category.padEnd(8, " ")} ${module.title}${count > 0 ? ` (${count})` : ""}`;
        }}
      />
    </Panel>
  );
}

function ModuleDetails(props: {
  module: ShowcaseModule;
  state: DashboardShellState;
  accent: ReturnType<typeof ansi>;
}) {
  const count = props.state.launchCounts[props.module.id] ?? 0;
  return (
    <Panel
      title={props.module.title}
      padding={0}
      grow={1}
      borderStyle={{ fg: props.accent }}
      titleStyle={{ fg: props.accent, bold: true }}
    >
      <Column gap={1} grow={1}>
        <Text style={{ bold: true }}>{props.module.command}</Text>
        <Text>{props.module.summary}</Text>
        <Text style={{ dim: true }}>opened {count} time{count === 1 ? "" : "s"}</Text>
        <Text style={{ dim: true }}>Open renders this module inside the current app.</Text>
        <Column gap={0}>
          {props.module.features.map((feature) => (
            <Text key={feature}>- {feature}</Text>
          ))}
        </Column>
      </Column>
    </Panel>
  );
}

function ShellStatePanel(props: { state: DashboardShellState; themeLabel: string }) {
  return (
    <Panel title="Shared state" padding={0}>
      <Column gap={0}>
        <Text>theme: {props.themeLabel}</Text>
        <Text>selected: {props.state.selectedModuleId}</Text>
        <Text>
          last open: {props.state.lastOpenedAt ? new Date(props.state.lastOpenedAt).toLocaleTimeString() : "never"}
        </Text>
        <Text style={{ dim: true }}>state persists between shell runs</Text>
      </Column>
    </Panel>
  );
}

function renderShowcaseModule(
  module: ShowcaseModule,
  examples: ShowcaseExampleProps | undefined,
) {
  if (module.id === "system-monitor") return <SystemMonitorApp {...examples?.monitor} />;
  if (module.id === "log-viewer") return <LogViewerApp {...examples?.logs} />;
  if (module.id === "git-dashboard") return <GitDashboardApp {...examples?.git} />;
  if (module.id === "api-explorer") return <ApiExplorerApp {...examples?.api} />;
  if (module.id === "file-manager") return <ExplorerApp {...examples?.files} />;
  if (module.id === "hello") return <HelloApp />;
  if (module.id === "form") return <FormApp />;
  if (module.id === "todo") return <TodoApp />;

  return (
    <App>
      <Window title={module.title} grow={1}>
        <ModuleDetails
          module={module}
          state={{ selectedModuleId: module.id, themeId: THEMES[0]!.id, launchCounts: {} }}
          accent={THEMES[0]!.accent}
        />
      </Window>
    </App>
  );
}

function defaultShellState(
  modules: readonly ShowcaseModule[],
  initialModuleId?: string,
): DashboardShellState {
  const initial = resolveModuleId(modules, initialModuleId) ?? modules[0]?.id ?? "system-monitor";
  return {
    selectedModuleId: initial,
    themeId: THEMES[0]!.id,
    launchCounts: {},
  };
}

function mergeState(
  fallback: DashboardShellState,
  loaded: Partial<DashboardShellState> | null,
  modules: readonly ShowcaseModule[],
  initialModuleId?: string,
): DashboardShellState {
  const forcedModuleId = resolveModuleId(modules, initialModuleId);
  if (!loaded) return forcedModuleId ? { ...fallback, selectedModuleId: forcedModuleId } : fallback;
  const moduleIds = new Set(modules.map((module) => module.id));
  const selectedModuleId = forcedModuleId
    ?? (
      loaded.selectedModuleId && moduleIds.has(loaded.selectedModuleId)
        ? loaded.selectedModuleId
        : fallback.selectedModuleId
    );
  const themeId = loaded.themeId && THEMES.some((theme) => theme.id === loaded.themeId)
    ? loaded.themeId
    : fallback.themeId;
  return {
    selectedModuleId,
    themeId,
    launchCounts: { ...(loaded.launchCounts ?? {}) },
    lastOpenedAt: loaded.lastOpenedAt,
  };
}

function resolveModuleId(modules: readonly ShowcaseModule[], moduleId: string | undefined): string | null {
  if (!moduleId) return null;
  return modules.some((module) => module.id === moduleId) ? moduleId : null;
}

function selectedIndexFor(modules: readonly ShowcaseModule[], moduleId: string): number {
  return Math.max(0, modules.findIndex((module) => module.id === moduleId));
}

function defaultShellStatePath(): string {
  const stateRoot = process.env.XDG_STATE_HOME || path.join(os.homedir(), ".local", "state");
  return path.join(stateRoot, "graceglyph", "showcase-shell.json");
}

function isMissingFile(error: unknown): boolean {
  return typeof error === "object"
    && error !== null
    && "code" in error
    && (error as { code?: string }).code === "ENOENT";
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
