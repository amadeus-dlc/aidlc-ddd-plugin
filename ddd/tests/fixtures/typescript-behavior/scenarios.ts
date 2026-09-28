/**
 * The behavior scenarios every language's generated code has to pass (language-independent design
 * §11), stated once for the TypeScript generation samples: a successful state change, a business
 * error that leaves the state as it was, an invalid value refused at construction, a state restored
 * after persistence, and the command outcomes — a repeated command that is already applied, a
 * refused command that changes nothing, and several events saved by one append.
 *
 * A scenario receives the modules a sample's packages export, loaded from the sample as written, so
 * the same steps run the class and the companion representation under either module layout. The
 * types below state only the surface the scenarios call; the samples themselves are not changed.
 *
 * A command that declares events succeeds in one of two ways: `applied`, carrying the events it
 * raised, or — for a command that remembers its command ids — `already-applied`, which raises none
 * and changes nothing. The in-memory repository says what it has saved: its version of an invoice,
 * which one save advances by one, and the events saved with it. A read returns the invoice with the
 * version it was read at, and a store saves only when the invoice is still at that version.
 */

import { expect } from "bun:test";

type Result<T, E> = { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: E };

/** The success side of a command that declares events. */
export type CommandOutcome =
  | { readonly kind: "applied"; readonly events: readonly unknown[] }
  | { readonly kind: "already-applied"; readonly events?: readonly unknown[] };

export interface InvoiceLine {
  addTo(total: number): number;
}
export interface Invoice {
  addLine(line: InvoiceLine): Result<void, string>;
  issue(): Result<CommandOutcome, string>;
  recordPayment(commandId: string, amount: number): Result<CommandOutcome, string>;
  isBilledTo(customer: string): boolean;
  total(): number;
  paid(): number;
  lines(): readonly InvoiceLine[];
}
export interface InvoiceRecord {
  readonly customer: string;
  readonly amounts: readonly number[];
  readonly issued: boolean;
  readonly paid: number;
  readonly paymentIds: readonly string[];
}
/** An invoice one read found, with the version it was read at. */
export interface FoundInvoice {
  readonly invoice: Invoice;
  readonly version: number;
}
export interface InMemoryInvoiceRepository {
  findById(invoiceId: string): Result<FoundInvoice, string>;
  store(invoiceId: string, invoice: Invoice, expectedVersion: number, events: readonly unknown[]): Result<void, string>;
  version(invoiceId: string): number;
  storedEvents(invoiceId: string): readonly unknown[];
}

/** What the domain, use-case and interface-adapter packages of a sample export. */
export interface SampleModules {
  readonly Invoice: {
    open(customer: string, lines: readonly InvoiceLine[]): Result<Invoice, string>;
    restore(
      customer: string,
      lines: readonly InvoiceLine[],
      issued: boolean,
      paid: number,
      paymentIds: readonly string[],
    ): Invoice;
  };
  readonly InvoiceLine: { of(amount: number): InvoiceLine };
  readonly IssueInvoice: new (invoices: InMemoryInvoiceRepository) => {
    execute(invoiceId: string): Result<void, string>;
  };
  readonly RecordPayment: new (invoices: InMemoryInvoiceRepository) => {
    execute(invoiceId: string, commandId: string, amount: number): Result<void, string>;
  };
  readonly InMemoryInvoiceRepository: new (records: ReadonlyMap<string, InvoiceRecord>) => InMemoryInvoiceRepository;
}

export interface BehaviorScenario {
  readonly id:
    | "state-change"
    | "business-error-keeps-state"
    | "invalid-value-rejected"
    | "restore-after-persistence"
    | "duplicate-command-already-applied"
    | "rejected-command-keeps-state"
    | "multiple-events-one-append";
  readonly description: string;
  readonly run: (modules: SampleModules) => void;
}

function value<T>(result: Result<T, string>): T {
  if (!result.ok) throw new Error(`expected success, got the error ${result.error}`);
  return result.value;
}
function expectError(result: Result<unknown, string>, error: string): void {
  expect(result).toEqual({ ok: false, error });
}
function expectOk(result: Result<void, string>): void {
  expect(result).toEqual({ ok: true, value: undefined });
}
/** The command applied and raised `events` events. */
function expectApplied(result: Result<CommandOutcome, string>, events: number): void {
  const outcome = value(result);
  expect(outcome.kind).toBe("applied");
  expect(outcome.events).toHaveLength(events);
}
/** The events of a command that applied. */
function eventsOf(result: Result<CommandOutcome, string>): readonly unknown[] {
  const outcome = value(result);
  if (outcome.kind !== "applied") throw new Error(`expected the command to apply, got ${outcome.kind}`);
  return outcome.events;
}
/** The command was already applied: it raised no event. */
function expectAlreadyApplied(result: Result<CommandOutcome, string>): void {
  const outcome = value(result);
  expect(outcome.kind).toBe("already-applied");
  expect(outcome.events ?? []).toHaveLength(0);
}

/** What the repository has saved of one invoice: its version and the events saved with it. */
function savedOf(repository: InMemoryInvoiceRepository, invoiceId: string): { version: number; events: number } {
  return { version: repository.version(invoiceId), events: repository.storedEvents(invoiceId).length };
}

const CUSTOMER = "acme";
const DRAFT = "invoice-draft";
const EMPTY_DRAFT = "invoice-empty";
const ISSUED = "invoice-issued";
const UNKNOWN = "invoice-unknown";
const PART_PAID = "invoice-part-paid";

/** The persisted records a repository starts from: a draft with lines, a draft without, an issued one. */
function records(): ReadonlyMap<string, InvoiceRecord> {
  return new Map<string, InvoiceRecord>([
    [DRAFT, { customer: CUSTOMER, amounts: [100, 20], issued: false, paid: 0, paymentIds: [] }],
    [EMPTY_DRAFT, { customer: CUSTOMER, amounts: [], issued: false, paid: 0, paymentIds: [] }],
    [ISSUED, { customer: CUSTOMER, amounts: [5], issued: true, paid: 0, paymentIds: [] }],
  ]);
}

/** One persisted record of an issued invoice of 100 with 30 paid, remembering `paymentIds`. */
function partPaidRecords(paymentIds: readonly string[]): ReadonlyMap<string, InvoiceRecord> {
  return new Map<string, InvoiceRecord>([[PART_PAID, { customer: CUSTOMER, amounts: [100], issued: true, paid: 30, paymentIds }]]);
}

/** `count` payment command ids, `payment-0` onwards. */
function paymentIds(count: number): string[] {
  return Array.from({ length: count }, (_, index: number) => `payment-${index}`);
}

export const BEHAVIOR_SCENARIOS: readonly BehaviorScenario[] = [
  {
    id: "state-change",
    description: "a command that succeeds changes the aggregate's state, and an issued invoice accepts no further change",
    run: ({ Invoice, InvoiceLine, IssueInvoice, InMemoryInvoiceRepository }) => {
      const invoice = value(Invoice.open(CUSTOMER, [InvoiceLine.of(100)]));
      expect(invoice.total()).toBe(100);
      expectOk(invoice.addLine(InvoiceLine.of(50)));
      expect(invoice.total()).toBe(150);
      expect(invoice.lines()).toHaveLength(2);
      expectApplied(invoice.issue(), 1);
      expectError(invoice.addLine(InvoiceLine.of(1)), "already-issued");
      expectError(invoice.issue(), "already-issued");
      expect(invoice.total()).toBe(150);

      expectOk(new IssueInvoice(new InMemoryInvoiceRepository(records())).execute(DRAFT));
    },
  },
  {
    id: "business-error-keeps-state",
    description: "a command refused with a business error leaves the aggregate's state as it was",
    run: ({ Invoice, InvoiceLine, IssueInvoice, InMemoryInvoiceRepository }) => {
      const invoice = value(Invoice.open(CUSTOMER, [InvoiceLine.of(100)]));
      expectError(invoice.addLine(InvoiceLine.of(-150)), "negative-total");
      expect(invoice.total()).toBe(100);
      expect(invoice.lines()).toHaveLength(1);

      const empty = value(Invoice.open(CUSTOMER, []));
      expectError(empty.issue(), "empty-lines");
      // Still a draft: a refused issue did not issue it.
      expectOk(empty.addLine(InvoiceLine.of(10)));
      expectApplied(empty.issue(), 1);

      const repository = new InMemoryInvoiceRepository(records());
      expectError(new IssueInvoice(repository).execute(ISSUED), "already-issued");
      expectError(new IssueInvoice(repository).execute(EMPTY_DRAFT), "empty-lines");
      const issued = value(repository.findById(ISSUED)).invoice;
      expect(issued.total()).toBe(5);
      expectError(issued.addLine(InvoiceLine.of(1)), "already-issued");
      const stillEmpty = value(repository.findById(EMPTY_DRAFT)).invoice;
      expect(stillEmpty.lines()).toHaveLength(0);
      expectOk(stillEmpty.addLine(InvoiceLine.of(1)));
    },
  },
  {
    id: "invalid-value-rejected",
    description:
      "an aggregate is never constructed from values its invariants forbid, and a persisted state that breaks them is refused as corrupt",
    run: ({ Invoice, InvoiceLine }) => {
      expectError(Invoice.open("", [InvoiceLine.of(1)]), "missing-customer");
      expectError(Invoice.open(CUSTOMER, [InvoiceLine.of(-1)]), "negative-total");
      expect(() => Invoice.restore("", [InvoiceLine.of(1)], false, 0, [])).toThrow("corrupt invoice state");
      expect(() => Invoice.restore(CUSTOMER, [], true, 0, [])).toThrow("corrupt invoice state");
      expect(() => Invoice.restore(CUSTOMER, [InvoiceLine.of(-1)], false, 0, [])).toThrow("corrupt invoice state");
      // A state paid up to its total and remembering as many ids as the invoice keeps is restored.
      const lines = [InvoiceLine.of(10)];
      expect(Invoice.restore(CUSTOMER, lines, true, 10, paymentIds(16)).paid()).toBe(10);
      expect(() => Invoice.restore(CUSTOMER, lines, true, 10, paymentIds(17))).toThrow("corrupt invoice state");
      expect(() => Invoice.restore(CUSTOMER, lines, true, 11, paymentIds(16))).toThrow("corrupt invoice state");
      expect(() => Invoice.restore(CUSTOMER, lines, true, -1, [])).toThrow("corrupt invoice state");
      expect(() => Invoice.restore(CUSTOMER, lines, false, 5, [])).toThrow("corrupt invoice state");
      expect(() => Invoice.restore(CUSTOMER, lines, false, 0, ["payment-0"])).toThrow("corrupt invoice state");
    },
  },
  {
    id: "restore-after-persistence",
    description: "an aggregate read back from its persisted state has the state that was persisted",
    run: ({ InvoiceLine, IssueInvoice, InMemoryInvoiceRepository }) => {
      const repository = new InMemoryInvoiceRepository(records());
      const draft = value(repository.findById(DRAFT)).invoice;
      expect(draft.total()).toBe(120);
      expect(draft.lines()).toHaveLength(2);
      expect(draft.isBilledTo(CUSTOMER)).toBe(true);
      expect(draft.isBilledTo("another-customer")).toBe(false);
      expectError(value(repository.findById(ISSUED)).invoice.issue(), "already-issued");

      const persisted = new InMemoryInvoiceRepository(records());
      const issueInvoice = new IssueInvoice(persisted);
      expectOk(issueInvoice.execute(DRAFT));
      // The stored invoice, not the draft record it was read from, is what the next read returns.
      const stored = value(persisted.findById(DRAFT)).invoice;
      expect(stored.total()).toBe(120);
      expect(stored.isBilledTo(CUSTOMER)).toBe(true);
      expectError(stored.addLine(InvoiceLine.of(1)), "already-issued");
      expectError(issueInvoice.execute(DRAFT), "already-issued");

      expectError(repository.findById(UNKNOWN), "invoice-not-found");
      expectError(issueInvoice.execute(UNKNOWN), "invoice-not-found");
    },
  },
  {
    id: "duplicate-command-already-applied",
    description:
      "a command that remembers its command ids, repeated with the same id, is already applied: no event, no change, nothing saved, also on an invoice restored from its persisted state",
    run: ({ Invoice, InvoiceLine, IssueInvoice, RecordPayment, InMemoryInvoiceRepository }) => {
      const invoice = value(Invoice.open(CUSTOMER, [InvoiceLine.of(100)]));
      expectApplied(invoice.issue(), 1);
      expectApplied(invoice.recordPayment("payment-1", 30), 1);
      expect(invoice.paid()).toBe(30);
      expectAlreadyApplied(invoice.recordPayment("payment-1", 30));
      expect(invoice.paid()).toBe(30);
      // Only the command id decides: the same id with another amount is the same command again.
      expectAlreadyApplied(invoice.recordPayment("payment-1", 50));
      expect(invoice.paid()).toBe(30);
      expectApplied(invoice.recordPayment("payment-2", 30), 1);
      expect(invoice.paid()).toBe(60);

      const repository = new InMemoryInvoiceRepository(records());
      expectOk(new IssueInvoice(repository).execute(DRAFT));
      const recordPayment = new RecordPayment(repository);
      expectOk(recordPayment.execute(DRAFT, "payment-1", 30));
      const saved = savedOf(repository, DRAFT);
      expectOk(recordPayment.execute(DRAFT, "payment-1", 30));
      expect(savedOf(repository, DRAFT)).toEqual(saved);
      expect(value(repository.findById(DRAFT)).invoice.paid()).toBe(30);

      // A restored invoice decides with the paid amount and the ids its persisted state holds.
      const restored = Invoice.restore(CUSTOMER, [InvoiceLine.of(100)], true, 30, ["payment-1"]);
      expectAlreadyApplied(restored.recordPayment("payment-1", 30));
      expect(restored.paid()).toBe(30);
      expectError(restored.recordPayment("payment-2", 80), "overpayment");
      expect(restored.paid()).toBe(30);

      const remembering = new InMemoryInvoiceRepository(partPaidRecords(["payment-1"]));
      expectOk(new RecordPayment(remembering).execute(PART_PAID, "payment-1", 30));
      expect(savedOf(remembering, PART_PAID)).toEqual({ version: 0, events: 0 });
      expect(value(remembering.findById(PART_PAID)).invoice.paid()).toBe(30);
      // A record that does not remember the id has the payment applied.
      const forgetting = new InMemoryInvoiceRepository(partPaidRecords([]));
      expectOk(new RecordPayment(forgetting).execute(PART_PAID, "payment-1", 30));
      expect(savedOf(forgetting, PART_PAID)).toEqual({ version: 1, events: 1 });
      expect(value(forgetting.findById(PART_PAID)).invoice.paid()).toBe(60);
    },
  },
  {
    id: "rejected-command-keeps-state",
    description:
      "a command that remembers its command ids and is refused changes nothing, saves nothing and does not remember the id",
    run: ({ Invoice, InvoiceLine, IssueInvoice, RecordPayment, InMemoryInvoiceRepository }) => {
      const draft = value(Invoice.open(CUSTOMER, [InvoiceLine.of(100)]));
      expectError(draft.recordPayment("payment-1", 30), "not-issued");
      expect(draft.paid()).toBe(0);

      const invoice = value(Invoice.open(CUSTOMER, [InvoiceLine.of(100)]));
      expectApplied(invoice.issue(), 1);
      expectError(invoice.recordPayment("payment-1", 150), "overpayment");
      expect(invoice.paid()).toBe(0);
      // A refused command is not remembered: the same id is applied once it can be.
      expectApplied(invoice.recordPayment("payment-1", 30), 1);
      expect(invoice.paid()).toBe(30);

      const repository = new InMemoryInvoiceRepository(records());
      const recordPayment = new RecordPayment(repository);
      expectError(recordPayment.execute(DRAFT, "payment-1", 30), "not-issued");
      expectOk(new IssueInvoice(repository).execute(DRAFT));
      const saved = savedOf(repository, DRAFT);
      expectError(recordPayment.execute(DRAFT, "payment-1", 500), "overpayment");
      expect(savedOf(repository, DRAFT)).toEqual(saved);
      expect(value(repository.findById(DRAFT)).invoice.paid()).toBe(0);
      expectError(recordPayment.execute(UNKNOWN, "payment-1", 30), "invoice-not-found");
    },
  },
  {
    id: "multiple-events-one-append",
    description:
      "a command that raises several of its declared events has them saved together by one append, which advances the version once; a store of an invoice saved again since its read is refused and saves nothing",
    run: ({ Invoice, InvoiceLine, IssueInvoice, RecordPayment, InMemoryInvoiceRepository }) => {
      const invoice = value(Invoice.open(CUSTOMER, [InvoiceLine.of(100), InvoiceLine.of(20)]));
      expectApplied(invoice.issue(), 1);
      // A part payment records the payment; the payment that reaches the total also settles it.
      expectApplied(invoice.recordPayment("payment-1", 20), 1);
      expectApplied(invoice.recordPayment("payment-2", 100), 2);
      expect(invoice.paid()).toBe(120);

      const repository = new InMemoryInvoiceRepository(records());
      expectOk(new IssueInvoice(repository).execute(DRAFT));
      const recordPayment = new RecordPayment(repository);
      const issued = savedOf(repository, DRAFT);
      expectOk(recordPayment.execute(DRAFT, "payment-1", 20));
      const partlyPaid = savedOf(repository, DRAFT);
      expect(partlyPaid).toEqual({ version: issued.version + 1, events: issued.events + 1 });
      expectOk(recordPayment.execute(DRAFT, "payment-2", 100));
      expect(savedOf(repository, DRAFT)).toEqual({ version: partlyPaid.version + 1, events: partlyPaid.events + 2 });
      expect(value(repository.findById(DRAFT)).invoice.paid()).toBe(120);

      // A store checks the version its own read found, whatever was read in between.
      const contended = new InMemoryInvoiceRepository(records());
      expectOk(new IssueInvoice(contended).execute(DRAFT));
      const first = value(contended.findById(DRAFT));
      const second = value(contended.findById(DRAFT));
      const secondEvents = eventsOf(second.invoice.recordPayment("payment-2", 20));
      expectOk(contended.store(DRAFT, second.invoice, second.version, secondEvents));
      expect(savedOf(contended, DRAFT)).toEqual({ version: 2, events: 2 });
      value(contended.findById(DRAFT));
      const firstEvents = eventsOf(first.invoice.recordPayment("payment-1", 30));
      expectError(contended.store(DRAFT, first.invoice, first.version, firstEvents), "version-conflict");
      expect(savedOf(contended, DRAFT)).toEqual({ version: 2, events: 2 });
      // The refused change was not saved: a new read lacks it, and the same payment applies there.
      const reread = value(contended.findById(DRAFT));
      expect(reread.invoice.paid()).toBe(20);
      const rereadEvents = eventsOf(reread.invoice.recordPayment("payment-1", 30));
      expect(rereadEvents).toHaveLength(1);
      expectOk(contended.store(DRAFT, reread.invoice, reread.version, rereadEvents));
      expect(savedOf(contended, DRAFT)).toEqual({ version: 3, events: 3 });
      expect(value(contended.findById(DRAFT)).invoice.paid()).toBe(50);
    },
  },
];
