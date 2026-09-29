/**
 * What the TypeScript use-case and interface-adapter golden cases (T-11-03) share: the domain
 * package they depend on, written in each representation the domain gate decides on, the packages
 * of the other layers, and the builder that turns one claimed source of one layer into a case.
 *
 * The domain package holds the aggregate `Invoice` (a `class` or a companion, each with the getters
 * `id` and `total` and the factory `open`) and the value object `Amount`, so every rule of both gates
 * has a domain type to be decided on. It declares no port: the repository port `InvoiceRepository`
 * belongs to the use-case layer, and a use-case case that needs it declares it there.
 */

import type { GoldenCase } from "../runner.ts";
import { CLASS_WITH_ID_GETTER, COMPANION_WITH_ID_GETTER, tsCase } from "./cases.ts";

export type Representation = "class" | "companion";
export const REPRESENTATIONS: readonly Representation[] = ["class", "companion"];

/** A TypeScript package of the case's workspace, besides the domain package. */
export interface LayerPackage {
  readonly dir: string;
  readonly name: string;
  /** Package-relative path -> content. */
  readonly files: Readonly<Record<string, string>>;
  /** Fields merged over the default `package.json`. */
  readonly manifest?: Readonly<Record<string, unknown>>;
}

/** The aggregate source of each representation, as `src/invoice.ts` of the domain package. */
const DOMAIN_SOURCE: Readonly<Record<Representation, string>> = {
  class: CLASS_WITH_ID_GETTER,
  companion: COMPANION_WITH_ID_GETTER,
};

const DOMAIN_FILES = {
  "src/index.ts": 'export { Invoice } from "./invoice.ts";\nexport { Amount } from "./amount.ts";\n',
  "src/amount.ts":
    "export class Amount {\n  #value: number;\n\n  constructor(value: number) {\n    this.#value = value;\n  }\n}\n",
};

export const USE_CASE_DIR = "packages/use-case/billing-use-case";
export const INTERFACE_ADAPTER_DIR = "packages/interface-adapter/billing-interface-adapter";

export const INFRASTRUCTURE: LayerPackage = {
  dir: "packages/infrastructure/billing-infrastructure",
  name: "@acme/billing-infrastructure",
  files: { "src/index.ts": "export class Clock {}\n" },
};
export const INTERFACE_ADAPTER: LayerPackage = {
  dir: INTERFACE_ADAPTER_DIR,
  name: "@acme/billing-interface-adapter",
  files: { "src/index.ts": "export class Adapter {}\n" },
};
export const RMU: LayerPackage = {
  dir: "packages/rmu/billing-rmu",
  name: "@acme/billing-rmu",
  files: { "src/index.ts": "export class Projection {}\n" },
};

/** The use-case package with `files` as its sources. */
export function useCasePackage(
  files: Readonly<Record<string, string>>,
  manifest?: Readonly<Record<string, unknown>>,
): LayerPackage {
  return { dir: USE_CASE_DIR, name: "@acme/billing-use-case", files, ...(manifest ? { manifest } : {}) };
}

/** The interface-adapter package with `files` as its sources. */
export function interfaceAdapterPackage(
  files: Readonly<Record<string, string>>,
  manifest?: Readonly<Record<string, unknown>>,
): LayerPackage {
  return { ...INTERFACE_ADAPTER, files, ...(manifest ? { manifest } : {}) };
}

interface LayerOptions {
  /** The package the claimed source is in. */
  readonly pkg: LayerPackage;
  /** The package-relative source claimed; `src/index.ts` by default. */
  readonly claim?: string;
  /** Packages of the workspace besides the domain package and `pkg`. */
  readonly others?: readonly LayerPackage[];
  readonly state?: string;
}

/**
 * A code-generation gate case of `sensor` over one claimed source of `options.pkg`, beside the domain
 * package written in `representation`. The case is named `<name>-<representation>`, and each expected
 * rule is reported on the claimed source unless `expect.files` names another file.
 */
export function layerCase(
  sensor: string,
  representation: Representation,
  name: string,
  options: LayerOptions,
  expect: GoldenCase["expect"],
): GoldenCase {
  const claim = `${options.pkg.dir}/${options.claim ?? "src/index.ts"}`;
  const files: Record<string, string> = {};
  for (const rule of expect.rules) files[rule] = claim;
  const built = tsCase(
    `${name}-${representation}`,
    {
      files: { ...DOMAIN_FILES, "src/invoice.ts": DOMAIN_SOURCE[representation] },
      modules: [["amount"]],
      others: [options.pkg, ...(options.others ?? [])],
      claims: [claim],
      ...(options.state ? { state: options.state } : {}),
    },
    { ...expect, files: { ...files, ...expect.files } },
  );
  return { ...built, sensor };
}
