import type { ComponentFn, ZenElement, ZenNode } from "./runtime/element.js";
import type { Theme } from "./theme/theme.js";
import type { Command } from "./app-shell.js";
import { registerCommand } from "./app-shell.js";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";

/**
 * Plugin protocol (§14). A plugin is a plain object that contributes
 * components, themes, commands, and/or middleware. Apps load plugins via
 * `createPluginRegistry().use(plugin)` — the order of `use()` calls
 * determines override precedence (later wins for ID collisions).
 *
 * The protocol is intentionally narrow: anything more specialized lives
 * inside an exported component or hook. That keeps the surface stable
 * across major versions even when individual plugins evolve.
 */
export interface GraceglyphPlugin {
  /** Stable plugin identifier (e.g. "@graceglyph/markdown"). */
  id: string;
  /** Semver-shaped version string. Used in diagnostics only. */
  version?: string;
  /** Human-readable description. */
  description?: string;
  /** Components contributed by this plugin, keyed by export name. */
  components?: Record<string, ComponentFn<unknown>>;
  /** Themes contributed by this plugin, keyed by theme name. */
  themes?: Record<string, Theme>;
  /** Commands registered when the plugin activates. */
  commands?: readonly Command[];
  /**
   * Render middleware. Called for every element returned by a component
   * function — return the same element or transform it. Use sparingly; this
   * is the heaviest hook the protocol exposes.
   */
  middleware?: PluginMiddleware;
  /** Setup hook called once per `registry.activate()`. */
  setup?: (context: PluginContext) => void | (() => void);
}

export type PluginMiddleware = (next: ZenNode, info: PluginRenderInfo) => ZenNode;

export interface PluginRenderInfo {
  /** Plugin id (for telemetry / debugging). */
  pluginId: string;
  /** Component that produced the node, when available. */
  componentName?: string;
}

export interface PluginContext {
  /** Resolve a registered component by name. */
  getComponent: (name: string) => ComponentFn<unknown> | undefined;
  /** Resolve a registered theme by name. */
  getTheme: (name: string) => Theme | undefined;
  /** All commands aggregated from active plugins. */
  commands: () => readonly Command[];
  /** Plugin id this context was created for. */
  pluginId: string;
}

export interface PluginRegistry {
  /** Append a plugin to the activation order. Returns the registry. */
  use: (plugin: GraceglyphPlugin) => PluginRegistry;
  /**
   * Activate every registered plugin. Returns a `dispose` thunk that
   * deactivates plugins in reverse order (LIFO), unregistering commands
   * and running setup teardowns.
   */
  activate: () => () => void;
  /** Resolve a component by name, latest-registration-wins on collisions. */
  resolveComponent: (name: string) => ComponentFn<unknown> | undefined;
  /** Resolve a theme by name. */
  resolveTheme: (name: string) => Theme | undefined;
  /** Aggregated theme map (last-write-wins). */
  themes: () => Record<string, Theme>;
  /** Aggregated component map (last-write-wins). */
  components: () => Record<string, ComponentFn<unknown>>;
  /** Aggregated commands across plugins, in registration order. */
  commands: () => readonly Command[];
  /** Apply registered middleware to a node. */
  runMiddleware: (node: ZenNode, info?: Partial<PluginRenderInfo>) => ZenNode;
  /** Plugins in activation order. */
  list: () => readonly GraceglyphPlugin[];
}

export interface PluginLoadSpec {
  /** Module path or package id to import. Supports "module#exportName". */
  module: string;
  /** Optional explicit export name. Overrides "#exportName" when provided. */
  exportName?: string;
  /** Optional options passed when the resolved export is a factory function. */
  options?: unknown;
}

export interface PluginLoadConfig {
  /** Plugin module specs provided by app config. */
  plugins?: readonly (string | PluginLoadSpec | GraceglyphPlugin)[];
}

interface RegistryState {
  plugins: GraceglyphPlugin[];
  active: boolean;
  cleanups: Array<() => void>;
}

export function createPluginRegistry(): PluginRegistry {
  const state: RegistryState = { plugins: [], active: false, cleanups: [] };

  const themes = (): Record<string, Theme> => {
    const out: Record<string, Theme> = {};
    for (const plugin of state.plugins) {
      if (!plugin.themes) continue;
      for (const [name, theme] of Object.entries(plugin.themes)) {
        out[name] = theme;
      }
    }
    return out;
  };

  const components = (): Record<string, ComponentFn<unknown>> => {
    const out: Record<string, ComponentFn<unknown>> = {};
    for (const plugin of state.plugins) {
      if (!plugin.components) continue;
      for (const [name, component] of Object.entries(plugin.components)) {
        out[name] = component;
      }
    }
    return out;
  };

  const commands = (): readonly Command[] => {
    const out: Command[] = [];
    const seen = new Set<string>();
    for (const plugin of state.plugins) {
      if (!plugin.commands) continue;
      for (const command of plugin.commands) {
        if (seen.has(command.id)) continue;
        seen.add(command.id);
        out.push(command);
      }
    }
    return out;
  };

  const resolveComponent: PluginRegistry["resolveComponent"] = (name) => components()[name];
  const resolveTheme: PluginRegistry["resolveTheme"] = (name) => themes()[name];

  const runMiddleware: PluginRegistry["runMiddleware"] = (node, info) => {
    let current: ZenNode = node;
    for (const plugin of state.plugins) {
      if (!plugin.middleware) continue;
      try {
        current = plugin.middleware(current, {
          pluginId: plugin.id,
          componentName: info?.componentName,
        });
      } catch (err) {
        // Don't let one plugin bring down the whole render path.

        console.error(`graceglyph plugin "${plugin.id}" middleware error:`, err);
      }
    }
    return current;
  };

  const registry: PluginRegistry = {
    use(plugin) {
      // Replace existing plugin with the same id rather than duplicate it,
      // so live `use()` calls during dev work without confusion.
      const existing = state.plugins.findIndex((p) => p.id === plugin.id);
      if (existing >= 0) state.plugins.splice(existing, 1, plugin);
      else state.plugins.push(plugin);
      return registry;
    },
    activate() {
      if (state.active) {
        // Activating twice is a no-op for plugin lifecycle.
        return () => {};
      }
      state.active = true;

      // Register commands first so any setup hook that triggers a command
      // dispatch sees them.
      const commandHandles: Array<() => void> = [];
      for (const plugin of state.plugins) {
        if (!plugin.commands) continue;
        for (const command of plugin.commands) {
          commandHandles.push(registerCommand(command));
        }
      }

      const setupHandles: Array<() => void> = [];
      for (const plugin of state.plugins) {
        if (!plugin.setup) continue;
        const ctx: PluginContext = {
          getComponent: resolveComponent,
          getTheme: resolveTheme,
          commands,
          pluginId: plugin.id,
        };
        try {
          const cleanup = plugin.setup(ctx);
          if (typeof cleanup === "function") setupHandles.push(cleanup);
        } catch (err) {
          console.error(`graceglyph plugin "${plugin.id}" setup error:`, err);
        }
      }

      state.cleanups = [...setupHandles, ...commandHandles];
      return () => {
        if (!state.active) return;
        state.active = false;
        // Tear down in reverse so setups run before their commands disappear.
        for (let i = state.cleanups.length - 1; i >= 0; i--) {
          try {
            state.cleanups[i]!();
          } catch (err) {
            console.error("graceglyph plugin cleanup error:", err);
          }
        }
        state.cleanups = [];
      };
    },
    resolveComponent,
    resolveTheme,
    themes,
    components,
    commands,
    runMiddleware,
    list: () => [...state.plugins],
  };

  return registry;
}

/**
 * Lightweight helper for plugin authors. Builds a `GraceglyphPlugin` with
 * sensible defaults — same shape, less boilerplate.
 */
export function definePlugin(plugin: GraceglyphPlugin): GraceglyphPlugin {
  if (!plugin.id || plugin.id.length === 0) {
    throw new Error("graceglyph plugin: id is required");
  }
  return plugin;
}

export function parsePluginArgsFromArgv(argv: readonly string[]): PluginLoadSpec[] {
  const specs: PluginLoadSpec[] = [];
  for (let i = 2; i < argv.length; i++) {
    const token = argv[i];
    if (!token) continue;
    if (token === "--plugin" || token === "-p") {
      const value = argv[i + 1];
      if (!value || value.startsWith("-")) continue;
      specs.push(parsePluginSpecifier(value));
      i += 1;
      continue;
    }
    if (token.startsWith("--plugin=")) {
      const value = token.slice("--plugin=".length);
      if (value.length === 0) continue;
      specs.push(parsePluginSpecifier(value));
    }
  }
  return specs;
}

export async function loadPlugin(
  input: string | PluginLoadSpec | GraceglyphPlugin,
): Promise<GraceglyphPlugin> {
  if (isPluginObject(input)) return definePlugin(input);
  const spec = typeof input === "string" ? parsePluginSpecifier(input) : input;
  const resolved = normalizeImportId(spec.module);
  const mod = await import(resolved);
  const exportName = spec.exportName || parsePluginSpecifier(spec.module).exportName;
  const candidate = pickPluginExport(mod, exportName);
  if (!candidate) {
    const keys = Object.keys(mod).join(", ");
    throw new Error(
      `graceglyph plugin: no plugin export found in "${spec.module}" (exports: ${keys})`,
    );
  }
  if (typeof candidate === "function") {
    const produced = await candidate(spec.options);
    if (!isPluginObject(produced)) {
      throw new Error(
        `graceglyph plugin: factory export from "${spec.module}" did not return a plugin`,
      );
    }
    return definePlugin(produced);
  }
  return definePlugin(candidate);
}

export async function loadPluginsFromConfig(
  config: PluginLoadConfig = {},
  argv: readonly string[] = process.argv,
): Promise<GraceglyphPlugin[]> {
  const requested: Array<string | PluginLoadSpec | GraceglyphPlugin> = [
    ...(config.plugins ?? []),
    ...parsePluginArgsFromArgv(argv),
  ];
  const loaded = new Map<string, GraceglyphPlugin>();
  for (const request of requested) {
    const plugin = await loadPlugin(request);
    loaded.set(plugin.id, plugin);
  }
  return Array.from(loaded.values());
}

export async function createPluginRegistryFromConfig(
  config: PluginLoadConfig = {},
  argv: readonly string[] = process.argv,
): Promise<PluginRegistry> {
  const registry = createPluginRegistry();
  const plugins = await loadPluginsFromConfig(config, argv);
  for (const plugin of plugins) registry.use(plugin);
  return registry;
}

/** Re-export so consumers can build their plugin types in one import. */
export type { ZenElement, ZenNode };

function parsePluginSpecifier(value: string): PluginLoadSpec {
  const hash = value.lastIndexOf("#");
  if (hash <= 0 || hash === value.length - 1) return { module: value };
  return {
    module: value.slice(0, hash),
    exportName: value.slice(hash + 1),
  };
}

function normalizeImportId(moduleId: string): string {
  if (moduleId.startsWith("./") || moduleId.startsWith("../") || moduleId.startsWith("/")) {
    return pathToFileURL(resolve(moduleId)).href;
  }
  return moduleId;
}

function pickPluginExport(
  mod: Record<string, unknown>,
  exportName?: string,
): GraceglyphPlugin | ((options?: unknown) => unknown | Promise<unknown>) | null {
  if (exportName) return normalizeExportCandidate(mod[exportName]);

  const direct =
    normalizeExportCandidate(mod.default) ??
    normalizeExportCandidate(mod.createPlugin) ??
    normalizeExportCandidate(mod.createMarkdownPlugin) ??
    normalizeExportCandidate(mod.plugin);
  if (direct) return direct;

  for (const value of Object.values(mod)) {
    const candidate = normalizeExportCandidate(value);
    if (candidate) return candidate;
  }
  return null;
}

function normalizeExportCandidate(
  value: unknown,
): GraceglyphPlugin | ((options?: unknown) => unknown | Promise<unknown>) | null {
  if (isPluginObject(value)) return value;
  if (typeof value === "function")
    return value as (options?: unknown) => unknown | Promise<unknown>;
  return null;
}

function isPluginObject(value: unknown): value is GraceglyphPlugin {
  return (
    typeof value === "object" &&
    value !== null &&
    "id" in value &&
    typeof (value as { id?: unknown }).id === "string"
  );
}
