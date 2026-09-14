/**
 * Owns the root settings document on disk: locating it, proving it is the only one inside the
 * searched tree, rendering it, and replacing it atomically. Holds no cached result, so a read
 * that follows an apply observes the file as it now stands.
 */

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

function nestedDocuments(root: string): string[] {
  const found: string[] = [];
  const walk = (directory: string): void => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.name === DOCUMENT_NAME && entry.isFile() && directory !== root) found.push(path);
      if (isExcludedFromProjectScan(entry.name)) continue;
      if (entry.isDirectory()) walk(path);
    }
  };
  walk(root);
  return found.sort();
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
  const nested = nestedDocuments(root);
  if (nested.length > 0)
    return {
      kind: "rejected",
      rejection: rejectionForNested(
        file,
        nested,
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
  const staging = `${file}.${process.pid}.staging`;
  try {
    writeFileSync(staging, text);
    renameSync(staging, file);
    return { kind: "written" };
  } catch (error) {
    // The staging path is ours by construction, so clearing it must not raise a second failure.
    rmSync(staging, { force: true, recursive: true });
    return { kind: "write-failed", detail: error instanceof Error ? error.message : String(error) };
  }
}
