/**
 * The behavior scenarios every language's generated code has to pass (language-independent design
 * §11), stated once for the TypeScript generation samples: a successful state change, a business
 * error that leaves the state as it was, an invalid value refused at construction, a state restored
 * after persistence, and the command outcomes — a repeated command that is already applied, a
 * refused command that changes nothing, and one event appended per command. One more scenario holds
 * for TypeScript alone: a command leaves the instance it was called on as it was.
 *
 * A scenario receives the modules a sample's packages export, loaded from the sample as written, so
 * the same steps run the class and the companion representation under either module layout. The
 * types below state only the surface the scenarios call; the samples themselves are not changed.
 *
 * A TypeScript domain method does not change the instance it is called on. A command that succeeds
 * returns the next instance together with the one event it raised; a command that remembers its
 * command ids succeeds either `applied`, with the next instance and its event, or `already-applied`,
 * which carries neither. The in-memory repository says what it has saved: its version of an invoice,
 * which one save advances by one, and the events saved with it. A read returns the invoice with the
 * version it was read at, and a store saves the one event of one command only when the invoice is
 * still at that version.
 */

import { expect } from "bun:test";

type Result<T, E> = { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: E };

/** The success side of a command: the instance after it and the one event it raised. */
export interface Change {
  readonly next: Invoice;
  readonly event: unknown;
}
/** The success side of a command that remembers its command ids. */
export type CommandOutcome =
  | { readonly kind: "applied"; readonly next: Invoice; readonly event: unknown }
  | { readonly kind: "already-applied" };

export interface InvoiceLine {
  addTo(total: number): number;
}
export interface Invoice {
  addLine(line: InvoiceLine): Result<Change, string>;
  issue(): Result<Change, string>;
  recordPayment(commandId: string, amount: number): Result<CommandOutcome, string>;
  isBilledTo(customer: string): boolean;
  isSettled(): boolean;
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
  store(invoiceId: string, invoice: Invoice, expectedVersion: number, event: unknown): Result<void, string>;
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
    | "one-event-appended-per-command";
  readonly description: string;
  readonly run: (modules: SampleModules) => void;
}

/** A scenario that holds for TypeScript alone, where a domain method returns a new instance. */
export interface TypeScriptScenario {
  readonly id: "command-keeps-original-instance";
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
/** The command succeeded with one event; the instance after it. */
function changed(result: Result<Change, string>): Invoice {
  const change = value(result);
  expect(change.event).toBeDefined();
  return change.next;
}
/** The command that remembers its command ids applied with one event; what it returned. */
function appliedChange(result: Result<CommandOutcome, string>): Change {
  const outcome = value(result);
  if (outcome.kind !== "applied") throw new Error(`expected the command to apply, got ${outcome.kind}`);
  expect(outcome.event).toBeDefined();
  return { next: outcome.next, event: outcome.event };
}
/** The command was already applied: it returned no instance and raised no event. */
function expectAlreadyApplied(result: Result<CommandOutcome, string>): void {
  expect(value(result)).toEqual({ kind: "already-applied" });
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
      const opened = value(Invoice.open(CUSTOMER, [InvoiceLine.of(100)]));
      expect(opened.total()).toBe(100);
      const added = changed(opened.addLine(InvoiceLine.of(50)));
      expect(added.total()).toBe(150);
      expect(added.lines()).toHaveLength(2);
      const issued = changed(added.issue());
      expectError(issued.addLine(InvoiceLine.of(1)), "already-issued");
      expectError(issued.issue(), "already-issued");
      expect(issued.total()).toBe(150);

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
      changed(changed(empty.addLine(InvoiceLine.of(10))).issue());

      const repository = new InMemoryInvoiceRepository(records());
      expectError(new IssueInvoice(repository).execute(ISSUED), "already-issued");
      expectError(new IssueInvoice(repository).execute(EMPTY_DRAFT), "empty-lines");
      const issued = value(repository.findById(ISSUED)).invoice;
      expect(issued.total()).toBe(5);
      expectError(issued.addLine(InvoiceLine.of(1)), "already-issued");
      const stillEmpty = value(repository.findById(EMPTY_DRAFT)).invoice;
      expect(stillEmpty.lines()).toHaveLength(0);
      changed(stillEmpty.addLine(InvoiceLine.of(1)));
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
      // The use case stored the instance the command returned, not the draft it was read as.
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
      const issued = changed(value(Invoice.open(CUSTOMER, [InvoiceLine.of(100)])).issue());
      const once = appliedChange(issued.recordPayment("payment-1", 30)).next;
      expect(once.paid()).toBe(30);
      expectAlreadyApplied(once.recordPayment("payment-1", 30));
      expect(once.paid()).toBe(30);
      // Only the command id decides: the same id with another amount is the same command again.
      expectAlreadyApplied(once.recordPayment("payment-1", 50));
      expect(once.paid()).toBe(30);
      const twice = appliedChange(once.recordPayment("payment-2", 30)).next;
      expect(twice.paid()).toBe(60);

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

      const issued = changed(value(Invoice.open(CUSTOMER, [InvoiceLine.of(100)])).issue());
      expectError(issued.recordPayment("payment-1", 150), "overpayment");
      expect(issued.paid()).toBe(0);
      // A refused command is not remembered: the same id is applied once it can be.
      expect(appliedChange(issued.recordPayment("payment-1", 30)).next.paid()).toBe(30);

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
    id: "one-event-appended-per-command",
    description:
      "every command that changes state is saved with its one event by one append that advances the version by one — the payment that settles the invoice too, since being settled is read from the state; a store of an invoice saved again since its read is refused and saves nothing",
    run: ({ Invoice, InvoiceLine, IssueInvoice, RecordPayment, InMemoryInvoiceRepository }) => {
      const issued = changed(value(Invoice.open(CUSTOMER, [InvoiceLine.of(100), InvoiceLine.of(20)])).issue());
      const partlyPaid = appliedChange(issued.recordPayment("payment-1", 20)).next;
      expect(partlyPaid.isSettled()).toBe(false);
      // The payment that reaches the total settles the invoice and still raises its one event.
      const settled = appliedChange(partlyPaid.recordPayment("payment-2", 100)).next;
      expect(settled.paid()).toBe(120);
      expect(settled.isSettled()).toBe(true);

      const repository = new InMemoryInvoiceRepository(records());
      expect(savedOf(repository, DRAFT)).toEqual({ version: 0, events: 0 });
      expectOk(new IssueInvoice(repository).execute(DRAFT));
      expect(savedOf(repository, DRAFT)).toEqual({ version: 1, events: 1 });
      const recordPayment = new RecordPayment(repository);
      expectOk(recordPayment.execute(DRAFT, "payment-1", 20));
      expect(savedOf(repository, DRAFT)).toEqual({ version: 2, events: 2 });
      expectOk(recordPayment.execute(DRAFT, "payment-2", 100));
      expect(savedOf(repository, DRAFT)).toEqual({ version: 3, events: 3 });
      const stored = value(repository.findById(DRAFT)).invoice;
      expect(stored.paid()).toBe(120);
      expect(stored.isSettled()).toBe(true);

      // A store appends the one event it is handed, checked against the version its own read found.
      const contended = new InMemoryInvoiceRepository(records());
      expectOk(new IssueInvoice(contended).execute(DRAFT));
      const first = value(contended.findById(DRAFT));
      const second = value(contended.findById(DRAFT));
      const secondChange = appliedChange(second.invoice.recordPayment("payment-2", 20));
      expectOk(contended.store(DRAFT, secondChange.next, second.version, secondChange.event));
      expect(savedOf(contended, DRAFT)).toEqual({ version: 2, events: 2 });
      expect(contended.storedEvents(DRAFT).at(-1)).toEqual(secondChange.event);
      value(contended.findById(DRAFT));
      const firstChange = appliedChange(first.invoice.recordPayment("payment-1", 30));
      expectError(contended.store(DRAFT, firstChange.next, first.version, firstChange.event), "version-conflict");
      expect(savedOf(contended, DRAFT)).toEqual({ version: 2, events: 2 });
      // The refused change was not saved: a new read lacks it, and the same payment applies there.
      const reread = value(contended.findById(DRAFT));
      expect(reread.invoice.paid()).toBe(20);
      const rereadChange = appliedChange(reread.invoice.recordPayment("payment-1", 30));
      expectOk(contended.store(DRAFT, rereadChange.next, reread.version, rereadChange.event));
      expect(savedOf(contended, DRAFT)).toEqual({ version: 3, events: 3 });
      expect(value(contended.findById(DRAFT)).invoice.paid()).toBe(50);
    },
  },
];

export const TYPESCRIPT_SCENARIOS: readonly TypeScriptScenario[] = [
  {
    id: "command-keeps-original-instance",
    description:
      "a command returns the next instance and leaves the one it was called on, and what that one already returned, as they were",
    run: ({ Invoice, InvoiceLine }) => {
      const opened = value(Invoice.open(CUSTOMER, [InvoiceLine.of(100)]));
      const openedLines = opened.lines();
      const added = changed(opened.addLine(InvoiceLine.of(50)));
      expect(added.total()).toBe(150);
      expect(opened.total()).toBe(100);
      expect(opened.lines()).toHaveLength(1);
      expect(openedLines).toHaveLength(1);

      const issued = changed(added.issue());
      // The instance issue was called on is still a draft: it still accepts a line.
      expect(changed(added.addLine(InvoiceLine.of(1))).total()).toBe(151);
      expectError(issued.addLine(InvoiceLine.of(1)), "already-issued");

      const settled = appliedChange(issued.recordPayment("payment-1", 150)).next;
      expect(settled.paid()).toBe(150);
      expect(settled.isSettled()).toBe(true);
      expect(issued.paid()).toBe(0);
      expect(issued.isSettled()).toBe(false);
      // Nor does it remember the command id the next instance remembers.
      expect(appliedChange(issued.recordPayment("payment-1", 150)).next.paid()).toBe(150);
      expectAlreadyApplied(settled.recordPayment("payment-1", 150));
    },
  },
];
