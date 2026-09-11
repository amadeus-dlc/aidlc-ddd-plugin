#!/usr/bin/env bun
// ddd-sensor-layer-structure — infrastructure-design gate (U4 BR6).
import { join } from "node:path";
import { runSensor } from "./ddd/lib/runtime/runtime.ts";
import { finding, pascalCase, relPath } from "./ddd/lib/sensors/common.ts";
import { parseDeclaration, readModel } from "./ddd/lib/sensors/declaration.ts";
import type { FindingInput } from "./ddd/lib/shared/findings.ts";

const MEDIA_WORDS = [
  "dynamodb",
  "dynamo",
  "postgres",
  "mysql",
  "sqlite",
  "redis",
  "mongo",
  "s3",
  "jdbc",
  "sql",
  "http",
  "grpc",
  "kafka",
  "inmemory",
];

process.exit(
  runSensor({
    sensor_id: "ddd-layer-structure",
    severity: "blocking",
    budget_ms: 9000,
    evaluate: (context) => {
      const file = relPath(context, context.output_path);
      const declaration = parseDeclaration(context.output_path, "layer-structure");
      if (!declaration.ok) {
        return [finding("layer-structure.item", file, declaration.message)];
      }
      const loaded = readModel(context.record_dir, declaration.document.model_ref);
      if (!loaded.ok) {
        return loaded.findings.map((entry) => finding("layer-structure.model", file, entry.message, entry.line));
      }
      const findings: FindingInput[] = [];

      const mappingPath = join(context.record_dir, "inception", "domain-design", "ddd-aggregate-mapping.md");
      const mappingDoc = parseDeclaration(mappingPath, "aggregate-mapping");
      const crateByAggregate = new Map<string, string>();
      if (mappingDoc.ok) {
        for (const mapping of mappingDoc.document.aggregate_mappings)
          crateByAggregate.set(mapping.aggregate_ref, mapping.crate);
      }

      for (const structure of declaration.document.layer_structures) {
        if (
          structure.crate_dependencies.length === 0 ||
          structure.ports.length === 0 ||
          structure.repositories.length === 0 ||
          structure.restoration_paths.length === 0 ||
          structure.persistence_backend.length === 0
        ) {
          findings.push(
            finding(
              "layer-structure.item",
              file,
              `context ${structure.context_ref} is missing required declaration items`,
              structure.line,
            ),
          );
        }
        const commandSide = new Set(structure.command_side_crates);
        const querySide = new Set(structure.query_side_crates);
        const rmu = new Set(structure.rmu_crates);
        const declared = new Set(structure.crate_dependencies.map((dep) => dep.crate));
        for (const crate of [...commandSide, ...querySide, ...rmu]) {
          if (!declared.has(crate)) {
            findings.push(
              finding(
                "layer-structure.dependencies-incomplete",
                file,
                `crate ${crate} has no crate_dependencies row`,
                structure.line,
              ),
            );
          }
        }
        if (structure.cqrs && querySide.size === 0) {
          findings.push(
            finding(
              "layer-structure.cqrs-sides",
              file,
              `context ${structure.context_ref} is cqrs but declares no query_side_crates`,
              structure.line,
            ),
          );
        }
        for (const dependency of structure.crate_dependencies) {
          if (rmu.has(dependency.crate)) continue;
          if (commandSide.has(dependency.crate) && dependency.depends_on.some((to) => querySide.has(to))) {
            findings.push(
              finding(
                "layer-structure.k",
                file,
                `command-side crate ${dependency.crate} depends on a query-side crate`,
                structure.line,
              ),
            );
          }
          if (querySide.has(dependency.crate) && dependency.depends_on.some((to) => commandSide.has(to))) {
            findings.push(
              finding(
                "layer-structure.k",
                file,
                `query-side crate ${dependency.crate} depends on a command-side crate`,
                structure.line,
              ),
            );
          }
          if (querySide.has(dependency.crate) && dependency.depends_on.some((to) => /-domain$/.test(to))) {
            findings.push(
              finding(
                "layer-structure.l",
                file,
                `query-side crate ${dependency.crate} depends on a domain crate`,
                structure.line,
              ),
            );
          }
        }
        for (const repository of structure.repositories) {
          const aggregateName = repository.aggregate_ref.split(".").slice(1).join("-");
          const expected = `${pascalCase(aggregateName)}Repository`;
          if (repository.name !== expected) {
            findings.push(
              finding(
                "layer-structure.m-name",
                file,
                `repository ${repository.name} must be ${expected}`,
                repository.line,
              ),
            );
          }
          const lower = repository.name.toLowerCase();
          if (MEDIA_WORDS.some((word) => lower.includes(word))) {
            findings.push(
              finding(
                "layer-structure.m-media",
                file,
                `repository ${repository.name} must not name a storage medium`,
                repository.line,
              ),
            );
          }
        }
        const context = loaded.model.bounded_contexts.find((bc) => bc.element_id === structure.context_ref);
        if (context) {
          for (const aggregate of context.aggregates) {
            const crate = crateByAggregate.get(aggregate.element_id);
            if (mappingDoc.ok && crate && !commandSide.has(crate) && !querySide.has(crate) && !rmu.has(crate)) continue;
            const path = structure.restoration_paths.find((entry) => entry.aggregate_ref === aggregate.element_id);
            if (path?.via !== "full-constructor") {
              findings.push(
                finding(
                  "layer-structure.n",
                  file,
                  `aggregate ${aggregate.element_id} has no full-constructor restoration path`,
                  structure.line,
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
