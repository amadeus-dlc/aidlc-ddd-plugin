/**
 * Runs of the TypeScript gates and the module layout CI entry over a generation sample, from any
 * tools tree: the source tree, a distribution, or an installed project.
 *
 * Each run reports what is wrong with it rather than asserting, so a test and a verification script
 * decide on the same conditions.
 */

import { rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  type CaseResult,
  type GoldenCase,
  judgeSensorRun,
  materializeCase,
  runGoldenCase,
  spawnSensorAt,
} from "../../golden/runner.ts";
import { type GenerationSample, otherParentModuleFile } from "./samples.ts";

/** The CI entry of the TypeScript module layout gate, relative to a tools tree. */
export const TYPESCRIPT_LAYOUT_CI_ENTRY = "ddd-check-typescript-module-layout.ts";

/** The four TypeScript gates a sample passes: domain, use case, interface adapter and module layout. */
export function sampleGateCases(sample: GenerationSample): readonly GoldenCase[] {
  return [sample.domainCase, sample.useCaseCase, sample.interfaceAdapterCase, sample.layoutCase];
}

/**
 * What keeps a gate run from being a pass that inspected the sample; empty when it is one. A gate
 * that decides the sources of some layers also passes with no finding when it inspects nothing —
 * no claimed TypeScript source in a package of its layers — so such a pass is reported too.
 */
export function inspectedPassProblems(toolsDir: string, gateCase: GoldenCase): string[] {
  return passProblems(gateCase, runGoldenCase(toolsDir, gateCase));
}

/** `inspectedPassProblems` over a case `writeCase` already wrote, whose `--output-path` is `outputPath`. */
export function inspectedPassProblemsAt(toolsDir: string, gateCase: GoldenCase, outputPath: string): string[] {
  return passProblems(gateCase, judgeSensorRun(gateCase, spawnSensorAt(toolsDir, gateCase, outputPath)));
}

function passProblems(gateCase: GoldenCase, result: CaseResult): string[] {
  const problems = [...result.problems];
  const findings = result.verdict?.findings ?? [];
  if (findings.length) problems.push(`${gateCase.sensor} reported ${JSON.stringify(findings)}`);
  const note = result.verdict?.note ?? "";
  if (note.includes("no typescript sources claimed")) problems.push(`${gateCase.sensor} inspected nothing: ${note}`);
  return problems;
}

export interface CiEntryRun {
  readonly exitCode: number | null;
  readonly output: string;
}

/**
 * Runs the module layout CI entry of `toolsDir` over the sample's project. With `mixedLayout`, the
 * project also holds a file where the other layout places the parent module, which the entry has
 * to refuse, so a run that exits 0 is known to have read the layout.
 */
export function runLayoutCiEntry(toolsDir: string, sample: GenerationSample, mixedLayout: boolean): CiEntryRun {
  const { root } = materializeCase(sample.layoutCase);
  try {
    if (mixedLayout) writeFileSync(join(root, otherParentModuleFile(sample.layout)), "export {};\n");
    return runLayoutCiEntryAt(toolsDir, root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

/** Runs the module layout CI entry of `toolsDir` over the project at `root`. */
export function runLayoutCiEntryAt(toolsDir: string, root: string): CiEntryRun {
  const proc = Bun.spawnSync([process.execPath, join(toolsDir, TYPESCRIPT_LAYOUT_CI_ENTRY), "--project", root], {
    stdout: "pipe",
    stderr: "pipe",
  });
  return { exitCode: proc.exitCode, output: `${proc.stdout.toString()}${proc.stderr.toString()}` };
}
