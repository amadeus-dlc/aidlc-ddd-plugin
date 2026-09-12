/**
 * Golden-case runner (U4 BR8) — shared by the design suite and (later) the Rust
 * suite. A case is run through the real sensor script entry point as a child
 * process with `--stage` / `--output-path`, exactly as the dispatcher does, and
 * its stdout verdict is compared to the expectation.
 *
 * Cases are described by a `GoldenCase` table (cases.ts) and materialised into
 * a temp record directory. The runner never writes into the fixture source.
 */

import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
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
  findings: { rule_id: string; file: string; line?: number }[];
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

function materialize(testCase: GoldenCase): string {
  const root = mkdtempSync(join(tmpdir(), "ddd-golden-"));
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
  return root;
}

export function runGoldenCase(toolsDir: string, testCase: GoldenCase): CaseResult {
  const problems: string[] = [];
  const root = materialize(testCase);
  try {
    const record = join(root, "aidlc", "spaces", "default", "intents", "i1");
    const outputPath = join(record, testCase.output);
    const proc = Bun.spawnSync(
      ["bun", join(toolsDir, scriptNameFor(testCase.sensor)), "--stage", testCase.stage, "--output-path", outputPath],
      {
        stdout: "pipe",
        stderr: "pipe",
      },
    );
    if ((proc.exitCode ?? 0) !== 0) {
      return { sensor: testCase.sensor, name: testCase.name, ok: false, problems: [`exit code ${proc.exitCode}`] };
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(proc.stdout.toString().trim());
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
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
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
