/**
 * The Rust verification path: every mapped operation of the scenario workspace is resolved by the
 * native extractor under one Cargo condition, and handed to the shared comparison as an observation
 * and its execution. Nothing here judges a case set.
 *
 * The mapped module is placed where the module layout its package is written in puts it. The module
 * path itself does not move with the layout, so the declaration path is `[...module, type]` in either.
 */

import { join, posix } from "node:path";
import type { AggregateMapping } from "../aggregate-mapping/contract.ts";
import type { SourceInput } from "../error-contract/contract.ts";
import { freezeInput } from "../error-contract-verification/input.ts";
import type { RustModuleLayout } from "../project-settings/contract.ts";
import { projectSettingsPayload } from "../project-settings/payload.ts";
import { resolveCargoCondition } from "../rust/error-contract/cargo-condition.ts";
import { extractRust, RUST_TOOLCHAIN } from "../rust/error-contract/index.ts";
import { NATIVE_BIN_DIR, PLATFORM_KEY, resolvePlatform } from "../rust/native/manifest.ts";
import { type ObservedOperations, PROJECT_ROOTS, RUST_PACKAGE_LAYOUT } from "./scenario.ts";

/**
 * Where the mapped module sits under `layout`, beside the library crate root. `mod-rs` reaches a
 * module through the directory it owns, and the scenario gives every module it writes there a child,
 * so that placement is the one the layout states for a module with children.
 */
function mappedModuleFile(layout: RustModuleLayout, crateRoot: string, module: readonly string[]): string {
  const directory = posix.dirname(crateRoot);
  return layout === "file"
    ? posix.join(directory, ...module).concat(".rs")
    : posix.join(directory, ...module, "mod.rs");
}

export async function observeRustOperations(
  mapping: AggregateMapping,
  sources: readonly SourceInput[],
): Promise<ObservedOperations> {
  // The triple comes from the distribution record of the extractor that will resolve these
  // operations, so this path needs no `rustc` of its own.
  const platform = resolvePlatform(NATIVE_BIN_DIR, PLATFORM_KEY);
  if (!platform) throw new Error(`this distribution records no native extractor for ${PLATFORM_KEY}`);
  const resolution = await resolveCargoCondition({
    manifestPath: join(PROJECT_ROOTS.rust, "Cargo.toml"),
    targetTriple: platform.target,
    features: [],
  });
  if (resolution.kind !== "resolved")
    throw new Error(`Cargo condition unavailable: ${JSON.stringify(resolution.reasons)}`);
  const condition = resolution.condition;
  const owners = condition.packages.filter((entry) => entry.name === mapping.code.package);
  if (owners.length !== 1) throw new Error(`the workspace does not own one package ${mapping.code.package}`);
  // The condition records library targets only, so the first target is the crate root.
  const [library] = owners[0].targets;
  const layout = RUST_PACKAGE_LAYOUT.get(mapping.code.package);
  if (!layout) throw new Error(`the scenario records no module layout for package ${mapping.code.package}`);
  const file = mappedModuleFile(layout, library.srcPath, mapping.code.module);

  const observed = await Promise.all(
    mapping.operations.map(async (operation) => {
      const frozen = freezeInput({
        language: "rust",
        cargoCondition: condition,
        target: {
          packageId: owners[0].packageId,
          targetName: library.name,
          file,
          declarationPath: [...mapping.code.module, mapping.code.type],
          operation: operation.code.method,
        },
        sources,
        settings: projectSettingsPayload({ languages: ["rust"], rust: { moduleLayout: layout }, typescript: null }),
        toolchain: RUST_TOOLCHAIN,
      });
      const { execution } = await extractRust(frozen);
      return { operationRef: operation.operation_ref, request: frozen.request, execution };
    }),
  );
  return {
    observations: observed.map(({ operationRef, request }) => ({ operationRef, request })),
    executions: observed.map(({ operationRef, execution }) => ({ operationRef, execution })),
  };
}
