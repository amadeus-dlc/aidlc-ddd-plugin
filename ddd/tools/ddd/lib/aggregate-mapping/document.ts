/**
 * Owns the mapping artifact on disk: proving the path is the registered one, extracting its one
 * labelled YAML block, and replacing that block by writing the whole document beside it and
 * renaming it into place, so the registered path never holds a half-written document. Holds no
 * cached result, so a read that follows a write observes the file as it now stands.
 */

import { randomBytes } from "node:crypto";
import {
  accessSync,
  closeSync,
  constants,
  existsSync,
  lstatSync,
  openSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { basename, dirname, resolve } from "node:path";
import { MAPPING_DATA_FILE, MAPPING_DATA_PATH } from "../schema/artifacts.ts";
import type { FindingInput } from "../shared/findings.ts";
import { readYamlBlock, replaceYamlBlock, type YamlBlock } from "../shared/markdown-yaml.ts";
import { isRecord, MAPPING_RULES } from "./contract.ts";

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

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
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

type WriteOutcome = { readonly kind: "written" } | { readonly kind: "write-failed"; readonly detail: string };

/**
 * Replace only the YAML body; the prose, the fence delimiters and every other fence keep their
 * bytes.
 *
 * The replacement becomes visible in one step: the whole document is written to an entry of this
 * call's own beside it and renamed over it. Writing the registered file itself would empty it
 * before the new body existed, so a full disk, an I/O error or a kill would leave an emptied or
 * half-written document where the caller is told nothing changed.
 */
export function writeMappingDocument(document: MappingDocument, yaml: string): WriteOutcome {
  // Anyone who can create entries beside the document could pre-place a symbolic link at a staging
  // path they can predict, and the write would follow it out of the record with our privileges. An
  // unguessable name plus an exclusive create removes both halves: the path cannot be aimed at, and
  // an entry that already exists fails the open instead of being written through.
  const staging = `${document.path}.${randomBytes(12).toString("hex")}.staging`;
  let created = false;
  try {
    // Renaming over a symbolic link replaces the link itself, silently detaching the file it names.
    if (lstatSync(document.path, { throwIfNoEntry: false })?.isSymbolicLink())
      return {
        kind: "write-failed",
        detail: `${document.path} is a symbolic link; replace it with a regular file first`,
      };
    // A rename asks the directory for permission and never the document, so on its own it would
    // replace a mapping the team has made read-only. The document's own permission decides here,
    // as it did when the document was written in place.
    accessSync(document.path, constants.W_OK);
    const text = replaceYamlBlock(document.text, document.block, yaml);
    const handle = openSync(staging, "wx");
    // From here the entry exists, whether or not the write that follows completes.
    created = true;
    try {
      writeFileSync(handle, text);
    } finally {
      closeSync(handle);
    }
    renameSync(staging, document.path);
    return { kind: "written" };
  } catch (error) {
    // Only the entry this call brought into existence is ours to remove; anything already at that
    // path belongs to whoever put it there.
    if (created) rmSync(staging, { force: true });
    return { kind: "write-failed", detail: errorMessage(error) };
  }
}
