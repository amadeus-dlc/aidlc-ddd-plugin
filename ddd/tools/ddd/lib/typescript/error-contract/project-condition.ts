/**
 * The TypeScript project boundary of the business-error contract. One analysis
 * condition is resolved here from the project on disk and handed on already
 * decided; nothing below this file reads a tsconfig or a package manifest again.
 *
 * A configuration this condition does not model is refused rather than narrowed
 * to a default, so a project is never inspected under settings it never stated.
 */

import { existsSync, readFileSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";
import ts from "typescript";
import type { EntryPoint, Issue, TypeScriptCondition, TypeScriptPackage } from "../../error-contract/index.ts";
import {
  type CompilerSettings,
  compilerSettings,
  notModelled,
  parseConfig,
  Refusal,
  referencedPackageRoots,
  SUPPORTED_COMPILER_API_VERSION,
  sharedCompilerSettings,
  text,
  unreadable,
} from "../compiler/settings.ts";

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

/** One entry of a package manifest's dependency table, as it is written there. */
interface DeclaredDependency {
  readonly name: string;
  readonly selector: string;
}
interface ReadPackage {
  readonly root: string;
  readonly packageRoot: string;
  readonly package: Omit<TypeScriptPackage, "projectReferences" | "dependencies">;
  readonly references: readonly string[];
  readonly dependencies: readonly DeclaredDependency[];
  readonly settings: CompilerSettings;
}
function readPackage(workspaceRoot: string, root: string): ReadPackage {
  const packageRoot = projectRelative(workspaceRoot, root, "reference");
  const manifestPath = join(root, "package.json");
  const manifest = readJson(manifestPath, `${packageRoot}/package.json`);
  const name = text(manifest.name, `${packageRoot}/package.json.name`);
  const version = text(manifest.version, `${packageRoot}/package.json.version`);
  const tsconfigPath = join(root, "tsconfig.json");
  const config = parseConfig(ts, tsconfigPath, `${packageRoot}/tsconfig.json`);
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
    dependencies: Object.entries((dependencies ?? {}) as Record<string, unknown>).map(([entry, selector]) => ({
      name: entry,
      selector: text(selector, `${packageRoot}/package.json.dependencies.${entry}`),
    })),
    settings: compilerSettings(ts, config.options, `${packageRoot}/tsconfig.json`),
  };
}

/**
 * The dependency selectors this condition models. A workspace protocol selector
 * names the package this project carries by construction, and an exact version
 * names it when the two versions are the same. Every other selector — a range, a
 * comparator set, a tag, a registry alias, a link — is refused rather than read
 * as accepting whatever version this project happens to carry: which version a
 * range accepts is a question this boundary does not answer.
 */
const WORKSPACE_PROTOCOL = "workspace:";
const WORKSPACE_ANY = new Set(["*", "^", "~"]);
const EXACT_VERSION = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;
function requireSelectorAccepts(selector: string, version: string, subject: string): void {
  const workspace = selector.startsWith(WORKSPACE_PROTOCOL);
  const stated = workspace ? selector.slice(WORKSPACE_PROTOCOL.length) : selector;
  if (workspace && WORKSPACE_ANY.has(stated)) return;
  if (!EXACT_VERSION.test(stated)) notModelled(subject, "Expected an exact version or a workspace protocol selector.");
  if (stated !== version) notModelled(subject, `Expected the version this project carries, which is ${version}.`);
}

function condition(options: TypeScriptConditionOptions): TypeScriptCondition {
  if (ts.version !== SUPPORTED_COMPILER_API_VERSION)
    unreadable("compilerApiVersion", `Compiler API ${SUPPORTED_COMPILER_API_VERSION} is required.`);
  const workspaceRoot = resolve(options.workspaceRoot);
  const read = referencedPackageRoots(ts, workspaceRoot).map((reference) => readPackage(workspaceRoot, reference));
  const byRoot = new Map(read.map((entry) => [entry.root, entry.package.packageId]));
  const identities = new Set(byRoot.values());
  if (identities.size !== read.length) notModelled("tsconfig.json.references", "Two packages share one identity.");
  const byName = new Map<string, string[]>();
  for (const entry of read)
    byName.set(entry.package.name, [...(byName.get(entry.package.name) ?? []), entry.package.packageId]);
  const versionOf = new Map(read.map((entry) => [entry.package.packageId, entry.package.version]));

  const packages: TypeScriptPackage[] = read.map((entry) => ({
    ...entry.package,
    projectReferences: entry.references.map((reference) => {
      const packageId = byRoot.get(reference);
      if (!packageId)
        notModelled(`${entry.packageRoot}/tsconfig.json.references`, "Reference is outside this project.");
      return packageId;
    }),
    dependencies: entry.dependencies.map(({ name, selector }) => {
      const field = `${entry.packageRoot}/package.json.dependencies.${name}`;
      const candidates = byName.get(name) ?? [];
      if (candidates.length !== 1) notModelled(field, "Dependency is not one package of this project.");
      requireSelectorAccepts(selector, versionOf.get(candidates[0]) ?? "", field);
      return candidates[0];
    }),
  }));

  const settings = sharedCompilerSettings(read.map((entry) => entry.settings));

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
