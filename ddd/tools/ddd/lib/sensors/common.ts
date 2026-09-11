/**
 * Shared helpers for the U4 design sensor scripts.
 *
 * Findings are reported relative to the intent record directory so the golden
 * cases can compare stable paths (the record dir is the fixed frame the design
 * artifacts live in).
 */

import { existsSync, readFileSync } from "node:fs";
import { relative, sep } from "node:path";
import type { SensorRunContext } from "../runtime/context.ts";
import type { ElementIndex } from "../schema/index-builder.ts";
import type { DomainModel } from "../schema/model.ts";
import type { FindingInput } from "../shared/findings.ts";

export function relPath(context: SensorRunContext, absolute: string): string {
  return relative(context.record_dir, absolute).split(sep).join("/");
}

export function finding(rule_id: string, file: string, message: string, line?: number): FindingInput {
  return { rule_id, file, message, ...(line === undefined ? {} : { line }) };
}

export function readText(path: string): string | undefined {
  if (!existsSync(path)) return undefined;
  try {
    return readFileSync(path, "utf-8");
  } catch {
    return undefined;
  }
}

export interface UnresolvedReference {
  id: string;
  reason: string;
  expected?: string;
}

/** Walk every reference attribute and report those the index cannot resolve. */
export function collectUnresolved(model: DomainModel, index: ElementIndex): UnresolvedReference[] {
  const out: UnresolvedReference[] = [];
  const check = (id: string, expected?: string): void => {
    if (!id) return;
    const result = index.resolve(id, expected as never);
    if (!result.ok) out.push({ id, reason: result.reason, ...(expected ? { expected } : {}) });
  };
  for (const bc of model.bounded_contexts) {
    for (const aggregate of bc.aggregates) {
      check(aggregate.bounded_context, "bc");
      check(aggregate.root_element, "entity");
      for (const element of aggregate.elements) {
        check(element.aggregate, "aggregate");
        for (const attribute of element.attributes) {
          const looksLikeId = /^(entity|vo|primitive)\./.test(attribute.type);
          if (looksLikeId) check(attribute.type);
        }
      }
      for (const invariant of aggregate.invariants) {
        check(invariant.aggregate, "aggregate");
        if (invariant.element) check(invariant.element);
      }
      for (const command of aggregate.commands) {
        check(command.aggregate, "aggregate");
        for (const transition of command.transitions) check(transition, "transition");
        for (const event of command.events) check(event, "event");
        for (const error of command.domain_errors) check(error.command, "command");
      }
      for (const event of aggregate.events) {
        check(event.aggregate, "aggregate");
        check(event.produced_by, "command");
      }
      for (const transition of aggregate.transitions) {
        check(transition.aggregate, "aggregate");
        check(transition.command, "command");
      }
      for (const factory of aggregate.factory_rules) check(factory.target_element);
    }
    for (const pm of bc.process_managers) {
      for (const aggregateId of pm.aggregates) check(aggregateId, "aggregate");
      for (const step of [...pm.steps, ...pm.compensations]) check(step.command, "command");
    }
  }
  return out;
}

export function pascalCase(name: string): string {
  return name
    .split(/[-_]/)
    .filter((part) => part.length > 0)
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join("");
}
