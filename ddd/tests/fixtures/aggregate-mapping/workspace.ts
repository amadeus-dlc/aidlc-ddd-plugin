/**
 * Workspace fixtures for the aggregate mapping suites.
 *
 * One intent record carries the canonical model, the mapping document and whatever the team wrote
 * next to them. Every builder returns fresh data, so a test that edits a mapping never edits what
 * another test reads.
 */

import { MAPPING_DATA_PATH, MODEL_DATA_PATH, MODEL_VIEW_FILE } from "../../../tools/ddd/lib/schema/artifacts.ts";
import type { FENCE_VARIANTS } from "../domain-model/workspace.ts";

type Fence = (typeof FENCE_VARIANTS)[number][1];

export const RECORD_DIR = "aidlc/spaces/default/intents/i1";
/** A second intent record in the same workspace, so two mapping documents can be read side by side. */
export const OTHER_RECORD_DIR = "aidlc/spaces/default/intents/i2";
/** The model reference every mapping here carries, resolved against the record directory. */
export const MODEL_REF = MODEL_DATA_PATH;
export const MAPPING_IN_RECORD = `${RECORD_DIR}/${MAPPING_DATA_PATH}`;
export const MODEL_IN_RECORD = `${RECORD_DIR}/${MODEL_DATA_PATH}`;
export const SUPPLEMENT_FILE = "mapping-supplement.yaml";
/** A mapping-named document outside the registered location; nothing may rewrite it. */
export const STRAY_MAPPING_FILE = "drafts/ddd-aggregate-mapping.md";

const STAGE_STATE =
  "## Stage Progress\n- [x] ddd-domain-modeling — EXECUTE\n- [x] domain-design — EXECUTE\n- [x] functional-design — EXECUTE\n";

/** Replace one exact piece of text, failing loudly when the fixture no longer contains it. */
export function edit(text: string, from: string, to: string): string {
  if (!text.includes(from)) throw new Error(`fixture text does not contain ${JSON.stringify(from)}`);
  return text.replace(from, to);
}

// ---------------------------------------------------------------------------
// Canonical model
// ---------------------------------------------------------------------------

type ModelVersion = 1 | 2;

/**
 * The same element ids in both model formats. Only the operation-owned format (2) can give the
 * factory rule its own business error, which is what the mapping has to name.
 */
export function canonicalModelYaml(version: ModelVersion): string {
  const owner = version === 1 ? "command" : "operation";
  const error = (id: string, name: string, operation: string, condition: string): string =>
    `              - { element_id: ${id}, name: ${name}, ${owner}: ${operation}, condition: ${JSON.stringify(condition)} }`;
  const factoryErrors =
    version === 1
      ? []
      : [
          "            domain_errors:",
          error("error.invoice.open.negative-amount", "NegativeAmount", "factory.invoice.open", "開始金額が負である。"),
        ];
  return [
    `schema_version: ${version}`,
    "bounded_contexts:",
    "  - element_id: bc.billing",
    "    name: Billing",
    "    aggregates:",
    "      - element_id: aggregate.invoice",
    "        name: Invoice",
    "        bounded_context: bc.billing",
    "        root_element: entity.invoice",
    "        states: [draft, issued]",
    "        elements:",
    "          - { element_id: entity.invoice, kind: entity, name: Invoice, aggregate: aggregate.invoice }",
    "        invariants:",
    "          - element_id: invariant.invoice.total-positive",
    "            name: TotalPositive",
    "            aggregate: aggregate.invoice",
    '            statement: "請求金額は負であってはならない。"',
    "        commands:",
    "          - element_id: command.invoice.issue",
    "            name: Issue",
    "            aggregate: aggregate.invoice",
    "            effect: transition",
    "            state_effect: transitions",
    "            transitions: [transition.invoice.issue]",
    "            domain_errors:",
    error("error.invoice.issue.already-issued", "AlreadyIssued", "command.invoice.issue", "請求書が下書き状態ではない。"),
    error("error.invoice.issue.empty-lines", "EmptyLines", "command.invoice.issue", "請求明細が一件もない。"),
    "            events: [event.invoice.issued]",
    "            idempotency: { strategy: none }",
    "          - element_id: command.invoice.cancel",
    "            name: Cancel",
    "            aggregate: aggregate.invoice",
    "            effect: transition",
    "            state_effect: none",
    "            domain_errors:",
    error(
      "error.invoice.cancel.already-cancelled",
      "AlreadyCancelled",
      "command.invoice.cancel",
      "請求書は取り消し済みである。",
    ),
    "            idempotency: { strategy: none }",
    "        events:",
    "          - { element_id: event.invoice.issued, name: Issued, aggregate: aggregate.invoice, produced_by: command.invoice.issue }",
    "        transitions:",
    "          - { element_id: transition.invoice.issue, name: Issue, aggregate: aggregate.invoice, from_state: draft, to_state: issued, command: command.invoice.issue }",
    "        factory_rules:",
    "          - element_id: factory.invoice.open",
    "            name: Open",
    "            target_element: entity.invoice",
    "            preconditions: [invariant.invoice.total-positive]",
    ...factoryErrors,
    "      - element_id: aggregate.payment",
    "        name: Payment",
    "        bounded_context: bc.billing",
    "        root_element: entity.payment",
    "        elements:",
    "          - { element_id: entity.payment, kind: entity, name: Payment, aggregate: aggregate.payment }",
    "        commands:",
    "          - element_id: command.payment.settle",
    "            name: Settle",
    "            aggregate: aggregate.payment",
    "            effect: transition",
    "            state_effect: none",
    "            domain_errors:",
    error("error.payment.settle.already-settled", "AlreadySettled", "command.payment.settle", "入金は消し込み済みである。"),
    "            idempotency: { strategy: none }",
    "lineage:",
    '  - { lineage_id: lineage-0001, element_id: aggregate.ledger, relation: deprecated, deprecated_at: "2026-01-01" }',
    "",
  ].join("\n");
}

export function modelDocument(yaml: string): string {
  return `# 正規モデル\n\n\`\`\`yaml\n${yaml.trimEnd()}\n\`\`\`\n`;
}

// ---------------------------------------------------------------------------
// Mapping documents
// ---------------------------------------------------------------------------

const DEFAULT_FENCE: Fence = { open: "```yaml", close: "```" };

/**
 * Prose that spells the legacy keys, plus a longer non-YAML fence that nests a mapping-shaped
 * ```yaml fence. readYamlBlock swallows the nested one, so the document still has exactly one
 * block to migrate and everything here is a region a migration must leave byte-for-byte alone.
 */
const PROSE_HEAD = [
  "# 集約の実装写像",
  "",
  "この本文は移行で書き換えない。`module: crate` と `crate::invoice` という字面は本文にも現れる。",
  "",
  "module: crate",
  "crate: billing-domain",
  "",
  "````text",
  "```yaml",
  "schema_version: 1",
  "aggregate_mappings:",
  "  - { aggregate_ref: aggregate.invoice, crate: billing-domain, module: crate }",
  "```",
  "````",
  "",
].join("\n");

const PROSE_TAIL = [
  "",
  "## 補足",
  "",
  "| 業務語 | 置き場所 |",
  "|---|---|",
  "| 請求書 | `crate::invoice` |",
  "| 入金 | `crate::payment` |",
  "",
].join("\n");

export function mappingDocument(yaml: string, fence: Fence = DEFAULT_FENCE): string {
  return `${PROSE_HEAD}${fence.open}\n${yaml.trimEnd()}\n${fence.close}\n${PROSE_TAIL}`;
}

export function mappingDocumentWithoutBlock(): string {
  return `${PROSE_HEAD}${PROSE_TAIL}`;
}

export function mappingDocumentWithTwoBlocks(yaml: string): string {
  return `${mappingDocument(yaml)}\n\`\`\`yaml\n${yaml.trimEnd()}\n\`\`\`\n`;
}

export function mappingDocumentWithUnclosedBlock(yaml: string): string {
  return `${PROSE_HEAD}\`\`\`yaml\n${yaml.trimEnd()}\n`;
}

/** An info string that only starts with yaml does not label a YAML block for readYamlBlock. */
export function mappingDocumentWithDecoratedInfoString(yaml: string): string {
  return `${PROSE_HEAD}\`\`\`yaml ddd-aggregate-mapping\n${yaml.trimEnd()}\n\`\`\`\n${PROSE_TAIL}`;
}

/** Business values that spell legacy keys; a textual rewrite would reach them, a structural one cannot. */
export const LEGACY_INVOICE_TERM = "請求書（crate::invoice）";
export const LEGACY_INVOICE_RATIONALE = "module: crate の字面を含むが、これは業務の説明である";

/**
 * The schema_version = 1 mapping the production sensors read today. Its module spellings cover a
 * crate root, a `crate::` prefix, a nested path and a raw identifier, and its business wording is
 * Japanese with values that spell the legacy keys.
 */
export function legacyMappingYaml(): string {
  return [
    "schema_version: 1",
    `model_ref: ${MODEL_REF}`,
    "aggregate_mappings:",
    "  - aggregate_ref: aggregate.invoice",
    "    programming_model: class",
    "    persistence_method: event-sourcing",
    "    crate: billing-domain",
    "    module: invoice",
    "    ports: [InvoiceNumbering, TaxRates]",
    "    repository: InvoiceRepository",
    "    reference_ids: [entity.invoice, invariant.invoice.total-positive]",
    "    replay_methods:",
    "      - { method: apply_issued, event_ref: event.invoice.issued }",
    "  - aggregate_ref: aggregate.payment",
    "    programming_model: actor",
    "    persistence_method: state-sourcing",
    "    crate: billing-domain",
    "    module: crate::payment",
    "    ports: []",
    "    repository: PaymentRepository",
    "    reference_ids: [entity.payment]",
    "domain_packages:",
    "  - crate: billing-domain",
    "    module: crate",
    "    term: 請求",
    "    model_refs: [bc.billing]",
    "    rationale: 請求の業務全体を所有する",
    "  - crate: billing-domain",
    "    module: crate::invoice",
    `    term: ${JSON.stringify(LEGACY_INVOICE_TERM)}`,
    "    model_refs: [aggregate.invoice]",
    `    rationale: ${JSON.stringify(LEGACY_INVOICE_RATIONALE)}`,
    "  - crate: billing-domain",
    "    module: invoice::number",
    "    term: 請求書番号",
    "    model_refs: [entity.invoice]",
    "    rationale: 請求書番号の採番規則をまとめる",
    "  - crate: billing-domain",
    "    module: r#type",
    "    term: 請求種別",
    "    model_refs: [bc.billing]",
    "    rationale: 請求の種別を区別する",
    "  - crate: billing-domain",
    "    module: payment",
    "    term: 入金",
    "    model_refs: [aggregate.payment]",
    "    rationale: 入金の消し込みを扱う",
    "",
  ].join("\n");
}

// ---------------------------------------------------------------------------
// Language-neutral mapping (schema_version 2)
// ---------------------------------------------------------------------------

export type MappingLanguage = "rust" | "typescript";

interface CodeLocationSource {
  language: string;
  package: string;
  module: string[];
}

interface ErrorSource {
  error_ref: string;
  code: { case: string };
}

export interface OperationSource {
  operation_ref: string;
  code: { method: string; error_type: string };
  errors: ErrorSource[];
}

export interface ReplaySource {
  event_ref: string;
  code: { method: string };
}

interface AggregateSource {
  aggregate_ref: string;
  programming_model: string;
  persistence_method: string;
  reference_ids: string[];
  replay_methods?: ReplaySource[];
  code: CodeLocationSource & { type?: string; ports?: string[]; repository?: string };
  operations: OperationSource[];
}

interface PackageSource {
  term: string;
  model_refs: string[];
  rationale: string;
  code: CodeLocationSource;
}

export interface MappingSource {
  schema_version?: unknown;
  model_ref?: string;
  aggregate_mappings: AggregateSource[];
  domain_packages: PackageSource[];
}

interface Spelling {
  readonly package: string;
  readonly lineModule: string;
  readonly replay: string;
  readonly cases: {
    readonly alreadyIssued: string;
    readonly emptyLines: string;
    readonly alreadyCancelled: string;
    readonly negativeAmount: string;
    readonly alreadySettled: string;
  };
}

/** Only these names differ between the two languages; every business id and owner is shared. */
const SPELLINGS: Readonly<Record<MappingLanguage, Spelling>> = {
  rust: {
    package: "billing-domain",
    lineModule: "invoice_line",
    replay: "apply_issued",
    cases: {
      alreadyIssued: "AlreadyIssued",
      emptyLines: "EmptyLines",
      alreadyCancelled: "AlreadyCancelled",
      negativeAmount: "NegativeAmount",
      alreadySettled: "AlreadySettled",
    },
  },
  typescript: {
    package: "@acme/billing-domain",
    lineModule: "invoice-line",
    replay: "applyIssued",
    cases: {
      alreadyIssued: "already-issued",
      emptyLines: "empty-lines",
      alreadyCancelled: "already-cancelled",
      negativeAmount: "negative-amount",
      alreadySettled: "already-settled",
    },
  },
};

/**
 * The corresponding mapping for one language. The payment aggregate declares no ports, repository
 * or replay methods, so the optional keys are exercised by the same document that loads cleanly;
 * the invoice-line package has no aggregate of its own, as a package still being planned.
 * `packageName` moves every aggregate and package of the document to that one package name.
 */
export function mappingSource(
  language: MappingLanguage,
  packageName: string = SPELLINGS[language].package,
): MappingSource {
  const spelling = SPELLINGS[language];
  const at = (module: string[]): CodeLocationSource => ({ language, package: packageName, module });
  return {
    schema_version: 2,
    model_ref: MODEL_REF,
    aggregate_mappings: [
      {
        aggregate_ref: "aggregate.invoice",
        programming_model: "class",
        persistence_method: "event-sourcing",
        reference_ids: ["entity.invoice", "invariant.invoice.total-positive"],
        replay_methods: [{ event_ref: "event.invoice.issued", code: { method: spelling.replay } }],
        code: {
          ...at(["invoice"]),
          type: "Invoice",
          ports: ["InvoiceNumbering"],
          repository: "InvoiceRepository",
        },
        operations: [
          {
            operation_ref: "command.invoice.issue",
            code: { method: "issue", error_type: "IssueInvoiceError" },
            errors: [
              { error_ref: "error.invoice.issue.already-issued", code: { case: spelling.cases.alreadyIssued } },
              { error_ref: "error.invoice.issue.empty-lines", code: { case: spelling.cases.emptyLines } },
            ],
          },
          {
            operation_ref: "command.invoice.cancel",
            code: { method: "cancel", error_type: "CancelInvoiceError" },
            errors: [
              { error_ref: "error.invoice.cancel.already-cancelled", code: { case: spelling.cases.alreadyCancelled } },
            ],
          },
          {
            operation_ref: "factory.invoice.open",
            code: { method: "open", error_type: "OpenInvoiceError" },
            errors: [
              { error_ref: "error.invoice.open.negative-amount", code: { case: spelling.cases.negativeAmount } },
            ],
          },
        ],
      },
      {
        aggregate_ref: "aggregate.payment",
        programming_model: "actor",
        persistence_method: "state-sourcing",
        reference_ids: ["entity.payment"],
        code: { ...at(["payment"]), type: "Payment" },
        operations: [
          {
            operation_ref: "command.payment.settle",
            code: { method: "settle", error_type: "SettlePaymentError" },
            errors: [
              { error_ref: "error.payment.settle.already-settled", code: { case: spelling.cases.alreadySettled } },
            ],
          },
        ],
      },
    ],
    domain_packages: [
      { term: "請求", model_refs: ["bc.billing"], rationale: "請求の業務全体を所有する", code: at([]) },
      {
        term: "請求書",
        model_refs: ["aggregate.invoice"],
        rationale: "請求書の状態と操作をまとめる",
        code: at(["invoice"]),
      },
      {
        term: "請求明細",
        model_refs: ["entity.invoice"],
        rationale: "請求明細の計算規則をまとめる予定の場所",
        code: at(["invoice", spelling.lineModule]),
      },
      { term: "入金", model_refs: ["aggregate.payment"], rationale: "入金の消し込みを扱う", code: at(["payment"]) },
    ],
  };
}

/** A package the tests add next to the base ones, under the same language and package name. */
export function extraPackage(source: MappingSource, term: string, module: string[]): PackageSource {
  const root = source.domain_packages[0].code;
  return {
    term,
    model_refs: ["bc.billing"],
    rationale: `${term}を扱う`,
    code: { language: root.language, package: root.package, module },
  };
}

export function renderYaml(value: object): string {
  return Bun.YAML.stringify(value, null, 2);
}

// ---------------------------------------------------------------------------
// Supplement: what the legacy format has no place for
// ---------------------------------------------------------------------------

export interface SupplementAggregate {
  aggregate_ref: string;
  code?: { type: string };
  operations?: OperationSource[];
}

export interface SupplementSource {
  aggregate_mappings: SupplementAggregate[];
}

/**
 * Code names chosen so none of them can be derived from the model: the type names differ from the
 * aggregate names and the method names from the command names.
 */
export function supplementSource(): SupplementSource {
  return {
    aggregate_mappings: [
      {
        aggregate_ref: "aggregate.invoice",
        code: { type: "BillingInvoice" },
        operations: [
          {
            operation_ref: "command.invoice.issue",
            code: { method: "issue_invoice", error_type: "IssueInvoiceError" },
            errors: [
              { error_ref: "error.invoice.issue.already-issued", code: { case: "AlreadyIssued" } },
              { error_ref: "error.invoice.issue.empty-lines", code: { case: "NoLines" } },
            ],
          },
          {
            operation_ref: "command.invoice.cancel",
            code: { method: "cancel_invoice", error_type: "CancelInvoiceError" },
            errors: [{ error_ref: "error.invoice.cancel.already-cancelled", code: { case: "AlreadyCancelled" } }],
          },
          {
            operation_ref: "factory.invoice.open",
            code: { method: "open_invoice", error_type: "OpenInvoiceError" },
            errors: [{ error_ref: "error.invoice.open.negative-amount", code: { case: "NegativeOpeningAmount" } }],
          },
        ],
      },
      {
        aggregate_ref: "aggregate.payment",
        code: { type: "PaymentRecord" },
        operations: [
          {
            operation_ref: "command.payment.settle",
            code: { method: "settle_payment", error_type: "SettlePaymentError" },
            errors: [{ error_ref: "error.payment.settle.already-settled", code: { case: "AlreadySettled" } }],
          },
        ],
      },
    ],
  };
}

// ---------------------------------------------------------------------------
// Workspace layout
// ---------------------------------------------------------------------------

interface RecordOptions {
  readonly modelVersion?: ModelVersion;
  readonly record?: string;
}

/** An intent record the shipped production sensors and the mapping reader can both be pointed at. */
export function recordFiles(mappingMarkdown: string, options: RecordOptions = {}): Record<string, string> {
  const record = options.record ?? RECORD_DIR;
  return {
    [`${record}/aidlc-state.md`]: STAGE_STATE,
    [`${record}/${MODEL_DATA_PATH}`]: modelDocument(canonicalModelYaml(options.modelVersion ?? 2)),
    [`${record}/${MAPPING_DATA_PATH}`]: mappingMarkdown,
  };
}

/** Files a mapping migration must never touch: sibling artifacts, notes, settings and a stray copy. */
export function untouchableUserFiles(): Record<string, string> {
  return {
    [`${RECORD_DIR}/inception/ddd-domain-modeling/${MODEL_VIEW_FILE}`]:
      "# 正規モデル（レビュー用）\n\n- aggregate.invoice\n- aggregate.payment\n",
    [`${RECORD_DIR}/inception/functional-design/functional-spec.md`]:
      "# 機能仕様\n\n`module: crate` という字面はここにも現れる。\n",
    [STRAY_MAPPING_FILE]: mappingDocument(legacyMappingYaml()),
    "notes/design.md": "# メモ\n\n`crate::invoice` は請求書の置き場所である。\n",
    ".ddd.toml":
      'schema_version = 2\nlanguages = ["rust", "typescript"]\n\n[rust]\nmodule_layout = "file"\n\n[typescript]\nmodule_layout = "named-file"\ncode_representation = "class"\n',
  };
}
