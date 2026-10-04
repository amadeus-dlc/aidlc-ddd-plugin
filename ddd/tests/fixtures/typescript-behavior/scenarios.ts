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
  addLine(line: InvoiceLine): Result<InvoiceEvent, string>;
  issue(): Result<InvoiceEvent, string>;
  isBilledTo(customer: string): boolean;
  total(): Money;
  lines(): readonly InvoiceLine[];
}
export type InvoiceEvent =
  | { readonly kind: "opened"; readonly customer: string; readonly lines: readonly InvoiceLine[] }
  | { readonly kind: "line-added"; readonly line: InvoiceLine }
  | { readonly kind: "issued" };
export interface RepositoryError {
  readonly kind: "repository-error";
  readonly message: string;
}
export interface InvoiceRepository {
  findById(invoiceId: string): Result<Invoice | undefined, RepositoryError>;
  store(invoiceId: string, event: InvoiceEvent): Result<void, RepositoryError>;
}

/** What the domain, use-case and interface-adapter packages of a sample export. */
export interface SampleModules {
  readonly Invoice: {
    open(customer: string, lines: readonly InvoiceLine[]): Result<Invoice, string>;
    restore(history: readonly InvoiceEvent[]): Invoice;
  };
  readonly Money: { of(value: number): Money; parse(value: number): Result<Money, string> };
  readonly InvoiceLine: { of(amount: Money): InvoiceLine };
  readonly IssueInvoiceUseCase: new (invoiceRepository: InvoiceRepository) => {
    execute(invoiceId: string): Result<void, string | RepositoryError>;
  };
  readonly InMemoryInvoiceRepository: new (records: ReadonlyMap<string, readonly InvoiceEvent[]>) => InvoiceRepository;
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
/** The invoice a repository found; the port answers a missing one with `undefined`, not a failure. */
function found(result: Result<Invoice | undefined, RepositoryError>): Invoice {
  if (!result.ok) throw new Error(`expected a load, got the repository error ${result.error.message}`);
  if (result.value === undefined) throw new Error("expected a stored invoice, found none");
  return result.value;
}
function expectError(result: Result<unknown, unknown>, error: string): void {
  expect(result).toEqual({ ok: false, error });
}
function expectOk(result: Result<void, unknown>): void {
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

/** Initial event streams, followed by an issuance event where applicable. */
function records(modules: SampleModules): ReadonlyMap<string, readonly InvoiceEvent[]> {
  const { line } = amounts(modules);
  return new Map<string, readonly InvoiceEvent[]>([
    [DRAFT, [{ kind: "opened", customer: CUSTOMER, lines: [line(100), line(20)] }]],
    [EMPTY_DRAFT, [{ kind: "opened", customer: CUSTOMER, lines: [] }]],
    [ISSUED, [{ kind: "opened", customer: CUSTOMER, lines: [line(5)] }, { kind: "issued" }]],
  ]);
}

function expectEvent(result: Result<InvoiceEvent, unknown>, kind: "line-added" | "issued"): void {
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error("expected a domain event");
  expect(result.value.kind).toBe(kind);
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
      expectEvent(invoice.addLine(line(50)), "line-added");
      expectTotal(invoice, 150);
      expect(invoice.lines()).toHaveLength(2);
      expectEvent(invoice.issue(), "issued");
      expectError(invoice.addLine(line(1)), "already-issued");
      expectError(invoice.issue(), "already-issued");
      expectTotal(invoice, 150);

      expectOk(new IssueInvoiceUseCase(new InMemoryInvoiceRepository(records(modules))).execute(DRAFT));
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
      expectEvent(empty.addLine(line(10)), "line-added");
      expectEvent(empty.issue(), "issued");

      const repository = new InMemoryInvoiceRepository(records(modules));
      expectError(new IssueInvoiceUseCase(repository).execute(ISSUED), "already-issued");
      expectError(new IssueInvoiceUseCase(repository).execute(EMPTY_DRAFT), "empty-lines");
      const issued = found(repository.findById(ISSUED));
      expectTotal(issued, 5);
      expectError(issued.addLine(line(1)), "already-issued");
      const stillEmpty = found(repository.findById(EMPTY_DRAFT));
      expect(stillEmpty.lines()).toHaveLength(0);
      expectEvent(stillEmpty.addLine(line(1)), "line-added");
    },
  },
  {
    id: "invalid-value-rejected",
    description: "an aggregate is never constructed from values its invariants forbid",
    run: (modules) => {
      const { Invoice, Money } = modules;
      expectError(Money.parse(Number.NaN), "non-finite-amount");
      expectError(Money.parse(Number.POSITIVE_INFINITY), "non-finite-amount");
      expect(() => Money.of(Number.NaN)).toThrow("non-finite-amount");
      const { line } = amounts(modules);
      expectError(Invoice.open("", [line(1)]), "missing-customer");
      expectError(Invoice.open(CUSTOMER, [line(-1)]), "negative-total");
      expect(() => Invoice.restore([{ kind: "opened", customer: "", lines: [line(1)] }])).toThrow("corrupt invoice history");
      expect(() => Invoice.restore([{ kind: "opened", customer: CUSTOMER, lines: [] }, { kind: "issued" }])).toThrow("corrupt invoice history");
      expect(() => Invoice.restore([{ kind: "opened", customer: CUSTOMER, lines: [line(-1)] }])).toThrow("corrupt invoice history");
    },
  },
  {
    id: "restore-after-persistence",
    description: "an aggregate read back from its persisted state has the state that was persisted",
    run: (modules) => {
      const { IssueInvoiceUseCase, InMemoryInvoiceRepository } = modules;
      const { line, expectTotal } = amounts(modules);
      const inputLines: InvoiceLine[] = [line(7)];
      const inputEvents: InvoiceEvent[] = [{ kind: "opened", customer: CUSTOMER, lines: inputLines }];
      const isolated = new InMemoryInvoiceRepository(new Map([[DRAFT, inputEvents]]));
      inputLines.push(line(8));
      inputEvents.push({ kind: "issued" });
      expectTotal(found(isolated.findById(DRAFT)), 7);
      expectEvent(found(isolated.findById(DRAFT)).issue(), "issued");
      const appendedLines: InvoiceLine[] = [line(11)];
      expectOk(isolated.store(UNKNOWN, { kind: "opened", customer: CUSTOMER, lines: appendedLines }));
      appendedLines.push(line(2));
      expectTotal(found(isolated.findById(UNKNOWN)), 11);

      const repository = new InMemoryInvoiceRepository(records(modules));
      const draft = found(repository.findById(DRAFT));
      const detachedEvent = value(draft.addLine(line(3)));
      expect(detachedEvent.kind).toBe("line-added");
      expectTotal(found(repository.findById(DRAFT)), 120);
      expectTotal(draft, 123);
      expect(draft.lines()).toHaveLength(3);
      expect(draft.isBilledTo(CUSTOMER)).toBe(true);
      expect(draft.isBilledTo("another-customer")).toBe(false);
      expectError(found(repository.findById(ISSUED)).issue(), "already-issued");

      const persisted = new InMemoryInvoiceRepository(records(modules));
      const issueInvoice = new IssueInvoiceUseCase(persisted);
      expectOk(issueInvoice.execute(DRAFT));
      // The appended issuance event determines the next replayed aggregate.
      const stored = found(persisted.findById(DRAFT));
      expectTotal(stored, 120);
      expect(stored.isBilledTo(CUSTOMER)).toBe(true);
      expectError(stored.addLine(line(1)), "already-issued");
      expectError(issueInvoice.execute(DRAFT), "already-issued");

      // A missing invoice is no failure of the port; the use case turns it into its own error.
      expect(repository.findById(UNKNOWN)).toEqual({ ok: true, value: undefined });
      expectError(issueInvoice.execute(UNKNOWN), "invoice-not-found");
    },
  },
];
