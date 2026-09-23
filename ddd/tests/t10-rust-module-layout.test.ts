import { expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { layoutConfig, MODULE_LAYOUT_CASES } from "./golden/module-layout/cases.ts";
import { runGoldenCase } from "./golden/runner.ts";

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
      const { initAnalyzer } = await import("../tools/ddd/lib/rust/analyzer.ts");
      const { checkModuleLayout } = await import("../tools/ddd/lib/module-layout/check.ts");
      const runtime = await initAnalyzer();
      if (scenario === "budget") {
        expect(() =>
          checkModuleLayout(runtime, root, () => {
            throw new Error("budget-exceeded");
          }),
        ).toThrow("budget-exceeded");
        return;
      }
      if (scenario === "no-project") {
        expect(checkModuleLayout(runtime, root)).toEqual({ findings: [], crates: 0, files: 0 });
      } else if (scenario === "no-targets") {
        writeFileSync(join(root, ".ddd.toml"), layoutConfig());
        writeFileSync(join(root, "Cargo.toml"), '[package]\nname="empty"\n');
        expect(
          checkModuleLayout(runtime, root).findings.some((entry) => entry.rule_id === "module-layout.unresolved"),
        ).toBe(true);
      } else if (scenario === "symlink") {
        const { symlinkSync } = await import("node:fs");
        writeFileSync(join(root, ".ddd.toml"), layoutConfig());
        symlinkSync(root, join(root, "recursive"));
        expect(
          checkModuleLayout(runtime, root).findings.some((entry) => entry.rule_id === "module-layout.unresolved"),
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

for (const layer of ["domain", "use-case", "interface-adapter", "rmu"] as const) {
  test(`${layer}: type resolution follows logical modules and ignores orphan files`, async () => {
    const root = mkdtempSync(join(tmpdir(), "ddd-logical-module-"));
    try {
      mkdirSync(join(root, "src/storage"), { recursive: true });
      writeFileSync(join(root, "src/lib.rs"), '#[path="storage/invoice.rs"] pub mod invoice;\n');
      writeFileSync(join(root, "src/storage/invoice.rs"), "pub struct Invoice;\n");
      writeFileSync(join(root, "src/orphan.rs"), "pub struct Orphan;\n");
      const { initAnalyzer } = await import("../tools/ddd/lib/rust/analyzer.ts");
      const { buildProgram, collectRustSources } = await import("../tools/ddd/lib/rules/rust/program.ts");
      const runtime = await initAnalyzer();
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
      // Module resolution is decided by the crate's own declarations, so this case reads the
      // program without the native facts rules (a) and (d) add.
      const program = buildProgram(runtime, collectRustSources(runtime, root, assignments), null);
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
    const { initAnalyzer } = await import("../tools/ddd/lib/rust/analyzer.ts");
    const { checkModuleLayout } = await import("../tools/ddd/lib/module-layout/check.ts");
    return checkModuleLayout(await initAnalyzer(), root);
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
    const { initAnalyzer } = await import("../tools/ddd/lib/rust/analyzer.ts");
    const { checkModuleLayout } = await import("../tools/ddd/lib/module-layout/check.ts");
    const { chmodSync } = await import("node:fs");
    writeFileSync(join(root, ".ddd.toml"), layoutConfig());
    mkdirSync(sealed, { recursive: true });
    chmodSync(sealed, 0o000);
    const runtime = await initAnalyzer();
    const result = checkModuleLayout(runtime, root);
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
