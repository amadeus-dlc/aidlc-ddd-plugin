# TypeScript domain conventions

Updated: 2026-09-27. Design conventions and automated coverage are documented separately. Existing rule IDs remain stable.

## Purpose

Conventions for generating TypeScript domain code that the TypeScript gates pass: both code representations, method-specific Result errors, state ownership, and both module layouts. A check name does not imply that the entire convention is enforced automatically. The conventions shared with Rust are in the [layer boundaries](../aidlc-shared/ddd-layer-boundaries.md) and the [domain packaging](../aidlc-shared/ddd-domain-packaging.md) knowledge; the file placement is in the [TypeScript module layout](../aidlc-shared/ddd-typescript-module-layout.md) knowledge.

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

## Rationale

The representation is a project-wide choice, independent of the aggregate's execution model (`programming_model`) and persistence method. A `private` modifier is erased by the compiler; a `#` field and a closure are private at run time. A brand prevents assigning an object that only has the same shape; it is not proof that a factory built the value, so assertions and copies are still reviewed. The type checker proves neither the business invariants nor the effect of copies; verify rejected operations leaving the state unchanged with behavior tests.

The TypeScript gates decide from stated types and syntax, without a type checker. Type check the generated code and run its tests beside them.

## Class representation

State is held in `#` fields. The private constructor takes the whole state and is the full constructor: `open` builds a new invoice through it, and `restore` rebuilds a persisted one through it after validating the whole state. `open`, which the aggregate mapping binds to `factory.invoice.open`, returns `Result`; `restore`, bound to no operation, returns the instance and throws on a corrupt state, which is not a business failure. Adapters restore an invoice through `restore`. `new` of the type appears only inside the class body. The command `addLine` spells the slug of `command.invoice.add-line` and replaces the readonly array instead of changing it. `lines()` returns a copy, and `total()` asks each line to add itself instead of reading its amount. This is the aggregate module under `named-file`, where the parent names its child `./invoice/line.ts`:

```ts
import type { Result } from "@acme/language-extensions";
import type { InvoiceLine } from "./invoice/line.ts";

export type OpenInvoiceError = "missing-customer";
export type AddInvoiceLineError = "already-issued";
export type IssueInvoiceError = "already-issued" | "empty-lines";

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
    return { ok: true, value: new Invoice(customer, lines, false) };
  }

  static restore(customer: string, lines: readonly InvoiceLine[], issued: boolean): Invoice {
    if (customer.length === 0 || (issued && lines.length === 0)) throw new Error("corrupt invoice state");
    return new Invoice(customer, lines, issued);
  }

  addLine(line: InvoiceLine): Result<void, AddInvoiceLineError> {
    if (this.#issued) return { ok: false, error: "already-issued" };
    this.#lines = [...this.#lines, line];
    return { ok: true, value: undefined };
  }

  issue(): Result<void, IssueInvoiceError> {
    if (this.#issued) return { ok: false, error: "already-issued" };
    if (this.#lines.length === 0) return { ok: false, error: "empty-lines" };
    this.#issued = true;
    return { ok: true, value: undefined };
  }

  isBilledTo(customer: string): boolean {
    return this.#customer === customer;
  }

  total(): number {
    return this.#lines.reduce((sum: number, line: InvoiceLine) => line.addTo(sum), 0);
  }

  lines(): readonly InvoiceLine[] {
    return [...this.#lines];
  }
}
```

Do not write accessors (`get` / `set`), `extends`, `implements`, decorators, `declare` or `abstract` members, or computed member names: the gate stops on them as uninspectable.

## Companion representation

A `type` literal and a `const` object share the name of the domain type in one file. The type literal holds the brand and the method signatures only. The factory that takes the whole state, `restore` here, is the full constructor: it validates the whole state, copies its input into the closure state, holding collections as `readonly` arrays, and writes the instance inside the companion as a literal annotated with the type, implementing every method. It throws on a corrupt state, which is not a business failure. `open` builds a new invoice through it, and adapters restore an invoice through it. The same aggregate module in the companion representation:

```ts
import type { Result } from "@acme/language-extensions";
import type { InvoiceLine } from "./invoice/line.ts";

export type OpenInvoiceError = "missing-customer";
export type AddInvoiceLineError = "already-issued";
export type IssueInvoiceError = "already-issued" | "empty-lines";

const brand: unique symbol = Symbol("Invoice");

export type Invoice = {
  readonly [brand]: true;
  addLine(line: InvoiceLine): Result<void, AddInvoiceLineError>;
  issue(): Result<void, IssueInvoiceError>;
  isBilledTo(customer: string): boolean;
  total(): number;
  lines(): readonly InvoiceLine[];
};

export const Invoice = {
  open(customer: string, lines: readonly InvoiceLine[]): Result<Invoice, OpenInvoiceError> {
    if (customer.length === 0) return { ok: false, error: "missing-customer" };
    return { ok: true, value: Invoice.restore(customer, lines, false) };
  },
  restore(customer: string, lines: readonly InvoiceLine[], issued: boolean): Invoice {
    if (customer.length === 0 || (issued && lines.length === 0)) throw new Error("corrupt invoice state");
    const kept: readonly InvoiceLine[] = [...lines];
    const state = { customer, lines: kept, issued };
    const instance: Invoice = {
      [brand]: true,
      addLine(line: InvoiceLine): Result<void, AddInvoiceLineError> {
        if (state.issued) return { ok: false, error: "already-issued" };
        state.lines = [...state.lines, line];
        return { ok: true, value: undefined };
      },
      issue(): Result<void, IssueInvoiceError> {
        if (state.issued) return { ok: false, error: "already-issued" };
        if (state.lines.length === 0) return { ok: false, error: "empty-lines" };
        state.issued = true;
        return { ok: true, value: undefined };
      },
      isBilledTo(customer: string): boolean {
        return state.customer === customer;
      },
      total(): number {
        return state.lines.reduce((sum: number, line: InvoiceLine) => line.addTo(sum), 0);
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

## Result and method-specific errors

`Result` is a type of the infrastructure package for language extensions (here `@acme/language-extensions` at `packages/infrastructure/language-extensions`), published through its `exports` entry `src/index.ts`. Domain packages list it in `dependencies` and import it by the package name with `import type`. No library such as neverthrow, Effect or fp-ts is part of this convention.

```ts
export type Result<T, E> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: E };
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
export type { AddInvoiceLineError, IssueInvoiceError, OpenInvoiceError } from "./invoice.ts";
export { Invoice } from "./invoice.ts";
export { InvoiceLine } from "./invoice/line.ts";
```

Under `index-file`:

```ts
export type { AddInvoiceLineError, IssueInvoiceError, OpenInvoiceError } from "./invoice/index.ts";
export { Invoice } from "./invoice/index.ts";
export { InvoiceLine } from "./invoice/line.ts";
```

When a module file moves between the layouts, update every specifier that names it. The declarations placed in TypeScript under `domain_packages` follow the placement: `src/index.ts` is the package root `[]`, `src/invoice.ts` and `src/invoice/index.ts` are `[invoice]`, and `src/invoice/line.ts` is `[invoice, line]`.

## What stops the gate

A syntax error, destructuring, an object spread, a decorator, a computed name not spelled by one identifier, `import =`, `export =`, a dynamic import, a namespace or a dynamic callee in any source below `src/` of a domain package stops the domain gate as uninspectable, claimed or not. The only computed name to write is a companion's brand key, `[brand]`, spelled by the brand's identifier as in the example above; any other computed member of a companion, and any computed member of a class, stops the gate too. So do a dependency it cannot follow, a dependency on a package that states no `exports`, a package whose settings state `baseUrl`, and a domain package the root `tsconfig.json` does not reference. In a claimed domain source, an object literal whose type is stated by an annotation, `as`, `<T>` or `satisfies` also stops the gate when that type, once `Readonly<…>` and a union with `null` or `undefined` are removed, names a domain type but is not one named type, such as `{ lines: readonly InvoiceLine[] }` or `Record<string, Invoice>`. For a companion's closure state, write it as the example above does: state the readonly type on the collection's own variable and leave the state object unannotated, `const kept: readonly InvoiceLine[] = [...lines];` and `const state = { customer, lines: kept, issued };`. Keep test files, declaration files, and `.tsx`, `.mts` or `.cts` sources outside `src`, where the layout gate cannot place them.

No TypeScript gate inspects the use-case or Interface Adapter layer yet. Follow the [layer boundaries](../aidlc-shared/ddd-layer-boundaries.md) and check those sources in code review.

## Examples

The [generation samples](../../tests/fixtures/typescript-generation/samples.ts) hold the complete projects these examples come from, in both representations and both layouts, with the model, the aggregate mapping and the source claims; the development repository runs them through the TypeScript domain gate, the module layout gate, its CI entry, and the compiler. These are test inputs, not complete business applications.

The distribution does not include tests or docs, so these links are for the development repository. All conventions needed at the destination are retained in this file.

## Sources

- [TypeScript domain sensor contract](../../docs/users/typescript-sensor-contract.md)
- [TypeScript module layout contract](../../docs/users/typescript-module-layout.md)
- [Language-independent design](../../docs/developers/language-independent-design.md)
