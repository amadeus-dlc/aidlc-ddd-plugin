/**
 * The behavior scenarios every language's generated code has to pass (language-independent design
 * §11), stated once for the TypeScript generation samples: a successful state change, a business
 * error that leaves the state as it was, an invalid value refused at construction, and a state
 * restored after persistence from the latest snapshot and the events that follow it.
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
  id(): string;
  sequenceNumber(): number;
  isBilledTo(customer: string): boolean;
  total(): Money;
  lines(): readonly InvoiceLine[];
}
export type InvoiceEvent =
  | {
      readonly kind: "opened";
      readonly invoiceId: string;
      readonly sequenceNumber: number;
      readonly customer: string;
      readonly lines: readonly InvoiceLine[];
    }
  | { readonly kind: "line-added"; readonly invoiceId: string; readonly sequenceNumber: number; readonly line: InvoiceLine }
  | { readonly kind: "issued"; readonly invoiceId: string; readonly sequenceNumber: number };
export interface RepositoryError {
  readonly kind: "repository-error";
  readonly message: string;
}
export interface InvoiceRepository {
  findById(invoiceId: string): Result<Invoice | undefined, RepositoryError>;
  store(event: InvoiceEvent, snapshot: Invoice): Result<void, RepositoryError>;
}

/** What the domain, use-case and interface-adapter packages of a sample export. */
export interface SampleModules {
  readonly Invoice: {
    open(invoiceId: string, customer: string, lines: readonly InvoiceLine[]): Result<Invoice, string>;
    replay(events: readonly InvoiceEvent[], snapshot: Invoice): Invoice;
  };
  readonly Money: { of(value: number): Money; parse(value: number): Result<Money, string> };
  readonly InvoiceLine: { of(amount: Money): InvoiceLine };
  readonly IssueInvoiceUseCase: new (invoiceRepository: InvoiceRepository) => {
    execute(invoiceId: string): Result<void, string | RepositoryError>;
  };
  readonly InMemoryInvoiceRepository: new (snapshotInterval: number) => InvoiceRepository;
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
function expectRepositoryError(result: Result<unknown, RepositoryError>): void {
  expect(result).toMatchObject({ ok: false, error: { kind: "repository-error" } });
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
const INTERVAL = 3;

/** The creation event of an invoice just opened: the one event the aggregate does not return itself. */
function opened(invoice: Invoice, customer: string, lines: readonly InvoiceLine[]): InvoiceEvent {
  return { kind: "opened", invoiceId: invoice.id(), sequenceNumber: invoice.sequenceNumber(), customer, lines };
}
function lineAdded(invoiceId: string, sequenceNumber: number, line: InvoiceLine): InvoiceEvent {
  return { kind: "line-added", invoiceId, sequenceNumber, line };
}
function issuedAt(invoiceId: string, sequenceNumber: number): InvoiceEvent {
  return { kind: "issued", invoiceId, sequenceNumber };
}

/** Opens an invoice and stores its creation event with the invoice itself. */
function openAndStore(modules: SampleModules, repository: InvoiceRepository, invoiceId: string, lines: readonly InvoiceLine[]): Invoice {
  const invoice = value(modules.Invoice.open(invoiceId, CUSTOMER, lines));
  expectOk(repository.store(opened(invoice, CUSTOMER, lines), invoice));
  return invoice;
}

/** A repository holding a draft, an empty draft and an issued invoice, each stored through the port. */
function seeded(modules: SampleModules): InvoiceRepository {
  const { line } = amounts(modules);
  const repository = new modules.InMemoryInvoiceRepository(INTERVAL);
  openAndStore(modules, repository, DRAFT, [line(100), line(20)]);
  openAndStore(modules, repository, EMPTY_DRAFT, []);
  const issued = openAndStore(modules, repository, ISSUED, [line(5)]);
  expectOk(repository.store(expectEvent(issued.issue(), "issued"), issued));
  return repository;
}

function expectEvent(result: Result<InvoiceEvent, unknown>, kind: "line-added" | "issued"): InvoiceEvent {
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error("expected a domain event");
  expect(result.value.kind).toBe(kind);
  return result.value;
}

export const BEHAVIOR_SCENARIOS: readonly BehaviorScenario[] = [
  {
    id: "state-change",
    description: "a command that succeeds changes the aggregate's state, and an issued invoice accepts no further change",
    run: (modules) => {
      const { Invoice, IssueInvoiceUseCase } = modules;
      const { line, expectTotal } = amounts(modules);
      const invoice = value(Invoice.open(DRAFT, CUSTOMER, [line(100)]));
      expect(invoice.id()).toBe(DRAFT);
      expect(invoice.sequenceNumber()).toBe(1);
      expectTotal(invoice, 100);
      const added = expectEvent(invoice.addLine(line(50)), "line-added");
      expect(added.invoiceId).toBe(DRAFT);
      expect(added.sequenceNumber).toBe(2);
      expectTotal(invoice, 150);
      expect(invoice.lines()).toHaveLength(2);
      const issued = expectEvent(invoice.issue(), "issued");
      expect(issued.invoiceId).toBe(DRAFT);
      expect(issued.sequenceNumber).toBe(3);
      expect(invoice.sequenceNumber()).toBe(3);
      expectError(invoice.addLine(line(1)), "already-issued");
      expectError(invoice.issue(), "already-issued");
      expectTotal(invoice, 150);

      expectOk(new IssueInvoiceUseCase(seeded(modules)).execute(DRAFT));
    },
  },
  {
    id: "business-error-keeps-state",
    description: "a command refused with a business error leaves the aggregate's state as it was",
    run: (modules) => {
      const { Invoice, IssueInvoiceUseCase } = modules;
      const { line, expectTotal } = amounts(modules);
      const invoice = value(Invoice.open(DRAFT, CUSTOMER, [line(100)]));
      expectError(invoice.addLine(line(-150)), "negative-total");
      expectTotal(invoice, 100);
      expect(invoice.lines()).toHaveLength(1);
      expect(invoice.sequenceNumber()).toBe(1);

      const empty = value(Invoice.open(EMPTY_DRAFT, CUSTOMER, []));
      expectError(empty.issue(), "empty-lines");
      expect(empty.sequenceNumber()).toBe(1);
      // Still a draft: a refused issue did not issue it.
      expect(expectEvent(empty.addLine(line(10)), "line-added").sequenceNumber).toBe(2);
      expect(expectEvent(empty.issue(), "issued").sequenceNumber).toBe(3);

      const repository = seeded(modules);
      expectError(new IssueInvoiceUseCase(repository).execute(ISSUED), "already-issued");
      expectError(new IssueInvoiceUseCase(repository).execute(EMPTY_DRAFT), "empty-lines");
      const issued = found(repository.findById(ISSUED));
      expectTotal(issued, 5);
      expect(issued.sequenceNumber()).toBe(2);
      expectError(issued.addLine(line(1)), "already-issued");
      const stillEmpty = found(repository.findById(EMPTY_DRAFT));
      expect(stillEmpty.lines()).toHaveLength(0);
      expect(stillEmpty.sequenceNumber()).toBe(1);
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
      expectError(Invoice.open(DRAFT, "", [line(1)]), "missing-customer");
      expectError(Invoice.open(DRAFT, CUSTOMER, [line(-1)]), "negative-total");

      // A continuation of the snapshot that does not belong to it is refused, not reported as a business error.
      const snapshot = value(Invoice.open(DRAFT, CUSTOMER, [line(10)]));
      const corrupt = "corrupt invoice history";
      expect(() => Invoice.replay([lineAdded(UNKNOWN, 2, line(1))], snapshot)).toThrow(corrupt);
      expect(() => Invoice.replay([lineAdded(DRAFT, 3, line(1))], snapshot)).toThrow(corrupt);
      expect(() => Invoice.replay([lineAdded(DRAFT, 2, line(1)), lineAdded(DRAFT, 2, line(1))], snapshot)).toThrow(corrupt);
      expect(() => Invoice.replay([{ kind: "opened", invoiceId: DRAFT, sequenceNumber: 2, customer: CUSTOMER, lines: [] }], snapshot)).toThrow(corrupt);
      expect(() => Invoice.replay([issuedAt(DRAFT, 2), lineAdded(DRAFT, 3, line(1))], snapshot)).toThrow(corrupt);
      expect(() => Invoice.replay([issuedAt(DRAFT, 2), issuedAt(DRAFT, 3)], snapshot)).toThrow(corrupt);
      expect(() => Invoice.replay([lineAdded(DRAFT, 2, line(-11))], snapshot)).toThrow(corrupt);
      const empty = value(Invoice.open(DRAFT, CUSTOMER, []));
      expect(() => Invoice.replay([issuedAt(DRAFT, 2)], empty)).toThrow(corrupt);
    },
  },
  {
    id: "restore-after-persistence",
    description: "an aggregate read back from its persisted state has the state that was persisted",
    run: (modules) => {
      const { Invoice, IssueInvoiceUseCase, InMemoryInvoiceRepository } = modules;
      const { line, expectTotal } = amounts(modules);

      // The snapshot interval is a required argument, and an unusable one is refused.
      for (const interval of [0, -1, 1.5, Number.NaN]) expect(() => new InMemoryInvoiceRepository(interval)).toThrow();

      // What the repository keeps is detached from what the caller keeps.
      const inputLines: InvoiceLine[] = [line(7)];
      const isolated = new InMemoryInvoiceRepository(2);
      const first = openAndStore(modules, isolated, DRAFT, inputLines);
      inputLines.push(line(8));
      expectTotal(found(isolated.findById(DRAFT)), 7);
      expectEvent(first.addLine(line(9)), "line-added");
      expectTotal(found(isolated.findById(DRAFT)), 7);
      expectEvent(found(isolated.findById(DRAFT)).issue(), "issued");
      const appendedLines: InvoiceLine[] = [line(11)];
      openAndStore(modules, isolated, UNKNOWN, appendedLines);
      appendedLines.push(line(2));
      expectTotal(found(isolated.findById(UNKNOWN)), 11);

      // Replaying leaves the snapshot it continues as it was.
      const base = value(Invoice.open(DRAFT, CUSTOMER, [line(1)]));
      const advanced = value(Invoice.open(DRAFT, CUSTOMER, [line(1)]));
      const next = expectEvent(advanced.addLine(line(2)), "line-added");
      const replayed = Invoice.replay([next], base);
      expect(replayed.sequenceNumber()).toBe(2);
      expectTotal(replayed, 3);
      expect(base.sequenceNumber()).toBe(1);
      expectTotal(base, 1);

      const repository = seeded(modules);
      const draft = found(repository.findById(DRAFT));
      const detachedEvent = value(draft.addLine(line(3)));
      expect(detachedEvent.kind).toBe("line-added");
      expectTotal(found(repository.findById(DRAFT)), 120);
      expectTotal(draft, 123);
      expect(draft.lines()).toHaveLength(3);
      expect(draft.isBilledTo(CUSTOMER)).toBe(true);
      expect(draft.isBilledTo("another-customer")).toBe(false);
      expectError(found(repository.findById(ISSUED)).issue(), "already-issued");

      const persisted = seeded(modules);
      const issueInvoice = new IssueInvoiceUseCase(persisted);
      expectOk(issueInvoice.execute(DRAFT));
      // The appended issuance event determines the next replayed aggregate.
      const stored = found(persisted.findById(DRAFT));
      expectTotal(stored, 120);
      expect(stored.sequenceNumber()).toBe(2);
      expect(stored.isBilledTo(CUSTOMER)).toBe(true);
      expectError(stored.addLine(line(1)), "already-issued");
      expectError(issueInvoice.execute(DRAFT), "already-issued");

      // A missing invoice is no failure of the port; the use case turns it into its own error.
      expect(repository.findById(UNKNOWN)).toEqual({ ok: true, value: undefined });
      expectError(issueInvoice.execute(UNKNOWN), "invoice-not-found");

      // A store that does not extend what is kept is refused, and what is kept stays as it was.
      const guarded = new InMemoryInvoiceRepository(2);
      const original = openAndStore(modules, guarded, DRAFT, [line(5)]);
      const stranger = value(Invoice.open(UNKNOWN, CUSTOMER, [line(1)]));
      expectRepositoryError(guarded.store(opened(original, CUSTOMER, []), stranger));
      const second = expectEvent(original.addLine(line(1)), "line-added");
      expectRepositoryError(guarded.store(second, value(Invoice.open(DRAFT, CUSTOMER, [line(5)]))));
      expectOk(guarded.store(second, original));
      expectRepositoryError(guarded.store(second, original));
      expectEvent(original.addLine(line(1)), "line-added");
      const fourth = expectEvent(original.addLine(line(1)), "line-added");
      expectRepositoryError(guarded.store(fourth, original));
      const kept = found(guarded.findById(DRAFT));
      expectTotal(kept, 6);
      expect(kept.sequenceNumber()).toBe(2);
      const late = value(Invoice.open(UNKNOWN, CUSTOMER, [line(1)]));
      expectRepositoryError(guarded.store(expectEvent(late.addLine(line(1)), "line-added"), late));
      expect(guarded.findById(UNKNOWN)).toEqual({ ok: true, value: undefined });

      // The snapshot is replaced at number 1 and at each multiple of the interval, and a read starts from it.
      const timing = (interval: number): Result<Invoice | undefined, RepositoryError> => {
        const timed = new InMemoryInvoiceRepository(interval);
        openAndStore(modules, timed, DRAFT, []);
        const loaded = found(timed.findById(DRAFT));
        expectEvent(loaded.addLine(line(5)), "line-added");
        expectOk(timed.store(issuedAt(DRAFT, 2), loaded));
        return timed.findById(DRAFT);
      };
      // Interval 2 replaces the snapshot at number 2, so nothing is replayed.
      const snapshotted = found(timing(2));
      expectTotal(snapshotted, 5);
      expectEvent(snapshotted.issue(), "issued");
      // Interval 3 keeps the snapshot at number 1, so the event at number 2 is replayed over it and is refused.
      expectRepositoryError(timing(3));
    },
  },
];
