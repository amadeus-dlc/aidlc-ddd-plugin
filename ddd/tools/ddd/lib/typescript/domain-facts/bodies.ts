/**
 * What a body does to state, read from its syntax alone: which members of `this` and which captured
 * bindings it writes, whether it is nothing but the return of one of them, and which type the
 * nearest binding of a name states.
 *
 * A name is captured when its nearest binding, seen from where the name is written, lies outside the
 * body: a parameter, a local, a nested function or class, or a caught error of the body is its own
 * only where it is visible, so a callback parameter of the same name elsewhere in the body does not
 * hide a captured binding, and a name bound through destructuring is found too. A captured binding
 * an enclosing function declares is closure state; one declared at the top of the file is module
 * state. A write to any captured binding is recorded. A call of a method named as an array, `Map` or
 * `Set` changing method is recorded as a write to closure state when the types written in the file
 * say it is called on such a collection: on the binding itself when the type it states is one or it
 * states none, or on one member of it the type it states gives such a type. Only a member of `this`
 * or closure state, or closure state itself, counts as state a getter returns. No name is resolved
 * further than that, so a write through an alias of `this` or through a value handed in is not state
 * the body is recorded to write.
 */

import type ts from "typescript";
import type { CompilerApi } from "../compiler/settings.ts";
import type { WriteFact } from "./contract.ts";

interface BodyEffects {
  readonly writes: readonly WriteFact[];
  readonly returns_state_only: boolean;
}

/** Whether the binding pattern `name` binds `text`, through any destructuring. */
function bindsName(api: CompilerApi, name: ts.BindingName, text: string): boolean {
  if (api.isIdentifier(name)) return name.text === text;
  return name.elements.some((element) => !api.isOmittedExpression(element) && bindsName(api, element.name, text));
}

/** Whether `scope` is `fn` itself or lies inside it: a binding held there belongs to `fn`. */
function within(fn: ts.Node, scope: ts.Node): boolean {
  for (let current: ts.Node | undefined = scope; current; current = current.parent) if (current === fn) return true;
  return false;
}

/**
 * Whether `identifier`, as written inside `fn`, names a binding `fn` itself holds: a parameter, a
 * local, a nested function or class, or a caught error that is visible where the name is written.
 * A binding of the same name in a nested callback that does not enclose the name is not one.
 */
function isOwnBinding(api: CompilerApi, fn: ts.Node, identifier: ts.Identifier): boolean {
  const found = nearestBinding(api, identifier, identifier.text);
  return found !== undefined && within(fn, found.scope);
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
function writtenState(api: CompilerApi, fn: ts.Node, target: ts.Expression): WriteFact | null {
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
  if (api.isIdentifier(current) && !isOwnBinding(api, fn, current)) return { target: "captured", name: current.text };
  return null;
}

function isAssignment(api: CompilerApi, kind: ts.SyntaxKind): boolean {
  return kind >= api.SyntaxKind.FirstAssignment && kind <= api.SyntaxKind.LastAssignment;
}

/**
 * The methods an array, a `Map` or a `Set` changes itself through. Called on state such a collection
 * is, they change that state as an assignment to it would; on any other value, a method of the same
 * name is that value's own and may return a new value instead.
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

const COLLECTION_TYPE = /^(?:Array|Map|Set)\s*<|\[\]$/;

/** Whether a type, as the source spells it, is an array, a `Map` or a `Set`. */
export function isCollectionType(text: string): boolean {
  return COLLECTION_TYPE.test(text.trim());
}

/**
 * The binding of `identifier`, as written inside `fn`, when it is closure state: bound by an
 * enclosing function rather than by `fn` itself or at the top of the file, where it is module state
 * shared by every instance.
 */
function closureStateBinding(api: CompilerApi, fn: ts.Node, identifier: ts.Identifier): ts.Node | undefined {
  const found = nearestBinding(api, identifier, identifier.text);
  return found !== undefined && !api.isSourceFile(found.scope) && !within(fn, found.scope) ? found.binding : undefined;
}

/**
 * The type a binding states for its own name: a parameter or a variable annotation. A name bound
 * through destructuring takes one part of the stated type, not the type itself, so it states none.
 */
function statedTypeOf(api: CompilerApi, binding: ts.Node): ts.TypeNode | undefined {
  if (!api.isParameter(binding) && !api.isVariableDeclaration(binding)) return undefined;
  if (!api.isIdentifier(binding.name)) return undefined;
  return binding.type;
}

function propertyNameText(api: CompilerApi, name: ts.PropertyName | undefined): string | undefined {
  if (name && (api.isIdentifier(name) || api.isStringLiteral(name) || api.isNumericLiteral(name))) return name.text;
  return undefined;
}

/**
 * The members of the type `name` a type literal alias or interfaces declare at the top of the file,
 * seen from `from`. Undefined when a type parameter or a declaration nearer to `from` holds the name,
 * when the top of the file declares it otherwise, or declares it not at all: those types are not
 * spelled here.
 */
function topLevelTypeMembers(api: CompilerApi, from: ts.Node, name: string): readonly ts.TypeElement[] | undefined {
  for (let scope: ts.Node | undefined = from.parent; scope; scope = scope.parent) {
    if (
      (api.isFunctionLike(scope) ||
        api.isClassLike(scope) ||
        api.isInterfaceDeclaration(scope) ||
        api.isTypeAliasDeclaration(scope)) &&
      scope.typeParameters?.some((parameter) => parameter.name.text === name)
    )
      return undefined;
    if (!api.isBlock(scope) && !api.isSourceFile(scope) && !api.isModuleBlock(scope) && !api.isCaseClause(scope))
      continue;
    const declarations = scope.statements.filter(
      (statement) =>
        (api.isTypeAliasDeclaration(statement) ||
          api.isInterfaceDeclaration(statement) ||
          api.isClassDeclaration(statement) ||
          api.isEnumDeclaration(statement)) &&
        statement.name?.text === name,
    );
    if (declarations.length === 0) continue;
    if (!api.isSourceFile(scope)) return undefined;
    const members: ts.TypeElement[] = [];
    for (const declaration of declarations) {
      if (api.isInterfaceDeclaration(declaration)) members.push(...declaration.members);
      else if (api.isTypeAliasDeclaration(declaration) && api.isTypeLiteralNode(declaration.type))
        members.push(...declaration.type.members);
      else return undefined;
    }
    return members;
  }
  return undefined;
}

/**
 * The type the stated type `type` of the binding `binding` gives its member `name`: `type` is a
 * type literal, or one name without type arguments of a type the top of the file declares, and it
 * holds exactly one member of that name, a property signature. Undefined otherwise.
 */
function memberTypeOf(api: CompilerApi, binding: ts.Node, type: ts.TypeNode, name: string): ts.TypeNode | undefined {
  const members = api.isTypeLiteralNode(type)
    ? type.members
    : api.isTypeReferenceNode(type) && !type.typeArguments && api.isIdentifier(type.typeName)
      ? topLevelTypeMembers(api, binding, type.typeName.text)
      : undefined;
  if (members === undefined) return undefined;
  const named = members.filter((member) => propertyNameText(api, member.name) === name);
  return named.length === 1 && api.isPropertySignature(named[0]) ? named[0].type : undefined;
}

/**
 * The closure state a call of a changing method on `receiver` writes: the closure-state binding
 * itself, when the type it states is an array, a `Map` or a `Set` or it states none; or the binding
 * owning a member `binding.member`, when the type the binding states gives that member such a type.
 * What the stated types do not decide — a member of a binding whose type is not spelled here, a
 * longer access chain, an element access — is not recorded, as a class field whose type is not
 * stated is not.
 */
function changedClosureState(
  api: CompilerApi,
  file: ts.SourceFile,
  fn: ts.Node,
  receiver: ts.Expression,
): ts.Identifier | undefined {
  const target = unwrap(api, receiver);
  if (api.isIdentifier(target)) {
    const binding = closureStateBinding(api, fn, target);
    if (binding === undefined) return undefined;
    const type = statedTypeOf(api, binding);
    return type === undefined || isCollectionType(type.getText(file)) ? target : undefined;
  }
  if (!api.isPropertyAccessExpression(target)) return undefined;
  const owner = unwrap(api, target.expression);
  if (!api.isIdentifier(owner)) return undefined;
  const binding = closureStateBinding(api, fn, owner);
  const type = binding === undefined ? undefined : statedTypeOf(api, binding);
  if (binding === undefined || type === undefined) return undefined;
  const member = memberTypeOf(api, binding, type, target.name.text);
  return member !== undefined && isCollectionType(member.getText(file)) ? owner : undefined;
}

/** Whether `expression` is state read off `this` or off closure state, or closure state itself. */
function isStateRead(api: CompilerApi, fn: ts.Node, expression: ts.Expression): boolean {
  const read = unwrap(api, expression);
  if (api.isIdentifier(read)) return closureStateBinding(api, fn, read) !== undefined;
  if (!api.isPropertyAccessExpression(read)) return false;
  const owner = unwrap(api, read.expression);
  return (
    owner.kind === api.SyntaxKind.ThisKeyword ||
    (api.isIdentifier(owner) && closureStateBinding(api, fn, owner) !== undefined)
  );
}

/** What the body of `fn` writes, and whether it only returns state. A function without a body does neither. */
export function bodyEffects(api: CompilerApi, file: ts.SourceFile, fn: ts.FunctionLikeDeclaration): BodyEffects {
  const body = fn.body;
  if (!body) return { writes: [], returns_state_only: false };
  const writes = new Map<string, WriteFact>();
  const record = (target: ts.Expression) => {
    const written = writtenState(api, fn, target);
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
      const changed = changedClosureState(api, file, fn, node.expression.expression);
      if (changed) writes.set(`captured\u0000${changed.text}`, { target: "captured", name: changed.text });
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
    returns_state_only: returned !== undefined && isStateRead(api, fn, returned),
  };
}

/** Declarations a block-like scope makes visible to the statements it holds. */
function scopeBinding(api: CompilerApi, statements: readonly ts.Statement[], name: string): ts.Node | undefined {
  for (const statement of statements) {
    if (api.isVariableStatement(statement)) {
      const found = statement.declarationList.declarations.find((declaration) =>
        bindsName(api, declaration.name, name),
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
  return list.declarations.find((declaration) => bindsName(api, declaration.name, name));
}

/**
 * A `var` of `name` anywhere in the body of `fn` outside its nested functions: `var` is hoisted to
 * the function, so it binds the name throughout the body even when written in a nested block.
 */
function hoistedVar(api: CompilerApi, fn: ts.SignatureDeclaration, name: string): ts.Node | undefined {
  const body = (fn as ts.FunctionLikeDeclaration).body;
  if (!body) return undefined;
  let found: ts.Node | undefined;
  const visit = (node: ts.Node): void => {
    if (found || (node !== body && api.isFunctionLike(node))) return;
    if (
      api.isVariableDeclarationList(node) &&
      !(node.flags & (api.NodeFlags.Let | api.NodeFlags.Const)) &&
      node.declarations.some((declaration) => bindsName(api, declaration.name, name))
    ) {
      found = node.declarations.find((declaration) => bindsName(api, declaration.name, name));
      return;
    }
    api.forEachChild(node, visit);
  };
  visit(body);
  return found;
}

/**
 * The nearest binding of `name` seen from `from`, and the scope that holds it. A name bound through
 * destructuring is found as well; its binding is the parameter or declaration that destructures.
 */
export function nearestBinding(
  api: CompilerApi,
  from: ts.Node,
  name: string,
): { binding: ts.Node; scope: ts.Node } | undefined {
  for (let scope: ts.Node | undefined = from.parent; scope; scope = scope.parent) {
    let binding: ts.Node | undefined;
    if (api.isFunctionLike(scope)) {
      binding =
        scope.parameters.find((parameter) => bindsName(api, parameter.name, name)) ??
        ((api.isFunctionExpression(scope) || api.isClassExpression(scope)) && scope.name?.text === name
          ? scope
          : undefined) ??
        hoistedVar(api, scope, name);
    } else if (api.isBlock(scope) || api.isSourceFile(scope) || api.isModuleBlock(scope) || api.isCaseClause(scope))
      binding = scopeBinding(api, scope.statements, name);
    else if (api.isForStatement(scope) || api.isForOfStatement(scope) || api.isForInStatement(scope))
      binding = listBinding(api, scope.initializer, name);
    else if (api.isCatchClause(scope) && scope.variableDeclaration)
      binding = bindsName(api, scope.variableDeclaration.name, name) ? scope.variableDeclaration : undefined;
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
  return statedTypeOf(api, found.binding)?.getText(file);
}
