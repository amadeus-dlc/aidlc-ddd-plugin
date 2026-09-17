/**
 * Writes a declaration back out as the schema_version 2 YAML the loader reads.
 *
 * Key order is fixed so reviewers see the business terms — the context, the sides, the ports and the
 * aggregates — before the package names that spell them. Lists the reader requires are written even
 * when empty; the note on a restoration path is written only when the declaration carries one.
 */

import { field, mapping, optionalField, requiredNodeList, requiredScalarList } from "../shared/yaml-render.ts";
import type {
  LayerDeclaration,
  LayerPackage,
  LayerStructure,
  PackageDependency,
  PackageIdentity,
  PortDeclaration,
  RepositoryDeclaration,
  RestorationPath,
} from "./contract.ts";

function identityLines(identity: PackageIdentity): string[] {
  return [field("language", identity.language), field("package", identity.package)];
}

function packageLines(entry: LayerPackage): string[] {
  return [field("role", entry.role), ...mapping("code", identityLines(entry.code))];
}

function dependencyLines(row: PackageDependency): string[] {
  return [
    ...mapping("code", identityLines(row.code)),
    ...requiredNodeList("depends_on", row.depends_on.map(identityLines)),
  ];
}

function portLines(port: PortDeclaration): string[] {
  return [field("name", port.name), field("kind", port.kind), ...requiredScalarList("verbs", port.verbs)];
}

function repositoryLines(repository: RepositoryDeclaration): string[] {
  return [
    field("name", repository.name),
    field("aggregate_ref", repository.aggregate_ref),
    field("io_unit", repository.io_unit),
    ...requiredScalarList("verbs", repository.verbs),
    field("store_semantics", repository.store_semantics),
  ];
}

function restorationPathLines(path: RestorationPath): string[] {
  return [field("aggregate_ref", path.aggregate_ref), field("via", path.via), ...optionalField("note", path.note)];
}

function structureLines(structure: LayerStructure): string[] {
  return [
    field("context_ref", structure.context_ref),
    field("cqrs", structure.cqrs),
    ...requiredNodeList("packages", structure.packages.map(packageLines)),
    ...requiredNodeList("dependencies", structure.dependencies.map(dependencyLines)),
    ...requiredNodeList("ports", structure.ports.map(portLines)),
    ...requiredNodeList("repositories", structure.repositories.map(repositoryLines)),
    ...requiredNodeList("restoration_paths", structure.restoration_paths.map(restorationPathLines)),
    field("persistence_backend", structure.persistence_backend),
  ];
}

export function renderLayerYaml(declaration: LayerDeclaration): string {
  return [
    field("schema_version", declaration.schema_version),
    field("model_ref", declaration.model_ref),
    ...requiredNodeList("layer_structures", declaration.layer_structures.map(structureLines)),
  ].join("\n");
}
