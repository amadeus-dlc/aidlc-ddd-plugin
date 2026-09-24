import { afterEach, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { rustSourcesUnder } from "../tools/ddd/lib/packaging/rust-modules.ts";
import {
  classifyDomainFactExtractor,
  type DomainFactSet,
  readDomainFacts,
} from "../tools/ddd/lib/rust/domain-facts/index.ts";
import { removeExtractorTools, toolsWithExtractor, toolsWithProductExtractor } from "./golden/extractor-tools.ts";
import { layoutConfig, MODULE_LAYOUT_CASES } from "./golden/module-layout/cases.ts";
import { type GoldenCase, runGoldenCase, spawnSensor } from "./golden/runner.ts";

afterEach(removeExtractorTools);

/** The launch every entry of the module walk classifies, resolved once for the whole file. */
async function readyExtractor() {
  const outcome = await classifyDomainFactExtractor();
  expect(outcome.kind, "run bun run prepare:native").toBe("ready");
  return outcome;
}

/** The declarations of every Rust source under `root`, as the walk's callers batch them. */
function declarationsUnder(root: string, binaryPath: string): DomainFactSet {
  const sources = rustSourcesUnder(root, root).map((file) => ({
    file,
    source: readFileSync(join(root, file), "utf8"),
  }));
  const result = readDomainFacts(binaryPath, sources);
  if (result.kind !== "facts") throw new Error(result.detail);
  return result.facts;
}

for (const entry of MODULE_LAYOUT_CASES) {
  test(`${entry.sensor}/${entry.name}`, () => {
    expect(runGoldenCase(join(import.meta.dir, "../tools"), entry).problems).toEqual([]);
  });
  test(`CI exit status: ${entry.name}`, () => {
    const root = mkdtempSync(join(tmpdir(), "ddd-layout-ci-"));
    try {
      for (const [path, text] of Object.entries(entry.workspace ?? {})) {
        const full = join(root, path);
        mkdirSync(dirname(full), { recursive: true });
        writeFileSync(full, text);
      }
      const result = Bun.spawnSync(
        [process.execPath, join(import.meta.dir, "../tools/ddd-check-rust-module-layout.ts"), "--project", root],
        { stdout: "pipe", stderr: "pipe" },
      );
      const output = JSON.parse(result.stdout.toString());
      expect(output.pass, JSON.stringify(output)).toBe(entry.expect.pass);
      expect(result.exitCode).toBe(entry.expect.pass ? 0 : 1);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
}

for (const scenario of ["no-project", "no-targets", "invalid-project", "symlink", "budget"]) {
  test(`inspection fails closed: ${scenario}`, async () => {
    const root = mkdtempSync(join(tmpdir(), "ddd-layout-failure-"));
    try {
      const { checkModuleLayout } = await import("../tools/ddd/lib/module-layout/check.ts");
      const extractor = await readyExtractor();
      if (scenario === "budget") {
        expect(() =>
          checkModuleLayout(extractor, root, () => {
            throw new Error("budget-exceeded");
          }),
        ).toThrow("budget-exceeded");
        return;
      }
      if (scenario === "no-project") {
        expect(checkModuleLayout(extractor, root)).toEqual({ findings: [], crates: 0, files: 0 });
      } else if (scenario === "no-targets") {
        writeFileSync(join(root, ".ddd.toml"), layoutConfig());
        writeFileSync(join(root, "Cargo.toml"), '[package]\nname="empty"\n');
        expect(
          checkModuleLayout(extractor, root).findings.some((entry) => entry.rule_id === "module-layout.unresolved"),
        ).toBe(true);
      } else if (scenario === "symlink") {
        const { symlinkSync } = await import("node:fs");
        writeFileSync(join(root, ".ddd.toml"), layoutConfig());
        symlinkSync(root, join(root, "recursive"));
        expect(
          checkModuleLayout(extractor, root).findings.some((entry) => entry.rule_id === "module-layout.unresolved"),
        ).toBe(true);
      }
      const cli = Bun.spawnSync(
        [
          process.execPath,
          join(import.meta.dir, "../tools/ddd-check-rust-module-layout.ts"),
          "--project",
          scenario === "invalid-project" ? join(root, "missing") : root,
        ],
        { stdout: "pipe", stderr: "pipe" },
      );
      expect(cli.exitCode).toBe(1);
      const verdict = JSON.parse(cli.stdout.toString());
      expect(verdict.pass).toBe(false);
      for (const entry of verdict.findings ?? []) expect(entry.file.length).toBeGreaterThan(0);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
}

// --- an extractor the module walk cannot launch ------------------------------

// The walk decides which file to open next from the declarations the extractor reports, so both
// entries of this check classify its launch before walking. Their terminals differ in shape — the
// gate ends in the sensor runtime's tool-unavailable exit, the CI entry in its own catch — so each
// is observed on its own rather than inferred from the other. Each test below pairs a run whose
// extractor is the product one with a run whose extractor is absent, over the same project, so the
// installation is the only thing that moves between the verdict and the terminal.

/** The clean single-crate project the walk passes, as the golden catalog describes it. */
function cleanLayoutCase(): GoldenCase {
  const source = MODULE_LAYOUT_CASES.find((entry) => entry.name === "clean-file");
  if (!source) throw new Error("the module-layout catalog carries no clean-file case");
  return structuredClone(source);
}

/** The project the CI entry is pointed at, carrying the same workspace the gate is run over. */
function layoutProject(testCase: GoldenCase): string {
  const root = mkdtempSync(join(tmpdir(), "ddd-layout-launch-"));
  for (const [path, text] of Object.entries(testCase.workspace ?? {})) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), text);
  }
  return root;
}

/** Runs the CI entry of `tools` over `project`, as a pipeline step invokes it. */
function runLayoutCli(tools: string, project: string) {
  const proc = Bun.spawnSync([process.execPath, join(tools, "ddd-check-rust-module-layout.ts"), "--project", project], {
    stdout: "pipe",
    stderr: "pipe",
  });
  return { exitCode: proc.exitCode, stdout: proc.stdout.toString(), stderr: proc.stderr.toString() };
}

test("the layout gate reports its verdict with the extractor installed, and stops without it", () => {
  const ready = spawnSensor(toolsWithProductExtractor(), cleanLayoutCase());
  expect(ready.exitCode, ready.stderr).toBe(0);
  expect(JSON.parse(ready.stdout).pass).toBe(true);

  // Same project, same gate: the installation is the only difference, so a clean pass here would be
  // a walk answering "this project declares nothing" about files it never read.
  const blocked = spawnSensor(toolsWithExtractor({ present: false }), cleanLayoutCase());
  expect(blocked.exitCode).toBe(127);
  expect(blocked.stdout).toBe("");
});

test("the CI entry reports its verdict with the extractor installed, and does not pass without it", () => {
  const project = layoutProject(cleanLayoutCase());
  try {
    const ready = runLayoutCli(toolsWithProductExtractor(), project);
    expect(ready.exitCode, ready.stderr).toBe(0);
    expect(JSON.parse(ready.stdout).pass).toBe(true);

    const blocked = runLayoutCli(toolsWithExtractor({ present: false }), project);
    expect(blocked.exitCode).toBe(1);
    const verdict = JSON.parse(blocked.stdout);
    expect(verdict.pass).toBe(false);
    // The walk never ran, so this is not a completed inspection that happens to fail: it carries a
    // reason and none of the results a finished walk reports.
    expect(typeof verdict.reason).toBe("string");
    expect(verdict.findings).toBeUndefined();
    expect(verdict.crates).toBeUndefined();
  } finally {
    rmSync(project, { recursive: true, force: true });
  }
});

for (const layer of ["domain", "use-case", "interface-adapter", "rmu"] as const) {
  test(`${layer}: type resolution follows logical modules and ignores orphan files`, async () => {
    const root = mkdtempSync(join(tmpdir(), "ddd-logical-module-"));
    try {
      mkdirSync(join(root, "src/storage"), { recursive: true });
      writeFileSync(join(root, "src/lib.rs"), '#[path="storage/invoice.rs"] pub mod invoice;\n');
      writeFileSync(join(root, "src/storage/invoice.rs"), "pub struct Invoice;\n");
      writeFileSync(join(root, "src/orphan.rs"), "pub struct Orphan;\n");
      const { buildProgram, collectRustSources } = await import("../tools/ddd/lib/rules/rust/program.ts");
      const extractor = await readyExtractor();
      const assignments = [
        {
          crate_name: "billing",
          path: ".",
          layer,
          layer_source: "suffix" as const,
          cqrs_side: "none" as const,
          cqrs_source: "none" as const,
          is_composition_root: false,
          diagnostics: [],
          targets: [{ kind: "lib" as const, name: "billing", src_path: "src/lib.rs" }],
        },
      ];
      // Module resolution is decided by the crate's own declarations, which is what the extractor
      // reports: the walk follows the `#[path]` module and never the orphan file beside it.
      if (extractor.kind !== "ready") return;
      const facts = declarationsUnder(root, extractor.binaryPath);
      const program = buildProgram(collectRustSources(facts, root, assignments), facts);
      expect(program.resolveType("src/lib.rs", [], "crate::invoice::Invoice")?.key).toBe("billing::invoice::Invoice");
      expect(program.types.some((entry) => entry.name === "Orphan")).toBe(false);
      expect([...program.notes]).toEqual([]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
}

/** Settings of a project that names TypeScript as its only language. */
const TYPESCRIPT_ONLY_SETTINGS =
  'schema_version = 2\nlanguages = ["typescript"]\n\n[typescript]\nmodule_layout = "named-file"\ncode_representation = "class"\n';

async function checkProject(files: Record<string, string>) {
  const root = mkdtempSync(join(tmpdir(), "ddd-layout-languages-"));
  try {
    for (const [path, text] of Object.entries(files)) {
      mkdirSync(dirname(join(root, path)), { recursive: true });
      writeFileSync(join(root, path), text);
    }
    const { checkModuleLayout } = await import("../tools/ddd/lib/module-layout/check.ts");
    return checkModuleLayout(await readyExtractor(), root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

test("a project whose settings name no Rust and that holds no Rust has nothing to check", async () => {
  const result = await checkProject({
    ".ddd.toml": TYPESCRIPT_ONLY_SETTINGS,
    "package.json": '{ "name": "billing" }\n',
    "src/invoice.ts": "export class Invoice {}\n",
  });
  expect(result).toEqual({ findings: [], crates: 0, files: 0 });
});

for (const [label, files] of [
  ["a Cargo manifest", { "Cargo.toml": '[package]\nname = "billing"\nversion = "0.1.0"\nedition = "2021"\n' }],
  ["a Rust source", { "tools/generate.rs": "fn main() {}\n" }],
] as const)
  test(`a project whose settings name no Rust but that holds ${label} is refused for its settings`, async () => {
    const result = await checkProject({ ".ddd.toml": TYPESCRIPT_ONLY_SETTINGS, ...files });
    expect(result.mode).toBeUndefined();
    expect(result.findings.map((entry) => [entry.rule_id, entry.file])).toEqual([
      ["module-layout.configuration", ".ddd.toml"],
    ]);
  });

// Dropping read permission does nothing for a superuser, whose listing succeeds regardless, so the
// test either observes the finding or does not run at all.
const RUNNING_AS_SUPERUSER = process.getuid?.() === 0;

test.skipIf(RUNNING_AS_SUPERUSER)("a directory the walk cannot list is reported rather than thrown", async () => {
  const root = mkdtempSync(join(tmpdir(), "ddd-layout-unreadable-"));
  const sealed = join(root, "packages");
  try {
    const { checkModuleLayout } = await import("../tools/ddd/lib/module-layout/check.ts");
    const { chmodSync } = await import("node:fs");
    writeFileSync(join(root, ".ddd.toml"), layoutConfig());
    mkdirSync(sealed, { recursive: true });
    chmodSync(sealed, 0o000);
    const result = checkModuleLayout(await readyExtractor(), root);
    expect(result.findings.some((entry) => entry.rule_id === "module-layout.unresolved")).toBe(true);
  } finally {
    const { chmodSync } = await import("node:fs");
    try {
      chmodSync(sealed, 0o755);
    } catch {
      // The directory may not exist when the test failed before creating it.
    }
    rmSync(root, { recursive: true, force: true });
  }
});

// --- declarations that reach outside the inspected project ---------------------

// The declarations the walk follows come from one batch, and that batch is gathered by the same
// discovery that skips the excluded directories. A declaration into one of them therefore names a
// file the extractor was never asked about, which is not the same fact as a file it could not
// parse. Both entries are observed for every input below, because their terminals differ in shape.

const LAYOUT_OUTPUT = "construction/code-generation/code-summary.md";
const LAYOUT_MANIFEST = '[package]\nname = "billing"\nversion = "0.1.0"\nedition = "2021"\n';

/** A single-crate layout case carrying `workspace`, with the settings and manifest it needs. */
function scanScopeCase(name: string, mode: string, workspace: Record<string, string>): GoldenCase {
  return {
    sensor: "ddd-rust-module-layout",
    name,
    stage: "code-generation",
    output: LAYOUT_OUTPUT,
    files: { [LAYOUT_OUTPUT]: "# Code summary\n" },
    state: "## Stage Progress\n- [ ] ddd-domain-modeling — SKIP\n",
    workspace: { ".ddd.toml": layoutConfig(mode), "Cargo.toml": LAYOUT_MANIFEST, ...workspace },
    expect: { pass: true, rules: [] },
  };
}

/** The verdict of the sensor entry and of the CI entry over the same project, as each reports it. */
function bothLayoutEntries(testCase: GoldenCase) {
  const sensor = spawnSensor(join(import.meta.dir, "../tools"), testCase);
  const project = layoutProject(testCase);
  try {
    const cli = runLayoutCli(join(import.meta.dir, "../tools"), project);
    return {
      sensor: { exitCode: sensor.exitCode, stderr: sensor.stderr, verdict: JSON.parse(sensor.stdout) },
      cli: { exitCode: cli.exitCode, stderr: cli.stderr, verdict: JSON.parse(cli.stdout) },
    };
  } finally {
    rmSync(project, { recursive: true, force: true });
  }
}

const located = (verdict: { findings?: { rule_id: string; file: string }[] }) =>
  (verdict.findings ?? []).map((entry) => [entry.rule_id, entry.file]);

test("a module declaration into an excluded directory is reported where the declaration is written", () => {
  const { sensor, cli } = bothLayoutEntries(
    scanScopeCase("scan-scope-outside", "file", {
      "src/lib.rs": 'mod invoice;\n#[path = "vendor/generated.rs"] mod generated;\n',
      "src/invoice.rs": "pub struct Invoice;\n",
      "src/vendor/generated.rs": "pub struct Generated;\n",
    }),
  );
  expect(sensor.exitCode, sensor.stderr).toBe(0);
  expect(sensor.verdict.pass).toBe(false);
  expect(cli.exitCode).toBe(1);
  expect(cli.verdict.pass).toBe(false);
  for (const verdict of [sensor.verdict, cli.verdict]) {
    // The file the declaration names is outside the inspected project, so nothing is reported on it.
    expect(located(verdict)).toEqual([["module-layout.unresolved", "src/lib.rs"]]);
    expect(verdict.findings[0].line).toBe(2);
    // The walk never asked about that file, which is a different fact from failing to read it.
    expect(verdict.findings[0].message).not.toContain("could not be parsed");
  }
});

test("a declaration naming a file the discovery does not collect is reported where it is written", () => {
  // The discovery collects the Rust sources among the entries it keeps, so the batch is gathered by
  // the `.rs` name as well as by the directory. Only the target's name differs from the case below,
  // which is what separates a declaration this walk may follow from one it may not.
  const { sensor, cli } = bothLayoutEntries(
    scanScopeCase("scan-scope-uncollected-name", "file", {
      "src/lib.rs": 'mod invoice;\n#[path = "generated.txt"] mod generated;\n',
      "src/invoice.rs": "pub struct Invoice;\n",
      "src/generated.txt": "pub struct Generated;\n",
    }),
  );
  expect(sensor.exitCode, sensor.stderr).toBe(0);
  expect(sensor.verdict.pass).toBe(false);
  expect(cli.exitCode).toBe(1);
  expect(cli.verdict.pass).toBe(false);
  for (const verdict of [sensor.verdict, cli.verdict]) {
    expect(located(verdict)).toEqual([["module-layout.unresolved", "src/lib.rs"]]);
    expect(verdict.findings[0].line).toBe(2);
    // That file was never handed to the extractor, so it is not reported as one it could not read.
    expect(verdict.findings[0].message).not.toContain("could not be parsed");
  }
});

test("the same declaration into an inspected directory resolves and is judged as before", () => {
  const { sensor, cli } = bothLayoutEntries(
    scanScopeCase("scan-scope-inside", "file", {
      "src/lib.rs": 'mod invoice;\n#[path = "billing/generated.rs"] mod generated;\n',
      "src/invoice.rs": "pub struct Invoice;\n",
      "src/billing/generated.rs": "pub struct Generated;\n",
    }),
  );
  expect(sensor.exitCode, sensor.stderr).toBe(0);
  expect(cli.exitCode, cli.stderr).toBe(0);
  for (const verdict of [sensor.verdict, cli.verdict]) {
    expect(located(verdict)).toEqual([]);
    expect(verdict.pass).toBe(true);
  }
});

test("a Cargo target root in an excluded directory is reported on the manifest that names it", () => {
  const { sensor, cli } = bothLayoutEntries(
    scanScopeCase("scan-scope-target-root", "file", {
      "Cargo.toml": `${LAYOUT_MANIFEST}\n[lib]\npath = "vendor/lib.rs"\n`,
      "vendor/lib.rs": "pub struct Generated;\n",
    }),
  );
  expect(sensor.exitCode, sensor.stderr).toBe(0);
  expect(cli.exitCode).toBe(1);
  for (const verdict of [sensor.verdict, cli.verdict]) {
    expect(located(verdict)).toEqual([["module-layout.unresolved", "Cargo.toml"]]);
    expect(verdict.findings[0].message).not.toContain("could not be parsed");
    expect(verdict.pass).toBe(false);
  }
});

test("a module whose declarations could not be read is reported once, not also on its placement", () => {
  const { sensor, cli } = bothLayoutEntries(
    scanScopeCase("scan-scope-unparsable-parent", "mod-rs", {
      "src/lib.rs": "mod invoice;\n",
      "src/invoice/mod.rs": "pub struct {\n",
    }),
  );
  expect(sensor.exitCode, sensor.stderr).toBe(0);
  expect(cli.exitCode).toBe(1);
  for (const verdict of [sensor.verdict, cli.verdict]) {
    // Whether this file declares a child is exactly what could not be read, so the mod-rs placement
    // rule has no input; reporting a violation too would answer a question the walk never settled.
    expect(located(verdict)).toEqual([["module-layout.unresolved", "src/invoice/mod.rs"]]);
    expect(verdict.pass).toBe(false);
  }
});
