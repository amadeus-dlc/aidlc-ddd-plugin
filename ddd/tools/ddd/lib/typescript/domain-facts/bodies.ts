/**
 * What a body does to state, read from its syntax alone: which members of `this` and which captured
 * bindings it writes, whether it is nothing but the return of one of them, and which type the
 * nearest binding of a name states.
 *
 * A binding is captured when the body does not declare it: a parameter, a local, a nested function
 * or class, or a caught error declared anywhere inside the body is the body's own. A captured binding
 * an enclosing function declares is closure state; one declared at the top of the file is module
 * state. A write to any captured binding is recorded; a call of an array, `Map` or `Set` changing
 * method on closure state is recorded as a write to it; and only a member of `this` or closure state,
 * or closure state itself, counts as state a getter returns. No name is resolved further than that,
 * so a write through an alias of `this` or through a value handed in is not state the body is
 * recorded to write.
 */

import type ts from "typescript";
import type { CompilerApi } from "../compiler/settings.ts";
import type { WriteFact } from "./contract.ts";

interface BodyEffects {
  readonly writes: readonly WriteFact[];
  readonly returns_state_only: boolean;
}

/** Every name a binding inside `node` declares, nested functions included. */
function declaredNames(api: CompilerApi, node: ts.Node): Set<string> {
  const names = new Set<string>();
  const bind = (name: ts.BindingName): void => {
    if (api.isIdentifier(name)) {
      names.add(name.text);
      return;
    }
    for (const element of name.elements) if (!api.isOmittedExpression(element)) bind(element.name);
  };
  const visit = (current: ts.Node): void => {
    if (api.isParameter(current) || api.isVariableDeclaration(current) || api.isBindingElement(current))
      bind(current.name);
    else if (
      (api.isFunctionDeclaration(current) || api.isClassDeclaration(current) || api.isFunctionExpression(current)) &&
      current.name
    )
      names.add(current.name.text);
    api.forEachChild(current, visit);
  };
  visit(node);
  return names;
}

function unwrap(api: CompilerApi, expression: ts.Expression): ts.Expression {
  let current = expression;
  while (api.isParenthesizedExpression(current) || api.isNonNullExpression(current)) current = current.expression;
  return current;
}

/**
 * The state a written expression reaches: `this.x…` writes member `x` of `this`, and `name…` writes
 * the binding `name` when the body captures it.
 */
function writtenState(api: CompilerApi, target: ts.Expression, locals: ReadonlySet<string>): WriteFact | null {
  let current = unwrap(api, target);
  let member: string | null = null;
  while (api.isPropertyAccessExpression(current) || api.isElementAccessExpression(current)) {
    if (api.isPropertyAccessExpression(current)) member = current.name.text;
    else
      member =
        api.isStringLiteral(current.argumentExpression) || api.isNumericLiteral(current.argumentExpression)
          ? current.argumentExpression.text
          : "[]";
    current = unwrap(api, current.expression);
  }
  if (current.kind === api.SyntaxKind.ThisKeyword) return member === null ? null : { target: "this", name: member };
  if (api.isIdentifier(current) && !locals.has(current.text)) return { target: "captured", name: current.text };
  return null;
}

function isAssignment(api: CompilerApi, kind: ts.SyntaxKind): boolean {
  return kind >= api.SyntaxKind.FirstAssignment && kind <= api.SyntaxKind.LastAssignment;
}

/**
 * The methods an array, a `Map` or a `Set` changes itself through. Called on closure state, they
 * change that state as an assignment to it would.
 */
export const COLLECTION_MUTATORS: ReadonlySet<string> = new Set([
  "push",
  "pop",
  "shift",
  "unshift",
  "splice",
  "sort",
  "reverse",
  "fill",
  "copyWithin",
  "set",
  "add",
  "delete",
  "clear",
]);

/** The identifier an access chain `a.b[c].d` starts from, or undefined when it starts elsewhere. */
function rootIdentifier(api: CompilerApi, expression: ts.Expression): ts.Identifier | undefined {
  let current = unwrap(api, expression);
  while (api.isPropertyAccessExpression(current) || api.isElementAccessExpression(current))
    current = unwrap(api, current.expression);
  return api.isIdentifier(current) ? current : undefined;
}

/**
 * Whether `name`, seen from `fn`, is closure state: bound by an enclosing function rather than by
 * `fn` itself or at the top of the file, where it is module state shared by every instance.
 */
function isClosureState(api: CompilerApi, fn: ts.Node, name: string, locals: ReadonlySet<string>): boolean {
  if (locals.has(name)) return false;
  const found = nearestBinding(api, fn, name);
  return found !== undefined && !api.isSourceFile(found.scope);
}

/** Whether `expression` is state read off `this` or off closure state, or closure state itself. */
function isStateRead(api: CompilerApi, fn: ts.Node, expression: ts.Expression, locals: ReadonlySet<string>): boolean {
  const read = unwrap(api, expression);
  if (api.isIdentifier(read)) return isClosureState(api, fn, read.text, locals);
  if (!api.isPropertyAccessExpression(read)) return false;
  const owner = unwrap(api, read.expression);
  return (
    owner.kind === api.SyntaxKind.ThisKeyword ||
    (api.isIdentifier(owner) && isClosureState(api, fn, owner.text, locals))
  );
}

/** What the body of `fn` writes, and whether it only returns state. A function without a body does neither. */
export function bodyEffects(api: CompilerApi, fn: ts.FunctionLikeDeclaration): BodyEffects {
  const body = fn.body;
  if (!body) return { writes: [], returns_state_only: false };
  const locals = declaredNames(api, fn);
  const writes = new Map<string, WriteFact>();
  const record = (target: ts.Expression) => {
    const written = writtenState(api, target, locals);
    if (written) writes.set(`${written.target}\u0000${written.name}`, written);
  };
  const visit = (node: ts.Node): void => {
    if (api.isBinaryExpression(node) && isAssignment(api, node.operatorToken.kind)) record(node.left);
    else if (
      (api.isPrefixUnaryExpression(node) || api.isPostfixUnaryExpression(node)) &&
      (node.operator === api.SyntaxKind.PlusPlusToken || node.operator === api.SyntaxKind.MinusMinusToken)
    )
      record(node.operand);
    else if (api.isDeleteExpression(node)) record(node.expression);
    else if (
      api.isCallExpression(node) &&
      api.isPropertyAccessExpression(node.expression) &&
      COLLECTION_MUTATORS.has(node.expression.name.text)
    ) {
      const root = rootIdentifier(api, node.expression.expression);
      if (root && isClosureState(api, fn, root.text, locals))
        writes.set(`captured\u0000${root.text}`, { target: "captured", name: root.text });
    }
    api.forEachChild(node, visit);
  };
  visit(body);
  const returned = api.isBlock(body)
    ? body.statements.length === 1 && api.isReturnStatement(body.statements[0])
      ? body.statements[0].expression
      : undefined
    : body;
  return {
    writes: [...writes.values()],
    returns_state_only: returned !== undefined && isStateRead(api, fn, returned, locals),
  };
}

/** Declarations a block-like scope makes visible to the statements it holds. */
function scopeBinding(api: CompilerApi, statements: readonly ts.Statement[], name: string): ts.Node | undefined {
  for (const statement of statements) {
    if (api.isVariableStatement(statement)) {
      const found = statement.declarationList.declarations.find(
        (declaration) => api.isIdentifier(declaration.name) && declaration.name.text === name,
      );
      if (found) return found;
    } else if (
      (api.isFunctionDeclaration(statement) || api.isClassDeclaration(statement)) &&
      statement.name?.text === name
    )
      return statement;
  }
  return undefined;
}

function listBinding(api: CompilerApi, list: ts.ForInitializer | undefined, name: string): ts.Node | undefined {
  if (!list || !api.isVariableDeclarationList(list)) return undefined;
  return list.declarations.find((declaration) => api.isIdentifier(declaration.name) && declaration.name.text === name);
}

/** The nearest binding of `name` seen from `from`, and the scope that holds it. */
function nearestBinding(
  api: CompilerApi,
  from: ts.Node,
  name: string,
): { binding: ts.Node; scope: ts.Node } | undefined {
  for (let scope: ts.Node | undefined = from.parent; scope; scope = scope.parent) {
    let binding: ts.Node | undefined;
    if (api.isFunctionLike(scope))
      binding = scope.parameters.find((parameter) => api.isIdentifier(parameter.name) && parameter.name.text === name);
    else if (api.isBlock(scope) || api.isSourceFile(scope) || api.isModuleBlock(scope) || api.isCaseClause(scope))
      binding = scopeBinding(api, scope.statements, name);
    else if (api.isForStatement(scope) || api.isForOfStatement(scope) || api.isForInStatement(scope))
      binding = listBinding(api, scope.initializer, name);
    else if (api.isCatchClause(scope) && scope.variableDeclaration && api.isIdentifier(scope.variableDeclaration.name))
      binding = scope.variableDeclaration.name.text === name ? scope.variableDeclaration : undefined;
    if (binding) return { binding, scope };
  }
  return undefined;
}

/**
 * The type the nearest binding of `name`, seen from `from`, states: a parameter or a variable
 * annotation. Undefined when that binding states no type, or no binding of the name is written
 * between `from` and the top of the file.
 */
export function bindingTypeOf(api: CompilerApi, file: ts.SourceFile, from: ts.Node, name: string): string | undefined {
  const found = nearestBinding(api, from, name);
  if (!found) return undefined;
  const binding = found.binding;
  const stated = api.isParameter(binding) || api.isVariableDeclaration(binding) ? binding.type : undefined;
  return stated?.getText(file);
}
