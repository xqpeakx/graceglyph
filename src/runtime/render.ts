import type { ZenElement } from "./element.js";
import { Runtime, RuntimeOptions } from "./runtime.js";

export interface RenderHandle {
  /** Cleanly exit the app (leaves alt screen, restores cursor). */
  stop(): void;
  /** Underlying runtime — use for advanced integration or tests. */
  runtime: Runtime;
}

/**
 * Boot a zenterm app. Takes a root element and a handful of terminal options.
 *
 *   import { render } from "zenterm";
 *   render(<App />);
 */
export function render(
  element: ZenElement,
  opts: RuntimeOptions = {},
): RenderHandle {
  const runtime = new Runtime(opts);
  runtime.mount(element);
  runtime.run();
  return { stop: () => runtime.stop(), runtime };
}
