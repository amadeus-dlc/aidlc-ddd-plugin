/**
 * Inspection context types (U5 entities). U5 does not redefine U1/U2/U4 types;
 * it composes them here for the rule evaluators.
 */

import type { SensorRunContext, SourceClaim } from "../runtime/context.ts";
import type { AnalyzerRuntime, SyntaxTree } from "../rust/analyzer.ts";
import type { ElementIndex } from "../schema/index-builder.ts";
import type { DeclarationResult } from "../sensors/declaration.ts";
import type { CargoWorkspace, CrateLayerAssignment, FileClassification, Layer } from "../workspace/resolver.ts";
import type { ExternalCrateRule } from "./lists.ts";
import type { RustProgram } from "./rust/program.ts";

export interface InspectionTarget {
  claim: SourceClaim;
  classification: FileClassification;
  tree?: SyntaxTree;
  crate_name?: string;
}

export interface ModelAvailability {
  status: "available" | "skipped" | "absent" | "invalid";
  index?: ElementIndex;
  note?: string;
}

export interface MutatorSymbol {
  file: string;
  method_name: string;
  command_slug: string;
  classification: "declared-command" | "replay-exempt" | "post-init" | "undeclared" | "unknown";
  line: number;
}

export interface DomainTypeSymbol {
  key: string;
  type_name: string;
  crate_name: string;
  file: string;
  kind: "struct" | "enum";
  aggregate_slug: string;
  aggregate_ref?: string;
  getters: string[];
  constructors: string[];
  mutators: MutatorSymbol[];
  has_default: boolean;
  defaults: { file: string; line: number }[];
  non_private_field_lines: number[];
  field_type_texts: string[];
}

export interface DomainSymbolTable {
  crates: string[];
  types: DomainTypeSymbol[];
  getter_names: Set<string>;
  type_names: Set<string>;
  /** method name -> owning type names, for the constructor lookup in (n). */
  constructors_by_type: Map<string, Set<string>>;
  file_count: number;
}

export interface DependencyEdge {
  from_crate: string;
  to_crate: string;
  evidence: "use-path" | "cargo-dependency";
  file: string;
  line?: number;
  verdict: "ok" | "layer-forbidden" | "cross-side" | "external-io";
}

export interface InspectionContext {
  analyzer: AnalyzerRuntime;
  aggregateMapping?: DeclarationResult;
  run: SensorRunContext;
  workspace: CargoWorkspace;
  assignments: CrateLayerAssignment[];
  targets: InspectionTarget[];
  skipped: InspectionTarget[];
  symbols: DomainSymbolTable;
  program: RustProgram;
  model: ModelAvailability;
  denylist: readonly ExternalCrateRule[];
  opaque: string[];
  edges: DependencyEdge[];
  layerDiagnostics: { code: string; file: string; message: string }[];
  targetLayers: readonly Layer[];
  includesQuerySide: boolean;
}
