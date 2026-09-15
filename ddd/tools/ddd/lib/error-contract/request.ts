import {
  array,
  ContractError,
  canonicalJson,
  digest,
  integer,
  jsonCopy,
  nonempty,
  record,
  requireValue,
  scalarCompare,
} from "../state-exposure/canonical.ts";
import type {
  CargoCondition,
  CargoPackage,
  CargoTarget,
  DependencyRename,
  InspectionRequest,
  JsonValue,
  OperationTarget,
  RequestPreparation,
  SourceSnapshot,
  ToolVersion,
} from "./contract.ts";
import { SCHEMA_VERSION } from "./contract.ts";

function path(value: unknown, subject: string): string {
  const name = nonempty(value, subject);
  requireValue(
    !name.includes("\\") &&
      !name.includes("\0") &&
      name.split("/").every((part) => part && part !== "." && part !== ".."),
    subject,
    "Expected a relative POSIX path without empty or dot segments.",
  );
  return name;
}

function uniqueNames(names: string[], subject: string, ordered: boolean): void {
  requireValue(new Set(names).size === names.length, subject, "Duplicate identifiers.");
  if (ordered)
    requireValue(
      names.every((name, i) => i === 0 || scalarCompare(names[i - 1], name) < 0),
      subject,
      "Expected Unicode scalar order.",
    );
}

function cargoTargets(value: unknown, subject: string): CargoTarget[] {
  return array(value, subject, 1).map((entry, index) => {
    const item = record(entry, `${subject}.${index}`);
    return {
      kind: nonempty(item.kind, `${subject}.${index}.kind`),
      name: nonempty(item.name, `${subject}.${index}.name`),
      srcPath: path(item.srcPath, `${subject}.${index}.srcPath`),
    };
  });
}

function dependencyRenames(value: unknown, subject: string): DependencyRename[] {
  return array(value, subject).map((entry, index) => {
    const item = record(entry, `${subject}.${index}`);
    return {
      alias: nonempty(item.alias, `${subject}.${index}.alias`),
      packageId: nonempty(item.packageId, `${subject}.${index}.packageId`),
    };
  });
}

function cargoCondition(value: unknown, subject: string): CargoCondition {
  const item = record(value, subject);
  const targetTriple = nonempty(item.targetTriple, `${subject}.targetTriple`);
  const packages: CargoPackage[] = array(item.packages, `${subject}.packages`, 1).map((entry, index) => {
    const field = `${subject}.packages.${index}`;
    const pkg = record(entry, field);
    return {
      packageId: nonempty(pkg.packageId, `${field}.packageId`),
      name: nonempty(pkg.name, `${field}.name`),
      edition: nonempty(pkg.edition, `${field}.edition`),
      targets: cargoTargets(pkg.targets, `${field}.targets`),
      features: array(pkg.features, `${field}.features`).map((feature, position) =>
        nonempty(feature, `${field}.features.${position}`),
      ),
      dependencyRenames: dependencyRenames(pkg.dependencyRenames, `${field}.dependencyRenames`),
    };
  });
  uniqueNames(
    packages.map((entry) => entry.packageId),
    `${subject}.packages`,
    false,
  );
  const known = new Set(packages.map((entry) => entry.packageId));
  for (const [index, entry] of packages.entries())
    for (const [position, rename] of entry.dependencyRenames.entries())
      requireValue(
        known.has(rename.packageId),
        `${subject}.packages.${index}.dependencyRenames.${position}.packageId`,
        "Renamed dependency is not a package of this condition.",
      );
  return { targetTriple, packages };
}

function operationTarget(value: unknown, subject: string): OperationTarget {
  const item = record(value, subject);
  return {
    packageId: nonempty(item.packageId, `${subject}.packageId`),
    targetName: nonempty(item.targetName, `${subject}.targetName`),
    file: path(item.file, `${subject}.file`),
    declarationPath: array(item.declarationPath, `${subject}.declarationPath`, 1).map((name, index) =>
      nonempty(name, `${subject}.declarationPath.${index}`),
    ),
    operation: nonempty(item.operation, `${subject}.operation`),
  };
}

function tools(value: unknown, subject: string, ordered: boolean): ToolVersion[] {
  const items = array(value, subject, 1).map((entry, index) => {
    const item = record(entry, `${subject}.${index}`);
    return {
      name: nonempty(item.name, `${subject}.${index}.name`),
      version: nonempty(item.version, `${subject}.${index}.version`),
    };
  });
  uniqueNames(
    items.map((item) => item.name),
    subject,
    ordered,
  );
  return items.sort((a, b) => scalarCompare(a.name, b.name));
}

function base(value: unknown, subject: string, ordered: boolean) {
  const item = record(jsonCopy(value, subject), subject);
  requireValue(item.language === "rust", `${subject}.language`, "Unknown language.");
  return {
    item,
    cargoCondition: cargoCondition(item.cargoCondition, `${subject}.cargoCondition`),
    target: operationTarget(item.target, `${subject}.target`),
    settings: record(item.settings, `${subject}.settings`) as { readonly [key: string]: JsonValue },
    toolchain: tools(item.toolchain, `${subject}.toolchain`, ordered),
  };
}

function snapshot(sourcePath: string, content: string): SourceSnapshot {
  const bytes = new TextEncoder().encode(content);
  const lineStarts = [0];
  for (let i = 0; i < bytes.length; i++) {
    if (bytes[i] === 13) {
      if (bytes[i + 1] === 10) i++;
      lineStarts.push(i + 1);
    } else if (bytes[i] === 10) lineStarts.push(i + 1);
    else if (bytes[i] === 0xe2 && bytes[i + 1] === 0x80 && (bytes[i + 2] === 0xa8 || bytes[i + 2] === 0xa9)) {
      i += 2;
      lineStarts.push(i + 1);
    }
  }
  return { path: sourcePath, sha256: digest(content), byteLength: bytes.length, lineStarts };
}

function validateSourceTargets(
  sources: SourceSnapshot[],
  selected: OperationTarget,
  subject: string,
  ordered: boolean,
): void {
  uniqueNames(
    sources.map((source) => source.path),
    `${subject}.sources`,
    ordered,
  );
  requireValue(
    sources.some((source) => source.path === selected.file),
    `${subject}.target.file`,
    "Target file is not a source.",
  );
}

function identify(fields: Omit<InspectionRequest, "requestIdentity">): InspectionRequest {
  return { ...fields, requestIdentity: digest(canonicalJson(fields as unknown as JsonValue)) };
}

export function prepareErrorContractRequest(input: unknown): RequestPreparation {
  try {
    const values = base(input, "input", false);
    const sources = array(values.item.sources, "input.sources", 1).map((entry, index) => {
      const item = record(entry, `input.sources.${index}`);
      const sourcePath = path(item.path, `input.sources.${index}.path`);
      requireValue(typeof item.content === "string", `input.sources.${index}.content`, "Expected source text.");
      return snapshot(sourcePath, item.content);
    });
    validateSourceTargets(sources, values.target, "input", false);
    sources.sort((a, b) => scalarCompare(a.path, b.path));
    return {
      kind: "prepared",
      request: identify({
        schemaVersion: SCHEMA_VERSION,
        language: "rust",
        cargoCondition: values.cargoCondition,
        target: values.target,
        sources,
        settings: values.settings,
        toolchain: values.toolchain,
      }),
    };
  } catch (error) {
    if (error instanceof ContractError) return { kind: "input-rejected", issues: [error.issue] };
    throw error;
  }
}

export function isDigest(value: unknown): value is string {
  return typeof value === "string" && /^sha256:[0-9a-f]{64}$/.test(value);
}

function validateSnapshot(value: unknown, subject: string): SourceSnapshot {
  const item = record(value, subject);
  const sourcePath = path(item.path, `${subject}.path`);
  requireValue(isDigest(item.sha256), `${subject}.sha256`, "Invalid source digest.");
  const byteLength = integer(item.byteLength, `${subject}.byteLength`);
  const lineStarts = array(item.lineStarts, `${subject}.lineStarts`, 1).map((entry, index) =>
    integer(entry, `${subject}.lineStarts.${index}`),
  );
  requireValue(
    lineStarts[0] === 0 &&
      lineStarts.every((start, i) => start <= byteLength && (i === 0 || start > lineStarts[i - 1])),
    `${subject}.lineStarts`,
    "Line starts must begin at zero and increase within the source.",
  );
  return { path: sourcePath, sha256: item.sha256, byteLength, lineStarts };
}

export function validateRequest(request: unknown): InspectionRequest {
  const values = base(request, "request", true);
  requireValue(values.item.schemaVersion === SCHEMA_VERSION, "request.schemaVersion", "Unknown request version.");
  requireValue(isDigest(values.item.requestIdentity), "request.requestIdentity", "Invalid request identity.");
  const sources = array(values.item.sources, "request.sources", 1).map((entry, index) =>
    validateSnapshot(entry, `request.sources.${index}`),
  );
  validateSourceTargets(sources, values.target, "request", true);
  const expected = identify({
    schemaVersion: SCHEMA_VERSION,
    language: "rust",
    cargoCondition: values.cargoCondition,
    target: values.target,
    sources,
    settings: values.settings,
    toolchain: values.toolchain,
  });
  requireValue(
    expected.requestIdentity === values.item.requestIdentity,
    "request.requestIdentity",
    "Request identity does not match its contents.",
  );
  return expected;
}
