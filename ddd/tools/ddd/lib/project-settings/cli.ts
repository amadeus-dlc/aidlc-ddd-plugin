/**
 * The migration command, kept free of process globals so every branch is reachable from a test.
 * The JSON report names the outcome, so callers never have to read the exit status alone.
 */

import type { MigrationOutcome, TypeScriptSupplement } from "./migration.ts";
import { applyMigration, previewMigration } from "./migration.ts";

export interface CommandResult {
  readonly exitCode: number;
  readonly stdout: string;
}

interface MigrateRequest {
  readonly root: string;
  readonly supplement: TypeScriptSupplement;
  readonly apply: boolean;
}

type ParsedArguments =
  | { readonly kind: "migrate"; readonly request: MigrateRequest }
  | { readonly kind: "invalid-arguments"; readonly detail: string };

const VALUE_OPTIONS: readonly string[] = ["--project", "--typescript-layout", "--typescript-representation"];
const USAGE =
  "usage: ddd-project-settings migrate --project <project-root> [--typescript-layout <named-file|index-file>] [--typescript-representation <class|companion>] [--apply]";

function parseArguments(argv: readonly string[]): ParsedArguments {
  if (argv[0] !== "migrate") return { kind: "invalid-arguments", detail: `unknown command; ${USAGE}` };
  let root: string | null = null;
  let moduleLayout: string | null = null;
  let codeRepresentation: string | null = null;
  let typeScriptRequested = false;
  let apply = false;
  for (let index = 1; index < argv.length; index++) {
    const option = argv[index];
    if (option === "--apply") {
      apply = true;
      continue;
    }
    if (!VALUE_OPTIONS.includes(option))
      return { kind: "invalid-arguments", detail: `unknown option ${option}; ${USAGE}` };
    const value = argv[index + 1];
    // No choice this command accepts is spelled like an option, so an option-shaped token is a
    // missing value and not the value itself. Consuming it would drop the option it names: swallowing
    // `--apply` leaves the request in preview, where nothing is written and nothing reports a refusal.
    if (value === undefined || value.startsWith("--"))
      return { kind: "invalid-arguments", detail: `${option} needs a value; ${USAGE}` };
    index++;
    if (option === "--project") root = value;
    if (option === "--typescript-layout") {
      moduleLayout = value;
      typeScriptRequested = true;
    }
    if (option === "--typescript-representation") {
      codeRepresentation = value;
      typeScriptRequested = true;
    }
  }
  if (root === null) return { kind: "invalid-arguments", detail: `--project is required; ${USAGE}` };
  return {
    kind: "migrate",
    request: {
      root,
      apply,
      supplement: typeScriptRequested
        ? { kind: "requested", moduleLayout, codeRepresentation }
        : { kind: "not-requested" },
    },
  };
}

function report(outcome: MigrationOutcome): Record<string, unknown> {
  switch (outcome.kind) {
    case "candidate":
      return { outcome: outcome.kind, selection: outcome.candidate };
    case "applied":
    case "already-migrated":
      return { outcome: outcome.kind, selection: outcome.selection };
    case "missing-information":
      return { outcome: outcome.kind, missing: outcome.missing };
    case "rejected":
      return { outcome: outcome.kind, ...outcome.rejection };
    case "write-failed":
      return { outcome: outcome.kind, detail: outcome.detail };
  }
}

function exitCode(outcome: MigrationOutcome, apply: boolean): number {
  switch (outcome.kind) {
    case "candidate":
    case "applied":
    case "already-migrated":
      return 0;
    case "missing-information":
      return apply ? 1 : 0;
    case "rejected":
      return 1;
    case "write-failed":
      return 3;
  }
}

export function runProjectSettingsCommand(argv: readonly string[]): CommandResult {
  const parsed = parseArguments(argv);
  if (parsed.kind === "invalid-arguments")
    return { exitCode: 2, stdout: JSON.stringify({ outcome: parsed.kind, detail: parsed.detail }) };
  const { root, supplement, apply } = parsed.request;
  const outcome = apply ? applyMigration(root, supplement) : previewMigration(root, supplement);
  return { exitCode: exitCode(outcome, apply), stdout: JSON.stringify(report(outcome)) };
}
