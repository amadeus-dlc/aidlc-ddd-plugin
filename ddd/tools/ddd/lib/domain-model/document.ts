/**
 * Owns the model artifact on disk: proving the path names it, extracting its one labelled YAML
 * block, and replacing that block. Holds no cached result, so a read that follows a write observes
 * the file as it now stands.
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { basename } from "node:path";
import { MODEL_DATA_FILE } from "../schema/artifacts.ts";
import type { FindingInput } from "../shared/findings.ts";
import { readYamlBlock, replaceYamlBlock, type YamlBlock } from "../shared/markdown-yaml.ts";

export interface ModelDocument {
  readonly path: string;
  readonly text: string;
  readonly block: YamlBlock;
  /** Whatever the document says its version is, before any format has been assumed. */
  readonly declaredVersion: unknown;
}

type DocumentOutcome =
  | { readonly kind: "loaded"; readonly document: ModelDocument }
  | { readonly kind: "rejected"; readonly findings: FindingInput[] };

function rejected(path: string, ruleId: string, message: string): DocumentOutcome {
  return { kind: "rejected", findings: [{ rule_id: ruleId, file: path, message }] };
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function readModelDocument(path: string): DocumentOutcome {
  // The migration converts the one registered artifact kind. The loader also accepts raw YAML, but
  // that is a lower-level read, not a document this command is entitled to rewrite.
  if (basename(path) !== MODEL_DATA_FILE)
    return rejected(path, "schema.structure", `only ${MODEL_DATA_FILE} can be migrated, not ${basename(path)}`);
  if (!existsSync(path)) return rejected(path, "schema.yaml-parse", `domain model not found: ${path}`);
  let text: string;
  try {
    text = readFileSync(path, "utf-8");
  } catch (error) {
    return rejected(path, "schema.yaml-parse", `failed to read ${path}: ${errorMessage(error)}`);
  }
  let block: YamlBlock;
  let declaredVersion: unknown;
  try {
    block = readYamlBlock(text);
    const root = Bun.YAML.parse(block.yaml);
    declaredVersion =
      typeof root === "object" && root !== null && !Array.isArray(root)
        ? (root as Record<string, unknown>).schema_version
        : undefined;
  } catch (error) {
    return rejected(path, "schema.yaml-parse", `failed to parse ${path}: ${errorMessage(error)}`);
  }
  return { kind: "loaded", document: { path, text, block, declaredVersion } };
}

type WriteOutcome = { readonly kind: "written" } | { readonly kind: "write-failed"; readonly detail: string };

/** Replace only the YAML body; the prose, the fence delimiters and every other fence keep their bytes. */
export function writeMigratedDocument(document: ModelDocument, yaml: string): WriteOutcome {
  try {
    writeFileSync(document.path, replaceYamlBlock(document.text, document.block, yaml));
    return { kind: "written" };
  } catch (error) {
    return { kind: "write-failed", detail: errorMessage(error) };
  }
}
