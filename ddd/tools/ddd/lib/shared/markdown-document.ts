/**
 * Replacing the one labelled YAML block of a Markdown artifact on disk, shared by the migrations.
 *
 * The prose, the fence delimiters and every other fence keep their bytes; only the block body is
 * replaced. The replacement becomes visible in one step, and a registered path this code will not
 * write through is refused rather than written around.
 */

import { randomBytes } from "node:crypto";
import { accessSync, closeSync, constants, lstatSync, openSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { replaceYamlBlock, type YamlBlock } from "./markdown-yaml.ts";

export type WriteOutcome = { readonly kind: "written" } | { readonly kind: "write-failed"; readonly detail: string };

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Replace only the YAML body of `block` in the document at `path`.
 *
 * The whole document is written to an entry of this call's own beside it and renamed over it.
 * Writing the registered file itself would empty it before the new body existed, so a full disk, an
 * I/O error or a kill would leave an emptied or half-written document where the caller is told
 * nothing changed.
 */
export function writeYamlBlockDocument(path: string, text: string, block: YamlBlock, yaml: string): WriteOutcome {
  // Anyone who can create entries beside the document could pre-place a symbolic link at a staging
  // path they can predict, and the write would follow it out of the record with our privileges. An
  // unguessable name plus an exclusive create removes both halves: the path cannot be aimed at, and
  // an entry that already exists fails the open instead of being written through.
  const staging = `${path}.${randomBytes(12).toString("hex")}.staging`;
  let created = false;
  try {
    // Renaming over a symbolic link replaces the link itself, silently detaching the file it names.
    if (lstatSync(path, { throwIfNoEntry: false })?.isSymbolicLink())
      return { kind: "write-failed", detail: `${path} is a symbolic link; replace it with a regular file first` };
    // A rename asks the directory for permission and never the document, so on its own it would
    // replace an artifact the team has made read-only. The document's own permission decides here,
    // as it did when the document was written in place.
    accessSync(path, constants.W_OK);
    const replaced = replaceYamlBlock(text, block, yaml);
    const handle = openSync(staging, "wx");
    // From here the entry exists, whether or not the write that follows completes.
    created = true;
    try {
      writeFileSync(handle, replaced);
    } finally {
      closeSync(handle);
    }
    renameSync(staging, path);
    return { kind: "written" };
  } catch (error) {
    // Only the entry this call brought into existence is ours to remove; anything already at that
    // path belongs to whoever put it there.
    if (created) rmSync(staging, { force: true });
    return { kind: "write-failed", detail: errorMessage(error) };
  }
}
