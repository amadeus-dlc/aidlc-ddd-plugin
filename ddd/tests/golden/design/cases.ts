/**
 * Design golden cases (U4 BR8). Each case materialises a minimal record
 * directory and drives one sensor script through its real entry point.
 *
 * The inputs are the operation-owned model, the language-neutral aggregate
 * mapping and the language-neutral layer declaration the gates read. The
 * use-case declaration keeps its own format, which never changed. The
 * `*-legacy-*` cases hold the formats a record has to be migrated from, and
 * every gate that reads one refuses it.
 *
 * The model-mutating cases carry matching ddd-domain-model.md text so the
 * completeness (f) checks stay quiet unless a case targets them.
 */

import { designDocument } from "../model-document.ts";
import type { GoldenCase } from "../runner.ts";

const M = `schema_version: 2
bounded_contexts:
  - element_id: bc.billing
    name: Billing
    aggregates:
      - element_id: aggregate.invoice
        name: Invoice
        bounded_context: bc.billing
        root_element: entity.invoice
        states: [draft, issued]
        elements:
          - { element_id: entity.invoice, kind: entity, name: Invoice, aggregate: aggregate.invoice }
          - { element_id: primitive.money, kind: domain-primitive, name: Money, aggregate: aggregate.invoice, attributes: [{ name: value, type: decimal }] }
        invariants:
          - { element_id: invariant.invoice.total-positive, name: TotalPositive, aggregate: aggregate.invoice, statement: The money amount must be non-negative. }
        commands:
          - element_id: command.invoice.issue
            name: Issue
            aggregate: aggregate.invoice
            effect: transition
            state_effect: transitions
            transitions: [transition.invoice.issue]
            domain_errors:
              - { element_id: error.invoice.issue.already-issued, name: AlreadyIssued, operation: command.invoice.issue, condition: not draft }
            events: [event.invoice.issued]
            idempotency: { strategy: none }
        events:
          - { element_id: event.invoice.issued, name: Issued, aggregate: aggregate.invoice, produced_by: command.invoice.issue }
        transitions:
          - { element_id: transition.invoice.issue, name: Issue, aggregate: aggregate.invoice, from_state: draft, to_state: issued, command: command.invoice.issue }
        factory_rules:
          - element_id: factory.invoice.open
            name: Open
            target_element: entity.invoice
            preconditions: [invariant.invoice.total-positive]
            domain_errors:
              - { element_id: error.invoice.open.negative-amount, name: NegativeAmount, operation: factory.invoice.open, condition: negative opening amount }
lineage: []
`;

const FACTORY_ERRORS =
  "            domain_errors:\n              - { element_id: error.invoice.open.negative-amount, name: NegativeAmount, operation: factory.invoice.open, condition: negative opening amount }\n";

/**
 * The same model in the legacy format: DomainErrors name their owner under `command`, and a factory
 * rule has no place for business errors at all.
 */
const M_LEGACY = M.replace("schema_version: 2", "schema_version: 1")
  .replace(FACTORY_ERRORS, "")
  .replaceAll("operation: command.", "command: command.");

const M_NO_INV = M.replace(/ {8}invariants:\n {10}- \{[^\n]*\}\n/, "");
const M_NO_TRANS = M.replace("transitions: [transition.invoice.issue]", "transitions: []").replace(
  / {8}transitions:\n {10}- \{[^\n]*\}\n/,
  "        transitions: []\n",
);
const M_DEPRECATED = M.replace(
  "lineage: []",
  'lineage:\n  - { lineage_id: lineage-0001, element_id: entity.old, relation: deprecated, deprecated_at: "2026-01-01" }\n',
);
const M_CYCLE = M.replace(
  "lineage: []",
  'lineage:\n  - { lineage_id: lineage-0001, element_id: entity.a, relation: merged, replaced_by: entity.b, deprecated_at: "2026-01-01" }\n  - { lineage_id: lineage-0002, element_id: entity.b, relation: merged, replaced_by: entity.a, deprecated_at: "2026-01-01" }\n',
);
const ACCUM_COMMAND = `          - element_id: command.invoice.add
            name: Add
            aggregate: aggregate.invoice
            effect: accumulation
            state_effect: none
            domain_errors:
              - { element_id: error.invoice.add.overflow, name: Overflow, operation: command.invoice.add, condition: overflow }
            idempotency: { strategy: none }
`;
const M_ACCUM = M.replace("        events:\n", `${ACCUM_COMMAND}        events:\n`);

/** A second aggregate in the same context, spelled after the first one. */
const INVOICE_AGGREGATE = M.slice(M.indexOf("      - element_id: aggregate.invoice"), M.indexOf("lineage: []"));
const OTHER_AGGREGATE = INVOICE_AGGREGATE.replaceAll("invoice", "other")
  .replaceAll("Invoice", "Other")
  .replaceAll("primitive.money", "primitive.credit");
const M_TWO = M.replace("lineage: []", `${OTHER_AGGREGATE}lineage: []`);

function md(ids: string[], statement?: string): string {
  const lines = ["# Domain model", ...ids.map((id) => `- ${id}`)];
  if (statement) lines.push(`- invariant.invoice.total-positive: ${statement}`);
  return `${lines.join("\n")}\n`;
}

const IDS = [
  "bc.billing",
  "aggregate.invoice",
  "entity.invoice",
  "primitive.money",
  "command.invoice.issue",
  "error.invoice.issue.already-issued",
  "event.invoice.issued",
  "transition.invoice.issue",
  "factory.invoice.open",
  "error.invoice.open.negative-amount",
];
const MD = md(IDS, "The money amount must be non-negative.");
const MD_NO_INV = md(IDS.slice(0, 4).concat(IDS.slice(4)));
const MD_NO_TRANS = md(
  IDS.filter((id) => id !== "transition.invoice.issue"),
  "The money amount must be non-negative.",
);

/** The mapping of aggregate.invoice: its command and its factory rule, each with its one business error. */
const INVOICE_MAPPING = `  - aggregate_ref: aggregate.invoice
    programming_model: class
    persistence_method: state-sourcing
    reference_ids: [entity.invoice, invariant.invoice.total-positive]
    code:
      language: rust
      package: billing-domain
      module: [billing, invoice]
      type: Invoice
      ports: []
      repository: InvoiceRepository
    operations:
      - operation_ref: command.invoice.issue
        code: { method: issue, error_type: IssueInvoiceError }
        errors:
          - { error_ref: error.invoice.issue.already-issued, code: { case: AlreadyIssued } }
      - operation_ref: factory.invoice.open
        code: { method: open, error_type: OpenInvoiceError }
        errors:
          - { error_ref: error.invoice.open.negative-amount, code: { case: NegativeAmount } }
`;

function mappingDocument(entries: string): string {
  return `# Aggregate mapping

\`\`\`yaml
schema_version: 2
model_ref: inception/ddd-domain-modeling/ddd-domain-model-yaml.md
aggregate_mappings:
${entries}\`\`\`
`;
}

const MAP = mappingDocument(INVOICE_MAPPING);

const MAP_DUP = mappingDocument(`${INVOICE_MAPPING}${INVOICE_MAPPING}`);

const MAP_ACCUM = MAP.replace(
  "      - operation_ref: factory.invoice.open",
  "      - operation_ref: command.invoice.add\n        code: { method: add, error_type: AddInvoiceError }\n        errors:\n          - { error_ref: error.invoice.add.overflow, code: { case: Overflow } }\n      - operation_ref: factory.invoice.open",
);

/** The aggregate of M_TWO, implemented in a crate of its own. */
const OTHER_MAPPING = INVOICE_MAPPING.replaceAll("invoice", "other")
  .replaceAll("Invoice", "Other")
  .replace("package: billing-domain", "package: other-domain")
  .replace("module: [billing, other]", "module: [other]");

/** A legacy key left directly under an aggregate of a schema_version 2 mapping. */
const MAP_LEGACY_KEY = MAP.replace(
  "    persistence_method: state-sourcing\n",
  "    persistence_method: state-sourcing\n    crate: billing-domain\n",
);

/** The Rust-only crate/module mapping a record has to be migrated from. */
const MAP_LEGACY = `# Aggregate mapping

\`\`\`yaml
schema_version: 1
model_ref: inception/ddd-domain-modeling/ddd-domain-model-yaml.md
aggregate_mappings:
  - aggregate_ref: aggregate.invoice
    programming_model: class
    persistence_method: state-sourcing
    crate: billing-domain
    module: billing::invoice
    ports: []
    repository: InvoiceRepository
    reference_ids: [entity.invoice, invariant.invoice.total-positive]
domain_packages:
  - { crate: billing-domain, module: crate, term: 請求, model_refs: [bc.billing], rationale: 請求の業務全体を所有する }
  - { crate: billing-domain, module: billing, term: 請求, model_refs: [bc.billing], rationale: 請求の業務全体を所有する }
  - { crate: billing-domain, module: "billing::invoice", term: 請求書, model_refs: [aggregate.invoice], rationale: 請求書の状態と操作をまとめる }
\`\`\`
`;

const UC = `# Use cases

\`\`\`yaml
schema_version: 1
model_ref: inception/ddd-domain-modeling/ddd-domain-model-yaml.md
use_cases:
  - use_case_id: uc.issue-invoice
    name: Issue invoice
    target_aggregates: [aggregate.invoice]
    commands: [command.invoice.issue]
    re_execution_basis: idempotency none
    recovery_policy: caller-retry
    read_model_exposure: invoice view
\`\`\`
`;

const COMMAND_PACKAGE = "      - { role: command, code: { language: rust, package: billing-domain } }\n";
const QUERY_PACKAGE = "      - { role: query, code: { language: rust, package: billing-query } }\n";
const COMMAND_ROW = "      - { code: { language: rust, package: billing-domain }, depends_on: [] }\n";
const QUERY_ROW = "      - { code: { language: rust, package: billing-query }, depends_on: [] }\n";

const LAYER = `# Layer structure

\`\`\`yaml
schema_version: 2
model_ref: inception/ddd-domain-modeling/ddd-domain-model-yaml.md
layer_structures:
  - context_ref: bc.billing
    cqrs: true
    packages:
${COMMAND_PACKAGE}${QUERY_PACKAGE}    dependencies:
${COMMAND_ROW}${QUERY_ROW}    ports:
      - { name: InvoiceRepository, kind: repository, verbs: [find_by_id, store, delete_by_id] }
    repositories:
      - { name: InvoiceRepository, aggregate_ref: aggregate.invoice, io_unit: single, verbs: [find_by_id, store, delete_by_id], store_semantics: upsert }
    restoration_paths:
      - { aggregate_ref: aggregate.invoice, via: full-constructor }
    persistence_backend: postgres
\`\`\`
`;

/** The Rust-only crate layer declaration a record has to be migrated from. */
const LAYER_LEGACY = `# Layer structure

\`\`\`yaml
schema_version: 1
model_ref: inception/ddd-domain-modeling/ddd-domain-model-yaml.md
layer_structures:
  - context_ref: bc.billing
    cqrs: true
    command_side_crates: [billing-domain]
    query_side_crates: [billing-query]
    rmu_crates: []
    crate_dependencies:
      - { crate: billing-domain, depends_on: [] }
      - { crate: billing-query, depends_on: [] }
    ports:
      - { name: InvoiceRepository, kind: repository, verbs: [find_by_id, store, delete_by_id] }
    repositories:
      - { name: InvoiceRepository, aggregate_ref: aggregate.invoice, io_unit: single, verbs: [find_by_id, store, delete_by_id], store_semantics: upsert }
    restoration_paths:
      - { aggregate_ref: aggregate.invoice, via: full-constructor }
    persistence_backend: postgres
\`\`\`
`;

const MODEL_FILES = {
  "inception/ddd-domain-modeling/ddd-domain-model-yaml.md": M,
  "inception/ddd-domain-modeling/ddd-domain-model.md": MD,
};
const MAP_PATH = "inception/domain-design/ddd-aggregate-mapping.md";
const UC_PATH = "construction/u1/functional-design/functional-spec.md";
const LAYER_PATH = "construction/u1/infrastructure-design/cicd-pipeline.md";
const MODEL_PATH = "inception/ddd-domain-modeling/ddd-domain-model-yaml.md";
const MD_PATH = "inception/ddd-domain-modeling/ddd-domain-model.md";
const COMPONENTS_PATH = "inception/domain-design/components.md";

const RAW_DESIGN_CASES: GoldenCase[] = [
  // ---- model-completeness ----
  {
    sensor: "ddd-model-completeness",
    name: "clean-complete",
    stage: "ddd-domain-modeling",
    output: MODEL_PATH,
    files: MODEL_FILES,
    expect: { pass: true, rules: [] },
  },
  {
    sensor: "ddd-model-completeness",
    name: "violation-schema",
    stage: "ddd-domain-modeling",
    output: MODEL_PATH,
    files: { [MODEL_PATH]: "schema_version: 2\nbounded_contexts: []\n", [MD_PATH]: MD },
    expect: { pass: false, rules: ["model-completeness.schema"] },
  },
  {
    sensor: "ddd-model-completeness",
    name: "violation-legacy-model",
    stage: "ddd-domain-modeling",
    output: MODEL_PATH,
    files: { [MODEL_PATH]: M_LEGACY, [MD_PATH]: MD },
    expect: { pass: false, rules: ["model-completeness.schema"] },
  },
  {
    sensor: "ddd-model-completeness",
    name: "violation-i",
    stage: "ddd-domain-modeling",
    output: MODEL_PATH,
    files: { [MODEL_PATH]: M_NO_INV, [MD_PATH]: MD_NO_INV },
    expect: { pass: false, rules: ["model-completeness.i"] },
  },
  {
    sensor: "ddd-model-completeness",
    name: "violation-ii",
    stage: "ddd-domain-modeling",
    output: MODEL_PATH,
    files: { [MODEL_PATH]: M_NO_TRANS, [MD_PATH]: MD_NO_TRANS },
    expect: { pass: false, rules: ["model-completeness.ii"] },
  },
  {
    sensor: "ddd-model-completeness",
    name: "violation-f-absent",
    stage: "ddd-domain-modeling",
    output: MODEL_PATH,
    files: { [MODEL_PATH]: M },
    expect: { pass: false, rules: ["model-completeness.f-absent"] },
  },
  {
    sensor: "ddd-model-completeness",
    name: "violation-f-missing",
    stage: "ddd-domain-modeling",
    output: MODEL_PATH,
    files: { [MODEL_PATH]: M, [MD_PATH]: MD.replace("- primitive.money\n", "") },
    expect: { pass: false, rules: ["model-completeness.f-missing"] },
  },
  {
    sensor: "ddd-model-completeness",
    name: "violation-f-unknown",
    stage: "ddd-domain-modeling",
    output: MODEL_PATH,
    files: { [MODEL_PATH]: M, [MD_PATH]: `${MD}- entity.ghost\n` },
    expect: { pass: false, rules: ["model-completeness.f-unknown"] },
  },
  {
    sensor: "ddd-model-completeness",
    name: "violation-f-invariant",
    stage: "ddd-domain-modeling",
    output: MODEL_PATH,
    files: {
      [MODEL_PATH]: M,
      [MD_PATH]: MD.replace("The money amount must be non-negative.", "Money is non-negative."),
    },
    expect: { pass: false, rules: ["model-completeness.f-invariant"] },
  },

  // ---- model-presence ----
  {
    sensor: "ddd-model-presence",
    name: "clean-skip",
    stage: "domain-design",
    output: COMPONENTS_PATH,
    files: { [COMPONENTS_PATH]: "# components\n" },
    state: "## Stage Progress\n- [S] ddd-domain-modeling — SKIP\n",
    expect: { pass: true, rules: [], note_contains: "SKIP" },
  },
  {
    sensor: "ddd-model-presence",
    name: "clean-execute",
    stage: "domain-design",
    output: COMPONENTS_PATH,
    files: { [COMPONENTS_PATH]: "# components\n", [MODEL_PATH]: M },
    expect: { pass: true, rules: [] },
  },
  {
    sensor: "ddd-model-presence",
    name: "violation-missing",
    stage: "domain-design",
    output: COMPONENTS_PATH,
    files: { [COMPONENTS_PATH]: "# components\n" },
    expect: { pass: false, rules: ["model-presence.missing"], files: { "model-presence.missing": MODEL_PATH } },
  },
  {
    sensor: "ddd-model-presence",
    name: "violation-invalid",
    stage: "domain-design",
    output: COMPONENTS_PATH,
    files: {
      [COMPONENTS_PATH]: "# components\n",
      [MODEL_PATH]: "schema_version: 2\nbounded_contexts: []\n",
    },
    expect: { pass: false, rules: ["model-presence.invalid"], files: { "model-presence.invalid": MODEL_PATH } },
  },
  {
    sensor: "ddd-model-presence",
    name: "violation-legacy-model",
    stage: "domain-design",
    output: COMPONENTS_PATH,
    files: { [COMPONENTS_PATH]: "# components\n", [MODEL_PATH]: M_LEGACY },
    expect: { pass: false, rules: ["model-presence.invalid"], files: { "model-presence.invalid": MODEL_PATH } },
  },

  // ---- reference-ids ----
  {
    sensor: "ddd-reference-ids",
    name: "clean-mapping",
    stage: "domain-design",
    output: MAP_PATH,
    files: { [MODEL_PATH]: M, [MAP_PATH]: MAP },
    expect: { pass: true, rules: [] },
  },
  {
    sensor: "ddd-reference-ids",
    name: "violation-document",
    stage: "domain-design",
    output: MAP_PATH,
    files: { [MODEL_PATH]: M, [MAP_PATH]: "# no yaml\n" },
    expect: { pass: false, rules: ["reference-ids.document"] },
  },
  {
    sensor: "ddd-reference-ids",
    name: "violation-legacy-mapping",
    stage: "domain-design",
    output: MAP_PATH,
    files: { [MODEL_PATH]: M, [MAP_PATH]: MAP_LEGACY },
    expect: { pass: false, rules: ["reference-ids.document"] },
  },
  {
    sensor: "ddd-reference-ids",
    name: "violation-model",
    stage: "domain-design",
    output: MAP_PATH,
    files: {
      [MAP_PATH]: MAP.replace(
        "inception/ddd-domain-modeling/ddd-domain-model-yaml.md",
        "inception/ddd-domain-modeling/missing.yaml",
      ),
    },
    expect: { pass: false, rules: ["reference-ids.model"] },
  },
  {
    sensor: "ddd-reference-ids",
    name: "violation-legacy-model",
    stage: "domain-design",
    output: MAP_PATH,
    files: { [MODEL_PATH]: M_LEGACY, [MAP_PATH]: MAP },
    expect: { pass: false, rules: ["reference-ids.model"] },
  },
  {
    sensor: "ddd-reference-ids",
    name: "violation-legacy-model-use-cases",
    stage: "functional-design",
    output: UC_PATH,
    files: { [MODEL_PATH]: M_LEGACY, [UC_PATH]: UC },
    expect: { pass: false, rules: ["reference-ids.model"] },
  },
  {
    sensor: "ddd-reference-ids",
    name: "violation-undefined",
    stage: "domain-design",
    output: MAP_PATH,
    files: {
      [MODEL_PATH]: M,
      [MAP_PATH]: MAP.replace("[entity.invoice, invariant.invoice.total-positive]", "[entity.missing]"),
    },
    expect: { pass: false, rules: ["reference-ids.undefined"] },
  },
  {
    sensor: "ddd-reference-ids",
    name: "violation-deprecated",
    stage: "domain-design",
    output: MAP_PATH,
    files: {
      [MODEL_PATH]: M_DEPRECATED,
      [MAP_PATH]: MAP.replace("[entity.invoice, invariant.invoice.total-positive]", "[entity.old]"),
    },
    expect: { pass: false, rules: ["reference-ids.deprecated"] },
  },
  {
    sensor: "ddd-reference-ids",
    name: "violation-kind",
    stage: "domain-design",
    output: MAP_PATH,
    files: {
      [MODEL_PATH]: M,
      [MAP_PATH]: MAP.replace("aggregate_ref: aggregate.invoice", "aggregate_ref: entity.invoice"),
    },
    expect: { pass: false, rules: ["reference-ids.kind"] },
  },
  {
    sensor: "ddd-reference-ids",
    name: "violation-operation-kind",
    stage: "domain-design",
    output: MAP_PATH,
    files: {
      [MODEL_PATH]: M,
      [MAP_PATH]: MAP.replace("operation_ref: command.invoice.issue", "operation_ref: event.invoice.issued"),
    },
    expect: { pass: false, rules: ["reference-ids.kind"] },
  },
  {
    sensor: "ddd-reference-ids",
    name: "violation-error-reference",
    stage: "domain-design",
    output: MAP_PATH,
    files: {
      [MODEL_PATH]: M,
      [MAP_PATH]: MAP.replace(
        "error_ref: error.invoice.issue.already-issued",
        "error_ref: error.invoice.issue.never-declared",
      ),
    },
    expect: { pass: false, rules: ["reference-ids.undefined"] },
  },
  {
    sensor: "ddd-reference-ids",
    name: "violation-cycle",
    stage: "domain-design",
    output: MAP_PATH,
    files: {
      [MODEL_PATH]: M_CYCLE,
      [MAP_PATH]: MAP.replace("[entity.invoice, invariant.invoice.total-positive]", "[entity.a]"),
    },
    expect: { pass: false, rules: ["reference-ids.cycle"] },
  },
  {
    sensor: "ddd-reference-ids",
    name: "violation-missing",
    stage: "domain-design",
    output: MAP_PATH,
    files: { [MODEL_PATH]: M, [MAP_PATH]: MAP.replace("[entity.invoice, invariant.invoice.total-positive]", "[]") },
    expect: { pass: false, rules: ["reference-ids.document"] },
  },

  // ---- mapping-declarations ----
  {
    sensor: "ddd-mapping-declarations",
    name: "clean-mapping",
    stage: "domain-design",
    output: MAP_PATH,
    files: { [MODEL_PATH]: M, [MAP_PATH]: MAP },
    expect: { pass: true, rules: [] },
  },
  {
    sensor: "ddd-mapping-declarations",
    name: "violation-document",
    stage: "domain-design",
    output: MAP_PATH,
    files: { [MODEL_PATH]: M, [MAP_PATH]: "# no yaml\n" },
    expect: { pass: false, rules: ["mapping-declarations.document"] },
  },
  {
    sensor: "ddd-mapping-declarations",
    name: "violation-legacy-mapping",
    stage: "domain-design",
    output: MAP_PATH,
    files: { [MODEL_PATH]: M, [MAP_PATH]: MAP_LEGACY },
    expect: { pass: false, rules: ["mapping-declarations.document"] },
  },
  {
    sensor: "ddd-mapping-declarations",
    name: "violation-legacy-key",
    stage: "domain-design",
    output: MAP_PATH,
    files: { [MODEL_PATH]: M, [MAP_PATH]: MAP_LEGACY_KEY },
    expect: { pass: false, rules: ["mapping-declarations.document"] },
  },
  {
    sensor: "ddd-mapping-declarations",
    name: "violation-model",
    stage: "domain-design",
    output: MAP_PATH,
    files: {
      [MAP_PATH]: MAP.replace(
        "inception/ddd-domain-modeling/ddd-domain-model-yaml.md",
        "inception/ddd-domain-modeling/missing.yaml",
      ),
    },
    expect: { pass: false, rules: ["mapping-declarations.model"] },
  },
  {
    sensor: "ddd-mapping-declarations",
    name: "violation-legacy-model",
    stage: "domain-design",
    output: MAP_PATH,
    files: { [MODEL_PATH]: M_LEGACY, [MAP_PATH]: MAP },
    expect: { pass: false, rules: ["mapping-declarations.model"] },
  },
  {
    sensor: "ddd-mapping-declarations",
    name: "violation-axes",
    stage: "domain-design",
    output: MAP_PATH,
    files: { [MODEL_PATH]: M, [MAP_PATH]: MAP.replace("programming_model: class", "programming_model: ") },
    expect: { pass: false, rules: ["mapping-declarations.document"] },
  },
  {
    sensor: "ddd-mapping-declarations",
    name: "violation-aggregate-unmapped",
    stage: "domain-design",
    output: MAP_PATH,
    files: {
      [MODEL_PATH]: M,
      [MAP_PATH]: MAP.replace("aggregate_ref: aggregate.invoice", "aggregate_ref: aggregate.other"),
    },
    expect: { pass: false, rules: ["mapping-declarations.document"] },
  },
  {
    sensor: "ddd-mapping-declarations",
    name: "violation-operation-unmapped",
    stage: "domain-design",
    output: MAP_PATH,
    files: {
      [MODEL_PATH]: M,
      [MAP_PATH]: MAP.replace(
        "      - operation_ref: factory.invoice.open\n        code: { method: open, error_type: OpenInvoiceError }\n        errors:\n          - { error_ref: error.invoice.open.negative-amount, code: { case: NegativeAmount } }\n",
        "",
      ),
    },
    expect: { pass: false, rules: ["mapping-declarations.document"] },
  },
  {
    sensor: "ddd-mapping-declarations",
    name: "violation-duplicate",
    stage: "domain-design",
    output: MAP_PATH,
    files: { [MODEL_PATH]: M, [MAP_PATH]: MAP_DUP },
    expect: { pass: false, rules: ["mapping-declarations.document"] },
  },
  {
    sensor: "ddd-mapping-declarations",
    name: "violation-use-case-item",
    stage: "functional-design",
    output: UC_PATH,
    files: { [MODEL_PATH]: M, [UC_PATH]: UC.replace("re_execution_basis: idempotency none", "re_execution_basis: ") },
    expect: { pass: false, rules: ["mapping-declarations.use-case-item"] },
  },
  {
    sensor: "ddd-mapping-declarations",
    name: "violation-legacy-model-use-cases",
    stage: "functional-design",
    output: UC_PATH,
    files: { [MODEL_PATH]: M_LEGACY, [UC_PATH]: UC },
    expect: { pass: false, rules: ["mapping-declarations.model"] },
  },
  {
    // A mapping that is present but not readable in the current format blocks the functional design
    // instead of only skipping the Process Manager requirement.
    sensor: "ddd-mapping-declarations",
    name: "violation-legacy-mapping-beside-use-cases",
    stage: "functional-design",
    output: UC_PATH,
    files: { [MODEL_PATH]: M, [MAP_PATH]: MAP_LEGACY, [UC_PATH]: UC },
    expect: {
      pass: false,
      rules: ["mapping-declarations.document"],
      files: { "mapping-declarations.document": MAP_PATH },
    },
  },
  {
    sensor: "ddd-mapping-declarations",
    name: "violation-multi-aggregate-strategy",
    stage: "functional-design",
    output: UC_PATH,
    files: {
      [MODEL_PATH]: M,
      [UC_PATH]: UC.replace(
        "target_aggregates: [aggregate.invoice]",
        "target_aggregates: [aggregate.invoice, aggregate.other]",
      ),
    },
    expect: { pass: false, rules: ["mapping-declarations.multi-aggregate-strategy"] },
  },
  {
    sensor: "ddd-mapping-declarations",
    name: "violation-process-manager-required",
    stage: "functional-design",
    output: UC_PATH,
    files: {
      [MODEL_PATH]: M_TWO,
      [MAP_PATH]: mappingDocument(
        `${INVOICE_MAPPING}${OTHER_MAPPING}`.replaceAll("programming_model: class", "programming_model: actor"),
      ),
      [UC_PATH]: UC.replace(
        "target_aggregates: [aggregate.invoice]",
        "target_aggregates: [aggregate.invoice, aggregate.other]",
      ),
    },
    expect: {
      pass: false,
      rules: ["mapping-declarations.multi-aggregate-strategy", "mapping-declarations.process-manager-required"],
    },
  },
  {
    sensor: "ddd-mapping-declarations",
    name: "violation-j",
    stage: "domain-design",
    output: MAP_PATH,
    files: { [MODEL_PATH]: M_ACCUM, [MAP_PATH]: MAP_ACCUM },
    expect: { pass: false, rules: ["mapping-declarations.j"] },
  },

  // ---- layer-structure ----
  {
    sensor: "ddd-layer-structure",
    name: "clean",
    stage: "infrastructure-design",
    output: LAYER_PATH,
    files: { [MODEL_PATH]: M, [MAP_PATH]: MAP, [LAYER_PATH]: LAYER },
    expect: { pass: true, rules: [] },
  },
  {
    sensor: "ddd-layer-structure",
    name: "violation-legacy-layer",
    stage: "infrastructure-design",
    output: LAYER_PATH,
    files: { [MODEL_PATH]: M, [MAP_PATH]: MAP, [LAYER_PATH]: LAYER_LEGACY },
    expect: { pass: false, rules: ["layer-structure.item"] },
  },
  {
    sensor: "ddd-layer-structure",
    name: "violation-model",
    stage: "infrastructure-design",
    output: LAYER_PATH,
    files: {
      [LAYER_PATH]: LAYER.replace(
        "inception/ddd-domain-modeling/ddd-domain-model-yaml.md",
        "inception/ddd-domain-modeling/missing.yaml",
      ),
    },
    expect: { pass: false, rules: ["layer-structure.model"] },
  },
  {
    sensor: "ddd-layer-structure",
    name: "violation-legacy-model",
    stage: "infrastructure-design",
    output: LAYER_PATH,
    files: { [MODEL_PATH]: M_LEGACY, [LAYER_PATH]: LAYER },
    expect: { pass: false, rules: ["layer-structure.model"] },
  },
  {
    sensor: "ddd-layer-structure",
    name: "violation-item",
    stage: "infrastructure-design",
    output: LAYER_PATH,
    files: {
      [MODEL_PATH]: M,
      [MAP_PATH]: MAP,
      [LAYER_PATH]: LAYER.replace(`    dependencies:\n${COMMAND_ROW}${QUERY_ROW}`, "    dependencies: []\n"),
    },
    expect: { pass: false, rules: ["layer-structure.item", "layer-structure.dependencies-incomplete"] },
  },
  {
    sensor: "ddd-layer-structure",
    name: "violation-cqrs-sides",
    stage: "infrastructure-design",
    output: LAYER_PATH,
    files: {
      [MODEL_PATH]: M,
      [MAP_PATH]: MAP,
      [LAYER_PATH]: LAYER.replace(QUERY_PACKAGE, "").replace(QUERY_ROW, ""),
    },
    expect: { pass: false, rules: ["layer-structure.cqrs-sides"] },
  },
  {
    sensor: "ddd-layer-structure",
    name: "violation-k",
    stage: "infrastructure-design",
    output: LAYER_PATH,
    files: {
      [MODEL_PATH]: M,
      [MAP_PATH]: MAP,
      [LAYER_PATH]: LAYER.replace(
        COMMAND_PACKAGE,
        COMMAND_PACKAGE.replace("billing-domain", "billing-command"),
      ).replace(
        COMMAND_ROW,
        "      - { code: { language: rust, package: billing-command }, depends_on: [{ language: rust, package: billing-query }] }\n",
      ),
    },
    expect: { pass: false, rules: ["layer-structure.k"] },
  },
  {
    sensor: "ddd-layer-structure",
    name: "violation-l",
    stage: "infrastructure-design",
    output: LAYER_PATH,
    files: {
      [MODEL_PATH]: M,
      [MAP_PATH]: MAP,
      [LAYER_PATH]: LAYER.replace(
        QUERY_ROW,
        "      - { code: { language: rust, package: billing-query }, depends_on: [{ language: rust, package: billing-shared-domain }] }\n",
      ),
    },
    expect: { pass: false, rules: ["layer-structure.l"] },
  },
  {
    sensor: "ddd-layer-structure",
    name: "violation-n",
    stage: "infrastructure-design",
    output: LAYER_PATH,
    files: { [MODEL_PATH]: M, [MAP_PATH]: MAP, [LAYER_PATH]: LAYER.replace("via: full-constructor", "via: other") },
    expect: { pass: false, rules: ["layer-structure.n"] },
  },
  {
    // Where the mapping places the aggregate's code does not decide whether the context has to rebuild it.
    sensor: "ddd-layer-structure",
    name: "violation-n-aggregate-mapped-elsewhere",
    stage: "infrastructure-design",
    output: LAYER_PATH,
    files: {
      [MODEL_PATH]: M,
      [MAP_PATH]: MAP.replace("package: billing-domain", "package: other-domain"),
      [LAYER_PATH]: LAYER.replace("via: full-constructor", "via: other"),
    },
    expect: { pass: false, rules: ["layer-structure.n"] },
  },

  // ---- design-advisories ----
  {
    sensor: "ddd-design-advisories",
    name: "clean",
    stage: "infrastructure-design",
    output: LAYER_PATH,
    files: { [MODEL_PATH]: M, [LAYER_PATH]: LAYER },
    expect: { pass: true, rules: [] },
  },
  {
    sensor: "ddd-design-advisories",
    name: "violation-legacy-layer",
    stage: "infrastructure-design",
    output: LAYER_PATH,
    files: { [MODEL_PATH]: M, [LAYER_PATH]: LAYER_LEGACY },
    expect: { pass: false, rules: ["design-advisories.document"] },
  },
  {
    sensor: "ddd-design-advisories",
    name: "violation-document",
    stage: "functional-design",
    output: UC_PATH,
    files: { [MODEL_PATH]: M, [UC_PATH]: "# no yaml\n" },
    expect: { pass: false, rules: ["design-advisories.document"] },
  },
  {
    sensor: "ddd-design-advisories",
    name: "violation-multi-aggregate",
    stage: "functional-design",
    output: UC_PATH,
    files: {
      [MODEL_PATH]: M,
      [UC_PATH]: UC.replace(
        "target_aggregates: [aggregate.invoice]",
        "target_aggregates: [aggregate.invoice, aggregate.other]",
      ),
    },
    expect: { pass: false, rules: ["design-advisories.multi-aggregate"] },
  },
  {
    sensor: "ddd-design-advisories",
    name: "violation-repository-scope",
    stage: "infrastructure-design",
    output: LAYER_PATH,
    files: { [MODEL_PATH]: M, [LAYER_PATH]: LAYER.replace("io_unit: single", "io_unit: partial") },
    expect: { pass: false, rules: ["design-advisories.repository-scope"] },
  },
  {
    sensor: "ddd-design-advisories",
    name: "violation-store-upsert",
    stage: "infrastructure-design",
    output: LAYER_PATH,
    files: { [MODEL_PATH]: M, [LAYER_PATH]: LAYER.replace("store_semantics: upsert", "store_semantics: insert-only") },
    expect: { pass: false, rules: ["design-advisories.store-upsert"] },
  },
];

RAW_DESIGN_CASES.push(
  {
    sensor: "ddd-reference-ids",
    name: "clean-replay-reference",
    stage: "domain-design",
    output: MAP_PATH,
    files: {
      [MODEL_PATH]: M,
      [MAP_PATH]: MAP.replace(
        "    reference_ids:",
        "    replay_methods: [{ event_ref: event.invoice.issued, code: { method: apply_event } }]\n    reference_ids:",
      ),
    },
    expect: { pass: true, rules: [] },
  },
  {
    sensor: "ddd-reference-ids",
    name: "violation-replay-reference",
    stage: "domain-design",
    output: MAP_PATH,
    files: {
      [MODEL_PATH]: M,
      [MAP_PATH]: MAP.replace(
        "    reference_ids:",
        "    replay_methods: [{ event_ref: event.invoice.unknown, code: { method: apply_event } }]\n    reference_ids:",
      ),
    },
    expect: { pass: false, rules: ["reference-ids.undefined"] },
  },
  {
    sensor: "ddd-mapping-declarations",
    name: "violation-replay-shape",
    stage: "domain-design",
    output: MAP_PATH,
    files: {
      [MODEL_PATH]: M,
      [MAP_PATH]: MAP.replace("    reference_ids:", "    replay_methods: invalid\n    reference_ids:"),
    },
    expect: { pass: false, rules: ["mapping-declarations.document"] },
  },
);

export const DESIGN_CASES: GoldenCase[] = RAW_DESIGN_CASES.map((entry) => ({
  ...entry,
  files: Object.fromEntries(
    Object.entries(entry.files).map(([path, content]) => [path, designDocument(path, content)]),
  ),
}));
