/**
 * Line builders for the YAML the migrations write back into Markdown artifacts.
 *
 * Every string is emitted as a JSON-escaped double-quoted scalar, which is also a YAML
 * double-quoted scalar: business wording carries `: `, `#`, quotes, newlines and non-ASCII text,
 * and none of those may change meaning on the way through. Each builder returns unindented lines
 * for its caller to place, so a renderer reads as the shape of the document it writes.
 */

const INDENT = "  ";

type Scalar = string | number | boolean;

function scalar(value: Scalar): string {
  return typeof value === "string" ? JSON.stringify(value) : String(value);
}

/** One `key: value` line, written without indentation for the caller to place. */
export function field(key: string, value: Scalar): string {
  return `${key}: ${scalar(value)}`;
}

/** The same, dropped entirely when the value is not carried. */
export function optionalField(key: string, value: Scalar | undefined): string[] {
  return value === undefined ? [] : [field(key, value)];
}

function indent(lines: readonly string[], depth: number): string[] {
  const pad = INDENT.repeat(depth);
  return lines.map((line) => `${pad}${line}`);
}

/** One list item: the node's first line takes the dash, the rest line up under it. */
function item(lines: readonly string[]): string[] {
  return lines.map((line, index) => (index === 0 ? `- ${line}` : `${INDENT}${line}`));
}

/** An optional list of scalars, omitted when empty so the document states only what it has. */
export function scalarList(key: string, values: readonly string[]): string[] {
  if (values.length === 0) return [];
  return [
    `${key}:`,
    ...indent(
      values.map((value) => `- ${scalar(value)}`),
      1,
    ),
  ];
}

/**
 * A list of scalars under a key the reader requires. An empty one is written as `[]` rather than
 * omitted, because dropping the key would leave a document the reader refuses to read back.
 */
export function requiredScalarList(key: string, values: readonly string[]): string[] {
  return values.length === 0 ? [`${key}: []`] : scalarList(key, values);
}

export function nodeList(key: string, nodes: readonly (readonly string[])[]): string[] {
  if (nodes.length === 0) return [];
  return [`${key}:`, ...indent(nodes.flatMap(item), 1)];
}

/**
 * A list of nodes under a key the reader requires. An empty one is written as `[]` rather than
 * omitted, because dropping the key would leave a document the reader refuses to read back.
 */
export function requiredNodeList(key: string, nodes: readonly (readonly string[])[]): string[] {
  return nodes.length === 0 ? [`${key}: []`] : nodeList(key, nodes);
}

export function mapping(key: string, lines: readonly string[]): string[] {
  return [`${key}:`, ...indent(lines, 1)];
}
