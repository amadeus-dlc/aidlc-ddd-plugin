/**
 * The compiler one inspection runs on, built from the frozen snapshot and the
 * recorded project condition and from nothing else: no project discovery, no
 * ambient types, no file the snapshot does not carry, and no emit.
 *
 * Module resolution is decided here as well, because which file a specifier
 * names and how it crosses a package boundary are one question. The recorded
 * entry points are what a package publishes, so a specifier is answered from the
 * condition rather than from a package manifest read again at inspection time.
 */

import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, posix } from "node:path";
import ts from "typescript";
import type { ReasonCode, SourceInput, TypeScriptCondition } from "../../error-contract/index.ts";
import { compilerPath, INPUT_ROOT, packageOf } from "./context.ts";

export const TS_ERROR_CONTRACT_TOOLCHAIN = [
  { name: "ddd-typescript-error-contract", version: "1" },
  { name: "typescript", version: ts.version },
];

/** The compiler setting each recorded value stands for; the boundary refuses every other value. */
const MODULE_KIND: Record<TypeScriptCondition["module"], ts.ModuleKind> = { esnext: ts.ModuleKind.ESNext };
const MODULE_RESOLUTION: Record<TypeScriptCondition["moduleResolution"], ts.ModuleResolutionKind> = {
  bundler: ts.ModuleResolutionKind.Bundler,
};
const LANGUAGE_TARGET: Record<TypeScriptCondition["target"], ts.ScriptTarget> = { esnext: ts.ScriptTarget.ESNext };

export type SpecifierResolution =
  | { readonly kind: "same-package"; readonly file: string }
  | { readonly kind: "package-entry" | "internal-path"; readonly file: string; readonly packageId: string }
  | { readonly kind: "unresolved"; readonly code: ReasonCode; readonly message: string };

function unresolved(code: ReasonCode, message: string): SpecifierResolution {
  return { kind: "unresolved", code, message };
}

/**
 * Two packages that share a name are never merged into one candidate: whether
 * they also share a version decides which limit the reference ran into, and
 * neither is answered by picking one of them.
 */
function namedPackage(
  condition: TypeScriptCondition,
  name: string,
): TypeScriptCondition["packages"][number] | SpecifierResolution {
  const candidates = condition.packages.filter((entry) => entry.name === name);
  if (candidates.length === 0) return unresolved("missing-referent", `No package of this project is named ${name}.`);
  if (candidates.length > 1)
    return new Set(candidates.map((entry) => entry.version)).size > 1
      ? unresolved("unsupported-version-resolution", `More than one version of ${name} is in this project.`)
      : unresolved("multiple-package-versions", `More than one package of this project is named ${name}.`);
  return candidates[0];
}

export function resolveSpecifier(
  condition: TypeScriptCondition,
  sources: ReadonlySet<string>,
  specifier: string,
  containingPath: string,
): SpecifierResolution {
  const owner = packageOf(condition, containingPath);
  if (specifier.startsWith("./") || specifier.startsWith("../")) {
    const file = posix.normalize(posix.join(posix.dirname(containingPath), specifier));
    if (!sources.has(file)) return unresolved("missing-referent", `${specifier} names no source of this snapshot.`);
    const target = packageOf(condition, file);
    if (!target) return unresolved("missing-referent", `${specifier} names no package of this project.`);
    if (target.packageId === owner?.packageId) return { kind: "same-package", file };
    return { kind: "internal-path", file, packageId: target.packageId };
  }
  const segments = specifier.split("/");
  const found = namedPackage(condition, segments[0]);
  if ("kind" in found) return found;
  const subpath = segments.length === 1 ? "." : `./${segments.slice(1).join("/")}`;
  const entry = found.entryPoints.find((point) => point.subpath === subpath);
  if (!entry) return unresolved("missing-referent", `${found.name} publishes no entry point ${subpath}.`);
  if (!sources.has(entry.target))
    return unresolved("missing-referent", `${entry.target} is no source of this snapshot.`);
  return { kind: "package-entry", file: entry.target, packageId: found.packageId };
}

/** Every compiler-owned standard library asset, and no ambient type package. */
function standardLibrary(): Map<string, string> {
  const compilerLib = dirname(require.resolve("typescript"));
  const files = new Map<string, string>();
  for (const name of readdirSync(compilerLib))
    if (/^lib\.[\w.]+\.d\.ts$/.test(name)) files.set(`/lib/${name}`, readFileSync(join(compilerLib, name), "utf8"));
  return files;
}

/**
 * A program belongs to one request. Nothing here is held across calls, so a
 * changed condition can never be answered from an earlier one's compiler.
 */
export function createInspectionProgram(sources: readonly SourceInput[], condition: TypeScriptCondition): ts.Program {
  if (ts.version !== condition.compilerApiVersion)
    throw new Error(`Compiler API ${condition.compilerApiVersion} is required`);
  const files = standardLibrary();
  for (const source of sources) files.set(compilerPath(source.path), source.content);
  const paths = new Set(sources.map((source) => source.path));
  const options: ts.CompilerOptions = {
    target: LANGUAGE_TARGET[condition.target],
    module: MODULE_KIND[condition.module],
    moduleResolution: MODULE_RESOLUTION[condition.moduleResolution],
    customConditions: [...condition.resolutionConditions],
    strict: condition.strict,
    allowImportingTsExtensions: true,
    noEmit: true,
    types: [],
    lib: ["lib.esnext.d.ts"],
  };
  const host: ts.CompilerHost = {
    getSourceFile: (file, version) => {
      const text = files.get(posix.normalize(file));
      return text === undefined ? undefined : ts.createSourceFile(file, text, version, true);
    },
    getDefaultLibFileName: () => "/lib/lib.esnext.d.ts",
    getDefaultLibLocation: () => "/lib",
    writeFile: () => {
      throw new Error("source emission forbidden");
    },
    getCurrentDirectory: () => INPUT_ROOT,
    getDirectories: () => [],
    fileExists: (file) => files.has(posix.normalize(file)),
    readFile: (file) => files.get(posix.normalize(file)),
    getCanonicalFileName: (file) => file,
    useCaseSensitiveFileNames: () => true,
    getNewLine: () => "\n",
    resolveModuleNameLiterals: (literals, containingFile) =>
      literals.map((literal) => {
        const resolved = resolveSpecifier(condition, paths, literal.text, containingFile.slice(INPUT_ROOT.length + 1));
        return {
          resolvedModule:
            resolved.kind === "unresolved"
              ? undefined
              : { resolvedFileName: compilerPath(resolved.file), extension: ts.Extension.Ts },
        };
      }),
  };
  return ts.createProgram(
    sources.map((source) => compilerPath(source.path)),
    options,
    host,
  );
}
