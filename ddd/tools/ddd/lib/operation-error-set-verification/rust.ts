/**
 * The Rust verification path: every mapped operation of the scenario workspace is resolved by the
 * native extractor under one Cargo condition, and handed to the shared comparison as an observation
 * and its execution. Nothing here judges a case set.
 *
 * The mapped module is placed as a leaf file beside the package's library crate root. That is the
 * one placement the scenario workspace uses; the extractor itself accepts both project module layouts.
 */

import { join, posix } from "node:path";
import type { AggregateMapping } from "../aggregate-mapping/contract.ts";
import type { SourceInput } from "../error-contract/contract.ts";
import { freezeInput } from "../error-contract-verification/input.ts";
import { projectSettingsPayload } from "../project-settings/payload.ts";
import { resolveCargoCondition } from "../rust/error-contract/cargo-condition.ts";
import { extractRust, RUST_TOOLCHAIN } from "../rust/error-contract/index.ts";
import { NATIVE_BIN_DIR, PLATFORM_KEY, resolvePlatform } from "../rust/native/manifest.ts";
import { type ObservedOperations, PROJECT_ROOTS } from "./scenario.ts";

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

  const observed = await Promise.all(
    mapping.operations.map(async (operation) => {
      const frozen = freezeInput({
        language: "rust",
        cargoCondition: condition,
        target: {
          packageId: owners[0].packageId,
          targetName: library.name,
          file: posix.join(posix.dirname(library.srcPath), ...mapping.code.module).concat(".rs"),
          declarationPath: [...mapping.code.module, mapping.code.type],
          operation: operation.code.method,
        },
        sources,
        settings: projectSettingsPayload({ languages: ["rust"], rust: { moduleLayout: "file" }, typescript: null }),
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
