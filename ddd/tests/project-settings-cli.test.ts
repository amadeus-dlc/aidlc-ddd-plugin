import { expect, test } from "bun:test";
import { readFileSync, symlinkSync } from "node:fs";
import { join } from "node:path";
import type { ProjectSelection } from "../tools/ddd/lib/project-settings/index.ts";
import { readProjectSettings, runProjectSettingsCommand } from "../tools/ddd/lib/project-settings/index.ts";
import {
  legacyDocument,
  snapshotBytes,
  untouchableUserFiles,
  withWorkspace,
} from "./fixtures/project-settings/workspace.ts";

const ENTRY_POINT = join(import.meta.dir, "../tools/ddd-project-settings.ts");

function run(argv: readonly string[]): { exitCode: number; report: Record<string, unknown> } {
  const result = runProjectSettingsCommand(argv);
  return { exitCode: result.exitCode, report: JSON.parse(result.stdout) };
}

test("a preview reports an applicable candidate without touching the project", () => {
  withWorkspace({ ".ddd.toml": legacyDocument("mod-rs"), ...untouchableUserFiles() }, (root) => {
    const before = snapshotBytes(root);
    const { exitCode, report } = run(["migrate", "--project", root]);
    expect(exitCode).toBe(0);
    expect(report.outcome).toBe("candidate");
    expect(report.selection).toEqual({ languages: ["rust"], rust: { moduleLayout: "mod-rs" }, typescript: null });
    expect(snapshotBytes(root)).toEqual(before);
  });
});

test("a preview that lacks a supplement reports the missing items and stays distinguishable from success", () => {
  withWorkspace({ ".ddd.toml": legacyDocument() }, (root) => {
    const { exitCode, report } = run(["migrate", "--project", root, "--typescript-layout", "index-file"]);
    expect(exitCode).toBe(0);
    expect(report.outcome).toBe("missing-information");
    expect(report.missing).toEqual(["typescript.code_representation"]);
    expect(run(["migrate", "--project", root]).report.outcome).toBe("candidate");
  });
});

test("an apply that lacks a supplement fails and changes nothing", () => {
  withWorkspace({ ".ddd.toml": legacyDocument(), ...untouchableUserFiles() }, (root) => {
    const before = snapshotBytes(root);
    const { exitCode, report } = run(["migrate", "--project", root, "--typescript-representation", "class", "--apply"]);
    expect(exitCode).toBe(1);
    expect(report.outcome).toBe("missing-information");
    expect(report.missing).toEqual(["typescript.module_layout"]);
    expect(snapshotBytes(root)).toEqual(before);
  });
});

test("an explicit apply writes once and a re-run reports that nothing is left to do", () => {
  const selection: ProjectSelection = {
    languages: ["rust", "typescript"],
    rust: { moduleLayout: "file" },
    typescript: { moduleLayout: "named-file", codeRepresentation: "class" },
  };
  const argv = (root: string) => [
    "migrate",
    "--project",
    root,
    "--typescript-layout",
    "named-file",
    "--typescript-representation",
    "class",
    "--apply",
  ];
  withWorkspace({ ".ddd.toml": legacyDocument(), ...untouchableUserFiles() }, (root) => {
    const applied = run(argv(root));
    expect(applied.exitCode).toBe(0);
    expect(applied.report.outcome).toBe("applied");
    expect(applied.report.selection).toEqual(selection);
    expect(readProjectSettings(root)).toEqual({ kind: "validated", selection });

    const document = readFileSync(join(root, ".ddd.toml"), "utf8");
    const again = run(argv(root));
    expect(again.exitCode).toBe(0);
    expect(again.report.outcome).toBe("already-migrated");
    expect(readFileSync(join(root, ".ddd.toml"), "utf8")).toBe(document);
  });
});

test("a project without a document is refused with its reason", () => {
  withWorkspace(untouchableUserFiles(), (root) => {
    const { exitCode, report } = run(["migrate", "--project", root]);
    expect(exitCode).toBe(1);
    expect(report.outcome).toBe("rejected");
    expect(report.reason).toBe("file-absent");
  });
});

for (const [label, argv] of [
  ["an unknown flag", ["migrate", "--project", ".", "--force"]],
  ["a missing project", ["migrate"]],
  ["an unknown subcommand", ["convert", "--project", "."]],
  ["a flag given without its value", ["migrate", "--project"]],
] as const)
  test(`refuses ${label} with the argument exit status`, () => {
    const { exitCode, report } = run(argv);
    expect(exitCode).toBe(2);
    expect(report.outcome).toBe("invalid-arguments");
  });

test("a write that cannot be performed is reported with its own status", () => {
  withWorkspace({ "source.toml": legacyDocument() }, (external) =>
    withWorkspace(untouchableUserFiles(), (root) => {
      symlinkSync(join(external, "source.toml"), join(root, ".ddd.toml"));
      const before = snapshotBytes(root);
      const { exitCode, report } = run(["migrate", "--project", root, "--apply"]);
      expect(exitCode).toBe(3);
      expect(report.outcome).toBe("write-failed");
      expect(snapshotBytes(root)).toEqual(before);
    }),
  );
});

test("the shipped entry point runs on its own", () => {
  withWorkspace({ ".ddd.toml": legacyDocument("mod-rs") }, (root) => {
    const preview = Bun.spawnSync([process.execPath, ENTRY_POINT, "migrate", "--project", root], {
      stdout: "pipe",
      stderr: "pipe",
    });
    expect(preview.exitCode).toBe(0);
    expect(JSON.parse(preview.stdout.toString()).outcome).toBe("candidate");
  });
  withWorkspace({}, (root) => {
    const refused = Bun.spawnSync([process.execPath, ENTRY_POINT, "migrate", "--project", root], {
      stdout: "pipe",
      stderr: "pipe",
    });
    expect(refused.exitCode).toBe(1);
    expect(JSON.parse(refused.stdout.toString())).toMatchObject({ outcome: "rejected", reason: "file-absent" });
  });
});

test("an option left without a value never swallows the flag that follows it", () => {
  withWorkspace({ ".ddd.toml": legacyDocument("mod-rs"), ...untouchableUserFiles() }, (root) => {
    const before = snapshotBytes(root);
    // `--apply` is not a layout, so reading it as one would drop the apply and leave a preview that
    // writes nothing and still exits 0 — a caller reading the exit status alone would call that done.
    const { exitCode, report } = run(["migrate", "--project", root, "--typescript-layout", "--apply"]);
    expect(exitCode).toBe(2);
    expect(report.outcome).toBe("invalid-arguments");
    expect(report.detail).toContain("--typescript-layout needs a value");
    expect(snapshotBytes(root)).toEqual(before);
  });
});

test("a complete supplement still applies once the value is spelled out", () => {
  withWorkspace({ ".ddd.toml": legacyDocument("mod-rs"), ...untouchableUserFiles() }, (root) => {
    const { exitCode, report } = run([
      "migrate",
      "--project",
      root,
      "--typescript-layout",
      "named-file",
      "--typescript-representation",
      "class",
      "--apply",
    ]);
    expect(exitCode).toBe(0);
    expect(report.outcome).toBe("applied");
    expect(readFileSync(join(root, ".ddd.toml"), "utf8")).toContain('module_layout = "named-file"');
  });
});
