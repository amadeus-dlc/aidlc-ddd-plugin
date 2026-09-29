/**
 * One command, at most one event: a command names the event it produces with `event`, that
 * event names the command back with `produced_by`, and no command is the producer of two events.
 *
 * Every case is a whole model document, because the rules relate a command to the events of its
 * aggregate — and, for the producer count, to every event in the model.
 */

import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { LoadResult } from "../tools/ddd/lib/schema/loader.ts";
import { loadDomainModel } from "../tools/ddd/lib/schema/loader.ts";

type SchemaVersion = 1 | 2;

/** The key each format spells the owning operation of a DomainError with. */
const OWNER_KEY: Record<SchemaVersion, string> = { 1: "command", 2: "operation" };

const temporaryDirectories: string[] = [];
afterEach(() => {
  while (temporaryDirectories.length > 0) {
    rmSync(temporaryDirectories.pop() as string, { recursive: true, force: true });
  }
});

function load(yaml: string, version: SchemaVersion): LoadResult {
  const directory = mkdtempSync(join(tmpdir(), "ddd-command-event-"));
  temporaryDirectories.push(directory);
  const path = join(directory, "domain-model.yaml");
  writeFileSync(path, yaml);
  return loadDomainModel(path, version);
}

function findingsOf(result: LoadResult): { rule_id: string; message: string }[] {
  if (result.ok) throw new Error("expected the load to be refused");
  return result.findings.map((entry) => ({ rule_id: entry.rule_id, message: entry.message }));
}

function rulesOf(result: LoadResult): string[] {
  return findingsOf(result).map((entry) => entry.rule_id);
}

/**
 * A command of aggregate.invoice. `eventLines` is spliced in verbatim between the error set and
 * the idempotency policy, so a case can write the new key, the retired key, or nothing at all.
 */
function command(version: SchemaVersion, verb: string, eventLines: readonly string[]): string[] {
  return [
    `          - element_id: command.invoice.${verb}`,
    `            name: ${verb}`,
    "            aggregate: aggregate.invoice",
    "            effect: transition",
    "            state_effect: none",
    "            domain_errors:",
    `              - { element_id: error.invoice.${verb}.rejected, name: Rejected, ${OWNER_KEY[version]}: command.invoice.${verb}, condition: "業務上の失敗条件" }`,
    ...eventLines,
    "            idempotency: { strategy: none }",
  ];
}

function event(aggregate: string, name: string, producedBy: string): string {
  return `          - { element_id: event.${aggregate}.${name}, name: ${name}, aggregate: aggregate.${aggregate}, produced_by: ${producedBy} }`;
}

interface AggregateSpec {
  readonly commands: readonly string[][];
  readonly events: readonly string[];
}

function aggregate(name: string, spec: AggregateSpec): string[] {
  const lines = [
    `      - element_id: aggregate.${name}`,
    `        name: ${name}`,
    "        bounded_context: bc.billing",
    `        root_element: entity.${name}`,
    "        elements:",
    `          - { element_id: entity.${name}, kind: entity, name: ${name}, aggregate: aggregate.${name} }`,
    "        invariants:",
    `          - { element_id: invariant.${name}.consistent, name: Consistent, aggregate: aggregate.${name}, statement: "整合している。" }`,
  ];
  if (spec.commands.length > 0) lines.push("        commands:", ...spec.commands.flat());
  if (spec.events.length > 0) lines.push("        events:", ...spec.events);
  return lines;
}

function model(version: SchemaVersion, ...aggregates: string[][]): string {
  return `${[
    `schema_version: ${version}`,
    "bounded_contexts:",
    "  - element_id: bc.billing",
    "    name: Billing",
    "    aggregates:",
    ...aggregates.flat(),
    "lineage: []",
  ].join("\n")}\n`;
}

/** Issue produces `issued`; cancel produces nothing. */
function invoiceModel(version: SchemaVersion, issueEventLines: readonly string[], events?: readonly string[]): string {
  return model(
    version,
    aggregate("invoice", {
      commands: [command(version, "issue", issueEventLines), command(version, "cancel", [])],
      events: events ?? [event("invoice", "issued", "command.invoice.issue")],
    }),
  );
}

const VERSIONS = [1, 2] as const;

describe("a command that names the event it produces", () => {
  for (const version of VERSIONS) {
    test(`schema_version ${version} loads it and keeps the one event id on the command`, () => {
      const result = load(invoiceModel(version, ["            event: event.invoice.issued"]), version);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      const [issue, cancel] = result.model.bounded_contexts[0].aggregates[0].commands;
      expect(issue.event).toBe("event.invoice.issued");
      expect(cancel.event).toBeUndefined();
    });
  }

  test("a command that changes no state loads without an event", () => {
    const result = load(invoiceModel(2, [], []), 2);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.model.bounded_contexts[0].aggregates[0].commands.map((entry) => entry.event)).toEqual([
      undefined,
      undefined,
    ]);
  });

  test("an event on the aggregate loads without `event` on its producing command", () => {
    // `event` on the command is optional: the aggregate's event list alone keeps its meaning.
    const result = load(invoiceModel(2, []), 2);
    expect(result.ok).toBe(true);
  });
});

describe("the retired list of events on a command", () => {
  const RETIRED_FORMS: readonly (readonly [string, readonly string[]])[] = [
    ["a flow list", ["            events: [event.invoice.issued]"]],
    ["a block list", ["            events:", "              - event.invoice.issued"]],
    ["an empty list", ["            events: []"]],
  ];

  for (const version of VERSIONS)
    for (const [label, lines] of RETIRED_FORMS) {
      test(`schema_version ${version} refuses ${label} as the retired key`, () => {
        expect(rulesOf(load(invoiceModel(version, lines), version))).toContain("schema.command-events");
      });
    }

  test("the refusal points the author at the single `event` key", () => {
    const findings = findingsOf(load(invoiceModel(2, ["            events: []"]), 2));
    const retired = findings.filter((entry) => entry.rule_id === "schema.command-events");
    expect(retired).toHaveLength(1);
    expect(retired[0].message).toContain("command.invoice.issue");
    expect(retired[0].message).toMatch(/`event:/);
  });

  test("the retired key is reported once, not also as an unknown key", () => {
    expect(rulesOf(load(invoiceModel(2, ["            events: [event.invoice.issued]"]), 2))).not.toContain(
      "schema.unknown-key",
    );
  });

  test("the event list directly under an aggregate is not the retired key", () => {
    const result = load(invoiceModel(2, ["            event: event.invoice.issued"]), 2);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.model.bounded_contexts[0].aggregates[0].events.map((entry) => entry.element_id)).toEqual([
      "event.invoice.issued",
    ]);
  });
});

describe("the shape of `event`", () => {
  test("a list under the new key is a structure error, not the retired key", () => {
    const rules = rulesOf(load(invoiceModel(2, ["            event: [event.invoice.issued]"]), 2));
    expect(rules).toContain("schema.structure");
    expect(rules).not.toContain("schema.command-events");
  });

  test("an empty string is a structure error", () => {
    const rules = rulesOf(load(invoiceModel(2, ['            event: ""']), 2));
    expect(rules).toContain("schema.structure");
    expect(rules).not.toContain("schema.command-events");
  });
});

describe("the event a command names", () => {
  test("is refused when it is not on the command's aggregate", () => {
    // The event names this command back, so only its place in the model is wrong.
    const yaml = model(
      2,
      aggregate("invoice", {
        commands: [command(2, "issue", ["            event: event.receipt.issued"])],
        events: [],
      }),
      aggregate("receipt", { commands: [], events: [event("receipt", "issued", "command.invoice.issue")] }),
    );
    expect(rulesOf(load(yaml, 2))).toContain("schema.event-link");
  });

  test("is refused when its produced_by names another command of the same aggregate", () => {
    const yaml = invoiceModel(
      2,
      ["            event: event.invoice.issued"],
      [event("invoice", "issued", "command.invoice.cancel")],
    );
    expect(rulesOf(load(yaml, 2))).toContain("schema.event-producer");
  });

  test("is accepted when its produced_by names this command", () => {
    expect(load(invoiceModel(2, ["            event: event.invoice.issued"]), 2).ok).toBe(true);
  });
});

describe("one command as the producer of two events", () => {
  for (const version of VERSIONS) {
    test(`schema_version ${version} refuses two events on one aggregate naming the same command`, () => {
      const yaml = invoiceModel(
        version,
        [],
        [event("invoice", "issued", "command.invoice.issue"), event("invoice", "sent", "command.invoice.issue")],
      );
      expect(rulesOf(load(yaml, version))).toContain("schema.event-producer");
    });
  }

  test("refuses it even when the command names one of the two with `event`", () => {
    const yaml = invoiceModel(
      2,
      ["            event: event.invoice.issued"],
      [event("invoice", "issued", "command.invoice.issue"), event("invoice", "sent", "command.invoice.issue")],
    );
    expect(rulesOf(load(yaml, 2))).toContain("schema.event-producer");
  });

  test("refuses two events on different aggregates naming the same command", () => {
    const yaml = model(
      2,
      aggregate("invoice", {
        commands: [command(2, "issue", [])],
        events: [event("invoice", "issued", "command.invoice.issue")],
      }),
      aggregate("receipt", { commands: [], events: [event("receipt", "issued", "command.invoice.issue")] }),
    );
    expect(rulesOf(load(yaml, 2))).toContain("schema.event-producer");
  });

  test("accepts two events produced by two different commands", () => {
    const yaml = model(
      2,
      aggregate("invoice", {
        commands: [
          command(2, "issue", ["            event: event.invoice.issued"]),
          command(2, "cancel", ["            event: event.invoice.cancelled"]),
        ],
        events: [
          event("invoice", "issued", "command.invoice.issue"),
          event("invoice", "cancelled", "command.invoice.cancel"),
        ],
      }),
    );
    expect(load(yaml, 2).ok).toBe(true);
  });
});

describe("the JSON Schema documents of the model", () => {
  const SCHEMA_DIR = join(import.meta.dir, "../tools/ddd/lib/schema");

  for (const file of ["domain-model.schema.json", "domain-model-v2.schema.json"]) {
    test(`${file} gives a command one optional event id and no event list`, () => {
      const schema = JSON.parse(readFileSync(join(SCHEMA_DIR, file), "utf8")) as {
        $defs: {
          command: { additionalProperties: boolean; required: string[]; properties: Record<string, unknown> };
        };
      };
      const commandSchema = schema.$defs.command;
      expect(commandSchema.additionalProperties).toBe(false);
      expect(commandSchema.properties.event).toMatchObject({ $ref: "#/$defs/elementId" });
      expect(Object.keys(commandSchema.properties)).not.toContain("events");
      expect(commandSchema.required).not.toContain("event");
    });
  }
});
