/**
 * The TypeScript side of the business-error contract: the project boundary that
 * records one analysis condition, and the extractor that resolves one operation
 * under it. Everything below this face is an implementation detail of that pair.
 */

export { extractTypeScriptErrorContract } from "./extract.ts";
export { TS_ERROR_CONTRACT_TOOLCHAIN } from "./program.ts";
export type {
  ResultDefinitionSelector,
  TypeScriptConditionOptions,
  TypeScriptConditionResolution,
} from "./project-condition.ts";
export { resolveTypeScriptCondition } from "./project-condition.ts";
