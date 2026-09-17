/**
 * Migrating the DDD layer section of one `cicd-pipeline.md` from the Rust-only crate format to the
 * language-neutral one.
 *
 * The subject is the pipeline document, which survives preview -> apply -> re-read -> re-run, so
 * the sequence is observed on one workspace rather than on a fresh copy per condition. Only the
 * one YAML block below the DDD heading is the migration's to rewrite: the pipeline prose, the CI
 * configuration fence beside it and every other file in the workspace keep their bytes. What the
 * crate format never stated is reported as missing rather than filled in.
 */

import { expect, test } from "bun:test";
import { chmodSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import {
  applyLayerMigration,
  loadLayerDeclaration,
  previewLayerMigration,
  runLayerDeclarationCommand,
} from "../tools/ddd/lib/layer-declaration/index.ts";
import { parseDeclaration } from "../tools/ddd/lib/sensors/declaration.ts";
import { canonicalModelYaml, edit, modelDocument } from "./fixtures/aggregate-mapping/workspace.ts";
import {
  envelopeOf,
  FENCE_VARIANTS,
  snapshotBytes,
  without,
  withWorkspace,
} from "./fixtures/domain-model/workspace.ts";
import {
  DECLARATION_IN_RECORD,
  declarationDocument,
  declarationDocumentInJapanese,
  declarationDocumentWithBothHeadings,
  declarationDocumentWithDecoratedInfoString,
  declarationDocumentWithNestedBlockOnly,
  declarationDocumentWithoutBlock,
  declarationDocumentWithoutSection,
  declarationDocumentWithTwoBlocks,
  declarationDocumentWithUnclosedBlock,
  JAPANESE_HEADING,
  LAYER_HEADINGS,
  type LayerSource,
  layerSource,
  legacyLayerYaml,
  legacyLayerYamlWithoutStatedDefaults,
  MISSING_FROM_SILENT_LEGACY,
  MODEL_IN_RECORD,
  MODEL_REF,
  PERSISTENCE_BACKEND,
  PROSE_LEGACY_SPELLING,
  recordFiles,
  renderYaml,
  STRAY_DECLARATION_FILE,
  structureOf,
  USE_CASE_IN_RECORD,
  untouchableUserFiles,
} from "./fixtures/layer-declaration/workspace.ts";

const ENTRY_POINT = join(import.meta.dir, "../tools/ddd-layer-declaration.ts");
const LAYER_SENSOR = join(import.meta.dir, "../tools/ddd-sensor-layer-structure.ts");

type MigrationOutcome = ReturnType<typeof previewLayerMigration>;
type Finding = Extract<MigrationOutcome, { kind: "rejected" }>["findings"][number];

const RULE = {
  document: "layer-declaration.document",
  version: "layer-declaration.version",
  structure: "layer-declaration.structure",
  unknownKey: "layer-declaration.unknown-key",
  model: "layer-declaration.model",
  reference: "layer-declaration.reference",
} as const;

interface WorkspaceOptions {
  readonly declaration?: string;
  readonly modelVersion?: 1 | 2;
}

function legacyWorkspace(options: WorkspaceOptions = {}): Record<string, string> {
  return {
    ...recordFiles(options.declaration ?? declarationDocument(legacyLayerYaml()), {
      modelVersion: options.modelVersion ?? 2,
    }),
    ...untouchableUserFiles(),
  };
}

function declarationPathOf(root: string): string {
  return join(root, DECLARATION_IN_RECORD);
}

function readDocument(path: string): string {
  return readFileSync(path, "utf8");
}

function findingsOf(outcome: MigrationOutcome): readonly Finding[] {
  if (outcome.kind !== "rejected") throw new Error(`expected a refusal, got ${JSON.stringify(outcome)}`);
  expect(outcome.findings.length).toBeGreaterThan(0);
  return outcome.findings;
}

function run(argv: readonly string[]): { exitCode: number; report: Record<string, unknown> } {
  const result = runLayerDeclarationCommand(argv);
  return { exitCode: result.exitCode, report: JSON.parse(result.stdout) };
}

function verdictOf(declarationPath: string): { pass: boolean; findings: { rule_id: string }[] } {
  const spawned = Bun.spawnSync(
    [process.execPath, LAYER_SENSOR, "--stage", "infrastructure-design", "--output-path", declarationPath],
    { stdout: "pipe", stderr: "pipe" },
  );
  return JSON.parse(spawned.stdout.toString());
}

/** What the crate-fixed fixture says, stated in the language-neutral format. */
function expectedMigratedDeclaration(): LayerSource {
  return layerSource("rust");
}

// ---------------------------------------------------------------------------
// Preview and apply
// ---------------------------------------------------------------------------

test("a preview offers the candidate built from the crate-fixed declaration, and writes nothing", () => {
  withWorkspace(legacyWorkspace(), (root) => {
    const before = snapshotBytes(root);
    const outcome = previewLayerMigration(declarationPathOf(root));
    expect(outcome.kind).toBe("candidate");
    if (outcome.kind !== "candidate") return;

    expect(outcome.declaration).toEqual(expectedMigratedDeclaration() as unknown as typeof outcome.declaration);
    // A declared value that spells a legacy key is business wording, and comes through as written.
    expect(structureOf(outcome.declaration as unknown as LayerSource).persistence_backend).toBe(PERSISTENCE_BACKEND);

    expect(snapshotBytes(root)).toEqual(before);
  });
});

// The crate format never checked whether a crate a row depends on is listed on a side, and its rule
// against a query-side dependency on a domain crate judges that crate by its name alone.
test("a dependency on a crate no side list names comes through as an edge of the candidate", () => {
  const yaml = edit(
    legacyLayerYaml(),
    "      - { crate: billing-query, depends_on: [] }\n",
    "      - { crate: billing-query, depends_on: [billing-shared-domain] }\n",
  );
  withWorkspace(legacyWorkspace({ declaration: declarationDocument(yaml) }), (root) => {
    const before = snapshotBytes(root);
    const expected = expectedMigratedDeclaration();
    structureOf(expected).dependencies[1].depends_on.push({ language: "rust", package: "billing-shared-domain" });

    const outcome = previewLayerMigration(declarationPathOf(root));
    expect(outcome.kind).toBe("candidate");
    if (outcome.kind !== "candidate") return;
    expect(outcome.declaration).toEqual(expected as unknown as typeof outcome.declaration);

    expect(snapshotBytes(root)).toEqual(before);
  });
});

test("an apply rewrites only the one YAML block, and the document reads back as the previewed candidate", () => {
  withWorkspace(legacyWorkspace(), (root) => {
    const path = declarationPathOf(root);
    const before = snapshotBytes(root);
    const documentBefore = readDocument(path);

    const preview = previewLayerMigration(path);
    expect(preview.kind).toBe("candidate");
    if (preview.kind !== "candidate") return;
    const applied = applyLayerMigration(path);
    expect(applied.kind).toBe("applied");
    if (applied.kind !== "applied") return;
    expect(applied.declaration).toEqual(preview.declaration);

    const loaded = loadLayerDeclaration(path);
    expect(loaded.ok).toBe(true);
    if (!loaded.ok) return;
    expect(loaded.declaration).toEqual(preview.declaration);

    // The pipeline prose that spells the legacy keys, the CI configuration fence in the build
    // section, the fence delimiters and the Japanese table after the block keep every byte.
    expect(envelopeOf(readDocument(path), LAYER_HEADINGS)).toEqual(envelopeOf(documentBefore, LAYER_HEADINGS));
    expect(envelopeOf(readDocument(path), LAYER_HEADINGS).head).toContain(PROSE_LEGACY_SPELLING);
    expect(without(snapshotBytes(root), DECLARATION_IN_RECORD)).toEqual(without(before, DECLARATION_IN_RECORD));
    expect(snapshotBytes(root)[DECLARATION_IN_RECORD]).not.toBe(before[DECLARATION_IN_RECORD]);
  });
});

for (const [label, fence] of FENCE_VARIANTS)
  test(`an apply through ${label} replaces the same single block and nothing else`, () => {
    withWorkspace(legacyWorkspace({ declaration: declarationDocument(legacyLayerYaml(), fence) }), (root) => {
      const path = declarationPathOf(root);
      const before = snapshotBytes(root);
      const documentBefore = readDocument(path);

      expect(applyLayerMigration(path).kind).toBe("applied");

      expect(loadLayerDeclaration(path).ok).toBe(true);
      expect(envelopeOf(readDocument(path), LAYER_HEADINGS)).toEqual(envelopeOf(documentBefore, LAYER_HEADINGS));
      expect(without(snapshotBytes(root), DECLARATION_IN_RECORD)).toEqual(without(before, DECLARATION_IN_RECORD));
    });
  });

test("an apply under the Japanese section marker leaves the marker and the prose around it alone", () => {
  withWorkspace(legacyWorkspace({ declaration: declarationDocumentInJapanese(legacyLayerYaml()) }), (root) => {
    const path = declarationPathOf(root);
    const before = snapshotBytes(root);
    const documentBefore = readDocument(path);

    expect(applyLayerMigration(path).kind).toBe("applied");

    const after = readDocument(path);
    expect(after).toContain(`## ${JAPANESE_HEADING}`);
    expect(envelopeOf(after, LAYER_HEADINGS)).toEqual(envelopeOf(documentBefore, LAYER_HEADINGS));
    expect(without(snapshotBytes(root), DECLARATION_IN_RECORD)).toEqual(without(before, DECLARATION_IN_RECORD));
  });
});

test("one pipeline document carries preview, apply, re-read and re-run across the change", () => {
  withWorkspace(legacyWorkspace(), (root) => {
    const path = declarationPathOf(root);
    const before = snapshotBytes(root);

    expect(loadLayerDeclaration(path).ok).toBe(false);
    expect(previewLayerMigration(path).kind).toBe("candidate");
    expect(snapshotBytes(root)).toEqual(before);

    expect(applyLayerMigration(path).kind).toBe("applied");
    const afterApply = snapshotBytes(root);
    expect(afterApply[DECLARATION_IN_RECORD]).not.toBe(before[DECLARATION_IN_RECORD]);

    const loaded = loadLayerDeclaration(path);
    expect(loaded.ok).toBe(true);
    if (!loaded.ok) return;

    const again = previewLayerMigration(path);
    expect(again.kind).toBe("already-migrated");
    if (again.kind !== "already-migrated") return;
    expect(again.declaration).toEqual(loaded.declaration);
    expect(applyLayerMigration(path).kind).toBe("already-migrated");
    expect(snapshotBytes(root)).toEqual(afterApply);
  });
});

test("an already migrated document that no longer validates is refused rather than reported as done", () => {
  const broken = layerSource("rust");
  structureOf(broken).repositories[0].aggregate_ref = "aggregate.refund";
  withWorkspace(legacyWorkspace({ declaration: declarationDocument(renderYaml(broken)) }), (root) => {
    const path = declarationPathOf(root);
    const before = snapshotBytes(root);
    for (const outcome of [previewLayerMigration(path), applyLayerMigration(path)])
      expect(findingsOf(outcome).map((entry) => entry.rule_id)).toContain(RULE.reference);
    expect(snapshotBytes(root)).toEqual(before);
  });
});

// ---------------------------------------------------------------------------
// What the crate format never stated
// ---------------------------------------------------------------------------

test("values the crate-fixed reader supplied on its own are reported missing, and nothing is invented or written", () => {
  const silent = declarationDocument(legacyLayerYamlWithoutStatedDefaults());
  withWorkspace(legacyWorkspace({ declaration: silent }), (root) => {
    const path = declarationPathOf(root);
    const before = snapshotBytes(root);
    const expected = { kind: "missing-information" as const, missing: MISSING_FROM_SILENT_LEGACY };

    expect(previewLayerMigration(path)).toEqual(expected);
    expect(applyLayerMigration(path)).toEqual(expected);

    expect(snapshotBytes(root)).toEqual(before);
    expect(loadLayerDeclaration(path).ok).toBe(false);
  });
});

test("an empty verb list and a false cqrs flag the crate-fixed declaration states are carried over, not reported missing", () => {
  const stated = edit(
    edit(
      edit(legacyLayerYaml(), "    cqrs: true\n", "    cqrs: false\n"),
      "      - { name: InvoiceNumbering, kind: external-client, verbs: [next_number] }\n",
      "      - { name: InvoiceNumbering, kind: external-client, verbs: [] }\n",
    ),
    "io_unit: collection, verbs: [find_by_id, store], store_semantics: insert-only }",
    "io_unit: collection, verbs: [], store_semantics: insert-only }",
  );
  withWorkspace(legacyWorkspace({ declaration: declarationDocument(stated) }), (root) => {
    const before = snapshotBytes(root);
    const expected = expectedMigratedDeclaration();
    const structure = structureOf(expected);
    structure.cqrs = false;
    structure.ports[0].verbs = [];
    structure.repositories[1].verbs = [];

    const outcome = previewLayerMigration(declarationPathOf(root));
    expect(outcome.kind).toBe("candidate");
    if (outcome.kind !== "candidate") return;
    expect(outcome.declaration).toEqual(expected as unknown as typeof outcome.declaration);

    expect(snapshotBytes(root)).toEqual(before);
  });
});

test("a defect in what the crate-fixed declaration does state is reported ahead of what is still missing", () => {
  const broken = edit(
    legacyLayerYamlWithoutStatedDefaults(),
    "      - { name: InvoiceRepository, aggregate_ref: aggregate.invoice }",
    "      - { name: InvoiceRepository, aggregate_ref: aggregate.refund }",
  );
  withWorkspace(legacyWorkspace({ declaration: declarationDocument(broken) }), (root) => {
    const path = declarationPathOf(root);
    const before = snapshotBytes(root);
    for (const outcome of [previewLayerMigration(path), applyLayerMigration(path)]) {
      expect(outcome.kind).toBe("rejected");
      expect(findingsOf(outcome).map((entry) => entry.rule_id)).toContain(RULE.reference);
    }
    expect(snapshotBytes(root)).toEqual(before);
  });
});

test("a declaration whose canonical model has not been migrated yet is refused", () => {
  withWorkspace(legacyWorkspace({ modelVersion: 1 }), (root) => {
    const path = declarationPathOf(root);
    const before = snapshotBytes(root);
    for (const outcome of [previewLayerMigration(path), applyLayerMigration(path)])
      expect(findingsOf(outcome).map((entry) => entry.rule_id)).toContain(RULE.model);
    expect(snapshotBytes(root)).toEqual(before);
  });
});

// ---------------------------------------------------------------------------
// Documents the migration refuses, and never writes
// ---------------------------------------------------------------------------

const REFUSED_DOCUMENTS: readonly (readonly [string, string])[] = [
  ["carries no labelled YAML block in the section", declarationDocumentWithoutBlock()],
  ["carries two labelled YAML blocks in the section", declarationDocumentWithTwoBlocks(legacyLayerYaml())],
  ["never closes its YAML block", declarationDocumentWithUnclosedBlock(legacyLayerYaml())],
  ["only has a fence whose info string decorates yaml", declarationDocumentWithDecoratedInfoString(legacyLayerYaml())],
  ["only nests a declaration-shaped block inside prose", declarationDocumentWithNestedBlockOnly()],
  ["has no DDD layer section at all", declarationDocumentWithoutSection(legacyLayerYaml())],
  ["carries both section markers at once", declarationDocumentWithBothHeadings(legacyLayerYaml())],
  ["carries YAML that does not parse", declarationDocument("layer_structures:\n  - [")],
];

for (const [label, document] of REFUSED_DOCUMENTS)
  test(`a document that ${label} is refused by preview and apply alike, and nothing is written`, () => {
    withWorkspace(legacyWorkspace({ declaration: document }), (root) => {
      const path = declarationPathOf(root);
      const before = snapshotBytes(root);
      for (const outcome of [previewLayerMigration(path), applyLayerMigration(path)])
        expect(findingsOf(outcome).map((entry) => entry.rule_id)).toContain(RULE.document);
      expect(snapshotBytes(root)).toEqual(before);
    });
  });

test("a pipeline-named document outside the registered location is refused and left alone", () => {
  withWorkspace(legacyWorkspace(), (root) => {
    const path = join(root, STRAY_DECLARATION_FILE);
    const before = snapshotBytes(root);
    for (const outcome of [previewLayerMigration(path), applyLayerMigration(path)])
      expect(findingsOf(outcome).map((entry) => entry.rule_id)).toContain(RULE.document);
    expect(snapshotBytes(root)).toEqual(before);
  });
});

test("a record with no pipeline document is refused", () => {
  const files = legacyWorkspace();
  delete files[DECLARATION_IN_RECORD];
  withWorkspace(files, (root) => {
    expect(findingsOf(previewLayerMigration(declarationPathOf(root))).map((entry) => entry.rule_id)).toContain(
      RULE.document,
    );
  });
});

const LEGACY = legacyLayerYaml();

/** Crate-fixed content the production reader would silently coerce or drop, or does not accept. */
const REFUSED_LEGACY_CONTENT: readonly (readonly [string, string, string])[] = [
  [
    "a command side list written as one string",
    RULE.structure,
    edit(LEGACY, "    command_side_crates: [billing-domain]\n", "    command_side_crates: billing-domain\n"),
  ],
  ["a cqrs flag written as a string", RULE.structure, edit(LEGACY, "    cqrs: true\n", '    cqrs: "true"\n')],
  [
    "a crate name that is not a string",
    RULE.structure,
    edit(LEGACY, "      - { crate: billing-query, depends_on: [] }\n", "      - { crate: 42, depends_on: [] }\n"),
  ],
  [
    "a dependency target that is not a string",
    RULE.structure,
    edit(
      LEGACY,
      "      - { crate: billing-rmu, depends_on: [billing-domain, billing-query] }\n",
      "      - { crate: billing-rmu, depends_on: [billing-domain, 42] }\n",
    ),
  ],
  [
    "port verbs written as one string",
    RULE.structure,
    edit(
      LEGACY,
      "      - { name: InvoiceNumbering, kind: external-client, verbs: [next_number] }\n",
      "      - { name: InvoiceNumbering, kind: external-client, verbs: next_number }\n",
    ),
  ],
  [
    "store semantics that are not a string",
    RULE.structure,
    edit(LEGACY, "store_semantics: upsert }", "store_semantics: 42 }"),
  ],
  [
    "a structure key the crate-fixed reader ignores",
    RULE.unknownKey,
    edit(LEGACY, "    cqrs: true\n", "    cqrs: true\n    owner_team: 請求チーム\n"),
  ],
  [
    "a root key the crate-fixed reader ignores",
    RULE.unknownKey,
    edit(LEGACY, "layer_structures:\n", "notes: 移行前の記録\nlayer_structures:\n"),
  ],
  [
    "a dependency row key the crate-fixed reader ignores",
    RULE.unknownKey,
    edit(
      LEGACY,
      "      - { crate: billing-query, depends_on: [] }\n",
      "      - { crate: billing-query, depends_on: [], optional: true }\n",
    ),
  ],
  [
    "a port key the crate-fixed reader ignores",
    RULE.unknownKey,
    edit(
      LEGACY,
      "      - { name: InvoiceNumbering, kind: external-client, verbs: [next_number] }\n",
      "      - { name: InvoiceNumbering, kind: external-client, verbs: [next_number], since: v2 }\n",
    ),
  ],
  [
    "a repository key the crate-fixed reader ignores",
    RULE.unknownKey,
    edit(LEGACY, "store_semantics: upsert }", "store_semantics: upsert, table: invoices }"),
  ],
  [
    "a restoration path key the crate-fixed reader ignores",
    RULE.unknownKey,
    edit(
      LEGACY,
      "      - { aggregate_ref: aggregate.invoice, via: full-constructor }\n",
      "      - { aggregate_ref: aggregate.invoice, via: full-constructor, file: src/invoice.rs }\n",
    ),
  ],
  ["a version other than 1 or 2", RULE.version, edit(LEGACY, "schema_version: 1\n", "schema_version: 3\n")],
  ["no version at all", RULE.version, edit(LEGACY, "schema_version: 1\n", "")],
  // The crate format required the reference as well, so a declaration without one names no model to
  // validate against. That is a refusal, not one more value the migration could ask the team for.
  ["no model reference at all", RULE.structure, edit(LEGACY, `model_ref: ${MODEL_REF}\n`, "")],
];

for (const [label, rule, yaml] of REFUSED_LEGACY_CONTENT)
  test(`a crate-fixed declaration with ${label} is refused, and nothing is written`, () => {
    withWorkspace(legacyWorkspace({ declaration: declarationDocument(yaml) }), (root) => {
      const path = declarationPathOf(root);
      const before = snapshotBytes(root);
      for (const outcome of [previewLayerMigration(path), applyLayerMigration(path)])
        expect(findingsOf(outcome).map((entry) => entry.rule_id)).toContain(rule);
      expect(snapshotBytes(root)).toEqual(before);
    });
  });

// ---------------------------------------------------------------------------
// Failure never writes
// ---------------------------------------------------------------------------

test("an apply re-reads the document, so an earlier successful preview never authorises a later change", () => {
  withWorkspace(legacyWorkspace(), (root) => {
    const path = declarationPathOf(root);
    const original = readDocument(path);
    expect(previewLayerMigration(path).kind).toBe("candidate");

    writeFileSync(
      path,
      declarationDocument(
        edit(
          legacyLayerYaml(),
          "      - { aggregate_ref: aggregate.invoice, via: full-constructor }\n",
          "      - { aggregate_ref: aggregate.refund, via: full-constructor }\n",
        ),
      ),
    );
    const corrupted = snapshotBytes(root);
    expect(findingsOf(applyLayerMigration(path)).map((entry) => entry.rule_id)).toContain(RULE.reference);
    expect(snapshotBytes(root)).toEqual(corrupted);

    writeFileSync(path, declarationDocument(legacyLayerYamlWithoutStatedDefaults()));
    const silent = snapshotBytes(root);
    expect(applyLayerMigration(path)).toEqual({
      kind: "missing-information",
      missing: MISSING_FROM_SILENT_LEGACY,
    });
    expect(snapshotBytes(root)).toEqual(silent);

    writeFileSync(path, original);
    expect(applyLayerMigration(path).kind).toBe("applied");
  });
});

// Dropping write permission does nothing for a superuser, whose write succeeds regardless, so the
// test either observes the failure or does not run at all.
const RUNNING_AS_SUPERUSER = process.getuid?.() === 0;

test.skipIf(RUNNING_AS_SUPERUSER)(
  "a declaration that cannot be written is not reported as success and is left alone",
  () => {
    withWorkspace(legacyWorkspace(), (root) => {
      const path = declarationPathOf(root);
      const before = snapshotBytes(root);
      chmodSync(path, 0o444);
      try {
        expect(applyLayerMigration(path).kind).toBe("write-failed");
        expect(snapshotBytes(root)).toEqual(before);

        const { exitCode, report } = run(["migrate", "--declaration", path, "--apply"]);
        expect(exitCode).toBe(3);
        expect(report.outcome).toBe("write-failed");
        expect(typeof report.detail).toBe("string");
        expect(snapshotBytes(root)).toEqual(before);
      } finally {
        chmodSync(path, 0o644);
      }
    });
  },
);

// A registered path that is a symbolic link names a file kept somewhere else. Replacing the link
// with a regular file would detach that file silently, and writing through the link would rewrite a
// file outside the record, so the apply refuses and both keep their bytes.
test("a declaration document that is a symbolic link is refused, and neither the link nor the file it names is written", () => {
  withWorkspace(legacyWorkspace(), (root) => {
    const path = declarationPathOf(root);
    const target = join(root, STRAY_DECLARATION_FILE);
    rmSync(path);
    symlinkSync(target, path);
    const before = snapshotBytes(root);
    expect(before[DECLARATION_IN_RECORD]).toBe(`symlink:${target}`);

    expect(applyLayerMigration(path).kind).toBe("write-failed");
    expect(snapshotBytes(root)).toEqual(before);
  });
});

// Creating an entry beside the document needs write permission on its directory, which a superuser
// has regardless, so the test either observes the failure or does not run at all.
test.skipIf(RUNNING_AS_SUPERUSER)(
  "a declaration whose directory accepts no new entry is not reported as success and is left alone",
  () => {
    withWorkspace(legacyWorkspace(), (root) => {
      const path = declarationPathOf(root);
      const before = snapshotBytes(root);
      // The document itself stays writable: what the apply cannot do is create the entry it writes
      // the new document to before renaming it into place.
      chmodSync(dirname(path), 0o555);
      try {
        const { exitCode, report } = run(["migrate", "--declaration", path, "--apply"]);
        expect(exitCode).toBe(3);
        expect(report.outcome).toBe("write-failed");
        expect(typeof report.detail).toBe("string");
        expect(snapshotBytes(root)).toEqual(before);
      } finally {
        chmodSync(dirname(path), 0o755);
      }
    });
  },
);

// ---------------------------------------------------------------------------
// The use-case declaration beside it is neither read nor written
// ---------------------------------------------------------------------------

test("the use-case declaration is not a layer declaration, and an apply beside it leaves it untouched", () => {
  withWorkspace(legacyWorkspace(), (root) => {
    const useCasePath = join(root, USE_CASE_IN_RECORD);
    const before = snapshotBytes(root);
    for (const outcome of [previewLayerMigration(useCasePath), applyLayerMigration(useCasePath)])
      expect(findingsOf(outcome).map((entry) => entry.rule_id)).toContain(RULE.document);
    expect(snapshotBytes(root)).toEqual(before);

    expect(applyLayerMigration(declarationPathOf(root)).kind).toBe("applied");
    expect(snapshotBytes(root)[USE_CASE_IN_RECORD]).toBe(before[USE_CASE_IN_RECORD]);
    expect(parseDeclaration(useCasePath, "use-case-declarations").ok).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// The production gate keeps reading the crate-fixed format
// ---------------------------------------------------------------------------

test("the production layer gate reads the crate-fixed format and does not accept the migrated one", () => {
  withWorkspace(legacyWorkspace({ modelVersion: 1 }), (root) => {
    const path = declarationPathOf(root);
    expect(verdictOf(path).pass).toBe(true);

    // The team migrates the canonical model first; only then can the declaration follow.
    expect(previewLayerMigration(path).kind).toBe("rejected");
    writeFileSync(join(root, MODEL_IN_RECORD), modelDocument(canonicalModelYaml(2)));
    expect(applyLayerMigration(path).kind).toBe("applied");

    const migrated = verdictOf(path);
    expect(migrated.pass).toBe(false);
    expect(migrated.findings.map((entry) => entry.rule_id)).toContain("layer-structure.item");
  });
});

// ---------------------------------------------------------------------------
// Command
// ---------------------------------------------------------------------------

test("the command previews, applies and then reports that nothing is left to do", () => {
  withWorkspace(legacyWorkspace(), (root) => {
    const path = declarationPathOf(root);
    const before = snapshotBytes(root);

    const preview = run(["migrate", "--declaration", path]);
    expect(preview.exitCode).toBe(0);
    expect(preview.report.outcome).toBe("candidate");
    expect((preview.report.declaration as { schema_version: unknown }).schema_version).toBe(2);
    expect(snapshotBytes(root)).toEqual(before);

    const applied = run(["migrate", "--apply", "--declaration", path]);
    expect(applied.exitCode).toBe(0);
    expect(applied.report.outcome).toBe("applied");

    const again = run(["migrate", "--declaration", path, "--apply"]);
    expect(again.exitCode).toBe(0);
    expect(again.report.outcome).toBe("already-migrated");
  });
});

test("missing definitions exit 0 on preview and non-zero on apply", () => {
  withWorkspace(
    legacyWorkspace({ declaration: declarationDocument(legacyLayerYamlWithoutStatedDefaults()) }),
    (root) => {
      const path = declarationPathOf(root);
      const before = snapshotBytes(root);

      const preview = run(["migrate", "--declaration", path]);
      expect(preview.exitCode).toBe(0);
      expect(preview.report.outcome).toBe("missing-information");
      expect(preview.report.missing).toEqual(MISSING_FROM_SILENT_LEGACY);

      const applied = run(["migrate", "--declaration", path, "--apply"]);
      expect(applied.exitCode).toBe(1);
      expect(applied.report.outcome).toBe("missing-information");
      expect(applied.report.missing).toEqual(MISSING_FROM_SILENT_LEGACY);
      expect(snapshotBytes(root)).toEqual(before);
    },
  );
});

test("a refused document exits with the refusal status and names its findings", () => {
  withWorkspace(legacyWorkspace({ declaration: declarationDocumentWithoutBlock() }), (root) => {
    const { exitCode, report } = run(["migrate", "--declaration", declarationPathOf(root)]);
    expect(exitCode).toBe(1);
    expect(report.outcome).toBe("rejected");
    expect((report.findings as { rule_id: string }[]).map((entry) => entry.rule_id)).toContain(RULE.document);
  });
});

for (const [label, argv] of [
  ["no command at all", []],
  ["an unknown subcommand", ["convert", "--declaration", "c.md"]],
  ["an unknown option", ["migrate", "--declaration", "c.md", "--force"]],
  ["a missing declaration", ["migrate"]],
  ["a declaration option given without its value", ["migrate", "--declaration"]],
] as const)
  test(`the command refuses ${label} with the argument exit status`, () => {
    const { exitCode, report } = run(argv);
    expect(exitCode).toBe(2);
    expect(report.outcome).toBe("invalid-arguments");
  });

// Reading `--apply` as the value would drop the apply and leave a preview of a path that does not
// exist, which writes nothing and exits with the refusal status instead of the argument status.
test("a declaration option left without a value never swallows the apply flag after it", () => {
  withWorkspace(legacyWorkspace(), (root) => {
    const before = snapshotBytes(root);
    const { exitCode, report } = run(["migrate", "--declaration", "--apply"]);
    expect(exitCode).toBe(2);
    expect(report.outcome).toBe("invalid-arguments");
    expect(snapshotBytes(root)).toEqual(before);
  });
});

test("the shipped entry point runs on its own, with no production sensor switched over", () => {
  withWorkspace(legacyWorkspace(), (root) => {
    const before = snapshotBytes(root);
    const spawned = Bun.spawnSync(
      [process.execPath, ENTRY_POINT, "migrate", "--declaration", declarationPathOf(root)],
      {
        stdout: "pipe",
        stderr: "pipe",
      },
    );
    expect(spawned.exitCode).toBe(0);
    expect(JSON.parse(spawned.stdout.toString()).outcome).toBe("candidate");
    expect(snapshotBytes(root)).toEqual(before);
  });
});
