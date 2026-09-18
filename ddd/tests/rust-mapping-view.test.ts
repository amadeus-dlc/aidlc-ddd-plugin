/**
 * The Rust view of the implementation mapping: what the current Rust source sensors receive.
 *
 * The mapping is language-neutral and may place some aggregates and packages in TypeScript. The
 * Rust sensors bind Rust types and modules only, so the view keeps the Rust entries, spells their
 * location the way those sensors compare it — a crate name and the module path below its root — and
 * leaves every other language out. A record whose mapping cannot be read yields no view at all.
 */

import { expect, test } from "bun:test";
import { join } from "node:path";
import { loadAggregateMapping } from "../tools/ddd/lib/aggregate-mapping/index.ts";
import { loadRustMapping } from "../tools/ddd/lib/rules/rust/mapping.ts";
import {
  legacyMappingYaml,
  MAPPING_IN_RECORD,
  type MappingSource,
  mappingDocument,
  mappingSource,
  RECORD_DIR,
  recordFiles,
  renderYaml,
} from "./fixtures/aggregate-mapping/workspace.ts";
import { withWorkspace } from "./fixtures/domain-model/workspace.ts";

type RustMapping = ReturnType<typeof loadRustMapping>;
type LoadedView = Extract<RustMapping, { kind: "loaded" }>;

const TYPESCRIPT_PACKAGE = "@acme/billing-domain";

/**
 * One mapping with both languages: the invoice aggregate and its packages in Rust, a Rust package
 * spelled with a raw identifier, and the payment aggregate with its packages in TypeScript.
 */
function mixedSource(): MappingSource {
  const source = mappingSource("rust");
  const payment = source.aggregate_mappings[1];
  payment.code = { ...payment.code, language: "typescript", package: TYPESCRIPT_PACKAGE, module: ["payment"] };
  const typescript = (module: string[]) => ({ language: "typescript", package: TYPESCRIPT_PACKAGE, module });
  source.domain_packages = [
    ...source.domain_packages.filter((entry) => entry.term !== "入金"),
    { term: "請求種別", model_refs: ["bc.billing"], rationale: "請求の種別を区別する", code: rustAt(["r#type"]) },
    { term: "請求（画面）", model_refs: ["bc.billing"], rationale: "請求の画面側を所有する", code: typescript([]) },
    {
      term: "入金",
      model_refs: ["aggregate.payment"],
      rationale: "入金の消し込みを扱う",
      code: typescript(["payment"]),
    },
  ];
  return source;
}

function rustAt(module: string[]): { language: string; package: string; module: string[] } {
  return { language: "rust", package: "billing-domain", module };
}

function viewOf(source: MappingSource): LoadedView {
  return withWorkspace(recordFiles(mappingDocument(renderYaml(source))), (root) => {
    // The fixture itself has to be a mapping the gates accept, or nothing below says anything.
    const read = loadAggregateMapping(join(root, MAPPING_IN_RECORD));
    if (!read.ok) throw new Error(`the mixed-language fixture does not load: ${JSON.stringify(read.findings)}`);
    const loaded = loadRustMapping(join(root, RECORD_DIR));
    if (loaded.kind !== "loaded") throw new Error(`expected a Rust view, got ${JSON.stringify(loaded)}`);
    return loaded;
  });
}

function aggregatesOf(loaded: LoadedView) {
  return loaded.view.aggregates.map((entry) => ({
    aggregate_ref: entry.aggregate_ref,
    persistence_method: entry.persistence_method,
    crate: entry.crate,
    module: entry.module,
    replay_methods: entry.replay_methods.map((replay) => ({ method: replay.method, event_ref: replay.event_ref })),
  }));
}

function packagesOf(loaded: LoadedView) {
  return loaded.view.packages.map((entry) => ({ crate: entry.crate, module: entry.module }));
}

test("a Rust aggregate reaches the Rust sensors with its crate, its module path and its replay methods", () => {
  expect(aggregatesOf(viewOf(mixedSource()))).toEqual([
    {
      aggregate_ref: "aggregate.invoice",
      persistence_method: "event-sourcing",
      crate: "billing-domain",
      module: ["invoice"],
      replay_methods: [{ method: "apply_issued", event_ref: "event.invoice.issued" }],
    },
  ]);
});

test("every Rust package reaches the Rust sensors, the raw identifier spelled as written", () => {
  expect(packagesOf(viewOf(mixedSource()))).toEqual([
    { crate: "billing-domain", module: [] },
    { crate: "billing-domain", module: ["invoice"] },
    { crate: "billing-domain", module: ["invoice", "invoice_line"] },
    { crate: "billing-domain", module: ["r#type"] },
  ]);
});

test("nothing placed in TypeScript is handed to the Rust sensors", () => {
  const loaded = viewOf(mixedSource());
  for (const entry of loaded.view.aggregates) {
    expect(entry.aggregate_ref).not.toBe("aggregate.payment");
    expect(entry.crate).not.toBe(TYPESCRIPT_PACKAGE);
  }
  for (const entry of loaded.view.packages) expect(entry.crate).not.toBe(TYPESCRIPT_PACKAGE);
});

test("a record without a mapping has no view, and says so", () => {
  const files = recordFiles(mappingDocument(renderYaml(mappingSource("rust"))));
  delete files[MAPPING_IN_RECORD];
  withWorkspace(files, (root) => {
    expect(loadRustMapping(join(root, RECORD_DIR))).toEqual({ kind: "absent" });
  });
});

for (const [label, files, rule] of [
  ["a legacy crate/module mapping", recordFiles(mappingDocument(legacyMappingYaml())), "aggregate-mapping.version"],
  [
    "a mapping whose model is still in the legacy format",
    recordFiles(mappingDocument(renderYaml(mappingSource("rust"))), { modelVersion: 1 }),
    "aggregate-mapping.model",
  ],
  [
    "a mapping that leaves an aggregate of the model unmapped",
    (() => {
      const source = mappingSource("rust");
      source.aggregate_mappings.splice(1, 1);
      return recordFiles(mappingDocument(renderYaml(source)));
    })(),
    "aggregate-mapping.coverage",
  ],
] as const)
  test(`${label} has no view; the reader's findings say why`, () => {
    withWorkspace(files, (root) => {
      const loaded = loadRustMapping(join(root, RECORD_DIR));
      expect(loaded.kind).toBe("invalid");
      if (loaded.kind !== "invalid") return;
      expect(loaded.findings.map((entry) => entry.rule_id)).toContain(rule);
    });
  });
