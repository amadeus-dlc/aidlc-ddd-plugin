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
  EntryPoint,
  InspectionRequest,
  JsonValue,
  OperationTarget,
  RequestIdentity,
  RequestPreparation,
  ResultDefinition,
  RustInspectionRequest,
  SourceSnapshot,
  ToolVersion,
  TypeScriptCondition,
  TypeScriptInspectionRequest,
  TypeScriptPackage,
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

function entryPoints(value: unknown, subject: string): EntryPoint[] {
  return array(value, subject).map((entry, index) => {
    const item = record(entry, `${subject}.${index}`);
    return {
      subpath: nonempty(item.subpath, `${subject}.${index}.subpath`),
      target: path(item.target, `${subject}.${index}.target`),
    };
  });
}

function typeScriptPackages(value: unknown, subject: string): TypeScriptPackage[] {
  const packages = array(value, subject, 1).map((entry, index) => {
    const field = `${subject}.${index}`;
    const pkg = record(entry, field);
    return {
      packageId: nonempty(pkg.packageId, `${field}.packageId`),
      name: nonempty(pkg.name, `${field}.name`),
      version: nonempty(pkg.version, `${field}.version`),
      packageRoot: path(pkg.packageRoot, `${field}.packageRoot`),
      tsconfigPath: path(pkg.tsconfigPath, `${field}.tsconfigPath`),
      entryPoints: entryPoints(pkg.entryPoints, `${field}.entryPoints`),
      projectReferences: array(pkg.projectReferences, `${field}.projectReferences`).map((id, position) =>
        nonempty(id, `${field}.projectReferences.${position}`),
      ),
      dependencies: array(pkg.dependencies, `${field}.dependencies`).map((id, position) =>
        nonempty(id, `${field}.dependencies.${position}`),
      ),
    };
  });
  uniqueNames(
    packages.map((entry) => entry.packageId),
    subject,
    false,
  );
  const known = new Set(packages.map((entry) => entry.packageId));
  for (const [index, entry] of packages.entries())
    for (const [key, links] of [
      ["projectReferences", entry.projectReferences],
      ["dependencies", entry.dependencies],
    ] as const)
      for (const [position, packageId] of links.entries())
        requireValue(
          known.has(packageId),
          `${subject}.${index}.${key}.${position}`,
          "Linked package is not a package of this condition.",
        );
  return packages;
}

function resultDefinition(value: unknown, subject: string, known: ReadonlySet<string>): ResultDefinition {
  const item = record(value, subject);
  const packageId = nonempty(item.packageId, `${subject}.packageId`);
  requireValue(known.has(packageId), `${subject}.packageId`, "Result is not declared by a package of this condition.");
  return {
    packageId,
    modulePath: path(item.modulePath, `${subject}.modulePath`),
    typeName: nonempty(item.typeName, `${subject}.typeName`),
  };
}

function typeScriptCondition(value: unknown, subject: string): TypeScriptCondition {
  const item = record(value, subject);
  requireValue(item.module === "esnext", `${subject}.module`, "Unsupported module kind.");
  requireValue(item.moduleResolution === "bundler", `${subject}.moduleResolution`, "Unsupported module resolution.");
  requireValue(item.target === "esnext", `${subject}.target`, "Unsupported language target.");
  requireValue(item.strict === true, `${subject}.strict`, "Expected a project that type checks strictly.");
  const packages = typeScriptPackages(item.packages, `${subject}.packages`);
  return {
    compilerApiVersion: nonempty(item.compilerApiVersion, `${subject}.compilerApiVersion`),
    module: item.module,
    moduleResolution: item.moduleResolution,
    target: item.target,
    resolutionConditions: array(item.resolutionConditions, `${subject}.resolutionConditions`).map((name, index) =>
      nonempty(name, `${subject}.resolutionConditions.${index}`),
    ),
    strict: item.strict,
    packages,
    resultDefinition: resultDefinition(
      item.resultDefinition,
      `${subject}.resultDefinition`,
      new Set(packages.map((entry) => entry.packageId)),
    ),
  };
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

type BaseValues = {
  readonly item: Record<string, unknown>;
  readonly target: OperationTarget;
  readonly settings: { readonly [key: string]: JsonValue };
  readonly toolchain: readonly ToolVersion[];
} & (
  | { readonly language: "rust"; readonly cargoCondition: CargoCondition }
  | { readonly language: "typescript"; readonly typeScriptCondition: TypeScriptCondition }
);

function base(value: unknown, subject: string, ordered: boolean): BaseValues {
  const item = record(jsonCopy(value, subject), subject);
  const body = {
    item,
    target: operationTarget(item.target, `${subject}.target`),
    settings: record(item.settings, `${subject}.settings`) as { readonly [key: string]: JsonValue },
    toolchain: tools(item.toolchain, `${subject}.toolchain`, ordered),
  };
  // The language names the one condition an inspection carries. Carrying the
  // other language's condition as well is refused here rather than dropped
  // silently, because a dropped field leaves no trace in the request identity.
  if (item.language === "rust") {
    requireValue(
      item.typeScriptCondition === undefined,
      `${subject}.typeScriptCondition`,
      "A Rust inspection carries no TypeScript condition.",
    );
    return {
      ...body,
      language: "rust",
      cargoCondition: cargoCondition(item.cargoCondition, `${subject}.cargoCondition`),
    };
  }
  requireValue(item.language === "typescript", `${subject}.language`, "Unknown language.");
  requireValue(
    item.cargoCondition === undefined,
    `${subject}.cargoCondition`,
    "A TypeScript inspection carries no Cargo condition.",
  );
  return {
    ...body,
    language: "typescript",
    typeScriptCondition: typeScriptCondition(item.typeScriptCondition, `${subject}.typeScriptCondition`),
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

type RequestFields =
  | Omit<RustInspectionRequest, "requestIdentity">
  | Omit<TypeScriptInspectionRequest, "requestIdentity">;

/**
 * The one place a request states its fields, so the identity a preparation issues
 * and the identity a validation recomputes can never be taken over different sets.
 */
function requestFields(values: BaseValues, sources: readonly SourceSnapshot[]): RequestFields {
  const body = {
    schemaVersion: SCHEMA_VERSION,
    target: values.target,
    sources,
    settings: values.settings,
    toolchain: values.toolchain,
  };
  return values.language === "rust"
    ? { ...body, language: values.language, cargoCondition: values.cargoCondition }
    : { ...body, language: values.language, typeScriptCondition: values.typeScriptCondition };
}

function identify(fields: RequestFields): InspectionRequest {
  const requestIdentity: RequestIdentity = digest(canonicalJson(fields as unknown as JsonValue));
  return { ...fields, requestIdentity };
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
    return { kind: "prepared", request: identify(requestFields(values, sources)) };
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
  const expected = identify(requestFields(values, sources));
  requireValue(
    expected.requestIdentity === values.item.requestIdentity,
    "request.requestIdentity",
    "Request identity does not match its contents.",
  );
  return expected;
}
