#!/usr/bin/env node

import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import * as path from "node:path";

const self = fileURLToPath(import.meta.url);
const createScript = path.resolve(path.dirname(self), "create.ts");

const args = process.argv.slice(2);
const hasTemplate = args.some((arg) => arg === "--template" || arg.startsWith("--template="));
const forwarded = hasTemplate ? args : [...args, "--template", "component"];

const child = spawn(process.execPath, ["--loader", "ts-node/esm", createScript, ...forwarded], {
  stdio: "inherit",
});

child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 1);
});
