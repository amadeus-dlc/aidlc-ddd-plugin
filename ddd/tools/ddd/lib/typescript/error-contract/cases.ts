/**
 * The closed set of business error cases a resolved error type states. A type
 * this contract cannot close is left unresolved with its reason rather than
 * reported as a set that happens to be empty.
 *
 * The closed forms are the ones the agreed representation writes: one string
 * literal type, or a union whose members are all string literal types.
 */

import ts from "typescript";
import type { ErrorCase, ErrorCaseSet, Issue } from "../../error-contract/index.ts";
import { type Context, location, problem } from "./context.ts";

export type ErrorCases =
  | { readonly kind: "closed"; readonly value: ErrorCaseSet }
  | { readonly kind: "open"; readonly issue: Issue };

function caseOf(context: Context, node: ts.TypeNode): ErrorCase | undefined {
  if (!ts.isLiteralTypeNode(node) || !ts.isStringLiteral(node.literal)) return undefined;
  return { name: node.literal.text, location: location(context, node.literal) };
}

export function errorCasesOf(context: Context, declaration: ts.Declaration, reference: ts.Node): ErrorCases {
  const open = (message: string): ErrorCases => ({
    kind: "open",
    issue: problem(context, "open-error-type", message, reference),
  });
  if (!ts.isTypeAliasDeclaration(declaration)) return open("The error type states no closed set of cases.");
  const members = ts.isUnionTypeNode(declaration.type) ? [...declaration.type.types] : [declaration.type];
  const items: ErrorCase[] = [];
  for (const member of members) {
    const entry = caseOf(context, member);
    if (!entry) return open("A member of the error type carries no business error case.");
    items.push(entry);
  }
  if (items.some((entry, index) => items.findIndex((other) => other.name === entry.name) !== index))
    return open("The error type states one case name more than once.");
  return { kind: "closed", value: { completeness: "complete", items, reasons: [] } };
}
