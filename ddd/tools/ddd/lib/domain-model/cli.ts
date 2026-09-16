/**
 * The migration command, kept free of process globals so every branch is reachable from a test.
 * The JSON report names the outcome, so callers never have to read the exit status alone.
 */

import { applyModelMigration, type ModelMigrationOutcome, previewModelMigration } from "./migration.ts";

export interface CommandResult {
  readonly exitCode: number;
  readonly stdout: string;
}

interface MigrateRequest {
  readonly model: string;
  readonly apply: boolean;
}

type ParsedArguments =
  | { readonly kind: "migrate"; readonly request: MigrateRequest }
  | { readonly kind: "invalid-arguments"; readonly detail: string };

const VALUE_OPTIONS: readonly string[] = ["--model"];
const USAGE = "usage: ddd-domain-model migrate --model <path to ddd-domain-model-yaml.md> [--apply]";

function parseArguments(argv: readonly string[]): ParsedArguments {
  if (argv[0] !== "migrate") return { kind: "invalid-arguments", detail: `unknown command; ${USAGE}` };
  let model: string | null = null;
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
    // No value this command accepts is spelled like an option, so an option-shaped token is a
    // missing value and not the value itself. Consuming it would drop the option it names:
    // swallowing `--apply` leaves a preview, which writes nothing and still exits 0.
    if (value === undefined || value.startsWith("--"))
      return { kind: "invalid-arguments", detail: `${option} needs a value; ${USAGE}` };
    index++;
    model = value;
  }
  if (model === null) return { kind: "invalid-arguments", detail: `--model is required; ${USAGE}` };
  return { kind: "migrate", request: { model, apply } };
}

function report(outcome: ModelMigrationOutcome): Record<string, unknown> {
  switch (outcome.kind) {
    case "candidate":
    case "already-migrated":
    case "applied":
      return { outcome: outcome.kind, model: outcome.model };
    case "missing-information":
      return { outcome: outcome.kind, missing: outcome.missing };
    case "rejected":
      return { outcome: outcome.kind, findings: outcome.findings };
    case "write-failed":
      return { outcome: outcome.kind, detail: outcome.detail };
  }
}

function exitCode(outcome: ModelMigrationOutcome, apply: boolean): number {
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

export function runDomainModelCommand(argv: readonly string[]): CommandResult {
  const parsed = parseArguments(argv);
  if (parsed.kind === "invalid-arguments")
    return { exitCode: 2, stdout: JSON.stringify({ outcome: parsed.kind, detail: parsed.detail }) };
  const { model, apply } = parsed.request;
  const outcome = apply ? applyModelMigration(model) : previewModelMigration(model);
  return { exitCode: exitCode(outcome, apply), stdout: JSON.stringify(report(outcome)) };
}
