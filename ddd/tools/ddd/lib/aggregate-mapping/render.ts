/**
 * Writes a validated mapping back out as the schema_version 2 YAML the loader reads.
 *
 * Key order is fixed so reviewers see the business ids before the code names. Lists the reader
 * requires are written even when empty; optional ones — ports, replay methods, a repository — are
 * written only when the mapping carries them.
 */

import {
  field,
  mapping,
  nodeList,
  optionalField,
  requiredNodeList,
  requiredScalarList,
  scalarList,
} from "../shared/yaml-render.ts";
import type {
  AggregateCode,
  AggregateMapping,
  CodeLocation,
  DomainPackageMapping,
  ErrorCaseMapping,
  ImplementationMapping,
  OperationMapping,
  ReplayMethodMapping,
} from "./contract.ts";

function locationLines(location: CodeLocation): string[] {
  return [
    field("language", location.language),
    field("package", location.package),
    ...requiredScalarList("module", location.module),
  ];
}

function aggregateCodeLines(code: AggregateCode): string[] {
  return [
    ...locationLines(code),
    field("type", code.type),
    ...scalarList("ports", code.ports),
    ...optionalField("repository", code.repository),
  ];
}

function replayLines(replay: ReplayMethodMapping): string[] {
  return [field("event_ref", replay.event_ref), ...mapping("code", [field("method", replay.code.method)])];
}

function errorCaseLines(errorCase: ErrorCaseMapping): string[] {
  return [field("error_ref", errorCase.error_ref), ...mapping("code", [field("case", errorCase.code.case)])];
}

function operationLines(operation: OperationMapping): string[] {
  return [
    field("operation_ref", operation.operation_ref),
    ...mapping("code", [field("method", operation.code.method), field("error_type", operation.code.error_type)]),
    ...requiredNodeList("errors", operation.errors.map(errorCaseLines)),
  ];
}

function aggregateLines(aggregate: AggregateMapping): string[] {
  return [
    field("aggregate_ref", aggregate.aggregate_ref),
    field("programming_model", aggregate.programming_model),
    field("persistence_method", aggregate.persistence_method),
    ...requiredScalarList("reference_ids", aggregate.reference_ids),
    ...nodeList("replay_methods", aggregate.replay_methods.map(replayLines)),
    ...mapping("code", aggregateCodeLines(aggregate.code)),
    ...requiredNodeList("operations", aggregate.operations.map(operationLines)),
  ];
}

function packageLines(domainPackage: DomainPackageMapping): string[] {
  return [
    field("term", domainPackage.term),
    ...requiredScalarList("model_refs", domainPackage.model_refs),
    field("rationale", domainPackage.rationale),
    ...mapping("code", locationLines(domainPackage.code)),
  ];
}

export function renderMappingYaml(implementation: ImplementationMapping): string {
  return [
    field("schema_version", implementation.schema_version),
    field("model_ref", implementation.model_ref),
    ...requiredNodeList("aggregate_mappings", implementation.aggregate_mappings.map(aggregateLines)),
    ...requiredNodeList("domain_packages", implementation.domain_packages.map(packageLines)),
  ].join("\n");
}
