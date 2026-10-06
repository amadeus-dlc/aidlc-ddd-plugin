import { rustBehaviorSamples } from "../fixtures/rust-behavior/sample.ts";
import { generationSamples } from "../fixtures/typescript-generation/samples.ts";
import type { GoldenCase } from "./runner.ts";

const MAPPING = "inception/domain-design/ddd-aggregate-mapping.md";
const LAYER = "construction/u1/infrastructure-design/cicd-pipeline.md";
const SOURCE_MANIFEST = "construction/u1/code-generation/source-manifest.json";
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
  // A method that takes an instance of its own type evolves it and is no auxiliary constructor; one that only
  // holds the type inside a collection is still one, and nothing connects it to the primary constructor.
  variant(sample.domainCase, `${prefix}-aux-replay-collection`, "primary-constructor", (c) =>
    replace(
      c,
      money,
      `${stat}of(value: number): Money {`,
      `${stat}replay(snapshots: readonly Money[]): Money { throw new Error("none"); }${comma}\n  ${stat}of(value: number): Money {`,
    ),
  );
  variant(sample.domainCase, `${prefix}-aux-replay-snapshot`, undefined, (c) =>
    replace(
      c,
      money,
      `${stat}of(value: number): Money {`,
      `${stat}replay(snapshot: Money): Money { return snapshot; }${comma}\n  ${stat}of(value: number): Money {`,
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
  const port = "/src/invoice-repository.ts";
  const store = "store(event: InvoiceEvent, snapshot: Invoice): Result<void, RepositoryError>;";
  variant(sample.useCaseCase, `${prefix}-event-store-id-event`, "event-sourcing-store", (c) =>
    replace(c, port, store, "store(invoiceId: string, event: InvoiceEvent): Result<void, RepositoryError>;"),
  );
  variant(sample.useCaseCase, `${prefix}-event-store-event-only`, "event-sourcing-store", (c) =>
    replace(c, port, store, "store(event: InvoiceEvent): Result<void, RepositoryError>;"),
  );
  variant(sample.useCaseCase, `${prefix}-event-store-swapped`, "event-sourcing-store", (c) =>
    replace(c, port, store, "store(snapshot: Invoice, event: InvoiceEvent): Result<void, RepositoryError>;"),
  );
  variant(sample.useCaseCase, `${prefix}-event-store-aggregate-twice`, "event-sourcing-store", (c) =>
    replace(c, port, store, "store(event: Invoice, snapshot: Invoice): Result<void, RepositoryError>;"),
  );
  variant(sample.interfaceAdapterCase, `${prefix}-event-storage-clean`, undefined, (c) => memory(c, "typescript"));
  const adapter = "/src/in-memory-invoice-repository.ts";
  const streams = "readonly #events: Map<string, readonly InvoiceEvent[]> = new Map();";
  const snapshots = "readonly #snapshots: Map<string, Invoice> = new Map();";
  variant(sample.interfaceAdapterCase, `${prefix}-event-storage-no-snapshots`, "event-sourcing-storage", (c) => {
    memory(c, "typescript");
    replace(c, adapter, snapshots, "");
  });
  variant(sample.interfaceAdapterCase, `${prefix}-event-storage-two-snapshots`, "event-sourcing-storage", (c) => {
    memory(c, "typescript");
    replace(c, adapter, snapshots, `${snapshots}\n  readonly #latest: Map<string, Invoice> = new Map();`);
  });
  variant(sample.interfaceAdapterCase, `${prefix}-event-storage-two-streams`, "event-sourcing-storage", (c) => {
    memory(c, "typescript");
    replace(c, adapter, streams, `${streams}\n  readonly #archive: Map<string, readonly InvoiceEvent[]> = new Map();`);
  });
  variant(sample.interfaceAdapterCase, `${prefix}-event-storage-wrapper`, "event-sourcing-storage", (c) => {
    memory(c, "typescript");
    replace(c, adapter, snapshots, "readonly #snapshots: Map<string, StoredInvoice> = new Map();");
    replace(
      c,
      adapter,
      "export class InMemoryInvoiceRepository",
      "type StoredInvoice = { readonly invoice: Invoice };\n\nexport class InMemoryInvoiceRepository",
    );
  });
  variant(sample.interfaceAdapterCase, `${prefix}-adapter-surface-accessor`, "repository-adapter-surface", (c) => {
    memory(c, "typescript");
    replace(
      c,
      adapter,
      "  findById(invoiceId: string)",
      "  eventsFor(invoiceId: string): readonly InvoiceEvent[] {\n    return this.#events.get(invoiceId) ?? [];\n  }\n\n  findById(invoiceId: string)",
    );
  });
  variant(sample.interfaceAdapterCase, `${prefix}-adapter-surface-field`, "repository-adapter-surface", (c) => {
    memory(c, "typescript");
    replace(c, adapter, "readonly #snapshotInterval: number;", "readonly snapshotInterval: number;");
  });
  // The first parameter of `store` is the aggregate's event: `<Aggregate>Event`, an event the model declares for it,
  // or an import of either under another name; a business error type of the same package is none.
  const domainImport = 'import type { Invoice, InvoiceEvent } from "@acme/billing-domain";';
  variant(sample.useCaseCase, `${prefix}-event-store-error-type`, "event-sourcing-store", (c) => {
    replace(
      c,
      port,
      domainImport,
      'import type { Invoice, InvoiceEvent, OpenInvoiceError } from "@acme/billing-domain";',
    );
    replace(c, port, store, "store(event: OpenInvoiceError, snapshot: Invoice): Result<void, RepositoryError>;");
  });
  variant(sample.useCaseCase, `${prefix}-event-store-model-event`, undefined, (c) => {
    replace(c, port, domainImport, 'import type { Invoice, InvoiceEvent, Issued } from "@acme/billing-domain";');
    replace(c, port, store, "store(event: Issued, snapshot: Invoice): Result<void, RepositoryError>;");
  });
  variant(sample.useCaseCase, `${prefix}-event-store-aliased-event`, undefined, (c) => {
    replace(c, port, domainImport, 'import type { Invoice, InvoiceEvent as Event } from "@acme/billing-domain";');
    replace(c, port, store, "store(event: Event, snapshot: Invoice): Result<void, RepositoryError>;");
  });
  variant(sample.useCaseCase, `${prefix}-event-store-aliased-error`, "event-sourcing-store", (c) => {
    replace(c, port, domainImport, 'import type { Invoice, OpenInvoiceError as Event } from "@acme/billing-domain";');
    replace(c, port, store, "store(event: Event, snapshot: Invoice): Result<void, RepositoryError>;");
  });
  // An adapter is judged by the port its `implements` resolves to, not by how the name is spelled.
  const portImport = 'import type { InvoiceRepository, RepositoryError } from "@acme/billing-use-case";';
  const aliasPort = (c: GoldenCase) => {
    replace(
      c,
      adapter,
      portImport,
      'import type { InvoiceRepository as Port, RepositoryError } from "@acme/billing-use-case";',
    );
    replace(c, adapter, "implements InvoiceRepository", "implements Port");
  };
  const accessor = (c: GoldenCase) =>
    replace(
      c,
      adapter,
      "  findById(invoiceId: string)",
      "  eventsFor(invoiceId: string): readonly InvoiceEvent[] {\n    return this.#events.get(invoiceId) ?? [];\n  }\n\n  findById(invoiceId: string)",
    );
  variant(sample.interfaceAdapterCase, `${prefix}-adapter-surface-port-alias`, undefined, aliasPort);
  variant(sample.interfaceAdapterCase, `${prefix}-adapter-surface-port-alias`, "repository-adapter-surface", (c) => {
    aliasPort(c);
    accessor(c);
  });
  variant(
    sample.interfaceAdapterCase,
    `${prefix}-adapter-surface-port-namespace`,
    "repository-adapter-surface",
    (c) => {
      replace(
        c,
        adapter,
        portImport,
        'import type * as useCase from "@acme/billing-use-case";\nimport type { RepositoryError } from "@acme/billing-use-case";',
      );
      replace(c, adapter, "implements InvoiceRepository", "implements useCase.InvoiceRepository");
      accessor(c);
    },
  );
  // The two Event Sourcing maps are required of an adapter however its port is spelled.
  variant(sample.interfaceAdapterCase, `${prefix}-event-storage-port-alias`, undefined, (c) => {
    memory(c, "typescript");
    aliasPort(c);
  });
  variant(
    sample.interfaceAdapterCase,
    `${prefix}-event-storage-port-alias-no-snapshots`,
    "event-sourcing-storage",
    (c) => {
      memory(c, "typescript");
      aliasPort(c);
      replace(c, adapter, snapshots, "");
    },
  );
  variant(
    sample.interfaceAdapterCase,
    `${prefix}-event-storage-port-alias-two-snapshots`,
    "event-sourcing-storage",
    (c) => {
      memory(c, "typescript");
      aliasPort(c);
      replace(c, adapter, snapshots, `${snapshots}\n  readonly #latest: Map<string, Invoice> = new Map();`);
    },
  );
  // A port named through an alias of one named type is followed to the port it names.
  const aliasInFile = (c: GoldenCase) => {
    replace(
      c,
      adapter,
      "export class InMemoryInvoiceRepository",
      "type Port = InvoiceRepository;\n\nexport class InMemoryInvoiceRepository",
    );
    replace(c, adapter, "implements InvoiceRepository", "implements Port");
  };
  const aliasImported = (c: GoldenCase) => {
    replace(
      c,
      port,
      "export interface InvoiceRepository {",
      "export type Port = InvoiceRepository;\n\nexport interface InvoiceRepository {",
    );
    replace(
      c,
      "billing-use-case/src/index.ts",
      "export type { InvoiceRepository, RepositoryError }",
      "export type { InvoiceRepository, Port, RepositoryError }",
    );
    replace(c, adapter, portImport, 'import type { Port, RepositoryError } from "@acme/billing-use-case";');
    replace(c, adapter, "implements InvoiceRepository", "implements Port");
  };
  variant(sample.interfaceAdapterCase, `${prefix}-adapter-surface-port-type-alias`, undefined, aliasInFile);
  variant(
    sample.interfaceAdapterCase,
    `${prefix}-adapter-surface-port-type-alias`,
    "repository-adapter-surface",
    (c) => {
      aliasInFile(c);
      accessor(c);
    },
  );
  // An alias the adapter package declares in a source of its own is followed too, once that source is read.
  const aliasInPackage = (c: GoldenCase) => {
    const file = Object.keys(workspace(c)).find((path) => path.endsWith(adapter));
    if (!file) throw new Error(`missing ${adapter}`);
    const child = file.replace(/in-memory-invoice-repository\.ts$/, "port.ts");
    workspace(c)[child] =
      'import type { InvoiceRepository } from "@acme/billing-use-case";\n\nexport type Port = InvoiceRepository;\n';
    replace(
      c,
      adapter,
      portImport,
      'import type { RepositoryError } from "@acme/billing-use-case";\nimport type { Port } from "./port.ts";',
    );
    replace(c, adapter, "implements InvoiceRepository", "implements Port");
    const manifest = JSON.parse(c.files[SOURCE_MANIFEST]) as { writes: { path: string }[] };
    manifest.writes.push({ path: child });
    c.files[SOURCE_MANIFEST] = JSON.stringify(manifest);
  };
  variant(sample.interfaceAdapterCase, `${prefix}-adapter-surface-package-port-type-alias`, undefined, aliasInPackage);
  variant(
    sample.interfaceAdapterCase,
    `${prefix}-adapter-surface-package-port-type-alias`,
    "repository-adapter-surface",
    (c) => {
      aliasInPackage(c);
      accessor(c);
    },
  );
  variant(sample.interfaceAdapterCase, `${prefix}-adapter-surface-imported-port-type-alias`, undefined, aliasImported);
  variant(
    sample.interfaceAdapterCase,
    `${prefix}-adapter-surface-imported-port-type-alias`,
    "repository-adapter-surface",
    (c) => {
      aliasImported(c);
      accessor(c);
    },
  );
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
variant(rust.domainCase, "construction-rust-aux-replay-reference", "primary-constructor", (c) =>
  replace(c, "/src/money.rs", "impl Money {", "impl Money { pub fn replay(snapshot: &Money) -> Self { *snapshot }"),
);
variant(rust.domainCase, "construction-rust-aux-replay-snapshot", undefined, (c) =>
  replace(c, "/src/money.rs", "impl Money {", "impl Money { pub fn replay(snapshot: Self) -> Self { snapshot }"),
);
// A parameter is the type itself when it is `Self`, or a name or alias that leads to it; an alias of a wrapper is not.
variant(rust.domainCase, "construction-rust-aux-replay-aliased-snapshot", undefined, (c) =>
  replace(
    c,
    "/src/money.rs",
    "impl Money {",
    "type Snap = Money;\n\nimpl Money { pub fn replay(snapshot: Snap) -> Self { snapshot }",
  ),
);
variant(rust.domainCase, "construction-rust-aux-replay-aliased-optional", "primary-constructor", (c) =>
  replace(
    c,
    "/src/money.rs",
    "impl Money {",
    "type Snap = Option<Money>;\n\nimpl Money { pub fn replay(snapshot: Snap) -> Self { snapshot.unwrap() }",
  ),
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
const rustStore = "fn store(&mut self, event: InvoiceEvent, snapshot: Invoice) -> Result<(), RepositoryError>;";
variant(rust.useCaseCase, "construction-rust-event-store-id-event", "event-sourcing-store", (c) =>
  replace(
    c,
    "/src/invoice_repository.rs",
    rustStore,
    "fn store(&mut self, invoice_id: &str, event: InvoiceEvent) -> Result<(), RepositoryError>;",
  ),
);
variant(rust.useCaseCase, "construction-rust-event-store-event-only", "event-sourcing-store", (c) =>
  replace(
    c,
    "/src/invoice_repository.rs",
    rustStore,
    "fn store(&mut self, event: InvoiceEvent) -> Result<(), RepositoryError>;",
  ),
);
variant(rust.useCaseCase, "construction-rust-event-store-swapped", "event-sourcing-store", (c) =>
  replace(
    c,
    "/src/invoice_repository.rs",
    rustStore,
    "fn store(&mut self, snapshot: Invoice, event: InvoiceEvent) -> Result<(), RepositoryError>;",
  ),
);
variant(rust.useCaseCase, "construction-rust-event-store-aggregate-twice", "event-sourcing-store", (c) =>
  replace(
    c,
    "/src/invoice_repository.rs",
    rustStore,
    "fn store(&mut self, event: Invoice, snapshot: Invoice) -> Result<(), RepositoryError>;",
  ),
);
const rustPort = "/src/invoice_repository.rs";
const rustTrait = "pub trait InvoiceRepository {";
const rustPortCase = (name: string, rule: string | undefined, signature: string, imports?: [string, string]) =>
  variant(rust.useCaseCase, `construction-rust-event-store-${name}`, rule, (c) => {
    if (imports) replace(c, rustPort, imports[0], imports[1]);
    replace(c, rustPort, rustStore, signature);
  });
rustPortCase(
  "borrowed-lifetime",
  undefined,
  "fn store<'a>(&mut self, event: &'a InvoiceEvent, snapshot: &'a Invoice) -> Result<(), RepositoryError>;",
);
rustPortCase(
  "borrowed-mutable",
  undefined,
  "fn store(&mut self, event: &mut InvoiceEvent, snapshot: &mut Invoice) -> Result<(), RepositoryError>;",
);
rustPortCase(
  "borrowed-slice",
  "event-sourcing-store",
  "fn store<'a>(&mut self, event: &'a [InvoiceEvent], snapshot: &'a Invoice) -> Result<(), RepositoryError>;",
);
rustPortCase(
  "qualified",
  undefined,
  "fn store(&mut self, event: billing_domain::invoice::InvoiceEvent, snapshot: billing_domain::invoice::Invoice) -> Result<(), RepositoryError>;",
);
rustPortCase(
  "collected-event",
  "event-sourcing-store",
  "fn store(&mut self, event: Vec<InvoiceEvent>, snapshot: Invoice) -> Result<(), RepositoryError>;",
);
rustPortCase(
  "optional-snapshot",
  "event-sourcing-store",
  "fn store(&mut self, event: InvoiceEvent, snapshot: Option<Invoice>) -> Result<(), RepositoryError>;",
);
rustPortCase(
  "error-type",
  "event-sourcing-store",
  "fn store(&mut self, event: billing_domain::invoice::OpenInvoiceError, snapshot: Invoice) -> Result<(), RepositoryError>;",
);
// A type alias is followed to what it names: one that stands for a collection or an `Option` is no event or snapshot.
const rustAlias = (alias: string): [string, string] => [rustTrait, `${alias}\n\n${rustTrait}`];
rustPortCase(
  "aliased-event",
  undefined,
  "fn store(&mut self, event: Event, snapshot: Invoice) -> Result<(), RepositoryError>;",
  rustAlias("type Event = InvoiceEvent;"),
);
rustPortCase(
  "aliased-snapshot",
  undefined,
  "fn store(&mut self, event: InvoiceEvent, snapshot: Snapshot) -> Result<(), RepositoryError>;",
  rustAlias("type Snapshot = Invoice;"),
);
rustPortCase(
  "aliased-collection",
  "event-sourcing-store",
  "fn store(&mut self, event: EventBatch, snapshot: Invoice) -> Result<(), RepositoryError>;",
  rustAlias("type EventBatch = Vec<InvoiceEvent>;"),
);
rustPortCase(
  "aliased-optional-snapshot",
  "event-sourcing-store",
  "fn store(&mut self, event: InvoiceEvent, snapshot: Snapshot) -> Result<(), RepositoryError>;",
  rustAlias("type Snapshot = Option<Invoice>;"),
);
rustPortCase(
  "model-event",
  undefined,
  "fn store(&mut self, event: billing_domain::invoice::Issued, snapshot: Invoice) -> Result<(), RepositoryError>;",
);
variant(rust.useCaseCase, "construction-rust-event-store-borrowed", undefined, (c) =>
  replace(
    c,
    "/src/invoice_repository.rs",
    rustStore,
    "fn store(&mut self, event: &InvoiceEvent, snapshot: &Invoice) -> Result<(), RepositoryError>;",
  ),
);
variant(rust.interfaceAdapterCase, "construction-rust-event-storage-clean", undefined, (c) => memory(c, "rust"));
const rustAdapter = "/src/in_memory_invoice_repository.rs";
const rustStreams = "    events: HashMap<String, Vec<InvoiceEvent>>,";
const rustSnapshots = "    snapshots: HashMap<String, Invoice>,";
variant(rust.interfaceAdapterCase, "construction-rust-event-storage-no-snapshots", "event-sourcing-storage", (c) => {
  memory(c, "rust");
  replace(c, rustAdapter, `${rustSnapshots}\n`, "");
});
variant(rust.interfaceAdapterCase, "construction-rust-event-storage-two-snapshots", "event-sourcing-storage", (c) => {
  memory(c, "rust");
  replace(c, rustAdapter, rustSnapshots, `${rustSnapshots}\n    latest: HashMap<String, Invoice>,`);
});
variant(rust.interfaceAdapterCase, "construction-rust-event-storage-two-streams", "event-sourcing-storage", (c) => {
  memory(c, "rust");
  replace(c, rustAdapter, rustStreams, `${rustStreams}\n    archive: HashMap<String, Vec<InvoiceEvent>>,`);
});
variant(rust.interfaceAdapterCase, "construction-rust-event-storage-wrapper", "event-sourcing-storage", (c) => {
  memory(c, "rust");
  replace(c, rustAdapter, rustSnapshots, "    snapshots: HashMap<String, StoredInvoice>,");
  replace(
    c,
    rustAdapter,
    "pub struct InMemoryInvoiceRepository",
    "struct StoredInvoice {\n    invoice: Invoice,\n}\n\npub struct InMemoryInvoiceRepository",
  );
});
variant(rust.interfaceAdapterCase, "construction-rust-adapter-surface-accessor", "repository-adapter-surface", (c) => {
  memory(c, "rust");
  replace(
    c,
    rustAdapter,
    "impl InMemoryInvoiceRepository {",
    "impl InMemoryInvoiceRepository {\n    pub fn events_for(&self, invoice_id: &str) -> Vec<InvoiceEvent> {\n        self.events.get(invoice_id).cloned().unwrap_or_default()\n    }\n",
  );
});
variant(rust.interfaceAdapterCase, "construction-rust-adapter-surface-field", "repository-adapter-surface", (c) => {
  memory(c, "rust");
  replace(c, rustAdapter, "    snapshot_interval: u64,", "    pub snapshot_interval: u64,");
});
variant(
  rust.interfaceAdapterCase,
  "construction-rust-event-storage-optional-snapshots",
  "event-sourcing-storage",
  (c) => {
    memory(c, "rust");
    replace(c, rustAdapter, rustSnapshots, "    snapshots: HashMap<String, Option<Invoice>>,");
  },
);
const rustStruct = "pub struct InMemoryInvoiceRepository";
const withAlias = (c: GoldenCase, alias: string) => replace(c, rustAdapter, rustStruct, `${alias}\n\n${rustStruct}`);
variant(rust.interfaceAdapterCase, "construction-rust-event-storage-aliased-snapshots", undefined, (c) => {
  memory(c, "rust");
  withAlias(c, "type Snapshot = billing_domain::invoice::Invoice;");
  replace(c, rustAdapter, rustSnapshots, "    snapshots: HashMap<String, Snapshot>,");
});
variant(
  rust.interfaceAdapterCase,
  "construction-rust-event-storage-aliased-optional-snapshots",
  "event-sourcing-storage",
  (c) => {
    memory(c, "rust");
    withAlias(c, "type Snapshot = Option<Invoice>;");
    replace(c, rustAdapter, rustSnapshots, "    snapshots: HashMap<String, Snapshot>,");
  },
);
const createCopies = (c: GoldenCase, alias: string, body: string) => {
  withAlias(c, alias);
  const inherent = "impl InMemoryInvoiceRepository {";
  replace(
    c,
    rustAdapter,
    inherent,
    `${inherent}\n    pub fn create(snapshot_interval: u64) -> Created {\n        ${body}\n    }\n`,
  );
};
variant(rust.interfaceAdapterCase, "construction-rust-adapter-surface-aliased-constructor", undefined, (c) =>
  createCopies(c, "type Created = InMemoryInvoiceRepository;", "Self::new(snapshot_interval)"),
);
variant(
  rust.interfaceAdapterCase,
  "construction-rust-adapter-surface-aliased-constructor",
  "repository-adapter-surface",
  (c) => createCopies(c, "type Created = Vec<InMemoryInvoiceRepository>;", "Vec::new()"),
);
variant(rust.interfaceAdapterCase, "construction-rust-event-storage-qualified-snapshots", undefined, (c) => {
  memory(c, "rust");
  replace(c, rustAdapter, rustSnapshots, "    snapshots: HashMap<String, billing_domain::invoice::Invoice>,");
});
// An adapter is judged by what its `impl` resolves to, not by how the type or the trait is spelled.
const rustInherent = "impl InMemoryInvoiceRepository {";
const rustEventsFor =
  "\n    pub fn events_for(&self, invoice_id: &str) -> Vec<InvoiceEvent> {\n        self.events.get(invoice_id).cloned().unwrap_or_default()\n    }\n";
const qualifyTarget = (c: GoldenCase, extra = "") => {
  replace(c, rustAdapter, rustInherent, `impl self::InMemoryInvoiceRepository {${extra}`);
  replace(
    c,
    rustAdapter,
    "impl InvoiceRepository for InMemoryInvoiceRepository {",
    "impl InvoiceRepository for self::InMemoryInvoiceRepository {",
  );
};
const aliasTrait = (c: GoldenCase) => {
  replace(
    c,
    rustAdapter,
    "use billing_use_case::invoice_repository::{InvoiceRepository, RepositoryError};",
    "use billing_use_case::invoice_repository::{InvoiceRepository as Port, RepositoryError};",
  );
  replace(
    c,
    rustAdapter,
    "impl InvoiceRepository for InMemoryInvoiceRepository {",
    "impl Port for InMemoryInvoiceRepository {",
  );
};
variant(rust.interfaceAdapterCase, "construction-rust-adapter-surface-qualified-target", undefined, (c) =>
  qualifyTarget(c),
);
variant(
  rust.interfaceAdapterCase,
  "construction-rust-adapter-surface-qualified-target",
  "repository-adapter-surface",
  (c) => qualifyTarget(c, rustEventsFor),
);
variant(rust.interfaceAdapterCase, "construction-rust-adapter-surface-port-alias", undefined, (c) => aliasTrait(c));
variant(
  rust.interfaceAdapterCase,
  "construction-rust-adapter-surface-port-alias",
  "repository-adapter-surface",
  (c) => {
    aliasTrait(c);
    replace(c, rustAdapter, "    snapshot_interval: u64,", "    pub snapshot_interval: u64,");
  },
);
variant(
  rust.interfaceAdapterCase,
  "construction-rust-adapter-surface-optional-constructor",
  "repository-adapter-surface",
  (c) =>
    replace(
      c,
      rustAdapter,
      rustInherent,
      `${rustInherent}\n    pub fn try_new(snapshot_interval: u64) -> Option<Self> {\n        None\n    }\n`,
    ),
);
// The two Event Sourcing maps are required of an adapter however its trait or its type is spelled.
for (const [spelling, spell] of [
  ["port-alias", aliasTrait],
  ["qualified-target", (c: GoldenCase) => qualifyTarget(c)],
] as const) {
  variant(rust.interfaceAdapterCase, `construction-rust-event-storage-${spelling}`, undefined, (c) => {
    memory(c, "rust");
    spell(c);
  });
  variant(
    rust.interfaceAdapterCase,
    `construction-rust-event-storage-${spelling}-no-snapshots`,
    "event-sourcing-storage",
    (c) => {
      memory(c, "rust");
      spell(c);
      replace(c, rustAdapter, `${rustSnapshots}\n`, "");
    },
  );
  variant(
    rust.interfaceAdapterCase,
    `construction-rust-event-storage-${spelling}-two-snapshots`,
    "event-sourcing-storage",
    (c) => {
      memory(c, "rust");
      spell(c);
      replace(c, rustAdapter, rustSnapshots, `${rustSnapshots}\n    latest: HashMap<String, Invoice>,`);
    },
  );
}
// A trait impl in a child file still makes its struct a repository adapter, and the struct's file is the one reported.
const childImpl = (c: GoldenCase) => {
  const file = Object.keys(workspace(c)).find((path) => path.endsWith(rustAdapter));
  if (!file) throw new Error(`missing ${rustAdapter}`);
  const text = workspace(c)[file];
  const impl = "impl InvoiceRepository for InMemoryInvoiceRepository {";
  const at = text.indexOf(impl);
  if (at === -1) throw new Error(`missing ${impl}`);
  const child = file.replace(/\.rs$/, "/port.rs");
  workspace(c)[file] = `mod port;\n\n${text.slice(0, at)}`;
  workspace(c)[child] =
    `use billing_domain::invoice::{Invoice, InvoiceEvent};\nuse billing_use_case::invoice_repository::{InvoiceRepository, RepositoryError};\n\nuse super::InMemoryInvoiceRepository;\n\n${text.slice(at)}`;
  const manifest = JSON.parse(c.files[SOURCE_MANIFEST]) as { writes: { path: string }[] };
  manifest.writes.push({ path: child });
  c.files[SOURCE_MANIFEST] = JSON.stringify(manifest);
};
variant(rust.interfaceAdapterCase, "construction-rust-adapter-surface-child-impl", undefined, (c) => childImpl(c));
variant(
  rust.interfaceAdapterCase,
  "construction-rust-adapter-surface-child-impl",
  "repository-adapter-surface",
  (c) => {
    childImpl(c);
    replace(c, rustAdapter, "    snapshot_interval: u64,", "    pub snapshot_interval: u64,");
  },
);
variant(
  rust.interfaceAdapterCase,
  "construction-rust-adapter-surface-child-impl-accessor",
  "repository-adapter-surface",
  (c) => {
    childImpl(c);
    replace(c, rustAdapter, rustInherent, `${rustInherent}${rustEventsFor}`);
  },
);
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
});
variant(rust.interfaceAdapterCase, "construction-rust-state-storage-record", "in-memory-restoration", (c) => {
  memory(c, "rust");
  c.files[MAPPING] = c.files[MAPPING].replace(
    "persistence_method: event-sourcing",
    "persistence_method: state-sourcing",
  );
});
export const CONSTRUCTION_CASES = cases;
