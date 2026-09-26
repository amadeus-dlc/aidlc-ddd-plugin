/**
 * The TypeScript verification path: every mapped operation of one scenario project is resolved with
 * the Compiler API under that project's condition and code representation, and handed to the shared
 * comparison as an observation and its execution. Nothing here judges a case set.
 *
 * The mapped module is placed under the package's `src` where the module layout its package is
 * written in puts it, and the operation owner is the mapped type alone, which is the one owner the
 * extractor accepts.
 */

import { posix } from "node:path";
import type { AggregateMapping } from "../aggregate-mapping/contract.ts";
import type { SourceInput } from "../error-contract/contract.ts";
import { freezeInput } from "../error-contract-verification/input.ts";
import type { TypeScriptCodeRepresentation, TypeScriptModuleLayout } from "../project-settings/contract.ts";
import { projectSettingsPayload } from "../project-settings/payload.ts";
import {
  extractTypeScriptErrorContract,
  resolveTypeScriptCondition,
  TS_ERROR_CONTRACT_TOOLCHAIN,
} from "../typescript/error-contract/index.ts";
import { type ObservedOperations, PROJECT_ROOTS, TYPESCRIPT_PACKAGE_LAYOUT } from "./scenario.ts";

/** Each code representation is written in its own project, so no project mixes the two. */
const PROJECT_ROOT: Readonly<Record<TypeScriptCodeRepresentation, string>> = {
  class: PROJECT_ROOTS["typescript-class"],
  companion: PROJECT_ROOTS["typescript-companion"],
};

/** The declaration both scenario projects configure as their language-support result. */
const RESULT_DEFINITION = { packageName: "billing-domain", modulePath: "src/result.ts", typeName: "Result" } as const;

/**
 * Where the mapped module sits under `layout`, in the package's `src`. `index-file` writes a module
 * with children as `<module>/index.ts` and a leaf as `<module>.ts`, so the file is the one of the two
 * the sources actually hold. Neither, or both, is refused rather than guessed.
 */
function mappedModuleFile(
  layout: TypeScriptModuleLayout,
  packageRoot: string,
  module: readonly string[],
  sources: readonly SourceInput[],
): string {
  const named = posix.join(packageRoot, "src", ...module).concat(".ts");
  if (layout === "named-file") return named;
  const index = posix.join(packageRoot, "src", ...module, "index.ts");
  const present = [index, named].filter((file) => sources.some((source) => source.path === file));
  if (present.length !== 1) {
    throw new Error(`the sources do not hold exactly one file for module ${module.join("/")}: ${index} or ${named}`);
  }
  return present[0];
}

export function observeTypeScriptOperations(
  representation: TypeScriptCodeRepresentation,
  mapping: AggregateMapping,
  sources: readonly SourceInput[],
): ObservedOperations {
  const resolution = resolveTypeScriptCondition({
    workspaceRoot: PROJECT_ROOT[representation],
    resultDefinition: RESULT_DEFINITION,
  });
  if (resolution.kind !== "resolved")
    throw new Error(`project condition unavailable: ${JSON.stringify(resolution.reasons)}`);
  const condition = resolution.condition;
  const owners = condition.packages.filter((entry) => entry.name === mapping.code.package);
  if (owners.length !== 1) throw new Error(`the project does not own one package ${mapping.code.package}`);
  const [owner] = owners;
  const layout = TYPESCRIPT_PACKAGE_LAYOUT.get(mapping.code.package);
  if (!layout) throw new Error(`the scenario records no module layout for package ${mapping.code.package}`);
  const file = mappedModuleFile(layout, owner.packageRoot, mapping.code.module, sources);

  const observed = mapping.operations.map((operation) => {
    const frozen = freezeInput({
      language: "typescript",
      typeScriptCondition: condition,
      target: {
        packageId: owner.packageId,
        targetName: owner.tsconfigPath,
        file,
        declarationPath: [mapping.code.type],
        operation: operation.code.method,
      },
      sources,
      settings: projectSettingsPayload({
        languages: ["typescript"],
        rust: null,
        typescript: { moduleLayout: layout, codeRepresentation: representation },
      }),
      toolchain: TS_ERROR_CONTRACT_TOOLCHAIN,
    });
    const execution = { status: "completed", response: extractTypeScriptErrorContract(frozen) };
    return { operationRef: operation.operation_ref, request: frozen.request, execution };
  });
  return {
    observations: observed.map(({ operationRef, request }) => ({ operationRef, request })),
    executions: observed.map(({ operationRef, execution }) => ({ operationRef, execution })),
  };
}
