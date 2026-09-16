/**
 * Which declaration an inspected operation is, under the code representation the
 * project settings name. A class states its operations on the class itself; a
 * structure and its companion state instance operations on the type and
 * generation methods on the companion value, so reaching one of those is itself
 * a step of the resolution.
 */

import ts from "typescript";
import type { Issue, OperationIdentity, ResolutionStep } from "../../error-contract/index.ts";
import { type Context, declarationIdentity, declarationPathOf, location, problem } from "./context.ts";

/** Both forms carry a name and a declared return type; only the class form carries a body. */
export type OperationDeclaration = ts.MethodDeclaration | ts.MethodSignature;

export type OperationLookup =
  | {
      readonly kind: "found";
      readonly declaration: OperationDeclaration;
      readonly identity: OperationIdentity;
      readonly step: ResolutionStep | null;
    }
  | { readonly kind: "missing"; readonly issue: Issue };

function named(node: ts.Node, name: string): boolean {
  const declared = (node as ts.NamedDeclaration).name;
  return !!declared && (ts.isIdentifier(declared) || ts.isStringLiteral(declared)) && declared.text === name;
}

function classOperations(file: ts.SourceFile, owner: string, operation: string): OperationDeclaration[] {
  return file.statements
    .filter(
      (statement): statement is ts.ClassDeclaration => ts.isClassDeclaration(statement) && named(statement, owner),
    )
    .flatMap((declaration) => declaration.members.filter(ts.isMethodDeclaration))
    .filter((member) => named(member, operation));
}

/** The instance operations a companion's type states and the generation methods its value states. */
function companionOperations(file: ts.SourceFile, owner: string, operation: string): OperationDeclaration[] {
  const fromType = file.statements
    .filter(
      (statement): statement is ts.TypeAliasDeclaration =>
        ts.isTypeAliasDeclaration(statement) && named(statement, owner),
    )
    .flatMap((declaration) => (ts.isTypeLiteralNode(declaration.type) ? [...declaration.type.members] : []))
    .filter((member): member is ts.MethodSignature => ts.isMethodSignature(member) && named(member, operation));
  const fromValue = file.statements
    .filter(ts.isVariableStatement)
    .flatMap((statement) => [...statement.declarationList.declarations])
    .filter((declaration) => named(declaration, owner))
    .flatMap((declaration) =>
      declaration.initializer && ts.isObjectLiteralExpression(declaration.initializer)
        ? [...declaration.initializer.properties]
        : [],
    )
    .filter(
      (property): property is ts.MethodDeclaration => ts.isMethodDeclaration(property) && named(property, operation),
    );
  return [...fromType, ...fromValue];
}

export function locateOperation(context: Context, file: ts.SourceFile): OperationLookup {
  const target = context.request.target;
  if (target.declarationPath.length !== 1)
    return {
      kind: "missing",
      issue: problem(context, "unsupported-syntax", "An operation owner is named by one declaration."),
    };
  const owner = target.declarationPath[0];
  const found =
    context.representation === "class"
      ? classOperations(file, owner, target.operation)
      : companionOperations(file, owner, target.operation);
  if (found.length !== 1)
    return {
      kind: "missing",
      issue: problem(
        context,
        found.length ? "target-ambiguous" : "target-missing",
        `${owner}::${target.operation} is not one declaration of this module.`,
      ),
    };
  const declaration = found[0];
  const identity = declarationIdentity(context, declaration);
  if (!identity)
    return {
      kind: "missing",
      issue: problem(
        context,
        "missing-referent",
        "The operation belongs to no package of this condition.",
        declaration,
      ),
    };
  const path = declarationPathOf(declaration);
  return {
    kind: "found",
    declaration,
    identity: {
      symbolId: identity,
      packageId: target.packageId,
      declarationPath: [owner],
      operation: target.operation,
    },
    // The companion form splits a type from its value, so reaching the operation crossed that split.
    step:
      context.representation === "companion"
        ? {
            kind: "companion",
            reference: path.join("::"),
            resolved: identity,
            location: location(context, declaration),
          }
        : null,
  };
}
