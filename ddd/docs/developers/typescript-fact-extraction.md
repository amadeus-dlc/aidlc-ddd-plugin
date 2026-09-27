# TypeScript fact extraction

[日本語](typescript-fact-extraction.ja.md) | [Native extractor distribution](native-extractor-distribution.md)

The TypeScript fact extraction turns TypeScript sources into the facts TypeScript rules decide on: the declarations of each file, their members and visibility, imports and exports with type-only ones told apart, calls, and constructions. This document records how the Compiler API reaches an installed project, which Compiler API version and project settings are supported, what is reported when the extraction cannot start, and the contract of the facts it returns. No sensor reads these facts yet; the TypeScript rules are later T-11 work.

## The distributed Compiler API

The distribution carries the Compiler API. An installed project may have no `typescript` package, or a different version of it, and the extraction must start from the distributed tree alone:

```
tools/ddd/lib/typescript/vendor/typescript.js               # lib/typescript.js of typescript@6.0.3, copied verbatim
tools/ddd/lib/typescript/vendor/manifest.json               # {"typescript.js": {"sha256": "<digest>"}}
tools/ddd/lib/typescript/vendor/LICENSE.txt                 # Apache-2.0
tools/ddd/lib/typescript/vendor/ThirdPartyNoticeText.txt
tools/ddd/lib/typescript/vendor/NOTICE.md
```

[`compiler/launch.ts`](../../tools/ddd/lib/typescript/compiler/launch.ts) resolves `vendor/` relative to itself, so the same relative location holds in the source tree, in `dist/<harness>/` and in an installed project. It loads the compiler by absolute path; no module of the extraction imports a bare `typescript` at runtime, so an installed project's own `node_modules` is never consulted.

The alternative — using the installed project's `typescript` and checking its version — was rejected: a project without the package, or with another version, could never start the extraction, which contradicts starting from the distribution alone.

The files travel with the rest of the `tools/` payload: the plugin build projects them into `dist/claude/` and `dist/codex/`, composition writes them into the project, and [`install.ts`](../../scripts/install.ts) records them in `owned_files`. A fresh installation and an `--update` both place them. The directory is excluded from lint and coverage, kept byte-for-byte by `.gitattributes`, and explicitly un-ignored in `.gitignore` because a remote installation fetches the git source.

### Preparing the distributed compiler

Run from `ddd/`:

```sh
bun install --frozen-lockfile
bun run prepare:typescript
```

[`prepare-typescript-compiler.ts`](../../scripts/prepare-typescript-compiler.ts) refuses a `node_modules/typescript` of any version other than the supported one, copies `lib/typescript.js` and the two license texts into `vendor/`, and rewrites `manifest.json` from the copied bytes. `bun run check` runs it before the tests, and a test fails when the distributed compiler differs from the development dependency or from the recorded digest.

## Supported Compiler API version and project settings

The version and the settings are stated once, in [`compiler/settings.ts`](../../tools/ddd/lib/typescript/compiler/settings.ts), and the error-contract entry and the fact extraction both read them from there.

| Item | Supported |
|---|---|
| Compiler API | `6.0.3` exactly (the development dependency pins the same version) |
| Root `tsconfig.json` | exists, parses, and references at least one package |
| Each referenced package's `tsconfig.json` (with everything it inherits) | `module: esnext`, `moduleResolution: bundler`, `target: esnext`, `strict: true` |
| `customConditions` | any list of nonempty names |
| Across packages | every package states the same settings, including the same `customConditions` |

A setting left unstated is refused like a setting with another value, so a project is never inspected under settings it never stated.

## When the extraction cannot start

`classifyTypeScriptExtractor(workspaceRoot)` classifies one launch once, and `typeScriptExtractorIssue` projects that one outcome into one issue, in the shape the native extractor reports: `{code, subject, message, location: null}`. The conditions are tested in a fixed order because each presupposes the previous:

| Order | Condition | Reported subject | Reason code |
|---|---|---|---|
| 1 | No manifest, a manifest that is not a digest record, or no compiler file | `typescript-extractor:compiler-missing` | `tool-unavailable` |
| 2 | The compiler bytes do not hash to the recorded digest | `typescript-extractor:checksum-mismatch` | `tool-unavailable` |
| 3 | Loading the compiler throws | `typescript-extractor:load-failed` | `tool-unavailable` |
| 4 | The loaded compiler reports another version, or none | `typescript-extractor:version-mismatch` | `unknown-version` |
| 5 | The inspected project is outside the supported settings | `typescript-extractor:project-condition-mismatch` | `tool-unavailable` when a `tsconfig.json` is missing or unreadable, `unsupported-syntax` when a setting is outside the range |

Each condition carries its own subject, and when more than one holds only the first is reported. The digest is checked before the compiler is loaded, so changed bytes are never evaluated.

None of these pass. `requireTypeScriptFacts` turns a blocked launch, and an extraction that did not complete, into a `ToolUnavailableError`; the sensor runtime turns that into its tool-unavailable terminal — exit 127, no verdict on stdout, the reason on stderr — exactly as `requireDomainFacts` does for Rust. An inspection that cannot run does not approve.

## The fact contract

`requireTypeScriptFacts(outcome, sources)` takes `{file, source}` pairs and returns `{files, notes}`. `files` maps each file to its facts; `notes` has one line per construct that could hide a fact, sorted, each once. A request with no sources returns no files and no notes.

Each source is parsed from its text alone — no library, no module resolution, no ambient types, no emit. A path ending in `.tsx` is parsed as TSX and every other path as TypeScript. A file whose syntax the compiler rejects has **no record** in `files`, never an empty one, and gets the note `domain-facts.unresolved: <file>:<line> syntax-error`; the other files of the request are still read.

Positions: lines are 1-based; a span is `{start_line, start_col, end_line, end_col}`, with 1-based columns counted in UTF-16 code units and the end column one past the last character of the node. Each list is in source order.

| Field | Record |
|---|---|
| `declarations` | `{name, kind, binding?, exported, default_export, ambient, span, members}` for each statement at the top of the file. `kind` is `class`, `interface`, `type-alias`, `enum`, `function` or `variable`; a variable also has `binding`: `const`, `let`, `var`, `using` or `await-using`. An anonymous default-exported class or function is named `default`. `exported`, `default_export` and `ambient` come from the `export`, `default` and `declare` written on the declaration |
| `members` | `{name, kind, visibility, static, readonly, span}`. Class members (properties, methods, accessors, the constructor, and constructor parameter properties), interface and type-literal members, enum members, and the members of an object literal a variable is initialized with. `visibility` is `public`, `protected`, `private` or `private-name` (a `#name`, spelled with its `#`). Call, construct and index signatures and static blocks are not members; a spread in such an object literal is not a member and is returned as unresolved (`object-spread`) |
| `imports` | `{specifier, kind, type_only, bindings, line}`. `kind` is `named`, `default`, `namespace`, `side-effect`, `dynamic` (`import("…")`) or `type-query` (an import type such as `import("…").T`). `bindings` are `{name, imported, type_only}`, with `imported` `default` for a default import and `*` for a namespace |
| `exports` | `{kind, specifier?, type_only, names, line}` for export statements. `kind` is `named`, `all`, `namespace` or `default-expression`; `names` are `{name, local, type_only}`. An `export` written on a declaration is not an export statement — the declaration's `exported` carries it |
| `calls` | `{kind, callee_text, receiver_text?, span}`. `kind` is `function-call`, `method-call` (with the receiver as spelled) or `super-call`. A tagged template is a call of its tag |
| `constructions` | `{kind, type_text, span}`. `new-expression` names the class as spelled; `typed-object-literal` is an object literal written against a type by `as T`, `satisfies T`, `<T>` or the annotation of the variable it initializes. `as const` states no type |
| `unresolved` | `{line, reason}`, each also a note `domain-facts.unresolved: <file>:<line> <reason>` |

### Type-only dependencies

A dependency is type-only when it is erased: `import type …`, `export type …`, and an import type. A binding written `type B` inside a value import is type-only, while the import itself is not, because the statement still loads its module. A value `import("…")` is never type-only.

### Unresolved constructs

The reasons are a closed set. Each marks a construct whose declarations, dependencies or callee cannot be decided from its syntax:

| Reason | Construct |
|---|---|
| `decorator` | any decorator; it may replace what it decorates |
| `computed-name` | a computed member name of a recorded declaration; the member is not recorded |
| `object-spread` | a spread (`...x`) in the object literal a variable at the top of a file is initialized with; the members it brings in are not recorded |
| `binding-pattern` | a destructuring variable declaration at the top of a file; its names are not recorded |
| `import-equals` | `import x = require("…")` and `import x = N.y` at the top of a file |
| `export-assignment` | `export = …` |
| `dynamic-import` | `import(…)` or an import type whose specifier is not a string literal |
| `namespace` | a namespace or module declaration, `declare global`, and `export as namespace`; what it declares is not recorded |
| `dynamic-callee` | a call or `new` whose target is neither a name nor a property access, such as `handlers[kind]()` |

### What the extraction does not decide

The extraction runs without a type checker. Every fact comes from a syntax node, so a spelling inside a comment, a string, a template without substitutions or a regular expression is never a fact, and no fact depends on what a name resolves to. Distinctions that need types — a value import that is only used as a type, which declaration a call reaches, the type of an untyped object literal — are not in this fact set; a rule that needs them has to establish them with the Program and TypeChecker, as the [language-independent design](language-independent-design.md) requires.

## Out of scope

The TypeScript rules and gates (later T-11 work), languages other than TypeScript, and library-specific integration with neverthrow, Effect or fp-ts. The error-contract and state-evidence entries still import the development dependency; they are verification paths that no sensor reaches, and moving them onto the distributed compiler is not part of this change. Measurement on Linux, Windows and x86_64 has not been done; the distributed compiler is JavaScript and does not depend on the platform.
