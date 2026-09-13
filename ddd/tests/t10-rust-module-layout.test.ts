import { expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { MODULE_LAYOUT_CASES } from "./golden/module-layout/cases.ts";
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
        writeFileSync(join(root, ".ddd.toml"), 'schema_version=1\n[rust]\nmodule_layout="file"\n');
        writeFileSync(join(root, "Cargo.toml"), '[package]\nname="empty"\n');
        expect(
          checkModuleLayout(runtime, root).findings.some((entry) => entry.rule_id === "module-layout.unresolved"),
        ).toBe(true);
      } else if (scenario === "symlink") {
        const { symlinkSync } = await import("node:fs");
        writeFileSync(join(root, ".ddd.toml"), 'schema_version=1\n[rust]\nmodule_layout="file"\n');
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
      const { buildProgram } = await import("../tools/ddd/lib/rules/rust/program.ts");
      const runtime = await initAnalyzer();
      const program = buildProgram(runtime, root, [
        {
          crate_name: "billing",
          path: ".",
          layer,
          layer_source: "suffix",
          cqrs_side: "none",
          cqrs_source: "none",
          is_composition_root: false,
          diagnostics: [],
          targets: [{ kind: "lib", name: "billing", src_path: "src/lib.rs" }],
        },
      ]);
      expect(program.resolveType("src/lib.rs", [], "crate::invoice::Invoice")?.key).toBe("billing::invoice::Invoice");
      expect(program.types.some((entry) => entry.name === "Orphan")).toBe(false);
      expect([...program.notes]).toEqual([]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
}
