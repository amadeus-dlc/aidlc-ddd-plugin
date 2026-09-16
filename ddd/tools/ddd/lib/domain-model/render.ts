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
import { field, mapping, nodeList, optionalField, requiredNodeList, scalarList } from "../shared/yaml-render.ts";

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
