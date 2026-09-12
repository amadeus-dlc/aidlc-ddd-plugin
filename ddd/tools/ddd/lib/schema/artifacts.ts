import { readYamlBlock } from "../shared/markdown-yaml.ts";

/** AI-DLC resolves these registered artifact names as Markdown files. */
export const MODEL_DATA_FILE = "ddd-domain-model-yaml.md";
export const MODEL_VIEW_FILE = "ddd-domain-model.md";
export const MODEL_DATA_PATH = `inception/ddd-domain-modeling/${MODEL_DATA_FILE}`;

/** The model data artifact contains exactly one explicitly labelled YAML block. */
export function modelYaml(markdown: string): string {
  return readYamlBlock(markdown).yaml;
}
