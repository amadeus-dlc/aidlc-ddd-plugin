# TypeScript domain conventions

Updated: 2026-09-28. Design conventions and automated coverage are documented separately. Existing rule IDs remain stable.

## Purpose

Conventions for generating TypeScript code that the TypeScript gates pass: both code representations, method-specific Result errors, state ownership, and both module layouts in the domain layer, and the use-case and Interface Adapter layers that call it. A check name does not imply that the entire convention is enforced automatically. The conventions shared with Rust are in the [layer boundaries](../aidlc-shared/ddd-layer-boundaries.md) and the [domain packaging](../aidlc-shared/ddd-domain-packaging.md) knowledge; the file placement is in the [TypeScript module layout](../aidlc-shared/ddd-typescript-module-layout.md) knowledge.

## Rules

| Rule ID | Convention | Current coverage |
|---|---|---|
| K.typescript-domain-conventions.1 | Select one code representation for the project in `code_representation` of the `[typescript]` table of the project-root `.ddd.toml`, `class` or `companion`, and apply it to every aggregate, Entity, Domain Primitive and value object. Do not mix the two. | Design convention. The domain gate decides both representations. |
| K.typescript-domain-conventions.2 | Hide the state of a class in `#` fields only. `private`, `protected`, `readonly` and parameter properties do not hide state. | a |
| K.typescript-domain-conventions.3 | Hide the state of a companion in the closure its factory binds. The type literal declares the brand and the method signatures only. | a |
| K.typescript-domain-conventions.4 | Give each companion type one non-exported top-level `const` of type `unique symbol` created by `Symbol("…")`, and key its instances by it. | A brand the gate cannot identify stops it as uninspectable. |
| K.typescript-domain-conventions.5 | Construct only through the full constructor, which takes the whole state: for a class, the `private constructor`; for a companion, the factory that writes an instance literal annotated with the type. Other factories go through it. Restore persisted state through a `restore` factory that validates the whole state before building and throws on a corrupt one; adapters call it. Validate before building, and write no post-init method. | c |
| K.typescript-domain-conventions.6 | Limit methods that change state to declared commands, named by the command slug, or to the replay methods the aggregate mapping declares. | b |
| K.typescript-domain-conventions.7 | Do not call domain getters from domain code, and state the type of every receiver of a domain method. | d. A getter-named call on a receiver without a stated named type stops the gate. |
| K.typescript-domain-conventions.8 | Declare `Result` in the language-extensions package of the infrastructure layer and import it into the domain by the package name with `import type`. Declare no `Result` in a domain package. | g checks the direction and the package boundary of the import. The placement of `Result` itself is review. |
| K.typescript-domain-conventions.9 | Return `Result<success, E>` with the return type stated from every factory and command the aggregate mapping binds in `operations`, where `E` is the operation's own error type: the union of the string literals of its mapped error cases. A factory the mapping binds to no operation, such as `restore` or a value object's `of`, returns the value itself; declare a factory with business failures upstream as a factory rule. | Type checking and review. The production gate does not compare the error sets yet. |
| K.typescript-domain-conventions.10 | Share no mutable array or object with the outside of the domain: copy what comes in, return copies or readonly values, and return a business failure before changing any state. | Review and behavior tests. |
| K.typescript-domain-conventions.11 | Name another package only by its package name and an entry its `exports` publish; write no `paths` alias into another package, no `baseUrl`, and no `export *` in a published entry. | g |
| K.typescript-domain-conventions.12 | Place modules by the selected layout and write the relative specifiers that layout gives them. | `ddd-typescript-module-layout` checks the placement; the compiler checks the specifiers. |
| K.typescript-domain-conventions.13 | In the use-case layer, give `execute` IDs and value objects with stated types, and state one named type on every receiver of `execute` or of a domain method. In the Interface Adapter layer, restore aggregates through `restore` and keep the command and query sides apart. | `ddd-typescript-use-case` (g, h, i, d) and `ddd-typescript-interface-adapter` (k, l, m, n, g). |
| K.typescript-domain-conventions.14 | A command whose model entry declares events returns `Result<CommandOutcome<E>, …>`, where `CommandOutcome` is declared beside `Result`: `applied` carries one or more of the declared events and changes the state; `already-applied` carries none and changes nothing, and only a `command-id-memory` command answers it. The use case stores the aggregate and the events of `applied` with one `store`, which checks the expected version once and appends them together; it stores nothing on `already-applied`. A command that declares no event returns `Result<void, …>`. | Review and behavior tests. No gate decides the outcome shape: the TypeScript facts carry no return type. |

## Rationale

The representation is a project-wide choice, independent of the aggregate's execution model (`programming_model`) and persistence method. A `private` modifier is erased by the compiler; a `#` field and a closure are private at run time. A brand prevents assigning an object that only has the same shape; it is not proof that a factory built the value, so assertions and copies are still reviewed. The type checker proves neither the business invariants nor the effect of copies; verify rejected operations leaving the state unchanged with behavior tests.

The TypeScript gates decide from stated types and syntax, without a type checker. Type check the generated code and run its tests beside them.

## Class representation

State is held in `#` fields. The private constructor takes the whole state, including the paid amount and the remembered payment ids, and is the full constructor: `open` builds a new invoice through it, and `restore` rebuilds a persisted one through it after validating the whole state, refusing a paid amount below zero or above the total, more remembered ids than the invoice keeps, and a payment on an invoice not issued. `open`, which the aggregate mapping binds to `factory.invoice.open`, returns `Result`; `restore`, bound to no operation, returns the instance and throws on a corrupt state, which is not a business failure. Adapters restore an invoice through `restore`. `new` of the type appears only inside the class body. The command `addLine` spells the slug of `command.invoice.add-line` and replaces the readonly array instead of changing it. `lines()` returns a copy, and `total()` asks each line to add itself instead of reading its amount. The commands `issue` and `recordPayment` declare events, so they return a `CommandOutcome` as an unannotated literal: `issue` is applied with its one event; `recordPayment` remembers the ids of its recent commands up to the model's `retention_count`, answers a remembered id as already applied without changing anything, and raises `payment-recorded`, together with `settled` when the payment reaches the total. A refused payment returns its error before any state changes, so its id is not remembered. `customer()`, `issued()`, `paid()` and `paymentIds()` are getters an adapter reads to save the state; domain code does not call them, and `paymentIds()` returns a copy. This is the aggregate module under `named-file`, where the parent names its child `./invoice/line.ts`:

```ts
import type { CommandOutcome, Result } from "@acme/language-extensions";
import type { InvoiceLine } from "./invoice/line.ts";

export type OpenInvoiceError = "missing-customer" | "negative-total";
export type AddInvoiceLineError = "already-issued" | "negative-total";
export type IssueInvoiceError = "already-issued" | "empty-lines";
export type RecordPaymentError = "not-issued" | "overpayment";
export type InvoiceEvent = "issued" | "payment-recorded" | "settled";

/** How many payment command ids an invoice remembers: the model's retention_count. */
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
```

Do not write accessors (`get` / `set`), `extends`, `implements`, decorators, `declare` or `abstract` members, or computed member names: the gate stops on them as uninspectable.

## Companion representation

A `type` literal and a `const` object share the name of the domain type in one file. The type literal holds the brand and the method signatures only. The factory that takes the whole state, `restore` here, is the full constructor: it validates the whole state with the same check as the class, copies its input into the closure state, holding collections as `readonly` arrays, and writes the instance inside the companion as a literal annotated with the type, implementing every method. It throws on a corrupt state, which is not a business failure. `open` builds a new invoice through it, and adapters restore an invoice through it. The closure state has members of a domain type, so it is annotated with one named state type. The same aggregate module in the companion representation:

```ts
import type { CommandOutcome, Result } from "@acme/language-extensions";
import type { InvoiceLine } from "./invoice/line.ts";

export type OpenInvoiceError = "missing-customer" | "negative-total";
export type AddInvoiceLineError = "already-issued" | "negative-total";
export type IssueInvoiceError = "already-issued" | "empty-lines";
export type RecordPaymentError = "not-issued" | "overpayment";
export type InvoiceEvent = "issued" | "payment-recorded" | "settled";

/** How many payment command ids an invoice remembers: the model's retention_count. */
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
```

Do not build an instance with a spread, `as` or `satisfies`, do not export the brand or create it with `Symbol.for`, and do not write the domain type as an `interface`: an `interface` paired with a `const` is not a companion.

## Result, command outcomes and method-specific errors

`Result` and `CommandOutcome` are types of the infrastructure package for language extensions (here `@acme/language-extensions` at `packages/infrastructure/language-extensions`), published through its `exports` entry `src/index.ts`. Domain packages list it in `dependencies` and import them by the package name with `import type`. No library such as neverthrow, Effect or fp-ts is part of this convention.

```ts
export type Result<T, E> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: E };
```

The success side of a command whose model entry declares events is a `CommandOutcome` of the aggregate's event type: `applied` with one or more of the events the model declares for that command, or `already-applied` with none. Only a command with `idempotency.strategy: command-id-memory` answers `already-applied`; a repeat of a `strategy: none` command is refused with its own error or is a no-op of the state transition, as the use case's `re_execution_basis` states. A command that declares no event, such as `addLine`, returns `Result<void, …>`.

```ts
export type CommandOutcome<E> =
  | { readonly kind: "applied"; readonly events: readonly E[] }
  | { readonly kind: "already-applied" };
```

The package entry publishes both:

```ts
export type { CommandOutcome } from "./command-outcome.ts";
export type { Result } from "./result.ts";
```

Each factory and command the aggregate mapping binds in `operations` states its own error type as its return type. The type is named by `code.error_type` of the operation in the aggregate mapping and is the union of the string literals of its `code.case` values: `IssueInvoiceError` holds `"already-issued"` and `"empty-lines"`, and nothing of `open` or `addLine`. Do not share one error type between operations or widen it with `string`, `any` or `unknown`. Return an expected business failure as `{ ok: false, error: "<case>" }`; unexpected runtime failures are not business errors. A factory the mapping binds to no operation, such as `restore` above or `InvoiceLine.of`, has no error type and returns the value itself; when a factory has business failures, declare it upstream as a factory rule of the canonical model instead of inventing its errors in code.

## Ownership

Copy an array or object a factory or command receives before keeping it (`[...lines]`), and return a copy or a readonly value instead of the one held in state (`lines()` above). A private field or a closure still changes when the caller keeps a reference to the same mutable value. Return a business failure before changing any state.

## Module layouts and specifiers

Inside a package, name a module by a relative specifier with its `.ts` extension. The parent module `invoice` has the child `invoice/line`, which is `src/invoice/line.ts` in both layouts.

- `named-file`: the parent is `src/invoice.ts` and names its child `./invoice/line.ts`.
- `index-file`: the parent is `src/invoice/index.ts` and names its child `./line.ts`.

The package entry `src/index.ts` publishes each name explicitly, never with `export *`. Under `named-file`:

```ts
export type {
  AddInvoiceLineError,
  InvoiceEvent,
  IssueInvoiceError,
  OpenInvoiceError,
  RecordPaymentError,
} from "./invoice.ts";
export { Invoice } from "./invoice.ts";
export { InvoiceLine } from "./invoice/line.ts";
```

Under `index-file`:

```ts
export type {
  AddInvoiceLineError,
  InvoiceEvent,
  IssueInvoiceError,
  OpenInvoiceError,
  RecordPaymentError,
} from "./invoice/index.ts";
export { Invoice } from "./invoice/index.ts";
export { InvoiceLine } from "./invoice/line.ts";
```

When a module file moves between the layouts, update every specifier that names it. The declarations placed in TypeScript under `domain_packages` follow the placement: `src/index.ts` is the package root `[]`, `src/invoice.ts` and `src/invoice/index.ts` are `[invoice]`, and `src/invoice/line.ts` is `[invoice, line]`.

## Use-case and Interface Adapter layers

The use-case package `@acme/billing-use-case` (`packages/command/billing-use-case`) and the interface-adapter package `@acme/billing-interface-adapter` (`packages/command/billing-interface-adapter`) follow the [layer boundaries](../aidlc-shared/ddd-layer-boundaries.md). Both list the domain and language-extensions packages in `dependencies`, and the adapter also lists the use-case package. Their sources are the same in both code representations and both module layouts: they call only `restore`, `of`, the commands `issue` and `recordPayment`, and the getters the adapter saves the state with, which both representations spell alike, and they hold leaf modules only.

The repository port is an `interface` named `<Aggregate>Repository`, declared here in the use-case package; it may also be declared in a domain package. Its lookup returns its own error type through `Result`, and on success the aggregate together with the version it was read at. Its `store` takes the aggregate, that version as the expected version, and the events of one applied command: it checks once that the aggregate is still at the expected version and saves the state and every event in one append, returning `version-conflict` and saving nothing otherwise. A read in between by another caller does not change what a store is checked against:

```ts
import type { Invoice, InvoiceEvent } from "@acme/billing-domain";
import type { Result } from "@acme/language-extensions";

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
```

`execute` takes an ID and never an aggregate, and every parameter states its type. The use case holds the port in a `#` field typed as the port, states one named type on every receiver it calls, and asks the aggregate to run the command instead of reading its state. It calls no other use case's `execute`. A getter result may only be handed unchanged to a method of a repository port, directly or through a `const`. On `applied` it hands the events to `store` together with the aggregate and the version its own read found; on `already-applied` it stores nothing. `RecordPayment` in `src/record-payment.ts` is written the same way for `recordPayment`.

```ts
import type { Invoice, InvoiceEvent, IssueInvoiceError } from "@acme/billing-domain";
import type { CommandOutcome, Result } from "@acme/language-extensions";
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
```

The adapter implements the port and may prefix its name with the storage medium. It restores the aggregate through `restore` and each line through `of`; it never builds a domain type with `new`, a literal annotated with the type, or `as`. The collections are typed on their fields, so `new Map()` names no domain type. It keeps each invoice as a record of its whole state and restores a new invoice from the record on every read, so a caller's change reaches the record only through a `store` that succeeds and a refused change is not kept. `store` compares the expected version once with the current one, then writes the record through the getters, advances the version by one and appends the command's events together; `version` and `storedEvents` show what it saved. The command side and the query side do not depend on each other, and a query-side source imports no domain type and no repository port.

```ts
import { Invoice, InvoiceLine } from "@acme/billing-domain";
import type { InvoiceEvent } from "@acme/billing-domain";
import type { FoundInvoice, InvoiceNotFound, InvoiceRepository, VersionConflict } from "@acme/billing-use-case";
import type { Result } from "@acme/language-extensions";

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
```

## What stops the gate

A syntax error, destructuring, an object spread, a decorator, a computed name not spelled by one identifier, `import =`, `export =`, a dynamic import, a namespace or a dynamic callee in any source below `src/` of a domain package stops the domain gate as uninspectable, claimed or not. The only computed name to write is a companion's brand key, `[brand]`, spelled by the brand's identifier as in the example above; any other computed member of a companion, and any computed member of a class, stops the gate too. So do a dependency it cannot follow, a dependency on a package that states no `exports`, a package whose settings state `baseUrl`, and a domain package the root `tsconfig.json` does not reference. In a claimed domain source, an object literal whose type is stated by an annotation, `as`, `<T>` or `satisfies` also stops the gate when that type, once `Readonly<…>` and a union with `null` or `undefined` are removed, names a domain type but is not one named type, such as `{ lines: readonly InvoiceLine[] }` or `Record<string, Invoice>`. For a companion's closure state, write it as the example above does: declare one named state type and annotate the state object with it, `const state: InvoiceState = { customer, lines: [...lines], issued, paid, paymentIds: [...paymentIds] };`. Return a command outcome as an unannotated literal. Keep test files, declaration files, and `.tsx`, `.mts` or `.cts` sources outside `src`, where the layout gate cannot place them.

In a claimed use-case source, an `execute` parameter without a stated type and a receiver of `execute` or of a getter-named method without an annotation naming one type stop the use-case gate. In a query-side source, a namespace import or an `export *` of a domain package stops the interface-adapter gate. When a claimed source of their layers is to be decided, a compiler that does not launch stops the domain, use-case and interface-adapter gates; the module layout gate reads the directory tree only.

## Examples

The [generation samples](../../tests/fixtures/typescript-generation/samples.ts) hold the complete projects these examples come from, in both representations and both layouts, with the model, the aggregate mapping and the source claims; the development repository runs them through the TypeScript domain gate, the use-case gate, the interface-adapter gate, the module layout gate, its CI entry, and the compiler. These are test inputs, not complete business applications.

The distribution does not include tests or docs, so these links are for the development repository. All conventions needed at the destination are retained in this file.

## Sources

- [TypeScript domain sensor contract](../../docs/users/typescript-sensor-contract.md)
- [TypeScript module layout contract](../../docs/users/typescript-module-layout.md)
- [Language-independent design](../../docs/developers/language-independent-design.md)
