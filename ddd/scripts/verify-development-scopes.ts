import { existsSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";

const workspaceRoot = resolve(import.meta.dir, "../..");
const scopeNames = ["plugin-dev", "plugin-bugfix", "plugin-refactor"];
const errors: string[] = [];
const checkedScopes: { harness: string; scope: string }[] = [];

type ScopeGrid = Record<string, { stages: Record<string, string> }>;
for (const harness of [".codex", ".claude"]) {
  const installed = scopeNames.filter((name) => existsSync(join(workspaceRoot, harness, "scopes", `aidlc-${name}.md`)));
  if (installed.length === 0) continue;
  const grid: ScopeGrid = await Bun.file(join(workspaceRoot, harness, "tools/data/scope-grid.json")).json();
  for (const name of installed) {
    checkedScopes.push({ harness, scope: name });
    const stages = grid[name]?.stages;
    if (!stages) {
      errors.push(`${harness}: ${name} is missing from scope-grid.json`);
      continue;
    }
    if (stages["units-generation"] === "EXECUTE" && stages["user-stories"] !== "EXECUTE") {
      errors.push(
        `${harness}: ${name} must execute user-stories with units-generation for the AI-DLC 2.8.2 traceability contract`,
      );
    }
  }
}
if (checkedScopes.length === 0) {
  errors.push("No installed plugin development scopes were checked");
}

type SensorResult = {
  pass: boolean;
  findings_count: number;
  invalid_targets?: string[];
  [key: string]: unknown;
};

const version = Bun.spawnSync(["aidlc", "--version"], {
  stdout: "pipe",
  stderr: "pipe",
});
if (version.exitCode !== 0) {
  throw new Error(`aidlc --version failed: ${version.stderr.toString()}`);
}

const fixtureRoot = mkdtempSync(join(tmpdir(), "ddd-development-scopes-"));
const recordName = "260913-scope-compatibility";
const intents = join(fixtureRoot, "aidlc/spaces/default/intents");
const record = join(intents, recordName);
const inception = join(record, "inception");
const checks: { name: string; expectedPass: boolean; result: SensorResult }[] = [];

async function write(path: string, content: string): Promise<void> {
  mkdirSync(dirname(path), { recursive: true });
  await Bun.write(path, content);
}

function inspect(stage: string): SensorResult {
  const result = Bun.spawnSync(
    [
      "aidlc",
      "engine",
      "sensor-traceability",
      "--output-path",
      join(inception, stage, "traceability.json"),
      "--stage",
      stage,
    ],
    {
      cwd: fixtureRoot,
      env: { ...process.env, AIDLC_HARNESS_DIR: ".codex" },
      stdout: "pipe",
      stderr: "pipe",
    },
  );
  if (result.exitCode !== 0) {
    throw new Error(`traceability failed to run: ${result.stderr.toString()}`);
  }
  const value: SensorResult = JSON.parse(result.stdout.toString());
  if (typeof value.pass !== "boolean" || typeof value.findings_count !== "number") {
    throw new Error("traceability returned an invalid response");
  }
  return value;
}

try {
  mkdirSync(join(fixtureRoot, ".codex"), { recursive: true });
  await write(join(fixtureRoot, "aidlc/active-space"), "default\n");
  await write(join(intents, "active-intent"), `${recordName}\n`);
  await write(
    join(intents, "intents.json"),
    JSON.stringify([
      {
        uuid: "019f0000-0000-7000-8000-000000000002",
        slug: "scope-compatibility",
        dirName: recordName,
        scope: "express",
        status: "active",
      },
    ]),
  );
  // These are isolated sensor inputs, with no workflow approval or audit events.
  await write(
    join(record, "aidlc-state.md"),
    "# AI-DLC State Tracking\n\n## Project Information\n- **Project**: 開発スコープの互換性検証\n- **Project Type**: Greenfield\n- **Scope**: express\n\n## Current Status\n- **Lifecycle Phase**: INCEPTION\n- **Current Stage**: units-generation\n- **Status**: Running\n",
  );
  await write(
    join(inception, "requirements-analysis/requirements.md"),
    "# 検証用要件\n\n## Functional Requirements\n\n### FR1: 状態公開を判定する\n\n指定型の状態公開を検査する。\n",
  );
  await write(
    join(inception, "user-stories/stories.md"),
    "# 検証用ストーリー\n\n## US1.1: 指定型の状態公開を確認する\n\n開発者として、型の検査結果と根拠を確認したい。要件: FR1。\n",
  );
  await write(
    join(inception, "user-stories/traceability.json"),
    JSON.stringify({
      stage: "user-stories",
      upstream_ids: ["FR1"],
      coverage: [{ id: "FR1", status: "OK", target: "US1.1" }],
    }),
  );
  await write(
    join(inception, "units-generation/unit-of-work.md"),
    "# 作業単位\n\n## Units\n\n| Unit ID | Directory | Kind |\n|---|---|---|\n| U1 | u1-inspection | library |\n| U2 | u2-verification | library |\n",
  );
  await write(
    join(inception, "units-generation/unit-of-work-dependency.md"),
    "# 依存\n\n## Units\n\n```yaml\nunits:\n  - name: u1-inspection\n    kind: library\n    depends_on: []\n  - name: u2-verification\n    kind: library\n    depends_on: [u1-inspection]\n```\n",
  );
  await write(
    join(inception, "units-generation/unit-of-work-story-map.md"),
    "# 対応\n\n## Mapping\n\n| Story ID | Unit ID | Directory |\n|---|---|---|\n| US1.1 | U1 | u1-inspection |\n",
  );
  await write(
    join(inception, "units-generation/traceability.json"),
    JSON.stringify({
      stage: "units-generation",
      upstream_ids: ["US1.1"],
      coverage: [{ id: "US1.1", status: "OK", target: "U1" }],
    }),
  );
  checks.push({
    name: "requirements-to-stories",
    expectedPass: true,
    result: inspect("user-stories"),
  });
  checks.push({
    name: "stories-to-units",
    expectedPass: true,
    result: inspect("units-generation"),
  });
  await write(
    join(inception, "units-generation/unit-of-work-story-map.md"),
    "# 対応\n\n## Mapping\n\n| Story ID | Unit ID | Directory |\n|---|---|---|\n| US1.1 | U2 | u2-verification |\n",
  );
  checks.push({
    name: "mismatched-unit-rejected",
    expectedPass: false,
    result: inspect("units-generation"),
  });
  for (const check of checks) {
    if (check.result.pass !== check.expectedPass) {
      errors.push(`${check.name}: unexpected pass=${check.result.pass}`);
    }
  }
  if (!checks[2]?.result.invalid_targets?.some((v) => v.includes("US1.1"))) {
    errors.push("The invalid mapping did not report the mismatched story target");
  }
} finally {
  rmSync(fixtureRoot, { recursive: true, force: true });
}

console.log(
  JSON.stringify(
    {
      framework: version.stdout.toString().trim(),
      checkedScopes,
      checks,
      pass: errors.length === 0,
      errors,
    },
    null,
    2,
  ),
);
if (errors.length > 0) process.exitCode = 1;
