import type { ZenElement } from "./runtime/element.js";
import { render, type RenderHandle } from "./runtime/render.js";
import type { RuntimeOptions } from "./runtime/runtime.js";
import {
  createPluginRegistryFromConfig,
  type PluginLoadConfig,
  type PluginRegistry,
} from "./plugin.js";

export interface RenderWithPluginsOptions extends RuntimeOptions, PluginLoadConfig {
  /** Optional argv source for parsing --plugin / -p flags. */
  argv?: readonly string[];
  /** Disable plugin activation while still loading them into the registry. */
  activatePlugins?: boolean;
}

export interface RenderWithPluginsHandle extends RenderHandle {
  /** Preloaded plugin registry. */
  registry: PluginRegistry;
  /** Dispose activated plugins manually. Safe to call multiple times. */
  disposePlugins(): void;
}

export async function renderWithPlugins(
  element: ZenElement,
  options: RenderWithPluginsOptions = {},
): Promise<RenderWithPluginsHandle> {
  const { plugins, argv, activatePlugins = true, ...runtime } = options;
  const registry = await createPluginRegistryFromConfig({ plugins }, argv);
  const deactivate = activatePlugins ? registry.activate() : () => {};
  let pluginsDisposed = false;
  let stopped = false;

  const disposePlugins = (): void => {
    if (pluginsDisposed) return;
    pluginsDisposed = true;
    deactivate();
  };

  let handle: RenderHandle;
  try {
    handle = render(element, runtime);
  } catch (error) {
    disposePlugins();
    throw error;
  }

  return {
    ...handle,
    registry,
    disposePlugins,
    stop() {
      if (stopped) return;
      stopped = true;
      try {
        disposePlugins();
      } finally {
        handle.stop();
      }
    },
  };
}
