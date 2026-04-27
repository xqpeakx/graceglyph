import { promises as fs } from "node:fs";

import type { RenderHandle } from "./render.js";
import type { Runtime } from "./runtime.js";
import type { HostNode } from "./host.js";
import type { ScreenBuffer } from "../render/buffer.js";
import { collectInspectorWarnings } from "./diagnostics.js";
import { inspectTree, type InspectorTreeNode } from "./devtools.js";
import type { PerfTimeline, PerfSample } from "./perf.js";
import type { Capabilities } from "../render/capabilities.js";

/**
 * §9 bug-report bundle. A snapshot of everything you'd want to inspect
 * after a crash: the rendered frames, host tree, layout warnings, perf
 * samples, and terminal capabilities.
 *
 * The bundle is plain JSON-serializable — no class instances, no
 * circular references — so it round-trips through `JSON.stringify` and
 * survives transport over a wire or disk.
 */
export interface BugReportBundle {
  generatedAt: string;
  graceglyph: { version: string };
  terminal: {
    width: number;
    height: number;
    capabilities: Capabilities | null;
  };
  inspector: {
    warnings: readonly string[];
    tree: InspectorTreeNode | null;
  };
  frame: {
    /** Stripped snapshot of the front buffer (no ANSI, just glyphs). */
    snapshot: string;
    rows: number;
    cols: number;
  } | null;
  perf: {
    samples: readonly PerfSample[];
    summary: ReturnType<PerfTimeline["summarize"]> | null;
  } | null;
}

export interface CollectBugReportOptions {
  /** Optional perf timeline to include. */
  perf?: PerfTimeline;
  /** Override the framework version reported in the bundle. */
  version?: string;
}

const PACKAGE_VERSION = "0.1.0-next";

export function collectBugReport(
  handle: Pick<RenderHandle, "runtime"> | Runtime,
  options: CollectBugReportOptions = {},
): BugReportBundle {
  const runtime = "runtime" in handle ? handle.runtime : handle;
  const root = (runtime as unknown as { hostRoot: HostNode | null }).hostRoot ?? null;
  const front = (runtime.renderer as unknown as { front: ScreenBuffer | undefined }).front;
  const capabilities = (runtime as unknown as { capabilities?: Capabilities }).capabilities ?? null;

  return {
    generatedAt: new Date().toISOString(),
    graceglyph: { version: options.version ?? PACKAGE_VERSION },
    terminal: {
      width: front?.width ?? 0,
      height: front?.height ?? 0,
      capabilities,
    },
    inspector: {
      warnings: root ? collectInspectorWarnings(root) : [],
      tree: root ? inspectTree(root) : null,
    },
    frame: front ? snapshotBuffer(front) : null,
    perf: options.perf
      ? {
          samples: options.perf.frames(),
          summary: options.perf.summarize(),
        }
      : null,
  };
}

function snapshotBuffer(front: ScreenBuffer): BugReportBundle["frame"] {
  const rows: string[] = [];
  for (let y = 0; y < front.height; y++) {
    let row = "";
    for (let x = 0; x < front.width; x++) {
      const cell = front.get(x, y);
      if (!cell || cell.width === 0) continue;
      row += cell.char || " ";
    }
    rows.push(row);
  }
  return {
    snapshot: rows.join("\n"),
    rows: front.height,
    cols: front.width,
  };
}

/**
 * Serialize a bundle to a stable JSON string with sorted top-level keys.
 * Useful for diffing snapshots in CI or comparing reports across runs.
 */
export function serializeBugReport(bundle: BugReportBundle): string {
  return JSON.stringify(bundle, null, 2);
}

/**
 * Write a bundle to disk as JSON. Returns the resolved path. Creates
 * parent directories if needed.
 */
export async function writeBugReport(
  handle: Pick<RenderHandle, "runtime"> | Runtime,
  filePath: string,
  options: CollectBugReportOptions = {},
): Promise<string> {
  const bundle = collectBugReport(handle, options);
  const dir = filePath.replace(/\/[^/]*$/, "");
  if (dir.length > 0 && dir !== filePath) {
    await fs.mkdir(dir, { recursive: true });
  }
  await fs.writeFile(filePath, serializeBugReport(bundle), "utf8");
  return filePath;
}
