/**
 * Workspace fixtures for the artifact-set migration suite: one project whose settings, canonical
 * model, implementation mapping and layer declarations are all still in the Rust-only format.
 *
 * The documents come from the single-artifact fixtures, so each keeps the prose, the other fences
 * and the Japanese business wording those suites already prove a migration leaves alone. Both
 * layer declaration layouts are present: the one a Unit writes, and the one a workflow without
 * Units writes straight under the stage, under the Japanese section marker and a tilde fence.
 */

import { MAPPING_DATA_PATH, MODEL_DATA_PATH, MODEL_VIEW_FILE } from "../../../tools/ddd/lib/schema/artifacts.ts";
import {
  canonicalModelYaml,
  edit,
  legacyMappingYaml,
  mappingDocument,
  renderYaml,
  type SupplementSource,
  supplementSource,
} from "../aggregate-mapping/workspace.ts";
import { modelDocument } from "../domain-model/workspace.ts";
import {
  declarationDocument,
  JAPANESE_HEADING,
  legacyLayerYaml,
  recordFiles as layerRecordFiles,
} from "../layer-declaration/workspace.ts";
import { legacyDocument } from "../project-settings/workspace.ts";

export const RECORD_DIR = "aidlc/spaces/default/intents/i1";
export const STATE_FILE = "aidlc-state.md";
export const SETTINGS_FILE = ".ddd.toml";
export const SUPPLEMENT_FILE = "mapping-supplement.yaml";

/** Record-relative locations of the artifacts one set migration converts. */
export const MODEL_PATH = MODEL_DATA_PATH;
export const VIEW_PATH = `inception/ddd-domain-modeling/${MODEL_VIEW_FILE}`;
export const MAPPING_PATH = MAPPING_DATA_PATH;
export const COMPONENTS_PATH = "inception/domain-design/components.md";
/**
 * A copy of the legacy model kept outside the record, so a registered location can be aimed at a
 * file the migration has no standing to rewrite.
 */
export const STRAY_MODEL_FILE = "drafts/ddd-domain-model-yaml.md";
export const UNIT_LAYER_PATH = "construction/u1/infrastructure-design/cicd-pipeline.md";
export const STAGE_LAYER_PATH = "construction/infrastructure-design/cicd-pipeline.md";
export const USE_CASE_PATH = "construction/u1/functional-design/functional-spec.md";

const PAYMENT_STATEMENT = "入金額は負であってはならない。";
const INVOICE_STATEMENT = "請求金額は負であってはならない。";

const FACTORY_RULE = [
  "        factory_rules:",
  "          - element_id: factory.invoice.open",
  "            name: Open",
  "            target_element: entity.invoice",
  "            preconditions: [invariant.invoice.total-positive]",
  "",
].join("\n");

const PAYMENT_ELEMENTS =
  "          - { element_id: entity.payment, kind: entity, name: Payment, aggregate: aggregate.payment }\n";

/**
 * The legacy model the mapping and layer fixtures name. The payment aggregate gets an invariant so
 * the model gate has nothing to report once the model is migrated. Without the factory rule the
 * legacy format states everything the operation-owned one needs.
 */
export function legacyModelYaml(options: { readonly withFactory?: boolean } = {}): string {
  const withInvariant = edit(
    canonicalModelYaml(1),
    PAYMENT_ELEMENTS,
    [
      PAYMENT_ELEMENTS.trimEnd(),
      "        invariants:",
      "          - element_id: invariant.payment.non-negative",
      "            name: NonNegative",
      "            aggregate: aggregate.payment",
      `            statement: ${JSON.stringify(PAYMENT_STATEMENT)}`,
      "",
    ].join("\n"),
  );
  return options.withFactory ? withInvariant : edit(withInvariant, FACTORY_RULE, "");
}

const MODEL_IDS = [
  "bc.billing",
  "aggregate.invoice",
  "entity.invoice",
  "invariant.invoice.total-positive",
  "command.invoice.issue",
  "error.invoice.issue.already-issued",
  "error.invoice.issue.empty-lines",
  "event.invoice.issued",
  "transition.invoice.issue",
  "command.invoice.cancel",
  "error.invoice.cancel.already-cancelled",
  "aggregate.payment",
  "entity.payment",
  "invariant.payment.non-negative",
  "command.payment.settle",
  "error.payment.settle.already-settled",
];

/** The review document the model gate cross-checks: every element id and both invariant statements. */
export function viewDocument(): string {
  const ids = MODEL_IDS.map((id) => `- ${id}`).join("\n");
  return `# 正規モデル（レビュー用）\n\n${ids}\n\n- ${INVOICE_STATEMENT}\n- ${PAYMENT_STATEMENT}\n`;
}

/**
 * The supplement for the legacy mapping. A model without its factory rule has no operation to name
 * for it; a model that keeps the rule is named with no error case, since the legacy format gives the
 * rule none to map.
 */
export function supplementFor(options: { readonly withFactory?: boolean } = {}): SupplementSource {
  const source = supplementSource();
  for (const row of source.aggregate_mappings) {
    const operations = row.operations ?? [];
    row.operations = options.withFactory
      ? operations.map((operation) =>
          operation.operation_ref === "factory.invoice.open" ? { ...operation, errors: [] } : operation,
        )
      : operations.filter((operation) => operation.operation_ref !== "factory.invoice.open");
  }
  return source;
}

/**
 * The CI section of the pipeline document also carries an unlabelled fence whose text spells a
 * legacy layer key. Only the labelled block under the DDD heading is a declaration.
 */
export const UNLABELLED_CI_FENCE = "```\ncrate_dependencies:\n  - { crate: billing-domain, depends_on: [] }\n```\n";

export function unitLayerDocument(yaml: string = legacyLayerYaml()): string {
  return edit(declarationDocument(yaml), "## DDD Layer Structure", `${UNLABELLED_CI_FENCE}\n## DDD Layer Structure`);
}

export function stageLayerDocument(yaml: string = legacyLayerYaml()): string {
  return edit(
    declarationDocument(yaml, { open: "~~~yaml", close: "~~~" }),
    "## DDD Layer Structure",
    `## ${JAPANESE_HEADING}`,
  );
}

export interface LegacySetOptions {
  readonly withFactory?: boolean;
  /** `null` leaves the document out. */
  readonly model?: string | null;
  readonly mapping?: string | null;
  readonly unitLayer?: string | null;
  readonly stageLayer?: string | null;
  readonly settings?: string | null;
  readonly supplement?: SupplementSource | null;
}

function present(entries: readonly (readonly [string, string | null])[]): Record<string, string> {
  const files: Record<string, string> = {};
  for (const [path, content] of entries) if (content !== null) files[path] = content;
  return files;
}

/** Record-relative files of the legacy record, including its state file. */
export function legacyRecordFiles(options: LegacySetOptions = {}): Record<string, string> {
  // The layer fixtures already carry the state file and the use-case declaration a record holds.
  const layerRecord = layerRecordFiles("", { record: RECORD_DIR });
  return present([
    [STATE_FILE, layerRecord[`${RECORD_DIR}/${STATE_FILE}`]],
    [MODEL_PATH, options.model === undefined ? modelDocument(legacyModelYaml(options)) : options.model],
    [VIEW_PATH, viewDocument()],
    [MAPPING_PATH, options.mapping === undefined ? mappingDocument(legacyMappingYaml()) : options.mapping],
    [COMPONENTS_PATH, "# コンポーネント\n"],
    [UNIT_LAYER_PATH, options.unitLayer === undefined ? unitLayerDocument() : options.unitLayer],
    [STAGE_LAYER_PATH, options.stageLayer === undefined ? stageLayerDocument() : options.stageLayer],
    [USE_CASE_PATH, layerRecord[`${RECORD_DIR}/${USE_CASE_PATH}`]],
  ]);
}

/**
 * Project-root files: the settings, a Cargo package laid out in the `file` mode the settings
 * select, the supplement, and files no migration may touch.
 */
export function legacyProjectFiles(options: LegacySetOptions = {}): Record<string, string> {
  const supplement = options.supplement === undefined ? supplementFor(options) : options.supplement;
  return present([
    [SETTINGS_FILE, options.settings === undefined ? legacyDocument("file") : options.settings],
    ["Cargo.toml", '[package]\nname = "billing"\nversion = "0.1.0"\nedition = "2021"\n'],
    ["src/lib.rs", "mod invoice;\n"],
    ["src/invoice.rs", "pub struct Invoice;\n"],
    [SUPPLEMENT_FILE, supplement === null ? null : renderYaml(supplement)],
    [".github/workflows/ci.yml", "name: ci\non: [push]\njobs:\n  build:\n    runs-on: ubuntu-latest\n"],
    ["notes/design.md", "# メモ\n\n`crate: billing-domain` と `module: crate` はここにも現れる。\n"],
    ["drafts/cicd-pipeline.md", unitLayerDocument()],
    [STRAY_MODEL_FILE, modelDocument(legacyModelYaml(options))],
  ]);
}

/** The whole project: project files at the root, record files under the record directory. */
export function legacySetFiles(options: LegacySetOptions = {}): Record<string, string> {
  const files = legacyProjectFiles(options);
  for (const [path, content] of Object.entries(legacyRecordFiles(options))) files[`${RECORD_DIR}/${path}`] = content;
  return files;
}
