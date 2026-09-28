/**
 * Drives the DDD gates of a project the plugin was installed into, through the entry points the
 * installed AI-DLC offers a model: the approval (`report --result awaiting-approval`, which fires
 * the gate sensors, then `report --result approved`), the standalone completion
 * (`next --single`, then `report --single --result completed`), and the manual check the standalone
 * completion instructions prescribe (`aidlc engine sensor fire`).
 *
 * The record is one intent without Units, so an artifact a golden case places under
 * `construction/u1/` is written straight under the stage, as the approval tests of the composed
 * project do. The stage graph the engine reads is a copy outside the project that keeps only the
 * gate sensors under test, so the installed files stay as the installer left them.
 */

import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { artifactFilename } from "../../../.codex/tools/aidlc-artifact-vocabulary.ts";
import type { GraphStage } from "../../../.codex/tools/aidlc-graph.ts";

const INTENT = "gate-test";
const COMMAND_TIMEOUT_MS = 60_000;

export interface CommandRun {
  readonly exitCode: number | null;
  readonly stdout: string;
  readonly stderr: string;
}

/** The last line a command printed that reads as one JSON object, or undefined when none does. */
export function lastJson(run: CommandRun): Record<string, unknown> | undefined {
  const lines = run.stdout.split("\n").filter((line) => line.trim().length > 0);
  for (const line of lines.reverse()) {
    try {
      const parsed: unknown = JSON.parse(line);
      if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed))
        return parsed as Record<string, unknown>;
    } catch {
      // A line that is not JSON is not the verdict; the search goes on to the line before it.
    }
  }
  return undefined;
}

/**
 * The manual check passes only on a clean exit whose last JSON line is `result: passed` without a
 * `note`: AI-DLC reports a sensor that could not run as a pass carrying a note, and the gate admits
 * no such pass.
 */
export function manualCheckPasses(run: CommandRun): boolean {
  const verdict = lastJson(run);
  return run.exitCode === 0 && verdict?.result === "passed" && verdict.note === undefined;
}

export interface InstalledGates {
  /** The record directory of the intent the gates run on. */
  readonly record: string;
  /** Starts `slug` afresh: the record is emptied and holds only a state with the stage in progress. */
  startStage(slug: string, phase: string, scope: string): void;
  /** Writes record-relative files, placing what a case writes under `construction/u1/` under the stage. */
  writeRecord(files: Readonly<Record<string, string>>): void;
  /** Writes a placeholder for every registered output of `slug` the record does not hold, except `except`. */
  fillOtherOutputs(slug: string, phase: string, except: readonly string[]): void;
  /** The record-relative path the stage's artifact named `filename` is written to. */
  artifactPath(slug: string, phase: string, filename: string): string;
  openGate(slug: string): CommandRun;
  approve(slug: string): CommandRun;
  completeStandalone(slug: string): { readonly started: CommandRun; readonly reported: CommandRun };
  manualCheck(sensor: string, slug: string, outputPath: string): CommandRun;
}

/**
 * The gates of the project at `project`, installed for the harness whose directory is `leaf`.
 * `scratch` is a directory outside the project the narrowed stage graph is written to; `sensors`
 * decides which gate sensors the graph keeps.
 */
export function installedGates(
  project: string,
  leaf: string,
  scratch: string,
  sensors: (id: string) => boolean,
): InstalledGates {
  const graph = JSON.parse(readFileSync(join(project, leaf, "tools/data/stage-graph.json"), "utf8")) as GraphStage[];
  for (const stage of graph) stage.sensors_applicable = stage.sensors_applicable.filter((s) => sensors(s.id));
  const graphPath = join(scratch, "stage-graph.json");
  writeFileSync(graphPath, JSON.stringify(graph));

  const record = join(project, "aidlc/spaces/default/intents", INTENT);
  const env: Record<string, string | undefined> = {
    ...process.env,
    AIDLC_PROJECT_DIR: project,
    CLAUDE_PROJECT_DIR: project,
    AIDLC_HARNESS_DIR: leaf,
    AIDLC_STAGE_GRAPH: graphPath,
    AIDLC_SKIP_SUMMARY_CONFIRMATION_GUARD: "1",
    AIDLC_SKIP_REVIEWER_GATE_GUARD: "1",
    AIDLC_SKIP_HUMAN_PRESENCE_GUARD: "1",
  };
  delete env.AIDLC_COMPILED_EXECUTABLE;
  delete env.AIDLC_SKIP_ARTIFACT_GUARD;

  const write = (path: string, content: string) => {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, content);
  };
  const run = (tool: string, args: readonly string[]): CommandRun => {
    const result = Bun.spawnSync([process.execPath, join(project, leaf, "tools", tool), ...args], {
      cwd: project,
      env,
      stdout: "pipe",
      stderr: "pipe",
      timeout: COMMAND_TIMEOUT_MS,
      killSignal: "SIGKILL",
    });
    return { exitCode: result.exitCode, stdout: result.stdout.toString(), stderr: result.stderr.toString() };
  };
  const stageOf = (slug: string): GraphStage => {
    const stage = graph.find((candidate) => candidate.slug === slug);
    if (stage === undefined) throw new Error(`the installed stage graph has no stage ${slug}`);
    return stage;
  };
  const artifactPath = (slug: string, phase: string, filename: string) => `${phase}/${slug}/${filename}`;

  return {
    record,
    startStage(slug, phase, scope) {
      rmSync(record, { recursive: true, force: true });
      write(join(project, "aidlc/spaces/default/intents/active-intent"), `${INTENT}\n`);
      const modelLine = slug === "ddd-domain-modeling" ? "" : "- [x] ddd-domain-modeling — EXECUTE\n";
      write(
        join(record, "aidlc-state.md"),
        `# AI-DLC State Tracking\n\n- **State Version**: 8\n- **Scope**: ${scope}\n- **Current Stage**: ${slug}\n- **Current Phase**: ${phase}\n- **Workflow Status**: in-progress\n\n## Stage Progress\n${modelLine}- [-] ${slug} — EXECUTE\n`,
      );
    },
    writeRecord(files) {
      for (const [path, content] of Object.entries(files))
        write(join(record, path.replace("construction/u1/", "construction/")), content);
    },
    fillOtherOutputs(slug, phase, except) {
      for (const artifact of stageOf(slug).produces) {
        const filename = artifactFilename(artifact);
        const path = join(record, artifactPath(slug, phase, filename));
        if (!except.includes(filename) && !existsSync(path)) write(path, "# Supporting artifact\n");
      }
    },
    artifactPath,
    openGate(slug) {
      return run("aidlc-orchestrate.ts", ["report", "--stage", slug, "--result", "awaiting-approval"]);
    },
    approve(slug) {
      const reviewer = stageOf(slug).reviewer;
      if (reviewer !== undefined) {
        const review = ["review", "--stage", slug, "--reviewer", reviewer, "--iteration", "1"];
        const requested = run("aidlc-log.ts", review);
        const reviewFile = lastJson(requested)?.reviewFile;
        if (requested.exitCode !== 0 || typeof reviewFile !== "string")
          throw new Error(`the review of ${slug} was not requested: ${requested.stdout}${requested.stderr}`);
        write(
          join(project, reviewFile),
          `**Verdict:** READY\n\n**Reviewer:** ${reviewer}\n\n**Iteration:** 1\n`,
        );
        const recorded = run("aidlc-log.ts", [...review, "--verdict", "READY"]);
        if (recorded.exitCode !== 0)
          throw new Error(`the review of ${slug} was not recorded: ${recorded.stdout}${recorded.stderr}`);
      }
      return run("aidlc-orchestrate.ts", ["report", "--stage", slug, "--result", "approved", "--user-input", "Approve"]);
    },
    completeStandalone(slug) {
      const started = run("aidlc-orchestrate.ts", ["next", "--stage", slug, "--single"]);
      const reported = run("aidlc-orchestrate.ts", ["report", "--stage", slug, "--single", "--result", "completed"]);
      return { started, reported };
    },
    manualCheck(sensor, slug, outputPath) {
      return run("aidlc.ts", ["engine", "sensor", "fire", sensor, "--stage", slug, "--output-path", outputPath]);
    },
  };
}
