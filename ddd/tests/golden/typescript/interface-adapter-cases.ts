/**
 * TypeScript interface-adapter golden cases (T-11-03): command / query cross-side references (k),
 * query-side references to a domain type or repository port (l), repository naming (m), restoration
 * bypass (n) and the dependency direction (g), each over the domain aggregate written as a `class`
 * and as a companion, with the rule ids and finding meanings of `ddd-rust-interface-adapter`.
 *
 * The gate decides the interface-adapter and rmu packages and every query-side package, whatever
 * its layer, as the Rust gate does.
 */

import type { GoldenCase } from "../runner.ts";
import {
  INFRASTRUCTURE,
  interfaceAdapterPackage,
  type LayerPackage,
  layerCase,
  REPRESENTATIONS,
  type Representation,
  RMU,
} from "./layer-fixture.ts";

export const TYPESCRIPT_INTERFACE_ADAPTER_SENSOR = "ddd-typescript-interface-adapter";

export const COMMAND_API_DIR = "packages/command/interface-adapter/billing-command-api";
const QUERY_API_DIR = "packages/query/interface-adapter/billing-query-api";
export const QUERY_USE_CASE_DIR = "packages/query/use-case/billing-query-use-case";

const QUERY_DAO: LayerPackage = {
  dir: "packages/query/interface-adapter/billing-query-dao",
  name: "@acme/billing-query-dao",
  files: { "src/index.ts": "export class Dao {}\n" },
};
const COMMAND_DAO: LayerPackage = {
  dir: "packages/command/interface-adapter/billing-command-dao",
  name: "@acme/billing-command-dao",
  files: { "src/index.ts": "export class Dao {}\n" },
};

/** The command-side API package with `source` as its entry. */
export function commandApi(source: string): LayerPackage {
  return { dir: COMMAND_API_DIR, name: "@acme/billing-command-api", files: { "src/index.ts": source } };
}

/** The query-side API package with `source` as its entry. */
function queryApi(source: string): LayerPackage {
  return { dir: QUERY_API_DIR, name: "@acme/billing-query-api", files: { "src/index.ts": source } };
}

/** The query-side use-case package with `source` as its entry. */
export function queryUseCase(source: string): LayerPackage {
  return { dir: QUERY_USE_CASE_DIR, name: "@acme/billing-query-use-case", files: { "src/index.ts": source } };
}

/** The rmu package with `source` as its entry. */
function rmu(source: string): LayerPackage {
  return { ...RMU, files: { "src/index.ts": source } };
}

const adapter = (source: string) => interfaceAdapterPackage({ "src/index.ts": source });

/**
 * Each Rust interface-adapter case whose scene a TypeScript case repeats, by name, with the
 * TypeScript case's name less its representation suffix: one TypeScript case per representation
 * answers for it.
 */
export const INTERFACE_ADAPTER_RUST_COUNTERPARTS: Readonly<Record<string, string>> = {
  "violation-k": "violation-k",
  "violation-k-reverse": "violation-k-reverse",
  "clean-rmu-bridge": "clean-rmu-bridge",
  "violation-l": "violation-l",
  "clean-query-dto": "clean-query-dto",
  "clean-repository": "clean-repository",
  "clean-storage-implementation-name": "clean-storage-implementation-name",
  "violation-m-media": "violation-m-media",
  "violation-n": "violation-n",
  "clean-restoration-constructor": "clean-restoration-factory",
  "clean-g-interface-adapter-to-infrastructure-use": "clean-g-interface-adapter-to-infrastructure-import",
  "clean-g-interface-adapter-to-infrastructure-cargo": "clean-g-interface-adapter-to-infrastructure-package-json",
  "violation-g-interface-adapter-to-rmu-use": "violation-g-interface-adapter-to-rmu",
  "clean-g-interface-adapter-external-io-use": "clean-g-interface-adapter-external-io",
};

type Scene = readonly [string, LayerPackage, readonly LayerPackage[], GoldenCase["expect"]];

const pass: GoldenCase["expect"] = { pass: true, rules: [] };
const fails = (rule: string): GoldenCase["expect"] => ({ pass: false, rules: [rule] });

/** Command / query cross-side references (k), type-only ones included. */
const CROSS_SIDE_SCENES: readonly Scene[] = [
  [
    "violation-k",
    commandApi('import { Dao } from "@acme/billing-query-dao";\n\nexport class CommandApi {}\n'),
    [QUERY_DAO],
    fails("k"),
  ],
  [
    "violation-k-type-only",
    commandApi('import type { Dao } from "@acme/billing-query-dao";\n\nexport class CommandApi {}\n'),
    [QUERY_DAO],
    fails("k"),
  ],
  [
    "violation-k-type-only-reexport",
    commandApi('export type { Dao } from "@acme/billing-query-dao";\n\nexport class CommandApi {}\n'),
    [QUERY_DAO],
    fails("k"),
  ],
  // The same import spelled only inside a comment and a string is no dependency.
  [
    "clean-k-commented-import",
    commandApi(
      '// import type { Dao } from "@acme/billing-query-dao";\nexport const note = \'import { Dao } from "@acme/billing-query-dao"\';\n\nexport class CommandApi {}\n',
    ),
    [QUERY_DAO],
    pass,
  ],
  // A dependency the package.json alone states crosses the sides as much as an import does.
  [
    "violation-k-package-json",
    {
      ...commandApi("export class CommandApi {}\n"),
      manifest: { dependencies: { "@acme/billing-query-dao": "0.1.0" } },
    },
    [QUERY_DAO],
    { pass: false, rules: ["k"], files: { k: `${COMMAND_API_DIR}/package.json` } },
  ],
  [
    "violation-k-reverse",
    queryApi('import { Dao } from "@acme/billing-command-dao";\n\nexport class QueryApi {}\n'),
    [COMMAND_DAO],
    fails("k"),
  ],
  // The rmu layer bridges the two sides.
  [
    "clean-rmu-bridge",
    rmu('import { Dao } from "@acme/billing-query-dao";\n\nexport class Projection {}\n'),
    [QUERY_DAO],
    pass,
  ],
];

/** Query-side references to a domain type or a repository port (l). */
const QUERY_SIDE_SCENES: readonly Scene[] = [
  [
    "violation-l",
    queryUseCase(
      'import { Invoice } from "@acme/billing-domain";\n\nexport function read(): Invoice | undefined {\n  return undefined;\n}\n',
    ),
    [],
    fails("l"),
  ],
  [
    "violation-l-type-only",
    queryUseCase(
      'import type { Invoice } from "@acme/billing-domain";\n\nexport function read(): Invoice | undefined {\n  return undefined;\n}\n',
    ),
    [],
    fails("l"),
  ],
  [
    "violation-l-repository",
    queryApi(
      'import type { InvoiceRepository } from "@acme/billing-domain";\n\nexport function read(repo: InvoiceRepository): void {}\n',
    ),
    [],
    fails("l"),
  ],
  // Re-exporting a domain type from the query side references it as importing it does.
  [
    "violation-l-reexport",
    queryApi('export { Invoice } from "@acme/billing-domain";\n\nexport class QueryApi {}\n'),
    [],
    fails("l"),
  ],
  [
    "clean-query-dto",
    queryUseCase(
      "export type InvoiceDto = { readonly id: string };\n\nexport function read(): InvoiceDto | undefined {\n  return undefined;\n}\n",
    ),
    [],
    pass,
  ],
];

/** Repository naming (m): the port carries the naming contract, an implementation may name its medium. */
const NAMING_SCENES: readonly Scene[] = [
  [
    "clean-repository",
    adapter(
      "export interface InvoiceRepository {}\n\nexport class InMemoryInvoiceRepository implements InvoiceRepository {}\n",
    ),
    [],
    pass,
  ],
  [
    "clean-storage-implementation-name",
    adapter(
      "export interface InvoiceRepository {}\n\nexport class PostgresInvoiceRepository implements InvoiceRepository {}\n",
    ),
    [],
    pass,
  ],
  ["violation-m-media", adapter("export interface DynamoDbInvoiceRepository {}\n"), [], fails("m")],
  [
    "violation-m-media-type-literal",
    adapter("export type DynamoDbInvoiceRepository = { remove(id: string): void };\n"),
    [],
    fails("m"),
  ],
  ["violation-m-aggregate-name", adapter("export interface CustomerRepository {}\n"), [], fails("m")],
  // An implementation may name its medium, but is still named after an aggregate.
  ["violation-m-implementation-name", adapter("export class PaymentRepository {}\n"), [], fails("m")],
];

/** Restoration bypass (n): an aggregate is restored through its own factory, not built around it. */
function restorationScenes(representation: Representation): Scene[] {
  const bypass =
    representation === "class"
      ? '  return new Invoice("x", 0);\n'
      : '  const restored: Invoice = { issue() {}, total() {\n    return 0;\n  }, id() {\n    return "x";\n  } };\n  return restored;\n';
  return [
    [
      "violation-n",
      adapter(`import { Invoice } from "@acme/billing-domain";\n\nexport function restore(): Invoice {\n${bypass}}\n`),
      [],
      fails("n"),
    ],
    [
      "violation-n-type-assertion",
      adapter(
        'import { Invoice } from "@acme/billing-domain";\n\nexport function restore(value: unknown): Invoice {\n  return value as Invoice;\n}\n',
      ),
      [],
      fails("n"),
    ],
    [
      "clean-restoration-factory",
      adapter(
        'import { Invoice } from "@acme/billing-domain";\n\nexport function restore(): Invoice {\n  return Invoice.open("x", 0);\n}\n',
      ),
      [],
      pass,
    ],
  ];
}

const ADAPTER_PACKAGE_JSON = "packages/interface-adapter/billing-interface-adapter/package.json";

/** Dependency direction (g): an adapter may reach infrastructure and I/O, not the rmu layer. */
const DEPENDENCY_SCENES: readonly Scene[] = [
  [
    "clean-g-interface-adapter-to-infrastructure-import",
    adapter('import { Clock } from "@acme/billing-infrastructure";\n\nexport class Adapter {}\n'),
    [INFRASTRUCTURE],
    pass,
  ],
  [
    "clean-g-interface-adapter-to-infrastructure-package-json",
    interfaceAdapterPackage(
      { "src/index.ts": "export class Adapter {}\n" },
      { dependencies: { "@acme/billing-infrastructure": "0.1.0" } },
    ),
    [INFRASTRUCTURE],
    pass,
  ],
  [
    "clean-g-interface-adapter-external-io",
    adapter('import { MongoClient } from "mongodb";\n\nexport class Adapter {}\n'),
    [],
    pass,
  ],
  [
    "violation-g-interface-adapter-to-rmu",
    adapter('import { Projection } from "@acme/billing-rmu";\n\nexport class Adapter {}\n'),
    [RMU],
    fails("g"),
  ],
  [
    "violation-g-interface-adapter-type-only",
    adapter('import type { Projection } from "@acme/billing-rmu";\n\nexport class Adapter {}\n'),
    [RMU],
    fails("g"),
  ],
  [
    "violation-g-interface-adapter-package-json",
    interfaceAdapterPackage(
      { "src/index.ts": "export class Adapter {}\n" },
      { dependencies: { "@acme/billing-rmu": "0.1.0" } },
    ),
    [RMU],
    { pass: false, rules: ["g"], files: { g: ADAPTER_PACKAGE_JSON } },
  ],
];

function interfaceAdapterCases(representation: Representation): GoldenCase[] {
  return [
    ...CROSS_SIDE_SCENES,
    ...QUERY_SIDE_SCENES,
    ...NAMING_SCENES,
    ...restorationScenes(representation),
    ...DEPENDENCY_SCENES,
  ].map(([name, pkg, others, expect]) =>
    layerCase(TYPESCRIPT_INTERFACE_ADAPTER_SENSOR, representation, name, { pkg, others }, expect),
  );
}

export const TYPESCRIPT_INTERFACE_ADAPTER_CASES: GoldenCase[] = REPRESENTATIONS.flatMap(interfaceAdapterCases);
