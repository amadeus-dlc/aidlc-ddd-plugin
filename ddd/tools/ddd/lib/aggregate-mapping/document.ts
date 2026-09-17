/**
 * Owns the mapping artifact on disk: proving the path is the registered one, extracting its one
 * labelled YAML block, and replacing that block by writing the whole document beside it and
 * renaming it into place, so the registered path never holds a half-written document. Holds no
 * cached result, so a read that follows a write observes the file as it now stands.
 */

import { existsSync, readFileSync } from "node:fs";
import { basename, dirname, resolve } from "node:path";
import { MAPPING_DATA_FILE, MAPPING_DATA_PATH } from "../schema/artifacts.ts";
import type { FindingInput } from "../shared/findings.ts";
import { errorMessage, type WriteOutcome, writeYamlBlockDocument } from "../shared/markdown-document.ts";
import { readYamlBlock, type YamlBlock } from "../shared/markdown-yaml.ts";
import { isRecord } from "../shared/yaml-read.ts";
import { MAPPING_RULES } from "./contract.ts";

export interface MappingDocument {
  readonly path: string;
  /** The intent record the registered location places the document in; model_ref resolves against it. */
  readonly recordDir: string;
  readonly text: string;
  readonly block: YamlBlock;
  /** The parsed block, before any format has been assumed. */
  readonly root: Readonly<Record<string, unknown>>;
}

type DocumentRead =
  | { readonly kind: "loaded"; readonly document: MappingDocument }
  | { readonly kind: "rejected"; readonly findings: readonly FindingInput[] };

function refused(path: string, message: string): DocumentRead {
  return { kind: "rejected", findings: [{ rule_id: MAPPING_RULES.document, file: path, message }] };
}

/**
 * The record directory `path` sits in when it is `<record>/inception/domain-design/ddd-aggregate-mapping.md`.
 * Only that artifact is a mapping document: a copy elsewhere is not one this code may read or rewrite.
 */
function recordDirOf(path: string): string | undefined {
  let current = resolve(path);
  for (const segment of MAPPING_DATA_PATH.split("/").reverse()) {
    if (basename(current) !== segment) return undefined;
    current = dirname(current);
  }
  return current;
}

export function readMappingDocument(path: string): DocumentRead {
  const recordDir = recordDirOf(path);
  if (recordDir === undefined)
    return refused(path, `only ${MAPPING_DATA_PATH} inside an intent record is a mapping document, not ${path}`);
  if (!existsSync(path)) return refused(path, `${MAPPING_DATA_FILE} not found: ${path}`);
  let text: string;
  try {
    text = readFileSync(path, "utf-8");
  } catch (error) {
    return refused(path, `failed to read ${path}: ${errorMessage(error)}`);
  }
  let block: YamlBlock;
  let root: unknown;
  try {
    block = readYamlBlock(text);
    root = Bun.YAML.parse(block.yaml);
  } catch (error) {
    return refused(path, `failed to parse ${path}: ${errorMessage(error)}`);
  }
  if (!isRecord(root)) return refused(path, `the YAML block of ${path} must be a mapping`);
  return { kind: "loaded", document: { path, recordDir, text, block, root } };
}

/** Replace only the YAML body of the mapping document; everything outside it keeps its bytes. */
export function writeMappingDocument(document: MappingDocument, yaml: string): WriteOutcome {
  return writeYamlBlockDocument(document, yaml);
}
