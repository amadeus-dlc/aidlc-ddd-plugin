/**
 * The walk from one parsed TypeScript file to the facts rules read. Every fact comes from a syntax
 * node, so a spelling inside a comment, a string or a regular expression is never a fact, and no
 * fact depends on what a name resolves to: the extraction runs without a type checker.
 *
 * Declarations, members, static imports and exports are read from the statements at the top of the
 * file. Calls, constructions, dynamic imports and import types are read wherever they are written.
 * A construct that could hide one of these facts is returned as unresolved instead of being read
 * as if it declared nothing.
 */

import type ts from "typescript";
import type { CompilerApi } from "../compiler/settings.ts";
import type {
  CallFact,
  ConstructionFact,
  DeclarationFact,
  DeclarationKind,
  ExportFact,
  ImportBinding,
  ImportFact,
  MemberFact,
  Span,
  TypeScriptFileFacts,
  UnresolvedFact,
  UnresolvedReason,
  VariableBinding,
  Visibility,
} from "./contract.ts";

export function extractFileFacts(api: CompilerApi, file: ts.SourceFile): TypeScriptFileFacts {
  const declarations: DeclarationFact[] = [];
  const imports: ImportFact[] = [];
  const exports: ExportFact[] = [];
  const calls: CallFact[] = [];
  const constructions: ConstructionFact[] = [];
  const unresolved: UnresolvedFact[] = [];

  const lineOf = (node: ts.Node) => file.getLineAndCharacterOfPosition(node.getStart(file)).line + 1;
  const spanOf = (node: ts.Node): Span => {
    const start = file.getLineAndCharacterOfPosition(node.getStart(file));
    const end = file.getLineAndCharacterOfPosition(node.getEnd());
    return {
      start_line: start.line + 1,
      start_col: start.character + 1,
      end_line: end.line + 1,
      end_col: end.character + 1,
    };
  };
  const leaveUnresolved = (node: ts.Node, reason: UnresolvedReason): void => {
    unresolved.push({ line: lineOf(node), reason });
  };
  const hasModifier = (node: ts.Node, kind: ts.SyntaxKind) =>
    api.canHaveModifiers(node) && (api.getModifiers(node) ?? []).some((modifier) => modifier.kind === kind);

  /** A member name as the source spells it; a computed name is decided only when the program runs. */
  function memberName(name: ts.PropertyName): string | null {
    if (api.isComputedPropertyName(name)) {
      leaveUnresolved(name, "computed-name");
      return null;
    }
    return name.text;
  }

  function member(
    node: ts.Node,
    name: ts.PropertyName,
    kind: MemberFact["kind"],
    visibility: Visibility | null,
  ): MemberFact[] {
    const spelled = memberName(name);
    if (spelled === null) return [];
    return [
      {
        name: spelled,
        kind,
        visibility:
          visibility ??
          (api.isPrivateIdentifier(name)
            ? "private-name"
            : hasModifier(node, api.SyntaxKind.PrivateKeyword)
              ? "private"
              : hasModifier(node, api.SyntaxKind.ProtectedKeyword)
                ? "protected"
                : "public"),
        static: hasModifier(node, api.SyntaxKind.StaticKeyword),
        readonly: hasModifier(node, api.SyntaxKind.ReadonlyKeyword),
        span: spanOf(node),
      },
    ];
  }

  function classMembers(node: ts.ClassDeclaration): MemberFact[] {
    return node.members.flatMap((element): MemberFact[] => {
      if (api.isPropertyDeclaration(element)) return member(element, element.name, "property", null);
      if (api.isMethodDeclaration(element)) return member(element, element.name, "method", null);
      if (api.isGetAccessorDeclaration(element)) return member(element, element.name, "get-accessor", null);
      if (api.isSetAccessorDeclaration(element)) return member(element, element.name, "set-accessor", null);
      if (api.isConstructorDeclaration(element)) {
        const constructorMember: MemberFact = {
          name: "constructor",
          kind: "constructor",
          visibility: hasModifier(element, api.SyntaxKind.PrivateKeyword)
            ? "private"
            : hasModifier(element, api.SyntaxKind.ProtectedKeyword)
              ? "protected"
              : "public",
          static: false,
          readonly: false,
          span: spanOf(element),
        };
        const parameterProperties = element.parameters
          .filter((parameter) => api.isParameterPropertyDeclaration(parameter, element))
          .flatMap((parameter) =>
            api.isIdentifier(parameter.name) ? member(parameter, parameter.name, "property", null) : [],
          );
        return [constructorMember, ...parameterProperties];
      }
      return [];
    });
  }

  function typeMembers(elements: readonly ts.TypeElement[]): MemberFact[] {
    return elements.flatMap((element): MemberFact[] => {
      if (!element.name) return [];
      if (api.isPropertySignature(element)) return member(element, element.name, "property", "public");
      if (api.isMethodSignature(element)) return member(element, element.name, "method", "public");
      if (api.isGetAccessorDeclaration(element)) return member(element, element.name, "get-accessor", "public");
      if (api.isSetAccessorDeclaration(element)) return member(element, element.name, "set-accessor", "public");
      return [];
    });
  }

  /** The members a literal spells; a spread brings in members only the running program knows. */
  function objectMembers(literal: ts.ObjectLiteralExpression): MemberFact[] {
    return literal.properties.flatMap((element): MemberFact[] => {
      if (api.isPropertyAssignment(element) || api.isShorthandPropertyAssignment(element))
        return member(element, element.name, "property", "public");
      if (api.isMethodDeclaration(element)) return member(element, element.name, "method", "public");
      if (api.isGetAccessorDeclaration(element)) return member(element, element.name, "get-accessor", "public");
      if (api.isSetAccessorDeclaration(element)) return member(element, element.name, "set-accessor", "public");
      const spread: ts.SpreadAssignment = element;
      leaveUnresolved(spread, "object-spread");
      return [];
    });
  }

  /** The object literal an expression is, looking through parentheses and type assertions. */
  function objectLiteralOf(expression: ts.Expression | undefined): ts.ObjectLiteralExpression | null {
    let current = expression;
    while (
      current &&
      (api.isParenthesizedExpression(current) ||
        api.isAsExpression(current) ||
        api.isSatisfiesExpression(current) ||
        api.isTypeAssertionExpression(current))
    )
      current = current.expression;
    return current && api.isObjectLiteralExpression(current) ? current : null;
  }

  function recordDeclaration(
    statement: ts.Statement,
    node: ts.Node,
    name: ts.Identifier | undefined,
    kind: DeclarationKind,
    members: readonly MemberFact[],
    binding?: VariableBinding,
  ): void {
    const exported = hasModifier(statement, api.SyntaxKind.ExportKeyword);
    declarations.push({
      name: name ? name.text : "default",
      kind,
      ...(binding === undefined ? {} : { binding }),
      exported,
      default_export: exported && hasModifier(statement, api.SyntaxKind.DefaultKeyword),
      ambient: hasModifier(statement, api.SyntaxKind.DeclareKeyword),
      span: spanOf(node),
      members,
    });
  }

  function variableBinding(list: ts.VariableDeclarationList): VariableBinding {
    const flags = list.flags & api.NodeFlags.BlockScoped;
    if (flags === api.NodeFlags.Const) return "const";
    if (flags === api.NodeFlags.Let) return "let";
    if (flags === api.NodeFlags.Using) return "using";
    if (flags === api.NodeFlags.AwaitUsing) return "await-using";
    return "var";
  }

  function specifierOf(expression: ts.Expression): string {
    if (!api.isStringLiteral(expression))
      throw new Error(`a module specifier at line ${lineOf(expression)} is not a string`);
    return expression.text;
  }

  function staticImport(node: ts.ImportDeclaration): void {
    const specifier = specifierOf(node.moduleSpecifier);
    const clause = node.importClause;
    const line = lineOf(node);
    if (!clause) {
      imports.push({ specifier, kind: "side-effect", type_only: false, bindings: [], line });
      return;
    }
    const typeOnly = clause.phaseModifier === api.SyntaxKind.TypeKeyword;
    const bindings: ImportBinding[] = [];
    if (clause.name) bindings.push({ name: clause.name.text, imported: "default", type_only: typeOnly });
    const named = clause.namedBindings;
    if (named && api.isNamespaceImport(named))
      bindings.push({ name: named.name.text, imported: "*", type_only: typeOnly });
    if (named && api.isNamedImports(named))
      for (const element of named.elements)
        bindings.push({
          name: element.name.text,
          imported: (element.propertyName ?? element.name).text,
          type_only: typeOnly || element.isTypeOnly,
        });
    const kind =
      named && api.isNamespaceImport(named) ? "namespace" : named && api.isNamedImports(named) ? "named" : "default";
    imports.push({ specifier, kind, type_only: typeOnly, bindings, line });
  }

  function exportStatement(node: ts.ExportDeclaration): void {
    const specifier = node.moduleSpecifier ? { specifier: specifierOf(node.moduleSpecifier) } : {};
    const line = lineOf(node);
    const clause = node.exportClause;
    if (!clause) {
      exports.push({ kind: "all", ...specifier, type_only: node.isTypeOnly, names: [], line });
      return;
    }
    if (api.isNamespaceExport(clause)) {
      exports.push({
        kind: "namespace",
        ...specifier,
        type_only: node.isTypeOnly,
        names: [{ name: clause.name.text, local: "*", type_only: node.isTypeOnly }],
        line,
      });
      return;
    }
    exports.push({
      kind: "named",
      ...specifier,
      type_only: node.isTypeOnly,
      names: clause.elements.map((element) => ({
        name: element.name.text,
        local: (element.propertyName ?? element.name).text,
        type_only: node.isTypeOnly || element.isTypeOnly,
      })),
      line,
    });
  }

  function variables(statement: ts.VariableStatement): void {
    const binding = variableBinding(statement.declarationList);
    for (const declaration of statement.declarationList.declarations) {
      if (!api.isIdentifier(declaration.name)) {
        leaveUnresolved(declaration.name, "binding-pattern");
        continue;
      }
      const literal = objectLiteralOf(declaration.initializer);
      const members = literal ? objectMembers(literal) : [];
      recordDeclaration(statement, declaration, declaration.name, "variable", members, binding);
    }
  }

  function topLevel(statement: ts.Statement): void {
    if (api.isImportDeclaration(statement)) {
      staticImport(statement);
    } else if (api.isExportDeclaration(statement)) {
      exportStatement(statement);
    } else if (api.isExportAssignment(statement)) {
      if (statement.isExportEquals) leaveUnresolved(statement, "export-assignment");
      else exports.push({ kind: "default-expression", type_only: false, names: [], line: lineOf(statement) });
    } else if (api.isImportEqualsDeclaration(statement)) {
      leaveUnresolved(statement, "import-equals");
    } else if (api.isModuleDeclaration(statement) || api.isNamespaceExportDeclaration(statement)) {
      leaveUnresolved(statement, "namespace");
    } else if (api.isClassDeclaration(statement)) {
      recordDeclaration(statement, statement, statement.name, "class", classMembers(statement));
    } else if (api.isInterfaceDeclaration(statement)) {
      recordDeclaration(statement, statement, statement.name, "interface", typeMembers(statement.members));
    } else if (api.isTypeAliasDeclaration(statement)) {
      const members = api.isTypeLiteralNode(statement.type) ? typeMembers(statement.type.members) : [];
      recordDeclaration(statement, statement, statement.name, "type-alias", members);
    } else if (api.isEnumDeclaration(statement)) {
      const members = statement.members.flatMap((element) => member(element, element.name, "enum-member", "public"));
      recordDeclaration(statement, statement, statement.name, "enum", members);
    } else if (api.isFunctionDeclaration(statement)) {
      recordDeclaration(statement, statement, statement.name, "function", []);
    } else if (api.isVariableStatement(statement)) {
      variables(statement);
    }
  }

  function callee(node: ts.CallExpression | ts.TaggedTemplateExpression, target: ts.Expression): void {
    if (target.kind === api.SyntaxKind.SuperKeyword)
      calls.push({ kind: "super-call", callee_text: "super", span: spanOf(node) });
    else if (api.isIdentifier(target))
      calls.push({ kind: "function-call", callee_text: target.text, span: spanOf(node) });
    else if (api.isPropertyAccessExpression(target))
      calls.push({
        kind: "method-call",
        callee_text: target.name.text,
        receiver_text: target.expression.getText(file),
        span: spanOf(node),
      });
    else leaveUnresolved(node, "dynamic-callee");
  }

  /** The type an object literal is written against, when an assertion or an annotation states one. */
  function statedType(literal: ts.ObjectLiteralExpression): ts.TypeNode | null {
    let outer: ts.Node = literal;
    while (api.isParenthesizedExpression(outer.parent)) outer = outer.parent;
    const parent = outer.parent;
    if (api.isAsExpression(parent) || api.isSatisfiesExpression(parent) || api.isTypeAssertionExpression(parent))
      return api.isConstTypeReference(parent.type) ? null : parent.type;
    if (api.isVariableDeclaration(parent) && parent.initializer === outer && parent.type) return parent.type;
    return null;
  }

  function visit(node: ts.Node): void {
    if (node.parent === file && api.isStatement(node)) topLevel(node);
    if (api.isDecorator(node)) leaveUnresolved(node, "decorator");
    else if (api.isCallExpression(node)) {
      if (node.expression.kind === api.SyntaxKind.ImportKeyword) {
        const [argument] = node.arguments;
        if (argument && (api.isStringLiteral(argument) || api.isNoSubstitutionTemplateLiteral(argument)))
          imports.push({
            specifier: argument.text,
            kind: "dynamic",
            type_only: false,
            bindings: [],
            line: lineOf(node),
          });
        else leaveUnresolved(node, "dynamic-import");
      } else callee(node, node.expression);
    } else if (api.isTaggedTemplateExpression(node)) callee(node, node.tag);
    else if (api.isNewExpression(node)) {
      if (api.isIdentifier(node.expression) || api.isPropertyAccessExpression(node.expression))
        constructions.push({ kind: "new-expression", type_text: node.expression.getText(file), span: spanOf(node) });
      else leaveUnresolved(node, "dynamic-callee");
    } else if (api.isObjectLiteralExpression(node)) {
      const type = statedType(node);
      if (type) constructions.push({ kind: "typed-object-literal", type_text: type.getText(file), span: spanOf(node) });
    } else if (api.isImportTypeNode(node)) {
      const argument = node.argument;
      if (api.isLiteralTypeNode(argument) && api.isStringLiteral(argument.literal))
        imports.push({
          specifier: argument.literal.text,
          kind: "type-query",
          type_only: true,
          bindings: [],
          line: lineOf(node),
        });
      else leaveUnresolved(node, "dynamic-import");
    }
    api.forEachChild(node, visit);
  }

  visit(file);
  return { declarations, imports, exports, calls, constructions, unresolved };
}
