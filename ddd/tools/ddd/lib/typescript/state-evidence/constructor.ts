import ts from "typescript";
import type { Issue } from "../../state-exposure/index.ts";
import { type Context, contains, hasModifier, problem, staticName } from "./context.ts";

/** Recognize only direct assignments to declared fields; uncertain construction stays partial. */
export function constructorAssignments(
  context: Context,
  declaration: ts.ClassDeclaration,
): { initialized: Set<string>; reasons: Issue[] } {
  const declared = new Set(
    declaration.members
      .filter(
        (m): m is ts.PropertyDeclaration => ts.isPropertyDeclaration(m) && !hasModifier(m, ts.SyntaxKind.StaticKeyword),
      )
      .map((m) => staticName(m.name)),
  );
  const initialized = new Set<string>();
  const reasons: Issue[] = [];
  for (const ctor of declaration.members.filter(ts.isConstructorDeclaration)) {
    if (!ctor.body || ctor.parameters.some((p) => ts.isParameterPropertyDeclaration(p, ctor))) {
      reasons.push(problem(context, "unsupported-syntax", ctor));
      continue;
    }
    const assignments = new Set<ts.Node>();
    for (const statement of ctor.body.statements) {
      if (!ts.isExpressionStatement(statement) || !ts.isBinaryExpression(statement.expression)) continue;
      const expression = statement.expression;
      const left = expression.left;
      if (
        expression.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
        ts.isPropertyAccessExpression(left) &&
        left.expression.kind === ts.SyntaxKind.ThisKeyword &&
        declared.has(left.name.text)
      ) {
        initialized.add(left.name.text);
        assignments.add(left.expression);
      }
    }
    const visit = (node: ts.Node) => {
      if (node !== ctor && ts.isFunctionLike(node)) {
        // Nested bodies may execute immediately or through a callback. Without
        // call-flow analysis, an instance capture cannot prove complete construction.
        if (contains(node, (part) => part.kind === ts.SyntaxKind.ThisKeyword))
          reasons.push(problem(context, "unsupported-syntax", node));
        return;
      }
      if (ts.isReturnStatement(node) || (node.kind === ts.SyntaxKind.ThisKeyword && !assignments.has(node)))
        reasons.push(problem(context, "unsupported-syntax", node));
      ts.forEachChild(node, visit);
    };
    visit(ctor);
  }
  return { initialized, reasons };
}
