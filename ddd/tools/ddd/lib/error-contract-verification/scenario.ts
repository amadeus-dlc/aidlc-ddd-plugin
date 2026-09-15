/**
 * The fixed scenario the business-error contract is verified against: where its
 * Cargo workspace lives, which project module layout each package is written in,
 * and the sources that snapshot carries. The verification script and the contract
 * tests read one scenario from here rather than each restating it.
 */

import { readdirSync, readFileSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";
import type { SourceInput } from "../error-contract/index.ts";
import type { RustModuleLayout } from "../project-settings/contract.ts";

export const WORKSPACE = resolve(import.meta.dir, "../../../..", "tests/fixtures/error-contract/workspace");

/** The scenario writes one package in each project module layout, so both are exercised. */
export const LAYOUT: Record<"billing-domain" | "billing-use-case", RustModuleLayout> = {
  "billing-domain": "file",
  "billing-use-case": "mod-rs",
};
export type PackageName = keyof typeof LAYOUT;

/** Every Rust source of the workspace, named by its workspace-relative path. */
export function workspaceSources(): SourceInput[] {
  const found: SourceInput[] = [];
  const walk = (directory: string) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const full = join(directory, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith(".rs"))
        found.push({ path: relative(WORKSPACE, full).split(sep).join("/"), content: readFileSync(full, "utf8") });
    }
  };
  walk(WORKSPACE);
  return found.sort((a, b) => (a.path < b.path ? -1 : 1));
}
