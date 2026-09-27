# TypeScript module layout

Choose one reviewable TypeScript layout per project in the project-root `.ddd.toml` before placing TypeScript modules. The settings document names typescript among its languages and states `module_layout` in its typescript table as either `named-file` or `index-file`. The same setting drives the gate sensor and CI. Do not infer it from existing files, select per-package overrides, or mix the two.

A project that uses no TypeScript declares no TypeScript layout, and a project that holds TypeScript (a `tsconfig.json` or a TypeScript source outside the excluded trees) has to name it. A document still in the Rust-only format is refused until it is converted with `ddd-artifact-set migrate` or `ddd-project-settings migrate`.

A TypeScript module is its file. The source root is `src` directly under a package root, the directory holding `package.json`; sources elsewhere, such as `test/` or build scripts, are not placed modules. `src/index.ts` is the package entry and is not a placed module. A module has children when its directory `src/<m>/` holds TypeScript sources other than its own `index.ts`.

- `named-file`: a module with children is `src/<m>.ts`, with its children under `src/<m>/`. Do not create `src/<m>/index.ts`.
- `index-file`: a module with children is `src/<m>/index.ts`. Do not create `src/<m>.ts` beside that directory.
- In both layouts a leaf is the named file, such as `src/<m>/<leaf>.ts`. An `index.ts` left in a directory whose children moved away is a leftover and has to become the named file.

Every module file is named `<module>.ts`. Test files, declaration files, and `.tsx`, `.mts`, or `.cts` sources inside `src` cannot be placed as modules; keep them outside `src`. Do not place a module in both files, leave a module directory without its module file, link files or directories into the project with symbolic links, or place a package inside another package's `src`. When moving a module file, update the imports that name it.

`ddd-typescript-module-layout` blocks code-generation, build-and-test, and ci-pipeline admission for missing or invalid configuration, wrong placement, or unresolved structure. It scans owned project sources rather than source-manifest claims, and does not depend on domain modeling. Hidden directories, aidlc, node_modules, vendor, target, and dist are excluded from discovery. It checks file placement only; it does not check imports, exports, or compilation.

Use `bun <project-root>/<harness-dir>/tools/ddd-check-typescript-module-layout.ts --project <project-root>` for CI and standalone completion, requiring exit status 0. Run it every time, beside type checking and tests. General gate sensors are not enforced by standard AI-DLC 2.8.2 standalone completion. The CI pipeline stage must install an actual required check; prose in a report is not CI enforcement.

In this repository, see the [user contract](../../docs/users/typescript-module-layout.md). Repository docs are not distributed as runtime knowledge.

In these commands, `<harness-dir>` is `.claude` for Claude Code or `.codex` for Codex; replace both path placeholders with the installed project paths.
