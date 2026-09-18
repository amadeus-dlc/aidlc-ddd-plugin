/**
 * Converts one project's DDD artifact set — the project settings, and the canonical model, the
 * implementation mapping and every layer declaration of one intent record — in one explicit step.
 *
 * The whole set is assessed before anything is written, and the artifacts that name the canonical
 * model are checked against the model this run is about to write rather than against the one still
 * on disk, so a defect between two of them is reported instead of surviving into a half-converted
 * record. When any part of the set is refused or still incomplete, nothing is written at all.
 *
 * A write that fails partway is not reported as success and is not rolled back: unwinding can fail
 * in turn and would leave a state nobody can name. The report says what was written, what failed,
 * what is left and how to finish, and a re-run on the same record finishes it — the artifacts
 * already converted read as already migrated.
 */

import { existsSync } from "node:fs";
import { isAbsolute, join, relative, resolve } from "node:path";
import {
  loadReferencedModel as loadMappingModel,
  type ModelLoad as MappingModelLoad,
  type ReferencedModelResolver as MappingModelResolver,
} from "../aggregate-mapping/loader.ts";
import {
  assessMappingMigration,
  type MappingCandidate,
  writeMappingCandidate,
} from "../aggregate-mapping/migration.ts";
import {
  assessModelMigration,
  type ModelCandidate,
  renderModelCandidate,
  writeModelCandidateInRecord,
} from "../domain-model/migration.ts";
import { layerDeclarationPaths } from "../layer-declaration/document.ts";
import {
  type ReferencedModelResolver as LayerModelResolver,
  loadReferencedModel as loadLayerModel,
} from "../layer-declaration/loader.ts";
import { assessLayerMigration, type LayerCandidate, writeLayerCandidate } from "../layer-declaration/migration.ts";
import { DOCUMENT_NAME, type ProjectSelection } from "../project-settings/contract.ts";
import { renderDocument, writeRootDocument } from "../project-settings/document.ts";
import { previewMigration as previewSettingsMigration } from "../project-settings/migration.ts";
import { RECORD_STATE_FILE } from "../runtime/context.ts";
import { MAPPING_DATA_PATH, MODEL_DATA_PATH } from "../schema/artifacts.ts";
import type { ElementIndex } from "../schema/index-builder.ts";
import { loadDomainModelSource, OPERATION_OWNED_SCHEMA_VERSION } from "../schema/loader.ts";
import type { DomainModel } from "../schema/model.ts";
import { resolveModelPath } from "../sensors/declaration.ts";
import type { FindingInput } from "../shared/findings.ts";
import type { WriteOutcome } from "../shared/markdown-document.ts";
import {
  type ArtifactKind,
  type ArtifactOutcome,
  type ArtifactReport,
  refuseRecord,
  type SetOutcome,
  selectSetOutcome,
} from "./contract.ts";

export interface SetRequest {
  readonly project: string;
  readonly record: string;
  readonly supplement: string | null;
  readonly apply: boolean;
}

export interface SetResult {
  readonly outcome: Exclude<SetOutcome, "invalid-arguments">;
  /** Present when the request itself was refused, before any artifact was read. */
  readonly findings?: readonly FindingInput[];
  readonly artifacts?: readonly ArtifactReport[];
  readonly written?: readonly string[];
  readonly failed?: { readonly path: string; readonly detail: string };
  readonly pending?: readonly string[];
  readonly rerun?: string;
}

/** A conversion assessed and not yet performed, kept with the artifact it belongs to. */
type PendingWrite =
  | { readonly artifact: "canonical-model"; readonly candidate: ModelCandidate; readonly recordDir: string }
  | { readonly artifact: "implementation-mapping"; readonly candidate: MappingCandidate }
  | { readonly artifact: "layer-declaration"; readonly candidate: LayerCandidate }
  | { readonly artifact: "project-settings"; readonly project: string; readonly selection: ProjectSelection };

interface Assessed {
  readonly report: ArtifactReport;
  readonly write?: PendingWrite;
}

/** The canonical model of the set, once, for every artifact of the set that names it. */
type SetModel =
  | { readonly kind: "unavailable" }
  | { readonly kind: "available"; readonly model: DomainModel; readonly index: ElementIndex };

function isInside(root: string, target: string): boolean {
  const rel = relative(resolve(root), resolve(target));
  return rel === "" || (!rel.startsWith("..") && !isAbsolute(rel));
}

function report(
  artifact: ArtifactKind,
  path: string,
  fields: { readonly outcome: ArtifactOutcome } & Record<string, unknown>,
): ArtifactReport {
  return { artifact, path, ...fields };
}

// ---------------------------------------------------------------------------
// The canonical model
// ---------------------------------------------------------------------------

/**
 * The model artifact, and the model every other artifact of the set is checked against. A model
 * that cannot state a factory rule's business errors is still the model the mapping and the
 * declarations name, so they are checked against it as the legacy format states it while the model
 * itself reports what is still missing.
 */
function assessModel(path: string, recordDir: string): Assessed & { readonly model: SetModel } {
  if (!existsSync(path))
    return { report: report("canonical-model", path, { outcome: "absent" }), model: { kind: "unavailable" } };
  const assessment = assessModelMigration(path);
  switch (assessment.kind) {
    case "rejected":
      return {
        report: report("canonical-model", path, { outcome: "rejected", findings: assessment.findings }),
        model: { kind: "unavailable" },
      };
    case "already-migrated":
      return {
        report: report("canonical-model", path, { outcome: "already-migrated", model: assessment.model }),
        model: { kind: "available", model: assessment.model, index: assessment.index },
      };
    case "missing-information":
      return {
        report: report("canonical-model", path, { outcome: "missing-information", missing: assessment.missing }),
        model: { kind: "available", model: assessment.model, index: assessment.index },
      };
    case "candidate": {
      // The document as it would be written, read back in the format it will then claim: what the
      // rest of the set is checked against is exactly what this run is about to put on disk.
      const reread = loadDomainModelSource(renderModelCandidate(assessment), path, OPERATION_OWNED_SCHEMA_VERSION);
      if (!reread.ok)
        return {
          report: report("canonical-model", path, { outcome: "rejected", findings: reread.findings }),
          model: { kind: "unavailable" },
        };
      return {
        report: report("canonical-model", path, { outcome: "candidate", model: reread.model }),
        write: { artifact: "canonical-model", candidate: assessment, recordDir },
        model: { kind: "available", model: reread.model, index: reread.index },
      };
    }
  }
}

// ---------------------------------------------------------------------------
// The artifacts that name the model
// ---------------------------------------------------------------------------

/**
 * The model of the set, for a document whose `model_ref` resolves to it; anything else is read from
 * disk as usual, so a declaration that names a model this set does not hold is refused for that.
 */
function setModelOf(
  modelPath: string,
  model: SetModel,
  recordDir: string,
  modelRef: string,
): MappingModelLoad | undefined {
  if (model.kind !== "available") return undefined;
  if (resolveModelPath(recordDir, modelRef) !== resolve(modelPath)) return undefined;
  return { ok: true, model: model.model, index: model.index };
}

function assessMapping(path: string, supplement: string | null, resolveModel: MappingModelResolver): Assessed {
  if (!existsSync(path)) return { report: report("implementation-mapping", path, { outcome: "absent" }) };
  const assessment = assessMappingMigration(path, supplement, resolveModel);
  switch (assessment.kind) {
    case "rejected":
      return { report: report("implementation-mapping", path, { outcome: "rejected", findings: assessment.findings }) };
    case "already-migrated":
      return {
        report: report("implementation-mapping", path, { outcome: "already-migrated", mapping: assessment.mapping }),
      };
    case "missing-information":
      return {
        report: report("implementation-mapping", path, { outcome: "missing-information", missing: assessment.missing }),
      };
    case "candidate":
      return {
        report: report("implementation-mapping", path, { outcome: "candidate", mapping: assessment.mapping }),
        write: { artifact: "implementation-mapping", candidate: assessment },
      };
  }
}

function assessLayer(path: string, resolveModel: LayerModelResolver): Assessed {
  const assessment = assessLayerMigration(path, resolveModel);
  switch (assessment.kind) {
    case "rejected":
      return { report: report("layer-declaration", path, { outcome: "rejected", findings: assessment.findings }) };
    case "already-migrated":
      return {
        report: report("layer-declaration", path, {
          outcome: "already-migrated",
          declaration: assessment.declaration,
        }),
      };
    case "missing-information":
      return {
        report: report("layer-declaration", path, { outcome: "missing-information", missing: assessment.missing }),
      };
    case "candidate":
      return {
        report: report("layer-declaration", path, { outcome: "candidate", declaration: assessment.declaration }),
        write: { artifact: "layer-declaration", candidate: assessment },
      };
  }
}

// ---------------------------------------------------------------------------
// The project settings
// ---------------------------------------------------------------------------

/** TypeScript is not generated or inspected yet, so the set never adds it to a project's languages. */
const TYPESCRIPT_NOT_REQUESTED = { kind: "not-requested" } as const;

function assessSettings(project: string): Assessed {
  const path = join(project, DOCUMENT_NAME);
  const assessment = previewSettingsMigration(project, TYPESCRIPT_NOT_REQUESTED);
  switch (assessment.kind) {
    case "rejected":
      return {
        report: report("project-settings", path, {
          outcome: "rejected",
          reason: assessment.rejection.reason,
          detail: assessment.rejection.detail,
          missing: assessment.rejection.missing,
          rejectedDocuments: assessment.rejection.rejectedDocuments,
        }),
      };
    case "already-migrated":
      return {
        report: report("project-settings", path, { outcome: "already-migrated", selection: assessment.selection }),
      };
    case "missing-information":
      return {
        report: report("project-settings", path, { outcome: "missing-information", missing: assessment.missing }),
      };
    case "candidate":
      return {
        report: report("project-settings", path, { outcome: "candidate", selection: assessment.candidate }),
        write: { artifact: "project-settings", project, selection: assessment.candidate },
      };
  }
}

// ---------------------------------------------------------------------------
// Assessing and applying the set
// ---------------------------------------------------------------------------

/**
 * Every artifact of the set, in the order the set is written: the canonical model first, then the
 * mapping that names it, then the declarations that name it by path, and the project settings last,
 * because they are the one document that configures the project as a whole.
 */
function assessSet(request: SetRequest): Assessed[] {
  const modelPath = join(request.record, MODEL_DATA_PATH);
  const model = assessModel(modelPath, request.record);
  const resolveMappingModel: MappingModelResolver = (document, modelRef) =>
    setModelOf(modelPath, model.model, document.recordDir, modelRef) ?? loadMappingModel(document, modelRef);
  const resolveLayerModel: LayerModelResolver = (document, modelRef) =>
    setModelOf(modelPath, model.model, document.recordDir, modelRef) ?? loadLayerModel(document, modelRef);
  return [
    { report: model.report, ...(model.write ? { write: model.write } : {}) },
    assessMapping(join(request.record, MAPPING_DATA_PATH), request.supplement, resolveMappingModel),
    ...layerDeclarationPaths(request.record).map((path) => assessLayer(path, resolveLayerModel)),
    assessSettings(request.project),
  ];
}

function performWrite(write: PendingWrite): WriteOutcome {
  switch (write.artifact) {
    case "canonical-model":
      return writeModelCandidateInRecord(write.candidate, write.recordDir);
    case "implementation-mapping":
      return writeMappingCandidate(write.candidate);
    case "layer-declaration":
      return writeLayerCandidate(write.candidate);
    case "project-settings":
      return writeRootDocument(write.project, renderDocument(write.selection));
  }
}

function rerunAdvice(failed: string): string {
  return `resolve what stopped the write to ${failed} and run the same command again: the artifacts already written report as already-migrated, and the ones still listed as pending are converted then`;
}

function applySet(assessed: readonly Assessed[]): SetResult {
  const reports: ArtifactReport[] = [];
  const written: string[] = [];
  for (let index = 0; index < assessed.length; index++) {
    const entry = assessed[index];
    if (entry.write === undefined) {
      reports.push(entry.report);
      continue;
    }
    const outcome = performWrite(entry.write);
    if (outcome.kind === "written") {
      written.push(entry.report.path);
      reports.push({ ...entry.report, outcome: "applied" });
      continue;
    }
    const remaining = assessed.slice(index + 1).filter((candidate) => candidate.write !== undefined);
    return {
      outcome: "write-failed",
      artifacts: [
        ...reports,
        { ...entry.report, outcome: "write-failed", detail: outcome.detail },
        ...remaining.map((candidate) => candidate.report),
      ],
      written,
      failed: { path: entry.report.path, detail: outcome.detail },
      pending: remaining.map((candidate) => candidate.report.path),
      rerun: rerunAdvice(entry.report.path),
    };
  }
  return { outcome: "applied", artifacts: reports };
}

/** The record has to be an intent record, and one this project owns. */
function refuseUnusableRecord(request: SetRequest): SetResult | undefined {
  if (!existsSync(join(request.record, RECORD_STATE_FILE)))
    return {
      outcome: "rejected",
      findings: refuseRecord(
        request.record,
        `${request.record} holds no ${RECORD_STATE_FILE}, so it is not an intent record this command may convert`,
      ),
    };
  if (!isInside(request.project, request.record))
    return {
      outcome: "rejected",
      findings: refuseRecord(
        request.record,
        `${request.record} is outside the project ${request.project}, whose settings this command would convert with it`,
      ),
    };
  return undefined;
}

export function migrateArtifactSet(request: SetRequest): SetResult {
  const unusable = refuseUnusableRecord(request);
  if (unusable) return unusable;
  const assessed = assessSet(request);
  const artifacts = assessed.map((entry) => entry.report);
  const outcome = selectSetOutcome(artifacts);
  if (!request.apply || outcome !== "candidate") return { outcome, artifacts };
  return applySet(assessed);
}
