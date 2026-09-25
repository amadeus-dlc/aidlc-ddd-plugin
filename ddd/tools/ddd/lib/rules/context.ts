/**
 * InspectionContext assembly (U5 WF1) — turns a run context into the facts the
 * rule evaluators consume.
 */

import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { rustSourcesUnder } from "../packaging/rust-modules.ts";
import { readSourceClaims, readStageStatus, type SensorRunContext } from "../runtime/context.ts";
import { ToolUnavailableError } from "../runtime/runtime.ts";
import { type DomainFactSet, type RustSourceFile, requireDomainFacts } from "../rust/domain-facts/index.ts";
import type { NativeOutcome } from "../rust/native/launch.ts";
import { MODEL_DATA_PATH } from "../schema/artifacts.ts";
import { loadDomainModel, OPERATION_OWNED_SCHEMA_VERSION } from "../schema/loader.ts";
import { finding, relPath } from "../sensors/common.ts";
import type { FindingInput } from "../shared/findings.ts";
import { assignLayers, classifyFile, type Layer, scanWorkspace } from "../workspace/resolver.ts";
import { IO_CRATES } from "./lists.ts";
import { buildEdges } from "./rust/edges.ts";
import { loadRustMapping } from "./rust/mapping.ts";
import { buildProgram, collectRustSources, PROGRAM_LAYERS } from "./rust/program.ts";
import { buildSymbolTable } from "./rust/symbols.ts";
import type { InspectionContext, InspectionTarget, ModelAvailability } from "./types.ts";

export interface SensorConfig {
  sensor_id: string;
  target_layers: readonly Layer[];
  includes_query_side: boolean;
  report_layer_diagnostics?: boolean;
  /**
   * The native extractor every Rust rule decides on, as the sensor entry classified it. A
   * classification that is not `ready` decides nothing on its own: it stops this run only once
   * those rules have a file to decide on.
   */
  domain_facts: NativeOutcome;
}

export type ContextResult =
  | { kind: "empty"; note: string }
  | { kind: "failed"; findings: FindingInput[]; note?: string }
  | { kind: "ready"; context: InspectionContext; findings: FindingInput[]; note?: string };

function findWorkspaceRoot(filePath: string): { root: string; isWorkspace: boolean } | undefined {
  let current = dirname(filePath);
  let packageCandidate: string | undefined;
  for (let i = 0; i < 50; i++) {
    const cargo = join(current, "Cargo.toml");
    if (existsSync(cargo)) {
      try {
        const parsed = Bun.TOML.parse(readFileSync(cargo, "utf-8")) as Record<string, unknown>;
        if (parsed.workspace !== undefined) return { root: current, isWorkspace: true };
        if (parsed.package !== undefined && packageCandidate === undefined) packageCandidate = current;
      } catch {
        /* ignore */
      }
    }
    const parent = dirname(current);
    if (parent === current) break;
    current = parent;
  }
  return packageCandidate ? { root: packageCandidate, isWorkspace: false } : undefined;
}

/**
 * Stops the inspection when a file the rules are decided from carries no declarations.
 *
 * `decidedFrom` names those files: the claimed files the per-file rules run over, and every source
 * the program is built from, because a declaration hidden in any of them changes what the whole
 * program resolves to. A file among them the extractor could not read decides nothing, and stopping
 * here carries the reason the extractor gave for it — a failure raised later, while the rules run,
 * would be reported as an evaluation error and drop that reason.
 */
function requireDecisionBase(facts: DomainFactSet, decidedFrom: readonly string[]): void {
  const unread = [...new Set(decidedFrom)].filter((file) => !facts.files.has(file)).sort();
  if (unread.length === 0) return;
  const reasons = facts.notes.filter((note) =>
    unread.some((file) => note.startsWith(`domain-facts.unresolved: ${file}:`)),
  );
  // A file can go unread without the extractor recording a reason for it — a source the batch could
  // not even open carries no note. Naming the files is the answer then, rather than a dangling colon.
  const detail = reasons.length > 0 ? `: ${reasons.join("; ")}` : "";
  throw new ToolUnavailableError(
    `the native extractor did not read ${unread.join(", ")}, so the Rust rules cannot be decided${detail}`,
  );
}

export function assembleContext(run: SensorRunContext, config: SensorConfig): ContextResult {
  const claimsResult = readSourceClaims(run, { extensions: [".rs"] });
  if (!claimsResult.ok) {
    return { kind: "failed", findings: [finding("runtime.claims", ".", claimsResult.reason)] };
  }
  const findings: FindingInput[] = [...claimsResult.findings];
  const rustClaims = claimsResult.claims.filter((claim) => !claim.repo || claim.repo.length > 0);
  if (rustClaims.length === 0) return { kind: "empty", note: "no rust sources claimed" };

  const roots = new Map<string, string[]>();
  for (const claim of rustClaims) {
    if (!claim.resolved_path) continue;
    const found = findWorkspaceRoot(claim.resolved_path);
    if (!found) {
      findings.push(
        finding("layer.unowned", relPath(run, claim.resolved_path), "claimed file has no Cargo workspace root"),
      );
      continue;
    }
    const root = found.root;
    if (!root.startsWith(run.workspace_root)) {
      findings.push(
        finding("layer.unowned", relPath(run, claim.resolved_path), "workspace root is outside the project root"),
      );
      continue;
    }
    const list = roots.get(root) ?? [];
    list.push(claim.path);
    roots.set(root, list);
  }
  if (roots.size === 0) return { kind: "failed", findings };

  const [workspaceRoot, rootClaims] = [...roots.entries()].sort((a, b) => a[0].localeCompare(b[0], "en"))[0];
  if (roots.size > 1) {
    findings.push(
      finding("workspace.multiple-roots", workspaceRoot, "claimed files span more than one Cargo workspace root"),
    );
  }

  const workspace = scanWorkspace(workspaceRoot);
  const assignments = assignLayers(workspace);

  // Model availability (BR3.4).
  const status = readStageStatus(run, "ddd-domain-modeling");
  let model: ModelAvailability;
  if (status.execution === "SKIP" || status.execution === "absent") {
    model = {
      status: status.execution === "SKIP" ? "skipped" : "absent",
      note: `domain-modeling is ${status.execution}; model-dependent checks (b, h, c-model, n-model) skipped`,
    };
  } else {
    const modelPath = join(run.record_dir, MODEL_DATA_PATH);
    const loaded = loadDomainModel(modelPath, OPERATION_OWNED_SCHEMA_VERSION);
    if (!loaded.ok) {
      model = { status: "invalid" };
      findings.push(
        finding(
          "model.invalid",
          relPath(run, modelPath),
          "domain-modeling ran but ddd-domain-model-yaml.md did not load",
        ),
      );
    } else {
      model = { status: "available", index: loaded.index };
    }
  }

  const targets: InspectionTarget[] = [];
  const skipped: InspectionTarget[] = [];
  const claimByPath = new Map(rustClaims.filter((c) => c.resolved_path).map((c) => [c.resolved_path as string, c]));
  const claimedContents = new Map<string, Uint8Array>();

  for (const [root, paths] of [[workspaceRoot, rootClaims]] as [string, string[]][]) {
    for (const claimPath of paths.sort((a, b) => a.localeCompare(b, "en"))) {
      const claim = claimByPath.get(join(root, claimPath)) ?? rustClaims.find((c) => c.path === claimPath);
      if (!claim?.resolved_path) continue;
      const file = claim.path;
      const classification = classifyFile(assignments, file);
      const target: InspectionTarget = { claim, classification };
      if (classification.crate_name) target.crate_name = classification.crate_name;
      const inLayer = config.target_layers.includes(classification.effective_layer as Layer);
      const querySide = config.includes_query_side && classification.cqrs_side === "query";
      if (classification.role === "crate-source" && (inLayer || querySide)) {
        try {
          const content = readFileSync(join(root, file));
          target.file = file;
          claimedContents.set(file, content);
        } catch {
          // A claim that cannot be read stays a target, without a file of its own: it is still one of
          // the files the rules have to decide, so it keeps the extractor required for this run, and
          // the per-file rules it carries no declarations for report nothing rather than passing it.
        }
        targets.push(target);
      } else {
        skipped.push(target);
      }
    }
  }

  // Every Rust rule decides on the extractor, so it is required exactly where those rules have a
  // file to decide: with no target among the claimed files none of them evaluates anything, its
  // classification cannot change this verdict, and an unusable one is not this run's terminal.
  // The program is what those rules are decided over, so it is not built for a run without one.
  const facts: DomainFactSet =
    targets.length > 0
      ? requireDomainFacts(config.domain_facts, batchSources(workspaceRoot, assignments, claimedContents))
      : { files: new Map(), notes: [] };
  const collected =
    targets.length > 0
      ? collectRustSources(facts, workspaceRoot, assignments)
      : { crates: [], workspaceCrates: new Set<string>() };
  requireDecisionBase(facts, [
    ...targets.flatMap((target) => (target.file ? [target.file] : [])),
    ...collected.crates.flatMap((crate) => crate.inventory.sources.map((source) => source.decidedFrom)),
  ]);

  const program = buildProgram(collected, facts);
  const rustMapping = loadRustMapping(run.record_dir);
  if (rustMapping.kind === "invalid") program.notes.add("replay.disabled: aggregate mapping is invalid");
  const symbols = buildSymbolTable(program, model, rustMapping.kind === "loaded" ? rustMapping.view.aggregates : []);

  const edges = buildEdges(facts, targets, assignments, workspaceRoot, IO_CRATES);
  const layerDiagnostics = [
    ...workspace.diagnostics.map((d) => ({ code: d.code, file: d.file, message: d.message })),
    ...assignments.flatMap((a) => a.diagnostics.map((d) => ({ code: d.code, file: d.file, message: d.message }))),
  ];

  const noteParts: string[] = [];
  if (skipped.length > 0) noteParts.push(`${skipped.length} files outside ${config.target_layers.join("/")}`);
  noteParts.push(...facts.notes);
  if (model.note) noteParts.push(model.note);

  const context: InspectionContext = {
    rustMapping,
    run,
    workspace,
    assignments,
    targets,
    skipped,
    symbols,
    program,
    model,
    denylist: IO_CRATES,
    edges,
    layerDiagnostics,
    targetLayers: config.target_layers,
    includesQuerySide: config.includes_query_side,
  };
  if (targets.length === 0 && findings.length === 0) {
    return { kind: "empty", note: "no rust sources claimed" };
  }
  return { kind: "ready", context, findings, ...(noteParts.length > 0 ? { note: noteParts.join("; ") } : {}) };
}

/**
 * The one batch the inspection sends: every Rust source of every crate the program is built from,
 * plus every claimed file. The module walk decides which file to open next from the declarations of
 * the one it is on, so the batch covers each program crate's sources in full rather than only the
 * ones a walk has already reached.
 */
function batchSources(
  workspaceRoot: string,
  assignments: readonly { crate_name: string; path: string; layer: Layer }[],
  claimed: ReadonlyMap<string, Uint8Array>,
): RustSourceFile[] {
  const decoder = new TextDecoder();
  const sources = new Map<string, string>();
  for (const [file, bytes] of claimed) sources.set(file, decoder.decode(bytes));
  for (const assignment of assignments) {
    if (!PROGRAM_LAYERS.includes(assignment.layer)) continue;
    for (const file of rustSourcesUnder(workspaceRoot, join(workspaceRoot, assignment.path))) {
      if (sources.has(file)) continue;
      try {
        sources.set(file, readFileSync(join(workspaceRoot, file), "utf-8"));
      } catch {
        // A source that cannot be read carries no declarations to ask about. The module walk
        // reports it where a declaration names it, which is where it is this crate's defect.
      }
    }
  }
  return [...sources].sort((a, b) => a[0].localeCompare(b[0], "en")).map(([file, source]) => ({ file, source }));
}
