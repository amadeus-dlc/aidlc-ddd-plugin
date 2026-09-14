import { afterEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, sep } from "node:path";
import {
  readSourceClaims,
  readStageStatus,
  resolveContext,
  type SensorRunContext,
} from "../tools/ddd/lib/runtime/context.ts";
import { runSensor, type SensorIO, ToolUnavailableError } from "../tools/ddd/lib/runtime/runtime.ts";
import { checkCompleteness } from "../tools/ddd/lib/schema/completeness.ts";
import { parseElementId } from "../tools/ddd/lib/schema/element-id.ts";
import { loadDomainModel } from "../tools/ddd/lib/schema/loader.ts";
import type { DomainModel } from "../tools/ddd/lib/schema/model.ts";
import { collectUnresolved, finding, pascalCase, readText, relPath } from "../tools/ddd/lib/sensors/common.ts";
import { assembleFindings, assertFindingInput, compareFindings } from "../tools/ddd/lib/shared/findings.ts";

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

/** Burn wall-clock time so an elapsed-budget branch is reached deterministically. */
function spin(ms: number): void {
  const until = Date.now() + ms;
  while (Date.now() <= until) {
    // deliberately busy: the budget is measured against the wall clock
  }
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

  test("runSensor emits a verdict rather than throwing when the context cannot be resolved", () => {
    const { io: sink, out } = io();
    const code = runSensor(
      { sensor_id: "demo", severity: "blocking", evaluate: () => [] },
      ["--stage", "code-generation"],
      sink,
    );
    expect(code).toBe(0);
    expect(JSON.parse(out.join("").trim())).toMatchObject({
      pass: false,
      sensor_id: "demo",
      stage: "",
      output_path: "",
      findings_count: 0,
      reason: "args-missing",
    });
  });

  test("resolveContext reports record-dir-unresolved outside an intent record", () => {
    const dir = makeTemp();
    const output = join(dir, "artifact.md");
    writeFileSync(output, "body\n");
    const result = resolveContext(["--stage", "code-generation", "--output-path", output]);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("record-dir-unresolved");
  });

  test("runSensor carries an evaluation note and names a lone finding as the reason", () => {
    const { outputPath } = workspace();
    const { io: sink, out } = io();
    const code = runSensor(
      {
        sensor_id: "demo",
        severity: "advisory",
        evaluate: () => ({
          findings: [{ rule_id: "demo.rule", file: "a.md", message: "one thing" }],
          note: "checked 1 file",
        }),
      },
      ["--stage", "code-generation", "--output-path", outputPath],
      sink,
    );
    expect(code).toBe(0);
    const verdict = JSON.parse(out.join("").trim());
    expect(verdict.pass).toBe(false);
    expect(verdict.findings_count).toBe(1);
    expect(verdict.note).toBe("checked 1 file");
    expect(verdict.reason).toBe("demo.rule: one thing");
  });

  test("runSensor exits 127 without a verdict when a bundled tool is unavailable", () => {
    const { outputPath } = workspace();
    const { io: sink, out, err } = io();
    const code = runSensor(
      {
        sensor_id: "demo",
        severity: "blocking",
        evaluate: () => {
          throw new ToolUnavailableError("tree-sitter");
        },
      },
      ["--stage", "code-generation", "--output-path", outputPath],
      sink,
    );
    expect(code).toBe(127);
    expect(out).toEqual([]);
    expect(err.join("")).toContain("tool unavailable: tree-sitter");
  });

  test("checkBudget turns an elapsed budget into a budget-exceeded verdict", () => {
    const { outputPath } = workspace();
    const { io: sink, out } = io();
    let elapsed = 0;
    let exceeded = false;
    const code = runSensor(
      {
        sensor_id: "demo",
        severity: "blocking",
        budget_ms: 1,
        evaluate: (_context, api) => {
          spin(5);
          elapsed = api.elapsedMs();
          exceeded = api.budgetExceeded();
          api.checkBudget();
          return [];
        },
      },
      ["--stage", "code-generation", "--output-path", outputPath],
      sink,
    );
    expect(elapsed).toBeGreaterThan(1);
    expect(exceeded).toBe(true);
    expect(code).toBe(0);
    expect(JSON.parse(out.join("").trim())).toMatchObject({ pass: false, reason: "budget-exceeded" });
  });

  test("an overrunning sensor that never checks its budget is still rejected", () => {
    const { outputPath } = workspace();
    const { io: sink, out } = io();
    const code = runSensor(
      {
        sensor_id: "demo",
        severity: "blocking",
        budget_ms: 1,
        evaluate: () => {
          spin(5);
          return [{ rule_id: "demo.rule", file: "a.md", message: "ignored" }];
        },
      },
      ["--stage", "code-generation", "--output-path", outputPath],
      sink,
    );
    expect(code).toBe(0);
    expect(JSON.parse(out.join("").trim())).toMatchObject({
      pass: false,
      findings_count: 0,
      reason: "budget-exceeded",
    });
  });
});

describe("sensor helpers", () => {
  const context = {
    stage: "code-generation",
    output_path: "/w/aidlc/spaces/default/intents/i1/construction/u1/artifact.md",
    record_dir: "/w/aidlc/spaces/default/intents/i1",
    workspace_root: "/w",
    started_at: new Date(0).toISOString(),
  };

  test("relPath renders a record-relative path with forward slashes", () => {
    expect(relPath(context, "/w/aidlc/spaces/default/intents/i1/construction/u1/artifact.md")).toBe(
      "construction/u1/artifact.md",
    );
  });

  test("relPath escapes the record dir rather than silently clamping", () => {
    expect(relPath(context, "/w/README.md")).toBe("../../../../../README.md");
  });

  test("finding omits line unless one is supplied", () => {
    expect(finding("r", "a.md", "m")).toEqual({ rule_id: "r", file: "a.md", message: "m" });
    expect(finding("r", "a.md", "m", 7)).toEqual({ rule_id: "r", file: "a.md", message: "m", line: 7 });
    expect(finding("r", "a.md", "m", 0)).toEqual({ rule_id: "r", file: "a.md", message: "m", line: 0 });
  });

  test("readText returns the contents of a file and undefined for anything unreadable", () => {
    const dir = makeTemp();
    const path = join(dir, "note.md");
    writeFileSync(path, "body\n");
    expect(readText(path)).toBe("body\n");
    expect(readText(join(dir, "absent.md"))).toBeUndefined();
    expect(readText(dir)).toBeUndefined();
  });

  test("pascalCase joins hyphen and underscore separated words and drops empty parts", () => {
    expect(pascalCase("invoice")).toBe("Invoice");
    expect(pascalCase("issue-invoice")).toBe("IssueInvoice");
    expect(pascalCase("issue_invoice-line")).toBe("IssueInvoiceLine");
    expect(pascalCase("--issue--invoice--")).toBe("IssueInvoice");
    expect(pascalCase("")).toBe("");
  });

  test("collectUnresolved reports nothing when every reference resolves", () => {
    const loaded = loadDomainModel(fixture("valid.yaml"));
    expect(loaded.ok).toBe(true);
    if (!loaded.ok) return;
    expect(collectUnresolved(loaded.model, loaded.index)).toEqual([]);
  });

  test("collectUnresolved names the expected kind when a typed reference is dangling", () => {
    const loaded = loadDomainModel(fixture("valid.yaml"));
    expect(loaded.ok).toBe(true);
    if (!loaded.ok) return;
    const model = structuredClone(loaded.model);
    const aggregate = model.bounded_contexts[0].aggregates[0];
    aggregate.root_element = "entity.absent";
    aggregate.commands[0].transitions = ["transition.absent"];
    aggregate.events[0].produced_by = "command.absent";
    const unresolved = collectUnresolved(model, loaded.index);
    expect(unresolved.map((u) => `${u.id}/${u.expected}`).sort()).toEqual([
      "command.absent/command",
      "entity.absent/entity",
      "transition.absent/transition",
    ]);
    expect(unresolved.every((u) => u.reason.length > 0)).toBe(true);
  });

  test("collectUnresolved omits expected for an attribute type reference", () => {
    const loaded = loadDomainModel(fixture("valid.yaml"));
    expect(loaded.ok).toBe(true);
    if (!loaded.ok) return;
    const model = structuredClone(loaded.model);
    const element = model.bounded_contexts[0].aggregates[0].elements[0];
    element.attributes[1].type = "primitive.absent";
    const unresolved = collectUnresolved(model, loaded.index);
    expect(unresolved).toHaveLength(1);
    expect(unresolved[0].id).toBe("primitive.absent");
    expect("expected" in unresolved[0]).toBe(false);
  });

  test("collectUnresolved ignores attribute types that are not element ids", () => {
    const loaded = loadDomainModel(fixture("valid.yaml"));
    expect(loaded.ok).toBe(true);
    if (!loaded.ok) return;
    const model = structuredClone(loaded.model);
    model.bounded_contexts[0].aggregates[0].elements[0].attributes[1].type = "decimal";
    expect(collectUnresolved(model, loaded.index)).toEqual([]);
  });
});

describe("checkCompleteness advisory rules", () => {
  function loadedModel(): DomainModel {
    const loaded = loadDomainModel(fixture("valid.yaml"));
    if (!loaded.ok) throw new Error("the valid fixture must load");
    return structuredClone(loaded.model);
  }

  test("a state_effect of transitions with no transition listed is reported", () => {
    const model = loadedModel();
    model.bounded_contexts[0].aggregates[0].commands[0].transitions = [];
    const findings = checkCompleteness(model);
    expect(rules(findings)).toEqual(["completeness.ii"]);
    expect(findings[0].message).toContain("command.invoice.issue");
    expect(findings[0].file).toBe("ddd-domain-model-yaml.md");
  });

  test("a state_effect of none that still lists transitions is reported", () => {
    const model = loadedModel();
    model.bounded_contexts[0].aggregates[0].commands[0].state_effect = "none";
    expect(rules(checkCompleteness(model))).toEqual(["completeness.ii"]);
  });

  test("an accumulation command without command-id-memory is reported", () => {
    const model = loadedModel();
    const command = model.bounded_contexts[0].aggregates[0].commands[0];
    command.effect = "accumulation";
    expect(rules(checkCompleteness(model))).toEqual(["idempotency.j"]);
    command.idempotency.strategy = "command-id-memory";
    expect(checkCompleteness(model)).toEqual([]);
  });

  test("the reported file name can be overridden by the caller", () => {
    const model = loadedModel();
    model.bounded_contexts[0].aggregates[0].invariants = [];
    const findings = checkCompleteness(model, "other.md");
    expect(rules(findings)).toEqual(["completeness.i"]);
    expect(findings[0].file).toBe("other.md");
  });
});

describe("readSourceClaims", () => {
  function record(outputRel = "construction/u1/artifact.md"): {
    root: string;
    context: SensorRunContext;
  } {
    const root = makeTemp();
    const dir = join(root, "aidlc", "spaces", "default", "intents", "i1");
    const output = join(dir, ...outputRel.split("/"));
    mkdirSync(join(output, ".."), { recursive: true });
    writeFileSync(join(dir, "aidlc-state.md"), "## Stage Progress\n- [x] code-generation — EXECUTE\n");
    writeFileSync(output, "body\n");
    const resolved = resolveContext(["--stage", "code-generation", "--output-path", output]);
    if (!resolved.ok) throw new Error(`context: ${resolved.reason}`);
    return { root, context: resolved.context };
  }

  function writeManifest(root: string, body: string): void {
    const path = join(
      root,
      "aidlc/spaces/default/intents/i1/construction/u1/code-generation/source-manifest.json".split("/").join(sep),
    );
    mkdirSync(join(path, ".."), { recursive: true });
    writeFileSync(path, body);
  }

  function reasonFor(body: string): string {
    const { root, context } = record();
    writeManifest(root, body);
    const result = readSourceClaims(context);
    expect(result.ok).toBe(false);
    return result.ok ? "" : result.reason;
  }

  const manifest = (writes: unknown[], extra: Record<string, unknown> = {}) =>
    JSON.stringify({ stage: "code-generation", unit: "u1", version: 1, writes, ...extra });

  test("reports unit-unresolved when the output path names no unit", () => {
    const { context } = record("artifact.md");
    expect(context.unit).toBeUndefined();
    const result = readSourceClaims(context);
    expect(result).toEqual({ ok: false, reason: "unit-unresolved" });
  });

  test("reports source-manifest-invalid when the manifest is absent", () => {
    const { context } = record();
    expect(readSourceClaims(context)).toEqual({ ok: false, reason: "source-manifest-invalid" });
  });

  test("rejects every malformed manifest shape", () => {
    expect(reasonFor("{ not json")).toBe("source-manifest-invalid");
    expect(reasonFor("[]")).toBe("source-manifest-invalid");
    expect(reasonFor("null")).toBe("source-manifest-invalid");
    expect(reasonFor(manifest([], { extra: 1 }))).toBe("source-manifest-invalid");
    expect(reasonFor(JSON.stringify({ stage: "code-generation", unit: "u1", version: 2, writes: [] }))).toBe(
      "source-manifest-invalid",
    );
    expect(reasonFor(JSON.stringify({ stage: "build-and-test", unit: "u1", version: 1, writes: [] }))).toBe(
      "source-manifest-invalid",
    );
    expect(reasonFor(JSON.stringify({ stage: "code-generation", unit: 1, version: 1, writes: [] }))).toBe(
      "source-manifest-invalid",
    );
    expect(reasonFor(JSON.stringify({ stage: "code-generation", unit: "u1", version: 1, writes: {} }))).toBe(
      "source-manifest-invalid",
    );
    expect(reasonFor(manifest(["a.md"]))).toBe("source-manifest-invalid");
    expect(reasonFor(manifest([{ path: "a.md", mode: "write" }]))).toBe("source-manifest-invalid");
    expect(reasonFor(manifest([{ path: "" }]))).toBe("source-manifest-invalid");
    expect(reasonFor(manifest([{ path: "a.md", repo: 7 }]))).toBe("source-manifest-invalid");
  });

  test("flags a write naming a repo the caller did not supply", () => {
    const { root, context } = record();
    writeManifest(root, manifest([{ path: "a.md", repo: "sibling" }]));
    const result = readSourceClaims(context);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.claims).toEqual([]);
    expect(result.findings.map((f) => f.rule_id)).toEqual(["runtime.claim-out-of-scope"]);
    expect(result.findings[0].message).toContain('unknown repo "sibling"');
  });

  test("resolves a write against the supplied repo root and keeps the repo name", () => {
    const { root, context } = record();
    const sibling = makeTemp();
    writeFileSync(join(sibling, "lib.rs"), "fn main() {}\n");
    writeManifest(root, manifest([{ path: "lib.rs", repo: "sibling" }]));
    const result = readSourceClaims(context, { repoRoots: { sibling } });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.findings).toEqual([]);
    expect(result.claims).toEqual([
      { path: "lib.rs", repo: "sibling", is_directory: false, resolved_path: join(sibling, "lib.rs") },
    ]);
  });

  test("flags a write that escapes its base directory", () => {
    const { root, context } = record();
    writeManifest(root, manifest([{ path: "../outside.md" }]));
    const result = readSourceClaims(context);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.claims).toEqual([]);
    expect(result.findings.map((f) => f.rule_id)).toEqual(["runtime.claim-out-of-scope"]);
    expect(result.findings[0].message).toContain("resolves outside");
  });

  test("flags a declared directory that does not exist", () => {
    const { root, context } = record();
    writeManifest(root, manifest([{ path: "src/" }]));
    const result = readSourceClaims(context);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.findings.map((f) => f.rule_id)).toEqual(["runtime.claim-missing"]);
    expect(result.findings[0].message).toContain("declared directory");
  });

  test("expands a declared directory recursively and honours the extension filter", () => {
    const { root, context } = record();
    mkdirSync(join(root, "src", "inner"), { recursive: true });
    writeFileSync(join(root, "src", "b.rs"), "");
    writeFileSync(join(root, "src", "a.rs"), "");
    writeFileSync(join(root, "src", "notes.md"), "");
    writeFileSync(join(root, "src", "inner", "c.rs"), "");
    writeManifest(root, manifest([{ path: "src/" }]));

    const all = readSourceClaims(context);
    expect(all.ok).toBe(true);
    if (!all.ok) return;
    expect(all.findings).toEqual([]);
    expect(all.claims.map((c) => c.path)).toEqual(["src/a.rs", "src/b.rs", "src/inner/c.rs", "src/notes.md"]);
    expect(all.claims.every((c) => c.is_directory === false)).toBe(true);

    const rust = readSourceClaims(context, { extensions: [".rs"] });
    expect(rust.ok).toBe(true);
    if (!rust.ok) return;
    expect(rust.claims.map((c) => c.path)).toEqual(["src/a.rs", "src/b.rs", "src/inner/c.rs"]);
  });

  test("flags a directory declared without its trailing slash", () => {
    const { root, context } = record();
    mkdirSync(join(root, "src"), { recursive: true });
    writeManifest(root, manifest([{ path: "src" }]));
    const result = readSourceClaims(context);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.findings.map((f) => f.rule_id)).toEqual(["runtime.claim-out-of-scope"]);
    expect(result.findings[0].message).toContain("without a trailing slash");
  });
});

describe("finding input validation and ordering", () => {
  test("assertFindingInput accepts a complete finding with and without a line", () => {
    expect(() => assertFindingInput({ rule_id: "r", file: "a.md", message: "m" })).not.toThrow();
    expect(() => assertFindingInput({ rule_id: "r", file: "a.md", message: "m", line: 1 })).not.toThrow();
  });

  test("assertFindingInput rejects a missing mandatory field", () => {
    for (const input of [
      { rule_id: "", file: "a.md", message: "m" },
      { rule_id: "r", file: "", message: "m" },
      { rule_id: "r", file: "a.md", message: "" },
    ]) {
      expect(() => assertFindingInput(input)).toThrow(/missing a required field/);
    }
  });

  test("assertFindingInput rejects a line that is not a positive integer", () => {
    expect(() => assertFindingInput({ rule_id: "r", file: "a.md", message: "m", line: 0 })).toThrow(/positive integer/);
    expect(() => assertFindingInput({ rule_id: "r", file: "a.md", message: "m", line: -1 })).toThrow(
      /positive integer/,
    );
    expect(() => assertFindingInput({ rule_id: "r", file: "a.md", message: "m", line: 1.5 })).toThrow(
      /positive integer/,
    );
  });

  test("compareFindings falls through file, line, rule_id, then message", () => {
    const base = { rule_id: "r", file: "a.md", line: 1, message: "m" };
    expect(compareFindings(base, { ...base, file: "b.md" })).toBeLessThan(0);
    expect(compareFindings(base, { ...base, line: 2 })).toBeLessThan(0);
    expect(compareFindings(base, { ...base, rule_id: "s" })).toBeLessThan(0);
    expect(compareFindings(base, { ...base, message: "n" })).toBeLessThan(0);
    expect(compareFindings(base, { ...base })).toBe(0);
    // an absent line sorts as line 0, ahead of an explicit line 1
    expect(compareFindings({ rule_id: "r", file: "a.md", message: "m" }, base)).toBeLessThan(0);
  });
});

describe("element index lookups", () => {
  function index() {
    const loaded = loadDomainModel(fixture("valid.yaml"));
    if (!loaded.ok) throw new Error("the valid fixture must load");
    return loaded.index;
  }

  test("byId returns the indexed element and undefined for an unknown id", () => {
    expect(index().byId("entity.invoice")?.kind).toBe("entity");
    expect(index().byId("entity.absent")).toBeUndefined();
  });

  test("resolve distinguishes malformed, undefined and kind-mismatch", () => {
    expect(index().resolve("Entity.Invoice")).toEqual({ ok: false, reason: "malformed" });
    expect(index().resolve("entity.absent")).toEqual({ ok: false, reason: "undefined" });
    expect(index().resolve("entity.invoice", "command")).toEqual({ ok: false, reason: "kind-mismatch" });
  });

  test("elements filters by kind and returns everything without one", () => {
    const all = index().elements();
    expect(all.map((e) => e.kind)).toEqual(
      expect.arrayContaining(["bc", "aggregate", "entity", "primitive", "command", "event", "transition"]),
    );
    const entities = index().elements("entity");
    expect(entities.map((e) => e.name)).toEqual(["Invoice"]);
    expect(entities.map((e) => e.id.kind)).toEqual(["entity"]);
  });

  test("commandsOf returns an empty list for an aggregate with no commands", () => {
    expect(index().commandsOf("aggregate.absent")).toEqual([]);
  });

  test("retired lineage entries resolve as deprecated rather than undefined", () => {
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
lineage:
  - lineage_id: lineage-0001
    element_id: entity.retired
    relation: deprecated
    deprecated_at: "2026-01-01"
    successors: []
  - lineage_id: lineage-0002
    element_id: entity.invoice
    relation: renamed
    previous_name: OldInvoice
    successors: []
`;
    const loaded = loadDomainModel(writeModel(yaml));
    expect(loaded.ok).toBe(true);
    if (!loaded.ok) return;
    expect(loaded.index.retiredIds().has("entity.retired")).toBe(true);
    expect(loaded.index.resolve("entity.retired")).toEqual({ ok: false, reason: "deprecated" });
    // a rename does not retire its element; only split, merged and deprecated do
    expect(loaded.index.retiredIds().has("entity.invoice")).toBe(false);
    expect(loaded.index.resolve("entity.invoice").ok).toBe(true);
    expect(loaded.index.resolve("entity.absent")).toEqual({ ok: false, reason: "undefined" });
  });
});
