/**
 * Schema-level fixture values for the TypeScript side of the shared
 * business-error contract.
 *
 * The source below is a self-contained snapshot used to exercise request
 * preparation and the request identity. It is not a resolution scenario:
 * resolution across modules, packages, entry points and project conditions is
 * exercised against the TypeScript workspace in `typescript-workspace/`.
 *
 * Response-side builders are not restated here. A response carries no language
 * of its own, so the builders in `values.ts` already cover that half.
 */

import type {
  InspectionInput,
  ResultDefinition,
  TypeScriptCondition,
  TypeScriptPackage,
} from "../../../tools/ddd/lib/error-contract/contract.ts";
import { projectSettingsPayload } from "../../../tools/ddd/lib/project-settings/payload.ts";

export const TS_DOMAIN_ID = "path:billing-domain#billing-domain@0.1.0";
export const TS_USE_CASE_ID = "path:billing-use-case#billing-use-case@0.1.0";

export const TS_SOURCE_PATH = "billing-domain/src/index.ts";
export const TS_SOURCE = [
  "export type Result<T, E> = { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: E };",
  'export type IssueInvoiceError = "already-issued" | "empty";',
  "export class Invoice { issue(): Result<void, IssueInvoiceError> { return { ok: true, value: undefined }; } }",
  "",
].join("\n");

export function tsLineStarts(): number[] {
  const starts = [0];
  for (let index = 0; index < TS_SOURCE.length; index++) if (TS_SOURCE[index] === "\n") starts.push(index + 1);
  return starts;
}

export function tsPackage(overrides: Partial<TypeScriptPackage> = {}): TypeScriptPackage {
  return {
    packageId: TS_DOMAIN_ID,
    name: "billing-domain",
    version: "0.1.0",
    packageRoot: "billing-domain",
    tsconfigPath: "billing-domain/tsconfig.json",
    entryPoints: [{ subpath: ".", target: "billing-domain/src/index.ts" }],
    projectReferences: [],
    dependencies: [],
    ...overrides,
  };
}
export function tsUseCasePackage(overrides: Partial<TypeScriptPackage> = {}): TypeScriptPackage {
  return {
    packageId: TS_USE_CASE_ID,
    name: "billing-use-case",
    version: "0.1.0",
    packageRoot: "billing-use-case",
    tsconfigPath: "billing-use-case/tsconfig.json",
    entryPoints: [{ subpath: ".", target: "billing-use-case/src/index.ts" }],
    projectReferences: [TS_DOMAIN_ID],
    dependencies: [TS_DOMAIN_ID],
    ...overrides,
  };
}
export function tsResultDefinition(overrides: Partial<ResultDefinition> = {}): ResultDefinition {
  return { packageId: TS_DOMAIN_ID, modulePath: "billing-domain/src/index.ts", typeName: "Result", ...overrides };
}
export function tsCondition(overrides: Partial<TypeScriptCondition> = {}): TypeScriptCondition {
  return {
    compilerApiVersion: "6.0.3",
    module: "esnext",
    moduleResolution: "bundler",
    target: "esnext",
    resolutionConditions: ["development"],
    strict: true,
    packages: [tsPackage()],
    resultDefinition: tsResultDefinition(),
    ...overrides,
  };
}
export function tsSettings() {
  return projectSettingsPayload({
    languages: ["typescript"],
    rust: null,
    typescript: { moduleLayout: "named-file", codeRepresentation: "class" },
  });
}
export function tsInput(overrides: Partial<InspectionInput> = {}): InspectionInput {
  return {
    language: "typescript",
    typeScriptCondition: tsCondition(),
    target: {
      packageId: TS_DOMAIN_ID,
      targetName: "billing-domain/tsconfig.json",
      file: TS_SOURCE_PATH,
      declarationPath: ["Invoice"],
      operation: "issue",
    },
    sources: [{ path: TS_SOURCE_PATH, content: TS_SOURCE }],
    settings: tsSettings(),
    toolchain: [{ name: "fixture", version: "1" }],
    ...overrides,
  } as InspectionInput;
}
