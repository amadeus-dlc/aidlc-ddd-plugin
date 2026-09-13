import ts from "typescript";
import type { Issue, MemberEvidence, StateEvidence } from "../../state-exposure/index.ts";
import { type Context, contains, hasModifier, member, problem, resolved, staticName, unresolved } from "./context.ts";

function standardBrandCreation(context: Context, initializer: ts.Expression): boolean {
  if (
    contains(
      initializer,
      (node) => ts.isAsExpression(node) || ts.isTypeAssertionExpression(node) || ts.isSatisfiesExpression(node),
    )
  )
    return false;
  let expression = initializer;
  while (ts.isParenthesizedExpression(expression)) expression = expression.expression;
  if (
    !ts.isCallExpression(expression) ||
    !ts.isIdentifier(expression.expression) ||
    expression.expression.text !== "Symbol" ||
    expression.typeArguments?.length ||
    expression.arguments.length > 1 ||
    expression.arguments.some((argument) => !ts.isStringLiteral(argument))
  )
    return false;
  const symbol = context.checker.getSymbolAtLocation(expression.expression);
  const declarations = symbol?.declarations;
  if (
    !declarations?.length ||
    declarations.some((declaration) => !declaration.getSourceFile().fileName.startsWith("/lib/lib."))
  )
    return false;
  const signature = context.checker.getResolvedSignature(expression);
  return (
    !!signature?.declaration?.getSourceFile().fileName.startsWith("/lib/lib.") &&
    !!(context.checker.getTypeAtLocation(expression).flags & (ts.TypeFlags.ESSymbol | ts.TypeFlags.UniqueESSymbol))
  );
}

function privateBrand(context: Context, type: ts.TypeAliasDeclaration): ts.Symbol | undefined {
  if (!ts.isTypeLiteralNode(type.type)) return;
  const brands = type.type.members.filter(
    (m): m is ts.PropertySignature => ts.isPropertySignature(m) && !!m.name && ts.isComputedPropertyName(m.name),
  );
  if (brands.length !== 1) return;
  const brand = brands[0];
  if (!ts.isComputedPropertyName(brand.name) || !ts.isIdentifier(brand.name.expression)) return;
  const symbol = context.checker.getSymbolAtLocation(brand.name.expression);
  if (!symbol || !(context.checker.getTypeAtLocation(brand.name.expression).flags & ts.TypeFlags.UniqueESSymbol))
    return;
  const declaration = symbol.valueDeclaration;
  if (
    !declaration ||
    !ts.isVariableDeclaration(declaration) ||
    !ts.isVariableDeclarationList(declaration.parent) ||
    !(declaration.parent.flags & ts.NodeFlags.Const) ||
    !ts.isVariableStatement(declaration.parent.parent) ||
    declaration.parent.parent.parent !== context.file
  )
    return;
  if (
    !declaration.initializer ||
    !standardBrandCreation(context, declaration.initializer) ||
    !(
      context.checker.getTypeAtLocation(declaration.initializer).flags &
      (ts.TypeFlags.ESSymbol | ts.TypeFlags.UniqueESSymbol)
    )
  )
    return;
  if (hasModifier(declaration.parent.parent, ts.SyntaxKind.ExportKeyword)) return;
  const module = context.checker.getSymbolAtLocation(context.file);
  if (
    module &&
    context.checker
      .getExportsOfModule(module)
      .some((s) => s === symbol || (s.flags & ts.SymbolFlags.Alias && context.checker.getAliasedSymbol(s) === symbol))
  )
    return;
  if (!brand.type || brand.type.kind !== ts.SyntaxKind.LiteralType || brand.type.getText(context.file) !== "true")
    return;
  return symbol;
}
function ownReturns(body: ts.Block): ts.ReturnStatement[] | undefined {
  const returns: ts.ReturnStatement[] = [];
  let unsupported = false;
  const visit = (node: ts.Node) => {
    if (node !== body && ts.isFunctionLike(node)) return;
    if (ts.isReturnStatement(node)) {
      returns.push(node);
      return;
    }
    if (
      ts.isForStatement(node) ||
      ts.isForOfStatement(node) ||
      ts.isForInStatement(node) ||
      ts.isWhileStatement(node) ||
      ts.isDoStatement(node) ||
      ts.isTryStatement(node) ||
      ts.isSwitchStatement(node) ||
      ts.isThrowStatement(node)
    )
      unsupported = true;
    ts.forEachChild(node, visit);
  };
  visit(body);
  if (unsupported || !ts.isReturnStatement(body.statements[body.statements.length - 1])) return;
  return returns;
}
function unwrap(context: Context, expression: ts.Expression, body: ts.Block): ts.ObjectLiteralExpression | undefined {
  if (ts.isObjectLiteralExpression(expression)) return expression;
  if (!ts.isIdentifier(expression)) return;
  const symbol = context.checker.getSymbolAtLocation(expression);
  const declaration = symbol?.valueDeclaration;
  if (
    !declaration ||
    !ts.isVariableDeclaration(declaration) ||
    !ts.isVariableDeclarationList(declaration.parent) ||
    !(declaration.parent.flags & ts.NodeFlags.Const) ||
    declaration.parent.parent.parent !== body ||
    !declaration.initializer ||
    !ts.isObjectLiteralExpression(declaration.initializer)
  )
    return;
  let unsafe = false;
  const visit = (node: ts.Node) => {
    if (ts.isIdentifier(node) && context.checker.getSymbolAtLocation(node) === symbol && node !== declaration.name) {
      const parent = node.parent;
      if (
        !(
          ts.isReturnStatement(parent) ||
          (ts.isPropertyAssignment(parent) && staticName(parent.name) === "value" && parent.initializer === node)
        )
      )
        unsafe = true;
    }
    ts.forEachChild(node, visit);
  };
  visit(body);
  return unsafe ? undefined : declaration.initializer;
}
function prop(object: ts.ObjectLiteralExpression, name: string): ts.Expression | undefined {
  const properties = object.properties.filter((p) => p.name && staticName(p.name) === name);
  const first = properties[0];
  return properties.length === 1 && first && ts.isPropertyAssignment(first) ? first.initializer : undefined;
}
function identifiesSuccess(context: Context, returned: ts.Type, target: ts.Type, node: ts.Node): boolean {
  const alternatives = returned.isUnion() ? returned.types : [returned];
  return alternatives.some((type) => {
    if (!(type.flags & (ts.TypeFlags.Any | ts.TypeFlags.Unknown)) && context.checker.isTypeAssignableTo(type, target))
      return true;
    const ok = type.getProperty("ok");
    const value = type.getProperty("value");
    if (!ok || !value || context.checker.typeToString(context.checker.getTypeOfSymbolAtLocation(ok, node)) !== "true")
      return false;
    const success = context.checker.getTypeOfSymbolAtLocation(value, node);
    return (
      !(success.flags & (ts.TypeFlags.Any | ts.TypeFlags.Unknown)) &&
      context.checker.isTypeAssignableTo(success, target)
    );
  });
}
function instances(
  context: Context,
  factory: ts.MethodDeclaration,
  targetType: ts.Type,
): ts.ObjectLiteralExpression[] | undefined {
  if (!factory.body || !factory.type || factory.asteriskToken || hasModifier(factory, ts.SyntaxKind.AsyncKeyword))
    return;
  const returns = ownReturns(factory.body);
  if (!returns?.length) return;
  const signature = context.checker.getSignatureFromDeclaration(factory);
  if (
    !signature ||
    context.checker.getReturnTypeOfSignature(signature).flags & (ts.TypeFlags.Any | ts.TypeFlags.Unknown)
  )
    return;
  if (!identifiesSuccess(context, context.checker.getReturnTypeOfSignature(signature), targetType, factory)) return;
  const found: ts.ObjectLiteralExpression[] = [];
  for (const statement of returns) {
    if (!statement.expression) return;
    const returned = unwrap(context, statement.expression, factory.body);
    if (!returned) return;
    const ok = prop(returned, "ok");
    if (ok?.kind === ts.SyntaxKind.FalseKeyword) {
      if (!prop(returned, "error") || returned.properties.length !== 2) return;
      continue;
    }
    const candidate = ok?.kind === ts.SyntaxKind.TrueKeyword ? prop(returned, "value") : statement.expression;
    if (!candidate || (ok && returned.properties.length !== 2)) return;
    const instance = unwrap(context, candidate, factory.body);
    if (!instance) return;
    const actualType = context.checker.getTypeAtLocation(candidate);
    if (
      actualType.flags & (ts.TypeFlags.Any | ts.TypeFlags.Unknown) ||
      !context.checker.isTypeAssignableTo(actualType, targetType)
    )
      return;
    found.push(instance);
  }
  return found.length && new Set(found).size === 1 ? found : undefined;
}
export function extractCompanion(
  context: Context,
  type: ts.TypeAliasDeclaration,
  value: ts.VariableDeclaration,
): StateEvidence {
  const brand = privateBrand(context, type);
  if (
    !brand ||
    !value.initializer ||
    !ts.isObjectLiteralExpression(value.initializer) ||
    !ts.isVariableDeclarationList(value.parent) ||
    !(value.parent.flags & ts.NodeFlags.Const)
  )
    return unresolved(context, "unsupported-syntax", type);
  const typeSymbol = context.checker.getSymbolAtLocation(type.name);
  const valueSymbol = context.checker.getSymbolAtLocation(value.name);
  if (!typeSymbol || typeSymbol !== valueSymbol) return unresolved(context, "target-ambiguous", type);
  const targetType = context.checker.getDeclaredTypeOfSymbol(typeSymbol);
  const factories = value.initializer.properties;
  if (factories.length !== 1 || !ts.isMethodDeclaration(factories[0]))
    return unresolved(context, "unsupported-syntax", value);
  const factory = factories[0];
  // Assertions anywhere on the factory's construction path invalidate identification.
  const unsafe = (node: ts.Node): boolean =>
    ts.isAsExpression(node) || ts.isTypeAssertionExpression(node) || ts.isSatisfiesExpression(node);
  if (contains(factory, unsafe)) return unresolved(context, "unsupported-syntax", factory);
  const found = instances(context, factory, targetType);
  if (!found) return unresolved(context, "unsupported-syntax", factory);
  const instance = found[0];
  const items: MemberEvidence[] = [];
  const reasons: Issue[] = [];
  let brandCount = 0;
  for (const property of instance.properties) {
    if (ts.isSpreadAssignment(property)) {
      reasons.push(problem(context, "unsupported-syntax", property));
      continue;
    }
    if (property.name && ts.isComputedPropertyName(property.name)) {
      if (
        ts.isPropertyAssignment(property) &&
        context.checker.getSymbolAtLocation(property.name.expression) === brand &&
        property.initializer.kind === ts.SyntaxKind.TrueKeyword
      ) {
        brandCount++;
        items.push(member(context, property, "brand", "absent"));
      } else reasons.push(problem(context, "unsupported-syntax", property));
      continue;
    }
    const name = property.name && staticName(property.name);
    if (!name) {
      reasons.push(problem(context, "unsupported-syntax", property));
      continue;
    }
    if (ts.isMethodDeclaration(property) && property.body) items.push(member(context, property, name, "absent"));
    else if (ts.isPropertyAssignment(property) || ts.isShorthandPropertyAssignment(property))
      items.push(member(context, property, name, true));
    else items.push(member(context, property, name, "unresolved"));
  }
  if (brandCount !== 1 || new Set(items.map((m) => m.memberId)).size !== items.length)
    return unresolved(context, "unsupported-syntax", instance);
  return resolved(context, type, items, reasons);
}
