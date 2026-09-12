/**
 * Declaration documents — read the aggregate mapping or the dedicated DDD
 * section of a registered core review artifact. Exactly one labelled YAML
 * block in that scope is authoritative; other sections are not declarations.
 */

import { existsSync, readFileSync } from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";
import type { SensorRunContext } from "../runtime/context.ts";
import { type LoadResult, loadDomainModel } from "../schema/loader.ts";
import { readYamlBlock } from "../shared/markdown-yaml.ts";

export type DeclarationKind = "aggregate-mapping" | "use-case-declarations" | "layer-structure";

export function declarationPath(context: SensorRunContext, kind: DeclarationKind): string {
  const filename =
    kind === "aggregate-mapping"
      ? "ddd-aggregate-mapping.md"
      : kind === "use-case-declarations"
        ? "functional-spec.md"
        : "cicd-pipeline.md";
  return join(dirname(context.output_path), filename);
}

export interface AggregateMapping {
  aggregate_ref: string;
  programming_model: string;
  persistence_method: string;
  crate: string;
  module: string;
  ports: string[];
  repository: string;
  reference_ids: string[];
  replay_methods: { method: string; event_ref: string }[];
  line: number;
}

export interface DomainPackage {
  crate: string;
  module: string;
  term: string;
  model_refs: string[];
  rationale: string;
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
  domain_packages?: DomainPackage[];
  use_cases: UseCaseDeclaration[];
  layer_structures: LayerStructureDeclaration[];
}

export type DeclarationResult =
  | { ok: true; document: DeclarationDocument; raw: string; yaml: string; yamlStartLine: number }
  | { ok: false; reason: "yaml-absent" | "yaml-invalid" | "schema-invalid"; message: string };

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
  const heading =
    kind === "use-case-declarations"
      ? ["DDD Use-case Declarations", "DDD ユースケース宣言"]
      : kind === "layer-structure"
        ? ["DDD Layer Structure", "DDD 層構造宣言"]
        : undefined;
  let fenced: { yaml: string; startLine: number };
  try {
    fenced = readYamlBlock(raw, heading);
  } catch (error) {
    return {
      ok: false,
      reason: "yaml-absent",
      message: `${path}: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
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
  const key =
    kind === "aggregate-mapping"
      ? "aggregate_mappings"
      : kind === "use-case-declarations"
        ? "use_cases"
        : "layer_structures";
  if (!Array.isArray(parsed[key]) || !(parsed[key] as unknown[]).every(isRecord)) {
    return { ok: false, reason: "schema-invalid", message: `${path}: ${key} must be an explicit list of mappings` };
  }
  for (const mapping of recordArray(parsed.aggregate_mappings)) {
    if (mapping.replay_methods === undefined) continue;
    if (
      !Array.isArray(mapping.replay_methods) ||
      !mapping.replay_methods.every(
        (entry) =>
          isRecord(entry) &&
          typeof entry.method === "string" &&
          /^[a-zA-Z_]\w*$/.test(entry.method) &&
          typeof entry.event_ref === "string" &&
          entry.event_ref.length > 0,
      )
    ) {
      return {
        ok: false,
        reason: "schema-invalid",
        message: `${path}: replay_methods requires method and event_ref entries`,
      };
    }
  }
  const at = (needle: string) => lineOf(fenced.yaml, needle, fenced.startLine);
  if (
    parsed.domain_packages !== undefined &&
    (!Array.isArray(parsed.domain_packages) ||
      !parsed.domain_packages.every(
        (entry) =>
          isRecord(entry) &&
          (entry.model_refs === undefined ||
            (Array.isArray(entry.model_refs) && entry.model_refs.every((ref) => typeof ref === "string"))),
      ))
  ) {
    return {
      ok: false,
      reason: "schema-invalid",
      message: `${path}: domain_packages must contain package mappings and string model_refs`,
    };
  }
  const domainPackages =
    parsed.domain_packages === undefined
      ? undefined
      : recordArray(parsed.domain_packages).map((entry) => ({
          crate: str(entry.crate),
          module: str(entry.module),
          term: str(entry.term),
          model_refs: strArray(entry.model_refs),
          rationale: str(entry.rationale),
          line: at(`module: ${str(entry.module)}`),
        }));

  const aggregate_mappings: AggregateMapping[] = recordArray(parsed.aggregate_mappings).map((entry) => ({
    aggregate_ref: str(entry.aggregate_ref),
    programming_model: str(entry.programming_model),
    persistence_method: str(entry.persistence_method),
    crate: str(entry.crate),
    module: str(entry.module),
    ports: strArray(entry.ports),
    repository: str(entry.repository),
    reference_ids: strArray(entry.reference_ids),
    replay_methods: recordArray(entry.replay_methods).map((replay) => ({
      method: str(replay.method),
      event_ref: str(replay.event_ref),
    })),
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
      domain_packages: domainPackages,
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
