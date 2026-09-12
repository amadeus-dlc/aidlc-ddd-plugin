import { withFixturePackages } from "./package-fixture.ts";

/** Materialize raw YAML fixtures using the published Markdown envelope. */
export function modelDocument(yaml: string): string {
  return `# 正規モデル\n\n\`\`\`yaml\n${yaml.trimEnd()}\n\`\`\`\n`;
}

export function designDocument(path: string, content: string): string {
  if (path.endsWith("ddd-aggregate-mapping.md")) return withFixturePackages(content);
  if (path.endsWith("ddd-domain-model-yaml.md")) return modelDocument(content);
  const heading = path.endsWith("functional-spec.md")
    ? "DDD Use-case Declarations"
    : path.endsWith("cicd-pipeline.md")
      ? "DDD Layer Structure"
      : undefined;
  if (!heading) return content;
  return `# 設計\n\n## ${heading}\n\n${content.replace(/^# .*\n/, "")}`;
}
