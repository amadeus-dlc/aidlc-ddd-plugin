import type { GoldenCase } from "../runner.ts";
import { DEPENDENCY_CASES } from "./dependencies.ts";
import { editYaml, MAP, MODEL, SOURCE_MANIFEST, specimen, VIEW, workspace } from "./fixtures.ts";

const cases: GoldenCase[] = [...DEPENDENCY_CASES];
function derive(sensor: string, source: string, name: string, edit: (entry: GoldenCase) => void): GoldenCase {
  const entry = specimen(sensor, source);
  entry.name = name;
  edit(entry);
  cases.push(entry);
  return entry;
}
const clean = (entry: GoldenCase) => {
  entry.expect = { pass: true, rules: [] };
};

derive("ddd-reference-ids", "clean-mapping", "violation-malformed-id", (entry) => {
  editYaml(entry, MAP, (doc) => {
    doc.aggregate_mappings[0].reference_ids = ["not-an-id"];
  });
  entry.expect = { pass: false, rules: ["reference-ids.malformed"] };
});
derive("ddd-reference-ids", "clean-mapping", "violation-id-arity", (entry) => {
  editYaml(entry, MAP, (doc) => {
    doc.aggregate_mappings[0].reference_ids = ["entity.invoice.extra"];
  });
  entry.expect = { pass: false, rules: ["reference-ids.malformed"] };
});
for (const sensor of ["ddd-model-completeness", "ddd-model-presence"]) {
  derive(
    sensor,
    sensor === "ddd-model-presence" ? "clean-execute" : "clean-complete",
    "violation-unresolved-model-reference",
    (entry) => {
      editYaml(entry, MODEL, (doc) => {
        doc.bounded_contexts[0].aggregates[0].root_element = "entity.missing";
      });
      const rule = sensor === "ddd-model-presence" ? "model-presence.invalid" : "model-completeness.schema";
      entry.expect = { pass: false, rules: [rule], files: { [rule]: MODEL } };
    },
  );
}
derive("ddd-model-completeness", "clean-complete", "clean-model-whitespace", (entry) => {
  entry.files[VIEW] = entry.files[VIEW].replace(
    "The money amount must be non-negative.",
    "The money\n amount must be non-negative.",
  );
});
derive("ddd-model-completeness", "clean-complete", "clean-no-transition", (entry) => {
  editYaml(entry, MODEL, (doc) => {
    const aggregate = doc.bounded_contexts[0].aggregates[0];
    aggregate.commands[0].state_effect = "none";
    aggregate.commands[0].transitions = [];
    aggregate.transitions = [];
  });
  entry.files[VIEW] = entry.files[VIEW].replace("- transition.invoice.issue\n", "");
});
derive("ddd-model-completeness", "clean-complete", "violation-empty-model-view", (entry) => {
  entry.files[VIEW] = "";
  entry.expect = { pass: false, rules: ["model-completeness.f-missing", "model-completeness.f-invariant"] };
});
derive("ddd-model-presence", "clean-skip", "clean-absent-stage", (entry) => {
  entry.state = "## Stage Progress\n";
  entry.expect.note_contains = "absent";
});

const useCase = derive("ddd-mapping-declarations", "violation-use-case-item", "clean-use-case", (entry) => {
  editYaml(entry, entry.output, (doc) => {
    doc.use_cases[0].re_execution_basis = "request ID and expected version";
  });
  clean(entry);
});
for (const sensor of ["ddd-mapping-declarations", "ddd-reference-ids", "ddd-design-advisories"]) {
  const entry = structuredClone(useCase);
  entry.sensor = sensor;
  entry.name = "clean-use-case";
  if (sensor !== useCase.sensor) cases.push(entry);
  const empty = structuredClone(entry);
  empty.name = "clean-empty-use-cases";
  editYaml(empty, empty.output, (doc) => {
    doc.use_cases = [];
  });
  cases.push(empty);
}
const strategy = derive(
  "ddd-mapping-declarations",
  "violation-process-manager-required",
  "clean-actor-process-manager",
  (entry) => {
    editYaml(entry, MODEL, (doc) => {
      const context = doc.bounded_contexts[0];
      context.aggregates.push(
        JSON.parse(
          JSON.stringify(context.aggregates[0])
            .replaceAll("invoice", "other")
            .replaceAll("Invoice", "Other")
            .replaceAll("primitive.money", "primitive.credit"),
        ),
      );
      context.process_managers = [
        {
          element_id: "pm.invoice",
          name: "Invoice flow",
          aggregates: ["aggregate.invoice", "aggregate.other"],
          steps: [{ name: "Issue", command: "command.invoice.issue" }],
          compensations: [],
        },
      ];
    });
    editYaml(entry, entry.output, (doc) => {
      doc.use_cases[0].multi_aggregate_strategy = { kind: "process-manager", process_manager_ref: "pm.invoice" };
    });
    clean(entry);
  },
);
const classFlow = structuredClone(strategy);
classFlow.name = "clean-class-re-execution";
editYaml(classFlow, MAP, (doc) => {
  for (const mapping of doc.aggregate_mappings) mapping.programming_model = "class";
});
editYaml(classFlow, classFlow.output, (doc) => {
  doc.use_cases[0].multi_aggregate_strategy = { kind: "re-execution", description: "retry with request ID" };
});
cases.push(classFlow);
derive("ddd-mapping-declarations", "violation-j", "clean-additive-idempotency", (entry) => {
  editYaml(entry, MODEL, (doc) => {
    doc.bounded_contexts[0].aggregates[0].commands.find(
      (c: { effect: string }) => c.effect === "accumulation",
    ).idempotency = { strategy: "command-id-memory", retention: "multiple", retention_count: 2 };
  });
  clean(entry);
});
for (const sensor of ["ddd-layer-structure", "ddd-design-advisories"]) {
  derive(sensor, "clean", "clean-empty-layers", (entry) => {
    editYaml(entry, entry.output, (doc) => {
      doc.layer_structures = [];
    });
  });
  derive(sensor, "clean", "clean-collection-repository", (entry) => {
    editYaml(entry, entry.output, (doc) => {
      doc.layer_structures[0].repositories[0].io_unit = "collection";
    });
  });
}
derive("ddd-layer-structure", "clean", "clean-non-cqrs", (entry) => {
  editYaml(entry, entry.output, (doc) => {
    const layer = doc.layer_structures[0];
    layer.cqrs = false;
    layer.query_side_crates = [];
    layer.crate_dependencies = layer.crate_dependencies.slice(0, 1);
  });
});
derive("ddd-layer-structure", "clean", "clean-rmu-cross-side", (entry) => {
  editYaml(entry, entry.output, (doc) => {
    const layer = doc.layer_structures[0];
    layer.rmu_crates = ["billing-rmu"];
    layer.crate_dependencies.push({ crate: "billing-rmu", depends_on: ["billing-domain", "billing-query"] });
  });
});
derive("ddd-layer-structure", "clean", "violation-k-reverse", (entry) => {
  editYaml(entry, entry.output, (doc) => {
    doc.layer_structures[0].crate_dependencies[1].depends_on = ["billing-domain"];
  });
  entry.expect = { pass: false, rules: ["layer-structure.k", "layer-structure.l"] };
});
derive("ddd-rust-domain", "clean-domain", "violation-model-invalid", (entry) => {
  editYaml(entry, MODEL, (doc) => {
    doc.schema_version = 2;
  });
  entry.expect = {
    pass: false,
    rules: ["model.invalid", "domain-packaging.reference"],
    files: { "model.invalid": MODEL, "domain-packaging.reference": MAP },
  };
});
derive("ddd-rust-domain", "clean-domain", "violation-layer-unowned", (entry) => {
  entry.workspace = { "orphan.rs": "pub struct Invoice;" };
  entry.files[SOURCE_MANIFEST] = JSON.stringify({
    stage: "code-generation",
    unit: "u1",
    version: 1,
    writes: [{ path: "orphan.rs" }],
  });
  entry.expect = { pass: false, rules: ["layer.unowned"], files: { "layer.unowned": "../../../../../orphan.rs" } };
});
derive("ddd-rust-domain", "clean-domain", "clean-full-constructor", (entry) => {
  const path = "packages/domain/billing-domain/src/lib.rs";
  workspace(entry)[path] += "\nimpl Invoice { pub fn new(id: String, amount: i64) -> Self { Self { id, amount } } }\n";
});
derive("ddd-rust-domain", "clean-domain", "clean-self-getter", (entry) => {
  const path = "packages/domain/billing-domain/src/lib.rs";
  workspace(entry)[path] = workspace(entry)[path].replace(
    "pub fn issue(&mut self) {}",
    "pub fn issue(&mut self) { let total = self.total(); }",
  );
});
derive("ddd-rust-interface-adapter", "violation-n", "clean-restoration-constructor", (entry) => {
  workspace(entry)["packages/domain/billing-domain/src/lib.rs"] =
    "pub struct Invoice { id: String } impl Invoice { pub fn new() -> Self { Self { id: String::new() } } }";
  workspace(entry)["packages/interface-adapter/billing-interface-adapter/src/lib.rs"] =
    "use billing_domain::Invoice; pub fn restore() -> Invoice { Invoice::new() }";
  clean(entry);
});
derive("ddd-rust-interface-adapter", "violation-l", "clean-query-dto", (entry) => {
  workspace(entry)["packages/query/use-case/billing-query-use-case/src/lib.rs"] =
    "pub struct InvoiceDto; pub fn read() -> InvoiceDto { InvoiceDto }";
  clean(entry);
});
derive("ddd-rust-interface-adapter", "violation-k", "clean-rmu-bridge", (entry) => {
  const old = "packages/command/interface-adapter/billing-command-api";
  const next = "packages/rmu/billing-rmu";
  entry.workspace = Object.fromEntries(
    Object.entries(workspace(entry)).map(([path, content]) => [
      path.replace(old, next),
      content.replaceAll(old, next).replaceAll("billing-command-api", "billing-rmu"),
    ]),
  );
  entry.files[SOURCE_MANIFEST] = entry.files[SOURCE_MANIFEST].replaceAll(old, next);
  clean(entry);
});
for (const name of [
  "impls",
  "implementation",
  "implementations",
  "vos",
  "value_object",
  "valueobject",
  "valueobjects",
  "VO",
]) {
  derive(
    "ddd-mapping-declarations",
    "violation-packaging-technical-name",
    `violation-package-reserved-${name}`,
    (entry) => {
      editYaml(entry, MAP, (doc) => {
        doc.domain_packages[1].module = name;
      });
    },
  );
  derive("ddd-rust-domain", "violation-packaging-empty-inline", `violation-package-reserved-${name}`, (entry) => {
    const path = "packages/domain/billing-domain/src/lib.rs";
    workspace(entry)[path] = `pub struct Invoice; mod ${name} {}\n`;
  });
}
derive("ddd-rust-domain", "clean-packaging-path-attribute", "violation-module-cycle", (entry) => {
  const path = "packages/domain/billing-domain/src/lib.rs";
  workspace(entry)[path] = '#[path = "lib.rs"] mod invoice; pub struct Invoice;\n';
  entry.expect = {
    pass: false,
    rules: ["domain-packaging.unresolved"],
    files: { "domain-packaging.unresolved": path },
  };
});
derive("ddd-reference-ids", "clean-mapping", "clean-renamed-lineage", (entry) => {
  editYaml(entry, MODEL, (doc) => {
    doc.lineage = [
      { lineage_id: "lineage-0001", element_id: "entity.invoice", relation: "renamed", previous_name: "Old Invoice" },
    ];
  });
});
derive("ddd-model-completeness", "clean-complete", "clean-retired-view-reference", (entry) => {
  editYaml(entry, MODEL, (doc) => {
    doc.lineage = [
      { lineage_id: "lineage-0001", element_id: "entity.old", relation: "deprecated", deprecated_at: "2026-01-01" },
    ];
  });
  entry.files[VIEW] += "- entity.old\n";
});
for (const [sensor, source, english, japanese, key, rule] of [
  [
    "ddd-mapping-declarations",
    "use",
    "DDD Use-case Declarations",
    "DDD ユースケース宣言",
    "use_cases",
    "mapping-declarations.document",
  ],
  [
    "ddd-reference-ids",
    "use",
    "DDD Use-case Declarations",
    "DDD ユースケース宣言",
    "use_cases",
    "reference-ids.document",
  ],
  [
    "ddd-design-advisories",
    "use",
    "DDD Use-case Declarations",
    "DDD ユースケース宣言",
    "use_cases",
    "design-advisories.document",
  ],
  ["ddd-layer-structure", "layer", "DDD Layer Structure", "DDD 層構造宣言", "layer_structures", "layer-structure.item"],
]) {
  const original = source === "use" ? structuredClone(useCase) : specimen(sensor, "clean");
  original.sensor = sensor;
  const legacy = structuredClone(original);
  legacy.name = "clean-legacy-heading";
  legacy.files[legacy.output] = legacy.files[legacy.output].replace(english, japanese);
  cases.push(legacy);
  const duplicate = structuredClone(original);
  duplicate.name = "violation-mixed-headings";
  duplicate.files[duplicate.output] += `\n${duplicate.files[duplicate.output].replace(english, japanese)}`;
  duplicate.expect = { pass: false, rules: [rule] };
  cases.push(duplicate);
  const missing = structuredClone(original);
  missing.name = "violation-missing-list";
  editYaml(missing, missing.output, (doc) => {
    delete doc[key];
  });
  missing.expect = { pass: false, rules: [rule] };
  cases.push(missing);
}
derive("ddd-rust-interface-adapter", "clean-repository", "clean-storage-implementation-name", (entry) => {
  const path = "packages/interface-adapter/billing-interface-adapter/src/lib.rs";
  workspace(entry)[path] = workspace(entry)[path].replaceAll("InMemory", "Postgres");
});
derive("ddd-rust-interface-adapter", "violation-n", "violation-default-restoration", (entry) => {
  const path = "packages/interface-adapter/billing-interface-adapter/src/lib.rs";
  workspace(entry)[path] = "use billing_domain::Invoice; pub fn restore() -> Invoice { Invoice::default() }";
});
derive("ddd-rust-interface-adapter", "violation-k", "violation-k-reverse", (entry) => {
  entry.workspace = Object.fromEntries(
    Object.entries(workspace(entry)).map(([path, content]) => [
      path.replaceAll("command", "TEMP").replaceAll("query", "command").replaceAll("TEMP", "query"),
      content.replaceAll("command", "TEMP").replaceAll("query", "command").replaceAll("TEMP", "query"),
    ]),
  );
  entry.files[SOURCE_MANIFEST] = entry.files[SOURCE_MANIFEST].replaceAll("command", "query");
  entry.expect.files = { k: "packages/query/interface-adapter/billing-query-api/src/lib.rs" };
});
derive("ddd-reference-ids", "clean-mapping", "clean-single-reference", (entry) => {
  editYaml(entry, MAP, (doc) => {
    doc.aggregate_mappings[0].reference_ids = ["entity.invoice"];
  });
});
const multiMapping = structuredClone(strategy);
multiMapping.name = "clean-multi-aggregate-mapping";
multiMapping.stage = "domain-design";
multiMapping.output = MAP;
cases.push(multiMapping);
export const CONTRACT_CASES = cases;
