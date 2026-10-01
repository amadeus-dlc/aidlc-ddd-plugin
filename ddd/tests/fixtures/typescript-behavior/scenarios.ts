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

export interface InvoiceLine {
  addTo(total: number): number;
}
export interface Invoice {
  addLine(line: InvoiceLine): Result<void, string>;
  issue(): Result<void, string>;
  isBilledTo(customer: string): boolean;
  total(): number;
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
  readonly InvoiceLine: { of(amount: number): InvoiceLine };
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
    run: ({ Invoice, InvoiceLine, IssueInvoiceUseCase, InMemoryInvoiceRepository }) => {
      const invoice = value(Invoice.open(CUSTOMER, [InvoiceLine.of(100)]));
      expect(invoice.total()).toBe(100);
      expectOk(invoice.addLine(InvoiceLine.of(50)));
      expect(invoice.total()).toBe(150);
      expect(invoice.lines()).toHaveLength(2);
      expectOk(invoice.issue());
      expectError(invoice.addLine(InvoiceLine.of(1)), "already-issued");
      expectError(invoice.issue(), "already-issued");
      expect(invoice.total()).toBe(150);

      expectOk(new IssueInvoiceUseCase(new InMemoryInvoiceRepository(records())).execute(DRAFT));
    },
  },
  {
    id: "business-error-keeps-state",
    description: "a command refused with a business error leaves the aggregate's state as it was",
    run: ({ Invoice, InvoiceLine, IssueInvoiceUseCase, InMemoryInvoiceRepository }) => {
      const invoice = value(Invoice.open(CUSTOMER, [InvoiceLine.of(100)]));
      expectError(invoice.addLine(InvoiceLine.of(-150)), "negative-total");
      expect(invoice.total()).toBe(100);
      expect(invoice.lines()).toHaveLength(1);

      const empty = value(Invoice.open(CUSTOMER, []));
      expectError(empty.issue(), "empty-lines");
      // Still a draft: a refused issue did not issue it.
      expectOk(empty.addLine(InvoiceLine.of(10)));
      expectOk(empty.issue());

      const repository = new InMemoryInvoiceRepository(records());
      expectError(new IssueInvoiceUseCase(repository).execute(ISSUED), "already-issued");
      expectError(new IssueInvoiceUseCase(repository).execute(EMPTY_DRAFT), "empty-lines");
      const issued = value(repository.findById(ISSUED));
      expect(issued.total()).toBe(5);
      expectError(issued.addLine(InvoiceLine.of(1)), "already-issued");
      const stillEmpty = value(repository.findById(EMPTY_DRAFT));
      expect(stillEmpty.lines()).toHaveLength(0);
      expectOk(stillEmpty.addLine(InvoiceLine.of(1)));
    },
  },
  {
    id: "invalid-value-rejected",
    description: "an aggregate is never constructed from values its invariants forbid",
    run: ({ Invoice, InvoiceLine }) => {
      expectError(Invoice.open("", [InvoiceLine.of(1)]), "missing-customer");
      expectError(Invoice.open(CUSTOMER, [InvoiceLine.of(-1)]), "negative-total");
      expect(() => Invoice.restore("", [InvoiceLine.of(1)], false)).toThrow("corrupt invoice state");
      expect(() => Invoice.restore(CUSTOMER, [], true)).toThrow("corrupt invoice state");
      expect(() => Invoice.restore(CUSTOMER, [InvoiceLine.of(-1)], false)).toThrow("corrupt invoice state");
    },
  },
  {
    id: "restore-after-persistence",
    description: "an aggregate read back from its persisted state has the state that was persisted",
    run: ({ InvoiceLine, IssueInvoiceUseCase, InMemoryInvoiceRepository }) => {
      const repository = new InMemoryInvoiceRepository(records());
      const draft = value(repository.findById(DRAFT));
      expect(draft.total()).toBe(120);
      expect(draft.lines()).toHaveLength(2);
      expect(draft.isBilledTo(CUSTOMER)).toBe(true);
      expect(draft.isBilledTo("another-customer")).toBe(false);
      expectError(value(repository.findById(ISSUED)).issue(), "already-issued");

      const persisted = new InMemoryInvoiceRepository(records());
      const issueInvoice = new IssueInvoiceUseCase(persisted);
      expectOk(issueInvoice.execute(DRAFT));
      // The stored invoice, not the draft record it was read from, is what the next read returns.
      const stored = value(persisted.findById(DRAFT));
      expect(stored.total()).toBe(120);
      expect(stored.isBilledTo(CUSTOMER)).toBe(true);
      expectError(stored.addLine(InvoiceLine.of(1)), "already-issued");
      expectError(issueInvoice.execute(DRAFT), "already-issued");

      expectError(repository.findById(UNKNOWN), "invoice-not-found");
      expectError(issueInvoice.execute(UNKNOWN), "invoice-not-found");
    },
  },
];
