import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { InspectionInput, InspectionOutcome, Target, ToolVersion } from "../state-exposure/index.ts";
import { validateExpected } from "./expected.ts";
import { type FrozenTask, freezeInput } from "./input.ts";
export const FIXTURES = resolve(import.meta.dir, "../../../..", "tests/fixtures/state-exposure-languages");
export interface VerificationCase {
  caseId: string;
  task: FrozenTask;
  expected: InspectionOutcome;
  scenario: string;
}
const versions: Record<string, ToolVersion[]> = {
  rust: [
    { name: "ddd-rust-syn-spike", version: "0.0.0" },
    { name: "syn", version: "3.0.5" },
  ],
  typescript: [
    { name: "ddd-typescript-state-evidence", version: "1" },
    { name: "typescript", version: "6.0.3" },
  ],
};
export function loadCases(
  definitions: unknown = JSON.parse(readFileSync(resolve(FIXTURES, "cases.json"), "utf8")),
): VerificationCase[] {
  if (!Array.isArray(definitions) || !definitions.length) throw new Error("case set must not be empty");
  const seen = new Set<string>();
  return definitions.map((raw) => {
    if (
      !raw ||
      typeof raw !== "object" ||
      typeof raw.caseId !== "string" ||
      !/^[a-z0-9-]+$/.test(raw.caseId) ||
      seen.has(raw.caseId)
    )
      throw new Error("invalid or duplicate caseId");
    seen.add(raw.caseId);
    if (
      typeof raw.sourceFile !== "string" ||
      !/^[a-z0-9-]+\.(rs|ts\.txt)$/.test(raw.sourceFile) ||
      !["rust", "typescript"].includes(raw.language)
    )
      throw new Error("invalid case source");
    const target: Target = raw.target;
    const input: InspectionInput = {
      language: raw.language,
      target,
      sources: [{ path: target?.file, content: readFileSync(resolve(FIXTURES, raw.sourceFile), "utf8") }],
      settings: {},
      toolchain: versions[raw.language],
    };
    const task = freezeInput(input);
    const expected = structuredClone(raw.expected);
    if (expected?.kind !== "evaluated" || expected.result?.requestIdentity !== "INPUT_IDENTITY")
      throw new Error("invalid independent expected result");
    expected.result.requestIdentity = task.request.requestIdentity;
    validateExpected(expected, task);
    const scenario = raw.scenario ?? "source";
    if (
      ![
        "source",
        "empty",
        "whitespace",
        "invalid",
        "multiple",
        "failed",
        "timeout",
        "overflow",
        "resource",
        "unavailable",
      ].includes(scenario)
    )
      throw new Error("invalid scenario");
    return { caseId: raw.caseId, task, expected, scenario };
  });
}
