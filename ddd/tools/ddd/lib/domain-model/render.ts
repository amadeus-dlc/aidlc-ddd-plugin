/**
 * Writes a normalised model back out as the operation-owned YAML the loader reads.
 *
 * Shaped for this model and nothing else, so key order stays readable for the humans who review
 * the artifact. Every string is emitted as a JSON-escaped double-quoted scalar, which is also a
 * YAML double-quoted scalar: business conditions carry `: `, `#`, quotes, newlines and non-ASCII
 * text, and none of those may change meaning on the way through.
 */

import type {
  Aggregate,
  BoundedContext,
  Command,
  DomainElement,
  DomainError,
  DomainEvent,
  DomainModel,
  ElementAttribute,
  ElementLineage,
  FactoryRule,
  IdempotencyPolicy,
  Invariant,
  ProcessManager,
  ProcessStep,
  StateTransition,
} from "../schema/model.ts";

const INDENT = "  ";

type Scalar = string | number | boolean;

function scalar(value: Scalar): string {
  return typeof value === "string" ? JSON.stringify(value) : String(value);
}

/** One `key: value` line, written without indentation for the caller to place. */
function field(key: string, value: Scalar): string {
  return `${key}: ${scalar(value)}`;
}

/** The same, dropped entirely when the model does not carry the value. */
function optionalField(key: string, value: Scalar | undefined): string[] {
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

/** An optional list of scalars, omitted when empty so the document states only what the model has. */
function scalarList(key: string, values: readonly string[]): string[] {
  if (values.length === 0) return [];
  return [
    `${key}:`,
    ...indent(
      values.map((value) => `- ${scalar(value)}`),
      1,
    ),
  ];
}

function nodeList(key: string, nodes: readonly (readonly string[])[]): string[] {
  if (nodes.length === 0) return [];
  return [`${key}:`, ...indent(nodes.flatMap(item), 1)];
}

/**
 * A list of nodes under a key the loader requires. An empty one is written as `[]` rather than
 * omitted, because dropping the key would leave a document the loader refuses to read back.
 */
function requiredNodeList(key: string, nodes: readonly (readonly string[])[]): string[] {
  return nodes.length === 0 ? [`${key}: []`] : nodeList(key, nodes);
}

function mapping(key: string, lines: readonly string[]): string[] {
  return [`${key}:`, ...indent(lines, 1)];
}

function attributeLines(attribute: ElementAttribute): string[] {
  return [
    field("name", attribute.name),
    field("type", attribute.type),
    field("required", attribute.required),
    field("collection", attribute.collection),
  ];
}

function elementLines(element: DomainElement): string[] {
  return [
    field("element_id", element.element_id),
    field("kind", element.kind),
    field("name", element.name),
    field("aggregate", element.aggregate),
    ...nodeList("attributes", element.attributes.map(attributeLines)),
    ...scalarList("invariants", element.invariants),
  ];
}

function invariantLines(invariant: Invariant): string[] {
  return [
    field("element_id", invariant.element_id),
    field("name", invariant.name),
    field("aggregate", invariant.aggregate),
    ...optionalField("element", invariant.element),
    field("statement", invariant.statement),
  ];
}

function domainErrorLines(domainError: DomainError): string[] {
  return [
    field("element_id", domainError.element_id),
    field("name", domainError.name),
    field("operation", domainError.operation),
    field("condition", domainError.condition),
  ];
}

function idempotencyLines(policy: IdempotencyPolicy): string[] {
  return [
    field("strategy", policy.strategy),
    ...optionalField("retention", policy.retention),
    ...optionalField("retention_count", policy.retention_count),
    ...optionalField("retention_window", policy.retention_window),
    ...optionalField("rationale", policy.rationale),
  ];
}

function commandLines(command: Command): string[] {
  return [
    field("element_id", command.element_id),
    field("name", command.name),
    field("aggregate", command.aggregate),
    field("effect", command.effect),
    field("state_effect", command.state_effect),
    ...scalarList("transitions", command.transitions),
    ...nodeList("domain_errors", command.domain_errors.map(domainErrorLines)),
    ...scalarList("events", command.events),
    ...mapping("idempotency", idempotencyLines(command.idempotency)),
  ];
}

function eventLines(event: DomainEvent): string[] {
  return [
    field("element_id", event.element_id),
    field("name", event.name),
    field("aggregate", event.aggregate),
    field("produced_by", event.produced_by),
  ];
}

function transitionLines(transition: StateTransition): string[] {
  return [
    field("element_id", transition.element_id),
    field("name", transition.name),
    field("aggregate", transition.aggregate),
    field("from_state", transition.from_state),
    field("to_state", transition.to_state),
    field("command", transition.command),
  ];
}

function factoryLines(factory: FactoryRule): string[] {
  return [
    field("element_id", factory.element_id),
    field("name", factory.name),
    field("target_element", factory.target_element),
    ...scalarList("preconditions", factory.preconditions),
    ...nodeList("domain_errors", factory.domain_errors.map(domainErrorLines)),
  ];
}

/**
 * `process_managers` is omitted: the loader derives it from each ProcessManager's aggregates, so
 * writing it down would put a second copy of that fact in the artifact.
 */
function aggregateLines(aggregate: Aggregate): string[] {
  return [
    field("element_id", aggregate.element_id),
    field("name", aggregate.name),
    field("bounded_context", aggregate.bounded_context),
    field("root_element", aggregate.root_element),
    ...scalarList("states", aggregate.states),
    ...nodeList("elements", aggregate.elements.map(elementLines)),
    ...nodeList("invariants", aggregate.invariants.map(invariantLines)),
    ...nodeList("commands", aggregate.commands.map(commandLines)),
    ...nodeList("events", aggregate.events.map(eventLines)),
    ...nodeList("transitions", aggregate.transitions.map(transitionLines)),
    ...nodeList("factory_rules", aggregate.factory_rules.map(factoryLines)),
  ];
}

function stepLines(step: ProcessStep): string[] {
  return [field("name", step.name), field("command", step.command), ...optionalField("on_failure", step.on_failure)];
}

function processManagerLines(manager: ProcessManager): string[] {
  return [
    field("element_id", manager.element_id),
    field("name", manager.name),
    ...scalarList("aggregates", manager.aggregates),
    ...requiredNodeList("steps", manager.steps.map(stepLines)),
    ...nodeList("compensations", manager.compensations.map(stepLines)),
  ];
}

function boundedContextLines(context: BoundedContext): string[] {
  return [
    field("element_id", context.element_id),
    field("name", context.name),
    ...nodeList("aggregates", context.aggregates.map(aggregateLines)),
    ...nodeList("process_managers", context.process_managers.map(processManagerLines)),
  ];
}

function lineageLines(entry: ElementLineage): string[] {
  return [
    field("lineage_id", entry.lineage_id),
    field("element_id", entry.element_id),
    field("relation", entry.relation),
    ...optionalField("previous_name", entry.previous_name),
    ...scalarList("successors", entry.successors),
    ...optionalField("replaced_by", entry.replaced_by),
    ...optionalField("deprecated_at", entry.deprecated_at),
  ];
}

export function renderModelYaml(model: DomainModel): string {
  return [
    field("schema_version", model.schema_version),
    ...nodeList("bounded_contexts", model.bounded_contexts.map(boundedContextLines)),
    ...nodeList("lineage", model.lineage.map(lineageLines)),
  ].join("\n");
}
