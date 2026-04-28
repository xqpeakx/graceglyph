import { readFileSync } from "node:fs";

const STDIN_SENTINEL = "-";

function parsePayload(pathOrStdin) {
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
  return payload;
}

function parseBaseline(path) {
  const baseline = JSON.parse(readFileSync(path, "utf8"));
  if (!baseline || !Array.isArray(baseline.cases) || typeof baseline.policy !== "object") {
    throw new Error(`invalid benchmark baseline in ${path}`);
  }
  return baseline;
}

function formatMs(value) {
  return `${value.toFixed(3)}ms`;
}

function findScenario(results, needle) {
  return results.find((entry) => typeof entry.name === "string" && entry.name.includes(needle));
}

function checkDrift(current, baseline) {
  const failures = [];
  const regressions = [];
  const policy = baseline.policy?.maxRegressionPct ?? {};

  for (const entry of baseline.cases) {
    const scenario = findScenario(current.results, entry.nameContains);
    if (!scenario) {
      failures.push(`missing scenario containing "${entry.nameContains}"`);
      continue;
    }

    for (const [metric, baselineValue] of Object.entries(entry.metrics ?? {})) {
      const currentValue = scenario[metric];
      if (typeof baselineValue !== "number" || !Number.isFinite(baselineValue)) {
        failures.push(`baseline metric ${metric} for "${entry.nameContains}" is invalid`);
        continue;
      }
      if (typeof currentValue !== "number" || !Number.isFinite(currentValue)) {
        failures.push(`scenario "${scenario.name}" has invalid metric ${metric}`);
        continue;
      }

      const maxRegressionPct = policy[metric];
      if (typeof maxRegressionPct !== "number" || maxRegressionPct < 0) {
        failures.push(`missing or invalid drift policy for metric "${metric}"`);
        continue;
      }

      const allowed = baselineValue * (1 + maxRegressionPct);
      const deltaPct = baselineValue === 0 ? 0 : (currentValue - baselineValue) / baselineValue;
      regressions.push({ scenario: scenario.name, metric, currentValue, baselineValue, deltaPct });
      if (currentValue > allowed) {
        failures.push(
          `${scenario.name}: ${metric}=${formatMs(currentValue)} exceeds allowed drift from ${formatMs(
            baselineValue,
          )} by ${(deltaPct * 100).toFixed(1)}% (limit ${(maxRegressionPct * 100).toFixed(1)}%)`,
        );
      }
    }
  }

  return { failures, regressions };
}

function main() {
  const inputPath = process.argv[2] || STDIN_SENTINEL;
  const baselinePath = process.argv[3] || "bench/baseline.json";
  const current = parsePayload(inputPath);
  const baseline = parseBaseline(baselinePath);
  const { failures, regressions } = checkDrift(current, baseline);
  const enforce = process.env.BENCH_DRIFT_ENFORCE === "1";

  if (failures.length > 0) {
    if (!enforce) {
      console.warn(
        `bench drift check (informational): skipping enforcement on ${current.platform}/${current.arch} (set BENCH_DRIFT_ENFORCE=1 to enforce).`,
      );
      for (const failure of failures) {
        console.warn(`- ${failure}`);
      }
      return;
    }
    console.error("bench drift check failed:");
    for (const failure of failures) {
      console.error(`- ${failure}`);
    }
    process.exitCode = 1;
    return;
  }

  // eslint-disable-next-line no-console
  console.log("bench drift check passed");
  for (const row of regressions) {
    // eslint-disable-next-line no-console
    console.log(
      `- ${row.scenario}: ${row.metric} ${formatMs(row.currentValue)} vs baseline ${formatMs(
        row.baselineValue,
      )} (${(row.deltaPct * 100).toFixed(1)}%)`,
    );
  }
}

main();
