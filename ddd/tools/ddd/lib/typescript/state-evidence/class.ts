import ts from "typescript";
import type { Issue, MemberEvidence, StateEvidence } from "../../state-exposure/index.ts";
import { constructorAssignments } from "./constructor.ts";
import { type Context, contains, hasModifier, member, problem, resolved, staticName, unresolved } from "./context.ts";

export function extractClass(context: Context, declaration: ts.ClassDeclaration): StateEvidence {
  if (
    !declaration.name ||
    declaration.heritageClauses?.length ||
    hasModifier(declaration, ts.SyntaxKind.DeclareKeyword) ||
    ts.getDecorators(declaration)?.length
  )
    return unresolved(context, "unsupported-syntax", declaration);
  const symbol = context.checker.getSymbolAtLocation(declaration.name);
  if (symbol?.declarations?.length !== 1) return unresolved(context, "target-ambiguous", declaration);
  context.checker.getDeclaredTypeOfSymbol(symbol);
  const items: MemberEvidence[] = [];
  const construction = constructorAssignments(context, declaration);
  const reasons: Issue[] = [...construction.reasons];
  for (const node of declaration.members) {
    if (hasModifier(node, ts.SyntaxKind.StaticKeyword)) continue;
    if (ts.isConstructorDeclaration(node)) continue;
    if (ts.isSemicolonClassElement(node)) continue;
    if (
      ts.isPropertyDeclaration(node) &&
      node.initializer &&
      contains(node.initializer, (part) => part.kind === ts.SyntaxKind.ThisKeyword)
    )
      reasons.push(problem(context, "unsupported-syntax", node.initializer));
    const name = node.name && staticName(node.name);
    if (!name) {
      reasons.push(problem(context, "unsupported-syntax", node));
      continue;
    }
    if (ts.canHaveDecorators(node) && ts.getDecorators(node)?.length) {
      items.push(member(context, node, name, "unresolved"));
      continue;
    }
    if (ts.isMethodDeclaration(node) && node.body && !hasModifier(node, ts.SyntaxKind.AbstractKeyword))
      items.push(member(context, node, name, "absent"));
    else if (
      ts.isPropertyDeclaration(node) &&
      (node.initializer || construction.initialized.has(name)) &&
      !hasModifier(node, ts.SyntaxKind.DeclareKeyword) &&
      !hasModifier(node, ts.SyntaxKind.AbstractKeyword)
    )
      items.push(member(context, node, name, !ts.isPrivateIdentifier(node.name)));
    else items.push(member(context, node, name, "unresolved"));
  }
  if (new Set(items.map((m) => m.memberId)).size !== items.length)
    return unresolved(context, "target-ambiguous", declaration);
  return resolved(context, declaration, items, reasons);
}
