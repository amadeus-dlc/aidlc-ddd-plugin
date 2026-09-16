/**
 * Operation-owned errors in the canonical model: which operation a DomainError belongs to,
 * and which documents each loader entry point accepts.
 *
 * Every case is a whole model document, because ownership is decided by the containing
 * command or factory rule and cannot be observed on a DomainError in isolation.
 */

import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { LoadResult } from "../tools/ddd/lib/schema/loader.ts";
import { loadDomainModel } from "../tools/ddd/lib/schema/loader.ts";
import { collectUnresolved } from "../tools/ddd/lib/sensors/common.ts";

type SchemaVersion = 1 | 2;

/** The key each format spells the owning operation with. */
const OWNER_KEY: Record<SchemaVersion, string> = { 1: "command", 2: "operation" };

const temporaryDirectories: string[] = [];
afterEach(() => {
  while (temporaryDirectories.length > 0) {
    rmSync(temporaryDirectories.pop() as string, { recursive: true, force: true });
  }
});

function writeModel(yaml: string): string {
  const directory = mkdtempSync(join(tmpdir(), "ddd-model-operations-"));
  temporaryDirectories.push(directory);
  const path = join(directory, "domain-model.yaml");
  writeFileSync(path, yaml);
  return path;
}

/** Omitting the version exercises the entry point the production sensors call. */
function load(yaml: string, version?: SchemaVersion): LoadResult {
  const path = writeModel(yaml);
  return version === undefined ? loadDomainModel(path) : loadDomainModel(path, version);
}

function rulesOf(result: LoadResult): string[] {
  if (result.ok) throw new Error("expected the load to be refused");
  return result.findings.map((entry) => entry.rule_id);
}

function errorEntry(version: SchemaVersion, id: string, owner: string, name: string): string {
  return `              - { element_id: ${id}, name: ${name}, ${OWNER_KEY[version]}: ${owner}, condition: "業務上の失敗条件" }`;
}

function commandEntry(id: string, name: string, errors: readonly string[]): string {
  return [
    `          - element_id: ${id}`,
    `            name: ${name}`,
    "            aggregate: aggregate.invoice",
    "            effect: transition",
    "            state_effect: none",
    "            domain_errors:",
    ...errors,
    "            idempotency: { strategy: none }",
  ].join("\n");
}

/** `undefined` omits the error set entirely; `[]` declares it empty. */
function factoryEntry(id: string, name: string, errors: readonly string[] | undefined): string {
  const head = [
    `          - element_id: ${id}`,
    `            name: ${name}`,
    "            target_element: entity.invoice",
    "            preconditions: [invariant.invoice.total-positive]",
  ];
  if (errors === undefined) return head.join("\n");
  if (errors.length === 0) return [...head, "            domain_errors: []"].join("\n");
  return [...head, "            domain_errors:", ...errors].join("\n");
}

interface ModelOptions {
  readonly version?: SchemaVersion;
  readonly commands?: readonly string[];
  readonly factories?: readonly string[];
  readonly lineage?: readonly string[];
}

function aggregateModel(options: ModelOptions): string {
  const lines = [
    `schema_version: ${options.version ?? 1}`,
    "bounded_contexts:",
    "  - element_id: bc.billing",
    "    name: Billing",
    "    aggregates:",
    "      - element_id: aggregate.invoice",
    "        name: Invoice",
    "        bounded_context: bc.billing",
    "        root_element: entity.invoice",
    "        elements:",
    "          - { element_id: entity.invoice, kind: entity, name: Invoice, aggregate: aggregate.invoice }",
    "        invariants:",
    "          - element_id: invariant.invoice.total-positive",
    "            name: TotalPositive",
    "            aggregate: aggregate.invoice",
    '            statement: "負であってはならない。"',
  ];
  if (options.commands?.length) lines.push("        commands:", ...options.commands);
  if (options.factories?.length) lines.push("        factory_rules:", ...options.factories);
  if (options.lineage?.length) lines.push("lineage:", ...options.lineage);
  else lines.push("lineage: []");
  return `${lines.join("\n")}\n`;
}

/**
 * Two commands on one aggregate. The second one exists only so a DomainError can name an
 * operation that resolves but does not contain it — the case a reference check alone passes.
 */
function twoCommands(version: SchemaVersion, issueErrorOwner: string): string {
  return aggregateModel({
    version,
    commands: [
      commandEntry("command.invoice.issue", "Issue", [
        errorEntry(version, "error.invoice.issue.already-issued", issueErrorOwner, "AlreadyIssued"),
      ]),
      commandEntry("command.invoice.cancel", "Cancel", [
        errorEntry(version, "error.invoice.cancel.already-cancelled", "command.invoice.cancel", "AlreadyCancelled"),
      ]),
    ],
  });
}

function commandAndFactory(factoryErrorOwner: string): string {
  return aggregateModel({
    version: 2,
    commands: [
      commandEntry("command.invoice.issue", "Issue", [
        errorEntry(2, "error.invoice.issue.already-issued", "command.invoice.issue", "AlreadyIssued"),
      ]),
    ],
    factories: [
      factoryEntry("factory.invoice.open", "Open", [
        errorEntry(2, "error.invoice.open.negative-amount", factoryErrorOwner, "NegativeAmount"),
      ]),
    ],
  });
}

describe("a DomainError declared under a command", () => {
  for (const version of [1, 2] as const) {
    test(`schema_version ${version} accepts one that names its containing command`, () => {
      expect(load(twoCommands(version, "command.invoice.issue"), version).ok).toBe(true);
    });

    test(`schema_version ${version} refuses one that names another command that exists`, () => {
      expect(rulesOf(load(twoCommands(version, "command.invoice.cancel"), version))).toContain(
        "schema.id-owner-mismatch",
      );
    });
  }

  test("the entry point the production sensors call refuses the mismatch too", () => {
    expect(rulesOf(load(twoCommands(1, "command.invoice.cancel")))).toContain("schema.id-owner-mismatch");
  });
});

describe("a DomainError declared under a factory rule", () => {
  test("is accepted when it names its containing factory rule", () => {
    expect(load(commandAndFactory("factory.invoice.open"), 2).ok).toBe(true);
  });

  test("is refused when it names a command instead of its containing factory rule", () => {
    expect(rulesOf(load(commandAndFactory("command.invoice.issue"), 2))).toContain("schema.id-owner-mismatch");
  });

  test("shares the error namespace with command errors and resolves from the index", () => {
    const result = load(commandAndFactory("factory.invoice.open"), 2);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.index.resolve("error.invoice.issue.already-issued", "error").ok).toBe(true);
    expect(result.index.resolve("error.invoice.open.negative-amount", "error").ok).toBe(true);
  });

  test("has its owner reference walked by the unresolved scan, which expects a factory rule", () => {
    const result = load(commandAndFactory("factory.invoice.open"), 2);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(collectUnresolved(result.model, result.index)).toEqual([]);

    // A command that exists resolves on its own, so only the expected kind can reject it.
    const model = structuredClone(result.model);
    model.bounded_contexts[0].aggregates[0].factory_rules[0].domain_errors[0].operation = "command.invoice.issue";
    expect(collectUnresolved(model, result.index)).toEqual([
      { id: "command.invoice.issue", reason: "kind-mismatch", expected: "factory" },
    ]);
  });

  test("is refused when one element_id is declared by both a command and a factory rule", () => {
    const yaml = aggregateModel({
      version: 2,
      commands: [
        commandEntry("command.invoice.open", "Open", [
          errorEntry(2, "error.invoice.open.invalid-amount", "command.invoice.open", "InvalidAmount"),
        ]),
      ],
      factories: [
        factoryEntry("factory.invoice.open", "Open", [
          errorEntry(2, "error.invoice.open.invalid-amount", "factory.invoice.open", "InvalidAmount"),
        ]),
      ],
    });
    expect(rulesOf(load(yaml, 2))).toContain("schema.id-duplicate");
  });
});

describe("operation id segments", () => {
  test("accept a factory rule whose id carries the containing aggregate name", () => {
    const yaml = aggregateModel({
      version: 2,
      factories: [
        factoryEntry("factory.invoice.open", "Open", [
          errorEntry(2, "error.invoice.open.negative-amount", "factory.invoice.open", "NegativeAmount"),
        ]),
      ],
    });
    expect(load(yaml, 2).ok).toBe(true);
  });

  test("refuse a factory rule whose id carries a different aggregate name", () => {
    // The error id keeps the containing aggregate's name, so only the factory rule's own id is wrong.
    const yaml = aggregateModel({
      version: 2,
      factories: [
        factoryEntry("factory.other.open", "Open", [
          errorEntry(2, "error.invoice.open.negative-amount", "factory.other.open", "NegativeAmount"),
        ]),
      ],
    });
    expect(rulesOf(load(yaml, 2))).toEqual(["schema.id-owner-mismatch"]);
  });

  test("refuse a factory DomainError whose id names a different aggregate", () => {
    const yaml = aggregateModel({
      version: 2,
      factories: [
        factoryEntry("factory.invoice.open", "Open", [
          errorEntry(2, "error.other.open.negative-amount", "factory.invoice.open", "NegativeAmount"),
        ]),
      ],
    });
    expect(rulesOf(load(yaml, 2))).toEqual(["schema.id-owner-mismatch"]);
  });

  test("refuse a factory DomainError whose id names a different operation", () => {
    const yaml = aggregateModel({
      version: 2,
      factories: [
        factoryEntry("factory.invoice.open", "Open", [
          errorEntry(2, "error.invoice.issue.negative-amount", "factory.invoice.open", "NegativeAmount"),
        ]),
      ],
    });
    expect(rulesOf(load(yaml, 2))).toContain("schema.id-owner-mismatch");
  });
});

describe("a broken ownership reference", () => {
  test("is refused when it resolves to nothing", () => {
    const yaml = aggregateModel({
      version: 2,
      commands: [
        commandEntry("command.invoice.issue", "Issue", [
          errorEntry(2, "error.invoice.issue.already-issued", "command.invoice.absent", "AlreadyIssued"),
        ]),
      ],
    });
    expect(rulesOf(load(yaml, 2))).toContain("schema.ref-undefined");
  });

  test("is refused when it points at a retired id", () => {
    const yaml = aggregateModel({
      version: 2,
      commands: [
        commandEntry("command.invoice.issue", "Issue", [
          errorEntry(2, "error.invoice.issue.already-issued", "command.invoice.cancel", "AlreadyIssued"),
        ]),
      ],
      lineage: [
        "  - lineage_id: lineage-0001",
        "    element_id: command.invoice.cancel",
        "    relation: deprecated",
        '    deprecated_at: "2026-01-01"',
        "    successors: []",
      ],
    });
    expect(rulesOf(load(yaml, 2))).toContain("schema.ref-deprecated");
  });

  test("is refused when it is not a well-formed element id", () => {
    const yaml = aggregateModel({
      version: 2,
      commands: [
        commandEntry("command.invoice.issue", "Issue", [
          errorEntry(2, "error.invoice.issue.already-issued", "Command.Invoice", "AlreadyIssued"),
        ]),
      ],
    });
    expect(rulesOf(load(yaml, 2))).toContain("schema.ref-undefined");
  });

  test("is refused when a factory DomainError breaks the id grammar", () => {
    const yaml = aggregateModel({
      version: 2,
      factories: [
        factoryEntry("factory.invoice.open", "Open", [
          errorEntry(2, "Error.Invoice.Open.NegativeAmount", "factory.invoice.open", "NegativeAmount"),
        ]),
      ],
    });
    expect(rulesOf(load(yaml, 2))).toContain("schema.id-grammar");
  });
});

describe("a factory rule in the new format", () => {
  test("is refused when it declares no error set at all", () => {
    const yaml = aggregateModel({ version: 2, factories: [factoryEntry("factory.invoice.open", "Open", undefined)] });
    expect(rulesOf(load(yaml, 2))).toContain("schema.factory-no-error");
  });

  test("is refused when it declares an empty error set", () => {
    const yaml = aggregateModel({ version: 2, factories: [factoryEntry("factory.invoice.open", "Open", [])] });
    expect(rulesOf(load(yaml, 2))).toContain("schema.factory-no-error");
  });
});

describe("the legacy format is not widened", () => {
  test("a legacy factory rule still loads without an error set and normalises to none", () => {
    const result = load(aggregateModel({ factories: [factoryEntry("factory.invoice.open", "Open", undefined)] }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.model.bounded_contexts[0].aggregates[0].factory_rules[0].domain_errors).toEqual([]);
  });

  test("a legacy factory rule that declares an error set is refused as an unknown key", () => {
    const yaml = aggregateModel({
      factories: [
        factoryEntry("factory.invoice.open", "Open", [
          errorEntry(1, "error.invoice.open.negative-amount", "factory.invoice.open", "NegativeAmount"),
        ]),
      ],
    });
    expect(rulesOf(load(yaml))).toContain("schema.unknown-key");
  });

  test("a legacy DomainError may not use the new ownership key", () => {
    const yaml = aggregateModel({
      version: 1,
      commands: [
        commandEntry("command.invoice.issue", "Issue", [
          errorEntry(2, "error.invoice.issue.already-issued", "command.invoice.issue", "AlreadyIssued"),
        ]),
      ],
    });
    expect(rulesOf(load(yaml))).toContain("schema.unknown-key");
  });

  test("a new-format DomainError may not use the legacy ownership key", () => {
    const yaml = aggregateModel({
      version: 2,
      commands: [
        commandEntry("command.invoice.issue", "Issue", [
          errorEntry(1, "error.invoice.issue.already-issued", "command.invoice.issue", "AlreadyIssued"),
        ]),
      ],
    });
    expect(rulesOf(load(yaml, 2))).toContain("schema.unknown-key");
  });
});

describe("the two entry points stay separate", () => {
  test("the default one reads a legacy document and refuses a new-format one", () => {
    expect(load(twoCommands(1, "command.invoice.issue")).ok).toBe(true);
    expect(load(twoCommands(2, "command.invoice.issue")).ok).toBe(false);
  });

  test("the new-format one reads a new-format document and refuses a legacy one", () => {
    expect(load(twoCommands(2, "command.invoice.issue"), 2).ok).toBe(true);
    expect(load(twoCommands(1, "command.invoice.issue"), 2).ok).toBe(false);
  });
});
