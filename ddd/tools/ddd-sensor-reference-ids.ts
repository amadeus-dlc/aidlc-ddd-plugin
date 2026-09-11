#!/usr/bin/env bun
// ddd-sensor-reference-ids — domain-design / functional-design gate (U4 BR4).
//
// Parses the declaration document, loads its model_ref through U1, and resolves
// every declared ID. A cyclic lineage, reported by U1 as lineage.cycle, is
// transcribed as reference-ids.cycle.
import { runSensor } from "./ddd/lib/runtime/runtime.ts";
import type { ElementKind } from "./ddd/lib/schema/element-id.ts";
import type { ResolveReason } from "./ddd/lib/schema/index-builder.ts";
import { finding, relPath } from "./ddd/lib/sensors/common.ts";
import { type DeclarationKind, parseDeclaration, readModel } from "./ddd/lib/sensors/declaration.ts";
import type { FindingInput } from "./ddd/lib/shared/findings.ts";

const REASON_RULE: Record<ResolveReason, string> = {
  undefined: "reference-ids.undefined",
  deprecated: "reference-ids.deprecated",
  "kind-mismatch": "reference-ids.kind",
  malformed: "reference-ids.malformed",
};

function declarationKind(outputPath: string): DeclarationKind {
  return outputPath.endsWith("ddd-aggregate-mapping.md") ? "aggregate-mapping" : "use-case-declarations";
}

process.exit(
  runSensor({
    sensor_id: "ddd-reference-ids",
    severity: "blocking",
    budget_ms: 9000,
    evaluate: (context) => {
      const file = relPath(context, context.output_path);
      const declaration = parseDeclaration(context.output_path, declarationKind(context.output_path));
      if (!declaration.ok) {
        return [finding("reference-ids.document", file, declaration.message)];
      }
      const loaded = readModel(context.record_dir, declaration.document.model_ref);
      if (!loaded.ok) {
        return loaded.findings.map((entry) =>
          entry.rule_id === "lineage.cycle"
            ? finding("reference-ids.cycle", file, entry.message, entry.line)
            : finding("reference-ids.model", file, entry.message, entry.line),
        );
      }
      const findings: FindingInput[] = [];
      const resolve = (id: string, expected: ElementKind | undefined, line: number): void => {
        const result = loaded.index.resolve(id, expected);
        if (result.ok) return;
        findings.push(finding(REASON_RULE[result.reason], file, `reference ${id} is ${result.reason}`, line));
      };

      if (declaration.document.kind === "aggregate-mapping") {
        for (const mapping of declaration.document.aggregate_mappings) {
          resolve(mapping.aggregate_ref, "aggregate", mapping.line);
          for (const reference of mapping.reference_ids) resolve(reference, undefined, mapping.line);
          if (mapping.reference_ids.length === 0) {
            findings.push(
              finding(
                "reference-ids.missing",
                file,
                `mapping ${mapping.aggregate_ref} has no reference_ids`,
                mapping.line,
              ),
            );
          }
        }
      } else {
        for (const useCase of declaration.document.use_cases) {
          for (const aggregate of useCase.target_aggregates) resolve(aggregate, "aggregate", useCase.line);
          for (const command of useCase.commands) resolve(command, "command", useCase.line);
          const strategy = useCase.multi_aggregate_strategy;
          if (strategy?.process_manager_ref) resolve(strategy.process_manager_ref, "pm", useCase.line);
        }
      }
      return findings;
    },
  }),
);
