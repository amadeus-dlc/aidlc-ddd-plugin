/**
 * Converts the DDD layer section of one `cicd-pipeline.md` from the Rust-only crate format to the
 * language-neutral one.
 *
 * Only what the crate-fixed declaration states is carried over, and it is carried over unchanged:
 * the conversion is structural, so a value whose own wording spells a legacy key comes through as
 * business wording rather than as something to rewrite. What that format had no place for — whether
 * the context is cqrs, what a port is and does, how a repository reads and stores, how an aggregate
 * is rebuilt — is reported as missing and never invented, and until it is all stated nothing is
 * written. A defect in what is stated is reported ahead of what is still missing. Applying re-reads
 * and re-validates the document, so an earlier successful preview never authorises a later change.
 */

import type { FindingInput } from "../shared/findings.ts";
import type { WriteOutcome } from "../shared/markdown-document.ts";
import { LAYER_SCHEMA_VERSION, type LayerDeclaration, LEGACY_LAYER_SCHEMA_VERSION } from "./contract.ts";
import { type LayerDocument, readLayerDocument, writeLayerDocument } from "./document.ts";
import { convertLegacyDeclaration } from "./legacy.ts";
import {
  declaredVersion,
  loadLayerDocument,
  loadReferencedModel,
  type ReferencedModelResolver,
  versionFinding,
} from "./loader.ts";
import { completeDeclaration, readLayerDraft } from "./reader.ts";
import { renderLayerYaml } from "./render.ts";
import { validateLayerDraft } from "./validation.ts";

export type LayerMigrationOutcome =
  | { readonly kind: "candidate"; readonly declaration: LayerDeclaration }
  | { readonly kind: "already-migrated"; readonly declaration: LayerDeclaration }
  | { readonly kind: "applied"; readonly declaration: LayerDeclaration }
  | { readonly kind: "missing-information"; readonly missing: readonly string[] }
  | { readonly kind: "rejected"; readonly findings: readonly FindingInput[] }
  | { readonly kind: "write-failed"; readonly detail: string };

export interface LayerCandidate {
  readonly kind: "candidate";
  readonly declaration: LayerDeclaration;
  readonly document: LayerDocument;
}

export type LayerAssessment =
  | LayerCandidate
  | Extract<LayerMigrationOutcome, { kind: "already-migrated" | "missing-information" | "rejected" }>;

function rejected(findings: readonly FindingInput[]): LayerAssessment {
  return { kind: "rejected", findings };
}

function assessLegacy(document: LayerDocument, resolveModel: ReferencedModelResolver): LayerAssessment {
  const converted = convertLegacyDeclaration(document);
  if (converted.kind === "rejected") return rejected(converted.findings);
  const read = readLayerDraft(converted.root, document.path);
  if (read.kind === "rejected") return rejected(read.findings);
  const model = resolveModel(document, read.draft.model_ref);
  if (!model.ok) return rejected(model.findings);
  const defects = validateLayerDraft(read.draft, model.index, document.path);
  if (defects.length > 0) return rejected(defects);
  const completion = completeDeclaration(read.draft);
  if (!completion.complete) return { kind: "missing-information", missing: completion.missing };
  return { kind: "candidate", declaration: completion.declaration, document };
}

/**
 * What converting `declarationPath` would do, without writing anything. `resolveModel` supplies the
 * canonical model the declaration names, so a set migration can check it against the model it is
 * about to write rather than against the one still on disk.
 */
export function assessLayerMigration(declarationPath: string, resolveModel: ReferencedModelResolver): LayerAssessment {
  const read = readLayerDocument(declarationPath);
  if (read.kind === "rejected") return rejected(read.findings);
  const { document } = read;
  const version = declaredVersion(document);
  // An already migrated document is only done when it still reads as one.
  if (version === LAYER_SCHEMA_VERSION) {
    const loaded = loadLayerDocument(document, resolveModel);
    return loaded.ok ? { kind: "already-migrated", declaration: loaded.declaration } : rejected(loaded.findings);
  }
  if (version !== LEGACY_LAYER_SCHEMA_VERSION) return rejected([versionFinding(document)]);
  return assessLegacy(document, resolveModel);
}

/** Replaces the declaration block with the candidate; the only write this module performs. */
export function writeLayerCandidate(candidate: LayerCandidate): WriteOutcome {
  return writeLayerDocument(candidate.document, renderLayerYaml(candidate.declaration));
}

export function previewLayerMigration(declarationPath: string): LayerMigrationOutcome {
  const assessment = assessLayerMigration(declarationPath, loadReferencedModel);
  return assessment.kind === "candidate" ? { kind: "candidate", declaration: assessment.declaration } : assessment;
}

export function applyLayerMigration(declarationPath: string): LayerMigrationOutcome {
  const assessment = assessLayerMigration(declarationPath, loadReferencedModel);
  if (assessment.kind !== "candidate") return assessment;
  const written = writeLayerCandidate(assessment);
  if (written.kind === "write-failed") return { kind: "write-failed", detail: written.detail };
  return { kind: "applied", declaration: assessment.declaration };
}
