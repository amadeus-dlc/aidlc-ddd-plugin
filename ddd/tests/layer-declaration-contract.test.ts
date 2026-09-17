/**
 * The language-neutral layer declaration (schema_version 2): what one `cicd-pipeline.md` may say,
 * what the loader refuses before any layer rule is applied, and what the structural inspection
 * makes of a declaration that loaded.
 *
 * Every case is a whole document inside a real intent record, because a package is identified by
 * the language that spells it as well as by its name, and every business reference is decided by
 * the canonical model the document names. The use-case declaration in the same record is read
 * here too: it is already language-neutral, and this suite is where that stays true.
 */

import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { inspectLayerDeclaration, loadLayerDeclaration } from "../tools/ddd/lib/layer-declaration/index.ts";
import { loadDomainModel, OPERATION_OWNED_SCHEMA_VERSION } from "../tools/ddd/lib/schema/loader.ts";
import { parseDeclaration, resolveModelPath } from "../tools/ddd/lib/sensors/declaration.ts";
import { readYamlBlock } from "../tools/ddd/lib/shared/markdown-yaml.ts";
import { withWorkspace } from "./fixtures/domain-model/workspace.ts";
import {
  DECLARATION_IN_RECORD,
  declarationDocument,
  declarationDocumentInJapanese,
  declarationDocumentWithBothHeadings,
  declarationDocumentWithDecoratedInfoString,
  declarationDocumentWithNestedBlockOnly,
  declarationDocumentWithoutBlock,
  declarationDocumentWithoutSection,
  declarationDocumentWithTwoBlocks,
  declarationDocumentWithUnclosedBlock,
  identityOf,
  LANGUAGE_SPELLED_KEYS,
  type LayerLanguage,
  type LayerSource,
  layerSource,
  legacyLayerYaml,
  OTHER_RECORD_DIR,
  type PackageIdentitySource,
  packageNameOf,
  RECORD_DIR,
  recordFiles,
  renderYaml,
  structureOf,
  USE_CASE_HEADINGS,
  USE_CASE_IN_RECORD,
  USE_CASE_KEYS,
  useCaseSource,
} from "./fixtures/layer-declaration/workspace.ts";

type LoadOutcome = ReturnType<typeof loadLayerDeclaration>;
type LoadedDeclaration = Extract<LoadOutcome, { ok: true }>["declaration"];

const RULE = {
  document: "layer-declaration.document",
  version: "layer-declaration.version",
  structure: "layer-declaration.structure",
  unknownKey: "layer-declaration.unknown-key",
  model: "layer-declaration.model",
  reference: "layer-declaration.reference",
  duplicate: "layer-declaration.duplicate",
  coverage: "layer-declaration.coverage",
  requiredItems: "layer-declaration.required-items",
  dependencyRow: "layer-declaration.dependency-row",
  cqrsSides: "layer-declaration.cqrs-sides",
  sideDependency: "layer-declaration.side-dependency",
  queryDomainDependency: "layer-declaration.query-domain-dependency",
  restorationPath: "layer-declaration.restoration-path",
} as const;

function loadMarkdown(markdown: string, modelVersion: 1 | 2 = 2): LoadOutcome {
  return withWorkspace(recordFiles(markdown, { modelVersion }), (root) =>
    loadLayerDeclaration(join(root, DECLARATION_IN_RECORD)),
  );
}

function loadSource(source: LayerSource, modelVersion: 1 | 2 = 2): LoadOutcome {
  return loadMarkdown(declarationDocument(renderYaml(source)), modelVersion);
}

/** A fresh declaration for `language`, edited by `change` before it is written. */
function variant(language: LayerLanguage, change: (source: LayerSource) => void): LayerSource {
  const source = layerSource(language);
  change(source);
  return source;
}

/** Lets a case put a value of the wrong shape, or a key the format does not have, into a document. */
function loose(value: object): Record<string, unknown> {
  return value as Record<string, unknown>;
}

function declarationOf(outcome: LoadOutcome): LoadedDeclaration {
  if (!outcome.ok) throw new Error(`expected the declaration to load: ${JSON.stringify(outcome.findings)}`);
  return outcome.declaration;
}

function rulesOf(outcome: LoadOutcome): string[] {
  if (outcome.ok) throw new Error("expected the declaration to be refused");
  expect(outcome.findings.length).toBeGreaterThan(0);
  return outcome.findings.map((entry) => entry.rule_id);
}

/** Refused, and every finding names `rule`: the document carries no other defect. */
function expectRefusedOnlyBy(outcome: LoadOutcome, rule: string): void {
  expect(new Set(rulesOf(outcome))).toEqual(new Set([rule]));
}

/** A package is the language that spells it together with its name, never the name on its own. */
function identityKey(identity: { language: string; package: string }): string {
  return JSON.stringify([identity.language, identity.package]);
}

/**
 * The dependency regime a declaration states, with every package identity replaced by the role and
 * position it holds. Two declarations of one model share this even when the languages that spell
 * their packages do not.
 */
function regimeOf(declaration: LoadedDeclaration) {
  return declaration.layer_structures.map((structure) => {
    const slots = new Map(
      structure.packages.map((entry, index) => [identityKey(entry.code), `${entry.role}#${index}`]),
    );
    const slotOf = (identity: { language: string; package: string }): string => {
      const slot = slots.get(identityKey(identity));
      if (slot === undefined) throw new Error(`a dependency names a package the declaration does not declare`);
      return slot;
    };
    return {
      context_ref: structure.context_ref,
      cqrs: structure.cqrs,
      roles: structure.packages.map((entry) => entry.role),
      dependencies: structure.dependencies.map((row) => ({
        from: slotOf(row.code),
        to: row.depends_on.map(slotOf),
      })),
      ports: structure.ports,
      repositories: structure.repositories,
      restoration_paths: structure.restoration_paths,
      persistence_backend: structure.persistence_backend,
    };
  });
}

/** Loads a declaration, then runs the structural inspection on that result and on nothing else. */
function inspect(source: LayerSource): string[] {
  return withWorkspace(recordFiles(declarationDocument(renderYaml(source))), (root) => {
    const path = join(root, DECLARATION_IN_RECORD);
    const loaded = loadLayerDeclaration(path);
    if (!loaded.ok) throw new Error(`expected the declaration to load: ${JSON.stringify(loaded.findings)}`);
    const findings = inspectLayerDeclaration(loaded.declaration, loaded.model, path);
    expect(findings.every((entry) => entry.file === path)).toBe(true);
    return findings.map((entry) => entry.rule_id);
  });
}

// ---------------------------------------------------------------------------
// What a valid document carries
// ---------------------------------------------------------------------------

test("a schema_version 2 document loads with the canonical model it names", () => {
  const outcome = loadSource(layerSource("rust"));
  expect(outcome.ok).toBe(true);
  if (!outcome.ok) return;
  expect(outcome.declaration.schema_version).toBe(2);
  expect(outcome.index.resolve("bc.billing", "bc").ok).toBe(true);
  expect(outcome.index.resolve("aggregate.invoice", "aggregate").ok).toBe(true);
});

test("a loaded declaration keeps the roles, the dependency edges, the ports, the repositories and the restoration paths", () => {
  const source = layerSource("rust");
  expect(declarationOf(loadSource(source))).toEqual(source as unknown as LoadedDeclaration);
});

test("a Rust declaration and a TypeScript declaration of one model state the same dependency regime", () => {
  withWorkspace(
    {
      ...recordFiles(declarationDocument(renderYaml(layerSource("rust")))),
      ...recordFiles(declarationDocument(renderYaml(layerSource("typescript"))), { record: OTHER_RECORD_DIR }),
    },
    (root) => {
      const rust = declarationOf(loadLayerDeclaration(join(root, DECLARATION_IN_RECORD)));
      const typescript = declarationOf(
        loadLayerDeclaration(join(root, DECLARATION_IN_RECORD.replace(RECORD_DIR, OTHER_RECORD_DIR))),
      );

      expect(regimeOf(rust)).toEqual(regimeOf(typescript));

      // Only the package identities differ, and each says which language spells it.
      const identitiesOf = (declaration: LoadedDeclaration): PackageIdentitySource[] =>
        structureOf(declaration as unknown as LayerSource).packages.map((entry) => entry.code);
      expect(identitiesOf(rust)).toEqual([
        identityOf("rust", "command"),
        identityOf("rust", "query"),
        identityOf("rust", "rmu"),
      ]);
      expect(identitiesOf(typescript)).toEqual([
        identityOf("typescript", "command"),
        identityOf("typescript", "query"),
        identityOf("typescript", "rmu"),
      ]);
    },
  );
});

test("two packages that share a name are one package only when they share a language", () => {
  const acrossLanguages = variant("rust", (source) => {
    const structure = structureOf(source);
    const foreign: PackageIdentitySource = { language: "typescript", package: packageNameOf("rust", "command") };
    structure.packages[1].code = foreign;
    structure.dependencies[1].code = { ...foreign };
    structure.dependencies[2].depends_on[1] = { ...foreign };
  });
  const loaded = declarationOf(loadSource(acrossLanguages));
  expect(structureOf(loaded as unknown as LayerSource).packages.map((entry) => entry.code)).toEqual([
    identityOf("rust", "command"),
    { language: "typescript", package: packageNameOf("rust", "command") },
    identityOf("rust", "rmu"),
  ]);

  const withinOneLanguage = variant("rust", (source) => {
    const structure = structureOf(source);
    structure.packages[1].code = identityOf("rust", "command");
    structure.dependencies[1].code = identityOf("rust", "command");
    structure.dependencies[2].depends_on[1] = identityOf("rust", "command");
  });
  expectRefusedOnlyBy(loadSource(withinOneLanguage), RULE.duplicate);
});

test("a verb list is empty only when the document says so", () => {
  const stated = variant("rust", (source) => {
    structureOf(source).ports[0].verbs = [];
  });
  expect(structureOf(declarationOf(loadSource(stated)) as unknown as LayerSource).ports[0].verbs).toEqual([]);

  const unstated = variant("rust", (source) => {
    delete loose(structureOf(source).ports[0]).verbs;
  });
  expectRefusedOnlyBy(loadSource(unstated), RULE.structure);
});

// ---------------------------------------------------------------------------
// Version, document and the canonical model
// ---------------------------------------------------------------------------

test("a crate-fixed schema_version 1 declaration is not read as the new format, and the finding points to the migration", () => {
  const outcome = loadMarkdown(declarationDocument(legacyLayerYaml()));
  expect(rulesOf(outcome)).toEqual([RULE.version]);
  if (outcome.ok) return;
  expect(outcome.findings[0].message).toContain("migrate");
});

for (const [label, version] of [
  ["a quoted version", "2"],
  ["a later version", 3],
  ["no version at all", undefined],
] as const)
  test(`a document with ${label} is refused with one version finding`, () => {
    const source = variant("rust", (draft) => {
      if (version === undefined) delete draft.schema_version;
      else draft.schema_version = version;
    });
    expect(rulesOf(loadSource(source))).toEqual([RULE.version]);
  });

const VALID_YAML = () => renderYaml(layerSource("rust"));

test("the Japanese section marker names the same single declaration", () => {
  expect(loadMarkdown(declarationDocumentInJapanese(VALID_YAML())).ok).toBe(true);
});

for (const [label, markdown] of [
  ["carries no labelled YAML block in the section", () => declarationDocumentWithoutBlock()],
  ["carries two labelled YAML blocks in the section", () => declarationDocumentWithTwoBlocks(VALID_YAML())],
  ["never closes its YAML block", () => declarationDocumentWithUnclosedBlock(VALID_YAML())],
  ["labels its block with more than the language", () => declarationDocumentWithDecoratedInfoString(VALID_YAML())],
  ["only nests a declaration-shaped block inside prose", () => declarationDocumentWithNestedBlockOnly()],
  ["has no DDD layer section at all", () => declarationDocumentWithoutSection(VALID_YAML())],
  ["carries both section markers at once", () => declarationDocumentWithBothHeadings(VALID_YAML())],
  ["carries YAML that does not parse", () => declarationDocument("layer_structures:\n  - [")],
  ["carries a YAML list instead of a mapping", () => declarationDocument("- schema_version: 2")],
] as const)
  test(`a document that ${label} is refused as a document`, () => {
    withWorkspace(recordFiles(markdown()), (root) => {
      const path = join(root, DECLARATION_IN_RECORD);
      const outcome = loadLayerDeclaration(path);
      expectRefusedOnlyBy(outcome, RULE.document);
      if (outcome.ok) return;
      expect(outcome.findings.every((entry) => entry.file === path)).toBe(true);
    });
  });

for (const [label, relative] of [
  ["a record with no pipeline document", null],
  ["a pipeline-named file at the record root", `${RECORD_DIR}/cicd-pipeline.md`],
  ["a pipeline-named file under another stage", `${RECORD_DIR}/construction/u1/functional-design/cicd-pipeline.md`],
  [
    "a pipeline-named file outside the construction phase",
    `${RECORD_DIR}/inception/infrastructure-design/cicd-pipeline.md`,
  ],
  [
    "another file name in the infrastructure-design stage",
    `${RECORD_DIR}/construction/u1/infrastructure-design/ci-pipeline.md`,
  ],
] as const)
  test(`${label} is not a registered layer declaration`, () => {
    const files = recordFiles(declarationDocument(VALID_YAML()));
    const target = relative ?? DECLARATION_IN_RECORD;
    if (relative === null) delete files[DECLARATION_IN_RECORD];
    else files[relative] = declarationDocument(VALID_YAML());
    withWorkspace(files, (root) => {
      expectRefusedOnlyBy(loadLayerDeclaration(join(root, target)), RULE.document);
    });
  });

test("a declaration whose canonical model has not been migrated yet is refused against the model", () => {
  expectRefusedOnlyBy(loadSource(layerSource("rust"), 1), RULE.model);
});

test("a declaration whose model_ref names nothing is refused against the model", () => {
  const source = variant("rust", (draft) => {
    draft.model_ref = "inception/ddd-domain-modeling/absent-model.md";
  });
  expectRefusedOnlyBy(loadSource(source), RULE.model);
});

// ---------------------------------------------------------------------------
// The closed key set: nothing a crate-fixed document spelled survives unnoticed
// ---------------------------------------------------------------------------

const UNKNOWN_KEYS: readonly (readonly [string, (source: LayerSource) => void])[] = [
  [
    "an aggregate mapping at the root",
    (s) => {
      loose(s).aggregate_mappings = [];
    },
  ],
  [
    "a domain package list at the root",
    (s) => {
      loose(s).domain_packages = [];
    },
  ],
  [
    "the crate-fixed command side list",
    (s) => {
      loose(structureOf(s)).command_side_crates = ["billing-domain"];
    },
  ],
  [
    "the crate-fixed query side list",
    (s) => {
      loose(structureOf(s)).query_side_crates = ["billing-query"];
    },
  ],
  [
    "the crate-fixed read-model updater list",
    (s) => {
      loose(structureOf(s)).rmu_crates = ["billing-rmu"];
    },
  ],
  [
    "the crate-fixed dependency list",
    (s) => {
      loose(structureOf(s)).crate_dependencies = [{ crate: "billing-domain", depends_on: [] }];
    },
  ],
  [
    "an owning team beside the context",
    (s) => {
      loose(structureOf(s)).owner_team = "請求チーム";
    },
  ],
  [
    "a legacy crate beside a package's role",
    (s) => {
      loose(structureOf(s).packages[0]).crate = "billing-domain";
    },
  ],
  [
    "a module path inside a package identity",
    (s) => {
      loose(structureOf(s).packages[0].code).module = ["invoice"];
    },
  ],
  [
    "a package version inside a package identity",
    (s) => {
      loose(structureOf(s).packages[0].code).version = "0.1.0";
    },
  ],
  [
    "a legacy crate beside a dependency row",
    (s) => {
      loose(structureOf(s).dependencies[0]).crate = "billing-domain";
    },
  ],
  [
    "a module path inside a dependency target",
    (s) => {
      loose(structureOf(s).dependencies[2].depends_on[0]).module = [];
    },
  ],
  [
    "a version marker on a port",
    (s) => {
      loose(structureOf(s).ports[0]).since = "v2";
    },
  ],
  [
    "a storage table on a repository",
    (s) => {
      loose(structureOf(s).repositories[0]).table = "invoices";
    },
  ],
  [
    "a source file on a restoration path",
    (s) => {
      loose(structureOf(s).restoration_paths[0]).file = "src/invoice.rs";
    },
  ],
];

for (const [label, change] of UNKNOWN_KEYS)
  test(`${label} is an unknown key`, () => {
    expectRefusedOnlyBy(loadSource(variant("rust", change)), RULE.unknownKey);
  });

// ---------------------------------------------------------------------------
// Shape: nothing is coerced, defaulted or dropped
// ---------------------------------------------------------------------------

const STRUCTURE_VIOLATIONS: readonly (readonly [string, LayerLanguage, (source: LayerSource) => void])[] = [
  [
    "a package identity without a language",
    "rust",
    (s) => {
      delete loose(structureOf(s).packages[0].code).language;
    },
  ],
  [
    "a package identity without a name",
    "rust",
    (s) => {
      delete loose(structureOf(s).packages[0].code).package;
    },
  ],
  [
    "a language outside the supported set",
    "rust",
    (s) => {
      structureOf(s).packages[0].code.language = "python";
    },
  ],
  [
    "a dependency target without a language",
    "rust",
    (s) => {
      delete loose(structureOf(s).dependencies[2].depends_on[0]).language;
    },
  ],
  [
    "a Rust package name with a space",
    "rust",
    (s) => {
      structureOf(s).packages[0].code.package = "billing domain";
    },
  ],
  [
    "a Rust package name with a version",
    "rust",
    (s) => {
      structureOf(s).packages[0].code.package = "billing-domain@0.1.0";
    },
  ],
  [
    "a TypeScript package name npm cannot name",
    "typescript",
    (s) => {
      structureOf(s).packages[0].code.package = "@Acme/Billing-Domain";
    },
  ],
  [
    "a package identity written as a bare name",
    "rust",
    (s) => {
      loose(structureOf(s).packages[0]).code = "billing-domain";
    },
  ],
  [
    "a dependency target written as a bare name",
    "rust",
    (s) => {
      loose(structureOf(s).dependencies[2]).depends_on = ["billing-domain"];
    },
  ],
  [
    "a role outside command, query and rmu",
    "rust",
    (s) => {
      structureOf(s).packages[0].role = "infrastructure";
    },
  ],
  [
    "a cqrs flag written as a string",
    "rust",
    (s) => {
      loose(structureOf(s)).cqrs = "true";
    },
  ],
  [
    "no cqrs flag at all",
    "rust",
    (s) => {
      delete loose(structureOf(s)).cqrs;
    },
  ],
  [
    "a port kind outside the classification set",
    "rust",
    (s) => {
      structureOf(s).ports[0].kind = "adapter";
    },
  ],
  [
    "port verbs written as one string",
    "rust",
    (s) => {
      loose(structureOf(s).ports[0]).verbs = "next_number";
    },
  ],
  [
    "an io unit outside the set",
    "rust",
    (s) => {
      structureOf(s).repositories[0].io_unit = "streaming";
    },
  ],
  [
    "store semantics outside the set",
    "rust",
    (s) => {
      structureOf(s).repositories[0].store_semantics = "append";
    },
  ],
  [
    "a restoration route outside the set",
    "rust",
    (s) => {
      structureOf(s).restoration_paths[0].via = "snapshot";
    },
  ],
  [
    "an empty repository name",
    "rust",
    (s) => {
      structureOf(s).repositories[0].name = "";
    },
  ],
  [
    "an empty persistence backend",
    "rust",
    (s) => {
      structureOf(s).persistence_backend = "";
    },
  ],
  [
    "no model reference",
    "rust",
    (s) => {
      delete s.model_ref;
    },
  ],
  [
    "no layer structures",
    "rust",
    (s) => {
      delete loose(s).layer_structures;
    },
  ],
  [
    "layer structures written as a mapping",
    "rust",
    (s) => {
      loose(s).layer_structures = { "bc.billing": {} };
    },
  ],
  [
    "no package list",
    "rust",
    (s) => {
      delete loose(structureOf(s)).packages;
    },
  ],
  [
    "no dependency list",
    "rust",
    (s) => {
      delete loose(structureOf(s)).dependencies;
    },
  ],
  [
    "no restoration path list",
    "rust",
    (s) => {
      delete loose(structureOf(s)).restoration_paths;
    },
  ],
];

for (const [label, language, change] of STRUCTURE_VIOLATIONS)
  test(`${label} is refused by the shape`, () => {
    expectRefusedOnlyBy(loadSource(variant(language, change)), RULE.structure);
  });

// ---------------------------------------------------------------------------
// Duplicates and coverage
// ---------------------------------------------------------------------------

const DUPLICATES: readonly (readonly [string, (source: LayerSource) => void])[] = [
  [
    "one package identity declared under two roles",
    (s) => {
      structureOf(s).packages.push({ role: "query", code: identityOf("rust", "command") });
    },
  ],
  [
    "two dependency rows for one package",
    (s) => {
      structureOf(s).dependencies.push({ code: identityOf("rust", "command"), depends_on: [] });
    },
  ],
  [
    "one package named twice inside one dependency row",
    (s) => {
      structureOf(s).dependencies[2].depends_on.push(identityOf("rust", "command"));
    },
  ],
  [
    "two structures for one context",
    (s) => {
      s.layer_structures.push(structuredClone(structureOf(s)));
    },
  ],
  [
    "two restoration paths for one aggregate",
    (s) => {
      structureOf(s).restoration_paths.push({ aggregate_ref: "aggregate.invoice", via: "other" });
    },
  ],
  [
    "two ports under one name",
    (s) => {
      structureOf(s).ports.push({ name: "InvoiceNumbering", kind: "repository", verbs: [] });
    },
  ],
  [
    "two repositories under one name",
    (s) => {
      structureOf(s).repositories.push(structuredClone(structureOf(s).repositories[0]));
    },
  ],
];

for (const [label, change] of DUPLICATES)
  test(`${label} is a duplicate`, () => {
    expectRefusedOnlyBy(loadSource(variant("rust", change)), RULE.duplicate);
  });

const UNDECLARED: PackageIdentitySource = { language: "rust", package: "billing-reporting" };

test("a dependency on a package the declaration never declares is kept as an edge", () => {
  const source = variant("rust", (s) => {
    structureOf(s).dependencies[2].depends_on.push({ ...UNDECLARED });
  });
  expect(declarationOf(loadSource(source))).toEqual(source as unknown as LoadedDeclaration);
});

const COVERAGE_GAPS: readonly (readonly [string, (source: LayerSource) => void])[] = [
  [
    "a dependency row for a package the declaration never declares",
    (s) => {
      structureOf(s).dependencies.push({ code: { ...UNDECLARED }, depends_on: [] });
    },
  ],
];

for (const [label, change] of COVERAGE_GAPS)
  test(`${label} is a coverage gap`, () => {
    expectRefusedOnlyBy(loadSource(variant("rust", change)), RULE.coverage);
  });

// ---------------------------------------------------------------------------
// Business references
// ---------------------------------------------------------------------------

const BROKEN_REFERENCES: readonly (readonly [string, (source: LayerSource) => void])[] = [
  [
    "a context the model does not define",
    (s) => {
      structureOf(s).context_ref = "bc.shipping";
    },
  ],
  [
    "a context reference that names an aggregate",
    (s) => {
      structureOf(s).context_ref = "aggregate.invoice";
    },
  ],
  [
    "a context reference that is not a model element id",
    (s) => {
      structureOf(s).context_ref = "billing";
    },
  ],
  [
    "a repository for an aggregate the model does not define",
    (s) => {
      structureOf(s).repositories[0].aggregate_ref = "aggregate.refund";
    },
  ],
  [
    "a repository for an aggregate the lineage retired",
    (s) => {
      structureOf(s).repositories[0].aggregate_ref = "aggregate.ledger";
    },
  ],
  [
    "a repository whose aggregate reference names an entity",
    (s) => {
      structureOf(s).repositories[0].aggregate_ref = "entity.invoice";
    },
  ],
  [
    "a restoration path for an aggregate the model does not define",
    (s) => {
      structureOf(s).restoration_paths[0].aggregate_ref = "aggregate.refund";
    },
  ],
  [
    "a restoration path whose aggregate reference is not a model element id",
    (s) => {
      structureOf(s).restoration_paths[0].aggregate_ref = "invoice";
    },
  ],
];

for (const [label, change] of BROKEN_REFERENCES)
  test(`${label} is a broken reference`, () => {
    expectRefusedOnlyBy(loadSource(variant("rust", change)), RULE.reference);
  });

// ---------------------------------------------------------------------------
// The structural inspection, run on its own against a declaration that loaded
// ---------------------------------------------------------------------------

test("a declaration that follows the layer rules raises nothing, updater included", () => {
  // The read-model updater depends on both sides, which is what an updater is for.
  expect(inspect(layerSource("rust"))).toEqual([]);
});

test("a command-side package that depends on the query side is refused", () => {
  const source = variant("rust", (draft) => {
    structureOf(draft).dependencies[0].depends_on.push(identityOf("rust", "query"));
  });
  expect(inspect(source)).toContain(RULE.sideDependency);
});

test("a query-side package that depends on the command side is refused", () => {
  const source = variant("rust", (draft) => {
    structureOf(draft).dependencies[1].depends_on.push(identityOf("rust", "command"));
  });
  expect(inspect(source)).toContain(RULE.sideDependency);
});

test("a cqrs context that declares no query-side package is refused", () => {
  const source = variant("rust", (draft) => {
    const structure = structureOf(draft);
    structure.packages.splice(1, 1);
    structure.dependencies.splice(1, 1);
    structure.dependencies[1].depends_on.splice(1, 1);
  });
  expect(inspect(source)).toContain(RULE.cqrsSides);
});

test("a declared package with no dependency row is refused", () => {
  const source = variant("rust", (draft) => {
    const structure = structureOf(draft);
    structure.dependencies.splice(2, 1);
  });
  expect(inspect(source)).toContain(RULE.dependencyRow);
});

test("a context that declares no port is missing a required item", () => {
  const source = variant("rust", (draft) => {
    structureOf(draft).ports = [];
  });
  expect(inspect(source)).toContain(RULE.requiredItems);
});

test("an aggregate of the context with no full-constructor restoration path is refused", () => {
  const source = variant("rust", (draft) => {
    structureOf(draft).restoration_paths.splice(1, 1);
  });
  expect(inspect(source)).toContain(RULE.restorationPath);
});

test("a restoration path that rebuilds an aggregate some other way is refused", () => {
  const source = variant("rust", (draft) => {
    structureOf(draft).restoration_paths[1].via = "other";
  });
  expect(inspect(source)).toContain(RULE.restorationPath);
});

/**
 * A query-side package may depend on a package the context does not declare; what it may not depend
 * on is one whose name carries the domain layer marker, in either language's spelling of that name.
 * The marker is read from the name alone, so the package needs no declaration for the rule to apply.
 */
const QUERY_DEPENDENCIES: readonly (readonly [string, LayerLanguage, string, boolean])[] = [
  ["a Rust package that carries the domain layer marker", "rust", "shared-domain", true],
  ["a Rust package named after the business", "rust", "shared-read-models", false],
  ["a scoped TypeScript package that carries the marker", "typescript", "@acme/shared-domain", true],
  ["a scoped TypeScript package named after the business", "typescript", "@acme/shared-read-models", false],
];

for (const [label, language, name, refused] of QUERY_DEPENDENCIES)
  test(`a query-side package that depends on ${label} is ${refused ? "refused" : "accepted"}`, () => {
    const source = variant(language, (draft) => {
      structureOf(draft).dependencies[1].depends_on.push({ language, package: name });
    });
    expect(inspect(source).includes(RULE.queryDomainDependency)).toBe(refused);
  });

// ---------------------------------------------------------------------------
// The use-case declaration beside it is already language-neutral
// ---------------------------------------------------------------------------

test("the use-case declaration reads through the shared block, model_ref and reference path", () => {
  withWorkspace(recordFiles(declarationDocument(VALID_YAML())), (root) => {
    const path = join(root, USE_CASE_IN_RECORD);
    const block = readYamlBlock(readFileSync(path, "utf8"), USE_CASE_HEADINGS);
    const parsed = Bun.YAML.parse(block.yaml) as { model_ref: string; use_cases: Record<string, unknown>[] };
    expect(parsed.use_cases).toEqual(useCaseSource().use_cases);

    const declared = parseDeclaration(path, "use-case-declarations");
    expect(declared.ok).toBe(true);
    if (!declared.ok) return;
    for (const [index, expected] of useCaseSource().use_cases.entries())
      expect(declared.document.use_cases[index]).toMatchObject(expected);

    const model = loadDomainModel(
      resolveModelPath(join(root, RECORD_DIR), parsed.model_ref),
      OPERATION_OWNED_SCHEMA_VERSION,
    );
    expect(model.ok).toBe(true);
    if (!model.ok) return;
    for (const useCase of parsed.use_cases) {
      for (const aggregate of useCase.target_aggregates as string[])
        expect(model.index.resolve(aggregate, "aggregate").ok).toBe(true);
      for (const command of useCase.commands as string[]) expect(model.index.resolve(command, "command").ok).toBe(true);
    }
  });
});

test("a use-case declaration the production reader returns carries no name a language spells", () => {
  withWorkspace(recordFiles(declarationDocument(VALID_YAML())), (root) => {
    const declared = parseDeclaration(join(root, USE_CASE_IN_RECORD), "use-case-declarations");
    expect(declared.ok).toBe(true);
    if (!declared.ok) return;
    expect(declared.document.use_cases.length).toBe(useCaseSource().use_cases.length);
    for (const useCase of declared.document.use_cases) {
      const keys = Object.keys(useCase).filter((key) => key !== "line");
      expect(keys.filter((key) => !USE_CASE_KEYS.includes(key))).toEqual([]);
      for (const spelled of LANGUAGE_SPELLED_KEYS) expect(keys).not.toContain(spelled);
    }
  });
});
