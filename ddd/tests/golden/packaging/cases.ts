import { DESIGN_CASES } from "../design/cases.ts";
import type { GoldenCase } from "../runner.ts";
import { RUST_CASES } from "../rust/cases.ts";

const MAP = "inception/domain-design/ddd-aggregate-mapping.md";
export const MODEL = "inception/ddd-domain-modeling/ddd-domain-model-yaml.md";
export const DOMAIN = "packages/domain/billing-domain/src/lib.rs";
export const ROOT_PACKAGE = {
  crate: "billing-domain",
  module: "crate",
  term: "請求",
  model_refs: ["bc.billing"],
  rationale: "請求のドメインを所有する",
};

export function mapping(packages: unknown): string {
  return `# 集約写像\n\n\`\`\`yaml\n${JSON.stringify(
    {
      schema_version: 1,
      model_ref: MODEL,
      aggregate_mappings: [
        {
          aggregate_ref: "aggregate.invoice",
          programming_model: "class",
          persistence_method: "state-sourcing",
          crate: "billing-domain",
          module: "crate",
          ports: [],
          repository: "InvoiceRepository",
          reference_ids: ["entity.invoice"],
        },
      ],
      ...(packages === undefined ? {} : { domain_packages: packages }),
    },
    null,
    2,
  )}\n\`\`\`\n`;
}

function design(name: string, packages: unknown, rules: string[]): GoldenCase {
  const base = DESIGN_CASES.find(
    (entry) => entry.sensor === "ddd-mapping-declarations" && entry.name === "clean-mapping",
  );
  if (!base) throw new Error("mapping fixture missing");
  return {
    ...structuredClone(base),
    name,
    files: { ...base.files, [MAP]: mapping(packages) },
    expect: { pass: rules.length === 0, rules },
  };
}

function rust(name: string, source: string, packages: unknown, rules: string[]): GoldenCase {
  const base = RUST_CASES.find((entry) => entry.name === "clean-domain");
  if (!base?.workspace) throw new Error("Rust fixture missing");
  const entry = structuredClone(base);
  entry.name = name;
  entry.workspace = { ...base.workspace, [DOMAIN]: source };
  entry.files[MAP] = mapping(packages);
  entry.expect = { pass: rules.length === 0, rules, files: Object.fromEntries(rules.map((rule) => [rule, DOMAIN])) };
  return entry;
}

export const PACKAGING_CASES: GoldenCase[] = [
  design(
    "violation-packaging-technical-name",
    [ROOT_PACKAGE, { ...ROOT_PACKAGE, module: "vo" }],
    ["domain-packaging.technical-name"],
  ),
  rust(
    "violation-packaging-empty-inline",
    "pub struct Invoice;\nmod vo {}\n",
    [ROOT_PACKAGE],
    ["domain-packaging.technical-name"],
  ),
];

const pkg = (module: string) => ({ ...ROOT_PACKAGE, module, term: "請求書", model_refs: ["aggregate.invoice"] });
const names = ["aggregate", "aggregates", "impl", "vo", "entities", "entity", "value_objects"];
for (const name of names) {
  PACKAGING_CASES.push(
    design(`violation-packaging-name-${name}`, [ROOT_PACKAGE, pkg(name)], ["domain-packaging.technical-name"]),
  );
  const identifier = name === "impl" ? "r#impl" : name;
  PACKAGING_CASES.push(
    rust(
      `violation-packaging-mod-${name}`,
      `pub struct Invoice;\nmod ${identifier} {}\n`,
      [ROOT_PACKAGE],
      ["domain-packaging.technical-name"],
    ),
  );
}
PACKAGING_CASES.push(
  design("clean-packaging-declarations", [ROOT_PACKAGE, pkg("invoice"), pkg("invoice::number")], []),
  design("violation-packaging-missing-declarations", undefined, ["domain-packaging.declaration"]),
  design("violation-packaging-empty-declarations", [], ["domain-packaging.coverage"]),
  design("violation-packaging-missing-term", [{ ...ROOT_PACKAGE, term: " " }], ["domain-packaging.declaration"]),
  design(
    "violation-packaging-missing-rationale",
    [{ ...ROOT_PACKAGE, rationale: " " }],
    ["domain-packaging.declaration"],
  ),
  design(
    "violation-packaging-missing-reference",
    [{ ...ROOT_PACKAGE, model_refs: [] }],
    ["domain-packaging.declaration"],
  ),
  design(
    "violation-packaging-duplicate",
    [ROOT_PACKAGE, { ...ROOT_PACKAGE, module: "crate" }],
    ["domain-packaging.duplicate"],
  ),
  design("violation-packaging-missing-parent", [ROOT_PACKAGE, pkg("invoice::number")], ["domain-packaging.coverage"]),
  design("violation-packaging-shape", "not a list", ["mapping-declarations.document"]),
  rust(
    "clean-packaging-inline",
    "pub struct Invoice;\nmod invoice { mod number {} }\n",
    [ROOT_PACKAGE, pkg("invoice"), pkg("invoice::number")],
    [],
  ),
  rust(
    "clean-packaging-impl-syntax",
    "pub struct Invoice; impl Invoice { pub fn issue(&mut self) {} }\n",
    [ROOT_PACKAGE],
    [],
  ),
  rust(
    "clean-packaging-word-substring",
    "pub struct Invoice; mod identity {} mod invoice_entities {}\n",
    [ROOT_PACKAGE, pkg("identity"), pkg("invoice_entities")],
    [],
  ),
  rust(
    "violation-packaging-undeclared",
    "pub struct Invoice; mod invoice {}\n",
    [ROOT_PACKAGE],
    ["domain-packaging.coverage"],
  ),
  rust(
    "violation-packaging-under-business-name",
    "pub struct Invoice; mod invoice { mod vo {} }\n",
    [ROOT_PACKAGE, pkg("invoice")],
    ["domain-packaging.technical-name"],
  ),
  rust(
    "clean-packaging-test-module",
    "pub struct Invoice;\n#[cfg(test)] mod tests { mod entities {} }\n",
    [ROOT_PACKAGE],
    [],
  ),
  rust(
    "violation-packaging-item-macro",
    "pub struct Invoice; domain_modules!();\n",
    [ROOT_PACKAGE],
    ["domain-packaging.unresolved"],
  ),
);
const ref = design(
  "violation-packaging-reference-id",
  [{ ...ROOT_PACKAGE, model_refs: ["aggregate.unknown"] }],
  ["reference-ids.undefined"],
);
ref.sensor = "ddd-reference-ids";
PACKAGING_CASES.push(ref);

const external = rust(
  "clean-packaging-external-reference",
  "use external_domain::entities; pub struct Invoice;\n",
  [ROOT_PACKAGE],
  [],
);
external.workspace = {
  ...external.workspace,
  "Cargo.toml":
    '[workspace]\nmembers = ["packages/domain/billing-domain", "packages/domain/external-domain"]\nresolver = "2"\n',
  "packages/domain/external-domain/Cargo.toml":
    '[package]\nname = "external-domain"\nversion = "0.1.0"\nedition = "2021"\n',
  "packages/domain/external-domain/src/lib.rs": "pub mod entities {}\n",
};
PACKAGING_CASES.push(external);

const standard = rust(
  "clean-packaging-external-module",
  "pub struct Invoice; mod invoice;\n",
  [ROOT_PACKAGE, pkg("invoice"), pkg("invoice::number")],
  [],
);
standard.workspace = {
  ...standard.workspace,
  "packages/domain/billing-domain/src/invoice.rs": "mod number;\n",
  "packages/domain/billing-domain/src/invoice/number.rs": "",
};
PACKAGING_CASES.push(standard);
const modRs = structuredClone(standard);
modRs.name = "clean-packaging-mod-rs";
delete modRs.workspace?.["packages/domain/billing-domain/src/invoice.rs"];
modRs.workspace = { ...modRs.workspace, "packages/domain/billing-domain/src/invoice/mod.rs": "mod number;\n" };
PACKAGING_CASES.push(modRs);
const absent = rust(
  "violation-packaging-missing-module-file",
  "pub struct Invoice; mod invoice;\n",
  [ROOT_PACKAGE, pkg("invoice")],
  ["domain-packaging.unresolved"],
);
PACKAGING_CASES.push(absent);
const alias = rust(
  "clean-packaging-path-attribute",
  '#[path = "billing.rs"] mod invoice;\npub struct Invoice;\n',
  [ROOT_PACKAGE, pkg("invoice")],
  [],
);
alias.workspace = { ...alias.workspace, "packages/domain/billing-domain/src/billing.rs": "" };
PACKAGING_CASES.push(alias);
const physical = rust(
  "violation-packaging-physical-classification",
  '#[path = "vo/price.rs"] mod money;\npub struct Invoice;\n',
  [ROOT_PACKAGE, pkg("money")],
  ["domain-packaging.technical-name"],
);
physical.workspace = { ...physical.workspace, "packages/domain/billing-domain/src/vo/price.rs": "" };
physical.expect.locations = [
  { rule: "domain-packaging.technical-name", file: DOMAIN },
  { rule: "domain-packaging.technical-name", file: "packages/domain/billing-domain/src/vo/price.rs" },
];
PACKAGING_CASES.push(physical);
const nested = rust(
  "clean-packaging-inline-path",
  'mod invoice { #[path = "ledger.rs"] mod number; }\npub struct Invoice;\n',
  [ROOT_PACKAGE, pkg("invoice"), pkg("invoice::number")],
  [],
);
nested.workspace = { ...nested.workspace, "packages/domain/billing-domain/src/invoice/ledger.rs": "" };
PACKAGING_CASES.push(nested);
const override = rust(
  "clean-packaging-inline-directory-path",
  '#[path = "billing_files"] mod invoice { #[path = "ledger.rs"] mod number; }\npub struct Invoice;\n',
  [ROOT_PACKAGE, pkg("invoice"), pkg("invoice::number")],
  [],
);
override.workspace = { ...override.workspace, "packages/domain/billing-domain/src/billing_files/ledger.rs": "" };
PACKAGING_CASES.push(override);
const raw = rust(
  "clean-packaging-raw-path",
  '#[path = r#"billing.rs"#] mod invoice;\npub struct Invoice;\n',
  [ROOT_PACKAGE, pkg("invoice")],
  [],
);
raw.workspace = alias.workspace
  ? { ...alias.workspace, [DOMAIN]: '#[path = r#"billing.rs"#] mod invoice;\npub struct Invoice;\n' }
  : undefined;
PACKAGING_CASES.push(raw);
const escapedPath = rust(
  "violation-packaging-path-escape",
  '#[path = "../../../foreign.rs"] mod invoice;\npub struct Invoice;\n',
  [ROOT_PACKAGE, pkg("invoice")],
  ["domain-packaging.unresolved"],
);
PACKAGING_CASES.push(escapedPath);
const missingMapping = rust(
  "violation-packaging-no-mapping",
  "pub struct Invoice;\n",
  [ROOT_PACKAGE],
  ["domain-packaging.declaration"],
);
delete missingMapping.files[MAP];
missingMapping.expect.files = { "domain-packaging.declaration": MAP };
PACKAGING_CASES.push(missingMapping);
const codeRef = rust(
  "violation-packaging-code-reference",
  "pub struct Invoice;\n",
  [{ ...ROOT_PACKAGE, model_refs: ["aggregate.unknown"] }],
  ["domain-packaging.reference"],
);
codeRef.expect.files = { "domain-packaging.reference": MAP };
PACKAGING_CASES.push(codeRef);

const duplicateCode = rust(
  "violation-packaging-code-duplicate",
  "pub struct Invoice;\n",
  [ROOT_PACKAGE, ROOT_PACKAGE],
  ["domain-packaging.duplicate"],
);
duplicateCode.expect.files = { "domain-packaging.duplicate": MAP };
PACKAGING_CASES.push(duplicateCode);
const rootCoverage = rust(
  "violation-packaging-code-root-coverage",
  "pub struct Invoice;\n",
  [],
  ["domain-packaging.coverage"],
);
rootCoverage.expect.files = { "domain-packaging.coverage": MAP };
PACKAGING_CASES.push(rootCoverage);
PACKAGING_CASES.push(
  rust("clean-packaging-planned-module", "pub struct Invoice;\n", [ROOT_PACKAGE, pkg("invoice")], []),
);
const orphan = rust(
  "violation-packaging-orphan-claim",
  "pub struct Invoice;\n",
  [ROOT_PACKAGE, pkg("invoice")],
  ["domain-packaging.unresolved"],
);
const orphanPath = "packages/domain/billing-domain/src/invoice.rs";
orphan.workspace = { ...orphan.workspace, [orphanPath]: "" };
orphan.files["construction/u1/code-generation/source-manifest.json"] = JSON.stringify({
  stage: "code-generation",
  unit: "u1",
  version: 1,
  writes: [{ path: orphanPath }],
});
orphan.expect.files = { "domain-packaging.unresolved": orphanPath };
PACKAGING_CASES.push(orphan);
const ambiguity = structuredClone(standard);
ambiguity.name = "violation-packaging-ambiguous-source";
ambiguity.workspace = { ...ambiguity.workspace, "packages/domain/billing-domain/src/invoice/mod.rs": "" };
ambiguity.expect = {
  pass: false,
  rules: ["domain-packaging.unresolved"],
  files: { "domain-packaging.unresolved": DOMAIN },
};
PACKAGING_CASES.push(ambiguity);
const conditional = rust(
  "violation-packaging-conditional-path",
  '#[cfg_attr(feature = "alternate", path = "billing.rs")] mod invoice;\npub struct Invoice;\n',
  [ROOT_PACKAGE, pkg("invoice")],
  ["domain-packaging.unresolved"],
);
PACKAGING_CASES.push(conditional);
const auxiliary = structuredClone(standard);
auxiliary.name = "clean-packaging-auxiliary-only-claim";
auxiliary.workspace = { ...auxiliary.workspace, "packages/domain/billing-domain/tests/sample.rs": "mod entities {}\n" };
auxiliary.files["construction/u1/code-generation/source-manifest.json"] = JSON.stringify({
  stage: "code-generation",
  unit: "u1",
  version: 1,
  writes: [{ path: "packages/domain/billing-domain/tests/sample.rs" }],
});
PACKAGING_CASES.push(auxiliary);
const crateName = rust(
  "violation-packaging-crate-classification",
  "pub struct Invoice;\n",
  [{ ...ROOT_PACKAGE, crate: "entities-domain" }],
  ["domain-packaging.technical-name"],
);
crateName.workspace = {
  ...crateName.workspace,
  "packages/domain/billing-domain/Cargo.toml":
    '[package]\nname = "entities-domain"\nversion = "0.1.0"\nedition = "2021"\n',
};
crateName.expect.locations = [
  { rule: "domain-packaging.technical-name", file: "packages/domain/billing-domain/Cargo.toml" },
  { rule: "domain-packaging.technical-name", file: MAP },
];
PACKAGING_CASES.push(crateName);

const pathReplay = rust(
  "clean-packaging-path-replay",
  '#[path = "billing.rs"] mod invoice;\n',
  [ROOT_PACKAGE, pkg("invoice")],
  [],
);
const replaySource = "packages/domain/billing-domain/src/billing.rs";
pathReplay.workspace = {
  ...pathReplay.workspace,
  [replaySource]:
    "pub struct Invoice { amount: i64 }\npub struct Issued { amount: i64 }\nimpl Invoice { pub fn apply_event(&mut self, event: Issued) { self.amount = event.amount; } }\n",
};
pathReplay.files[MAP] = pathReplay.files[MAP]
  .replace('"module": "crate"', '"module": "invoice"')
  .replace('"persistence_method": "state-sourcing"', '"persistence_method": "event-sourcing"')
  .replace(
    '"reference_ids": [',
    '"replay_methods": [{"method": "apply_event", "event_ref": "event.invoice.issued"}], "reference_ids": [',
  );
pathReplay.files["construction/u1/code-generation/source-manifest.json"] = JSON.stringify({
  stage: "code-generation",
  unit: "u1",
  version: 1,
  writes: [{ path: DOMAIN }, { path: replaySource }],
});
PACKAGING_CASES.push(pathReplay);

const pathChild = rust(
  "clean-packaging-path-child",
  '#[path = "billing.rs"] mod invoice;\npub struct Invoice;\n',
  [ROOT_PACKAGE, pkg("invoice"), pkg("invoice::number")],
  [],
);
pathChild.workspace = {
  ...pathChild.workspace,
  "packages/domain/billing-domain/src/billing.rs": "mod number;\n",
  "packages/domain/billing-domain/src/number.rs": "",
};
PACKAGING_CASES.push(pathChild);
