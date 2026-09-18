/**
 * Migrating one ddd-domain-model-yaml.md from the legacy format to the operation-owned one.
 *
 * The subject is a directory that survives preview -> apply -> re-read -> re-run, so the
 * sequence is observed on one workspace rather than on a fresh copy per condition.
 */

import { expect, test } from "bun:test";
import { chmodSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  applyModelMigration,
  previewModelMigration,
  runDomainModelCommand,
} from "../tools/ddd/lib/domain-model/index.ts";
import { MODEL_DATA_FILE, modelYaml } from "../tools/ddd/lib/schema/artifacts.ts";
import { loadDomainModel } from "../tools/ddd/lib/schema/loader.ts";
import {
  documentWithNoYamlBlock,
  documentWithTwoYamlBlocks,
  documentWithUnclosedYamlBlock,
  envelopeOf,
  FENCE_VARIANTS,
  ISSUE_CONDITION,
  legacyModelYaml,
  MODEL_IN_RECORD,
  modelDocument,
  recordFiles,
  SETTLE_CONDITION,
  snapshotBytes,
  untouchableUserFiles,
  viewDocument,
  without,
  withWorkspace,
} from "./fixtures/domain-model/workspace.ts";

const ENTRY_POINT = join(import.meta.dir, "../tools/ddd-domain-model.ts");
const COMPLETENESS_SENSOR = join(import.meta.dir, "../tools/ddd-sensor-model-completeness.ts");
const MISSING_FACTORY_ERRORS = ["factory.invoice.open.domain_errors"];

interface ParsedDocument {
  readonly bounded_contexts: readonly {
    readonly aggregates: readonly {
      readonly commands: readonly { readonly domain_errors: readonly Record<string, unknown>[] }[];
      readonly transitions: readonly Record<string, unknown>[];
    }[];
    readonly process_managers: readonly {
      readonly steps: readonly Record<string, unknown>[];
      readonly compensations: readonly Record<string, unknown>[];
    }[];
  }[];
}

function modelPathOf(root: string): string {
  return join(root, MODEL_DATA_FILE);
}

function readDocument(path: string): string {
  return readFileSync(path, "utf8");
}

function legacyWorkspace(options: { withFactory?: boolean } = {}): Record<string, string> {
  return { [MODEL_DATA_FILE]: modelDocument(legacyModelYaml(options)), ...untouchableUserFiles() };
}

function run(argv: readonly string[]): { exitCode: number; report: Record<string, unknown> } {
  const result = runDomainModelCommand(argv);
  return { exitCode: result.exitCode, report: JSON.parse(result.stdout) };
}

function verdictOf(modelPath: string): { pass: boolean; findings: { rule_id: string }[] } {
  const spawned = Bun.spawnSync(
    [process.execPath, COMPLETENESS_SENSOR, "--stage", "ddd-domain-modeling", "--output-path", modelPath],
    { stdout: "pipe", stderr: "pipe" },
  );
  return JSON.parse(spawned.stdout.toString());
}

test("a preview of a legacy model offers a candidate and writes nothing", () => {
  withWorkspace(legacyWorkspace(), (root) => {
    const before = snapshotBytes(root);
    const outcome = previewModelMigration(modelPathOf(root));
    expect(outcome.kind).toBe("candidate");
    if (outcome.kind !== "candidate") return;
    expect(outcome.model.schema_version).toBe(2);
    expect(snapshotBytes(root)).toEqual(before);
  });
});

test("an apply keeps every business id, reference, condition and its language", () => {
  withWorkspace(legacyWorkspace(), (root) => {
    const path = modelPathOf(root);
    const before = snapshotBytes(root);
    const documentBefore = readDocument(path);
    const legacy = loadDomainModel(path);
    expect(legacy.ok).toBe(true);
    if (!legacy.ok) return;

    expect(applyModelMigration(path).kind).toBe("applied");

    const migrated = loadDomainModel(path, 2);
    expect(migrated.ok).toBe(true);
    if (!migrated.ok) return;
    expect(migrated.model).toEqual({ ...legacy.model, schema_version: 2 });

    expect(envelopeOf(readDocument(path))).toEqual(envelopeOf(documentBefore));
    expect(without(snapshotBytes(root), MODEL_DATA_FILE)).toEqual(without(before, MODEL_DATA_FILE));
    expect(snapshotBytes(root)[MODEL_DATA_FILE]).not.toBe(before[MODEL_DATA_FILE]);
  });
});

test("only the DomainError ownership key is renamed, and the same spelling elsewhere is left alone", () => {
  withWorkspace(legacyWorkspace(), (root) => {
    const path = modelPathOf(root);
    expect(applyModelMigration(path).kind).toBe("applied");

    const parsed = Bun.YAML.parse(modelYaml(readDocument(path))) as ParsedDocument;
    const context = parsed.bounded_contexts[0];
    const invoice = context.aggregates[0];
    const payment = context.aggregates[1];
    const manager = context.process_managers[0];

    const issueError = invoice.commands[0].domain_errors[0];
    expect(Object.keys(issueError)).toContain("operation");
    expect(Object.keys(issueError)).not.toContain("command");
    expect(issueError.operation).toBe("command.invoice.issue");
    expect(issueError.condition).toBe(ISSUE_CONDITION);

    // The same key name on a transition and on process-manager steps names a command, not an
    // error owner, so it stays as it was.
    for (const node of [invoice.transitions[0], manager.steps[0], manager.compensations[0]]) {
      expect(Object.keys(node)).toContain("command");
      expect(Object.keys(node)).not.toContain("operation");
    }
    expect(invoice.transitions[0].command).toBe("command.invoice.issue");
    expect(manager.steps[0].command).toBe("command.invoice.issue");
    expect(manager.compensations[0].command).toBe("command.payment.refund");

    // A condition whose text spells the renamed key is a business value, not a key.
    expect(payment.commands[0].domain_errors[0].condition).toBe(SETTLE_CONDITION);
  });
});

test("a condition carrying YAML punctuation, quotes, a newline and non-ASCII survives the round trip", () => {
  const awkward = '下書き: "確定" ではない # 注記\n2行目\\末尾';
  withWorkspace({ [MODEL_DATA_FILE]: modelDocument(legacyModelYaml({ issueCondition: awkward })) }, (root) => {
    const path = modelPathOf(root);
    const legacy = loadDomainModel(path);
    expect(legacy.ok).toBe(true);
    if (!legacy.ok) return;

    expect(applyModelMigration(path).kind).toBe("applied");

    const migrated = loadDomainModel(path, 2);
    expect(migrated.ok).toBe(true);
    if (!migrated.ok) return;
    expect(migrated.model).toEqual({ ...legacy.model, schema_version: 2 });
    expect(migrated.model.bounded_contexts[0].aggregates[0].commands[0].domain_errors[0].condition).toBe(awkward);
  });
});

test("an empty list under a required key is still declared, so the applied model reads back and re-runs cleanly", () => {
  withWorkspace({ [MODEL_DATA_FILE]: modelDocument(legacyModelYaml({ emptyProcessSteps: true })) }, (root) => {
    const path = modelPathOf(root);
    const legacy = loadDomainModel(path);
    expect(legacy.ok).toBe(true);
    if (!legacy.ok) return;

    expect(applyModelMigration(path).kind).toBe("applied");

    const parsed = Bun.YAML.parse(modelYaml(readDocument(path))) as ParsedDocument;
    expect(parsed.bounded_contexts[0].process_managers[0].steps).toEqual([]);
    const migrated = loadDomainModel(path, 2);
    expect(migrated.ok).toBe(true);
    if (!migrated.ok) return;
    expect(migrated.model).toEqual({ ...legacy.model, schema_version: 2 });

    const afterApply = snapshotBytes(root);
    expect(applyModelMigration(path).kind).toBe("already-migrated");
    expect(snapshotBytes(root)).toEqual(afterApply);
  });
});

// The YAML writer's helpers are shared with other migrations, so the bytes this migration writes are
// pinned here: a change that still reads back the same model would otherwise go unnoticed.
const GOLDEN_DIR = join(import.meta.dir, "fixtures/domain-model");
const CONDITION_NEEDING_ESCAPES = '下書き: "確定" ではない # 注記\n2行目\\末尾';

for (const [label, options, golden] of [
  ["a condition that needs escaping", { issueCondition: CONDITION_NEEDING_ESCAPES }, "migrated-model.yaml"],
  ["an empty list under a required key", { emptyProcessSteps: true }, "migrated-model-empty-steps.yaml"],
] as const)
  test(`the block written for ${label} keeps the exact layout the migration writes`, () => {
    withWorkspace({ [MODEL_DATA_FILE]: modelDocument(legacyModelYaml(options)) }, (root) => {
      const path = modelPathOf(root);
      expect(applyModelMigration(path).kind).toBe("applied");
      expect(`${modelYaml(readDocument(path))}\n`).toBe(readFileSync(join(GOLDEN_DIR, golden), "utf8"));
    });
  });

test("an applied model declares exactly the element ids the source declared", () => {
  withWorkspace(legacyWorkspace(), (root) => {
    const path = modelPathOf(root);
    const legacy = loadDomainModel(path);
    expect(legacy.ok).toBe(true);
    if (!legacy.ok) return;
    const declared = legacy.index
      .elements()
      .map((element) => element.id.value)
      .sort();

    expect(applyModelMigration(path).kind).toBe("applied");

    const migrated = loadDomainModel(path, 2);
    expect(migrated.ok).toBe(true);
    if (!migrated.ok) return;
    expect(
      migrated.index
        .elements()
        .map((element) => element.id.value)
        .sort(),
    ).toEqual(declared);
  });
});

for (const [label, fence] of FENCE_VARIANTS)
  test(`an apply through ${label} replaces the same single block and no other fence`, () => {
    withWorkspace({ [MODEL_DATA_FILE]: modelDocument(legacyModelYaml(), fence), ...untouchableUserFiles() }, (root) => {
      const path = modelPathOf(root);
      const before = snapshotBytes(root);
      const documentBefore = readDocument(path);

      expect(applyModelMigration(path).kind).toBe("applied");

      expect(loadDomainModel(path, 2).ok).toBe(true);
      expect(envelopeOf(readDocument(path))).toEqual(envelopeOf(documentBefore));
      expect(without(snapshotBytes(root), MODEL_DATA_FILE)).toEqual(without(before, MODEL_DATA_FILE));
    });
  });

test("a factory rule leaves the migration incomplete, and nothing is invented or written", () => {
  withWorkspace(legacyWorkspace({ withFactory: true }), (root) => {
    const path = modelPathOf(root);
    const before = snapshotBytes(root);

    expect(previewModelMigration(path)).toEqual({ kind: "missing-information", missing: MISSING_FACTORY_ERRORS });
    expect(applyModelMigration(path)).toEqual({ kind: "missing-information", missing: MISSING_FACTORY_ERRORS });

    expect(snapshotBytes(root)).toEqual(before);
    expect(loadDomainModel(path).ok).toBe(true);
    expect(loadDomainModel(path, 2).ok).toBe(false);
  });
});

const REFUSED_DOCUMENTS: readonly (readonly [string, string])[] = [
  ["carries no labelled YAML block", documentWithNoYamlBlock()],
  ["carries two labelled YAML blocks", documentWithTwoYamlBlocks(legacyModelYaml())],
  ["never closes its YAML block", documentWithUnclosedYamlBlock(legacyModelYaml())],
  ["carries YAML that does not parse", modelDocument("bounded_contexts:\n  - [")],
  ["carries a model the legacy loader refuses", modelDocument(`${legacyModelYaml()}crates: []`)],
];

for (const [label, document] of REFUSED_DOCUMENTS)
  test(`a document that ${label} is refused by preview and apply alike, and nothing is written`, () => {
    withWorkspace({ [MODEL_DATA_FILE]: document, ...untouchableUserFiles() }, (root) => {
      const path = modelPathOf(root);
      const before = snapshotBytes(root);

      for (const outcome of [previewModelMigration(path), applyModelMigration(path)]) {
        expect(outcome.kind).toBe("rejected");
        if (outcome.kind !== "rejected") continue;
        expect(outcome.findings.length).toBeGreaterThan(0);
      }
      expect(snapshotBytes(root)).toEqual(before);
    });
  });

test("a path with no document at all is refused", () => {
  withWorkspace(untouchableUserFiles(), (root) => {
    expect(previewModelMigration(modelPathOf(root)).kind).toBe("rejected");
  });
});

test("a raw YAML file is outside the one artifact kind the migration accepts", () => {
  withWorkspace({ "model.yaml": legacyModelYaml(), ...untouchableUserFiles() }, (root) => {
    const path = join(root, "model.yaml");
    const before = snapshotBytes(root);
    expect(previewModelMigration(path).kind).toBe("rejected");
    expect(applyModelMigration(path).kind).toBe("rejected");
    expect(snapshotBytes(root)).toEqual(before);
  });
});

test("one model directory carries preview, apply, re-read and re-run across the change", () => {
  withWorkspace(legacyWorkspace(), (root) => {
    const path = modelPathOf(root);
    const before = snapshotBytes(root);

    expect(loadDomainModel(path).ok).toBe(true);
    expect(loadDomainModel(path, 2).ok).toBe(false);
    expect(previewModelMigration(path).kind).toBe("candidate");
    expect(snapshotBytes(root)).toEqual(before);

    expect(applyModelMigration(path).kind).toBe("applied");
    const afterApply = snapshotBytes(root);
    expect(afterApply[MODEL_DATA_FILE]).not.toBe(before[MODEL_DATA_FILE]);
    expect(without(afterApply, MODEL_DATA_FILE)).toEqual(without(before, MODEL_DATA_FILE));

    expect(loadDomainModel(path, 2).ok).toBe(true);
    expect(loadDomainModel(path).ok).toBe(false);

    expect(previewModelMigration(path).kind).toBe("already-migrated");
    expect(applyModelMigration(path).kind).toBe("already-migrated");
    expect(snapshotBytes(root)).toEqual(afterApply);
  });
});

// Dropping write permission does nothing for a superuser, whose write succeeds regardless, so the
// test either observes the failure or does not run at all.
const RUNNING_AS_SUPERUSER = process.getuid?.() === 0;

test.skipIf(RUNNING_AS_SUPERUSER)(
  "a target that cannot be written is not reported as success and leaves the document alone",
  () => {
    withWorkspace(legacyWorkspace(), (root) => {
      const path = modelPathOf(root);
      const before = snapshotBytes(root);
      chmodSync(path, 0o444);
      try {
        const outcome = applyModelMigration(path);
        expect(outcome.kind).toBe("write-failed");
        expect(snapshotBytes(root)).toEqual(before);

        const { exitCode, report } = run(["migrate", "--model", path, "--apply"]);
        expect(exitCode).toBe(3);
        expect(report.outcome).toBe("write-failed");
        expect(snapshotBytes(root)).toEqual(before);
      } finally {
        chmodSync(path, 0o644);
      }
    });
  },
);

test("the production model gate refuses the legacy format and accepts the model once it is migrated", () => {
  withWorkspace(recordFiles(modelDocument(legacyModelYaml()), viewDocument()), (root) => {
    const path = join(root, ...MODEL_IN_RECORD.split("/"));
    const legacy = verdictOf(path);
    expect(legacy.pass).toBe(false);
    expect(legacy.findings.map((entry) => entry.rule_id)).toContain("model-completeness.schema");

    expect(applyModelMigration(path).kind).toBe("applied");

    const migrated = verdictOf(path);
    expect(migrated.findings).toEqual([]);
    expect(migrated.pass).toBe(true);
  });
});

test("the command previews, applies and then reports that nothing is left to do", () => {
  withWorkspace(legacyWorkspace(), (root) => {
    const path = modelPathOf(root);
    const before = snapshotBytes(root);

    const preview = run(["migrate", "--model", path]);
    expect(preview.exitCode).toBe(0);
    expect(preview.report.outcome).toBe("candidate");
    expect(snapshotBytes(root)).toEqual(before);

    const applied = run(["migrate", "--model", path, "--apply"]);
    expect(applied.exitCode).toBe(0);
    expect(applied.report.outcome).toBe("applied");

    const again = run(["migrate", "--model", path, "--apply"]);
    expect(again.exitCode).toBe(0);
    expect(again.report.outcome).toBe("already-migrated");
  });
});

test("a missing business definition exits 0 on preview and non-zero on apply", () => {
  withWorkspace(legacyWorkspace({ withFactory: true }), (root) => {
    const path = modelPathOf(root);
    const before = snapshotBytes(root);

    const preview = run(["migrate", "--model", path]);
    expect(preview.exitCode).toBe(0);
    expect(preview.report.outcome).toBe("missing-information");
    expect(preview.report.missing).toEqual(MISSING_FACTORY_ERRORS);

    const applied = run(["migrate", "--model", path, "--apply"]);
    expect(applied.exitCode).toBe(1);
    expect(applied.report.outcome).toBe("missing-information");
    expect(snapshotBytes(root)).toEqual(before);
  });
});

test("a document the loader refuses exits with the refusal status", () => {
  withWorkspace({ [MODEL_DATA_FILE]: documentWithNoYamlBlock() }, (root) => {
    const { exitCode, report } = run(["migrate", "--model", modelPathOf(root)]);
    expect(exitCode).toBe(1);
    expect(report.outcome).toBe("rejected");
  });
});

for (const [label, argv] of [
  ["an unknown option", ["migrate", "--model", ".", "--force"]],
  ["a missing model", ["migrate"]],
  ["an unknown subcommand", ["convert", "--model", "."]],
  ["an option given without its value", ["migrate", "--model"]],
] as const)
  test(`refuses ${label} with the argument exit status`, () => {
    const { exitCode, report } = run(argv);
    expect(exitCode).toBe(2);
    expect(report.outcome).toBe("invalid-arguments");
  });

test("an option left without a value never swallows the flag that follows it", () => {
  withWorkspace(legacyWorkspace(), (root) => {
    const before = snapshotBytes(root);
    // Reading `--apply` as the model would drop the apply and leave a preview that writes
    // nothing and still exits 0 — a caller reading the exit status alone would call that done.
    const { exitCode, report } = run(["migrate", "--model", "--apply"]);
    expect(exitCode).toBe(2);
    expect(report.outcome).toBe("invalid-arguments");
    expect(snapshotBytes(root)).toEqual(before);
  });
});

test("the shipped entry point runs on its own", () => {
  withWorkspace(legacyWorkspace(), (root) => {
    const before = snapshotBytes(root);
    const spawned = Bun.spawnSync([process.execPath, ENTRY_POINT, "migrate", "--model", modelPathOf(root)], {
      stdout: "pipe",
      stderr: "pipe",
    });
    expect(spawned.exitCode).toBe(0);
    expect(JSON.parse(spawned.stdout.toString()).outcome).toBe("candidate");
    expect(snapshotBytes(root)).toEqual(before);
  });
});
