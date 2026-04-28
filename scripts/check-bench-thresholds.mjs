import { readFileSync } from "node:fs";

const STDIN_SENTINEL = "-";

const THRESHOLDS = [
  { contains: "static-frame: 200x60 paint", metric: "p50Ms", max: 8 },
  { contains: "static-frame: 200x60 diff", metric: "p99Ms", max: 16 },
  { contains: "table-scroll:", metric: "p50Ms", max: 4 },
  { contains: "resize-storm:", metric: "p50Ms", max: 2 },
];

function formatMs(value) {
  return `${value.toFixed(3)}ms`;
}

function parseResults(pathOrStdin) {
  const raw =
    pathOrStdin === STDIN_SENTINEL ? readFileSync(0, "utf8") : readFileSync(pathOrStdin, "utf8");
  const payload = JSON.parse(raw);
  if (!payload || !Array.isArray(payload.results)) {
    throw new Error(
      pathOrStdin === STDIN_SENTINEL
        ? "invalid benchmark payload on stdin"
        : `invalid benchmark payload in ${pathOrStdin}`,
    );
  }
  return payload.results;
}

function findScenario(results, needle) {
  return results.find((entry) => typeof entry.name === "string" && entry.name.includes(needle));
}

function checkThresholds(results) {
  const failures = [];
  for (const threshold of THRESHOLDS) {
    const scenario = findScenario(results, threshold.contains);
    if (!scenario) {
      failures.push(`missing scenario containing "${threshold.contains}"`);
      continue;
    }
    const value = scenario[threshold.metric];
    if (typeof value !== "number" || !Number.isFinite(value)) {
      failures.push(`scenario "${scenario.name}" has invalid metric ${threshold.metric}`);
      continue;
    }
    if (value >= threshold.max) {
      failures.push(
        `${scenario.name}: ${threshold.metric}=${formatMs(value)} exceeds <${formatMs(threshold.max)}`,
      );
    }
  }
  return failures;
}

function main() {
  const inputPath = process.argv[2] || STDIN_SENTINEL;
  const results = parseResults(inputPath);
  const failures = checkThresholds(results);
  if (failures.length > 0) {
     
    console.error("bench threshold check failed:");
    for (const failure of failures) {
       
      console.error(`- ${failure}`);
    }
    process.exitCode = 1;
    return;
  }
  // eslint-disable-next-line no-console
  console.log("bench threshold check passed");
}

main();
