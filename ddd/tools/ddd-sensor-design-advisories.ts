#!/usr/bin/env bun
// ddd-sensor-design-advisories — functional-design / infrastructure-design gate (U4 BR7).
//
// Advisory only: it says what a reviewer should look at, never what blocks admission. The layer
// declaration is read through the reader that owns its format; the use-case declarations keep
// their own, which no language spells and which never changed. The store semantics a repository
// needs follow from how the implementation mapping persists its aggregate, so that mapping is read
// through its own reader too.
import { join } from "node:path";
import { loadAggregateMapping } from "./ddd/lib/aggregate-mapping/index.ts";
import { loadLayerDeclaration } from "./ddd/lib/layer-declaration/index.ts";
import type { SensorRunContext } from "./ddd/lib/runtime/context.ts";
import { runSensor } from "./ddd/lib/runtime/runtime.ts";
import { MAPPING_DATA_PATH } from "./ddd/lib/schema/artifacts.ts";
import { finding, relPath } from "./ddd/lib/sensors/common.ts";
import { declarationPath, parseDeclaration } from "./ddd/lib/sensors/declaration.ts";
import type { FindingInput } from "./ddd/lib/shared/findings.ts";

function evaluateUseCases(context: SensorRunContext): FindingInput[] {
  const path = declarationPath(context, "use-case-declarations");
  const file = relPath(context, path);
  const declaration = parseDeclaration(path, "use-case-declarations");
  if (!declaration.ok) return [finding("design-advisories.document", file, declaration.message)];
  const findings: FindingInput[] = [];
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
  return findings;
}

/** The store semantics each persistence method is stored with: state by upsert, events appended. */
const STORE_SEMANTICS_BY_METHOD = {
  "state-sourcing": "upsert",
  "event-sourcing": "insert-only",
} as const;

/**
 * How the mapping persists each aggregate, by aggregate id. An absent or unreadable mapping says
 * nothing, and neither does one that does not map the aggregate: the store semantics of such an
 * aggregate cannot be judged, which is what the reviewer is told.
 */
function persistenceMethods(context: SensorRunContext): ReadonlyMap<string, keyof typeof STORE_SEMANTICS_BY_METHOD> {
  const mapping = loadAggregateMapping(join(context.record_dir, MAPPING_DATA_PATH));
  if (!mapping.ok) return new Map();
  return new Map(mapping.mapping.aggregate_mappings.map((entry) => [entry.aggregate_ref, entry.persistence_method]));
}

function evaluateLayers(context: SensorRunContext): FindingInput[] {
  const path = declarationPath(context, "layer-structure");
  const file = relPath(context, path);
  const loaded = loadLayerDeclaration(path);
  if (!loaded.ok)
    return loaded.findings.map((entry) =>
      finding("design-advisories.document", file, `${entry.rule_id}: ${entry.message}`),
    );
  const methods = persistenceMethods(context);
  const findings: FindingInput[] = [];
  for (const structure of loaded.declaration.layer_structures) {
    for (const repository of structure.repositories) {
      if (repository.io_unit === "partial") {
        findings.push(
          finding(
            "design-advisories.repository-scope",
            file,
            `repository ${repository.name} has partial io_unit scope`,
          ),
        );
      }
      const method = methods.get(repository.aggregate_ref);
      if (method === undefined) {
        findings.push(
          finding(
            "design-advisories.store-upsert",
            file,
            `repository ${repository.name}: the implementation mapping does not say how ${repository.aggregate_ref} is persisted, so its store semantics cannot be judged`,
          ),
        );
        continue;
      }
      const expected = STORE_SEMANTICS_BY_METHOD[method];
      if (!repository.verbs.includes("store") || repository.store_semantics !== expected) {
        findings.push(
          finding(
            "design-advisories.store-upsert",
            file,
            `repository ${repository.name} persists a ${method} aggregate and is not declared as a ${expected} store`,
          ),
        );
      }
    }
  }
  return findings;
}

process.exit(
  runSensor({
    sensor_id: "ddd-design-advisories",
    severity: "advisory",
    budget_ms: 9000,
    evaluate: (context) =>
      context.stage === "functional-design" ? evaluateUseCases(context) : evaluateLayers(context),
  }),
);
