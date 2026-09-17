# Shared DDD design for Rust and TypeScript

English | [Japanese](language-independent-design.ja.md) | [Developer documentation](README.md)

Status: agreed specification, confirmed by the user on 2026-09-13. Implementation is pending except where the comparison below identifies existing Rust behavior. This document records the outcome of the design discussion and is the shared implementation target for both languages.

Improve the DDD plugin as a whole. Rust is the first implementation and release target; TypeScript is the next target for the same backend responsibilities. Both must satisfy the same domain, boundary, and inspection contracts. Evaluate existing Rust behavior against those contracts and correct its gaps as part of the work. Language-specific syntax and analysis belong in their respective implementations. See the [project glossary](../../../CONTEXT.md) for the terms used here.

## 1. Separate execution hosts from layered packages

Use this organization in both languages:

```text
apps/
  web/                           # Framework application, such as Next.js
workers/
  billing-events/                # Worker execution host
packages/
  command/
    billing-domain/
    billing-use-case/
    billing-interface-adapter/
  query/
    billing-use-case/
    billing-interface-adapter/
  infrastructure/
    language-extensions/
  rmu/
    billing-rmu/
```

`command/` and `query/` are grouping directories. Each leaf under `packages/` is a separate package: a Cargo crate for Rust and a `package.json` package for TypeScript. Package identifiers must remain unambiguous across groups; the directory sketch does not prescribe identical package names for command and query. Domain-internal names follow ubiquitous language; technical classifications such as aggregate/, impl/, vo/, and entities/ do not justify business packages.

Execution hosts handle framework integration, dependency assembly, and delegation. Business decisions and direct persistence implementations belong in the appropriate packages. Framework-owned file conventions and application entry points remain usable; hosts are not forced into the domain model's source representation. Hosts are still subject to dependency and responsibility checks.

Dependencies flow from `apps/*` and `workers/*` into `packages/*`. Packages must not depend back on execution hosts. Apply the existing layer rules inside `packages/`: Interface Adapter may depend on use-case, domain, and infrastructure; use-case may depend on domain and infrastructure; domain may depend on infrastructure. Infrastructure contains language-support facilities and must not depend on the other layers. DB and external HTTP implementations belong in Interface Adapter. Preserve command/query separation and the existing Read Model Updater bridge rules; the machine identifier remains `rmu`.

The first TypeScript target is ESM on the server-side Node.js runtime, with a real Next.js build and execution as acceptance criteria. The host organization leaves room for other frameworks and workers. It does not establish Cloudflare Workers or Edge Runtime support in the first TypeScript release. Next.js supports ESM imports and local-package transpilation; module configuration and server/client boundaries still require verification. See [ESM imports](https://nextjs.org/docs/messages/import-esm-externals) and [transpilePackages](https://nextjs.org/docs/app/api-reference/config/next-config-js/transpilePackages).

## 2. Check both dependency direction and public access

| Contract | Rust | TypeScript |
|---|---|---|
| Layer boundary | Cargo crate | `package.json` package |
| External entry surface | Reachable public crate API | Entry points in `package.json` `exports`, and the API exported through them |
| Internal cooperation | Internal module visibility follows the crate's rules | File-level exports may serve other files in the same package |
| Cross-package access | Check public visibility and allowed layer direction | Resolve the actual target and check public entry points and allowed layer direction |
| Type-only references | Count as dependencies | Apply the same rules to `import type` |
| Publication changes | Explicitly name re-exports at public entry points | Explicitly name re-exports at public entry points |

Publication does not grant permission to every layer. A public API can still be an illegal dependency for a particular caller. Preserve sensors for both concerns. Reject paths or aliases that bypass a package's public boundary, including direct relative or absolute access to internals.

Keep publication intentional: prohibit wildcard re-exports at public entry points (`pub use ...::*` and `export *`). Internal file exports are not all package-public APIs. Do not introduce a duplicate design-artifact inventory of every exported symbol; for TypeScript, `package.json` `exports` is the source of entry-point declarations and code determines the exported symbols. Review whether publication is necessary. Node's `exports` encapsulation does not prevent every absolute-path access, so the sensor remains necessary. See the [Node.js package specification](https://nodejs.org/api/packages.html#main-entry-point-export).

## 3. Keep three independent choices

| Choice | Scope | Rust | TypeScript |
|---|---|---|---|
| Aggregate execution model | Per aggregate | `actor / class` | Same conceptual choice |
| Persistence strategy | Per aggregate | `state-sourcing / event-sourcing` | Same conceptual choice |
| Domain source representation | Per project | Native `struct + impl` | Class, or structure with methods and a companion object |

The existing `programming_model: class` means an aggregate programming model; it does not require a TypeScript `class` keyword. Rust already represents that model using struct + impl. A TypeScript project using structures and companions can also implement actor-based aggregates. Keep these choices independent in declarations, generation, and inspection.

Apply the selected TypeScript representation to aggregates, Entities, Domain Primitives, and Value Objects throughout the project. Mixing the two domain representations within one project is prohibited. The representation setting does not dictate framework code in execution hosts.

## 4. Preserve the agreed TypeScript representations

The class representation hides internal state with JavaScript `#` private fields. The structure representation uses a type and a same-named companion object: instance methods reside in the returned object, static-equivalent operations such as creation reside in the companion, and state is captured by closures. Add a type-specific, unexported `unique symbol` brand to the structure representation.

This example records the agreed structure shape, including method-specific errors. Its numeric limits illustrate a business rule; they are not a universal counter requirement. The inline Result definition stands for the language-support contract that belongs in infrastructure. The example does not define final configuration keys or model-to-code bindings.

```ts
type Result<T, E> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: E };

export type CreateCounterError = "invalid-initial-value";
export type IncrementCounterError = "limit-reached";
const counterBrand: unique symbol = Symbol("Counter");

export type Counter = {
  readonly [counterBrand]: true;
  increment(): Result<void, IncrementCounterError>;
};

export const Counter = {
  create(initialValue: number): Result<Counter, CreateCounterError> {
    if (!Number.isSafeInteger(initialValue) || initialValue < 0) {
      return { ok: false, error: "invalid-initial-value" };
    }
    const state = { value: initialValue };
    const instance: Counter = {
      [counterBrand]: true,
      increment() {
        if (state.value === Number.MAX_SAFE_INTEGER) {
          return { ok: false, error: "limit-reached" };
        }
        state.value += 1;
        return { ok: true, value: undefined };
      },
    };
    return { ok: true, value: instance };
  },
};
```

A brand prevents ordinary assignment of a merely matching object shape; it is not runtime proof that construction passed through the companion. Inspect assertions, copies, and other construction bypasses. Keep this separate from state privacy. TypeScript's `private` modifier is enforced during type checking, while `#` private fields retain runtime privacy; see [class privacy](https://www.typescriptlang.org/docs/handbook/2/classes.html#caveats), [structural compatibility](https://www.typescriptlang.org/docs/handbook/type-compatibility), and [unique symbols](https://www.typescriptlang.org/docs/handbook/symbols#unique-symbol).

## 5. Preserve invariants and ownership in both languages

Keep domain state private, including readonly fields. Domain Primitives and Value Objects are immutable and validated on creation. Use complete construction paths; reject empty construction followed by field filling and restoration that bypasses validation. Preserve the existing rules restricting mutation to declared business operations or explicit event application, and restricting getter calls from domain/use-case code. Use-case code may forward getter results as repository arguments without using them for business decisions.

Do not share mutable array or object references across the domain boundary. Separate ownership through appropriate copying or immutable representations on input and output. A private field or closure does not protect an object whose mutable reference remains outside. Rust ownership and explicit sharing mechanisms, and TypeScript references, require language-specific checks against this same contract. Business failure leaves the pre-operation state intact.

## 6. Close error contracts around their methods

Expected business failures return `Result<Success, MethodSpecificError>`. DomainError is the shared modeling concept; code must use a closed error type for the particular method, rather than an unrestricted domain-wide error type. For example, `issue` returns `Result<..., IssueInvoiceError>` and `cancel` returns `Result<..., CancelInvoiceError>`.

Define the owning operation and business failure conditions in the canonical model, including generation methods such as `create`. Implementation mappings bind those declarations to language-specific methods and error types. Sensors compare error ownership, the declared set, and the method's return error type for missing cases, extra cases, or errors belonging to another operation. Review and behavior tests establish the correctness of actual error paths; a type-set comparison alone does not prove them.

Keep unexpected runtime failures distinct from expected business rejection. Preserve the existing restoration policy for corrupt histories or unknown schemas and the existing distinctions between repository conflicts, communication failure, and unknown commit outcomes. This agreement does not impose a blanket ban on every exception or panic.

Place the TypeScript Result implementation in the language-support infrastructure package. No specific Result library is selected. Individual integrations with neverthrow, Effect, or fp-ts are outside this scope. Continue to decide concrete success values, duplicate-success representation, and multi-event results through the existing T-03 work.

## 7. Select and enforce one module layout

| Contract | Rust: implemented in T-08 | TypeScript: agreed target |
|---|---|---|
| Named-file parent | `invoice.rs` | `invoice.ts` |
| Directory-entry parent | `invoice/mod.rs` | `invoice/index.ts` |
| Leaf in either mode | `invoice/line.rs` | `invoice/line.ts` |
| Selection scope | Project-wide | Project-wide |
| Mixed layout or missing selection | Blocking finding | Blocking finding |
| Public roots | Cargo targets and crate visibility | Package entry points and exported symbols |

A directory-entry parent has child modules; leaves remain named files. Apply the selected mode consistently through generation instructions and sensors. File placement and API exposure are separate checks. An index.ts layout does not authorize arbitrary internal imports. Keep source representation, aggregate execution, persistence, and file layout as separate choices.

The shipped Rust configuration is currently `.ddd.toml` with `schema_version = 1` and `[rust] module_layout = "file" | "mod-rs"`. The final common configuration schema and TypeScript key names must be defined during implementation design; these decisions do not make TypeScript settings available in the current installer. See the [current Rust contract](../users/rust-module-layout.md).

## 8. Treat unresolved inspection as a blocking result

For a required inspection target, inability to resolve a reference or type blocks approval. Report a distinct unresolved-inspection diagnosis, rather than reporting a guessed rule violation or a pass. Make the inspected scope and unsupported constructs visible. Apply this contract to both languages; the current Rust implementation's advisory notes are not evidence that the new contract is implemented.

Keep normal gate checks and CI checks aligned, with direct execution for standalone paths. Standard AI-DLC 2.8.2 still has the separately tracked standalone-completion gap in T-01. This agreement does not modify third-party framework distributions or establish that the gap is fixed.

### Use Rust + syn for Rust analysis

Adopt a Rust executable using syn as the Rust syntax-analysis backend. Keep Rust syntax traversal and language-specific resolution in that implementation; the TypeScript wrapper does not parse Rust source. The [experiment](rust-syn-spike.md) establishes bounded syntax extraction and local native execution, not production sensor replacement.

Combine syn syntax with Cargo package/target/configuration evidence and scope-aware explicit reference resolution. Do not equate parsing with compiler type analysis. Required facts needing unsupported inference, trait resolution, macro expansion, or conditional compilation remain unresolved and block approval. A deeper semantic provider, if needed for intended release scenarios, requires its own compatibility proof.

The [inspection contract design](inspection-contract-design.md) defines shared facts, resolution/completeness states, operation-error comparison, per-rule results, and the Rust/TypeScript proof matrix. Keep business IDs separate from implementation symbol IDs, preserve access paths when resolving aliases, and bind results to the inspected source/configuration snapshot. Production native distribution and all-rule migration belong to T-10.

### Use the TypeScript Compiler API for TypeScript analysis

Use the TypeScript Compiler API for syntax and type analysis, starting with the small T-09 proof and continuing into T-11. Build a Program with the target project's compiler configuration and use its AST, symbols, and TypeChecker for aliases, re-exports, type-only references, and method return/error types. Respect tsconfig module resolution and project references, together with package exports, when identifying actual targets. A syntax-only parse or transpilation result does not establish type-dependent checks.

Keep Compiler API objects inside the TypeScript-specific implementation. Pass language-independent facts and findings into the shared inspection contract, and improve Rust's extraction/resolution against that same contract. Unresolved required facts still block approval; the compiler's type information does not prove business invariants or ownership effects by itself.

Record and test the supported compiler/API version and project compatibility range. The [official API guide](https://github.com/microsoft/TypeScript/wiki/Using-the-Compiler-API) currently describes TypeScript 6.0 and earlier and notes a different API for 7.1. Select the concrete version during implementation design and verify the integration rather than assuming all API generations are interchangeable.

## 9. Migrate artifacts to a common contract

Keep the canonical domain model as the owner of business definitions and stable IDs. Express implementation locations, package/module/type/method bindings, and language-specific facts in the implementation mappings. Generalize the actual declaration and inspection contracts, including their semantics; renaming crate fields alone is insufficient.

The agreed destination is a common artifact format. Provide an explicit migration command for existing Rust artifacts. Convert information that has a deterministic mapping and identify information needing domain input, including missing factory error definitions. Do not invent business errors to make migration pass. Preserve business identity and meaning, and preserve the language of existing records. Readers, validators, generation instructions, fixtures, and documentation must move together.

Exact schema versions, field names, binding syntax, migration command arguments, and migration validation details remain implementation-design work. T-09-05 implements the first part of this agreement: `schema_version: 2` of the canonical model, in which each operation owns its own business errors, and `ddd-domain-model.ts migrate` for that one artifact. The aggregate mapping, layer declarations and project settings are not part of it, and no production gate reads the new format yet. See [operation-owned errors](../users/domain-model-operation-errors.md). T-09-06 implements the aggregate mapping part: `schema_version: 2` of `ddd-aggregate-mapping.md`, which separates business identity from each language's package, module path, type, method and error case, binds commands, factory rules and business errors to code, and `ddd-aggregate-mapping.ts migrate` for that one artifact. Layer declarations and project settings remain outside it, and no production gate reads the new mapping yet. See [implementation mapping](../users/implementation-mapping.md). T-09-07 implements the layer declaration part: `schema_version: 2` of the `## DDD Layer Structure` section of `cicd-pipeline.md`, which states the dependency regime — the CQRS sides, the dependency edges, the ports, the repositories and the restoration paths — over package identities that name the language spelling them, a structural inspection that can be run on its own, and `ddd-layer-declaration.ts migrate` for that one section. The use-case declarations of `functional-spec.md` were already language-neutral and are unchanged. Project settings remain outside it, and no production gate reads the new declaration yet. See [layer declaration](../users/layer-declaration.md). The first inspection that reads the new canonical model and aggregate mapping is `operation-error-set/1`, implemented in T-09-08. It uses both languages' resolved facts to find missing, extra and foreign errors of commands and generation methods with one shared judgement, and it runs from the verification paths rather than a production gate. See [operation error-set comparison](operation-error-set.md).

## 10. Compare the current Rust implementation with the target

| Area | Current Rust evidence | Required work for the shared contract |
|---|---|---|
| Rules and execution context | Rule facts and context still include Cargo/Rust structures; see [definitions](../../tools/ddd/lib/rules/definitions.ts) and [context types](../../tools/ddd/lib/rules/types.ts). | Separate shared requirements from language-specific extraction, resolution, and evaluation. Validate the separation with both languages. |
| Implementation mappings | The format half is closed in T-09-06: the [aggregate mapping reader](../../tools/ddd/lib/aggregate-mapping/index.ts) reads `schema_version: 2`, which records each language's location under `code`, and migrates a crate/module document explicitly. The production [declarations](../../tools/ddd/lib/sensors/declaration.ts) and [package validation](../../tools/ddd/lib/packaging/declarations.ts) still build in crate fields, `::` module paths, and the `crate` root convention. | Switch the production sensors, generation instructions and knowledge to the new mapping, and match its names against resolved code symbols. |
| Method errors | The shared comparison is implemented in T-09-08: the [operation error-set comparison](../../tools/ddd/lib/operation-error-set/index.ts) matches each language's resolved case set against each operation's mapped errors and reports missing, extra and foreign cases with one meaning. It runs from the verification paths only; the production [domain sensor](../../tools/ddd-sensor-rust-domain.ts) still does not compare Result error types and their variant sets with each method's errors. | Connect the comparison to the production sensors. |
| Error owner consistency | Closed in T-09-05. The gap was reproduced — a `DomainError.command` naming another command that existed was accepted — and the [loader](../../tools/ddd/lib/schema/loader.ts) now compares the declared owner with the containing operation in both schema versions. | Done for the canonical model. The code-side comparison of declared and returned errors is implemented on the verification paths in T-09-08, and the comparator also refuses a containing operation and a declared owner that disagree in the model or the mapping. Connecting it to the production sensors remains. |
| Generation errors | The canonical model half is closed in T-09-05: [FactoryRule](../../tools/ddd/lib/schema/model.ts) carries its own error set in `schema_version: 2`, and the loader checks its ownership. The artifact-level method mapping is closed in T-09-06: the [aggregate mapping reader](../../tools/ddd/lib/aggregate-mapping/index.ts) binds each factory rule to its method and error type. Comparing a generation method's error set with its resolved case set is implemented on the verification paths in T-09-08. Matching the mapped error type name against the resolved declaration name is still absent. | Add the check that matches the mapped error type name against the resolved declaration name, and connect the comparison to the production sensors. |
| Construction and invariants | Existing checks recognize construction shapes and declared operations. | Preserve those checks and add behavior tests; shape recognition does not prove invariant semantics. |
| Visibility, hosts, unresolved inspection | Existing layer checks and T-08 provide a foundation. Host separation, explicit public-boundary inspection, wildcard publication rules, and all required unresolved diagnoses are not fully enforced. | Improve Rust as well as TypeScript. Include infrastructure and host coverage in the scope audit. |
| Module layout | T-08 supports both Rust forms and blocking layout findings. | Preserve this behavior while adding the corresponding TypeScript policies. |

## 11. Verify behavior as well as sensor outcomes

Define shared scenarios first, then implement them in each language and supported representation. Existing sensor, distribution, installation, and gate tests remain required. Add actual application behavior tests for successful state changes, unchanged state on business failure, rejected invalid construction, and restoration after persistence.

The acceptance matrix must cover Rust's two layouts and TypeScript's two layouts combined with its two domain representations. Also test forbidden reverse dependencies, command/query boundaries, type-only dependencies, access through non-public paths and aliases, wildcard re-exports, method-error mismatches, unresolved analysis, and mutable-reference leaks. Record which supported aggregate execution and persistence combinations each scenario verifies; preserve the independent axes without claiming untested combinations pass.

Test the first TypeScript integration with an actual ESM Next.js application on the server-side Node.js runtime. Passing isolated source fixtures is insufficient for that integration claim. Keep semantic review alongside these tests; no finite suite establishes every possible business invariant.

## 12. Deliver Rust improvements first, then TypeScript

| Milestone | Deliverable and acceptance |
|---|---|
| Shared design and feasibility | Shared contracts, Rust/TypeScript comparison cases, and a small TypeScript implementation that exercises the proposed common boundary. |
| First release | Common architecture and artifact format, Rust gap fixes, explicit artifact migration, coherent knowledge/stages/sensors, and verified Rust behavior. Carry forward T-01/T-03/T-05/T-06 obligations and report their actual status. |
| Following release | TypeScript extraction and sensors, both domain representations and layouts, the agreed error/ownership contracts, and verified Next.js/Node.js integration. |

A TypeScript-only improvement does not complete a shared requirement. Each shared change needs a Rust impact assessment and aligned specifications, knowledge, stage instructions, sensors, and tests. The [work plan](completion-tasks.md) tracks this sequence. This document records agreement; implementation and execution evidence establish completion.
