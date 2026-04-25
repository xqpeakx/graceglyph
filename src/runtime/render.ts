import type { ZenElement } from "./element.js";
import { Runtime, RuntimeOptions } from "./runtime.js";
import type { Theme } from "../theme/theme.js";

export interface RenderHandle {
  /** Cleanly exit the app (leaves alt screen, restores cursor). */
  stop(): void;
  /** Swap the runtime theme and repaint subscribed nodes. */
  setTheme(theme: Theme): void;
  /** Underlying runtime — use for advanced integration or tests. */
  runtime: Runtime;
}

/**
 * Boot a graceglyph app. Takes a root element and a handful of terminal options.
 *
 *   import { render } from "graceglyph";
 *   render(<App />);
 */
export function render(element: ZenElement, opts: RuntimeOptions = {}): RenderHandle {
  const runtime = new Runtime(opts);
  runtime.mount(element);
  runtime.run();
  return {
    stop: () => runtime.stop(),
    setTheme: (theme) => runtime.setTheme(theme),
    runtime,
  };
}
