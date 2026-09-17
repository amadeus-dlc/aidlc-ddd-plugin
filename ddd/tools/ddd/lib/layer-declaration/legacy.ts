/**
 * Converts the Rust-only schema_version 1 layer declaration into the shape of the language-neutral one.
 *
 * Acceptance starts where the production sensors start: parseDeclaration decides whether the section
 * is a crate-fixed layer declaration at all. That reader silently coerces or drops values it does not
 * expect, so the raw block is read again here with the legacy key set closed, and every value is
 * carried over exactly as written for the schema_version 2 reader to check. The three crate lists
 * become one package list whose entries say which side they are on, and each crate becomes a package
 * identity spelled in Rust. A value the crate format has no place for is not produced here: the key
 * is simply absent, which is what lets the migration report it rather than invent it.
 */

import { parseDeclaration } from "../sensors/declaration.ts";
import type { FindingInput } from "../shared/findings.ts";
import { isRecord, own } from "../shared/yaml-read.ts";
import { LAYER_RULES, LAYER_SCHEMA_VERSION, LayerReport, type PackageRole } from "./contract.ts";
import type { LayerDocument } from "./document.ts";

/** The only language the crate-fixed format could name. */
const LEGACY_LANGUAGE = "rust";

const LEGACY_KEYS = {
  root: ["schema_version", "model_ref", "layer_structures"],
  structure: [
    "context_ref",
    "cqrs",
    "command_side_crates",
    "query_side_crates",
    "rmu_crates",
    "crate_dependencies",
    "ports",
    "repositories",
    "restoration_paths",
    "persistence_backend",
  ],
  dependency: ["crate", "depends_on"],
  port: ["name", "kind", "verbs"],
  repository: ["name", "aggregate_ref", "io_unit", "verbs", "store_semantics"],
  restoration: ["aggregate_ref", "via", "note"],
} as const;

/** Which crate list of the crate-fixed format states which side of the context. */
const SIDE_LISTS: readonly (readonly [PackageRole, string])[] = [
  ["command", "command_side_crates"],
  ["query", "query_side_crates"],
  ["rmu", "rmu_crates"],
];

type Row = Readonly<Record<string, unknown>>;

type LegacyConversion =
  | { readonly kind: "converted"; readonly root: Row }
  | { readonly kind: "rejected"; readonly findings: readonly FindingInput[] };

/** Converts each mapping in a list; any other value is left as written for the new reader to refuse. */
function convertRows(value: unknown, where: string, convert: (row: Row, where: string) => Row): unknown {
  if (!Array.isArray(value)) return value;
  return value.map((row, index) => (isRecord(row) ? convert(row, `${where}[${index}]`) : row));
}

/** The key as the legacy document states it, or nothing at all when it does not state it. */
function stated(row: Row, key: string): Row {
  return own(row, key) === undefined ? {} : { [key]: row[key] };
}

function crateIdentity(crate: unknown): Row {
  return { language: LEGACY_LANGUAGE, package: crate };
}

/** The three crate lists as one package list; the side each crate was listed under becomes its role. */
function convertPackages(report: LayerReport, row: Row, where: string): unknown {
  const packages: unknown[] = [];
  for (const [role, key] of SIDE_LISTS) {
    const crates = own(row, key);
    if (!Array.isArray(crates)) {
      report.structure(`${where}: "${key}" must be a list of crate names`);
      continue;
    }
    for (const crate of crates) packages.push({ role, code: crateIdentity(crate) });
  }
  return packages;
}

function convertDependency(report: LayerReport, row: Row, where: string): Row {
  report.unknownKeys(row, LEGACY_KEYS.dependency, where);
  const targets = own(row, "depends_on");
  return {
    code: crateIdentity(own(row, "crate")),
    depends_on: Array.isArray(targets) ? targets.map(crateIdentity) : targets,
  };
}

function convertPort(report: LayerReport, row: Row, where: string): Row {
  report.unknownKeys(row, LEGACY_KEYS.port, where);
  return { name: own(row, "name"), ...stated(row, "kind"), ...stated(row, "verbs") };
}

function convertRepository(report: LayerReport, row: Row, where: string): Row {
  report.unknownKeys(row, LEGACY_KEYS.repository, where);
  return {
    name: own(row, "name"),
    aggregate_ref: own(row, "aggregate_ref"),
    ...stated(row, "io_unit"),
    ...stated(row, "verbs"),
    ...stated(row, "store_semantics"),
  };
}

function convertRestorationPath(report: LayerReport, row: Row, where: string): Row {
  report.unknownKeys(row, LEGACY_KEYS.restoration, where);
  return { aggregate_ref: own(row, "aggregate_ref"), ...stated(row, "via"), ...stated(row, "note") };
}

function convertStructure(report: LayerReport, row: Row, where: string): Row {
  report.unknownKeys(row, LEGACY_KEYS.structure, where);
  return {
    context_ref: own(row, "context_ref"),
    ...stated(row, "cqrs"),
    packages: convertPackages(report, row, where),
    dependencies: convertRows(own(row, "crate_dependencies"), `${where}.crate_dependencies`, (dependency, at) =>
      convertDependency(report, dependency, at),
    ),
    ports: convertRows(own(row, "ports"), `${where}.ports`, (port, at) => convertPort(report, port, at)),
    repositories: convertRows(own(row, "repositories"), `${where}.repositories`, (repository, at) =>
      convertRepository(report, repository, at),
    ),
    restoration_paths: convertRows(own(row, "restoration_paths"), `${where}.restoration_paths`, (path, at) =>
      convertRestorationPath(report, path, at),
    ),
    persistence_backend: own(row, "persistence_backend"),
  };
}

export function convertLegacyDeclaration(document: LayerDocument): LegacyConversion {
  const accepted = parseDeclaration(document.path, "layer-structure");
  if (!accepted.ok) {
    const rule = accepted.reason === "schema-invalid" ? LAYER_RULES.structure : LAYER_RULES.document;
    return { kind: "rejected", findings: [{ rule_id: rule, file: document.path, message: accepted.message }] };
  }
  const report = new LayerReport(document.path);
  const root = document.root;
  report.unknownKeys(root, LEGACY_KEYS.root, "layer declaration");
  const converted: Row = {
    schema_version: LAYER_SCHEMA_VERSION,
    model_ref: own(root, "model_ref"),
    layer_structures: convertRows(own(root, "layer_structures"), "layer_structures", (row, where) =>
      convertStructure(report, row, where),
    ),
  };
  if (report.findings.length > 0) return { kind: "rejected", findings: report.findings };
  return { kind: "converted", root: converted };
}
