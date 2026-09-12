import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import type { GraphStage } from "../../.codex/tools/aidlc-graph.ts";
import { filterProducesByKind } from "../../.codex/tools/aidlc-lib.ts";
import { runPluginCompose } from "../../.codex/tools/aidlc-plugin-test.ts";
import { DESIGN_CASES } from "./golden/design/cases.ts";
import { PACKAGING_CASES } from "./golden/packaging/cases.ts";

const repository = resolve(import.meta.dir, "../..");
const roots: string[] = [];
const write = (path: string, content: string) => {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content);
};

function fixture(harness: "claude" | "codex" = "codex") {
  const leaf = `.${harness}`;
  const root = mkdtempSync(join(tmpdir(), "ddd-gate-"));
  roots.push(root);
  cpSync(join(repository, leaf), join(root, leaf), { recursive: true });
  cpSync(join(repository, ".agents"), join(root, ".agents"), { recursive: true });
  const memory = "aidlc/spaces/default/memory";
  if (existsSync(join(repository, memory))) cpSync(join(repository, memory), join(root, memory), { recursive: true });
  const composed = runPluginCompose({
    harness,
    harnessLeaf: leaf,
    projectDir: root,
    pluginBuilt: join(repository, `ddd/dist/${harness}`),
  });
  expect(composed.status, composed.stderr || composed.stdout).toBe(0);
  const graphPath = join(root, leaf, "tools/data/stage-graph.json");
  const graph = JSON.parse(readFileSync(graphPath, "utf8")) as GraphStage[];
  // Exercise the real artifact and gate-sensor machinery. Unrelated core
  // document/reviewer/Q&A policies belong to the framework's own tests.
  for (const stage of graph) {
    stage.sensors_applicable = (stage.sensors_applicable ?? []).filter((sensor) => sensor.id.startsWith("ddd-"));
  }
  writeFileSync(graphPath, JSON.stringify(graph));
  const record = join(root, "aidlc/spaces/default/intents/gate-test");
  write(join(root, "aidlc/spaces/default/intents/active-intent"), "gate-test\n");
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    AIDLC_PROJECT_DIR: root,
    CLAUDE_PROJECT_DIR: root,
    AIDLC_HARNESS_DIR: leaf,
    AIDLC_STAGE_GRAPH: graphPath,
    AIDLC_SKIP_SUMMARY_CONFIRMATION_GUARD: "1",
    AIDLC_SKIP_REVIEWER_GATE_GUARD: "1",
  };
  delete env.AIDLC_COMPILED_EXECUTABLE;
  delete env.AIDLC_SKIP_ARTIFACT_GUARD;
  const command = (tool: string, args: string[]) => {
    const result = Bun.spawnSync([process.execPath, join(root, leaf, `tools/aidlc-${tool}.ts`), ...args], {
      cwd: root,
      env,
      stdout: "pipe",
      stderr: "pipe",
    });
    return { code: result.exitCode, output: result.stdout.toString() + result.stderr.toString() };
  };
  const state = (slug: string, phase = "inception", scope = "refactor") => {
    write(
      join(record, "aidlc-state.md"),
      `# AI-DLC State Tracking\n\n- **State Version**: 8\n- **Scope**: ${scope}\n- **Current Stage**: ${slug}\n- **Current Phase**: ${phase}\n- **Workflow Status**: in-progress\n\n## Stage Progress\n- [-] ${slug} — EXECUTE\n`,
    );
  };
  return { root, record, command, state, graph };
}

beforeAll(() => {
  for (const harness of ["claude", "codex"]) {
    const built = Bun.spawnSync(
      [process.execPath, join(repository, ".codex/tools/aidlc-plugin-build.ts"), join(repository, "ddd"), harness],
      { stdout: "pipe", stderr: "pipe" },
    );
    expect(built.exitCode, built.stderr.toString()).toBe(0);
  }
});
afterAll(() => {
  for (const root of roots) rmSync(root, { recursive: true, force: true });
});

describe("DDD gate integration", () => {
  test("a valid canonical model opens its real gate", () => {
    const f = fixture();
    f.state("ddd-domain-modeling");
    const model = DESIGN_CASES.find((entry) => entry.name === "clean-complete");
    if (!model) throw new Error("model fixture missing");
    for (const [path, content] of Object.entries(model.files)) write(join(f.record, path), content);
    const result = f.command("orchestrate", [
      "report",
      "--stage",
      "ddd-domain-modeling",
      "--result",
      "awaiting-approval",
    ]);
    expect(result.code, result.output).toBe(0);
    expect(result.output).toContain("Recorded awaiting-approval");
  });

  test("rejects a functional design whose required DDD declaration is absent", () => {
    const f = fixture();
    f.state("functional-design", "construction");
    write(join(f.record, "construction/functional-design/functional-spec.md"), "# 機能設計\n\nDDD宣言がない。\n");
    const result = f.command("orchestrate", [
      "report",
      "--stage",
      "functional-design",
      "--result",
      "awaiting-approval",
    ]);
    expect(result.output).not.toContain("Recorded awaiting-approval");
    expect(result.output).toContain("ddd-mapping-declarations");
  });
});

function specimen(sensor: string, name: string) {
  const entry = DESIGN_CASES.find((item) => item.sensor === sensor && item.name === name);
  if (!entry) throw new Error(`fixture missing: ${sensor}/${name}`);
  return structuredClone(entry);
}

function materialize(f: ReturnType<typeof fixture>, files: Record<string, string>) {
  for (const [path, content] of Object.entries(files)) {
    write(join(f.record, path.replace("construction/u1/", "construction/")), content);
  }
}

function openGate(f: ReturnType<typeof fixture>, slug: string) {
  return f.command("orchestrate", ["report", "--stage", slug, "--result", "awaiting-approval"]);
}

function expectRejected(result: ReturnType<typeof openGate>, detail: string) {
  expect(result.output).not.toContain("Recorded awaiting-approval");
  expect(result.output).toContain(detail);
}

for (const harness of ["claude", "codex"] as const) {
  describe(`${harness}: DDD approval admission`, () => {
    test.each(["ddd-domain-model-yaml.md", "ddd-domain-model.md"])(
      "missing %s is rejected through the surviving artifact",
      (filename) => {
        const f = fixture(harness);
        f.state("ddd-domain-modeling");
        const files = specimen("ddd-model-completeness", "clean-complete").files;
        delete files[`inception/ddd-domain-modeling/${filename}`];
        materialize(f, files);
        expectRejected(openGate(f, "ddd-domain-modeling"), "ddd-model-completeness");
      },
    );

    test("an absent model artifact set cannot open the gate", () => {
      const f = fixture(harness);
      f.state("ddd-domain-modeling");
      expectRejected(openGate(f, "ddd-domain-modeling"), "REQUIRED_ARTIFACTS_MISSING");
    });

    test.each(["clean-complete", "violation-schema"])("model gate handles %s", (name) => {
      const f = fixture(harness);
      f.state("ddd-domain-modeling");
      materialize(f, specimen("ddd-model-completeness", name).files);
      const result = openGate(f, "ddd-domain-modeling");
      if (name === "clean-complete") expect(result.output).toContain("Recorded awaiting-approval");
      else expectRejected(result, "ddd-model-completeness");
    });

    test("domain design requires its mapping even if components exist", () => {
      const f = fixture(harness);
      f.state("domain-design");
      write(join(f.record, "inception/domain-design/components.md"), "# Components\n");
      expectRejected(openGate(f, "domain-design"), "ddd-mapping-declarations");
    });

    for (const [slug, artifact, sensor, name] of [
      ["functional-design", "functional-spec.md", "ddd-mapping-declarations", "violation-use-case-item"],
      ["infrastructure-design", "cicd-pipeline.md", "ddd-layer-structure", "clean"],
    ]) {
      test(`${slug}: a complete embedded declaration opens the gate`, () => {
        const f = fixture(harness);
        f.state(slug, "construction");
        const entry = specimen(sensor, name);
        const path = `construction/u1/${slug}/${artifact}`;
        entry.files[path] = entry.files[path].replace(
          "re_execution_basis: \n",
          "re_execution_basis: idempotency none\n",
        );
        materialize(f, entry.files);
        expect(openGate(f, slug).output).toContain("Recorded awaiting-approval");
      });

      test(`${slug}: an absent DDD section is rejected`, () => {
        const f = fixture(harness);
        f.state(slug, "construction");
        write(join(f.record, `construction/${slug}/${artifact}`), "# 設計\nDDD宣言がない。\n");
        expectRejected(openGate(f, slug), sensor);
      });

      test(`${slug}: a missing declaration artifact is detected from another registered output`, () => {
        const f = fixture(harness);
        f.state(slug, "construction");
        write(join(f.record, `construction/${slug}/traceability.json`), "{}\n");
        expectRejected(openGate(f, slug), sensor);
      });

      test(`${slug}: an absent declaration list is not treated as an empty list`, () => {
        const f = fixture(harness);
        f.state(slug, "construction");
        const heading = slug === "functional-design" ? "DDD Use-case Declarations" : "DDD Layer Structure";
        write(
          join(f.record, `construction/${slug}/${artifact}`),
          `# 設計\n\n## ${heading}\n\n\`\`\`yaml\nschema_version: 1\nmodel_ref: inception/ddd-domain-modeling/ddd-domain-model-yaml.md\n\`\`\`\n`,
        );
        expectRejected(openGate(f, slug), sensor);
      });
    }

    test("embedded declarations retain the core Unit applicability", () => {
      const f = fixture(harness);
      const functional = f.graph.find((s) => s.slug === "functional-design");
      const infrastructure = f.graph.find((s) => s.slug === "infrastructure-design");
      if (!functional || !infrastructure) throw new Error("stages missing");
      for (const kind of ["service", "spec", "ui", "library", "packaging"] as const) {
        const fd = filterProducesByKind(functional.produces_kinds ?? {}, functional.produces, kind);
        const ia = filterProducesByKind(infrastructure.produces_kinds ?? {}, infrastructure.produces, kind);
        expect(fd.includes("functional-spec")).toBe(kind !== "packaging");
        expect(ia.includes("cicd-pipeline")).toBe(kind !== "spec");
      }
    });
  });
}

// Opt-in red probe for the upstream 2.8.2 gap, not a plugin regression.
// Run with DDD_VERIFY_FRAMEWORK_SINGLE=1 to require the missing guarantee.
test.skipIf(process.env.DDD_VERIFY_FRAMEWORK_SINGLE !== "1")(
  "standard isolated completion must reject missing DDD artifacts",
  () => {
    const f = fixture();
    f.state("ddd-domain-modeling");
    const started = f.command("orchestrate", ["next", "--stage", "ddd-domain-modeling", "--single"]);
    expect(started.output).not.toContain('"kind":"error"');
    const result = f.command("orchestrate", [
      "report",
      "--stage",
      "ddd-domain-modeling",
      "--single",
      "--result",
      "completed",
    ]);
    expect(result.output).not.toContain('"kind":"done"');
  },
);

for (const harness of ["claude", "codex"] as const) {
  describe(`${harness}: packaging gates`, () => {
    for (const [name, stage, allowed, sensor] of [
      ["clean-packaging-declarations", "domain-design", true, "ddd-mapping-declarations"],
      ["violation-packaging-technical-name", "domain-design", false, "ddd-mapping-declarations"],
      ["clean-packaging-inline", "code-generation", true, "ddd-rust-domain"],
      ["violation-packaging-empty-inline", "code-generation", false, "ddd-rust-domain"],
    ] as const) {
      test(`${stage}: ${name}`, () => {
        const entry = PACKAGING_CASES.find((candidate) => candidate.name === name);
        if (!entry) throw new Error(`package fixture missing: ${name}`);
        const f = fixture(harness);
        f.state(
          stage,
          stage === "code-generation" ? "construction" : "inception",
          stage === "code-generation" ? "feature" : "refactor",
        );
        for (const [path, content] of Object.entries(entry.files)) write(join(f.record, path), content);
        for (const [path, content] of Object.entries(entry.workspace ?? {})) write(join(f.root, path), content);
        const result = openGate(f, stage);
        if (allowed) expect(result.output).toContain("Recorded awaiting-approval");
        else expectRejected(result, sensor);
      });
    }
  });
}
