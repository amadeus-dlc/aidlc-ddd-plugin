/**
 * loadLayerDeclaration — reads the DDD layer section of one `cicd-pipeline.md` in the
 * language-neutral format.
 *
 * The read stops at the first stage that fails: the document, its version, its shape, the canonical
 * model it names, the declaration against that model, and only then whether the declaration says
 * everything the format requires. The version is never guessed and a crate-fixed document is never
 * read as this format; it is refused with a pointer to the migration.
 */

import type { ElementIndex } from "../schema/index-builder.ts";
import { loadDomainModel, OPERATION_OWNED_SCHEMA_VERSION } from "../schema/loader.ts";
import type { DomainModel } from "../schema/model.ts";
import { resolveModelPath } from "../sensors/declaration.ts";
import type { FindingInput } from "../shared/findings.ts";
import { own } from "../shared/yaml-read.ts";
import { LAYER_RULES, LAYER_SCHEMA_VERSION, type LayerDeclaration, LEGACY_LAYER_SCHEMA_VERSION } from "./contract.ts";
import { type LayerDocument, readLayerDocument } from "./document.ts";
import { completeDeclaration, readLayerDraft } from "./reader.ts";
import { validateLayerDraft } from "./validation.ts";

export type LayerLoadResult =
  | {
      readonly ok: true;
      readonly declaration: LayerDeclaration;
      /** The canonical model the declaration names, which the structural inspection checks against. */
      readonly model: DomainModel;
      readonly index: ElementIndex;
    }
  | { readonly ok: false; readonly findings: readonly FindingInput[] };

type ModelLoad =
  | { readonly ok: true; readonly model: DomainModel; readonly index: ElementIndex }
  | { readonly ok: false; readonly findings: readonly FindingInput[] };

export function declaredVersion(document: LayerDocument): unknown {
  return own(document.root, "schema_version");
}

export function versionFinding(document: LayerDocument): FindingInput {
  const version = declaredVersion(document);
  const message =
    version === LEGACY_LAYER_SCHEMA_VERSION
      ? `schema_version ${LEGACY_LAYER_SCHEMA_VERSION} is the Rust-only crate format; migrate it with \`ddd-layer-declaration migrate\``
      : version === undefined
        ? `schema_version ${LAYER_SCHEMA_VERSION} is required`
        : `schema_version must be ${LAYER_SCHEMA_VERSION}, got ${JSON.stringify(version)}`;
  return { rule_id: LAYER_RULES.version, file: document.path, message };
}

/**
 * The canonical model `modelRef` names, read in the operation-owned format only, so one record never
 * holds a declaration of this format beside a model of the older one. Every refusal is reported
 * against the declaration document, which is where the reference is written.
 */
export function loadReferencedModel(document: LayerDocument, modelRef: string): ModelLoad {
  const loaded = loadDomainModel(resolveModelPath(document.recordDir, modelRef), OPERATION_OWNED_SCHEMA_VERSION);
  if (loaded.ok) return loaded;
  return {
    ok: false,
    findings: loaded.findings.map((entry) => ({
      rule_id: LAYER_RULES.model,
      file: document.path,
      message: `model_ref ${modelRef} does not load as a schema_version ${OPERATION_OWNED_SCHEMA_VERSION} canonical model (migrate it first with \`ddd-domain-model migrate\`): ${entry.rule_id}: ${entry.message}`,
    })),
  };
}

/** The schema_version 2 read of a document already opened, shared with the migration's re-run check. */
export function loadLayerDocument(document: LayerDocument): LayerLoadResult {
  if (declaredVersion(document) !== LAYER_SCHEMA_VERSION) return { ok: false, findings: [versionFinding(document)] };
  const read = readLayerDraft(document.root, document.path);
  if (read.kind === "rejected") return { ok: false, findings: read.findings };
  const model = loadReferencedModel(document, read.draft.model_ref);
  if (!model.ok) return model;
  const defects = validateLayerDraft(read.draft, model.index, document.path);
  if (defects.length > 0) return { ok: false, findings: defects };
  const completion = completeDeclaration(read.draft);
  // In this format a value the document does not state is a value it has to state: only a migration
  // from the crate format, which never had a place for these, reports them as information to supply.
  if (!completion.complete)
    return {
      ok: false,
      findings: completion.missing.map((missing) => ({
        rule_id: LAYER_RULES.structure,
        file: document.path,
        message: `${missing} is not stated`,
      })),
    };
  return { ok: true, declaration: completion.declaration, model: model.model, index: model.index };
}

export function loadLayerDeclaration(path: string): LayerLoadResult {
  const read = readLayerDocument(path);
  if (read.kind === "rejected") return { ok: false, findings: read.findings };
  return loadLayerDocument(read.document);
}
