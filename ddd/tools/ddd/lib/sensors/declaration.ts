/**
 * Declaration documents — the shared reader for the three `ddd-` design
 * artifacts U7 writes and U4 inspects (ADR-008). The first fenced ```yaml
 * block is authoritative; the surrounding Markdown is human-facing prose.
 */

import { existsSync, readFileSync } from "node:fs";
import { isAbsolute, join, resolve } from "node:path";
import { type LoadResult, loadDomainModel } from "../schema/loader.ts";

export type DeclarationKind = "aggregate-mapping" | "use-case-declarations" | "layer-structure";

export interface AggregateMapping {
  aggregate_ref: string;
  programming_model: string;
  persistence_method: string;
  crate: string;
  module: string;
  ports: string[];
  repository: string;
  reference_ids: string[];
  line: number;
}

export interface MultiAggregateStrategy {
  kind: string;
  process_manager_ref?: string;
  rationale?: string;
}

export interface UseCaseDeclaration {
  use_case_id: string;
  name: string;
  target_aggregates: string[];
  commands: string[];
  re_execution_basis: string;
  recovery_policy: string;
  multi_aggregate_strategy?: MultiAggregateStrategy;
  read_model_exposure: string;
  line: number;
}

export interface CrateDependencyDeclaration {
  crate: string;
  depends_on: string[];
}

export interface PortDeclaration {
  name: string;
  kind: string;
  verbs: string[];
}

export interface RepositoryDeclaration {
  name: string;
  aggregate_ref: string;
  io_unit: string;
  verbs: string[];
  store_semantics: string;
  line: number;
}

export interface RestorationPathDeclaration {
  aggregate_ref: string;
  via: string;
  note?: string;
}

export interface LayerStructureDeclaration {
  context_ref: string;
  cqrs: boolean;
  command_side_crates: string[];
  query_side_crates: string[];
  rmu_crates: string[];
  crate_dependencies: CrateDependencyDeclaration[];
  ports: PortDeclaration[];
  repositories: RepositoryDeclaration[];
  restoration_paths: RestorationPathDeclaration[];
  persistence_backend: string;
  line: number;
}

export interface DeclarationDocument {
  kind: DeclarationKind;
  schema_version: number;
  model_ref: string;
  aggregate_mappings: AggregateMapping[];
  use_cases: UseCaseDeclaration[];
  layer_structures: LayerStructureDeclaration[];
}

export type DeclarationResult =
  | { ok: true; document: DeclarationDocument; raw: string; yaml: string; yamlStartLine: number }
  | { ok: false; reason: "yaml-absent" | "yaml-invalid" | "schema-invalid"; message: string };

const FENCE = /^[ \t]*```(?:yaml|yml)?[ \t]*$/;

export function extractFencedYaml(markdown: string): { yaml: string; startLine: number } | undefined {
  const lines = markdown.split("\n");
  for (let i = 0; i < lines.length; i++) {
    if (!FENCE.test(lines[i])) continue;
    const body: string[] = [];
    for (let j = i + 1; j < lines.length; j++) {
      if (/^[ \t]*```[ \t]*$/.test(lines[j])) return { yaml: body.join("\n"), startLine: j - body.length + 1 };
      body.push(lines[j]);
    }
    return undefined;
  }
  return undefined;
}

export function lineOf(yaml: string, needle: string, startLine: number): number {
  const lines = yaml.split("\n");
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes(needle)) return startLine + i;
  }
  return startLine;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function str(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function strArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
}

function recordArray(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.filter(isRecord) : [];
}

export function parseDeclaration(path: string, kind: DeclarationKind): DeclarationResult {
  if (!existsSync(path)) {
    return { ok: false, reason: "yaml-absent", message: `declaration ${path} does not exist` };
  }
  const raw = readFileSync(path, "utf-8");
  const fenced = extractFencedYaml(raw);
  if (!fenced) return { ok: false, reason: "yaml-absent", message: `${path} has no fenced yaml block` };
  let parsed: unknown;
  try {
    parsed = Bun.YAML.parse(fenced.yaml);
  } catch (error) {
    return {
      ok: false,
      reason: "yaml-invalid",
      message: `${path}: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
  if (!isRecord(parsed)) {
    return { ok: false, reason: "yaml-invalid", message: `${path}: the fenced yaml must be a mapping` };
  }
  const schemaVersion = parsed.schema_version;
  const modelRef = str(parsed.model_ref);
  if (schemaVersion !== 1 || modelRef.length === 0) {
    return { ok: false, reason: "schema-invalid", message: `${path}: schema_version 1 and model_ref are required` };
  }
  const at = (needle: string) => lineOf(fenced.yaml, needle, fenced.startLine);

  const aggregate_mappings: AggregateMapping[] = recordArray(parsed.aggregate_mappings).map((entry) => ({
    aggregate_ref: str(entry.aggregate_ref),
    programming_model: str(entry.programming_model),
    persistence_method: str(entry.persistence_method),
    crate: str(entry.crate),
    module: str(entry.module),
    ports: strArray(entry.ports),
    repository: str(entry.repository),
    reference_ids: strArray(entry.reference_ids),
    line: at(`aggregate_ref: ${str(entry.aggregate_ref)}`) || at(str(entry.aggregate_ref)),
  }));

  const use_cases: UseCaseDeclaration[] = recordArray(parsed.use_cases).map((entry) => {
    const strategy = isRecord(entry.multi_aggregate_strategy)
      ? {
          kind: str(entry.multi_aggregate_strategy.kind),
          ...(str(entry.multi_aggregate_strategy.process_manager_ref)
            ? { process_manager_ref: str(entry.multi_aggregate_strategy.process_manager_ref) }
            : {}),
          ...(str(entry.multi_aggregate_strategy.rationale)
            ? { rationale: str(entry.multi_aggregate_strategy.rationale) }
            : {}),
        }
      : undefined;
    return {
      use_case_id: str(entry.use_case_id),
      name: str(entry.name),
      target_aggregates: strArray(entry.target_aggregates),
      commands: strArray(entry.commands),
      re_execution_basis: str(entry.re_execution_basis),
      recovery_policy: str(entry.recovery_policy),
      ...(strategy ? { multi_aggregate_strategy: strategy } : {}),
      read_model_exposure: str(entry.read_model_exposure),
      line: at(`use_case_id: ${str(entry.use_case_id)}`) || at(str(entry.use_case_id)),
    };
  });

  const layer_structures: LayerStructureDeclaration[] = recordArray(parsed.layer_structures).map((entry) => ({
    context_ref: str(entry.context_ref),
    cqrs: entry.cqrs === true,
    command_side_crates: strArray(entry.command_side_crates),
    query_side_crates: strArray(entry.query_side_crates),
    rmu_crates: strArray(entry.rmu_crates),
    crate_dependencies: recordArray(entry.crate_dependencies).map((dep) => ({
      crate: str(dep.crate),
      depends_on: strArray(dep.depends_on),
    })),
    ports: recordArray(entry.ports).map((port) => ({
      name: str(port.name),
      kind: str(port.kind),
      verbs: strArray(port.verbs),
    })),
    repositories: recordArray(entry.repositories).map((repo) => ({
      name: str(repo.name),
      aggregate_ref: str(repo.aggregate_ref),
      io_unit: str(repo.io_unit),
      verbs: strArray(repo.verbs),
      store_semantics: str(repo.store_semantics) || "unknown",
      line: at(`name: ${str(repo.name)}`) || at(str(repo.name)),
    })),
    restoration_paths: recordArray(entry.restoration_paths).map((pathEntry) => ({
      aggregate_ref: str(pathEntry.aggregate_ref),
      via: str(pathEntry.via),
      ...(str(pathEntry.note) ? { note: str(pathEntry.note) } : {}),
    })),
    persistence_backend: str(entry.persistence_backend),
    line: at(`context_ref: ${str(entry.context_ref)}`) || at(str(entry.context_ref)),
  }));

  return {
    ok: true,
    raw,
    yaml: fenced.yaml,
    yamlStartLine: fenced.startLine,
    document: {
      kind,
      schema_version: 1,
      model_ref: modelRef,
      aggregate_mappings,
      use_cases,
      layer_structures,
    },
  };
}

export function resolveModelPath(recordDir: string, modelRef: string): string {
  return isAbsolute(modelRef) ? modelRef : resolve(join(recordDir, modelRef));
}

export function readModel(recordDir: string, modelRef: string): LoadResult {
  return loadDomainModel(resolveModelPath(recordDir, modelRef));
}
