import { afterEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { designDocument } from "./golden/model-document.ts";

const toolsDir = join(import.meta.dir, "..", "tools");

const MODEL = `schema_version: 2
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
              - { element_id: error.invoice.issue.already-issued, name: AlreadyIssued, operation: command.invoice.issue, condition: not draft }
            events: [event.invoice.issued]
            idempotency: { strategy: none }
        events:
          - { element_id: event.invoice.issued, name: Issued, aggregate: aggregate.invoice, produced_by: command.invoice.issue }
        transitions:
          - { element_id: transition.invoice.issue, name: Issue, aggregate: aggregate.invoice, from_state: draft, to_state: issued, command: command.invoice.issue }
        factory_rules:
          - element_id: factory.invoice.open
            name: Open
            target_element: entity.invoice
            preconditions: [invariant.invoice.total-positive]
            domain_errors:
              - { element_id: error.invoice.open.negative-amount, name: NegativeAmount, operation: factory.invoice.open, condition: negative opening amount }
lineage: []
`;

/** The same model in the format a record has to be migrated from. */
const LEGACY_MODEL = MODEL.replace("schema_version: 2", "schema_version: 1")
  .replace(
    "            domain_errors:\n              - { element_id: error.invoice.open.negative-amount, name: NegativeAmount, operation: factory.invoice.open, condition: negative opening amount }\n",
    "",
  )
  .replace("operation: command.invoice.issue", "command: command.invoice.issue");

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
- error.invoice.open.negative-amount
`;

const AGGREGATE_MAPPING = `# Aggregate mapping

\`\`\`yaml
schema_version: 2
model_ref: inception/ddd-domain-modeling/ddd-domain-model-yaml.md
aggregate_mappings:
  - aggregate_ref: aggregate.invoice
    programming_model: class
    persistence_method: state-sourcing
    reference_ids: [entity.invoice, invariant.invoice.total-positive]
    code:
      language: rust
      package: billing-domain
      module: [billing, invoice]
      type: Invoice
      ports: []
      repository: InvoiceRepository
    operations:
      - operation_ref: command.invoice.issue
        code: { method: issue, error_type: IssueInvoiceError }
        errors:
          - { error_ref: error.invoice.issue.already-issued, code: { case: AlreadyIssued } }
      - operation_ref: factory.invoice.open
        code: { method: open, error_type: OpenInvoiceError }
        errors:
          - { error_ref: error.invoice.open.negative-amount, code: { case: NegativeAmount } }
\`\`\`
`;

/** A Rust-only crate/module mapping, the format a record has to be migrated from. */
const LEGACY_AGGREGATE_MAPPING = `# Aggregate mapping

\`\`\`yaml
schema_version: 1
model_ref: inception/ddd-domain-modeling/ddd-domain-model-yaml.md
aggregate_mappings:
  - aggregate_ref: aggregate.invoice
    programming_model: class
    persistence_method: state-sourcing
    crate: billing-domain
    module: crate
    ports: []
    repository: InvoiceRepository
    reference_ids: [entity.invoice, invariant.invoice.total-positive]
domain_packages:
  - { crate: billing-domain, module: crate, term: billing, model_refs: [bc.billing], rationale: owns billing }
\`\`\`
`;

const USE_CASES = `# Use cases

\`\`\`yaml
schema_version: 1
model_ref: inception/ddd-domain-modeling/ddd-domain-model-yaml.md
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
schema_version: 2
model_ref: inception/ddd-domain-modeling/ddd-domain-model-yaml.md
layer_structures:
  - context_ref: bc.billing
    cqrs: true
    packages:
      - { role: command, code: { language: rust, package: billing-domain } }
      - { role: query, code: { language: rust, package: billing-query } }
    dependencies:
      - { code: { language: rust, package: billing-domain }, depends_on: [] }
      - { code: { language: rust, package: billing-query }, depends_on: [] }
    ports:
      - { name: InvoiceRepository, kind: repository, verbs: [find_by_id, store, delete_by_id] }
    repositories:
      - { name: InvoiceRepository, aggregate_ref: aggregate.invoice, io_unit: single, verbs: [find_by_id, store, delete_by_id], store_semantics: upsert }
    restoration_paths:
      - { aggregate_ref: aggregate.invoice, via: full-constructor }
    persistence_backend: postgres
\`\`\`
`;

/** The same context in the Rust-only crate format a record has to be migrated from. */
const LEGACY_LAYER_STRUCTURE = `# Layer structure

\`\`\`yaml
schema_version: 1
model_ref: inception/ddd-domain-modeling/ddd-domain-model-yaml.md
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
      - { name: InvoiceRepository, kind: repository, verbs: [find_by_id, store, delete_by_id] }
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
    writeFileSync(path, designDocument(rel, content));
  }
  return record;
}

interface Verdict {
  pass: boolean;
  findings_count: number;
  findings: { rule_id: string; file: string; line?: number; message: string }[];
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
      "inception/ddd-domain-modeling/ddd-domain-model-yaml.md": MODEL,
      "inception/ddd-domain-modeling/ddd-domain-model.md": MODEL_MD,
    });
    const { verdict } = runSensor(
      "model-completeness",
      "ddd-domain-modeling",
      record,
      "inception/ddd-domain-modeling/ddd-domain-model-yaml.md",
    );
    expect(ruleIds(verdict)).toEqual([]);
    expect(verdict.pass).toBe(true);
  });

  test("reports an id missing from the md", () => {
    const record = makeRecord({
      "inception/ddd-domain-modeling/ddd-domain-model-yaml.md": MODEL,
      "inception/ddd-domain-modeling/ddd-domain-model.md": MODEL_MD.replaceAll("primitive.money", ""),
    });
    const { verdict } = runSensor(
      "model-completeness",
      "ddd-domain-modeling",
      record,
      "inception/ddd-domain-modeling/ddd-domain-model-yaml.md",
    );
    expect(ruleIds(verdict)).toContain("model-completeness.f-missing");
  });

  test("reports a missing md", () => {
    const record = makeRecord({ "inception/ddd-domain-modeling/ddd-domain-model-yaml.md": MODEL });
    const { verdict } = runSensor(
      "model-completeness",
      "ddd-domain-modeling",
      record,
      "inception/ddd-domain-modeling/ddd-domain-model-yaml.md",
    );
    expect(ruleIds(verdict)).toContain("model-completeness.f-absent");
  });

  test("reports an invalid model as schema", () => {
    const record = makeRecord({
      "inception/ddd-domain-modeling/ddd-domain-model-yaml.md": "schema_version: 2\nbounded_contexts: []\n",
      "inception/ddd-domain-modeling/ddd-domain-model.md": "# empty\n",
    });
    const { verdict } = runSensor(
      "model-completeness",
      "ddd-domain-modeling",
      record,
      "inception/ddd-domain-modeling/ddd-domain-model-yaml.md",
    );
    expect(ruleIds(verdict)).toContain("model-completeness.schema");
  });

  test("refuses a legacy model and points to the migration that converts the whole record", () => {
    const record = makeRecord({
      "inception/ddd-domain-modeling/ddd-domain-model-yaml.md": LEGACY_MODEL,
      "inception/ddd-domain-modeling/ddd-domain-model.md": MODEL_MD,
    });
    const { verdict } = runSensor(
      "model-completeness",
      "ddd-domain-modeling",
      record,
      "inception/ddd-domain-modeling/ddd-domain-model-yaml.md",
    );
    expect(verdict.pass).toBe(false);
    expect(new Set(ruleIds(verdict))).toEqual(new Set(["model-completeness.schema"]));
    expect(verdict.findings.some((entry) => entry.message.includes("ddd-artifact-set migrate"))).toBe(true);
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
      "inception/ddd-domain-modeling/ddd-domain-model-yaml.md": MODEL,
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

  test("reports an undefined reference", () => {
    const record = makeRecord({
      "inception/ddd-domain-modeling/ddd-domain-model-yaml.md": MODEL,
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

  test("refuses an empty reference_ids list as a document the mapping reader does not accept", () => {
    const record = makeRecord({
      "inception/ddd-domain-modeling/ddd-domain-model-yaml.md": MODEL,
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
    expect(new Set(ruleIds(verdict))).toEqual(new Set(["reference-ids.document"]));
  });

  test("resolves the operations and error cases a mapping names", () => {
    const record = makeRecord({
      "inception/ddd-domain-modeling/ddd-domain-model-yaml.md": MODEL,
      "inception/domain-design/ddd-aggregate-mapping.md": AGGREGATE_MAPPING.replace(
        "operation_ref: factory.invoice.open",
        "operation_ref: invariant.invoice.total-positive",
      ).replace("error_ref: error.invoice.issue.already-issued", "error_ref: command.invoice.issue"),
    });
    const { verdict } = runSensor(
      "reference-ids",
      "domain-design",
      record,
      "inception/domain-design/ddd-aggregate-mapping.md",
    );
    // Neither reference names what its position requires: an operation, and a business error.
    expect(ruleIds(verdict)).toEqual(["reference-ids.kind", "reference-ids.kind"]);
  });

  test("refuses a legacy mapping as a document", () => {
    const record = makeRecord({
      "inception/ddd-domain-modeling/ddd-domain-model-yaml.md": MODEL,
      "inception/domain-design/ddd-aggregate-mapping.md": LEGACY_AGGREGATE_MAPPING,
    });
    const { verdict } = runSensor(
      "reference-ids",
      "domain-design",
      record,
      "inception/domain-design/ddd-aggregate-mapping.md",
    );
    expect(verdict.pass).toBe(false);
    expect(new Set(ruleIds(verdict))).toEqual(new Set(["reference-ids.document"]));
  });
});

describe("mapping-declarations", () => {
  test("passes the aggregate mapping", () => {
    const record = makeRecord({
      "inception/ddd-domain-modeling/ddd-domain-model-yaml.md": MODEL,
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

  test("reports a missing axis as the mapping reader's finding", () => {
    const record = makeRecord({
      "inception/ddd-domain-modeling/ddd-domain-model-yaml.md": MODEL,
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
    expect(verdict.pass).toBe(false);
    expect(new Set(ruleIds(verdict))).toEqual(new Set(["mapping-declarations.document"]));
    expect(verdict.findings.every((entry) => entry.message.startsWith("aggregate-mapping.structure: "))).toBe(true);
  });

  test("reads a legacy key under a schema_version 2 aggregate as unknown, never as its old meaning", () => {
    const record = makeRecord({
      "inception/ddd-domain-modeling/ddd-domain-model-yaml.md": MODEL,
      "inception/domain-design/ddd-aggregate-mapping.md": AGGREGATE_MAPPING.replace(
        "    persistence_method: state-sourcing\n",
        "    persistence_method: state-sourcing\n    crate: billing-domain\n",
      ),
    });
    const { verdict } = runSensor(
      "mapping-declarations",
      "domain-design",
      record,
      "inception/domain-design/ddd-aggregate-mapping.md",
    );
    expect(verdict.pass).toBe(false);
    expect(new Set(ruleIds(verdict))).toEqual(new Set(["mapping-declarations.document"]));
    expect(verdict.findings.some((entry) => entry.message.includes("aggregate-mapping.unknown-key"))).toBe(true);
  });

  test("blocks a functional design beside a mapping it cannot read, and only notes an absent one", () => {
    const useCases = {
      "inception/ddd-domain-modeling/ddd-domain-model-yaml.md": MODEL,
      "construction/u1/functional-design/functional-spec.md": USE_CASES,
    };
    const absent = runSensor(
      "mapping-declarations",
      "functional-design",
      makeRecord(useCases),
      "construction/u1/functional-design/functional-spec.md",
    ).verdict;
    expect(absent.pass).toBe(true);
    expect(absent.note ?? "").toContain("absent");

    const unreadable = runSensor(
      "mapping-declarations",
      "functional-design",
      makeRecord({ ...useCases, "inception/domain-design/ddd-aggregate-mapping.md": LEGACY_AGGREGATE_MAPPING }),
      "construction/u1/functional-design/functional-spec.md",
    ).verdict;
    expect(unreadable.pass).toBe(false);
    expect(unreadable.findings.map((entry) => [entry.rule_id, entry.file])).toEqual([
      ["mapping-declarations.document", "inception/domain-design/ddd-aggregate-mapping.md"],
    ]);
  });

  test("reports missing use case items on functional-design", () => {
    const record = makeRecord({
      "inception/ddd-domain-modeling/ddd-domain-model-yaml.md": MODEL,
      "construction/u1/functional-design/functional-spec.md": USE_CASES.replace(
        "re_execution_basis: idempotency none",
        "re_execution_basis: ",
      ),
    });
    const { verdict } = runSensor(
      "mapping-declarations",
      "functional-design",
      record,
      "construction/u1/functional-design/functional-spec.md",
    );
    expect(ruleIds(verdict)).toContain("mapping-declarations.use-case-item");
  });
});

describe("layer-structure", () => {
  test("passes a clean declaration", () => {
    const record = makeRecord({
      "inception/ddd-domain-modeling/ddd-domain-model-yaml.md": MODEL,
      "inception/domain-design/ddd-aggregate-mapping.md": AGGREGATE_MAPPING,
      "construction/u1/infrastructure-design/cicd-pipeline.md": LAYER_STRUCTURE,
    });
    const { verdict } = runSensor(
      "layer-structure",
      "infrastructure-design",
      record,
      "construction/u1/infrastructure-design/cicd-pipeline.md",
    );
    expect(ruleIds(verdict)).toEqual([]);
  });

  test("reports a missing restoration path", () => {
    const record = makeRecord({
      "inception/ddd-domain-modeling/ddd-domain-model-yaml.md": MODEL,
      "inception/domain-design/ddd-aggregate-mapping.md": AGGREGATE_MAPPING,
      "construction/u1/infrastructure-design/cicd-pipeline.md": LAYER_STRUCTURE.replace(
        "via: full-constructor",
        "via: other",
      ),
    });
    const { verdict } = runSensor(
      "layer-structure",
      "infrastructure-design",
      record,
      "construction/u1/infrastructure-design/cicd-pipeline.md",
    );
    expect(ruleIds(verdict)).toEqual(["layer-structure.n"]);
    expect(verdict.findings[0].file).toBe("construction/u1/infrastructure-design/cicd-pipeline.md");
  });

  test("reads the declaration a stage without Units writes straight under the stage", () => {
    const path = "construction/infrastructure-design/cicd-pipeline.md";
    const record = makeRecord({
      "inception/ddd-domain-modeling/ddd-domain-model-yaml.md": MODEL,
      [path]: LAYER_STRUCTURE.replace("via: full-constructor", "via: other"),
    });
    const { verdict } = runSensor("layer-structure", "infrastructure-design", record, path);
    expect(verdict.findings.map((entry) => [entry.rule_id, entry.file])).toEqual([["layer-structure.n", path]]);
  });

  test("refuses a legacy crate declaration, with the finding naming the migration", () => {
    const record = makeRecord({
      "inception/ddd-domain-modeling/ddd-domain-model-yaml.md": MODEL,
      "construction/u1/infrastructure-design/cicd-pipeline.md": LEGACY_LAYER_STRUCTURE,
    });
    const { verdict } = runSensor(
      "layer-structure",
      "infrastructure-design",
      record,
      "construction/u1/infrastructure-design/cicd-pipeline.md",
    );
    expect(verdict.pass).toBe(false);
    expect(ruleIds(verdict)).toEqual(["layer-structure.item"]);
    expect(verdict.findings[0].message).toContain("layer-declaration.version: ");
    expect(verdict.findings[0].message).toContain("ddd-artifact-set migrate");
  });
});

describe("design-advisories", () => {
  test("passes a clean infrastructure declaration", () => {
    const record = makeRecord({
      "inception/ddd-domain-modeling/ddd-domain-model-yaml.md": MODEL,
      "construction/u1/infrastructure-design/cicd-pipeline.md": LAYER_STRUCTURE,
    });
    const { verdict } = runSensor(
      "design-advisories",
      "infrastructure-design",
      record,
      "construction/u1/infrastructure-design/cicd-pipeline.md",
    );
    expect(verdict.pass).toBe(true);
  });

  test("reports a non-upsert store as advisory", () => {
    const record = makeRecord({
      "inception/ddd-domain-modeling/ddd-domain-model-yaml.md": MODEL,
      "construction/u1/infrastructure-design/cicd-pipeline.md": LAYER_STRUCTURE.replace(
        "store_semantics: upsert",
        "store_semantics: insert-only",
      ),
    });
    const { verdict } = runSensor(
      "design-advisories",
      "infrastructure-design",
      record,
      "construction/u1/infrastructure-design/cicd-pipeline.md",
    );
    expect(ruleIds(verdict)).toContain("design-advisories.store-upsert");
    expect(verdict.pass).toBe(false);
    expect(verdict.findings[0].file).toBe("construction/u1/infrastructure-design/cicd-pipeline.md");
  });

  test("reports a layer declaration it cannot read in the current format", () => {
    const record = makeRecord({
      "inception/ddd-domain-modeling/ddd-domain-model-yaml.md": LEGACY_MODEL,
      "construction/u1/infrastructure-design/cicd-pipeline.md": LAYER_STRUCTURE,
    });
    const { verdict } = runSensor(
      "design-advisories",
      "infrastructure-design",
      record,
      "construction/u1/infrastructure-design/cicd-pipeline.md",
    );
    expect(verdict.pass).toBe(false);
    expect(new Set(ruleIds(verdict))).toEqual(new Set(["design-advisories.document"]));
  });
});

describe("determinism", () => {
  test("model-completeness is byte-identical across three runs", () => {
    const record = makeRecord({
      "inception/ddd-domain-modeling/ddd-domain-model-yaml.md": MODEL,
      "inception/ddd-domain-modeling/ddd-domain-model.md": MODEL_MD.replaceAll("primitive.money", ""),
    });
    const script = join(toolsDir, "ddd-sensor-model-completeness.ts");
    const output = join(record, "inception/ddd-domain-modeling/ddd-domain-model-yaml.md");
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
