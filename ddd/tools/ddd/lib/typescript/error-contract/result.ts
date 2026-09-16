/**
 * What an operation's declared return type states: no result contract when it
 * returns nothing, and otherwise whether it is the standard result, which types
 * it carries, and how the declaration those types name was reached - the error
 * declaration for the standard result, the returned declaration for any other.
 *
 * Only a type annotation states a contract. A spelling in a comment, a string or
 * a template literal is not in type position and never establishes one, and a
 * body that only asserts its shape is not a declared return type either.
 *
 * The standard result is decided by identity with the declaration the condition
 * configures, never by the spelling of a name, so an application type that
 * happens to be named the same is refused rather than accepted.
 */

import ts from "typescript";
import type {
  ErrorCaseSet,
  Fact,
  Issue,
  ResolutionStep,
  ResultContract,
  TypeReference,
} from "../../error-contract/index.ts";
import { errorCasesOf } from "./cases.ts";
import { type Context, compilerPath, location, problem } from "./context.ts";
import type { OperationDeclaration } from "./operation.ts";
import { resolveTypeName } from "./reference.ts";

export interface ContractFacts {
  readonly resultContract: Fact<ResultContract>;
  readonly errorCases: Fact<ErrorCaseSet>;
  readonly steps: readonly ResolutionStep[];
}

/** One failure states both facts, so a reason is never traded for a differently shaped one. */
function refused(issue: Issue, steps: readonly ResolutionStep[]): ContractFacts {
  return {
    resultContract: { status: "unresolved", reasons: [issue] },
    errorCases: { status: "unresolved", reasons: [issue] },
    steps,
  };
}

function containsAssertion(node: ts.Node): boolean {
  return (
    ts.isAsExpression(node) ||
    ts.isTypeAssertionExpression(node) ||
    ts.isSatisfiesExpression(node) ||
    ts.forEachChild(node, (child) => containsAssertion(child) || undefined) === true
  );
}
function returnsAssertion(declaration: OperationDeclaration): boolean {
  const body = ts.isMethodDeclaration(declaration) ? declaration.body : undefined;
  if (!body) return false;
  let found = false;
  const visit = (node: ts.Node) => {
    if (node !== body && ts.isFunctionLike(node)) return;
    if (ts.isReturnStatement(node) && node.expression && containsAssertion(node.expression)) found = true;
    ts.forEachChild(node, visit);
  };
  visit(body);
  return found;
}

/** The declaration this project configures as its language-support result. */
function configuredResult(context: Context): ts.Declaration | undefined {
  const file = context.program.getSourceFile(compilerPath(context.condition.resultDefinition.modulePath));
  return file?.statements.find(
    (statement): statement is ts.TypeAliasDeclaration | ts.InterfaceDeclaration | ts.ClassDeclaration =>
      (ts.isTypeAliasDeclaration(statement) ||
        ts.isInterfaceDeclaration(statement) ||
        ts.isClassDeclaration(statement)) &&
      statement.name?.text === context.condition.resultDefinition.typeName,
  );
}

function typeParameterOf(context: Context, node: ts.TypeNode): string | undefined {
  if (!ts.isTypeReferenceNode(node) || !ts.isIdentifier(node.typeName) || node.typeArguments) return undefined;
  const declaration = context.checker.getSymbolAtLocation(node.typeName)?.declarations?.[0];
  return declaration && ts.isTypeParameterDeclaration(declaration) ? node.typeName.text : undefined;
}
function substitute(
  context: Context,
  node: ts.TypeNode,
  bindings: ReadonlyMap<string, ts.TypeNode>,
): ts.TypeNode | undefined {
  const parameter = typeParameterOf(context, node);
  if (parameter === undefined) return node;
  return bindings.get(parameter);
}

/** The success type states what an operation produces; the path to it is not how the error was reached. */
function successReference(context: Context, node: ts.TypeNode): TypeReference | Issue {
  if (node.kind === ts.SyntaxKind.VoidKeyword) return { kind: "unit" };
  if (!ts.isTypeReferenceNode(node) || !ts.isIdentifier(node.typeName))
    return problem(context, "unsupported-syntax", "The success type is outside this condition.", node);
  const resolved = resolveTypeName(context, node.typeName, null);
  return resolved.kind === "resolved" ? { kind: "nominal", symbolId: resolved.target.symbolId } : resolved.issue;
}

function declaredName(declaration: ts.Declaration): string | undefined {
  const name = (declaration as ts.NamedDeclaration).name;
  return name && ts.isIdentifier(name) ? name.text : undefined;
}

function escapes(node: ts.TypeNode): boolean {
  return node.kind === ts.SyntaxKind.AnyKeyword || node.kind === ts.SyntaxKind.UnknownKeyword;
}

/** A name that crosses no alias still reached its declaration, so a resolved reference is never pathless. */
function referencePath(
  context: Context,
  name: ts.Identifier,
  symbolId: string,
  hops: readonly ResolutionStep[],
): ResolutionStep[] {
  return hops.length
    ? [...hops]
    : [{ kind: "direct", reference: name.text, resolved: symbolId, location: location(context, name) }];
}

function standardResultFacts(
  context: Context,
  annotation: ts.TypeNode,
  application: ts.TypeReferenceNode,
  bindings: ReadonlyMap<string, ts.TypeNode>,
  steps: ResolutionStep[],
): ContractFacts {
  const args = (application.typeArguments ?? []).map((argument) => substitute(context, argument, bindings));
  if (args.length !== 2 || args.some((argument) => argument === undefined))
    return refused(
      problem(
        context,
        "unsupported-type-argument",
        "The standard result states a success and an error type.",
        application,
      ),
      steps,
    );
  const [success, error] = args as ts.TypeNode[];
  for (const argument of [success, error])
    if (escapes(argument))
      return refused(problem(context, "escape-type", "An escape type states no contract.", argument), steps);

  const successType = successReference(context, success);
  if ("code" in successType) return refused(successType, steps);
  if (!ts.isTypeReferenceNode(error) || !ts.isIdentifier(error.typeName))
    return refused(problem(context, "open-error-type", "The error type names no declaration.", error), steps);

  const errorSteps: ResolutionStep[] = [];
  const resolved = resolveTypeName(context, error.typeName, errorSteps);
  if (resolved.kind !== "resolved") return refused(resolved.issue, [...steps, ...errorSteps]);
  const path = [...steps, ...referencePath(context, error.typeName, resolved.target.symbolId, errorSteps)];

  const contract: Fact<ResultContract> = {
    status: "resolved",
    value: { standardResult: true, successType, errorType: { kind: "nominal", symbolId: resolved.target.symbolId } },
    evidence: [location(context, annotation)],
  };
  const cases = errorCasesOf(context, resolved.target.declaration, error);
  return cases.kind === "closed"
    ? {
        resultContract: contract,
        errorCases: { status: "resolved", value: cases.value, evidence: [location(context, error)] },
        steps: path,
      }
    : refused(cases.issue, path);
}

export function resolveResultContract(context: Context, declaration: OperationDeclaration): ContractFacts {
  const annotation = declaration.type;
  if (!annotation)
    return refused(
      returnsAssertion(declaration)
        ? problem(context, "unchecked-assertion", "Only an assertion states this return type.", declaration)
        : problem(context, "expression-inference-required", "Only the body states this return type.", declaration),
      [],
    );
  const configured = configuredResult(context);
  if (!configured)
    return refused(
      problem(context, "unsupported-syntax", "The configured language-support result is not declared.", annotation),
      [],
    );

  const steps: ResolutionStep[] = [];
  const followed = new Set<ts.Declaration>();
  let node: ts.TypeNode = annotation;
  let bindings: ReadonlyMap<string, ts.TypeNode> = new Map();
  for (;;) {
    if (!ts.isTypeReferenceNode(node) || !ts.isIdentifier(node.typeName))
      return node.kind === ts.SyntaxKind.VoidKeyword
        ? {
            resultContract: { status: "absent", evidence: [location(context, annotation)] },
            errorCases: { status: "absent", evidence: [location(context, annotation)] },
            steps,
          }
        : refused(
            problem(context, "unsupported-syntax", "The declared return type is outside this condition.", node),
            steps,
          );

    const reached: ResolutionStep[] = [];
    const resolved = resolveTypeName(context, node.typeName, reached);
    if (resolved.kind !== "resolved") return refused(resolved.issue, steps);
    if (resolved.target.declaration === configured)
      return standardResultFacts(context, annotation, node, bindings, steps);

    // The name of the configured result is not its identity: another declaration under that
    // spelling is refused rather than read as the standard result.
    if (declaredName(resolved.target.declaration) === context.condition.resultDefinition.typeName)
      return refused(
        problem(
          context,
          "shadowed-result-identity",
          "This declaration is not the configured language-support result.",
          node,
        ),
        steps,
      );

    const alias = resolved.target.declaration;
    if (!ts.isTypeAliasDeclaration(alias) || !ts.isTypeReferenceNode(alias.type))
      return {
        resultContract: {
          status: "resolved",
          value: { standardResult: false, resultType: { kind: "nominal", symbolId: resolved.target.symbolId } },
          evidence: [location(context, annotation)],
        },
        errorCases: { status: "absent", evidence: [location(context, annotation)] },
        steps: [...steps, ...referencePath(context, node.typeName, resolved.target.symbolId, reached)],
      };
    if (followed.has(alias))
      return refused(problem(context, "alias-cycle", "The alias chain resolves through itself.", node), steps);
    followed.add(alias);

    const parameters = alias.typeParameters ?? [];
    const args = (node.typeArguments ?? []).map((argument) => substitute(context, argument, bindings));
    if (args.length !== parameters.length || args.some((argument) => argument === undefined))
      return refused(problem(context, "unsupported-type-argument", "A type argument is not bound.", node), steps);
    steps.push(...reached, {
      kind: "type-alias",
      reference: node.typeName.text,
      resolved: resolved.target.symbolId,
      location: location(context, node.typeName),
    });
    bindings = new Map(parameters.map((parameter, index) => [parameter.name.text, (args as ts.TypeNode[])[index]]));
    node = alias.type;
  }
}
