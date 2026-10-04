# TypeScript domain conventions

Updated: 2026-10-03. Design conventions and automated coverage are documented separately. Existing rule IDs remain stable.

## Purpose

Conventions for generating TypeScript code that the TypeScript gates pass: both code representations, method-specific Result errors, state ownership, and both module layouts in the domain layer, and the use-case and Interface Adapter layers that call it. A check name does not imply that the entire convention is enforced automatically. The conventions shared with Rust are in the [layer boundaries](../aidlc-shared/ddd-layer-boundaries.md) and the [domain packaging](../aidlc-shared/ddd-domain-packaging.md) knowledge; the file placement is in the [TypeScript module layout](../aidlc-shared/ddd-typescript-module-layout.md) knowledge.

## Rules

| Rule ID | Convention | Current coverage |
|---|---|---|
| K.typescript-domain-conventions.1 | Select one code representation for the project in `code_representation` of the `[typescript]` table of the project-root `.ddd.toml`, `class` or `companion`, and apply it to every aggregate, Entity, Domain Primitive and value object. Do not mix the two. | Design convention. The domain gate decides both representations. |
| K.typescript-domain-conventions.2 | Hide the state of a class in `#` fields only. `private`, `protected`, `readonly` and parameter properties do not hide state. | a |
| K.typescript-domain-conventions.3 | Hide the state of a companion in the closure its factory binds. The type literal declares the brand and the method signatures only. | a |
| K.typescript-domain-conventions.4 | Give each companion type one non-exported top-level `const` of type `unique symbol` created by `Symbol("…")`, and key its instances by it. | A brand the gate cannot identify stops it as uninspectable. |
| K.typescript-domain-conventions.5 | Construct only through the full constructor, which takes the whole state: for a class, the `private constructor`; for a companion, the factory that writes an instance literal annotated with the type. Other factories go through it. Restore persisted event history through a `restore` factory that validates its creation event, constructs through the primary constructor and applies the declared replay methods; adapters call it and report corrupt history as `RepositoryError`. Validate before building, and write no post-init method. | c |
| K.typescript-domain-conventions.6 | Limit methods that change state to declared commands, named by the command slug, or to the replay methods the aggregate mapping declares. | b |
| K.typescript-domain-conventions.7 | Do not call domain getters from domain code, and state the type of every receiver of a domain method. | d. A getter-named call on a receiver without a stated named type stops the gate. |
| K.typescript-domain-conventions.8 | Declare `Result` in the language-extensions package of the infrastructure layer and import it into the domain by the package name with `import type`. Declare no `Result` in a domain package. | g checks the direction and the package boundary of the import. The placement of `Result` itself is review. |
| K.typescript-domain-conventions.9 | Return `Result<success, E>` with the return type stated from every factory and command the aggregate mapping binds in `operations`, where `E` is the operation's own error type: the union of the string literals of its mapped error cases. A factory the mapping binds to no operation, such as `restore` or a value object's `of`, returns the value itself; declare a factory with business failures upstream as a factory rule. | Type checking and review. The production gate does not compare the error sets yet. |
| K.typescript-domain-conventions.10 | Share no mutable array or object with the outside of the domain: copy what comes in, return copies or readonly values, and return a business failure before changing any state. | Review and behavior tests. |
| K.typescript-domain-conventions.11 | Name another package only by its package name and an entry its `exports` publish; write no `paths` alias into another package, no `baseUrl`, and no `export *` in a published entry. | g |
| K.typescript-domain-conventions.12 | Place modules by the selected layout and write the relative specifiers that layout gives them. | `ddd-typescript-module-layout` checks the placement; the compiler checks the specifiers. |
| K.typescript-domain-conventions.13 | In the use-case layer, give `execute` IDs and value objects with stated types, and state one named type on every receiver of `execute` or of a domain method. In the Interface Adapter layer, restore aggregates through `restore` and keep the command and query sides apart. | `ddd-typescript-use-case` (g, h, i, d) and `ddd-typescript-interface-adapter` (k, l, m, n, g). |

## Rationale

The representation is a project-wide choice, independent of the aggregate's execution model (`programming_model`) and persistence method. A `private` modifier is erased by the compiler; a `#` field and a closure are private at run time. A brand prevents assigning an object that only has the same shape; it is not proof that a factory built the value, so assertions and copies are still reviewed. The type checker proves neither the business invariants nor the effect of copies; verify rejected operations leaving the state unchanged with behavior tests.

The TypeScript gates decide from stated types and syntax, without a type checker. Type check the generated code and run its tests beside them.

## Class representation

State is held in `#` fields. The private constructor takes the whole state and is the full constructor: `open` builds a new invoice through it, and `restore` validates the opening event through `open`, then applies subsequent events through the declared replay methods. `open`, which the aggregate mapping binds to `factory.invoice.open`, returns `Result`; `restore`, bound to no operation, returns the replayed instance and throws on corrupt history, which is not a business failure. Adapters restore an invoice through `restore`. `new` of the type appears only inside the class body. The command `addLine` spells the slug of `command.invoice.add-line` and replaces the readonly array instead of changing it. `lines()` returns a copy, and `total()` asks each line to add its amount to a `Money` total instead of reading the amount; the total stays a `Money`, and whether it is negative is asked of it (`isNegative`). The customer stays a bare `string` only to keep the example short; real code wraps it the same way, as it wraps the amounts, and places each wrapped type by the [domain packaging](../aidlc-shared/ddd-domain-packaging.md) Modules. This is the aggregate module under `named-file`, where the parent names its child `./invoice/line.ts`:

```ts
import type { Result } from "@acme/language-extensions";
import type { InvoiceLine } from "./invoice/line.ts";
import { Money } from "./money.ts";

export type Opened = { readonly kind: "opened"; readonly customer: string; readonly lines: readonly InvoiceLine[] };
export type LineAdded = { readonly kind: "line-added"; readonly line: InvoiceLine };
export type Issued = { readonly kind: "issued" };
export type InvoiceEvent = Opened | LineAdded | Issued;

export type OpenInvoiceError = "missing-customer" | "negative-total";
export type AddInvoiceLineError = "already-issued" | "negative-total";
export type IssueInvoiceError = "already-issued" | "empty-lines";

function sumOf(lines: readonly InvoiceLine[]): Money {
  return lines.reduce((sum: Money, line: InvoiceLine) => line.addTo(sum), Money.zero());
}

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
```

Do not write accessors (`get` / `set`), `extends`, `implements`, decorators, `declare` or `abstract` members, or computed member names: the gate stops on them as uninspectable.

## Companion representation

A `type` literal and a `const` object share the name of the domain type in one file. The type literal holds the brand and the method signatures only. In this example `open` is the primary constructor: it validates the opening inputs, copies them into complete closure state, holds collections as `readonly` arrays and writes the typed instance literal implementing every method. `restore` is an auxiliary path: it validates the opening event through `Invoice.open`, then applies subsequent events with the declared replay methods. It throws on corrupt history. Adapters call `restore` to return a replayed invoice. The same aggregate module in the companion representation:

```ts
import type { Result } from "@acme/language-extensions";
import type { InvoiceLine } from "./invoice/line.ts";
import { Money } from "./money.ts";

export type Opened = { readonly kind: "opened"; readonly customer: string; readonly lines: readonly InvoiceLine[] };
export type LineAdded = { readonly kind: "line-added"; readonly line: InvoiceLine };
export type Issued = { readonly kind: "issued" };
export type InvoiceEvent = Opened | LineAdded | Issued;

export type OpenInvoiceError = "missing-customer" | "negative-total";
export type AddInvoiceLineError = "already-issued" | "negative-total";
export type IssueInvoiceError = "already-issued" | "empty-lines";

function sumOf(lines: readonly InvoiceLine[]): Money {
  return lines.reduce((sum: Money, line: InvoiceLine) => line.addTo(sum), Money.zero());
}

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
```

Do not build an instance with a spread, `as` or `satisfies`, do not export the brand or create it with `Symbol.for`, and do not write the domain type as an `interface`: an `interface` paired with a `const` is not a companion.

## Domain Primitives

A primitive with business meaning, such as an amount, is wrapped in a Domain Primitive that the model declares as `kind: domain-primitive` with its one attribute. `Money` is the amount of a line and the total of an invoice; it lives in a module of its own, `money`, which the aggregate mapping declares with `primitive.money`. `add` reads the other value's `#value` inside the class: a `#` field is readable from other instances of the same class, so no getter takes the number out to add it outside the class, and `equals` compares two values the same way. `InvoiceLine` does not expose its amount; `addTo` returns the `Money` it gets by adding its amount to the total it receives. In the companion representation `add` asks the other value to add this one's value (`other.plus(state.value)`), and `equals` asks it to match (`other.matches(state.value)`); each companion type in the module has its own brand.

```ts
import type { Result } from "@acme/language-extensions";

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
```

```ts
import type { Money } from "../money.ts";

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
```

## Result and method-specific errors

`Result` is a type of the infrastructure package for language extensions (here `@acme/language-extensions` at `packages/infrastructure/language-extensions`), published through its `exports` entry `src/index.ts`. Domain packages list it in `dependencies` and import it by the package name with `import type`. No library such as neverthrow, Effect or fp-ts is part of this convention.

```ts
export type Result<T, E> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: E };
```

Each factory and command the aggregate mapping binds in `operations` states its own error type as its return type. The type is named by `code.error_type` of the operation in the aggregate mapping and is the union of the string literals of its `code.case` values: `IssueInvoiceError` holds `"already-issued"` and `"empty-lines"`, and nothing of `open` or `addLine`. Do not share one error type between operations or widen it with `string`, `any` or `unknown`. Return an expected business failure as `{ ok: false, error: "<case>" }`; unexpected runtime failures are not business errors. A factory the mapping binds to no operation, such as `restore` above, `Money.of` or `InvoiceLine.of`, has no error type and returns the value itself; when a factory has business failures, declare it upstream as a factory rule of the canonical model instead of inventing its errors in code.

## Ownership

Copy an array or object a factory or command receives before keeping it (`[...lines]`), and return a copy or a readonly value instead of the one held in state (`lines()` above). A private field or a closure still changes when the caller keeps a reference to the same mutable value. Return a business failure before changing any state.

## Module layouts and specifiers

Inside a package, name a module by a relative specifier with its `.ts` extension. The parent module `invoice` has the child `invoice/line`, which is `src/invoice/line.ts` in both layouts.

- `named-file`: the parent is `src/invoice.ts` and names its child `./invoice/line.ts`.
- `index-file`: the parent is `src/invoice/index.ts` and names its child `./line.ts`.

The package entry `src/index.ts` publishes each name explicitly, never with `export *`. Under `named-file`:

```ts
export type { AddInvoiceLineError, IssueInvoiceError, OpenInvoiceError, InvoiceEvent, Opened, LineAdded, Issued } from "./invoice.ts";
export { Invoice } from "./invoice.ts";
export { InvoiceLine } from "./invoice/line.ts";
export { Money } from "./money.ts";
```

Under `index-file`:

```ts
export type { AddInvoiceLineError, IssueInvoiceError, OpenInvoiceError, InvoiceEvent, Opened, LineAdded, Issued } from "./invoice/index.ts";
export { Invoice } from "./invoice/index.ts";
export { InvoiceLine } from "./invoice/line.ts";
export { Money } from "./money.ts";
```

When a module file moves between the layouts, update every specifier that names it. The declarations placed in TypeScript under `domain_packages` follow the placement: `src/index.ts` is the package root `[]`, `src/invoice.ts` and `src/invoice/index.ts` are `[invoice]`, `src/invoice/line.ts` is `[invoice, line]`, and `src/money.ts` is `[money]`.

## Use-case and Interface Adapter layers

The use-case package `@acme/billing-use-case` (`packages/command/billing-use-case`) and the interface-adapter package `@acme/billing-interface-adapter` (`packages/command/billing-interface-adapter`) follow the [layer boundaries](../aidlc-shared/ddd-layer-boundaries.md). Both list the domain and language-extensions packages in `dependencies`, and the adapter also lists the use-case package. Their sources are the same in both code representations and both module layouts: they call only `restore`, `of` and the command `issue`, which both representations spell alike, and they hold leaf modules only.

The repository port is an `interface` named `<Aggregate>Repository`, declared here in the use-case package and never in a domain package: ports belong to the use-case layer. Loading and storing reach outside the process and can fail, so every method returns `Result` and reports a failure as `RepositoryError`, an infrastructure failure declared beside the port rather than a business error; the per-operation error-type rules do not apply to it. The lookup does not treat a missing invoice as a failure and returns `undefined`, and the store returns `Result<void, RepositoryError>`:

```ts
import type { Invoice, InvoiceEvent } from "@acme/billing-domain";
import type { Result } from "@acme/language-extensions";

export type RepositoryError = { readonly kind: "repository-error"; readonly message: string };

export interface InvoiceRepository {
  findById(invoiceId: string): Result<Invoice | undefined, RepositoryError>;
  store(invoiceId: string, event: InvoiceEvent): Result<void, RepositoryError>;
}
```

The use case is a class named `<Verb><Object>UseCase` (`IssueInvoiceUseCase`). `execute` takes an ID and never an aggregate, and every parameter states its type. The use case holds the port in a `#` field typed as the port and named after it (`#invoiceRepository`), states one named type on every receiver it calls, and asks the aggregate to run the command instead of reading its state. It calls no other use case's `execute`. A getter result may only be handed unchanged to a method of a repository port, directly or through a `const`.

```ts
import type { Invoice, IssueInvoiceError, Issued } from "@acme/billing-domain";
import type { Result } from "@acme/language-extensions";
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
```

The adapter implements the port and may prefix its name with the storage medium. The standard example uses Event Sourcing: it stores event streams in a map, returns an aggregate replayed from its history, and appends the event returned by the command. It introduces no aggregate-state record or snapshot. Lookup returns `undefined` for a missing stream and reports corrupt history through the common `RepositoryError`. The use case never loads or replays raw history. Query-side sources import no domain type and no repository port.

```ts
import { Invoice } from "@acme/billing-domain";
import type { InvoiceEvent } from "@acme/billing-domain";
import type { InvoiceRepository, RepositoryError } from "@acme/billing-use-case";
import type { Result } from "@acme/language-extensions";

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
```

## What stops the gate

A syntax error, destructuring, an object spread, a decorator, a computed name not spelled by one identifier, `import =`, `export =`, a dynamic import, a namespace or a dynamic callee in any source below `src/` of a domain package stops the domain gate as uninspectable, claimed or not. The only computed name to write is a companion's brand key, `[brand]`, spelled by the brand's identifier as in the example above; any other computed member of a companion, and any computed member of a class, stops the gate too. So do a dependency it cannot follow, a dependency on a package that states no `exports`, a package whose settings state `baseUrl`, and a domain package the root `tsconfig.json` does not reference. In a claimed domain source, an object literal whose type is stated by an annotation, `as`, `<T>` or `satisfies` also stops the gate when that type, once `Readonly<…>` and a union with `null` or `undefined` are removed, names a domain type but is not one named type, such as `{ lines: readonly InvoiceLine[] }` or `Record<string, Invoice>`. For a companion's closure state, write it as the example above does: state the readonly type on the collection's own variable and leave the state object unannotated, `const kept: readonly InvoiceLine[] = [...lines];` and `const state = { customer, lines: kept, issued };`. Keep test files, declaration files, and `.tsx`, `.mts` or `.cts` sources outside `src`, where the layout gate cannot place them.

In a claimed use-case source, an `execute` parameter without a stated type and a receiver of `execute` or of a getter-named method without an annotation naming one type stop the use-case gate. In a query-side source, a namespace import or an `export *` of a domain package stops the interface-adapter gate. When a claimed source of their layers is to be decided, a compiler that does not launch stops the domain, use-case and interface-adapter gates; the module layout gate reads the directory tree only.

## Examples

The [generation samples](../../tests/fixtures/typescript-generation/samples.ts) hold the complete projects these examples come from, in both representations and both layouts, with the model, the aggregate mapping and the source claims; the development repository runs them through the TypeScript domain gate, the use-case gate, the interface-adapter gate, the module layout gate, its CI entry, and the compiler. These are test inputs, not complete business applications.

The distribution does not include tests or docs, so these links are for the development repository. All conventions needed at the destination are retained in this file.

## Sources

- [TypeScript domain sensor contract](../../docs/users/typescript-sensor-contract.md)
- [TypeScript module layout contract](../../docs/users/typescript-module-layout.md)
- [Language-independent design](../../docs/developers/language-independent-design.md)

## Construction and repository defaults

Follow the [shared construction and repository contracts](../aidlc-shared/ddd-construction-contracts.md): checked `of` and `parse` for Domain Primitives, one primary constructor with delegated auxiliary paths, factory naming by intent, direct aggregate lookup with the common `RepositoryError`, and Event Sourcing for the standard example.
