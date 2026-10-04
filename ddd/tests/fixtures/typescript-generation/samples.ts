/**
 * The TypeScript code the code-generation instructions teach, written once per code representation
 * (`class`, `companion`) and module layout (`named-file`, `index-file`), with the record the
 * code-generation gate reads.
 *
 * Each sample is a project of four packages: the language-extensions package of the infrastructure
 * layer, which declares `Result`; a command-side domain package holding the `invoice` aggregate with
 * its child module `invoice/line`; a use-case package declaring the repository port and the use case
 * that issues an invoice; and an interface-adapter package implementing that port. The parent module
 * has a child so the two layouts place it in different files; only the file of that parent and the
 * specifiers that name it change with the layout. The use-case and interface-adapter sources are the
 * same in every sample: they reach the aggregate only through calls both representations share and
 * hold leaf modules alone, so the domain package is what differs. The repository port lives in the
 * use-case package so the domain package, its model and its mapping stay those the domain gate
 * already decides. The TypeScript examples of the runtime instructions are copies of these sources.
 */

import { SUPPORTED_COMPILER_OPTIONS } from "../typescript-facts/project.ts";
import { modelDocument } from "../../golden/model-document.ts";
import type { GoldenCase } from "../../golden/runner.ts";

export type Representation = "class" | "companion";
export type Layout = "named-file" | "index-file";

const REPRESENTATIONS: readonly Representation[] = ["class", "companion"];
const LAYOUTS: readonly Layout[] = ["named-file", "index-file"];

const DOMAIN_SENSOR = "ddd-typescript-domain";
const LAYOUT_SENSOR = "ddd-typescript-module-layout";
const USE_CASE_SENSOR = "ddd-typescript-use-case";
const INTERFACE_ADAPTER_SENSOR = "ddd-typescript-interface-adapter";

const OUTPUT = "construction/u1/code-generation/code-summary.md";
const SOURCE_MANIFEST = "construction/u1/code-generation/source-manifest.json";
const MODEL_PATH = "inception/ddd-domain-modeling/ddd-domain-model-yaml.md";
const MAPPING_PATH = "inception/domain-design/ddd-aggregate-mapping.md";
const STATE = "## Stage Progress\n- [x] ddd-domain-modeling — EXECUTE\n- [x] code-generation — EXECUTE\n";

const RESULT_DIR = "packages/infrastructure/language-extensions";
const RESULT_NAME = "@acme/language-extensions";
const DOMAIN_DIR = "packages/command/billing-domain";
const DOMAIN_NAME = "@acme/billing-domain";
const USE_CASE_DIR = "packages/command/billing-use-case";
const USE_CASE_NAME = "@acme/billing-use-case";
const INTERFACE_ADAPTER_DIR = "packages/command/billing-interface-adapter";
const INTERFACE_ADAPTER_NAME = "@acme/billing-interface-adapter";

/** The project-relative file of the `invoice` parent module under `layout`. */
export function parentModuleFile(layout: Layout): string {
  return layout === "named-file" ? `${DOMAIN_DIR}/src/invoice.ts` : `${DOMAIN_DIR}/src/invoice/index.ts`;
}

/** The file of the parent module the other layout uses; a sample never writes it. */
export function otherParentModuleFile(layout: Layout): string {
  return parentModuleFile(layout === "named-file" ? "index-file" : "named-file");
}

const RESULT_SOURCE = `export type Result<T, E> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: E };
`;

const RESULT_INDEX = `export type { Result } from "./result.ts";
`;

const CLASS_MONEY = `import type { Result } from "${RESULT_NAME}";

export type ParseMoneyError = "non-finite-amount";

export class Money {
  #value: number;

  private constructor(value: number) {
    this.#value = value;
  }

  static of(value: number): Money {
    const parsed = Money.parse(value);
    if (!parsed.ok) throw new Error(parsed.error);
    return parsed.value;
  }

  static parse(value: number): Result<Money, ParseMoneyError> {
    if (!Number.isFinite(value)) return { ok: false, error: "non-finite-amount" };
    return { ok: true, value: new Money(value) };
  }

  static zero(): Money {
    return Money.of(0);
  }

  add(other: Money): Money {
    return Money.of(this.#value + other.#value);
  }

  isNegative(): boolean {
    return this.#value < 0;
  }

  equals(other: Money): boolean {
    return other.#value === this.#value;
  }
}
`;

const CLASS_LINE = `import type { Money } from "../money.ts";

export class InvoiceLine {
  #amount: Money;

  private constructor(amount: Money) {
    this.#amount = amount;
  }

  static of(amount: Money): InvoiceLine {
    return new InvoiceLine(amount);
  }

  addTo(total: Money): Money {
    return total.add(this.#amount);
  }
}
`;

const COMPANION_MONEY = `import type { Result } from "${RESULT_NAME}";

export type ParseMoneyError = "non-finite-amount";

const brand: unique symbol = Symbol("Money");

export type Money = {
  readonly [brand]: true;
  add(other: Money): Money;
  plus(value: number): Money;
  isNegative(): boolean;
  equals(other: Money): boolean;
  matches(value: number): boolean;
};

export const Money = {
  of(value: number): Money {
    const parsed = Money.parse(value);
    if (!parsed.ok) throw new Error(parsed.error);
    return parsed.value;
  },
  parse(value: number): Result<Money, ParseMoneyError> {
    if (!Number.isFinite(value)) return { ok: false, error: "non-finite-amount" };
    const state = { value };
    const instance: Money = {
      [brand]: true,
      add(other: Money): Money {
        return other.plus(state.value);
      },
      plus(value: number): Money {
        return Money.of(state.value + value);
      },
      isNegative(): boolean {
        return state.value < 0;
      },
      equals(other: Money): boolean {
        return other.matches(state.value);
      },
      matches(value: number): boolean {
        return state.value === value;
      },
    };
    return { ok: true, value: instance };
  },
  zero(): Money {
    return Money.of(0);
  },
};
`;

const COMPANION_LINE = `import type { Money } from "../money.ts";

const brand: unique symbol = Symbol("InvoiceLine");

export type InvoiceLine = {
  readonly [brand]: true;
  addTo(total: Money): Money;
};

export const InvoiceLine = {
  of(amount: Money): InvoiceLine {
    const state = { amount };
    const instance: InvoiceLine = {
      [brand]: true,
      addTo(total: Money): Money {
        return total.add(state.amount);
      },
    };
    return instance;
  },
};
`;

const ERROR_TYPES = `export type Opened = { readonly kind: "opened"; readonly customer: string; readonly lines: readonly InvoiceLine[] };
export type LineAdded = { readonly kind: "line-added"; readonly line: InvoiceLine };
export type Issued = { readonly kind: "issued" };
export type InvoiceEvent = Opened | LineAdded | Issued;

export type OpenInvoiceError = "missing-customer" | "negative-total";
export type AddInvoiceLineError = "already-issued" | "negative-total";
export type IssueInvoiceError = "already-issued" | "empty-lines";
`;

function imports(lineSpecifier: string, moneySpecifier: string): string {
  return `import type { Result } from "${RESULT_NAME}";
import type { InvoiceLine } from "${lineSpecifier}";
import { Money } from "${moneySpecifier}";
`;
}

/** The invoice total both representations check: the invariant forbids a negative one. */
const SUM_OF = `function sumOf(lines: readonly InvoiceLine[]): Money {
  return lines.reduce((sum: Money, line: InvoiceLine) => line.addTo(sum), Money.zero());
}
`;

function classInvoice(lineSpecifier: string, moneySpecifier: string): string {
  return `${imports(lineSpecifier, moneySpecifier)}
${ERROR_TYPES}
${SUM_OF}
export class Invoice {
  #customer: string;
  #lines: readonly InvoiceLine[];
  #issued: boolean;

  private constructor(customer: string, lines: readonly InvoiceLine[], issued: boolean) {
    this.#customer = customer;
    this.#lines = [...lines];
    this.#issued = issued;
  }

  static open(customer: string, lines: readonly InvoiceLine[]): Result<Invoice, OpenInvoiceError> {
    if (customer.length === 0) return { ok: false, error: "missing-customer" };
    if (sumOf(lines).isNegative()) return { ok: false, error: "negative-total" };
    return { ok: true, value: new Invoice(customer, lines, false) };
  }

  static restore(history: readonly InvoiceEvent[]): Invoice {
    const first: InvoiceEvent | undefined = history[0];
    if (first === undefined || first.kind !== "opened") throw new Error("corrupt invoice history");
    const opened = Invoice.open(first.customer, first.lines);
    if (!opened.ok) throw new Error("corrupt invoice history");
    const invoice: Invoice = opened.value;
    for (const event of history.slice(1)) {
      if (event.kind === "line-added") invoice.applyLineAdded(event);
      else if (event.kind === "issued") invoice.applyIssued(event);
      else throw new Error("corrupt invoice history");
    }
    return invoice;
  }

  addLine(line: InvoiceLine): Result<LineAdded, AddInvoiceLineError> {
    if (this.#issued) return { ok: false, error: "already-issued" };
    if (line.addTo(sumOf(this.#lines)).isNegative()) return { ok: false, error: "negative-total" };
    const event: LineAdded = { kind: "line-added", line };
    this.applyLineAdded(event);
    return { ok: true, value: event };
  }

  issue(): Result<Issued, IssueInvoiceError> {
    if (this.#issued) return { ok: false, error: "already-issued" };
    if (this.#lines.length === 0) return { ok: false, error: "empty-lines" };
    const event: Issued = { kind: "issued" };
    this.applyIssued(event);
    return { ok: true, value: event };
  }

  applyLineAdded(event: LineAdded): void {
    if (this.#issued || event.line.addTo(sumOf(this.#lines)).isNegative()) throw new Error("corrupt invoice history");
    this.#lines = [...this.#lines, event.line];
  }

  applyIssued(_event: Issued): void {
    if (this.#issued || this.#lines.length === 0) throw new Error("corrupt invoice history");
    this.#issued = true;
  }

  isBilledTo(customer: string): boolean {
    return this.#customer === customer;
  }

  total(): Money {
    return sumOf(this.#lines);
  }

  lines(): readonly InvoiceLine[] {
    return [...this.#lines];
  }
}
`;
}

function companionInvoice(lineSpecifier: string, moneySpecifier: string): string {
  return `${imports(lineSpecifier, moneySpecifier)}
${ERROR_TYPES}
${SUM_OF}
const brand: unique symbol = Symbol("Invoice");

export type Invoice = {
  readonly [brand]: true;
  addLine(line: InvoiceLine): Result<LineAdded, AddInvoiceLineError>;
  issue(): Result<Issued, IssueInvoiceError>;
  applyLineAdded(event: LineAdded): void;
  applyIssued(event: Issued): void;
  isBilledTo(customer: string): boolean;
  total(): Money;
  lines(): readonly InvoiceLine[];
};

export const Invoice = {
  restore(history: readonly InvoiceEvent[]): Invoice {
    const first: InvoiceEvent | undefined = history[0];
    if (first === undefined || first.kind !== "opened") throw new Error("corrupt invoice history");
    const opened = Invoice.open(first.customer, first.lines);
    if (!opened.ok) throw new Error("corrupt invoice history");
    const invoice: Invoice = opened.value;
    for (const event of history.slice(1)) {
      if (event.kind === "line-added") invoice.applyLineAdded(event);
      else if (event.kind === "issued") invoice.applyIssued(event);
      else throw new Error("corrupt invoice history");
    }
    return invoice;
  },
  open(customer: string, lines: readonly InvoiceLine[]): Result<Invoice, OpenInvoiceError> {
    if (customer.length === 0) return { ok: false, error: "missing-customer" };
    if (sumOf(lines).isNegative()) return { ok: false, error: "negative-total" };
    const kept: readonly InvoiceLine[] = [...lines];
    const state = { customer, lines: kept, issued: false };
    const instance: Invoice = {
      [brand]: true,
      addLine(line: InvoiceLine): Result<LineAdded, AddInvoiceLineError> {
        if (state.issued) return { ok: false, error: "already-issued" };
        if (line.addTo(sumOf(state.lines)).isNegative()) return { ok: false, error: "negative-total" };
        const event: LineAdded = { kind: "line-added", line };
        instance.applyLineAdded(event);
        return { ok: true, value: event };
      },
      issue(): Result<Issued, IssueInvoiceError> {
        if (state.issued) return { ok: false, error: "already-issued" };
        if (state.lines.length === 0) return { ok: false, error: "empty-lines" };
        const event: Issued = { kind: "issued" };
        instance.applyIssued(event);
        return { ok: true, value: event };
      },
      applyLineAdded(event: LineAdded): void {
        if (state.issued || event.line.addTo(sumOf(state.lines)).isNegative()) throw new Error("corrupt invoice history");
        state.lines = [...state.lines, event.line];
      },
      applyIssued(_event: Issued): void {
        if (state.issued || state.lines.length === 0) throw new Error("corrupt invoice history");
        state.issued = true;
      },
      isBilledTo(customer: string): boolean {
        return state.customer === customer;
      },
      total(): Money {
        return sumOf(state.lines);
      },
      lines(): readonly InvoiceLine[] {
        return [...state.lines];
      },
    };
    return { ok: true, value: instance };
  },
};
`;
}

function domainIndex(parentSpecifier: string): string {
  return `export type { AddInvoiceLineError, IssueInvoiceError, OpenInvoiceError, InvoiceEvent, Opened, LineAdded, Issued } from "${parentSpecifier}";
export { Invoice } from "${parentSpecifier}";
export { InvoiceLine } from "./invoice/line.ts";
export { Money } from "./money.ts";
`;
}

const INVOICE_REPOSITORY_PORT = `import type { Invoice, InvoiceEvent } from "${DOMAIN_NAME}";
import type { Result } from "${RESULT_NAME}";

export type RepositoryError = { readonly kind: "repository-error"; readonly message: string };

export interface InvoiceRepository {
  findById(invoiceId: string): Result<Invoice | undefined, RepositoryError>;
  store(invoiceId: string, event: InvoiceEvent): Result<void, RepositoryError>;
}
`;

const ISSUE_INVOICE = `import type { Invoice, IssueInvoiceError, Issued } from "${DOMAIN_NAME}";
import type { Result } from "${RESULT_NAME}";
import type { InvoiceRepository, RepositoryError } from "./invoice-repository.ts";

export type InvoiceNotFound = "invoice-not-found";
export type IssueInvoiceFailure = InvoiceNotFound | IssueInvoiceError | RepositoryError;

export class IssueInvoiceUseCase {
  readonly #invoiceRepository: InvoiceRepository;

  constructor(invoiceRepository: InvoiceRepository) {
    this.#invoiceRepository = invoiceRepository;
  }

  execute(invoiceId: string): Result<void, IssueInvoiceFailure> {
    const found: Result<Invoice | undefined, RepositoryError> = this.#invoiceRepository.findById(invoiceId);
    if (!found.ok) return found;
    if (found.value === undefined) return { ok: false, error: "invoice-not-found" };
    const invoice: Invoice = found.value;
    const issued: Result<Issued, IssueInvoiceError> = invoice.issue();
    if (!issued.ok) return issued;
    const stored: Result<void, RepositoryError> = this.#invoiceRepository.store(invoiceId, issued.value);
    if (!stored.ok) return stored;
    return { ok: true, value: undefined };
  }
}
`;

const USE_CASE_INDEX = `export type { InvoiceRepository, RepositoryError } from "./invoice-repository.ts";
export type { InvoiceNotFound, IssueInvoiceFailure } from "./issue-invoice.ts";
export { IssueInvoiceUseCase } from "./issue-invoice.ts";
`;

const IN_MEMORY_INVOICE_REPOSITORY = `import { Invoice } from "${DOMAIN_NAME}";
import type { InvoiceEvent } from "${DOMAIN_NAME}";
import type { InvoiceRepository, RepositoryError } from "${USE_CASE_NAME}";
import type { Result } from "${RESULT_NAME}";

export class InMemoryInvoiceRepository implements InvoiceRepository {
  readonly #events: Map<string, readonly InvoiceEvent[]>;

  constructor(streams: ReadonlyMap<string, readonly InvoiceEvent[]>) {
    this.#events = new Map();
    for (const [id, events] of streams) this.#events.set(id, events.map((event: InvoiceEvent) => InMemoryInvoiceRepository.copyEvent(event)));
  }

  private static copyEvent(event: InvoiceEvent): InvoiceEvent {
    if (event.kind === "opened") return Object.freeze({ kind: "opened", customer: event.customer, lines: Object.freeze([...event.lines]) });
    if (event.kind === "line-added") return Object.freeze({ kind: "line-added", line: event.line });
    return Object.freeze({ kind: "issued" });
  }

  findById(invoiceId: string): Result<Invoice | undefined, RepositoryError> {
    const events: readonly InvoiceEvent[] | undefined = this.#events.get(invoiceId);
    if (events === undefined) return { ok: true, value: undefined };
    try {
      return { ok: true, value: Invoice.restore(events) };
    } catch (error) {
      return { ok: false, error: { kind: "repository-error", message: String(error) } };
    }
  }

  store(invoiceId: string, event: InvoiceEvent): Result<void, RepositoryError> {
    const history: readonly InvoiceEvent[] = this.#events.get(invoiceId) ?? [];
    this.#events.set(invoiceId, [...history, InMemoryInvoiceRepository.copyEvent(event)]);
    return { ok: true, value: undefined };
  }
}
`;

const INTERFACE_ADAPTER_INDEX = `export { InMemoryInvoiceRepository } from "./in-memory-invoice-repository.ts";
`;

/** The canonical model: `open` is a factory, `addLine` and `issue` are commands, each with its own errors. */
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
          - { element_id: vo.invoice-line, kind: value-object, name: InvoiceLine, aggregate: aggregate.invoice }
          - { element_id: primitive.money, kind: domain-primitive, name: Money, aggregate: aggregate.invoice, attributes: [{ name: value, type: decimal, required: true }] }
        invariants:
          - { element_id: invariant.invoice.money-finite, name: FiniteAmount, aggregate: aggregate.invoice, statement: monetary amounts are finite }
          - { element_id: invariant.invoice.total-positive, name: TotalPositive, aggregate: aggregate.invoice, statement: the total is not negative }
        commands:
          - element_id: command.invoice.add-line
            name: AddLine
            aggregate: aggregate.invoice
            effect: accumulation
            state_effect: none
            domain_errors:
              - { element_id: error.invoice.add-line.already-issued, name: AlreadyIssued, operation: command.invoice.add-line, condition: the invoice is issued }
              - { element_id: error.invoice.add-line.negative-total, name: NegativeTotal, operation: command.invoice.add-line, condition: the line would make the total negative }
            events: [event.invoice.line-added]
            idempotency: { strategy: none }
          - element_id: command.invoice.issue
            name: Issue
            aggregate: aggregate.invoice
            effect: transition
            state_effect: transitions
            transitions: [transition.invoice.issue]
            domain_errors:
              - { element_id: error.invoice.issue.already-issued, name: AlreadyIssued, operation: command.invoice.issue, condition: the invoice is issued }
              - { element_id: error.invoice.issue.empty-lines, name: EmptyLines, operation: command.invoice.issue, condition: the invoice has no line }
            events: [event.invoice.issued]
            idempotency: { strategy: none }
        events:
          - { element_id: event.invoice.opened, name: Opened, aggregate: aggregate.invoice, produced_by: factory.invoice.open }
          - { element_id: event.invoice.line-added, name: LineAdded, aggregate: aggregate.invoice, produced_by: command.invoice.add-line }
          - { element_id: event.invoice.issued, name: Issued, aggregate: aggregate.invoice, produced_by: command.invoice.issue }
        transitions:
          - { element_id: transition.invoice.issue, name: Issue, aggregate: aggregate.invoice, from_state: draft, to_state: issued, command: command.invoice.issue }
        factory_rules:
          - element_id: factory.invoice.parse-money
            name: ParseMoney
            target_element: primitive.money
            preconditions: [invariant.invoice.money-finite]
            domain_errors:
              - { element_id: error.invoice.parse-money.non-finite-amount, name: NonFiniteAmount, operation: factory.invoice.parse-money, condition: the amount is not finite }
          - element_id: factory.invoice.open
            name: Open
            target_element: entity.invoice
            preconditions: [invariant.invoice.total-positive]
            domain_errors:
              - { element_id: error.invoice.open.missing-customer, name: MissingCustomer, operation: factory.invoice.open, condition: no customer is given }
              - { element_id: error.invoice.open.negative-total, name: NegativeTotal, operation: factory.invoice.open, condition: the lines add up to a negative total }
lineage: []
`;

const location = (module: readonly string[]) =>
  `{ language: typescript, package: "${DOMAIN_NAME}", module: [${module.join(", ")}] }`;

/** The implementation mapping placing the aggregate at `[invoice]` and naming each operation's error type. */
const MAPPING = [
  "# Aggregate mapping",
  "",
  "```yaml",
  "schema_version: 2",
  `model_ref: ${MODEL_PATH}`,
  "aggregate_mappings:",
  "  - aggregate_ref: aggregate.invoice",
  "    programming_model: class",
  "    persistence_method: event-sourcing",
  "    replay_methods:",
  "      - { event_ref: event.invoice.line-added, code: { method: applyLineAdded } }",
  "      - { event_ref: event.invoice.issued, code: { method: applyIssued } }",
  "    reference_ids: [entity.invoice]",
  `    code: { language: typescript, package: "${DOMAIN_NAME}", module: [invoice], type: Invoice }`,
  "    operations:",
  "      - operation_ref: factory.invoice.parse-money",
  "        code: { method: parse, error_type: ParseMoneyError }",
  "        errors:",
  "          - { error_ref: error.invoice.parse-money.non-finite-amount, code: { case: non-finite-amount } }",
  "      - operation_ref: factory.invoice.open",
  "        code: { method: open, error_type: OpenInvoiceError }",
  "        errors:",
  "          - { error_ref: error.invoice.open.missing-customer, code: { case: missing-customer } }",
  "          - { error_ref: error.invoice.open.negative-total, code: { case: negative-total } }",
  "      - operation_ref: command.invoice.add-line",
  "        code: { method: addLine, error_type: AddInvoiceLineError }",
  "        errors:",
  "          - { error_ref: error.invoice.add-line.already-issued, code: { case: already-issued } }",
  "          - { error_ref: error.invoice.add-line.negative-total, code: { case: negative-total } }",
  "      - operation_ref: command.invoice.issue",
  "        code: { method: issue, error_type: IssueInvoiceError }",
  "        errors:",
  "          - { error_ref: error.invoice.issue.already-issued, code: { case: already-issued } }",
  "          - { error_ref: error.invoice.issue.empty-lines, code: { case: empty-lines } }",
  "domain_packages:",
  `  - { term: Billing, model_refs: [bc.billing], rationale: owns the billing business, code: ${location([])} }`,
  `  - { term: Invoice, model_refs: [aggregate.invoice], rationale: opens and issues invoices, code: ${location(["invoice"])} }`,
  `  - { term: Invoice line, model_refs: [vo.invoice-line], rationale: one amount an invoice adds up, code: ${location(["invoice", "line"])} }`,
  `  - { term: Money, model_refs: [primitive.money], rationale: the amount of a line and the total of an invoice, code: ${location(["money"])} }`,
  "```",
  "",
].join("\n");

function settings(representation: Representation, layout: Layout): string {
  return `schema_version = 2\nlanguages = ["typescript"]\n\n[typescript]\nmodule_layout = "${layout}"\ncode_representation = "${representation}"\n`;
}

function packageManifest(name: string, dependencies?: Readonly<Record<string, string>>): string {
  return `${JSON.stringify(
    { name, version: "0.1.0", type: "module", exports: { ".": "./src/index.ts" }, ...(dependencies ? { dependencies } : {}) },
    null,
    2,
  )}\n`;
}

const PACKAGE_TSCONFIG = `${JSON.stringify(
  {
    compilerOptions: {
      ...SUPPORTED_COMPILER_OPTIONS,
      allowImportingTsExtensions: true,
      noEmit: true,
      noUnusedLocals: true,
      noUnusedParameters: true,
    },
    include: ["src/**/*.ts"],
  },
  null,
  2,
)}\n`;

export interface GenerationSample {
  readonly representation: Representation;
  readonly layout: Layout;
  /** Project-root relative path -> content of every file of the project. */
  readonly workspace: Readonly<Record<string, string>>;
  /** Project-root relative path -> content of the TypeScript sources the sample generates. */
  readonly sources: Readonly<Record<string, string>>;
  /** The run of the TypeScript domain gate (T-11-02) over the sample. */
  readonly domainCase: GoldenCase;
  /** The run of the TypeScript module layout gate (T-11-04) over the same project and record. */
  readonly layoutCase: GoldenCase;
  /** The run of the TypeScript use-case gate (T-11-03) over the same project and record. */
  readonly useCaseCase: GoldenCase;
  /** The run of the TypeScript interface-adapter gate (T-11-03) over the same project and record. */
  readonly interfaceAdapterCase: GoldenCase;
}

/** The generated project for one code representation and one module layout. */
function generationSample(representation: Representation, layout: Layout): GenerationSample {
  const named = layout === "named-file";
  const lineSpecifier = named ? "./invoice/line.ts" : "./line.ts";
  const moneySpecifier = named ? "./money.ts" : "../money.ts";
  const parentSpecifier = named ? "./invoice.ts" : "./invoice/index.ts";
  const sources: Record<string, string> = {
    [`${RESULT_DIR}/src/index.ts`]: RESULT_INDEX,
    [`${RESULT_DIR}/src/result.ts`]: RESULT_SOURCE,
    [`${DOMAIN_DIR}/src/index.ts`]: domainIndex(parentSpecifier),
    [parentModuleFile(layout)]:
      representation === "class" ? classInvoice(lineSpecifier, moneySpecifier) : companionInvoice(lineSpecifier, moneySpecifier),
    [`${DOMAIN_DIR}/src/invoice/line.ts`]: representation === "class" ? CLASS_LINE : COMPANION_LINE,
    [`${DOMAIN_DIR}/src/money.ts`]: representation === "class" ? CLASS_MONEY : COMPANION_MONEY,
    [`${USE_CASE_DIR}/src/index.ts`]: USE_CASE_INDEX,
    [`${USE_CASE_DIR}/src/invoice-repository.ts`]: INVOICE_REPOSITORY_PORT,
    [`${USE_CASE_DIR}/src/issue-invoice.ts`]: ISSUE_INVOICE,
    [`${INTERFACE_ADAPTER_DIR}/src/index.ts`]: INTERFACE_ADAPTER_INDEX,
    [`${INTERFACE_ADAPTER_DIR}/src/in-memory-invoice-repository.ts`]: IN_MEMORY_INVOICE_REPOSITORY,
  };
  const references = [RESULT_DIR, DOMAIN_DIR, USE_CASE_DIR, INTERFACE_ADAPTER_DIR].map((dir) => ({ path: `./${dir}` }));
  const workspace: Record<string, string> = {
    ".ddd.toml": settings(representation, layout),
    "tsconfig.json": `${JSON.stringify({ files: [], references }, null, 2)}\n`,
    [`${RESULT_DIR}/package.json`]: packageManifest(RESULT_NAME),
    [`${RESULT_DIR}/tsconfig.json`]: PACKAGE_TSCONFIG,
    [`${DOMAIN_DIR}/package.json`]: packageManifest(DOMAIN_NAME, { [RESULT_NAME]: "0.1.0" }),
    [`${DOMAIN_DIR}/tsconfig.json`]: PACKAGE_TSCONFIG,
    [`${USE_CASE_DIR}/package.json`]: packageManifest(USE_CASE_NAME, { [DOMAIN_NAME]: "0.1.0", [RESULT_NAME]: "0.1.0" }),
    [`${USE_CASE_DIR}/tsconfig.json`]: PACKAGE_TSCONFIG,
    [`${INTERFACE_ADAPTER_DIR}/package.json`]: packageManifest(INTERFACE_ADAPTER_NAME, {
      [DOMAIN_NAME]: "0.1.0",
      [USE_CASE_NAME]: "0.1.0",
      [RESULT_NAME]: "0.1.0",
    }),
    [`${INTERFACE_ADAPTER_DIR}/tsconfig.json`]: PACKAGE_TSCONFIG,
    ...sources,
  };
  const files: Record<string, string> = {
    [OUTPUT]: "# Code summary\n",
    [SOURCE_MANIFEST]: JSON.stringify({
      stage: "code-generation",
      unit: "u1",
      version: 1,
      writes: Object.keys(sources).map((path) => ({ path })),
    }),
    [MODEL_PATH]: modelDocument(MODEL),
    [MAPPING_PATH]: MAPPING,
  };
  const name = `generation-sample-${representation}-${layout}`;
  const domainCase: GoldenCase = {
    sensor: DOMAIN_SENSOR,
    name,
    stage: "code-generation",
    output: OUTPUT,
    workspace,
    files,
    state: STATE,
    expect: { pass: true, rules: [] },
  };
  return {
    representation,
    layout,
    workspace,
    sources,
    domainCase,
    layoutCase: { ...domainCase, sensor: LAYOUT_SENSOR },
    useCaseCase: { ...domainCase, sensor: USE_CASE_SENSOR },
    interfaceAdapterCase: { ...domainCase, sensor: INTERFACE_ADAPTER_SENSOR },
  };
}

/** Every sample, one per code representation and module layout. */
export function generationSamples(): GenerationSample[] {
  return REPRESENTATIONS.flatMap((representation) =>
    LAYOUTS.map((layout) => generationSample(representation, layout)),
  );
}
