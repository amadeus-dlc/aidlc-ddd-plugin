/**
 * The migration command, kept free of process globals so every branch is reachable from a test.
 * The JSON report names the outcome, so callers never have to read the exit status alone.
 */

import { applyMappingMigration, type MappingMigrationOutcome, previewMappingMigration } from "./migration.ts";

export interface CommandResult {
  readonly exitCode: number;
  readonly stdout: string;
}

interface MigrateRequest {
  readonly mapping: string;
  readonly supplement: string | null;
  readonly apply: boolean;
}

type ParsedArguments =
  | { readonly kind: "migrate"; readonly request: MigrateRequest }
  | { readonly kind: "invalid-arguments"; readonly detail: string };

const VALUE_OPTIONS: readonly string[] = ["--mapping", "--supplement"];
const USAGE =
  "usage: ddd-aggregate-mapping migrate --mapping <path to ddd-aggregate-mapping.md> [--supplement <path to a supplement YAML file>] [--apply]";

function parseArguments(argv: readonly string[]): ParsedArguments {
  if (argv[0] !== "migrate") return { kind: "invalid-arguments", detail: `unknown command; ${USAGE}` };
  let mapping: string | null = null;
  let supplement: string | null = null;
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
    // No path this command accepts is spelled like an option, so an option-shaped token is a
    // missing value and not the value itself. Consuming it would drop the option it names:
    // swallowing `--apply` leaves a preview, which writes nothing.
    if (value === undefined || value.startsWith("--"))
      return { kind: "invalid-arguments", detail: `${option} needs a value; ${USAGE}` };
    index++;
    if (option === "--mapping") mapping = value;
    else supplement = value;
  }
  if (mapping === null) return { kind: "invalid-arguments", detail: `--mapping is required; ${USAGE}` };
  return { kind: "migrate", request: { mapping, supplement, apply } };
}

function report(outcome: MappingMigrationOutcome): Record<string, unknown> {
  switch (outcome.kind) {
    case "candidate":
    case "already-migrated":
    case "applied":
      return { outcome: outcome.kind, mapping: outcome.mapping };
    case "missing-information":
      return { outcome: outcome.kind, missing: outcome.missing };
    case "rejected":
      return { outcome: outcome.kind, findings: outcome.findings };
    case "write-failed":
      return { outcome: outcome.kind, detail: outcome.detail };
  }
}

function exitCode(outcome: MappingMigrationOutcome, apply: boolean): number {
  switch (outcome.kind) {
    case "candidate":
    case "already-migrated":
    case "applied":
      return 0;
    case "missing-information":
      return apply ? 1 : 0;
    case "rejected":
      return 1;
    case "write-failed":
      return 3;
  }
}

export function runAggregateMappingCommand(argv: readonly string[]): CommandResult {
  const parsed = parseArguments(argv);
  if (parsed.kind === "invalid-arguments")
    return { exitCode: 2, stdout: JSON.stringify({ outcome: parsed.kind, detail: parsed.detail }) };
  const { mapping, supplement, apply } = parsed.request;
  const outcome = apply ? applyMappingMigration(mapping, supplement) : previewMappingMigration(mapping, supplement);
  return { exitCode: exitCode(outcome, apply), stdout: JSON.stringify(report(outcome)) };
}
