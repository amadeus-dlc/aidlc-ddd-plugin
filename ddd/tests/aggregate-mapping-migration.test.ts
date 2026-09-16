/**
 * Migrating one ddd-aggregate-mapping.md from the Rust-only crate/module format to the
 * language-neutral one.
 *
 * The subject is the mapping document, which survives preview -> apply -> re-read -> re-run, so
 * the sequence is observed on one workspace rather than on a fresh copy per condition. What the
 * legacy format has no place for (type, operation and error-case names) arrives only through an
 * explicit supplement file; nothing is derived from the model's names.
 */

import { expect, test } from "bun:test";
import { chmodSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import {
  applyMappingMigration,
  loadAggregateMapping,
  previewMappingMigration,
  runAggregateMappingCommand,
} from "../tools/ddd/lib/aggregate-mapping/index.ts";
import {
  canonicalModelYaml,
  edit,
  LEGACY_INVOICE_RATIONALE,
  LEGACY_INVOICE_TERM,
  legacyMappingYaml,
  MAPPING_IN_RECORD,
  MODEL_IN_RECORD,
  MODEL_REF,
  mappingDocument,
  mappingDocumentWithDecoratedInfoString,
  mappingDocumentWithoutBlock,
  mappingDocumentWithTwoBlocks,
  mappingDocumentWithUnclosedBlock,
  mappingSource,
  modelDocument,
  type OperationSource,
  recordFiles,
  renderYaml,
  STRAY_MAPPING_FILE,
  SUPPLEMENT_FILE,
  type SupplementAggregate,
  type SupplementSource,
  supplementSource,
  untouchableUserFiles,
} from "./fixtures/aggregate-mapping/workspace.ts";
import {
  envelopeOf,
  FENCE_VARIANTS,
  snapshotBytes,
  without,
  withWorkspace,
} from "./fixtures/domain-model/workspace.ts";

const ENTRY_POINT = join(import.meta.dir, "../tools/ddd-aggregate-mapping.ts");
const MAPPING_SENSOR = join(import.meta.dir, "../tools/ddd-sensor-mapping-declarations.ts");

type MigrationOutcome = ReturnType<typeof previewMappingMigration>;
type Finding = Extract<MigrationOutcome, { kind: "rejected" }>["findings"][number];

const RULE = {
  document: "aggregate-mapping.document",
  version: "aggregate-mapping.version",
  structure: "aggregate-mapping.structure",
  unknownKey: "aggregate-mapping.unknown-key",
  model: "aggregate-mapping.model",
  reference: "aggregate-mapping.reference",
  ownerMismatch: "aggregate-mapping.owner-mismatch",
  duplicate: "aggregate-mapping.duplicate",
} as const;

/** Everything the legacy format cannot say, named where it belongs, in document then model order. */
const MISSING_WITHOUT_SUPPLEMENT = [
  "aggregate_mappings[aggregate.invoice].code.type",
  "aggregate_mappings[aggregate.invoice].operations[command.invoice.issue]",
  "aggregate_mappings[aggregate.invoice].operations[command.invoice.cancel]",
  "aggregate_mappings[aggregate.invoice].operations[factory.invoice.open]",
  "aggregate_mappings[aggregate.payment].code.type",
  "aggregate_mappings[aggregate.payment].operations[command.payment.settle]",
];

const rustAt = (module: string[]) => ({ language: "rust", package: "billing-domain", module });

function supplementRow(source: SupplementSource, index: number): SupplementAggregate {
  const row = source.aggregate_mappings[index];
  if (row === undefined) throw new Error(`the supplement fixture has no row ${index}`);
  return row;
}

function supplementOperations(source: SupplementSource, index: number): OperationSource[] {
  const operations = supplementRow(source, index).operations;
  if (operations === undefined) throw new Error(`the supplement fixture row ${index} lists its operations`);
  return operations;
}

/**
 * The candidate the legacy fixture and the full supplement describe. Module spellings lose only
 * their `::` separators and a leading `crate`; every business value, including the Japanese
 * wording that spells legacy keys, arrives unchanged; the code names are the supplement's own.
 */
function expectedMigratedMapping() {
  const supplement = supplementSource();
  return {
    schema_version: 2,
    model_ref: MODEL_REF,
    aggregate_mappings: [
      {
        aggregate_ref: "aggregate.invoice",
        programming_model: "class",
        persistence_method: "event-sourcing",
        reference_ids: ["entity.invoice", "invariant.invoice.total-positive"],
        replay_methods: [{ event_ref: "event.invoice.issued", code: { method: "apply_issued" } }],
        code: {
          ...rustAt(["invoice"]),
          type: "BillingInvoice",
          ports: ["InvoiceNumbering", "TaxRates"],
          repository: "InvoiceRepository",
        },
        operations: supplementOperations(supplement, 0),
      },
      {
        aggregate_ref: "aggregate.payment",
        programming_model: "actor",
        persistence_method: "state-sourcing",
        reference_ids: ["entity.payment"],
        code: { ...rustAt(["payment"]), type: "PaymentRecord", repository: "PaymentRepository" },
        operations: supplementOperations(supplement, 1),
      },
    ],
    domain_packages: [
      { term: "請求", model_refs: ["bc.billing"], rationale: "請求の業務全体を所有する", code: rustAt([]) },
      {
        term: LEGACY_INVOICE_TERM,
        model_refs: ["aggregate.invoice"],
        rationale: LEGACY_INVOICE_RATIONALE,
        code: rustAt(["invoice"]),
      },
      {
        term: "請求書番号",
        model_refs: ["entity.invoice"],
        rationale: "請求書番号の採番規則をまとめる",
        code: rustAt(["invoice", "number"]),
      },
      { term: "請求種別", model_refs: ["bc.billing"], rationale: "請求の種別を区別する", code: rustAt(["r#type"]) },
      { term: "入金", model_refs: ["aggregate.payment"], rationale: "入金の消し込みを扱う", code: rustAt(["payment"]) },
    ],
  };
}

interface WorkspaceOptions {
  readonly mapping?: string;
  readonly modelVersion?: 1 | 2;
  /** `null` leaves the supplement file out of the workspace. */
  readonly supplement?: string | null;
}

function legacyWorkspace(options: WorkspaceOptions = {}): Record<string, string> {
  const files: Record<string, string> = {
    ...recordFiles(options.mapping ?? mappingDocument(legacyMappingYaml()), {
      modelVersion: options.modelVersion ?? 2,
    }),
    ...untouchableUserFiles(),
  };
  if (options.supplement !== null) files[SUPPLEMENT_FILE] = options.supplement ?? renderYaml(supplementSource());
  return files;
}

function mappingPathOf(root: string): string {
  return join(root, MAPPING_IN_RECORD);
}

function supplementPathOf(root: string): string {
  return join(root, SUPPLEMENT_FILE);
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
  const result = runAggregateMappingCommand(argv);
  return { exitCode: result.exitCode, report: JSON.parse(result.stdout) };
}

function verdictOf(mappingPath: string): { pass: boolean; findings: { rule_id: string }[] } {
  const spawned = Bun.spawnSync(
    [process.execPath, MAPPING_SENSOR, "--stage", "domain-design", "--output-path", mappingPath],
    { stdout: "pipe", stderr: "pipe" },
  );
  return JSON.parse(spawned.stdout.toString());
}

// ---------------------------------------------------------------------------
// Preview and apply
// ---------------------------------------------------------------------------

test("a preview offers the candidate built from the legacy document and the supplement, and writes nothing", () => {
  withWorkspace(legacyWorkspace(), (root) => {
    const before = snapshotBytes(root);
    const outcome = previewMappingMigration(mappingPathOf(root), supplementPathOf(root));
    expect(outcome.kind).toBe("candidate");
    if (outcome.kind !== "candidate") return;

    expect(outcome.mapping).toMatchObject(expectedMigratedMapping());
    // The payment mapping declared no replay methods and no ports; none are invented for it.
    const payment = outcome.mapping.aggregate_mappings[1];
    expect(payment.replay_methods).toEqual([]);
    expect(payment.code.ports).toEqual([]);

    expect(snapshotBytes(root)).toEqual(before);
  });
});

test("an apply rewrites only the one YAML block, and the document reads back as the previewed candidate", () => {
  withWorkspace(legacyWorkspace(), (root) => {
    const path = mappingPathOf(root);
    const before = snapshotBytes(root);
    const documentBefore = readDocument(path);

    const preview = previewMappingMigration(path, supplementPathOf(root));
    expect(preview.kind).toBe("candidate");
    if (preview.kind !== "candidate") return;
    const applied = applyMappingMigration(path, supplementPathOf(root));
    expect(applied.kind).toBe("applied");
    if (applied.kind !== "applied") return;
    expect(applied.mapping).toEqual(preview.mapping);

    const loaded = loadAggregateMapping(path);
    expect(loaded.ok).toBe(true);
    if (!loaded.ok) return;
    expect(loaded.mapping).toEqual(preview.mapping);

    // The prose that spells `module: crate` and `crate::invoice`, the nested mapping-shaped fence
    // and the Japanese table after the block keep every byte.
    expect(envelopeOf(readDocument(path))).toEqual(envelopeOf(documentBefore));
    expect(without(snapshotBytes(root), MAPPING_IN_RECORD)).toEqual(without(before, MAPPING_IN_RECORD));
    expect(snapshotBytes(root)[MAPPING_IN_RECORD]).not.toBe(before[MAPPING_IN_RECORD]);
  });
});

for (const [label, fence] of FENCE_VARIANTS)
  test(`an apply through ${label} replaces the same single block and nothing else`, () => {
    withWorkspace(legacyWorkspace({ mapping: mappingDocument(legacyMappingYaml(), fence) }), (root) => {
      const path = mappingPathOf(root);
      const before = snapshotBytes(root);
      const documentBefore = readDocument(path);

      expect(applyMappingMigration(path, supplementPathOf(root)).kind).toBe("applied");

      expect(loadAggregateMapping(path).ok).toBe(true);
      expect(envelopeOf(readDocument(path))).toEqual(envelopeOf(documentBefore));
      expect(without(snapshotBytes(root), MAPPING_IN_RECORD)).toEqual(without(before, MAPPING_IN_RECORD));
    });
  });

test("one mapping document carries preview, apply, re-read and re-run across the change", () => {
  withWorkspace(legacyWorkspace(), (root) => {
    const path = mappingPathOf(root);
    const supplement = supplementPathOf(root);
    const before = snapshotBytes(root);

    expect(loadAggregateMapping(path).ok).toBe(false);
    expect(previewMappingMigration(path, supplement).kind).toBe("candidate");
    expect(snapshotBytes(root)).toEqual(before);

    expect(applyMappingMigration(path, supplement).kind).toBe("applied");
    const afterApply = snapshotBytes(root);
    expect(afterApply[MAPPING_IN_RECORD]).not.toBe(before[MAPPING_IN_RECORD]);

    const loaded = loadAggregateMapping(path);
    expect(loaded.ok).toBe(true);
    if (!loaded.ok) return;

    const again = previewMappingMigration(path, supplement);
    expect(again.kind).toBe("already-migrated");
    if (again.kind !== "already-migrated") return;
    expect(again.mapping).toEqual(loaded.mapping);
    expect(applyMappingMigration(path, supplement).kind).toBe("already-migrated");
    // A migrated document needs no supplement: leaving it out, or naming a file that does not
    // exist, does not change the outcome.
    expect(applyMappingMigration(path, null).kind).toBe("already-migrated");
    expect(applyMappingMigration(path, join(root, "absent-supplement.yaml")).kind).toBe("already-migrated");
    expect(snapshotBytes(root)).toEqual(afterApply);
  });
});

test("an already migrated document that no longer validates is refused rather than reported as done", () => {
  const broken = mappingSource("rust");
  broken.aggregate_mappings[0].reference_ids.push("entity.refund");
  withWorkspace(legacyWorkspace({ mapping: mappingDocument(renderYaml(broken)) }), (root) => {
    const path = mappingPathOf(root);
    const before = snapshotBytes(root);
    for (const outcome of [previewMappingMigration(path, null), applyMappingMigration(path, null)])
      expect(findingsOf(outcome).map((entry) => entry.rule_id)).toContain(RULE.reference);
    expect(snapshotBytes(root)).toEqual(before);
  });
});

// ---------------------------------------------------------------------------
// What the legacy format cannot say
// ---------------------------------------------------------------------------

test("without a supplement the type and every operation are reported missing, and nothing is invented or written", () => {
  withWorkspace(legacyWorkspace({ supplement: null }), (root) => {
    const path = mappingPathOf(root);
    const before = snapshotBytes(root);
    const expected = { kind: "missing-information" as const, missing: MISSING_WITHOUT_SUPPLEMENT };

    expect(previewMappingMigration(path, null)).toEqual(expected);
    expect(applyMappingMigration(path, null)).toEqual(expected);

    expect(snapshotBytes(root)).toEqual(before);
    expect(loadAggregateMapping(path).ok).toBe(false);
  });
});

test("a supplement that leaves out one error case and one type gets exactly those two reported", () => {
  const partial = supplementSource();
  supplementOperations(partial, 0)[0].errors.splice(1, 1);
  delete supplementRow(partial, 1).code;
  withWorkspace(legacyWorkspace({ supplement: renderYaml(partial) }), (root) => {
    const path = mappingPathOf(root);
    const before = snapshotBytes(root);
    const expected = {
      kind: "missing-information" as const,
      missing: [
        "aggregate_mappings[aggregate.invoice].operations[command.invoice.issue].errors[error.invoice.issue.empty-lines]",
        "aggregate_mappings[aggregate.payment].code.type",
      ],
    };

    expect(previewMappingMigration(path, supplementPathOf(root))).toEqual(expected);
    expect(applyMappingMigration(path, supplementPathOf(root))).toEqual(expected);
    expect(snapshotBytes(root)).toEqual(before);
  });
});

test("a defect in the legacy document is reported ahead of what a supplement would still have to add", () => {
  const broken = edit(
    legacyMappingYaml(),
    "    reference_ids: [entity.payment]\n",
    "    reference_ids: [entity.payment, entity.refund]\n",
  );
  withWorkspace(legacyWorkspace({ mapping: mappingDocument(broken) }), (root) => {
    const path = mappingPathOf(root);
    const before = snapshotBytes(root);
    // Nothing is written by any of these, so the order they are run in does not matter.
    const withSupplement = applyMappingMigration(path, supplementPathOf(root));
    for (const outcome of [previewMappingMigration(path, null), applyMappingMigration(path, null), withSupplement])
      expect(findingsOf(outcome).map((entry) => entry.rule_id)).toContain(RULE.reference);

    // The broken reference is the legacy document's own, so it names that document even when the
    // names beside it were read from a supplement.
    const brokenReferences = findingsOf(withSupplement).filter(
      (entry) => entry.rule_id === RULE.reference && entry.message.includes("entity.refund"),
    );
    expect(brokenReferences.length).toBeGreaterThan(0);
    expect(brokenReferences.every((entry) => entry.file === path)).toBe(true);

    expect(snapshotBytes(root)).toEqual(before);
  });
});

test("a legacy mapping whose canonical model has not been migrated yet is refused", () => {
  withWorkspace(legacyWorkspace({ modelVersion: 1 }), (root) => {
    const path = mappingPathOf(root);
    const before = snapshotBytes(root);
    for (const outcome of [
      previewMappingMigration(path, supplementPathOf(root)),
      applyMappingMigration(path, supplementPathOf(root)),
    ])
      expect(findingsOf(outcome).map((entry) => entry.rule_id)).toContain(RULE.model);
    expect(snapshotBytes(root)).toEqual(before);
  });
});

const SUPPLEMENT_REFUSALS: readonly (readonly [string, string, string | null])[] = [
  ["a supplement file that does not exist", RULE.document, null],
  ["a supplement that does not parse", RULE.document, "aggregate_mappings:\n  - ["],
  [
    "a supplement with a key besides aggregate_mappings",
    RULE.unknownKey,
    renderYaml({ ...supplementSource(), domain_packages: [] }),
  ],
  [
    "a supplement row that tries to set the programming model",
    RULE.unknownKey,
    (() => {
      const source = supplementSource();
      Object.assign(supplementRow(source, 0), { programming_model: "actor" });
      return renderYaml(source);
    })(),
  ],
  [
    "a supplement row that tries to move the aggregate to another package",
    RULE.unknownKey,
    (() => {
      const source = supplementSource();
      Object.assign(supplementRow(source, 0), { code: { type: "BillingInvoice", package: "other-domain" } });
      return renderYaml(source);
    })(),
  ],
  [
    "a supplement row for an aggregate the legacy mapping does not map",
    RULE.structure,
    (() => {
      const source = supplementSource();
      source.aggregate_mappings.push({ aggregate_ref: "aggregate.ledger", code: { type: "Ledger" }, operations: [] });
      return renderYaml(source);
    })(),
  ],
  [
    "a supplement row without its aggregate",
    RULE.structure,
    (() => {
      const source = supplementSource();
      delete (supplementRow(source, 1) as unknown as Record<string, unknown>).aggregate_ref;
      return renderYaml(source);
    })(),
  ],
  [
    "a supplement method name that is not a Rust identifier",
    RULE.structure,
    (() => {
      const source = supplementSource();
      supplementOperations(source, 0)[0].code.method = "issue-invoice";
      return renderYaml(source);
    })(),
  ],
  [
    "a supplement that lists one aggregate twice",
    RULE.duplicate,
    (() => {
      const source = supplementSource();
      source.aggregate_mappings.push(structuredClone(supplementRow(source, 1)));
      return renderYaml(source);
    })(),
  ],
];

for (const [label, rule, supplement] of SUPPLEMENT_REFUSALS)
  test(`${label} is refused against the supplement file, and nothing is written`, () => {
    withWorkspace(legacyWorkspace({ supplement }), (root) => {
      const path = mappingPathOf(root);
      const supplementPath = supplementPathOf(root);
      const before = snapshotBytes(root);
      for (const outcome of [
        previewMappingMigration(path, supplementPath),
        applyMappingMigration(path, supplementPath),
      ]) {
        const matching = findingsOf(outcome).filter((entry) => entry.rule_id === rule);
        expect(matching.length).toBeGreaterThan(0);
        expect(matching.every((entry) => entry.file === supplementPath)).toBe(true);
      }
      expect(snapshotBytes(root)).toEqual(before);
    });
  });

test("a supplement that gives an operation an error another operation owns is refused", () => {
  const source = supplementSource();
  supplementOperations(source, 0)[0].errors.push({
    error_ref: "error.invoice.cancel.already-cancelled",
    code: { case: "CancelledElsewhere" },
  });
  withWorkspace(legacyWorkspace({ supplement: renderYaml(source) }), (root) => {
    const path = mappingPathOf(root);
    const before = snapshotBytes(root);
    for (const outcome of [
      previewMappingMigration(path, supplementPathOf(root)),
      applyMappingMigration(path, supplementPathOf(root)),
    ]) {
      const findings = findingsOf(outcome);
      expect(findings.map((entry) => entry.rule_id)).toContain(RULE.ownerMismatch);
      // The error case is one the supplement wrote, so the finding names the supplement and not the
      // legacy document the rest of the mapping was read from.
      const mismatches = findings.filter((entry) => entry.rule_id === RULE.ownerMismatch);
      expect(mismatches.every((entry) => entry.file === supplementPathOf(root))).toBe(true);
    }
    expect(snapshotBytes(root)).toEqual(before);
  });
});

// ---------------------------------------------------------------------------
// Legacy documents the migration refuses
// ---------------------------------------------------------------------------

const REFUSED_DOCUMENTS: readonly (readonly [string, string])[] = [
  ["carries no labelled YAML block", mappingDocumentWithoutBlock()],
  ["carries two labelled YAML blocks", mappingDocumentWithTwoBlocks(legacyMappingYaml())],
  ["never closes its YAML block", mappingDocumentWithUnclosedBlock(legacyMappingYaml())],
  ["only has a fence whose info string decorates yaml", mappingDocumentWithDecoratedInfoString(legacyMappingYaml())],
  ["carries YAML that does not parse", mappingDocument("aggregate_mappings:\n  - [")],
];

for (const [label, document] of REFUSED_DOCUMENTS)
  test(`a document that ${label} is refused by preview and apply alike, and nothing is written`, () => {
    withWorkspace(legacyWorkspace({ mapping: document }), (root) => {
      const path = mappingPathOf(root);
      const before = snapshotBytes(root);
      for (const outcome of [
        previewMappingMigration(path, supplementPathOf(root)),
        applyMappingMigration(path, supplementPathOf(root)),
      ])
        expect(findingsOf(outcome).map((entry) => entry.rule_id)).toContain(RULE.document);
      expect(snapshotBytes(root)).toEqual(before);
    });
  });

test("a mapping-named document outside the registered location is refused and left alone", () => {
  withWorkspace(legacyWorkspace(), (root) => {
    const path = join(root, STRAY_MAPPING_FILE);
    const before = snapshotBytes(root);
    for (const outcome of [
      previewMappingMigration(path, supplementPathOf(root)),
      applyMappingMigration(path, supplementPathOf(root)),
    ])
      expect(findingsOf(outcome).map((entry) => entry.rule_id)).toContain(RULE.document);
    expect(snapshotBytes(root)).toEqual(before);
  });
});

test("a record with no mapping document is refused", () => {
  const files = legacyWorkspace();
  delete files[MAPPING_IN_RECORD];
  withWorkspace(files, (root) => {
    expect(
      findingsOf(previewMappingMigration(mappingPathOf(root), supplementPathOf(root))).map((entry) => entry.rule_id),
    ).toContain(RULE.document);
  });
});

for (const spelling of ["invoice/number", "::invoice", "invoice::", ""])
  test(`a legacy module spelled ${JSON.stringify(spelling)} is not converted, and nothing is written`, () => {
    const yaml = edit(
      legacyMappingYaml(),
      "    module: invoice::number\n",
      `    module: ${JSON.stringify(spelling)}\n`,
    );
    withWorkspace(legacyWorkspace({ mapping: mappingDocument(yaml) }), (root) => {
      const path = mappingPathOf(root);
      const before = snapshotBytes(root);
      for (const outcome of [
        previewMappingMigration(path, supplementPathOf(root)),
        applyMappingMigration(path, supplementPathOf(root)),
      ])
        expect(findingsOf(outcome).map((entry) => entry.rule_id)).toContain(RULE.structure);
      expect(snapshotBytes(root)).toEqual(before);
    });
  });

const LEGACY = legacyMappingYaml();

/** Legacy content the production reader would silently coerce or drop, or does not accept at all. */
const REFUSED_LEGACY_CONTENT: readonly (readonly [string, string, string])[] = [
  [
    "ports written as one string",
    RULE.structure,
    edit(LEGACY, "    ports: [InvoiceNumbering, TaxRates]\n", "    ports: InvoiceNumbering\n"),
  ],
  [
    "a reference id that is not a string",
    RULE.structure,
    edit(
      LEGACY,
      "    reference_ids: [entity.invoice, invariant.invoice.total-positive]\n",
      "    reference_ids: [entity.invoice, 42]\n",
    ),
  ],
  [
    "a repository that is not a string",
    RULE.structure,
    edit(LEGACY, "    repository: InvoiceRepository\n", "    repository: 42\n"),
  ],
  ["a business term that is not a string", RULE.structure, edit(LEGACY, "    term: 請求書番号\n", "    term: 2026\n")],
  [
    "a replay method name the legacy reader refuses",
    RULE.structure,
    edit(LEGACY, "method: apply_issued", "method: apply-issued"),
  ],
  ["no domain packages at all", RULE.structure, LEGACY.slice(0, LEGACY.indexOf("domain_packages:"))],
  [
    "an aggregate key the legacy reader ignores",
    RULE.unknownKey,
    edit(
      LEGACY,
      "    repository: PaymentRepository\n",
      "    repository: PaymentRepository\n    owner_team: 請求チーム\n",
    ),
  ],
  [
    "a replay key the legacy reader ignores",
    RULE.unknownKey,
    edit(
      LEGACY,
      "      - { method: apply_issued, event_ref: event.invoice.issued }\n",
      "      - { method: apply_issued, event_ref: event.invoice.issued, since: v2 }\n",
    ),
  ],
  [
    "a package key the legacy reader ignores",
    RULE.unknownKey,
    edit(LEGACY, "    rationale: 入金の消し込みを扱う\n", "    rationale: 入金の消し込みを扱う\n    owner: 経理部\n"),
  ],
  [
    "a root key the legacy reader ignores",
    RULE.unknownKey,
    edit(LEGACY, "domain_packages:\n", "notes: 移行前の記録\ndomain_packages:\n"),
  ],
  ["a version other than 1 or 2", RULE.version, edit(LEGACY, "schema_version: 1\n", "schema_version: 3\n")],
  ["no version at all", RULE.version, edit(LEGACY, "schema_version: 1\n", "")],
];

for (const [label, rule, yaml] of REFUSED_LEGACY_CONTENT)
  test(`a legacy document with ${label} is refused, and nothing is written`, () => {
    withWorkspace(legacyWorkspace({ mapping: mappingDocument(yaml) }), (root) => {
      const path = mappingPathOf(root);
      const before = snapshotBytes(root);
      for (const outcome of [
        previewMappingMigration(path, supplementPathOf(root)),
        applyMappingMigration(path, supplementPathOf(root)),
      ])
        expect(findingsOf(outcome).map((entry) => entry.rule_id)).toContain(rule);
      expect(snapshotBytes(root)).toEqual(before);
    });
  });

// ---------------------------------------------------------------------------
// Failure never writes
// ---------------------------------------------------------------------------

test("an apply re-reads both files, so an earlier successful preview never authorises a later change", () => {
  withWorkspace(legacyWorkspace(), (root) => {
    const path = mappingPathOf(root);
    const supplement = supplementPathOf(root);
    const original = readDocument(path);
    expect(previewMappingMigration(path, supplement).kind).toBe("candidate");

    writeFileSync(
      path,
      mappingDocument(
        edit(legacyMappingYaml(), "    reference_ids: [entity.payment]\n", "    reference_ids: [entity.refund]\n"),
      ),
    );
    const corrupted = snapshotBytes(root);
    expect(findingsOf(applyMappingMigration(path, supplement)).map((entry) => entry.rule_id)).toContain(RULE.reference);
    expect(snapshotBytes(root)).toEqual(corrupted);

    writeFileSync(path, original);
    const partial = supplementSource();
    supplementOperations(partial, 1)[0].errors.splice(0, 1);
    writeFileSync(supplement, renderYaml(partial));
    const trimmed = snapshotBytes(root);
    expect(applyMappingMigration(path, supplement)).toEqual({
      kind: "missing-information",
      missing: [
        "aggregate_mappings[aggregate.payment].operations[command.payment.settle].errors[error.payment.settle.already-settled]",
      ],
    });
    expect(snapshotBytes(root)).toEqual(trimmed);

    writeFileSync(supplement, renderYaml(supplementSource()));
    expect(applyMappingMigration(path, supplement).kind).toBe("applied");
  });
});

// Dropping write permission does nothing for a superuser, whose write succeeds regardless, so the
// test either observes the failure or does not run at all.
const RUNNING_AS_SUPERUSER = process.getuid?.() === 0;

test.skipIf(RUNNING_AS_SUPERUSER)(
  "a mapping that cannot be written is not reported as success and is left alone",
  () => {
    withWorkspace(legacyWorkspace(), (root) => {
      const path = mappingPathOf(root);
      const before = snapshotBytes(root);
      chmodSync(path, 0o444);
      try {
        expect(applyMappingMigration(path, supplementPathOf(root)).kind).toBe("write-failed");
        expect(snapshotBytes(root)).toEqual(before);

        const { exitCode, report } = run([
          "migrate",
          "--mapping",
          path,
          "--supplement",
          supplementPathOf(root),
          "--apply",
        ]);
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
test("a mapping document that is a symbolic link is refused, and neither the link nor the file it names is written", () => {
  withWorkspace(legacyWorkspace(), (root) => {
    const path = mappingPathOf(root);
    const target = join(root, STRAY_MAPPING_FILE);
    rmSync(path);
    symlinkSync(target, path);
    const before = snapshotBytes(root);
    expect(before[MAPPING_IN_RECORD]).toBe(`symlink:${target}`);

    expect(applyMappingMigration(path, supplementPathOf(root)).kind).toBe("write-failed");
    expect(snapshotBytes(root)).toEqual(before);
  });
});

// Creating an entry beside the document needs write permission on its directory, which a superuser
// has regardless, so the test either observes the failure or does not run at all.
test.skipIf(RUNNING_AS_SUPERUSER)(
  "a mapping whose directory accepts no new entry is not reported as success and is left alone",
  () => {
    withWorkspace(legacyWorkspace(), (root) => {
      const path = mappingPathOf(root);
      const before = snapshotBytes(root);
      // The document itself stays writable: what the apply cannot do is create the entry it writes
      // the new document to before renaming it into place.
      chmodSync(dirname(path), 0o555);
      try {
        const { exitCode, report } = run([
          "migrate",
          "--mapping",
          path,
          "--supplement",
          supplementPathOf(root),
          "--apply",
        ]);
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
// Production sensors keep reading the legacy format
// ---------------------------------------------------------------------------

test("the production mapping gate reads the legacy format and does not accept the migrated one", () => {
  withWorkspace(legacyWorkspace({ modelVersion: 1 }), (root) => {
    const path = mappingPathOf(root);
    const supplement = supplementPathOf(root);
    expect(verdictOf(path).pass).toBe(true);

    // The team migrates the canonical model first; only then can the mapping follow.
    expect(previewMappingMigration(path, supplement).kind).toBe("rejected");
    writeFileSync(join(root, MODEL_IN_RECORD), modelDocument(canonicalModelYaml(2)));
    expect(applyMappingMigration(path, supplement).kind).toBe("applied");

    const migrated = verdictOf(path);
    expect(migrated.pass).toBe(false);
    expect(migrated.findings.map((entry) => entry.rule_id)).toContain("mapping-declarations.document");
  });
});

// ---------------------------------------------------------------------------
// Command
// ---------------------------------------------------------------------------

test("the command previews, applies and then reports that nothing is left to do", () => {
  withWorkspace(legacyWorkspace(), (root) => {
    const path = mappingPathOf(root);
    const supplement = supplementPathOf(root);
    const before = snapshotBytes(root);

    const preview = run(["migrate", "--mapping", path, "--supplement", supplement]);
    expect(preview.exitCode).toBe(0);
    expect(preview.report.outcome).toBe("candidate");
    expect((preview.report.mapping as { schema_version: unknown }).schema_version).toBe(2);
    expect(snapshotBytes(root)).toEqual(before);

    const applied = run(["migrate", "--apply", "--supplement", supplement, "--mapping", path]);
    expect(applied.exitCode).toBe(0);
    expect(applied.report.outcome).toBe("applied");

    const again = run(["migrate", "--mapping", path, "--apply"]);
    expect(again.exitCode).toBe(0);
    expect(again.report.outcome).toBe("already-migrated");
  });
});

test("missing definitions exit 0 on preview and non-zero on apply", () => {
  withWorkspace(legacyWorkspace({ supplement: null }), (root) => {
    const path = mappingPathOf(root);
    const before = snapshotBytes(root);

    const preview = run(["migrate", "--mapping", path]);
    expect(preview.exitCode).toBe(0);
    expect(preview.report.outcome).toBe("missing-information");
    expect(preview.report.missing).toEqual(MISSING_WITHOUT_SUPPLEMENT);

    const applied = run(["migrate", "--mapping", path, "--apply"]);
    expect(applied.exitCode).toBe(1);
    expect(applied.report.outcome).toBe("missing-information");
    expect(applied.report.missing).toEqual(MISSING_WITHOUT_SUPPLEMENT);
    expect(snapshotBytes(root)).toEqual(before);
  });
});

test("a refused document exits with the refusal status and names its findings", () => {
  withWorkspace(legacyWorkspace({ mapping: mappingDocumentWithoutBlock() }), (root) => {
    const { exitCode, report } = run(["migrate", "--mapping", mappingPathOf(root)]);
    expect(exitCode).toBe(1);
    expect(report.outcome).toBe("rejected");
    expect((report.findings as { rule_id: string }[]).map((entry) => entry.rule_id)).toContain(RULE.document);
  });
});

for (const [label, argv] of [
  ["no command at all", []],
  ["an unknown subcommand", ["convert", "--mapping", "m.md"]],
  ["an unknown option", ["migrate", "--mapping", "m.md", "--force"]],
  ["a missing mapping", ["migrate"]],
  ["a supplement without a mapping", ["migrate", "--supplement", "s.yaml"]],
  ["a mapping option given without its value", ["migrate", "--mapping"]],
  ["a supplement option given without its value", ["migrate", "--mapping", "m.md", "--supplement"]],
] as const)
  test(`the command refuses ${label} with the argument exit status`, () => {
    const { exitCode, report } = run(argv);
    expect(exitCode).toBe(2);
    expect(report.outcome).toBe("invalid-arguments");
  });

// Reading `--apply` as the value would drop the apply and leave a preview of a path that does not
// exist, which writes nothing and exits with the refusal status instead of the argument status.
for (const [label, argv] of [
  ["the mapping", (_path: string) => ["migrate", "--mapping", "--apply"]],
  ["the supplement", (path: string) => ["migrate", "--mapping", path, "--supplement", "--apply"]],
] as const)
  test(`an option for ${label} left without a value never swallows the apply flag after it`, () => {
    withWorkspace(legacyWorkspace(), (root) => {
      const before = snapshotBytes(root);
      const { exitCode, report } = run(argv(mappingPathOf(root)));
      expect(exitCode).toBe(2);
      expect(report.outcome).toBe("invalid-arguments");
      expect(snapshotBytes(root)).toEqual(before);
    });
  });

test("the shipped entry point runs on its own, with no production sensor switched over", () => {
  withWorkspace(legacyWorkspace(), (root) => {
    const before = snapshotBytes(root);
    const spawned = Bun.spawnSync(
      [
        process.execPath,
        ENTRY_POINT,
        "migrate",
        "--mapping",
        mappingPathOf(root),
        "--supplement",
        supplementPathOf(root),
      ],
      { stdout: "pipe", stderr: "pipe" },
    );
    expect(spawned.exitCode).toBe(0);
    expect(JSON.parse(spawned.stdout.toString()).outcome).toBe("candidate");
    expect(snapshotBytes(root)).toEqual(before);
  });
});
