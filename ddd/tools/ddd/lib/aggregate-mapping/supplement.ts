/**
 * The migration supplement: a YAML file that names what the legacy format has no place for.
 *
 * It may give an aggregate its type name and its operation mappings (method, error type and error
 * cases), and nothing else. Every value the legacy document already states — package, module,
 * execution model, persistence, ports, repository, references, replay methods — is outside its key
 * set, so a supplement can add to the legacy document but never overwrite it. Names are checked in
 * the language of the aggregate the legacy document maps, and every finding points at this file.
 *
 * ```yaml
 * aggregate_mappings:
 *   - aggregate_ref: aggregate.invoice
 *     code: { type: Invoice }
 *     operations:
 *       - operation_ref: command.invoice.issue
 *         code: { method: issue, error_type: IssueInvoiceError }
 *         errors:
 *           - { error_ref: error.invoice.issue.already-issued, code: { case: AlreadyIssued } }
 * ```
 */

import { existsSync, readFileSync } from "node:fs";
import type { FindingInput } from "../shared/findings.ts";
import { errorMessage } from "../shared/markdown-document.ts";
import { isRecord, type OptionalValue, own } from "../shared/yaml-read.ts";
import {
  type AggregateMappingDraft,
  MAPPING_RULES,
  type MappingDraft,
  MappingReport,
  type OperationMapping,
} from "./contract.ts";
import { readOperations, readTypeName } from "./reader.ts";

const KEYS = {
  root: ["aggregate_mappings"],
  row: ["aggregate_ref", "code", "operations"],
  code: ["type"],
} as const;

interface SuppliedNames {
  readonly type: OptionalValue<string>;
  readonly operations: readonly OperationMapping[];
}

type SupplementRead =
  | { readonly kind: "read"; readonly names: ReadonlyMap<string, SuppliedNames> }
  | { readonly kind: "rejected"; readonly findings: readonly FindingInput[] };

const NOTHING_SUPPLIED: SupplementRead = { kind: "read", names: new Map() };

function refused(path: string, message: string): SupplementRead {
  return { kind: "rejected", findings: [{ rule_id: MAPPING_RULES.document, file: path, message }] };
}

function parseSupplement(path: string): { readonly root: unknown } | { readonly refusal: SupplementRead } {
  if (!existsSync(path)) return { refusal: refused(path, `supplement not found: ${path}`) };
  try {
    return { root: Bun.YAML.parse(readFileSync(path, "utf-8")) };
  } catch (error) {
    return { refusal: refused(path, `failed to read the supplement ${path}: ${errorMessage(error)}`) };
  }
}

function readTypeOf(
  report: MappingReport,
  row: Readonly<Record<string, unknown>>,
  where: string,
  mapped: AggregateMappingDraft,
): OptionalValue<string> | undefined {
  const code = own(row, "code");
  if (code === undefined) return { present: false };
  if (!isRecord(code)) {
    report.add(MAPPING_RULES.structure, `${where}: "code" must be a mapping`);
    return undefined;
  }
  report.unknownKeys(code, KEYS.code, `${where}.code`);
  return readTypeName(report, code, `${where}.code`, mapped.code.language);
}

/**
 * The names `path` supplies, keyed by aggregate. Without a supplement nothing is supplied, and the
 * migration reports every name the legacy document lacks.
 */
export function readSupplement(path: string | null, draft: MappingDraft): SupplementRead {
  if (path === null) return NOTHING_SUPPLIED;
  const parsed = parseSupplement(path);
  if ("refusal" in parsed) return parsed.refusal;
  if (!isRecord(parsed.root)) return refused(path, `the supplement ${path} must be a YAML mapping`);
  const report = new MappingReport(path);
  report.unknownKeys(parsed.root, KEYS.root, "supplement");
  const rows = own(parsed.root, "aggregate_mappings");
  if (!Array.isArray(rows)) {
    report.add(MAPPING_RULES.structure, `supplement: "aggregate_mappings" must be a list`);
    return { kind: "rejected", findings: report.findings };
  }
  const names = new Map<string, SuppliedNames>();
  rows.forEach((row, index) => {
    const where = `supplement aggregate_mappings[${index}]`;
    if (!isRecord(row)) {
      report.add(MAPPING_RULES.structure, `${where}: must be a mapping`);
      return;
    }
    report.unknownKeys(row, KEYS.row, where);
    const aggregateRef = own(row, "aggregate_ref");
    const mapped = draft.aggregate_mappings.find((entry) => entry.aggregate_ref === aggregateRef);
    if (typeof aggregateRef !== "string" || mapped === undefined) {
      report.add(
        MAPPING_RULES.structure,
        `${where}: "aggregate_ref" ${JSON.stringify(aggregateRef)} must name an aggregate the legacy document maps`,
      );
      return;
    }
    if (names.has(aggregateRef)) {
      report.add(MAPPING_RULES.duplicate, `${where}: ${aggregateRef} is supplied more than once`);
      return;
    }
    const type = readTypeOf(report, row, where, mapped);
    const operations = readOperations(report, row, where, mapped.code.language, false);
    if (type !== undefined && operations !== undefined) names.set(aggregateRef, { type, operations });
  });
  if (report.findings.length > 0) return { kind: "rejected", findings: report.findings };
  return { kind: "read", names };
}

/** The draft with the supplied names added; what the legacy document stated is carried unchanged. */
export function withSuppliedNames(draft: MappingDraft, read: Extract<SupplementRead, { kind: "read" }>): MappingDraft {
  return {
    ...draft,
    aggregate_mappings: draft.aggregate_mappings.map((entry) => {
      const supplied = read.names.get(entry.aggregate_ref);
      if (supplied === undefined) return entry;
      return {
        ...entry,
        code: { ...entry.code, ...(supplied.type.present ? { type: supplied.type.value } : {}) },
        operations: supplied.operations,
      };
    }),
  };
}
