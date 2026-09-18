/**
 * Converts one `ddd-aggregate-mapping.md` from the Rust-only crate/module format to the
 * language-neutral one.
 *
 * Only what the legacy document states is carried over, and it is carried over unchanged. The type,
 * operation and error-case names it has no place for come from an explicit supplement file and from
 * nowhere else: never from the model's names or ids. Until they are all given, the migration
 * reports them as missing and writes nothing. A defect in what is given is reported ahead of what is
 * still missing. Applying re-reads and re-validates both files, so an earlier successful preview
 * never authorises a later change.
 */

import type { FindingInput } from "../shared/findings.ts";
import type { WriteOutcome } from "../shared/markdown-document.ts";
import { type ImplementationMapping, LEGACY_MAPPING_SCHEMA_VERSION, MAPPING_SCHEMA_VERSION } from "./contract.ts";
import { type MappingDocument, readMappingDocument, writeMappingDocument } from "./document.ts";
import { convertLegacyMapping } from "./legacy.ts";
import {
  declaredVersion,
  loadMappingDocument,
  loadReferencedModel,
  type ReferencedModelResolver,
  versionFinding,
} from "./loader.ts";
import { readMappingDraft } from "./reader.ts";
import { renderMappingYaml } from "./render.ts";
import { readSupplement, withSuppliedNames } from "./supplement.ts";
import { validateMapping } from "./validation.ts";

export type MappingMigrationOutcome =
  | { readonly kind: "candidate"; readonly mapping: ImplementationMapping }
  | { readonly kind: "already-migrated"; readonly mapping: ImplementationMapping }
  | { readonly kind: "applied"; readonly mapping: ImplementationMapping }
  | { readonly kind: "missing-information"; readonly missing: readonly string[] }
  | { readonly kind: "rejected"; readonly findings: readonly FindingInput[] }
  | { readonly kind: "write-failed"; readonly detail: string };

export interface MappingCandidate {
  readonly kind: "candidate";
  readonly mapping: ImplementationMapping;
  readonly document: MappingDocument;
}

export type MappingAssessment =
  | MappingCandidate
  | Extract<MappingMigrationOutcome, { kind: "already-migrated" | "missing-information" | "rejected" }>;

function rejected(findings: readonly FindingInput[]): MappingAssessment {
  return { kind: "rejected", findings };
}

function assessLegacy(
  document: MappingDocument,
  supplementPath: string | null,
  resolveModel: ReferencedModelResolver,
): MappingAssessment {
  const converted = convertLegacyMapping(document);
  if (converted.kind === "rejected") return rejected(converted.findings);
  const read = readMappingDraft(converted.root, document.path);
  if (read.kind === "rejected") return rejected(read.findings);
  const model = resolveModel(document, read.draft.model_ref);
  if (!model.ok) return rejected(model.findings);
  const supplement = readSupplement(supplementPath, read.draft);
  if (supplement.kind === "rejected") return rejected(supplement.findings);

  const validation = validateMapping(withSuppliedNames(read.draft, supplement), model.model, model.index, {
    document: document.path,
    // Type, operation and error-case names come from the supplement when one is given; without one
    // the legacy document is their only source, and it names none.
    names: supplementPath ?? document.path,
  });
  if (validation.findings.length > 0) return rejected(validation.findings);
  if (!validation.complete) return { kind: "missing-information", missing: validation.missing };
  return { kind: "candidate", mapping: validation.mapping, document };
}

/**
 * What converting `mappingPath` would do, without writing anything. `resolveModel` supplies the
 * canonical model the document names, so a set migration can check the mapping against the model it
 * is about to write rather than against the one still on disk.
 */
export function assessMappingMigration(
  mappingPath: string,
  supplementPath: string | null,
  resolveModel: ReferencedModelResolver,
): MappingAssessment {
  const read = readMappingDocument(mappingPath);
  if (read.kind === "rejected") return rejected(read.findings);
  const { document } = read;
  const version = declaredVersion(document);
  // A migrated document needs no supplement, so the one given is not even read.
  if (version === MAPPING_SCHEMA_VERSION) {
    const loaded = loadMappingDocument(document, resolveModel);
    return loaded.ok ? { kind: "already-migrated", mapping: loaded.mapping } : rejected(loaded.findings);
  }
  if (version !== LEGACY_MAPPING_SCHEMA_VERSION) return rejected([versionFinding(document)]);
  return assessLegacy(document, supplementPath, resolveModel);
}

/** Replaces the document's YAML body with the candidate; the only write this module performs. */
export function writeMappingCandidate(candidate: MappingCandidate): WriteOutcome {
  return writeMappingDocument(candidate.document, renderMappingYaml(candidate.mapping));
}

export function previewMappingMigration(mappingPath: string, supplementPath: string | null): MappingMigrationOutcome {
  const assessment = assessMappingMigration(mappingPath, supplementPath, loadReferencedModel);
  return assessment.kind === "candidate" ? { kind: "candidate", mapping: assessment.mapping } : assessment;
}

export function applyMappingMigration(mappingPath: string, supplementPath: string | null): MappingMigrationOutcome {
  const assessment = assessMappingMigration(mappingPath, supplementPath, loadReferencedModel);
  if (assessment.kind !== "candidate") return assessment;
  const written = writeMappingCandidate(assessment);
  if (written.kind === "write-failed") return { kind: "write-failed", detail: written.detail };
  return { kind: "applied", mapping: assessment.mapping };
}
