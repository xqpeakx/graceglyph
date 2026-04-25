/** @jsx h */

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
import type { BoxProps, BoxStyle, ZenElement } from "./runtime/element.js";
import { Fragment, h, isElement, normalizeChildren } from "./runtime/element.js";
import type { KeyEvent, MouseEvent } from "./input/keys.js";
import { ansi } from "./render/style.js";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "./runtime/hooks.js";

export interface RouteProps {
  path: string;
  title?: string;
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
  const routes = normalizeChildren(props.children).filter(isElement);
  const route = routes.find((child) => (
    child.type === Route && (child.props as unknown as RouteProps).path === props.path
  ));
  if (!route) return h(Fragment, {}, props.fallback ?? null);
  return h(Fragment, {}, (route.props as unknown as RouteProps).children);
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
  const selected = Math.max(0, props.tabs.findIndex((tab) => tab.id === props.selectedId));

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
          style={tab.id === props.selectedId ? { fg: ansi(15), bg: ansi(4), bold: true } : undefined}
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
  keys?: readonly string[];
  run: () => void;
}

type CommandListener = () => void;

const commandRegistry = new Map<string, Command>();
const commandListeners = new Set<CommandListener>();

export function registerCommand(command: Command): () => void {
  commandRegistry.set(command.id, command);
  emitCommandChange();
  return () => {
    if (commandRegistry.get(command.id) === command) {
      commandRegistry.delete(command.id);
      emitCommandChange();
    }
  };
}

export function useCommand(command: Command, deps: unknown[] = []): void {
  useEffect(() => registerCommand(command), [command.id, ...deps]);
}

export function useCommands(): readonly Command[] {
  const [version, setVersion] = useState(0);
  useEffect(() => {
    const listener = () => setVersion((value) => value + 1);
    commandListeners.add(listener);
    return () => {
      commandListeners.delete(listener);
    };
  }, []);
  return useMemo(() => (
    Array.from(commandRegistry.values()).sort((left, right) => (
      (left.group ?? "").localeCompare(right.group ?? "") || left.title.localeCompare(right.title)
    ))
  ), [version]);
}

export interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  commands?: readonly Command[];
}

export function CommandPalette(props: CommandPaletteProps): ZenElement | null {
  const registered = useCommands();
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
}

export function HelpOverlay(props: HelpOverlayProps): ZenElement | null {
  const registered = useCommands();
  const commands = props.commands ?? registered;
  const [selected, setSelected] = useState(0);
  const lines = commands.length > 0
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
              {props.onDismiss && <Button onClick={() => props.onDismiss?.(toast.id)}>Dismiss</Button>}
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
  breadcrumbs?: readonly BreadcrumbItem[];
  commands?: readonly Command[];
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
  const registered = useCommands();
  const commands = mergeCommands(registered, props.commands ?? []);

  const shellCommands = useMemo<Command[]>(() => [
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
  ], [commands]);

  function goBack(): void {
    const crumbs = props.breadcrumbs ?? [];
    const previous = crumbs.length >= 2 ? crumbs[crumbs.length - 2] : crumbs[0];
    if (previous) props.onNavigate(previous.path);
  }

  return (
    <App>
      <Column
        grow={1}
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
          return runHotkey(shellCommands, event);
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
              <Breadcrumbs items={props.breadcrumbs ?? []} onNavigate={props.onNavigate} />
              {props.children}
            </Column>
          </Window>
        )}
        <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} commands={shellCommands} />
        <HelpOverlay open={helpOpen} onClose={() => setHelpOpen(false)} commands={shellCommands} />
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

export function Stack(props: Omit<BoxProps, "direction"> & { direction?: "row" | "column" }): ZenElement {
  return <Box {...props} direction={props.direction ?? "column"} />;
}

export function Grid(props: {
  columns: number;
  gap?: number;
  children?: unknown;
}): ZenElement {
  const children = normalizeChildren(props.children);
  const columns = Math.max(1, props.columns);
  const rows: unknown[] = [];
  for (let index = 0; index < children.length; index += columns) {
    rows.push(
      <Row key={`row-${index}`} gap={props.gap ?? 1}>
        {children.slice(index, index + columns).map((child, childIndex) => (
          <Box key={`cell-${index + childIndex}`} grow={1}>{child}</Box>
        ))}
      </Row>,
    );
  }
  return <Column gap={props.gap ?? 1}>{rows}</Column>;
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
      <Box width={horizontal ? props.firstSize : undefined} height={!horizontal ? props.firstSize : undefined} grow={props.firstSize ? undefined : 1}>
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
  const scrollBy = (delta: number) => props.onOffsetChange(Math.min(maxOffset, Math.max(0, offset + delta)));

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
          <Text style={{ dim: true }}>{props.lines.length === 0 ? "empty" : `${offset + 1}-${Math.min(props.lines.length, offset + props.height)} / ${props.lines.length}`}</Text>
        </Row>
      </Column>
    </Panel>
  );
}

export function useHotkeys(commands: readonly Command[]): (event: KeyEvent) => boolean | void {
  return useCallback((event: KeyEvent) => runHotkey(commands, event), [commands]);
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

export function useAsync<T>(
  load: () => Promise<T>,
  deps: unknown[] = [],
): AsyncState<T> {
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
    const storage = optionalLocalStorage();
    try {
      const stored = storage?.getItem(key);
      return stored ? JSON.parse(stored) as T : fallback;
    } catch {
      return fallback;
    }
  });

  const setPersistentValue = (next: T | ((current: T) => T)) => {
    setValue((current) => {
      const value = typeof next === "function" ? (next as (current: T) => T)(current) : next;
      const storage = optionalLocalStorage();
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

function optionalLocalStorage(): { getItem(key: string): string | null; setItem(key: string, value: string): void } | undefined {
  return (globalThis as {
    localStorage?: { getItem(key: string): string | null; setItem(key: string, value: string): void };
  }).localStorage;
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

function mergeCommands(
  registered: readonly Command[],
  explicit: readonly Command[],
): Command[] {
  const merged = new Map<string, Command>();
  for (const command of registered) merged.set(command.id, command);
  for (const command of explicit) merged.set(command.id, command);
  return Array.from(merged.values());
}

function filterCommands(commands: readonly Command[], query: string): Command[] {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) return [...commands];
  return commands.filter((command) => (
    command.title.toLowerCase().includes(trimmed)
    || command.id.toLowerCase().includes(trimmed)
    || (command.group ?? "").toLowerCase().includes(trimmed)
    || (command.keys ?? []).some((key) => key.toLowerCase().includes(trimmed))
  ));
}

function formatCommand(command: Command): string {
  const group = command.group ? `${command.group} / ` : "";
  const keys = command.keys && command.keys.length > 0 ? `  ${command.keys.join(", ")}` : "";
  return `${group}${command.title}${keys}`;
}

function runHotkey(commands: readonly Command[], event: KeyEvent): boolean {
  for (const command of commands) {
    if (!command.keys?.some((key) => keyMatches(key, event))) continue;
    command.run();
    return true;
  }
  return false;
}

function keyMatches(key: string, event: KeyEvent): boolean {
  const normalized = key.toLowerCase();
  const parts = normalized.split("+");
  const keyName = parts[parts.length - 1] ?? "";
  const wantsCtrl = parts.includes("ctrl") || parts.includes("control");
  const wantsAlt = parts.includes("alt") || parts.includes("meta");
  const wantsShift = parts.includes("shift");
  if (wantsCtrl !== event.ctrl || wantsAlt !== event.alt) return false;
  if (wantsShift && !event.shift) return false;
  if (event.name === "char") return event.char?.toLowerCase() === keyName;
  return event.name === keyName;
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
