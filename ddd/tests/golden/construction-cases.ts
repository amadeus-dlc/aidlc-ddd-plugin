import { rustBehaviorSamples } from "../fixtures/rust-behavior/sample.ts";
import { generationSamples } from "../fixtures/typescript-generation/samples.ts";
import type { GoldenCase } from "./runner.ts";

const MAPPING = "inception/domain-design/ddd-aggregate-mapping.md";
const LAYER = "construction/u1/infrastructure-design/cicd-pipeline.md";
const cases: GoldenCase[] = [];
function workspace(entry: GoldenCase): Record<string, string> {
  if (!entry.workspace) throw new Error(`missing workspace ${entry.name}`);
  return entry.workspace;
}
function variant(
  base: GoldenCase,
  name: string,
  rule: string | undefined,
  edit?: (entry: GoldenCase) => void,
): GoldenCase {
  const entry = structuredClone(base);
  entry.name = `${rule ? "violation" : "clean"}-${name}`;
  entry.expect = { pass: rule === undefined, rules: rule ? [rule] : [] };
  if (rule) {
    const language = entry.sensor.includes("-rust-") ? "rust" : "typescript";
    const suffix = entry.sensor.endsWith("-domain")
      ? `/src/money.${language === "rust" ? "rs" : "ts"}`
      : entry.sensor.endsWith("-use-case")
        ? `/src/invoice${language === "rust" ? "_" : "-"}repository.${language === "rust" ? "rs" : "ts"}`
        : `/src/in${language === "rust" ? "_" : "-"}memory${language === "rust" ? "_" : "-"}invoice${language === "rust" ? "_" : "-"}repository.${language === "rust" ? "rs" : "ts"}`;
    const file = Object.keys(workspace(entry)).find((path) => path.endsWith(suffix));
    if (!file) throw new Error(`missing finding file ${suffix}`);
    entry.expect.files = { [rule]: file };
  }
  edit?.(entry);
  cases.push(entry);
  return entry;
}
function replace(entry: GoldenCase, suffix: string, before: string, after: string): void {
  const file = Object.keys(workspace(entry)).find((path) => path.endsWith(suffix));
  if (!file || !workspace(entry)[file].includes(before)) throw new Error(`missing ${entry.name}: ${suffix}: ${before}`);
  workspace(entry)[file] = workspace(entry)[file].replace(before, after);
}
function memory(entry: GoldenCase, language: "rust" | "typescript"): void {
  const pkg = language === "rust" ? "billing-interface-adapter" : "@acme/billing-interface-adapter";
  entry.files[LAYER] = `# Pipeline\n\n## DDD Layer Structure\n\n\`\`\`yaml
schema_version: 2
model_ref: inception/ddd-domain-modeling/ddd-domain-model-yaml.md
layer_structures:
  - context_ref: bc.billing
    cqrs: false
    persistence_backend: in-memory
    packages: [{ role: command, code: { language: ${language}, package: "${pkg}" } }]
    dependencies: [{ code: { language: ${language}, package: "${pkg}" }, depends_on: [] }]
    ports: [{ name: InvoiceRepository, kind: repository, verbs: [find, store] }]
    repositories: [{ name: InvoiceRepository, aggregate_ref: aggregate.invoice, io_unit: single, verbs: [find, store], store_semantics: insert-only }]
    restoration_paths: [{ aggregate_ref: aggregate.invoice, via: full-constructor }]
\`\`\`\n`;
}
for (const sample of generationSamples().filter((entry) => entry.layout === "named-file")) {
  const repr = sample.representation;
  const prefix = `construction-${repr}`;
  const stat = repr === "class" ? "static " : "";
  const comma = repr === "class" ? "" : ",";
  const money = "/src/money.ts";
  variant(sample.domainCase, `${prefix}-clean`, undefined);
  variant(sample.domainCase, `${prefix}-missing-of`, "primitive-initialization", (c) => {
    replace(c, money, `${stat}of(value: number)`, `${stat}checked(value: number)`);
    const file = Object.keys(workspace(c)).find((path) => path.endsWith(money));
    if (file) workspace(c)[file] = workspace(c)[file].replaceAll("Money.of(", "Money.checked(");
  });
  variant(sample.domainCase, `${prefix}-missing-parse`, "primitive-initialization", (c) => {
    replace(c, money, `${stat}parse(value: number)`, `${stat}uncheckedParse(value: number)`);
    replace(c, money, "Money.parse(value)", "Money.uncheckedParse(value)");
  });
  variant(sample.domainCase, `${prefix}-guard-bypass`, "primitive-initialization", (c) =>
    replace(c, money, '    if (!Number.isFinite(value)) return { ok: false, error: "non-finite-amount" };', ""),
  );
  variant(sample.domainCase, `${prefix}-factory-copy`, "factory-naming", (c) =>
    replace(
      c,
      money,
      `${stat}of(value: number): Money {`,
      `${stat}from(value: Money): Money { return Money.of(0); }${comma}\n  ${stat}of(value: number): Money {`,
    ),
  );
  variant(sample.domainCase, `${prefix}-aux-cycle`, "primary-constructor", (c) =>
    replace(
      c,
      money,
      `${stat}of(value: number): Money {`,
      `${stat}cycleOne(): Money { return Money.cycleTwo(); }${comma}\n  ${stat}cycleTwo(): Money { return Money.cycleOne(); }${comma}\n  ${stat}of(value: number): Money {`,
    ),
  );
  variant(sample.domainCase, `${prefix}-aux-unconnected`, "primary-constructor", (c) =>
    replace(
      c,
      money,
      `${stat}of(value: number): Money {`,
      `${stat}unconnected(): Money { throw new Error("unconnected"); }${comma}\n  ${stat}of(value: number): Money {`,
    ),
  );
  variant(sample.domainCase, `${prefix}-aux-chain`, undefined, (c) =>
    replace(
      c,
      money,
      `${stat}of(value: number): Money {`,
      `${stat}fromText(value: string): Money { return Money.of(Number(value)); }${comma}\n  ${stat}of(value: number): Money {`,
    ),
  );
  variant(sample.useCaseCase, `${prefix}-repository-clean`, undefined);
  variant(sample.useCaseCase, `${prefix}-repository-envelope`, "repository-result-contract", (c) =>
    replace(
      c,
      "/src/invoice-repository.ts",
      "Result<Invoice | undefined, RepositoryError>",
      "Result<string | undefined, RepositoryError>",
    ),
  );
  variant(sample.useCaseCase, `${prefix}-repository-payload`, "repository-result-contract", (c) =>
    replace(c, "/src/invoice-repository.ts", "Result<void, RepositoryError>", "Result<Invoice, RepositoryError>"),
  );
  variant(sample.interfaceAdapterCase, `${prefix}-event-storage-clean`, undefined, (c) => memory(c, "typescript"));
  variant(sample.interfaceAdapterCase, `${prefix}-event-storage-state`, "event-sourcing-storage", (c) => {
    memory(c, "typescript");
    replace(c, "/src/in-memory-invoice-repository.ts", "Map<string, readonly InvoiceEvent[]>", "Map<string, Invoice>");
  });
  variant(sample.interfaceAdapterCase, `${prefix}-state-storage-clean`, undefined, (c) => {
    memory(c, "typescript");
    c.files[MAPPING] = c.files[MAPPING].replace(
      "persistence_method: event-sourcing",
      "persistence_method: state-sourcing",
    );
    replace(c, "/src/in-memory-invoice-repository.ts", "Map<string, readonly InvoiceEvent[]>", "Map<string, Invoice>");
    replace(c, "/src/in-memory-invoice-repository.ts", "Invoice.restore(events)", "events");
  });
  variant(sample.interfaceAdapterCase, `${prefix}-state-storage-record`, "in-memory-restoration", (c) => {
    memory(c, "typescript");
    c.files[MAPPING] = c.files[MAPPING].replace(
      "persistence_method: event-sourcing",
      "persistence_method: state-sourcing",
    );
  });
}
const rust = rustBehaviorSamples().find((entry) => entry.layout === "file");
if (!rust) throw new Error("missing Rust construction sample");
variant(rust.domainCase, "construction-rust-clean", undefined);
variant(rust.domainCase, "construction-rust-missing-of", "primitive-initialization", (c) => {
  replace(c, "/src/money.rs", "pub fn of(value:", "pub fn checked(value:");
  const file = Object.keys(workspace(c)).find((path) => path.endsWith("/src/money.rs"));
  if (file) workspace(c)[file] = workspace(c)[file].replaceAll("Self::of(", "Self::checked(");
});
variant(rust.domainCase, "construction-rust-guard-bypass", "primitive-initialization", (c) =>
  replace(c, "/src/money.rs", "if !value.is_finite() { return Err(ParseMoneyError::NonFiniteAmount); }", ""),
);
variant(rust.domainCase, "construction-rust-factory-copy", "factory-naming", (c) =>
  replace(c, "/src/money.rs", "impl Money {", "impl Money { pub fn from(value: Money) -> Self { Self::of(0.0) }"),
);
variant(rust.domainCase, "construction-rust-aux-cycle", "primary-constructor", (c) =>
  replace(
    c,
    "/src/money.rs",
    "impl Money {",
    "impl Money { fn cycle_one() -> Self { Self::cycle_two() } fn cycle_two() -> Self { Self::cycle_one() }",
  ),
);
variant(rust.domainCase, "construction-rust-aux-unconnected", "primary-constructor", (c) =>
  replace(c, "/src/money.rs", "impl Money {", 'impl Money { fn unconnected() -> Self { panic!("unconnected") }'),
);
variant(rust.domainCase, "construction-rust-aux-chain", undefined, (c) =>
  replace(
    c,
    "/src/money.rs",
    "impl Money {",
    "impl Money { pub fn from_decimal(value: &str) -> Self { Self::of(value.parse().unwrap()) }",
  ),
);
variant(rust.useCaseCase, "construction-rust-repository-clean", undefined);
variant(rust.useCaseCase, "construction-rust-repository-envelope", "repository-result-contract", (c) =>
  replace(
    c,
    "/src/invoice_repository.rs",
    "Result<Option<Invoice>, RepositoryError>",
    "Result<Option<String>, RepositoryError>",
  ),
);
variant(rust.useCaseCase, "construction-rust-repository-payload", "repository-result-contract", (c) =>
  replace(c, "/src/invoice_repository.rs", "Result<(), RepositoryError>", "Result<Invoice, RepositoryError>"),
);
variant(rust.interfaceAdapterCase, "construction-rust-event-storage-clean", undefined, (c) => memory(c, "rust"));
variant(rust.interfaceAdapterCase, "construction-rust-event-storage-state", "event-sourcing-storage", (c) => {
  memory(c, "rust");
  replace(c, "/src/in_memory_invoice_repository.rs", "HashMap<String, Vec<InvoiceEvent>>", "HashMap<String, Invoice>");
});
variant(rust.interfaceAdapterCase, "construction-rust-state-storage-clean", undefined, (c) => {
  memory(c, "rust");
  c.files[MAPPING] = c.files[MAPPING].replace(
    "persistence_method: event-sourcing",
    "persistence_method: state-sourcing",
  );
  replace(c, "/src/in_memory_invoice_repository.rs", "HashMap<String, Vec<InvoiceEvent>>", "HashMap<String, Invoice>");
  replace(c, "/src/in_memory_invoice_repository.rs", "Invoice::restore(events)", "events.clone()");
});
variant(rust.interfaceAdapterCase, "construction-rust-state-storage-record", "in-memory-restoration", (c) => {
  memory(c, "rust");
  c.files[MAPPING] = c.files[MAPPING].replace(
    "persistence_method: event-sourcing",
    "persistence_method: state-sourcing",
  );
});
export const CONSTRUCTION_CASES = cases;
