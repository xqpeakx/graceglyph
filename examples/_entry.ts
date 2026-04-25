import * as path from "node:path";
import { fileURLToPath } from "node:url";

import { render } from "../src/index.js";
import type { ZenElement } from "../src/index.js";

export function runExample(element: ZenElement, metaUrl: string): void {
  const entry = process.argv[1];
  if (!entry) return;

  const currentFile = path.resolve(fileURLToPath(metaUrl));
  const invokedFile = path.resolve(entry);

  if (currentFile === invokedFile) {
    render(element);
  }
}
