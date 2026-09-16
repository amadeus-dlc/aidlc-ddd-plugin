/**
 * The language-neutral aggregate mapping (schema_version 2): what one document may say, and what
 * the loader refuses before any source file is resolved.
 *
 * Every case is a whole document inside a real intent record, because a package's owner is decided
 * by the other packages around it and an error's owner by the canonical model the document names.
 */

import { expect, test } from "bun:test";
import { join } from "node:path";
import { loadAggregateMapping, packageAt, parentLocation } from "../tools/ddd/lib/aggregate-mapping/index.ts";
import {
  extraPackage,
  legacyMappingYaml,
  MAPPING_IN_RECORD,
  type MappingLanguage,
  type MappingSource,
  mappingDocument,
  mappingDocumentWithDecoratedInfoString,
  mappingDocumentWithoutBlock,
  mappingDocumentWithTwoBlocks,
  mappingDocumentWithUnclosedBlock,
  mappingSource,
  OTHER_RECORD_DIR,
  RECORD_DIR,
  type ReplaySource,
  recordFiles,
  renderYaml,
} from "./fixtures/aggregate-mapping/workspace.ts";
import { withWorkspace } from "./fixtures/domain-model/workspace.ts";

type LoadOutcome = ReturnType<typeof loadAggregateMapping>;
type LoadedMapping = Extract<LoadOutcome, { ok: true }>["mapping"];

const RULE = {
  document: "aggregate-mapping.document",
  version: "aggregate-mapping.version",
  structure: "aggregate-mapping.structure",
  unknownKey: "aggregate-mapping.unknown-key",
  model: "aggregate-mapping.model",
  reference: "aggregate-mapping.reference",
  ownerMismatch: "aggregate-mapping.owner-mismatch",
  duplicate: "aggregate-mapping.duplicate",
  coverage: "aggregate-mapping.coverage",
  technicalName: "aggregate-mapping.technical-name",
} as const;

function loadMarkdown(markdown: string, modelVersion: 1 | 2 = 2): LoadOutcome {
  return withWorkspace(recordFiles(markdown, { modelVersion }), (root) =>
    loadAggregateMapping(join(root, MAPPING_IN_RECORD)),
  );
}

function loadSource(source: MappingSource): LoadOutcome {
  return loadMarkdown(mappingDocument(renderYaml(source)));
}

/** A fresh document for `language`, edited by `change` before it is written. */
function variant(language: MappingLanguage, change: (source: MappingSource) => void): MappingSource {
  const source = mappingSource(language);
  change(source);
  return source;
}

/** Lets a case put a value of the wrong shape, or a key the format does not have, into a document. */
function loose(value: object): Record<string, unknown> {
  return value as Record<string, unknown>;
}

function invoiceReplay(source: MappingSource): ReplaySource {
  const replay = source.aggregate_mappings[0].replay_methods?.[0];
  if (replay === undefined) throw new Error("the invoice mapping in the fixture declares a replay method");
  return replay;
}

function mappingOf(outcome: LoadOutcome): LoadedMapping {
  if (!outcome.ok) throw new Error(`expected the mapping to load: ${JSON.stringify(outcome.findings)}`);
  return outcome.mapping;
}

function rulesOf(outcome: LoadOutcome): string[] {
  if (outcome.ok) throw new Error("expected the mapping to be refused");
  expect(outcome.findings.length).toBeGreaterThan(0);
  return outcome.findings.map((entry) => entry.rule_id);
}

/** Refused, and every finding names `rule`: the document carries no other defect. */
function expectRefusedOnlyBy(outcome: LoadOutcome, rule: string): void {
  expect(new Set(rulesOf(outcome))).toEqual(new Set([rule]));
}

function withoutCode(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(withoutCode);
  if (typeof value === "object" && value !== null)
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => key !== "code")
        .map(([key, entry]) => [key, withoutCode(entry)]),
    );
  return value;
}

/** Who owns what, read only through the public location API and the document's own nesting. */
function ownershipOf(mapping: LoadedMapping) {
  return {
    packages: mapping.domain_packages.map((entry) => {
      const parent = parentLocation(entry.code);
      return { term: entry.term, parent: parent === undefined ? null : packageAt(mapping, parent)?.term };
    }),
    aggregates: mapping.aggregate_mappings.map((entry) => ({
      aggregate: entry.aggregate_ref,
      package: packageAt(mapping, entry.code)?.term,
      operations: entry.operations.map((operation) => ({
        operation: operation.operation_ref,
        errors: operation.errors.map((error) => error.error_ref),
      })),
    })),
  };
}

const EXPECTED_OWNERSHIP = {
  packages: [
    { term: "請求", parent: null },
    { term: "請求書", parent: "請求" },
    { term: "請求明細", parent: "請求書" },
    { term: "入金", parent: "請求" },
  ],
  aggregates: [
    {
      aggregate: "aggregate.invoice",
      package: "請求書",
      operations: [
        {
          operation: "command.invoice.issue",
          errors: ["error.invoice.issue.already-issued", "error.invoice.issue.empty-lines"],
        },
        { operation: "command.invoice.cancel", errors: ["error.invoice.cancel.already-cancelled"] },
        { operation: "factory.invoice.open", errors: ["error.invoice.open.negative-amount"] },
      ],
    },
    {
      aggregate: "aggregate.payment",
      package: "入金",
      operations: [{ operation: "command.payment.settle", errors: ["error.payment.settle.already-settled"] }],
    },
  ],
};

// ---------------------------------------------------------------------------
// What a valid document carries
// ---------------------------------------------------------------------------

test("a schema_version 2 document loads with the canonical model it names", () => {
  const outcome = loadSource(mappingSource("rust"));
  expect(outcome.ok).toBe(true);
  if (!outcome.ok) return;
  expect(outcome.mapping.schema_version).toBe(2);
  expect(outcome.index.resolve("aggregate.invoice", "aggregate").ok).toBe(true);
  expect(outcome.index.resolve("error.invoice.open.negative-amount", "error").ok).toBe(true);
});

test("a loaded mapping keeps the vocabulary, the execution model, the persistence and the declared replay methods", () => {
  const source = mappingSource("rust");
  expect(mappingOf(loadSource(source))).toMatchObject(source as unknown as Record<string, unknown>);
});

test("a Rust mapping and a TypeScript mapping of one model share every business id and owner", () => {
  withWorkspace(
    {
      ...recordFiles(mappingDocument(renderYaml(mappingSource("rust")))),
      ...recordFiles(mappingDocument(renderYaml(mappingSource("typescript"))), { record: OTHER_RECORD_DIR }),
    },
    (root) => {
      const rust = mappingOf(loadAggregateMapping(join(root, MAPPING_IN_RECORD)));
      const typescript = mappingOf(
        loadAggregateMapping(join(root, MAPPING_IN_RECORD.replace(RECORD_DIR, OTHER_RECORD_DIR))),
      );

      expect(withoutCode(rust)).toEqual(withoutCode(typescript));
      expect(ownershipOf(rust)).toEqual(EXPECTED_OWNERSHIP);
      expect(ownershipOf(typescript)).toEqual(EXPECTED_OWNERSHIP);

      // Only the code side differs, and it says which language it is written in.
      expect(rust.aggregate_mappings.map((entry) => entry.code.language)).toEqual(["rust", "rust"]);
      expect(typescript.aggregate_mappings.map((entry) => entry.code.language)).toEqual(["typescript", "typescript"]);
      expect(typescript.domain_packages.map((entry) => entry.code.package)).toEqual([
        "@acme/billing-domain",
        "@acme/billing-domain",
        "@acme/billing-domain",
        "@acme/billing-domain",
      ]);
      expect(typescript.domain_packages[2].code.module).toEqual(["invoice", "invoice-line"]);
    },
  );
});

test("a raw identifier names the same Rust location as its plain spelling, and keeps its spelling", () => {
  const source = variant("rust", (draft) => {
    draft.domain_packages.push(extraPackage(draft, "請求種別", ["r#type"]));
    draft.aggregate_mappings[1].code.module = ["type"];
  });
  const mapping = mappingOf(loadSource(source));
  expect(packageAt(mapping, mapping.aggregate_mappings[1].code)?.term).toBe("請求種別");
  expect(mapping.domain_packages[4].code.module).toEqual(["r#type"]);
});

test("a Rust command and a factory rule share one method namespace", () => {
  const source = variant("rust", (draft) => {
    draft.aggregate_mappings[0].operations[2].code.method = "issue";
  });
  expectRefusedOnlyBy(loadSource(source), RULE.duplicate);
});

test("a TypeScript command and a factory rule may share a method name, being static and instance members", () => {
  const source = variant("typescript", (draft) => {
    draft.aggregate_mappings[0].operations[2].code.method = "issue";
  });
  expect(loadSource(source).ok).toBe(true);
});

// ---------------------------------------------------------------------------
// Version and document
// ---------------------------------------------------------------------------

test("a legacy schema_version 1 mapping is not read as the new format, and the finding points to the migration", () => {
  const outcome = loadMarkdown(mappingDocument(legacyMappingYaml()));
  expect(outcome.ok).toBe(false);
  if (outcome.ok) return;
  expect(outcome.findings.map((entry) => entry.rule_id)).toEqual([RULE.version]);
  expect(outcome.findings[0].message).toContain("migrate");
});

for (const [label, version] of [
  ["a quoted version", "2"],
  ["a later version", 3],
  ["no version at all", undefined],
] as const)
  test(`a document with ${label} is refused with one version finding`, () => {
    const source = variant("rust", (draft) => {
      if (version === undefined) delete draft.schema_version;
      else draft.schema_version = version;
    });
    const outcome = loadSource(source);
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.findings.map((entry) => entry.rule_id)).toEqual([RULE.version]);
  });

const valid = () => renderYaml(mappingSource("rust"));

for (const [label, markdown] of [
  ["carries no labelled YAML block", () => mappingDocumentWithoutBlock()],
  ["carries two labelled YAML blocks", () => mappingDocumentWithTwoBlocks(valid())],
  ["never closes its YAML block", () => mappingDocumentWithUnclosedBlock(valid())],
  ["labels its block with more than the language", () => mappingDocumentWithDecoratedInfoString(valid())],
  ["carries YAML that does not parse", () => mappingDocument("aggregate_mappings:\n  - [")],
  ["carries a YAML list instead of a mapping", () => mappingDocument("- schema_version: 2")],
] as const)
  test(`a document that ${label} is refused as a document`, () => {
    withWorkspace(recordFiles(markdown()), (root) => {
      const path = join(root, MAPPING_IN_RECORD);
      const outcome = loadAggregateMapping(path);
      expectRefusedOnlyBy(outcome, RULE.document);
      if (outcome.ok) return;
      expect(outcome.findings.every((entry) => entry.file === path)).toBe(true);
    });
  });

for (const [label, relative] of [
  ["a record that has no mapping document", null],
  ["a mapping-named file outside the domain-design stage", `${RECORD_DIR}/ddd-aggregate-mapping.md`],
  ["a mapping-named file under another stage", `${RECORD_DIR}/inception/functional-design/ddd-aggregate-mapping.md`],
  ["another file name in the domain-design stage", `${RECORD_DIR}/inception/domain-design/aggregate-mapping.md`],
] as const)
  test(`${label} is not a registered mapping document`, () => {
    const files = recordFiles(mappingDocument(valid()));
    const target = relative ?? MAPPING_IN_RECORD;
    if (relative === null) delete files[MAPPING_IN_RECORD];
    else files[relative] = mappingDocument(valid());
    withWorkspace(files, (root) => {
      expectRefusedOnlyBy(loadAggregateMapping(join(root, target)), RULE.document);
    });
  });

// ---------------------------------------------------------------------------
// Separation of business identity from code, and the closed key set
// ---------------------------------------------------------------------------

const UNKNOWN_KEYS: readonly (readonly [string, (source: MappingSource) => void])[] = [
  [
    "a table of every export at the root",
    (s) => {
      loose(s).exports = [{ name: "Invoice" }];
    },
  ],
  [
    "a public API list at the root",
    (s) => {
      loose(s).public_api = ["Invoice::issue"];
    },
  ],
  [
    "a legacy crate beside an aggregate's business ids",
    (s) => {
      loose(s.aggregate_mappings[0]).crate = "billing-domain";
    },
  ],
  [
    "a legacy module beside an aggregate's business ids",
    (s) => {
      loose(s.aggregate_mappings[0]).module = "crate::invoice";
    },
  ],
  [
    "a legacy crate beside a package's vocabulary",
    (s) => {
      loose(s.domain_packages[0]).crate = "billing-domain";
    },
  ],
  [
    "a compiler symbol id on an aggregate",
    (s) => {
      loose(s.aggregate_mappings[0]).symbol_id = "rust:billing_domain::invoice::Invoice";
    },
  ],
  [
    "a package id in a package's code",
    (s) => {
      loose(s.domain_packages[0].code).package_id = "path+file:///work/billing#billing-domain@0.1.0";
    },
  ],
  [
    "a source file in an aggregate's code",
    (s) => {
      loose(s.aggregate_mappings[0].code).file = "src/invoice.rs";
    },
  ],
  [
    "a source line in an aggregate's code",
    (s) => {
      loose(s.aggregate_mappings[0].code).line = 12;
    },
  ],
  [
    "an export list in an aggregate's code",
    (s) => {
      loose(s.aggregate_mappings[0].code).exports = ["Invoice"];
    },
  ],
  [
    "a compiler symbol id on an operation",
    (s) => {
      loose(s.aggregate_mappings[0].operations[0]).symbol_id = "rust:issue";
    },
  ],
  [
    "a source span in an operation's code",
    (s) => {
      loose(s.aggregate_mappings[0].operations[0].code).span = "10:4-18:5";
    },
  ],
  [
    "a source file on an error",
    (s) => {
      loose(s.aggregate_mappings[0].operations[0].errors[0]).file = "src/invoice.rs";
    },
  ],
  [
    "a source line in an error's code",
    (s) => {
      loose(s.aggregate_mappings[0].operations[0].errors[0].code).line = 3;
    },
  ],
  [
    "a source line on a replay method",
    (s) => {
      loose(invoiceReplay(s)).line = 40;
    },
  ],
];

for (const [label, change] of UNKNOWN_KEYS)
  test(`${label} is an unknown key`, () => {
    expectRefusedOnlyBy(loadSource(variant("rust", change)), RULE.unknownKey);
  });

const STRUCTURE_VIOLATIONS: readonly (readonly [string, MappingLanguage, (source: MappingSource) => void])[] = [
  [
    "an aggregate without code",
    "rust",
    (s) => {
      delete loose(s.aggregate_mappings[0]).code;
    },
  ],
  [
    "a language outside the supported set",
    "rust",
    (s) => {
      s.aggregate_mappings[0].code.language = "python";
    },
  ],
  [
    "a package without a language",
    "rust",
    (s) => {
      delete loose(s.domain_packages[1].code).language;
    },
  ],
  [
    "a module spelled as a legacy string",
    "rust",
    (s) => {
      loose(s.domain_packages[0].code).module = "crate";
    },
  ],
  [
    "a module segment that carries a path separator",
    "rust",
    (s) => {
      s.domain_packages[1].code.module = ["crate::invoice"];
    },
  ],
  [
    "a Rust module segment with a hyphen",
    "rust",
    (s) => {
      s.domain_packages[2].code.module = ["invoice", "invoice-line"];
    },
  ],
  [
    "a Rust module that names source files",
    "rust",
    (s) => {
      s.aggregate_mappings[0].code.module = ["src", "invoice.rs"];
    },
  ],
  [
    "a TypeScript module that names a source file",
    "typescript",
    (s) => {
      s.domain_packages[1].code.module = ["invoice.ts"];
    },
  ],
  [
    "a Rust package with a version",
    "rust",
    (s) => {
      s.domain_packages[0].code.package = "billing-domain@0.1.0";
    },
  ],
  [
    "a TypeScript package that npm cannot name",
    "typescript",
    (s) => {
      s.domain_packages[0].code.package = "@Acme/Billing-Domain";
    },
  ],
  [
    "a Rust type name with generic arguments",
    "rust",
    (s) => {
      s.aggregate_mappings[0].code.type = "Invoice<T>";
    },
  ],
  [
    "a Rust method name with a hyphen",
    "rust",
    (s) => {
      s.aggregate_mappings[0].operations[0].code.method = "issue-invoice";
    },
  ],
  [
    "a TypeScript method name with a hyphen",
    "typescript",
    (s) => {
      s.aggregate_mappings[0].operations[0].code.method = "issue-invoice";
    },
  ],
  [
    "an operation without an error type",
    "rust",
    (s) => {
      delete loose(s.aggregate_mappings[0].operations[0].code).error_type;
    },
  ],
  [
    "a Rust error case that is not an identifier",
    "rust",
    (s) => {
      s.aggregate_mappings[0].operations[0].errors[0].code.case = "already-issued";
    },
  ],
  [
    "an empty TypeScript error case",
    "typescript",
    (s) => {
      s.aggregate_mappings[0].operations[0].errors[0].code.case = "";
    },
  ],
  [
    "a replay method without a code name",
    "rust",
    (s) => {
      delete loose(invoiceReplay(s)).code;
    },
  ],
  [
    "a Rust replay method name with a hyphen",
    "rust",
    (s) => {
      invoiceReplay(s).code.method = "apply-issued";
    },
  ],
  [
    "an empty port name",
    "rust",
    (s) => {
      s.aggregate_mappings[0].code.ports = [""];
    },
  ],
  [
    "an empty repository name",
    "rust",
    (s) => {
      s.aggregate_mappings[0].code.repository = "";
    },
  ],
  [
    "a blank business term",
    "rust",
    (s) => {
      s.domain_packages[1].term = "   ";
    },
  ],
  [
    "an empty rationale",
    "rust",
    (s) => {
      s.domain_packages[1].rationale = "";
    },
  ],
  [
    "a package with no model reference",
    "rust",
    (s) => {
      s.domain_packages[1].model_refs = [];
    },
  ],
  [
    "an aggregate with no reference id",
    "rust",
    (s) => {
      s.aggregate_mappings[0].reference_ids = [];
    },
  ],
  [
    "reference ids written as one string",
    "rust",
    (s) => {
      loose(s.aggregate_mappings[0]).reference_ids = "entity.invoice";
    },
  ],
  [
    "a programming model outside actor and class",
    "rust",
    (s) => {
      s.aggregate_mappings[0].programming_model = "functional";
    },
  ],
  [
    "a persistence method outside the two sourcing styles",
    "rust",
    (s) => {
      s.aggregate_mappings[0].persistence_method = "crud";
    },
  ],
  [
    "no model reference",
    "rust",
    (s) => {
      delete s.model_ref;
    },
  ],
  [
    "no aggregate mappings",
    "rust",
    (s) => {
      delete loose(s).aggregate_mappings;
    },
  ],
  [
    "no domain packages",
    "rust",
    (s) => {
      delete loose(s).domain_packages;
    },
  ],
  [
    "an aggregate without its operation list",
    "rust",
    (s) => {
      delete loose(s.aggregate_mappings[1]).operations;
    },
  ],
  [
    "an operation without its error list",
    "rust",
    (s) => {
      delete loose(s.aggregate_mappings[1].operations[0]).errors;
    },
  ],
];

for (const [label, language, change] of STRUCTURE_VIOLATIONS)
  test(`${label} is a structure violation`, () => {
    expectRefusedOnlyBy(loadSource(variant(language, change)), RULE.structure);
  });

// ---------------------------------------------------------------------------
// The canonical model the document names
// ---------------------------------------------------------------------------

test("a document that names a legacy canonical model is refused, since only the new model has factory errors", () => {
  expectRefusedOnlyBy(loadMarkdown(mappingDocument(valid()), 1), RULE.model);
});

test("a document whose model reference does not resolve to a model is refused", () => {
  const source = variant("rust", (draft) => {
    draft.model_ref = "inception/ddd-domain-modeling/missing.md";
  });
  expectRefusedOnlyBy(loadSource(source), RULE.model);
});

const ONLY_REFERENCE: readonly (readonly [string, (source: MappingSource) => void])[] = [
  [
    "a reference id the model does not define",
    (s) => {
      s.aggregate_mappings[0].reference_ids.push("entity.refund");
    },
  ],
  [
    "a source position as a reference id",
    (s) => {
      s.aggregate_mappings[0].reference_ids = ["src/invoice.rs:12"];
    },
  ],
  [
    "a compiler package id as a reference id",
    (s) => {
      s.aggregate_mappings[0].reference_ids = ["path+file:///work/billing#billing-domain@0.1.0"];
    },
  ],
  [
    "a retired id as a package model reference",
    (s) => {
      s.domain_packages[0].model_refs = ["aggregate.ledger"];
    },
  ],
  [
    "an undefined package model reference",
    (s) => {
      s.domain_packages[0].model_refs = ["bc.shipping"];
    },
  ],
  [
    "a replay method bound to a command instead of an event",
    (s) => {
      invoiceReplay(s).event_ref = "command.invoice.issue";
    },
  ],
  [
    "a replay method bound to an undefined event",
    (s) => {
      invoiceReplay(s).event_ref = "event.invoice.voided";
    },
  ],
];

for (const [label, change] of ONLY_REFERENCE)
  test(`${label} is a broken model reference`, () => {
    expectRefusedOnlyBy(loadSource(variant("rust", change)), RULE.reference);
  });

// Replacing an aggregate, operation or error reference also leaves the model element it used to
// name unmapped, so these documents carry a coverage finding as well.
const REFERENCE_AMONG_OTHERS: readonly (readonly [string, (source: MappingSource) => void])[] = [
  [
    "a source position as an aggregate id",
    (s) => {
      s.aggregate_mappings[1].aggregate_ref = "src/payment.rs:12";
    },
  ],
  [
    "a compiler package id as an aggregate id",
    (s) => {
      s.aggregate_mappings[1].aggregate_ref = "path+file:///work/billing#billing-domain@0.1.0";
    },
  ],
  [
    "an entity id as an aggregate id",
    (s) => {
      s.aggregate_mappings[1].aggregate_ref = "entity.payment";
    },
  ],
  [
    "a retired aggregate id",
    (s) => {
      s.aggregate_mappings[1].aggregate_ref = "aggregate.ledger";
    },
  ],
  [
    "an event id as an operation id",
    (s) => {
      s.aggregate_mappings[0].operations[1].operation_ref = "event.invoice.issued";
    },
  ],
  [
    "an undefined operation id",
    (s) => {
      s.aggregate_mappings[0].operations[1].operation_ref = "command.invoice.void";
    },
  ],
  [
    "a command id as an error id",
    (s) => {
      s.aggregate_mappings[0].operations[1].errors[0].error_ref = "command.invoice.cancel";
    },
  ],
  [
    "an undefined error id",
    (s) => {
      s.aggregate_mappings[0].operations[1].errors[0].error_ref = "error.invoice.cancel.overdrawn";
    },
  ],
];

for (const [label, change] of REFERENCE_AMONG_OTHERS)
  test(`${label} is a broken model reference`, () => {
    expect(rulesOf(loadSource(variant("rust", change)))).toContain(RULE.reference);
  });

const FOREIGN_OWNERS: readonly (readonly [string, (source: MappingSource) => void])[] = [
  [
    "an operation of another aggregate",
    (s) => {
      s.aggregate_mappings[0].operations.push({
        operation_ref: "command.payment.settle",
        code: { method: "settle_payment", error_type: "SettlePaymentError" },
        errors: [{ error_ref: "error.payment.settle.already-settled", code: { case: "AlreadySettled" } }],
      });
    },
  ],
  [
    "an error another command of the same aggregate owns",
    (s) => {
      s.aggregate_mappings[0].operations[0].errors.push({
        error_ref: "error.invoice.cancel.already-cancelled",
        code: { case: "CancelledElsewhere" },
      });
    },
  ],
  [
    "an error a command of another aggregate owns",
    (s) => {
      s.aggregate_mappings[0].operations[0].errors.push({
        error_ref: "error.payment.settle.already-settled",
        code: { case: "SettledElsewhere" },
      });
    },
  ],
  [
    "a command's error listed under the factory rule",
    (s) => {
      s.aggregate_mappings[0].operations[2].errors.push({
        error_ref: "error.invoice.issue.already-issued",
        code: { case: "IssuedElsewhere" },
      });
    },
  ],
];

for (const [label, change] of FOREIGN_OWNERS)
  test(`${label} is refused even though its id resolves`, () => {
    expectRefusedOnlyBy(loadSource(variant("rust", change)), RULE.ownerMismatch);
  });

// ---------------------------------------------------------------------------
// Missing and duplicate mappings
// ---------------------------------------------------------------------------

const DUPLICATES: readonly (readonly [string, MappingLanguage, (source: MappingSource) => void])[] = [
  [
    "the same package location twice",
    "rust",
    (s) => {
      s.domain_packages.push(extraPackage(s, "請求（重複）", []));
    },
  ],
  [
    "a raw identifier and its plain spelling as two packages",
    "rust",
    (s) => {
      s.domain_packages.push(extraPackage(s, "請求種別", ["r#type"]), extraPackage(s, "請求種別2", ["type"]));
    },
  ],
  [
    "the same aggregate mapped twice",
    "rust",
    (s) => {
      s.aggregate_mappings.push(structuredClone(s.aggregate_mappings[1]));
    },
  ],
  [
    "two aggregates on one type",
    "rust",
    (s) => {
      s.aggregate_mappings[1].code = { ...s.aggregate_mappings[1].code, module: ["invoice"], type: "Invoice" };
    },
  ],
  [
    "the same operation mapped twice in one aggregate",
    "rust",
    (s) => {
      s.aggregate_mappings[0].operations.push({
        ...structuredClone(s.aggregate_mappings[0].operations[1]),
        code: { method: "cancel_again", error_type: "CancelInvoiceError" },
      });
    },
  ],
  [
    "two Rust commands on one method",
    "rust",
    (s) => {
      s.aggregate_mappings[0].operations[1].code.method = "issue";
    },
  ],
  [
    "two TypeScript commands on one method",
    "typescript",
    (s) => {
      s.aggregate_mappings[0].operations[1].code.method = "issue";
    },
  ],
  [
    "the same error mapped twice in one operation",
    "rust",
    (s) => {
      s.aggregate_mappings[0].operations[0].errors.push({
        error_ref: "error.invoice.issue.already-issued",
        code: { case: "IssuedTwice" },
      });
    },
  ],
  [
    "two errors of one operation on one case",
    "rust",
    (s) => {
      s.aggregate_mappings[0].operations[0].errors[1].code.case = "AlreadyIssued";
    },
  ],
];

for (const [label, language, change] of DUPLICATES)
  test(`${label} is a duplicate mapping`, () => {
    expectRefusedOnlyBy(loadSource(variant(language, change)), RULE.duplicate);
  });

const COVERAGE_GAPS: readonly (readonly [string, MappingLanguage, (source: MappingSource) => void])[] = [
  [
    "a package with no root package",
    "rust",
    (s) => {
      s.domain_packages.shift();
    },
  ],
  [
    "a package whose parent is not declared",
    "rust",
    (s) => {
      s.domain_packages.splice(1, 1);
    },
  ],
  [
    "an aggregate whose location has no package",
    "rust",
    (s) => {
      s.aggregate_mappings[1].code.module = ["settlement"];
    },
  ],
  [
    "an aggregate in a package that declares nothing",
    "typescript",
    (s) => {
      s.aggregate_mappings[1].code.package = "@acme/payments-domain";
    },
  ],
  [
    "an aggregate whose language differs from the packages at its location",
    "rust",
    (s) => {
      s.aggregate_mappings[1].code.language = "typescript";
    },
  ],
  [
    "a model aggregate with no mapping",
    "rust",
    (s) => {
      s.aggregate_mappings.splice(1, 1);
    },
  ],
  [
    "an aggregate with no type name",
    "rust",
    (s) => {
      delete s.aggregate_mappings[0].code.type;
    },
  ],
  [
    "a command with no mapping",
    "rust",
    (s) => {
      s.aggregate_mappings[0].operations.splice(1, 1);
    },
  ],
  [
    "a factory rule with no mapping",
    "rust",
    (s) => {
      s.aggregate_mappings[0].operations.splice(2, 1);
    },
  ],
  [
    "a business error with no case",
    "rust",
    (s) => {
      s.aggregate_mappings[0].operations[0].errors.splice(1, 1);
    },
  ],
];

for (const [label, language, change] of COVERAGE_GAPS)
  test(`${label} leaves the mapping incomplete`, () => {
    expectRefusedOnlyBy(loadSource(variant(language, change)), RULE.coverage);
  });

// ---------------------------------------------------------------------------
// Business vocabulary in package names
// ---------------------------------------------------------------------------

for (const [label, language, module] of [
  ["a Rust segment that contains a reserved word inside it", "rust", ["identity"]],
  ["a Rust segment that ends with a reserved word", "rust", ["invoice", "invoice_entities"]],
  ["a TypeScript segment that ends with a reserved word", "typescript", ["invoice", "invoice-entities"]],
] as const)
  test(`${label} is a business name`, () => {
    const source = variant(language, (draft) => {
      draft.domain_packages.push(extraPackage(draft, "業務名", [...module]));
    });
    expect(loadSource(source).ok).toBe(true);
  });

// A package name is compared the same way a module segment is: as a whole name, so a business name
// that ends in a reserved word is not refused for containing it.
for (const [label, language, name] of [
  ["a Rust package that ends with a reserved word", "rust", "invoice-entities"],
  ["a Rust package whose business name ends with the layer marker", "rust", "identity-domain"],
  ["a scoped TypeScript package that ends with a reserved word", "typescript", "@acme/invoice-entities"],
  ["a dot-separated TypeScript package that ends with a reserved word", "typescript", "@acme/invoice.entities"],
] as const)
  test(`${label} is a business name`, () => {
    expect(loadSource(mappingSource(language, name)).ok).toBe(true);
  });

for (const [label, language, module] of [
  ["a Rust value-object segment", "rust", ["vo"]],
  ["a raw Rust implementation segment", "rust", ["invoice", "r#impl"]],
  ["a kebab-case TypeScript value-object segment", "typescript", ["value-objects"]],
  ["a PascalCase TypeScript value-object segment", "typescript", ["invoice", "ValueObjects"]],
] as const)
  test(`${label} is a technical classification`, () => {
    const source = variant(language, (draft) => {
      draft.domain_packages.push(extraPackage(draft, "技術分類", [...module]));
    });
    expectRefusedOnlyBy(loadSource(source), RULE.technicalName);
  });

for (const [label, language, name] of [
  ["a Rust package of entities", "rust", "entities-domain"],
  ["a Rust package of value objects", "rust", "value-objects"],
  ["a Rust package named only domain", "rust", "domain"],
  ["a scoped TypeScript package of value objects", "typescript", "@acme/value-objects-domain"],
  ["a scoped TypeScript package named only domain", "typescript", "@acme/domain"],
] as const)
  test(`${label} is a technical classification`, () => {
    expectRefusedOnlyBy(loadSource(mappingSource(language, name)), RULE.technicalName);
  });
