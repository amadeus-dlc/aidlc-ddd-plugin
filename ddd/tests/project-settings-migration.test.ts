import { expect, test } from "bun:test";
import { readFileSync, symlinkSync } from "node:fs";
import { join } from "node:path";
import type {
  MigrationOutcome,
  ProjectSelection,
  TypeScriptSupplement,
} from "../tools/ddd/lib/project-settings/index.ts";
import { applyMigration, previewMigration, readProjectSettings } from "../tools/ddd/lib/project-settings/index.ts";
import {
  legacyDocument,
  modernDocument,
  snapshotBytes,
  untouchableUserFiles,
  withoutRootDocument,
  withWorkspace,
} from "./fixtures/project-settings/workspace.ts";

const LAYOUT_ENTRY_POINT = join(import.meta.dir, "../tools/ddd-check-rust-module-layout.ts");
const NOT_REQUESTED: TypeScriptSupplement = { kind: "not-requested" };
const requested = (moduleLayout: string | null, codeRepresentation: string | null): TypeScriptSupplement => ({
  kind: "requested",
  moduleLayout,
  codeRepresentation,
});

function rejectionOf(outcome: MigrationOutcome) {
  if (outcome.kind !== "rejected") throw new Error(`expected a rejection, received ${JSON.stringify(outcome)}`);
  return outcome.rejection;
}

for (const moduleLayout of ["file", "mod-rs"] as const)
  test(`a preview of the legacy ${moduleLayout} layout keeps its meaning and writes nothing`, () => {
    withWorkspace({ ".ddd.toml": legacyDocument(moduleLayout), ...untouchableUserFiles() }, (root) => {
      const before = snapshotBytes(root);
      expect(previewMigration(root, NOT_REQUESTED)).toEqual({
        kind: "candidate",
        candidate: { languages: ["rust"], rust: { moduleLayout }, typescript: null },
      });
      expect(snapshotBytes(root)).toEqual(before);
    });
  });

test("a TypeScript request without values reports what is missing and invents nothing", () => {
  withWorkspace({ ".ddd.toml": legacyDocument("mod-rs"), ...untouchableUserFiles() }, (root) => {
    const before = snapshotBytes(root);
    expect(previewMigration(root, requested(null, null))).toEqual({
      kind: "missing-information",
      missing: ["typescript.module_layout", "typescript.code_representation"],
    });
    expect(previewMigration(root, requested("index-file", null))).toEqual({
      kind: "missing-information",
      missing: ["typescript.code_representation"],
    });
    expect(previewMigration(root, requested(null, "companion"))).toEqual({
      kind: "missing-information",
      missing: ["typescript.module_layout"],
    });
    expect(snapshotBytes(root)).toEqual(before);
  });
});

test("a supplemented preview offers an applicable candidate", () => {
  withWorkspace({ ".ddd.toml": legacyDocument("mod-rs") }, (root) => {
    expect(previewMigration(root, requested("index-file", "companion"))).toEqual({
      kind: "candidate",
      candidate: {
        languages: ["rust", "typescript"],
        rust: { moduleLayout: "mod-rs" },
        typescript: { moduleLayout: "index-file", codeRepresentation: "companion" },
      },
    });
  });
});

for (const [label, supplement, subject] of [
  ["representation", requested("index-file", "record"), "typescript.code_representation"],
  ["layout", requested("barrel-file", "class"), "typescript.module_layout"],
] as const)
  test(`a supplement value outside the settings contract is refused on the ${label} axis`, () => {
    withWorkspace({ ".ddd.toml": legacyDocument() }, (root) => {
      const rejection = rejectionOf(previewMigration(root, supplement));
      expect(rejection.reason).toBe("unknown-key-or-value");
      expect(rejection.subject).toBe(subject);
    });
  });

for (const [label, document, reason] of [
  ["an unknown value", 'schema_version = 1\n[rust]\nmodule_layout = "auto"\n', "version-unknown"],
  ["an unknown version", 'schema_version = 5\n[rust]\nmodule_layout = "file"\n', "version-unknown"],
  ["broken syntax", "[", "malformed-syntax"],
] as const)
  test(`a legacy document with ${label} is refused instead of repaired`, () => {
    withWorkspace({ ".ddd.toml": document, ...untouchableUserFiles() }, (root) => {
      const before = snapshotBytes(root);
      expect(rejectionOf(previewMigration(root, NOT_REQUESTED)).reason).toBe(reason);
      expect(rejectionOf(applyMigration(root, NOT_REQUESTED)).reason).toBe(reason);
      expect(snapshotBytes(root)).toEqual(before);
    });
  });

test("a preview with no document at all is refused", () => {
  withWorkspace(untouchableUserFiles(), (root) => {
    expect(rejectionOf(previewMigration(root, NOT_REQUESTED)).reason).toBe("file-absent");
  });
});

test("one project directory carries preview, supplement, apply, re-read and re-run across the change", () => {
  withWorkspace({ ".ddd.toml": legacyDocument("mod-rs"), ...untouchableUserFiles() }, (root) => {
    const applied: ProjectSelection = {
      languages: ["rust", "typescript"],
      rust: { moduleLayout: "mod-rs" },
      typescript: { moduleLayout: "index-file", codeRepresentation: "companion" },
    };
    const before = snapshotBytes(root);

    expect(readProjectSettings(root)).toEqual({
      kind: "rejected",
      rejection: {
        reason: "legacy-modern-mixed",
        file: join(root, ".ddd.toml"),
        subject: null,
        missing: [],
        rejectedDocuments: [],
        detail: expect.any(String),
      },
    });
    expect(previewMigration(root, NOT_REQUESTED)).toEqual({
      kind: "candidate",
      candidate: { languages: ["rust"], rust: { moduleLayout: "mod-rs" }, typescript: null },
    });
    expect(previewMigration(root, requested("index-file", null)).kind).toBe("missing-information");
    expect(previewMigration(root, requested("index-file", "companion"))).toEqual({
      kind: "candidate",
      candidate: applied,
    });
    expect(rejectionOf(applyMigration(root, requested("index-file", "record"))).reason).toBe("unknown-key-or-value");
    expect(applyMigration(root, requested("index-file", null)).kind).toBe("missing-information");
    expect(snapshotBytes(root)).toEqual(before);

    expect(applyMigration(root, requested("index-file", "companion"))).toEqual({ kind: "applied", selection: applied });
    const afterApply = snapshotBytes(root);
    expect(afterApply[".ddd.toml"]).not.toBe(before[".ddd.toml"]);
    expect(withoutRootDocument(afterApply)).toEqual(withoutRootDocument(before));

    expect(readProjectSettings(root)).toEqual({ kind: "validated", selection: applied });
    expect(applyMigration(root, requested("index-file", "companion"))).toEqual({
      kind: "already-migrated",
      selection: applied,
    });
    expect(previewMigration(root, NOT_REQUESTED)).toEqual({ kind: "already-migrated", selection: applied });
    expect(snapshotBytes(root)).toEqual(afterApply);
  });
});

test("an applied document keeps the aggregate mapping and every other user file byte-identical", () => {
  const files = untouchableUserFiles();
  withWorkspace({ ".ddd.toml": legacyDocument(), ...files }, (root) => {
    expect(applyMigration(root, requested("named-file", "companion")).kind).toBe("applied");
    for (const [path, content] of Object.entries(files)) expect(readFileSync(join(root, path), "utf8")).toBe(content);
  });
});

test("a document that is already in the new format is left alone by an apply", () => {
  const document = modernDocument({ rust: { moduleLayout: "file" } });
  withWorkspace({ ".ddd.toml": document }, (root) => {
    expect(applyMigration(root, NOT_REQUESTED)).toEqual({
      kind: "already-migrated",
      selection: { languages: ["rust"], rust: { moduleLayout: "file" }, typescript: null },
    });
    expect(readFileSync(join(root, ".ddd.toml"), "utf8")).toBe(document);
  });
});

test("a write that cannot be performed is not reported as success and leaves nothing behind", () => {
  withWorkspace({ "source.toml": legacyDocument("mod-rs") }, (external) =>
    withWorkspace(untouchableUserFiles(), (root) => {
      symlinkSync(join(external, "source.toml"), join(root, ".ddd.toml"));
      const before = snapshotBytes(root);
      const outcome = applyMigration(root, NOT_REQUESTED);
      expect(outcome.kind).toBe("write-failed");
      expect(snapshotBytes(root)).toEqual(before);
      expect(readFileSync(join(external, "source.toml"), "utf8")).toBe(legacyDocument("mod-rs"));
    }),
  );
});

test("the current production layout entry point still does not accept the migrated document", () => {
  const verdict = (root: string): { mode?: string; findings?: { rule_id: string }[] } => {
    const spawned = Bun.spawnSync([process.execPath, LAYOUT_ENTRY_POINT, "--project", root], {
      stdout: "pipe",
      stderr: "pipe",
    });
    return JSON.parse(spawned.stdout.toString());
  };
  withWorkspace({ ".ddd.toml": legacyDocument(), ...untouchableUserFiles() }, (root) => {
    expect(verdict(root).mode).toBe("file");
    expect(applyMigration(root, NOT_REQUESTED).kind).toBe("applied");
    const migrated = verdict(root);
    expect(migrated.mode).toBeUndefined();
    expect((migrated.findings ?? []).map((entry) => entry.rule_id)).toContain("module-layout.configuration");
  });
});

test("a symbolic link planted at the previously predictable staging path is never written through", () => {
  withWorkspace({ "secret.txt": "owned by someone else\n" }, (external) =>
    withWorkspace({ ".ddd.toml": legacyDocument("mod-rs"), ...untouchableUserFiles() }, (root) => {
      // The staging name used to be derived from the process id, so anyone who could create entries
      // beside the document could aim the write at a file of their choosing. Nothing may reach it now.
      const predictable = join(root, `.ddd.toml.${process.pid}.staging`);
      symlinkSync(join(external, "secret.txt"), predictable);
      expect(applyMigration(root, NOT_REQUESTED).kind).toBe("applied");
      expect(readFileSync(join(external, "secret.txt"), "utf8")).toBe("owned by someone else\n");
      // The entry belongs to whoever placed it; a write that avoids it must not delete it either.
      expect(readFileSync(predictable, "utf8")).toBe("owned by someone else\n");
    }),
  );
});

test("an applied migration leaves no staging entry behind", () => {
  withWorkspace({ ".ddd.toml": legacyDocument("mod-rs"), ...untouchableUserFiles() }, (root) => {
    expect(applyMigration(root, NOT_REQUESTED).kind).toBe("applied");
    expect(Object.keys(snapshotBytes(root)).filter((path) => path.includes(".staging"))).toEqual([]);
  });
});
