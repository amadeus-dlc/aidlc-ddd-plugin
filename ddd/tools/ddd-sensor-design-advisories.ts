#!/usr/bin/env bun
// ddd-sensor-design-advisories — functional-design / infrastructure-design gate (U4 BR7).
import { runSensor } from "./ddd/lib/runtime/runtime.ts";
import { finding, relPath } from "./ddd/lib/sensors/common.ts";
import { parseDeclaration } from "./ddd/lib/sensors/declaration.ts";
import type { FindingInput } from "./ddd/lib/shared/findings.ts";

process.exit(
  runSensor({
    sensor_id: "ddd-design-advisories",
    severity: "advisory",
    budget_ms: 9000,
    evaluate: (context) => {
      const file = relPath(context, context.output_path);
      const isUseCase = context.output_path.endsWith("ddd-use-case-declarations.md");
      const declaration = parseDeclaration(
        context.output_path,
        isUseCase ? "use-case-declarations" : "layer-structure",
      );
      if (!declaration.ok) {
        return [finding("design-advisories.document", file, declaration.message)];
      }
      const findings: FindingInput[] = [];
      if (isUseCase) {
        for (const useCase of declaration.document.use_cases) {
          if (useCase.target_aggregates.length >= 2) {
            const strategy = useCase.multi_aggregate_strategy?.kind ?? "none";
            findings.push(
              finding(
                "design-advisories.multi-aggregate",
                file,
                `use case ${useCase.use_case_id} updates multiple aggregates (strategy: ${strategy})`,
                useCase.line,
              ),
            );
          }
        }
      } else {
        for (const structure of declaration.document.layer_structures) {
          for (const repository of structure.repositories) {
            if (repository.io_unit === "partial") {
              findings.push(
                finding(
                  "design-advisories.repository-scope",
                  file,
                  `repository ${repository.name} has partial io_unit scope`,
                  repository.line,
                ),
              );
            }
            if (!repository.verbs.includes("store") || repository.store_semantics !== "upsert") {
              findings.push(
                finding(
                  "design-advisories.store-upsert",
                  file,
                  `repository ${repository.name} is not declared as an upsert store`,
                  repository.line,
                ),
              );
            }
          }
        }
      }
      return findings;
    },
  }),
);
