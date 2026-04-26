/** @jsx h */

import {
  Accordion,
  App,
  Autocomplete,
  Avatar,
  Badge,
  Box,
  Button,
  ButtonGroup,
  BottomBar,
  Calendar,
  Card,
  Checkbox,
  Chip,
  Code,
  Column,
  Combobox,
  DatePicker,
  DiffView,
  Divider,
  EmptyState,
  ErrorBoundary,
  ErrorMessage,
  Form,
  FormField,
  IconButton,
  JSONViewer,
  KeyHints,
  Kbd,
  LogStream,
  MaskedInput,
  MultiSelect,
  Notifications,
  NumberInput,
  Pagination,
  Panel,
  PasswordInput,
  Pill,
  ProgressBar,
  ProgressRing,
  RadioGroup,
  RangeSlider,
  Row,
  Select,
  Sidebar,
  Skeleton,
  Slider,
  Sparkline,
  Spinner,
  StatusBar,
  Stepper,
  Suspense,
  Switch,
  Table,
  Tag,
  Text,
  TimePicker,
  ToggleButton,
  TopBar,
  Tooltip,
  Tree,
  Window,
  Wizard,
  ansi,
  h,
  useEffect,
  useState,
  type LogEntry,
  type LogLevel,
  type TableColumn,
  type TreeNode,
} from "../src/index.js";
import { runExample } from "./_entry.js";

interface GalleryRow {
  [key: string]: unknown;
  id: number;
  name: string;
  role: string;
  age: number;
}

const TABLE_ROWS: readonly GalleryRow[] = [
  { id: 1, name: "alice", role: "design", age: 32 },
  { id: 2, name: "bob", role: "infra", age: 28 },
  { id: 3, name: "carol", role: "data", age: 41 },
  { id: 4, name: "dave", role: "devx", age: 36 },
];

const TABLE_COLUMNS: readonly TableColumn<GalleryRow>[] = [
  { id: "name", header: "Name", sortable: true, fr: 2 },
  { id: "role", header: "Role", sortable: true, fr: 2 },
  { id: "age", header: "Age", sortable: true, align: "right" },
];

const SAMPLE_CODE = [
  "// guarded against double-firing",
  "function refreshToken() {",
  "  if (refreshPromise) return refreshPromise;",
  "  refreshPromise = doRefresh().finally(() => (refreshPromise = null));",
  "  return refreshPromise;",
  "}",
].join("\n");

const SAMPLE_DIFF = [
  "diff --git a/refresh.ts b/refresh.ts",
  "--- a/refresh.ts",
  "+++ b/refresh.ts",
  "@@ -1,5 +1,6 @@",
  " function refreshToken() {",
  "-  if (isRefreshing) return;",
  "+  if (refreshPromise) return refreshPromise;",
  "+  refreshPromise = doRefresh().finally(() => (refreshPromise = null));",
  "   return refreshPromise;",
  " }",
].join("\n");

const SAMPLE_JSON = {
  build: {
    id: "ci-2026-04-25-001",
    duration_ms: 18753,
    coverage: { lines: 0.92, branches: 0.86 },
    artifacts: ["dist/index.js", "dist/index.d.ts"],
  },
  passing: true,
  notes: null,
};

const TREE_NODES: readonly TreeNode[] = [
  {
    id: "src",
    label: "src",
    children: [
      { id: "src/index.ts", label: "index.ts" },
      {
        id: "src/components",
        label: "components",
        children: [
          { id: "src/components/Button.tsx", label: "Button.tsx" },
          { id: "src/components/Table.tsx", label: "Table.tsx" },
        ],
      },
    ],
  },
  { id: "README.md", label: "README.md" },
];

interface DemoTag {
  id: string;
  label: string;
}

const INITIAL_TAGS: readonly DemoTag[] = [
  { id: "tui", label: "tui" },
  { id: "typescript", label: "typescript" },
  { id: "graceglyph", label: "graceglyph" },
];

const DENSITY_OPTIONS = [
  { value: "comfortable", label: "Comfortable" },
  { value: "compact", label: "Compact" },
  { value: "tight", label: "Tight" },
] as const;

type Density = (typeof DENSITY_OPTIONS)[number]["value"];

interface GalleryDate {
  year: number;
  month: number;
  day: number;
}

const REGION_OPTIONS = [
  { value: "iad", label: "us-east-1 / iad" },
  { value: "sfo", label: "us-west-1 / sfo" },
  { value: "fra", label: "eu-central-1 / fra" },
] as const;

const OWNER_SUGGESTIONS = ["ada", "brendan", "carol", "drew", "linus", "margaret"];

const FLAG_OPTIONS = [
  { value: "audit", label: "Audit log" },
  { value: "trace", label: "Trace IDs" },
  { value: "alerts", label: "Alerts" },
  { value: "replay", label: "Replay buffer", disabled: true },
] as const;

export function ComponentsGalleryApp() {
  const [notify, setNotify] = useState(true);
  const [analytics, setAnalytics] = useState(false);
  const [autoSync, setAutoSync] = useState(true);
  const [density, setDensity] = useState<Density>("comfortable");
  const [tags, setTags] = useState<readonly DemoTag[]>(INITIAL_TAGS);
  const [progress, setProgress] = useState(0.18);
  const [series, setSeries] = useState<readonly number[]>(seedSeries());
  const [volume, setVolume] = useState(0.4);
  const [budget, setBudget] = useState<[number, number]>([200, 800]);
  const [team, setTeam] = useState(8);
  const [secret, setSecret] = useState("hunter2");
  const [favorite, setFavorite] = useState<string>("emerald");
  const [pinned, setPinned] = useState({ a: true, b: false, c: false });
  const [loadingPanel, setLoadingPanel] = useState(true);
  const [tableSelected, setTableSelected] = useState(0);
  const [tableSort, setTableSort] = useState<{
    columnId: string;
    direction: "asc" | "desc";
  } | null>(null);
  const [treeExpanded, setTreeExpanded] = useState<Record<string, boolean>>({
    src: true,
  });
  const [treeSelected, setTreeSelected] = useState<string>("src");
  const [accordionOpen, setAccordionOpen] = useState<readonly string[]>(["onboarding"]);
  const [stepperStep, setStepperStep] = useState(1);
  const [page, setPage] = useState(2);
  const [logs, setLogs] = useState<readonly LogEntry[]>(() => seedLogs());
  const [logFilter, setLogFilter] = useState("");
  const [logsPaused, setLogsPaused] = useState(false);
  const [favoriteRegion, setFavoriteRegion] =
    useState<(typeof REGION_OPTIONS)[number]["value"]>("iad");
  const [owner, setOwner] = useState("ada");
  const [flags, setFlags] = useState<readonly string[]>(["audit", "trace"]);
  const [phone, setPhone] = useState("3135550100");
  const [wizardStep, setWizardStep] = useState(0);
  const [formSaved, setFormSaved] = useState(false);
  const [releaseDate, setReleaseDate] = useState<GalleryDate>({
    year: 2026,
    month: 3,
    day: 26,
  });
  const [calendarMonth, setCalendarMonth] = useState<Pick<GalleryDate, "year" | "month">>({
    year: 2026,
    month: 3,
  });
  const [deployTime, setDeployTime] = useState({ hour: 9, minute: 30, second: 0 });
  const [noticeOpen, setNoticeOpen] = useState(true);

  // Trickle new log entries when not paused.
  useEffect(() => {
    const handle = setInterval(() => {
      if (logsPaused) return;
      setLogs((current) => {
        const next: LogEntry = {
          id: current.length + 1,
          timestamp: Date.now(),
          level: pickLevel(),
          message: pickMessage(current.length + 1),
        };
        const trimmed = current.length >= 64 ? current.slice(-63) : current;
        return [...trimmed, next];
      });
    }, 380);
    return () => clearInterval(handle);
  }, [logsPaused]);

  // Toggle the loading panel every few seconds so the skeleton is visible.
  useEffect(() => {
    const handle = setInterval(() => setLoadingPanel((v) => !v), 2400);
    return () => clearInterval(handle);
  }, []);

  // Animate the progress bar so the demo is alive.
  useEffect(() => {
    const handle = setInterval(() => {
      setProgress((p) => (p >= 1 ? 0 : Math.min(1, p + 0.04)));
    }, 220);
    return () => clearInterval(handle);
  }, []);

  // Trickle new sparkline samples so it looks like a live feed.
  useEffect(() => {
    const handle = setInterval(() => {
      setSeries((current) => {
        const next = [
          ...current.slice(1),
          Math.max(0, Math.min(100, lastValue(current) + jitter())),
        ];
        return next;
      });
    }, 350);
    return () => clearInterval(handle);
  }, []);

  function removeTag(id: string): void {
    setTags((current) => current.filter((tag) => tag.id !== id));
  }

  function resetTags(): void {
    setTags(INITIAL_TAGS);
  }

  return (
    <App>
      <Window title="Component gallery" grow={1} padding={1}>
        <Column gap={1} grow={1}>
          <Text style={{ dim: true }}>
            Hand-rolled showcase of the new tier-1 and tier-2 primitives. Tab cycles focus.
          </Text>

          <Divider label="Form primitives" />

          <Row gap={2}>
            <Column gap={1} width={28}>
              <Checkbox checked={notify} onChange={setNotify} label="Email me on release" />
              <Checkbox
                checked={analytics}
                onChange={setAnalytics}
                label="Share anonymous metrics"
              />
              <Switch checked={autoSync} onChange={setAutoSync} label="Auto-sync" />
            </Column>

            <Column gap={1} grow={1}>
              <Text style={{ bold: true }}>Density</Text>
              <RadioGroup
                value={density}
                onChange={setDensity}
                options={DENSITY_OPTIONS as unknown as readonly { value: Density; label: string }[]}
              />
            </Column>
          </Row>

          <Divider label="Status & feedback" />

          <Row gap={2}>
            <Column gap={1} width={32}>
              <Row gap={1}>
                <Badge variant="info">v0.2-next</Badge>
                <Badge variant="success">build passing</Badge>
                <Badge variant="warning">flaky</Badge>
                <Badge variant="danger">incident</Badge>
              </Row>
              <Row gap={1}>
                <Spinner label="syncing" />
                <Spinner variant="bouncingBar" label="indexing" interval={120} />
              </Row>
              <ProgressBar value={progress} width={20} showPercent />
              <ProgressBar indeterminate width={20} label="warming caches" />
            </Column>

            <Panel title="Live feed" padding={0} grow={1}>
              <Column gap={1}>
                <Sparkline values={series} />
                <Text style={{ dim: true }}>last value: {Math.round(lastValue(series))}</Text>
              </Column>
            </Panel>
          </Row>

          <Divider label="Tags & shortcuts" />

          <Row gap={1}>
            {tags.map((tag) => (
              <Tag key={tag.id} onRemove={() => removeTag(tag.id)}>
                {tag.label}
              </Tag>
            ))}
            <Button onClick={resetTags}>Reset</Button>
          </Row>

          <Row gap={2}>
            <Text>Press</Text>
            <Kbd>Tab</Kbd>
            <Text>to focus,</Text>
            <Kbd>{["Ctrl", "K"]}</Kbd>
            <Text>for the palette,</Text>
            <Kbd>F12</Kbd>
            <Text>for the inspector.</Text>
          </Row>

          <Divider label="Inputs & ranges" />

          <Row gap={2}>
            <Column gap={1} width={36}>
              <Text style={{ bold: true }}>Volume</Text>
              <Slider value={volume} onChange={setVolume} min={0} max={1} step={0.05} width={24} />

              <Text style={{ bold: true }}>Budget</Text>
              <RangeSlider
                value={budget}
                onChange={setBudget}
                min={0}
                max={1000}
                step={25}
                width={26}
              />
              <Text style={{ dim: true }}>↑/↓ swap thumbs · ←/→ adjust active</Text>
            </Column>

            <Column gap={1} grow={1}>
              <Text style={{ bold: true }}>Team size</Text>
              <Row gap={1}>
                <NumberInput value={team} onChange={setTeam} min={1} max={50} step={1} width={6} />
                <Text style={{ dim: true }}>↑/↓ adjusts</Text>
              </Row>

              <Text style={{ bold: true }}>API token</Text>
              <PasswordInput value={secret} onChange={setSecret} width={20} />

              <Text style={{ bold: true }}>Favorite color</Text>
              <Select
                value={favorite}
                onChange={setFavorite}
                width={22}
                options={[
                  { value: "emerald", label: "Emerald" },
                  { value: "azure", label: "Azure" },
                  { value: "amber", label: "Amber" },
                  { value: "rose", label: "Rose" },
                  { value: "slate", label: "Slate" },
                ]}
              />
            </Column>
          </Row>

          <Divider label="Toggle group & loading" />

          <Row gap={2}>
            <ButtonGroup>
              <ToggleButton pressed={pinned.a} onChange={(v) => setPinned((p) => ({ ...p, a: v }))}>
                Pin A
              </ToggleButton>
              <ToggleButton pressed={pinned.b} onChange={(v) => setPinned((p) => ({ ...p, b: v }))}>
                Pin B
              </ToggleButton>
              <ToggleButton pressed={pinned.c} onChange={(v) => setPinned((p) => ({ ...p, c: v }))}>
                Pin C
              </ToggleButton>
            </ButtonGroup>

            <Panel title="User card" padding={1} grow={1}>
              {loadingPanel ? (
                <Column gap={0}>
                  <Skeleton width={18} />
                  <Skeleton width={26} />
                  <Skeleton width={22} />
                </Column>
              ) : (
                <Column gap={0}>
                  <Text>quentin@graceglyph</Text>
                  <Text style={{ dim: true }}>account: maintainer · joined Apr 2026</Text>
                  <Text style={{ dim: true }}>last login: just now</Text>
                </Column>
              )}
            </Panel>
          </Row>

          <Divider label="Data display" />

          <Row gap={2}>
            <Panel title="People" padding={0} grow={1}>
              <Table
                rows={TABLE_ROWS}
                columns={TABLE_COLUMNS}
                selected={tableSelected}
                onSelectChange={setTableSelected}
                sort={tableSort ?? undefined}
                onSortChange={setTableSort}
                zebra
                height={6}
              />
            </Panel>

            <Panel title="Files" padding={0} width={32}>
              <Tree
                nodes={TREE_NODES}
                expanded={treeExpanded}
                onToggle={(id, isOpen) => setTreeExpanded((prev) => ({ ...prev, [id]: isOpen }))}
                selectedId={treeSelected}
                onSelect={(id) => setTreeSelected(id)}
                height={6}
              />
            </Panel>
          </Row>

          <Divider label="Flow & navigation" />

          <Row gap={2}>
            <Column grow={1}>
              <Stepper
                steps={[
                  { id: "plan", label: "Plan" },
                  { id: "build", label: "Build" },
                  { id: "ship", label: "Ship" },
                ]}
                current={stepperStep}
                onChange={setStepperStep}
              />

              <Accordion
                items={[
                  {
                    id: "onboarding",
                    title: "Onboarding",
                    content: "Walks new users through the showcase modules.",
                  },
                  {
                    id: "shortcuts",
                    title: "Shortcuts",
                    content: "Keyboard shortcuts are listed in the help overlay (?).",
                  },
                  {
                    id: "telemetry",
                    title: "Telemetry",
                    content: "graceglyph never phones home — telemetry is opt-in only.",
                  },
                ]}
                openIds={accordionOpen}
                onChange={setAccordionOpen}
                mode="single"
              />
            </Column>

            <Column width={36} gap={1}>
              <Pagination page={page} pageCount={9} onChange={setPage} windowSize={5} />

              <Tooltip label="Search current view (Ctrl+F)">
                <Button>Search</Button>
              </Tooltip>

              <EmptyState
                title="No incidents"
                description="Pages will appear here when something needs attention."
                icon="¯\\_(ツ)_/¯"
              />
            </Column>
          </Row>

          <Divider label="Code, diffs, JSON, logs" />

          <Row gap={1}>
            <Panel title="refresh.ts" padding={0} grow={1}>
              <Code language="typescript" showLineNumbers>
                {SAMPLE_CODE}
              </Code>
            </Panel>

            <Panel title="diff" padding={0} grow={1}>
              <DiffView unified={SAMPLE_DIFF} />
            </Panel>
          </Row>

          <Row gap={1}>
            <Panel title="last build" padding={0} width={36}>
              <JSONViewer value={SAMPLE_JSON} defaultExpandDepth={-1} />
            </Panel>

            <Panel title="logs (live)" padding={0} grow={1}>
              <Column gap={0} grow={1}>
                <Row gap={1}>
                  <Text>filter:</Text>
                  <PasswordInput value={logFilter} onChange={setLogFilter} width={16} />
                  <Button onClick={() => setLogsPaused((v) => !v)}>
                    {logsPaused ? "Resume" : "Pause"}
                  </Button>
                  {logsPaused ? <Badge variant="warning">paused</Badge> : null}
                </Row>
                <LogStream
                  entries={logs}
                  filter={logFilter}
                  paused={logsPaused}
                  showTimestamp
                  height={6}
                />
              </Column>
            </Panel>
          </Row>

          <Divider label="Application chrome" />

          <Row gap={2}>
            <Column gap={1} width={36}>
              <TopBar>
                <Text>graceglyph.dev</Text>
                <Box grow={1} />
                <IconButton icon="↻" ariaLabel="Refresh" onClick={() => setNoticeOpen(true)} />
              </TopBar>

              <Row gap={1}>
                <Avatar name="Grace Glyph" variant="accent" />
                <Column gap={0}>
                  <Text style={{ bold: true }}>Framework shell</Text>
                  <Row gap={1}>
                    <Pill variant="success" icon="✓">
                      stable
                    </Pill>
                    <Chip icon="⚑" onRemove={() => setFormSaved(false)}>
                      branch: main
                    </Chip>
                  </Row>
                </Column>
              </Row>

              <KeyHints
                hints={[
                  { keys: ["Ctrl", "K"], label: "commands" },
                  { keys: "?", label: "help" },
                  { keys: "Esc", label: "close" },
                ]}
              />

              <StatusBar left="ready" center={`region ${favoriteRegion}`} right="0 errors" />
              <BottomBar>
                <Text style={{ dim: true }}>workspace: graceglyph</Text>
              </BottomBar>
            </Column>

            <Card title="Shell slots" footer="TopBar · Sidebar · BottomBar" width={60}>
              <Row gap={1}>
                <Sidebar width={16} height={6} padding={[0, 1]}>
                  <Text>Navigation</Text>
                  <Text style={{ dim: true }}>Components</Text>
                  <Text style={{ dim: true }}>Themes</Text>
                  <Text style={{ dim: true }}>Testing</Text>
                </Sidebar>
                <Column gap={1} grow={1}>
                  <ProgressRing value={progress} label="release gate" />
                  <ProgressRing label="watching" intervalMs={160} />
                  <Notifications
                    width={34}
                    onDismiss={() => setNoticeOpen(false)}
                    items={
                      noticeOpen
                        ? [
                            {
                              id: "gallery",
                              kind: "info",
                              title: "Story loaded",
                              message: "Chrome primitives are wired into the gallery.",
                            },
                          ]
                        : []
                    }
                  />
                </Column>
              </Row>
            </Card>
          </Row>

          <Divider label="Advanced forms" />

          <Row gap={2}>
            <Form onSubmit={() => setFormSaved(true)}>
              <FormField label="Region" description="Combobox with filtered options">
                <Combobox
                  value={favoriteRegion}
                  onChange={setFavoriteRegion}
                  options={REGION_OPTIONS}
                  width={24}
                />
              </FormField>

              <FormField label="Owner" description="Autocomplete suggestions">
                <Autocomplete
                  value={owner}
                  onChange={setOwner}
                  suggestions={(query) =>
                    OWNER_SUGGESTIONS.filter((item) => item.startsWith(query.toLowerCase()))
                  }
                  width={24}
                />
              </FormField>

              <FormField
                label="Flags"
                description="Multi-select with a disabled option"
                error={flags.length === 0 ? "Pick at least one flag" : undefined}
              >
                <MultiSelect
                  value={flags}
                  onChange={setFlags}
                  options={FLAG_OPTIONS}
                  width={24}
                  max={3}
                />
              </FormField>

              <FormField label="Support phone">
                <MaskedInput mask="(###) ###-####" value={phone} onChange={setPhone} width={16} />
              </FormField>

              {formSaved ? (
                <Text style={{ fg: ansi(2) }}>Saved draft settings</Text>
              ) : (
                <ErrorMessage>Ctrl+Enter submits this form shell.</ErrorMessage>
              )}
            </Form>

            <Column gap={1} grow={1}>
              <Wizard
                current={wizardStep}
                onChange={setWizardStep}
                onSubmit={() => setFormSaved(true)}
                steps={[
                  { id: "scope", label: "Scope", content: "Choose component tiers." },
                  {
                    id: "review",
                    label: "Review",
                    content: "Validate tokens, tests, and stories.",
                    canAdvance: () => flags.length > 0,
                  },
                  { id: "ship", label: "Ship", content: "Publish the next preview." },
                ]}
              />

              <Panel title="Resilience" padding={1}>
                <Column gap={1}>
                  <ErrorBoundary
                    render={() => {
                      if (!noticeOpen) throw new Error("dismissed notification queue");
                      return <Text>Notification queue is mounted.</Text>;
                    }}
                    fallback={(error) => <Text style={{ fg: ansi(3) }}>{error.message}</Text>}
                  />
                  <Suspense when={loadingPanel} fallback="Loading async resource…">
                    <Text>Async resource ready.</Text>
                  </Suspense>
                </Column>
              </Panel>
            </Column>
          </Row>

          <Divider label="Temporal inputs" />

          <Row gap={2}>
            <Calendar
              month={calendarMonth}
              onMonthChange={setCalendarMonth}
              selected={releaseDate}
              onSelect={setReleaseDate}
            />

            <Column gap={1}>
              <FormField label="Release date">
                <DatePicker value={releaseDate} onChange={setReleaseDate} showCalendar width={24} />
              </FormField>

              <FormField label="Deploy time">
                <TimePicker
                  value={deployTime}
                  onChange={(next) =>
                    setDeployTime({
                      hour: next.hour,
                      minute: next.minute,
                      second: next.second ?? 0,
                    })
                  }
                  showSeconds
                  width={12}
                />
              </FormField>

              <Text style={{ dim: true }}>
                Scheduled: {releaseDate.year}-{pad2(releaseDate.month + 1)}-{pad2(releaseDate.day)}{" "}
                {pad2(deployTime.hour)}:{pad2(deployTime.minute)}:{pad2(deployTime.second)}
              </Text>
            </Column>
          </Row>

          <Box grow={1} />
          <Text style={{ dim: true }}>
            Notify: {notify ? "on" : "off"} · Analytics: {analytics ? "on" : "off"} · Auto-sync:{" "}
            {autoSync ? "on" : "off"} · Density: {density} · Vol: {Math.round(volume * 100)}% ·
            Budget: {budget[0]}–{budget[1]} · Team: {team} · Color: {favorite} · Page: {page} ·
            Step: {stepperStep} · Logs: {logs.length}
          </Text>
        </Column>
      </Window>
    </App>
  );
}

runExample(<ComponentsGalleryApp />, import.meta.url);

function seedSeries(): number[] {
  const values: number[] = [];
  for (let i = 0; i < 32; i++) {
    values.push(40 + Math.sin(i / 3) * 20 + Math.random() * 8);
  }
  return values;
}

function lastValue(series: readonly number[]): number {
  return series[series.length - 1] ?? 0;
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

function jitter(): number {
  return (Math.random() - 0.5) * 14;
}

const LOG_MESSAGES = [
  "build: rebuilt 12 files",
  "test: 180 passed",
  "deploy: rollout 3 of 5",
  "warn: cache miss on /api/users",
  "error: 503 from upstream",
  "info: connection established",
  "debug: gc collected 4MB",
] as const;

function seedLogs(): LogEntry[] {
  const base = Date.now() - 6 * 1000;
  return Array.from({ length: 8 }, (_, i) => ({
    id: i + 1,
    timestamp: base + i * 400,
    level: pickLevel(),
    message: pickMessage(i + 1),
  }));
}

function pickLevel(): LogLevel {
  const r = Math.random();
  if (r < 0.55) return "info";
  if (r < 0.8) return "debug";
  if (r < 0.95) return "warn";
  return "error";
}

function pickMessage(n: number): string {
  return `${LOG_MESSAGES[n % LOG_MESSAGES.length]}`;
}
