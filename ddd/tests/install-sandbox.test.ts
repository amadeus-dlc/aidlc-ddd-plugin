import { afterEach, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import {
  cpSync,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  readlinkSync,
  renameSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve, sep } from "node:path";
import { legacySetFiles, RECORD_DIR, SUPPLEMENT_FILE } from "./fixtures/artifact-set/workspace.ts";
import { type CommandRun, installedGates, lastJson, manualCheckPasses } from "./fixtures/installed-gate.ts";
import { inspectedRustPassProblems } from "./fixtures/rust-behavior/gate-runs.ts";
import { rustBehaviorSamples } from "./fixtures/rust-behavior/sample.ts";
import { PROBE, PROBE_CONSTRUCTED_TYPE, writeTypeScriptProject } from "./fixtures/typescript-facts/project.ts";
import {
  inspectedPassProblems,
  runLayoutCiEntry,
  sampleGateCases,
} from "./fixtures/typescript-generation/gate-runs.ts";
import { generationSamples } from "./fixtures/typescript-generation/samples.ts";
import { ALL_CASES } from "./golden/catalog.ts";
import { DESIGN_CASES } from "./golden/design/cases.ts";
import { typescriptLayoutConfig } from "./golden/module-layout/typescript-cases.ts";
import { type GoldenCase, runGoldenCase } from "./golden/runner.ts";

const repository = resolve(import.meta.dir, "../..");
const temporary: string[] = [];
afterEach(() => {
  for (const root of temporary.splice(0)) rmSync(root, { recursive: true, force: true });
});
function fixture(harness: "claude" | "codex") {
  const root = mkdtempSync(join(tmpdir(), "ddd-install-sandbox-"));
  temporary.push(root);
  const project = join(root, "project");
  const source = join(root, "source");
  const leaf = `.${harness}`;
  mkdirSync(project, { recursive: true });
  cpSync(join(repository, leaf), join(project, leaf), { recursive: true, dereference: true });
  if (harness === "codex")
    cpSync(join(repository, ".agents"), join(project, ".agents"), { recursive: true, dereference: true });
  cpSync(join(repository, "ddd"), join(source, "ddd"), {
    recursive: true,
    dereference: true,
    filter: (path) => !path.split(sep).some((part) => part === "node_modules" || part === "dist"),
  });
  const userFile = join(project, "application.txt");
  writeFileSync(userFile, "User-owned application data\n");
  const env = { ...process.env, AIDLC_PROJECT_DIR: project, CLAUDE_PROJECT_DIR: project };
  delete env.AIDLC_COMPILED_EXECUTABLE;
  const invoke = (args: string[] = ["--from", source]) => {
    const result = Bun.spawnSync(
      [
        process.execPath,
        join(repository, "ddd/scripts/install.ts"),
        "--project",
        project,
        "--harness",
        harness,
        ...args,
      ],
      { cwd: project, env, stdout: "pipe", stderr: "pipe" },
    );
    return { code: result.exitCode, output: result.stdout.toString() + result.stderr.toString() };
  };
  return { root, project, source, leaf, userFile, invoke };
}

for (const harness of ["claude", "codex"] as const)
  test(`${harness}: fresh installation registers runnable plugin artifacts`, () => {
    const f = fixture(harness);
    const result = f.invoke();
    expect(result.code, result.output).toBe(0);
    const data = join(f.project, f.leaf, "tools/data");
    expect(
      JSON.parse(readFileSync(join(data, "stage-graph.json"), "utf8")).some(
        (stage: { slug: string }) => stage.slug === "ddd-domain-modeling",
      ),
    ).toBe(true);
    expect(existsSync(join(data, "ddd-install.json"))).toBe(true);
    const entry = DESIGN_CASES.find(
      (candidate) => candidate.sensor === "ddd-model-completeness" && candidate.name === "clean-complete",
    );
    if (!entry) throw new Error("Model fixture missing");
    expect(runGoldenCase(join(f.project, f.leaf, "tools"), entry).problems).toEqual([]);
    expect(readFileSync(f.userFile, "utf8")).toBe("User-owned application data\n");
  }, 30_000);

function snapshot(root: string): Record<string, string> {
  const files: Record<string, string> = {};
  function visit(dir: string) {
    for (const entry of readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name, "en"))) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) visit(path);
      else if (entry.isSymbolicLink()) files[path.slice(root.length + 1)] = `link:${readlinkSync(path)}`;
      // The mode is part of what an installation publishes: an executable payload that lands without
      // its execute bit, or a destination file whose mode is changed in place, must both be visible.
      else
        files[path.slice(root.length + 1)] =
          `${(lstatSync(path).mode & 0o777).toString(8)}:${createHash("sha256").update(readFileSync(path)).digest("hex")}`;
    }
  }
  visit(root);
  return files;
}

for (const harness of ["claude", "codex"] as const)
  test(`${harness}: reinstalling the same source leaves the destination unchanged`, () => {
    const f = fixture(harness);
    const first = f.invoke();
    expect(first.code, first.output).toBe(0);
    const before = snapshot(f.project);
    const second = f.invoke();
    expect(second.code, second.output).toBe(0);
    expect(second.output).toContain("Changed 0");
    expect(snapshot(f.project)).toEqual(before);
  }, 30_000);

for (const harness of ["claude", "codex"] as const) {
  test(`${harness}: a fresh dry-run leaves the destination unchanged`, () => {
    const f = fixture(harness);
    const before = snapshot(f.project);
    const result = f.invoke(["--from", f.source, "--dry-run"]);
    expect(result.code, result.output).toBe(0);
    expect(snapshot(f.project)).toEqual(before);
  }, 30_000);

  test(`${harness}: update installs changed payload and records its version`, () => {
    const f = fixture(harness);
    const first = f.invoke();
    expect(first.code, first.output).toBe(0);
    const manifest = join(f.source, "ddd/.aidlc-plugin/plugin.json");
    const value = JSON.parse(readFileSync(manifest, "utf8"));
    value.version = "0.1.1";
    writeFileSync(manifest, JSON.stringify(value));
    const relativeFile = "knowledge/aidlc-shared/ddd-domain-packaging.md";
    const text = `${readFileSync(join(f.source, "ddd", relativeFile), "utf8")}\nInstallation verification revision.\n`;
    writeFileSync(join(f.source, "ddd", relativeFile), text);
    const result = f.invoke(["--update"]);
    expect(result.code, result.output).toBe(0);
    expect(readFileSync(join(f.project, f.leaf, relativeFile), "utf8")).toBe(text);
    expect(JSON.parse(readFileSync(join(f.project, f.leaf, "tools/data/ddd-install.json"), "utf8")).version).toBe(
      "0.1.1",
    );
    expect(readFileSync(f.userFile, "utf8")).toBe("User-owned application data\n");
  }, 30_000);
}

const PLATFORM_KEY = `${process.platform}-${process.arch}`;
const EXTRACTOR_PAYLOAD = `tools/ddd/bin/${PLATFORM_KEY}/ddd-rust-syn-spike`;
const MANIFEST_PAYLOAD = "tools/ddd/bin/manifest.json";

function protocolOf(binary: string, flag: string): unknown {
  const result = Bun.spawnSync([binary, flag], { stdout: "pipe", stderr: "pipe" });
  expect(result.exitCode, result.stderr.toString()).toBe(0);
  return JSON.parse(result.stdout.toString()).protocol_version;
}

for (const harness of ["claude", "codex"] as const)
  test(`${harness}: the native extractor is installed, launches, and still launches after an update`, () => {
    const f = fixture(harness);
    const first = f.invoke();
    expect(first.code, first.output).toBe(0);
    const receiptPath = join(f.project, f.leaf, "tools/data/ddd-install.json");
    const installed = join(f.project, f.leaf, EXTRACTOR_PAYLOAD);
    const owned = Object.keys(JSON.parse(readFileSync(receiptPath, "utf8")).owned_files);
    expect(owned).toContain(EXTRACTOR_PAYLOAD);
    expect(owned).toContain(MANIFEST_PAYLOAD);
    expect(protocolOf(installed, "--error-contract-version")).toBe(3);
    expect(protocolOf(installed, "--state-exposure-version")).toBe(2);

    const manifest = join(f.source, "ddd/.aidlc-plugin/plugin.json");
    const value = JSON.parse(readFileSync(manifest, "utf8"));
    value.version = "0.1.1";
    writeFileSync(manifest, JSON.stringify(value));
    const updated = f.invoke(["--update"]);
    expect(updated.code, updated.output).toBe(0);
    expect(JSON.parse(readFileSync(receiptPath, "utf8")).version).toBe("0.1.1");
    expect(existsSync(installed)).toBe(true);
    expect(protocolOf(installed, "--error-contract-version")).toBe(3);
    expect(protocolOf(installed, "--state-exposure-version")).toBe(2);
  }, 60_000);

const TYPESCRIPT_COMPILER_PAYLOAD = "tools/ddd/lib/typescript/vendor/typescript.js";
const TYPESCRIPT_MANIFEST_PAYLOAD = "tools/ddd/lib/typescript/vendor/manifest.json";

/** Launches the TypeScript extractor of an installed tools tree in a process that cannot install packages. */
function typeScriptLaunchOf(tools: string, project: string, cwd: string): unknown {
  const result = Bun.spawnSync([process.execPath, "--no-install", PROBE, tools, project], {
    cwd,
    stdout: "pipe",
    stderr: "pipe",
  });
  expect(result.exitCode, result.stderr.toString()).toBe(0);
  return JSON.parse(result.stdout.toString());
}

for (const harness of ["claude", "codex"] as const)
  test(`${harness}: the TypeScript extractor is installed, launches, and still launches after an update`, () => {
    const f = fixture(harness);
    const first = f.invoke();
    expect(first.code, first.output).toBe(0);
    const receiptPath = join(f.project, f.leaf, "tools/data/ddd-install.json");
    const owned = Object.keys(JSON.parse(readFileSync(receiptPath, "utf8")).owned_files);
    expect(owned).toContain(TYPESCRIPT_COMPILER_PAYLOAD);
    expect(owned).toContain(TYPESCRIPT_MANIFEST_PAYLOAD);
    const tools = join(f.project, f.leaf, "tools");
    const inspected = join(f.root, "inspected");
    mkdirSync(inspected);
    writeTypeScriptProject(inspected);
    const launched = { kind: "ready", constructions: [PROBE_CONSTRUCTED_TYPE] };
    expect(typeScriptLaunchOf(tools, inspected, f.root)).toEqual(launched);

    const manifest = join(f.source, "ddd/.aidlc-plugin/plugin.json");
    const value = JSON.parse(readFileSync(manifest, "utf8"));
    value.version = "0.1.1";
    writeFileSync(manifest, JSON.stringify(value));
    const updated = f.invoke(["--update"]);
    expect(updated.code, updated.output).toBe(0);
    expect(JSON.parse(readFileSync(receiptPath, "utf8")).version).toBe("0.1.1");
    expect(typeScriptLaunchOf(tools, inspected, f.root)).toEqual(launched);
  }, 60_000);

/** Each of the sixteen gate runs per harness loads the distributed compiler in a process of its own. */
const INSTALLED_TYPESCRIPT_GATES_TIMEOUT_MS = 60_000;

for (const harness of ["claude", "codex"] as const)
  test(
    `${harness}: the installed TypeScript gates and CI entry pass every generation sample and the CI entry refuses a mixed layout`,
    () => {
      const f = fixture(harness);
      const installed = f.invoke();
      expect(installed.code, installed.output).toBe(0);
      const tools = join(f.project, f.leaf, "tools");
      for (const sample of generationSamples()) {
        const label = `${sample.representation}/${sample.layout}`;
        for (const gateCase of sampleGateCases(sample))
          expect(inspectedPassProblems(tools, gateCase), `${label} ${gateCase.sensor}`).toEqual([]);
        const passed = runLayoutCiEntry(tools, sample, false);
        expect(passed.exitCode, `${label}: ${passed.output}`).toBe(0);
        const refused = runLayoutCiEntry(tools, sample, true);
        expect(refused.exitCode, `${label} mixed layout: ${refused.output}`).toBe(1);
        expect(refused.output).toContain("module-layout.unresolved");
      }
    },
    INSTALLED_TYPESCRIPT_GATES_TIMEOUT_MS,
  );

for (const harness of ["claude", "codex"] as const)
  test(`${harness}: a user file at the native extractor path is refused without touching the destination`, () => {
    const f = fixture(harness);
    const path = join(f.project, f.leaf, EXTRACTOR_PAYLOAD);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, "// User-owned file; do not replace.\n");
    const before = snapshot(f.project);
    const result = f.invoke();
    expect(result.code).not.toBe(0);
    expect(result.output).toContain("collision");
    expect(snapshot(f.project)).toEqual(before);
  }, 30_000);

for (const harness of ["claude", "codex"] as const)
  test(`${harness}: the installed set migration reads a project that still has to migrate`, () => {
    const f = fixture(harness);
    const installed = f.invoke();
    expect(installed.code, installed.output).toBe(0);
    for (const [path, content] of Object.entries(legacySetFiles())) {
      const file = join(f.project, path);
      mkdirSync(dirname(file), { recursive: true });
      writeFileSync(file, content);
    }
    const preview = (): string => {
      const result = Bun.spawnSync(
        [
          process.execPath,
          join(f.project, f.leaf, "tools/ddd-artifact-set.ts"),
          "migrate",
          "--project",
          f.project,
          "--record",
          join(f.project, RECORD_DIR),
          "--supplement",
          join(f.project, SUPPLEMENT_FILE),
        ],
        { cwd: f.project, stdout: "pipe", stderr: "pipe" },
      );
      expect(result.exitCode, result.stderr.toString()).toBe(0);
      return JSON.parse(result.stdout.toString()).outcome;
    };
    expect(preview()).toBe("candidate");

    const manifest = join(f.source, "ddd/.aidlc-plugin/plugin.json");
    const value = JSON.parse(readFileSync(manifest, "utf8"));
    value.version = "0.1.1";
    writeFileSync(manifest, JSON.stringify(value));
    const knowledge = join(f.source, "ddd/knowledge/aidlc-shared/ddd-domain-packaging.md");
    writeFileSync(knowledge, `${readFileSync(knowledge, "utf8")}\nInstallation verification revision.\n`);
    const updated = f.invoke(["--update"]);
    expect(updated.code, updated.output).toBe(0);
    expect(preview()).toBe("candidate");
  }, 60_000);

for (const harness of ["claude", "codex"] as const)
  test(`${harness}: a contribution-only update is not mistaken for an unchanged install`, () => {
    const f = fixture(harness);
    const first = f.invoke();
    expect(first.code, first.output).toBe(0);
    const contribution = join(f.source, "ddd/contributions/construction/code-generation.md");
    writeFileSync(contribution, `${readFileSync(contribution, "utf8")}\nInstaller contribution update marker.\n`);
    const result = f.invoke(["--update"]);
    expect(result.code, result.output).toBe(0);
    expect(
      readFileSync(join(f.project, f.leaf, "aidlc-common/stages/construction/code-generation.md"), "utf8"),
    ).toContain("Installer contribution update marker.");
  }, 30_000);

for (const harness of ["claude", "codex"] as const)
  test(`${harness}: failed composition preserves the installed version and all destination files`, () => {
    const f = fixture(harness);
    const first = f.invoke();
    expect(first.code, first.output).toBe(0);
    const before = snapshot(f.project);
    writeFileSync(
      join(f.source, `ddd/dist/${harness}/hooks/compose.ts`),
      'console.error("intentional compose failure"); process.exit(2);\n',
    );
    const result = f.invoke(["--from", f.source, "--skip-build"]);
    expect(result.code).not.toBe(0);
    expect(result.output).toContain("intentional compose failure");
    expect(
      JSON.stringify(snapshot(f.project)) === JSON.stringify(before),
      "failed update must leave the installed tree intact",
    ).toBe(true);
  }, 30_000);

for (const harness of ["claude", "codex"] as const) {
  test(`${harness}: an update dry-run validates changed payload without publishing it`, () => {
    const f = fixture(harness);
    const first = f.invoke();
    expect(first.code, first.output).toBe(0);
    const before = snapshot(f.project);
    const path = join(f.source, "ddd/knowledge/aidlc-shared/ddd-domain-packaging.md");
    writeFileSync(path, `${readFileSync(path, "utf8")}\nDry-run revision.\n`);
    const result = f.invoke(["--update", "--dry-run"]);
    expect(result.code, result.output).toBe(0);
    expect(snapshot(f.project)).toEqual(before);
  }, 30_000);
}

for (const harness of ["claude", "codex"] as const)
  test(`${harness}: fresh installation refuses to overwrite a colliding user file`, () => {
    const f = fixture(harness);
    const path = join(f.project, f.leaf, "tools/ddd-sensor-model-presence.ts");
    writeFileSync(path, "// User-owned file; do not replace.\n");
    const before = snapshot(f.project);
    const result = f.invoke();
    expect(result.code).not.toBe(0);
    expect(result.output).toContain("collision");
    expect(snapshot(f.project)).toEqual(before);
  }, 30_000);

for (const harness of ["claude", "codex"] as const)
  test(`${harness}: update removes a file previously installed by this plugin`, () => {
    const f = fixture(harness);
    const relativeFile = "tools/ddd-install-probe.ts";
    writeFileSync(join(f.source, "ddd", relativeFile), 'export const revision = "old";\n');
    const first = f.invoke();
    expect(first.code, first.output).toBe(0);
    expect(existsSync(join(f.project, f.leaf, relativeFile))).toBe(true);
    rmSync(join(f.source, "ddd", relativeFile));
    const result = f.invoke(["--update"]);
    expect(result.code, result.output).toBe(0);
    expect(existsSync(join(f.project, f.leaf, relativeFile))).toBe(false);
  }, 30_000);

for (const harness of ["claude", "codex"] as const)
  test(`${harness}: update preserves local edits to an installed plugin file`, () => {
    const f = fixture(harness);
    expect(f.invoke().code).toBe(0);
    writeFileSync(join(f.project, f.leaf, "tools/ddd-sensor-model-presence.ts"), "// Local edit\n");
    const before = snapshot(f.project);
    const result = f.invoke(["--update"]);
    expect(result.code).not.toBe(0);
    expect(result.output).toContain("was modified");
    expect(snapshot(f.project)).toEqual(before);
  }, 30_000);

test("unsupported harness names are rejected before installation", () => {
  const f = fixture("claude");
  const before = snapshot(f.project);
  for (const harness of ["kimi", "opencode", "copilot", "cursor", "kiro", "kiro-ide"]) {
    const result = f.invoke(["--harness", harness, "--from", f.source]);
    expect(result.code).not.toBe(0);
    expect(result.output).toContain("unsupported harness");
  }
  expect(snapshot(f.project)).toEqual(before);
}, 30_000);

for (const harness of ["claude", "codex"] as const) {
  test(`${harness}: invalid contribution updates leave the installed tree intact`, () => {
    const f = fixture(harness);
    expect(f.invoke().code).toBe(0);
    const before = snapshot(f.project);
    const path = join(f.source, "ddd/contributions/construction/code-generation.md");
    writeFileSync(path, readFileSync(path, "utf8").replaceAll("after-step:1", "after-step:999"));
    const result = f.invoke(["--update"]);
    expect(result.code).not.toBe(0);
    expect(snapshot(f.project)).toEqual(before);
  }, 30_000);

  test(`${harness}: a failed fresh compose leaves the destination untouched`, () => {
    const f = fixture(harness);
    expect(f.invoke(["--from", f.source, "--dry-run"]).code).toBe(0);
    const before = snapshot(f.project);
    writeFileSync(
      join(f.source, `ddd/dist/${harness}/hooks/compose.ts`),
      'console.error("fresh failure"); process.exit(2);\n',
    );
    const result = f.invoke(["--from", f.source, "--skip-build"]);
    expect(result.code).not.toBe(0);
    expect(snapshot(f.project)).toEqual(before);
  }, 30_000);

  test(`${harness}: prebuilt installation consumes the existing projection`, () => {
    const f = fixture(harness);
    expect(f.invoke(["--from", f.source, "--dry-run"]).code).toBe(0);
    const relativeFile = "knowledge/aidlc-shared/ddd-domain-packaging.md";
    const built = readFileSync(join(f.source, `ddd/dist/${harness}`, relativeFile), "utf8");
    writeFileSync(join(f.source, "ddd", relativeFile), `${built}\nUnbuilt source edit.\n`);
    const result = f.invoke(["--from", f.source, "--skip-build"]);
    expect(result.code, result.output).toBe(0);
    expect(readFileSync(join(f.project, f.leaf, relativeFile), "utf8")).toBe(built);
  }, 30_000);
}

test("legacy ownership is not guessed when the previous payload cannot be verified", () => {
  const f = fixture("claude");
  const helper = join(f.source, "ddd/tools/ddd-legacy-probe.ts");
  writeFileSync(helper, "export const value = 1;\n");
  expect(f.invoke().code).toBe(0);
  const provenance = join(f.project, f.leaf, "tools/data/ddd-install.json");
  const record = JSON.parse(readFileSync(provenance, "utf8"));
  delete record.owned_files;
  writeFileSync(provenance, JSON.stringify(record));
  const before = snapshot(f.project);
  rmSync(helper);
  const result = f.invoke(["--update"]);
  expect(result.code).not.toBe(0);
  expect(result.output).toContain("ownership");
  expect(snapshot(f.project)).toEqual(before);
}, 30_000);

test("verified legacy receipts gain file ownership on reinstallation", () => {
  const f = fixture("claude");
  expect(f.invoke().code).toBe(0);
  const path = join(f.project, f.leaf, "tools/data/ddd-install.json");
  const record = JSON.parse(readFileSync(path, "utf8"));
  delete record.owned_files;
  writeFileSync(path, JSON.stringify(record));
  const result = f.invoke(["--update"]);
  expect(result.code, result.output).toBe(0);
  expect(Object.keys(JSON.parse(readFileSync(path, "utf8")).owned_files).length).toBeGreaterThan(0);
  expect(f.invoke(["--update"]).output).toContain("Changed 0");
}, 30_000);

test("a fixed-tag update detects a modified installed payload", () => {
  const f = fixture("claude");
  expect(f.invoke().code).toBe(0);
  const path = join(f.project, f.leaf, "tools/data/ddd-install.json");
  const record = JSON.parse(readFileSync(path, "utf8"));
  record.source = "tag";
  record.ref = "v0.1.0";
  writeFileSync(path, JSON.stringify(record));
  expect(f.invoke(["--update"]).output).toContain("Changed 0");
  writeFileSync(join(f.project, f.leaf, "tools/ddd-sensor-model-presence.ts"), "// Local edit\n");
  const before = snapshot(f.project);
  const result = f.invoke(["--update"]);
  expect(result.code).not.toBe(0);
  expect(snapshot(f.project)).toEqual(before);
}, 30_000);

for (const harness of ["claude", "codex"] as const) {
  test.skipIf(process.env.DDD_VERIFY_REMOTE_INSTALL !== "1")(
    `${harness}: install from the real GitHub main archive`,
    () => {
      const f = fixture(harness);
      const result = f.invoke(["--ref", "main"]);
      expect(result.code, result.output).toBe(0);
      const receipt = JSON.parse(readFileSync(join(f.project, f.leaf, "tools/data/ddd-install.json"), "utf8"));
      expect(receipt.source).toBe("ref");
      expect(receipt.ref).toBe("main");
      const entry = DESIGN_CASES.find(
        (candidate) => candidate.sensor === "ddd-model-completeness" && candidate.name === "clean-complete",
      );
      if (!entry) throw new Error("Model fixture missing");
      expect(runGoldenCase(join(f.project, f.leaf, "tools"), entry).problems).toEqual([]);
    },
    90_000,
  );
}

test("conflicting source selectors are rejected without changing the destination", () => {
  const f = fixture("claude");
  const before = snapshot(f.project);
  const result = f.invoke(["--from", f.source, "--ref", "main"]);
  expect(result.code).not.toBe(0);
  expect(result.output).toContain("one source selector");
  expect(snapshot(f.project)).toEqual(before);
}, 30_000);

for (const harness of ["claude", "codex"] as const) {
  test(`${harness}: update does not write through a linked destination directory`, () => {
    const f = fixture(harness);
    expect(f.invoke().code).toBe(0);
    const directory = join(f.project, f.leaf, "tools/ddd");
    const external = join(f.root, "external-tools");
    renameSync(directory, external);
    symlinkSync(external, directory, "dir");
    const before = snapshot(f.project);
    const externalBefore = snapshot(external);
    const sourceFile = join(f.source, "ddd/tools/ddd/lib/shared/findings.ts");
    writeFileSync(sourceFile, `${readFileSync(sourceFile, "utf8")}\n// New revision\n`);
    const result = f.invoke(["--update"]);
    expect(result.code).not.toBe(0);
    expect(result.output).toContain("linked path");
    expect(snapshot(f.project)).toEqual(before);
    expect(snapshot(external)).toEqual(externalBefore);
  }, 30_000);
}

// ---------------------------------------------------------------------------
// The gates of an installed project, reached the way a model reaches them
// ---------------------------------------------------------------------------

/** Installing, then driving several gate runs through the installed engine, takes more than one default timeout. */
const GATE_FLOW_TIMEOUT_MS = 120_000;
const USER_DATA = "User-owned application data\n";

function output(run: CommandRun): string {
  return `exit ${run.exitCode}\n${run.stdout}${run.stderr}`;
}

function caseNamed(sensor: string, name: string): GoldenCase {
  const found = ALL_CASES.find((candidate) => candidate.sensor === sensor && candidate.name === name);
  if (found === undefined) throw new Error(`golden case missing: ${sensor}/${name}`);
  return structuredClone(found);
}

/** Every audit row the record holds, as one text. */
function auditOf(record: string): string {
  const root = join(record, "audit");
  if (!existsSync(root)) return "";
  return readdirSync(root, { recursive: true })
    .filter((path) => String(path).endsWith(".md"))
    .map((path) => readFileSync(join(root, String(path)), "utf8"))
    .join("\n");
}

const MODEL_STAGE = { slug: "ddd-domain-modeling", phase: "inception", artifact: "ddd-domain-model-yaml.md" } as const;
const MODEL_SENSOR = "ddd-model-completeness";

/**
 * What `report --single` answers once AI-DLC checks a standalone completion the way it checks an
 * approval. AI-DLC 2.9.0 does not: its single-stage report (handleSingleReport in
 * aidlc-orchestrate.ts) calls none of verifyStageArtifacts, fireGateSensors and
 * enforceBlockingGateSensors, so the standalone completion instructions prescribe the manual check.
 */
const STANDALONE_COMPLETION_ONCE_FIXED =
  "report --single refuses a stage whose registered artifacts are missing and records no completion";

for (const harness of ["claude", "codex"] as const)
  test(
    `${harness}: AI-DLC 2.9.0 completes a standalone DDD stage whose artifacts are missing, and the manual check does not pass it`,
    () => {
      const f = fixture(harness);
      const installed = f.invoke();
      expect(installed.code, installed.output).toBe(0);
      const gates = installedGates(f.project, f.leaf, f.root, (id) => id.startsWith("ddd-"));
      gates.startStage(MODEL_STAGE.slug, MODEL_STAGE.phase, "refactor");
      const model = join(gates.record, gates.artifactPath(MODEL_STAGE.slug, MODEL_STAGE.phase, MODEL_STAGE.artifact));

      const { started, reported } = gates.completeStandalone(MODEL_STAGE.slug);
      expect(lastJson(started)?.kind, output(started)).toBe("run-stage");
      expect(existsSync(model)).toBe(false);
      // The upstream gap. Once AI-DLC refuses here instead, assert that refusal and retire the manual
      // check from the standalone completion instructions.
      expect(
        lastJson(reported)?.kind,
        `expected once fixed: ${STANDALONE_COMPLETION_ONCE_FIXED}\n${output(reported)}`,
      ).toBe("done");

      const check = gates.manualCheck(MODEL_SENSOR, MODEL_STAGE.slug, model);
      expect(check.exitCode, output(check)).not.toBe(0);
      expect(manualCheckPasses(check)).toBe(false);
      expect(readFileSync(f.userFile, "utf8")).toBe(USER_DATA);
    },
    GATE_FLOW_TIMEOUT_MS,
  );

for (const harness of ["claude", "codex"] as const)
  test(
    `${harness}: the manual check the standalone instructions prescribe passes a sound model, fails a broken one and refuses a missing one`,
    () => {
      const f = fixture(harness);
      const installed = f.invoke();
      expect(installed.code, installed.output).toBe(0);
      const gates = installedGates(f.project, f.leaf, f.root, (id) => id === MODEL_SENSOR);
      const model = () =>
        join(gates.record, gates.artifactPath(MODEL_STAGE.slug, MODEL_STAGE.phase, MODEL_STAGE.artifact));
      const check = (files: Readonly<Record<string, string>>) => {
        gates.startStage(MODEL_STAGE.slug, MODEL_STAGE.phase, "refactor");
        gates.writeRecord(files);
        return gates.manualCheck(MODEL_SENSOR, MODEL_STAGE.slug, model());
      };

      const sound = check(caseNamed(MODEL_SENSOR, "clean-complete").files);
      expect(manualCheckPasses(sound), output(sound)).toBe(true);

      const broken = check(caseNamed(MODEL_SENSOR, "violation-schema").files);
      expect(broken.exitCode, output(broken)).toBe(0);
      expect(lastJson(broken)?.result, output(broken)).toBe("failed");
      expect(manualCheckPasses(broken)).toBe(false);

      const files = caseNamed(MODEL_SENSOR, "clean-complete").files;
      delete files[`${MODEL_STAGE.phase}/${MODEL_STAGE.slug}/${MODEL_STAGE.artifact}`];
      const missing = check(files);
      expect(existsSync(model())).toBe(false);
      expect(missing.exitCode, output(missing)).not.toBe(0);
      expect(manualCheckPasses(missing)).toBe(false);
      expect(readFileSync(f.userFile, "utf8")).toBe(USER_DATA);
    },
    GATE_FLOW_TIMEOUT_MS,
  );

/**
 * The code-generation sensors the standalone completion instructions run, over a TypeScript-only
 * project. Each one answers its passing run with a note of its own (the layout's mode and counts,
 * "no Rust project", "no rust sources claimed"), which AI-DLC drops from a passing verdict: a note on
 * the verdict only ever reports a sensor that could not run. So the manual check's "no note"
 * condition refuses no sound run, whichever language the project is written in.
 */
const CODE_GENERATION_SENSORS = [
  "ddd-typescript-domain",
  "ddd-typescript-module-layout",
  "ddd-rust-domain",
  "ddd-rust-module-layout",
] as const;

for (const harness of ["claude", "codex"] as const)
  test(
    `${harness}: the manual check passes a sound code-generation run although its sensors answer with a note of their own`,
    () => {
      const f = fixture(harness);
      const installed = f.invoke();
      expect(installed.code, installed.output).toBe(0);
      const gates = installedGates(f.project, f.leaf, f.root, (id) => id.startsWith("ddd-"));
      const sound = caseNamed("ddd-typescript-domain", "clean-class");
      gates.startStage("code-generation", "construction", "refactor");
      // The case's record keeps its Unit directory, which its source manifest names.
      const place = (root: string, files: Readonly<Record<string, string>>) => {
        for (const [path, content] of Object.entries(files)) {
          mkdirSync(dirname(join(root, path)), { recursive: true });
          writeFileSync(join(root, path), content);
        }
      };
      place(gates.record, sound.files);
      place(f.project, { ...sound.workspace, ".ddd.toml": typescriptLayoutConfig("named-file") });
      const summary = join(gates.record, sound.output);
      for (const sensor of CODE_GENERATION_SENSORS) {
        const check = gates.manualCheck(sensor, "code-generation", summary);
        const detail = lastJson(check)?.detail_path;
        const why = typeof detail === "string" ? readFileSync(join(f.project, detail), "utf8") : "";
        expect(lastJson(check)?.result, `${sensor}\n${output(check)}${why}`).toBe("passed");
        expect(lastJson(check)?.note, `${sensor}\n${output(check)}`).toBeUndefined();
        expect(manualCheckPasses(check), sensor).toBe(true);
      }
      expect(readFileSync(f.userFile, "utf8")).toBe(USER_DATA);
    },
    GATE_FLOW_TIMEOUT_MS,
  );

/**
 * A gate whose contract the use-case, read-model updater and storage decisions changed, with the
 * golden cases that show it: declarations it admits, declarations it reports, and — for every gate —
 * the stage run with its declaration artifact missing.
 */
interface ChangedGate {
  readonly sensor: string;
  readonly stage: string;
  readonly artifact: string;
  /** A blocking gate closes the approval on a violation; an advisory one only reports it. */
  readonly blocking: boolean;
  readonly sound: readonly string[];
  readonly violations: readonly string[];
}

const CHANGED_GATES: readonly ChangedGate[] = [
  {
    sensor: "ddd-mapping-declarations",
    stage: "functional-design",
    artifact: "functional-spec.md",
    blocking: true,
    sound: ["clean-mixed-process-manager", "clean-class-process-manager", "clean-unmapped-single-aggregate"],
    violations: ["violation-mixed-re-execution", "violation-execution-model-undetermined"],
  },
  {
    sensor: "ddd-layer-structure",
    stage: "infrastructure-design",
    artifact: "cicd-pipeline.md",
    blocking: true,
    sound: ["clean-rmu-ordering", "clean-rmu-cross-side"],
    violations: ["violation-rmu-ordering-scope-value", "violation-ordering-outside-rmu"],
  },
  {
    sensor: "ddd-design-advisories",
    stage: "infrastructure-design",
    artifact: "cicd-pipeline.md",
    blocking: false,
    sound: ["clean", "clean-event-sourcing-insert-only"],
    violations: ["violation-store-upsert", "violation-event-sourcing-upsert", "violation-store-method-unmapped"],
  },
];

const CONSTRUCTION = "construction";

/** Starts the gate's stage afresh over `entry`'s record, with or without the declaration artifact. */
function prepareStage(
  gates: ReturnType<typeof installedGates>,
  gate: ChangedGate,
  entry: GoldenCase,
  withArtifact: boolean,
): string {
  gates.startStage(gate.stage, CONSTRUCTION, "refactor");
  const files = { ...entry.files };
  if (!withArtifact) delete files[`${CONSTRUCTION}/u1/${gate.stage}/${gate.artifact}`];
  gates.writeRecord(files);
  gates.fillOtherOutputs(gate.stage, CONSTRUCTION, [gate.artifact]);
  const artifact = join(gates.record, gates.artifactPath(gate.stage, CONSTRUCTION, gate.artifact));
  expect(existsSync(artifact)).toBe(withArtifact);
  return artifact;
}

for (const harness of ["claude", "codex"] as const)
  for (const gate of CHANGED_GATES) {
    test(
      `${harness}: the ${gate.sensor} gate at the ${gate.stage} approval admits sound declarations and ${gate.blocking ? "refuses" : "only reports"} violations and a missing declaration`,
      () => {
        const f = fixture(harness);
        const installed = f.invoke();
        expect(installed.code, installed.output).toBe(0);
        const gates = installedGates(f.project, f.leaf, f.root, (id) => id === gate.sensor);
        // The gate fired and failed; a blocking gate keeps the approval closed, an advisory one does not.
        const expectReported = (label: string) => {
          const opened = gates.openGate(gate.stage);
          if (gate.blocking) {
            expect(output(opened), label).not.toContain("Recorded awaiting-approval");
            expect(output(opened), label).toContain(gate.sensor);
          } else {
            expect(output(opened), label).toContain("Recorded awaiting-approval");
          }
          const audit = auditOf(gates.record);
          expect(audit, label).toContain(gate.sensor);
          expect(audit, label).toContain("SENSOR_FAILED");
        };

        for (const name of gate.sound) {
          prepareStage(gates, gate, caseNamed(gate.sensor, name), true);
          const opened = gates.openGate(gate.stage);
          expect(output(opened), name).toContain("Recorded awaiting-approval");
          expect(auditOf(gates.record), name).toContain("SENSOR_PASSED");
          const approved = gates.approve(gate.stage);
          expect(lastJson(approved)?.kind, `${name}: ${output(approved)}`).toBe("done");
        }

        for (const name of gate.violations) {
          prepareStage(gates, gate, caseNamed(gate.sensor, name), true);
          expectReported(name);
        }

        prepareStage(gates, gate, caseNamed(gate.sensor, gate.sound[0]), false);
        expectReported(`${gate.sound[0]} without ${gate.artifact}`);
        expect(readFileSync(f.userFile, "utf8")).toBe(USER_DATA);
      },
      GATE_FLOW_TIMEOUT_MS,
    );

    test(
      `${harness}: the manual check of ${gate.sensor} at ${gate.stage} passes sound declarations, fails violations and refuses a missing one`,
      () => {
        const f = fixture(harness);
        const installed = f.invoke();
        expect(installed.code, installed.output).toBe(0);
        const gates = installedGates(f.project, f.leaf, f.root, (id) => id === gate.sensor);

        for (const name of gate.sound) {
          const artifact = prepareStage(gates, gate, caseNamed(gate.sensor, name), true);
          const check = gates.manualCheck(gate.sensor, gate.stage, artifact);
          expect(manualCheckPasses(check), `${name}: ${output(check)}`).toBe(true);
        }

        for (const name of gate.violations) {
          const artifact = prepareStage(gates, gate, caseNamed(gate.sensor, name), true);
          const check = gates.manualCheck(gate.sensor, gate.stage, artifact);
          expect(check.exitCode, `${name}: ${output(check)}`).toBe(0);
          expect(lastJson(check)?.result, `${name}: ${output(check)}`).toBe("failed");
        }

        const artifact = prepareStage(gates, gate, caseNamed(gate.sensor, gate.sound[0]), false);
        const missing = gates.manualCheck(gate.sensor, gate.stage, artifact);
        expect(missing.exitCode, output(missing)).not.toBe(0);
        expect(manualCheckPasses(missing)).toBe(false);
        expect(readFileSync(f.userFile, "utf8")).toBe(USER_DATA);
      },
      GATE_FLOW_TIMEOUT_MS,
    );
  }

/** Each Rust gate run starts the installed native extractor in a process of its own. */
const INSTALLED_RUST_GATES_TIMEOUT_MS = 120_000;

for (const harness of ["claude", "codex"] as const)
  test(
    `${harness}: the installed Rust gates pass every Rust behavior sample with no finding`,
    () => {
      const f = fixture(harness);
      const installed = f.invoke();
      expect(installed.code, installed.output).toBe(0);
      const tools = join(f.project, f.leaf, "tools");
      for (const sample of rustBehaviorSamples())
        for (const gateCase of [sample.domainCase, sample.useCaseCase, sample.interfaceAdapterCase, sample.layoutCase])
          expect(inspectedRustPassProblems(tools, gateCase), `${sample.layout} ${gateCase.sensor}`).toEqual([]);
      expect(readFileSync(f.userFile, "utf8")).toBe(USER_DATA);
    },
    INSTALLED_RUST_GATES_TIMEOUT_MS,
  );
