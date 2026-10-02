/**
 * The behavior scenarios every language's generated code has to pass (language-independent design
 * §11), stated once for the TypeScript generation samples: a successful state change, a business
 * error that leaves the state as it was, an invalid value refused at construction, and a state
 * restored after persistence.
 *
 * A scenario receives the modules a sample's packages export, loaded from the sample as written, so
 * the same steps run the class and the companion representation under either module layout. The
 * types below state only the surface the scenarios call; the samples themselves are not changed.
 */

import { expect } from "bun:test";

type Result<T, E> = { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: E };

export interface Money {
  equals(other: Money): boolean;
}
export interface InvoiceLine {
  addTo(total: Money): Money;
}
export interface Invoice {
  addLine(line: InvoiceLine): Result<void, string>;
  issue(): Result<void, string>;
  isBilledTo(customer: string): boolean;
  total(): Money;
  lines(): readonly InvoiceLine[];
}
export interface InvoiceRecord {
  readonly customer: string;
  readonly amounts: readonly number[];
  readonly issued: boolean;
}
export interface InvoiceRepository {
  findById(invoiceId: string): Result<Invoice, string>;
  store(invoiceId: string, invoice: Invoice): void;
}

/** What the domain, use-case and interface-adapter packages of a sample export. */
export interface SampleModules {
  readonly Invoice: {
    open(customer: string, lines: readonly InvoiceLine[]): Result<Invoice, string>;
    restore(customer: string, lines: readonly InvoiceLine[], issued: boolean): Invoice;
  };
  readonly Money: { of(value: number): Money };
  readonly InvoiceLine: { of(amount: Money): InvoiceLine };
  readonly IssueInvoiceUseCase: new (invoiceRepository: InvoiceRepository) => {
    execute(invoiceId: string): Result<void, string>;
  };
  readonly InMemoryInvoiceRepository: new (records: ReadonlyMap<string, InvoiceRecord>) => InvoiceRepository;
}

export interface BehaviorScenario {
  readonly id: "state-change" | "business-error-keeps-state" | "invalid-value-rejected" | "restore-after-persistence";
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

/** Lines built from amounts, and totals checked through the value equality of `Money`, which exposes no number. */
function amounts({ Money, InvoiceLine }: SampleModules) {
  return {
    line: (amount: number): InvoiceLine => InvoiceLine.of(Money.of(amount)),
    expectTotal: (invoice: Invoice, amount: number): void => {
      expect(invoice.total().equals(Money.of(amount))).toBe(true);
    },
  };
}

const CUSTOMER = "acme";
const DRAFT = "invoice-draft";
const EMPTY_DRAFT = "invoice-empty";
const ISSUED = "invoice-issued";
const UNKNOWN = "invoice-unknown";

/** The persisted records a repository starts from: a draft with lines, a draft without, an issued one. */
function records(): ReadonlyMap<string, InvoiceRecord> {
  return new Map<string, InvoiceRecord>([
    [DRAFT, { customer: CUSTOMER, amounts: [100, 20], issued: false }],
    [EMPTY_DRAFT, { customer: CUSTOMER, amounts: [], issued: false }],
    [ISSUED, { customer: CUSTOMER, amounts: [5], issued: true }],
  ]);
}

export const BEHAVIOR_SCENARIOS: readonly BehaviorScenario[] = [
  {
    id: "state-change",
    description: "a command that succeeds changes the aggregate's state, and an issued invoice accepts no further change",
    run: (modules) => {
      const { Invoice, IssueInvoiceUseCase, InMemoryInvoiceRepository } = modules;
      const { line, expectTotal } = amounts(modules);
      const invoice = value(Invoice.open(CUSTOMER, [line(100)]));
      expectTotal(invoice, 100);
      expectOk(invoice.addLine(line(50)));
      expectTotal(invoice, 150);
      expect(invoice.lines()).toHaveLength(2);
      expectOk(invoice.issue());
      expectError(invoice.addLine(line(1)), "already-issued");
      expectError(invoice.issue(), "already-issued");
      expectTotal(invoice, 150);

      expectOk(new IssueInvoiceUseCase(new InMemoryInvoiceRepository(records())).execute(DRAFT));
    },
  },
  {
    id: "business-error-keeps-state",
    description: "a command refused with a business error leaves the aggregate's state as it was",
    run: (modules) => {
      const { Invoice, IssueInvoiceUseCase, InMemoryInvoiceRepository } = modules;
      const { line, expectTotal } = amounts(modules);
      const invoice = value(Invoice.open(CUSTOMER, [line(100)]));
      expectError(invoice.addLine(line(-150)), "negative-total");
      expectTotal(invoice, 100);
      expect(invoice.lines()).toHaveLength(1);

      const empty = value(Invoice.open(CUSTOMER, []));
      expectError(empty.issue(), "empty-lines");
      // Still a draft: a refused issue did not issue it.
      expectOk(empty.addLine(line(10)));
      expectOk(empty.issue());

      const repository = new InMemoryInvoiceRepository(records());
      expectError(new IssueInvoiceUseCase(repository).execute(ISSUED), "already-issued");
      expectError(new IssueInvoiceUseCase(repository).execute(EMPTY_DRAFT), "empty-lines");
      const issued = value(repository.findById(ISSUED));
      expectTotal(issued, 5);
      expectError(issued.addLine(line(1)), "already-issued");
      const stillEmpty = value(repository.findById(EMPTY_DRAFT));
      expect(stillEmpty.lines()).toHaveLength(0);
      expectOk(stillEmpty.addLine(line(1)));
    },
  },
  {
    id: "invalid-value-rejected",
    description: "an aggregate is never constructed from values its invariants forbid",
    run: (modules) => {
      const { Invoice } = modules;
      const { line } = amounts(modules);
      expectError(Invoice.open("", [line(1)]), "missing-customer");
      expectError(Invoice.open(CUSTOMER, [line(-1)]), "negative-total");
      expect(() => Invoice.restore("", [line(1)], false)).toThrow("corrupt invoice state");
      expect(() => Invoice.restore(CUSTOMER, [], true)).toThrow("corrupt invoice state");
      expect(() => Invoice.restore(CUSTOMER, [line(-1)], false)).toThrow("corrupt invoice state");
    },
  },
  {
    id: "restore-after-persistence",
    description: "an aggregate read back from its persisted state has the state that was persisted",
    run: (modules) => {
      const { IssueInvoiceUseCase, InMemoryInvoiceRepository } = modules;
      const { line, expectTotal } = amounts(modules);
      const repository = new InMemoryInvoiceRepository(records());
      const draft = value(repository.findById(DRAFT));
      expectTotal(draft, 120);
      expect(draft.lines()).toHaveLength(2);
      expect(draft.isBilledTo(CUSTOMER)).toBe(true);
      expect(draft.isBilledTo("another-customer")).toBe(false);
      expectError(value(repository.findById(ISSUED)).issue(), "already-issued");

      const persisted = new InMemoryInvoiceRepository(records());
      const issueInvoice = new IssueInvoiceUseCase(persisted);
      expectOk(issueInvoice.execute(DRAFT));
      // The stored invoice, not the draft record it was read from, is what the next read returns.
      const stored = value(persisted.findById(DRAFT));
      expectTotal(stored, 120);
      expect(stored.isBilledTo(CUSTOMER)).toBe(true);
      expectError(stored.addLine(line(1)), "already-issued");
      expectError(issueInvoice.execute(DRAFT), "already-issued");

      expectError(repository.findById(UNKNOWN), "invoice-not-found");
      expectError(issueInvoice.execute(UNKNOWN), "invoice-not-found");
    },
  },
];
