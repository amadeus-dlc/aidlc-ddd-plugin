/**
 * Converts one `ddd-domain-model-yaml.md` from the legacy format to the operation-owned one.
 *
 * Only what the legacy document already states is carried over: element ids, references, condition
 * texts and the language they were written in. A factory rule's business errors are not in the
 * legacy format at all, so they are reported as missing rather than invented, and nothing is
 * written. Applying re-reads and re-validates, so an earlier successful preview never authorises a
 * later invalid document.
 */

import type { ElementIndex } from "../schema/index-builder.ts";
import { LEGACY_SCHEMA_VERSION, loadDomainModel, OPERATION_OWNED_SCHEMA_VERSION } from "../schema/loader.ts";
import type { DomainModel } from "../schema/model.ts";
import type { FindingInput } from "../shared/findings.ts";
import {
  type ModelDocument,
  migratedDocumentText,
  readModelDocument,
  type WriteOutcome,
  writeMigratedDocument,
  writeMigratedDocumentInRecord,
} from "./document.ts";
import { renderModelYaml } from "./render.ts";

export type ModelMigrationOutcome =
  | { readonly kind: "candidate"; readonly model: DomainModel }
  | { readonly kind: "already-migrated"; readonly model: DomainModel }
  | { readonly kind: "applied"; readonly model: DomainModel }
  | { readonly kind: "missing-information"; readonly missing: readonly string[] }
  | { readonly kind: "rejected"; readonly findings: readonly FindingInput[] }
  | { readonly kind: "write-failed"; readonly detail: string };

export interface ModelCandidate {
  readonly kind: "candidate";
  readonly model: DomainModel;
  readonly index: ElementIndex;
  readonly document: ModelDocument;
}

/**
 * What converting one document would do. It carries the element index of the model it read, so a
 * caller converting a whole set can check the artifacts that name this model against it without
 * reading the document a second time. The ids the legacy format registers are the ids the
 * operation-owned format registers, so one index answers for both.
 */
export type ModelAssessment =
  | ModelCandidate
  | { readonly kind: "already-migrated"; readonly model: DomainModel; readonly index: ElementIndex }
  | {
      readonly kind: "missing-information";
      readonly missing: readonly string[];
      readonly model: DomainModel;
      readonly index: ElementIndex;
    }
  | { readonly kind: "rejected"; readonly findings: readonly FindingInput[] };

function refuse(path: string, message: string): ModelAssessment {
  return { kind: "rejected", findings: [{ rule_id: "schema.structure", file: path, message }] };
}

/** Business definitions the legacy format has no place to record, named by where they belong. */
function missingDefinitions(model: DomainModel): string[] {
  const missing: string[] = [];
  for (const context of model.bounded_contexts) {
    for (const aggregate of context.aggregates) {
      for (const factory of aggregate.factory_rules) {
        if (factory.domain_errors.length === 0) missing.push(`${factory.element_id}.domain_errors`);
      }
    }
  }
  return missing;
}

export function assessModelMigration(path: string): ModelAssessment {
  const read = readModelDocument(path);
  if (read.kind === "rejected") return { kind: "rejected", findings: read.findings };
  const document = read.document;

  if (document.declaredVersion === OPERATION_OWNED_SCHEMA_VERSION) {
    const loaded = loadDomainModel(path, OPERATION_OWNED_SCHEMA_VERSION);
    if (!loaded.ok) return { kind: "rejected", findings: loaded.findings };
    return { kind: "already-migrated", model: loaded.model, index: loaded.index };
  }
  if (document.declaredVersion !== LEGACY_SCHEMA_VERSION)
    return refuse(
      path,
      `schema_version must be ${LEGACY_SCHEMA_VERSION} to migrate or ${OPERATION_OWNED_SCHEMA_VERSION} to be already migrated, got ${JSON.stringify(document.declaredVersion)}`,
    );

  const loaded = loadDomainModel(path, LEGACY_SCHEMA_VERSION);
  if (!loaded.ok) return { kind: "rejected", findings: loaded.findings };
  const missing = missingDefinitions(loaded.model);
  if (missing.length > 0) return { kind: "missing-information", missing, model: loaded.model, index: loaded.index };
  // The loader normalises the legacy ownership key, so the candidate differs only by its version.
  return {
    kind: "candidate",
    model: { ...loaded.model, schema_version: OPERATION_OWNED_SCHEMA_VERSION },
    index: loaded.index,
    document,
  };
}

/** The document as the candidate would be written; the text a caller may read back before writing. */
export function renderModelCandidate(candidate: ModelCandidate): string {
  return migratedDocumentText(candidate.document, renderModelYaml(candidate.model));
}

/** Replaces the document's YAML body with the candidate, wherever the single-document command was pointed. */
function writeModelCandidate(candidate: ModelCandidate): WriteOutcome {
  return writeMigratedDocument(candidate.document, renderModelYaml(candidate.model));
}

/**
 * The same replacement for a candidate read from its registered location in `recordDir`, which a
 * caller converting a whole record has proven and a path given on its own never states. This module
 * keeps owning the write of its own document, as the mapping and the declaration modules do.
 */
export function writeModelCandidateInRecord(candidate: ModelCandidate, recordDir: string): WriteOutcome {
  return writeMigratedDocumentInRecord(candidate.document, recordDir, renderModelYaml(candidate.model));
}

/** The assessment as the command reports it: the index it carried is an internal aid, not a result. */
function reported(assessment: ModelAssessment): ModelMigrationOutcome {
  switch (assessment.kind) {
    case "candidate":
      return { kind: "candidate", model: assessment.model };
    case "already-migrated":
      return { kind: "already-migrated", model: assessment.model };
    case "missing-information":
      return { kind: "missing-information", missing: assessment.missing };
    case "rejected":
      return assessment;
  }
}

export function previewModelMigration(path: string): ModelMigrationOutcome {
  return reported(assessModelMigration(path));
}

export function applyModelMigration(path: string): ModelMigrationOutcome {
  const assessment = assessModelMigration(path);
  if (assessment.kind !== "candidate") return reported(assessment);
  const written = writeModelCandidate(assessment);
  if (written.kind === "write-failed") return { kind: "write-failed", detail: written.detail };
  return { kind: "applied", model: assessment.model };
}
