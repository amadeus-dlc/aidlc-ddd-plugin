/**
 * The TypeScript code the code-generation instructions teach, written once per code representation
 * (`class`, `companion`) and module layout (`named-file`, `index-file`), with the record the
 * code-generation gate reads.
 *
 * Each sample is a project of four packages: the language-extensions package of the infrastructure
 * layer, which declares `Result` and `CommandOutcome`; a command-side domain package holding the
 * `invoice` aggregate with its child module `invoice/line`; a use-case package declaring the
 * repository port and the use cases that issue an invoice and record a payment on it; and an
 * interface-adapter package implementing that port. A command that declares events succeeds with a
 * `CommandOutcome`: `issue` is applied with its one event, and `recordPayment`, which remembers its
 * recent command ids, is applied with one or two events or is already applied with none. The
 * repository keeps each invoice as a record holding its whole state, restores a new invoice from it on
 * every read, and returns it with the version it was read at; a store checks that version once and
 * appends every event of a command together. The parent module has a child so the two layouts place
 * it in different files; only the file of that parent and the
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

/** The success side of a command that declares events: applied with its events, or already applied. */
const COMMAND_OUTCOME_SOURCE = `export type CommandOutcome<E> =
  | { readonly kind: "applied"; readonly events: readonly E[] }
  | { readonly kind: "already-applied" };
`;

const RESULT_INDEX = `export type { CommandOutcome } from "./command-outcome.ts";
export type { Result } from "./result.ts";
`;

const CLASS_LINE = `export class InvoiceLine {
  #amount: number;

  private constructor(amount: number) {
    this.#amount = amount;
  }

  static of(amount: number): InvoiceLine {
    return new InvoiceLine(amount);
  }

  addTo(total: number): number {
    return total + this.#amount;
  }

  amount(): number {
    return this.#amount;
  }
}
`;

const COMPANION_LINE = `const brand: unique symbol = Symbol("InvoiceLine");

export type InvoiceLine = {
  readonly [brand]: true;
  addTo(total: number): number;
  amount(): number;
};

export const InvoiceLine = {
  of(amount: number): InvoiceLine {
    const state = { amount };
    const instance: InvoiceLine = {
      [brand]: true,
      addTo(total: number): number {
        return total + state.amount;
      },
      amount(): number {
        return state.amount;
      },
    };
    return instance;
  },
};
`;

const ERROR_TYPES = `export type OpenInvoiceError = "missing-customer" | "negative-total";
export type AddInvoiceLineError = "already-issued" | "negative-total";
export type IssueInvoiceError = "already-issued" | "empty-lines";
export type RecordPaymentError = "not-issued" | "overpayment";
export type InvoiceEvent = "issued" | "payment-recorded" | "settled";
`;

function imports(lineSpecifier: string): string {
  return `import type { CommandOutcome, Result } from "${RESULT_NAME}";
import type { InvoiceLine } from "${lineSpecifier}";
`;
}

/**
 * The invoice total both representations check, where the invariant forbids a negative one, and the
 * check of a whole persisted state both representations restore through.
 */
const SUM_OF = `/** How many payment command ids an invoice remembers: the model's retention_count. */
const REMEMBERED_PAYMENTS = 16;

function sumOf(lines: readonly InvoiceLine[]): number {
  return lines.reduce((sum: number, line: InvoiceLine) => line.addTo(sum), 0);
}

/** Whether a persisted state breaks an invariant: such a state is corrupt storage, not a business failure. */
function isCorrupt(
  customer: string,
  lines: readonly InvoiceLine[],
  issued: boolean,
  paid: number,
  paymentIds: readonly string[],
): boolean {
  const total: number = sumOf(lines);
  if (customer.length === 0 || total < 0 || (issued && lines.length === 0)) return true;
  if (paid < 0 || paid > total || paymentIds.length > REMEMBERED_PAYMENTS) return true;
  return !issued && (paid !== 0 || paymentIds.length > 0);
}
`;

function classInvoice(lineSpecifier: string): string {
  return `${imports(lineSpecifier)}
${ERROR_TYPES}
${SUM_OF}
export class Invoice {
  #customer: string;
  #lines: readonly InvoiceLine[];
  #issued: boolean;
  #paid: number;
  #paymentIds: readonly string[];

  private constructor(
    customer: string,
    lines: readonly InvoiceLine[],
    issued: boolean,
    paid: number,
    paymentIds: readonly string[],
  ) {
    this.#customer = customer;
    this.#lines = [...lines];
    this.#issued = issued;
    this.#paid = paid;
    this.#paymentIds = [...paymentIds];
  }

  static open(customer: string, lines: readonly InvoiceLine[]): Result<Invoice, OpenInvoiceError> {
    if (customer.length === 0) return { ok: false, error: "missing-customer" };
    if (sumOf(lines) < 0) return { ok: false, error: "negative-total" };
    return { ok: true, value: new Invoice(customer, lines, false, 0, []) };
  }

  static restore(
    customer: string,
    lines: readonly InvoiceLine[],
    issued: boolean,
    paid: number,
    paymentIds: readonly string[],
  ): Invoice {
    if (isCorrupt(customer, lines, issued, paid, paymentIds)) throw new Error("corrupt invoice state");
    return new Invoice(customer, lines, issued, paid, paymentIds);
  }

  addLine(line: InvoiceLine): Result<void, AddInvoiceLineError> {
    if (this.#issued) return { ok: false, error: "already-issued" };
    if (line.addTo(sumOf(this.#lines)) < 0) return { ok: false, error: "negative-total" };
    this.#lines = [...this.#lines, line];
    return { ok: true, value: undefined };
  }

  issue(): Result<CommandOutcome<InvoiceEvent>, IssueInvoiceError> {
    if (this.#issued) return { ok: false, error: "already-issued" };
    if (this.#lines.length === 0) return { ok: false, error: "empty-lines" };
    this.#issued = true;
    return { ok: true, value: { kind: "applied", events: ["issued"] } };
  }

  recordPayment(paymentId: string, amount: number): Result<CommandOutcome<InvoiceEvent>, RecordPaymentError> {
    if (this.#paymentIds.includes(paymentId)) return { ok: true, value: { kind: "already-applied" } };
    if (!this.#issued) return { ok: false, error: "not-issued" };
    const total: number = sumOf(this.#lines);
    if (this.#paid + amount > total) return { ok: false, error: "overpayment" };
    this.#paid = this.#paid + amount;
    this.#paymentIds = [...this.#paymentIds, paymentId].slice(-REMEMBERED_PAYMENTS);
    if (this.#paid === total) return { ok: true, value: { kind: "applied", events: ["payment-recorded", "settled"] } };
    return { ok: true, value: { kind: "applied", events: ["payment-recorded"] } };
  }

  isBilledTo(customer: string): boolean {
    return this.#customer === customer;
  }

  total(): number {
    return sumOf(this.#lines);
  }

  customer(): string {
    return this.#customer;
  }

  issued(): boolean {
    return this.#issued;
  }

  paid(): number {
    return this.#paid;
  }

  paymentIds(): readonly string[] {
    return [...this.#paymentIds];
  }

  lines(): readonly InvoiceLine[] {
    return [...this.#lines];
  }
}
`;
}

function companionInvoice(lineSpecifier: string): string {
  return `${imports(lineSpecifier)}
${ERROR_TYPES}
${SUM_OF}
const brand: unique symbol = Symbol("Invoice");

export type Invoice = {
  readonly [brand]: true;
  addLine(line: InvoiceLine): Result<void, AddInvoiceLineError>;
  issue(): Result<CommandOutcome<InvoiceEvent>, IssueInvoiceError>;
  recordPayment(paymentId: string, amount: number): Result<CommandOutcome<InvoiceEvent>, RecordPaymentError>;
  isBilledTo(customer: string): boolean;
  total(): number;
  customer(): string;
  issued(): boolean;
  paid(): number;
  paymentIds(): readonly string[];
  lines(): readonly InvoiceLine[];
};

type InvoiceState = {
  customer: string;
  lines: readonly InvoiceLine[];
  issued: boolean;
  paid: number;
  paymentIds: readonly string[];
};

export const Invoice = {
  open(customer: string, lines: readonly InvoiceLine[]): Result<Invoice, OpenInvoiceError> {
    if (customer.length === 0) return { ok: false, error: "missing-customer" };
    if (sumOf(lines) < 0) return { ok: false, error: "negative-total" };
    return { ok: true, value: Invoice.restore(customer, lines, false, 0, []) };
  },
  restore(
    customer: string,
    lines: readonly InvoiceLine[],
    issued: boolean,
    paid: number,
    paymentIds: readonly string[],
  ): Invoice {
    if (isCorrupt(customer, lines, issued, paid, paymentIds)) throw new Error("corrupt invoice state");
    const state: InvoiceState = { customer, lines: [...lines], issued, paid, paymentIds: [...paymentIds] };
    const instance: Invoice = {
      [brand]: true,
      addLine(line: InvoiceLine): Result<void, AddInvoiceLineError> {
        if (state.issued) return { ok: false, error: "already-issued" };
        if (line.addTo(sumOf(state.lines)) < 0) return { ok: false, error: "negative-total" };
        state.lines = [...state.lines, line];
        return { ok: true, value: undefined };
      },
      issue(): Result<CommandOutcome<InvoiceEvent>, IssueInvoiceError> {
        if (state.issued) return { ok: false, error: "already-issued" };
        if (state.lines.length === 0) return { ok: false, error: "empty-lines" };
        state.issued = true;
        return { ok: true, value: { kind: "applied", events: ["issued"] } };
      },
      recordPayment(paymentId: string, amount: number): Result<CommandOutcome<InvoiceEvent>, RecordPaymentError> {
        if (state.paymentIds.includes(paymentId)) return { ok: true, value: { kind: "already-applied" } };
        if (!state.issued) return { ok: false, error: "not-issued" };
        const total: number = sumOf(state.lines);
        if (state.paid + amount > total) return { ok: false, error: "overpayment" };
        state.paid = state.paid + amount;
        state.paymentIds = [...state.paymentIds, paymentId].slice(-REMEMBERED_PAYMENTS);
        if (state.paid === total) return { ok: true, value: { kind: "applied", events: ["payment-recorded", "settled"] } };
        return { ok: true, value: { kind: "applied", events: ["payment-recorded"] } };
      },
      isBilledTo(customer: string): boolean {
        return state.customer === customer;
      },
      total(): number {
        return sumOf(state.lines);
      },
      customer(): string {
        return state.customer;
      },
      issued(): boolean {
        return state.issued;
      },
      paid(): number {
        return state.paid;
      },
      paymentIds(): readonly string[] {
        return [...state.paymentIds];
      },
      lines(): readonly InvoiceLine[] {
        return [...state.lines];
      },
    };
    return instance;
  },
};
`;
}

function domainIndex(parentSpecifier: string): string {
  return `export type {
  AddInvoiceLineError,
  InvoiceEvent,
  IssueInvoiceError,
  OpenInvoiceError,
  RecordPaymentError,
} from "${parentSpecifier}";
export { Invoice } from "${parentSpecifier}";
export { InvoiceLine } from "./invoice/line.ts";
`;
}

const INVOICE_REPOSITORY_PORT = `import type { Invoice, InvoiceEvent } from "${DOMAIN_NAME}";
import type { Result } from "${RESULT_NAME}";

export type InvoiceNotFound = "invoice-not-found";
export type VersionConflict = "version-conflict";

/** An invoice one read found, with the version the invoice was at when it was read. */
export type FoundInvoice = { readonly invoice: Invoice; readonly version: number };

export interface InvoiceRepository {
  findById(invoiceId: string): Result<FoundInvoice, InvoiceNotFound>;
  /**
   * Saves the invoice and appends its events together if the invoice is still at the expected version,
   * the one its read found; otherwise saves nothing.
   */
  store(
    invoiceId: string,
    invoice: Invoice,
    expectedVersion: number,
    events: readonly InvoiceEvent[],
  ): Result<void, VersionConflict>;
}
`;

const ISSUE_INVOICE = `import type { Invoice, InvoiceEvent, IssueInvoiceError } from "${DOMAIN_NAME}";
import type { CommandOutcome, Result } from "${RESULT_NAME}";
import type { FoundInvoice, InvoiceNotFound, InvoiceRepository, VersionConflict } from "./invoice-repository.ts";

export type IssueInvoiceFailure = InvoiceNotFound | IssueInvoiceError | VersionConflict;

export class IssueInvoice {
  readonly #invoices: InvoiceRepository;

  constructor(invoices: InvoiceRepository) {
    this.#invoices = invoices;
  }

  execute(invoiceId: string): Result<void, IssueInvoiceFailure> {
    const found: Result<FoundInvoice, InvoiceNotFound> = this.#invoices.findById(invoiceId);
    if (!found.ok) return found;
    const invoice: Invoice = found.value.invoice;
    const issued: Result<CommandOutcome<InvoiceEvent>, IssueInvoiceError> = invoice.issue();
    if (!issued.ok) return issued;
    if (issued.value.kind === "already-applied") return { ok: true, value: undefined };
    return this.#invoices.store(invoiceId, invoice, found.value.version, issued.value.events);
  }
}
`;

const RECORD_PAYMENT = `import type { Invoice, InvoiceEvent, RecordPaymentError } from "${DOMAIN_NAME}";
import type { CommandOutcome, Result } from "${RESULT_NAME}";
import type { FoundInvoice, InvoiceNotFound, InvoiceRepository, VersionConflict } from "./invoice-repository.ts";

export type RecordPaymentFailure = InvoiceNotFound | RecordPaymentError | VersionConflict;

export class RecordPayment {
  readonly #invoices: InvoiceRepository;

  constructor(invoices: InvoiceRepository) {
    this.#invoices = invoices;
  }

  execute(invoiceId: string, paymentId: string, amount: number): Result<void, RecordPaymentFailure> {
    const found: Result<FoundInvoice, InvoiceNotFound> = this.#invoices.findById(invoiceId);
    if (!found.ok) return found;
    const invoice: Invoice = found.value.invoice;
    const recorded: Result<CommandOutcome<InvoiceEvent>, RecordPaymentError> = invoice.recordPayment(paymentId, amount);
    if (!recorded.ok) return recorded;
    if (recorded.value.kind === "already-applied") return { ok: true, value: undefined };
    return this.#invoices.store(invoiceId, invoice, found.value.version, recorded.value.events);
  }
}
`;

const USE_CASE_INDEX = `export type { FoundInvoice, InvoiceNotFound, InvoiceRepository, VersionConflict } from "./invoice-repository.ts";
export type { IssueInvoiceFailure } from "./issue-invoice.ts";
export { IssueInvoice } from "./issue-invoice.ts";
export type { RecordPaymentFailure } from "./record-payment.ts";
export { RecordPayment } from "./record-payment.ts";
`;

const IN_MEMORY_INVOICE_REPOSITORY = `import { Invoice, InvoiceLine } from "${DOMAIN_NAME}";
import type { InvoiceEvent } from "${DOMAIN_NAME}";
import type { FoundInvoice, InvoiceNotFound, InvoiceRepository, VersionConflict } from "${USE_CASE_NAME}";
import type { Result } from "${RESULT_NAME}";

export type InvoiceRecord = {
  readonly customer: string;
  readonly amounts: readonly number[];
  readonly issued: boolean;
  readonly paid: number;
  readonly paymentIds: readonly string[];
};

/**
 * Keeps each invoice as a record of its whole state, starting from the records it is given. Every read
 * restores a new invoice from the record, so a change reaches the record only through a store that
 * succeeds. A store saves only when the invoice is still at the version its read found, then writes
 * the record, advances the version by one and appends every event of the command together.
 */
export class InMemoryInvoiceRepository implements InvoiceRepository {
  readonly #records: Map<string, InvoiceRecord>;
  readonly #versions: Map<string, number>;
  readonly #events: Map<string, readonly InvoiceEvent[]>;

  constructor(records: ReadonlyMap<string, InvoiceRecord>) {
    this.#records = new Map(records);
    this.#versions = new Map();
    this.#events = new Map();
  }

  findById(invoiceId: string): Result<FoundInvoice, InvoiceNotFound> {
    const record: InvoiceRecord | undefined = this.#records.get(invoiceId);
    if (record === undefined) return { ok: false, error: "invoice-not-found" };
    const lines: readonly InvoiceLine[] = record.amounts.map((amount: number) => InvoiceLine.of(amount));
    const invoice: Invoice = Invoice.restore(record.customer, lines, record.issued, record.paid, record.paymentIds);
    return { ok: true, value: { invoice, version: this.version(invoiceId) } };
  }

  store(
    invoiceId: string,
    invoice: Invoice,
    expectedVersion: number,
    events: readonly InvoiceEvent[],
  ): Result<void, VersionConflict> {
    const current: number = this.version(invoiceId);
    if (expectedVersion !== current) return { ok: false, error: "version-conflict" };
    const lines: readonly InvoiceLine[] = invoice.lines();
    this.#records.set(invoiceId, {
      customer: invoice.customer(),
      amounts: lines.map((line: InvoiceLine) => line.amount()),
      issued: invoice.issued(),
      paid: invoice.paid(),
      paymentIds: invoice.paymentIds(),
    });
    this.#versions.set(invoiceId, current + 1);
    this.#events.set(invoiceId, [...this.storedEvents(invoiceId), ...events]);
    return { ok: true, value: undefined };
  }

  /** How many times the invoice has been stored. */
  version(invoiceId: string): number {
    return this.#versions.get(invoiceId) ?? 0;
  }

  /** Every event stored with the invoice, in the order the stores appended them. */
  storedEvents(invoiceId: string): readonly InvoiceEvent[] {
    return this.#events.get(invoiceId) ?? [];
  }
}
`;

const INTERFACE_ADAPTER_INDEX = `export type { InvoiceRecord } from "./in-memory-invoice-repository.ts";
export { InMemoryInvoiceRepository } from "./in-memory-invoice-repository.ts";
`;

/**
 * The canonical model: `open` is a factory, `addLine`, `issue` and `recordPayment` are commands, each
 * with its own errors. `recordPayment` remembers its recent command ids and raises one or both of its
 * declared events.
 */
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
        invariants:
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
          - element_id: command.invoice.record-payment
            name: RecordPayment
            aggregate: aggregate.invoice
            effect: accumulation
            state_effect: none
            domain_errors:
              - { element_id: error.invoice.record-payment.not-issued, name: NotIssued, operation: command.invoice.record-payment, condition: the invoice is not issued }
              - { element_id: error.invoice.record-payment.overpayment, name: Overpayment, operation: command.invoice.record-payment, condition: the payment would take the paid amount above the total }
            events: [event.invoice.payment-recorded, event.invoice.settled]
            idempotency: { strategy: command-id-memory, retention: multiple, retention_count: 16, rationale: a payment request is retried until its answer arrives and other payments may come in between }
        events:
          - { element_id: event.invoice.issued, name: Issued, aggregate: aggregate.invoice, produced_by: command.invoice.issue }
          - { element_id: event.invoice.payment-recorded, name: PaymentRecorded, aggregate: aggregate.invoice, produced_by: command.invoice.record-payment }
          - { element_id: event.invoice.settled, name: Settled, aggregate: aggregate.invoice, produced_by: command.invoice.record-payment }
        transitions:
          - { element_id: transition.invoice.issue, name: Issue, aggregate: aggregate.invoice, from_state: draft, to_state: issued, command: command.invoice.issue }
        factory_rules:
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
  "    persistence_method: state-sourcing",
  "    reference_ids: [entity.invoice]",
  `    code: { language: typescript, package: "${DOMAIN_NAME}", module: [invoice], type: Invoice }`,
  "    operations:",
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
  "      - operation_ref: command.invoice.record-payment",
  "        code: { method: recordPayment, error_type: RecordPaymentError }",
  "        errors:",
  "          - { error_ref: error.invoice.record-payment.not-issued, code: { case: not-issued } }",
  "          - { error_ref: error.invoice.record-payment.overpayment, code: { case: overpayment } }",
  "domain_packages:",
  `  - { term: Billing, model_refs: [bc.billing], rationale: owns the billing business, code: ${location([])} }`,
  `  - { term: Invoice, model_refs: [aggregate.invoice], rationale: opens and issues invoices and records their payments, code: ${location(["invoice"])} }`,
  `  - { term: Invoice line, model_refs: [vo.invoice-line], rationale: the amounts an invoice adds up, code: ${location(["invoice", "line"])} }`,
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
  const parentSpecifier = named ? "./invoice.ts" : "./invoice/index.ts";
  const sources: Record<string, string> = {
    [`${RESULT_DIR}/src/index.ts`]: RESULT_INDEX,
    [`${RESULT_DIR}/src/command-outcome.ts`]: COMMAND_OUTCOME_SOURCE,
    [`${RESULT_DIR}/src/result.ts`]: RESULT_SOURCE,
    [`${DOMAIN_DIR}/src/index.ts`]: domainIndex(parentSpecifier),
    [parentModuleFile(layout)]:
      representation === "class" ? classInvoice(lineSpecifier) : companionInvoice(lineSpecifier),
    [`${DOMAIN_DIR}/src/invoice/line.ts`]: representation === "class" ? CLASS_LINE : COMPANION_LINE,
    [`${USE_CASE_DIR}/src/index.ts`]: USE_CASE_INDEX,
    [`${USE_CASE_DIR}/src/invoice-repository.ts`]: INVOICE_REPOSITORY_PORT,
    [`${USE_CASE_DIR}/src/issue-invoice.ts`]: ISSUE_INVOICE,
    [`${USE_CASE_DIR}/src/record-payment.ts`]: RECORD_PAYMENT,
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
