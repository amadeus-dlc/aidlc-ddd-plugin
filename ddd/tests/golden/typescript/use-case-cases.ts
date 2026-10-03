/**
 * TypeScript use-case golden cases (T-11-03): the dependency direction and external I/O (g), an
 * aggregate handed to `execute` (h), one use case calling another (i) and getter calls (d), each over
 * the domain aggregate written as a `class` and as a companion, with the rule ids and finding
 * meanings of `ddd-rust-use-case`.
 */

import type { GoldenCase } from "../runner.ts";
import { INVOICE_REPOSITORY_PORT, SKIPPED_STATE } from "./cases.ts";
import {
  INFRASTRUCTURE,
  INTERFACE_ADAPTER,
  type LayerPackage,
  layerCase,
  REPRESENTATIONS,
  type Representation,
  useCasePackage,
} from "./layer-fixture.ts";

export const TYPESCRIPT_USE_CASE_SENSOR = "ddd-typescript-use-case";

const DOMAIN_IMPORT =
  'import { Invoice } from "@acme/billing-domain";\nimport type { InvoiceRepository } from "./invoice-repository.ts";\n';

/** A use-case function handed the aggregate and the repository port, with `body` as its statements. */
function repositoryRun(body: string): string {
  return `${DOMAIN_IMPORT}\nexport function run(invoice: Invoice, repo: InvoiceRepository): void {\n  ${body}\n}\n`;
}

/**
 * A use-case function whose switch forwards a getter result from a `const` of its first case clause,
 * then reads that `const` in a condition under `laterClause`.
 */
function caseRun(laterClause: string): string {
  return `${DOMAIN_IMPORT}\nexport function run(invoice: Invoice, repo: InvoiceRepository, mode: string): void {\n  switch (mode) {\n    case "a":\n      const id = invoice.id();\n      repo.remove(id);\n    ${laterClause}\n      if (id === "42") {\n      }\n  }\n}\n`;
}

const FINISH = "export class FinishInvoiceUseCase {\n  execute(): void {}\n}\n";

/**
 * Each Rust use-case case whose scene a TypeScript case repeats, by name, with the TypeScript case's
 * name less its representation suffix: one TypeScript case per representation answers for it.
 */
export const USE_CASE_RUST_COUNTERPARTS: Readonly<Record<string, string>> = {
  "violation-h": "violation-h",
  "violation-use-case-name": "violation-use-case-name",
  "clean-use-case-name-free-function": "clean-use-case-name-function",
  "violation-repository-result": "violation-repository-result",
  "clean-repository-result": "clean-repository-result",
  "violation-h-import-alias": "violation-h-import-alias",
  "clean-h-value-object": "clean-h-value-object",
  "clean-h-local-name-collision": "clean-h-local-name-collision",
  "violation-i": "violation-i",
  "violation-i-field-use-case": "violation-i-field",
  "violation-i-imported-use-case": "violation-i-imported",
  "clean-i-port-execute": "clean-i-port-execute",
  "clean-i-own-associated-call": "clean-i-own-call",
  "violation-d-getter-alias": "violation-d-alias",
  "clean-d-unrelated-getter-name": "clean-d-unrelated-getter-name",
  "clean-d-repository-argument": "clean-d-repository-argument",
  "clean-d-repository-local": "clean-d-repository-local",
  "clean-d-repository-local-alias": "clean-d-repository-local-alias",
  "clean-d-repository-multiple-uses": "clean-d-repository-multiple-uses",
  "clean-d-repository-local-shadow-safe": "clean-d-repository-local-shadow-safe",
  "clean-d-repository-import-alias": "clean-d-repository-import-alias",
  "clean-d-repository-field-port": "clean-d-repository-field-port",
  "clean-d-repository-use-case-port": "clean-d-repository-use-case-port",
  "violation-d-repository-arithmetic": "violation-d-repository-arithmetic",
  "violation-d-repository-business-branch": "violation-d-repository-business-branch",
  "violation-d-repository-transformation": "violation-d-repository-transformation",
  "violation-d-repository-local-business-use": "violation-d-repository-local-business-use",
  "violation-d-repository-local-unused": "violation-d-repository-local-unused",
  "violation-d-repository-local-mutable": "violation-d-repository-local-mutable",
  "violation-d-repository-local-shadow-business": "violation-d-repository-local-shadow-business",
  "violation-d-repository-unknown-method": "violation-d-repository-unknown-method",
  "violation-d-repository-unrelated-function": "violation-d-repository-unrelated-function",
  "violation-d-repository-unrelated-port": "violation-d-repository-unrelated-port",
  "violation-d-repository-mixed-consumers": "violation-d-repository-mixed-consumers",
  "violation-d-repository-name-collision": "violation-d-repository-name-collision",
  "clean-g-use-case-to-infrastructure-use": "clean-g-use-case-to-infrastructure-import",
  "clean-g-use-case-to-infrastructure-cargo": "clean-g-use-case-to-infrastructure-package-json",
  "violation-g-use-case-to-interface-adapter-use": "violation-g-use-case-to-interface-adapter-import",
  "violation-g-use-case-to-interface-adapter-cargo": "violation-g-use-case-to-interface-adapter-package-json",
  "violation-g-use-case-external-io-use": "violation-g-use-case-external-io",
};

/** Each scene: its name less the representation suffix, the use-case package, others, and the verdict. */
type Scene = readonly [string, LayerPackage, readonly LayerPackage[], GoldenCase["expect"]];

const pass: GoldenCase["expect"] = { pass: true, rules: [] };
const fails = (rule: string): GoldenCase["expect"] => ({ pass: false, rules: [rule] });
// The use-case package declares the repository port beside the claimed source: ports belong to it.
const source = (text: string) =>
  useCasePackage({ "src/index.ts": text, "src/invoice-repository.ts": INVOICE_REPOSITORY_PORT });

/** Aggregate arguments to `execute` (h). */
const EXECUTE_SCENES: readonly Scene[] = [
  [
    "violation-h",
    source(
      `import { Invoice } from "@acme/billing-domain";\n\nexport class IssueInvoiceUseCase {\n  execute(invoice: Invoice): void {}\n}\n`,
    ),
    [],
    fails("h"),
  ],
  // A top-level function named execute is a use case entry as much as a method is.
  [
    "violation-h-function",
    source(`import { Invoice } from "@acme/billing-domain";\n\nexport function execute(invoice: Invoice): void {}\n`),
    [],
    fails("h"),
  ],
  // The aggregate reached through an alias and inside a wrapper that only makes it optional.
  [
    "violation-h-import-alias",
    source(
      `import { Invoice as Bill } from "@acme/billing-domain";\n\nexport class IssueInvoiceUseCase {\n  execute(invoice: Bill | undefined): void {}\n}\n`,
    ),
    [],
    fails("h"),
  ],
  [
    "violation-h-readonly-array",
    source(
      `import { Invoice } from "@acme/billing-domain";\n\nexport class IssueInvoiceUseCase {\n  execute(invoices: readonly Invoice[]): void {}\n}\n`,
    ),
    [],
    fails("h"),
  ],
  ["clean-h-id", source("export class IssueInvoiceUseCase {\n  execute(invoiceId: string): void {}\n}\n"), [], pass],
  // A use case type is named <Verb><Object>UseCase; a use case written as a function has no type to name.
  [
    "violation-use-case-name",
    source("export class IssueInvoice {\n  execute(invoiceId: string): void {}\n}\n"),
    [],
    fails("use-case-name"),
  ],
  ["clean-use-case-name-function", source("export function execute(invoiceId: string): void {}\n"), [], pass],
  // Every method of a repository port returns Result, so a failed load or store reaches the use case.
  [
    "violation-repository-result",
    source(
      "export interface PaymentRepository {\n  findById(paymentId: string): string | undefined;\n  store(paymentId: string): void;\n}\n",
    ),
    [],
    { pass: false, rules: ["repository-result"] },
  ],
  [
    "clean-repository-result",
    source(
      "export interface PaymentRepository {\n  findById(paymentId: string): Result<string | undefined, RepositoryError>;\n  store(paymentId: string): Result<void, RepositoryError>;\n}\n",
    ),
    [],
    pass,
  ],
  [
    "clean-h-value-object",
    source(
      `import { Amount } from "@acme/billing-domain";\n\nexport class IssueInvoiceUseCase {\n  execute(amount: Amount): void {}\n}\n`,
    ),
    [],
    pass,
  ],
  // A use-case type that happens to share the aggregate's name is not the aggregate.
  [
    "clean-h-local-name-collision",
    source("export class Invoice {}\n\nexport class IssueInvoiceUseCase {\n  execute(value: Invoice): void {}\n}\n"),
    [],
    pass,
  ],
];

/** One use case calling another (i). */
const CHAINING_SCENES: readonly Scene[] = [
  [
    "violation-i",
    source(
      `${FINISH}\nexport class IssueInvoiceUseCase {\n  run(other: FinishInvoiceUseCase): void {\n    other.execute();\n  }\n}\n`,
    ),
    [],
    fails("i"),
  ],
  [
    "violation-i-field",
    source(
      `${FINISH}\nexport class IssueInvoiceUseCase {\n  readonly #finish: FinishInvoiceUseCase;\n\n  constructor(finish: FinishInvoiceUseCase) {\n    this.#finish = finish;\n  }\n\n  execute(): void {\n    this.#finish.execute();\n  }\n}\n`,
    ),
    [],
    fails("i"),
  ],
  [
    "violation-i-imported",
    useCasePackage({
      "src/index.ts": `import { FinishInvoiceUseCase as Done } from "./finish.ts";\n\nexport class IssueInvoiceUseCase {\n  execute(other: Done): void {\n    other.execute();\n  }\n}\n`,
      "src/finish.ts": FINISH,
    }),
    [],
    fails("i"),
  ],
  // An interface is a port, not another use case.
  [
    "clean-i-port-execute",
    source(
      "export interface PaymentPort {\n  execute(): void;\n}\n\nexport class IssueInvoiceUseCase {\n  execute(port: PaymentPort): void {\n    port.execute();\n  }\n}\n",
    ),
    [],
    pass,
  ],
  // A call on this, or on a value of the calling class itself, is not another use case.
  [
    "clean-i-own-call",
    source(
      "export class IssueInvoiceUseCase {\n  execute(): void {}\n\n  run(same: IssueInvoiceUseCase): void {\n    this.execute();\n    same.execute();\n  }\n}\n",
    ),
    [],
    pass,
  ],
];

/** Getter calls (d), and the forwarding of a getter result to a repository port that rule d permits. */
const GETTER_SCENES: readonly Scene[] = [
  [
    "violation-d-alias",
    source(
      `import { Invoice as Bill } from "@acme/billing-domain";\n\nexport function render(invoice: Bill): number {\n  return invoice.total();\n}\n`,
    ),
    [],
    fails("d"),
  ],
  // A use-case class with a method shaped like a getter is not a domain type, so calling it is no getter call.
  [
    "clean-d-unrelated-getter-name",
    source(
      "export class Statistics {\n  #count = 42;\n\n  total(): number {\n    return this.#count;\n  }\n}\n\nexport function render(stats: Statistics): number {\n  return stats.total();\n}\n",
    ),
    [],
    pass,
  ],
  ["clean-d-repository-argument", source(repositoryRun("repo.remove(invoice.id());")), [], pass],
  ["clean-d-repository-parenthesized", source(repositoryRun("repo.remove((invoice.id()));")), [], pass],
  ["clean-d-repository-local", source(repositoryRun("const id = invoice.id();\n  repo.remove(id);")), [], pass],
  [
    "clean-d-repository-local-alias",
    source(repositoryRun("const id = invoice.id();\n  const key = id;\n  repo.remove(key);")),
    [],
    pass,
  ],
  [
    "clean-d-repository-multiple-uses",
    source(repositoryRun("const id = invoice.id();\n  repo.remove(id);\n  repo.remove(id);")),
    [],
    pass,
  ],
  [
    "clean-d-repository-local-shadow-safe",
    source(
      repositoryRun(
        'const id = invoice.id();\n  {\n    const id = "0";\n    if (id === "42") {\n    }\n  }\n  repo.remove(id);',
      ),
    ),
    [],
    pass,
  ],
  [
    "clean-d-repository-import-alias",
    source(
      `import { Invoice } from "@acme/billing-domain";\nimport type { InvoiceRepository as Port } from "./invoice-repository.ts";\n\nexport function run(invoice: Invoice, repo: Port): void {\n  repo.remove(invoice.id());\n}\n`,
    ),
    [],
    pass,
  ],
  [
    "clean-d-repository-field-port",
    source(
      `${DOMAIN_IMPORT}\nexport class RemoveInvoice {\n  readonly #repo: InvoiceRepository;\n\n  constructor(repo: InvoiceRepository) {\n    this.#repo = repo;\n  }\n\n  run(invoice: Invoice): void {\n    this.#repo.remove(invoice.id());\n  }\n}\n`,
    ),
    [],
    pass,
  ],
  [
    "clean-d-repository-use-case-port",
    source(
      `import { Invoice } from "@acme/billing-domain";\n\nexport interface InvoiceRepository {\n  remove(id: string): Result<void, RepositoryError>;\n}\n\nexport function run(invoice: Invoice, repo: InvoiceRepository): void {\n  repo.remove(invoice.id());\n}\n`,
    ),
    [],
    pass,
  ],
  // A type literal alias is a port as much as an interface is, as rule m reads it.
  [
    "clean-d-repository-type-literal-port",
    source(
      `import { Invoice } from "@acme/billing-domain";\n\nexport type InvoiceRepository = { remove(id: string): Result<void, RepositoryError> };\n\nexport function run(invoice: Invoice, repo: InvoiceRepository): void {\n  repo.remove(invoice.id());\n}\n`,
    ),
    [],
    pass,
  ],
  ["violation-d-repository-arithmetic", source(repositoryRun("repo.remove(invoice.id() + 1);")), [], fails("d")],
  [
    "violation-d-repository-business-branch",
    source(repositoryRun('if (invoice.id() === "42") {\n    repo.remove("42");\n  }')),
    [],
    fails("d"),
  ],
  ["violation-d-repository-transformation", source(repositoryRun("repo.remove(invoice.id().trim());")), [], fails("d")],
  [
    "violation-d-repository-local-business-use",
    source(repositoryRun('const id = invoice.id();\n  if (id === "42") {\n    repo.remove(id);\n  }')),
    [],
    fails("d"),
  ],
  ["violation-d-repository-local-unused", source(repositoryRun("const id = invoice.id();")), [], fails("d")],
  [
    "violation-d-repository-local-mutable",
    source(repositoryRun('let id = invoice.id();\n  id += "1";\n  repo.remove(id);')),
    [],
    fails("d"),
  ],
  [
    "violation-d-repository-local-shadow-business",
    source(
      repositoryRun(
        'const id = invoice.id();\n  {\n    const id = "0";\n    repo.remove(id);\n  }\n  if (id === "42") {\n  }',
      ),
    ),
    [],
    fails("d"),
  ],
  ["violation-d-repository-unknown-method", source(repositoryRun("repo.unknown(invoice.id());")), [], fails("d")],
  ["violation-d-repository-unrelated-function", source(repositoryRun("remove(invoice.id());")), [], fails("d")],
  [
    "violation-d-repository-unrelated-port",
    source(
      `import { Invoice } from "@acme/billing-domain";\n\nexport interface AuditPort {\n  remove(id: string): void;\n}\n\nexport function run(invoice: Invoice, other: AuditPort): void {\n  other.remove(invoice.id());\n}\n`,
    ),
    [],
    fails("d"),
  ],
  // A const written directly in a case clause is in scope for every later clause, so it is not forwarded.
  ["violation-d-repository-case-fallthrough", source(caseRun('case "b":')), [], fails("d")],
  ["violation-d-repository-case-fallthrough-default", source(caseRun("default:")), [], fails("d")],
  [
    "violation-d-repository-mixed-consumers",
    source(repositoryRun("const id = invoice.id();\n  repo.remove(id);\n  log(id);")),
    [],
    fails("d"),
  ],
  // A class of the use-case layer named like a repository is not a repository port.
  [
    "violation-d-repository-name-collision",
    source(
      `import { Invoice } from "@acme/billing-domain";\n\nexport class InvoiceRepository {\n  remove(id: string): void {}\n}\n\nexport function run(invoice: Invoice, repo: InvoiceRepository): void {\n  repo.remove(invoice.id());\n}\n`,
    ),
    [],
    fails("d"),
  ],
];

const USE_CASE_PACKAGE_JSON = "packages/use-case/billing-use-case/package.json";

/** Dependency direction and external I/O (g), type-only dependencies included. */
const DEPENDENCY_SCENES: readonly Scene[] = [
  [
    "clean-g-use-case-to-infrastructure-import",
    source('import { Clock } from "@acme/billing-infrastructure";\n\nexport class IssueInvoiceUseCase {}\n'),
    [INFRASTRUCTURE],
    pass,
  ],
  [
    "clean-g-use-case-to-infrastructure-package-json",
    useCasePackage(
      { "src/index.ts": "export class IssueInvoiceUseCase {}\n" },
      { dependencies: { "@acme/billing-infrastructure": "0.1.0" } },
    ),
    [INFRASTRUCTURE],
    pass,
  ],
  [
    "violation-g-use-case-to-interface-adapter-import",
    source('import { Adapter } from "@acme/billing-interface-adapter";\n\nexport class IssueInvoiceUseCase {}\n'),
    [INTERFACE_ADAPTER],
    fails("g"),
  ],
  [
    "violation-g-use-case-type-only",
    source('import type { Adapter } from "@acme/billing-interface-adapter";\n\nexport class IssueInvoiceUseCase {}\n'),
    [INTERFACE_ADAPTER],
    fails("g"),
  ],
  [
    "violation-g-use-case-to-interface-adapter-package-json",
    useCasePackage(
      { "src/index.ts": "export class IssueInvoiceUseCase {}\n" },
      { dependencies: { "@acme/billing-interface-adapter": "0.1.0" } },
    ),
    [INTERFACE_ADAPTER],
    { pass: false, rules: ["g"], files: { g: USE_CASE_PACKAGE_JSON } },
  ],
  [
    "violation-g-use-case-external-io",
    source('import { MongoClient } from "mongodb";\n\nexport class IssueInvoiceUseCase {}\n'),
    [],
    fails("g"),
  ],
];

function useCaseCases(representation: Representation): GoldenCase[] {
  const cases = [...EXECUTE_SCENES, ...CHAINING_SCENES, ...GETTER_SCENES, ...DEPENDENCY_SCENES].map(
    ([name, pkg, others, expect]) =>
      layerCase(TYPESCRIPT_USE_CASE_SENSOR, representation, name, { pkg, others }, expect),
  );
  // With the model skipped there is no aggregate to decide an argument against, so h is not evaluated.
  const [, skippedPkg] = EXECUTE_SCENES[0];
  cases.push(
    layerCase(
      TYPESCRIPT_USE_CASE_SENSOR,
      representation,
      "clean-h-model-skipped",
      { pkg: skippedPkg, state: SKIPPED_STATE },
      { pass: true, rules: [], note_contains: "domain-modeling is SKIP" },
    ),
  );
  return cases;
}

export const TYPESCRIPT_USE_CASE_CASES: GoldenCase[] = REPRESENTATIONS.flatMap(useCaseCases);
