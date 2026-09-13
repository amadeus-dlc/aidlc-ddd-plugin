import { resolve } from "node:path";
import { extractRust, rustVersions } from "../rust/state-evidence/index.ts";
import { inspectStateExposure, type ToolVersion } from "../state-exposure/index.ts";
import { extractTypeScript, TS_TOOLCHAIN } from "../typescript/state-evidence/index.ts";
import { FIXTURES, loadCases, type VerificationCase } from "./cases.ts";
import { parseOptions } from "./options.ts";
import { issue, type Limits, type Observation } from "./process.ts";
import { compareResult, newReport, type VerificationReport } from "./report.ts";

export interface RunnerDependencies {
  load: () => VerificationCase[];
  probe: (language: string) => Promise<readonly ToolVersion[]>;
  extract: (entry: VerificationCase, limits: Limits) => Promise<Observation>;
}
async function probe(language: string): Promise<readonly ToolVersion[]> {
  if (language === "rust") return rustVersions();
  if (TS_TOOLCHAIN[1].version !== "6.0.3") throw new Error("TypeScript 6.0.3 required");
  return TS_TOOLCHAIN;
}
async function extract(entry: VerificationCase, limits: Limits): Promise<Observation> {
  if (entry.scenario !== "source") {
    const command =
      entry.scenario === "unavailable"
        ? [resolve(FIXTURES, "deliberately-missing-extractor")]
        : [process.execPath, resolve(FIXTURES, "child.ts"), entry.scenario];
    const scenarioLimits = {
      ...limits,
      ...(entry.scenario === "timeout" ? { timeoutMs: Math.min(limits.timeoutMs, 100) } : {}),
      ...(["overflow", "resource"].includes(entry.scenario)
        ? { maxOutputBytes: Math.min(limits.maxOutputBytes, 1024) }
        : {}),
    };
    const observation = await extractRust(entry.task, scenarioLimits, command);
    if (
      entry.scenario !== "unavailable" &&
      !observation.diagnostic.startsWith(`state-exposure-scenario:${entry.scenario}\n`)
    )
      throw new Error("controlled scenario did not start");
    return { ...observation, diagnostic: "" };
  }
  return entry.task.input.language === "rust" ? extractRust(entry.task, limits) : extractTypeScript(entry.task, limits);
}
const defaults: RunnerDependencies = { load: loadCases, probe, extract };
export async function runVerification(
  args: readonly string[],
  dependencies: RunnerDependencies = defaults,
): Promise<VerificationReport> {
  const report = newReport(["bun", "run", "verify:state-exposure", ...args]);
  let entries: VerificationCase[];
  let options: ReturnType<typeof parseOptions>;
  try {
    options = parseOptions(args);
    const all = dependencies.load();
    if (!all.length || new Set(all.map((c) => c.caseId)).size !== all.length)
      throw new Error("empty or duplicate case set");
    entries = all
      .filter((entry) => options.caseId === "all" || entry.caseId === options.caseId)
      .sort((a, b) => (a.caseId < b.caseId ? -1 : a.caseId > b.caseId ? 1 : 0));
    if (!entries.length) throw new Error("unknown caseId");
  } catch (error) {
    report.status = "usage-error";
    report.errors.push(
      issue("invalid-request", "cases/options", error instanceof Error ? error.message : String(error)),
    );
    return report;
  }
  const prepared = new Map<string, string | null>();
  const tools = new Map<string, ToolVersion>();
  for (const entry of entries) {
    const language = entry.task.input.language;
    if (!prepared.has(language)) {
      try {
        for (const version of await dependencies.probe(language)) tools.set(version.name, version);
        prepared.set(language, null);
      } catch (error) {
        prepared.set(language, error instanceof Error ? error.message : String(error));
      }
    }
    const unavailable = prepared.get(language);
    if (unavailable) {
      notRun(report, entry, unavailable);
      continue;
    }
    try {
      const observed = await dependencies.extract(entry, options);
      if (observed.diagnostic) process.stderr.write(`${entry.caseId}: ${observed.diagnostic}\n`);
      if (entry.scenario === "source" && observed.execution.status !== "completed") {
        notRun(report, entry, observed.execution.reasons.map((r) => r.code).join(", "));
        continue;
      }
      const actual = inspectStateExposure(entry.task.request, observed.execution);
      if (actual.kind === "input-rejected") {
        notRun(report, entry, "unexpected C1 contract rejection");
        continue;
      }
      report.cases.push(compareResult(entry.caseId, entry.expected, actual));
    } catch (error) {
      notRun(report, entry, error instanceof Error ? error.message : String(error));
    }
  }
  report.toolchain = [...tools.values()].sort((a, b) => (a.name < b.name ? -1 : 1));
  report.status = report.cases.some((c) => c.status === "not-run")
    ? "execution-error"
    : report.cases.some((c) => c.status === "mismatch")
      ? "mismatch"
      : "passed";
  return report;
}
function notRun(report: VerificationReport, entry: VerificationCase, message: string) {
  report.cases.push({
    caseId: entry.caseId,
    expected: entry.expected,
    actual: null,
    differences: [message],
    status: "not-run",
  });
  report.errors.push(issue("execution-failed", entry.caseId, message));
}
