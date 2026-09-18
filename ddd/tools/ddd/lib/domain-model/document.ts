/**
 * Owns the model artifact on disk: proving the path names it, extracting its one labelled YAML
 * block, and replacing that block. Holds no cached result, so a read that follows a write observes
 * the file as it now stands.
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { basename } from "node:path";
import { MODEL_DATA_FILE } from "../schema/artifacts.ts";
import type { FindingInput } from "../shared/findings.ts";
import { writeYamlBlockDocument } from "../shared/markdown-document.ts";
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

export type WriteOutcome = { readonly kind: "written" } | { readonly kind: "write-failed"; readonly detail: string };

/**
 * The document as a migration would write it: only the YAML body replaced, with the prose, the
 * fence delimiters and every other fence keeping their bytes. Available on its own so a candidate
 * can be proven readable in the format it claims before the file it replaces is touched.
 */
export function migratedDocumentText(document: ModelDocument, yaml: string): string {
  return replaceYamlBlock(document.text, document.block, yaml);
}

export function writeMigratedDocument(document: ModelDocument, yaml: string): WriteOutcome {
  try {
    writeFileSync(document.path, migratedDocumentText(document, yaml));
    return { kind: "written" };
  } catch (error) {
    return { kind: "write-failed", detail: errorMessage(error) };
  }
}

/**
 * The same replacement for a document the caller has proven to stand at its registered location
 * inside `recordDir`. Reading a model proves only its file name, so the record it belongs to cannot
 * be derived here; a caller that knows it hands it over, and the shared writer then holds the
 * registered path to being a real file inside that record and makes the replacement visible in one
 * step — as every other registered artifact of a record is written.
 */
export function writeMigratedDocumentInRecord(document: ModelDocument, recordDir: string, yaml: string): WriteOutcome {
  return writeYamlBlockDocument({ path: document.path, recordDir, text: document.text, block: document.block }, yaml);
}
