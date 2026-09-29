/**
 * TypeScript domain golden cases (T-11-02). Each case is a TypeScript project — a root
 * `tsconfig.json` referencing one directory per package, each with its `package.json` and a
 * `tsconfig.json` stating the supported compiler settings — plus the record the code-generation gate
 * reads: the code summary, the source claims, the canonical model and the implementation mapping.
 *
 * The domain aggregate is written in both representations the gate decides on — a `class` and a
 * companion (a `type` literal paired with a `const` object of the same name) — so every rule of the
 * Rust domain gate has a case of each.
 */

import { SUPPORTED_COMPILER_OPTIONS } from "../../fixtures/typescript-facts/project.ts";
import { modelDocument } from "../model-document.ts";
import type { GoldenCase } from "../runner.ts";
import { MODEL } from "../rust/cases.ts";

export const TYPESCRIPT_SENSOR = "ddd-typescript-domain";
const OUTPUT = "construction/u1/code-generation/code-summary.md";
const SOURCE_MANIFEST = "construction/u1/code-generation/source-manifest.json";
const MODEL_PATH = "inception/ddd-domain-modeling/ddd-domain-model-yaml.md";
const MAPPING_PATH = "inception/domain-design/ddd-aggregate-mapping.md";
const STATE = "## Stage Progress\n- [x] ddd-domain-modeling — EXECUTE\n- [x] code-generation — EXECUTE\n";
export const SKIPPED_STATE = "## Stage Progress\n- [S] ddd-domain-modeling — SKIP\n- [x] code-generation — EXECUTE\n";

export const DOMAIN_DIR = "packages/domain/billing-domain";
const DOMAIN_NAME = "@acme/billing-domain";
export const DOMAIN_FILE = `${DOMAIN_DIR}/src/invoice.ts`;
export const DOMAIN_INDEX = `${DOMAIN_DIR}/src/index.ts`;
const INDEX = 'export { Invoice } from "./invoice.ts";\n';

/** A TypeScript package: its directory below the project root, its name and its files. */
interface TsPackage {
  readonly dir: string;
  readonly name: string;
  /** Package-relative path -> content. */
  readonly files: Readonly<Record<string, string>>;
  /** Fields merged over the default `package.json` (name, version, type, and exports of `.`). */
  readonly manifest?: Readonly<Record<string, unknown>>;
  /** Options merged over the supported compiler settings of this package's `tsconfig.json`. */
  readonly compilerOptions?: Readonly<Record<string, unknown>>;
}

export const USE_CASE: TsPackage = {
  dir: "packages/use-case/billing-use-case",
  name: "@acme/billing-use-case",
  files: { "src/index.ts": "export class IssueInvoice {}\n" },
};
const INTERFACE_ADAPTER: TsPackage = {
  dir: "packages/interface-adapter/billing-interface-adapter",
  name: "@acme/billing-interface-adapter",
  files: { "src/index.ts": "export class Adapter {}\n" },
};
const INFRASTRUCTURE: TsPackage = {
  dir: "packages/infrastructure/billing-infrastructure",
  name: "@acme/billing-infrastructure",
  files: {
    "src/index.ts": "export class Clock {}\n",
    "src/db.ts": "export class Db {}\n",
    "src/x.ts": "export class X {}\n",
  },
};

/** The project files of `packages`, plus files outside any package. */
function tsWorkspace(
  packages: readonly TsPackage[],
  extra: Readonly<Record<string, string>> = {},
): Record<string, string> {
  const workspace: Record<string, string> = {
    "tsconfig.json": `${JSON.stringify({ files: [], references: packages.map((entry) => ({ path: `./${entry.dir}` })) }, null, 2)}\n`,
  };
  for (const entry of packages) {
    workspace[`${entry.dir}/package.json`] = `${JSON.stringify(
      { name: entry.name, version: "0.1.0", type: "module", exports: { ".": "./src/index.ts" }, ...entry.manifest },
      null,
      2,
    )}\n`;
    workspace[`${entry.dir}/tsconfig.json`] = `${JSON.stringify(
      { compilerOptions: { ...SUPPORTED_COMPILER_OPTIONS, ...entry.compilerOptions }, include: ["src/**/*.ts"] },
      null,
      2,
    )}\n`;
    for (const [path, content] of Object.entries(entry.files)) workspace[`${entry.dir}/${path}`] = content;
  }
  return { ...workspace, ...extra };
}

interface MappingOptions {
  /** The package the aggregate and the declared packages are placed in. */
  readonly pkg: string;
  /** Module paths declared below that package, besides its root. */
  readonly modules: readonly (readonly string[])[];
  readonly persistence?: "state-sourcing" | "event-sourcing";
  readonly replay?: { readonly event_ref: string; readonly method: string };
}

/** The implementation mapping of the shared model, placing the aggregate in TypeScript at `[invoice]`. */
function tsMapping(options: MappingOptions): string {
  const location = (module: readonly string[]) =>
    `{ language: typescript, package: "${options.pkg}", module: [${module.join(", ")}] }`;
  const packages = [[], ...options.modules].map(
    (module) =>
      `  - { term: 請求, model_refs: [bc.billing], rationale: 請求の業務を所有する, code: ${location(module)} }`,
  );
  const replay = options.replay
    ? [
        "    replay_methods:",
        `      - { event_ref: ${options.replay.event_ref}, code: { method: ${options.replay.method} } }`,
      ]
    : [];
  const references = options.replay ? "[entity.invoice, event.invoice.issued]" : "[entity.invoice]";
  return [
    "# 集約写像",
    "",
    "```yaml",
    "schema_version: 2",
    `model_ref: ${MODEL_PATH}`,
    "aggregate_mappings:",
    "  - aggregate_ref: aggregate.invoice",
    "    programming_model: class",
    `    persistence_method: ${options.persistence ?? "state-sourcing"}`,
    `    reference_ids: ${references}`,
    ...replay,
    `    code: { language: typescript, package: "${options.pkg}", module: [invoice], type: Invoice }`,
    "    operations:",
    "      - operation_ref: command.invoice.issue",
    "        code: { method: issue, error_type: IssueInvoiceError }",
    "        errors:",
    "          - { error_ref: error.invoice.issue.already-issued, code: { case: already-issued } }",
    "domain_packages:",
    ...packages,
    "```",
    "",
  ].join("\n");
}

export const CLASS_CLEAN = `export class Invoice {
  #id: string;
  #amount: number;
  #issued = false;

  private constructor(id: string, amount: number) {
    this.#id = id;
    this.#amount = amount;
  }

  static open(id: string, amount: number): Invoice {
    return new Invoice(id, amount);
  }

  issue(): void {
    this.#issued = true;
  }

  total(): number {
    return this.#amount;
  }
}
`;

export const COMPANION_CLEAN = `const brand: unique symbol = Symbol("Invoice");

export type Invoice = { readonly [brand]: true; issue(): void; total(): number };

export const Invoice = {
  open(id: string, amount: number): Invoice {
    const state = { id, amount, issued: false };
    const instance: Invoice = {
      [brand]: true,
      issue() {
        state.issued = true;
      },
      total() {
        return state.amount;
      },
    };
    return instance;
  },
};
`;

/** `text` with `from` replaced once; a pattern the fixture does not carry is a broken fixture. */
export function edit(text: string, from: string, to: string): string {
  if (!text.includes(from)) throw new Error(`the fixture carries no ${JSON.stringify(from)}`);
  return text.replace(from, to);
}

interface DomainOptions {
  /** The content of `src/invoice.ts`; ignored when `files` replaces the domain sources. */
  readonly source?: string;
  /** The domain package's files, replacing `src/index.ts` and `src/invoice.ts`. */
  readonly files?: Readonly<Record<string, string>>;
  /** Files added beside the default domain files. */
  readonly addFiles?: Readonly<Record<string, string>>;
  readonly manifest?: Readonly<Record<string, unknown>>;
  readonly compilerOptions?: Readonly<Record<string, unknown>>;
  readonly others?: readonly TsPackage[];
  /** Files outside every package, project-root relative. */
  readonly extra?: Readonly<Record<string, string>>;
  /** Project-root relative claims; defaults to the domain `src/invoice.ts`. */
  readonly claims?: readonly string[];
  readonly state?: string;
  /** Module paths declared besides the root and `[invoice]`. */
  readonly modules?: readonly (readonly string[])[];
  /** A mapping to write instead of the default one, or `null` for none. */
  readonly mapping?: string | null;
  readonly domainDir?: string;
  readonly domainName?: string;
  /** Replaces the canonical model document. */
  readonly model?: string;
}

/** A code-generation gate case over one domain package holding the aggregate. */
export function tsCase(name: string, options: DomainOptions, expect: GoldenCase["expect"]): GoldenCase {
  const dir = options.domainDir ?? DOMAIN_DIR;
  const pkg = options.domainName ?? DOMAIN_NAME;
  const domainFiles = options.files ?? {
    "src/index.ts": INDEX,
    "src/invoice.ts": options.source ?? CLASS_CLEAN,
    ...options.addFiles,
  };
  const domain: TsPackage = {
    dir,
    name: pkg,
    files: domainFiles,
    ...(options.manifest ? { manifest: options.manifest } : {}),
    ...(options.compilerOptions ? { compilerOptions: options.compilerOptions } : {}),
  };
  const claims = options.claims ?? [`${dir}/src/invoice.ts`];
  const files: Record<string, string> = {
    [OUTPUT]: "# code summary\n",
    [SOURCE_MANIFEST]: JSON.stringify({
      stage: "code-generation",
      unit: "u1",
      version: 1,
      writes: claims.map((path) => ({ path })),
    }),
    [MODEL_PATH]: options.model ?? modelDocument(MODEL),
  };
  const mapping =
    options.mapping === undefined
      ? tsMapping({ pkg, modules: [["invoice"], ...(options.modules ?? [])] })
      : options.mapping;
  if (mapping !== null) files[MAPPING_PATH] = mapping;
  const expectedFiles: Record<string, string> = {};
  for (const rule of expect.rules) expectedFiles[rule] = `${dir}/src/invoice.ts`;
  return {
    sensor: TYPESCRIPT_SENSOR,
    name,
    stage: "code-generation",
    output: OUTPUT,
    workspace: tsWorkspace([domain, ...(options.others ?? [])], options.extra),
    files,
    state: options.state ?? STATE,
    expect: { ...expect, files: { ...expectedFiles, ...expect.files } },
  };
}

const PEEK = "\nexport function peek(invoice: Invoice): number {\n  return invoice.total();\n}\n";
const ADAPTER_IMPORT = 'import { Adapter } from "@acme/billing-interface-adapter";\n';

const CLASS_PUBLIC_ID = edit(edit(CLASS_CLEAN, "#id: string;", "id: string;"), "this.#id = id;", "this.id = id;");
const COMPANION_PUBLIC_ID = edit(
  edit(COMPANION_CLEAN, "readonly [brand]: true;", "readonly [brand]: true; readonly id: string;"),
  "[brand]: true,\n",
  "[brand]: true,\n      id,\n",
);

/** The aggregate of each representation with a getter `id` added, shared with the layer golden cases. */
export const CLASS_WITH_ID_GETTER = edit(
  CLASS_CLEAN,
  "  total(): number {",
  "  id(): string {\n    return this.#id;\n  }\n\n  total(): number {",
);
export const COMPANION_WITH_ID_GETTER = edit(
  edit(COMPANION_CLEAN, "total(): number };", "total(): number; id(): string };"),
  "      total() {",
  "      id() {\n        return state.id;\n      },\n      total() {",
);

/** The repository port of the aggregate, shared with the layer golden cases. */
export const INVOICE_REPOSITORY_PORT = "export interface InvoiceRepository {\n  remove(id: string): void;\n}\n";

/**
 * A domain function handing the result of the getter `id` unchanged to a repository port it declares:
 * the forwarding rule (d) permits in the use-case layer only, and the port belongs there too.
 */
const FORWARDING_PORT = `\n${INVOICE_REPOSITORY_PORT}\nexport function forget(invoice: Invoice, repo: InvoiceRepository): void {\n  repo.remove(invoice.id());\n}\n`;
const CLASS_FORWARDING = `${CLASS_WITH_ID_GETTER}${FORWARDING_PORT}`;
const COMPANION_FORWARDING = `${COMPANION_WITH_ID_GETTER}${FORWARDING_PORT}`;

/**
 * The cases whose Rust counterpart is the same scene of `golden/rust/cases.ts`, one per
 * representation. The keys are the Rust case names; the values the two TypeScript ones.
 */
export const RUST_COUNTERPARTS: Readonly<Record<string, readonly [string, string]>> = {
  "clean-domain": ["clean-class", "clean-companion"],
  "violation-a": ["violation-a-class", "violation-a-companion"],
  "violation-b": ["violation-b-class", "violation-b-companion"],
  "violation-c-literal": ["violation-c-class", "violation-c-companion"],
  "violation-d": ["violation-d-class", "violation-d-companion"],
  "violation-g": ["violation-g-class", "violation-g-companion"],
  "clean-model-skipped": ["clean-model-skipped-class", "clean-model-skipped-companion"],
  "violation-d-repository-domain-layer": [
    "violation-d-repository-domain-layer-class",
    "violation-d-repository-domain-layer-companion",
  ],
  "violation-port-placement": ["violation-port-placement-class", "violation-port-placement-companion"],
};

function representationCases(): GoldenCase[] {
  const out: GoldenCase[] = [];
  for (const [representation, clean, publicId, renamed, forged, forwarding] of [
    [
      "class",
      CLASS_CLEAN,
      CLASS_PUBLIC_ID,
      edit(CLASS_CLEAN, "issue(): void {", "rename(): void {"),
      `${CLASS_CLEAN}\nexport function build(): Invoice {\n  return new Invoice("x", 0);\n}\n`,
      CLASS_FORWARDING,
    ],
    [
      "companion",
      COMPANION_CLEAN,
      COMPANION_PUBLIC_ID,
      edit(edit(COMPANION_CLEAN, "issue(): void;", "rename(): void;"), "issue() {", "rename() {"),
      `${COMPANION_CLEAN}\nexport function build(): Invoice {\n  const forged: Invoice = { [brand]: true, issue() {}, total() { return 0; } };\n  return forged;\n}\n`,
      COMPANION_FORWARDING,
    ],
  ] as const) {
    out.push(
      tsCase(`clean-${representation}`, { source: clean }, { pass: true, rules: [] }),
      tsCase(`violation-a-${representation}`, { source: publicId }, { pass: false, rules: ["a"] }),
      tsCase(`violation-b-${representation}`, { source: renamed }, { pass: false, rules: ["b"] }),
      tsCase(`violation-c-${representation}`, { source: forged }, { pass: false, rules: ["c"] }),
      tsCase(`violation-d-${representation}`, { source: `${clean}${PEEK}` }, { pass: false, rules: ["d"] }),
      // Handing a getter result unchanged to a repository port is still a getter call in the domain layer.
      tsCase(
        `violation-d-repository-domain-layer-${representation}`,
        { source: forwarding },
        { pass: false, rules: ["d", "port-placement"] },
      ),
      // A repository port belongs to the use-case layer; a domain source that declares one is reported.
      tsCase(
        `violation-port-placement-${representation}`,
        { source: `${clean}\n${INVOICE_REPOSITORY_PORT}` },
        { pass: false, rules: ["port-placement"] },
      ),
      tsCase(
        `violation-g-${representation}`,
        { source: `${ADAPTER_IMPORT}${clean}`, others: [INTERFACE_ADAPTER] },
        { pass: false, rules: ["g"] },
      ),
      tsCase(
        `clean-model-skipped-${representation}`,
        { source: clean, state: SKIPPED_STATE },
        { pass: true, rules: [], note_contains: "domain-modeling is SKIP" },
      ),
    );
  }
  return out;
}

/** State hiding (a): what hides state at run time and what only hides it from the type checker. */
function stateHidingCases(): GoldenCase[] {
  return [
    // Only a `#` field is hidden at run time; the rest of the class is operations.
    tsCase(
      "clean-a-private-name-only",
      { source: "export class Invoice { #amount = 0; issue() { this.#amount = 1; } }\n" },
      { pass: true, rules: [] },
    ),
    // `private` is erased by the compiler, so the field is an own property anyone can read.
    tsCase(
      "violation-a-class-private",
      { source: "export class Invoice { private amount = 0; }\n" },
      { pass: false, rules: ["a"] },
    ),
    tsCase(
      "violation-a-class-readonly",
      { source: edit(edit(CLASS_CLEAN, "#id: string;", "readonly id: string;"), "this.#id = id;", "this.id = id;") },
      { pass: false, rules: ["a"] },
    ),
    tsCase(
      "violation-a-class-parameter-property",
      {
        source: edit(
          edit(CLASS_CLEAN, "#id: string;\n", ""),
          "private constructor(id: string, amount: number) {\n    this.#id = id;\n",
          "private constructor(protected id: string, amount: number) {\n",
        ),
      },
      { pass: false, rules: ["a"] },
    ),
    // Static members belong to the class object, not to an instance's state.
    tsCase(
      "clean-a-static-member",
      { source: edit(CLASS_CLEAN, "#issued = false;", "#issued = false;\n  static readonly currency = 'JPY';") },
      { pass: true, rules: [] },
    ),
  ];
}

/** Undeclared mutation (b): a replay method is exempt only when the mapping declares it. */
function mutationCases(): GoldenCase[] {
  const replaySource = `export class Issued {
  #amount = 0;
}

export class Invoice {
  #amount = 0;

  applyEvent(event: Issued): void {
    this.#amount = 1;
  }
}
`;
  return [
    tsCase(
      "clean-b-declared-replay",
      {
        source: replaySource,
        mapping: tsMapping({
          pkg: DOMAIN_NAME,
          modules: [["invoice"]],
          persistence: "event-sourcing",
          replay: { event_ref: "event.invoice.issued", method: "applyEvent" },
        }),
      },
      { pass: true, rules: [] },
    ),
    tsCase("violation-b-undeclared-replay", { source: replaySource }, { pass: false, rules: ["b"] }),
    // A method that only reads state is a query, not a mutation.
    tsCase(
      "clean-b-query-method",
      {
        source: edit(
          CLASS_CLEAN,
          "total(): number {",
          "isLarge(): boolean {\n    return this.#amount > 100;\n  }\n\n  total(): number {",
        ),
      },
      { pass: true, rules: [] },
    ),
  ];
}

/** Incomplete construction (c). */
function constructionCases(): GoldenCase[] {
  return [
    tsCase(
      "violation-c-type-assertion",
      { source: `${CLASS_CLEAN}\nexport function cast(value: unknown): Invoice {\n  return value as Invoice;\n}\n` },
      { pass: false, rules: ["c"] },
    ),
    tsCase(
      "violation-c-post-init",
      {
        source: edit(
          CLASS_CLEAN,
          "total(): number {",
          "reset(): void {\n    this.#issued = false;\n  }\n\n  total(): number {",
        ),
      },
      { pass: false, rules: ["c"] },
    ),
    // A substitution is code, so a construction inside one is a construction.
    tsCase(
      "violation-c-template-substitution",
      { source: `${CLASS_CLEAN}\nexport const label = \`\${new Invoice("x", 0)}\`;\n` },
      { pass: false, rules: ["c"] },
    ),
    // Comments, strings and regular expressions only spell a construction.
    tsCase(
      "clean-c-spelling-in-comments",
      {
        source: `${CLASS_CLEAN}\n// new Invoice()\nexport const text = "new Invoice()";\nexport const pattern = /new Invoice\\(\\)/;\n`,
      },
      { pass: true, rules: [] },
    ),
  ];
}

/** Getter calls (d). */
function getterCases(): GoldenCase[] {
  return [
    tsCase(
      "clean-d-self-getter",
      { source: edit(CLASS_CLEAN, "this.#issued = true;", "if (this.total() >= 0) this.#issued = true;") },
      { pass: true, rules: [] },
    ),
  ];
}

const LINE_FILE = "export class Line {}\n";

/** Dependency direction (g): packages, exports, type-only dependencies, aliases and re-exports. */
function dependencyCases(): GoldenCase[] {
  return [
    tsCase(
      "clean-g-domain-to-infrastructure-import",
      { source: `import { Clock } from "@acme/billing-infrastructure";\n${CLASS_CLEAN}`, others: [INFRASTRUCTURE] },
      { pass: true, rules: [] },
    ),
    tsCase(
      "clean-g-domain-to-infrastructure-package-json",
      {
        source: CLASS_CLEAN,
        manifest: { dependencies: { "@acme/billing-infrastructure": "0.1.0" } },
        others: [INFRASTRUCTURE],
      },
      { pass: true, rules: [] },
    ),
    tsCase(
      "violation-g-package-json-dependency",
      { source: CLASS_CLEAN, manifest: { dependencies: { "@acme/billing-use-case": "0.1.0" } }, others: [USE_CASE] },
      { pass: false, rules: ["g"], files: { g: `${DOMAIN_DIR}/package.json` } },
    ),
    tsCase(
      "violation-g-type-only",
      { source: `import type { IssueInvoice } from "@acme/billing-use-case";\n${CLASS_CLEAN}`, others: [USE_CASE] },
      { pass: false, rules: ["g"] },
    ),
    tsCase(
      "violation-g-external-io",
      { source: `import { MongoClient } from "mongodb";\n${CLASS_CLEAN}` },
      { pass: false, rules: ["g"] },
    ),
    // The public entry of another package, a Node built-in and a file of this package are allowed.
    tsCase(
      "clean-g-public-entry",
      {
        source: `import { Clock } from "@acme/billing-infrastructure";\nimport fs from "node:fs";\nimport { Line } from "./invoice/line.ts";\n${CLASS_CLEAN}`,
        addFiles: { "src/invoice/line.ts": LINE_FILE },
        modules: [["invoice", "line"]],
        others: [INFRASTRUCTURE],
      },
      { pass: true, rules: [] },
    ),
    // A path the package does not export, reached by name or by a relative path into its directory.
    tsCase(
      "violation-g-private-path",
      {
        source: `import { Db } from "@acme/billing-infrastructure/src/db";\nimport { X } from "../../../infrastructure/billing-infrastructure/src/x.ts";\n${CLASS_CLEAN}`,
        others: [INFRASTRUCTURE],
      },
      { pass: false, rules: ["g"] },
    ),
    tsCase(
      "violation-g-alias",
      {
        source: `import { Clock } from "@infra/index.ts";\n${CLASS_CLEAN}`,
        compilerOptions: { paths: { "@infra/*": ["../../infrastructure/billing-infrastructure/src/*"] } },
        others: [INFRASTRUCTURE],
      },
      { pass: false, rules: ["g"] },
    ),
    tsCase(
      "clean-g-alias-own-package",
      {
        source: `import { Line } from "@self/invoice/line.ts";\n${CLASS_CLEAN}`,
        compilerOptions: { paths: { "@self/*": ["./src/*"] } },
        addFiles: { "src/invoice/line.ts": LINE_FILE },
        modules: [["invoice", "line"]],
      },
      { pass: true, rules: [] },
    ),
    tsCase(
      "violation-g-wildcard-reexport",
      {
        files: {
          "src/index.ts": 'export * from "./invoice.ts";\nexport * as money from "./money.ts";\n',
          "src/invoice.ts": CLASS_CLEAN,
          "src/money.ts": "export class Money {}\n",
        },
        modules: [["money"]],
        claims: [DOMAIN_INDEX, DOMAIN_FILE],
      },
      { pass: false, rules: ["g"], files: { g: DOMAIN_INDEX } },
    ),
    // A file the exports do not name may re-export its neighbours; a commented re-export is no export.
    tsCase(
      "clean-g-internal-barrel",
      {
        files: {
          "src/index.ts": '// export * from "./x.ts"\nexport { Invoice } from "./invoice/index.ts";\n',
          "src/invoice/index.ts": `export * from "./line.ts";\n${CLASS_CLEAN}`,
          "src/invoice/line.ts": LINE_FILE,
        },
        modules: [["invoice", "line"]],
        claims: [DOMAIN_INDEX, `${DOMAIN_DIR}/src/invoice/index.ts`],
      },
      { pass: true, rules: [] },
    ),
  ];
}

/** Domain packaging, with a TypeScript module path read off the file placement. */
function packagingCases(): GoldenCase[] {
  return [
    tsCase(
      "clean-packaging-index-file",
      {
        files: {
          "src/index.ts": 'export { Invoice } from "./invoice/index.ts";\n',
          "src/invoice/index.ts": CLASS_CLEAN,
        },
        claims: [`${DOMAIN_DIR}/src/invoice/index.ts`],
      },
      { pass: true, rules: [] },
    ),
    tsCase(
      "clean-packaging-word-substring",
      { addFiles: { "src/invoice-entities.ts": "export const entries = 1;\n" }, modules: [["invoice-entities"]] },
      { pass: true, rules: [] },
    ),
    tsCase(
      "violation-packaging-no-mapping",
      { mapping: null },
      { pass: false, rules: ["domain-packaging.declaration"], files: { "domain-packaging.declaration": MAPPING_PATH } },
    ),
    tsCase(
      "violation-packaging-technical-name",
      { addFiles: { "src/entities.ts": "export const entries = 1;\n" } },
      {
        pass: false,
        rules: ["domain-packaging.technical-name"],
        files: { "domain-packaging.technical-name": `${DOMAIN_DIR}/src/entities.ts` },
      },
    ),
    tsCase(
      "violation-packaging-coverage",
      { addFiles: { "src/money.ts": "export const money = 1;\n" } },
      {
        pass: false,
        rules: ["domain-packaging.coverage"],
        files: { "domain-packaging.coverage": `${DOMAIN_DIR}/src/money.ts` },
      },
    ),
    tsCase(
      "violation-packaging-invalid-segment",
      { addFiles: { "src/invoice.model.ts": "export const model = 1;\n" } },
      {
        pass: false,
        rules: ["domain-packaging.unresolved"],
        files: { "domain-packaging.unresolved": `${DOMAIN_DIR}/src/invoice.model.ts` },
      },
    ),
  ];
}

/** Layer diagnostics and the model the gate decides against. */
function diagnosticCases(): GoldenCase[] {
  const thing: TsPackage = {
    dir: "packages/misc/billing-thing",
    name: "@acme/billing-thing",
    files: { "src/index.ts": "export class Thing {}\n" },
  };
  const conflicting: TsPackage = {
    dir: "packages/use-case/billing-domain",
    name: "@acme/billing-domain",
    files: { "src/index.ts": "export class Placeholder {}\n" },
  };
  return [
    tsCase(
      "violation-layer-unknown",
      { others: [thing], claims: [DOMAIN_FILE, `${thing.dir}/src/index.ts`] },
      { pass: false, rules: ["layer.unknown"], files: { "layer.unknown": `${thing.dir}/package.json` } },
    ),
    tsCase(
      "violation-layer-conflict",
      {
        domainDir: "packages/domain/billing-core-domain",
        domainName: "@acme/billing-core-domain",
        others: [conflicting],
        claims: ["packages/domain/billing-core-domain/src/invoice.ts", `${conflicting.dir}/src/index.ts`],
      },
      { pass: false, rules: ["layer.conflict"], files: { "layer.conflict": `${conflicting.dir}/package.json` } },
    ),
    // No `package.json` owns the claimed file; the finding names it relative to the record, as the
    // Rust gate names a claim no Cargo workspace owns.
    tsCase(
      "violation-layer-unowned",
      { extra: { "scripts/seed.ts": "export const seed = 1;\n" }, claims: [DOMAIN_FILE, "scripts/seed.ts"] },
      { pass: false, rules: ["layer.unowned"], files: { "layer.unowned": "../../../../../scripts/seed.ts" } },
    ),
    tsCase(
      "violation-model-invalid",
      { model: modelDocument(edit(MODEL, "schema_version: 2", "schema_version: 1")) },
      {
        pass: false,
        rules: ["model.invalid", "domain-packaging.reference"],
        files: { "model.invalid": MODEL_PATH, "domain-packaging.reference": MAPPING_PATH },
      },
    ),
  ];
}

export const TYPESCRIPT_CASES: GoldenCase[] = [
  ...representationCases(),
  ...stateHidingCases(),
  ...mutationCases(),
  ...constructionCases(),
  ...getterCases(),
  ...dependencyCases(),
  ...packagingCases(),
  ...diagnosticCases(),
];
