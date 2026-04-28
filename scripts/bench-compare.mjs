import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const STDIN_SENTINEL = "-";
const DEFAULT_COMPETITOR_FILES = [
  "bench/competitors/ink.json",
  "bench/competitors/blessed.json",
  "bench/competitors/terminal-kit.json",
];

function parseJson(pathOrStdin) {
  const raw =
    pathOrStdin === STDIN_SENTINEL ? readFileSync(0, "utf8") : readFileSync(resolve(pathOrStdin), "utf8");
  return JSON.parse(raw);
}

function parseCurrent(pathOrStdin) {
  const payload = parseJson(pathOrStdin);
  if (!payload || !Array.isArray(payload.results)) {
    throw new Error(
      pathOrStdin === STDIN_SENTINEL
        ? "invalid current benchmark payload on stdin"
        : `invalid current benchmark payload in ${pathOrStdin}`,
    );
  }
  return payload;
}

function parseCompetitor(path) {
  const payload = parseJson(path);
  if (!payload || typeof payload.framework !== "string" || !Array.isArray(payload.results)) {
    throw new Error(`invalid competitor payload in ${path}`);
  }
  return payload;
}

function findByContains(results, contains) {
  return results.find((entry) => typeof entry.name === "string" && entry.name.includes(contains));
}

function formatMetric(value) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "n/a";
  return `${value.toFixed(3)}ms`;
}

function compare(currentPayload, competitors) {
  const scenarios = currentPayload.results.map((entry) => ({
    name: entry.name,
    p50Ms: entry.p50Ms,
    p99Ms: entry.p99Ms,
  }));

  const rows = scenarios.map((scenario) => {
    const perCompetitor = {};
    for (const competitor of competitors) {
      const match = findByContains(competitor.results, scenario.name);
      perCompetitor[competitor.framework] = {
        p50Ms: match?.p50Ms ?? null,
        p99Ms: match?.p99Ms ?? null,
      };
    }
    return {
      scenario,
      competitors: perCompetitor,
    };
  });

  return rows;
}

function scoreWins(rows, competitors) {
  const scoreboard = Object.fromEntries(competitors.map((comp) => [comp.framework, 0]));
  for (const row of rows) {
    for (const framework of Object.keys(scoreboard)) {
      const cmp = row.competitors[framework];
      if (typeof cmp?.p50Ms !== "number" || !Number.isFinite(cmp.p50Ms)) continue;
      if (typeof row.scenario.p50Ms !== "number" || !Number.isFinite(row.scenario.p50Ms)) continue;
      if (row.scenario.p50Ms < cmp.p50Ms) scoreboard[framework] += 1;
    }
  }
  return scoreboard;
}

function printMarkdown(rows, competitors) {
  const header = [
    "scenario",
    "graceglyph p50",
    "graceglyph p99",
    ...competitors.flatMap((c) => [`${c.framework} p50`, `${c.framework} p99`]),
  ];
  const separator = header.map(() => "---");
  // eslint-disable-next-line no-console
  console.log(`| ${header.join(" | ")} |`);
  // eslint-disable-next-line no-console
  console.log(`| ${separator.join(" | ")} |`);
  for (const row of rows) {
    const cells = [
      row.scenario.name,
      formatMetric(row.scenario.p50Ms),
      formatMetric(row.scenario.p99Ms),
      ...competitors.flatMap((comp) => {
        const metrics = row.competitors[comp.framework] ?? {};
        return [formatMetric(metrics.p50Ms), formatMetric(metrics.p99Ms)];
      }),
    ];
    // eslint-disable-next-line no-console
    console.log(`| ${cells.join(" | ")} |`);
  }
}

function main() {
  const inputPath = process.argv[2] || STDIN_SENTINEL;
  const competitorPaths = process.argv.slice(3);
  const files = competitorPaths.length > 0 ? competitorPaths : DEFAULT_COMPETITOR_FILES;
  const current = parseCurrent(inputPath);
  const competitors = files.map((path) => parseCompetitor(path));
  const rows = compare(current, competitors);
  printMarkdown(rows, competitors);
  const wins = scoreWins(rows, competitors);
  // eslint-disable-next-line no-console
  console.log("");
  // eslint-disable-next-line no-console
  console.log("graceglyph p50 win count by framework:");
  for (const [framework, winsCount] of Object.entries(wins)) {
    // eslint-disable-next-line no-console
    console.log(`- vs ${framework}: ${winsCount}`);
  }
}

main();
