/**
 * The shared scenario the operation error-set comparison is verified against: one canonical model,
 * a Rust and a TypeScript mapping of its one aggregate, and the three projects that implement it.
 * Both mappings are read through the production loaders, so the verification compares what the
 * artifacts actually say rather than a restatement of them.
 *
 * Every module of a project is one scenario. A scenario is reached by pointing the mapping at its
 * module; the mapping documents themselves name the module that matches.
 */

import { readdirSync, readFileSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";
import type { AggregateMapping, MappingLanguage } from "../aggregate-mapping/contract.ts";
import { loadAggregateMapping } from "../aggregate-mapping/loader.ts";
import type { SourceInput } from "../error-contract/contract.ts";
import type { OperationExecution, OperationObservation } from "../operation-error-set/contract.ts";
import type { RustModuleLayout } from "../project-settings/contract.ts";
import { loadDomainModel, OPERATION_OWNED_SCHEMA_VERSION } from "../schema/loader.ts";
import type { DomainModel } from "../schema/model.ts";

const FIXTURE = resolve(import.meta.dir, "../../../..", "tests/fixtures/operation-error-set");

const AGGREGATE_REF = "aggregate.invoice";

/** What a verification path hands to the comparison: one observation and one execution per mapped operation. */
export interface ObservedOperations {
  readonly observations: readonly OperationObservation[];
  readonly executions: readonly OperationExecution[];
}

/** Each project is one language and, for TypeScript, one code representation. */
export const PROJECT_ROOTS = {
  rust: join(FIXTURE, "rust-workspace"),
  "typescript-class": join(FIXTURE, "typescript-class-workspace"),
  "typescript-companion": join(FIXTURE, "typescript-companion-workspace"),
} as const;
export type ScenarioProject = keyof typeof PROJECT_ROOTS;

/**
 * The Rust workspace writes one package in each project module layout, so both are exercised. A
 * mapping reaches either by naming its package; a package this does not record is not placed under
 * a guessed layout, because which layout it is written in is exactly what would be guessed.
 */
export const RUST_PACKAGE_LAYOUT: ReadonlyMap<string, RustModuleLayout> = new Map([
  ["billing-domain", "file"],
  ["billing-domain-mod-rs", "mod-rs"],
]);

const SOURCE_EXTENSION: Readonly<Record<ScenarioProject, string>> = {
  rust: ".rs",
  "typescript-class": ".ts",
  "typescript-companion": ".ts",
};

export function loadScenarioModel(): DomainModel {
  const path = join(FIXTURE, "ddd-domain-model-yaml.md");
  const loaded = loadDomainModel(path, OPERATION_OWNED_SCHEMA_VERSION);
  if (!loaded.ok) throw new Error(`${path} does not load: ${JSON.stringify(loaded.findings)}`);
  return loaded.model;
}

export function loadScenarioMapping(language: MappingLanguage): AggregateMapping {
  const path = join(FIXTURE, "records", language, "inception/domain-design/ddd-aggregate-mapping.md");
  const loaded = loadAggregateMapping(path);
  if (!loaded.ok) throw new Error(`${path} does not load: ${JSON.stringify(loaded.findings)}`);
  const found = loaded.mapping.aggregate_mappings.filter((entry) => entry.aggregate_ref === AGGREGATE_REF);
  if (found.length !== 1) throw new Error(`${path} does not map ${AGGREGATE_REF} exactly once`);
  return found[0];
}

/** Every source of a project in its language, named by its project-relative path. */
export function scenarioSources(project: ScenarioProject): SourceInput[] {
  const root = PROJECT_ROOTS[project];
  const found: SourceInput[] = [];
  const walk = (directory: string) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const full = join(directory, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith(SOURCE_EXTENSION[project]))
        found.push({ path: relative(root, full).split(sep).join("/"), content: readFileSync(full, "utf8") });
    }
  };
  walk(root);
  return found.sort((a, b) => (a.path < b.path ? -1 : 1));
}
