/**
 * The normalised model (DomainModel) — the TypeScript shape of
 * `domain-model.yaml`. The loader is the only producer; consumers (U4/U5/U6/U7/U8)
 * read this shape and the ElementIndex, never the raw YAML.
 */

import type { ElementId } from "./element-id.ts";

export type DomainElementKind = "entity" | "value-object" | "domain-primitive";

export interface ElementAttribute {
  name: string;
  type: string;
  required: boolean;
  collection: boolean;
}

export interface DomainElement {
  element_id: string;
  kind: DomainElementKind;
  name: string;
  aggregate: string;
  attributes: ElementAttribute[];
  invariants: string[];
}

export interface Invariant {
  element_id: string;
  name: string;
  aggregate: string;
  element?: string;
  statement: string;
}

export type CommandEffect = "transition" | "accumulation";
export type StateEffect = "transitions" | "none";

export interface DomainError {
  element_id: string;
  name: string;
  command: string;
  condition: string;
}

export type IdempotencyStrategy = "none" | "command-id-memory";
export type IdempotencyRetention = "last-one" | "multiple" | "time-window";

export interface IdempotencyPolicy {
  strategy: IdempotencyStrategy;
  retention?: IdempotencyRetention;
  retention_count?: number;
  retention_window?: string;
  rationale?: string;
}

export interface Command {
  element_id: string;
  name: string;
  aggregate: string;
  effect: CommandEffect;
  state_effect: StateEffect;
  transitions: string[];
  domain_errors: DomainError[];
  events: string[];
  idempotency: IdempotencyPolicy;
}

export interface DomainEvent {
  element_id: string;
  name: string;
  aggregate: string;
  produced_by: string;
}

export interface StateTransition {
  element_id: string;
  name: string;
  aggregate: string;
  from_state: string;
  to_state: string;
  command: string;
}

export interface FactoryRule {
  element_id: string;
  name: string;
  target_element: string;
  preconditions: string[];
}

export interface Aggregate {
  element_id: string;
  name: string;
  bounded_context: string;
  root_element: string;
  states: string[];
  elements: DomainElement[];
  invariants: Invariant[];
  commands: Command[];
  events: DomainEvent[];
  transitions: StateTransition[];
  factory_rules: FactoryRule[];
  /** Derived by the loader from ProcessManager.aggregates. */
  process_managers: string[];
}

export interface ProcessStep {
  name: string;
  command: string;
  on_failure?: string;
}

export interface ProcessManager {
  element_id: string;
  name: string;
  aggregates: string[];
  steps: ProcessStep[];
  compensations: ProcessStep[];
}

export interface BoundedContext {
  element_id: string;
  name: string;
  aggregates: Aggregate[];
  process_managers: ProcessManager[];
}

export type LineageRelation = "renamed" | "split" | "merged" | "deprecated";

export interface ElementLineage {
  lineage_id: string;
  element_id: string;
  relation: LineageRelation;
  previous_name?: string;
  successors: string[];
  replaced_by?: string;
  deprecated_at?: string;
}

export interface DomainModel {
  schema_version: number;
  bounded_contexts: BoundedContext[];
  lineage: ElementLineage[];
}

/** A model element as the index exposes it to callers. */
export interface IndexedElement {
  id: ElementId;
  kind: ElementId["kind"];
  name: string;
  owner?: string;
  statement?: string;
  node: unknown;
}
