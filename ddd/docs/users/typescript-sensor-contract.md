# TypeScript domain sensor contract

English | [Japanese](typescript-sensor-contract.ja.md)

Updated: 2026-09-27, T-11-02. `ddd-typescript-domain` is the code-generation gate for the TypeScript domain layer. It reports the rule ids of the Rust domain gate (`ddd-rust-domain`) with the same meaning, decides them from the [TypeScript facts](../developers/typescript-fact-extraction.md), and stops as uninspectable wherever those facts do not decide. The use-case and interface-adapter rules (T-11-03) and the module layout check (T-11-04) are not part of it.

## When it runs and what it reads

It fires at the `code-generation` gate on `code-summary.md`, next to the Rust gates. The claimed `.ts` / `.tsx` files in `source-manifest.json` (not `.d.ts`) are the entry points:

| Claims | Answer |
|---|---|
| No TypeScript file | Pass, with the note `no typescript sources claimed`. The compiler is not needed |
| TypeScript files, none of them a domain source | Pass unless a claim is unowned, a claimed package has a layer diagnostic, or the executed domain model does not load. The compiler is not needed |
| At least one domain source | The distributed compiler is launched and every rule runs |

A claimed file belongs to the package of the nearest `package.json` above it. The layer comes from the package name with its scope set aside and from its placement, with the conventions of the Rust crates: the `-domain` / `-use-case` / `-interface-adapter` / `-infrastructure` suffixes, `packages/<layer>/` or `modules/<layer>/`, the `command` / `query` / `rmu` segments and the composition-root markers. A domain source is a non-test `.ts` / `.tsx` file below `src/` of a domain package; `*.test.ts`, `*.spec.ts` and `__tests__/` are auxiliary.

Besides the claimed files, the gate reads each package's `package.json`, the `tsconfig.json` of each package the root `tsconfig.json` references (for `paths` and `baseUrl`), the canonical model, the state file, the aggregate mapping, and the facts of every source below `src/` of every domain package — a type declared in any of them can be constructed, called or replayed in a claimed one.

## Both representations

A domain type is a `class`, or a companion: a `type T = { … }` literal and a `const T = { … }` object literal of the same name in one file. A companion's instances are the literals written inside its object for its type — a literal annotated with the type, or an untyped literal keyed by the type's brand. An `interface` paired with a `const` is not a companion.

## Rules

| Rule | Class | Companion |
|---|---|---|
| a: public state | Every non-static property that is not a `#` field, including parameter properties. `private`, `protected` and `readonly` are erased by the compiler, so they do not hide the field. Methods are operations; static members belong to the class object. Message: `public field Invoice.id in domain layer` | Every property of the type literal, reported once on the type literal, and every instance property the type literal does not declare. State kept in the closure the factory builds is hidden |
| b: undeclared mutation | An instance method (a `#` method too) that writes a member of `this` or captured state, or calls a changing method (`push`, `set`, `add`, `delete`, …) of a field stated as an array, a `Map` or a `Set`. Message: `mutating method Invoice.rename is not declared as command.invoice.rename` | An instance method that writes captured state, or calls a changing method (`push`, `set`, `add`, `delete`, …) on closure state |
| c: incomplete construction | `new T`, a literal typed as `T`, or `x as T` outside the class body; a post-init method (`init`, `setup`, `initialize`, `reset`, `configure`) is `c`, not `b` | A literal typed as `T`, or `x as T`, outside the companion's object |
| d: getter call | A call of a getter — a method whose body is only `return` of one member of `this`, of one member of closure state, or of closure state itself — on a receiver whose stated type is a domain type. `this.total()` is allowed. Message: `getter total called from domain layer (Tell, Don't Ask)` | The same, for the getters its instances write. Closure state is what the factory binds; a module-level constant a method returns does not make it a getter |
| g: dependency | See below | See below |

Rule b follows the command slugs of the canonical model as the Rust gate does: `rename` must be `command.<aggregate>.rename`, and `applyEvent` would be `apply-event`. A replay method is exempt only when the aggregate mapping declares it in `replay_methods` for an event-sourcing aggregate placed at the type's package and module path, and its one parameter is stated as the declared event's domain type in the same package. With the domain model SKIP or absent, b is not evaluated and the note records it. `c-default` has no counterpart: TypeScript has no `Default` derivation.

Messages spell a member with `.` where the Rust gate spells it with `::`; otherwise the words are the same.

### Dependency direction (g)

Each import and each re-export naming a module, in a claimed domain source, is followed in the order the project resolves it: a path, an `imports` specifier (`#…`) of the package, a `paths` alias of the package's `tsconfig.json`, the name of a project package with an optional subpath, and otherwise a package from outside the project. A project package is any directory of the workspace, the root included, whose `package.json` states a name, whether or not the root `tsconfig.json` references it; directories no project scan counts, such as `node_modules`, `dist` and those starting with `.`, are skipped. The `dependencies`, `devDependencies`, `peerDependencies` and `optionalDependencies` of the claimed package's `package.json` are edges too, unless an import already stands for the same edge. One edge is one finding, and its message names every decision that makes it one:

| Decision | Meaning |
|---|---|
| `layer-forbidden` | The layer permission table forbids the target package's layer (domain may depend on infrastructure only) |
| `external-io` | An external package on the npm I/O list (database, cache, message broker, HTTP client, RPC, web framework, cloud SDK). Node's built-in modules are not on it |
| `private-path` | A path into another package's directory, or a subpath of a package that its `exports` withhold |
| `alias` | A `paths` alias that leads into another package. An alias inside the same package is allowed |
| `wildcard-reexport` | `export *` or `export * as ns` in a file the package's `exports` publish. A file the `exports` do not name may re-export its neighbours |
| `type-only` | Accompanies the others when the dependency is erased (`import type`, import types): a type-only dependency is judged all the same |

A cross-side reference between command and query packages is not reported by this domain gate, as the Rust domain gate does not report it.

### Domain packaging

The module path of a source is read off its placement below `src/`: `src/index.ts` is the package root `[]`, `src/a.ts` and `src/a/index.ts` are `[a]`, and `src/a/b.ts` is `[a, b]`. Each module of a domain package a claim touches needs a `domain_packages` declaration placed in TypeScript under that package, with the same `domain-packaging.*` rule ids and meanings as the Rust gate (see the [packaging contract](domain-packaging-design.md)). A file name that is not a module segment (`invoice.model.ts`) and two files naming one module path (`src/invoice.ts` and `src/invoice/index.ts`) are `domain-packaging.unresolved`.

### Layer diagnostics

`layer.unknown` and `layer.conflict` are reported on the claimed package's `package.json`; a claimed TypeScript file no `package.json` owns is `layer.unowned`, named relative to the record as the Rust gate names an unowned claim. `layer.mixed-targets` is a Cargo diagnostic and is not declared.

## What stops the gate

Nothing this gate cannot decide passes. Each of the following stops it with exit 127, no verdict on stdout, and every construct listed on stderr as `<file>:<line> …` (a `package.json` dependency as `<file> …`); the framework then keeps a blocking gate closed:

- a domain source the extraction could not read (`syntax-error`) or read with a construct left unresolved (`decorator`, `computed-name`, `object-spread`, `binding-pattern`, `import-equals`, `export-assignment`, `dynamic-import`, `namespace`, `dynamic-callee`), claimed or not;
- a class with an accessor, a base class or an implemented interface, an ambient class, or a `declare`, `abstract` or computed member;
- a companion whose brand is not one non-exported top-level `const` of type `unique symbol` created by the global `Symbol()` / `Symbol("…")`, that writes no instance, whose instance hides members (a spread), lacks a method of its type, or is made by `as` / `satisfies`;
- a getter-named call on a receiver whose type is not stated by an annotation, or is stated as anything but one named type (a union, a generic application);
- a dependency through a path out of every package, an `imports` specifier the package does not map, a package that states no `exports` or states them in a form not modelled, an alias that does not lead into exactly one package, a package name that more than one `package.json` of the workspace states, or a package whose settings state `baseUrl`;
- `export *` or `export * as ns` in a claimed domain source of a package that states no `exports`, states them in a form not modelled, or points them only at files that are not its sources (such as `./dist/index.js`), since whether that file is published cannot be told;
- a type name that an import resolves into a domain package the root `tsconfig.json` does not reference, whose sources were not read;
- a claimed domain package the root `tsconfig.json` does not reference, whose compiler settings the launch never checked;
- a compiler that cannot be launched, reported exactly as the [fact extraction](../developers/typescript-fact-extraction.md#when-the-extraction-cannot-start) reports it: `ddd-typescript-domain: tool unavailable: <the launch issue's message>`.

## What it does not decide

The gate runs without a type checker, like the Rust gate's explicit-type matching. A receiver's type is what a parameter, a variable or a class field states; an initializer is never inferred from. A type name is resolved to a declaration of the same file, else through the import that names it among the domain types of the package the import leads to. A change of state through a value held elsewhere (an alias of `this`, a collection field whose type is not stated) is not seen, and a literal keyed by a brand but written outside its companion is not reported as a construction. Coverage of all TypeScript syntax is not guaranteed; generated code still needs type checking and tests.

The Rust gates (`ddd-rust-domain`, `ddd-rust-use-case`, `ddd-rust-interface-adapter`) decide claimed `.rs` files only. A claimed `.ts` file is not theirs to decide, so a project that claims only TypeScript sources passes them with the note `no rust sources claimed`; a claimed `.rs` file that no Cargo workspace owns is still `layer.unowned`.
