/** @jsx h */

import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

import {
  App,
  Box,
  Button,
  Column,
  List,
  Modal,
  Panel,
  Row,
  Text,
  TextInput,
  Window,
} from "./components.js";
import type {
  BoxProps,
  BoxStyle,
  DockPosition,
  GridTrackList,
  GridTrackSize,
  ZenElement,
} from "./runtime/element.js";
import { Fragment, h, isElement, normalizeChildren } from "./runtime/element.js";
import type { KeyEvent, MouseEvent } from "./input/keys.js";
import { ansi } from "./render/style.js";
import { useCallback, useEffect, useMemo, useRef, useState } from "./runtime/hooks.js";

export interface RouteProps {
  path: string;
  title?: string;
  canLeave?: boolean | (() => boolean);
  children?: unknown;
}

export function Route(props: RouteProps): ZenElement {
  return h(Fragment, {}, props.children);
}

export interface RouterProps {
  path: string;
  fallback?: unknown;
  children?: unknown;
}

export function Router(props: RouterProps): ZenElement {
  const routes = normalizeChildren(props.children).filter(isElement) as ZenElement[];
  const path = routePathname(props.path);
  for (const route of routes) {
    const match = matchRoute(route, path, "");
    if (match !== null) return h("box", { direction: "column" } as BoxProps, match.nodes);
  }
  return h(Fragment, {}, props.fallback ?? null);
}

export function canNavigateRoute(
  currentPath: string,
  nextPath: string,
  children: unknown,
): boolean {
  const fromPath = routePathname(currentPath);
  const toPath = routePathname(nextPath);
  if (fromPath === toPath) return true;
  const match = findRouteMatch(children, fromPath);
  if (!match) return true;
  for (const guard of match.leaveGuards) {
    if (typeof guard === "function") {
      if (!guard()) return false;
      continue;
    }
    if (guard === false) return false;
  }
  return true;
}

export function resolveDeepLinkPath(path: string | undefined, fallback = "/"): string {
  const candidate = path?.trim();
  if (!candidate) return routePathname(fallback);
  return routePathname(candidate);
}

export function resolveDeepLinkPathFromArgv(argv: readonly string[], fallback = "/"): string {
  let skipValue = false;
  for (let index = 2; index < argv.length; index++) {
    const value = argv[index];
    if (skipValue) {
      skipValue = false;
      continue;
    }
    if (!value) continue;
    if (value.startsWith("-")) {
      skipValue = !value.includes("=");
      continue;
    }
    return resolveDeepLinkPath(value, fallback);
  }
  return resolveDeepLinkPath(undefined, fallback);
}

interface RouteMatch {
  nodes: Array<ZenElement | string>;
  leaveGuards: Array<boolean | (() => boolean)>;
}

function matchRoute(route: ZenElement, path: string, basePath: string): RouteMatch | null {
  if (route.type !== Route) return null;

  const props = route.props as unknown as RouteProps;
  const routePath = joinRoutePath(basePath, props.path);
  if (!isPathMatchOrPrefix(path, routePath)) return null;
  const guard = props.canLeave;
  const guardChain = guard === undefined ? [] : [guard];

  const children = normalizeChildren(props.children);
  const nestedRoutes = children.filter((child) => isElement(child) && child.type === Route);
  const shellChildren = children.filter((child) => !(isElement(child) && child.type === Route));

  for (const child of nestedRoutes) {
    const nested = matchRoute(child as ZenElement, path, routePath);
    if (nested !== null) {
      return {
        nodes: [...shellChildren, ...nested.nodes],
        leaveGuards: [...guardChain, ...nested.leaveGuards],
      };
    }
  }

  if (path === routePath) {
    return {
      nodes: shellChildren.length > 0 ? shellChildren : normalizeChildren(props.children),
      leaveGuards: guardChain,
    };
  }

  return null;
}

function joinRoutePath(basePath: string, routePath: string): string {
  if (routePath.startsWith("/")) return normalizePath(routePath);
  if (routePath.length === 0 || routePath === ".") return normalizePath(basePath || "/");
  return normalizePath(`${basePath}/${routePath}`);
}

function normalizePath(path: string): string {
  const pathname = path.split(/[?#]/, 1)[0] ?? "/";
  const withSlash = pathname.startsWith("/") ? pathname : `/${pathname}`;
  const collapsed = withSlash.replace(/\/+/g, "/");
  return collapsed.length > 1 ? collapsed.replace(/\/$/, "") : collapsed;
}

function routePathname(path: string): string {
  return normalizePath(path);
}

function findRouteMatch(children: unknown, path: string): RouteMatch | null {
  const routes = normalizeChildren(children).filter(isElement) as ZenElement[];
  for (const route of routes) {
    const match = matchRoute(route, path, "");
    if (match) return match;
  }
  return null;
}

function isPathMatchOrPrefix(path: string, prefix: string): boolean {
  if (path === prefix) return true;
  if (prefix === "/") return path.startsWith("/");
  return path.startsWith(`${prefix}/`);
}

export interface TabItem {
  id: string;
  label: string;
  badge?: string | number;
}

export interface TabsProps {
  tabs: readonly TabItem[];
  selectedId: string;
  onChange: (id: string) => void;
}

export function Tabs(props: TabsProps): ZenElement {
  const selected = Math.max(
    0,
    props.tabs.findIndex((tab) => tab.id === props.selectedId),
  );

  function move(delta: number): void {
    if (props.tabs.length === 0) return;
    const next = props.tabs[(selected + delta + props.tabs.length) % props.tabs.length]!;
    props.onChange(next.id);
  }

  return (
    <Row
      gap={1}
      onKey={(event) => {
        if (event.name === "left") {
          move(-1);
          return true;
        }
        if (event.name === "right") {
          move(1);
          return true;
        }
        return false;
      }}
    >
      {props.tabs.map((tab) => (
        <Button
          key={tab.id}
          onClick={() => props.onChange(tab.id)}
          style={
            tab.id === props.selectedId ? { fg: ansi(15), bg: ansi(4), bold: true } : undefined
          }
        >
          {tab.badge == null ? tab.label : `${tab.label} ${tab.badge}`}
        </Button>
      ))}
    </Row>
  );
}

export interface Command {
  id: string;
  title: string;
  group?: string;
  scope?: string;
  keys?: readonly string[];
  run: () => void;
}

export interface CommandRegistrationOptions {
  scope?: string;
}

export interface HotkeyOptions {
  /** Max delay between strokes in a chord. Defaults to 1000ms. */
  timeoutMs?: number;
}

interface HotkeyBuffer {
  keys: string[];
  lastAt: number;
}

type CommandListener = () => void;

const commandRegistry = new Map<string, Command>();
const commandListeners = new Set<CommandListener>();

export function registerCommand(
  command: Command,
  options: CommandRegistrationOptions = {},
): () => void {
  const registered = options.scope
    ? { ...command, scope: command.scope ?? options.scope }
    : command;
  commandRegistry.set(registered.id, registered);
  emitCommandChange();
  return () => {
    if (commandRegistry.get(registered.id) === registered) {
      commandRegistry.delete(registered.id);
      emitCommandChange();
    }
  };
}

export function useCommand(
  command: Command,
  deps: unknown[] = [],
  options: CommandRegistrationOptions = {},
): void {
  useEffect(() => registerCommand(command, options), [command.id, options.scope, ...deps]);
}

export function useCommands(scope?: string | readonly string[]): readonly Command[] {
  const [version, setVersion] = useState(0);
  useEffect(() => {
    const listener = () => setVersion((value) => value + 1);
    commandListeners.add(listener);
    return () => {
      commandListeners.delete(listener);
    };
  }, []);
  const scopes = normalizeScopes(scope);
  return useMemo(
    () => sortCommands(filterCommandsByScope(commandRegistry.values(), scopes)),
    [version, scopes.join("\0")],
  );
}

export interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  commands?: readonly Command[];
  scope?: string | readonly string[];
}

export function CommandPalette(props: CommandPaletteProps): ZenElement | null {
  const registered = useCommands(props.scope);
  const commands = props.commands ?? registered;
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(0);
  const matches = filterCommands(commands, query);

  useEffect(() => {
    if (props.open) setQuery("");
  }, [props.open]);

  useEffect(() => {
    setSelected((index) => clamp(index, matches.length));
  }, [matches.length]);

  if (!props.open) return null;

  function runSelected(index: number): void {
    const command = matches[index];
    if (!command) return;
    command.run();
    props.onClose();
  }

  return (
    <Modal title="Command palette" width={56} height={14} onDismiss={props.onClose}>
      <Column gap={1} grow={1}>
        <TextInput
          value={query}
          onChange={setQuery}
          onSubmit={() => runSelected(selected)}
          placeholder="type a command..."
        />
        {matches.length > 0 ? (
          <List
            items={matches}
            selected={selected}
            onChange={setSelected}
            onSelect={runSelected}
            height={8}
            render={(command) => formatCommand(command)}
          />
        ) : (
          <Text style={{ dim: true }}>No commands match.</Text>
        )}
      </Column>
    </Modal>
  );
}

export interface HelpOverlayProps {
  open: boolean;
  onClose: () => void;
  commands?: readonly Command[];
  scope?: string | readonly string[];
}

export function HelpOverlay(props: HelpOverlayProps): ZenElement | null {
  const registered = useCommands(props.scope);
  const commands = props.commands ?? registered;
  const [selected, setSelected] = useState(0);
  const lines =
    commands.length > 0
      ? commands.map((command) => formatCommand(command))
      : ["No commands registered."];

  useEffect(() => {
    setSelected((index) => clamp(index, lines.length));
  }, [lines.length]);

  if (!props.open) return null;

  return (
    <Modal title="Help" width={58} height={14} onDismiss={props.onClose}>
      <Column gap={1} grow={1}>
        <Text style={{ dim: true }}>Every command can be clicked or run from the palette.</Text>
        <List
          items={lines}
          selected={selected}
          onChange={setSelected}
          height={9}
          render={(line) => line}
        />
      </Column>
    </Modal>
  );
}

export interface ToastMessage {
  id: string;
  title: string;
  detail?: string;
  tone?: "info" | "success" | "warning" | "error";
}

export function ToastViewport(props: {
  toasts: readonly ToastMessage[];
  onDismiss?: (id: string) => void;
}): ZenElement | null {
  if (props.toasts.length === 0) return null;
  return (
    <Box overlay align="end" justify="end" padding={1}>
      <Column gap={0} width={40}>
        {props.toasts.slice(-3).map((toast) => (
          <Panel
            key={toast.id}
            title={toast.title}
            padding={0}
            borderStyle={{ fg: toastColor(toast.tone) }}
            titleStyle={{ fg: toastColor(toast.tone), bold: true }}
          >
            <Row gap={1}>
              <Text style={{ dim: true }}>{toast.detail ?? toast.tone ?? "info"}</Text>
              {props.onDismiss && (
                <Button onClick={() => props.onDismiss?.(toast.id)}>Dismiss</Button>
              )}
            </Row>
          </Panel>
        ))}
      </Column>
    </Box>
  );
}

export interface BreadcrumbItem {
  label: string;
  path: string;
}

export interface AppShellProps {
  title: string;
  path: string;
  onNavigate: (path: string) => void;
  canNavigate?: (currentPath: string, nextPath: string) => boolean;
  breadcrumbs?: readonly BreadcrumbItem[];
  commands?: readonly Command[];
  commandScope?: string | readonly string[];
  toasts?: readonly ToastMessage[];
  onDismissToast?: (id: string) => void;
  padding?: BoxProps["padding"];
  windowStyle?: BoxStyle;
  windowBorderStyle?: BoxStyle;
  windowTitleStyle?: BoxStyle;
  chrome?: boolean;
  children?: unknown;
}

export function AppShell(props: AppShellProps): ZenElement {
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const registered = useCommands(props.commandScope);
  const commands = mergeCommands(registered, props.commands ?? []);
  const currentPath = routePathname(props.path);
  const navigate = useCallback(
    (nextPath: string) => {
      const targetPath = routePathname(nextPath);
      if (targetPath === currentPath) return;
      if (props.canNavigate && !props.canNavigate(currentPath, targetPath)) return;
      props.onNavigate(targetPath);
    },
    [currentPath, props.canNavigate, props.onNavigate],
  );

  const shellCommands = useMemo<Command[]>(
    () => [
      {
        id: "shell.palette",
        title: "Open command palette",
        group: "Shell",
        keys: [":"],
        run: () => setPaletteOpen(true),
      },
      {
        id: "shell.help",
        title: "Open help",
        group: "Shell",
        keys: ["?"],
        run: () => setHelpOpen(true),
      },
      {
        id: "shell.back",
        title: "Navigate back",
        group: "Shell",
        keys: ["escape"],
        run: goBack,
      },
      ...commands,
    ],
    [commands],
  );
  const runShellHotkey = useHotkeys(shellCommands);

  function goBack(): void {
    const crumbs = props.breadcrumbs ?? [];
    const previous = crumbs.length >= 2 ? crumbs[crumbs.length - 2] : crumbs[0];
    if (previous) navigate(previous.path);
  }

  return (
    <App>
      <Column
        grow={1}
        focusable
        accessibilityLabel={props.title}
        onKey={(event) => {
          if (event.name === "escape") {
            goBack();
            return true;
          }
          if (event.name === "char" && event.char === ":") {
            setPaletteOpen(true);
            return true;
          }
          if (event.name === "char" && event.char === "?") {
            setHelpOpen(true);
            return true;
          }
          return runShellHotkey(event);
        }}
      >
        {props.chrome === false ? (
          props.children
        ) : (
          <Window
            title={props.title}
            grow={1}
            padding={props.padding}
            style={props.windowStyle}
            borderStyle={props.windowBorderStyle}
            titleStyle={props.windowTitleStyle}
          >
            <Column gap={1} grow={1}>
              <Breadcrumbs items={props.breadcrumbs ?? []} onNavigate={navigate} />
              {props.children}
            </Column>
          </Window>
        )}
        <CommandPalette
          open={paletteOpen}
          onClose={() => setPaletteOpen(false)}
          commands={shellCommands}
          scope={props.commandScope}
        />
        <HelpOverlay
          open={helpOpen}
          onClose={() => setHelpOpen(false)}
          commands={shellCommands}
          scope={props.commandScope}
        />
        <ToastViewport toasts={props.toasts ?? []} onDismiss={props.onDismissToast} />
      </Column>
    </App>
  );
}

export function Breadcrumbs(props: {
  items: readonly BreadcrumbItem[];
  onNavigate: (path: string) => void;
}): ZenElement | null {
  if (props.items.length === 0) return null;
  return (
    <Row gap={1}>
      {props.items.map((item, index) => (
        <Button key={`${item.path}-${index}`} onClick={() => props.onNavigate(item.path)}>
          {index === props.items.length - 1 ? item.label : `${item.label} /`}
        </Button>
      ))}
    </Row>
  );
}

export function Stack(
  props: Omit<BoxProps, "direction"> & { direction?: "row" | "column" },
): ZenElement {
  return <Box {...props} direction={props.direction ?? "column"} />;
}

export interface GridProps extends Omit<BoxProps, "layout" | "gridColumns" | "gridRows"> {
  columns: number | GridTrackList;
  rows?: GridTrackList;
  autoColumns?: GridTrackSize;
  autoRows?: GridTrackSize;
}

export function Grid(props: GridProps): ZenElement {
  const { columns, rows, autoColumns, autoRows, gap = 1, children, ...rest } = props;
  const gridColumns =
    typeof columns === "number"
      ? Array.from({ length: Math.max(1, Math.floor(columns)) }, () => "1fr" as const)
      : columns;
  return (
    <Box
      {...rest}
      layout="grid"
      gap={gap}
      gridColumns={gridColumns}
      gridRows={rows}
      gridAutoColumns={autoColumns}
      gridAutoRows={autoRows}
    >
      {children}
    </Box>
  );
}

export interface DockProps extends Omit<BoxProps, "layout"> {
  children?: unknown;
}

export function Dock(props: DockProps): ZenElement {
  return <Box {...props} layout="dock" />;
}

export interface DockSlotProps extends Omit<BoxProps, "dock"> {
  side?: DockPosition;
  children?: unknown;
}

export function DockSlot(props: DockSlotProps): ZenElement {
  const { side = "fill", children, ...rest } = props;
  return (
    <Box {...rest} dock={side}>
      {children}
    </Box>
  );
}

export function SplitPane(props: {
  orientation?: "horizontal" | "vertical";
  first: unknown;
  second: unknown;
  firstSize?: number;
  onResize?: (delta: number) => void;
}): ZenElement {
  const horizontal = props.orientation !== "vertical";
  const direction = horizontal ? "row" : "column";
  const decreaseKey = horizontal ? "left" : "up";
  const increaseKey = horizontal ? "right" : "down";
  return (
    <Box
      direction={direction}
      gap={1}
      grow={1}
      onKey={(event) => {
        if (event.name === decreaseKey) {
          props.onResize?.(-1);
          return true;
        }
        if (event.name === increaseKey) {
          props.onResize?.(1);
          return true;
        }
        return false;
      }}
    >
      <Box
        width={horizontal ? props.firstSize : undefined}
        height={!horizontal ? props.firstSize : undefined}
        grow={props.firstSize ? undefined : 1}
      >
        {props.first}
      </Box>
      <Box focusable width={horizontal ? 3 : undefined} height={horizontal ? undefined : 1}>
        <Row gap={0}>
          <Button onClick={() => props.onResize?.(-1)}>-</Button>
          <Button onClick={() => props.onResize?.(1)}>+</Button>
        </Row>
      </Box>
      <Box grow={1}>{props.second}</Box>
    </Box>
  );
}

export function ScrollView(props: {
  lines: readonly string[];
  offset: number;
  onOffsetChange: (offset: number) => void;
  height: number;
  title?: string;
  header?: unknown;
  footer?: unknown;
}): ZenElement {
  const maxOffset = Math.max(0, props.lines.length - props.height);
  const offset = Math.min(Math.max(0, props.offset), maxOffset);
  const visible = props.lines.slice(offset, offset + props.height);
  const scrollBy = (delta: number) =>
    props.onOffsetChange(Math.min(maxOffset, Math.max(0, offset + delta)));

  return (
    <Panel
      title={props.title}
      padding={0}
      onKey={(event) => {
        if (event.name === "up") {
          scrollBy(-1);
          return true;
        }
        if (event.name === "down") {
          scrollBy(1);
          return true;
        }
        if (event.name === "pageup") {
          scrollBy(-props.height);
          return true;
        }
        if (event.name === "pagedown") {
          scrollBy(props.height);
          return true;
        }
        return false;
      }}
      onMouse={(event) => {
        if (event.button === "wheel-up") {
          scrollBy(-1);
          return true;
        }
        if (event.button === "wheel-down") {
          scrollBy(1);
          return true;
        }
        return false;
      }}
    >
      <Column gap={0}>
        {props.header}
        <List
          items={visible.length > 0 ? visible : [""]}
          selected={0}
          onChange={() => undefined}
          height={props.height}
          render={(line) => line || " "}
        />
        {props.footer}
        <Row gap={1}>
          <Button onClick={() => scrollBy(-1)}>Up</Button>
          <Button onClick={() => scrollBy(1)}>Down</Button>
          <Text style={{ dim: true }}>
            {props.lines.length === 0
              ? "empty"
              : `${offset + 1}-${Math.min(props.lines.length, offset + props.height)} / ${props.lines.length}`}
          </Text>
        </Row>
      </Column>
    </Panel>
  );
}

export function useHotkeys(
  commands: readonly Command[],
  options: HotkeyOptions = {},
): (event: KeyEvent) => boolean | void {
  const chordRef = useRef<HotkeyBuffer>({ keys: [], lastAt: 0 });
  const timeoutMs = options.timeoutMs ?? 1000;
  return useCallback(
    (event: KeyEvent) => runHotkey(commands, event, chordRef.current, timeoutMs),
    [commands, timeoutMs],
  );
}

export function useInterval(callback: () => void, delayMs: number | null): void {
  const callbackRef = useRef(callback);
  callbackRef.current = callback;
  useEffect(() => {
    if (delayMs === null) return;
    const timer = setInterval(() => callbackRef.current(), delayMs);
    return () => clearInterval(timer);
  }, [delayMs]);
}

export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

export interface AsyncState<T> {
  loading: boolean;
  data: T | null;
  error: unknown;
  reload: () => void;
}

export function useAsync<T>(load: () => Promise<T>, deps: unknown[] = []): AsyncState<T> {
  const [version, setVersion] = useState(0);
  const [state, setState] = useState<Omit<AsyncState<T>, "reload">>({
    loading: true,
    data: null,
    error: null,
  });

  useEffect(() => {
    let cancelled = false;
    setState((current) => ({ ...current, loading: true, error: null }));
    load()
      .then((data) => {
        if (!cancelled) setState({ loading: false, data, error: null });
      })
      .catch((error) => {
        if (!cancelled) setState((current) => ({ ...current, loading: false, error }));
      });
    return () => {
      cancelled = true;
    };
  }, [version, ...deps]);

  return {
    ...state,
    reload: () => setVersion((value) => value + 1),
  };
}

export function usePersistentState<T>(
  key: string,
  initial: T | (() => T),
): [T, (next: T | ((current: T) => T)) => void] {
  const [value, setValue] = useState<T>(() => {
    const fallback = typeof initial === "function" ? (initial as () => T)() : initial;
    const storage = optionalPersistentStorage();
    try {
      const stored = storage?.getItem(key);
      return stored ? (JSON.parse(stored) as T) : fallback;
    } catch {
      return fallback;
    }
  });

  const setPersistentValue = (next: T | ((current: T) => T)) => {
    setValue((current) => {
      const value = typeof next === "function" ? (next as (current: T) => T)(current) : next;
      const storage = optionalPersistentStorage();
      try {
        storage?.setItem(key, JSON.stringify(value));
      } catch {
        // Persistence is best-effort in terminal hosts.
      }
      return value;
    });
  };

  return [value, setPersistentValue];
}

interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

let fileStorageCache:
  | {
      path: string;
      values: Record<string, string>;
    }
  | undefined;

function optionalPersistentStorage(): KeyValueStorage | undefined {
  return optionalFileStorage() ?? optionalLocalStorage();
}

function optionalFileStorage(): KeyValueStorage | undefined {
  const statePath = resolveStateFilePath();
  if (!statePath) return undefined;
  return {
    getItem(key: string): string | null {
      const values = loadFileStorage(statePath);
      return Object.prototype.hasOwnProperty.call(values, key) ? values[key]! : null;
    },
    setItem(key: string, value: string): void {
      const values = loadFileStorage(statePath);
      values[key] = value;
      persistFileStorage(statePath, values);
    },
  };
}

function loadFileStorage(path: string): Record<string, string> {
  if (fileStorageCache && fileStorageCache.path === path) return fileStorageCache.values;
  let values: Record<string, string> = {};
  try {
    const raw = readFileSync(path, "utf8");
    const parsed = JSON.parse(raw) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      values = parsed as Record<string, string>;
    }
  } catch {
    values = {};
  }
  fileStorageCache = { path, values };
  return values;
}

function persistFileStorage(path: string, values: Record<string, string>): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(values, null, 2), "utf8");
  fileStorageCache = { path, values };
}

function resolveStateFilePath(): string | null {
  const env = optionalProcessEnv();
  if (!env) return null;
  const explicit = env.GRACEGLYPH_STATE_FILE?.trim();
  if (explicit) return explicit;
  const appId = env.GRACEGLYPH_APP_ID?.trim() || "graceglyph";
  const configHome = env.XDG_CONFIG_HOME?.trim() || join(homedir(), ".config");
  return join(configHome, appId, "state.json");
}

function optionalProcessEnv(): Record<string, string | undefined> | undefined {
  return (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env;
}

function optionalLocalStorage(): KeyValueStorage | undefined {
  return (
    globalThis as {
      localStorage?: {
        getItem(key: string): string | null;
        setItem(key: string, value: string): void;
      };
    }
  ).localStorage;
}

export function useFocusWithin(): {
  focused: boolean;
  onFocus: () => void;
  onBlur: () => void;
} {
  const [focused, setFocused] = useState(false);
  return {
    focused,
    onFocus: () => setFocused(true),
    onBlur: () => setFocused(false),
  };
}

export function useClipboard(): {
  value: string;
  copy: (value: string) => void;
  clear: () => void;
} {
  const [value, setValue] = useState("");
  return {
    value,
    copy: setValue,
    clear: () => setValue(""),
  };
}

export interface MouseState {
  x: number;
  y: number;
  button: MouseEvent["button"] | null;
  action: MouseEvent["action"] | null;
}

export function useMouse(): {
  mouse: MouseState;
  onMouse: (event: MouseEvent) => boolean | void;
} {
  const [mouse, setMouse] = useState<MouseState>({ x: 0, y: 0, button: null, action: null });
  return {
    mouse,
    onMouse: (event) => {
      setMouse({ x: event.x, y: event.y, button: event.button, action: event.action });
      return false;
    },
  };
}

function emitCommandChange(): void {
  for (const listener of commandListeners) listener();
}

function mergeCommands(registered: readonly Command[], explicit: readonly Command[]): Command[] {
  const merged = new Map<string, Command>();
  for (const command of registered) merged.set(command.id, command);
  for (const command of explicit) merged.set(command.id, command);
  return Array.from(merged.values());
}

function normalizeScopes(scope: string | readonly string[] | undefined): readonly string[] {
  if (scope === undefined) return [];
  return typeof scope === "string" ? [scope] : scope;
}

function filterCommandsByScope(commands: Iterable<Command>, scopes: readonly string[]): Command[] {
  const list = Array.from(commands);
  if (scopes.length === 0) return list;
  const allowed = new Set(scopes);
  return list.filter((command) => command.scope === undefined || allowed.has(command.scope));
}

function sortCommands(commands: Iterable<Command>): Command[] {
  return Array.from(commands).sort(
    (left, right) =>
      (left.group ?? "").localeCompare(right.group ?? "") || left.title.localeCompare(right.title),
  );
}

function filterCommands(commands: readonly Command[], query: string): Command[] {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) return [...commands];
  return commands.filter(
    (command) =>
      command.title.toLowerCase().includes(trimmed) ||
      command.id.toLowerCase().includes(trimmed) ||
      (command.group ?? "").toLowerCase().includes(trimmed) ||
      (command.keys ?? []).some((key) => key.toLowerCase().includes(trimmed)),
  );
}

function formatCommand(command: Command): string {
  const group = command.group ? `${command.group} / ` : "";
  const keys = command.keys && command.keys.length > 0 ? `  ${command.keys.join(", ")}` : "";
  return `${group}${command.title}${keys}`;
}

function runHotkey(
  commands: readonly Command[],
  event: KeyEvent,
  buffer?: HotkeyBuffer,
  timeoutMs = 1000,
): boolean {
  if (!buffer) return runSingleStrokeHotkey(commands, event);

  const now = Date.now();
  const current = buffer.keys.length > 0 && now - buffer.lastAt <= timeoutMs ? buffer.keys : [];
  const result = matchHotkey(commands, event, current);

  if (result.kind === "run") {
    buffer.keys = [];
    buffer.lastAt = 0;
    result.command.run();
    return true;
  }

  if (result.kind === "prefix") {
    buffer.keys = [...current, keyTokenFromEvent(event)];
    buffer.lastAt = now;
    return true;
  }

  if (current.length > 0) {
    buffer.keys = [];
    buffer.lastAt = 0;
    return runHotkey(commands, event, buffer, timeoutMs);
  }

  return false;
}

function keyMatches(key: string, event: KeyEvent): boolean {
  const parsed = parseKeyStroke(key);
  const keyName = parsed.key;
  const wantsCtrl = parsed.ctrl;
  const wantsAlt = parsed.alt;
  const wantsShift = parsed.shift;
  if (wantsCtrl !== event.ctrl || wantsAlt !== event.alt) return false;
  if (wantsShift && !event.shift) return false;
  if (event.name === "char") return event.char?.toLowerCase() === keyName;
  return event.name === keyName;
}

function runSingleStrokeHotkey(commands: readonly Command[], event: KeyEvent): boolean {
  for (const command of commands) {
    if (
      !command.keys?.some((key) => splitKeySequence(key).length === 1 && keyMatches(key, event))
    ) {
      continue;
    }
    command.run();
    return true;
  }
  return false;
}

function matchHotkey(
  commands: readonly Command[],
  event: KeyEvent,
  current: readonly string[],
): { kind: "none" } | { kind: "prefix" } | { kind: "run"; command: Command } {
  let hasPrefix = false;
  for (const command of commands) {
    for (const key of command.keys ?? []) {
      const sequence = splitKeySequence(key);
      if (sequence.length <= current.length) continue;
      if (!current.every((token, index) => token === normalizeKeyStroke(sequence[index]!))) {
        continue;
      }
      if (!keyMatches(sequence[current.length]!, event)) continue;
      if (sequence.length === current.length + 1) return { kind: "run", command };
      hasPrefix = true;
    }
  }
  return hasPrefix ? { kind: "prefix" } : { kind: "none" };
}

function splitKeySequence(key: string): string[] {
  return key
    .trim()
    .split(/\s+/)
    .filter((part) => part.length > 0);
}

function normalizeKeyStroke(stroke: string): string {
  const parsed = parseKeyStroke(stroke);
  return [
    parsed.ctrl ? "ctrl" : null,
    parsed.alt ? "alt" : null,
    parsed.shift ? "shift" : null,
    parsed.key,
  ]
    .filter(Boolean)
    .join("+");
}

function parseKeyStroke(stroke: string): {
  ctrl: boolean;
  alt: boolean;
  shift: boolean;
  key: string;
} {
  const parts = stroke
    .toLowerCase()
    .split("+")
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
  const key = parts[parts.length - 1] ?? "";
  return {
    ctrl: parts.includes("ctrl") || parts.includes("control"),
    alt: parts.includes("alt") || parts.includes("meta"),
    shift: parts.includes("shift"),
    key,
  };
}

function keyTokenFromEvent(event: KeyEvent): string {
  const key = event.name === "char" ? (event.char?.toLowerCase() ?? "") : event.name;
  return [event.ctrl ? "ctrl" : null, event.alt ? "alt" : null, event.shift ? "shift" : null, key]
    .filter(Boolean)
    .join("+");
}

function toastColor(tone: ToastMessage["tone"]) {
  if (tone === "success") return ansi(2);
  if (tone === "warning") return ansi(3);
  if (tone === "error") return ansi(1);
  return ansi(6);
}

function clamp(index: number, length: number): number {
  if (length === 0) return 0;
  return Math.min(index, length - 1);
}
