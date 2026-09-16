/**
 * Converts one `ddd-domain-model-yaml.md` from the legacy format to the operation-owned one.
 *
 * Only what the legacy document already states is carried over: element ids, references, condition
 * texts and the language they were written in. A factory rule's business errors are not in the
 * legacy format at all, so they are reported as missing rather than invented, and nothing is
 * written. Applying re-reads and re-validates, so an earlier successful preview never authorises a
 * later invalid document.
 */

import {
  LEGACY_SCHEMA_VERSION,
  loadDomainModel,
  OPERATION_OWNED_SCHEMA_VERSION,
  type SchemaVersion,
} from "../schema/loader.ts";
import type { DomainModel } from "../schema/model.ts";
import type { FindingInput } from "../shared/findings.ts";
import { type ModelDocument, readModelDocument, writeMigratedDocument } from "./document.ts";
import { renderModelYaml } from "./render.ts";

export type ModelMigrationOutcome =
  | { readonly kind: "candidate"; readonly model: DomainModel }
  | { readonly kind: "already-migrated"; readonly model: DomainModel }
  | { readonly kind: "applied"; readonly model: DomainModel }
  | { readonly kind: "missing-information"; readonly missing: readonly string[] }
  | { readonly kind: "rejected"; readonly findings: readonly FindingInput[] }
  | { readonly kind: "write-failed"; readonly detail: string };

type Assessment =
  | { readonly kind: "candidate"; readonly model: DomainModel; readonly document: ModelDocument }
  | Extract<ModelMigrationOutcome, { kind: "already-migrated" | "missing-information" | "rejected" }>;

function refuse(path: string, message: string): Assessment {
  return { kind: "rejected", findings: [{ rule_id: "schema.structure", file: path, message }] };
}

/** Loads through the same entry point the tests and sensors use, so one validator decides. */
function loadAs(path: string, version: SchemaVersion): { model: DomainModel } | { findings: FindingInput[] } {
  const loaded = loadDomainModel(path, version);
  return loaded.ok ? { model: loaded.model } : { findings: loaded.findings };
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

function assess(path: string): Assessment {
  const read = readModelDocument(path);
  if (read.kind === "rejected") return { kind: "rejected", findings: read.findings };
  const document = read.document;

  if (document.declaredVersion === OPERATION_OWNED_SCHEMA_VERSION) {
    const loaded = loadAs(path, OPERATION_OWNED_SCHEMA_VERSION);
    if ("findings" in loaded) return { kind: "rejected", findings: loaded.findings };
    return { kind: "already-migrated", model: loaded.model };
  }
  if (document.declaredVersion !== LEGACY_SCHEMA_VERSION)
    return refuse(
      path,
      `schema_version must be ${LEGACY_SCHEMA_VERSION} to migrate or ${OPERATION_OWNED_SCHEMA_VERSION} to be already migrated, got ${JSON.stringify(document.declaredVersion)}`,
    );

  const loaded = loadAs(path, LEGACY_SCHEMA_VERSION);
  if ("findings" in loaded) return { kind: "rejected", findings: loaded.findings };
  const missing = missingDefinitions(loaded.model);
  if (missing.length > 0) return { kind: "missing-information", missing };
  // The loader normalises the legacy ownership key, so the candidate differs only by its version.
  return { kind: "candidate", model: { ...loaded.model, schema_version: OPERATION_OWNED_SCHEMA_VERSION }, document };
}

export function previewModelMigration(path: string): ModelMigrationOutcome {
  const assessment = assess(path);
  return assessment.kind === "candidate" ? { kind: "candidate", model: assessment.model } : assessment;
}

export function applyModelMigration(path: string): ModelMigrationOutcome {
  const assessment = assess(path);
  if (assessment.kind !== "candidate") return assessment;
  const written = writeMigratedDocument(assessment.document, renderModelYaml(assessment.model));
  if (written.kind === "write-failed") return { kind: "write-failed", detail: written.detail };
  return { kind: "applied", model: assessment.model };
}
