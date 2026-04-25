#!/usr/bin/env node

import { promises as fs } from "node:fs";
import * as path from "node:path";

type TemplateId = "dashboard" | "cli-tool" | "log-viewer" | "crud-app";

interface TemplateFile {
  path: string;
  content: string;
}

interface TemplateDefinition {
  id: TemplateId;
  description: string;
  files: (projectName: string) => TemplateFile[];
}

const templates: Record<TemplateId, TemplateDefinition> = {
  dashboard: {
    id: "dashboard",
    description: "multi-panel app shell with tabs, commands, and persisted state",
    files: dashboardTemplate,
  },
  "cli-tool": {
    id: "cli-tool",
    description: "interactive command runner with async status and retries",
    files: cliToolTemplate,
  },
  "log-viewer": {
    id: "log-viewer",
    description: "streaming log viewer with filtering and severity controls",
    files: logViewerTemplate,
  },
  "crud-app": {
    id: "crud-app",
    description: "records dashboard with list/detail editing flows",
    files: crudTemplate,
  },
};

async function main(argv: readonly string[]): Promise<void> {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }
  if (args.list) {
    printTemplates();
    return;
  }

  const projectName = args.name ?? "graceglyph-app";
  const template = templates[args.template];
  const target = path.resolve(args.directory ?? projectName);
  await ensureEmptyTarget(target);

  for (const file of template.files(projectName)) {
    const destination = path.join(target, file.path);
    await fs.mkdir(path.dirname(destination), { recursive: true });
    await fs.writeFile(destination, file.content, "utf8");
  }

  console.log(`created ${projectName} with ${template.id} template`);
  console.log(`cd ${path.relative(process.cwd(), target) || "."}`);
  console.log("npm install");
  console.log("npm run dev");
}

function parseArgs(argv: readonly string[]): {
  name?: string;
  directory?: string;
  template: TemplateId;
  help: boolean;
  list: boolean;
} {
  let template: TemplateId = "dashboard";
  let name: string | undefined;
  let directory: string | undefined;
  let help = false;
  let list = false;

  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index]!;
    if (arg === "--help" || arg === "-h") {
      help = true;
      continue;
    }
    if (arg === "--list") {
      list = true;
      continue;
    }
    if (arg === "--template" || arg === "-t") {
      const next = argv[++index];
      if (!isTemplateId(next)) throw new Error(`unknown template: ${next ?? "(missing)"}`);
      template = next;
      continue;
    }
    if (arg.startsWith("--template=")) {
      const next = arg.slice("--template=".length);
      if (!isTemplateId(next)) throw new Error(`unknown template: ${next}`);
      template = next;
      continue;
    }
    if (arg === "--dir") {
      directory = argv[++index];
      if (!directory) throw new Error("--dir requires a path");
      continue;
    }
    if (arg.startsWith("--dir=")) {
      directory = arg.slice("--dir=".length);
      continue;
    }
    if (!name) {
      name = arg;
      continue;
    }
    throw new Error(`unexpected argument: ${arg}`);
  }

  return { name, directory, template, help, list };
}

async function ensureEmptyTarget(target: string): Promise<void> {
  try {
    const entries = await fs.readdir(target);
    if (entries.length > 0) {
      throw new Error(`${target} is not empty`);
    }
  } catch (error) {
    if (isMissingFile(error)) {
      await fs.mkdir(target, { recursive: true });
      return;
    }
    throw error;
  }
}

function printHelp(): void {
  console.log("create-graceglyph [name] --template <template>");
  console.log("");
  printTemplates();
}

function printTemplates(): void {
  console.log("templates:");
  for (const template of Object.values(templates)) {
    console.log(`  ${template.id.padEnd(10)} ${template.description}`);
  }
}

function isTemplateId(value: unknown): value is TemplateId {
  return typeof value === "string" && value in templates;
}

function isMissingFile(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "ENOENT"
  );
}

function baseFiles(projectName: string, main: string, description: string): TemplateFile[] {
  return [
    {
      path: "package.json",
      content: `${JSON.stringify(
        {
          name: packageName(projectName),
          version: "0.1.0",
          private: true,
          type: "module",
          description,
          scripts: {
            dev: "node --loader ts-node/esm src/main.tsx",
            build: "tsc -p tsconfig.json",
            test: "node --test --loader ts-node/esm test/*.test.ts",
          },
          dependencies: {
            graceglyph: "^0.0.1",
          },
          devDependencies: {
            "@types/node": "^20.11.0",
            "ts-node": "^10.9.2",
            typescript: "^5.4.0",
          },
        },
        null,
        2,
      )}\n`,
    },
    {
      path: "tsconfig.json",
      content: `${JSON.stringify(
        {
          compilerOptions: {
            target: "ES2022",
            module: "ES2022",
            moduleResolution: "Bundler",
            lib: ["ES2022"],
            strict: true,
            esModuleInterop: true,
            forceConsistentCasingInFileNames: true,
            skipLibCheck: true,
            jsx: "react-jsx",
            jsxImportSource: "graceglyph",
            noUncheckedIndexedAccess: true,
          },
          include: ["src/**/*.ts", "src/**/*.tsx", "test/**/*.ts", "test/**/*.tsx"],
        },
        null,
        2,
      )}\n`,
    },
    {
      path: "src/main.tsx",
      content: main,
    },
    {
      path: "README.md",
      content: `# ${projectName}\n\n${description}.\n\n## Run\n\n\`\`\`bash\nnpm install\nnpm run dev\n\`\`\`\n\n## Test\n\n\`\`\`bash\nnpm test\n\`\`\`\n`,
    },
    {
      path: "test/app.test.ts",
      content: `import test from "node:test";\nimport assert from "node:assert/strict";\n\nimport { renderTestApp } from "graceglyph/testing";\nimport { AppRoot } from "../src/main.js";\n\ntest("app renders without layout warnings", async () => {\n  const app = renderTestApp(<AppRoot />, { width: 100, height: 28, runtime: { devtools: false } });\n  try {\n    await app.settle();\n    assert.match(app.snapshot(), /${escapeRegExp(projectName)}/);\n    app.assertNoLayoutWarnings();\n  } finally {\n    app.stop();\n  }\n});\n`,
    },
  ];
}

function dashboardTemplate(projectName: string): TemplateFile[] {
  return baseFiles(
    projectName,
    `import {\n  AppShell,\n  Button,\n  Column,\n  Grid,\n  Panel,\n  Row,\n  Tabs,\n  Text,\n  ansi,\n  render,\n  useCommand,\n  usePersistentState,\n  useState,\n} from "graceglyph";\n\nconst tabs = [\n  { id: "overview", label: "Overview" },\n  { id: "jobs", label: "Jobs", badge: 4 },\n  { id: "settings", label: "Settings" },\n] as const;\n\nexport function AppRoot() {\n  const [path, setPath] = useState("/");\n  const [tab, setTab] = usePersistentState("dashboard.tab", "overview");\n  const [status, setStatus] = useState("ready");\n\n  useCommand({\n    id: "dashboard.refresh",\n    title: "Refresh dashboard",\n    group: "Dashboard",\n    keys: ["r"],\n    run: () => setStatus(\`refreshed at \${new Date().toLocaleTimeString()}\`),\n  }, []);\n\n  return (\n    <AppShell\n      title="${projectName}"\n      path={path}\n      onNavigate={setPath}\n      breadcrumbs={[{ label: "${projectName}", path: "/" }]}\n      windowBorderStyle={{ fg: ansi(6) }}\n    >\n      <Column gap={1} grow={1}>\n        <Tabs tabs={tabs} selectedId={tab} onChange={setTab} />\n        <Grid columns={2} gap={1}>\n          <Metric title="Latency" value="42ms" detail="p95 over 15m" />\n          <Metric title="Deploys" value="12" detail="3 waiting for review" />\n          <Metric title="Errors" value="0.04%" detail="below budget" />\n          <Metric title="Queue" value="128" detail="draining normally" />\n        </Grid>\n        <Panel title="Activity" grow={1}>\n          <Column gap={0}>\n            <Text>prod-api healthy after deploy web-2481</Text>\n            <Text>billing worker retried 2 jobs</Text>\n            <Text>cache warmer completed region iad</Text>\n          </Column>\n        </Panel>\n        <Row gap={1}>\n          <Button onClick={() => setStatus("manual refresh requested")}>Refresh</Button>\n          <Text style={{ dim: true }}>{status}</Text>\n        </Row>\n      </Column>\n    </AppShell>\n  );\n}\n\nfunction Metric(props: { title: string; value: string; detail: string }) {\n  return (\n    <Panel title={props.title}>\n      <Column gap={0}>\n        <Text style={{ bold: true }}>{props.value}</Text>\n        <Text style={{ dim: true }}>{props.detail}</Text>\n      </Column>\n    </Panel>\n  );\n}\n\nrender(<AppRoot />);\n`,
    "A production-style dashboard shell starter",
  );
}

function cliToolTemplate(projectName: string): TemplateFile[] {
  return baseFiles(
    projectName,
    `import {\n  AppShell,\n  Button,\n  Column,\n  Panel,\n  Row,\n  Text,\n  TextInput,\n  ansi,\n  render,\n  useAsync,\n  useCommand,\n  useState,\n} from "graceglyph";\n\nexport function AppRoot() {\n  const [path, setPath] = useState("/");\n  const [target, setTarget] = useState("production");\n  const [token, setToken] = useState(0);\n  const check = useAsync(async () => runCheck(target), [target, token]);\n\n  useCommand({\n    id: "cli.run",\n    title: "Run check",\n    group: "CLI",\n    keys: ["enter"],\n    run: () => setToken((value) => value + 1),\n  }, []);\n\n  return (\n    <AppShell\n      title="${projectName}"\n      path={path}\n      onNavigate={setPath}\n      breadcrumbs={[{ label: "${projectName}", path: "/" }]}\n      windowBorderStyle={{ fg: ansi(3) }}\n    >\n      <Column gap={1} grow={1}>\n        <Panel title="Command">\n          <Column gap={1}>\n            <TextInput value={target} onChange={setTarget} placeholder="target environment" />\n            <Row gap={1}>\n              <Button loading={check.loading} onClick={() => setToken((value) => value + 1)}>Run</Button>\n              <Button onClick={check.reload}>Retry</Button>\n              <Text style={{ dim: true }}>{check.loading ? "running" : "idle"}</Text>\n            </Row>\n          </Column>\n        </Panel>\n        <Panel title="Result" grow={1} borderStyle={{ fg: check.error ? ansi(1) : ansi(6) }}>\n          <Column gap={0}>\n            {check.error ? <Text>failed: {String(check.error)}</Text> : null}\n            {check.data?.map((line) => <Text key={line}>{line}</Text>)}\n          </Column>\n        </Panel>\n      </Column>\n    </AppShell>\n  );\n}\n\nasync function runCheck(target: string): Promise<string[]> {\n  await new Promise((resolve) => setTimeout(resolve, 120));\n  if (target.trim().length === 0) throw new Error("target is required");\n  return [\`target: \${target}\`, "connectivity: ok", "permissions: ok", "drift: none"];\n}\n\nrender(<AppRoot />);\n`,
    "An interactive terminal command starter",
  );
}

function logViewerTemplate(projectName: string): TemplateFile[] {
  return baseFiles(
    projectName,
    `import {\n  AppShell,\n  Button,\n  Column,\n  List,\n  Panel,\n  Row,\n  Text,\n  TextInput,\n  ansi,\n  render,\n  useCommand,\n  useDebouncedValue,\n  useInterval,\n  useState,\n} from "graceglyph";\n\ntype Level = "info" | "warn" | "error";\ninterface LogLine { id: number; level: Level; message: string; }\n\nexport function AppRoot() {\n  const [path, setPath] = useState("/");\n  const [lines, setLines] = useState<LogLine[]>(seedLines());\n  const [selected, setSelected] = useState(0);\n  const [query, setQuery] = useState("");\n  const [paused, setPaused] = useState(false);\n  const debounced = useDebouncedValue(query, 120);\n\n  useInterval(() => {\n    if (paused) return;\n    setLines((current) => [...current, nextLine(current.length + 1)].slice(-200));\n  }, 900);\n\n  useCommand({\n    id: "logs.pause",\n    title: paused ? "Resume stream" : "Pause stream",\n    group: "Logs",\n    keys: ["space"],\n    run: () => setPaused((value) => !value),\n  }, [paused]);\n\n  const visible = lines.filter((line) => line.message.toLowerCase().includes(debounced.toLowerCase()));\n\n  return (\n    <AppShell title="${projectName}" path={path} onNavigate={setPath} breadcrumbs={[{ label: "${projectName}", path: "/" }]}>\n      <Column gap={1} grow={1}>\n        <Row gap={1}>\n          <TextInput value={query} onChange={setQuery} placeholder="filter logs" grow={1} />\n          <Button onClick={() => setPaused((value) => !value)}>{paused ? "Resume" : "Pause"}</Button>\n        </Row>\n        <Panel title="Stream" grow={1} borderStyle={{ fg: ansi(6) }}>\n          <List\n            items={visible}\n            selected={selected}\n            onChange={setSelected}\n            height={14}\n            render={(line) => \`\${line.level.toUpperCase().padEnd(5)} \${line.message}\`}\n          />\n        </Panel>\n      </Column>\n    </AppShell>\n  );\n}\n\nfunction seedLines(): LogLine[] {\n  return [nextLine(1), nextLine(2), nextLine(3)];\n}\n\nfunction nextLine(id: number): LogLine {\n  const samples: Array<Omit<LogLine, "id">> = [\n    { level: "info", message: "GET /health 200 12ms" },\n    { level: "warn", message: "queue depth above target" },\n    { level: "error", message: "worker retry budget exhausted" },\n  ];\n  return { id, ...samples[id % samples.length]! };\n}\n\nrender(<AppRoot />);\n`,
    "A streaming log viewer starter",
  );
}

function crudTemplate(projectName: string): TemplateFile[] {
  return baseFiles(
    projectName,
    `import {\n  AppShell,\n  Button,\n  Column,\n  List,\n  Panel,\n  Row,\n  Text,\n  TextInput,\n  ansi,\n  render,\n  useCommand,\n  usePersistentState,\n  useState,\n} from "graceglyph";\n\ninterface Customer { id: string; name: string; owner: string; status: "active" | "paused"; }\n\nexport function AppRoot() {\n  const [path, setPath] = useState("/");\n  const [customers, setCustomers] = usePersistentState<Customer[]>("crud.customers", seedCustomers());\n  const [selected, setSelected] = useState(0);\n  const current = customers[selected] ?? customers[0]!;\n\n  useCommand({\n    id: "crud.toggle-status",\n    title: "Toggle customer status",\n    group: "Customers",\n    keys: ["space"],\n    run: () => updateCustomer(current.id, { status: current.status === "active" ? "paused" : "active" }),\n  }, [current.id, current.status]);\n\n  function updateCustomer(id: string, patch: Partial<Customer>): void {\n    setCustomers((items) => items.map((item) => item.id === id ? { ...item, ...patch } : item));\n  }\n\n  return (\n    <AppShell title="${projectName}" path={path} onNavigate={setPath} breadcrumbs={[{ label: "${projectName}", path: "/" }]} windowBorderStyle={{ fg: ansi(2) }}>\n      <Row gap={1} grow={1}>\n        <Panel title="Customers" padding={0}>\n          <List\n            items={customers}\n            selected={selected}\n            onChange={setSelected}\n            height={12}\n            render={(customer) => \`\${customer.status.padEnd(6)} \${customer.name}\`}\n          />\n        </Panel>\n        <Panel title="Details" grow={1}>\n          <Column gap={1}>\n            <TextInput value={current.name} onChange={(name) => updateCustomer(current.id, { name })} />\n            <TextInput value={current.owner} onChange={(owner) => updateCustomer(current.id, { owner })} />\n            <Row gap={1}>\n              <Button onClick={() => updateCustomer(current.id, { status: current.status === "active" ? "paused" : "active" })}>\n                Toggle status\n              </Button>\n              <Text>{current.status}</Text>\n            </Row>\n          </Column>\n        </Panel>\n      </Row>\n    </AppShell>\n  );\n}\n\nfunction seedCustomers(): Customer[] {\n  return [\n    { id: "c_001", name: "Acme Labs", owner: "Mira", status: "active" },\n    { id: "c_002", name: "Northstar", owner: "Jon", status: "paused" },\n    { id: "c_003", name: "Fieldstone", owner: "Ari", status: "active" },\n  ];\n}\n\nrender(<AppRoot />);\n`,
    "A CRUD terminal app starter",
  );
}

function packageName(name: string): string {
  return (
    name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, "-")
      .replace(/^-+|-+$/g, "") || "graceglyph-app"
  );
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

main(process.argv.slice(2)).catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
