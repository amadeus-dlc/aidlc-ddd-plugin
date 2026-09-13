import ts from "typescript";
import type { Issue, Location, MemberEvidence, ReasonCode, StateEvidence } from "../../state-exposure/index.ts";
import { byteLocation, type FrozenTask } from "../../state-exposure-verification/input.ts";

export interface Context {
  task: FrozenTask;
  file: ts.SourceFile;
  checker: ts.TypeChecker;
}
export function location(context: Context, node: ts.Node): Location {
  return byteLocation(
    context.task.request,
    Buffer.byteLength(context.file.text.slice(0, node.getStart(context.file))),
    Buffer.byteLength(context.file.text.slice(0, node.end)),
  );
}
export function problem(context: Context, code: ReasonCode, node?: ts.Node, subject?: string): Issue {
  return {
    code,
    message: code,
    subject: subject ?? context.task.request.target.declarationPath.join("::"),
    location: node ? location(context, node) : null,
  };
}
export function unresolved(context: Context, code: ReasonCode, node?: ts.Node): StateEvidence {
  return { targetStatus: "unresolved", reasons: [problem(context, code, node)] };
}
export function member(
  context: Context,
  node: ts.Node,
  name: string,
  value: boolean | "absent" | "unresolved",
): MemberEvidence {
  const memberId = `${context.task.request.target.declarationPath.join("::")}::${name}`;
  const evidence = [location(context, node)];
  return {
    memberId,
    stateExposure:
      value === "unresolved"
        ? { status: "unresolved", reasons: [problem(context, "unsupported-syntax", node, memberId)] }
        : value === "absent"
          ? { status: "absent", evidence }
          : { status: "resolved", value, evidence },
  };
}
export function resolved(
  context: Context,
  node: ts.Node,
  items: MemberEvidence[],
  reasons: Issue[] = [],
): StateEvidence {
  return {
    targetStatus: "resolved",
    targetEvidence: [location(context, node)],
    members: { completeness: reasons.length ? "partial" : "complete", items, reasons },
  };
}
export function hasModifier(node: ts.Node, kind: ts.SyntaxKind): boolean {
  return ts.canHaveModifiers(node) && !!ts.getModifiers(node)?.some((m) => m.kind === kind);
}
export function staticName(name: ts.PropertyName | ts.BindingName): string | undefined {
  return ts.isIdentifier(name) || ts.isPrivateIdentifier(name) || ts.isStringLiteral(name) || ts.isNumericLiteral(name)
    ? name.text
    : undefined;
}
export function contains(node: ts.Node, predicate: (node: ts.Node) => boolean): boolean {
  return predicate(node) || !!ts.forEachChild(node, (child) => contains(child, predicate));
}
