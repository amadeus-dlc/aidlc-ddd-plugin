/** Conservative lexical forwarding facts. No calls, operators or macros are transparent. */
import type { TSNode } from "./vendor/tree-sitter.ts";

type BindingLookup = (node: TSNode, name: string) => TSNode | undefined;

function same(left: TSNode | null | undefined, right: TSNode): boolean {
  return (
    left?.type === right.type &&
    left.startPosition.row === right.startPosition.row &&
    left.startPosition.column === right.startPosition.column
  );
}

function after(node: TSNode, declaration: TSNode): boolean {
  return (
    node.startPosition.row > declaration.endPosition.row ||
    (node.startPosition.row === declaration.endPosition.row &&
      node.startPosition.column >= declaration.endPosition.column)
  );
}

function isBindingPattern(node: TSNode): boolean {
  for (let child = node, parent = node.parent; parent; child = parent, parent = parent.parent) {
    if (same(parent.childForFieldName("pattern"), child)) return true;
    if (parent.type === "closure_parameters" && child.type === "identifier") return true;
    if (parent.type === "block") break;
  }
  return false;
}

/** Call expressions consuming every use of a value unchanged, or undefined if not proven. */
export function forwardedArgumentCalls(node: TSNode, binding: BindingLookup): TSNode[] | undefined {
  let value = node;
  while (value.parent) {
    const parent = value.parent;
    if (parent.type === "parenthesized_expression") value = parent;
    else if (parent.type === "reference_expression" && !parent.children.some((c) => c.type === "mutable_specifier")) {
      value = parent;
    } else break;
  }
  const parent = value.parent;
  if (parent?.type === "arguments" && parent.parent?.type === "call_expression") return [parent.parent];
  if (parent?.type !== "let_declaration" || !same(parent.childForFieldName("value"), value)) return undefined;
  const pattern = parent.childForFieldName("pattern");
  if (pattern?.type !== "identifier" || parent.children.some((c) => c.type === "mutable_specifier")) return undefined;
  const block = parent.parent;
  if (block?.type !== "block") return undefined;
  const consumers: TSNode[] = [];
  let complete = true;
  const visit = (candidate: TSNode) => {
    if (!complete) return;
    if (
      candidate.type === "identifier" &&
      candidate.text === pattern.text &&
      after(candidate, parent) &&
      !isBindingPattern(candidate) &&
      same(binding(candidate, pattern.text), parent)
    ) {
      const uses = forwardedArgumentCalls(candidate, binding);
      if (uses) consumers.push(...uses);
      else complete = false;
    }
    for (const child of candidate.namedChildren) visit(child);
  };
  visit(block);
  return complete && consumers.length > 0 ? consumers : undefined;
}
