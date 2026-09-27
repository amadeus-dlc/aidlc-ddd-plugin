/**
 * The TypeScript code the code-generation instructions teach, written once per code representation
 * (`class`, `companion`) and module layout (`named-file`, `index-file`), with the record the
 * code-generation gate reads.
 *
 * Each sample is a project of two packages: the language-extensions package of the infrastructure
 * layer, which declares `Result`, and a command-side domain package holding the `invoice` aggregate
 * with its child module `invoice/line`. The parent module has a child so the two layouts place it in
 * different files; only the file of that parent and the specifiers that name it change with the
 * layout. The TypeScript examples of the runtime instructions are copies of these sources.
 */

import { SUPPORTED_COMPILER_OPTIONS } from "../typescript-facts/project.ts";
import { modelDocument } from "../../golden/model-document.ts";
import type { GoldenCase } from "../../golden/runner.ts";

export type Representation = "class" | "companion";
export type Layout = "named-file" | "index-file";

const REPRESENTATIONS: readonly Representation[] = ["class", "companion"];
const LAYOUTS: readonly Layout[] = ["named-file", "index-file"];

const DOMAIN_SENSOR = "ddd-typescript-domain";
const LAYOUT_SENSOR = "ddd-typescript-module-layout";

const OUTPUT = "construction/u1/code-generation/code-summary.md";
const SOURCE_MANIFEST = "construction/u1/code-generation/source-manifest.json";
const MODEL_PATH = "inception/ddd-domain-modeling/ddd-domain-model-yaml.md";
const MAPPING_PATH = "inception/domain-design/ddd-aggregate-mapping.md";
const STATE = "## Stage Progress\n- [x] ddd-domain-modeling — EXECUTE\n- [x] code-generation — EXECUTE\n";

const RESULT_DIR = "packages/infrastructure/language-extensions";
const RESULT_NAME = "@acme/language-extensions";
const DOMAIN_DIR = "packages/command/billing-domain";
const DOMAIN_NAME = "@acme/billing-domain";

/** The project-relative file of the `invoice` parent module under `layout`. */
export function parentModuleFile(layout: Layout): string {
  return layout === "named-file" ? `${DOMAIN_DIR}/src/invoice.ts` : `${DOMAIN_DIR}/src/invoice/index.ts`;
}

/** The file of the parent module the other layout uses; a sample never writes it. */
export function otherParentModuleFile(layout: Layout): string {
  return parentModuleFile(layout === "named-file" ? "index-file" : "named-file");
}

const RESULT_SOURCE = `export type Result<T, E> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: E };
`;

const RESULT_INDEX = `export type { Result } from "./result.ts";
`;

const CLASS_LINE = `export class InvoiceLine {
  #amount: number;

  private constructor(amount: number) {
    this.#amount = amount;
  }

  static of(amount: number): InvoiceLine {
    return new InvoiceLine(amount);
  }

  addTo(total: number): number {
    return total + this.#amount;
  }
}
`;

const COMPANION_LINE = `const brand: unique symbol = Symbol("InvoiceLine");

export type InvoiceLine = {
  readonly [brand]: true;
  addTo(total: number): number;
};

export const InvoiceLine = {
  of(amount: number): InvoiceLine {
    const state = { amount };
    const instance: InvoiceLine = {
      [brand]: true,
      addTo(total: number): number {
        return total + state.amount;
      },
    };
    return instance;
  },
};
`;

const ERROR_TYPES = `export type OpenInvoiceError = "missing-customer";
export type AddInvoiceLineError = "already-issued";
export type IssueInvoiceError = "already-issued" | "empty-lines";
`;

function imports(lineSpecifier: string): string {
  return `import type { Result } from "${RESULT_NAME}";
import type { InvoiceLine } from "${lineSpecifier}";
`;
}

function classInvoice(lineSpecifier: string): string {
  return `${imports(lineSpecifier)}
${ERROR_TYPES}
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
`;
}

function companionInvoice(lineSpecifier: string): string {
  return `${imports(lineSpecifier)}
${ERROR_TYPES}
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
`;
}

function domainIndex(parentSpecifier: string): string {
  return `export type { AddInvoiceLineError, IssueInvoiceError, OpenInvoiceError } from "${parentSpecifier}";
export { Invoice } from "${parentSpecifier}";
export { InvoiceLine } from "./invoice/line.ts";
`;
}

/** The canonical model: `open` is a factory, `addLine` and `issue` are commands, each with its own errors. */
const MODEL = `schema_version: 2
bounded_contexts:
  - element_id: bc.billing
    name: Billing
    aggregates:
      - element_id: aggregate.invoice
        name: Invoice
        bounded_context: bc.billing
        root_element: entity.invoice
        states: [draft, issued]
        elements:
          - { element_id: entity.invoice, kind: entity, name: Invoice, aggregate: aggregate.invoice }
          - { element_id: vo.invoice-line, kind: value-object, name: InvoiceLine, aggregate: aggregate.invoice }
        invariants:
          - { element_id: invariant.invoice.total-positive, name: TotalPositive, aggregate: aggregate.invoice, statement: the total is not negative }
        commands:
          - element_id: command.invoice.add-line
            name: AddLine
            aggregate: aggregate.invoice
            effect: accumulation
            state_effect: none
            domain_errors:
              - { element_id: error.invoice.add-line.already-issued, name: AlreadyIssued, operation: command.invoice.add-line, condition: the invoice is issued }
            idempotency: { strategy: none }
          - element_id: command.invoice.issue
            name: Issue
            aggregate: aggregate.invoice
            effect: transition
            state_effect: transitions
            transitions: [transition.invoice.issue]
            domain_errors:
              - { element_id: error.invoice.issue.already-issued, name: AlreadyIssued, operation: command.invoice.issue, condition: the invoice is issued }
              - { element_id: error.invoice.issue.empty-lines, name: EmptyLines, operation: command.invoice.issue, condition: the invoice has no line }
            events: [event.invoice.issued]
            idempotency: { strategy: none }
        events:
          - { element_id: event.invoice.issued, name: Issued, aggregate: aggregate.invoice, produced_by: command.invoice.issue }
        transitions:
          - { element_id: transition.invoice.issue, name: Issue, aggregate: aggregate.invoice, from_state: draft, to_state: issued, command: command.invoice.issue }
        factory_rules:
          - element_id: factory.invoice.open
            name: Open
            target_element: entity.invoice
            preconditions: [invariant.invoice.total-positive]
            domain_errors:
              - { element_id: error.invoice.open.missing-customer, name: MissingCustomer, operation: factory.invoice.open, condition: no customer is given }
lineage: []
`;

const location = (module: readonly string[]) =>
  `{ language: typescript, package: "${DOMAIN_NAME}", module: [${module.join(", ")}] }`;

/** The implementation mapping placing the aggregate at `[invoice]` and naming each operation's error type. */
const MAPPING = [
  "# Aggregate mapping",
  "",
  "```yaml",
  "schema_version: 2",
  `model_ref: ${MODEL_PATH}`,
  "aggregate_mappings:",
  "  - aggregate_ref: aggregate.invoice",
  "    programming_model: class",
  "    persistence_method: state-sourcing",
  "    reference_ids: [entity.invoice]",
  `    code: { language: typescript, package: "${DOMAIN_NAME}", module: [invoice], type: Invoice }`,
  "    operations:",
  "      - operation_ref: factory.invoice.open",
  "        code: { method: open, error_type: OpenInvoiceError }",
  "        errors:",
  "          - { error_ref: error.invoice.open.missing-customer, code: { case: missing-customer } }",
  "      - operation_ref: command.invoice.add-line",
  "        code: { method: addLine, error_type: AddInvoiceLineError }",
  "        errors:",
  "          - { error_ref: error.invoice.add-line.already-issued, code: { case: already-issued } }",
  "      - operation_ref: command.invoice.issue",
  "        code: { method: issue, error_type: IssueInvoiceError }",
  "        errors:",
  "          - { error_ref: error.invoice.issue.already-issued, code: { case: already-issued } }",
  "          - { error_ref: error.invoice.issue.empty-lines, code: { case: empty-lines } }",
  "domain_packages:",
  `  - { term: Billing, model_refs: [bc.billing], rationale: owns the billing business, code: ${location([])} }`,
  `  - { term: Invoice, model_refs: [aggregate.invoice], rationale: opens and issues invoices, code: ${location(["invoice"])} }`,
  `  - { term: Invoice line, model_refs: [vo.invoice-line], rationale: the amounts an invoice adds up, code: ${location(["invoice", "line"])} }`,
  "```",
  "",
].join("\n");

function settings(representation: Representation, layout: Layout): string {
  return `schema_version = 2\nlanguages = ["typescript"]\n\n[typescript]\nmodule_layout = "${layout}"\ncode_representation = "${representation}"\n`;
}

function packageManifest(name: string, dependencies?: Readonly<Record<string, string>>): string {
  return `${JSON.stringify(
    { name, version: "0.1.0", type: "module", exports: { ".": "./src/index.ts" }, ...(dependencies ? { dependencies } : {}) },
    null,
    2,
  )}\n`;
}

const PACKAGE_TSCONFIG = `${JSON.stringify(
  {
    compilerOptions: {
      ...SUPPORTED_COMPILER_OPTIONS,
      allowImportingTsExtensions: true,
      noEmit: true,
      noUnusedLocals: true,
      noUnusedParameters: true,
    },
    include: ["src/**/*.ts"],
  },
  null,
  2,
)}\n`;

export interface GenerationSample {
  readonly representation: Representation;
  readonly layout: Layout;
  /** Project-root relative path -> content of every file of the project. */
  readonly workspace: Readonly<Record<string, string>>;
  /** Project-root relative path -> content of the TypeScript sources the sample generates. */
  readonly sources: Readonly<Record<string, string>>;
  /** The run of the TypeScript domain gate (T-11-02) over the sample. */
  readonly domainCase: GoldenCase;
  /** The run of the TypeScript module layout gate (T-11-04) over the same project and record. */
  readonly layoutCase: GoldenCase;
}

/** The generated project for one code representation and one module layout. */
function generationSample(representation: Representation, layout: Layout): GenerationSample {
  const named = layout === "named-file";
  const lineSpecifier = named ? "./invoice/line.ts" : "./line.ts";
  const parentSpecifier = named ? "./invoice.ts" : "./invoice/index.ts";
  const sources: Record<string, string> = {
    [`${RESULT_DIR}/src/index.ts`]: RESULT_INDEX,
    [`${RESULT_DIR}/src/result.ts`]: RESULT_SOURCE,
    [`${DOMAIN_DIR}/src/index.ts`]: domainIndex(parentSpecifier),
    [parentModuleFile(layout)]:
      representation === "class" ? classInvoice(lineSpecifier) : companionInvoice(lineSpecifier),
    [`${DOMAIN_DIR}/src/invoice/line.ts`]: representation === "class" ? CLASS_LINE : COMPANION_LINE,
  };
  const workspace: Record<string, string> = {
    ".ddd.toml": settings(representation, layout),
    "tsconfig.json": `${JSON.stringify({ files: [], references: [{ path: `./${RESULT_DIR}` }, { path: `./${DOMAIN_DIR}` }] }, null, 2)}\n`,
    [`${RESULT_DIR}/package.json`]: packageManifest(RESULT_NAME),
    [`${RESULT_DIR}/tsconfig.json`]: PACKAGE_TSCONFIG,
    [`${DOMAIN_DIR}/package.json`]: packageManifest(DOMAIN_NAME, { [RESULT_NAME]: "0.1.0" }),
    [`${DOMAIN_DIR}/tsconfig.json`]: PACKAGE_TSCONFIG,
    ...sources,
  };
  const files: Record<string, string> = {
    [OUTPUT]: "# Code summary\n",
    [SOURCE_MANIFEST]: JSON.stringify({
      stage: "code-generation",
      unit: "u1",
      version: 1,
      writes: Object.keys(sources).map((path) => ({ path })),
    }),
    [MODEL_PATH]: modelDocument(MODEL),
    [MAPPING_PATH]: MAPPING,
  };
  const name = `generation-sample-${representation}-${layout}`;
  const domainCase: GoldenCase = {
    sensor: DOMAIN_SENSOR,
    name,
    stage: "code-generation",
    output: OUTPUT,
    workspace,
    files,
    state: STATE,
    expect: { pass: true, rules: [] },
  };
  return { representation, layout, workspace, sources, domainCase, layoutCase: { ...domainCase, sensor: LAYOUT_SENSOR } };
}

/** Every sample, one per code representation and module layout. */
export function generationSamples(): GenerationSample[] {
  return REPRESENTATIONS.flatMap((representation) =>
    LAYOUTS.map((layout) => generationSample(representation, layout)),
  );
}
