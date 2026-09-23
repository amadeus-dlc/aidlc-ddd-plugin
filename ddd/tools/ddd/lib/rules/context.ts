/**
 * InspectionContext assembly (U5 WF1) — turns a run context into the facts the
 * rule evaluators consume.
 */

import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { readSourceClaims, readStageStatus, type SensorRunContext } from "../runtime/context.ts";
import { ToolUnavailableError } from "../runtime/runtime.ts";
import type { AnalyzerRuntime } from "../rust/analyzer.ts";
import { parse } from "../rust/analyzer.ts";
import { type DomainFactSet, type RustSourceFile, readDomainFacts } from "../rust/domain-facts/index.ts";
import { type NativeOutcome, nativeIssue } from "../rust/native/launch.ts";
import { MODEL_DATA_PATH } from "../schema/artifacts.ts";
import { loadDomainModel, OPERATION_OWNED_SCHEMA_VERSION } from "../schema/loader.ts";
import { finding, relPath } from "../sensors/common.ts";
import type { FindingInput } from "../shared/findings.ts";
import { assignLayers, classifyFile, type Layer, scanWorkspace } from "../workspace/resolver.ts";
import { IO_CRATES } from "./lists.ts";
import { buildEdges } from "./rust/edges.ts";
import { loadRustMapping } from "./rust/mapping.ts";
import { buildProgram, collectRustSources } from "./rust/program.ts";
import { buildSymbolTable } from "./rust/symbols.ts";
import type { InspectionContext, InspectionTarget, ModelAvailability } from "./types.ts";

export interface SensorConfig {
  sensor_id: string;
  target_layers: readonly Layer[];
  includes_query_side: boolean;
  report_layer_diagnostics?: boolean;
  /**
   * The native extractor rules (a) and (d) decide on, as the sensor entry classified it. `null` for
   * a sensor that declares neither rule, which then never launches it. A classification that is not
   * `ready` decides nothing on its own: it stops this run only once those rules have a file to
   * decide on.
   */
  domain_facts: NativeOutcome | null;
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
 * The one place an extractor rules (a) and (d) cannot be decided from becomes a stopped inspection.
 * A launch the entry classified as unusable, a run that did not answer, and an answer that does not
 * cover a file those rules are decided from all reach the same terminal, so an extractor that
 * cannot be read from never turns into a verdict. This is called only once those rules have a file
 * to decide on, which is what keeps a run with nothing to decide out of the terminal.
 *
 * `decidedFrom` names the files rules (a) and (d) are decided from. A file among them that the
 * extractor could not read decides nothing, and stopping here carries the reason the extractor
 * gave for it — a failure raised later, while the rules run, would be reported as an evaluation
 * error and drop that reason.
 */
function requireDomainFacts(
  extractor: NativeOutcome,
  contents: ReadonlyMap<string, Uint8Array>,
  decidedFrom: readonly string[],
): DomainFactSet {
  if (extractor.kind !== "ready") throw new ToolUnavailableError(nativeIssue(extractor).message);
  const sources: RustSourceFile[] = [...contents]
    .sort((a, b) => a[0].localeCompare(b[0], "en"))
    .map(([file, bytes]) => ({ file, source: new TextDecoder().decode(bytes) }));
  const result = readDomainFacts(extractor.binaryPath, sources);
  if (result.kind === "unavailable") throw new ToolUnavailableError(result.detail);
  const unread = [...new Set(decidedFrom)].filter((file) => !result.facts.publicMembers.has(file)).sort();
  if (unread.length > 0) {
    const reasons = result.facts.notes.filter((note) =>
      unread.some((file) => note.startsWith(`domain-facts.unresolved: ${file}:`)),
    );
    throw new ToolUnavailableError(
      `the native extractor did not read ${unread.join(", ")}, so rules (a) and (d) cannot be decided: ${reasons.join("; ")}`,
    );
  }
  return result.facts;
}

export function assembleContext(runtime: AnalyzerRuntime, run: SensorRunContext, config: SensorConfig): ContextResult {
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

  const collected = collectRustSources(runtime, workspaceRoot, assignments);

  const targets: InspectionTarget[] = [];
  const skipped: InspectionTarget[] = [];
  const opaque: string[] = [];
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
          const tree = parse(runtime, file, content);
          target.tree = tree;
          claimedContents.set(file, content);
          for (const region of tree.opaque_regions) {
            opaque.push(
              `analyzer.macro-opaque: ${region.file}:${region.span.start_line} (${region.macro_name ?? region.reason})`,
            );
          }
        } catch {
          /* unreadable file is skipped */
        }
        targets.push(target);
      } else {
        skipped.push(target);
      }
    }
  }

  // Rule (a) decides per claimed file and rule (d) collects getters across the whole program, so
  // one batch covers both: every crate source the program is built from, plus every claimed file.
  const factSources = new Map<string, Uint8Array>([...collected.contents, ...claimedContents]);
  const decidedFrom = [
    ...targets.flatMap((target) => (target.tree ? [target.tree.file] : [])),
    ...collected.crates
      .filter((crate) => crate.assignment.layer === "domain")
      .flatMap((crate) => crate.inventory.sources.map((source) => source.file)),
  ];
  // The extractor is required where the rules that read it have something to decide: with no target
  // among the claimed files, rules (a) and (d) evaluate nothing, so its classification cannot change
  // this verdict and an unusable one is not this run's terminal.
  const domainFacts =
    config.domain_facts !== null && targets.length > 0
      ? requireDomainFacts(config.domain_facts, factSources, decidedFrom)
      : null;

  const program = buildProgram(runtime, collected, domainFacts);
  const rustMapping = loadRustMapping(run.record_dir);
  if (rustMapping.kind === "invalid") program.notes.add("replay.disabled: aggregate mapping is invalid");
  const symbols = buildSymbolTable(program, model, rustMapping.kind === "loaded" ? rustMapping.view.aggregates : []);

  const edges = buildEdges(targets, assignments, workspaceRoot, IO_CRATES);
  const layerDiagnostics = [
    ...workspace.diagnostics.map((d) => ({ code: d.code, file: d.file, message: d.message })),
    ...assignments.flatMap((a) => a.diagnostics.map((d) => ({ code: d.code, file: d.file, message: d.message }))),
  ];

  const noteParts: string[] = [];
  if (skipped.length > 0) noteParts.push(`${skipped.length} files outside ${config.target_layers.join("/")}`);
  if (opaque.length > 0) noteParts.push(...opaque);
  if (domainFacts) noteParts.push(...domainFacts.notes);
  if (model.note) noteParts.push(model.note);

  const context: InspectionContext = {
    analyzer: runtime,
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
    opaque,
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
