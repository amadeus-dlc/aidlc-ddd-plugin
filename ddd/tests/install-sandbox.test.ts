import { afterEach, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import {
  cpSync,
  existsSync,
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
import { join, resolve, sep } from "node:path";
import { DESIGN_CASES } from "./golden/design/cases.ts";
import { runGoldenCase } from "./golden/runner.ts";

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
      else files[path.slice(root.length + 1)] = createHash("sha256").update(readFileSync(path)).digest("hex");
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
