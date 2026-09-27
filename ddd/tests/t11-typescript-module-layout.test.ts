import { expect, test } from "bun:test";
import { chmodSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { layoutConfig } from "./golden/module-layout/cases.ts";
import {
  TYPESCRIPT_LAYOUT_SENSOR,
  TYPESCRIPT_MODULE_LAYOUT_CASES,
  typescriptLayoutConfig,
} from "./golden/module-layout/typescript-cases.ts";
import { type GoldenCase, materializeCase, runGoldenCase, spawnSensor } from "./golden/runner.ts";

const TOOLS = join(import.meta.dir, "../tools");
const CI_ENTRY = join(TOOLS, "ddd-check-typescript-module-layout.ts");

/** The check both entries call, loaded per test so a missing module fails the tests that need it. */
async function loadCheck() {
  const { checkTypeScriptModuleLayout } = await import("../tools/ddd/lib/module-layout/typescript.ts");
  return checkTypeScriptModuleLayout;
}

/** Runs the CI entry over `project`, as a pipeline step invokes it. */
function runCli(...args: string[]) {
  const proc = Bun.spawnSync([process.execPath, CI_ENTRY, ...args], { stdout: "pipe", stderr: "pipe" });
  return { exitCode: proc.exitCode, stdout: proc.stdout.toString(), stderr: proc.stderr.toString() };
}

const located = (verdict: { findings?: { rule_id: string; file: string }[] }) =>
  (verdict.findings ?? []).map((entry) => `${entry.rule_id} @ ${entry.file}`).sort();

function findCase(name: string): GoldenCase {
  const entry = TYPESCRIPT_MODULE_LAYOUT_CASES.find((candidate) => candidate.name === name);
  if (!entry) throw new Error(`the TypeScript layout catalog carries no ${name} case`);
  return entry;
}

/** The gate verdict and the CI verdict over the same materialised project. */
function bothEntries(testCase: GoldenCase) {
  const sensor = spawnSensor(TOOLS, testCase);
  const { root } = materializeCase(testCase);
  try {
    const cli = runCli("--project", root);
    return {
      sensor: { exitCode: sensor.exitCode, stderr: sensor.stderr, verdict: JSON.parse(sensor.stdout) },
      cli: { exitCode: cli.exitCode, stderr: cli.stderr, verdict: JSON.parse(cli.stdout) },
    };
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

// --- the catalog through the gate and through CI ----------------------------------------------------

for (const entry of TYPESCRIPT_MODULE_LAYOUT_CASES) {
  test(`${entry.sensor}/${entry.name}`, () => {
    expect(runGoldenCase(TOOLS, entry).problems).toEqual([]);
  });
  // Both entries have to return the same verdict, so the CI entry is held to the same expectation and
  // to the findings the gate reported over the identical project.
  test(`CI entry agrees with the gate: ${entry.name}`, () => {
    const { sensor, cli } = bothEntries(entry);
    expect(sensor.exitCode, sensor.stderr).toBe(0);
    expect(cli.verdict.pass, JSON.stringify(cli.verdict)).toBe(entry.expect.pass);
    expect(cli.exitCode).toBe(entry.expect.pass ? 0 : 1);
    expect(located(cli.verdict)).toEqual(located(sensor.verdict));
  });
}

test("the catalog covers each failure kind under both layouts", () => {
  const names = new Set(TYPESCRIPT_MODULE_LAYOUT_CASES.map((entry) => entry.name));
  for (const mode of ["named-file", "index-file"])
    for (const name of [
      `clean-${mode}-leaf`,
      `clean-${mode}-parent`,
      `violation-index-leaf-${mode}`,
      `violation-missing-parent-${mode}`,
      `violation-ambiguous-parent-${mode}`,
    ])
      expect(names.has(name), name).toBe(true);
  expect(names.has("violation-index-parent-in-named-file")).toBe(true);
  expect(names.has("violation-named-parent-in-index-file")).toBe(true);
  for (const entry of TYPESCRIPT_MODULE_LAYOUT_CASES) expect(entry.sensor).toBe(TYPESCRIPT_LAYOUT_SENSOR);
});

// --- a violation names where the module belongs ------------------------------------------------------

for (const [name, file, required] of [
  ["violation-index-parent-in-named-file", "src/invoice/index.ts", "src/invoice.ts"],
  ["violation-named-parent-in-index-file", "src/invoice.ts", "src/invoice/index.ts"],
  ["violation-index-leaf-index-file", "src/invoice/index.ts", "src/invoice.ts"],
  [
    "violation-index-parent-in-workspace-package",
    "packages/billing/src/invoice/index.ts",
    "packages/billing/src/invoice.ts",
  ],
] as const)
  test(`a violation on ${file} names the file the layout requires: ${name}`, () => {
    const { sensor, cli } = bothEntries(findCase(name));
    for (const verdict of [sensor.verdict, cli.verdict]) {
      const reported = (verdict.findings ?? []).filter(
        (entry: { rule_id: string; file: string }) =>
          entry.rule_id === "module-layout.violation" && entry.file === file,
      );
      expect(reported).toHaveLength(1);
      expect(reported[0].message).toContain(required);
      expect(verdict.pass).toBe(false);
    }
  });

// --- what the check counts ---------------------------------------------------------------------------

async function checkFiles(files: Record<string, string>, links: Record<string, string> = {}) {
  const root = mkdtempSync(join(tmpdir(), "ddd-ts-layout-"));
  try {
    for (const [path, text] of Object.entries(files)) {
      mkdirSync(dirname(join(root, path)), { recursive: true });
      writeFileSync(join(root, path), text);
    }
    for (const [path, target] of Object.entries(links)) {
      mkdirSync(dirname(join(root, path)), { recursive: true });
      symlinkSync(target, join(root, path));
    }
    return (await loadCheck())(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

test("only a package whose root holds src is counted, and its module files with it", async () => {
  const result = await checkFiles({
    ".ddd.toml": typescriptLayoutConfig("named-file"),
    "package.json": '{ "name": "workspace", "private": true }\n',
    "packages/billing/package.json": '{ "name": "billing" }\n',
    "packages/billing/src/invoice.ts": "export class Invoice {}\n",
    "packages/billing/src/invoice/line.ts": "export class Line {}\n",
    "packages/tooling/package.json": '{ "name": "tooling" }\n',
  });
  expect(result.findings).toEqual([]);
  expect(result.mode).toBe("named-file");
  expect(result.packages).toBe(1);
  expect(result.files).toBe(2);
});

test("the selected layout is reported as the mode it inspected with", async () => {
  const result = await checkFiles({
    ".ddd.toml": typescriptLayoutConfig("index-file"),
    "package.json": '{ "name": "billing" }\n',
    "src/invoice.ts": "export class Invoice {}\n",
  });
  expect(result.mode).toBe("index-file");
  expect(result.findings).toEqual([]);
});

// --- a project that states no TypeScript and holds none ------------------------------------------------

const RUST_PROJECT = {
  ".ddd.toml": layoutConfig("file"),
  "Cargo.toml": '[package]\nname = "billing"\nversion = "0.1.0"\nedition = "2021"\n',
  "src/lib.rs": "mod invoice;\n",
  "src/invoice.rs": "pub struct Invoice;\n",
};

test("a Rust project holding no TypeScript has nothing for the TypeScript check to report", async () => {
  // A package manifest for JavaScript tooling, and TypeScript only in trees the project scan skips,
  // do not make this a TypeScript project.
  const result = await checkFiles({
    ...RUST_PROJECT,
    "package.json": '{ "name": "tooling", "private": true }\n',
    ".claude/tools/aidlc-orchestrate.ts": "export {};\n",
    "node_modules/x/index.ts": "export {};\n",
  });
  expect(result).toEqual({ findings: [], packages: 0, files: 0 });
});

test("a project with no settings and no TypeScript has nothing to report", async () => {
  expect(await checkFiles({ "README.md": "# Billing\n" })).toEqual({ findings: [], packages: 0, files: 0 });
});

test("the gate passes a Rust project that holds no TypeScript", () => {
  const entry = structuredClone(findCase("clean-named-file-leaf"));
  entry.name = "clean-rust-only-project";
  entry.workspace = { ...RUST_PROJECT };
  entry.expect = { pass: true, rules: [], locations: [] };
  expect(runGoldenCase(TOOLS, entry).problems).toEqual([]);
});

for (const [label, files] of [
  ["a tsconfig.json", { "tsconfig.json": "{}\n" }],
  ["a TypeScript source", { "tools/generate.ts": "export {};\n" }],
] as const)
  test(`a project whose settings name no TypeScript but that holds ${label} is refused for its settings`, async () => {
    const result = await checkFiles({ ...RUST_PROJECT, ...files });
    expect(result.mode).toBeUndefined();
    expect(result.findings.map((entry) => [entry.rule_id, entry.file])).toEqual([
      ["module-layout.configuration", ".ddd.toml"],
    ]);
  });

// --- configurations the check cannot resolve do not pass ------------------------------------------------

test("a symbolic link to a directory inside the project is reported, not followed", async () => {
  const result = await checkFiles(
    {
      ".ddd.toml": typescriptLayoutConfig("named-file"),
      "package.json": '{ "name": "billing" }\n',
      "src/invoice.ts": "export class Invoice {}\n",
    },
    { "src/recursive": ".." },
  );
  expect(result.findings.map((entry) => [entry.rule_id, entry.file])).toEqual([
    ["module-layout.unresolved", "src/recursive"],
  ]);
});

test("a check whose budget runs out stops rather than reporting a partial verdict", async () => {
  const root = mkdtempSync(join(tmpdir(), "ddd-ts-layout-budget-"));
  try {
    writeFileSync(join(root, ".ddd.toml"), typescriptLayoutConfig());
    writeFileSync(join(root, "package.json"), '{ "name": "billing" }\n');
    mkdirSync(join(root, "src"));
    writeFileSync(join(root, "src/invoice.ts"), "export class Invoice {}\n");
    const check = await loadCheck();
    expect(() =>
      check(root, () => {
        throw new Error("budget-exceeded");
      }),
    ).toThrow("budget-exceeded");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("the CI entry does not pass a project with no TypeScript package", () => {
  const root = mkdtempSync(join(tmpdir(), "ddd-ts-layout-empty-"));
  try {
    const cli = runCli("--project", root);
    expect(cli.exitCode).toBe(1);
    const verdict = JSON.parse(cli.stdout);
    expect(verdict.pass).toBe(false);
    expect(verdict.findings).toEqual([]);
    expect(verdict.packages).toBe(0);
    expect(typeof verdict.reason).toBe("string");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

for (const [label, args] of [
  ["a project path that does not exist", ["--project", join(tmpdir(), "ddd-ts-layout-missing", "project")]],
  ["no arguments", []],
  ["an unknown flag", ["--root", "."]],
] as const)
  test(`the CI entry fails closed on ${label}`, () => {
    const cli = runCli(...args);
    expect(cli.exitCode).toBe(1);
    const verdict = JSON.parse(cli.stdout);
    expect(verdict.pass).toBe(false);
    expect(typeof verdict.reason).toBe("string");
  });

// Dropping read permission does nothing for a superuser, whose listing succeeds regardless, so the
// test either observes the finding or does not run at all.
const RUNNING_AS_SUPERUSER = process.getuid?.() === 0;

test.skipIf(RUNNING_AS_SUPERUSER)("a module directory the walk cannot list is reported once", async () => {
  const root = mkdtempSync(join(tmpdir(), "ddd-ts-layout-unreadable-"));
  const sealed = join(root, "src/invoice");
  try {
    writeFileSync(join(root, ".ddd.toml"), typescriptLayoutConfig("named-file"));
    writeFileSync(join(root, "package.json"), '{ "name": "billing" }\n');
    mkdirSync(sealed, { recursive: true });
    writeFileSync(join(sealed, "line.ts"), "export class Line {}\n");
    chmodSync(sealed, 0o000);
    const result = (await loadCheck())(root);
    // Whether `invoice` has children is what could not be read, so it is not also reported as missing
    // its module file.
    expect(result.findings.map((entry) => [entry.rule_id, entry.file])).toEqual([
      ["module-layout.unresolved", "src/invoice"],
    ]);
  } finally {
    try {
      chmodSync(sealed, 0o755);
    } catch {
      // The directory may not exist when the test failed before creating it.
    }
    rmSync(root, { recursive: true, force: true });
  }
});
