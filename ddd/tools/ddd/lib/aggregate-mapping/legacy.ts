/**
 * Converts the Rust-only schema_version 1 mapping into the shape of the language-neutral one.
 *
 * Acceptance starts where the production sensors start: parseDeclaration decides whether the
 * document is a legacy mapping at all. That reader silently coerces or drops values it does not
 * expect, so the raw block is read again here with the legacy key set closed, and every value is
 * carried over exactly as written for the schema_version 2 reader to check. A crate becomes
 * `code.package`; a module path loses only its `::` separators and a leading `crate`, and every
 * segment keeps its spelling. The legacy format names no type, operation or error case, so none is
 * produced here.
 */

import { moduleParts } from "../packaging/declarations.ts";
import { parseDeclaration } from "../sensors/declaration.ts";
import type { FindingInput } from "../shared/findings.ts";
import { isRecord, MAPPING_RULES, MAPPING_SCHEMA_VERSION, MappingReport, own } from "./contract.ts";
import type { MappingDocument } from "./document.ts";

const LEGACY_KEYS = {
  root: ["schema_version", "model_ref", "aggregate_mappings", "domain_packages"],
  aggregate: [
    "aggregate_ref",
    "programming_model",
    "persistence_method",
    "crate",
    "module",
    "ports",
    "repository",
    "reference_ids",
    "replay_methods",
  ],
  replay: ["method", "event_ref"],
  package: ["crate", "module", "term", "model_refs", "rationale"],
} as const;

type Row = Readonly<Record<string, unknown>>;

type LegacyConversion =
  | { readonly kind: "converted"; readonly root: Row }
  | { readonly kind: "rejected"; readonly findings: readonly FindingInput[] };

/** Converts each mapping in a list; any other value is left as written for the new reader to refuse. */
function convertRows(value: unknown, where: string, convert: (row: Row, where: string) => Row): unknown {
  if (!Array.isArray(value)) return value;
  return value.map((row, index) => (isRecord(row) ? convert(row, `${where}[${index}]`) : row));
}

/** `crate::invoice::r#type` becomes `["invoice", "r#type"]`: only the separators and a leading `crate` go. */
function moduleSegments(report: MappingReport, row: Row, where: string): readonly string[] | undefined {
  const module = own(row, "module");
  const parts = typeof module === "string" ? moduleParts(module) : undefined;
  if (typeof module !== "string" || parts === undefined) {
    report.add(
      MAPPING_RULES.structure,
      `${where}: "module" ${JSON.stringify(module)} is not a Rust module path such as crate::invoice`,
    );
    return undefined;
  }
  const spelled = module.split("::");
  return spelled.slice(spelled.length - parts.length);
}

function codeLocation(report: MappingReport, row: Row, where: string): Row {
  const crate = own(row, "crate");
  if (typeof crate !== "string" || crate.length === 0)
    report.add(MAPPING_RULES.structure, `${where}: "crate" must be a non-empty string`);
  return { language: "rust", package: crate, module: moduleSegments(report, row, where) };
}

function convertReplay(report: MappingReport, row: Row, where: string): Row {
  report.unknownKeys(row, LEGACY_KEYS.replay, where);
  return { event_ref: own(row, "event_ref"), code: { method: own(row, "method") } };
}

function convertAggregate(report: MappingReport, row: Row, where: string): Row {
  report.unknownKeys(row, LEGACY_KEYS.aggregate, where);
  return {
    aggregate_ref: own(row, "aggregate_ref"),
    programming_model: own(row, "programming_model"),
    persistence_method: own(row, "persistence_method"),
    reference_ids: own(row, "reference_ids"),
    replay_methods: convertRows(own(row, "replay_methods"), `${where}.replay_methods`, (replay, at) =>
      convertReplay(report, replay, at),
    ),
    code: {
      ...codeLocation(report, row, where),
      ports: own(row, "ports"),
      repository: own(row, "repository"),
    },
    operations: [],
  };
}

function convertPackage(report: MappingReport, row: Row, where: string): Row {
  report.unknownKeys(row, LEGACY_KEYS.package, where);
  return {
    term: own(row, "term"),
    model_refs: own(row, "model_refs"),
    rationale: own(row, "rationale"),
    code: codeLocation(report, row, where),
  };
}

export function convertLegacyMapping(document: MappingDocument): LegacyConversion {
  const accepted = parseDeclaration(document.path, "aggregate-mapping");
  if (!accepted.ok) {
    const rule = accepted.reason === "schema-invalid" ? MAPPING_RULES.structure : MAPPING_RULES.document;
    return { kind: "rejected", findings: [{ rule_id: rule, file: document.path, message: accepted.message }] };
  }
  const report = new MappingReport(document.path);
  const root = document.root;
  report.unknownKeys(root, LEGACY_KEYS.root, "mapping");
  const converted: Row = {
    schema_version: MAPPING_SCHEMA_VERSION,
    model_ref: own(root, "model_ref"),
    aggregate_mappings: convertRows(own(root, "aggregate_mappings"), "aggregate_mappings", (row, where) =>
      convertAggregate(report, row, where),
    ),
    domain_packages: convertRows(own(root, "domain_packages"), "domain_packages", (row, where) =>
      convertPackage(report, row, where),
    ),
  };
  if (report.findings.length > 0) return { kind: "rejected", findings: report.findings };
  return { kind: "converted", root: converted };
}
