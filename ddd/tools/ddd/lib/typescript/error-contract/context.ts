/**
 * What every step of a TypeScript inspection shares: the frozen request, the
 * resolved project condition, the compiler it built, and the spellings the
 * shared contract records. Identifiers and locations are stated in the project's
 * own terms, so no compiler-owned path reaches the contract.
 */

import ts from "typescript";
import type {
  Issue,
  Location,
  ReasonCode,
  TypeScriptCondition,
  TypeScriptInspectionRequest,
  TypeScriptPackage,
} from "../../error-contract/index.ts";
import { byteLocation } from "../../error-contract-verification/input.ts";
import type { TypeScriptCodeRepresentation } from "../../project-settings/contract.ts";

/** The compiler reads the snapshot under one root of its own; nothing outside it exists. */
export const INPUT_ROOT = "/input";

export interface Context {
  readonly request: TypeScriptInspectionRequest;
  readonly condition: TypeScriptCondition;
  readonly representation: TypeScriptCodeRepresentation;
  readonly program: ts.Program;
  readonly checker: ts.TypeChecker;
}

export function compilerPath(sourcePath: string): string {
  return `${INPUT_ROOT}/${sourcePath}`;
}
/**
 * The project path a snapshot file is named by. A compiler-owned library file
 * yields a spelling no package root can own and no location can accept, so a
 * declaration outside the snapshot is refused rather than named as one of it.
 */
export function projectPath(file: ts.SourceFile): string {
  return file.fileName.slice(INPUT_ROOT.length + 1);
}

export function location(context: Context, node: ts.Node): Location {
  const file = node.getSourceFile();
  return byteLocation(
    context.request,
    projectPath(file),
    Buffer.byteLength(file.text.slice(0, node.getStart(file))),
    Buffer.byteLength(file.text.slice(0, node.end)),
  );
}

/** Every issue of one inspection names the operation it was requested for. */
export function subjectOf(request: TypeScriptInspectionRequest): string {
  return [...request.target.declarationPath, request.target.operation].join("::");
}

export function problem(context: Context, code: ReasonCode, message: string, node?: ts.Node): Issue {
  return { code, message, subject: subjectOf(context.request), location: node ? location(context, node) : null };
}

/**
 * A symbol identity names one declaration across packages, modules and owners.
 * Every part is escaped before it is joined, so a part that spells the separator
 * cannot make two different declarations share one identity.
 */
function part(value: string): string {
  return value.replaceAll("%", "%25").replaceAll(":", "%3A");
}
function symbolId(packageId: string, modulePath: string, declarationPath: readonly string[]): string {
  return [packageId, modulePath, ...declarationPath].map(part).join("::");
}

/** The package that owns a project path, by the longest root that contains it. */
export function packageOf(condition: TypeScriptCondition, path: string): TypeScriptPackage | undefined {
  return condition.packages
    .filter((entry) => path === entry.packageRoot || path.startsWith(`${entry.packageRoot}/`))
    .sort((a, b) => b.packageRoot.length - a.packageRoot.length)[0];
}

/** The names that lead from a module to a declaration, outermost first. */
export function declarationPathOf(node: ts.Node): string[] {
  const path: string[] = [];
  for (let current: ts.Node | undefined = node; current && !ts.isSourceFile(current); current = current.parent) {
    const name = (current as ts.NamedDeclaration).name;
    if (name && (ts.isIdentifier(name) || ts.isStringLiteral(name))) path.unshift(name.text);
  }
  return path;
}

export function declarationIdentity(context: Context, node: ts.Node): string | undefined {
  const modulePath = projectPath(node.getSourceFile());
  const owner = packageOf(context.condition, modulePath);
  const path = declarationPathOf(node);
  return owner && path.length ? symbolId(owner.packageId, modulePath, path) : undefined;
}
