import { afterEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

const toolsDir = join(import.meta.dir, "..", "tools");

const MODEL = `schema_version: 1
bounded_contexts:
  - element_id: bc.billing
    name: Billing
    aggregates:
      - element_id: aggregate.invoice
        name: Invoice
        bounded_context: bc.billing
        root_element: entity.invoice
        states: [draft, issued]
        elements:
          - { element_id: entity.invoice, kind: entity, name: Invoice, aggregate: aggregate.invoice }
          - { element_id: primitive.money, kind: domain-primitive, name: Money, aggregate: aggregate.invoice,
              attributes: [{ name: value, type: decimal }] }
        invariants:
          - { element_id: invariant.invoice.total-positive, name: TotalPositive, aggregate: aggregate.invoice, statement: The money amount must be non-negative. }
        commands:
          - element_id: command.invoice.issue
            name: Issue
            aggregate: aggregate.invoice
            effect: transition
            state_effect: transitions
            transitions: [transition.invoice.issue]
            domain_errors:
              - { element_id: error.invoice.issue.already-issued, name: AlreadyIssued, command: command.invoice.issue, condition: not draft }
            events: [event.invoice.issued]
            idempotency: { strategy: none }
        events:
          - { element_id: event.invoice.issued, name: Issued, aggregate: aggregate.invoice, produced_by: command.invoice.issue }
        transitions:
          - { element_id: transition.invoice.issue, name: Issue, aggregate: aggregate.invoice, from_state: draft, to_state: issued, command: command.invoice.issue }
        factory_rules:
          - { element_id: factory.invoice.open, name: Open, target_element: entity.invoice, preconditions: [invariant.invoice.total-positive] }
lineage: []
`;

const MODEL_MD = `# Invoice
- bc.billing
- aggregate.invoice
- entity.invoice
- primitive.money
- invariant.invoice.total-positive: The money amount must be non-negative.
- command.invoice.issue
- error.invoice.issue.already-issued
- event.invoice.issued
- transition.invoice.issue
- factory.invoice.open
`;

const AGGREGATE_MAPPING = `# Aggregate mapping

\`\`\`yaml
schema_version: 1
model_ref: inception/ddd-domain-modeling/domain-model.yaml
aggregate_mappings:
  - aggregate_ref: aggregate.invoice
    programming_model: class
    persistence_method: state-sourcing
    crate: billing-domain
    module: billing::invoice
    ports: []
    repository: InvoiceRepository
    reference_ids: [entity.invoice, invariant.invoice.total-positive]
\`\`\`
`;

const USE_CASES = `# Use cases

\`\`\`yaml
schema_version: 1
model_ref: inception/ddd-domain-modeling/domain-model.yaml
use_cases:
  - use_case_id: uc.issue-invoice
    name: Issue invoice
    target_aggregates: [aggregate.invoice]
    commands: [command.invoice.issue]
    re_execution_basis: idempotency none
    recovery_policy: caller-retry
    read_model_exposure: invoice view
\`\`\`
`;

const LAYER_STRUCTURE = `# Layer structure

\`\`\`yaml
schema_version: 1
model_ref: inception/ddd-domain-modeling/domain-model.yaml
layer_structures:
  - context_ref: bc.billing
    cqrs: true
    command_side_crates: [billing-domain]
    query_side_crates: [billing-query]
    rmu_crates: []
    crate_dependencies:
      - { crate: billing-domain, depends_on: [] }
      - { crate: billing-query, depends_on: [] }
    ports:
      - { name: InvoiceRepository, kind: repository }
    repositories:
      - { name: InvoiceRepository, aggregate_ref: aggregate.invoice, io_unit: single, verbs: [find_by_id, store, delete_by_id], store_semantics: upsert }
    restoration_paths:
      - { aggregate_ref: aggregate.invoice, via: full-constructor }
    persistence_backend: postgres
\`\`\`
`;

const tempDirs: string[] = [];
afterEach(() => {
  while (tempDirs.length > 0) rmSync(tempDirs.pop() as string, { recursive: true, force: true });
});

function makeRecord(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), "ddd-u4-"));
  tempDirs.push(root);
  const record = join(root, "aidlc", "spaces", "default", "intents", "i1");
  mkdirSync(record, { recursive: true });
  writeFileSync(
    join(record, "aidlc-state.md"),
    "## Stage Progress\n- [x] ddd-domain-modeling — EXECUTE\n- [x] domain-design — EXECUTE\n",
  );
  for (const [rel, content] of Object.entries(files)) {
    const path = join(record, rel);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, content);
  }
  return record;
}

interface Verdict {
  pass: boolean;
  findings_count: number;
  findings: { rule_id: string; file: string; line?: number }[];
  note?: string;
}

function runSensor(
  sensorId: string,
  stage: string,
  record: string,
  outputRel: string,
): { code: number; verdict: Verdict } {
  const script = join(toolsDir, `ddd-sensor-${sensorId}.ts`);
  const proc = Bun.spawnSync(["bun", script, "--stage", stage, "--output-path", join(record, outputRel)], {
    stdout: "pipe",
    stderr: "pipe",
  });
  const stdout = proc.stdout.toString().trim();
  return { code: proc.exitCode ?? 0, verdict: JSON.parse(stdout) as Verdict };
}

function ruleIds(verdict: Verdict): string[] {
  return verdict.findings.map((f) => f.rule_id);
}

describe("model-completeness", () => {
  test("passes on a complete model and matching md", () => {
    const record = makeRecord({
      "inception/ddd-domain-modeling/domain-model.yaml": MODEL,
      "inception/ddd-domain-modeling/domain-model.md": MODEL_MD,
    });
    const { verdict } = runSensor(
      "model-completeness",
      "ddd-domain-modeling",
      record,
      "inception/ddd-domain-modeling/domain-model.yaml",
    );
    expect(ruleIds(verdict)).toEqual([]);
    expect(verdict.pass).toBe(true);
  });

  test("reports an id missing from the md", () => {
    const record = makeRecord({
      "inception/ddd-domain-modeling/domain-model.yaml": MODEL,
      "inception/ddd-domain-modeling/domain-model.md": MODEL_MD.replaceAll("primitive.money", ""),
    });
    const { verdict } = runSensor(
      "model-completeness",
      "ddd-domain-modeling",
      record,
      "inception/ddd-domain-modeling/domain-model.yaml",
    );
    expect(ruleIds(verdict)).toContain("model-completeness.f-missing");
  });

  test("reports a missing md", () => {
    const record = makeRecord({ "inception/ddd-domain-modeling/domain-model.yaml": MODEL });
    const { verdict } = runSensor(
      "model-completeness",
      "ddd-domain-modeling",
      record,
      "inception/ddd-domain-modeling/domain-model.yaml",
    );
    expect(ruleIds(verdict)).toContain("model-completeness.f-absent");
  });

  test("reports an invalid model as schema", () => {
    const record = makeRecord({
      "inception/ddd-domain-modeling/domain-model.yaml": "schema_version: 2\nbounded_contexts: []\n",
      "inception/ddd-domain-modeling/domain-model.md": "# empty\n",
    });
    const { verdict } = runSensor(
      "model-completeness",
      "ddd-domain-modeling",
      record,
      "inception/ddd-domain-modeling/domain-model.yaml",
    );
    expect(ruleIds(verdict)).toContain("model-completeness.schema");
  });
});

describe("model-presence", () => {
  test("passes when domain-modeling is SKIP with a note", () => {
    const record = makeRecord({ "inception/domain-design/components.md": "# components\n" });
    writeFileSync(join(record, "aidlc-state.md"), "## Stage Progress\n- [S] ddd-domain-modeling — SKIP\n");
    const { verdict } = runSensor("model-presence", "domain-design", record, "inception/domain-design/components.md");
    expect(verdict.pass).toBe(true);
    expect(verdict.note).toContain("SKIP");
  });

  test("reports a missing model when EXECUTE", () => {
    const record = makeRecord({ "inception/domain-design/components.md": "# components\n" });
    const { verdict } = runSensor("model-presence", "domain-design", record, "inception/domain-design/components.md");
    expect(ruleIds(verdict)).toContain("model-presence.missing");
  });
});

describe("reference-ids", () => {
  test("passes on resolvable references", () => {
    const record = makeRecord({
      "inception/ddd-domain-modeling/domain-model.yaml": MODEL,
      "inception/domain-design/ddd-aggregate-mapping.md": AGGREGATE_MAPPING,
    });
    const { verdict } = runSensor(
      "reference-ids",
      "domain-design",
      record,
      "inception/domain-design/ddd-aggregate-mapping.md",
    );
    expect(ruleIds(verdict)).toEqual([]);
  });

  test("reports an undefined reference and an empty reference_ids", () => {
    const record = makeRecord({
      "inception/ddd-domain-modeling/domain-model.yaml": MODEL,
      "inception/domain-design/ddd-aggregate-mapping.md": AGGREGATE_MAPPING.replace(
        "reference_ids: [entity.invoice, invariant.invoice.total-positive]",
        "reference_ids: [entity.missing]",
      ),
    });
    const { verdict } = runSensor(
      "reference-ids",
      "domain-design",
      record,
      "inception/domain-design/ddd-aggregate-mapping.md",
    );
    expect(ruleIds(verdict)).toContain("reference-ids.undefined");
  });

  test("reports a missing reference_ids list", () => {
    const record = makeRecord({
      "inception/ddd-domain-modeling/domain-model.yaml": MODEL,
      "inception/domain-design/ddd-aggregate-mapping.md": AGGREGATE_MAPPING.replace(
        "reference_ids: [entity.invoice, invariant.invoice.total-positive]",
        "reference_ids: []",
      ),
    });
    const { verdict } = runSensor(
      "reference-ids",
      "domain-design",
      record,
      "inception/domain-design/ddd-aggregate-mapping.md",
    );
    expect(ruleIds(verdict)).toContain("reference-ids.missing");
  });
});

describe("mapping-declarations", () => {
  test("passes the aggregate mapping", () => {
    const record = makeRecord({
      "inception/ddd-domain-modeling/domain-model.yaml": MODEL,
      "inception/domain-design/ddd-aggregate-mapping.md": AGGREGATE_MAPPING,
    });
    const { verdict } = runSensor(
      "mapping-declarations",
      "domain-design",
      record,
      "inception/domain-design/ddd-aggregate-mapping.md",
    );
    expect(ruleIds(verdict)).toEqual([]);
  });

  test("reports unmapped aggregate and a missing axis", () => {
    const record = makeRecord({
      "inception/ddd-domain-modeling/domain-model.yaml": MODEL,
      "inception/domain-design/ddd-aggregate-mapping.md": AGGREGATE_MAPPING.replace(
        "programming_model: class",
        "programming_model: ",
      ),
    });
    const { verdict } = runSensor(
      "mapping-declarations",
      "domain-design",
      record,
      "inception/domain-design/ddd-aggregate-mapping.md",
    );
    expect(ruleIds(verdict)).toContain("mapping-declarations.axes");
  });

  test("reports missing use case items on functional-design", () => {
    const record = makeRecord({
      "inception/ddd-domain-modeling/domain-model.yaml": MODEL,
      "construction/u1/functional-design/ddd-use-case-declarations.md": USE_CASES.replace(
        "re_execution_basis: idempotency none",
        "re_execution_basis: ",
      ),
    });
    const { verdict } = runSensor(
      "mapping-declarations",
      "functional-design",
      record,
      "construction/u1/functional-design/ddd-use-case-declarations.md",
    );
    expect(ruleIds(verdict)).toContain("mapping-declarations.use-case-item");
  });
});

describe("layer-structure", () => {
  test("passes a clean declaration", () => {
    const record = makeRecord({
      "inception/ddd-domain-modeling/domain-model.yaml": MODEL,
      "inception/domain-design/ddd-aggregate-mapping.md": AGGREGATE_MAPPING,
      "construction/u1/infrastructure-design/ddd-layer-structure.md": LAYER_STRUCTURE,
    });
    const { verdict } = runSensor(
      "layer-structure",
      "infrastructure-design",
      record,
      "construction/u1/infrastructure-design/ddd-layer-structure.md",
    );
    expect(ruleIds(verdict)).toEqual([]);
  });

  test("reports repository name and medium, and a missing restoration path", () => {
    const record = makeRecord({
      "inception/ddd-domain-modeling/domain-model.yaml": MODEL,
      "inception/domain-design/ddd-aggregate-mapping.md": AGGREGATE_MAPPING,
      "construction/u1/infrastructure-design/ddd-layer-structure.md": LAYER_STRUCTURE.replaceAll(
        "InvoiceRepository",
        "InvoiceDynamoRepository",
      ).replace("via: full-constructor", "via: other"),
    });
    const { verdict } = runSensor(
      "layer-structure",
      "infrastructure-design",
      record,
      "construction/u1/infrastructure-design/ddd-layer-structure.md",
    );
    expect(ruleIds(verdict)).toContain("layer-structure.m-name");
    expect(ruleIds(verdict)).toContain("layer-structure.m-media");
    expect(ruleIds(verdict)).toContain("layer-structure.n");
  });
});

describe("design-advisories", () => {
  test("passes a clean infrastructure declaration", () => {
    const record = makeRecord({
      "inception/ddd-domain-modeling/domain-model.yaml": MODEL,
      "construction/u1/infrastructure-design/ddd-layer-structure.md": LAYER_STRUCTURE,
    });
    const { verdict } = runSensor(
      "design-advisories",
      "infrastructure-design",
      record,
      "construction/u1/infrastructure-design/ddd-layer-structure.md",
    );
    expect(verdict.pass).toBe(true);
  });

  test("reports a non-upsert store as advisory", () => {
    const record = makeRecord({
      "inception/ddd-domain-modeling/domain-model.yaml": MODEL,
      "construction/u1/infrastructure-design/ddd-layer-structure.md": LAYER_STRUCTURE.replace(
        "store_semantics: upsert",
        "store_semantics: insert-only",
      ),
    });
    const { verdict } = runSensor(
      "design-advisories",
      "infrastructure-design",
      record,
      "construction/u1/infrastructure-design/ddd-layer-structure.md",
    );
    expect(ruleIds(verdict)).toContain("design-advisories.store-upsert");
    expect(verdict.pass).toBe(false);
    expect(verdict.findings[0].file).toBe("construction/u1/infrastructure-design/ddd-layer-structure.md");
  });
});

describe("determinism", () => {
  test("model-completeness is byte-identical across three runs", () => {
    const record = makeRecord({
      "inception/ddd-domain-modeling/domain-model.yaml": MODEL,
      "inception/ddd-domain-modeling/domain-model.md": MODEL_MD.replaceAll("primitive.money", ""),
    });
    const script = join(toolsDir, "ddd-sensor-model-completeness.ts");
    const output = join(record, "inception/ddd-domain-modeling/domain-model.yaml");
    const runs = [0, 1, 2].map(() => {
      const proc = Bun.spawnSync(["bun", script, "--stage", "ddd-domain-modeling", "--output-path", output], {
        stdout: "pipe",
      });
      return proc.stdout.toString().trim();
    });
    expect(runs[0]).toBe(runs[1]);
    expect(runs[1]).toBe(runs[2]);
  });
});
