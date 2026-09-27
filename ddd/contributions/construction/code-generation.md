---
target: code-generation
plugin: ddd
adds:
  consumes:
    - artifact: ddd-aggregate-mapping
      required: false
  sensors:
    - ddd-rust-module-layout
    - ddd-typescript-module-layout
    - ddd-rust-domain
    - ddd-rust-use-case
    - ddd-rust-interface-adapter
    - ddd-typescript-domain
fragments:
  - anchor: after-step:1
    order: 100
  - anchor: in:Sensors
    order: 100
---

## fragment: after-step:1

### Step 1x (ddd): Read the DDD conventions

Before planning, read the naming and placement conventions and carry them into
the plan. The conventions for all languages apply to every change; then follow
the section of each language the change generates.

#### All languages

- **Domain package names.** Read the shared `ddd-domain-packaging.md` knowledge and domain_packages in the aggregate mapping. Every declaration states the language that spells the package, its name, and the module path below its root. Match actual modules in affected domain packages (a Cargo crate, or a TypeScript package with its `package.json`) to the declarations placed in their language; do not introduce technical classifications such as aggregate/, impl/, vo/, or entities/. Resolve missing declarations upstream rather than inventing terms during code generation. Empty and private modules are included.
- **Naming and placement.** Package suffixes (`-domain`, `-use-case`,
  `-interface-adapter`, `-infrastructure`), the `packages/<layer>/` or
  `modules/<layer>/` placement, the command / query / rmu segments, and the
  composition-root markers. Derive layers from the package, not from a config file.
- **Domain layer.** No public fields; no mutating method that is not a declared
  Command; construct aggregates only through a full constructor.
- **Use-case layer.** `execute` takes IDs and value objects, never an aggregate;
  a use case never calls another use case. Do not use domain getters for business decisions. Getter results may be forwarded unchanged to repository port arguments, directly or through immutable locals whose every use is such a forwarding. Compare or calculate in domain operations.
- **Interface Adapter layer.** The command side and query side do not depend on
  each other; the query side never references a domain type or repository port;
  repositories are named `<Aggregate>Repository`; adapters restore aggregates
  through the full constructor.

Report only source files in `source-manifest.json`; these claims identify the
affected files and packages. Domain packaging also inspects the reachable module
layout of each affected domain package.

#### Rust

- **Rust module layout.** Read `ddd-rust-module-layout.md` shared knowledge and the project-root `.ddd.toml`. Establish one explicit layout before generating Rust. Follow it across all packages; do not infer it from edition or introduce `mod.rs` when `file` is selected.
- **Domain package names.** Only the declarations placed in Rust reach the Rust code checks. Inline modules and path-attribute layouts are included.
- **Domain layer.** Match Rust replay to `replay_methods` in the aggregate mapping, where each entry states the event it applies under `event_ref` and the method that applies it under `code.method`: event-sourcing mode, the aggregate's package and module path, the target event ID, and a single event parameter type must agree. Names such as `apply` alone do not exempt mutation methods.
- **Use-case layer.** See the getter argument contract in `ddd-rust-domain-conventions.md`.

Rust checks match type declarations, explicit parameter/variable/field types, and module-level use statements and aliases. Do not report ambiguous bindings or expressions requiring type inference as confirmed violations. Inspect the `note` in each directly executed Rust sensor JSON result and record `syntax.unresolved` / `model.unresolved` coverage gaps in code-summary for review. The standard dispatcher may omit notes on success, so passing a gate does not prove that every location was checked.

#### TypeScript

Read `ddd-typescript-domain-conventions.md` developer knowledge; its examples are code the TypeScript gates pass.

- **Code representation.** Read `code_representation` in the `[typescript]` table of the project-root `.ddd.toml`: `class` or `companion`. Apply it to every aggregate, Entity, Domain Primitive and value object of the project, and do not mix the two. It is independent of the aggregate's `programming_model` and persistence method. Do not infer it from existing files.
- **`class`.** Keep state in `#` fields only; `private`, `protected`, `readonly` and parameter properties do not hide state. Give the class a `private constructor` that takes the whole state: it is the full constructor, and static factories construct through it; `new` of the type appears only inside its class body. Do not write accessors, `extends`, `implements`, decorators, `declare` or `abstract` members, or computed member names.
- **`companion`.** Write a `type T = { … }` literal and a `const T = { … }` object of the same name in one file. The type literal holds the brand and method signatures only. Give each type one non-exported top-level `const brand: unique symbol = Symbol("T")`; do not use `Symbol.for` or export the brand. The companion's factory that takes the whole state is the full constructor: it keeps the state in a closure it binds and writes each instance inside the companion as a literal annotated with the type that implements every method of the type; the other factories go through it. Do not build an instance with a spread, `as` or `satisfies`. An `interface` paired with a `const` is not a companion.
- **Mutation.** Only a method named by a command slug of the canonical model changes state: `command.invoice.add-line` is `addLine`. Hold collections as `readonly` arrays and replace them (`[...lines, line]`) inside the command. A replay method is exempt only when the aggregate mapping declares it in `replay_methods` for an event-sourcing aggregate at the type's package and module path, with its one parameter stated as the declared event's domain type.
- **Construction.** Each factory validates its input and rejects it before building anything; do not build an empty instance and fill it later, and do not write post-init methods (`init`, `setup`, `initialize`, `reset`, `configure`). Restore persisted state through a `restore` factory that validates the whole state and builds through the full constructor; adapters restore aggregates by calling it. It throws on a corrupt state, which is not a business failure.
- **Getters.** Do not call a getter — a method that only returns one member of state — of another domain object from domain code; ask that object to do the work instead. State the type of every receiver of a domain method (a parameter, a variable or a field) with an annotation naming one type; the gate does not infer it.
- **Result.** Declare `Result<T, E>` as a type in the language-extensions package of the infrastructure layer (such as `packages/infrastructure/language-extensions`) and publish it from that package's `exports` entry. Import it into a domain package by the package name with `import type`, and list that package in `dependencies`. Do not declare another `Result` in a domain package. neverthrow, Effect and fp-ts are not part of this convention.
- **Method-specific errors.** Every factory and command the aggregate mapping binds in `operations` returns `Result<success, E>` with its return type stated, where `E` is the type the aggregate mapping names in that operation's `code.error_type`. A factory bound to no operation, such as `restore` or a value object's `of`, returns the value itself; when a factory has business failures, declare it upstream as a factory rule instead of inventing its errors. Declare `E` as a union of the string literals of that operation's `code.case` values and nothing else: no case of another operation, and no widening with `string`, `any` or `unknown`. Declare and export the error types in the module of their aggregate type. Return an expected business failure as `{ ok: false, error: "<case>" }`, not by throwing.
- **Ownership.** Copy an array or object a factory or command receives before keeping it (`[...lines]`). Return a copy or a readonly value, never the array or object held in state. Return a business failure before changing any state, so a rejected operation leaves the state as it was.
- **Dependencies and exports.** Inside a package, name a module by a relative specifier with its `.ts` extension. Name another package only by its package name and an entry its `package.json` `exports` publish, and list it in `dependencies`; a domain package depends on infrastructure packages only. Do not reach into another package by a path, and do not add `paths` or `baseUrl` to a `tsconfig.json`. Publish names from the package entry `src/index.ts` one by one; do not write `export *` there.
- **Module layout.** Read `ddd-typescript-module-layout.md` shared knowledge and the project-root `.ddd.toml`. Place every TypeScript module under a package's `src` following the one selected layout: `named-file` or `index-file` for modules with children, and the named file for leaves. Do not infer it from existing files. With `named-file`, the parent `src/<m>.ts` names a child as `./<m>/<leaf>.ts` and the entry names the parent as `./<m>.ts`. With `index-file`, the parent `src/<m>/index.ts` names a child as `./<leaf>.ts` and the entry names the parent as `./<m>/index.ts`. When a module file moves, update every specifier that names it.
- **Domain package names.** The declarations placed in TypeScript are matched against the module paths of each affected domain package's `src/`: `src/index.ts` is the package root `[]`, `src/a.ts` and `src/a/index.ts` are `[a]`, and `src/a/b.ts` is `[a, b]`. Name every module file `<module>.ts`; a name such as `invoice.model.ts` is not a module.
- **Sources under `src`.** Keep test files, declaration files, and `.tsx`, `.mts` or `.cts` sources outside a package's `src`.
- **Constructs that stop the gate.** Destructuring, object spreads, decorators, computed names not spelled by one identifier, `import =`, `export =`, dynamic imports, namespaces and dynamic callees in a domain source stop the TypeScript domain gate as uninspectable; do not generate them. The only computed name to write is a companion's brand key, `[brand]`, spelled by the brand's identifier; any other computed member of a companion, and any computed member of a class, stops the gate too. An object literal whose type is stated by an annotation, `as`, `<T>` or `satisfies` also stops the gate when that type, once `Readonly<…>` and a union with `null` or `undefined` are removed, names a domain type but is not one named type, such as `{ lines: readonly InvoiceLine[] }` or `Record<string, Invoice>`. For a companion's closure state, state the readonly type on the collection's own variable and leave the state object unannotated: `const kept: readonly InvoiceLine[] = [...lines];` and `const state = { customer, lines: kept, issued };`.
- **Use-case and Interface Adapter layers.** No TypeScript gate inspects these layers yet. Follow the conventions for all languages above and check them in code review.

Type check the generated TypeScript and run its tests; the TypeScript gates decide from stated types and syntax and do not compile the code.

## fragment: in:Sensors

The three layer-specific Rust sensors fire on `code-summary.md`: `ddd-rust-domain`
(rules a, b, c, d, g plus the layer diagnostics), `ddd-rust-use-case`
(rules g, h, i, d) and `ddd-rust-interface-adapter` (rules k, l, m, n, g, and
every query-side file). Fix the code as the finding names the rule; a repeated
failure means the plan did not carry the conventions above.

`ddd-typescript-domain` fires on the same `code-summary.md` for claimed `.ts` / `.tsx` domain
sources and reports the rule ids of `ddd-rust-domain` (a, b, c, d, g, domain packaging and the
layer diagnostics). Only a `#` field or a companion's closure hides state; `private` does not. A
dependency through a path into another package, a `paths` alias into another package, a subpath its
`exports` withholds, or `export *` in a published entry is a finding (g), type-only or not. A
construct the gate cannot decide — an accessor, a base class, a brand it cannot identify, a getter
receiver without a stated type, a specifier it cannot follow, or a compiler that does not launch —
stops the gate as uninspectable; resolve it rather than retrying.

Besides the claimed files, `ddd-typescript-domain` reads every source below `src/` of every domain
package, since a type declared in any of them can be constructed, called or replayed in a claimed
one; a syntax error or a construct the extraction leaves unresolved stops the gate there too,
claimed or not. No TypeScript gate inspects the use-case or Interface Adapter layer yet, so review
those TypeScript sources against the conventions above.

The domain sensor inspects the module structure of affected domain crates, in addition to changed files. Resolve technical-classification names, undeclared modules, broken references, and unresolved analysis. Review the correspondence between vocabulary and responsibilities in code review as well.

The independent `ddd-rust-module-layout` sensor also fires on code-summary and checks every owned Cargo package, even with no source claims or a skipped domain model. For standalone completion, run `bun <project-root>/<harness-dir>/tools/ddd-check-rust-module-layout.ts --project <project-root>` and require exit status 0 before reporting completion.

The independent `ddd-typescript-module-layout` sensor also fires on code-summary and checks the `src` source root of every package holding TypeScript. For standalone completion of a TypeScript project, run `bun <project-root>/<harness-dir>/tools/ddd-check-typescript-module-layout.ts --project <project-root>` and require exit status 0 before reporting completion.

In these commands, `<harness-dir>` is `.claude` for Claude Code or `.codex` for Codex; replace both path placeholders with the installed project paths.
