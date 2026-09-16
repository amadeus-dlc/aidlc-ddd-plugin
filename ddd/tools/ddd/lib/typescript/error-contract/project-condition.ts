/**
 * The TypeScript project boundary of the business-error contract. One analysis
 * condition is resolved here from the project on disk and handed on already
 * decided; nothing below this file reads a tsconfig or a package manifest again.
 *
 * A configuration this condition does not model is refused rather than narrowed
 * to a default, so a project is never inspected under settings it never stated.
 */

import { existsSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import ts from "typescript";
import type {
  EntryPoint,
  Issue,
  ReasonCode,
  TypeScriptCondition,
  TypeScriptPackage,
} from "../../error-contract/index.ts";

/** Names the language-support result inside its own package, before package identities exist. */
export interface ResultDefinitionSelector {
  readonly packageName: string;
  readonly modulePath: string;
  readonly typeName: string;
}
export interface TypeScriptConditionOptions {
  readonly workspaceRoot: string;
  readonly resultDefinition: ResultDefinitionSelector;
}
export type TypeScriptConditionResolution =
  | { readonly kind: "resolved"; readonly condition: TypeScriptCondition }
  | { readonly kind: "unavailable"; readonly reasons: readonly Issue[] };

const SUPPORTED_COMPILER_API_VERSION = "6.0.3";

/** The compiler settings this condition models, each as the one value it accepts. */
const SUPPORTED_MODULE = new Map<ts.ModuleKind, TypeScriptCondition["module"]>([[ts.ModuleKind.ESNext, "esnext"]]);
const SUPPORTED_MODULE_RESOLUTION = new Map<ts.ModuleResolutionKind, TypeScriptCondition["moduleResolution"]>([
  [ts.ModuleResolutionKind.Bundler, "bundler"],
]);
const SUPPORTED_TARGET = new Map<ts.ScriptTarget, TypeScriptCondition["target"]>([[ts.ScriptTarget.ESNext, "esnext"]]);

class Refusal extends Error {
  constructor(
    readonly code: ReasonCode,
    readonly subject: string,
    message: string,
  ) {
    super(message);
  }
}
function unreadable(subject: string, message: string): never {
  throw new Refusal("tool-unavailable", subject, message);
}
function notModelled(subject: string, message: string): never {
  throw new Refusal("unsupported-syntax", subject, message);
}

/**
 * The path invariant the request contract states, applied where a path first
 * enters the condition: a relative POSIX path with no empty and no dot segment.
 * A condition that recorded any other path would be refused as a request, so it
 * is refused here instead of being handed on as a resolved one.
 */
function insideProject(path: string): boolean {
  return path.length > 0 && path.split("/").every((part) => part && part !== "." && part !== "..");
}

function projectRelative(workspaceRoot: string, absolute: string, subject: string): string {
  const path = relative(workspaceRoot, absolute).split(sep).join("/");
  if (!insideProject(path)) notModelled(subject, "Path is outside the project.");
  return path;
}

function readJson(path: string, subject: string): Record<string, unknown> {
  if (!existsSync(path)) unreadable(subject, `${path} is not there.`);
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    unreadable(subject, error instanceof Error ? error.message : String(error));
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) unreadable(subject, "Expected a JSON object.");
  return parsed as Record<string, unknown>;
}

function text(value: unknown, subject: string): string {
  if (typeof value !== "string" || !value.length) notModelled(subject, "Expected a nonempty string.");
  return value;
}

const parseHost: ts.ParseConfigHost = {
  useCaseSensitiveFileNames: true,
  readDirectory: (path, extensions, exclude, include, depth) =>
    ts.sys.readDirectory(path, extensions, exclude, include, depth),
  fileExists: (path) => existsSync(path),
  readFile: (path) => (existsSync(path) ? readFileSync(path, "utf8") : undefined),
};

interface ParsedConfig {
  readonly options: ts.CompilerOptions;
  readonly references: readonly string[];
}
function parseConfig(path: string, subject: string): ParsedConfig {
  if (!existsSync(path)) unreadable(subject, `${path} is not there.`);
  const read = ts.readConfigFile(path, (file) => parseHost.readFile(file));
  if (read.error) unreadable(subject, ts.flattenDiagnosticMessageText(read.error.messageText, " "));
  const parsed = ts.parseJsonConfigFileContent(read.config, parseHost, dirname(path), undefined, path);
  if (parsed.errors.length) unreadable(subject, ts.flattenDiagnosticMessageText(parsed.errors[0].messageText, " "));
  return { options: parsed.options, references: (parsed.projectReferences ?? []).map((entry) => entry.path) };
}

/** The compiler settings a package states, including everything its config inherits. */
interface CompilerSettings {
  readonly module: TypeScriptCondition["module"];
  readonly moduleResolution: TypeScriptCondition["moduleResolution"];
  readonly target: TypeScriptCondition["target"];
  readonly resolutionConditions: readonly string[];
}
function compilerSettings(options: ts.CompilerOptions, subject: string): CompilerSettings {
  const module = options.module === undefined ? undefined : SUPPORTED_MODULE.get(options.module);
  if (!module) notModelled(`${subject}.module`, "Unsupported module kind.");
  const moduleResolution =
    options.moduleResolution === undefined ? undefined : SUPPORTED_MODULE_RESOLUTION.get(options.moduleResolution);
  if (!moduleResolution) notModelled(`${subject}.moduleResolution`, "Unsupported module resolution.");
  const target = options.target === undefined ? undefined : SUPPORTED_TARGET.get(options.target);
  if (!target) notModelled(`${subject}.target`, "Unsupported language target.");
  if (options.strict !== true) notModelled(`${subject}.strict`, "Expected a project that type checks strictly.");
  return {
    module,
    moduleResolution,
    target,
    resolutionConditions: (options.customConditions ?? []).map((name, index) =>
      text(name, `${subject}.customConditions.${index}`),
    ),
  };
}

function entryPoints(manifest: Record<string, unknown>, packageRoot: string, subject: string): EntryPoint[] {
  const exported = manifest.exports;
  if (!exported || typeof exported !== "object" || Array.isArray(exported))
    notModelled(`${subject}.exports`, "Expected a subpath map.");
  return Object.entries(exported as Record<string, unknown>)
    .map(([subpath, value]) => {
      const field = `${subject}.exports["${subpath}"]`;
      const target = text(value, field);
      if (!target.startsWith("./")) notModelled(field, "Expected a package-relative target.");
      const inPackage = target.slice(2);
      if (!insideProject(inPackage)) notModelled(field, "Target is outside the package.");
      return { subpath: text(subpath, `${subject}.exports`), target: `${packageRoot}/${inPackage}` };
    })
    .sort((a, b) => (a.subpath < b.subpath ? -1 : 1));
}

interface ReadPackage {
  readonly root: string;
  readonly packageRoot: string;
  readonly package: Omit<TypeScriptPackage, "projectReferences" | "dependencies">;
  readonly references: readonly string[];
  readonly dependencyNames: readonly string[];
  readonly settings: CompilerSettings;
}
function readPackage(workspaceRoot: string, root: string): ReadPackage {
  const packageRoot = projectRelative(workspaceRoot, root, "reference");
  const manifestPath = join(root, "package.json");
  const manifest = readJson(manifestPath, `${packageRoot}/package.json`);
  const name = text(manifest.name, `${packageRoot}/package.json.name`);
  const version = text(manifest.version, `${packageRoot}/package.json.version`);
  const tsconfigPath = join(root, "tsconfig.json");
  const config = parseConfig(tsconfigPath, `${packageRoot}/tsconfig.json`);
  const dependencies = manifest.dependencies;
  if (
    dependencies !== undefined &&
    (typeof dependencies !== "object" || dependencies === null || Array.isArray(dependencies))
  )
    notModelled(`${packageRoot}/package.json.dependencies`, "Expected a dependency table.");
  return {
    root,
    packageRoot,
    package: {
      packageId: `path:${packageRoot}#${name}@${version}`,
      name,
      version,
      packageRoot,
      tsconfigPath: projectRelative(workspaceRoot, tsconfigPath, `${packageRoot}/tsconfig.json`),
      entryPoints: entryPoints(manifest, packageRoot, `${packageRoot}/package.json`),
    },
    references: config.references,
    dependencyNames: Object.keys((dependencies ?? {}) as Record<string, unknown>),
    settings: compilerSettings(config.options, `${packageRoot}/tsconfig.json`),
  };
}

function oneSetting<T>(values: readonly T[], subject: string, spell: (value: T) => string): T {
  const distinct = new Set(values.map(spell));
  if (distinct.size !== 1) notModelled(subject, "The packages of this project state different compiler settings.");
  return values[0];
}

function condition(options: TypeScriptConditionOptions): TypeScriptCondition {
  if (ts.version !== SUPPORTED_COMPILER_API_VERSION)
    unreadable("compilerApiVersion", `Compiler API ${SUPPORTED_COMPILER_API_VERSION} is required.`);
  const workspaceRoot = resolve(options.workspaceRoot);
  const root = parseConfig(join(workspaceRoot, "tsconfig.json"), "tsconfig.json");
  if (!root.references.length) notModelled("tsconfig.json.references", "The project references no package.");

  const read = root.references.map((reference) => readPackage(workspaceRoot, reference));
  const byRoot = new Map(read.map((entry) => [entry.root, entry.package.packageId]));
  const identities = new Set(byRoot.values());
  if (identities.size !== read.length) notModelled("tsconfig.json.references", "Two packages share one identity.");
  const byName = new Map<string, string[]>();
  for (const entry of read)
    byName.set(entry.package.name, [...(byName.get(entry.package.name) ?? []), entry.package.packageId]);

  const packages: TypeScriptPackage[] = read.map((entry) => ({
    ...entry.package,
    projectReferences: entry.references.map((reference) => {
      const packageId = byRoot.get(reference);
      if (!packageId)
        notModelled(`${entry.packageRoot}/tsconfig.json.references`, "Reference is outside this project.");
      return packageId;
    }),
    dependencies: entry.dependencyNames.map((name) => {
      const candidates = byName.get(name) ?? [];
      if (candidates.length !== 1)
        notModelled(
          `${entry.packageRoot}/package.json.dependencies.${name}`,
          "Dependency is not one package of this project.",
        );
      return candidates[0];
    }),
  }));

  const settings = oneSetting(
    read.map((entry) => entry.settings),
    "tsconfig.json.compilerOptions",
    (value) => JSON.stringify(value),
  );

  const owner = read.find((entry) => entry.package.name === options.resultDefinition.packageName);
  if (!owner || (byName.get(options.resultDefinition.packageName) ?? []).length !== 1)
    unreadable("resultDefinition.packageName", "The language-support result names no single package of this project.");
  const modulePath = join(owner.root, options.resultDefinition.modulePath);
  if (!existsSync(modulePath)) unreadable("resultDefinition.modulePath", `${modulePath} is not there.`);

  return {
    compilerApiVersion: ts.version,
    module: settings.module,
    moduleResolution: settings.moduleResolution,
    target: settings.target,
    resolutionConditions: settings.resolutionConditions,
    strict: true,
    packages: packages.sort((a, b) => (a.packageId < b.packageId ? -1 : 1)),
    resultDefinition: {
      packageId: owner.package.packageId,
      modulePath: projectRelative(workspaceRoot, modulePath, "resultDefinition.modulePath"),
      typeName: text(options.resultDefinition.typeName, "resultDefinition.typeName"),
    },
  };
}

export function resolveTypeScriptCondition(options: TypeScriptConditionOptions): TypeScriptConditionResolution {
  try {
    return { kind: "resolved", condition: condition(options) };
  } catch (error) {
    if (error instanceof Refusal)
      return {
        kind: "unavailable",
        reasons: [{ code: error.code, subject: error.subject, message: error.message, location: null }],
      };
    throw error;
  }
}
