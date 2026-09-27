/**
 * The TypeScript code the code-generation instructions teach behaves as the shared behavior
 * scenarios require (T-11-06, language-independent design §11), for both code representations
 * under both module layouts.
 *
 * Each sample is written into a fresh directory and its packages are linked under `node_modules`
 * the way a package manager installs workspace packages, so the sources run as written: the samples
 * are copies of the runtime instructions' examples and are not changed to be tested.
 *
 * The scenarios run against the sample in a child `bun test` process started without coverage
 * (tests/fixtures/typescript-behavior/sample-runner.ts). Loading the samples into this process would
 * put their sources, which every run executes, into the coverage `bun run test` measures; this test
 * only judges what the child reports.
 */

import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import type { ScenarioReport } from "./fixtures/typescript-behavior/sample-runner.ts";
import { BEHAVIOR_SCENARIOS } from "./fixtures/typescript-behavior/scenarios.ts";
import { type GenerationSample, generationSamples } from "./fixtures/typescript-generation/samples.ts";

const MAPPING_PATH = "inception/domain-design/ddd-aggregate-mapping.md";
const SAMPLE_RUNNER = join(import.meta.dir, "fixtures/typescript-behavior/sample-runner.ts");

/** Package name -> project-relative package root, read from the sample's own package manifests. */
function packageRoots(sample: GenerationSample): Map<string, string> {
  const roots = new Map<string, string>();
  for (const [path, content] of Object.entries(sample.workspace)) {
    if (!path.endsWith("/package.json")) continue;
    roots.set((JSON.parse(content) as { name: string }).name, dirname(path));
  }
  return roots;
}

/** Writes the sample and links each of its packages under `node_modules`; the caller removes the root. */
function installSample(sample: GenerationSample): string {
  const root = mkdtempSync(join(tmpdir(), "ddd-behavior-sample-"));
  for (const [path, content] of Object.entries(sample.workspace)) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), content);
  }
  for (const [name, packageRoot] of packageRoots(sample)) {
    const link = join(root, "node_modules", name);
    mkdirSync(dirname(link), { recursive: true });
    symlinkSync(join(root, packageRoot), link, "dir");
  }
  return root;
}

/** One child run of the scenarios; `reports` is undefined when the child wrote no report. */
interface ScenarioRun {
  readonly exitCode: number | null;
  readonly stdout: string;
  readonly stderr: string;
  readonly reports: readonly ScenarioReport[] | undefined;
}

/** Runs every scenario against the sample installed at `root` in a child `bun test` without coverage. */
function runScenarios(root: string): ScenarioRun {
  const entry = "behavior.test.ts";
  const reportPath = join(root, "behavior-report.json");
  writeFileSync(
    join(root, entry),
    `import { registerSampleScenarios } from ${JSON.stringify(SAMPLE_RUNNER)};\n` +
      `registerSampleScenarios(${JSON.stringify(root)}, ${JSON.stringify(reportPath)});\n`,
  );
  // The child runs in the sample's directory, so this package's bunfig (and its coverage) is not read.
  const proc = Bun.spawnSync(["bun", "test", `./${entry}`], { cwd: root, stdout: "pipe", stderr: "pipe" });
  return {
    exitCode: proc.exitCode,
    stdout: proc.stdout.toString(),
    stderr: proc.stderr.toString(),
    reports: existsSync(reportPath) ? (JSON.parse(readFileSync(reportPath, "utf8")) as ScenarioReport[]) : undefined,
  };
}

/** The child's own account of a run, shown when a judgement on it fails. */
function childOutput(run: ScenarioRun): string {
  return `child bun test exited ${run.exitCode}\n--- stdout ---\n${run.stdout}\n--- stderr ---\n${run.stderr}`;
}

/** The value one key of the sample's aggregate mapping states. */
function mappingValue(sample: GenerationSample, key: string): string | undefined {
  const mapping = sample.domainCase.files[MAPPING_PATH];
  if (mapping === undefined) throw new Error(`the ${sample.representation}/${sample.layout} sample has no mapping`);
  return new RegExp(`^\\s*${key}:\\s*(\\S+)\\s*$`, "m").exec(mapping)?.[1];
}

for (const sample of generationSamples()) {
  describe(`generation sample behavior: ${sample.representation} / ${sample.layout}`, () => {
    let root: string;
    let run: ScenarioRun;
    beforeAll(() => {
      root = installSample(sample);
      run = runScenarios(root);
    });
    afterAll(() => {
      rmSync(root, { recursive: true, force: true });
    });

    // A clean exit alone does not pass: the child has to report every scenario, in order.
    test("the child run reports every behavior scenario, in order, and exits cleanly", () => {
      expect(run.reports, childOutput(run)).toBeDefined();
      expect(
        run.reports?.map((report) => report.id),
        childOutput(run),
      ).toEqual(BEHAVIOR_SCENARIOS.map((scenario) => scenario.id));
      expect(run.exitCode, childOutput(run)).toBe(0);
    });

    for (const scenario of BEHAVIOR_SCENARIOS)
      test(`${scenario.id}: ${scenario.description}`, () => {
        const report = run.reports?.find((candidate) => candidate.id === scenario.id);
        if (report === undefined) throw new Error(`no result for ${scenario.id}\n${childOutput(run)}`);
        if (!report.ok) throw new Error(`${scenario.id} failed: ${report.message}\n${childOutput(run)}`);
      });

    // The behavior record names the execution model and persistence method each scenario exercises;
    // they are the ones the sample's own mapping declares.
    test("declares the class programming model and state-sourcing persistence it is exercised under", () => {
      expect(mappingValue(sample, "programming_model")).toBe("class");
      expect(mappingValue(sample, "persistence_method")).toBe("state-sourcing");
    });
  });
}

test("the behavior scenarios are the four the shared design requires", () => {
  expect(BEHAVIOR_SCENARIOS.map((scenario) => scenario.id)).toEqual([
    "state-change",
    "business-error-keeps-state",
    "invalid-value-rejected",
    "restore-after-persistence",
  ]);
});

test("the behavior runs cover both code representations under both module layouts", () => {
  const combinations = generationSamples().map((sample) => `${sample.representation}/${sample.layout}`);
  expect(combinations.sort()).toEqual([
    "class/index-file",
    "class/named-file",
    "companion/index-file",
    "companion/named-file",
  ]);
});
