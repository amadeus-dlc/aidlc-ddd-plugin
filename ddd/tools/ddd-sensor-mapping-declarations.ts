#!/usr/bin/env bun
// ddd-sensor-mapping-declarations — domain-design / functional-design gate (U4 BR5).
import { join } from "node:path";
import { runSensor } from "./ddd/lib/runtime/runtime.ts";
import { checkCompleteness } from "./ddd/lib/schema/completeness.ts";
import { finding, relPath } from "./ddd/lib/sensors/common.ts";
import { type DeclarationKind, parseDeclaration, readModel } from "./ddd/lib/sensors/declaration.ts";
import type { FindingInput } from "./ddd/lib/shared/findings.ts";

const PROGRAMMING_MODELS = new Set(["actor", "class"]);
const PERSISTENCE_METHODS = new Set(["state-sourcing", "event-sourcing"]);
const RECOVERY_POLICIES = new Set(["caller-retry", "step-backoff", "both"]);

function declarationKind(outputPath: string): DeclarationKind {
  return outputPath.endsWith("ddd-aggregate-mapping.md") ? "aggregate-mapping" : "use-case-declarations";
}

process.exit(
  runSensor({
    sensor_id: "ddd-mapping-declarations",
    severity: "blocking",
    budget_ms: 9000,
    evaluate: (context) => {
      const file = relPath(context, context.output_path);
      const declaration = parseDeclaration(context.output_path, declarationKind(context.output_path));
      if (!declaration.ok) {
        return [finding("mapping-declarations.document", file, declaration.message)];
      }
      const loaded = readModel(context.record_dir, declaration.document.model_ref);
      if (!loaded.ok) {
        return loaded.findings.map((entry) => finding("mapping-declarations.model", file, entry.message, entry.line));
      }
      const findings: FindingInput[] = [];
      const document = declaration.document;

      if (document.kind === "aggregate-mapping") {
        const mapped = new Set<string>();
        for (const mapping of document.aggregate_mappings) {
          if (mapped.has(mapping.aggregate_ref)) {
            findings.push(
              finding(
                "mapping-declarations.duplicate",
                file,
                `duplicate mapping for ${mapping.aggregate_ref}`,
                mapping.line,
              ),
            );
          }
          mapped.add(mapping.aggregate_ref);
          const missingAxes: string[] = [];
          if (!PROGRAMMING_MODELS.has(mapping.programming_model)) missingAxes.push("programming_model");
          if (!PERSISTENCE_METHODS.has(mapping.persistence_method)) missingAxes.push("persistence_method");
          if (missingAxes.length > 0) {
            findings.push(
              finding(
                "mapping-declarations.axes",
                file,
                `mapping ${mapping.aggregate_ref} is missing axes: ${missingAxes.join(", ")}`,
                mapping.line,
              ),
            );
          }
        }
        for (const bc of loaded.model.bounded_contexts) {
          for (const aggregate of bc.aggregates) {
            if (!mapped.has(aggregate.element_id)) {
              findings.push(
                finding(
                  "mapping-declarations.aggregate-unmapped",
                  file,
                  `aggregate ${aggregate.element_id} has no mapping`,
                ),
              );
            }
          }
        }
      } else {
        // The PM requirement reads the sibling mapping document when present.
        const mappingPath = join(context.record_dir, "inception", "domain-design", "ddd-aggregate-mapping.md");
        const mappingDoc = parseDeclaration(mappingPath, "aggregate-mapping");
        const programmingModel = new Map<string, string>();
        if (mappingDoc.ok) {
          for (const mapping of mappingDoc.document.aggregate_mappings) {
            programmingModel.set(mapping.aggregate_ref, mapping.programming_model);
          }
        }
        const pmCheckSkipped = mappingDoc.ok === false;

        for (const useCase of document.use_cases) {
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
            !pmCheckSkipped &&
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
        for (const entry of checkCompleteness(loaded.model, file)) {
          if (entry.rule_id === "idempotency.j")
            findings.push(finding("mapping-declarations.j", file, entry.message, entry.line));
        }
        if (pmCheckSkipped) {
          return { findings, note: "ddd-aggregate-mapping is absent; Process Manager requirement not evaluated" };
        }
        return findings;
      }

      for (const entry of checkCompleteness(loaded.model, file)) {
        if (entry.rule_id === "idempotency.j")
          findings.push(finding("mapping-declarations.j", file, entry.message, entry.line));
      }
      return findings;
    },
  }),
);
