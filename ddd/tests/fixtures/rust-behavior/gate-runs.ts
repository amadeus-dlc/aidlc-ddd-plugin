/**
 * Runs of the Rust gates over a Rust behavior sample, from any tools tree: the source tree, a
 * distribution, or an installed project.
 *
 * Each run reports what is wrong with it rather than asserting, so every test that runs a Rust gate
 * over a sample decides on the same conditions.
 */

import { type GoldenCase, runGoldenCase } from "../../golden/runner.ts";

/**
 * What keeps a Rust gate run from being a pass that inspected the sample; empty when it is one. A
 * pass that claimed no Rust source inspected nothing, and a note naming an unresolved part left that
 * part of the sample undecided, so both are reported too.
 */
export function inspectedRustPassProblems(toolsDir: string, gateCase: GoldenCase): string[] {
  const result = runGoldenCase(toolsDir, gateCase);
  const problems = [...result.problems];
  const findings = result.verdict?.findings ?? [];
  if (findings.length) problems.push(`${gateCase.sensor} reported ${JSON.stringify(findings)}`);
  const note = result.verdict?.note ?? "";
  if (note.includes("no rust sources claimed")) problems.push(`${gateCase.sensor} inspected nothing: ${note}`);
  if (note.includes(".unresolved:")) problems.push(`${gateCase.sensor} left part of the sample undecided: ${note}`);
  return problems;
}
