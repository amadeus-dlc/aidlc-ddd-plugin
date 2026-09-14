/**
 * Owns the root settings document on disk: locating it, proving it is the only one inside the
 * searched tree, rendering it, and replacing it atomically. Holds no cached result, so a read
 * that follows an apply observes the file as it now stands.
 */

import { randomBytes } from "node:crypto";
import type { Dirent } from "node:fs";
import { existsSync, lstatSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { isExcludedFromProjectScan } from "../shared/project-scope.ts";
import type { ProjectSelection, ReadOutcome, SettingsRejection } from "./contract.ts";
import {
  DOCUMENT_NAME,
  LANGUAGES_KEY,
  rejectionForDocument,
  rejectionForNested,
  SCHEMA_VERSION,
  VERSION_KEY,
} from "./contract.ts";
import { validateProjectSettings } from "./settings.ts";

type DocumentOutcome =
  | { readonly kind: "loaded"; readonly file: string; readonly table: Record<string, unknown> }
  | { readonly kind: "rejected"; readonly rejection: SettingsRejection };

type WriteOutcome = { readonly kind: "written" } | { readonly kind: "write-failed"; readonly detail: string };

type SearchOutcome =
  | { readonly kind: "searched"; readonly nested: readonly string[] }
  | { readonly kind: "unsearchable"; readonly directory: string; readonly detail: string };

/**
 * A directory the search cannot list is not an empty directory: a nested document inside it would go
 * unseen, and accepting the root document would claim a uniqueness the search never established.
 * The first failure ends the search and is reported, so the caller refuses instead of guessing.
 */
function nestedDocuments(root: string): SearchOutcome {
  const found: string[] = [];
  let failure: { directory: string; detail: string } | null = null;
  const walk = (directory: string): void => {
    if (failure) return;
    let entries: Dirent[];
    try {
      entries = readdirSync(directory, { withFileTypes: true });
    } catch (error) {
      failure = { directory, detail: error instanceof Error ? error.message : String(error) };
      return;
    }
    for (const entry of entries) {
      const path = join(directory, entry.name);
      if (entry.name === DOCUMENT_NAME && entry.isFile() && directory !== root) found.push(path);
      if (isExcludedFromProjectScan(entry.name)) continue;
      if (entry.isDirectory()) walk(path);
    }
  };
  walk(root);
  if (failure) return { kind: "unsearchable", ...(failure as { directory: string; detail: string }) };
  return { kind: "searched", nested: found.sort() };
}

export function loadRootDocument(root: string): DocumentOutcome {
  const file = join(root, DOCUMENT_NAME);
  if (!existsSync(file))
    return {
      kind: "rejected",
      rejection: rejectionForDocument(file, "file-absent", `no ${DOCUMENT_NAME} at the project root`),
    };
  let text: string;
  try {
    text = readFileSync(file, "utf8");
  } catch (error) {
    return {
      kind: "rejected",
      rejection: rejectionForDocument(file, "unreadable", error instanceof Error ? error.message : String(error)),
    };
  }
  let table: unknown;
  try {
    table = Bun.TOML.parse(text);
  } catch (error) {
    return {
      kind: "rejected",
      rejection: rejectionForDocument(file, "malformed-syntax", error instanceof Error ? error.message : String(error)),
    };
  }
  const search = nestedDocuments(root);
  if (search.kind === "unsearchable")
    return {
      kind: "rejected",
      rejection: rejectionForDocument(
        file,
        "unreadable",
        `cannot search ${search.directory} for nested ${DOCUMENT_NAME} documents: ${search.detail}`,
      ),
    };
  if (search.nested.length > 0)
    return {
      kind: "rejected",
      rejection: rejectionForNested(
        file,
        search.nested,
        `only the project-root ${DOCUMENT_NAME} configures this project; remove the listed documents`,
      ),
    };
  return { kind: "loaded", file, table: table as Record<string, unknown> };
}

export function readProjectSettings(root: string): ReadOutcome {
  const document = loadRootDocument(root);
  if (document.kind === "rejected") return { kind: "rejected", rejection: document.rejection };
  return validateProjectSettings(document.table, document.file);
}

export function renderDocument(selection: ProjectSelection): string {
  const lines = [
    `${VERSION_KEY} = ${SCHEMA_VERSION}`,
    `${LANGUAGES_KEY} = [${selection.languages.map((name) => `"${name}"`).join(", ")}]`,
  ];
  if (selection.rust) lines.push("", "[rust]", `module_layout = "${selection.rust.moduleLayout}"`);
  if (selection.typescript)
    lines.push(
      "",
      "[typescript]",
      `module_layout = "${selection.typescript.moduleLayout}"`,
      `code_representation = "${selection.typescript.codeRepresentation}"`,
    );
  return `${lines.join("\n")}\n`;
}

export function writeRootDocument(root: string, text: string): WriteOutcome {
  const file = join(root, DOCUMENT_NAME);
  // Renaming over a symbolic link replaces the link itself, silently detaching the file it names.
  if (existsSync(file) && lstatSync(file).isSymbolicLink())
    return { kind: "write-failed", detail: `${file} is a symbolic link; replace it with a regular file first` };
  // Anyone who can create entries beside the document could pre-place a symbolic link at a staging
  // path they can predict, and the write would follow it out of the project with our privileges. An
  // unguessable name plus an exclusive create removes both halves: the path cannot be aimed at, and
  // an entry that already exists fails the open instead of being written through.
  const staging = `${file}.${randomBytes(12).toString("hex")}.staging`;
  let created = false;
  try {
    writeFileSync(staging, text, { flag: "wx" });
    created = true;
    renameSync(staging, file);
    return { kind: "written" };
  } catch (error) {
    // Only the entry this call brought into existence is ours to remove; anything already at that
    // path belongs to whoever put it there, and deleting it would be the same overwrite by hand.
    if (created) rmSync(staging, { force: true });
    return { kind: "write-failed", detail: error instanceof Error ? error.message : String(error) };
  }
}
