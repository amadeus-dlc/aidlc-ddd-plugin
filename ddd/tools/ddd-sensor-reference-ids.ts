#!/usr/bin/env bun
// ddd-sensor-reference-ids — domain-design / functional-design gate (U4 BR4).
//
// Reads the declaration through the reader that owns its format, loads the canonical model it
// names, and resolves every business id it states. A cyclic lineage, reported by U1 as
// lineage.cycle, is transcribed as reference-ids.cycle. The reader carries no line numbers, so a
// finding names the document rather than inventing a position inside it.
import { join } from "node:path";
import { MAPPING_SCHEMA_VERSION } from "./ddd/lib/aggregate-mapping/contract.ts";
import { readMappingDocument } from "./ddd/lib/aggregate-mapping/document.ts";
import { declaredVersion, versionFinding } from "./ddd/lib/aggregate-mapping/loader.ts";
import { readMappingDraft } from "./ddd/lib/aggregate-mapping/reader.ts";
import type { SensorRunContext } from "./ddd/lib/runtime/context.ts";
import { runSensor } from "./ddd/lib/runtime/runtime.ts";
import { MAPPING_DATA_PATH } from "./ddd/lib/schema/artifacts.ts";
import type { ElementKind } from "./ddd/lib/schema/element-id.ts";
import type { ElementIndex, ResolveReason } from "./ddd/lib/schema/index-builder.ts";
import { loadDomainModel, OPERATION_OWNED_SCHEMA_VERSION } from "./ddd/lib/schema/loader.ts";
import { finding, relPath } from "./ddd/lib/sensors/common.ts";
import { declarationPath, parseDeclaration, resolveModelPath } from "./ddd/lib/sensors/declaration.ts";
import type { FindingInput } from "./ddd/lib/shared/findings.ts";

const REASON_RULE: Record<ResolveReason, string> = {
  undefined: "reference-ids.undefined",
  deprecated: "reference-ids.deprecated",
  "kind-mismatch": "reference-ids.kind",
  malformed: "reference-ids.malformed",
};

type ModelRead =
  | { readonly kind: "loaded"; readonly index: ElementIndex }
  | { readonly kind: "refused"; readonly findings: FindingInput[] };

/** The canonical model `modelRef` names, with its refusals in this gate's vocabulary. */
function readModel(context: SensorRunContext, modelRef: string, file: string): ModelRead {
  const loaded = loadDomainModel(resolveModelPath(context.record_dir, modelRef), OPERATION_OWNED_SCHEMA_VERSION);
  if (loaded.ok) return { kind: "loaded", index: loaded.index };
  return {
    kind: "refused",
    findings: loaded.findings.map((entry) =>
      entry.rule_id === "lineage.cycle"
        ? finding("reference-ids.cycle", file, entry.message, entry.line)
        : finding("reference-ids.model", file, entry.message, entry.line),
    ),
  };
}

/** Collects one unresolved reference per position, in the vocabulary of why it did not resolve. */
class References {
  readonly findings: FindingInput[] = [];

  constructor(
    private readonly index: ElementIndex,
    private readonly file: string,
  ) {}

  resolve(id: string, expected: ElementKind | undefined): void {
    const result = this.index.resolve(id, expected);
    if (result.ok) return;
    this.findings.push(finding(REASON_RULE[result.reason], this.file, `reference ${id} is ${result.reason}`));
  }

  /** An operation is either a command or a factory rule, which is one kind more than the index resolves. */
  resolveOperation(id: string): void {
    const result = this.index.resolve(id, undefined);
    if (!result.ok) {
      this.findings.push(finding(REASON_RULE[result.reason], this.file, `reference ${id} is ${result.reason}`));
      return;
    }
    if (result.element.kind === "command" || result.element.kind === "factory") return;
    this.findings.push(
      finding(
        "reference-ids.kind",
        this.file,
        `reference ${id} names a ${result.element.kind}, not a command or a factory rule`,
      ),
    );
  }
}

function evaluateMapping(context: SensorRunContext): FindingInput[] {
  const path = join(context.record_dir, MAPPING_DATA_PATH);
  const file = relPath(context, path);
  const document = (() => {
    const read = readMappingDocument(path);
    if (read.kind === "rejected") return { findings: read.findings };
    if (declaredVersion(read.document) !== MAPPING_SCHEMA_VERSION) return { findings: [versionFinding(read.document)] };
    return readMappingDraft(read.document.root, read.document.path);
  })();
  if (!("draft" in document))
    return document.findings.map((entry) =>
      finding("reference-ids.document", file, `${entry.rule_id}: ${entry.message}`),
    );

  const model = readModel(context, document.draft.model_ref, file);
  if (model.kind === "refused") return model.findings;
  const references = new References(model.index, file);
  for (const entry of document.draft.domain_packages)
    for (const ref of entry.model_refs) references.resolve(ref, undefined);
  for (const mapping of document.draft.aggregate_mappings) {
    references.resolve(mapping.aggregate_ref, "aggregate");
    for (const reference of mapping.reference_ids) references.resolve(reference, undefined);
    for (const replay of mapping.replay_methods) references.resolve(replay.event_ref, "event");
    for (const operation of mapping.operations) {
      references.resolveOperation(operation.operation_ref);
      for (const errorCase of operation.errors) references.resolve(errorCase.error_ref, "error");
    }
  }
  return references.findings;
}

function evaluateUseCases(context: SensorRunContext): FindingInput[] {
  const path = declarationPath(context, "use-case-declarations");
  const file = relPath(context, path);
  const declaration = parseDeclaration(path, "use-case-declarations");
  if (!declaration.ok) return [finding("reference-ids.document", file, declaration.message)];
  const model = readModel(context, declaration.document.model_ref, file);
  if (model.kind === "refused") return model.findings;
  const references = new References(model.index, file);
  for (const useCase of declaration.document.use_cases) {
    for (const aggregate of useCase.target_aggregates) references.resolve(aggregate, "aggregate");
    for (const command of useCase.commands) references.resolve(command, "command");
    const strategy = useCase.multi_aggregate_strategy;
    if (strategy?.process_manager_ref) references.resolve(strategy.process_manager_ref, "pm");
  }
  return references.findings;
}

process.exit(
  runSensor({
    sensor_id: "ddd-reference-ids",
    severity: "blocking",
    budget_ms: 9000,
    evaluate: (context) => (context.stage === "domain-design" ? evaluateMapping(context) : evaluateUseCases(context)),
  }),
);
