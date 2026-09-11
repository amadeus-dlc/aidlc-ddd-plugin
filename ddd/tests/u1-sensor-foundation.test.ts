import { afterEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readSourceClaims, readStageStatus, resolveContext } from "../tools/ddd/lib/runtime/context.ts";
import { runSensor, type SensorIO } from "../tools/ddd/lib/runtime/runtime.ts";
import { checkCompleteness } from "../tools/ddd/lib/schema/completeness.ts";
import { parseElementId } from "../tools/ddd/lib/schema/element-id.ts";
import { loadDomainModel } from "../tools/ddd/lib/schema/loader.ts";
import { assembleFindings } from "../tools/ddd/lib/shared/findings.ts";

const here = import.meta.dir;
const fixture = (name: string) => join(here, "fixtures/u1", name);

const tempDirs: string[] = [];
function makeTemp(): string {
  const dir = mkdtempSync(join(tmpdir(), "ddd-u1-"));
  tempDirs.push(dir);
  return dir;
}
afterEach(() => {
  while (tempDirs.length > 0) rmSync(tempDirs.pop() as string, { recursive: true, force: true });
});

function writeModel(yaml: string): string {
  const dir = makeTemp();
  const path = join(dir, "domain-model.yaml");
  writeFileSync(path, yaml);
  return path;
}

function rules(findings: { rule_id: string }[]): string[] {
  return findings.map((f) => f.rule_id);
}

describe("parseElementId", () => {
  test("accepts a well-formed id and derives kind and segments", () => {
    const parsed = parseElementId("command.invoice.issue");
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.id.kind).toBe("command");
      expect(parsed.id.segments).toEqual(["invoice", "issue"]);
    }
  });

  test("rejects a grammar violation", () => {
    const parsed = parseElementId("Command.Invoice");
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) expect(parsed.rule_id).toBe("schema.id-grammar");
  });

  test("rejects a segment-arity violation", () => {
    const parsed = parseElementId("error.invoice.issue");
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) expect(parsed.rule_id).toBe("schema.id-arity");
  });
});

describe("loadDomainModel", () => {
  test("loads the valid fixture and exposes the index", () => {
    const result = loadDomainModel(fixture("valid.yaml"));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.index.resolve("entity.invoice").ok).toBe(true);
    expect(result.index.resolve("entity.invoice", "entity").ok).toBe(true);
    expect(result.index.resolve("entity.invoice", "command").ok).toBe(false);
    expect(result.index.commandsOf("aggregate.invoice")).toHaveLength(1);
    expect(result.model.bounded_contexts[0].aggregates[0].process_managers).toEqual([]);
    expect(checkCompleteness(result.model)).toEqual([]);
  });

  test("rejects an unknown key (BR3.9)", () => {
    const path = writeModel(`schema_version: 1\ncrates: []\nbounded_contexts: []\n`);
    const result = loadDomainModel(path);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(rules(result.findings)).toContain("schema.unknown-key");
  });

  test("rejects a wrong schema_version", () => {
    const path = writeModel(`schema_version: 2\nbounded_contexts: []\n`);
    const result = loadDomainModel(path);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(rules(result.findings)).toContain("schema.structure");
  });

  test("rejects a malformed element_id", () => {
    const path = writeModel(
      `schema_version: 1\nbounded_contexts:\n  - element_id: Billing\n    name: B\n    aggregates: []\n`,
    );
    const result = loadDomainModel(path);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(rules(result.findings)).toContain("schema.id-grammar");
  });

  test("detects a duplicate element_id", () => {
    const yaml = `schema_version: 1
bounded_contexts:
  - element_id: bc.billing
    name: Billing
    aggregates:
      - element_id: aggregate.invoice
        name: Invoice
        bounded_context: bc.billing
        root_element: entity.invoice
        elements:
          - { element_id: entity.invoice, kind: entity, name: Invoice, aggregate: aggregate.invoice }
          - { element_id: entity.invoice, kind: entity, name: Invoice, aggregate: aggregate.invoice }
`;
    const result = loadDomainModel(writeModel(yaml));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(rules(result.findings)).toContain("schema.id-duplicate");
  });

  test("requires at least one DomainError per Command (BR3.4)", () => {
    const yaml = `schema_version: 1
bounded_contexts:
  - element_id: bc.billing
    name: Billing
    aggregates:
      - element_id: aggregate.invoice
        name: Invoice
        bounded_context: bc.billing
        root_element: entity.invoice
        elements:
          - { element_id: entity.invoice, kind: entity, name: Invoice, aggregate: aggregate.invoice }
        commands:
          - element_id: command.invoice.issue
            name: Issue
            aggregate: aggregate.invoice
            effect: transition
            state_effect: transitions
            domain_errors: []
            idempotency: { strategy: none }
`;
    const result = loadDomainModel(writeModel(yaml));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(rules(result.findings)).toContain("schema.command-no-error");
  });

  test("reports a zero-invariant aggregate through completeness, not the load", () => {
    const yaml = `schema_version: 1
bounded_contexts:
  - element_id: bc.billing
    name: Billing
    aggregates:
      - element_id: aggregate.invoice
        name: Invoice
        bounded_context: bc.billing
        root_element: entity.invoice
        elements:
          - { element_id: entity.invoice, kind: entity, name: Invoice, aggregate: aggregate.invoice }
`;
    const result = loadDomainModel(writeModel(yaml));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(rules(checkCompleteness(result.model))).toContain("completeness.i");
  });

  test("detects an unknown reference", () => {
    const yaml = `schema_version: 1
bounded_contexts:
  - element_id: bc.billing
    name: Billing
    aggregates:
      - element_id: aggregate.invoice
        name: Invoice
        bounded_context: bc.other
        root_element: entity.missing
        elements:
          - { element_id: entity.invoice, kind: entity, name: Invoice, aggregate: aggregate.invoice }
`;
    const result = loadDomainModel(writeModel(yaml));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(rules(result.findings)).toContain("schema.ref-undefined");
      expect(rules(result.findings)).toContain("schema.id-owner-mismatch");
    }
  });
});

describe("findings assembly", () => {
  test("sorts by (file, line, rule_id) and numbers finding_id", () => {
    const assembled = assembleFindings("s", "blocking", [
      { rule_id: "b", file: "z.md", message: "second" },
      { rule_id: "a", file: "a.md", line: 10, message: "first" },
      { rule_id: "a", file: "a.md", line: 2, message: "zeroth" },
    ]);
    expect(assembled.map((f) => f.finding_id)).toEqual(["s:a:1", "s:a:2", "s:b:3"]);
    expect(assembled[0].message).toBe("zeroth");
    expect(assembled.every((f) => f.severity === "blocking")).toBe(true);
  });
});

describe("sensor runtime", () => {
  function workspace(): { root: string; outputPath: string } {
    const root = makeTemp();
    const record = join(root, "aidlc", "spaces", "default", "intents", "i1");
    const output = join(record, "construction", "u1", "artifact.md");
    mkdirSync(join(record, "construction", "u1"), { recursive: true });
    writeFileSync(join(record, "aidlc-state.md"), "## Stage Progress\n- [x] code-generation — EXECUTE\n");
    writeFileSync(output, "body\n");
    return { root, outputPath: output };
  }

  const io = (): { io: SensorIO; out: string[]; err: string[] } => {
    const out: string[] = [];
    const err: string[] = [];
    return { io: { stdout: (t) => out.push(t), stderr: (t) => err.push(t) }, out, err };
  };

  test("resolveContext finds record_dir, workspace_root and unit", () => {
    const { root, outputPath } = workspace();
    const result = resolveContext(["--stage", "code-generation", "--output-path", outputPath]);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.context.record_dir).toBe(join(root, "aidlc", "spaces", "default", "intents", "i1"));
    expect(result.context.workspace_root).toBe(root);
    expect(result.context.unit).toBe("u1");
  });

  test("resolveContext reports args-missing", () => {
    const result = resolveContext(["--stage", "x"]);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("args-missing");
  });

  test("readStageStatus reads the Stage Progress line", () => {
    const { outputPath } = workspace();
    const context = resolveContext(["--stage", "code-generation", "--output-path", outputPath]);
    if (!context.ok) throw new Error("context");
    expect(readStageStatus(context.context, "code-generation")).toEqual({
      stage: "code-generation",
      execution: "EXECUTE",
      checkbox: "x",
    });
    expect(readStageStatus(context.context, "unknown").execution).toBe("absent");
  });

  test("readSourceClaims expands the manifest and flags missing files", () => {
    const { root, outputPath } = workspace();
    const manifestPath = join(
      root,
      "aidlc",
      "spaces",
      "default",
      "intents",
      "i1",
      "construction",
      "u1",
      "code-generation",
      "source-manifest.json",
    );
    mkdirSync(join(manifestPath, ".."), { recursive: true });
    writeFileSync(
      manifestPath,
      JSON.stringify({
        stage: "code-generation",
        unit: "u1",
        version: 1,
        writes: [{ path: "aidlc/spaces/default/intents/i1/construction/u1/artifact.md" }, { path: "missing.md" }],
      }),
    );
    const context = resolveContext(["--stage", "code-generation", "--output-path", outputPath]);
    if (!context.ok) throw new Error("context");
    const result = readSourceClaims(context.context);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.claims).toHaveLength(1);
    expect(result.claims[0].path.endsWith("artifact.md")).toBe(true);
    expect(result.findings.map((f) => f.rule_id)).toContain("runtime.claim-missing");
  });

  test("runSensor emits one JSON line and exits 0 on pass", () => {
    const { outputPath } = workspace();
    const { io: sink, out } = io();
    const code = runSensor(
      {
        sensor_id: "demo",
        severity: "blocking",
        evaluate: () => [],
      },
      ["--stage", "code-generation", "--output-path", outputPath],
      sink,
    );
    expect(code).toBe(0);
    const verdict = JSON.parse(out.join("").trim());
    expect(verdict.pass).toBe(true);
    expect(verdict.findings_count).toBe(0);
  });

  test("runSensor fails closed on an evaluation error", () => {
    const { outputPath } = workspace();
    const { io: sink, out } = io();
    const code = runSensor(
      {
        sensor_id: "demo",
        severity: "blocking",
        evaluate: () => {
          throw new Error("boom");
        },
      },
      ["--stage", "code-generation", "--output-path", outputPath],
      sink,
    );
    expect(code).toBe(0);
    const verdict = JSON.parse(out.join("").trim());
    expect(verdict.pass).toBe(false);
    expect(verdict.reason).toContain("runtime-error");
  });
});
