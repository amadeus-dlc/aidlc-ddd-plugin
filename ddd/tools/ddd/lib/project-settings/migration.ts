/**
 * Reads the legacy Rust-only configuration as a migration source, builds a candidate that keeps its
 * meaning, and applies it only when the caller asks. Applying re-reads and re-validates, so an
 * earlier successful preview never authorises a later invalid input.
 */

import type {
  ProjectSelection,
  RustModuleLayout,
  SettingsRejection,
  TypeScriptCodeRepresentation,
  TypeScriptModuleLayout,
} from "./contract.ts";
import {
  entryOf,
  LEGACY_SCHEMA_VERSION,
  legacyRustModuleLayout,
  rejectionAtKey,
  rejectionForDocument,
  SCHEMA_VERSION,
  TYPESCRIPT_CODE_REPRESENTATIONS,
  TYPESCRIPT_MODULE_LAYOUTS,
  VERSION_KEY,
} from "./contract.ts";
import { loadRootDocument, renderDocument, writeRootDocument } from "./document.ts";
import { validateProjectSettings } from "./settings.ts";

/** The caller either asks for TypeScript and supplies its choices, or does not ask for it at all. */
export type TypeScriptSupplement =
  | { readonly kind: "not-requested" }
  | {
      readonly kind: "requested";
      readonly moduleLayout: string | null;
      readonly codeRepresentation: string | null;
    };

export type MigrationOutcome =
  | { readonly kind: "candidate"; readonly candidate: ProjectSelection }
  | { readonly kind: "missing-information"; readonly missing: readonly string[] }
  | { readonly kind: "rejected"; readonly rejection: SettingsRejection }
  | { readonly kind: "already-migrated"; readonly selection: ProjectSelection }
  | { readonly kind: "applied"; readonly selection: ProjectSelection }
  | { readonly kind: "write-failed"; readonly detail: string };

type Assessment = Exclude<MigrationOutcome, { kind: "applied" } | { kind: "write-failed" }>;

function candidateFor(layout: RustModuleLayout, supplement: TypeScriptSupplement, file: string): Assessment {
  if (supplement.kind === "not-requested")
    return { kind: "candidate", candidate: { languages: ["rust"], rust: { moduleLayout: layout }, typescript: null } };
  const missing: string[] = [];
  if (supplement.moduleLayout === null) missing.push("typescript.module_layout");
  if (supplement.codeRepresentation === null) missing.push("typescript.code_representation");
  if (missing.length > 0) return { kind: "missing-information", missing };
  const moduleLayout = supplement.moduleLayout as TypeScriptModuleLayout;
  const codeRepresentation = supplement.codeRepresentation as TypeScriptCodeRepresentation;
  if (!TYPESCRIPT_MODULE_LAYOUTS.includes(moduleLayout))
    return {
      kind: "rejected",
      rejection: rejectionAtKey(
        file,
        "unknown-key-or-value",
        "typescript.module_layout",
        `known methods are ${TYPESCRIPT_MODULE_LAYOUTS.join(", ")}`,
      ),
    };
  if (!TYPESCRIPT_CODE_REPRESENTATIONS.includes(codeRepresentation))
    return {
      kind: "rejected",
      rejection: rejectionAtKey(
        file,
        "unknown-key-or-value",
        "typescript.code_representation",
        `known methods are ${TYPESCRIPT_CODE_REPRESENTATIONS.join(", ")}`,
      ),
    };
  return {
    kind: "candidate",
    candidate: {
      languages: ["rust", "typescript"],
      rust: { moduleLayout: layout },
      typescript: { moduleLayout, codeRepresentation },
    },
  };
}

function assess(root: string, supplement: TypeScriptSupplement): Assessment {
  const document = loadRootDocument(root);
  if (document.kind === "rejected") return { kind: "rejected", rejection: document.rejection };
  const version = entryOf(document.table, VERSION_KEY);
  if (version === SCHEMA_VERSION) {
    const validated = validateProjectSettings(document.table, document.file);
    if (validated.kind === "rejected") return { kind: "rejected", rejection: validated.rejection };
    return { kind: "already-migrated", selection: validated.selection };
  }
  const layout = legacyRustModuleLayout(document.table);
  if (layout !== null) return candidateFor(layout, supplement, document.file);
  return {
    kind: "rejected",
    rejection: rejectionForDocument(
      document.file,
      "version-unknown",
      `this is not a migratable ${VERSION_KEY} = ${LEGACY_SCHEMA_VERSION} Rust configuration; repair it by hand`,
    ),
  };
}

export function previewMigration(root: string, supplement: TypeScriptSupplement): MigrationOutcome {
  return assess(root, supplement);
}

export function applyMigration(root: string, supplement: TypeScriptSupplement): MigrationOutcome {
  const assessment = assess(root, supplement);
  if (assessment.kind !== "candidate") return assessment;
  const written = writeRootDocument(root, renderDocument(assessment.candidate));
  if (written.kind === "write-failed") return { kind: "write-failed", detail: written.detail };
  return { kind: "applied", selection: assessment.candidate };
}
