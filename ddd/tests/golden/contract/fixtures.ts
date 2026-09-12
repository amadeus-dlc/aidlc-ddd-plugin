import { DESIGN_CASES } from "../design/cases.ts";
import { PACKAGING_CASES } from "../packaging/cases.ts";
import type { GoldenCase } from "../runner.ts";
import { RUST_CASES } from "../rust/cases.ts";

export const MODEL = "inception/ddd-domain-modeling/ddd-domain-model-yaml.md";
export const VIEW = "inception/ddd-domain-modeling/ddd-domain-model.md";
export const MAP = "inception/domain-design/ddd-aggregate-mapping.md";
export const SOURCE_MANIFEST = "construction/u1/code-generation/source-manifest.json";
const base = [...DESIGN_CASES, ...RUST_CASES, ...PACKAGING_CASES];
export function specimen(sensor: string, name: string): GoldenCase {
  const entry = base.find((item) => item.sensor === sensor && item.name === name);
  if (!entry) throw new Error(`Missing fixture: ${sensor}/${name}`);
  return structuredClone(entry);
}
export function editYaml(
  entry: GoldenCase,
  path: string,
  edit: (value: ReturnType<typeof Bun.YAML.parse>) => void,
): void {
  const markdown = entry.files[path];
  const block = /```yaml\n([\s\S]*?)\n```/.exec(markdown);
  if (!block) throw new Error(`No YAML: ${entry.name}/${path}`);
  const value = Bun.YAML.parse(block[1]);
  edit(value);
  entry.files[path] = markdown.replace(block[0], `\`\`\`yaml\n${JSON.stringify(value, null, 2)}\n\`\`\``);
}
export function workspace(entry: GoldenCase): Record<string, string> {
  if (!entry.workspace) throw new Error(`Missing workspace: ${entry.sensor}/${entry.name}`);
  return entry.workspace;
}
