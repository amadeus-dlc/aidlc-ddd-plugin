import { isDeepStrictEqual } from "node:util";
import type { InspectionOutcome, Issue, ToolVersion } from "../state-exposure/index.ts";
export interface VerificationCaseResult {
  caseId: string;
  status: "passed" | "mismatch" | "not-run";
  expected: InspectionOutcome;
  actual: InspectionOutcome | null;
  differences: readonly string[];
}
export interface VerificationReport {
  schemaVersion: "state-exposure-verification/1";
  runId: string;
  command: readonly string[];
  toolchain: readonly ToolVersion[];
  environment: { os: string; architecture: string; runtimeVersion: string };
  cases: VerificationCaseResult[];
  errors: Issue[];
  status: "passed" | "mismatch" | "usage-error" | "execution-error";
}
export function newReport(command: readonly string[]): VerificationReport {
  return {
    schemaVersion: "state-exposure-verification/1",
    runId: crypto.randomUUID(),
    command: [...command],
    toolchain: [],
    environment: { os: process.platform, architecture: process.arch, runtimeVersion: Bun.version },
    cases: [],
    errors: [],
    status: "passed",
  };
}
export function compareResult(
  caseId: string,
  expected: InspectionOutcome,
  actual: InspectionOutcome,
): VerificationCaseResult {
  const differences: string[] = [];
  if (!isDeepStrictEqual(expected, actual)) {
    if (expected.kind === "evaluated" && actual.kind === "evaluated") {
      for (const key of Object.keys(expected.result) as (keyof typeof expected.result)[])
        if (!isDeepStrictEqual(expected.result[key], actual.result[key])) differences.push(`result.${key}`);
    } else differences.push("outcome");
    if (!differences.length) differences.push("outcome");
  }
  return { caseId, expected, actual, differences, status: differences.length ? "mismatch" : "passed" };
}
export function exitCode(report: VerificationReport): 0 | 1 | 2 | 3 {
  return { passed: 0, mismatch: 1, "usage-error": 2, "execution-error": 3 }[report.status] as 0 | 1 | 2 | 3;
}
