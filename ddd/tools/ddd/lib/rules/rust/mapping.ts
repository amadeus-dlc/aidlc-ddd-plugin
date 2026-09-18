/**
 * The Rust view of the implementation mapping: what the current Rust source sensors receive.
 *
 * The mapping is language-neutral and may place some aggregates and packages in TypeScript. The
 * Rust source sensors bind Rust types and modules only, so this keeps the Rust entries and spells
 * their location the way those sensors compare it — a crate name and the module path below its
 * root — leaving every other language out. Nothing here re-decides whether the mapping is sound:
 * a record whose mapping the reader refuses has no view at all, and the reader's findings say why.
 */

import { existsSync } from "node:fs";
import { join } from "node:path";
import { loadAggregateMapping } from "../../aggregate-mapping/index.ts";
import { MAPPING_DATA_PATH } from "../../schema/artifacts.ts";
import type { FindingInput } from "../../shared/findings.ts";

/** One aggregate as the Rust rules compare it: replay methods, its crate and its module path. */
export interface RustAggregateMapping {
  readonly aggregate_ref: string;
  readonly persistence_method: string;
  readonly crate: string;
  /** The module path below the crate root, one segment per entry, spelled as the mapping wrote it. */
  readonly module: readonly string[];
  readonly replay_methods: readonly { readonly method: string; readonly event_ref: string }[];
}

export interface RustPackageMapping {
  readonly crate: string;
  readonly module: readonly string[];
}

export interface RustMappingView {
  readonly aggregates: readonly RustAggregateMapping[];
  readonly packages: readonly RustPackageMapping[];
}

export type RustMappingLoad =
  | { readonly kind: "absent" }
  | { readonly kind: "invalid"; readonly findings: readonly FindingInput[] }
  | { readonly kind: "loaded"; readonly view: RustMappingView };

/** Where the implementation mapping of `recordDir` is registered. */
export function mappingPathOf(recordDir: string): string {
  return join(recordDir, MAPPING_DATA_PATH);
}

/**
 * The Rust view of the mapping `recordDir` holds. A record without a mapping has none, which is a
 * different fact from a mapping that cannot be read in the current format.
 */
export function loadRustMapping(recordDir: string): RustMappingLoad {
  const path = mappingPathOf(recordDir);
  if (!existsSync(path)) return { kind: "absent" };
  const loaded = loadAggregateMapping(path);
  if (!loaded.ok) return { kind: "invalid", findings: loaded.findings };
  const view: RustMappingView = {
    aggregates: loaded.mapping.aggregate_mappings
      .filter((entry) => entry.code.language === "rust")
      .map((entry) => ({
        aggregate_ref: entry.aggregate_ref,
        persistence_method: entry.persistence_method,
        crate: entry.code.package,
        module: entry.code.module,
        replay_methods: entry.replay_methods.map((replay) => ({
          method: replay.code.method,
          event_ref: replay.event_ref,
        })),
      })),
    packages: loaded.mapping.domain_packages
      .filter((entry) => entry.code.language === "rust")
      .map((entry) => ({ crate: entry.code.package, module: entry.code.module })),
  };
  return { kind: "loaded", view };
}
