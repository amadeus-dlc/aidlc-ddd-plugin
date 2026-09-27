/**
 * Golden-case runner (U4 BR8) — shared by the design suite and (later) the Rust
 * suite. A case is run through the real sensor script entry point as a child
 * process with `--stage` / `--output-path`, exactly as the dispatcher does, and
 * its stdout verdict is compared to the expectation.
 *
 * Cases are described by a `GoldenCase` table (cases.ts) and materialised into
 * a temp record directory. The runner never writes into the fixture source.
 */

import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

export interface GoldenCase {
  /** Sensor id, e.g. ddd-model-completeness. */
  sensor: string;
  /** violation-<rule> or clean-<description>. */
  name: string;
  stage: string;
  /** Path relative to the record directory (the sensor's --output-path). */
  output: string;
  /** record-relative file path -> content. */
  files: Record<string, string>;
  /** project-root-relative file path -> content (the Rust sensors' workspace/). */
  workspace?: Record<string, string>;
  /**
   * project-root-relative link path -> the target it is written with, as `ln -s` takes it. Created
   * after `workspace`, so a link may name a file the same case declares.
   */
  links?: Record<string, string>;
  /**
   * project-root-relative path -> the permission bits it is left with. Applied after `workspace` and
   * `links`, so a case can take away the access an inspection needs to a file it just declared.
   */
  modes?: Record<string, number>;
  /** aidlc-state.md content; defaults to a single EXECUTE line. */
  state?: string;
  expect: {
    pass: boolean;
    rules: string[];
    /**
     * Expected finding file per rule_id, record-relative. Defaults to the
     * `output` path. A case that reports on a sibling artifact (model-presence
     * reports on ddd-domain-model-yaml.md, not components.md) overrides it here.
     */
    files?: Record<string, string>;
    locations?: { rule: string; file: string }[];
    note_contains?: string;
  };
}

export interface SensorVerdict {
  pass: boolean;
  findings_count: number;
  findings: { rule_id: string; file: string; line?: number; message: string }[];
  note?: string;
}

export interface CaseResult {
  sensor: string;
  name: string;
  ok: boolean;
  problems: string[];
  verdict?: SensorVerdict;
}

export function scriptNameFor(sensor: string): string {
  return `ddd-sensor-${sensor.replace(/^ddd-/, "")}.ts`;
}

export function isViolation(testCase: GoldenCase): boolean {
  return testCase.name.startsWith("violation-");
}

/**
 * Writes a case into a fresh temp project and returns its root plus the sensor's `--output-path`,
 * so a test that observes something other than the verdict (an exit status, an empty stdout) runs
 * the same fixture layout as `runGoldenCase`. The caller owns `root` and removes it.
 */
export function materializeCase(testCase: GoldenCase): { root: string; outputPath: string } {
  const root = mkdtempSync(join(tmpdir(), "ddd-golden-"));
  return { root, outputPath: writeCase(root, testCase) };
}

/**
 * Writes a case into the existing project directory `root` — its record, workspace, links and
 * modes — and returns the sensor's `--output-path`, so a project that has to exist before the gate
 * runs (one whose packages are installed and built) is judged over the same fixture layout.
 */
export function writeCase(root: string, testCase: GoldenCase): string {
  const record = join(root, "aidlc", "spaces", "default", "intents", "i1");
  mkdirSync(record, { recursive: true });
  writeFileSync(
    join(record, "aidlc-state.md"),
    testCase.state ??
      "## Stage Progress\n- [x] ddd-domain-modeling — EXECUTE\n- [x] domain-design — EXECUTE\n- [x] functional-design — EXECUTE\n- [x] infrastructure-design — EXECUTE\n",
  );
  for (const [rel, content] of Object.entries(testCase.files)) {
    const path = join(record, rel);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, content);
  }
  for (const [rel, content] of Object.entries(testCase.workspace ?? {})) {
    const path = join(root, rel);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, content);
  }
  for (const [rel, target] of Object.entries(testCase.links ?? {})) {
    const path = join(root, rel);
    mkdirSync(dirname(path), { recursive: true });
    symlinkSync(target, path);
  }
  for (const [rel, mode] of Object.entries(testCase.modes ?? {})) {
    chmodSync(join(root, rel), mode);
  }
  return join(record, testCase.output);
}

export interface SensorRun {
  /** Raw child exit status; null when the process was killed by a signal. */
  exitCode: number | null;
  stdout: string;
  stderr: string;
}

/**
 * Runs `testCase` through the real sensor entry point in `toolsDir` and returns the raw process
 * result. The temp project is materialised and removed here, so a test that observes something other
 * than a verdict — an exit status, an empty stdout, a reason on stderr — runs the same fixture layout
 * as `runGoldenCase` without restating the spawn. `toolsDir` is a parameter rather than the product
 * tree so a private copy with a different installed extractor can be run the same way.
 */
export function spawnSensor(toolsDir: string, testCase: GoldenCase): SensorRun {
  const { root, outputPath } = materializeCase(testCase);
  try {
    return spawnSensorAt(toolsDir, testCase, outputPath);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

/** Runs the sensor of `testCase` in `toolsDir` over a case already written, with `outputPath` as `writeCase` returned it. */
/** How long one direct sensor run may take before it is killed and reported as timed out. */
export const SENSOR_RUN_TIMEOUT_MS = 5 * 60_000;
/** The exit status a killed run is reported with, so no caller reads the missing status as success. */
export const TIMED_OUT_EXIT_CODE = 124;

export function spawnSensorAt(toolsDir: string, testCase: GoldenCase, outputPath: string): SensorRun {
  const proc = Bun.spawnSync(
    ["bun", join(toolsDir, scriptNameFor(testCase.sensor)), "--stage", testCase.stage, "--output-path", outputPath],
    { stdout: "pipe", stderr: "pipe", timeout: SENSOR_RUN_TIMEOUT_MS, killSignal: "SIGKILL" },
  );
  const stderr = proc.stderr.toString();
  return proc.exitedDueToTimeout
    ? {
        exitCode: TIMED_OUT_EXIT_CODE,
        stdout: proc.stdout.toString().trim(),
        stderr: `${stderr}killed after ${SENSOR_RUN_TIMEOUT_MS} ms\n`,
      }
    : { exitCode: proc.exitCode, stdout: proc.stdout.toString().trim(), stderr };
}

export function runGoldenCase(toolsDir: string, testCase: GoldenCase): CaseResult {
  return judgeSensorRun(testCase, spawnSensor(toolsDir, testCase));
}

/**
 * Compares one finished run of `testCase` with its expectation. Split from the spawn so a run made
 * some other way — an entry evaluated inside the test process — is judged by exactly the same rules.
 */
export function judgeSensorRun(testCase: GoldenCase, run: SensorRun): CaseResult {
  const problems: string[] = [];
  if ((run.exitCode ?? 0) !== 0) {
    return { sensor: testCase.sensor, name: testCase.name, ok: false, problems: [`exit code ${run.exitCode}`] };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(run.stdout);
  } catch {
    return {
      sensor: testCase.sensor,
      name: testCase.name,
      ok: false,
      problems: ["stdout is not a single JSON verdict"],
    };
  }
  if (
    typeof parsed !== "object" ||
    parsed === null ||
    typeof (parsed as SensorVerdict).pass !== "boolean" ||
    !Array.isArray((parsed as SensorVerdict).findings)
  ) {
    return {
      sensor: testCase.sensor,
      name: testCase.name,
      ok: false,
      problems: ["verdict has no boolean pass and findings array"],
    };
  }
  const verdict = parsed as SensorVerdict;
  if (verdict.pass !== testCase.expect.pass) {
    problems.push(`pass expected ${testCase.expect.pass}, got ${verdict.pass}`);
  }
  if (isViolation(testCase) && testCase.expect.rules.length === 0) {
    problems.push("violation case declares no expected rule");
  }
  // Full set comparison on (rule_id, file): a missing finding, an extra
  // finding, or a wrong file all fail. Lines are optional (BR8.2).
  const key = (rule: string, file: string) => `${rule} @ ${file}`;
  const expected = new Set(
    testCase.expect.locations
      ? testCase.expect.locations.map((entry) => key(entry.rule, entry.file))
      : testCase.expect.rules.map((rule) => key(rule, testCase.expect.files?.[rule] ?? testCase.output)),
  );
  const actual = new Set(verdict.findings.map((f) => key(f.rule_id, f.file)));
  for (const entry of expected) {
    if (!actual.has(entry)) problems.push(`missing expected finding ${entry}`);
  }
  for (const entry of actual) {
    if (!expected.has(entry)) problems.push(`unexpected finding ${entry}`);
  }
  if (testCase.expect.note_contains && !(verdict.note ?? "").includes(testCase.expect.note_contains)) {
    problems.push(`note does not contain "${testCase.expect.note_contains}"`);
  }
  return { sensor: testCase.sensor, name: testCase.name, ok: problems.length === 0, problems, verdict };
}

export function runGoldenCases(toolsDir: string, cases: readonly GoldenCase[]): CaseResult[] {
  return cases.map((testCase) => runGoldenCase(toolsDir, testCase));
}

/** Rules declared by each sensor manifest (`checks: - rule_id: ...`). */
export function declaredRules(sensorsDir: string, files: readonly string[]): Map<string, Set<string>> {
  const out = new Map<string, Set<string>>();
  for (const file of files) {
    const text = readFileSync(join(sensorsDir, file), "utf-8");
    const sensor = /^id:\s*(\S+)/m.exec(text)?.[1];
    if (!sensor) continue;
    const rules = new Set<string>();
    for (const match of text.matchAll(/rule_id:\s*"?([A-Za-z0-9_.*-]+)"?/g)) rules.add(match[1]);
    out.set(sensor, rules);
  }
  return out;
}
