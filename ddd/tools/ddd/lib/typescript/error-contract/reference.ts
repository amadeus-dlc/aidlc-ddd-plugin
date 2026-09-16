/**
 * How a name written in type position reaches the declaration it names, and what
 * that path crossed on the way. Each hop is classified from the declaration that
 * carries it, so a rename, a type-only import and a re-export stay apart even
 * when they end at one declaration.
 *
 * A specifier is classified before the compiler's answer is used, so a reference
 * that ran into a package limit reports that limit rather than the absence the
 * limit caused.
 */

import ts from "typescript";
import type { Issue, ResolutionStep, ResolutionStepKind } from "../../error-contract/index.ts";
import { type Context, declarationIdentity, location, packageOf, problem, projectPath } from "./context.ts";
import { resolveSpecifier } from "./program.ts";

export interface ReferenceTarget {
  readonly declaration: ts.Declaration;
  readonly symbolId: string;
}
export type ReferenceResolution =
  | { readonly kind: "resolved"; readonly target: ReferenceTarget }
  | { readonly kind: "unresolved"; readonly issue: Issue };

/** The hop an alias declaration is, and the module it reads a name from. */
interface Hop {
  readonly kind: ResolutionStepKind;
  readonly name: ts.Node;
  readonly moduleSpecifier?: ts.StringLiteralLike;
}

function specifierOf(node: ts.Expression | undefined): ts.StringLiteralLike | undefined {
  return node && ts.isStringLiteralLike(node) ? node : undefined;
}

function importHop(node: ts.ImportSpecifier): Hop {
  const clause = node.parent.parent;
  const declaration = clause.parent;
  const typeOnly = node.isTypeOnly || clause.isTypeOnly;
  return {
    kind: typeOnly ? "import-type" : node.propertyName ? "import-alias" : "direct",
    name: node.name,
    moduleSpecifier: ts.isImportDeclaration(declaration) ? specifierOf(declaration.moduleSpecifier) : undefined,
  };
}

function exportHop(node: ts.ExportSpecifier): Hop {
  const specifier = specifierOf(node.parent.parent.moduleSpecifier);
  return { kind: specifier ? "re-export" : "direct", name: node.name, moduleSpecifier: specifier };
}

function hopOf(declaration: ts.Declaration): Hop | undefined {
  if (ts.isImportSpecifier(declaration)) return importHop(declaration);
  if (ts.isExportSpecifier(declaration)) return exportHop(declaration);
  return undefined;
}

/** The declaration a symbol stands for, preferring the one that declares a type. */
function declarationOf(symbol: ts.Symbol): ts.Declaration | undefined {
  const declarations = symbol.declarations ?? [];
  return (
    declarations.find(
      (entry) =>
        ts.isTypeAliasDeclaration(entry) ||
        ts.isInterfaceDeclaration(entry) ||
        ts.isClassDeclaration(entry) ||
        ts.isEnumDeclaration(entry),
    ) ?? declarations[0]
  );
}

function refused(issue: Issue): ReferenceResolution {
  return { kind: "unresolved", issue };
}

/**
 * Walks the alias chain of a written name. `steps` collects the path when the
 * caller records it; resolving a name only to decide an identity passes null.
 */
export function resolveTypeName(
  context: Context,
  name: ts.Identifier,
  steps: ResolutionStep[] | null,
): ReferenceResolution {
  const sources = new Set(context.request.sources.map((source) => source.path));
  let symbol = context.checker.getSymbolAtLocation(name);
  if (!symbol) return refused(problem(context, "missing-referent", `${name.text} names no declaration.`, name));
  const seen = new Set<ts.Symbol>();
  while (symbol.flags & ts.SymbolFlags.Alias) {
    if (seen.has(symbol))
      return refused(problem(context, "alias-cycle", `${name.text} resolves through itself.`, name));
    seen.add(symbol);
    const declaration = declarationOf(symbol);
    if (!declaration) return refused(problem(context, "missing-referent", `${name.text} names no declaration.`, name));
    const hop = hopOf(declaration);
    if (!hop)
      return refused(problem(context, "unsupported-syntax", "This import form is outside the condition.", declaration));
    if (hop.moduleSpecifier) {
      const containing = projectPath(declaration.getSourceFile());
      const crossing = resolveSpecifier(context.condition, sources, hop.moduleSpecifier.text, containing);
      if (crossing.kind === "unresolved")
        return refused(problem(context, crossing.code, crossing.message, hop.moduleSpecifier));
      if (crossing.kind !== "same-package") {
        const owner = packageOf(context.condition, containing);
        if (!owner?.projectReferences.includes(crossing.packageId))
          return refused(
            problem(
              context,
              "invalid-project-reference",
              `${containing} reaches a package its project references do not carry.`,
              hop.moduleSpecifier,
            ),
          );
        steps?.push({
          kind: crossing.kind,
          reference: hop.moduleSpecifier.text,
          resolved: crossing.file,
          location: location(context, hop.moduleSpecifier),
        });
      }
    }
    const next = context.checker.getImmediateAliasedSymbol(symbol);
    if (!next) return refused(problem(context, "missing-referent", `${name.text} reaches no declaration.`, hop.name));
    const reached = declarationOf(next);
    const reachedIdentity = reached && declarationIdentity(context, reached);
    if (!reachedIdentity)
      return refused(
        problem(context, "missing-referent", `${name.text} reaches no declaration of this project.`, hop.name),
      );
    steps?.push({
      kind: hop.kind,
      reference: hop.name.getText(hop.name.getSourceFile()),
      resolved: reachedIdentity,
      location: location(context, hop.name),
    });
    symbol = next;
  }
  const declaration = declarationOf(symbol);
  const identity = declaration && declarationIdentity(context, declaration);
  if (!declaration || !identity)
    return refused(problem(context, "missing-referent", `${name.text} names no declaration.`, name));
  return { kind: "resolved", target: { declaration, symbolId: identity } };
}
