/**
 * Owns the layer declaration on disk: proving the path is the registered one, extracting the one
 * labelled YAML block below the DDD section marker, and replacing that block's body.
 *
 * `cicd-pipeline.md` is a review artifact whose other sections carry the pipeline prose and the CI
 * configuration the pipeline actually runs, so the section marker — not the file — is what selects
 * the declaration. Holds no cached result, so a read that follows a write observes the file as it
 * now stands.
 */

import { existsSync, readFileSync } from "node:fs";
import { basename, dirname, resolve } from "node:path";
import type { FindingInput } from "../shared/findings.ts";
import { errorMessage, type WriteOutcome, writeYamlBlockDocument } from "../shared/markdown-document.ts";
import { readYamlBlock, type YamlBlock } from "../shared/markdown-yaml.ts";
import { isRecord } from "../shared/yaml-read.ts";
import { LAYER_RULES } from "./contract.ts";

const DECLARATION_FILE = "cicd-pipeline.md";
const DECLARATION_STAGE = "infrastructure-design";
const CONSTRUCTION_PHASE = "construction";
/** Where the infrastructure-design stage writes the review artifact that holds the DDD section. */
const DECLARATION_LOCATION = `<record>/${CONSTRUCTION_PHASE}/<unit>/${DECLARATION_STAGE}/${DECLARATION_FILE}`;

/** The section markers the team may write the declaration under; exactly one of them, exactly once. */
const LAYER_HEADINGS: readonly string[] = ["DDD Layer Structure", "DDD 層構造宣言"];

export interface LayerDocument {
  readonly path: string;
  /** The intent record the registered location places the document in; model_ref resolves against it. */
  readonly recordDir: string;
  readonly text: string;
  readonly block: YamlBlock;
  /** The parsed block, before any format has been assumed. */
  readonly root: Readonly<Record<string, unknown>>;
}

type DocumentRead =
  | { readonly kind: "loaded"; readonly document: LayerDocument }
  | { readonly kind: "rejected"; readonly findings: readonly FindingInput[] };

function refused(path: string, message: string): DocumentRead {
  return { kind: "rejected", findings: [{ rule_id: LAYER_RULES.document, file: path, message }] };
}

/**
 * The record directory `path` sits in when it is the registered pipeline document of some unit.
 * The unit directory carries a name the delivery plan chose, so any one name stands there; every
 * other segment is fixed. A copy elsewhere is not a declaration this code may read or rewrite.
 */
function recordDirOf(path: string): string | undefined {
  let current = resolve(path);
  for (const segment of [DECLARATION_FILE, DECLARATION_STAGE]) {
    if (basename(current) !== segment) return undefined;
    current = dirname(current);
  }
  // The unit directory: named by the delivery plan, so only its presence is fixed.
  if (basename(current).length === 0) return undefined;
  current = dirname(current);
  if (basename(current) !== CONSTRUCTION_PHASE) return undefined;
  return dirname(current);
}

export function readLayerDocument(path: string): DocumentRead {
  const recordDir = recordDirOf(path);
  if (recordDir === undefined)
    return refused(path, `only ${DECLARATION_LOCATION} is a layer declaration document, not ${path}`);
  if (!existsSync(path)) return refused(path, `${DECLARATION_FILE} not found: ${path}`);
  let text: string;
  try {
    text = readFileSync(path, "utf-8");
  } catch (error) {
    return refused(path, `failed to read ${path}: ${errorMessage(error)}`);
  }
  let block: YamlBlock;
  let root: unknown;
  try {
    block = readYamlBlock(text, LAYER_HEADINGS);
    root = Bun.YAML.parse(block.yaml);
  } catch (error) {
    return refused(path, `failed to parse the DDD layer section of ${path}: ${errorMessage(error)}`);
  }
  if (!isRecord(root)) return refused(path, `the DDD layer section of ${path} must hold a YAML mapping`);
  return { kind: "loaded", document: { path, recordDir, text, block, root } };
}

/** Replace only the YAML body of the declaration block; everything outside it keeps its bytes. */
export function writeLayerDocument(document: LayerDocument, yaml: string): WriteOutcome {
  return writeYamlBlockDocument(document, yaml);
}
