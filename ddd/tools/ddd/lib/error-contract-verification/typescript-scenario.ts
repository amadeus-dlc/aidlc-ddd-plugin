/**
 * The fixed TypeScript scenario the business-error contract is verified against:
 * where its project lives, which module layout and code representation each
 * package is written in, which declaration is its language-support result, and
 * the sources that snapshot carries. The verification script and the contract
 * tests read one scenario from here rather than each restating it.
 *
 * States the result declaration by structure rather than by a named contract
 * type: the TypeScript boundary already depends on this directory for source
 * locations, so naming its types here would close a cycle between them.
 */

import { readdirSync, readFileSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";
import type { SourceInput } from "../error-contract/index.ts";
import type { TypeScriptSelection } from "../project-settings/contract.ts";

export const TYPESCRIPT_WORKSPACE = resolve(
  import.meta.dir,
  "../../../..",
  "tests/fixtures/error-contract/typescript-workspace",
);

/** The scenario writes one package in each module layout and each code representation, so both are exercised. */
export const TYPESCRIPT_SELECTION: Record<"billing-domain" | "billing-use-case", TypeScriptSelection> = {
  "billing-domain": { moduleLayout: "named-file", codeRepresentation: "class" },
  "billing-use-case": { moduleLayout: "index-file", codeRepresentation: "companion" },
};
export type TypeScriptPackageName = keyof typeof TYPESCRIPT_SELECTION;

/** The declaration this project configures as its language-support result, named inside its own package. */
export const TYPESCRIPT_RESULT = {
  packageName: "billing-domain",
  modulePath: "src/result.ts",
  typeName: "Result",
} as const;

/** Every TypeScript source of the project, named by its project-relative path. */
export function typeScriptWorkspaceSources(): SourceInput[] {
  const found: SourceInput[] = [];
  const walk = (directory: string) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const full = join(directory, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith(".ts"))
        found.push({
          path: relative(TYPESCRIPT_WORKSPACE, full).split(sep).join("/"),
          content: readFileSync(full, "utf8"),
        });
    }
  };
  walk(TYPESCRIPT_WORKSPACE);
  return found.sort((a, b) => (a.path < b.path ? -1 : 1));
}
