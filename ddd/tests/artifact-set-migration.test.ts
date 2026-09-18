/**
 * Migrating one project's DDD artifact set — the project settings, the canonical model, the
 * implementation mapping and every layer declaration of one intent record — in one explicit step.
 *
 * The subject is the project directory, which survives preview -> apply -> re-read -> re-run, so
 * each sequence is observed on one workspace rather than on a fresh copy per condition. The whole
 * set is checked before anything is written: when any part of it is refused or incomplete, no file
 * changes. A write that fails partway is not reported as success; the report says what was written,
 * what failed, what is left, and how to finish, and a re-run on the same record does finish.
 */

import { expect, test } from "bun:test";
import { chmodSync, existsSync, readFileSync, realpathSync, rmSync, symlinkSync } from "node:fs";
import { join } from "node:path";
import { loadAggregateMapping } from "../tools/ddd/lib/aggregate-mapping/index.ts";
import { runArtifactSetCommand } from "../tools/ddd/lib/artifact-set/index.ts";
import { loadLayerDeclaration } from "../tools/ddd/lib/layer-declaration/index.ts";
import type { ProjectSelection } from "../tools/ddd/lib/project-settings/index.ts";
import { readProjectSettings } from "../tools/ddd/lib/project-settings/index.ts";
import { loadDomainModel, OPERATION_OWNED_SCHEMA_VERSION } from "../tools/ddd/lib/schema/loader.ts";
import {
  edit,
  LEGACY_INVOICE_RATIONALE,
  LEGACY_INVOICE_TERM,
  legacyMappingYaml,
  MODEL_REF,
  mappingDocument,
  supplementSource,
} from "./fixtures/aggregate-mapping/workspace.ts";
import {
  COMPONENTS_PATH,
  legacySetFiles,
  MAPPING_PATH,
  MODEL_PATH,
  RECORD_DIR,
  SETTINGS_FILE,
  STAGE_LAYER_PATH,
  STATE_FILE,
  STRAY_MODEL_FILE,
  SUPPLEMENT_FILE,
  stageLayerDocument,
  UNIT_LAYER_PATH,
  UNLABELLED_CI_FENCE,
  unitLayerDocument,
} from "./fixtures/artifact-set/workspace.ts";
import { envelopeOf, snapshotBytes, withWorkspace } from "./fixtures/domain-model/workspace.ts";
import {
  declarationDocumentWithBothHeadings,
  JAPANESE_HEADING,
  LAYER_HEADINGS,
  layerSource,
  legacyLayerYaml,
  PERSISTENCE_BACKEND,
} from "./fixtures/layer-declaration/workspace.ts";

const ENTRY_POINT = join(import.meta.dir, "../tools/ddd-artifact-set.ts");
const TOOLS = join(import.meta.dir, "../tools");
const LAYOUT_ENTRY_POINT = join(TOOLS, "ddd-check-rust-module-layout.ts");

/** Project-relative paths of the five artifacts the set holds. */
const SETTINGS = SETTINGS_FILE;
const MODEL = `${RECORD_DIR}/${MODEL_PATH}`;
const MAPPING = `${RECORD_DIR}/${MAPPING_PATH}`;
const UNIT_LAYER = `${RECORD_DIR}/${UNIT_LAYER_PATH}`;
const STAGE_LAYER = `${RECORD_DIR}/${STAGE_LAYER_PATH}`;
const SET_ARTIFACTS = [SETTINGS, MODEL, MAPPING, UNIT_LAYER, STAGE_LAYER];
const LAYERS = [UNIT_LAYER, STAGE_LAYER];

const RUST_FILE_LAYOUT: ProjectSelection = {
  languages: ["rust"],
  rust: { moduleLayout: "file" },
  typescript: null,
};

/** What the legacy mapping cannot say, when no supplement names it. */
const MISSING_NAMES = [
  "aggregate_mappings[aggregate.invoice].code.type",
  "aggregate_mappings[aggregate.invoice].operations[command.invoice.issue]",
  "aggregate_mappings[aggregate.invoice].operations[command.invoice.cancel]",
  "aggregate_mappings[aggregate.payment].code.type",
  "aggregate_mappings[aggregate.payment].operations[command.payment.settle]",
];
const MISSING_FACTORY_ERRORS = ["factory.invoice.open.domain_errors"];

// Dropping write permission does nothing for a superuser, whose write succeeds regardless, so the
// test either observes the failure or does not run at all.
const RUNNING_AS_SUPERUSER = process.getuid?.() === 0;

interface ArtifactReport {
  readonly path: string;
  readonly outcome: string;
  readonly [field: string]: unknown;
}

interface SetReport {
  readonly outcome: string;
  readonly artifacts?: readonly ArtifactReport[];
  readonly written?: readonly string[];
  readonly failed?: { readonly path: string; readonly detail: unknown };
  readonly pending?: readonly string[];
  readonly rerun?: unknown;
  readonly [field: string]: unknown;
}

function run(argv: readonly string[]): { exitCode: number; report: SetReport } {
  const result = runArtifactSetCommand(argv);
  return { exitCode: result.exitCode, report: JSON.parse(result.stdout) };
}

interface MigrateOptions {
  readonly apply?: boolean;
  /** `false` leaves the supplement option off the command line. */
  readonly supplement?: boolean;
}

function migrateArgs(root: string, options: MigrateOptions = {}): string[] {
  return [
    "migrate",
    "--project",
    root,
    "--record",
    join(root, RECORD_DIR),
    ...(options.supplement === false ? [] : ["--supplement", join(root, SUPPLEMENT_FILE)]),
    ...(options.apply ? ["--apply"] : []),
  ];
}

function migrate(root: string, options: MigrateOptions = {}): { exitCode: number; report: SetReport } {
  return run(migrateArgs(root, options));
}

/** The project-relative form of a path the report names, whichever spelling of the root it uses. */
function projectPath(root: string, path: string): string {
  for (const base of new Set([root, realpathSync(root)])) {
    if (path.startsWith(`${base}/`)) return path.slice(base.length + 1);
  }
  throw new Error(`${path} is not a path inside the project ${root}`);
}

function projectPaths(root: string, paths: readonly string[] | undefined): string[] {
  if (paths === undefined) throw new Error("the report does not list these paths");
  return paths.map((path) => projectPath(root, path));
}

function artifactsOf(root: string, report: SetReport): Map<string, ArtifactReport> {
  const artifacts = report.artifacts ?? [];
  const byPath = new Map(artifacts.map((entry) => [projectPath(root, entry.path), entry]));
  expect(byPath.size).toBe(artifacts.length);
  return byPath;
}

function artifactOf(artifacts: ReadonlyMap<string, ArtifactReport>, path: string): ArtifactReport {
  const entry = artifacts.get(path);
  if (entry === undefined) throw new Error(`the report names no artifact at ${path}`);
  return entry;
}

/** Every rule id anywhere below `value`, so a refusal is found wherever the report places it. */
function ruleIdsIn(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap(ruleIdsIn);
  if (typeof value !== "object" || value === null) return [];
  const own = (value as { rule_id?: unknown }).rule_id;
  return [...(typeof own === "string" ? [own] : []), ...Object.values(value).flatMap(ruleIdsIn)];
}

function except(census: Record<string, string>, paths: readonly string[]): Record<string, string> {
  return Object.fromEntries(Object.entries(census).filter(([path]) => !paths.includes(path)));
}

function read(root: string, path: string): string {
  return readFileSync(join(root, path), "utf8");
}

function schemaVersionOf(value: unknown): unknown {
  return (value as { schema_version?: unknown } | undefined)?.schema_version;
}

/**
 * What the legacy mapping and the supplement describe. Module spellings lose only their `::`
 * separators and a leading `crate`; every business value arrives unchanged; the code names are the
 * supplement's own, and the factory rule the fixture model does not have is not named.
 */
function expectedMapping() {
  const supplement = supplementSource();
  const operationsOf = (index: number) =>
    (supplement.aggregate_mappings[index].operations ?? []).filter(
      (operation) => operation.operation_ref !== "factory.invoice.open",
    );
  const rustAt = (module: string[]) => ({ language: "rust", package: "billing-domain", module });
  return {
    schema_version: 2,
    model_ref: MODEL_REF,
    aggregate_mappings: [
      {
        aggregate_ref: "aggregate.invoice",
        programming_model: "class",
        persistence_method: "event-sourcing",
        reference_ids: ["entity.invoice", "invariant.invoice.total-positive"],
        replay_methods: [{ event_ref: "event.invoice.issued", code: { method: "apply_issued" } }],
        code: {
          ...rustAt(["invoice"]),
          type: "BillingInvoice",
          ports: ["InvoiceNumbering", "TaxRates"],
          repository: "InvoiceRepository",
        },
        operations: operationsOf(0),
      },
      {
        aggregate_ref: "aggregate.payment",
        programming_model: "actor",
        persistence_method: "state-sourcing",
        reference_ids: ["entity.payment"],
        replay_methods: [],
        code: { ...rustAt(["payment"]), type: "PaymentRecord", ports: [], repository: "PaymentRepository" },
        operations: operationsOf(1),
      },
    ],
    domain_packages: [
      { term: "請求", model_refs: ["bc.billing"], rationale: "請求の業務全体を所有する", code: rustAt([]) },
      {
        term: LEGACY_INVOICE_TERM,
        model_refs: ["aggregate.invoice"],
        rationale: LEGACY_INVOICE_RATIONALE,
        code: rustAt(["invoice"]),
      },
      {
        term: "請求書番号",
        model_refs: ["entity.invoice"],
        rationale: "請求書番号の採番規則をまとめる",
        code: rustAt(["invoice", "number"]),
      },
      { term: "請求種別", model_refs: ["bc.billing"], rationale: "請求の種別を区別する", code: rustAt(["r#type"]) },
      { term: "入金", model_refs: ["aggregate.payment"], rationale: "入金の消し込みを扱う", code: rustAt(["payment"]) },
    ],
  };
}

/** No entry below the project changed: no file rewritten, created or removed, and nothing left beside one. */
function expectNothingWritten(root: string, before: Record<string, string>): void {
  expect(snapshotBytes(root)).toEqual(before);
}

// ---------------------------------------------------------------------------
// Preview and apply
// ---------------------------------------------------------------------------

test("a preview names every artifact of the set as a candidate in the current format, and writes nothing", () => {
  withWorkspace(legacySetFiles(), (root) => {
    const before = snapshotBytes(root);
    const { exitCode, report } = migrate(root);
    expect(exitCode).toBe(0);
    expect(report.outcome).toBe("candidate");

    const artifacts = artifactsOf(root, report);
    expect([...artifacts.keys()].sort()).toEqual([...SET_ARTIFACTS].sort());
    for (const entry of artifacts.values()) expect(entry.outcome).toBe("candidate");
    expect(artifactOf(artifacts, SETTINGS).selection).toEqual(RUST_FILE_LAYOUT);
    expect(schemaVersionOf(artifactOf(artifacts, MODEL).model)).toBe(2);
    expect(schemaVersionOf(artifactOf(artifacts, MAPPING).mapping)).toBe(2);
    for (const layer of LAYERS) expect(schemaVersionOf(artifactOf(artifacts, layer).declaration)).toBe(2);

    expectNothingWritten(root, before);
  });
});

test("an apply converts the settings, the model, the mapping and both layer declarations to the current format", () => {
  withWorkspace(legacySetFiles(), (root) => {
    const { exitCode, report } = migrate(root, { apply: true });
    expect(exitCode).toBe(0);
    expect(report.outcome).toBe("applied");
    const artifacts = artifactsOf(root, report);
    expect([...artifacts.keys()].sort()).toEqual([...SET_ARTIFACTS].sort());
    for (const entry of artifacts.values()) expect(entry.outcome).toBe("applied");

    expect(readProjectSettings(root)).toEqual({ kind: "validated", selection: RUST_FILE_LAYOUT });
    expect(loadDomainModel(join(root, MODEL), OPERATION_OWNED_SCHEMA_VERSION).ok).toBe(true);
    expect(loadAggregateMapping(join(root, MAPPING)).ok).toBe(true);
    for (const layer of LAYERS) expect(loadLayerDeclaration(join(root, layer)).ok).toBe(true);
  });
});

test("the migrated set keeps every business id, reference, meaning and the language it was written in", () => {
  withWorkspace(legacySetFiles(), (root) => {
    const legacy = loadDomainModel(join(root, MODEL));
    if (!legacy.ok) throw new Error(`the legacy model fixture does not load: ${JSON.stringify(legacy.findings)}`);

    expect(migrate(root, { apply: true }).report.outcome).toBe("applied");

    const model = loadDomainModel(join(root, MODEL), OPERATION_OWNED_SCHEMA_VERSION);
    if (!model.ok) throw new Error(`the migrated model does not load: ${JSON.stringify(model.findings)}`);
    expect(model.model).toEqual({ ...legacy.model, schema_version: 2 });

    const mapping = loadAggregateMapping(join(root, MAPPING));
    if (!mapping.ok) throw new Error(`the migrated mapping does not load: ${JSON.stringify(mapping.findings)}`);
    expect(mapping.mapping).toEqual(expectedMapping() as unknown as typeof mapping.mapping);

    for (const layer of LAYERS) {
      const declaration = loadLayerDeclaration(join(root, layer));
      if (!declaration.ok) throw new Error(`${layer} does not load: ${JSON.stringify(declaration.findings)}`);
      expect(declaration.declaration).toEqual(layerSource("rust") as unknown as typeof declaration.declaration);
    }
  });
});

test("a declared value whose wording spells a legacy key comes through as business wording", () => {
  withWorkspace(legacySetFiles(), (root) => {
    expect(migrate(root, { apply: true }).report.outcome).toBe("applied");
    for (const layer of LAYERS) {
      const declaration = loadLayerDeclaration(join(root, layer));
      if (!declaration.ok) throw new Error(`${layer} does not load: ${JSON.stringify(declaration.findings)}`);
      const backend = declaration.declaration.layer_structures[0]?.persistence_backend;
      expect(backend).toBe(PERSISTENCE_BACKEND);
      expect(backend).toContain("crate: billing-domain");
    }
  });
});

test("only the labelled DDD blocks change; prose, the CI fences beside them and every other file keep their bytes", () => {
  withWorkspace(legacySetFiles(), (root) => {
    const before = snapshotBytes(root);
    const model = read(root, MODEL);
    const mapping = read(root, MAPPING);
    const layers = LAYERS.map((layer) => read(root, layer));

    expect(migrate(root, { apply: true }).report.outcome).toBe("applied");

    expect(envelopeOf(read(root, MODEL))).toEqual(envelopeOf(model));
    expect(envelopeOf(read(root, MAPPING))).toEqual(envelopeOf(mapping));
    LAYERS.forEach((layer, index) => {
      expect(envelopeOf(read(root, layer), LAYER_HEADINGS)).toEqual(envelopeOf(layers[index], LAYER_HEADINGS));
    });
    expect(except(snapshotBytes(root), SET_ARTIFACTS)).toEqual(except(before, SET_ARTIFACTS));
    for (const path of SET_ARTIFACTS) expect(snapshotBytes(root)[path]).not.toBe(before[path]);
  });
});

test("an unlabelled CI fence that spells a legacy layer key is not a declaration and keeps its bytes", () => {
  withWorkspace(legacySetFiles(), (root) => {
    const before = read(root, UNIT_LAYER);
    const heading = before.indexOf("## DDD Layer Structure");
    expect(before.slice(0, heading)).toContain(UNLABELLED_CI_FENCE);

    expect(migrate(root, { apply: true }).report.outcome).toBe("applied");

    const after = read(root, UNIT_LAYER);
    expect(after.slice(0, after.indexOf("## DDD Layer Structure"))).toBe(before.slice(0, heading));
  });
});

test("a declaration under the Japanese section marker and a tilde fence is converted where it stands", () => {
  withWorkspace(legacySetFiles(), (root) => {
    // The section marker and the fence opener as the fixture writes them, on consecutive lines.
    const opening = `## ${JAPANESE_HEADING}\n~~~yaml\n`;
    const before = read(root, STAGE_LAYER);
    expect(before).toContain(opening);

    expect(migrate(root, { apply: true }).report.outcome).toBe("applied");

    const after = read(root, STAGE_LAYER);
    expect(after).toContain(opening);
    expect(envelopeOf(after, LAYER_HEADINGS)).toEqual(envelopeOf(before, LAYER_HEADINGS));
    expect(loadLayerDeclaration(join(root, STAGE_LAYER)).ok).toBe(true);
  });
});

test("a second run over the migrated set reports already-migrated and changes no byte", () => {
  withWorkspace(legacySetFiles(), (root) => {
    expect(migrate(root, { apply: true }).report.outcome).toBe("applied");
    const afterApply = snapshotBytes(root);

    for (const apply of [false, true]) {
      const { exitCode, report } = migrate(root, { apply });
      expect(exitCode).toBe(0);
      expect(report.outcome).toBe("already-migrated");
      const artifacts = artifactsOf(root, report);
      expect([...artifacts.keys()].sort()).toEqual([...SET_ARTIFACTS].sort());
      for (const entry of artifacts.values()) expect(entry.outcome).toBe("already-migrated");
    }
    // A migrated mapping needs no supplement, so leaving it out changes nothing either.
    expect(migrate(root, { apply: true, supplement: false }).report.outcome).toBe("already-migrated");
    expect(snapshotBytes(root)).toEqual(afterApply);
  });
});

// ---------------------------------------------------------------------------
// The record the gates read
// ---------------------------------------------------------------------------

const GATE_RUNS: readonly (readonly [string, string, string])[] = [
  ["ddd-model-completeness", "ddd-domain-modeling", MODEL],
  ["ddd-model-presence", "domain-design", `${RECORD_DIR}/${COMPONENTS_PATH}`],
  ["ddd-mapping-declarations", "domain-design", MAPPING],
  ["ddd-reference-ids", "domain-design", MAPPING],
  ["ddd-layer-structure", "infrastructure-design", UNIT_LAYER],
  ["ddd-layer-structure", "infrastructure-design", STAGE_LAYER],
];

function gateVerdict(
  root: string,
  sensor: string,
  stage: string,
  output: string,
): { pass: boolean; findings: { rule_id: string }[] } {
  const script = join(TOOLS, `ddd-sensor-${sensor.replace(/^ddd-/, "")}.ts`);
  const spawned = Bun.spawnSync([process.execPath, script, "--stage", stage, "--output-path", join(root, output)], {
    stdout: "pipe",
    stderr: "pipe",
  });
  return JSON.parse(spawned.stdout.toString());
}

function layoutExitCode(root: string): number | null {
  return Bun.spawnSync([process.execPath, LAYOUT_ENTRY_POINT, "--project", root], { stdout: "pipe", stderr: "pipe" })
    .exitCode;
}

// Every check runs as its own process, as the gate runs it, so this sequence needs more than the default time.
const GATE_SEQUENCE_TIMEOUT_MS = 60_000;

test(
  "the migrated record passes the model, mapping, layer and module layout checks that refused it before",
  () => {
    withWorkspace(legacySetFiles(), (root) => {
      for (const [sensor, stage, output] of GATE_RUNS)
        expect({ sensor, output, pass: gateVerdict(root, sensor, stage, output).pass }).toEqual({
          sensor,
          output,
          pass: false,
        });
      expect(layoutExitCode(root)).toBe(1);

      expect(migrate(root, { apply: true }).report.outcome).toBe("applied");

      for (const [sensor, stage, output] of GATE_RUNS) {
        const verdict = gateVerdict(root, sensor, stage, output);
        expect({ sensor, output, pass: verdict.pass, findings: verdict.findings }).toEqual({
          sensor,
          output,
          pass: true,
          findings: [],
        });
      }
      expect(layoutExitCode(root)).toBe(0);
    });
  },
  GATE_SEQUENCE_TIMEOUT_MS,
);

// ---------------------------------------------------------------------------
// Checked before anything is written
// ---------------------------------------------------------------------------

test("code names the legacy mapping cannot state are reported before anything is written", () => {
  withWorkspace(legacySetFiles({ supplement: null }), (root) => {
    const before = snapshotBytes(root);

    const preview = migrate(root, { supplement: false });
    expect(preview.exitCode).toBe(0);
    expect(preview.report.outcome).toBe("missing-information");
    const artifacts = artifactsOf(root, preview.report);
    expect(artifactOf(artifacts, MAPPING)).toMatchObject({ outcome: "missing-information", missing: MISSING_NAMES });
    for (const path of [SETTINGS, MODEL, UNIT_LAYER, STAGE_LAYER])
      expect(artifactOf(artifacts, path).outcome).toBe("candidate");

    const applied = migrate(root, { supplement: false, apply: true });
    expect(applied.exitCode).toBe(1);
    expect(applied.report.outcome).toBe("missing-information");
    expect(artifactOf(artifactsOf(root, applied.report), MAPPING).missing).toEqual(MISSING_NAMES);
    expectNothingWritten(root, before);
  });
});

test("business errors the legacy model gives a factory rule no place for are reported, while the rest of the set is still checked", () => {
  withWorkspace(legacySetFiles({ withFactory: true }), (root) => {
    const before = snapshotBytes(root);

    const preview = migrate(root);
    expect(preview.exitCode).toBe(0);
    expect(preview.report.outcome).toBe("missing-information");
    const artifacts = artifactsOf(root, preview.report);
    expect(artifactOf(artifacts, MODEL)).toMatchObject({
      outcome: "missing-information",
      missing: MISSING_FACTORY_ERRORS,
    });
    // The mapping and the declarations are checked against the model as the legacy format states it.
    for (const path of [SETTINGS, MAPPING, UNIT_LAYER, STAGE_LAYER])
      expect(artifactOf(artifacts, path).outcome).toBe("candidate");

    const applied = migrate(root, { apply: true });
    expect(applied.exitCode).toBe(1);
    expect(applied.report.outcome).toBe("missing-information");
    expectNothingWritten(root, before);
  });
});

test("a mapping defect is refused in the same run that reports the model's missing business errors", () => {
  const mapping = mappingDocument(
    edit(
      legacyMappingYaml(),
      "    reference_ids: [entity.payment]\n",
      "    reference_ids: [entity.payment, entity.refund]\n",
    ),
  );
  withWorkspace(legacySetFiles({ withFactory: true, mapping }), (root) => {
    const before = snapshotBytes(root);
    for (const apply of [false, true]) {
      const { exitCode, report } = migrate(root, { apply });
      expect(exitCode).toBe(1);
      expect(report.outcome).toBe("rejected");
      const artifacts = artifactsOf(root, report);
      expect(artifactOf(artifacts, MODEL)).toMatchObject({
        outcome: "missing-information",
        missing: MISSING_FACTORY_ERRORS,
      });
      expect(artifactOf(artifacts, MAPPING).outcome).toBe("rejected");
      expect(ruleIdsIn(artifactOf(artifacts, MAPPING))).toContain("aggregate-mapping.reference");
    }
    expectNothingWritten(root, before);
  });
});

const INCONSISTENT_SETS: readonly (readonly [string, string, Parameters<typeof legacySetFiles>[0], string])[] = [
  [
    "a mapping that cites an element the model does not define",
    MAPPING,
    {
      mapping: mappingDocument(
        edit(legacyMappingYaml(), "    reference_ids: [entity.payment]\n", "    reference_ids: [entity.refund]\n"),
      ),
    },
    "aggregate-mapping.reference",
  ],
  [
    "a mapping that names a model the record does not hold",
    MAPPING,
    {
      mapping: mappingDocument(
        edit(legacyMappingYaml(), `model_ref: ${MODEL_REF}\n`, "model_ref: inception/ddd-domain-modeling/absent.md\n"),
      ),
    },
    "aggregate-mapping.model",
  ],
  [
    "a layer declaration that restores an aggregate the model does not define",
    UNIT_LAYER,
    {
      unitLayer: unitLayerDocument(
        edit(
          legacyLayerYaml(),
          "{ aggregate_ref: aggregate.invoice, via: full-constructor }",
          "{ aggregate_ref: aggregate.refund, via: full-constructor }",
        ),
      ),
    },
    "layer-declaration.reference",
  ],
  [
    "a declaration section written under both section markers",
    UNIT_LAYER,
    { unitLayer: declarationDocumentWithBothHeadings(legacyLayerYaml()) },
    "layer-declaration.document",
  ],
  [
    "a declaration section holding only an unlabelled fence and a decorated yaml fence",
    STAGE_LAYER,
    {
      stageLayer: edit(
        stageLayerDocument(),
        `~~~yaml\n${legacyLayerYaml().trimEnd()}\n~~~\n`,
        `\`\`\`\n${legacyLayerYaml()}\`\`\`\n\n\`\`\`yaml title\n${legacyLayerYaml()}\`\`\`\n`,
      ),
    },
    "layer-declaration.document",
  ],
];

for (const [label, offending, options, rule] of INCONSISTENT_SETS)
  test(`${label} is refused before anything is written, and the rest of the set is still reported`, () => {
    withWorkspace(legacySetFiles(options), (root) => {
      const before = snapshotBytes(root);
      for (const apply of [false, true]) {
        const { exitCode, report } = migrate(root, { apply });
        expect(exitCode).toBe(1);
        expect(report.outcome).toBe("rejected");
        const artifacts = artifactsOf(root, report);
        expect(artifactOf(artifacts, offending).outcome).toBe("rejected");
        expect(ruleIdsIn(artifactOf(artifacts, offending))).toContain(rule);
        for (const path of SET_ARTIFACTS.filter((candidate) => candidate !== offending))
          expect({ path, outcome: artifactOf(artifacts, path).outcome }).toEqual({ path, outcome: "candidate" });
      }
      expectNothingWritten(root, before);
    });
  });

test("a project without its settings file is refused before anything is written", () => {
  withWorkspace(legacySetFiles({ settings: null }), (root) => {
    const before = snapshotBytes(root);
    for (const apply of [false, true]) {
      const { exitCode, report } = migrate(root, { apply });
      expect(exitCode).toBe(1);
      expect(report.outcome).toBe("rejected");
      expect(artifactOf(artifactsOf(root, report), SETTINGS)).toMatchObject({
        outcome: "rejected",
        reason: "file-absent",
      });
    }
    expectNothingWritten(root, before);
  });
});

test("a record without its canonical model refuses the mapping and the declarations that name it", () => {
  withWorkspace(legacySetFiles({ model: null }), (root) => {
    const before = snapshotBytes(root);
    for (const apply of [false, true]) {
      const { exitCode, report } = migrate(root, { apply });
      expect(exitCode).toBe(1);
      expect(report.outcome).toBe("rejected");
      const artifacts = artifactsOf(root, report);
      expect(artifactOf(artifacts, MODEL).outcome).toBe("absent");
      expect(artifactOf(artifacts, MAPPING).outcome).toBe("rejected");
      expect(ruleIdsIn(artifactOf(artifacts, MAPPING))).toContain("aggregate-mapping.model");
      for (const layer of LAYERS) {
        expect(artifactOf(artifacts, layer).outcome).toBe("rejected");
        expect(ruleIdsIn(artifactOf(artifacts, layer))).toContain("layer-declaration.model");
      }
    }
    expectNothingWritten(root, before);
  });
});

test("a record without a mapping migrates the rest and creates no mapping", () => {
  withWorkspace(legacySetFiles({ mapping: null }), (root) => {
    const preview = migrate(root);
    expect(preview.exitCode).toBe(0);
    expect(preview.report.outcome).toBe("candidate");
    expect(artifactOf(artifactsOf(root, preview.report), MAPPING).outcome).toBe("absent");

    const { exitCode, report } = migrate(root, { apply: true });
    expect(exitCode).toBe(0);
    expect(report.outcome).toBe("applied");
    const artifacts = artifactsOf(root, report);
    expect(artifactOf(artifacts, MAPPING).outcome).toBe("absent");
    for (const path of [SETTINGS, MODEL, UNIT_LAYER, STAGE_LAYER])
      expect(artifactOf(artifacts, path).outcome).toBe("applied");
    expect(existsSync(join(root, MAPPING))).toBe(false);
    expect(loadDomainModel(join(root, MODEL), OPERATION_OWNED_SCHEMA_VERSION).ok).toBe(true);
  });
});

test("a record directory that holds no workflow state is refused before anything is written", () => {
  withWorkspace(legacySetFiles(), (root) => {
    rmSync(join(root, RECORD_DIR, STATE_FILE));
    const before = snapshotBytes(root);
    for (const apply of [false, true]) {
      const { exitCode, report } = migrate(root, { apply });
      expect(exitCode).toBe(1);
      expect(report.outcome).toBe("rejected");
      expect(ruleIdsIn(report)).toContain("artifact-set.record");
    }
    expectNothingWritten(root, before);
  });
});

test("a record outside the project is refused before anything is written", () => {
  withWorkspace(legacySetFiles(), (root) => {
    const before = snapshotBytes(root);
    for (const apply of [false, true]) {
      const argv = migrateArgs(root, { apply }).map((value) => (value === root ? join(root, "src") : value));
      const { exitCode, report } = run(argv);
      expect(exitCode).toBe(1);
      expect(report.outcome).toBe("rejected");
      expect(ruleIdsIn(report)).toContain("artifact-set.record");
    }
    expectNothingWritten(root, before);
  });
});

// ---------------------------------------------------------------------------
// A write that fails partway
// ---------------------------------------------------------------------------

test.skipIf(RUNNING_AS_SUPERUSER)(
  "a write that fails partway is not success: it names what was written, what failed and what is left, and a re-run finishes the set",
  () => {
    withWorkspace(legacySetFiles(), (root) => {
      const before = snapshotBytes(root);
      const mappingFile = join(root, MAPPING);
      chmodSync(mappingFile, 0o444);
      const failed = (() => {
        try {
          return migrate(root, { apply: true });
        } finally {
          chmodSync(mappingFile, 0o644);
        }
      })();

      expect(failed.exitCode).toBe(3);
      expect(failed.report.outcome).toBe("write-failed");
      expect(projectPaths(root, failed.report.written)).toEqual([MODEL]);
      expect(projectPath(root, failed.report.failed?.path ?? "")).toBe(MAPPING);
      expect(typeof failed.report.failed?.detail).toBe("string");
      // Written in the order the set is written: the declarations by path, the settings last.
      expect(projectPaths(root, failed.report.pending)).toEqual([STAGE_LAYER, UNIT_LAYER, SETTINGS]);
      expect(typeof failed.report.rerun).toBe("string");
      expect(String(failed.report.rerun).length).toBeGreaterThan(0);

      // The model is the only file that changed, and it changed completely; nothing was left beside it.
      const afterFailure = snapshotBytes(root);
      expect(except(afterFailure, [MODEL])).toEqual(except(before, [MODEL]));
      expect(afterFailure[MODEL]).not.toBe(before[MODEL]);
      expect(loadDomainModel(join(root, MODEL), OPERATION_OWNED_SCHEMA_VERSION).ok).toBe(true);

      const rerun = migrate(root, { apply: true });
      expect(rerun.exitCode).toBe(0);
      expect(rerun.report.outcome).toBe("applied");
      const artifacts = artifactsOf(root, rerun.report);
      expect(artifactOf(artifacts, MODEL).outcome).toBe("already-migrated");
      for (const path of [SETTINGS, MAPPING, UNIT_LAYER, STAGE_LAYER])
        expect({ path, outcome: artifactOf(artifacts, path).outcome }).toEqual({ path, outcome: "applied" });
      expect(readProjectSettings(root)).toEqual({ kind: "validated", selection: RUST_FILE_LAYOUT });
      expect(loadAggregateMapping(join(root, MAPPING)).ok).toBe(true);
      for (const layer of LAYERS) expect(loadLayerDeclaration(join(root, layer)).ok).toBe(true);
    });
  },
);

// A registered path that is a symbolic link names a file kept somewhere else. Writing through it
// would rewrite that file with the record's conversion while the record itself gained nothing, so
// the apply refuses and both the link and the file it names keep their bytes. The model is the
// first artifact the set writes, so refusing there leaves the whole set pending.
test("a canonical model that is a symbolic link is refused, and neither the link nor the file it names is written", () => {
  withWorkspace(legacySetFiles(), (root) => {
    const target = join(root, STRAY_MODEL_FILE);
    rmSync(join(root, MODEL));
    symlinkSync(target, join(root, MODEL));
    const before = snapshotBytes(root);
    expect(before[MODEL]).toBe(`symlink:${target}`);

    const { exitCode, report } = migrate(root, { apply: true });

    expect(exitCode).toBe(3);
    expect(report.outcome).toBe("write-failed");
    expect(projectPaths(root, report.written)).toEqual([]);
    expect(projectPath(root, report.failed?.path ?? "")).toBe(MODEL);
    expect(typeof report.failed?.detail).toBe("string");
    // Written in the order the set is written: the mapping, the declarations by path, the settings last.
    expect(projectPaths(root, report.pending)).toEqual([MAPPING, STAGE_LAYER, UNIT_LAYER, SETTINGS]);
    expect(typeof report.rerun).toBe("string");
    expectNothingWritten(root, before);
  });
});

test.skipIf(RUNNING_AS_SUPERUSER)(
  "a write that fails at the first artifact writes none of the set, and a re-run finishes it",
  () => {
    withWorkspace(legacySetFiles(), (root) => {
      const before = snapshotBytes(root);
      const modelFile = join(root, MODEL);
      chmodSync(modelFile, 0o444);
      const failed = (() => {
        try {
          return migrate(root, { apply: true });
        } finally {
          chmodSync(modelFile, 0o644);
        }
      })();

      expect(failed.exitCode).toBe(3);
      expect(failed.report.outcome).toBe("write-failed");
      expect(projectPaths(root, failed.report.written)).toEqual([]);
      expect(projectPath(root, failed.report.failed?.path ?? "")).toBe(MODEL);
      expect(typeof failed.report.failed?.detail).toBe("string");
      expect(projectPaths(root, failed.report.pending)).toEqual([MAPPING, STAGE_LAYER, UNIT_LAYER, SETTINGS]);
      expect(typeof failed.report.rerun).toBe("string");
      expect(String(failed.report.rerun).length).toBeGreaterThan(0);
      expectNothingWritten(root, before);

      const rerun = migrate(root, { apply: true });
      expect(rerun.exitCode).toBe(0);
      expect(rerun.report.outcome).toBe("applied");
      const artifacts = artifactsOf(root, rerun.report);
      for (const path of SET_ARTIFACTS)
        expect({ path, outcome: artifactOf(artifacts, path).outcome }).toEqual({ path, outcome: "applied" });
      expect(readProjectSettings(root)).toEqual({ kind: "validated", selection: RUST_FILE_LAYOUT });
      expect(loadDomainModel(join(root, MODEL), OPERATION_OWNED_SCHEMA_VERSION).ok).toBe(true);
      expect(loadAggregateMapping(join(root, MAPPING)).ok).toBe(true);
      for (const layer of LAYERS) expect(loadLayerDeclaration(join(root, layer)).ok).toBe(true);
    });
  },
);

// ---------------------------------------------------------------------------
// Command
// ---------------------------------------------------------------------------

const INVALID_ARGUMENTS: readonly (readonly [string, (root: string) => string[]])[] = [
  ["no command at all", () => []],
  ["an unknown subcommand", (root) => ["convert", ...migrateArgs(root).slice(1)]],
  ["an unknown option", (root) => [...migrateArgs(root), "--force"]],
  ["a missing project", (root) => ["migrate", "--record", join(root, RECORD_DIR), "--apply"]],
  ["a missing record", (root) => ["migrate", "--project", root, "--apply"]],
  ["a record option given without its value", (root) => ["migrate", "--project", root, "--record"]],
  ["the project given twice", (root) => [...migrateArgs(root, { apply: true }), "--project", root]],
  ["the record given twice", (root) => [...migrateArgs(root, { apply: true }), "--record", join(root, RECORD_DIR)]],
  [
    "the supplement given twice",
    (root) => [...migrateArgs(root, { apply: true }), "--supplement", join(root, SUPPLEMENT_FILE)],
  ],
  // Reading `--apply` as the value would drop the apply and leave a preview that writes nothing.
  [
    "a project option that would swallow the apply flag",
    (root) => ["migrate", "--record", join(root, RECORD_DIR), "--project", "--apply"],
  ],
  [
    "a supplement option that would swallow the apply flag",
    (root) => ["migrate", "--project", root, "--record", join(root, RECORD_DIR), "--supplement", "--apply"],
  ],
];

for (const [label, argv] of INVALID_ARGUMENTS)
  test(`the command refuses ${label} with the argument exit status, and writes nothing`, () => {
    withWorkspace(legacySetFiles(), (root) => {
      const before = snapshotBytes(root);
      const { exitCode, report } = run(argv(root));
      expect(exitCode).toBe(2);
      expect(report.outcome).toBe("invalid-arguments");
      expectNothingWritten(root, before);
    });
  });

test("the shipped entry point runs on its own and previews without writing", () => {
  withWorkspace(legacySetFiles(), (root) => {
    const before = snapshotBytes(root);
    const spawned = Bun.spawnSync([process.execPath, ENTRY_POINT, ...migrateArgs(root)], {
      stdout: "pipe",
      stderr: "pipe",
    });
    expect(spawned.exitCode).toBe(0);
    expect(JSON.parse(spawned.stdout.toString()).outcome).toBe("candidate");
    expectNothingWritten(root, before);
  });
});
