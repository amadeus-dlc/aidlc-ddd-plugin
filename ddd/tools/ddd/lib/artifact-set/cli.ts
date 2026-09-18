/**
 * The set migration command, kept free of process globals so every branch is reachable from a test.
 * The JSON report names the outcome, so callers never have to read the exit status alone.
 */

import { migrateArtifactSet, type SetRequest, type SetResult } from "./migration.ts";

export interface CommandResult {
  readonly exitCode: number;
  readonly stdout: string;
}

type ParsedArguments =
  | { readonly kind: "migrate"; readonly request: SetRequest }
  | { readonly kind: "invalid-arguments"; readonly detail: string };

const PROJECT = "--project";
const RECORD = "--record";
const SUPPLEMENT = "--supplement";
const VALUE_OPTIONS: readonly string[] = [PROJECT, RECORD, SUPPLEMENT];
const USAGE = `usage: ddd-artifact-set migrate ${PROJECT} <project root> ${RECORD} <intent record> [${SUPPLEMENT} <path to a mapping supplement YAML file>] [--apply]`;

function parseArguments(argv: readonly string[]): ParsedArguments {
  if (argv[0] !== "migrate") return { kind: "invalid-arguments", detail: `unknown command; ${USAGE}` };
  const given = new Map<string, string>();
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
    // Two paths leave the command line as the only record of which set was meant, and taking either
    // one would let a slip convert artifacts nobody asked to change.
    if (given.has(option)) return { kind: "invalid-arguments", detail: `${option} may be given only once; ${USAGE}` };
    given.set(option, value);
  }
  const project = given.get(PROJECT);
  const record = given.get(RECORD);
  if (project === undefined) return { kind: "invalid-arguments", detail: `${PROJECT} is required; ${USAGE}` };
  if (record === undefined) return { kind: "invalid-arguments", detail: `${RECORD} is required; ${USAGE}` };
  return { kind: "migrate", request: { project, record, supplement: given.get(SUPPLEMENT) ?? null, apply } };
}

function exitCode(result: SetResult, apply: boolean): number {
  switch (result.outcome) {
    case "candidate":
    case "already-migrated":
    case "applied":
      return 0;
    // A preview that names what is still missing did its job; an apply that names it did not.
    case "missing-information":
      return apply ? 1 : 0;
    case "rejected":
      return 1;
    case "write-failed":
      return 3;
  }
}

export function runArtifactSetCommand(argv: readonly string[]): CommandResult {
  const parsed = parseArguments(argv);
  if (parsed.kind === "invalid-arguments")
    return { exitCode: 2, stdout: JSON.stringify({ outcome: parsed.kind, detail: parsed.detail }) };
  const result = migrateArtifactSet(parsed.request);
  return { exitCode: exitCode(result, parsed.request.apply), stdout: JSON.stringify(result) };
}
