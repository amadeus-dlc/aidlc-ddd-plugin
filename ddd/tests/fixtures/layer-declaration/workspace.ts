/**
 * Workspace fixtures for the layer declaration suites.
 *
 * One intent record carries the canonical model, the cicd-pipeline document that holds the DDD
 * layer section, the use-case declaration beside it, and the CI files a migration must never
 * touch. Every builder returns fresh data, so a test that edits a declaration never edits what
 * another test reads.
 *
 * The canonical model comes from the aggregate mapping fixtures rather than a second copy: both
 * suites need the same billing context with its two aggregates and its retired one, and a second
 * copy would have to be kept in step with the schema loader on its own.
 */

import { MODEL_DATA_PATH } from "../../../tools/ddd/lib/schema/artifacts.ts";
import { canonicalModelYaml, modelDocument } from "../aggregate-mapping/workspace.ts";
import type { FENCE_VARIANTS } from "../domain-model/workspace.ts";

type Fence = (typeof FENCE_VARIANTS)[number][1];
type ModelVersion = 1 | 2;

export const RECORD_DIR = "aidlc/spaces/default/intents/i1";
/** A second intent record in the same workspace, so two declarations can be read side by side. */
export const OTHER_RECORD_DIR = "aidlc/spaces/default/intents/i2";

/** The reference every declaration states; a declaration that omits it names no canonical model. */
export const MODEL_REF = MODEL_DATA_PATH;
export const MODEL_IN_RECORD = `${RECORD_DIR}/${MODEL_DATA_PATH}`;

/** Where the infrastructure-design stage writes the review artifact that holds the DDD section. */
const DECLARATION_PATH = "construction/u1/infrastructure-design/cicd-pipeline.md";
export const DECLARATION_IN_RECORD = `${RECORD_DIR}/${DECLARATION_PATH}`;

/** The use-case declaration, already language-neutral, that must come through the change unharmed. */
const USE_CASE_PATH = "construction/u1/functional-design/functional-spec.md";
export const USE_CASE_IN_RECORD = `${RECORD_DIR}/${USE_CASE_PATH}`;

/** A pipeline-named document outside the registered location; nothing may rewrite it. */
export const STRAY_DECLARATION_FILE = "drafts/cicd-pipeline.md";

const ENGLISH_HEADING = "DDD Layer Structure";
export const JAPANESE_HEADING = "DDD 層構造宣言";
export const LAYER_HEADINGS: readonly string[] = [ENGLISH_HEADING, JAPANESE_HEADING];

const USE_CASE_HEADING = "DDD Use-case Declarations";
export const USE_CASE_HEADINGS: readonly string[] = [USE_CASE_HEADING, "DDD ユースケース宣言"];

const STAGE_STATE = [
  "## Stage Progress",
  "- [x] ddd-domain-modeling — EXECUTE",
  "- [x] domain-design — EXECUTE",
  "- [x] functional-design — EXECUTE",
  "- [x] infrastructure-design — EXECUTE",
  "",
].join("\n");

// ---------------------------------------------------------------------------
// Business values that spell the legacy keys
// ---------------------------------------------------------------------------

/** Prose outside the DDD section that spells the legacy keys; a textual rewrite would reach it. */
export const PROSE_LEGACY_SPELLING = "command_side_crates: [billing-domain]";

/** A declared value that spells a legacy key; a structural conversion carries it over untouched. */
export const PERSISTENCE_BACKEND = "postgres（本文の `crate: billing-domain` と同じ字面を含む説明）";

const PAYMENT_RESTORATION_NOTE = "入金は全項目コンストラクタで復元する";

// ---------------------------------------------------------------------------
// The language-neutral declaration (schema_version 2)
// ---------------------------------------------------------------------------

export type LayerLanguage = "rust" | "typescript";

export interface PackageIdentitySource {
  language: string;
  package: string;
}

export interface LayerPackageSource {
  role: string;
  code: PackageIdentitySource;
}

export interface DependencySource {
  code: PackageIdentitySource;
  depends_on: PackageIdentitySource[];
}

export interface PortSource {
  name: string;
  kind: string;
  verbs: string[];
}

export interface RepositorySource {
  name: string;
  aggregate_ref: string;
  io_unit: string;
  verbs: string[];
  store_semantics: string;
}

export interface RestorationPathSource {
  aggregate_ref: string;
  via: string;
  note?: string;
}

export interface LayerStructureSource {
  context_ref: string;
  cqrs: boolean;
  packages: LayerPackageSource[];
  dependencies: DependencySource[];
  ports: PortSource[];
  repositories: RepositorySource[];
  restoration_paths: RestorationPathSource[];
  persistence_backend: string;
}

export interface LayerSource {
  schema_version?: unknown;
  model_ref?: string;
  layer_structures: LayerStructureSource[];
}

/** Only the package names differ between the two languages; every business value is shared. */
const PACKAGE_SPELLINGS: Readonly<Record<LayerLanguage, Readonly<Record<string, string>>>> = {
  rust: { command: "billing-domain", query: "billing-query", rmu: "billing-rmu" },
  typescript: { command: "@acme/billing-domain", query: "@acme/billing-query", rmu: "@acme/billing-rmu" },
};

export function packageNameOf(language: LayerLanguage, role: "command" | "query" | "rmu"): string {
  return PACKAGE_SPELLINGS[language][role];
}

export function identityOf(language: LayerLanguage, role: "command" | "query" | "rmu"): PackageIdentitySource {
  return { language, package: packageNameOf(language, role) };
}

/**
 * The declaration for one language: a CQRS billing context whose read-model updater bridges both
 * sides, with a port that is not a repository, two repositories that differ in io unit and store
 * semantics, and a restoration path that carries a note.
 */
export function layerSource(language: LayerLanguage): LayerSource {
  const at = (role: "command" | "query" | "rmu"): PackageIdentitySource => identityOf(language, role);
  return {
    schema_version: 2,
    model_ref: MODEL_REF,
    layer_structures: [
      {
        context_ref: "bc.billing",
        cqrs: true,
        packages: [
          { role: "command", code: at("command") },
          { role: "query", code: at("query") },
          { role: "rmu", code: at("rmu") },
        ],
        dependencies: [
          { code: at("command"), depends_on: [] },
          { code: at("query"), depends_on: [] },
          { code: at("rmu"), depends_on: [at("command"), at("query")] },
        ],
        ports: [
          { name: "InvoiceNumbering", kind: "external-client", verbs: ["next_number"] },
          { name: "InvoiceRepository", kind: "repository", verbs: ["find_by_id", "store", "delete_by_id"] },
        ],
        repositories: [
          {
            name: "InvoiceRepository",
            aggregate_ref: "aggregate.invoice",
            io_unit: "single",
            verbs: ["find_by_id", "store", "delete_by_id"],
            store_semantics: "upsert",
          },
          {
            name: "PaymentRepository",
            aggregate_ref: "aggregate.payment",
            io_unit: "collection",
            verbs: ["find_by_id", "store"],
            store_semantics: "insert-only",
          },
        ],
        restoration_paths: [
          { aggregate_ref: "aggregate.invoice", via: "full-constructor" },
          { aggregate_ref: "aggregate.payment", via: "full-constructor", note: PAYMENT_RESTORATION_NOTE },
        ],
        persistence_backend: PERSISTENCE_BACKEND,
      },
    ],
  };
}

export function structureOf(source: LayerSource): LayerStructureSource {
  const structure = source.layer_structures[0];
  if (structure === undefined) throw new Error("the layer fixture declares one structure");
  return structure;
}

export function renderYaml(value: object): string {
  return Bun.YAML.stringify(value, null, 2);
}

// ---------------------------------------------------------------------------
// The Rust-only crate format (schema_version 1) the production sensors read
// ---------------------------------------------------------------------------

/** The same context as `layerSource("rust")`, written in the crate-fixed format. */
export function legacyLayerYaml(): string {
  return [
    "schema_version: 1",
    `model_ref: ${MODEL_REF}`,
    "layer_structures:",
    "  - context_ref: bc.billing",
    "    cqrs: true",
    "    command_side_crates: [billing-domain]",
    "    query_side_crates: [billing-query]",
    "    rmu_crates: [billing-rmu]",
    "    crate_dependencies:",
    "      - { crate: billing-domain, depends_on: [] }",
    "      - { crate: billing-query, depends_on: [] }",
    "      - { crate: billing-rmu, depends_on: [billing-domain, billing-query] }",
    "    ports:",
    "      - { name: InvoiceNumbering, kind: external-client, verbs: [next_number] }",
    "      - { name: InvoiceRepository, kind: repository, verbs: [find_by_id, store, delete_by_id] }",
    "    repositories:",
    "      - { name: InvoiceRepository, aggregate_ref: aggregate.invoice, io_unit: single, verbs: [find_by_id, store, delete_by_id], store_semantics: upsert }",
    "      - { name: PaymentRepository, aggregate_ref: aggregate.payment, io_unit: collection, verbs: [find_by_id, store], store_semantics: insert-only }",
    "    restoration_paths:",
    "      - { aggregate_ref: aggregate.invoice, via: full-constructor }",
    `      - { aggregate_ref: aggregate.payment, via: full-constructor, note: ${JSON.stringify(PAYMENT_RESTORATION_NOTE)} }`,
    `    persistence_backend: ${JSON.stringify(PERSISTENCE_BACKEND)}`,
    "",
  ].join("\n");
}

/**
 * The same context with every value the legacy reader supplies on its own left unsaid: no `cqrs`,
 * a port with only a name, a repository with only a name and its aggregate, and a restoration path
 * with only its aggregate. The legacy reader accepts all of this and fills in `false`, `""`, `[]`
 * and `"unknown"`.
 */
export function legacyLayerYamlWithoutStatedDefaults(): string {
  return [
    "schema_version: 1",
    `model_ref: ${MODEL_REF}`,
    "layer_structures:",
    "  - context_ref: bc.billing",
    "    command_side_crates: [billing-domain]",
    "    query_side_crates: [billing-query]",
    "    rmu_crates: [billing-rmu]",
    "    crate_dependencies:",
    "      - { crate: billing-domain, depends_on: [] }",
    "      - { crate: billing-query, depends_on: [] }",
    "      - { crate: billing-rmu, depends_on: [billing-domain, billing-query] }",
    "    ports:",
    "      - { name: InvoiceNumbering }",
    "    repositories:",
    "      - { name: InvoiceRepository, aggregate_ref: aggregate.invoice }",
    "    restoration_paths:",
    "      - { aggregate_ref: aggregate.invoice }",
    `    persistence_backend: ${JSON.stringify(PERSISTENCE_BACKEND)}`,
    "",
  ].join("\n");
}

/** Everything the crate format leaves unsaid, named where it belongs, in document then key order. */
export const MISSING_FROM_SILENT_LEGACY: readonly string[] = [
  "layer_structures[bc.billing].cqrs",
  "layer_structures[bc.billing].ports[InvoiceNumbering].kind",
  "layer_structures[bc.billing].ports[InvoiceNumbering].verbs",
  "layer_structures[bc.billing].repositories[InvoiceRepository].io_unit",
  "layer_structures[bc.billing].repositories[InvoiceRepository].verbs",
  "layer_structures[bc.billing].repositories[InvoiceRepository].store_semantics",
  "layer_structures[bc.billing].restoration_paths[aggregate.invoice].via",
];

// ---------------------------------------------------------------------------
// The cicd-pipeline document
// ---------------------------------------------------------------------------

const DEFAULT_FENCE: Fence = { open: "```yaml", close: "```" };

/**
 * The pipeline prose, a build section whose own ```yaml fence is CI configuration rather than a
 * declaration, and the DDD heading. The prose spells the legacy keys, so every line here is a
 * region a migration must leave byte-for-byte alone.
 */
const PROSE_HEAD = [
  "# CI/CD パイプライン",
  "",
  `この本文は移行で書き換えない。\`${PROSE_LEGACY_SPELLING}\` と \`crate: billing-domain\` という字面は本文にも現れる。`,
  "",
  PROSE_LEGACY_SPELLING,
  "crate: billing-domain",
  "",
  "## ビルド",
  "",
  "```yaml",
  "jobs:",
  "  build:",
  "    steps:",
  "      - run: cargo build --workspace",
  "      - run: bun test",
  "```",
  "",
  `## ${ENGLISH_HEADING}`,
  "",
].join("\n");

const PROSE_TAIL = [
  "",
  "## 付記",
  "",
  "| 業務語 | 置き場所 |",
  "|---|---|",
  "| 請求 | `billing-domain` |",
  "| 入金 | `billing-query` |",
  "",
].join("\n");

export function declarationDocument(yaml: string, fence: Fence = DEFAULT_FENCE): string {
  return `${PROSE_HEAD}${fence.open}\n${yaml.trimEnd()}\n${fence.close}\n${PROSE_TAIL}`;
}

/** The same document under the Japanese section marker, which the reader accepts on its own. */
export function declarationDocumentInJapanese(yaml: string): string {
  return declarationDocument(yaml).replace(`## ${ENGLISH_HEADING}`, `## ${JAPANESE_HEADING}`);
}

/** Both section markers at once: neither section is the one authoritative declaration. */
export function declarationDocumentWithBothHeadings(yaml: string): string {
  return `${declarationDocument(yaml)}\n## ${JAPANESE_HEADING}\n\n\`\`\`yaml\n${yaml.trimEnd()}\n\`\`\`\n`;
}

export function declarationDocumentWithoutSection(yaml: string): string {
  return declarationDocument(yaml).replace(`## ${ENGLISH_HEADING}`, "## 層構造のメモ");
}

export function declarationDocumentWithoutBlock(): string {
  return `${PROSE_HEAD}${PROSE_TAIL}`;
}

export function declarationDocumentWithTwoBlocks(yaml: string): string {
  const body = `\`\`\`yaml\n${yaml.trimEnd()}\n\`\`\`\n`;
  return `${PROSE_HEAD}${body}\n${body}${PROSE_TAIL}`;
}

export function declarationDocumentWithUnclosedBlock(yaml: string): string {
  return `${PROSE_HEAD}\`\`\`yaml\n${yaml.trimEnd()}\n`;
}

/** An info string that only starts with yaml does not label a YAML block for the shared reader. */
export function declarationDocumentWithDecoratedInfoString(yaml: string): string {
  return `${PROSE_HEAD}\`\`\`yaml ddd-layer-structure\n${yaml.trimEnd()}\n\`\`\`\n${PROSE_TAIL}`;
}

/**
 * The DDD section holds a longer non-YAML fence that nests a declaration-shaped ```yaml fence and
 * nothing else. The nested fence is prose, so the section states no declaration at all.
 */
export function declarationDocumentWithNestedBlockOnly(): string {
  const nested = [
    "````text",
    "```yaml",
    "schema_version: 1",
    "layer_structures:",
    `  - { context_ref: bc.billing, ${PROSE_LEGACY_SPELLING} }`,
    "```",
    "````",
    "",
  ].join("\n");
  return `${PROSE_HEAD}${nested}${PROSE_TAIL}`;
}

// ---------------------------------------------------------------------------
// The use-case declaration beside it
// ---------------------------------------------------------------------------

/** The fields a use-case declaration may carry; none of them is a name a language spells. */
export const USE_CASE_KEYS: readonly string[] = [
  "use_case_id",
  "name",
  "target_aggregates",
  "commands",
  "re_execution_basis",
  "recovery_policy",
  "multi_aggregate_strategy",
  "read_model_exposure",
];

/** Keys a language would have to spell; the use-case declaration carries none of them. */
export const LANGUAGE_SPELLED_KEYS: readonly string[] = [
  "crate",
  "crates",
  "module",
  "package",
  "packages",
  "type",
  "method",
  "error_type",
  "code",
];

export function useCaseSource(): { schema_version: number; model_ref: string; use_cases: Record<string, unknown>[] } {
  return {
    schema_version: 1,
    model_ref: MODEL_REF,
    use_cases: [
      {
        use_case_id: "uc.issue-invoice",
        name: "請求書を発行する",
        target_aggregates: ["aggregate.invoice"],
        commands: ["command.invoice.issue"],
        re_execution_basis: "idempotency none",
        recovery_policy: "caller-retry",
        read_model_exposure: "invoice view",
      },
      {
        use_case_id: "uc.settle-payment",
        name: "入金を消し込む",
        target_aggregates: ["aggregate.payment"],
        commands: ["command.payment.settle"],
        re_execution_basis: "idempotency none",
        recovery_policy: "caller-retry",
        read_model_exposure: "payment view",
      },
    ],
  };
}

function useCaseDocument(): string {
  return [
    "# 機能仕様",
    "",
    "この節以外は宣言ではない。",
    "",
    `## ${USE_CASE_HEADING}`,
    "",
    "```yaml",
    renderYaml(useCaseSource()).trimEnd(),
    "```",
    "",
  ].join("\n");
}

// ---------------------------------------------------------------------------
// Workspace layout
// ---------------------------------------------------------------------------

interface RecordOptions {
  readonly modelVersion?: ModelVersion;
  readonly record?: string;
}

/** An intent record the shipped production sensors and the new reader can both be pointed at. */
export function recordFiles(declarationMarkdown: string, options: RecordOptions = {}): Record<string, string> {
  const record = options.record ?? RECORD_DIR;
  return {
    [`${record}/aidlc-state.md`]: STAGE_STATE,
    [`${record}/${MODEL_DATA_PATH}`]: modelDocument(canonicalModelYaml(options.modelVersion ?? 2)),
    [`${record}/${DECLARATION_PATH}`]: declarationMarkdown,
    [`${record}/${USE_CASE_PATH}`]: useCaseDocument(),
  };
}

/**
 * Files a layer migration must never touch: the CI configuration the pipeline actually runs, the
 * sibling design artifacts, a stray copy of the pipeline document and the project settings.
 */
export function untouchableUserFiles(): Record<string, string> {
  return {
    ".github/workflows/ci.yml": [
      "name: ci",
      "on: [push]",
      "jobs:",
      "  build:",
      "    runs-on: ubuntu-latest",
      "    steps:",
      "      - run: cargo build --workspace",
      "",
    ].join("\n"),
    [`${RECORD_DIR}/construction/u1/infrastructure-design/infrastructure-specification.md`]:
      "# インフラ仕様\n\n`crate: billing-domain` という字面はここにも現れる。\n",
    [STRAY_DECLARATION_FILE]: declarationDocument(legacyLayerYaml()),
    "notes/design.md": "# メモ\n\n`billing-domain` は請求の置き場所である。\n",
    ".ddd.toml":
      'schema_version = 2\nlanguages = ["rust", "typescript"]\n\n[rust]\nmodule_layout = "file"\n\n[typescript]\nmodule_layout = "named-file"\ncode_representation = "class"\n',
  };
}
