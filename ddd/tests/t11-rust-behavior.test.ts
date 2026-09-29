/**
 * The Rust sample of the invoice aggregate behaves as the shared behavior scenarios require
 * (T-11-07, language-independent design §11), under both module layouts, and passes the four Rust
 * gates with no finding.
 *
 * The scenarios are the ones the TypeScript samples run (tests/fixtures/typescript-behavior/
 * scenarios.ts), written in Rust (tests/fixtures/rust-behavior/scenarios.rs). They run with
 * `cargo test` in a harness crate written next to the sample, which depends on the sample's crates
 * by path: the sample is compiled and run as written and never gains the harness as a member. This
 * test only judges what cargo reports.
 */

import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { inspectedRustPassProblems } from "./fixtures/rust-behavior/gate-runs.ts";
import {
  otherParentModuleFile,
  parentModuleFile,
  type RustBehaviorSample,
  rustBehaviorSamples,
} from "./fixtures/rust-behavior/sample.ts";
import { BEHAVIOR_SCENARIOS } from "./fixtures/typescript-behavior/scenarios.ts";
import { runGoldenCase, SENSOR_RUN_TIMEOUT_MS, TIMED_OUT_EXIT_CODE } from "./golden/runner.ts";

const TOOLS = join(import.meta.dir, "../tools");
const SCENARIOS_RS = join(import.meta.dir, "fixtures/rust-behavior/scenarios.rs");
const MAPPING_PATH = "inception/domain-design/ddd-aggregate-mapping.md";
const DOMAIN_CRATES = ["billing-domain", "billing-use-case", "billing-interface-adapter"] as const;
const CRATE_DIR = "packages/command";
/** The infrastructure crate that declares `CommandOutcome`, which the scenarios match on. */
const LANGUAGE_EXTENSIONS_CRATE = "language-extensions";
const LANGUAGE_EXTENSIONS_DIR = `packages/infrastructure/${LANGUAGE_EXTENSIONS_CRATE}`;

/** Every gate run starts the distributed extractor in a process of its own. */
const GATE_RUN_TIMEOUT_MS = 30_000;
/** A cold `cargo test` compiles the sample's three crates and the harness. */
const CARGO_RUN_TIMEOUT_MS = SENSOR_RUN_TIMEOUT_MS;

/** One scenario result libtest printed: the test's name and its outcome word. */
interface CargoTestReport {
  readonly name: string;
  readonly outcome: string;
}

/**
 * The result lines of libtest's output, `test <name> ... <outcome>`, in the order printed. The
 * summary line (`test result: ...`), the `running N tests` header and captured output under a
 * `---- <name> stdout ----` heading are not results.
 */
function cargoTestReports(stdout: string): CargoTestReport[] {
  const reports: CargoTestReport[] = [];
  for (const line of stdout.split("\n")) {
    const match = /^test (\S+) \.\.\. (\S+)$/.exec(line.trimEnd());
    if (match?.[1] !== undefined && match[2] !== undefined) reports.push({ name: match[1], outcome: match[2] });
  }
  return reports;
}

/** The Rust test that runs a scenario: its id with `_` for `-`. */
function rustTestName(scenarioId: string): string {
  return scenarioId.replaceAll("-", "_");
}

/**
 * What keeps `reports` from being exactly one report per scenario of `scenarioIds`; empty when it
 * is. A name no scenario owns and a second report of the same name are problems, not noise.
 */
function reportCoverageProblems(reports: readonly CargoTestReport[], scenarioIds: readonly string[]): string[] {
  const expected = new Set(scenarioIds.map(rustTestName));
  const problems: string[] = [];
  const seen = new Set<string>();
  for (const report of reports) {
    if (!expected.has(report.name)) problems.push(`${report.name} is no behavior scenario`);
    else if (seen.has(report.name)) problems.push(`${report.name} is reported more than once`);
    seen.add(report.name);
  }
  for (const name of expected) if (!seen.has(name)) problems.push(`${name} is not reported`);
  return problems;
}

interface CargoRun {
  readonly exitCode: number | null;
  readonly stdout: string;
  readonly stderr: string;
}

/** Writes the sample and the harness crate beside it into a fresh directory; the caller removes it. */
function installSample(sample: RustBehaviorSample): string {
  const root = mkdtempSync(join(tmpdir(), "ddd-rust-behavior-sample-"));
  const files: Record<string, string> = {
    ...sample.workspace,
    "behavior/Cargo.toml": harnessManifest(),
    "behavior/src/lib.rs": readFileSync(SCENARIOS_RS, "utf8"),
  };
  for (const [path, content] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), content);
  }
  return root;
}

/** The harness is a workspace of its own, so it is never a member of the sample's workspace. */
function harnessManifest(): string {
  const dependencies = [
    ...DOMAIN_CRATES.map((crate) => `${crate} = { path = "../${CRATE_DIR}/${crate}" }`),
    `${LANGUAGE_EXTENSIONS_CRATE} = { path = "../${LANGUAGE_EXTENSIONS_DIR}" }`,
  ];
  return [
    "[package]",
    'name = "behavior"',
    'version = "0.1.0"',
    'edition = "2021"',
    "",
    "[workspace]",
    "",
    "[lib]",
    'path = "src/lib.rs"',
    "",
    "[dependencies]",
    ...dependencies,
    "",
  ].join("\n");
}

function runScenarios(root: string): CargoRun {
  const proc = Bun.spawnSync(
    [
      "cargo",
      "test",
      "--offline",
      "--lib",
      "--manifest-path",
      join(root, "behavior/Cargo.toml"),
      "--",
      "--test-threads=1",
      "--color",
      "never",
    ],
    {
      env: { ...process.env, CARGO_TARGET_DIR: join(root, "target") },
      stdout: "pipe",
      stderr: "pipe",
      timeout: CARGO_RUN_TIMEOUT_MS,
      killSignal: "SIGKILL",
    },
  );
  const stderr = proc.stderr.toString();
  return proc.exitedDueToTimeout
    ? {
        exitCode: TIMED_OUT_EXIT_CODE,
        stdout: proc.stdout.toString(),
        stderr: `${stderr}killed after ${CARGO_RUN_TIMEOUT_MS} ms\n`,
      }
    : { exitCode: proc.exitCode, stdout: proc.stdout.toString(), stderr };
}

/** cargo's own account of a run, shown when a judgement on it fails. */
function cargoOutput(run: CargoRun): string {
  return `cargo test exited ${run.exitCode}\n--- stdout ---\n${run.stdout}\n--- stderr ---\n${run.stderr}`;
}

/** The value one key of the sample's aggregate mapping states. */
function mappingValue(sample: RustBehaviorSample, key: string): string | undefined {
  const mapping = sample.domainCase.files[MAPPING_PATH];
  if (mapping === undefined) throw new Error(`the ${sample.layout} sample has no mapping`);
  return new RegExp(`^\\s*${key}:\\s*(\\S+)\\s*$`, "m").exec(mapping)?.[1];
}

for (const sample of rustBehaviorSamples()) {
  describe(`rust behavior sample: ${sample.layout}`, () => {
    test(
      "passes the Rust domain gate with no finding",
      () => expect(inspectedRustPassProblems(TOOLS, sample.domainCase)).toEqual([]),
      GATE_RUN_TIMEOUT_MS,
    );

    test(
      "passes the Rust use-case gate with no finding",
      () => expect(inspectedRustPassProblems(TOOLS, sample.useCaseCase)).toEqual([]),
      GATE_RUN_TIMEOUT_MS,
    );

    test(
      "passes the Rust interface-adapter gate with no finding",
      () => expect(inspectedRustPassProblems(TOOLS, sample.interfaceAdapterCase)).toEqual([]),
      GATE_RUN_TIMEOUT_MS,
    );

    test(
      "passes the Rust module layout gate with no finding",
      () => {
        const result = runGoldenCase(TOOLS, sample.layoutCase);
        expect(result.problems).toEqual([]);
        expect(result.verdict?.findings).toEqual([]);
      },
      GATE_RUN_TIMEOUT_MS,
    );

    test("the gates run over the sample's own project and record", () => {
      for (const gateCase of [sample.domainCase, sample.useCaseCase, sample.interfaceAdapterCase, sample.layoutCase]) {
        expect(gateCase.workspace).toEqual(sample.workspace);
        expect(gateCase.expect).toEqual({ pass: true, rules: [] });
      }
      expect(sample.domainCase.sensor).toBe("ddd-rust-domain");
      expect(sample.useCaseCase.sensor).toBe("ddd-rust-use-case");
      expect(sample.interfaceAdapterCase.sensor).toBe("ddd-rust-interface-adapter");
      expect(sample.layoutCase.sensor).toBe("ddd-rust-module-layout");
    });

    test("claims every Rust source of the sample in its source manifest", () => {
      const rustFiles = Object.keys(sample.workspace)
        .filter((path) => path.endsWith(".rs"))
        .sort();
      expect(Object.keys(sample.sources).sort()).toEqual(rustFiles);
      for (const crate of DOMAIN_CRATES)
        expect(rustFiles.some((path) => path.startsWith(`${CRATE_DIR}/${crate}/src/`))).toBe(true);
      const manifest = Object.entries(sample.domainCase.files).find(([path]) => path.endsWith("source-manifest.json"));
      if (manifest === undefined) throw new Error(`the ${sample.layout} sample has no source manifest`);
      const writes = (JSON.parse(manifest[1]) as { writes: { path: string }[] }).writes.map((entry) => entry.path);
      expect(writes.sort()).toEqual(rustFiles);
    });

    test("places the parent module as its layout requires and declares that layout", () => {
      expect(Object.hasOwn(sample.workspace, parentModuleFile(sample.layout))).toBe(true);
      expect(Object.hasOwn(sample.workspace, otherParentModuleFile(sample.layout))).toBe(false);
      const source = sample.workspace[".ddd.toml"];
      if (source === undefined) throw new Error(`the ${sample.layout} sample has no .ddd.toml`);
      const settings = Bun.TOML.parse(source) as { languages?: string[]; rust?: { module_layout?: string } };
      expect(settings.languages).toEqual(["rust"]);
      expect(settings.rust).toEqual({ module_layout: sample.layout });
    });

    // The behavior record names the execution model and persistence method each scenario exercises;
    // they are the ones the sample's own mapping declares, for the Rust code it maps.
    test("declares the class programming model and event-sourcing persistence it is exercised under", () => {
      expect(mappingValue(sample, "programming_model")).toBe("class");
      expect(mappingValue(sample, "persistence_method")).toBe("event-sourcing");
      expect(sample.domainCase.files[MAPPING_PATH]).toContain("language: rust");
    });

    describe("cargo test of the behavior scenarios", () => {
      let root: string;
      let run: CargoRun;
      let reports: CargoTestReport[];
      beforeAll(() => {
        root = installSample(sample);
        run = runScenarios(root);
        reports = cargoTestReports(run.stdout);
      }, CARGO_RUN_TIMEOUT_MS);
      afterAll(() => {
        rmSync(root, { recursive: true, force: true });
      });

      // A clean exit alone does not pass: cargo has to report every scenario, each exactly once.
      test("reports every behavior scenario exactly once and exits cleanly", () => {
        expect(
          reportCoverageProblems(
            reports,
            BEHAVIOR_SCENARIOS.map((scenario) => scenario.id),
          ),
          cargoOutput(run),
        ).toEqual([]);
        expect(run.exitCode, cargoOutput(run)).toBe(0);
      });

      for (const scenario of BEHAVIOR_SCENARIOS)
        test(`${scenario.id}: ${scenario.description}`, () => {
          const report = reports.find((candidate) => candidate.name === rustTestName(scenario.id));
          if (report === undefined) throw new Error(`no result for ${scenario.id}\n${cargoOutput(run)}`);
          if (report.outcome !== "ok") throw new Error(`${scenario.id} ended ${report.outcome}\n${cargoOutput(run)}`);
        });
    });
  });
}

test("the Rust scenarios are exactly the shared behavior scenarios, one test each", () => {
  const names = [...readFileSync(SCENARIOS_RS, "utf8").matchAll(/#\[test\]\s*fn (\w+)\s*\(/g)].map((match) => match[1]);
  expect(names).toEqual(BEHAVIOR_SCENARIOS.map((scenario) => rustTestName(scenario.id)));
});

test("the behavior runs cover both Rust module layouts", () => {
  expect(rustBehaviorSamples().map((sample) => sample.layout)).toEqual(["file", "mod-rs"]);
});

describe("reading cargo's report", () => {
  const passing = [
    "",
    "running 7 tests",
    "test business_error_keeps_state ... ok",
    "test duplicate_command_already_applied ... ok",
    "test invalid_value_rejected ... ok",
    "test one_event_appended_per_command ... ok",
    "test rejected_command_keeps_state ... ok",
    "test restore_after_persistence ... ok",
    "test state_change ... ok",
    "",
    "test result: ok. 7 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s",
    "",
  ].join("\n");
  const ids = BEHAVIOR_SCENARIOS.map((scenario) => scenario.id);

  test("a result line is the report of the scenario its test name maps to", () => {
    expect(cargoTestReports("test state_change ... ok\n")).toEqual([{ name: "state_change", outcome: "ok" }]);
    expect(rustTestName("state-change")).toBe("state_change");
    expect(reportCoverageProblems(cargoTestReports(passing), ids)).toEqual([]);
  });

  test("the header, the summary and captured output are no report", () => {
    const failing = [
      "running 1 test",
      "test state_change ... FAILED",
      "",
      "failures:",
      "",
      "---- state_change stdout ----",
      "test result: ok. anything the test printed",
      "thread 'state_change' panicked at src/lib.rs:1:1",
      "",
      "failures:",
      "    state_change",
      "",
      "test result: FAILED. 0 passed; 1 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s",
    ].join("\n");
    expect(cargoTestReports(failing)).toEqual([{ name: "state_change", outcome: "FAILED" }]);
    expect(cargoTestReports("running 4 tests\ntest result: ok. 4 passed; 0 failed\n")).toEqual([]);
  });

  test("a name no scenario owns, a repeated name and a missing scenario are each refused", () => {
    const extra = cargoTestReports(`${passing}\ntest helper_check ... ok\n`);
    expect(reportCoverageProblems(extra, ids)).toEqual(["helper_check is no behavior scenario"]);
    const repeated = cargoTestReports(`${passing}\ntest state_change ... ok\n`);
    expect(reportCoverageProblems(repeated, ids)).toEqual(["state_change is reported more than once"]);
    const missing = cargoTestReports(passing.replace("test state_change ... ok\n", ""));
    expect(reportCoverageProblems(missing, ids)).toEqual(["state_change is not reported"]);
    const namespaced = cargoTestReports(passing.replace("test state_change", "test tests::state_change"));
    expect(reportCoverageProblems(namespaced, ids)).toEqual([
      "tests::state_change is no behavior scenario",
      "state_change is not reported",
    ]);
  });
});
