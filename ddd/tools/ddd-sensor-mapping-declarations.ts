#!/usr/bin/env bun
// ddd-sensor-mapping-declarations — domain-design / functional-design gate (U4 BR5).
//
// The implementation mapping is read by the reader that owns it, and its refusals are transcribed
// onto this gate's own rule ids; this sensor never re-decides what that reader already decided.
// The use-case declarations keep their own format, which no language spells and which never changed.
import { existsSync } from "node:fs";
import { join } from "node:path";
import type { MappingLoadResult } from "./ddd/lib/aggregate-mapping/index.ts";
import { loadAggregateMapping } from "./ddd/lib/aggregate-mapping/index.ts";
import { runSensor } from "./ddd/lib/runtime/runtime.ts";
import { MAPPING_DATA_PATH } from "./ddd/lib/schema/artifacts.ts";
import { checkCompleteness } from "./ddd/lib/schema/completeness.ts";
import { loadDomainModel, OPERATION_OWNED_SCHEMA_VERSION } from "./ddd/lib/schema/loader.ts";
import type { DomainModel } from "./ddd/lib/schema/model.ts";
import { finding, relPath } from "./ddd/lib/sensors/common.ts";
import { declarationPath, parseDeclaration, resolveModelPath } from "./ddd/lib/sensors/declaration.ts";
import type { FindingInput } from "./ddd/lib/shared/findings.ts";

const RECOVERY_POLICIES = new Set(["caller-retry", "step-backoff", "both"]);

/** Which rule of this gate reports a refusal the mapping reader made. */
function transcribedRule(ruleId: string): string {
  if (ruleId === "aggregate-mapping.model") return "mapping-declarations.model";
  if (ruleId === "aggregate-mapping.technical-name") return "domain-packaging.technical-name";
  return "mapping-declarations.document";
}

function transcribe(read: Extract<MappingLoadResult, { ok: false }>, file: string): FindingInput[] {
  return read.findings.map((entry) =>
    finding(transcribedRule(entry.rule_id), file, `${entry.rule_id}: ${entry.message}`),
  );
}

/** Rule (j) of the canonical model, reported by this gate wherever the model is read. */
function idempotency(model: DomainModel, file: string): FindingInput[] {
  return checkCompleteness(model, file)
    .filter((entry) => entry.rule_id === "idempotency.j")
    .map((entry) => finding("mapping-declarations.j", file, entry.message, entry.line));
}

process.exit(
  runSensor({
    sensor_id: "ddd-mapping-declarations",
    severity: "blocking",
    budget_ms: 9000,
    evaluate: (context) => {
      const mappingPath = join(context.record_dir, MAPPING_DATA_PATH);
      const mappingFile = relPath(context, mappingPath);

      if (context.stage === "domain-design") {
        const read = loadAggregateMapping(mappingPath);
        if (!read.ok) return transcribe(read, mappingFile);
        return idempotency(read.model, mappingFile);
      }

      const path = declarationPath(context, "use-case-declarations");
      const file = relPath(context, path);
      const declaration = parseDeclaration(path, "use-case-declarations");
      if (!declaration.ok) return [finding("mapping-declarations.document", file, declaration.message)];
      const loaded = loadDomainModel(
        resolveModelPath(context.record_dir, declaration.document.model_ref),
        OPERATION_OWNED_SCHEMA_VERSION,
      );
      if (!loaded.ok)
        return loaded.findings.map((entry) => finding("mapping-declarations.model", file, entry.message, entry.line));

      // A mapping that is present but unreadable blocks here too: reading it as the format it has to
      // be migrated from is what this gate no longer does, so skipping one check is not the answer.
      const mapping = existsSync(mappingPath) ? loadAggregateMapping(mappingPath) : undefined;
      const unreadableMapping = mapping !== undefined && !mapping.ok ? transcribe(mapping, mappingFile) : [];
      const programmingModel = new Map(
        (mapping?.ok ? mapping.mapping.aggregate_mappings : []).map((entry) => [
          entry.aggregate_ref,
          entry.programming_model,
        ]),
      );

      const findings: FindingInput[] = [];
      for (const useCase of declaration.document.use_cases) {
        const missing: string[] = [];
        if (useCase.name.length === 0) missing.push("name");
        if (useCase.target_aggregates.length === 0) missing.push("target_aggregates");
        if (useCase.commands.length === 0) missing.push("commands");
        if (useCase.re_execution_basis.length === 0) missing.push("re_execution_basis");
        if (!RECOVERY_POLICIES.has(useCase.recovery_policy)) missing.push("recovery_policy");
        if (useCase.read_model_exposure.length === 0) missing.push("read_model_exposure");
        if (missing.length > 0) {
          findings.push(
            finding(
              "mapping-declarations.use-case-item",
              file,
              `use case ${useCase.use_case_id} is missing: ${missing.join(", ")}`,
              useCase.line,
            ),
          );
        }
        if (useCase.target_aggregates.length >= 2 && !useCase.multi_aggregate_strategy) {
          findings.push(
            finding(
              "mapping-declarations.multi-aggregate-strategy",
              file,
              `use case ${useCase.use_case_id} targets multiple aggregates without a strategy`,
              useCase.line,
            ),
          );
        }
        if (
          mapping?.ok &&
          useCase.target_aggregates.length >= 2 &&
          useCase.target_aggregates.every((ref) => programmingModel.get(ref) === "actor") &&
          useCase.multi_aggregate_strategy?.kind !== "process-manager"
        ) {
          findings.push(
            finding(
              "mapping-declarations.process-manager-required",
              file,
              `actor-model use case ${useCase.use_case_id} must reference a Process Manager`,
              useCase.line,
            ),
          );
        }
      }
      findings.push(...idempotency(loaded.model, file), ...unreadableMapping);
      if (mapping === undefined)
        return { findings, note: "ddd-aggregate-mapping is absent; Process Manager requirement not evaluated" };
      return findings;
    },
  }),
);
