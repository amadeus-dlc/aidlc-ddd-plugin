/**
 * TypeScript projects written where a test needs one, and the probe that launches the TypeScript
 * extractor from a given tools tree in a process of its own.
 *
 * The probe runs outside the test process on purpose: the only Compiler API it can reach is the one
 * the tools tree it is pointed at distributes, which is what an installed project has.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/** The compiler settings the extractor's project condition accepts, as a package states them. */
export const SUPPORTED_COMPILER_OPTIONS: Readonly<Record<string, unknown>> = {
  target: "esnext",
  module: "esnext",
  moduleResolution: "bundler",
  strict: true,
};

export interface ProjectPackage {
  readonly name: string;
  readonly compilerOptions: Readonly<Record<string, unknown>>;
}

const ONE_SUPPORTED_PACKAGE: readonly ProjectPackage[] = [
  { name: "billing-domain", compilerOptions: SUPPORTED_COMPILER_OPTIONS },
];

/**
 * A root `tsconfig.json` referencing one package per entry, each with its own `tsconfig.json` and
 * one source, so a package config names at least one input as the compiler requires.
 */
export function writeTypeScriptProject(root: string, packages: readonly ProjectPackage[] = ONE_SUPPORTED_PACKAGE): string {
  writeFileSync(
    join(root, "tsconfig.json"),
    `${JSON.stringify({ files: [], references: packages.map((entry) => ({ path: `./${entry.name}` })) })}\n`,
  );
  for (const entry of packages) {
    const packageRoot = join(root, entry.name);
    mkdirSync(join(packageRoot, "src"), { recursive: true });
    writeFileSync(
      join(packageRoot, "package.json"),
      `${JSON.stringify({ name: entry.name, version: "0.1.0", type: "module", exports: { ".": "./src/index.ts" } })}\n`,
    );
    writeFileSync(
      join(packageRoot, "tsconfig.json"),
      `${JSON.stringify({ compilerOptions: entry.compilerOptions, include: ["src/**/*.ts"] })}\n`,
    );
    writeFileSync(join(packageRoot, "src/index.ts"), "export const ready = true;\n");
  }
  return root;
}

/** Arguments: the tools tree to launch from, then the project root. Prints one JSON object. */
export const PROBE = join(import.meta.dir, "probe.ts");

/** The one source the probe asks about, and the construction its facts must carry. */
export const PROBE_FILE = "src/invoice.ts";
export const PROBE_CONSTRUCTED_TYPE = "Invoice";
