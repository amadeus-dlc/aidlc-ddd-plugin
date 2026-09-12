import { expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { type DeclarationKind, parseDeclaration } from "../tools/ddd/lib/sensors/declaration.ts";

const declarations: { kind: DeclarationKind; key: string; english: string; japanese: string }[] = [
  {
    kind: "use-case-declarations",
    key: "use_cases",
    english: "DDD Use-case Declarations",
    japanese: "DDD ユースケース宣言",
  },
  { kind: "layer-structure", key: "layer_structures", english: "DDD Layer Structure", japanese: "DDD 層構造宣言" },
];
for (const declaration of declarations) {
  for (const language of ["english", "japanese", "both"] as const) {
    test(`${declaration.kind}: ${language} section markers`, () => {
      const root = mkdtempSync(join(tmpdir(), "ddd-declaration-language-"));
      try {
        const path = join(root, "artifact.md");
        const headings = language === "both" ? [declaration.english, declaration.japanese] : [declaration[language]];
        const sections = headings.map(
          (heading) =>
            `## ${heading}\n\n\`\`\`yaml\nschema_version: 1\nmodel_ref: inception/ddd-domain-modeling/ddd-domain-model-yaml.md\n${declaration.key}: []\n\`\`\`\n`,
        );
        writeFileSync(path, `# Design\n\n${sections.join("\n")}`);
        const result = parseDeclaration(path, declaration.kind);
        expect(result.ok).toBe(language !== "both");
        if (language === "both" && !result.ok) expect(result.message).toContain("exactly one section");
      } finally {
        rmSync(root, { recursive: true, force: true });
      }
    });
  }
}
