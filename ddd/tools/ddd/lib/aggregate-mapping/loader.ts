/**
 * loadAggregateMapping — reads one `ddd-aggregate-mapping.md` in the language-neutral format.
 *
 * The read stops at the first stage that fails: the document, its version, its shape, the canonical
 * model it names, and only then the mapping against that model. The version is never guessed and a
 * legacy document is never read as this format; it is refused with a pointer to the migration.
 */

import type { ElementIndex } from "../schema/index-builder.ts";
import { loadDomainModel, OPERATION_OWNED_SCHEMA_VERSION } from "../schema/loader.ts";
import type { DomainModel } from "../schema/model.ts";
import { resolveModelPath } from "../sensors/declaration.ts";
import type { FindingInput } from "../shared/findings.ts";
import { own } from "../shared/yaml-read.ts";
import {
  type ImplementationMapping,
  LEGACY_MAPPING_SCHEMA_VERSION,
  MAPPING_RULES,
  MAPPING_SCHEMA_VERSION,
} from "./contract.ts";
import { type MappingDocument, readMappingDocument } from "./document.ts";
import { readMappingDraft } from "./reader.ts";
import { validateMapping } from "./validation.ts";

export type MappingLoadResult =
  | {
      readonly ok: true;
      readonly mapping: ImplementationMapping;
      /** The canonical model the mapping names, so a caller never re-reads it to check the same thing. */
      readonly model: DomainModel;
      readonly index: ElementIndex;
    }
  | { readonly ok: false; readonly findings: readonly FindingInput[] };

export type ModelLoad =
  | { readonly ok: true; readonly model: DomainModel; readonly index: ElementIndex }
  | { readonly ok: false; readonly findings: readonly FindingInput[] };

/**
 * How the canonical model a mapping names is obtained. The gates read it from disk; a migration that
 * converts a whole set hands over the model of that set, which is not on disk in this format yet.
 */
export type ReferencedModelResolver = (document: MappingDocument, modelRef: string) => ModelLoad;

export function declaredVersion(document: MappingDocument): unknown {
  return own(document.root, "schema_version");
}

export function versionFinding(document: MappingDocument): FindingInput {
  const version = declaredVersion(document);
  const message =
    version === LEGACY_MAPPING_SCHEMA_VERSION
      ? `schema_version ${LEGACY_MAPPING_SCHEMA_VERSION} is the Rust-only crate/module format; convert the whole record with \`ddd-artifact-set migrate\`, or this document alone with \`ddd-aggregate-mapping migrate\``
      : version === undefined
        ? `schema_version ${MAPPING_SCHEMA_VERSION} is required`
        : `schema_version must be ${MAPPING_SCHEMA_VERSION}, got ${JSON.stringify(version)}`;
  return { rule_id: MAPPING_RULES.version, file: document.path, message };
}

/**
 * The canonical model `modelRef` names, read in the operation-owned format only: a factory rule
 * owns business errors there and nowhere else, and the mapping has to name them. Every refusal is
 * reported against the mapping document, which is where the reference is written.
 */
export function loadReferencedModel(document: MappingDocument, modelRef: string): ModelLoad {
  const modelPath = resolveModelPath(document.recordDir, modelRef);
  const loaded = loadDomainModel(modelPath, OPERATION_OWNED_SCHEMA_VERSION);
  if (loaded.ok) return loaded;
  return {
    ok: false,
    findings: loaded.findings.map((entry) => ({
      rule_id: MAPPING_RULES.model,
      file: document.path,
      message: `model_ref ${modelRef} does not load as a schema_version ${OPERATION_OWNED_SCHEMA_VERSION} canonical model (migrate it first with \`ddd-domain-model migrate\`): ${entry.rule_id}: ${entry.message}`,
    })),
  };
}

/** The schema_version 2 read of a document already opened, shared with the migration's re-run check. */
export function loadMappingDocument(
  document: MappingDocument,
  resolveModel: ReferencedModelResolver,
): MappingLoadResult {
  if (declaredVersion(document) !== MAPPING_SCHEMA_VERSION) return { ok: false, findings: [versionFinding(document)] };
  const read = readMappingDraft(document.root, document.path);
  if (read.kind === "rejected") return { ok: false, findings: read.findings };
  const model = resolveModel(document, read.draft.model_ref);
  if (!model.ok) return model;
  const validation = validateMapping(read.draft, model.model, model.index, {
    document: document.path,
    names: document.path,
  });
  if (!validation.complete) {
    const gaps = validation.missing.map((missing) => ({
      rule_id: MAPPING_RULES.coverage,
      file: document.path,
      message: `${missing} is required by the canonical model but not mapped`,
    }));
    return { ok: false, findings: [...validation.findings, ...gaps] };
  }
  if (validation.findings.length > 0) return { ok: false, findings: validation.findings };
  return { ok: true, mapping: validation.mapping, model: model.model, index: model.index };
}

export function loadAggregateMapping(path: string): MappingLoadResult {
  const read = readMappingDocument(path);
  if (read.kind === "rejected") return { ok: false, findings: read.findings };
  return loadMappingDocument(read.document, loadReferencedModel);
}
